import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { getBusinessDetailForAdmin, type SuperadminPeriod } from "@/lib/superadmin/queries";
import { deleteBusinessForAdmin } from "@/modules/admin/delete-business";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_PERIODS: SuperadminPeriod[] = ["7d", "30d", "month"];

function parsePeriod(value: string | null): SuperadminPeriod {
  return VALID_PERIODS.includes(value as SuperadminPeriod) ? (value as SuperadminPeriod) : "month";
}

// Sin este chequeo, cualquier dueño de negocio autenticado podría pedir el
// detalle de OTRA empresa con solo cambiar el id en la URL — a diferencia
// del resto de la app (donde getCurrentBusinessId() ya limita todo al
// negocio de la sesión), acá el id viene de la URL, así que la única
// protección posible es esta.
export async function GET(request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const period = parsePeriod(searchParams.get("period"));

  const detail = await getBusinessDetailForAdmin(id, period);
  if (!detail) {
    return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ business: detail });
}

// Borrado definitivo de una empresa (pensado para limpiar negocios de prueba).
// Exige que el cliente reenvíe el nombre exacto: el servidor lo vuelve a
// comparar contra la base, no confía en el botón deshabilitado de la pantalla.
export async function DELETE(request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { confirmName?: unknown } | null;
  const confirmName = typeof body?.confirmName === "string" ? body.confirmName : "";

  const result = await deleteBusinessForAdmin({ businessId: id, confirmName, actorEmail: admin.email });
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
