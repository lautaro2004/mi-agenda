import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getSubscriptionWithPlan, resolveAiAccess } from "@/modules/billing/subscription";
import { getAiUsageSummary, resolvePeriodStart } from "@/lib/superadmin/queries";

// businessId sale SIEMPRE de la sesión (getCurrentBusinessId), nunca de un
// parámetro del cliente — mismo criterio que el resto de app/api/business/*.
// Esto es lo único que evita que un negocio pueda pedir la suscripción de
// otro con solo cambiar un id en la URL.
export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const sub = await getSubscriptionWithPlan(businessId);
  const access = resolveAiAccess(sub);

  const monthStart = resolvePeriodStart("month");
  const aiUsage = await getAiUsageSummary({ from: monthStart, businessId });

  return NextResponse.json({
    // null solo en el caso legacy de un negocio sin Subscription todavía
    // (no debería pasar tras el backfill/ensureTrialSubscription, pero la
    // UI lo contempla como empty state en vez de asumir que siempre existe).
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          plan: sub.plan,
        }
      : null,
    // access.allowed ya contempla trial vencido / canceled / expired (ver
    // resolveAiAccess en modules/billing/subscription.ts) — la UI nunca
    // recalcula esta regla, solo la muestra.
    access: { allowed: access.allowed },
    aiUsage,
  });
}
