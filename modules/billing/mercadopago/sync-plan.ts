import type { PlanWithUsage } from "@/modules/billing/subscription";
import { updatePlanMercadoPagoSync } from "@/modules/billing/subscription";
import { isMercadoPagoConfigured } from "@/modules/billing/mercadopago/client";
import { createPreapprovalPlan, getPreapprovalPlan, updatePreapprovalPlanMetadata } from "@/modules/billing/mercadopago/plans";

// ── Orquestación Plan de Nexo ↔ preapproval_plan de Mercado Pago ────────
// Único punto que decide QUÉ hacer con Mercado Pago cuando se crea/edita un
// Plan pago desde Superadmin (Fase 2). No vive dentro de
// modules/billing/subscription.ts a propósito: esa capa es la fuente de
// verdad de "Plan de Nexo" y nunca debe importar nada de Mercado Pago (la
// dependencia va en un solo sentido — este archivo importa de subscription.ts,
// nunca al revés). Los callers (rutas de Superadmin) llaman a
// createPlan()/updatePlan() como siempre, y DESPUÉS a syncPlanWithMercadoPago()
// — dos pasos separados, nunca mezclados en una sola función.
//
// Regla de precio (ver auditoría — sección 3): la documentación de Mercado
// Pago confirma que PUT /preapproval_plan/{id} actualiza free_trial/frequency,
// pero NO confirma que transaction_amount se pueda cambiar sobre un plan
// EXISTENTE sin afectar a quienes ya están suscriptos a ese precio. Por eso,
// cualquier cambio de precio/moneda siempre crea un preapproval_plan NUEVO
// (una "versión" nueva) y reapunta Plan.mercadoPagoPlanId a ese id — nunca
// actualiza transaction_amount in-place. Las Subscription ya autorizadas
// guardan su propio providerSubscriptionId, totalmente independiente de
// Plan.mercadoPagoPlanId, así que reapuntar acá nunca las toca ni las rompe
// (sección 3 del pedido: "las suscripciones existentes deben continuar
// asociadas al plan anterior").

interface PlanForSync {
  id: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  active: boolean;
  mercadoPagoPlanId: string | null;
}

// Devuelve null cuando no hace falta sincronizar (Agenda interna / precio 0) — el caller
// simplemente sigue usando el PlanWithUsage que ya tenía de createPlan()/
// updatePlan(), sin tocar sus campos mercadoPago* (quedan en null, la UI los
// interpreta como "no aplica"). Cuando SÍ intenta sincronizar, siempre
// devuelve el Plan actualizado con el resultado — éxito o error quedan
// codificados en sus propios campos (mercadoPagoSyncStatus/
// mercadoPagoSyncError), nunca lanza: "no dejar la UI mostrando que el plan
// quedó sincronizado" exige que el error quede grabado y visible, no que la
// request explote con un 500.
export async function syncPlanWithMercadoPago(plan: PlanForSync): Promise<PlanWithUsage | null> {
  if (plan.monthlyPrice <= 0) {
    return null;
  }

  // Un plan pago que nunca se ofreció (active=false y todavía sin
  // mercadoPagoPlanId, ej. "Empresa" hoy) no debe generar un preapproval_plan
  // en Mercado Pago solo por guardarse desde Superadmin — nadie puede
  // contratarlo mientras esté inactivo, así que no hay nada que sincronizar
  // todavía (confirmado con un sync real contra sandbox: sincronizarlo de
  // movida crea un preapproval_plan real sin ningún caso de uso). Un plan que
  // YA tiene mercadoPagoPlanId y se desactiva sigue sincronizando -> ahí sí
  // hace falta reflejar el estado en MP (ver la rama de metadata más abajo).
  if (!plan.active && !plan.mercadoPagoPlanId) {
    return null;
  }

  if (!isMercadoPagoConfigured()) {
    return updatePlanMercadoPagoSync(plan.id, {
      mercadoPagoSyncStatus: "error",
      mercadoPagoSyncError: "Mercado Pago no está configurado (falta MERCADOPAGO_ACCESS_TOKEN).",
    });
  }

  try {
    if (!plan.mercadoPagoPlanId) {
      // Alta: todavía no existe ningún preapproval_plan para este Plan.
      const created = await createPreapprovalPlan({
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        currency: plan.currency,
      });
      return updatePlanMercadoPagoSync(plan.id, {
        mercadoPagoPlanId: created.id,
        mercadoPagoSyncStatus: "synced",
        mercadoPagoSyncError: null,
      });
    }

    // Ya hay un preapproval_plan vigente — ¿cambió precio o moneda respecto
    // a lo que Mercado Pago tiene registrado? Se consulta el estado REAL en
    // MP (nunca se asume a partir de lo que Nexo cree que mandó la última
    // vez) antes de decidir.
    const current = await getPreapprovalPlan(plan.mercadoPagoPlanId);
    const priceChanged = current.transactionAmount !== plan.monthlyPrice || current.currencyId !== plan.currency;

    if (priceChanged) {
      const created = await createPreapprovalPlan({
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        currency: plan.currency,
      });
      return updatePlanMercadoPagoSync(plan.id, {
        mercadoPagoPlanId: created.id,
        mercadoPagoSyncStatus: "synced",
        mercadoPagoSyncError: null,
      });
    }

    // Sin cambio de precio: solo actualizar metadata confirmada como segura
    // (nombre/estado) sobre el mismo preapproval_plan.
    await updatePreapprovalPlanMetadata(plan.mercadoPagoPlanId, { name: plan.name, active: plan.active });
    return updatePlanMercadoPagoSync(plan.id, { mercadoPagoSyncStatus: "synced", mercadoPagoSyncError: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al sincronizar con Mercado Pago.";
    return updatePlanMercadoPagoSync(plan.id, { mercadoPagoSyncStatus: "error", mercadoPagoSyncError: message });
  }
}
