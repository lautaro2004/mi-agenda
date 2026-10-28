import { z } from "zod";

import { buildTelHref, normalizeExternalUrl, sectionAnchor, DEFAULT_WHATSAPP_MESSAGE } from "@/lib/site-banners";
import { CONTACT_SECTION_KIND, allBuiltinKinds } from "@/lib/site-sections";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import type { BookingIntent } from "@/lib/booking-intent";
import type { SiteTemplate } from "@/lib/types";

// Navegación configurable del sitio público. Sin dependencias de servidor:
// la usan el panel, la API y el render. Los enlaces internos referencian el
// TIPO estable de sección (lib/site-sections.ts), nunca el texto visible ni
// un id generado en cada render.

export const NAV_PAGES = ["carta", "reservar"] as const;
export type NavPage = (typeof NAV_PAGES)[number];

export const NAV_PAGE_LABEL: Record<NavPage, string> = {
  carta: "Carta digital",
  reservar: "Página de reservas",
};

export type NavTarget =
  | { type: "section"; kind: string }
  | { type: "page"; page: NavPage }
  | { type: "url"; url: string }
  | { type: "whatsapp"; message?: string }
  | { type: "phone" };

export type NavCtaTarget = NavTarget | { type: "contact_form" } | { type: "booking" };

export interface NavLink {
  id: string;
  label: string;
  active: boolean;
  target: NavTarget;
}

export interface NavCta {
  label: string;
  active: boolean;
  target: NavCtaTarget;
}

export interface NavConfig {
  links: NavLink[];
  cta: NavCta | null;
  // Dónde se muestran las redes sociales (los enlaces viven en Business).
  socialsInFooter: boolean;
  socialsInNav: boolean;
}

export const MAX_NAV_LINKS = 8;

export const NAV_TARGET_LABEL: Record<NavCtaTarget["type"], string> = {
  section: "Sección de la página",
  page: "Página interna",
  url: "URL externa",
  whatsapp: "WhatsApp con mensaje",
  phone: "Llamada telefónica",
  contact_form: "Formulario de contacto",
  booking: "Reservar un turno",
};

const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;

const baseTargetSchemas = [
  z.object({ type: z.literal("section"), kind: z.string().max(30) }),
  z.object({ type: z.literal("page"), page: z.enum(NAV_PAGES) }),
  z.object({ type: z.literal("url"), url: z.string().max(500) }),
  z.object({ type: z.literal("whatsapp"), message: z.string().max(200).optional() }),
  z.object({ type: z.literal("phone") }),
] as const;

export const navTargetSchema = z.discriminatedUnion("type", [...baseTargetSchemas]);
export const navCtaTargetSchema = z.discriminatedUnion("type", [
  ...baseTargetSchemas,
  z.object({ type: z.literal("contact_form") }),
  z.object({ type: z.literal("booking") }),
]);

const labelSchema = z.string().trim().min(1, "Escribí el texto del enlace").max(30, "El texto es demasiado largo");

export const navLinkSchema = z.object({
  id: z.string().regex(ID_RE),
  label: labelSchema,
  active: z.boolean(),
  target: navTargetSchema,
});

export const navCtaSchema = z.object({
  label: labelSchema,
  active: z.boolean(),
  target: navCtaTargetSchema,
});

export const navConfigSchema = z
  .object({
    links: z.array(navLinkSchema).max(MAX_NAV_LINKS, `Máximo ${MAX_NAV_LINKS} enlaces`),
    cta: navCtaSchema.nullable(),
    socialsInFooter: z.boolean(),
    socialsInNav: z.boolean(),
  })
  .superRefine((config, ctx) => {
    const ids = new Set<string>();
    config.links.forEach((link, index) => {
      if (ids.has(link.id)) ctx.addIssue({ code: "custom", path: ["links", index, "id"], message: "Enlace repetido" });
      ids.add(link.id);
      validateTarget(link.target, (message) => ctx.addIssue({ code: "custom", path: ["links", index, "target"], message }));
    });
    if (config.cta) validateTarget(config.cta.target, (message) => ctx.addIssue({ code: "custom", path: ["cta", "target"], message }));
  });

function validateTarget(target: NavCtaTarget, fail: (message: string) => void) {
  if (target.type === "section" && !allBuiltinKinds().includes(target.kind)) fail("Elegí una sección válida");
  if (target.type === "url" && !normalizeExternalUrl(target.url)) fail("Ingresá una URL válida (https://…)");
}

