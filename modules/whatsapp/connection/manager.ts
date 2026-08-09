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
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import { extractMessageText, syncIncomingMessage } from "@/modules/whatsapp/messages/sync";
import { syncHistoricalMessages } from "@/modules/whatsapp/messages/history-sync";
import { getAuthState, sessionRepository } from "@/modules/whatsapp/sessions/store";

const RECONNECT_DELAY_MS = 3000;
const SESSIONS_DIR = path.join(process.cwd(), ".whatsapp-sessions");

const logger = pino({ level: "silent" });

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

  setAiEnabled(businessId: string, enabled: boolean) {
    this.updateConnection(businessId, { aiEnabled: enabled });
  }

  private updateConnection(businessId: string, patch: Partial<WhatsAppConnection>) {
    const updated = { ...this.getConnection(businessId), ...patch };
    this.connections.set(businessId, updated);
    whatsappEvents.emit({ type: "connection", payload: updated });
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

    try {
      const { state, saveCreds } = await getAuthState(businessId);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        logger,
      });

      this.sockets.set(businessId, sock);

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", (update) => {
        void this.handleConnectionUpdate(businessId, update);
      });

      sock.ev.on("messages.upsert", ({ messages, type }) => {
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
      });

      sock.ev.on("messaging-history.set", ({ messages }) => {
        if (this.historySynced.has(businessId)) return;
        this.historySynced.add(businessId);
        syncHistoricalMessages(businessId, messages);
      });
    } catch (error) {
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

      this.updateConnection(businessId, { status: "reconnecting" });
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
    const dir = path.join(SESSIONS_DIR, businessId);
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

    const connection = this.getConnection(businessId);
    if (!connection.aiEnabled) return;

    const conversation = conversationRepository.get(jid);
    if (!conversation || conversation.manualMode) return;

    const text = extractMessageText(rawMessage);
    if (!text) return;

    try {
      const { processMessage } = await import("@/modules/ai/gateway");
      const response = await processMessage({ conversationId: jid, businessId, message: text });
      if (!response) return;

      await this.sendMessage(businessId, jid, response.text, "ai");

      if (response.escalateToHuman) {
        conversationRepository.setManualMode(jid, true);
        if (!conversation.labels.includes("human_required")) {
          conversationRepository.toggleLabel(jid, "human_required");
        }
      } else if (response.labelHint && !conversation.labels.includes(response.labelHint)) {
        conversationRepository.toggleLabel(jid, response.labelHint);
      }
    } catch (error) {
      console.error("[AI] Error procesando mensaje:", error);
    }
  }

  async restore(businessId: string): Promise<void> {
    const dir = path.join(SESSIONS_DIR, businessId);
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
