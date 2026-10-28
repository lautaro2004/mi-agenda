import fs from "node:fs/promises";
import path from "node:path";

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  type WASocket,
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";

import type { MessageSender, WhatsAppConnection } from "@/lib/types";
import { whatsappEvents } from "@/modules/whatsapp/events";
import { withAiDisclosure } from "@/modules/whatsapp/ai-disclosure";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import { extractMessageText, resolvePhoneJid, syncIncomingMessage } from "@/modules/whatsapp/messages/sync";
import { syncHistoricalMessages } from "@/modules/whatsapp/messages/history-sync";
import { getSessionsDir } from "@/modules/whatsapp/sessions/dir";
import { getAuthState, sessionRepository } from "@/modules/whatsapp/sessions/store";

const RECONNECT_DELAY_MS = 3000;

// fetchLatestBaileysVersion() consulta GitHub en CADA conexión: si responde
// lento (o no responde), el QR tarda lo mismo. Se cachea y tiene un tope de
// espera; si falla se usa la versión incluida en Baileys.
const VERSION_TTL_MS = 6 * 60 * 60 * 1000;
const VERSION_TIMEOUT_MS = 3000;
type WaVersion = Awaited<ReturnType<typeof fetchLatestBaileysVersion>>["version"];
let cachedVersion: { version: WaVersion; at: number } | null = null;

async function resolveWaVersion(): Promise<WaVersion | undefined> {
  if (cachedVersion && Date.now() - cachedVersion.at < VERSION_TTL_MS) return cachedVersion.version;
  try {
    const result = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), VERSION_TIMEOUT_MS)),
    ]);
    if (result?.version) {
      cachedVersion = { version: result.version, at: Date.now() };
      return result.version;
    }
    console.warn("[WhatsApp] No se pudo consultar la última versión a tiempo; uso la incluida en Baileys.");
  } catch (error) {
    console.warn("[WhatsApp] Error consultando la versión de WhatsApp Web; uso la incluida:", error);
  }
  return cachedVersion?.version;
}

// "warn" por defecto (antes "silent"): si WhatsApp rechaza la conexión, queda
// registrado en los logs del worker en vez de fallar en silencio. Se puede
// subir a "info"/"debug" con WHATSAPP_LOG_LEVEL para diagnosticar.
const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || "warn" });

class WhatsAppConnectionManager {
  private sockets = new Map<string, WASocket>();
  private connections = new Map<string, WhatsAppConnection>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private connecting = new Set<string>();
  private historySynced = new Set<string>();

  private getConnection(businessId: string): WhatsAppConnection {
    const existing = this.connections.get(businessId);
    if (existing) return existing;

    const created: WhatsAppConnection = {
      status: "disconnected",
      phoneNumber: null,
      connectedAt: null,
      lastError: null,
      aiEnabled: true,
      qr: null,
    };
    this.connections.set(businessId, created);
    return created;
  }

  getStatus(businessId: string): WhatsAppConnection {
    return this.getConnection(businessId);
  }

  // Persistido en Business.whatsappAiEnabled: antes vivía solo en memoria y
  // un reinicio del servidor volvía a prender la IA de un negocio que había
  // elegido modo manual.
  async setAiEnabled(businessId: string, enabled: boolean): Promise<void> {
    const { prisma } = await import("@/lib/prisma");
    await prisma.business.update({ where: { id: businessId }, data: { whatsappAiEnabled: enabled } });
    this.updateConnection(businessId, { aiEnabled: enabled });
  }

