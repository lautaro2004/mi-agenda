import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { markNotificationRead } from "@/modules/notifications/service";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  await markNotificationRead(businessId, id);
  return NextResponse.json({ ok: true });
}
