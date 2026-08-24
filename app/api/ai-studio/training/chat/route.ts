import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { runTrainingTurn } from "@/modules/employee/training/engine";
import { getClientMessages } from "@/modules/employee/training/conversation";
import { getTrainingPlan } from "@/modules/employee/training-plan";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";
import { MAX_MESSAGE_LENGTH } from "@/lib/ai-limits";
import type { TrainingMode } from "@/modules/ai/prompt/training";

const CUSTOM_TRAINING_BLOCKED_REPLY =
  "El re-entrenamiento libre del asistente está disponible desde el plan Esencial. La configuración inicial (onboarding) siempre queda disponible — para entrenarlo con más detalle después, mejorá tu plan desde /dashboard/suscripcion.";

interface ChatRequestBody {
  mode?: string;
  message?: string;
}

function parseMode(value: string | null): TrainingMode {
  return value === "continuous" ? "continuous" : "onboarding";
}

// Rehidrata el chat al cargar la página: el historial vive en el servidor,
// no en el estado del navegador.
export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = parseMode(searchParams.get("mode"));

  const messages = await getClientMessages(businessId, mode);
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as ChatRequestBody;
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }

  // Protección de abuso barata (sección 17): un mensaje desproporcionado no
  // aporta a un onboarding conversacional y solo infla el costo del turno.
  // Se valida ANTES de tocar Gemini o persistir nada.
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Ese mensaje es muy largo (máximo ${MAX_MESSAGE_LENGTH} caracteres). Resumilo un poco.` },
      { status: 400 }
    );
  }

  const mode = parseMode(body.mode ?? null);

  // Onboarding SIEMPRE queda disponible (toda cuenta nueva, sin importar el
  // plan, tiene que poder terminar de configurar su negocio) — el gate es
  // solo sobre "continuous" (re-entrenamiento libre post-onboarding, ver
  // /dashboard/ai-studio/training). Reusa el mismo contrato que el corte por
  // límite de mensajes (limitReached) para que el chat existente lo
  // muestre sin lógica nueva — upgradeRequired solo cambia el copy/CTA.
  if (mode === "continuous") {
    const features = await resolveBusinessPlanFeatures(businessId);
    if (!features.customTrainingEnabled) {
      const plan = await getTrainingPlan(businessId);
      return NextResponse.json({ reply: CUSTOM_TRAINING_BLOCKED_REPLY, proposal: null, limitReached: true, upgradeRequired: true, plan });
    }
  }

  try {
    const result = await runTrainingTurn({ businessId, mode, message });
    // El plan viaja siempre en la respuesta del chat (no solo en apply/skip):
    // el corte por límite (ver limitReached) puede cambiar secciones a
    // "ignored" sin que haya pasado por un botón de confirmar/saltear, así
    // que el panel lateral necesita poder refrescarse desde acá también.
    const plan = await getTrainingPlan(businessId);
    return NextResponse.json({ ...result, plan });
  } catch (error) {
    console.error("[training/chat] error al generar respuesta:", error);
    return NextResponse.json(
      { error: "No pudimos enviar tu mensaje. ¿Querés reintentar?" },
      { status: 503 }
    );
  }
}
