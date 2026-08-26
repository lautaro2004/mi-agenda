import { PreApproval } from "mercadopago";

import { getMercadoPagoClient } from "@/modules/billing/mercadopago/client";

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

function toSnapshot(response: {
  id?: string;
  status?: string;
  external_reference?: string;
  payer_email?: string;
  next_payment_date?: string;
}): PreapprovalSnapshot {
  if (!response.id) {
    throw new Error("Mercado Pago no devolvió un id de preapproval.");
  }
  return {
    id: response.id,
    status: response.status ?? null,
    externalReference: response.external_reference ?? null,
    payerEmail: response.payer_email ?? null,
    nextPaymentDate: response.next_payment_date ?? null,
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
export async function createPreapproval(input: CreatePreapprovalInput): Promise<PreapprovalSnapshot> {
  const client = new PreApproval(getMercadoPagoClient());
  const response = await client.create({
    body: {
      preapproval_plan_id: input.preapprovalPlanId,
      payer_email: input.payerEmail,
      card_token_id: input.cardTokenId,
      external_reference: input.externalReference,
      status: "authorized",
    },
  });
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
