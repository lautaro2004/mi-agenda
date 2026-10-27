import { priceWithExtras } from "@/lib/billing-seats";
import { FxUnavailableError, getUsdArsRate, needsConversion, relativeChange } from "@/lib/fx";
import { prisma } from "@/lib/prisma";
import { computeCharge, isComboPlan } from "@/modules/billing/pricing";
import { isMercadoPagoConfigured } from "@/modules/billing/mercadopago/client";
import { sendRepriceNotice } from "@/modules/billing/mercadopago/reprice-notice";
import { getPreapproval, updatePreapprovalAmount } from "@/modules/billing/mercadopago/subscriptions";

// ── Reajuste por cotización (planes con precio de lista en USD) ──────────
// Mercado Pago cobra siempre el monto en pesos del preapproval. Para mantener
// el valor en dólares, ANTES de cada renovación se recalcula con el dólar
// oficial del día y se actualiza el monto de los próximos cobros.
//
// Reglas:
//  - solo suscripciones vivas de MP con cotización guardada (arsAmount);
//    las anteriores a esta función (en pesos fijos) no se tocan nunca;
//  - se reajusta una sola vez por ciclo: dentro de los 4 días previos al
//    próximo cobro y solo si la cotización guardada es anterior a ese ciclo;
//  - variaciones menores a 0,5 % no llaman a Mercado Pago (se refresca la
//    cotización guardada para no reintentar cada hora);
//  - idempotente: correrlo varias veces no cambia nada más que la primera.

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_BEFORE_CHARGE_MS = 4 * DAY_MS;
const MIN_CHANGE = 0.005;

export interface RepriceSummary {
  checked: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: number;
}

export async function repriceFxSubscriptions(now = new Date()): Promise<RepriceSummary> {
  const summary: RepriceSummary = { checked: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 };
  if (!isMercadoPagoConfigured()) return summary;

  const candidates = await prisma.subscription.findMany({
    where: {
      provider: "mercadopago",
      status: { in: ["active", "trialing"] },
      providerSubscriptionId: { not: null },
      arsAmount: { not: null },
      fxRateAt: { not: null },
    },
    include: { plan: { include: { prices: true } }, planPrice: true },
  });
  if (candidates.length === 0) return summary;

  try {
    await getUsdArsRate();
  } catch (error) {
    if (error instanceof FxUnavailableError) {
      console.error("[reprice] Sin cotización disponible: se reintenta en la próxima corrida.");
      return { ...summary, checked: candidates.length, skipped: candidates.length };
    }
    throw error;
  }

  for (const sub of candidates) {
    summary.checked++;
    try {
      const yearly = sub.billingInterval === "year";
      const listCurrency = yearly ? (sub.planPrice?.currency ?? sub.plan.currency) : sub.plan.currency;
      const baseAmount = yearly ? (sub.planPrice?.amount ?? 0) : sub.plan.monthlyPrice;
      const extraUnit = yearly ? sub.plan.extraUserYearlyPrice : sub.plan.extraUserMonthlyPrice;
      const isCombo = isComboPlan(sub.plan);
      // Combo: el precio se calcula al momento (ver pricing.ts); sin lista fija.
      const listAmount = isCombo ? 1 : priceWithExtras(baseAmount, extraUnit, sub.extraUsers);
      if ((!isCombo && (!needsConversion(listCurrency) || !(listAmount > 0))) || sub.arsAmount === null || !sub.fxRateAt) {
        summary.skipped++;
        continue;
      }
      // Prefiltro barato: evita consultar a MP por suscripciones recién cobradas.
      const minAgeDays = yearly ? 300 : 20;
      if (now.getTime() - sub.fxRateAt.getTime() < minAgeDays * DAY_MS) {
        summary.skipped++;
        continue;
      }

      const snapshot = await getPreapproval(sub.providerSubscriptionId!);
      const nextCharge = snapshot.nextPaymentDate ? new Date(snapshot.nextPaymentDate) : null;
      if (snapshot.status !== "authorized" || !nextCharge || Number.isNaN(nextCharge.getTime())) {
        summary.skipped++;
        continue;
      }
      const untilCharge = nextCharge.getTime() - now.getTime();
      const alreadyForThisCycle = sub.fxRateAt.getTime() >= nextCharge.getTime() - 6 * DAY_MS;
      if (untilCharge > WINDOW_BEFORE_CHARGE_MS || untilCharge < 0 || alreadyForThisCycle) {
        summary.skipped++;
        continue;
      }

      // Mismo cálculo que la cotización y el checkout (plan común o combo).
      const charge = await computeCharge(sub.plan, yearly ? "year" : "month", sub.extraUsers);
      if (!charge.ok || !charge.converted || charge.rate === undefined) {
        summary.skipped++;
        continue;
      }
      const newAmount = charge.arsAmount;
      const usedRate = charge.rate;
      if (relativeChange(sub.arsAmount, newAmount) < MIN_CHANGE) {
        await prisma.subscription.update({ where: { id: sub.id }, data: { fxRate: usedRate, fxRateAt: now } });
        summary.unchanged++;
        continue;
      }

      await updatePreapprovalAmount(sub.providerSubscriptionId!, newAmount);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { arsAmount: newAmount, fxRate: usedRate, fxRateAt: now },
      });
      console.log(`[reprice] negocio ${sub.businessId}: ${sub.arsAmount} → ${newAmount} ARS (cotización ${usedRate}).`);
      summary.updated++;
      // Aviso al dueño (best-effort: no afecta al reajuste ya hecho).
      await sendRepriceNotice({
        businessId: sub.businessId,
        planName: sub.plan.name,
        oldAmount: sub.arsAmount,
        newAmount,
        listAmount: charge.listAmount,
        listCurrency: charge.listCurrency,
        rate: usedRate,
        nextCharge,
      });
    } catch (error) {
      summary.errors++;
      console.error(`[reprice] Falló el reajuste del negocio ${sub.businessId}:`, error instanceof Error ? error.message : error);
    }
  }
  return summary;
}
