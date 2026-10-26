/**
 * Worker de WhatsApp: proceso siempre encendido que mantiene las sesiones de
 * Baileys y las conversaciones en memoria. La app Next (Netlify) le habla por
 * HTTP cuando WHATSAPP_WORKER_URL está definida (ver modules/whatsapp/remote.ts).
 *
 * Seguridad: todas las rutas (salvo /health) exigen `Authorization: Bearer
 * WHATSAPP_WORKER_SECRET`. El businessId llega en `x-business-id` y SOLO es
 * confiable porque la app Next ya lo resolvió desde la sesión del usuario.
 * Nunca exponer este servicio sin el secreto.
 */
import { timingSafeEqual } from "node:crypto";
import http from "node:http";

import type { ConversationLabel, ConversationStatus, MessageSender, WhatsAppEvent } from "@/lib/types";
import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import { whatsappEvents } from "@/modules/whatsapp/events";

const SECRET = process.env.WHATSAPP_WORKER_SECRET ?? "";
const PORT = Number(process.env.PORT ?? 8080);

if (SECRET.length < 24) {
  console.error("[worker] WHATSAPP_WORKER_SECRET es obligatorio (mínimo 24 caracteres).");
  process.exit(1);
}

function authorized(req: http.IncomingMessage): boolean {
  const header = req.headers.authorization ?? "";
  const expected = Buffer.from(`Bearer ${SECRET}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new Error("Body demasiado grande.");
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return (raw ? JSON.parse(raw) : {}) as T;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://worker");
    const route = `${req.method} ${url.pathname}`;

    if (route === "GET /health") return json(res, 200, { ok: true });
    if (!authorized(req)) return json(res, 401, { error: "No autorizado." });

    const businessId = String(req.headers["x-business-id"] ?? "").trim();
    if (!businessId) return json(res, 400, { error: "Falta x-business-id." });

    if (route === "GET /status") {
      return json(res, 200, { connection: whatsappConnectionManager.getStatus(businessId) });
    }
    if (route === "POST /connect") {
      await whatsappConnectionManager.connect(businessId);
      return json(res, 200, { connection: whatsappConnectionManager.getStatus(businessId) });
    }
    if (route === "POST /disconnect") {
      await whatsappConnectionManager.disconnect(businessId);
      return json(res, 200, { connection: whatsappConnectionManager.getStatus(businessId) });
    }
    if (route === "POST /ai") {
      const body = await readBody<{ enabled?: boolean }>(req);
      if (typeof body.enabled !== "boolean") return json(res, 400, { error: "El campo 'enabled' es requerido." });
      await whatsappConnectionManager.setAiEnabled(businessId, body.enabled);
      return json(res, 200, { connection: whatsappConnectionManager.getStatus(businessId) });
    }

    if (route === "GET /events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      const send = (event: WhatsAppEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
      send({ type: "connection", payload: whatsappConnectionManager.getStatus(businessId) });
      const unsubscribe = whatsappEvents.subscribe((eventBusinessId, event) => {
        if (eventBusinessId === businessId) send(event);
      });
      const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
      req.on("close", () => {
        clearInterval(ping);
        unsubscribe();
      });
      return;
    }

    if (route === "GET /conversations") {
      return json(res, 200, { conversations: conversationRepository.list(businessId) });
    }

    const conv = url.pathname.match(/^\/conversations\/([^/]+)(?:\/(read|messages))?$/);
    if (conv) {
      const id = decodeURIComponent(conv[1]);
      const action = conv[2];

      if (!action && req.method === "GET") {
        const conversation = conversationRepository.get(businessId, id);
        if (!conversation) return json(res, 404, { error: "Conversación no encontrada." });
        return json(res, 200, { conversation });
      }
      if (!action && req.method === "PATCH") {
        const body = await readBody<{
          status?: ConversationStatus;
          toggleLabel?: ConversationLabel;
          manualMode?: boolean;
        }>(req);
        let conversation = conversationRepository.get(businessId, id);
        if (!conversation) return json(res, 404, { error: "Conversación no encontrada." });
        if (body.status) conversation = conversationRepository.setStatus(businessId, id, body.status);
        if (body.toggleLabel) conversation = conversationRepository.toggleLabel(businessId, id, body.toggleLabel);
        if (typeof body.manualMode === "boolean") {
          conversation = conversationRepository.setManualMode(businessId, id, body.manualMode);
        }
        return json(res, 200, { conversation });
      }
      if (action === "read" && req.method === "POST") {
        const conversation = conversationRepository.markRead(businessId, id);
        if (!conversation) return json(res, 404, { error: "Conversación no encontrada." });
        return json(res, 200, { conversation });
      }
      if (action === "messages" && req.method === "POST") {
        const body = await readBody<{ text?: string; sender?: MessageSender }>(req);
        const text = body.text?.trim();
        if (!text) return json(res, 400, { error: "El mensaje no puede estar vacío." });
        try {
          await whatsappConnectionManager.sendMessage(businessId, id, text, body.sender);
        } catch (error) {
          return json(res, 409, { error: error instanceof Error ? error.message : "No se pudo enviar el mensaje." });
        }
        return json(res, 200, { conversation: conversationRepository.get(businessId, id) });
      }
    }

    return json(res, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    console.error("[worker] Error:", error);
    return json(res, 500, { error: "Error interno del worker." });
  }
});

server.listen(PORT, async () => {
  console.log(`[worker] escuchando en :${PORT}`);
  try {
    const { prisma } = await import("@/lib/prisma");
    const businesses = await prisma.business.findMany({ select: { id: true } });
    await Promise.all(businesses.map(({ id }) => whatsappConnectionManager.restore(id)));
    console.log(`[worker] sesiones restauradas (${businesses.length} negocios revisados)`);
  } catch (error) {
    console.error("[worker] No se pudieron restaurar las sesiones al arrancar:", error);
  }
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
