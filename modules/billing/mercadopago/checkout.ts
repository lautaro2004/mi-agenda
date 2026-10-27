import type { BillingInterval, BusinessSubscription } from "@/modules/billing/subscription";
import { BASE_PLAN_SLUG, assignSubscription, getPlanById, getSubscriptionWithPlan, setSubscriptionFx } from "@/modules/billing/subscription";
import { createPreapproval, createPreapprovalWithoutPlan } from "@/modules/billing/mercadopago/subscriptions";
import { priceWithExtras } from "@/lib/billing-seats";
import { FxUnavailableError, convertToArs, getUsdArsRate, needsConversion } from "@/lib/fx";
import { getPreapprovalPlan } from "@/modules/billing/mercadopago/plans";
import { mapMercadoPagoStatus } from "@/modules/billing/mercadopago/status-map";
import { MercadoPagoNotConfiguredError, getAccessTokenFingerprint } from "@/modules/billing/mercadopago/client";
import { describeMercadoPagoError } from "@/modules/billing/mercadopago/errors";
import { maskTail } from "@/lib/mask-secret";

// ── Contratación (Fase 3) ─────────────────────────────────────────────────
// Único punto que crea un preapproval real en Mercado Pago. Reutiliza
// assignSubscription() para el efecto sobre Nexo — nunca escribe
// prisma.subscription directamente acá.

// Cada código deja claro DE DÓNDE viene el problema — el frontend usa esto
// para diferenciar "esto es un problema de configuración/estado de Nexo"
// (el usuario no puede resolverlo probando otra tarjeta) de "esto es un
// rechazo real de Mercado Pago" (el usuario sí puede accionar: revisar la
// tarjeta, probar otra). Ver components/subscription-checkout-dialog.tsx.
export type CheckoutErrorCode =
  | "PLAN_NOT_FOUND"
  | "PLAN_INACTIVE"
  | "PLAN_NOT_SYNCED"
  | "FX_UNAVAILABLE"
  | "EXTRA_USERS_NOT_AVAILABLE"
  | "ALREADY_SUBSCRIBED"
  | "MERCADOPAGO_NOT_CONFIGURED"
  | "MERCADOPAGO_CHECKOUT_ERROR"
  | "MERCADOPAGO_UNEXPECTED_STATUS"
  | "NEXO_ACTIVATION_ERROR"
  | "UNEXPECTED_ERROR";

export interface CheckoutErrorResult {
  code: CheckoutErrorCode;
  // Siempre seguro de mostrar tal cual.
  message: string;
  // Detalle más específico cuando hay uno (ej. derivado de las causes de
  // Mercado Pago) — también siempre seguro de mostrar.
  detail?: string;
  // Código técnico corto (ej. "cc_rejected_other_reason" o un status HTTP) —
  // pensado para mostrarse discretamente en sandbox, nunca contiene datos
  // sensibles (son códigos públicos documentados por Mercado Pago).
  technicalCode?: string;
}

export interface CheckoutInput {
  businessId: string;
  planId: string;
  payerEmail: string;
  cardTokenId: string;
  // Período a contratar. Ausente = "month": la pantalla de Nexo de siempre
  // sigue mandando lo mismo y usa el mismo preapproval_plan de siempre.
  interval?: BillingInterval;
  // Usuarios de Nodo extra sobre los incluidos (solo planes que los ofrecen).
  extraUsers?: number;
}

export type CheckoutResult =
  | { ok: true; subscription: BusinessSubscription; mercadoPagoStatus: string }
  | { ok: false; error: CheckoutErrorResult };

type SimpleErrorCode = Exclude<CheckoutErrorCode, "MERCADOPAGO_CHECKOUT_ERROR" | "MERCADOPAGO_UNEXPECTED_STATUS">;

const SIMPLE_ERROR_MESSAGE: Record<SimpleErrorCode, string> = {
  PLAN_NOT_FOUND: "El plan elegido no existe.",
  PLAN_INACTIVE: "Ese plan ya no está disponible.",
  PLAN_NOT_SYNCED: "Ese plan todavía no está disponible para contratar — probá de nuevo en unos minutos.",
  EXTRA_USERS_NOT_AVAILABLE: "Este plan no admite usuarios extra.",
  FX_UNAVAILABLE: "No pudimos obtener la cotización del dólar para calcular el monto en pesos. Probá de nuevo en unos minutos.",
  ALREADY_SUBSCRIBED: "Ya tenés una suscripción paga activa. Si tenés un pago pendiente, actualizá tu medio de pago en lugar de contratar de nuevo.",
  MERCADOPAGO_NOT_CONFIGURED: "La contratación online todavía no está configurada.",
  NEXO_ACTIVATION_ERROR: "El pago se procesó, pero no pudimos activar tu plan.",
  UNEXPECTED_ERROR: "No pudimos procesar la contratación. Intentá de nuevo en unos minutos.",
};

