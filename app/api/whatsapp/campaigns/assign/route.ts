import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentBusinessId } from "@/modules/business/current";
import { assignCampaignManually, getAttributions } from "@/modules/whatsapp/campaigns/service";

const assignSchema = z.object({ conversationRef: z.string().trim().min(3).max(120), campaignId: z.string().trim().min(1).max(60).nullable() });

// Atribución actual de una conversación (para mostrar su origen en el chat).
export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const ref = new URL(request.url).searchParams.get("conversationRef");
  if (!ref) return NextResponse.json({ error: "Falta la conversación." }, { status: 400 });
  const [attribution] = await getAttributions(businessId, [ref]);
  return NextResponse.json({ attribution: attribution ?? null });
}

// Asignación manual: queda como origen CONFIRMADO. La campaña tiene que ser del negocio.
export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const parsed = assignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  const result = await assignCampaignManually({ businessId, ...parsed.data });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ attribution: result.value });
}
