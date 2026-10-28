import { z } from "zod";

import { CONTACT_SECTION_KIND, allBuiltinKinds } from "@/lib/site-sections";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import type { SiteBannerCtaType, SiteBannerVariant, SiteTemplate } from "@/lib/types";

// Sin dependencias de servidor: lo comparten el diálogo del panel (validación
// previa), la API (validación real) y el render público (resolución del CTA).

export const BANNER_VARIANTS = ["image", "text", "compact"] as const satisfies readonly SiteBannerVariant[];
export const BANNER_CTA_TYPES = [
  "contact_form",
  "section",
  "whatsapp",
  "url",
  "phone",
] as const satisfies readonly SiteBannerCtaType[];

export const BANNER_VARIANT_LABEL: Record<SiteBannerVariant, { label: string; description: string }> = {
  image: { label: "Solo imagen", description: "La imagen ya trae el diseño completo, sin texto encima." },
  text: { label: "Con título y botón", description: "Título, descripción y botón sobre la imagen." },
  compact: { label: "Compacto", description: "Franja chica para poner entre secciones." },
};

export const BANNER_CTA_LABEL: Record<SiteBannerCtaType, string> = {
  contact_form: "Ir al formulario de contacto",
  section: "Ir a una sección de la página",
  whatsapp: "Abrir WhatsApp con un mensaje",
  url: "Abrir una URL externa",
  phone: "Iniciar una llamada",
};

export const DEFAULT_WHATSAPP_MESSAGE = "Hola, vi su sitio web y quería hacer una consulta.";

const MAX_URL_LENGTH = 500;

// Solo http/https, sin credenciales embebidas. Si falta el esquema se asume
// https. Devuelve la URL normalizada o null — nunca deja pasar
// javascript:, data:, mailto:, etc.
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || value.length > MAX_URL_LENGTH || /\s/.test(value)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

export function buildTelHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

// Las imágenes de un banner tienen que vivir en la carpeta del propio
// negocio dentro del bucket (site-assets/{businessId}/banner/...): así un
// negocio nunca puede apuntar a archivos de otro ni a URLs arbitrarias.
export function isOwnBannerAssetPath(path: string | null | undefined, businessId: string): boolean {
  if (!path) return false;
  if (path.includes("..") || path.includes("//")) return false;
  return path.startsWith(`${businessId}/banner/`) && path.length > `${businessId}/banner/`.length;
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => (v ? v : null));

export const bannerCtaInputSchema = z.object({
  type: z.enum(BANNER_CTA_TYPES),
  label: z.string().trim().min(1, "Escribí el texto del botón").max(32, "El texto del botón es demasiado largo"),
  value: z.string().trim().max(MAX_URL_LENGTH).nullish(),
});

export const bannerInputSchema = z
  .object({
    name: z.string().trim().min(1, "Poné un nombre para identificarlo").max(80, "El nombre es demasiado largo"),
    variant: z.enum(BANNER_VARIANTS),
    desktopImageUrl: z.string().url("Subí la imagen de escritorio").max(MAX_URL_LENGTH),
    mobileImageUrl: z.string().url().max(MAX_URL_LENGTH).nullish().transform((v) => v ?? null),
    imageAlt: z.string().trim().min(1, "Describí la imagen para accesibilidad").max(160, "El texto alternativo es demasiado largo"),
    title: optionalText(90, "El título es demasiado largo"),
    description: optionalText(240, "La descripción es demasiado larga"),
    active: z.boolean().default(true),
    cta: bannerCtaInputSchema.nullish().transform((v) => v ?? null),
  })
  .superRefine((value, ctx) => {
    const cta = value.cta;
    if (!cta) return;
    if (cta.type === "section") {
      if (!cta.value || !allBuiltinKinds().includes(cta.value)) {
        ctx.addIssue({ code: "custom", path: ["cta", "value"], message: "Elegí una sección válida" });
      }
    }
    if (cta.type === "url" && !normalizeExternalUrl(cta.value)) {
      ctx.addIssue({ code: "custom", path: ["cta", "value"], message: "Ingresá una URL válida (https://…)" });
    }
    if (cta.type === "whatsapp" && cta.value && cta.value.length > 200) {
      ctx.addIssue({ code: "custom", path: ["cta", "value"], message: "El mensaje es demasiado largo (máx. 200)" });
    }
  });

export type BannerInput = z.infer<typeof bannerInputSchema>;

// Lo que se guarda en CTA.value según el tipo (nunca datos que no
// corresponden, así el cambio de tipo en el panel no deja basura).
export function canonicalCtaValue(cta: NonNullable<BannerInput["cta"]>): string | null {
  switch (cta.type) {
    case "section":
      return cta.value ?? null;
    case "url":
      return normalizeExternalUrl(cta.value);
    case "whatsapp":
      return cta.value ? cta.value : null;
    default:
      return null;
  }
}

export interface CtaContext {
  template: SiteTemplate;
  whatsappNumber: string | null | undefined;
  phone: string | null | undefined;
  // Tipos de sección que efectivamente se muestran en la página (visibles y
  // con contenido): un enlace interno a una sección oculta no se renderiza.
  visibleKinds: ReadonlySet<string>;
}

export interface ResolvedCta {
  href: string;
  label: string;
  // true = abre otra pestaña (target=_blank + rel noopener noreferrer).
  newTab: boolean;
}

export function sectionAnchor(kind: string): string {
  return `sec-${kind}`;
}

// Resuelve el destino real del botón. Devuelve null si no se puede cumplir
// (sin número de WhatsApp, sección oculta, etc.): el banner se muestra igual
// pero SIN botón, nunca con un botón que no hace nada.
export function resolveBannerCta(
  cta: { type: SiteBannerCtaType; label: string; value: string | null } | null,
  ctx: CtaContext
): ResolvedCta | null {
  if (!cta || !cta.label) return null;

  switch (cta.type) {
    case "contact_form": {
      const kind = CONTACT_SECTION_KIND[ctx.template];
      return ctx.visibleKinds.has(kind) ? { href: `#${sectionAnchor(kind)}`, label: cta.label, newTab: false } : null;
    }
    case "section":
      return cta.value && ctx.visibleKinds.has(cta.value)
        ? { href: `#${sectionAnchor(cta.value)}`, label: cta.label, newTab: false }
        : null;
    case "whatsapp": {
      const href = buildWhatsappHref(ctx.whatsappNumber, cta.value || DEFAULT_WHATSAPP_MESSAGE);
      return href ? { href, label: cta.label, newTab: true } : null;
    }
    case "url": {
      const href = normalizeExternalUrl(cta.value);
      return href ? { href, label: cta.label, newTab: true } : null;
    }
    case "phone": {
      const href = buildTelHref(ctx.phone);
      return href ? { href, label: cta.label, newTab: false } : null;
    }
    default:
      return null;
  }
}
