const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Nunca confiar en un color que eventualmente pueda venir de un dato
// editable por el usuario — se usa como custom property CSS, así que un
// valor sin validar podría inyectar cualquier cosa ahí. Cualquier caller
// que quiera usar un color de marca tiene que pasar por acá primero.
export function sanitizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : null;
}

// Business todavía no tiene ningún campo de color — agregarlo requeriría
// migración, y esta tarea explícitamente pide no hacer una si no es
// imprescindible. Por eso esto siempre devuelve null hoy: el sitio público
// usa "var(--brand-primary, var(--primary))" en los puntos de acento (ver
// components/public-site/header.tsx y hero.tsx), así que en cuanto exista
// una fuente real de color por negocio, alcanza con hacer que esta función
// la lea — no hay que tocar ningún componente visual.
export function getBrandColor(_business: { id: string }): string | null {
  return null;
}
