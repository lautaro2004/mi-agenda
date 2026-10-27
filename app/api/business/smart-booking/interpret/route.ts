import { NextResponse } from "next/server";

import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getAIProvider } from "@/modules/ai/providers";
import { canUseSmartBooking } from "@/modules/billing/subscription";
import { getCurrentBusinessId } from "@/modules/business/current";
import { interpretInstruction, MAX_INSTRUCTION_CHARS } from "@/modules/smart-booking/interpret";
import { getSmartBookingRules } from "@/modules/smart-booking/service";

// Propone reglas a partir de una instrucción del dueño. NO guarda nada: la
// pantalla muestra el cambio y el dueño confirma con el PUT de siempre.
export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  if (!(await canUseSmartBooking(businessId))) {
    return NextResponse.json(
      { error: "La agenda inteligente está disponible desde el plan Esencial+.", upgradeRequired: true },
      { status: 403 }
    );
  }
  if (isRateLimited(`smart-interpret:${businessId}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { instruction?: unknown } | null;
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  if (!instruction) return NextResponse.json({ error: "Escribí qué querés configurar." }, { status: 400 });
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    return NextResponse.json({ error: `Es demasiado largo (máximo ${MAX_INSTRUCTION_CHARS} caracteres).` }, { status: 400 });
  }

  const provider = getAIProvider("smart_rules_interpret");
  if (!provider) return NextResponse.json({ error: "La IA no está disponible ahora. Configurá las reglas a mano." }, { status: 503 });

  try {
    const { rules: current } = await getSmartBookingRules(businessId);
    const result = await interpretInstruction({ provider, businessId, instruction, current });
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        message:
          result.reason === "no_changes"
            ? "No encontré nada para cambiar con esa instrucción."
            : "No pude convertir eso en reglas. Probá con otras palabras o configuralo a mano.",
      });
    }
    return NextResponse.json({ ok: true, rules: result.rules, changes: result.changes });
  } catch (error) {
    console.error("[Smart Booking API] interpret error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No pude interpretar la instrucción. Configurá las reglas a mano." }, { status: 502 });
  }
}
