// ── Eventos de conversión (landing de adquisición /negocio-online) ──────
// El proyecto todavía no tiene ningún proveedor de analytics instalado (sin
// gtag/GTM/Meta Pixel en ningún lado — confirmado por búsqueda antes de
// escribir esto). Esta función es el único punto de entrada para futuros
// eventos: hoy no manda nada a ningún lado (no hay nada instalado todavía),
// pero ya deja el nombre/forma de cada evento fijado, listo para que cuando
// se agregue Google Ads / Meta Pixel / GA4 alcance con cablear esos scripts
// acá adentro — sin tocar los componentes que ya llaman a trackEvent().
// Nunca rompe la UI: si algún proveedor no está o tira error, se ignora.
export type AnalyticsEvent =
  | "page_view"
  | "click_cta_hero"
  | "click_cta_final"
  | "lead_form_submitted"
  | "registro_iniciado"
  | "registro_completado";

interface AnalyticsWindow {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  fbq?: (...args: unknown[]) => void;
}

export function trackEvent(name: AnalyticsEvent, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  const w = window as unknown as AnalyticsWindow;
  try {
    w.gtag?.("event", name, params);
    w.dataLayer?.push({ event: name, ...params });
    w.fbq?.("trackCustom", name, params);
  } catch {
    // Un proveedor de analytics roto/bloqueado (ad-blocker) nunca debe
    // interrumpir el flujo real del usuario.
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[analytics] ${name}`, params ?? {});
  }
}
