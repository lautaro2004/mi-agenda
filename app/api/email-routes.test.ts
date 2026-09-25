import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentBusinessId = vi.fn();
vi.mock("@/modules/business/current", () => ({ getCurrentBusinessId: () => getCurrentBusinessId() }));

const getEmailSettings = vi.fn();
const updateEmailSettings = vi.fn();
vi.mock("@/modules/email/settings", () => ({
  getEmailSettings: (...a: unknown[]) => getEmailSettings(...a),
  updateEmailSettings: (...a: unknown[]) => updateEmailSettings(...a),
}));

const sendDueReminders = vi.fn();
const sendDailySummaries = vi.fn();
vi.mock("@/modules/email/booking-emails", () => ({ sendDueReminders: (...a: unknown[]) => sendDueReminders(...a) }));
vi.mock("@/modules/email/daily-summary", () => ({ sendDailySummaries: (...a: unknown[]) => sendDailySummaries(...a) }));

const settingsRoute = await import("./business/email-notifications/route");
const cronRoute = await import("./cron/email-notifications/route");

const valid = {
  bookingConfirmationEnabled: true,
  reminderEnabled: true,
  reminderLeadMinutes: 30,
  dailySummaryEnabled: true,
  dailySummaryHour: 7,
};
const patch = (body: unknown) => settingsRoute.PATCH(new Request("http://t", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("/api/business/email-notifications", () => {
  it("sin sesión responde 401", async () => {
    getCurrentBusinessId.mockResolvedValue(null);
    expect((await settingsRoute.GET()).status).toBe(401);
    expect((await patch(valid)).status).toBe(401);
    expect(updateEmailSettings).not.toHaveBeenCalled();
  });

  it("usa siempre el negocio de la sesión, ignorando un businessId del body", async () => {
    getCurrentBusinessId.mockResolvedValue("biz-a");
    updateEmailSettings.mockImplementation(async (_id, values) => values);
    const res = await patch({ ...valid, businessId: "biz-b" });
    expect(res.status).toBe(200);
    expect(updateEmailSettings).toHaveBeenCalledWith("biz-a", valid);
  });

  it("valida anticipación (30/60) y hora (0-23)", async () => {
    getCurrentBusinessId.mockResolvedValue("biz-a");
    expect((await patch({ ...valid, reminderLeadMinutes: 45 })).status).toBe(400);
    expect((await patch({ ...valid, dailySummaryHour: 24 })).status).toBe(400);
    expect(updateEmailSettings).not.toHaveBeenCalled();
  });
});

describe("POST /api/cron/email-notifications", () => {
  const call = (auth?: string) =>
    cronRoute.POST(new Request("http://t", { method: "POST", headers: auth ? { authorization: auth } : {} }));

  it("sin CRON_SECRET configurado queda inutilizable (500)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer x")).status).toBe(500);
  });

  it("rechaza sin token o con token incorrecto (401)", async () => {
    vi.stubEnv("CRON_SECRET", "secreto");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer otro")).status).toBe(401);
    expect(sendDueReminders).not.toHaveBeenCalled();
  });

  it("con el token correcto corre recordatorios y resúmenes", async () => {
    vi.stubEnv("CRON_SECRET", "secreto");
    sendDueReminders.mockResolvedValue({ sent: 2, failed: 0 });
    sendDailySummaries.mockResolvedValue({ sent: 1, failed: 0 });
    const res = await call("Bearer secreto");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reminders: { sent: 2, failed: 0 }, dailySummaries: { sent: 1, failed: 0 } });
  });
});
