import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findUnique = vi.fn();
const findMany = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));

const sendBookingConfirmation = vi.fn();
const sendBookingDeclined = vi.fn();
vi.mock("@/modules/email/booking-emails", () => ({
  sendBookingConfirmation: (...a: unknown[]) => sendBookingConfirmation(...a),
  sendBookingDeclined: (...a: unknown[]) => sendBookingDeclined(...a),
}));

const { approveAppointment, rejectAppointment, expirePendingApprovals } = await import("./approval");

const NOW = new Date("2026-10-27T15:00:00Z");
const HOUR = 3_600_000;

beforeEach(() => {
  for (const m of [findFirst, findUnique, findMany, updateMany, sendBookingConfirmation, sendBookingDeclined]) m.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
  findUnique.mockResolvedValue({ id: "a1", status: "confirmed" });
});

describe("approveAppointment", () => {
  it("confirma una solicitud vigente, libera el vencimiento y avisa al cliente", async () => {
    findFirst.mockResolvedValue({ id: "a1", approvalExpiresAt: new Date(NOW.getTime() + HOUR), depositAmount: null });
    const res = await approveAppointment("biz_1", "a1", NOW);
    expect(res.error).toBeUndefined();
    expect(updateMany.mock.calls[0][0].data).toEqual({ status: "confirmed", approvalExpiresAt: null });
    expect(sendBookingConfirmation).toHaveBeenCalledWith("a1");
  });

  it("scopea todo al negocio de la sesión", async () => {
    findFirst.mockResolvedValue({ id: "a1", approvalExpiresAt: new Date(NOW.getTime() + HOUR), depositAmount: null });
    await approveAppointment("biz_1", "a1", NOW);
    expect(findFirst.mock.calls[0][0].where.businessId).toBe("biz_1");
    expect(updateMany.mock.calls[0][0].where.businessId).toBe("biz_1");
  });

  it("con seña, pasa a pendiente de pago (recién ahora se pide la seña)", async () => {
    findFirst.mockResolvedValue({ id: "a1", approvalExpiresAt: new Date(NOW.getTime() + HOUR), depositAmount: 5000 });
    await approveAppointment("biz_1", "a1", NOW);
    expect(updateMany.mock.calls[0][0].data.status).toBe("pending_payment");
  });

  it("no aprueba lo que ya venció aunque el barrido todavía no corrió", async () => {
    findFirst.mockResolvedValue({ id: "a1", approvalExpiresAt: new Date(NOW.getTime() - 1000), depositAmount: null });
    expect((await approveAppointment("biz_1", "a1", NOW)).error).toBe("expired");
    expect(updateMany).not.toHaveBeenCalled();
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("not_found si no hay una solicitud pendiente (o es de otro negocio)", async () => {
    findFirst.mockResolvedValue(null);
    expect((await approveAppointment("biz_1", "a1", NOW)).error).toBe("not_found");
  });

  it("si otra acción se adelantó (count 0) no confirma ni envía nada", async () => {
    findFirst.mockResolvedValue({ id: "a1", approvalExpiresAt: new Date(NOW.getTime() + HOUR), depositAmount: null });
    updateMany.mockResolvedValue({ count: 0 });
    expect((await approveAppointment("biz_1", "a1", NOW)).error).toBe("not_found");
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
  });
});

describe("rejectAppointment", () => {
  it("cancela, libera el horario y avisa al cliente", async () => {
    findUnique.mockResolvedValue({ id: "a1", status: "cancelled" });
    const res = await rejectAppointment("biz_1", "a1");
    expect(res.error).toBeUndefined();
    expect(updateMany.mock.calls[0][0].data).toEqual({ status: "cancelled", approvalExpiresAt: null });
    expect(updateMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz_1", status: "pending" });
    expect(sendBookingDeclined).toHaveBeenCalledWith("a1", "rejected");
  });

  it("no toca turnos que no estén esperando aprobación", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect((await rejectAppointment("biz_1", "a1")).error).toBe("not_found");
    expect(sendBookingDeclined).not.toHaveBeenCalled();
  });
});

describe("expirePendingApprovals", () => {
  it("cancela las vencidas, libera el horario y avisa a cada cliente", async () => {
    findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    const res = await expirePendingApprovals(NOW);
    expect(res).toEqual({ expired: 2 });
    expect(findMany.mock.calls[0][0].where).toEqual({ status: "pending", approvalExpiresAt: { lte: NOW } });
    expect(sendBookingDeclined).toHaveBeenCalledWith("a1", "expired");
    expect(sendBookingDeclined).toHaveBeenCalledWith("a2", "expired");
  });

  it("es idempotente: lo que otra acción ya resolvió no se cuenta ni se avisa de nuevo", async () => {
    findMany.mockResolvedValue([{ id: "a1" }]);
    updateMany.mockResolvedValue({ count: 0 });
    expect(await expirePendingApprovals(NOW)).toEqual({ expired: 0 });
    expect(sendBookingDeclined).not.toHaveBeenCalled();
  });

  it("sin vencidas no hace nada", async () => {
    findMany.mockResolvedValue([]);
    expect(await expirePendingApprovals(NOW)).toEqual({ expired: 0 });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
