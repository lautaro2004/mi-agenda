import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getBookingIntent } from "@/lib/booking-intent";
import {
  canonicalizeNav,
  defaultNavConfig,
  findNavIssues,
  navConfigSchema,
  parseStoredNav,
  resolveRenderNav,
  type NavConfig,
  type NavContext,
  type NavIssue,
  type RenderNav,
} from "@/lib/site-nav";
import { listActiveGalleryBlocks } from "@/modules/business/gallery";
import { effectiveTemplate, loadPublicLayout } from "@/modules/site/layout";
import { getBuiltinDefs } from "@/lib/site-sections";
import { isBookableService, type Business, type FAQ, type BusinessSchedule, type Service, type SiteTemplate } from "@/lib/types";
import { revalidatePublicSite } from "@/modules/site/revalidate";

export async function getStoredNavConfig(businessId: string): Promise<NavConfig | null> {
  try {
    const row = await prisma.siteNav.findUnique({ where: { businessId } });
    return row ? parseStoredNav(row.config) : null;
  } catch (error) {
    // Un fallo de lectura nunca rompe el sitio público: cae a la navegación por defecto.
    console.error("[site/nav] No se pudo leer la navegación:", error);
    return null;
  }
}

interface ContextInput {
  slug: string;
  template: SiteTemplate;
  business: Pick<Business, "menuEnabled" | "menuPdfUrl" | "whatsappNumber" | "phone" | "description">;
  services: Service[];
  faqCount: number;
  hasSchedule: boolean;
  galleryCount: number;
  // Tipos de sección visibles según el orden/visibilidad guardado.
  layoutVisibleKinds: ReadonlySet<string>;
}

// Un tipo de sección cuenta como "disponible" solo si el dueño no la ocultó y
// tiene contenido real (mismas reglas que usa el render público).
export function buildNavContext(input: ContextInput): NavContext {
  const hasMenu = input.business.menuEnabled && !!input.business.menuPdfUrl;
  const hasBookable = input.services.some(isBookableService);
  const hasContent: Record<string, boolean> = {
    gallery: input.galleryCount > 0,
    faq: input.faqCount > 0,
    menu: hasMenu,
    schedule: input.hasSchedule,
    about: !!input.business.description?.trim(),
    services: input.services.length > 0,
  };
  const visibleKinds = new Set<string>();
  for (const def of getBuiltinDefs(input.template)) {
    if (!input.layoutVisibleKinds.has(def.kind)) continue;
    if (def.kind in hasContent && !hasContent[def.kind]) continue;
    visibleKinds.add(def.kind);
  }
  return {
    slug: input.slug,
    template: input.template,
    visibleKinds,
    hasMenu,
    hasBookable,
    whatsappNumber: input.business.whatsappNumber,
    phone: input.business.phone,
  };
}

export interface NavEditorState {
  config: NavConfig;
  isDefault: boolean;
  issues: NavIssue[];
  // Secciones a las que se puede apuntar, con su disponibilidad actual.
  sectionOptions: { kind: string; label: string; available: boolean }[];
  pageOptions: { page: "carta" | "reservar"; available: boolean }[];
  contacts: { whatsapp: boolean; phone: boolean };
  bookable: boolean;
  contactKind: string;
  contactAvailable: boolean;
}

export function buildEditorState(stored: NavConfig | null, ctx: NavContext, intent: ReturnType<typeof getBookingIntent>, contactKind: string): NavEditorState {
  const config = stored ?? defaultNavConfig(ctx, intent);
  return {
    config,
    isDefault: stored === null,
    issues: findNavIssues(config, ctx),
    sectionOptions: getBuiltinDefs(ctx.template)
      .filter((def) => !def.pinnedFirst)
      .map((def) => ({ kind: def.kind, label: def.label, available: ctx.visibleKinds.has(def.kind) })),
    pageOptions: [
      { page: "carta", available: ctx.hasMenu },
      { page: "reservar", available: ctx.hasBookable },
    ],
    contacts: {
      whatsapp: !!ctx.whatsappNumber?.replace(/[^0-9]/g, ""),
      phone: !!ctx.phone?.replace(/[^0-9]/g, ""),
    },
    bookable: ctx.hasBookable,
    contactKind,
    contactAvailable: ctx.visibleKinds.has(contactKind),
  };
}

export type SaveNavResult = { ok: true; config: NavConfig } | { ok: false; error: string };

// Se valida TODO el objeto en el servidor antes de escribir (destinos,
// largos, esquemas de URL). Los destinos que hoy no se pueden cumplir
// (sección oculta, sin WhatsApp) se permiten guardar — el panel los marca y
// el sitio público simplemente no los muestra —, para no obligar a ordenar
// el contenido antes de poder armar la navegación.
export async function saveNavConfig(businessId: string, input: unknown): Promise<SaveNavResult> {
  const parsed = navConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos de navegación inválidos." };
  }
  const config = canonicalizeNav(parsed.data as NavConfig);
  const json = config as unknown as Prisma.InputJsonValue;
  await prisma.siteNav.upsert({
    where: { businessId },
    update: { config: json },
    create: { businessId, config: json },
  });
  await revalidatePublicSite(businessId);
  return { ok: true, config };
}

// Vuelve a la navegación automática (compatible con los sitios existentes).
export async function resetNavConfig(businessId: string): Promise<void> {
  await prisma.siteNav.deleteMany({ where: { businessId } });
  await revalidatePublicSite(businessId);
}

// Navegación para páginas internas (ej. /reservar), que no arman el layout
// completo: reconstruye qué secciones de la página principal están visibles
// con las mismas reglas, para que los enlaces coincidan con la home.
export async function getPublicNavForSubpage(state: {
  business: Business;
  services: Service[];
  faqs: FAQ[];
  schedule: BusinessSchedule;
}): Promise<RenderNav> {
  const { business, services } = state;
  const slug = business.slug ?? "";
  try {
    const template = effectiveTemplate(business.siteTemplate, services);
    const [stored, layout, galleryBlocks] = await Promise.all([
      getStoredNavConfig(business.id),
      loadPublicLayout(business.id, template),
      listActiveGalleryBlocks(business.id),
    ]);
    const ctx = buildNavContext({
      slug,
      template,
      business,
      services,
      faqCount: state.faqs.length,
      hasSchedule: state.schedule.some((d) => d.enabled),
      galleryCount: galleryBlocks.length,
      layoutVisibleKinds: new Set(layout.items.filter((i) => i.visible && i.kind !== "banner").map((i) => i.kind)),
    });
    return resolveRenderNav(stored, ctx, getBookingIntent(services));
  } catch (error) {
    console.error("[site/nav] Navegación de subpágina, uso la mínima:", error);
    return { links: [], cta: null, showWhatsappButton: true, socialsInFooter: true, socialsInNav: false };
  }
}
