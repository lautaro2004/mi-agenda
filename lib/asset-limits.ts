// Sin ninguna dependencia de servidor a propósito (nada de Supabase/Prisma):
// este módulo lo importan tanto el servidor (lib/site-assets.ts,
// modules/business/assets.ts) como componentes de cliente (para validar
// ANTES de subir, ver components/dashboard/asset-uploader.tsx). Nunca
// confiar solo en esta validación del lado del cliente — el servidor
// siempre revalida con la misma fuente.
// "service" = foto de un Service puntual (ver modules/business/service-images.ts)
// — mismo bucket que logo/hero, pero con su propio endpoint porque no es 1:1
// con un campo fijo de Business, sino con un service.id (ver
// app/api/business/services/[id]/image/route.ts).
export type SiteAssetKind = "logo" | "hero" | "service";

export const ASSET_LIMITS: Record<SiteAssetKind, { maxBytes: number; mimeTypes: string[] }> = {
  logo: {
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
};
