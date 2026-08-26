import { describe, expect, it, vi, beforeEach } from "vitest";

const updatePlanMercadoPagoSync = vi.fn();
const isMercadoPagoConfigured = vi.fn();
const createPreapprovalPlan = vi.fn();
const getPreapprovalPlan = vi.fn();
const updatePreapprovalPlanMetadata = vi.fn();

vi.mock("@/modules/billing/subscription", () => ({
  updatePlanMercadoPagoSync: (...args: unknown[]) => updatePlanMercadoPagoSync(...args),
}));

vi.mock("@/modules/billing/mercadopago/client", () => ({
  isMercadoPagoConfigured: (...args: unknown[]) => isMercadoPagoConfigured(...args),
}));

vi.mock("@/modules/billing/mercadopago/plans", () => ({
  createPreapprovalPlan: (...args: unknown[]) => createPreapprovalPlan(...args),
  getPreapprovalPlan: (...args: unknown[]) => getPreapprovalPlan(...args),
  updatePreapprovalPlanMetadata: (...args: unknown[]) => updatePreapprovalPlanMetadata(...args),
}));

const { syncPlanWithMercadoPago } = await import("./sync-plan");

const PLAN_GRATIS = {
  id: "plan_gratis",
  name: "Gratis",
  monthlyPrice: 0,
  currency: "ARS",
  active: true,
  mercadoPagoPlanId: null,
};

const PLAN_ESENCIAL = {
  id: "plan_esencial",
  name: "Esencial",
  monthlyPrice: 12000,
  currency: "ARS",
  active: true,
  mercadoPagoPlanId: null,
};

beforeEach(() => {
  updatePlanMercadoPagoSync.mockReset();
  isMercadoPagoConfigured.mockReset();
  createPreapprovalPlan.mockReset();
  getPreapprovalPlan.mockReset();
  updatePreapprovalPlanMetadata.mockReset();
  isMercadoPagoConfigured.mockReturnValue(true);
});

