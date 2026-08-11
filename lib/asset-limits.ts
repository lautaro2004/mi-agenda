// Sin ninguna dependencia de servidor a propósito (nada de Supabase/Prisma):
// este módulo lo importan tanto el servidor (lib/site-assets.ts,
// modules/business/assets.ts) como componentes de cliente (para validar
// ANTES de subir, ver components/dashboard/asset-uploader.tsx). Nunca
// confiar solo en esta validación del lado del cliente — el servidor
// siempre revalida con la misma fuente.
export type SiteAssetKind = "logo" | "hero";

export const ASSET_LIMITS: Record<SiteAssetKind, { maxBytes: number; mimeTypes: string[] }> = {
  logo: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  hero: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/webp"],
  },
};
