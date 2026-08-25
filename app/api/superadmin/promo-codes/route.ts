import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { promoCodeSchema } from "@/lib/schemas";
import { createPromoCode, listPromoCodes } from "@/modules/promo-codes/service";

export async function GET() {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const promoCodes = await listPromoCodes();
  return NextResponse.json({ promoCodes });
}

export async function POST(request: Request) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = promoCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  try {
    const promoCode = await createPromoCode({
      ...parsed.data,
      expiresAt: new Date(`${parsed.data.expiresAt}T23:59:59`),
    });
    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error) {
    console.error("[superadmin/promo-codes] Error al crear código:", error);
    return NextResponse.json({ error: "No pudimos crear el código. ¿Ya existe uno igual?" }, { status: 400 });
  }
}
