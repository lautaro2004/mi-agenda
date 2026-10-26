import { NextResponse } from "next/server";

import { whatsappEvents } from "@/modules/whatsapp/events";
import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { getCurrentBusinessId } from "@/modules/business/current";
import { isRemoteWhatsApp, workerFetch } from "@/modules/whatsapp/remote";
import type { WhatsAppEvent } from "@/lib/types";

export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (isRemoteWhatsApp()) {
    try {
      const upstream = await workerFetch(businessId, "/events", { signal: request.signal });
      if (!upstream.ok || !upstream.body) throw new Error(`worker ${upstream.status}`);
      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    } catch (error) {
      console.error("[whatsapp worker] events:", error);
      return NextResponse.json({ error: "El servicio de WhatsApp no está disponible." }, { status: 503 });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: WhatsAppEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "connection", payload: whatsappConnectionManager.getStatus(businessId) });

      // Solo eventos del negocio de esta sesión: el bus es global al proceso.
      const unsubscribe = whatsappEvents.subscribe((eventBusinessId, event) => {
        if (eventBusinessId === businessId) send(event);
      });

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
