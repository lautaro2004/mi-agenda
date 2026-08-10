import { prisma } from "@/lib/prisma";
import type { Resource } from "@/lib/types";
import type { ResourceFormValues } from "@/lib/schemas";

function toClientResource(row: {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  active: boolean;
}): Resource {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    description: row.description,
    active: row.active,
  };
}

export async function listResources(businessId: string): Promise<Resource[]> {
  const rows = await prisma.resource.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toClientResource);
}

export async function createResource(businessId: string, data: ResourceFormValues): Promise<Resource> {
  const row = await prisma.resource.create({
    data: { businessId, name: data.name, description: data.description ?? null },
  });
  return toClientResource(row);
}

export async function updateResource(
  businessId: string,
  id: string,
  data: ResourceFormValues
): Promise<Resource | null> {
  const result = await prisma.resource.updateMany({
    where: { id, businessId },
    data: { name: data.name, description: data.description ?? null },
  });
  if (result.count === 0) return null;
  const row = await prisma.resource.findUniqueOrThrow({ where: { id } });
  return toClientResource(row);
}

export async function setResourceActive(
  businessId: string,
  id: string,
  active: boolean
): Promise<Resource | null> {
  const result = await prisma.resource.updateMany({ where: { id, businessId }, data: { active } });
  if (result.count === 0) return null;
  const row = await prisma.resource.findUniqueOrThrow({ where: { id } });
  return toClientResource(row);
}

// Nunca borra físicamente un recurso con historial: un Appointment con
// resourceId apuntando a una fila borrada perdería contexto real de qué
// pasó. Si tiene turnos asociados (de cualquier estado, incluidos
// cancelados — es historial igual), se desactiva en su lugar. Devuelve qué
// pasó para que la UI pueda avisarle al dueño.
export async function deleteResource(
  businessId: string,
  id: string
): Promise<{ result: "deleted" | "deactivated" | "not_found" }> {
  const resource = await prisma.resource.findFirst({ where: { id, businessId } });
  if (!resource) return { result: "not_found" };

  const appointmentCount = await prisma.appointment.count({ where: { resourceId: id } });
  if (appointmentCount > 0) {
    await prisma.resource.update({ where: { id }, data: { active: false } });
    return { result: "deactivated" };
  }

  await prisma.resource.delete({ where: { id } });
  return { result: "deleted" };
}

export async function getServiceResourceIds(businessId: string, serviceId: string): Promise<string[]> {
  const rows = await prisma.serviceResource.findMany({
    where: { serviceId, service: { businessId } },
    select: { resourceId: true },
  });
  return rows.map((r) => r.resourceId);
}

// Reemplaza el conjunto completo de recursos vinculados a un servicio (mismo
// patrón que replaceSchedule): valida que los ids pertenezcan al negocio
// antes de tocar nada, y hace el swap en una transacción.
export async function setServiceResources(
  businessId: string,
  serviceId: string,
  resourceIds: string[]
): Promise<void> {
  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service) throw new Error("Servicio no encontrado.");

  if (resourceIds.length > 0) {
    const validCount = await prisma.resource.count({ where: { id: { in: resourceIds }, businessId } });
    if (validCount !== resourceIds.length) {
      throw new Error("Uno o más recursos no pertenecen a este negocio.");
    }
  }

  await prisma.$transaction([
    prisma.serviceResource.deleteMany({ where: { serviceId } }),
    ...(resourceIds.length > 0
      ? [
          prisma.serviceResource.createMany({
            data: resourceIds.map((resourceId) => ({ serviceId, resourceId })),
          }),
        ]
      : []),
  ]);
}

// Único punto que decide "¿este servicio usa recursos, y cuáles están
// activos?" — usado tanto por la disponibilidad (WhatsApp y dashboard) como
// por la asignación al crear un turno. Un array vacío significa "no usa
// recursos": el caller debe caer al comportamiento de agenda general.
export async function getActiveServiceResources(businessId: string, serviceId: string): Promise<Resource[]> {
  const rows = await prisma.resource.findMany({
    where: { businessId, active: true, services: { some: { serviceId } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toClientResource);
}