  private async loadAiEnabled(businessId: string): Promise<void> {
    try {
      const { prisma } = await import("@/lib/prisma");
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { whatsappAiEnabled: true },
      });
      if (business) this.updateConnection(businessId, { aiEnabled: business.whatsappAiEnabled });
    } catch (error) {
      console.error("[WhatsApp] No se pudo leer el estado de la IA:", error);
    }
  }

  private updateConnection(businessId: string, patch: Partial<WhatsAppConnection>) {
    const updated = { ...this.getConnection(businessId), ...patch };
    this.connections.set(businessId, updated);
    whatsappEvents.emit(businessId, { type: "connection", payload: updated });
    return updated;
  }

  async connect(businessId: string): Promise<void> {
    const current = this.getConnection(businessId);
    if (current.status === "connected" || current.status === "connecting" || this.connecting.has(businessId)) {
      return;
    }

    this.connecting.add(businessId);
    this.clearReconnectTimer(businessId);
    this.updateConnection(businessId, { status: "connecting", lastError: null, qr: null });
    // Antes de escuchar mensajes: así ningún mensaje se procesa con el
    // default en memoria (IA prendida) cuando el negocio eligió modo manual.
    await this.loadAiEnabled(businessId);

    try {
      const startedAt = Date.now();
      const [{ state, saveCreds }, version] = await Promise.all([getAuthState(businessId), resolveWaVersion()]);

      const sock = makeWASocket({
        ...(version ? { version } : {}),
        auth: state,
        logger,
      });
      console.log(`[WhatsApp] Socket creado negocio=${businessId} en ${Date.now() - startedAt}ms`);

      this.sockets.set(businessId, sock);

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", (update) => {
        void this.handleConnectionUpdate(businessId, update);
      });

      // Contactos identificados por LID → se resuelven al teléfono real antes
      // de crear la conversación (así el número se ve bien y el ID de la
      // conversación es estable).
      const lookupPhone = async (lid: string) => sock.signalRepository?.lidMapping?.getPNForLID(lid);

      sock.ev.on("messages.upsert", ({ messages, type }) => {
        void (async () => {
          await Promise.all(messages.map((m) => resolvePhoneJid(m, lookupPhone)));
          if (type === "notify") {
            for (const message of messages) {
              syncIncomingMessage(businessId, message);
              if (!message.key.fromMe) {
                void this.handleCustomerMessage(businessId, message.key.remoteJid ?? "", message);
              }
            }
          } else if (type === "append") {
            syncHistoricalMessages(businessId, messages);
          }
        })().catch((error) => console.error("[WhatsApp] Error procesando mensajes entrantes:", error));
      });

      sock.ev.on("messaging-history.set", ({ messages }) => {
        if (this.historySynced.has(businessId)) return;
        this.historySynced.add(businessId);
        void Promise.all(messages.map((m) => resolvePhoneJid(m, lookupPhone)))
          .then(() => syncHistoricalMessages(businessId, messages))
          .catch((error) => console.error("[WhatsApp] Error importando historial:", error));
      });
    } catch (error) {
      console.error(`[WhatsApp] No se pudo iniciar la conexión negocio=${businessId}:`, error);
      this.updateConnection(businessId, {
        status: "error",
        lastError: error instanceof Error ? error.message : "No se pudo iniciar la conexión.",
      });
    } finally {
      this.connecting.delete(businessId);
    }
  }

  private async handleConnectionUpdate(
    businessId: string,
    update: Partial<{
      connection: "open" | "connecting" | "close";
      qr?: string;
      lastDisconnect?: { error?: unknown; date: Date };
    }>
  ): Promise<void> {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log(`[WhatsApp] QR generado negocio=${businessId}`);
      const qrDataUrl = await QRCode.toDataURL(qr);
      this.updateConnection(businessId, { status: "connecting", qr: qrDataUrl, lastError: null });
      sessionRepository.setStatus(businessId, "connecting");
      return;
    }

    if (connection === "open") {
      const sock = this.sockets.get(businessId);
      const phoneNumber = sock?.user?.id ? `+${jidNormalizedUser(sock.user.id).split("@")[0]}` : null;
      const connectedAt = new Date().toISOString();

      this.updateConnection(businessId, {
        status: "connected",
        phoneNumber,
        connectedAt,
        lastError: null,
        qr: null,
      });
      sessionRepository.update(businessId, {
        status: "connected",
        phoneNumber,
        connectedAt,
        lastError: null,
      });
      return;
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
        ?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const closeReason = (lastDisconnect?.error as { message?: string } | undefined)?.message ?? "sin detalle";
      console.error(`[WhatsApp] Conexión cerrada negocio=${businessId} código=${statusCode ?? "?"} motivo="${closeReason}" cerradoPorUsuario=${loggedOut}`);

      this.cleanupSocket(businessId);

      if (loggedOut) {
        await this.clearSession(businessId);
        this.historySynced.delete(businessId);
        this.updateConnection(businessId, {
          status: "disconnected",
          phoneNumber: null,
          connectedAt: null,
          qr: null,
          lastError: null,
        });
        sessionRepository.update(businessId, {
          status: "disconnected",
          phoneNumber: null,
          connectedAt: null,
          lastDisconnectedAt: new Date().toISOString(),
        });
        return;
      }

      this.updateConnection(businessId, {
        status: "reconnecting",
        lastError: `WhatsApp cerró la conexión (código ${statusCode ?? "?"}): ${closeReason}`,
      });
      sessionRepository.update(businessId, {
        status: "reconnecting",
        lastDisconnectedAt: new Date().toISOString(),
      });

      this.scheduleReconnect(businessId);
    }
  }

  private scheduleReconnect(businessId: string) {
    this.clearReconnectTimer(businessId);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(businessId);
      void this.connect(businessId);
    }, RECONNECT_DELAY_MS);
    this.reconnectTimers.set(businessId, timer);
  }

  private clearReconnectTimer(businessId: string) {
    const timer = this.reconnectTimers.get(businessId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(businessId);
    }
  }

  private cleanupSocket(businessId: string) {
    const sock = this.sockets.get(businessId);
    if (!sock) return;
    sock.ev.removeAllListeners("creds.update");
    sock.ev.removeAllListeners("connection.update");
    sock.ev.removeAllListeners("messages.upsert");
    this.sockets.delete(businessId);
  }

  private async clearSession(businessId: string) {
    const dir = path.join(getSessionsDir(), businessId);
    await fs.rm(dir, { recursive: true, force: true });
  }

  async disconnect(businessId: string): Promise<void> {
    this.clearReconnectTimer(businessId);
    const sock = this.sockets.get(businessId);

    if (sock) {
      try {
        await sock.logout();
      } catch {
        sock.end(undefined);
      }
      this.cleanupSocket(businessId);
    }

    await this.clearSession(businessId);

    this.updateConnection(businessId, {
      status: "disconnected",
      phoneNumber: null,
      connectedAt: null,
      qr: null,
      lastError: null,
    });
    sessionRepository.update(businessId, {
      status: "disconnected",
      phoneNumber: null,
      connectedAt: null,
      lastDisconnectedAt: new Date().toISOString(),
    });
  }

  async sendMessage(
    businessId: string,
    jid: string,
    text: string,
    sender: MessageSender = "business"
  ): Promise<void> {
    const sock = this.sockets.get(businessId);
    if (!sock || this.getConnection(businessId).status !== "connected") {
      throw new Error("WhatsApp no está conectado.");
    }

    await sock.sendMessage(jid, { text });

    conversationRepository.addMessage(
      businessId,
      jid,
      {
        id: `out-${Date.now()}`,
        sender,
        text,
        timestamp: new Date().toISOString(),
      },
      false
    );
  }

  private async handleCustomerMessage(
    businessId: string,
    jid: string,
    rawMessage: Parameters<typeof extractMessageText>[0]
  ): Promise<void> {
    if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return;

    const conversation = conversationRepository.get(businessId, jid);

    // Detección de leads: ANTES de cualquier corte por IA apagada o modo
    // manual — detectar un lead no es responder. Sin await: nunca demora la
    // respuesta de la IA, y un error acá nunca la corta.
    if (conversation) {
      const leadText = extractMessageText(rawMessage);
      void import("@/modules/inquiries/whatsapp-lead")
        .then(({ captureWhatsappLead }) =>
          captureWhatsappLead({
            businessId,
            conversationRef: jid,
            contactName: conversation.contactName,
            contactPhone: conversation.contactPhone,
            text: leadText,
          })
        )
        .then(() => import("@/modules/inquiries/qualification"))
        .then(({ scheduleLeadQualification }) =>
          // Calificación con IA (si el negocio la activó): se reprograma en
          // cada mensaje del cliente y corre cuando el chat queda quieto. Es
          // no-op si no hay una consulta "pending" para este número.
          scheduleLeadQualification({
            businessId,
            jid,
            contactPhone: conversation.contactPhone,
            getMessages: () => conversationRepository.get(businessId, jid)?.messages ?? [],
          })
        )
        .catch((error) => console.error("[Leads] Error detectando lead de WhatsApp:", error));
    }

    const connection = this.getConnection(businessId);
    if (!connection.aiEnabled) return;

    if (!conversation || conversation.manualMode) return;

    // Comprobantes de pago se interceptan ANTES del pipeline normal de IA:
    // processMessage() nunca vio el binario de una imagen (ver
    // modules/whatsapp/messages/media.ts). Devuelve null cuando no aplica
    // (no es imagen/documento, o no hay ningún turno pendiente de pago para
    // este número) y seguimos con el flujo de siempre — así que para
    // negocios sin seña activada esto es un no-op total.
    try {
      const { handleIncomingPaymentMessage } = await import("@/modules/whatsapp/payments/inbound");
      const paymentReply = await handleIncomingPaymentMessage({ businessId, jid, rawMessage, conversation });
      if (paymentReply) {
        await this.sendMessage(businessId, jid, withAiDisclosure(conversation, paymentReply.text), "ai");
        return;
      }
    } catch (error) {
      console.error("[Payments] Error procesando comprobante entrante:", error);
    }

    const text = extractMessageText(rawMessage);
    if (!text) return;

    try {
      const { processMessage } = await import("@/modules/ai/gateway");
      const aiStart = Date.now();
      const response = await processMessage({ conversationId: jid, businessId, message: text });
      const aiMs = Date.now() - aiStart;
      if (!response) return;

      const sendStart = Date.now();
      await this.sendMessage(businessId, jid, withAiDisclosure(conversation, response.text), "ai");
      // Tiempos separados para saber dónde está la demora (IA vs. envío).
      console.log(`[WhatsApp] Respuesta negocio=${businessId} ia=${aiMs}ms envio=${Date.now() - sendStart}ms`);

      if (response.escalateToHuman) {
        conversationRepository.setManualMode(businessId, jid, true);
        if (!conversation.labels.includes("human_required")) {
          conversationRepository.toggleLabel(businessId, jid, "human_required");
          // Mismo guard que evita duplicar la etiqueta: notifica al dueño
          // una sola vez por escalamiento, no en cada mensaje siguiente de
          // una conversación que ya quedó en modo manual.
          const { notifyHumanRequired } = await import("@/modules/notifications/service");
          void notifyHumanRequired({ businessId, jid, contactName: conversation.contactName });
        }
      } else if (response.labelHint && !conversation.labels.includes(response.labelHint)) {
        conversationRepository.toggleLabel(businessId, jid, response.labelHint);
      }
    } catch (error) {
      console.error("[AI] Error procesando mensaje:", error);
    }
  }

  async restore(businessId: string): Promise<void> {
    const dir = path.join(getSessionsDir(), businessId);
    try {
      const files = await fs.readdir(dir);
      if (files.length === 0) return;
    } catch {
      return;
    }

    await this.connect(businessId);
  }
}

declare global {
  var __whatsappConnectionManager: WhatsAppConnectionManager | undefined;
}

export const whatsappConnectionManager =
  globalThis.__whatsappConnectionManager ?? new WhatsAppConnectionManager();
globalThis.__whatsappConnectionManager = whatsappConnectionManager;
