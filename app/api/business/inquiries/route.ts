import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { listInquiries } from "@/modules/inquiries/service";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const inquiries = await listInquiries(businessId);
  return NextResponse.json({ inquiries });
}
