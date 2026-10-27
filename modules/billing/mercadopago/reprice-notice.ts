import { getOwnerEmail, sendPlatformEmail } from "@/modules/email/send";
import { subscriptionRepriceEmail } from "@/modules/email/templates";

// Aviso al dueño cuando el reajuste por cotización cambia el monto en pesos.
// Nunca hace fallar el reajuste: si el email falla, solo se registra. La
// idempotencia viene de que el reajuste corre una sola vez por ciclo, y de la
// idempotencyKey (misma cotización del día = mismo email) por si se reintenta.
export async function sendRepriceNotice(params: {
  businessId: string;
  planName: string;
  oldAmount: number;
  newAmount: number;
  listAmount: number;
  listCurrency: string;
  rate: number;
  nextCharge: Date | null;
}): Promise<void> {
  try {
    const to = await getOwnerEmail(params.businessId);
    if (!to) return;
    const nextChargeDate = params.nextCharge
      ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(params.nextCharge)
      : null;
    const email = subscriptionRepriceEmail({ ...params, nextChargeDate });
    const result = await sendPlatformEmail({
      to,
      ...email,
      idempotencyKey: `reprice/${params.businessId}/${params.nextCharge?.toISOString().slice(0, 10) ?? "na"}`,
    });
    if (!result.ok) console.error(`[reprice] No se pudo avisar al dueño (negocio ${params.businessId}): ${result.error}`);
  } catch (error) {
    console.error(`[reprice] Falló el aviso al dueño (negocio ${params.businessId}):`, error instanceof Error ? error.message : error);
  }
}
