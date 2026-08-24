import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createService } from "@/modules/business/service";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";
import { prisma } from "@/lib/prisma";
import { serviceSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = serviceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de servicio inválidos." }, { status: 400 });
  }

  // maxServices null = sin límite (Profesional) — nunca se cuenta en ese
  // caso, evita un count() innecesario. El límite es sobre la CANTIDAD total
  // de servicios, no sobre si este nombre puntual ya existe — createService
  // ya es un upsert por (businessId, name), así que editar uno existente
  // nunca choca contra este límite.
  const features = await resolveBusinessPlanFeatures(businessId);
  if (features.maxServices !== null) {
    const existing = await prisma.service.findUnique({ where: { businessId_name: { businessId, name: parsed.data.name } } });
    if (!existing) {
      const count = await prisma.service.count({ where: { businessId } });
      if (count >= features.maxServices) {
        return NextResponse.json(
          {
            error: `Tu plan permite hasta ${features.maxServices} servicios. Mejorá tu plan para agregar más desde /dashboard/suscripcion.`,
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }
    }
  }

  const service = await createService(businessId, parsed.data);
  return NextResponse.json({ service }, { status: 201 });
}
