import { prisma } from "@/lib/prisma";
import { seoConfigGenerationSchema } from "@/lib/schemas";
import { SITE_URL } from "@/lib/site";
import { WEEK_DAYS } from "@/lib/types";
import type { Business, BusinessSchedule, SeoConfig, Service } from "@/lib/types";
import { getBusinessState } from "@/modules/business/service";
import { listResources } from "@/modules/business/resource";
import { getTrainingPlan } from "@/modules/employee/training-plan";
import { GeminiProvider } from "@/modules/ai/providers/gemini";
import type { BuiltPrompt } from "@/modules/ai/prompt/builder";

// Generación de SEO: un único llamado a Gemini, disparado por el dueño
// (automático cuando el negocio ya está "listo", o manual desde el
// dashboard) — NUNCA desde el sitio público. Ver app/s/[slug]/page.tsx, que
// solo lee lo que esta función ya dejó guardado.

function toClientSeoConfig(row: {
  seoTitle: string;
  metaDescription: string;
  h1: string;
  ogTitle: string;
  ogDescription: string;
  keywords: string[];
  extraText: string | null;
  generatedAt: Date;
  updatedAt: Date;
}): SeoConfig {
  return {
    seoTitle: row.seoTitle,
    metaDescription: row.metaDescription,
    h1: row.h1,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    keywords: row.keywords,
    extraText: row.extraText,
    generatedAt: row.generatedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getSeoConfig(businessId: string): Promise<SeoConfig | null> {
  const row = await prisma.seoConfig.findUnique({ where: { businessId } });
  return row ? toClientSeoConfig(row) : null;
}

// "Suficiente información real" para que Gemini tenga algo útil de dónde
// partir — el criterio concreto que el dueño pidió: negocio identificado,
// al menos un servicio, al menos un día con horario activo, y el
// entrenamiento inicial resuelto (sin secciones pendientes/en curso). Los
// recursos quedan afuera del chequeo a propósito: son opcionales según el
// rubro, no todos los negocios los necesitan.
export async function isReadyForSeoGeneration(businessId: string): Promise<boolean> {
  const [state, plan] = await Promise.all([getBusinessState(businessId), getTrainingPlan(businessId)]);
  const { business, services, schedule } = state;

  const businessReady = Boolean(business.name && business.category && business.description);
  const servicesReady = services.length > 0;
  const scheduleReady = schedule.some((d) => d.enabled);
  const trainingReady = !plan || plan.sections.every((s) => s.status === "completed" || s.status === "ignored");

  return businessReady && servicesReady && scheduleReady && trainingReady;
}

function geminiProvider(): GeminiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GeminiProvider(apiKey);
}

const SEO_FENCE = /```(?:json)?\s*([\s\S]*?)```/;

async function buildSeoPrompt(businessId: string): Promise<BuiltPrompt> {
  const [state, resources] = await Promise.all([getBusinessState(businessId), listResources(businessId)]);
  const { business, services, faqs, schedule } = state;

  const scheduleLines = schedule
    .filter((d) => d.enabled)
    .map((d) => `${d.day}: ${d.openTime}-${d.closeTime}`)
    .join("; ");

  const systemInstruction = `Sos un asistente de SEO para negocios pequeños. Generás metadata SEO honesta y específica a partir de datos REALES de un negocio — nunca inventes datos que no te dieron (ni dirección, ni años de experiencia, ni premios, ni nada que no esté abajo).

DATOS DEL NEGOCIO:
Nombre: ${business.name || "(sin definir)"}
Rubro: ${business.category || "(sin definir)"}
Descripción: ${business.description || "(sin definir)"}
Servicios: ${services.length ? services.map((s) => `${s.name}${s.price ? ` ($${s.price})` : ""}`).join("; ") : "ninguno"}
Preguntas frecuentes: ${faqs.length ? faqs.map((f) => f.question).join("; ") : "ninguna"}
Horario: ${scheduleLines || "sin definir"}
Recursos: ${resources.length ? resources.map((r) => r.name).join(", ") : "ninguno"}

Generá EXCLUSIVAMENTE un JSON válido, sin texto adicional y sin fence de código, con esta forma exacta:
{"seoTitle": "...", "metaDescription": "...", "h1": "...", "ogTitle": "...", "ogDescription": "...", "keywords": ["...", "..."], "extraText": "..."}

Reglas:
- seoTitle: 10 a 70 caracteres. Incluí el nombre del negocio y el rubro o servicio principal.
- metaDescription: 50 a 160 caracteres. Resumí qué hace el negocio y por qué elegirlo, en tono natural, sin relleno.
- h1: el título visible principal de la página — puede diferir del seoTitle.
- ogTitle/ogDescription: variantes para compartir en redes (pueden repetir seoTitle/metaDescription si ya funcionan bien ahí).
- keywords: 3 a 12 términos o frases cortas que describan el negocio y sus servicios. Es uso INTERNO, nunca se muestra en la página — no hace falta optimizarlas para lectura humana.
- extraText: opcional. Un párrafo breve adicional SOLO si de verdad aporta algo (ej. especialidad, zona de cobertura) — omitilo si no hay nada real que agregar. Nunca lo inventes para rellenar.
- Nada de "keyword stuffing": no repitas la misma palabra de forma forzada.
- Español rioplatense, natural.`;

  return { systemInstruction };
}

interface GenerateSeoResult {
  success: boolean;
  config?: SeoConfig;
  error?: string;
}

// Nunca lanza: cualquier falla (sin API key, Gemini caído, JSON inválido)
// se devuelve como { success: false }. El caller decide qué hacer, pero en
// ningún caso esto debe bloquear el negocio ni la publicación del sitio —
// y si ya existía una config previa, esta función JAMÁS la toca hasta que
// la nueva pase la validación completa (ver el guard antes del upsert).
export async function generateSeoConfig(businessId: string): Promise<GenerateSeoResult> {
  const provider = geminiProvider();
  if (!provider) {
    return { success: false, error: "GEMINI_API_KEY no configurada." };
  }

  let raw: string;
  try {
    const prompt = await buildSeoPrompt(businessId);
    raw = await provider.generateResponse(
      "Generá la configuración SEO ahora, en el formato indicado.",
      [],
      prompt,
      { businessId, operation: "seo_generate" }
    );
  } catch (error) {
    console.error("[seo] Error llamando a Gemini:", error);
    return { success: false, error: "No pudimos generar el SEO en este momento." };
  }

  const fenced = raw.match(SEO_FENCE);
  const jsonText = (fenced ? fenced[1] : raw).trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch (error) {
    console.error("[seo] JSON inválido de Gemini:", error, "\nRaw:", raw);
    return { success: false, error: "La respuesta de la IA no fue un JSON válido." };
  }

  const candidate = seoConfigGenerationSchema.safeParse(parsedJson);
  if (!candidate.success) {
    console.error("[seo] No cumple seoConfigGenerationSchema:", candidate.error.flatten(), "\nRaw:", parsedJson);
    return { success: false, error: "La configuración generada no cumplía el formato esperado." };
  }

  const data = candidate.data;
  const row = await prisma.seoConfig.upsert({
    where: { businessId },
    update: {
      seoTitle: data.seoTitle,
      metaDescription: data.metaDescription,
      h1: data.h1,
      ogTitle: data.ogTitle,
      ogDescription: data.ogDescription,
      keywords: data.keywords,
      extraText: data.extraText ?? null,
    },
    create: {
      businessId,
      seoTitle: data.seoTitle,
      metaDescription: data.metaDescription,
      h1: data.h1,
      ogTitle: data.ogTitle,
      ogDescription: data.ogDescription,
      keywords: data.keywords,
      extraText: data.extraText ?? null,
    },
  });

  return { success: true, config: toClientSeoConfig(row) };
}

// Fallback 100% determinístico, sin Gemini — usado por el sitio público
// (generateMetadata y el JSON-LD) cuando todavía no existe un SeoConfig
// generado. Nunca debe faltar: el sitio tiene que poder publicarse aunque el
// SEO real no se haya generado todavía.
export function buildFallbackSeoConfig(business: { name: string; category: string; description: string }): Pick<
  SeoConfig,
  "seoTitle" | "metaDescription" | "h1" | "ogTitle" | "ogDescription"
> {
  const name = business.name || "Nuestro negocio";
  const category = business.category ? ` — ${business.category}` : "";
  const title = `${name}${category}`.slice(0, 70);
  const description =
    (business.description || `${name}. Contactanos por WhatsApp para más información.`).slice(0, 160);

  return {
    seoTitle: title,
    metaDescription: description,
    h1: name,
    ogTitle: title,
    ogDescription: description,
  };
}

const SCHEMA_WEEKDAY: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

// Structured data (Schema.org LocalBusiness) armado 100% en código a partir
// de datos reales — nunca pasa por Gemini (ver punto 10 del pedido). Se
// arma en cada request del sitio público porque es barato (sin llamadas
// externas), a diferencia del SeoConfig que sí se persiste.
export function buildLocalBusinessJsonLd(params: {
  business: Business;
  services: Service[];
  schedule: BusinessSchedule;
  slug: string;
}): Record<string, unknown> {
  const { business, services, schedule, slug } = params;
  const url = `${SITE_URL}/s/${slug}`;

  const openingHoursSpecification = schedule
    .filter((d) => d.enabled)
    .map((d) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_WEEKDAY[d.day] ?? WEEK_DAYS.find((w) => w.id === d.day)?.label,
      opens: d.openTime,
      closes: d.closeTime,
    }));

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    url,
    ...(business.description ? { description: business.description } : {}),
    ...(business.logoUrl ? { image: business.logoUrl } : {}),
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(business.address ? { address: { "@type": "PostalAddress", streetAddress: business.address } } : {}),
    ...(openingHoursSpecification.length ? { openingHoursSpecification } : {}),
    ...(services.length
      ? {
          makesOffer: services.map((s) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: s.name,
              ...(s.description ? { description: s.description } : {}),
            },
            ...(s.price ? { price: s.price, priceCurrency: "ARS" } : {}),
          })),
        }
      : {}),
  };
}

// Disparador automático: solo si todavía no hay SeoConfig y el negocio ya
// está "listo" (ver isReadyForSeoGeneration). Fire-and-forget a propósito —
// los callers (guardar horarios, aplicar una propuesta de training) no deben
// esperar a Gemini ni fallar si esto falla.
export async function maybeAutoGenerateSeo(businessId: string): Promise<void> {
  try {
    const existing = await prisma.seoConfig.findUnique({ where: { businessId }, select: { id: true } });
    if (existing) return;

    const ready = await isReadyForSeoGeneration(businessId);
    if (!ready) return;

    const result = await generateSeoConfig(businessId);
    if (!result.success) {
      console.error("[seo] Auto-generación falló:", result.error);
    }
  } catch (error) {
    console.error("[seo] Error inesperado en la auto-generación:", error);
  }
}
