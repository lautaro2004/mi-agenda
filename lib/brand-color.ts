// Exportado para que lib/schemas.ts valide con la misma regla al guardar
// (única fuente de verdad del formato — nunca dos regex del mismo patrón).
export const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Nunca confiar en un color que eventualmente pueda venir de un dato
// editable por el usuario — se usa como custom property CSS, así que un
// valor sin validar podría inyectar cualquier cosa ahí. Cualquier caller
// que quiera usar un color de marca tiene que pasar por acá primero.
export function sanitizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : null;
}

// El sitio público usa "var(--brand-primary, var(--primary))" en los puntos
// de acento (header, hero, CTAs) — este es el único lugar que lee
// Business.brandColor, así que si el mecanismo de fallback cambia alguna
// vez, no hay que tocar ningún componente visual.
export function getBrandColor(business: { brandColor: string | null }): string | null {
  return business.brandColor;
}
