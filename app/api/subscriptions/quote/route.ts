import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getCheckoutQuote } from "@/modules/billing/quote";

// Cotización para mostrar ANTES de contratar (ver modules/billing/quote.ts).
export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "owner" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const result = await getCheckoutQuote({
    planId: url.searchParams.get("planId") ?? "",
    interval: url.searchParams.get("interval") === "year" ? "year" : "month",
    extraUsers: Number(url.searchParams.get("extraUsers") ?? 0) || 0,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
