import { NextResponse } from "next/server";
import { z } from "zod";

import { changeExtraUsers } from "@/modules/billing/mercadopago/extra-users";
import { resolveOwnedBusiness, verifyNodoBillingRequest } from "@/modules/billing/nodo-internal";

const bodySchema = z.object({
  userId: z.string().min(1),
  extraUsers: z.coerce.number().int().min(0).max(500),
});

// Cambio de usuarios extra desde Nodo. Misma función que la pantalla de Nexo
// (changeExtraUsers): el precio y el límite los calcula Nexo; el body solo trae
// la cantidad pedida y el userId que Nodo resolvió de su sesión (debe ser el
// DUEÑO del negocio).
export async function POST(request: Request) {
  const denied = verifyNodoBillingRequest(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "La cantidad de usuarios extra no es válida." }, { status: 400 });

  const businessId = await resolveOwnedBusiness(parsed.data.userId);
  if (!businessId) return NextResponse.json({ error: "FORBIDDEN", message: "Solo el dueño del negocio puede cambiar los usuarios." }, { status: 403 });

  const result = await changeExtraUsers(businessId, parsed.data.extraUsers);
  if (!result.ok) {
    const status = result.error === "MERCADOPAGO_ERROR" || result.error === "FX_UNAVAILABLE" ? 502 : 400;
    return NextResponse.json({ error: result.error, message: result.message }, { status });
  }
  return NextResponse.json(result);
}
