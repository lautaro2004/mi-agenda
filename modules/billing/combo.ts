import { DEFAULT_COMBO_DISCOUNT_PCT } from "@/lib/combo-pricing";
import { prisma } from "@/lib/prisma";
import { BASE_PLAN_SLUG } from "@/lib/types";

// ── Planes combo (Nexo + Nodo) ────────────────────────────────────────────
// El combo no se carga a mano en Superadmin: al contratar Nexo + Nodo juntos
// se crea (una sola vez por combinación) un Plan interno que habilita ambos
// productos. Ese Plan NO tiene precio propio (monthlyPrice 0): lo que se cobra
// se calcula siempre en el momento (ver modules/billing/pricing.ts) como la
// suma de los dos planes con el descuento. Las funciones de Nexo (permisos,
// créditos de IA) salen del plan de Nexo; usuarios de Nodo y extras, del de Nodo.
// El descuento queda fijado en el combo al crearlo (va en el slug): cambiar
// COMBO_DISCOUNT_PCT afecta solo a combos NUEVOS, nunca a los ya contratados.

export function comboDiscountPct(): number {
  const raw = Number(process.env.COMBO_DISCOUNT_PCT?.trim());
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_COMBO_DISCOUNT_PCT;
  return Math.min(90, raw);
}

export type ComboPlanResult =
  | { ok: true; planId: string; name: string }
  | { ok: false; error: "NEXO_PLAN_INVALID" | "CRM_PLAN_INVALID" };

type PlanRow = NonNullable<Awaited<ReturnType<typeof prisma.plan.findUnique>>>;

function onlyProduct(plan: PlanRow, product: "nexo" | "crm"): boolean {
  return plan.products.length === 1 && plan.products[0] === product;
}

function comboData(nexo: PlanRow, crm: PlanRow) {
  return {
    name: `${nexo.name} + ${crm.name}`,
    aiCredits: nexo.aiCredits,
    maxServices: nexo.maxServices,
    publicWebEnabled: nexo.publicWebEnabled,
    whatsappEnabled: nexo.whatsappEnabled,
    depositsEnabled: nexo.depositsEnabled,
    customTrainingEnabled: nexo.customTrainingEnabled,
    statsEnabled: nexo.statsEnabled,
    galleryEnabled: nexo.galleryEnabled,
    digitalMenuEnabled: nexo.digitalMenuEnabled,
    smartBookingEnabled: nexo.smartBookingEnabled,
    webAiChatEnabled: nexo.webAiChatEnabled,
    crmMaxUsers: crm.crmMaxUsers,
    extraUserMonthlyPrice: crm.extraUserMonthlyPrice,
    extraUserYearlyPrice: crm.extraUserYearlyPrice,
    trialDays: Math.max(nexo.trialDays ?? 0, crm.trialDays ?? 0) || null,
    packNexoPlanId: nexo.id,
    packCrmPlanId: crm.id,
  };
}

/** Devuelve (creando o actualizando) el plan combo de esta combinación. */
export async function getOrCreateComboPlan(
  nexoPlanId: string,
  crmPlanId: string,
  options: { allowFreeNexo?: boolean } = {}
): Promise<ComboPlanResult> {
  const [nexo, crm] = await Promise.all([prisma.plan.findUnique({ where: { id: nexoPlanId } }), prisma.plan.findUnique({ where: { id: crmPlanId } })]);
  // Un combo COBRADO exige un plan de Nexo pago. Los otorgamientos manuales
  // (Superadmin) pueden combinar también el plan base: no se cobra nada.
  const nexoPaid = options.allowFreeNexo || (nexo?.slug !== BASE_PLAN_SLUG && (nexo?.monthlyPrice ?? 0) > 0);
  if (!nexo || !nexo.active || !nexoPaid || !onlyProduct(nexo, "nexo")) {
    return { ok: false, error: "NEXO_PLAN_INVALID" };
  }
  if (!crm || !crm.active || !onlyProduct(crm, "crm") || !crm.crmMaxUsers) return { ok: false, error: "CRM_PLAN_INVALID" };

  const pct = comboDiscountPct();
  const slug = `combo-${nexo.slug}-${crm.slug}-${pct}`.slice(0, 120);
  const data = comboData(nexo, crm);
  const plan = await prisma.plan.upsert({
    where: { slug },
    create: {
      ...data,
      slug,
      description: `Combo automático: ${nexo.name} + ${crm.name} con ${pct}% de descuento.`,
      monthlyPrice: 0,
      currency: "ARS",
      active: true,
      products: ["nexo", "crm"],
      displayOrder: 9999,
      comboDiscountPct: pct,
    },
    update: data,
  });
  return { ok: true, planId: plan.id, name: plan.name };
}

