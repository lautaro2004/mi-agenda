import { z } from "zod";

// Tracking del sitio público. Sin Prisma: lo usan el cliente (tracker, panel)
// y el servidor (rutas) con las mismas reglas.
//
// Reglas de privacidad/seguridad:
// - Los eventos propios NO llevan datos personales (nada de nombre, teléfono,
//   email, IP ni user agent). La atribución solo guarda utm_*, el HOST del
//   referrer y la ruta de entrada.
// - GTM / Meta Pixel / GA4 se configuran SOLO con su ID, validado por formato.
//   No se acepta código ni scripts del cliente: el snippet lo arma la app.
// - Esos scripts de terceros se cargan únicamente después de que el visitante
//   acepta (ver components/public-site/site-tracker.tsx).

export const EVENT_TYPES = ["page_view", "cta_click", "form_submit"] as const;
export type SiteEventType = (typeof EVENT_TYPES)[number];

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

const utmValue = z
  .string()
  .trim()
  .max(80)
  .regex(/^[\p{L}\p{N} _.\-+|:/]*$/u, "Caracteres no permitidos")
  .optional();

export const touchSchema = z.object({
  utm_source: utmValue,
  utm_medium: utmValue,
  utm_campaign: utmValue,
  utm_content: utmValue,
  utm_term: utmValue,
  referrerHost: z.string().trim().max(100).optional(),
  landingPath: z.string().trim().max(200).optional(),
});
export type Touch = z.infer<typeof touchSchema>;

export const attributionSchema = z.object({
  first: touchSchema.optional(),
  last: touchSchema.optional(),
});
export type Attribution = z.infer<typeof attributionSchema>;

export const trackEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  path: z.string().trim().min(1).max(200),
  sessionId: z.string().trim().max(40).optional(),
  touch: touchSchema.optional(),
});
export type TrackEventInput = z.infer<typeof trackEventSchema>;

export function hasUtm(touch: Touch | undefined | null): boolean {
  return !!touch && UTM_KEYS.some((k) => !!touch[k]);
}

// Lee utm_* de una query string. Valores inválidos se descartan.
export function touchFromSearch(search: string, referrer: string, ownHost: string, path: string): Touch {
  const params = new URLSearchParams(search);
  const touch: Touch = { landingPath: path.slice(0, 200) };
  for (const key of UTM_KEYS) {
    const raw = params.get(key)?.trim();
    if (!raw) continue;
    const ok = utmValue.safeParse(raw);
    if (ok.success && ok.data) touch[key] = ok.data.toLowerCase();
  }
  const host = referrerHost(referrer, ownHost);
  if (host) touch.referrerHost = host;
  return touch;
}

export function referrerHost(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (!host || host === ownHost.replace(/^www\./, "")) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

// Etiqueta legible del origen: utm_source si hay; si no, el referrer; si no, "Directo".
export function sourceLabel(touch: { utm_source?: string | null; referrerHost?: string | null } | null | undefined): string {
  return touch?.utm_source || touch?.referrerHost || "Directo";
}

// ── IDs de terceros (validación estricta por formato) ─────────────────────
export const GTM_RE = /^GTM-[A-Z0-9]{4,10}$/;
export const META_PIXEL_RE = /^\d{10,20}$/;
export const GA4_RE = /^G-[A-Z0-9]{6,12}$/;

const optionalId = (re: RegExp, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => (re === GTM_RE || re === GA4_RE ? v.toUpperCase() : v))
    .refine((v) => v === "" || re.test(v), message)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const trackingConfigSchema = z.object({
  gtmId: optionalId(GTM_RE, "El ID de GTM tiene el formato GTM-XXXXXXX"),
  metaPixelId: optionalId(META_PIXEL_RE, "El ID del píxel de Meta son solo números (15 o 16 dígitos)"),
  ga4Id: optionalId(GA4_RE, "El ID de GA4 tiene el formato G-XXXXXXXXXX"),
});
export type TrackingConfigInput = z.infer<typeof trackingConfigSchema>;

export interface TrackingConfig {
  gtmId: string | null;
  metaPixelId: string | null;
  ga4Id: string | null;
}
export const EMPTY_TRACKING: TrackingConfig = { gtmId: null, metaPixelId: null, ga4Id: null };

export function hasThirdParty(config: TrackingConfig | null | undefined): boolean {
  return !!config && !!(config.gtmId || config.metaPixelId || config.ga4Id);
}

// ── Generador de links con UTM ────────────────────────────────────────────
export function buildUtmUrl(
  base: string,
  utm: Partial<Record<UtmKey, string>>
): { url: string | null; error: string | null } {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    return { url: null, error: "Pegá una URL completa, por ejemplo https://tusitio.com/s/mi-negocio" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { url: null, error: "La URL debe empezar con http o https." };
  for (const key of UTM_KEYS) {
    const v = utm[key]?.trim();
    if (!v) {
      url.searchParams.delete(key);
      continue;
    }
    const ok = utmValue.safeParse(v);
    if (!ok.success) return { url: null, error: "Usá solo letras, números, espacios, guiones o guion bajo en los UTM." };
    url.searchParams.set(key, v.toLowerCase().replace(/\s+/g, "_"));
  }
  if (!utm.utm_source?.trim()) return { url: null, error: "Completá al menos el origen (utm_source), por ejemplo instagram." };
  return { url: url.toString(), error: null };
}

// ── Detección de IDs a partir de un snippet pegado ───────────────────────
// El texto pegado SOLO se lee para sacar los IDs: no se guarda, no se ejecuta
// y no se inserta en la página. Lo que se publica es siempre el snippet
// estándar que arma la app con el ID ya validado.
export interface DetectedIds {
  gtmId: string | null;
  metaPixelId: string | null;
  ga4Id: string | null;
}

export function extractTrackingIds(text: string): DetectedIds {
  const gtm = text.match(/\bGTM-[A-Z0-9]{4,10}\b/i)?.[0]?.toUpperCase() ?? null;
  const ga4 = text.match(/\bG-[A-Z0-9]{6,12}\b/i)?.[0]?.toUpperCase() ?? null;
  // fbq('init', '1234567890123456')  |  facebook.com/tr?id=1234567890123456
  const pixel =
    text.match(/fbq\(\s*['"]init['"]\s*,\s*['"]?(\d{10,20})/i)?.[1] ??
    text.match(/facebook\.com\/tr\?[^"'\s>]*\bid=(\d{10,20})/i)?.[1] ??
    null;
  return {
    gtmId: gtm && GTM_RE.test(gtm) ? gtm : null,
    metaPixelId: pixel && META_PIXEL_RE.test(pixel) ? pixel : null,
    ga4Id: ga4 && GA4_RE.test(ga4) ? ga4 : null,
  };
}