function simpleError(code: SimpleErrorCode, detail?: string): CheckoutResult {
  return { ok: false, error: { code, message: SIMPLE_ERROR_MESSAGE[code], detail } };
}

// TEMPORAL — diagnóstico de "Card token service not found" (ver reporte de
// esta investigación). Relee el preapproval_plan con el MISMO Access Token
// que se va a usar para crear la suscripción — application_id/collector_id
// no son secretos (identifican públicamente qué aplicación/cuenta de
// Mercado Pago es dueña del plan), y compararlos contra el fingerprint del
// Access Token en cada intento permite confirmar en los logs de Netlify que
// no cambiaron entre despliegues. Puramente observacional: si esta consulta
// falla, se loguea y se sigue con el flujo normal — nunca bloquea ni cambia
// el resultado del checkout (ver runCheckout: el resultado de esta función
// no se usa para ninguna decisión todavía).
async function logPreapprovalPlanDiagnostics(mercadoPagoPlanId: string): Promise<void> {
  try {
    const plan = await getPreapprovalPlan(mercadoPagoPlanId);
    console.log("[checkout][diag] GET /preapproval_plan/:id ->", {
      id: plan.id,
      applicationId: plan.applicationId,
      collectorId: plan.collectorId,
      status: plan.status,
      currencyId: plan.currencyId,
      transactionAmount: plan.transactionAmount,
      accessTokenTail: getAccessTokenFingerprint(),
    });
  } catch (error) {
    console.warn(
      `[checkout][diag] No se pudo releer el preapproval_plan ${mercadoPagoPlanId} para el diagnóstico (no bloquea el checkout):`,
      error instanceof Error ? error.message : error
    );
  }
}

export async function createSubscriptionCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  try {
    return await runCheckout(input);
  } catch (error) {
    // Cualquier falla no prevista (ej. la base caída al leer el Plan) — no
    // debería pasar, pero si pasa el frontend igual recibe la forma
    // estructurada de siempre en vez de un 500 crudo.
    console.error(
      `[checkout] Error inesperado procesando la contratación (negocio ${input.businessId}, plan ${input.planId}):`,
      error instanceof Error ? error.message : error
    );
    return simpleError("UNEXPECTED_ERROR");
  }
}

