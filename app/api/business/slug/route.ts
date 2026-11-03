import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { changeSlug } from "@/modules/business/slug";

export async function PATCH(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { slug?: unknown } | null;
  if (typeof body?.slug !== "string") return NextResponse.json({ error: "Escribí la nueva URL." }, { status: 400 });

  const result = await changeSlug(businessId, body.slug);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.reason === "taken" ? 409 : 400 });
  return NextResponse.json({ slug: result.slug });
}
