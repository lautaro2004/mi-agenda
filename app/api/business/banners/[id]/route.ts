import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentBusinessId } from "@/modules/business/current";
import {
  BannerValidationError,
  deleteBanner,
  parseBannerInput,
  setBannerActive,
  updateBanner,
} from "@/modules/site/banners";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const activeOnlySchema = z.object({ active: z.boolean() }).strict();

// PATCH acepta o bien { active } (el interruptor de la lista) o el banner
// completo (el formulario de edición).
export async function PATCH(request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);

  try {
    const activeOnly = activeOnlySchema.safeParse(body);
    if (activeOnly.success) {
      const banner = await setBannerActive(businessId, id, activeOnly.data.active);
      if (!banner) return NextResponse.json({ error: "Banner no encontrado." }, { status: 404 });
      return NextResponse.json({ banner });
    }

    const parsed = parseBannerInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const banner = await updateBanner(businessId, id, parsed.data);
    if (!banner) return NextResponse.json({ error: "Banner no encontrado." }, { status: 404 });
    return NextResponse.json({ banner });
  } catch (error) {
    if (error instanceof BannerValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[api/business/banners/:id] Error al actualizar:", error);
    return NextResponse.json({ error: "No pudimos guardar el banner. Intentá de nuevo." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  try {
    const deleted = await deleteBanner(businessId, (await params).id);
    if (!deleted) return NextResponse.json({ error: "Banner no encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/business/banners/:id] Error al eliminar:", error);
    return NextResponse.json({ error: "No pudimos eliminar el banner. Intentá de nuevo." }, { status: 500 });
  }
}
