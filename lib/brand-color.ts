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

// Color de texto legible sobre un fondo de marca (plantilla de captación,
// que usa el color de marca como fondo y no solo como acento). Luminancia
// relativa WCAG: sobre colores claros (amarillo, celeste pastel) el blanco
// sería ilegible, así que se usa texto oscuro. Sin color de marca, el
// fallback es el --primary del tema (oscuro/saturado) → texto blanco.
export function readableTextOn(hex: string | null): "light" | "dark" {
  if (!hex) return "light";
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Umbral donde el contraste con negro supera al contraste con blanco.
  return luminance > 0.179 ? "dark" : "light";
}
