import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { getSuperadminOverview } from "@/lib/superadmin/queries";

export async function GET() {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const overview = await getSuperadminOverview();
  return NextResponse.json({ overview });
}
