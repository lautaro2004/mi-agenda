import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { AI_OPERATIONS, type AiOperation } from "@/modules/ai/usage";
import {
  getAiUsageByOperation,
  getAiUsageRanking,
  getAiUsageSummary,
  getAiUsageTimeSeries,
  resolvePeriodStart,
  type SuperadminPeriod,
} from "@/lib/superadmin/queries";

const VALID_PERIODS: SuperadminPeriod[] = ["7d", "30d", "month"];

function parsePeriod(value: string | null): SuperadminPeriod {
  return VALID_PERIODS.includes(value as SuperadminPeriod) ? (value as SuperadminPeriod) : "30d";
}

function parseOperation(value: string | null): AiOperation | undefined {
  return AI_OPERATIONS.includes(value as AiOperation) ? (value as AiOperation) : undefined;
}

export async function GET(request: Request) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = parsePeriod(searchParams.get("period"));
  const businessId = searchParams.get("businessId")?.trim() || undefined;
  const operation = parseOperation(searchParams.get("operation"));
  const from = resolvePeriodStart(period);

  const [summary, byOperation, timeSeries, ranking] = await Promise.all([
    getAiUsageSummary({ from, businessId, operation }),
    getAiUsageByOperation({ from, businessId }),
    getAiUsageTimeSeries({ from, businessId, operation }),
    getAiUsageRanking({ from, take: 10 }),
  ]);

  return NextResponse.json({ summary, byOperation, timeSeries, ranking, operations: AI_OPERATIONS });
}