export function newNavLinkId(): string {
  return `nav-${crypto.randomUUID().slice(0, 8)}`;
}

// Lo guardado en la base se lee de forma tolerante: si no cumple el schema
// (versión vieja, edición manual) se ignora y el sitio usa la navegación por
// defecto — nunca se cae.
export function parseStoredNav(stored: unknown): NavConfig | null {
  const parsed = navConfigSchema.safeParse(stored);
  return parsed.success ? (parsed.data as NavConfig) : null;
}

// Canonicaliza lo que se guarda (URL normalizada, sin datos de otros tipos).
export function canonicalizeNav(config: NavConfig): NavConfig {
  const fix = <T extends NavCtaTarget>(target: T): T => {
    if (target.type === "url") return { ...target, url: normalizeExternalUrl(target.url) ?? target.url };
    if (target.type === "whatsapp") return { type: "whatsapp", ...(target.message?.trim() ? { message: target.message.trim() } : {}) } as unknown as T;
    return target;
  };
  return {
    ...config,
    links: config.links.map((l) => ({ ...l, label: l.label.trim(), target: fix(l.target) })),
    cta: config.cta ? { ...config.cta, label: config.cta.label.trim(), target: fix(config.cta.target) } : null,
  };
}

// ── Resolución de destinos ────────────────────────────────────────────────

export interface NavContext {
  slug: string;
  template: SiteTemplate;
  // Tipos de sección que realmente se muestran (visibles y con contenido).
  visibleKinds: ReadonlySet<string>;
  hasMenu: boolean;
  // Hay servicios reservables (el negocio usa agenda/turnos).
  hasBookable: boolean;
  whatsappNumber: string | null | undefined;
  phone: string | null | undefined;
}

export type NavProblem =
  | "section_hidden"
  | "page_unavailable"
  | "no_whatsapp"
  | "no_phone"
  | "invalid_url"
  | "no_contact_section"
  | "no_booking";

export const NAV_PROBLEM_MESSAGE: Record<NavProblem, string> = {
  section_hidden: "Apunta a una sección que está oculta o sin contenido.",
  page_unavailable: "La página de destino no está disponible.",
  no_whatsapp: "Falta cargar el WhatsApp del negocio.",
  no_phone: "Falta cargar el teléfono del negocio.",
  invalid_url: "La URL no es válida.",
  no_contact_section: "El formulario de contacto no está visible en esta plantilla.",
  no_booking: "El negocio no tiene servicios reservables.",
};

export type ResolvedTarget =
  | { ok: true; href: string; newTab: boolean; booking?: boolean }
  | { ok: false; problem: NavProblem };

export function resolveNavTarget(target: NavCtaTarget, ctx: NavContext): ResolvedTarget {
  const base = `/s/${ctx.slug}`;
  switch (target.type) {
    case "section":
      return ctx.visibleKinds.has(target.kind)
        ? { ok: true, href: `${base}#${sectionAnchor(target.kind)}`, newTab: false }
        : { ok: false, problem: "section_hidden" };
    case "contact_form": {
      const kind = CONTACT_SECTION_KIND[ctx.template];
      return ctx.visibleKinds.has(kind)
        ? { ok: true, href: `${base}#${sectionAnchor(kind)}`, newTab: false }
        : { ok: false, problem: "no_contact_section" };
    }
    case "page":
      if (target.page === "carta") return ctx.hasMenu ? { ok: true, href: `${base}/carta`, newTab: false } : { ok: false, problem: "page_unavailable" };
      return ctx.hasBookable ? { ok: true, href: `${base}/reservar`, newTab: false } : { ok: false, problem: "page_unavailable" };
    case "booking":
      return ctx.hasBookable ? { ok: true, href: `${base}/reservar`, newTab: false, booking: true } : { ok: false, problem: "no_booking" };
    case "url": {
      const href = normalizeExternalUrl(target.url);
      return href ? { ok: true, href, newTab: true } : { ok: false, problem: "invalid_url" };
    }
    case "whatsapp": {
      const href = buildWhatsappHref(ctx.whatsappNumber, target.message?.trim() || DEFAULT_WHATSAPP_MESSAGE);
      return href ? { ok: true, href, newTab: true } : { ok: false, problem: "no_whatsapp" };
    }
    case "phone": {
      const href = buildTelHref(ctx.phone);
      return href ? { ok: true, href, newTab: false } : { ok: false, problem: "no_phone" };
    }
  }
}

// ── Configuración por defecto (sitios sin navegación guardada) ────────────

