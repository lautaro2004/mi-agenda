import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { markAllNotificationsRead } from "@/modules/notifications/service";

export async function POST() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  await markAllNotificationsRead(businessId);
  return NextResponse.json({ ok: true });
}
