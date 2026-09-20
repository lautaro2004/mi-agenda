import { NextResponse } from "next/server";

import { getBusinessIdBySlug } from "@/modules/business/slug";
import { createInquiry } from "@/modules/inquiries/service";
import { inquirySchema } from "@/lib/schemas";
import { isRateLimited } from "@/lib/rate-limit";

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
  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  if (isRateLimited(`inquiry:${businessId}:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Recibimos muchas solicitudes. Probá de nuevo en un rato." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos de la consulta." }, { status: 400 });
  }

  // Honeypot: éxito silencioso, sin crear nada ni avisarle al bot.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const { website: _website, ...input } = parsed.data;
  await createInquiry({ businessId, ...input });

  return NextResponse.json({ ok: true }, { status: 201 });
}
