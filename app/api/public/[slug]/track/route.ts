import { NextResponse } from "next/server";

import { trackEventSchema } from "@/lib/site-tracking";
import { isRateLimited } from "@/lib/rate-limit";
import { recordSiteEvent } from "@/modules/analytics/site-events";
import { getPublicBusinessIdBySlug } from "@/modules/business/slug";

// Eventos propios del sitio (vistas, clics, envíos). Público y sin sesión: el
// negocio sale del slug. No guarda IP ni user agent. Responde siempre 204 para
// no darle información a quien lo prueba (ni romper la página si falla).
const LIMIT = 120;
const WINDOW_MS = 60_000;
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|curl|wget/i;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ua = request.headers.get("user-agent") ?? "";
  if (BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

  const businessId = await getPublicBusinessIdBySlug(slug);
  if (!businessId) return new NextResponse(null, { status: 204 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`track:${businessId}:${ip}`, LIMIT, WINDOW_MS)) return new NextResponse(null, { status: 204 });

  const parsed = trackEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  await recordSiteEvent(businessId, parsed.data);
  return new NextResponse(null, { status: 204 });
}
