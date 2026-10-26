import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { landingCopySchema, type LandingCopyValues } from "@/lib/schemas";
import { getBusinessState } from "@/modules/business/service";
import { getAIProvider } from "@/modules/ai/providers";
import type { BuiltPrompt } from "@/modules/ai/prompt/builder";

// Textos de la plantilla de captación ("leads"). Igual que el SEO: la IA
// genera a pedido del dueño (botón en Sitio web), el dueño puede editar, y el
// sitio público SOLO lee lo guardado — nunca llama a la IA en una visita.
// Sin textos guardados, la plantilla usa sus textos fijos (ver
// LEADS_DEFAULT_COPY en lib/landing-copy.ts), así que esto es siempre una
// mejora opcional.

export interface LandingCopyState {
  copy: LandingCopyValues | null;
  generatedAt: string | null;
}

export async function getLandingCopy(businessId: string): Promise<LandingCopyState> {
  const row = await prisma.landingCopy.findUnique({ where: { businessId } });
  if (!row) return { copy: null, generatedAt: null };
  // Se valida también al leer: un JSON que no cumple (editado a mano en la
  // base, o de una versión vieja del schema) nunca llega a romper el sitio.
  const parsed = landingCopySchema.safeParse(row.content);
  return {
    copy: parsed.success ? parsed.data : null,
    generatedAt: row.generatedAt?.toISOString() ?? null,
  };
}

export async function saveLandingCopy(
  businessId: string,
  copy: LandingCopyValues,
  options: { generated?: boolean } = {}
): Promise<LandingCopyState> {
  const generatedAt = options.generated ? new Date() : undefined;
  const row = await prisma.landingCopy.upsert({
    where: { businessId },
    update: { content: copy as Prisma.InputJsonValue, ...(generatedAt ? { generatedAt } : {}) },
    create: { businessId, content: copy as Prisma.InputJsonValue, generatedAt: generatedAt ?? null },
  });
  return { copy, generatedAt: row.generatedAt?.toISOString() ?? null };
}

export async function deleteLandingCopy(businessId: string): Promise<void> {
  await prisma.landingCopy.deleteMany({ where: { businessId } });
}

// ── Generación ────────────────────────────────────────────────────────────

const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/;

export async function buildLandingCopyPrompt(businessId: string): Promise<BuiltPrompt> {
  const { business, services, faqs } = await getBusinessState(businessId);

  const systemInstruction = `Sos redactor/a de landing pages para negocios pequeños de Argentina. Escribís los textos de una página cuyo ÚNICO objetivo es que el visitante deje sus datos para que el negocio lo contacte (captación de clientes, muchas veces desde anuncios o Instagram).

DATOS REALES DEL NEGOCIO (no inventes nada que no esté acá):
Nombre: ${business.name || "(sin definir)"}
Rubro: ${business.category || "(sin definir)"}
Descripción: ${business.description || "(sin definir)"}
Servicios: ${services.length ? services.map((s) => `${s.name}${s.description ? ` — ${s.description}` : ""}`).join("; ") : "ninguno"}
Preguntas frecuentes: ${faqs.length ? faqs.map((f) => f.question).join("; ") : "ninguna"}

Generá EXCLUSIVAMENTE un JSON válido, sin texto adicional y sin fence de código, con esta forma exacta:
{"heroTitle": "...", "heroSubtitle": "...", "ctaLabel": "...", "steps": [{"title": "...", "body": "..."}, {"title": "...", "body": "..."}, {"title": "...", "body": "..."}], "servicesTitle": "...", "servicesIntro": "...", "closingTitle": "...", "closingBody": "...", "reasons": ["...", "...", "..."], "formTitle": "...", "formSubtitle": "..."}

Qué es cada cosa y sus límites (caracteres):
- heroTitle (8-80): título principal. Habla del resultado que busca el cliente de ESTE negocio, no del negocio. Concreto, sin frases hechas tipo "llevá tu negocio al siguiente nivel".
- heroSubtitle (20-240): una o dos oraciones que bajan a tierra el título: qué hace el negocio y para quién.
- ctaLabel (3-32): texto del botón que lleva al formulario. Dice lo que pasa al tocarlo (ej. "Quiero que me contacten", "Sumar mi local").
- steps (exactamente 3; title 3-40, body 8-120): el proceso REAL desde que la persona deja sus datos hasta que recibe el servicio, adaptado a este rubro. El primer paso siempre es dejar los datos en el formulario.
- servicesTitle (3-50): título de la sección de servicios.
- servicesIntro (0-200): una oración opcional debajo de ese título. Puede quedar vacía ("").
- closingTitle (3-50) y closingBody (10-180): cierre que invita a completar el formulario.
- reasons (exactamente 3, 3-50 cada uno): motivos cortos para dejar los datos, al lado del formulario. Solo cosas que se desprenden de los datos de arriba o que son ciertas para cualquier consulta (ej. "Sin compromiso"). NADA de cifras, plazos, precios, años de experiencia, garantías ni cantidades de clientes si no figuran arriba.
- formTitle (3-40) y formSubtitle (0-80): encabezado de la tarjeta del formulario.

Estilo:
- Español rioplatense (vos), natural, frases cortas. Sin signos de exclamación en exceso, sin emojis, sin mayúsculas sostenidas.
- Hablale al cliente ideal de este negocio (si es B2B, a quien tiene el negocio; si es B2C, a la persona).
- No repitas el nombre del negocio en cada texto.`;

  return { systemInstruction };
}

export function parseLandingCopyResponse(raw: string): LandingCopyValues | null {
  const fenced = raw.match(JSON_FENCE);
  const jsonText = (fenced ? fenced[1] : raw).trim();
  try {
    const parsed = landingCopySchema.safeParse(JSON.parse(jsonText));
    if (!parsed.success) {
      console.error("[landing-copy] No cumple landingCopySchema:", parsed.error.flatten());
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

// Nunca lanza. Si falla, NO toca los textos guardados: el dueño se queda con
// los últimos que funcionaron (mismo criterio que generateSeoConfig).
export async function generateLandingCopy(
  businessId: string
): Promise<{ success: true; state: LandingCopyState } | { success: false; error: string }> {
  const provider = getAIProvider("landing_copy");
  if (!provider) return { success: false, error: "No hay un proveedor de IA configurado." };

  let raw: string;
  try {
    raw = await provider.generateResponse(
      "Generá los textos ahora, en el formato indicado.",
      [],
      await buildLandingCopyPrompt(businessId),
      { businessId, operation: "landing_copy" }
    );
  } catch (error) {
    console.error("[landing-copy] Error llamando a la IA:", error);
    return { success: false, error: "No pudimos generar los textos en este momento." };
  }

  const copy = parseLandingCopyResponse(raw);
  if (!copy) return { success: false, error: "La IA devolvió textos que no cumplían el formato. Probá de nuevo." };

  return { success: true, state: await saveLandingCopy(businessId, copy, { generated: true }) };
}
