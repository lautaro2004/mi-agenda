import { NextResponse } from "next/server";

import { getPublicBusinessIdBySlug } from "@/modules/business/slug";
import { composeInquiryMessage, createInquiry } from "@/modules/inquiries/service";
import { inquirySchema } from "@/lib/schemas";
import { isRateLimited } from "@/lib/rate-limit";
import { buildLeadSubmissionSchema, composeLeadMessage, submissionEmail } from "@/lib/lead-form";
import { getLeadFormConfig } from "@/modules/business/lead-form";
import { parseAttribution, recordSiteEvent } from "@/modules/analytics/site-events";

// Origen del visitante (utm_*, referrer). Se valida aparte: lo que no pasa el
// schema se descarta y la consulta se guarda igual, sin origen.
function attributionOf(body: unknown) {
  return parseAttribution(body && typeof body === "object" ? (body as { attribution?: unknown }).attribution : null);
}

// Consulta desde el sitio público. Sin sesión: el businessId sale siempre del
// slug, nunca del body. Igual que /api/leads, necesita rate limit + honeypot
// porque (a diferencia de reservar un turno) no tiene fricción natural.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const businessId = await getPublicBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  if (isRateLimited(`inquiry:${businessId}:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Recibimos muchas solicitudes. Probá de nuevo en un rato." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);

  // Formulario de la plantilla de captación: se valida contra la
  // configuración del negocio (campos obligatorios, preguntas propias), la
  // misma que usa el formulario en el navegador.
  if (body && typeof body === "object" && (body as { form?: unknown }).form === "leads") {
    return handleLeadSubmission(businessId, body, slug);
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos de la consulta." }, { status: 400 });
  }

  // Honeypot: éxito silencioso, sin crear nada ni avisarle al bot.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const { website: _website, companyName, location, message, ...input } = parsed.data;
  await createInquiry({
    businessId,
    ...input,
    message: composeInquiryMessage({ message, companyName, location }),
    attribution: attributionOf(body),
  });
  await recordSiteEvent(businessId, { type: "form_submit", path: `/s/${slug}`, touch: attributionOf(body)?.last });

  return NextResponse.json({ ok: true }, { status: 201 });
}

async function handleLeadSubmission(businessId: string, body: unknown, slug: string) {
  const config = await getLeadFormConfig(businessId);
  const parsed = buildLeadSubmissionSchema(config).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos." }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  await createInquiry({
    businessId,
    customerName: parsed.data.customerName,
    customerWhatsapp: parsed.data.customerWhatsapp,
    customerEmail: submissionEmail(config, parsed.data),
    message: composeLeadMessage(config, parsed.data),
    attribution: attributionOf(body),
  });
  await recordSiteEvent(businessId, { type: "form_submit", path: `/s/${slug}`, touch: attributionOf(body)?.last });
  return NextResponse.json({ ok: true }, { status: 201 });
}
