"use client";

import { hasUtm, touchFromSearch, type Attribution, type SiteEventType, type Touch } from "@/lib/site-tracking";

// Origen del visitante dentro de UNA sesión del navegador (sessionStorage: se
// borra al cerrar la pestaña, no es una cookie y no sigue a la persona entre
// visitas). "first" = cómo llegó la primera vez en la sesión; "last" = el
// último origen con utm_* (o el primero si nunca hubo otro).
const KEY = (slug: string) => `nexo_attr_${slug}`;

interface Stored {
  sessionId: string;
  first: Touch;
  last: Touch;
}

function read(slug: string): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY(slug));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(slug: string, value: Stored) {
  try {
    sessionStorage.setItem(KEY(slug), JSON.stringify(value));
  } catch {
    /* sin storage: se sigue sin recordar el origen */
  }
}

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

// Registra el origen de la visita actual y devuelve lo que hay guardado.
export function captureAttribution(slug: string): Stored {
  const current = touchFromSearch(window.location.search, document.referrer, window.location.hostname, window.location.pathname);
  const stored = read(slug);
  if (!stored) {
    const fresh: Stored = { sessionId: randomId(), first: current, last: current };
    write(slug, fresh);
    return fresh;
  }
  // Un nuevo origen explícito (utm_*) pisa el último; navegar adentro del sitio no.
  if (hasUtm(current)) {
    const updated = { ...stored, last: current };
    write(slug, updated);
    return updated;
  }
  return stored;
}

export function getStoredAttribution(slug: string): Attribution | null {
  const stored = read(slug);
  return stored ? { first: stored.first, last: stored.last } : null;
}

export function sendSiteEvent(slug: string, type: SiteEventType) {
  const stored = read(slug) ?? captureAttribution(slug);
  const body = JSON.stringify({ type, path: window.location.pathname.slice(0, 200), sessionId: stored.sessionId, touch: stored.last });
  const url = `/api/public/${slug}/track`;
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
    void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch {
    /* las métricas nunca rompen la página */
  }
}
