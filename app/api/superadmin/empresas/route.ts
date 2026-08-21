import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { listBusinessesForAdmin, type AdminBusinessFilter } from "@/lib/superadmin/queries";

const VALID_FILTERS: AdminBusinessFilter[] = ["all", "onboarding_incomplete", "near_limit", "inactive"];

function parseFilter(value: string | null): AdminBusinessFilter {
  return VALID_FILTERS.includes(value as AdminBusinessFilter) ? (value as AdminBusinessFilter) : "all";
}

export async function GET(request: Request) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const filter = parseFilter(searchParams.get("filter"));

  const businesses = await listBusinessesForAdmin({ q, filter });
  return NextResponse.json({ businesses });
}
