import { NextResponse } from "next/server";

import { leadFormSchema } from "@/lib/schemas";
import { isRateLimited } from "@/lib/rate-limit";
import { createLead } from "@/modules/leads/service";

// Público a propósito (sección 5 del pedido): cualquier visitante de la
// landing puede mandar esto, sin sesión. Solo expone POST — nada para
// listar/editar/borrar leads vive acá, eso es exclusivo de
// /api/superadmin/leads (protegido con getSuperadminSession, ver ese
// archivo) — sección 16 del pedido: "no permitir modificar leads desde una
// API pública".
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (isRateLimited(`lead:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Recibimos muchas solicitudes. Probá de nuevo en un rato." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = leadFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  // Honeypot: un campo oculto por CSS en el form real — un visitante humano
  // nunca lo completa, un bot que autocompleta todos los inputs sí. Nunca se
  // le avisa al bot que fue detectado: se responde éxito sin crear el Lead.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const { website: _website, ...input } = parsed.data;
  await createLead(input);

  return NextResponse.json({ ok: true });
}
