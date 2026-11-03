import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getBusinessTimeZone } from "@/modules/business/time-zone";
import {
  EMPTY_TRACKING,
  attributionSchema,
  sourceLabel,
  type Attribution,
  type SiteEventType,
  type TrackEventInput,
  type TrackingConfig,
  type TrackingConfigInput,
} from "@/lib/site-tracking";

// Nunca lanzan hacia el sitio público: registrar una vista o leer la
// configuración de píxeles no puede romper la página ni el envío de un form.

export async function recordSiteEvent(businessId: string, input: TrackEventInput): Promise<void> {
  try {
    const t = input.touch;
    await prisma.siteEvent.create({
      data: {
        businessId,
        type: input.type,
        path: input.path,
        sessionId: input.sessionId ?? null,
        utmSource: t?.utm_source ?? null,
        utmMedium: t?.utm_medium ?? null,
        utmCampaign: t?.utm_campaign ?? null,
        utmContent: t?.utm_content ?? null,
        utmTerm: t?.utm_term ?? null,
        referrerHost: t?.referrerHost ?? null,
      },
    });
  } catch (error) {
    console.warn("[analytics] No se pudo registrar el evento:", error instanceof Error ? error.message : error);
  }
}

export async function getTrackingConfig(businessId: string): Promise<TrackingConfig> {
  try {
    const row = await prisma.siteTracking.findUnique({ where: { businessId } });
    return row ? { gtmId: row.gtmId, metaPixelId: row.metaPixelId, ga4Id: row.ga4Id } : EMPTY_TRACKING;
  } catch {
    return EMPTY_TRACKING;
  }
}

export async function saveTrackingConfig(businessId: string, input: TrackingConfigInput): Promise<TrackingConfig> {
  const data = { gtmId: input.gtmId ?? null, metaPixelId: input.metaPixelId ?? null, ga4Id: input.ga4Id ?? null };
  await prisma.siteTracking.upsert({ where: { businessId }, update: data, create: { businessId, ...data } });
  return data;
}

export interface SiteSummary {
  days: number;
  views: number;
  sessions: number;
  ctaClicks: number;
  formSubmits: number;
  inquiries: number;
  conversionPct: number | null;
  daily: { date: string; views: number }[];
  sources: { label: string; views: number; inquiries: number }[];
  campaigns: { label: string; views: number; inquiries: number }[];
  topPages: { path: string; views: number }[];
}

export async function getSiteSummary(businessId: string, days: number): Promise<SiteSummary> {
  const since = new Date(Date.now() - days * 86_400_000);
  const tz = await getBusinessTimeZone(businessId);

  const [byType, sessions, dailyRows, bySource, byCampaign, pages, inquiries] = await Promise.all([
    prisma.siteEvent.groupBy({ by: ["type"], where: { businessId, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.siteEvent.findMany({
      where: { businessId, type: "page_view", createdAt: { gte: since }, sessionId: { not: null } },
      distinct: ["sessionId"],
      select: { sessionId: true },
    }),
    prisma.$queryRaw<{ d: string; n: bigint }[]>(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS d, count(*)::bigint AS n
      FROM "nexo"."SiteEvent"
      WHERE "businessId" = ${businessId} AND "type" = 'page_view' AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`),
    prisma.siteEvent.groupBy({
      by: ["utmSource", "referrerHost"],
      where: { businessId, type: "page_view", createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.siteEvent.groupBy({
      by: ["utmCampaign"],
      where: { businessId, type: "page_view", createdAt: { gte: since }, utmCampaign: { not: null } },
      _count: { _all: true },
    }),
    prisma.siteEvent.groupBy({
      by: ["path"],
      where: { businessId, type: "page_view", createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 5,
    }),
    prisma.inquiry.findMany({
      where: { businessId, channel: "web", createdAt: { gte: since } },
      select: { attribution: true },
      take: 5000,
    }),
  ]);

  const count = (t: SiteEventType) => byType.find((r) => r.type === t)?._count._all ?? 0;
  const views = count("page_view");

  // Vistas por origen (utm_source o, si no hay, host del referrer).
  const sourceMap = new Map<string, { views: number; inquiries: number }>();
  for (const row of bySource) {
    const label = sourceLabel({ utm_source: row.utmSource, referrerHost: row.referrerHost });
    const cur = sourceMap.get(label) ?? { views: 0, inquiries: 0 };
    cur.views += row._count._all;
    sourceMap.set(label, cur);
  }
  const campaignMap = new Map<string, { views: number; inquiries: number }>();
  for (const row of byCampaign) campaignMap.set(row.utmCampaign ?? "", { views: row._count._all, inquiries: 0 });

  // Consultas por origen/campaña: primer contacto (first touch) de cada consulta.
  for (const inq of inquiries) {
    const parsed = attributionSchema.safeParse(inq.attribution);
    const touch = parsed.success ? (parsed.data.first ?? parsed.data.last) : undefined;
    const label = sourceLabel(touch);
    const s = sourceMap.get(label) ?? { views: 0, inquiries: 0 };
    s.inquiries += 1;
    sourceMap.set(label, s);
    if (touch?.utm_campaign) {
      const c = campaignMap.get(touch.utm_campaign) ?? { views: 0, inquiries: 0 };
      c.inquiries += 1;
      campaignMap.set(touch.utm_campaign, c);
    }
  }

  const toList = (m: Map<string, { views: number; inquiries: number }>) =>
    [...m.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.views + b.inquiries - (a.views + a.inquiries)).slice(0, 10);

  return {
    days,
    views,
    sessions: sessions.length,
    ctaClicks: count("cta_click"),
    formSubmits: count("form_submit"),
    inquiries: inquiries.length,
    conversionPct: sessions.length > 0 ? Math.round((inquiries.length / sessions.length) * 1000) / 10 : null,
    daily: dailyRows.map((r) => ({ date: r.d, views: Number(r.n) })),
    sources: toList(sourceMap),
    campaigns: toList(campaignMap),
    topPages: pages.map((p) => ({ path: p.path, views: p._count._all })),
  };
}

export function parseAttribution(raw: unknown): Attribution | null {
  const parsed = attributionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { first, last } = parsed.data;
  return first || last ? parsed.data : null;
}
