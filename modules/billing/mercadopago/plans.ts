import { PreApprovalPlan } from "mercadopago";

import { getMercadoPagoClient } from "@/modules/billing/mercadopago/client";

// ── preapproval_plan (planes de suscripción de Mercado Pago) ────────────
// Capa fina sobre el SDK oficial — nunca llamar a PreApprovalPlan
// directamente desde fuera de este archivo (sección 6 del pedido original:
// "evitar llamadas directas a Mercado Pago desde múltiples componentes").
//
// Tipo local mínimo en vez de importar el tipo de respuesta del SDK desde un
// path interno (mercadopago/dist/clients/...) — el paquete no reexporta
// PreApprovalPlanResponse desde su entrypoint público. Solo declara los
// campos que este módulo realmente lee; la respuesta real del SDK es un
// superset y lo satisface estructuralmente.
export interface PreapprovalPlanSnapshot {
  id: string;
  status: string | null;
  reason: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
  // application_id/collector_id no son sensibles (identifican de forma
  // pública QUÉ aplicación/cuenta de Mercado Pago es dueña del plan, no una
  // credencial) — se agregaron para el diagnóstico de "Card token service
  // not found" (ver checkout.ts#logPreapprovalPlanDiagnostics): permiten
  // confirmar que el plan pertenece a la misma aplicación que el
  // MERCADOPAGO_ACCESS_TOKEN usado para crearlo/consultarlo.
  applicationId: number | null;
  collectorId: number | null;
}

function toSnapshot(response: {
  id?: string;
  status?: string;
  reason?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
  application_id?: number;
  collector_id?: number;
}): PreapprovalPlanSnapshot {
  if (!response.id) {
    throw new Error("Mercado Pago no devolvió un id de preapproval_plan.");
  }
  return {
    id: response.id,
    status: response.status ?? null,
    reason: response.reason ?? null,
    transactionAmount: response.auto_recurring?.transaction_amount ?? null,
    currencyId: response.auto_recurring?.currency_id ?? null,
    applicationId: response.application_id ?? null,
    collectorId: response.collector_id ?? null,
  };
}

// BETTER_AUTH_URL ya es "la URL base real de esta app" en todo entorno
// (local/sandbox/producción, ver lib/auth/auth.ts) — se reutiliza acá en vez
// de lib/site.ts#SITE_URL, que apunta al dominio del sitio público de
// negocios (miagenda.com, todavía sin confirmar) y no al dashboard de Nexo.
function appBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export interface CreatePreapprovalPlanInput {
  name: string;
  monthlyPrice: number;
  currency: string;
}

// Alta de un preapproval_plan NUEVO — se usa tanto para la primera
// sincronización de un Plan pago como para "versionar" un plan existente
// cuando cambia el precio (ver sync-plan.ts). Frecuencia fija en 1 mes: hoy
// Nexo no vende ningún plan con otra periodicidad (sección 2 del pedido:
// "no inventar nuevos precios ni funcionalidades").
export async function createPreapprovalPlan(input: CreatePreapprovalPlanInput): Promise<PreapprovalPlanSnapshot> {
  const client = new PreApprovalPlan(getMercadoPagoClient());
  const response = await client.create({
    body: {
      reason: input.name,
      back_url: `${appBaseUrl()}/dashboard/suscripcion`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: input.monthlyPrice,
        currency_id: input.currency,
      },
    },
  });
  return toSnapshot(response);
}

export async function getPreapprovalPlan(mercadoPagoPlanId: string): Promise<PreapprovalPlanSnapshot> {
  const client = new PreApprovalPlan(getMercadoPagoClient());
  const response = await client.get({ preApprovalPlanId: mercadoPagoPlanId });
  return toSnapshot(response);
}

export interface UpdatePreapprovalPlanMetadataInput {
  name: string;
  active: boolean;
}

// SOLO metadata confirmada como segura de actualizar in-place (nombre/estado)
// — ver auditoría: la documentación de Mercado Pago no confirma que
// transaction_amount se pueda cambiar sobre un plan existente sin afectar a
// quienes ya están suscriptos a ese precio. El precio SIEMPRE pasa por
// createPreapprovalPlan() (una versión nueva), nunca por acá — ver
// sync-plan.ts para la decisión de cuál camino tomar.
export async function updatePreapprovalPlanMetadata(
  mercadoPagoPlanId: string,
  input: UpdatePreapprovalPlanMetadataInput
): Promise<PreapprovalPlanSnapshot> {
  const client = new PreApprovalPlan(getMercadoPagoClient());
  const response = await client.update({
    id: mercadoPagoPlanId,
    updatePreApprovalPlanRequest: {
      reason: input.name,
      // Validado contra sandbox real: un preapproval_plan solo conoce
      // "active"/"cancelled" (no existe "inactive" — enviarlo así lo mapea a
      // "cancelled"). Es reversible: mandar "active" de nuevo lo reactiva sin
      // problema, confirmado con un get() posterior.
      status: input.active ? "active" : "cancelled",
    },
  });
  return toSnapshot(response);
}
