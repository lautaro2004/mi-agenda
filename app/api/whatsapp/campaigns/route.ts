import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createCampaign, listCampaigns } from "@/modules/whatsapp/campaigns/service";

// businessId sale SIEMPRE de la sesión. Lectura: cualquier miembro; escritura: admin.
export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ campaigns: await listCampaigns(businessId) });
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  try {
    const result = await createCampaign(businessId, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ campaign: result.value }, { status: 201 });
  } catch (error) {
    console.error("[api/whatsapp/campaigns] Error al crear:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No pudimos guardar la campaña." }, { status: 500 });
  }
}