const CTA_LABEL: Record<BookingIntent, string> = {
  booking: "Reservar",
  meeting: "Agendar reunión",
  contact: "Contactar",
};

// Equivale a lo que el sitio mostraba antes, pero SOLO con enlaces que
// existen: nada de "Horarios" si el negocio no usa agenda/turnos ni enlaces a
// secciones que la plantilla no tiene. Un enlace opcional sin configurar no se
// muestra por defecto.
export function defaultNavConfig(ctx: NavContext, intent: BookingIntent): NavConfig {
  const links: NavLink[] = [];
  if (ctx.visibleKinds.has("services")) {
    links.push({ id: "default-services", label: "Servicios", active: true, target: { type: "section", kind: "services" } });
  }
  if (ctx.hasMenu) links.push({ id: "default-carta", label: "Carta", active: true, target: { type: "page", page: "carta" } });
  if (ctx.hasBookable && ctx.visibleKinds.has("schedule")) {
    links.push({ id: "default-schedule", label: "Horarios", active: true, target: { type: "section", kind: "schedule" } });
  }
  if (ctx.visibleKinds.has("faq")) {
    links.push({ id: "default-faq", label: "Preguntas frecuentes", active: true, target: { type: "section", kind: "faq" } });
  }
  return {
    links,
    cta: ctx.hasBookable && intent !== "contact" ? { label: CTA_LABEL[intent], active: true, target: { type: "booking" } } : null,
    socialsInFooter: true,
    socialsInNav: false,
  };
}

// ── Navegación lista para renderizar ─────────────────────────────────────

export interface RenderLink {
  id: string;
  label: string;
  href: string;
  newTab: boolean;
}

export interface RenderCta {
  label: string;
  href: string;
  newTab: boolean;
  // true = abre el modal de reserva (en vez de navegar).
  booking: boolean;
}

export interface RenderNav {
  links: RenderLink[];
  cta: RenderCta | null;
  // Sin navegación guardada se conserva el botón de WhatsApp de siempre.
  showWhatsappButton: boolean;
  socialsInFooter: boolean;
  socialsInNav: boolean;
}

// Solo entra lo activo y que se puede cumplir. Un enlace roto NO se muestra
// (el panel lo marca para corregirlo) — nunca queda un link muerto público.
export function resolveRenderNav(stored: NavConfig | null, ctx: NavContext, intent: BookingIntent): RenderNav {
  const config = stored ?? defaultNavConfig(ctx, intent);
  const links: RenderLink[] = [];
  for (const link of config.links) {
    if (!link.active) continue;
    const r = resolveNavTarget(link.target, ctx);
    if (r.ok) links.push({ id: link.id, label: link.label, href: r.href, newTab: r.newTab });
  }

  let cta: RenderCta | null = null;
  if (config.cta?.active) {
    const r = resolveNavTarget(config.cta.target, ctx);
    if (r.ok) cta = { label: config.cta.label, href: r.href, newTab: r.newTab, booking: !!r.booking };
  }

  return {
    links,
    cta,
    showWhatsappButton: stored === null,
    socialsInFooter: config.socialsInFooter,
    socialsInNav: config.socialsInNav,
  };
}

// Enlaces/CTA activos que hoy no se pueden cumplir (para avisar y corregir).
export interface NavIssue {
  where: "link" | "cta";
  id: string;
  label: string;
  problem: NavProblem;
}

export function findNavIssues(config: NavConfig, ctx: NavContext): NavIssue[] {
  const issues: NavIssue[] = [];
  for (const link of config.links) {
    if (!link.active) continue;
    const r = resolveNavTarget(link.target, ctx);
    if (!r.ok) issues.push({ where: "link", id: link.id, label: link.label, problem: r.problem });
  }
  if (config.cta?.active) {
    const r = resolveNavTarget(config.cta.target, ctx);
    if (!r.ok) issues.push({ where: "cta", id: "cta", label: config.cta.label, problem: r.problem });
  }
  return issues;
}

// Etiquetas de los enlaces/CTA que apuntan a una sección (se usa al ocultar
// una sección para avisar qué se rompería).
export function navLabelsPointingTo(config: NavConfig | null, kinds: ReadonlySet<string>): string[] {
  if (!config) return [];
  const labels: string[] = [];
  for (const link of config.links) {
    if (link.active && link.target.type === "section" && kinds.has(link.target.kind)) labels.push(link.label);
  }
  if (config.cta?.active && config.cta.target.type === "section" && kinds.has(config.cta.target.kind)) labels.push(config.cta.label);
  return labels;
}
