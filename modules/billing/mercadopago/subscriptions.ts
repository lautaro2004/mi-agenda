import { PreApproval } from "mercadopago";

import { getMercadoPagoClient } from "@/modules/billing/mercadopago/client";
import { maskTail } from "@/lib/mask-secret";

// ── preapproval (suscripciones individuales de Mercado Pago) ────────────
// Capa fina sobre el SDK oficial, mismo criterio que plans.ts — nunca llamar
// a PreApproval directamente desde fuera de este archivo.
export interface PreapprovalSnapshot {
  id: string;
  status: string | null;
  externalReference: string | null;
  payerEmail: string | null;
  nextPaymentDate: string | null;
}

// external_reference/next_payment_date: la respuesta de PUT /preapproval
// (PreApprovalUpdateResponse) los tipa distinto que POST/GET
// (PreApprovalResponse) — string vs number — por eso acá se aceptan ambos y
// se normalizan a string, así PreapprovalSnapshot tiene un único tipo
// consistente sin importar de qué llamada vino.
function toSnapshot(response: {
  id?: string;
  status?: string;
  external_reference?: string | number;
  payer_email?: string;
  next_payment_date?: string | number;
}): PreapprovalSnapshot {
  if (!response.id) {
    throw new Error("Mercado Pago no devolvió un id de preapproval.");
  }
  return {
    id: response.id,
    status: response.status ?? null,
    externalReference: response.external_reference !== undefined ? String(response.external_reference) : null,
    payerEmail: response.payer_email ?? null,
    nextPaymentDate: response.next_payment_date !== undefined ? String(response.next_payment_date) : null,
  };
}

export interface CreatePreapprovalInput {
  preapprovalPlanId: string;
  payerEmail: string;
  cardTokenId: string;
  externalReference: string;
}

// Único flujo soportado para una suscripción CON plan asociado (Fase 3):
// confirmado contra la documentación oficial de Mercado Pago que este tipo
// de suscripción siempre se crea con card_token_id + status "authorized" en
// el mismo POST — no existe un flujo de redirect/init_point para este caso
// (ese flujo solo aplica a preapproval SIN preapproval_plan_id). El
// card_token_id se genera en el navegador vía Checkout Bricks (CardForm),
// nunca pasa una tarjeta cruda por nuestro backend.
//
// Verificado campo por campo contra la referencia oficial vigente (POST
// /preapproval — mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/create-preapproval/post,
// revisado 2026-08-26): payer_email es el único campo estrictamente
// requerido; preapproval_plan_id/card_token_id/back_url/status son
// opcionales; reason/external_reference son "requeridos solo para
// suscripciones SIN plan asociado" (con preapproval_plan_id no hace falta
// repetirlos); auto_recurring es opcional cuando ya hay un plan asociado
// (el plan ya define frequency/transaction_amount/currency_id). El body de
// acá abajo no le falta ni le sobra ningún campo respecto a esa referencia
// para el caso "suscripción con plan asociado + card_token_id". No se manda
// `reason` porque preapproval_plan_id ya trae la razón/monto del plan.
export async function createPreapproval(input: CreatePreapprovalInput): Promise<PreapprovalSnapshot> {
  const client = new PreApproval(getMercadoPagoClient());
  const body = {
    preapproval_plan_id: input.preapprovalPlanId,
    payer_email: input.payerEmail,
    card_token_id: input.cardTokenId,
    external_reference: input.externalReference,
    status: "authorized" as const,
  };

  // TEMPORAL — diagnóstico de "Card token service not found" (ver reporte de
  // esta investigación). Muestra el request EXACTO que arma este archivo
  // antes de pasarlo al SDK — card_token_id enmascarado, payer_email oculto
  // (es dato personal, no hacía falta para este diagnóstico), el resto de
  // los campos no son sensibles (preapproval_plan_id es un id público de
  // Mercado Pago). Sacar una vez resuelta la investigación.
  console.log("[subscriptions][diag] POST /preapproval body:", {
    ...body,
    card_token_id: maskTail(body.card_token_id),
    payer_email: "(oculto)",
  });

  const response = await client.create({ body });
  return toSnapshot(response);
}

// Usado por el webhook (Fase 4) para nunca confiar solamente en el payload
// de la notificación — siempre se relee el estado real antes de escribir en
// la base.
export async function getPreapproval(preapprovalId: string): Promise<PreapprovalSnapshot> {
  const client = new PreApproval(getMercadoPagoClient());
  const response = await client.get({ id: preapprovalId });
  return toSnapshot(response);
}

// Fase 5 — cancelación desde Nexo. PUT /preapproval/{id} con status
// "cancelled" es la única transición documentada como definitiva (a
// diferencia de "paused", que es reversible) — confirmado real contra
// producción el 2026-08-26 durante el diagnóstico de "Card token service
// not found". Nunca borra nada del lado de Mercado Pago, solo corta la
// recurrencia.
export async function cancelPreapproval(preapprovalId: string): Promise<PreapprovalSnapshot> {
  const client = new PreApproval(getMercadoPagoClient());
  const response = await client.update({ id: preapprovalId, body: { status: "cancelled" } });
  return toSnapshot(response);
}
