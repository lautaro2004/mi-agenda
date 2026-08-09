import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createMemoryEntry, listMemoryEntries } from "@/modules/employee/memory";
import { memoryEntrySchema } from "@/lib/schemas";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const entries = await listMemoryEntries(businessId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = memoryEntrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la entrada inválidos." }, { status: 400 });
  }

  const entry = await createMemoryEntry(businessId, parsed.data);
  return NextResponse.json({ entry }, { status: 201 });
}
