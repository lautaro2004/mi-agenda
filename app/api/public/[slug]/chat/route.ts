import { NextResponse } from "next/server";

import { getClientIp, isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getAIProvider } from "@/modules/ai/providers";
import { canUseWebAiChat } from "@/modules/billing/subscription";
import { getPublicBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import { getChatCredits } from "@/modules/smart-booking/chat-credits";
import { MAX_MESSAGE_CHARS, runChatTurn, sanitizeHistory } from "@/modules/smart-booking/chat-engine";

// Chat web de reservas con IA. Gate en el servidor: plan con canUseWebAiChat
// (+ sitio público). Sin créditos o sin proveedor de IA el chat se degrada
// con un mensaje claro y el formulario de reserva sigue funcionando.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const businessId = await getPublicBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  if (isRateLimited(`chat:${businessId}:${getClientIp(request)}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  if (!(await canUseWebAiChat(businessId))) {
    return NextResponse.json({ error: "El chat no está disponible en este negocio." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown; history?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Escribí un mensaje." }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: `El mensaje es demasiado largo (máximo ${MAX_MESSAGE_CHARS} caracteres).` }, { status: 400 });
  }

  const degraded = (reply: string) => NextResponse.json({ reply, degraded: true });

  const credits = await getChatCredits(businessId);
  if (!credits.allowed || credits.remaining <= 0) {
    return degraded("El asistente no está disponible por ahora. Podés reservar tu turno desde el formulario de esta página.");
  }

  const provider = getAIProvider("web_booking_chat");
  if (!provider) {
    return degraded("El asistente no está disponible por ahora. Podés reservar tu turno desde el formulario de esta página.");
  }

  const { business, services, schedule } = await getBusinessState(businessId);

  try {
    const result = await runChatTurn({
      provider,
      ctx: { businessId, slug, business, services, schedule },
      message,
      history: sanitizeHistory(body?.history),
    });
    return NextResponse.json({ reply: result.reply, booked: result.booked ?? null });
  } catch (error) {
    console.error("[web-chat] Falló el turno del chat:", error instanceof Error ? error.message : error);
    return degraded("Tuve un problema para responderte. Podés reservar desde el formulario de esta página.");
  }
}