/**
 * Cuando cambia un plan de Nexo o de Nodo, los combos que lo usan copian sus
 * funciones nuevas (permisos, créditos, usuarios). El descuento no se toca.
 * Best-effort: nunca debe hacer fallar la edición del plan.
 */
export async function syncCombosFor(planId: string): Promise<void> {
  try {
    const combos = await prisma.plan.findMany({
      where: { comboDiscountPct: { not: null }, OR: [{ packNexoPlanId: planId }, { packCrmPlanId: planId }] },
    });
    for (const combo of combos) {
      if (!combo.packNexoPlanId || !combo.packCrmPlanId) continue;
      const [nexo, crm] = await Promise.all([
        prisma.plan.findUnique({ where: { id: combo.packNexoPlanId } }),
        prisma.plan.findUnique({ where: { id: combo.packCrmPlanId } }),
      ]);
      if (!nexo || !crm) continue;
      await prisma.plan.update({ where: { id: combo.id }, data: comboData(nexo, crm) });
    }
  } catch (error) {
    console.error("[combo] No se pudieron sincronizar los combos:", error instanceof Error ? error.message : error);
  }
}

export type PlanSelectionResult = { ok: true; planId: string } | { ok: false; error: string };

/**
 * Superadmin elige un plan de Nexo y/o uno de Nodo. Una suscripción guarda UN
 * plan, así que cuando corresponden los dos productos se usa el combo interno
 * (que habilita ambos). Lo que no se elige se MANTIENE de lo que el negocio ya
 * tiene: dar Nodo a quien tiene Nexo no le quita Nexo, y al revés.
 */
export async function resolvePlanSelection(input: {
  businessId: string;
  nexoPlanId?: string | null;
  crmPlanId?: string | null;
}): Promise<PlanSelectionResult> {
  const nexoId = input.nexoPlanId || null;
  const crmId = input.crmPlanId || null;
  if (!nexoId && !crmId) return { ok: false, error: "Elegí al menos un plan." };

  const [chosenNexo, chosenCrm] = await Promise.all([
    nexoId ? prisma.plan.findUnique({ where: { id: nexoId } }) : null,
    crmId ? prisma.plan.findUnique({ where: { id: crmId } }) : null,
  ]);
  if (nexoId && !chosenNexo) return { ok: false, error: "Plan de Nexo no encontrado." };
  if (crmId && !chosenCrm) return { ok: false, error: "Plan de Nodo no encontrado." };
  if (chosenCrm && !onlyProduct(chosenCrm, "crm")) return { ok: false, error: "El plan elegido para Nodo no es un plan de Nodo." };

  // Un plan que ya incluye ambos productos (combo o pack armado a mano) se
  // asigna tal cual: no se combina con otro.
  if (chosenNexo && chosenNexo.products.includes("crm")) {
    if (crmId) return { ok: false, error: "El plan de Nexo elegido ya incluye Nodo." };
    return { ok: true, planId: chosenNexo.id };
  }
  if (chosenNexo && !onlyProduct(chosenNexo, "nexo")) return { ok: false, error: "El plan elegido para Nexo no es un plan de Nexo." };

  // Lo que ya tiene hoy (para mantener el producto que no se está tocando).
  let currentNexo: string | null = null;
  let currentCrm: string | null = null;
  const sub = await prisma.subscription.findUnique({ where: { businessId: input.businessId }, select: { planId: true } });
  const current = sub ? await prisma.plan.findUnique({ where: { id: sub.planId } }) : null;
  if (current) {
    if (current.packNexoPlanId && current.packCrmPlanId) {
      currentNexo = current.packNexoPlanId;
      currentCrm = current.packCrmPlanId;
    } else if (onlyProduct(current, "nexo")) {
      currentNexo = current.id;
    } else if (onlyProduct(current, "crm")) {
      currentCrm = current.id;
    }
  }

  const nexo = nexoId ?? currentNexo;
  const crm = crmId ?? currentCrm;

  if (nexo && crm) {
    const combo = await getOrCreateComboPlan(nexo, crm, { allowFreeNexo: true });
    if (!combo.ok) {
      return {
        ok: false,
        error: combo.error === "NEXO_PLAN_INVALID" ? "El plan de Nexo no es válido o está desactivado." : "El plan de Nodo no es válido o está desactivado.",
      };
    }
    return { ok: true, planId: combo.planId };
  }
  return { ok: true, planId: (nexo ?? crm) as string };
}
