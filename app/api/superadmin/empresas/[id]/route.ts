import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { getBusinessDetailForAdmin, type SuperadminPeriod } from "@/lib/superadmin/queries";

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
