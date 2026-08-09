import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { ensureOwnerMembership } from "@/modules/business/membership";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as { businessName?: string };
  const businessName = body.businessName?.trim();

  if (!businessName) {
    return NextResponse.json({ error: "El nombre del negocio es requerido." }, { status: 400 });
  }

  await ensureOwnerMembership(session.user.id, businessName);

  return NextResponse.json({ ok: true });
}
