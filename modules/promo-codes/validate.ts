// Lógica pura, sin I/O — separada de service.ts a propósito para poder
// testearla sin base de datos (ver modules/promo-codes/validate.test.ts).
// Toma datos ya leídos (o null si el código no existe) y solo decide.

export type PromoCodeRedemptionError = "not_found" | "inactive" | "expired" | "exhausted" | "plan_unavailable";

export type PromoCodeEvaluation = { ok: true } | { ok: false; reason: PromoCodeRedemptionError };

export interface EvaluablePromoCode {
  active: boolean;
  expiresAt: Date;
  maxUses: number | null;
  usedCount: number;
}

// Orden de chequeo a propósito (sección 5 del pedido, mismo orden en que se
// listan las reglas): inactivo antes que vencido antes que agotado — no
// cambia el resultado final (todas son excluyentes entre sí salvo
// "not_found"), pero mantiene el mensaje más específico y predecible si
// alguna vez dos condiciones se solapan.
export function evaluatePromoCode(code: EvaluablePromoCode | null, now: Date): PromoCodeEvaluation {
  if (!code) return { ok: false, reason: "not_found" };
  if (!code.active) return { ok: false, reason: "inactive" };
  if (code.expiresAt.getTime() < now.getTime()) return { ok: false, reason: "expired" };
  if (code.maxUses !== null && code.usedCount >= code.maxUses) return { ok: false, reason: "exhausted" };
  return { ok: true };
}

export function computeBonusExpiresAt(durationDays: number, from: Date): Date {
  return new Date(from.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

// Mensajes claros pero sin filtrar de más (sección 6 del pedido: "no
// revelar información innecesaria") — nunca dicen, por ejemplo, cuántos usos
// le quedaban a otro cliente ni el motivo interno de por qué se desactivó.
export const PROMO_CODE_ERROR_MESSAGE: Record<PromoCodeRedemptionError, string> = {
  not_found: "Ese código no existe. Revisá que esté bien escrito.",
  inactive: "Ese código ya no está disponible.",
  expired: "Ese código venció.",
  exhausted: "Ese código ya alcanzó su límite de usos.",
  plan_unavailable: "El plan de ese código ya no está disponible. Contactanos para resolverlo.",
};

const CODE_NORMALIZE_RE = /\s+/g;

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(CODE_NORMALIZE_RE, "");
}

// Formato de ejemplo del pedido: NEXO-PRO-3M-8K4F. Vive en este archivo (sin
// I/O, sin import de lib/prisma) a propósito: components/superadmin/
// promo-code-dialog.tsx lo llama desde el cliente para el botón "Generar",
// y un módulo que importe Prisma no puede entrar al bundle del browser.
const RANDOM_SUFFIX_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin 0/O/1/I para evitar ambigüedad al leerlo en voz alta

export function generatePromoCode(planSlug: string, durationDays: number): string {
  const planPart = planSlug.slice(0, 4).toUpperCase() || "PLAN";
  const durationPart = durationDays % 30 === 0 ? `${durationDays / 30}M` : `${durationDays}D`;
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += RANDOM_SUFFIX_CHARS[Math.floor(Math.random() * RANDOM_SUFFIX_CHARS.length)];
  }
  return `NEXO-${planPart}-${durationPart}-${suffix}`;
}