describe("syncPlanWithMercadoPago", () => {
  it("Gratis nunca sincroniza (no llama a Mercado Pago)", async () => {
    const result = await syncPlanWithMercadoPago(PLAN_GRATIS);

    expect(result).toBeNull();
    expect(createPreapprovalPlan).not.toHaveBeenCalled();
    expect(getPreapprovalPlan).not.toHaveBeenCalled();
    expect(updatePlanMercadoPagoSync).not.toHaveBeenCalled();
  });

  it("un plan pago pero inactivo y todavía sin mercadoPagoPlanId no sincroniza (ej. Empresa)", async () => {
    const plan = { ...PLAN_ESENCIAL, active: false };
    const result = await syncPlanWithMercadoPago(plan);

    expect(result).toBeNull();
    expect(createPreapprovalPlan).not.toHaveBeenCalled();
    expect(updatePlanMercadoPagoSync).not.toHaveBeenCalled();
  });

  it("un plan inactivo que YA tiene mercadoPagoPlanId sigue sincronizando (para reflejar la baja en MP)", async () => {
    const plan = { ...PLAN_ESENCIAL, active: false, mercadoPagoPlanId: "mp_plan_existing" };
    getPreapprovalPlan.mockResolvedValue({ id: "mp_plan_existing", status: "active", reason: "Esencial", transactionAmount: 12000, currencyId: "ARS" });
    updatePreapprovalPlanMetadata.mockResolvedValue({ id: "mp_plan_existing", status: "cancelled", reason: "Esencial", transactionAmount: 12000, currencyId: "ARS" });
    updatePlanMercadoPagoSync.mockResolvedValue({ ...plan, mercadoPagoSyncStatus: "synced" });

    await syncPlanWithMercadoPago(plan);

    expect(updatePreapprovalPlanMetadata).toHaveBeenCalledWith("mp_plan_existing", { name: "Esencial", active: false });
  });

  it("un plan pago sin mercadoPagoPlanId crea un preapproval_plan nuevo y lo asocia", async () => {
    createPreapprovalPlan.mockResolvedValue({ id: "mp_plan_123", status: "active", reason: "Esencial", transactionAmount: 12000, currencyId: "ARS" });
    updatePlanMercadoPagoSync.mockResolvedValue({ ...PLAN_ESENCIAL, mercadoPagoPlanId: "mp_plan_123", mercadoPagoSyncStatus: "synced" });

    await syncPlanWithMercadoPago(PLAN_ESENCIAL);

    expect(createPreapprovalPlan).toHaveBeenCalledWith({ name: "Esencial", monthlyPrice: 12000, currency: "ARS" });
    expect(getPreapprovalPlan).not.toHaveBeenCalled();
    expect(updatePlanMercadoPagoSync).toHaveBeenCalledWith("plan_esencial", {
      mercadoPagoPlanId: "mp_plan_123",
      mercadoPagoSyncStatus: "synced",
      mercadoPagoSyncError: null,
    });
  });

  it("si no cambió el precio, actualiza metadata in-place sobre el mismo preapproval_plan (no crea uno nuevo)", async () => {
    const plan = { ...PLAN_ESENCIAL, mercadoPagoPlanId: "mp_plan_existing" };
    getPreapprovalPlan.mockResolvedValue({ id: "mp_plan_existing", status: "active", reason: "Esencial", transactionAmount: 12000, currencyId: "ARS" });
    updatePreapprovalPlanMetadata.mockResolvedValue({ id: "mp_plan_existing", status: "active", reason: "Esencial", transactionAmount: 12000, currencyId: "ARS" });
    updatePlanMercadoPagoSync.mockResolvedValue({ ...plan, mercadoPagoSyncStatus: "synced" });

    await syncPlanWithMercadoPago(plan);

    expect(createPreapprovalPlan).not.toHaveBeenCalled();
    expect(updatePreapprovalPlanMetadata).toHaveBeenCalledWith("mp_plan_existing", { name: "Esencial", active: true });
    expect(updatePlanMercadoPagoSync).toHaveBeenCalledWith("plan_esencial", {
      mercadoPagoSyncStatus: "synced",
      mercadoPagoSyncError: null,
    });
  });

  it("si cambió el precio, crea una versión NUEVA del preapproval_plan en vez de mutar transaction_amount", async () => {
    const plan = { ...PLAN_ESENCIAL, mercadoPagoPlanId: "mp_plan_old", monthlyPrice: 15000 };
    getPreapprovalPlan.mockResolvedValue({ id: "mp_plan_old", status: "active", reason: "Esencial", transactionAmount: 12000, currencyId: "ARS" });
    createPreapprovalPlan.mockResolvedValue({ id: "mp_plan_new", status: "active", reason: "Esencial", transactionAmount: 15000, currencyId: "ARS" });
    updatePlanMercadoPagoSync.mockResolvedValue({ ...plan, mercadoPagoPlanId: "mp_plan_new", mercadoPagoSyncStatus: "synced" });

    await syncPlanWithMercadoPago(plan);

    expect(createPreapprovalPlan).toHaveBeenCalledWith({ name: "Esencial", monthlyPrice: 15000, currency: "ARS" });
    expect(updatePreapprovalPlanMetadata).not.toHaveBeenCalled();
    expect(updatePlanMercadoPagoSync).toHaveBeenCalledWith("plan_esencial", {
      mercadoPagoPlanId: "mp_plan_new",
      mercadoPagoSyncStatus: "synced",
      mercadoPagoSyncError: null,
    });
  });

  it("un plan sin MERCADOPAGO_ACCESS_TOKEN queda en error, sin intentar llamar a la API", async () => {
    isMercadoPagoConfigured.mockReturnValue(false);
    updatePlanMercadoPagoSync.mockResolvedValue({ ...PLAN_ESENCIAL, mercadoPagoSyncStatus: "error" });

    await syncPlanWithMercadoPago(PLAN_ESENCIAL);

    expect(createPreapprovalPlan).not.toHaveBeenCalled();
    expect(updatePlanMercadoPagoSync).toHaveBeenCalledWith(
      "plan_esencial",
      expect.objectContaining({ mercadoPagoSyncStatus: "error" })
    );
  });

  it("si Mercado Pago devuelve un error, lo persiste en mercadoPagoSyncError en vez de lanzar", async () => {
    createPreapprovalPlan.mockRejectedValue(new Error("Mercado Pago respondió 401."));
    updatePlanMercadoPagoSync.mockResolvedValue({ ...PLAN_ESENCIAL, mercadoPagoSyncStatus: "error", mercadoPagoSyncError: "Mercado Pago respondió 401." });

    const result = await syncPlanWithMercadoPago(PLAN_ESENCIAL);

    expect(result).not.toBeNull();
    expect(updatePlanMercadoPagoSync).toHaveBeenCalledWith("plan_esencial", {
      mercadoPagoSyncStatus: "error",
      mercadoPagoSyncError: "Mercado Pago respondió 401.",
    });
  });
});
