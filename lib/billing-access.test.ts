import { describe, expect, it } from "vitest";

import { resolveProductAccess, type AccessSubscription } from "./billing-access";

// Mismos casos en crm/lib/billing-access.test.ts (la función está copiada en
// Nodo): si cambia una regla, cambian los dos.
const now = new Date("2026-10-26T12:00:00Z");
const d = (s: string) => new Date(s);
const base: AccessSubscription = {
  status: "active",
  provider: "mercadopago",
  pastDueSince: null,
  currentPeriodEnd: d("2026-11-20T00:00:00Z"),
  plan: { products: ["nexo", "crm"] },
};
const access = (patch: Partial<AccessSubscription>, product: "nexo" | "crm" = "crm") =>
  resolveProductAccess({ ...base, ...patch }, product, now);

describe("resolveProductAccess", () => {
  it("activa y con el producto en el plan → acceso normal", () => {
    expect(access({}).access).toBe("full");
  });

  it("producto fuera del plan o sin suscripción → bloqueado", () => {
    expect(access({ plan: { products: ["nexo"] } })).toMatchObject({ access: "blocked", reason: "not_in_plan" });
    expect(resolveProductAccess(null, "crm", now)).toMatchObject({ access: "blocked", reason: "no_subscription" });
  });

  it("prueba vigente → acceso; prueba vencida → bloqueado", () => {
    expect(access({ status: "trialing", provider: "benefit" }).access).toBe("full");
    expect(access({ status: "trialing", currentPeriodEnd: d("2026-10-20T00:00:00Z") })).toMatchObject({ reason: "trial_expired" });
  });

  it("atraso: 7 días de gracia contados desde pastDueSince", () => {
    expect(access({ status: "past_due", pastDueSince: d("2026-10-22T12:00:00Z") })).toMatchObject({
      access: "grace",
      graceEndsAt: d("2026-10-29T12:00:00Z"),
    });
    expect(access({ status: "past_due", pastDueSince: d("2026-10-19T12:00:00Z") })).toMatchObject({
      access: "blocked",
      reason: "past_due_expired",
    });
  });

  it("cancelada: acceso hasta el fin del período pagado", () => {
    expect(access({ status: "canceled" })).toMatchObject({ access: "full", reason: "canceled_until_period_end" });
    expect(access({ status: "canceled", currentPeriodEnd: d("2026-10-01T00:00:00Z") })).toMatchObject({ access: "blocked", reason: "canceled" });
  });

  it("vencida → bloqueado", () => {
    expect(access({ status: "expired" }).access).toBe("blocked");
  });

  it("si la renovación nunca se notificó, cuenta como atraso pasada la tolerancia", () => {
    expect(access({ currentPeriodEnd: d("2026-10-20T00:00:00Z") })).toMatchObject({
      access: "grace",
      pastDueSince: d("2026-10-20T00:00:00Z"),
    });
    expect(access({ currentPeriodEnd: d("2026-10-24T12:00:00Z") }).access).toBe("full");
    // Si MP dio señales después de la fecha de cobro, el estado persistido
    // manda (no se infiere atraso).
    expect(access({ currentPeriodEnd: d("2026-10-20T00:00:00Z"), mercadoPagoLastSyncedAt: d("2026-10-21T00:00:00Z") }).access).toBe("full");
    // Sin Mercado Pago (manual/bonificación) no hay renovación que esperar.
    expect(access({ provider: "manual", currentPeriodEnd: d("2026-10-01T00:00:00Z") }).access).toBe("full");
  });
});
