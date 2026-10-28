import type { BrandIconName } from "@/lib/brand-icon-paths";

// Redes sociales de un negocio. Fuente ÚNICA de verdad: las columnas de
// Business (instagramUrl, facebookUrl, tiktokUrl, youtubeUrl, linkedinUrl).
// Dónde se muestran (footer / navbar) es otra configuración (SiteNav), nunca
// una segunda copia de los enlaces.

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "linkedin"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_FIELD: Record<SocialPlatform, "instagramUrl" | "facebookUrl" | "tiktokUrl" | "youtubeUrl" | "linkedinUrl"> = {
  instagram: "instagramUrl",
  facebook: "facebookUrl",
  tiktok: "tiktokUrl",
  youtube: "youtubeUrl",
  linkedin: "linkedinUrl",
};

export const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

export const SOCIAL_ICON: Record<SocialPlatform, BrandIconName> = {
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  youtube: "youtube",
  linkedin: "linkedin",
};

export const SOCIAL_PLACEHOLDER: Record<SocialPlatform, string> = {
  instagram: "https://instagram.com/tu_usuario",
  facebook: "https://facebook.com/tu_pagina",
  tiktok: "https://tiktok.com/@tu_usuario",
  youtube: "https://youtube.com/@tu_canal",
  linkedin: "https://linkedin.com/company/tu_empresa",
};

// Dominios válidos por red (el enlace tiene que ser realmente de esa red: un
// link de Facebook en el campo de Instagram se rechaza, nunca se muestra con
// el ícono equivocado).
const DOMAINS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com", "fb.me"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  linkedin: ["linkedin.com"],
};

// Redes donde aceptamos solo el usuario ("@usuario") y armamos la URL.
const HANDLE_BASE: Partial<Record<SocialPlatform, string>> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/@",
};

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,40}$/;
const MAX_LENGTH = 300;

// Devuelve la URL canónica (https, sin espacios) o null si no es un enlace
// válido de esa red. "" (vacío) NO es válido acá: quien llama decide si un
// campo vacío significa "sin red configurada".
export function normalizeSocialUrl(platform: SocialPlatform, raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || value.length > MAX_LENGTH || /\s/.test(value)) return null;

  const handleBase = HANDLE_BASE[platform];
  if (handleBase && HANDLE_RE.test(value) && !value.includes(".com")) {
    return `${handleBase}${value.replace(/^@/, "")}`;
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const allowed = DOMAINS[platform].some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!allowed) return null;

  url.protocol = "https:";
  return url.toString();
}

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  href: string;
}

// Solo las redes con una URL configurada y VÁLIDA, en orden fijo. Un valor
// viejo guardado en la base que no pasa la validación simplemente no se
// muestra (nunca un enlace roto ni un ícono genérico).
export function buildSocialLinks(
  business: Partial<Record<(typeof SOCIAL_FIELD)[SocialPlatform], string | null | undefined>>
): SocialLink[] {
  const links: SocialLink[] = [];
  for (const platform of SOCIAL_PLATFORMS) {
    const href = normalizeSocialUrl(platform, business[SOCIAL_FIELD[platform]]);
    if (href) links.push({ platform, label: SOCIAL_LABEL[platform], href });
  }
  return links;
}
