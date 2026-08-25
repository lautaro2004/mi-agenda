import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getCurrentBusinessId } from "@/modules/business/current";
import { redeemPromoCodeSchema } from "@/lib/schemas";
import { PROMO_CODE_ERROR_MESSAGE } from "@/modules/promo-codes/validate";
import { redeemPromoCode } from "@/modules/promo-codes/service";

// Toda la validación real pasa por acá — sección 8 del pedido: el frontend
// nunca decide si un código es válido, solo muestra lo que este endpoint
// responde. businessId/userId salen SIEMPRE de la sesión, nunca del body.
export async function POST(request: Request) {
  const [businessId, session] = await Promise.all([
    getCurrentBusinessId(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!businessId || !session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = redeemPromoCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ingresá un código." }, { status: 400 });
  }

  const result = await redeemPromoCode({ code: parsed.data.code, businessId, userId: session.user.id });
  if (!result.ok) {
    return NextResponse.json({ error: PROMO_CODE_ERROR_MESSAGE[result.error] }, { status: 400 });
  }

  return NextResponse.json({ planName: result.planName, bonusExpiresAt: result.bonusExpiresAt.toISOString() });
}
