import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { countUnreadNotifications, listNotifications } from "@/modules/notifications/service";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(businessId),
    countUnreadNotifications(businessId),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
