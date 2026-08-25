// Sin ninguna dependencia de servidor a propósito (nada de Supabase/Prisma):
// este módulo lo importan tanto el servidor (lib/site-assets.ts,
// modules/business/assets.ts) como componentes de cliente (para validar
// ANTES de subir, ver components/dashboard/asset-uploader.tsx). Nunca
// confiar solo en esta validación del lado del cliente — el servidor
// siempre revalida con la misma fuente.
// "service" = foto de un Service puntual (ver modules/business/service-images.ts)
// — mismo bucket que logo/hero, pero con su propio endpoint porque no es 1:1
// con un campo fijo de Business, sino con un service.id (ver
// app/api/business/services/[id]/image/route.ts). "gallery" = imágenes de
// GalleryBlock (mismo criterio, escala por blockId). "menu" = PDF de la
// carta digital (ver modules/business/menu.ts) — único kind que no es
// imagen, mismo bucket público igual: una carta de restaurante no es
// información sensible.
// "avatar" = foto de perfil del USUARIO (User.image de better-auth), no de
// un Business — reutiliza el mismo bucket/helpers de Storage (ver
// lib/site-assets.ts) con el userId como prefijo del path en vez del
// businessId, pero es la única variante que no cuelga de Business.
export type SiteAssetKind = "logo" | "hero" | "service" | "gallery" | "menu" | "avatar";

export const ASSET_LIMITS: Record<SiteAssetKind, { maxBytes: number; mimeTypes: string[] }> = {
  logo: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  avatar: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  hero: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/webp"],
  },
  service: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  gallery: {
    maxBytes: 3 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  // Mismo límite que ya usa lib/document-limits.ts para PDF (knowledge
  // documents) — un tamaño "razonable" ya validado en este mismo proyecto,
  // no un número inventado de nuevo.
  menu: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["application/pdf"],
  },
};
