import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DEFAULT_LEAD_FORM, resolveLeadFormConfig, type LeadFormConfig } from "@/lib/lead-form";

// Configuración del formulario de captación por negocio (ver
// lib/lead-form.ts). Lectura resiliente: el sitio público y la ruta de
// consultas la usan en cada visita/envío, así que un error acá (tabla sin
// migrar, JSON inválido) nunca debe tirar abajo el formulario — cae en el de
// siempre.
export async function getLeadFormConfig(businessId: string): Promise<LeadFormConfig> {
  try {
    const row = await prisma.leadForm.findUnique({ where: { businessId }, select: { fields: true } });
    return row ? resolveLeadFormConfig(row.fields) : DEFAULT_LEAD_FORM;
  } catch (error) {
    console.error("[lead-form] No se pudo leer la configuración, se usa la estándar:", error);
    return DEFAULT_LEAD_FORM;
  }
}

export async function saveLeadFormConfig(businessId: string, config: LeadFormConfig): Promise<LeadFormConfig> {
  await prisma.leadForm.upsert({
    where: { businessId },
    update: { fields: config as Prisma.InputJsonValue },
    create: { businessId, fields: config as Prisma.InputJsonValue },
  });
  return config;
}

export async function resetLeadFormConfig(businessId: string): Promise<LeadFormConfig> {
  await prisma.leadForm.deleteMany({ where: { businessId } });
  return DEFAULT_LEAD_FORM;
}
