import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getBusinessState } from "@/modules/business/service";
import { listActiveGalleryBlocks } from "@/modules/business/gallery";
import { listBanners } from "@/modules/site/banners";
import { effectiveTemplate, getLayoutItems, saveLayout } from "@/modules/site/layout";
import { getStoredNavConfig } from "@/modules/site/nav";
import { navLabelsPointingTo } from "@/lib/site-nav";
import { CONTACT_SECTION_KIND, SITE_SECTIONS, siteLayoutInputSchema } from "@/lib/site-sections";

// businessId sale SIEMPRE de la sesión, nunca del body: un negocio no puede
// leer ni modificar el orden de otro.
export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const [state, banners, galleryBlocks] = await Promise.all([
    getBusinessState(businessId),
    listBanners(businessId),
    listActiveGalleryBlocks(businessId),
  ]);
  const template = effectiveTemplate(state.business.siteTemplate, state.services);
  const items = await getLayoutItems(businessId, template, new Set(banners.map((b) => b.id)));

  // Avisos al dueño: secciones que hoy no se muestran por falta de contenido.
  const hints: Record<string, string> = {};
  if (galleryBlocks.length === 0) hints.gallery = "Todavía no tenés fotos activas: la sección no se muestra.";
  if (state.faqs.length === 0) hints.faq = "Todavía no cargaste preguntas: la sección no se muestra.";
  if (!(state.business.menuEnabled && state.business.menuPdfUrl)) hints.menu = "Tu carta no está activa: la sección no se muestra.";
  if (!state.schedule.some((d) => d.enabled)) hints.schedule = "No tenés días de atención configurados: la sección no se muestra.";

  return NextResponse.json({
    template,
    items,
    sections: SITE_SECTIONS[template],
    contactKind: CONTACT_SECTION_KIND[template],
    banners,
    hints,
    contacts: {
      whatsapp: !!state.business.whatsappNumber?.replace(/[^0-9]/g, ""),
      phone: !!state.business.phone?.replace(/[^0-9]/g, ""),
    },
  });
}

export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = siteLayoutInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos de secciones inválidos." }, { status: 400 });

  try {
    const result = await saveLayout(businessId, parsed.data.template, parsed.data.items);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    // Si se ocultó una sección a la que apunta la navegación, se avisa para
    // que el dueño la corrija (el sitio público ya no muestra ese enlace).
    const hidden = new Set(result.items.filter((i) => !i.visible && i.kind !== "banner").map((i) => i.kind));
    const navWarnings = navLabelsPointingTo(await getStoredNavConfig(businessId), hidden);
    return NextResponse.json({ items: result.items, navWarnings });
  } catch (error) {
    console.error("[api/business/site-layout] Error al guardar:", error);
    return NextResponse.json({ error: "No pudimos guardar el orden de las secciones. Intentá de nuevo." }, { status: 500 });
  }
}
