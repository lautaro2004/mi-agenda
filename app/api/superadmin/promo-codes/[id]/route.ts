import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { promoCodeUpdateSchema } from "@/lib/schemas";
import { getPromoCodeDetail, updatePromoCode } from "@/modules/promo-codes/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Detalle + historial de canjes (sección 7 del pedido: "código → quién lo
// utilizó → cuándo → qué beneficio recibió").
export async function GET(_request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const detail = await getPromoCodeDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Código no encontrado." }, { status: 404 });
  }
  return NextResponse.json(detail);
}

// Solo PATCH — igual que /api/superadmin/planes/[id]: nunca se borra un
// código físicamente (sección 5 del pedido), solo se activa/desactiva o se
// edita.
export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = promoCodeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  try {
    const promoCode = await updatePromoCode(id, {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(`${parsed.data.expiresAt}T23:59:59`) : undefined,
    });
    if (!promoCode) {
      return NextResponse.json({ error: "Código no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ promoCode });
  } catch (error) {
    console.error("[superadmin/promo-codes/:id] Error al actualizar código:", error);
    return NextResponse.json({ error: "No pudimos actualizar el código. ¿Ya existe uno igual?" }, { status: 400 });
  }
}
