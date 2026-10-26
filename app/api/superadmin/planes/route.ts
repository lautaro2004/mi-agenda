import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { planSchema } from "@/lib/schemas";
import { createPlan, listPlansForAdmin, validatePlanCommercial } from "@/modules/billing/subscription";
import { syncPlanPricesWithMercadoPago, syncPlanWithMercadoPago } from "@/modules/billing/mercadopago/sync-plan";

export async function GET() {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const plans = await listPlansForAdmin();
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const commercialError = validatePlanCommercial(parsed.data);
  if (commercialError) return NextResponse.json({ error: commercialError }, { status: 400 });

  try {
    const plan = await createPlan(parsed.data);
    // Fase 2: un plan pago recién creado se sincroniza con Mercado Pago de
    // inmediato — un plan de precio 0 (Agenda interna) nunca dispara nada (ver syncPlanWithMercadoPago).
    // Un error acá NUNCA revierte la creación del Plan en Nexo (ya se
    // guardó bien): queda reflejado en mercadoPagoSyncStatus/SyncError para
    // que Superadmin lo vea y reintente, en vez de perder el plan recién
    // creado por un problema de MP.
    const synced = await syncPlanWithMercadoPago(plan);
    // Después del mensual de siempre: precio anual (si hay) — ver sync-plan.ts.
    await syncPlanPricesWithMercadoPago(plan.id);
    const fresh = (await listPlansForAdmin()).find((p) => p.id === plan.id);
    return NextResponse.json({ plan: fresh ?? synced ?? plan }, { status: 201 });
  } catch (error) {
    // Choque más probable: slug duplicado (@unique en Plan.slug).
    console.error("[superadmin/planes] Error al crear plan:", error);
    return NextResponse.json({ error: "No pudimos crear el plan. ¿El slug ya existe?" }, { status: 400 });
  }
}
