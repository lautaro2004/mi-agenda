import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentBusinessId } from "@/modules/business/current";
import { changeExtraUsers } from "@/modules/billing/mercadopago/extra-users";

const bodySchema = z.object({ extraUsers: z.coerce.number().int().min(0).max(500) });

// businessId sale siempre de la sesión (solo el dueño); el body trae solo la
// cantidad pedida. El precio y el límite se calculan en el servidor.
export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "owner" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "La cantidad de usuarios extra no es válida." }, { status: 400 });

  const result = await changeExtraUsers(businessId, parsed.data.extraUsers);
  if (!result.ok) {
    const status = result.error === "MERCADOPAGO_ERROR" || result.error === "FX_UNAVAILABLE" ? 502 : 400;
    return NextResponse.json({ error: result.error, message: result.message }, { status });
  }
  return NextResponse.json(result);
}
