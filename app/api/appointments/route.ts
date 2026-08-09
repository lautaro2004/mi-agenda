import { NextResponse } from "next/server";

import { getAppointments, getAppointmentStats } from "@/modules/appointments/service";
import { getCurrentBusinessId } from "@/modules/business/current";

export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statsOnly = searchParams.get("stats") === "1";

  try {
    if (statsOnly) {
      const stats = await getAppointmentStats(businessId);
      return NextResponse.json(stats);
    }

    const appointments = await getAppointments(businessId, {
      date: searchParams.get("date") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    return NextResponse.json({ appointments });
  } catch (error) {
    console.error("[Appointments API] GET error:", error);
    return NextResponse.json({ error: "Error al obtener turnos." }, { status: 500 });
  }
}
