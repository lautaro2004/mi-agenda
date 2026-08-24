import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";
import { getBusinessStats } from "@/modules/analytics/service";
import { resolvePeriodStart, type SuperadminPeriod } from "@/lib/superadmin/queries";

function parsePeriod(value: string | null): SuperadminPeriod {
  return value === "7d" || value === "30d" ? value : "month";
}

export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const features = await resolveBusinessPlanFeatures(businessId);
  if (!features.statsEnabled) {
    return NextResponse.json(
      {
        error: "Las estadísticas están disponibles desde el plan Esencial. Mejorá tu plan para activarlas.",
        upgradeRequired: true,
      },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const period = parsePeriod(searchParams.get("period"));
  const from = resolvePeriodStart(period);
  const stats = await getBusinessStats(businessId, from, new Date());

  return NextResponse.json({ stats });
}
