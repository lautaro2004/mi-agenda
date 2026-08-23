import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { updateBusinessInfo } from "@/modules/business/service";
import { siteTemplateSchema } from "@/lib/schemas";

export async function PATCH(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = siteTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Plantilla inválida." }, { status: 400 });
  }

  try {
    const business = await updateBusinessInfo(businessId, parsed.data);
    return NextResponse.json({ business });
  } catch (error) {
    console.error("[Site Template API] PATCH error:", error);
    return NextResponse.json({ error: "No pudimos guardar la plantilla." }, { status: 500 });
  }
}
