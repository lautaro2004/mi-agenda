import { describe, expect, it, vi, beforeEach } from "vitest";

const planFindUnique = vi.fn();
const subscriptionFindUnique = vi.fn();
const subscriptionFindMany = vi.fn();
const subscriptionUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: {
      findUnique: (...args: unknown[]) => planFindUnique(...args),
    },
    subscription: {
      findUnique: (...args: unknown[]) => subscriptionFindUnique(...args),
      findMany: (...args: unknown[]) => subscriptionFindMany(...args),
      upsert: (...args: unknown[]) => subscriptionUpsert(...args),
    },
  },
}));

const { grantTemporaryPlan, revertExpiredBenefits, resolveCurrentPlanId, DEFAULT_PLAN_SLUG } = await import("./subscription");

const GRATIS = { id: "plan_gratis", slug: DEFAULT_PLAN_SLUG, name: "Gratis", active: true, monthlyPrice: 0, currency: "ARS", aiCredits: 40, maxServices: null, whatsappEnabled: false, depositsEnabled: false, customTrainingEnabled: false, statsEnabled: false, galleryEnabled: false, digitalMenuEnabled: false };
const PROFESIONAL = { ...GRATIS, id: "plan_pro", slug: "profesional", name: "Profesional", monthlyPrice: 25000, aiCredits: 1000 };

function mockUpsertReturning(planRow: typeof GRATIS, extra: Record<string, unknown> = {}) {
  subscriptionUpsert.mockImplementation(async (args: { create: Record<string, unknown> }) => ({
    id: "sub_1",
    businessId: "biz_1",
    ...args.create,
    ...extra,
    plan: planRow,
  }));
}

beforeEach(() => {
  planFindUnique.mockReset();
  subscriptionFindUnique.mockReset();
  subscriptionFindMany.mockReset();
  subscriptionUpsert.mockReset();
});

describe("resolveCurrentPlanId", () => {
  it("devuelve el planId de la Subscription existente", async () => {
    subscriptionFindUnique.mockResolvedValue({ planId: "plan_esencial" });
    expect(await resolveCurrentPlanId("biz_1")).toBe("plan_esencial");
    expect(planFindUnique).not.toHaveBeenCalled();
  });

  it("cae al plan Gratis por defecto si el negocio todavía no tiene Subscription", async () => {
    subscriptionFindUnique.mockResolvedValue(null);
    planFindUnique.mockResolvedValue({ id: "plan_gratis" });
    expect(await resolveCurrentPlanId("biz_nuevo")).toBe("plan_gratis");
    expect(planFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: DEFAULT_PLAN_SLUG } }));
  });
});

describe("grantTemporaryPlan", () => {
  it("otorga el plan de inmediato, con provider 'benefit' y snapshot del plan anterior", async () => {
    subscriptionFindUnique.mockResolvedValue({ planId: GRATIS.id });
    planFindUnique.mockResolvedValue(PROFESIONAL);
    mockUpsertReturning(PROFESIONAL);

    const expiresAt = new Date("2027-01-01T00:00:00.000Z");
    const result = await grantTemporaryPlan({ businessId: "biz_1", planId: PROFESIONAL.id, expiresAt });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.subscription.plan.id).toBe(PROFESIONAL.id);
    expect(result.subscription.provider).toBe("benefit");
    expect(result.subscription.benefitExpiresAt).toEqual(expiresAt);
    expect(result.subscription.previousPlanId).toBe(GRATIS.id);
  });

  it("falla con plan_inactive si el plan elegido está desactivado", async () => {
    subscriptionFindUnique.mockResolvedValue({ planId: GRATIS.id });
    planFindUnique.mockResolvedValue({ ...PROFESIONAL, active: false });

    const result = await grantTemporaryPlan({ businessId: "biz_1", planId: PROFESIONAL.id, expiresAt: new Date("2027-01-01") });

    expect(result).toEqual({ ok: false, error: "plan_inactive" });
    expect(subscriptionUpsert).not.toHaveBeenCalled();
  });
});

describe("revertExpiredBenefits", () => {
  it("vuelve al plan anterior cuando la bonificación venció", async () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    subscriptionFindMany.mockResolvedValue([
      { businessId: "biz_1", previousPlanId: GRATIS.id, benefitExpiresAt: new Date("2026-08-31") },
    ]);
    planFindUnique.mockImplementation(async ({ where }: { where: { slug?: string; id?: string } }) => {
      if (where.slug === DEFAULT_PLAN_SLUG) return GRATIS;
      if (where.id === GRATIS.id) return GRATIS;
      return null;
    });
    mockUpsertReturning(GRATIS);

    const result = await revertExpiredBenefits(now);

    expect(result).toEqual({ reverted: 1, skipped: 0 });
    expect(subscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ planId: GRATIS.id, benefitExpiresAt: null, previousPlanId: null, provider: "manual" }),
      })
    );
  });

  it("si el plan anterior fue desactivado mientras tanto, cae al plan Gratis por defecto en vez de fallar", async () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    subscriptionFindMany.mockResolvedValue([
      { businessId: "biz_1", previousPlanId: "plan_esencial_descontinuado", benefitExpiresAt: new Date("2026-08-31") },
    ]);
    planFindUnique.mockImplementation(async ({ where }: { where: { slug?: string; id?: string } }) => {
      if (where.slug === DEFAULT_PLAN_SLUG) return GRATIS;
      if (where.id === "plan_esencial_descontinuado") return { ...PROFESIONAL, id: "plan_esencial_descontinuado", active: false };
      if (where.id === GRATIS.id) return GRATIS;
      return null;
    });
    mockUpsertReturning(GRATIS);

    const result = await revertExpiredBenefits(now);

    expect(result).toEqual({ reverted: 1, skipped: 0 });
    expect(subscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ planId: GRATIS.id }) })
    );
  });

  it("no toca suscripciones sin bonificación vencida", async () => {
    subscriptionFindMany.mockResolvedValue([]);

    const result = await revertExpiredBenefits(new Date());

    expect(result).toEqual({ reverted: 0, skipped: 0 });
    expect(subscriptionUpsert).not.toHaveBeenCalled();
  });
});
