"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { captureAttribution, sendSiteEvent } from "@/lib/site-attribution-client";
import { hasThirdParty, type TrackingConfig } from "@/lib/site-tracking";

// Qué hace:
// 1) Métricas propias (sin cookies ni datos personales): vista de página y
//    clics en WhatsApp / "reservar" / formulario. Guarda de dónde viene la
//    visita (utm_*) solo para esta sesión.
// 2) Si el negocio configuró GTM / Meta Pixel / GA4: pide consentimiento y
//    carga esos scripts ÚNICAMENTE si la persona acepta. Sin respuesta o con
//    "Rechazar" no se carga nada de terceros.
// Los scripts los arma la app a partir del ID validado; nunca se ejecuta
// código escrito por el negocio.

const CONSENT_KEY = "nexo_consent_v1";
type Consent = "granted" | "denied" | null;

type Win = Window & {
  dataLayer?: unknown[];
  fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  _fbq?: unknown;
  gtag?: (...args: unknown[]) => void;
};

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function addScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

let loaded = false;
function loadThirdParty(config: TrackingConfig) {
  if (loaded) return;
  loaded = true;
  const w = window as Win;
  w.dataLayer = w.dataLayer || [];

  if (config.gtmId) {
    w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    addScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmId)}`);
  }
  // Con GTM configurado, GA4 se maneja desde ahí (evita contar todo doble).
  if (config.ga4Id && !config.gtmId) {
    w.gtag = function gtag(...args: unknown[]) {
      (w.dataLayer as unknown[]).push(args);
    };
    w.gtag("js", new Date());
    w.gtag("config", config.ga4Id);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4Id)}`);
  }
  if (config.metaPixelId) {
    if (!w.fbq) {
      const fbq = function (...args: unknown[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = fbq as any;
        if (f.callMethod) f.callMethod(...args);
        else f.queue.push(args);
      } as unknown as NonNullable<Win["fbq"]>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyFbq = fbq as any;
      anyFbq.push = fbq;
      anyFbq.loaded = true;
      anyFbq.version = "2.0";
      anyFbq.queue = [];
      w.fbq = fbq;
      w._fbq = fbq;
      addScript("https://connect.facebook.net/en_US/fbevents.js");
    }
    w.fbq!("init", config.metaPixelId);
    w.fbq!("track", "PageView");
  }
}

// Conversión: sin ningún dato de la persona.
function fireLead(config: TrackingConfig) {
  const w = window as Win;
  if (!loaded) return;
  if (config.metaPixelId) w.fbq?.("track", "Lead");
  w.dataLayer?.push({ event: "generate_lead" });
  if (config.ga4Id && !config.gtmId) w.gtag?.("event", "generate_lead");
}

export function SiteTracker({ slug, tracking }: { slug: string; tracking: TrackingConfig }) {
  const [consent, setConsent] = React.useState<Consent>(null);
  const [ready, setReady] = React.useState(false);
  const thirdParty = hasThirdParty(tracking);

  // Métricas propias + origen de la visita.
  React.useEffect(() => {
    captureAttribution(slug);
    sendSiteEvent(slug, "page_view");

    function onClick(e: MouseEvent) {
      const a = (e.target as Element | null)?.closest?.("a,button");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (/wa\.me|api\.whatsapp\.com|whatsapp:/.test(href) || href === "#contacto" || a.hasAttribute("data-track-cta")) {
        sendSiteEvent(slug, "cta_click");
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [slug]);

  // Consentimiento + scripts de terceros.
  React.useEffect(() => {
    const current = readConsent();
    setConsent(current);
    setReady(true);
    if (thirdParty && current === "granted") loadThirdParty(tracking);
  }, [thirdParty, tracking]);

  // Conversión (la dispara el formulario al enviarse bien).
  React.useEffect(() => {
    const handler = () => fireLead(tracking);
    window.addEventListener("nexo:lead", handler);
    return () => window.removeEventListener("nexo:lead", handler);
  }, [tracking]);

  function choose(value: Exclude<Consent, null>) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* sin storage: vale para esta visita */
    }
    setConsent(value);
    if (value === "granted") loadThirdParty(tracking);
  }

  if (!thirdParty || !ready || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-card p-4 text-sm text-card-foreground shadow-lg sm:bottom-4"
    >
      <p>
        Usamos herramientas de medición (cookies de terceros) para saber qué anuncios funcionan. Podés aceptarlas o
        rechazarlas: el sitio funciona igual.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => choose("denied")}>
          Rechazar
        </Button>
        <Button type="button" size="sm" onClick={() => choose("granted")}>
          Aceptar
        </Button>
      </div>
    </div>
  );
}
