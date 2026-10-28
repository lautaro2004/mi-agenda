import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getBusinessState } from "@/modules/business/service";
import { listActiveGalleryBlocks } from "@/modules/business/gallery";
import { listBanners } from "@/modules/site/banners";
import { effectiveTemplate, getLayoutItems } from "@/modules/site/layout";
import { buildEditorState, buildNavContext, getStoredNavConfig, resetNavConfig, saveNavConfig } from "@/modules/site/nav";
import { getBookingIntent } from "@/lib/booking-intent";
import { CONTACT_SECTION_KIND } from "@/lib/site-sections";
import { MAX_NAV_LINKS } from "@/lib/site-nav";
import { buildSocialLinks } from "@/lib/social";

// businessId sale SIEMPRE de la sesión. Lectura: cualquier miembro; escritura: admin.
async function loadEditorState(businessId: string) {
  const [state, banners, galleryBlocks, stored] = await Promise.all([
    getBusinessState(businessId),
    listBanners(businessId),
    listActiveGalleryBlocks(businessId),
    getStoredNavConfig(businessId),
  ]);
  const template = effectiveTemplate(state.business.siteTemplate, state.services);
  const items = await getLayoutItems(businessId, template, new Set(banners.map((b) => b.id)));
  const layoutVisibleKinds = new Set(items.filter((i) => i.visible && i.kind !== "banner").map((i) => i.kind));
  const ctx = buildNavContext({
    slug: state.business.slug ?? "",
    template,
    business: state.business,
    services: state.services,
    faqCount: state.faqs.length,
    hasSchedule: state.schedule.some((d) => d.enabled),
    galleryCount: galleryBlocks.length,
    layoutVisibleKinds,
  });
  const editor = buildEditorState(stored, ctx, getBookingIntent(state.services), CONTACT_SECTION_KIND[template]);
  return {
    ...editor,
    maxLinks: MAX_NAV_LINKS,
    template,
    socials: buildSocialLinks(state.business).map((s) => ({ platform: s.platform, label: s.label })),
  };
}

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json(await loadEditorState(businessId));
}

export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  try {
    const result = await saveNavConfig(businessId, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(await loadEditorState(businessId));
  } catch (error) {
    console.error("[api/business/site-nav] Error al guardar:", error);
    return NextResponse.json({ error: "No pudimos guardar la navegación. Intentá de nuevo." }, { status: 500 });
  }
}

// Restablece la navegación automática.
export async function DELETE() {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await resetNavConfig(businessId);
    return NextResponse.json(await loadEditorState(businessId));
  } catch (error) {
    console.error("[api/business/site-nav] Error al restablecer:", error);
    return NextResponse.json({ error: "No pudimos restablecer la navegación." }, { status: 500 });
  }
}
