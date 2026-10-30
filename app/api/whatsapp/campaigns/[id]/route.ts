import { NextResponse } from "next/server";

import { CAMPAIGN_STATUSES } from "@/lib/campaigns";
import { getCurrentBusinessId } from "@/modules/business/current";
import { getCampaign, setCampaignStatus, updateCampaign } from "@/modules/whatsapp/campaigns/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id } = await params;
  const campaign = await getCampaign(businessId, id);
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PUT(request: Request, { params }: Ctx) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  try {
    const result = await updateCampaign(businessId, id, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ campaign: result.value });
  } catch (error) {
    console.error("[api/whatsapp/campaigns] Error al actualizar:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No pudimos guardar la campaña." }, { status: 500 });
  }
}

// Cambio de estado (activar, pausar, archivar) sin reenviar toda la campaña.
export async function PATCH(request: Request, { params }: Ctx) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const status = CAMPAIGN_STATUSES.find((s) => s === body?.status);
  if (!status) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  try {
    const result = await setCampaignStatus(businessId, id, status);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ campaign: result.value });
  } catch (error) {
    console.error("[api/whatsapp/campaigns] Error al cambiar el estado:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No pudimos cambiar el estado." }, { status: 500 });
  }
}
