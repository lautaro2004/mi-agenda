import { Invoice } from "mercadopago";

import { getMercadoPagoClient } from "@/modules/billing/mercadopago/client";

// ── Cuotas de una suscripción (authorized_payments) ───────────────────────
// Según la documentación de Mercado Pago, un cobro rechazado NO pausa el
// preapproval: la CUOTA queda en "recycling" (hasta 4 reintentos en ~10
// días) y al final en "processed" con el pago "rejected"; tras 3 cuotas
// rechazadas MP cancela la suscripción. Por eso el atraso se detecta acá,
// con el topic subscription_authorized_payment — no con el estado del
// preapproval. Se relee siempre desde la API (nunca se confía en el body
// del webhook). Cliente oficial: Invoice = GET /authorized_payments/{id}.

export interface AuthorizedPaymentSnapshot {
  id: string;
  preapprovalId: string | null;
  // scheduled | recycling | processed (y variantes de gateway)
  status: string | null;
  // approved | rejected | pending | … (null si todavía no hubo intento)
  paymentStatus: string | null;
  debitDate: Date | null;
}

export async function getAuthorizedPayment(id: string): Promise<AuthorizedPaymentSnapshot> {
  const response = await new Invoice(getMercadoPagoClient()).get({ id });
  return {
    id: String(response.id ?? id),
    preapprovalId: response.preapproval_id ?? null,
    status: response.status ?? null,
    paymentStatus: response.payment?.status ?? null,
    debitDate: response.debit_date ? new Date(response.debit_date) : null,
  };
}

export type InstallmentOutcome = "paid" | "failing" | "pending";

/** Pura: qué significa una cuota para el acceso. */
export function classifyInstallment(snapshot: Pick<AuthorizedPaymentSnapshot, "status" | "paymentStatus">): InstallmentOutcome {
  if (snapshot.paymentStatus === "approved") return "paid";
  if (snapshot.status === "recycling") return "failing";
  if (snapshot.status === "processed" && snapshot.paymentStatus === "rejected") return "failing";
  return "pending";
}

/** Cuotas de un preapproval, la más reciente primero (para la conciliación). */
export async function searchAuthorizedPayments(preapprovalId: string): Promise<AuthorizedPaymentSnapshot[]> {
  const response = await new Invoice(getMercadoPagoClient()).search({ options: { preapproval_id: preapprovalId, limit: 20 } });
  return (response.results ?? [])
    .map((r) => ({
      id: String(r.id ?? ""),
      preapprovalId: r.preapproval_id ?? preapprovalId,
      status: r.status ?? null,
      paymentStatus: r.payment?.status ?? null,
      debitDate: r.debit_date ? new Date(r.debit_date) : null,
    }))
    .sort((a, b) => (b.debitDate?.getTime() ?? 0) - (a.debitDate?.getTime() ?? 0));
}

/**
 * La cuota que define el estado actual: la más reciente que ya se resolvió
 * (cobrada o fallando). Las programadas/en proceso todavía no dicen nada.
 */
export function latestDecisiveInstallment(installments: AuthorizedPaymentSnapshot[]): AuthorizedPaymentSnapshot | null {
  return installments.find((i) => classifyInstallment(i) !== "pending") ?? null;
}
