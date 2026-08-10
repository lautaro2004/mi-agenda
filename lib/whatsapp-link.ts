// Único punto que arma un link de WhatsApp para el sitio público — el
// mensaje precargado es opcional (los CTA genéricos de header/hero/footer no
// llevan uno; las cards de servicios no reservables sí, contextualizado).
// encodeURIComponent escapa correctamente el texto para la query string.
export function buildWhatsappHref(whatsappNumber: string | null | undefined, message?: string): string | null {
  if (!whatsappNumber) return null;
  const digits = whatsappNumber.replace(/[^0-9]/g, "");
  if (!digits) return null;

  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
