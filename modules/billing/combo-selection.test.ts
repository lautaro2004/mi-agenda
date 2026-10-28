import { beforeEach, describe, expect, it, vi } from "vitest";

const { planFind, planUpsert, subFind } = vi.hoisted(() => ({
  planFind: vi.fn(async (_args: { where: { id: string } }): Promise<unknown> => null),
  planUpsert: vi.fn(async (_args: { create: Record<string, unknown> }): Promise<unknown> => null),
  subFind: vi.fn(async (_args: { where: { businessId: string } }): Promise<unknown> => null),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { plan: { findUnique: planFind, upsert: planUpsert }, subscription: { findUnique: subFind } },
}));

import { resolvePlanSelection } from "./combo";

const nexoPro = { id: "n1", slug: "profesional", name: "Profesional", active: true, monthlyPrice: 30000, products: ["nexo"], packNexoPlanId: null, packCrmPlanId: null };
const nexoBase = { id: "n0", slug: "agenda-interna", name: "Agenda interna", active: true, monthlyPrice: 0, products: ["nexo"], packNexoPlanId: null, packCrmPlanId: null };
const crmPro = { id: "c1", slug: "nodo-pro", name: "Nodo Pro", active: true, monthlyPrice: 50, products: ["crm"], crmMaxUsers: 5, packNexoPlanId: null, packCrmPlanId: null };
const crmTeam = { id: "c2", slug: "nodo-team", name: "Nodo Team", active: true, monthlyPrice: 120, products: ["crm"], crmMaxUsers: 10, packNexoPlanId: null, packCrmPlanId: null };
const combo = { id: "cb1", slug: "combo-profesional-nodo-pro-20", name: "Profesional + Nodo Pro", active: true, monthlyPrice: 0, products: ["nexo", "crm"], packNexoPlanId: "n1", packCrmPlanId: "c1" };

const plans: Record<string, unknown> = { n1: nexoPro, n0: nexoBase, c1: crmPro, c2: crmTeam, cb1: combo };

function currentPlan(id: string | null) {
  subFind.mockResolvedValue(id ? { planId: id } : null);
}

beforeEach(() => {
  planFind.mockReset().mockImplementation(async ({ where }: { where: { id: string } }) => plans[where.id] ?? null);
  planUpsert.mockReset().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ id: "combo-new", name: create.name }));
  subFind.mockReset().mockResolvedValue(null);
});

describe("resolvePlanSelection", () => {
  it("exige elegir al menos un plan", async () => {
    expect(await resolvePlanSelection({ businessId: "b1" })).toMatchObject({ ok: false });
    expect(await resolvePlanSelection({ businessId: "b1", nexoPlanId: "", crmPlanId: "" })).toMatchObject({ ok: false });
  });

  it("solo Nexo y sin Nodo previo: asigna ese plan tal cual", async () => {
    expect(await resolvePlanSelection({ businessId: "b1", nexoPlanId: "n1" })).toEqual({ ok: true, planId: "n1" });
    expect(planUpsert).not.toHaveBeenCalled();
  });

  it("dar Nodo a quien ya tiene Nexo NO le quita Nexo: arma el combo con los dos", async () => {
    currentPlan("n1");
    const r = await resolvePlanSelection({ businessId: "b1", crmPlanId: "c1" });
    expect(r).toEqual({ ok: true, planId: "combo-new" });
    expect(planUpsert.mock.calls[0][0].create).toMatchObject({ packNexoPlanId: "n1", packCrmPlanId: "c1", products: ["nexo", "crm"] });
  });

  it("dar Nexo a quien ya tiene Nodo conserva Nodo", async () => {
    currentPlan("c1");
    await resolvePlanSelection({ businessId: "b1", nexoPlanId: "n1" });
    expect(planUpsert.mock.calls[0][0].create).toMatchObject({ packNexoPlanId: "n1", packCrmPlanId: "c1" });
  });

  it("elegir los dos arma el combo aunque el negocio tenga otro plan", async () => {
    currentPlan("n0");
    await resolvePlanSelection({ businessId: "b1", nexoPlanId: "n1", crmPlanId: "c2" });
    expect(planUpsert.mock.calls[0][0].create).toMatchObject({ packNexoPlanId: "n1", packCrmPlanId: "c2" });
  });

  it("si hoy tiene un combo y se cambia solo Nodo, se mantiene el Nexo del combo", async () => {
    currentPlan("cb1");
    await resolvePlanSelection({ businessId: "b1", crmPlanId: "c2" });
    expect(planUpsert.mock.calls[0][0].create).toMatchObject({ packNexoPlanId: "n1", packCrmPlanId: "c2" });
  });

  it("en un otorgamiento se puede combinar el plan base de Nexo con Nodo (sin cobro)", async () => {
    currentPlan("n0");
    const r = await resolvePlanSelection({ businessId: "b1", crmPlanId: "c1" });
    expect(r.ok).toBe(true);
    expect(planUpsert.mock.calls[0][0].create).toMatchObject({ packNexoPlanId: "n0", packCrmPlanId: "c1" });
  });

  it("rechaza planes inexistentes o del producto equivocado", async () => {
    expect(await resolvePlanSelection({ businessId: "b1", nexoPlanId: "nope" })).toMatchObject({ ok: false });
    expect(await resolvePlanSelection({ businessId: "b1", crmPlanId: "n1" })).toMatchObject({ ok: false });
  });

  it("un plan que ya incluye ambos productos se asigna solo, sin combinar", async () => {
    expect(await resolvePlanSelection({ businessId: "b1", nexoPlanId: "cb1" })).toEqual({ ok: true, planId: "cb1" });
    expect(await resolvePlanSelection({ businessId: "b1", nexoPlanId: "cb1", crmPlanId: "c1" })).toMatchObject({ ok: false });
  });
});
