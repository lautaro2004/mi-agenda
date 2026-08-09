import { NextResponse } from "next/server";

import { aiLogger } from "@/modules/ai/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  return NextResponse.json({ logs: aiLogger.recent(limit) });
}
