import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getSubscriptionWithPlan, resolveAiAccess } from "@/modules/billing/subscription";
import type { ProductAccess } from "@/lib/billing-access";
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
    // (no debería pasar tras el backfill/ensureBaseSubscription, pero la
    // UI lo contempla como empty state en vez de asumir que siempre existe).
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          // Fase 5: la UI solo ofrece "Cancelar suscripción" cuando el plan
          // pago corre por Mercado Pago — uno manual/beneficio/promo no
          // tiene nada que cancelar del lado de un proveedor externo.
          provider: sub.provider,
          // Plan CONTRATADO (lo que el negocio pagó / tiene asignado).
          plan: sub.plan,
          // Plan con el que Nexo funciona HOY: el contratado, o el gratuito si
          // venció la gracia/prueba/período. Las pantallas gatean con esto.
          effectivePlan: sub.nexoPlan,
          degraded: sub.nexoOnBaseTier && sub.plan.id !== sub.nexoPlan.id,
          nexoAccess: serializeAccess(sub.nexoAccess),
          pastDueSince: sub.pastDueSince?.toISOString() ?? null,
          billingInterval: sub.billingInterval,
        }
      : null,
    // access.allowed ya contempla trial vencido / canceled / expired (ver
    // resolveAiAccess en modules/billing/subscription.ts) — la UI nunca
    // recalcula esta regla, solo la muestra.
    access: { allowed: access.allowed },
    aiUsage,
  });
}

function serializeAccess(a: ProductAccess) {
  return {
    access: a.access,
    reason: a.reason,
    graceEndsAt: a.access === "grace" ? a.graceEndsAt.toISOString() : null,
    periodEndsAt: a.access === "full" ? (a.periodEndsAt?.toISOString() ?? null) : null,
  };
}