async function runCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const plan = await getPlanById(input.planId);
  if (!plan) return simpleError("PLAN_NOT_FOUND");
  if (!plan.active) return simpleError("PLAN_INACTIVE");
  // Agenda interna (nivel base, monthlyPrice=0) nunca se contrata: no es un
  // plan comercial. Se rechaza por slug además del chequeo de abajo, así
  // que no depende de que nadie le sincronice un preapproval_plan por error.
  if (plan.slug === BASE_PLAN_SLUG) return simpleError("PLAN_NOT_FOUND");
  // Precio del período elegido. El mensual es el preapproval_plan de
  // siempre (Plan.mercadoPagoPlanId); el anual, el de su PlanPrice.
  const interval: BillingInterval = input.interval ?? "month";
  const price = (plan.prices ?? []).find((p) => p.interval === interval);
  // Precio de lista en USD: se cobra en pesos con una suscripción sin plan
  // (monto = lista × dólar oficial del momento). Ver lib/fx.ts.
  const listCurrency = interval === "month" ? plan.currency : (price?.currency ?? plan.currency);
  const extras = Math.max(0, Math.trunc(input.extraUsers ?? 0));
  const extraUnit = interval === "month" ? plan.extraUserMonthlyPrice : plan.extraUserYearlyPrice;
  if (extras > 0 && (!plan.products?.includes("crm") || !extraUnit || extraUnit <= 0)) {
    return simpleError("EXTRA_USERS_NOT_AVAILABLE");
  }
  const baseAmount = interval === "month" ? plan.monthlyPrice : (price?.amount ?? 0);
  const listAmount = extras > 0 ? priceWithExtras(baseAmount, extraUnit, extras) : baseAmount;
  const convert = needsConversion(listCurrency);
  // Monto dinámico (USD, o con usuarios extra): no cabe en un preapproval_plan
  // fijo, se crea una suscripción sin plan con el monto ya calculado.
  const dynamic = convert || extras > 0;
  const mercadoPagoPlanId = interval === "month" ? plan.mercadoPagoPlanId : (price?.active ? price.mercadoPagoPlanId : null);
  if (dynamic) {
    if (interval === "year" && !price?.active) return simpleError("PLAN_NOT_SYNCED");
    if (!(listAmount > 0)) return simpleError("PLAN_NOT_SYNCED");
  } else if (!mercadoPagoPlanId) {
    return simpleError("PLAN_NOT_SYNCED");
  }
  const existing = await getSubscriptionWithPlan(input.businessId);
  // Un preapproval vivo (al día O con un cobro en reintento) ya está
  // cobrando: crear otro sería un doble débito. Antes solo se miraba
  // "active", y con un pago atrasado se podía duplicar.
  if (
    existing?.provider === "mercadopago" &&
    existing.status !== "canceled" &&
    existing.status !== "expired"
  ) {
    return simpleError("ALREADY_SUBSCRIBED");
  }

  // TEMPORAL — diagnóstico de "Card token service not found" (ver reporte de
  // esta investigación). Nunca el valor completo de ningún secreto ni datos
  // de tarjeta: solo los últimos 6 caracteres del card_token_id/Access Token
  // y el preapproval_plan_id (que no es sensible, es un id de MP). Sirve
  // para comparar en los logs de Netlify: (a) que el card_token_id que llega
  // acá sea el mismo que generó el Brick en el navegador (sin transformarse
  // en el camino) y (b) qué Access Token está realmente activo en runtime,
  // para descartar una mezcla de credenciales TEST/producción o de
  // aplicaciones distintas. Sacar una vez resuelta la investigación.
  if (mercadoPagoPlanId && !dynamic) console.log(
    `[checkout][diag] negocio=${input.businessId} preapproval_plan_id=${mercadoPagoPlanId} card_token_id=${maskTail(input.cardTokenId)} access_token=${getAccessTokenFingerprint()}`
  );
  if (mercadoPagoPlanId && !dynamic) await logPreapprovalPlanDiagnostics(mercadoPagoPlanId);

  let fx: { arsAmount: number; fxRate: number | null; fxRateAt: Date | null } | null = null;
  if (convert) {
    try {
      const quote = await getUsdArsRate();
      fx = { arsAmount: convertToArs(listAmount, quote.rate), fxRate: quote.rate, fxRateAt: new Date() };
    } catch (error) {
      if (error instanceof FxUnavailableError) return simpleError("FX_UNAVAILABLE");
      throw error;
    }
  } else if (dynamic) {
    // Plan en pesos con usuarios extra: sin cotización, el monto ya está en ARS.
    fx = { arsAmount: listAmount, fxRate: null, fxRateAt: null };
  }

  let preapproval;
  try {
    preapproval = fx
      ? await createPreapprovalWithoutPlan({
          payerEmail: input.payerEmail,
          cardTokenId: input.cardTokenId,
          externalReference: input.businessId,
          reason: `${plan.name}${interval === "year" ? " (anual)" : ""}${extras > 0 ? ` + ${extras} usuario${extras === 1 ? "" : "s"}` : ""}`,
          amountArs: fx.arsAmount,
          frequencyMonths: interval === "year" ? 12 : 1,
          trialDays: plan.trialDays,
          backUrl: `${process.env.BETTER_AUTH_URL ?? "https://nexo.kodexa.ar"}/dashboard`,
        })
      : await createPreapproval({
          preapprovalPlanId: mercadoPagoPlanId!,
          payerEmail: input.payerEmail,
          cardTokenId: input.cardTokenId,
          // Alcanza con businessId: Subscription es 1:1 por negocio (businessId
          // @unique), así que no hace falta componer un id más largo para
          // identificar a qué Subscription de Nexo corresponde este preapproval.
          externalReference: input.businessId,
        });
  } catch (error) {
    if (error instanceof MercadoPagoNotConfiguredError) {
      console.error(`[checkout] Mercado Pago no configurado — negocio ${input.businessId}, plan ${input.planId}.`);
      return simpleError("MERCADOPAGO_NOT_CONFIGURED");
    }

    // Nunca se loguea cardTokenId/payerEmail completos acá — solo lo que
    // devolvió la API de Mercado Pago sobre SU rechazo (status/error/causes)
    // más las mismas huellas (últimos 6 caracteres) que el log de diagnóstico
    // de arriba, para tener todo junto en el mismo lugar cuando algo falla.
    const info = describeMercadoPagoError(error);
    console.error(`[checkout] Mercado Pago rechazó la creación del preapproval — negocio ${input.businessId}, plan ${input.planId}:`, {
      httpStatus: info.httpStatus,
      mpErrorSlug: info.mpErrorSlug,
      causes: info.causes,
      message: info.rawMessage,
      cardTokenIdTail: maskTail(input.cardTokenId),
      accessTokenTail: getAccessTokenFingerprint(),
      preapprovalPlanId: mercadoPagoPlanId,
    });

    return {
      ok: false,
      error: {
        code: "MERCADOPAGO_CHECKOUT_ERROR",
        message: "Mercado Pago rechazó la suscripción.",
        detail: info.detail,
        technicalCode: info.technicalCode ?? undefined,
      },
    };
  }

  // "NO activar el plan pago únicamente porque el usuario volvió desde
  // Mercado Pago. La activación definitiva depende del estado confirmado
  // por Mercado Pago" — acá no hay redirect (ver subscriptions.ts: el flujo
  // con plan asociado no lo tiene), pero el mismo principio aplica: solo se
  // otorga el Plan si la respuesta DIRECTA de la API de creación confirma
  // "authorized". Si Mercado Pago devolviera "pending" (no debería pasar con
  // card_token_id, pero no se asume), no se toca el Plan todavía — queda
  // para que lo resuelva el webhook (Fase 4) cuando MP confirme el estado.
  const internalStatus = mapMercadoPagoStatus(preapproval.status ?? "");
  if (!internalStatus) {
    console.error(
      `[checkout] Mercado Pago devolvió un status sin mapping interno — negocio ${input.businessId}, preapproval ${preapproval.id}, status="${preapproval.status}".`
    );
    return {
      ok: false,
      error: {
        code: "MERCADOPAGO_UNEXPECTED_STATUS",
        message: "Mercado Pago todavía no confirmó el pago.",
        detail: "Probá de nuevo en unos minutos.",
        technicalCode: preapproval.status ?? undefined,
      },
    };
  }

  const now = new Date();
  const result = await assignSubscription(input.businessId, {
    planId: input.planId,
    status: internalStatus,
    currentPeriodStart: now,
    currentPeriodEnd: null,
    provider: "mercadopago",
    providerSubscriptionId: preapproval.id,
    mercadoPagoStatus: preapproval.status,
    mercadoPagoLastSyncedAt: now,
    ...(price ? { planPriceId: price.id } : {}),
    billingInterval: interval,
  });

  if (!result.ok) {
    // No debería pasar (ya validamos active arriba), pero si el plan se
    // desactivó en la fracción de segundo entre ambos chequeos, no dejamos
    // un preapproval autorizado en Mercado Pago sin ningún reflejo en Nexo.
    console.error(
      `[checkout] La suscripción se creó en Mercado Pago (${preapproval.id}, negocio ${input.businessId}) pero assignSubscription falló: ${result.error}.`
    );
    return {
      ok: false,
      error: {
        code: "NEXO_ACTIVATION_ERROR",
        message: "El pago se procesó, pero no pudimos activar tu plan.",
        detail: "Contactanos para regularizar tu suscripción — el pago ya fue autorizado por Mercado Pago.",
      },
    };
  }

  if (fx) {
    // No bloquea la contratación: el cobro ya está autorizado; si esto falla, el
    // reajuste mensual simplemente no encuentra la suscripción hasta corregirlo.
    await setSubscriptionFx(input.businessId, { ...fx, extraUsers: extras }).catch((error) =>
      console.error(`[checkout] No se pudo guardar la cotización (negocio ${input.businessId}):`, error)
    );
  }

  return { ok: true, subscription: result.subscription, mercadoPagoStatus: preapproval.status ?? "" };
}
