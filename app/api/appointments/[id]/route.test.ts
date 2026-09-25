import { describe, expect, it, vi, beforeEach } from "vitest";

// Aislamiento entre negocios de PATCH/DELETE /api/appointments/[id]: se usa el
// servicio REAL (modules/appointments/service.ts) contra un prisma en memoria
// mínimo, para probar que el filtro por businessId está de verdad en la
// consulta y no solo cableado en la ruta.

const getCurrentBusinessId = vi.fn();
vi.mock("@/modules/business/current", () => ({
  getCurrentBusinessId: () => getCurrentBusinessId(),
}));

type Row = {
  id: string;
  businessId: string;
  status: string;
  customerName: string;
  serviceName: string;
  date: string;
  startTime: string;
};

const db = vi.hoisted(() => ({ rows: [] as Row[] }));

const appointmentModel = vi.hoisted(() => ({
  findFirst: async ({ where }: { where: { id: string; businessId: string } }) =>
    db.rows.find((r) => r.id === where.id && r.businessId === where.businessId) ?? null,
  update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
    const row = db.rows.find((r) => r.id === where.id);
    if (!row) throw new Error("P2025");
    Object.assign(row, data);
    return row;
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: appointmentModel,
    $transaction: async (fn: (tx: { appointment: typeof appointmentModel }) => unknown) =>
      fn({ appointment: appointmentModel }),
  },
}));

const { PATCH, DELETE } = await import("./route");

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: unknown) =>
  PATCH(new Request("http://test/api/appointments/x", { method: "PATCH", body: JSON.stringify(body) }), params(id));
const del = (id: string) => DELETE(new Request("http://test/api/appointments/x", { method: "DELETE" }), params(id));

function makeRow(id: string, businessId: string): Row {
  return { id, businessId, status: "confirmed", customerName: "Cliente", serviceName: "Corte", date: "2030-01-01", startTime: "10:00" };
}

beforeEach(() => {
  getCurrentBusinessId.mockReset();
  db.rows = [makeRow("appt-a", "biz-a"), makeRow("appt-b", "biz-b")];
});

describe("/api/appointments/[id] — aislamiento por negocio", () => {
  it("un usuario del negocio A cancela su propio turno", async () => {
    getCurrentBusinessId.mockResolvedValue("biz-a");
    const res = await patch("appt-a", { action: "cancel" });
    expect(res.status).toBe(200);
    expect(db.rows.find((r) => r.id === "appt-a")?.status).toBe("cancelled");
  });

  it("DELETE cancela el turno propio", async () => {
    getCurrentBusinessId.mockResolvedValue("biz-a");
    const res = await del("appt-a");
    expect(res.status).toBe(200);
    expect(db.rows.find((r) => r.id === "appt-a")?.status).toBe("cancelled");
  });

  it("un usuario del negocio A NO puede cancelar el turno del negocio B (404, sin cambios)", async () => {
    getCurrentBusinessId.mockResolvedValue("biz-a");
    expect((await patch("appt-b", { action: "cancel" })).status).toBe(404);
    expect((await del("appt-b")).status).toBe(404);
    expect(db.rows.find((r) => r.id === "appt-b")?.status).toBe("confirmed");
  });

  it("un usuario del negocio A NO puede reprogramar el turno del negocio B (404, sin cambios)", async () => {
    getCurrentBusinessId.mockResolvedValue("biz-a");
    const res = await patch("appt-b", { action: "reschedule", date: "2030-02-02", startTime: "11:00", durationMinutes: 60 });
    expect(res.status).toBe(404);
    const row = db.rows.find((r) => r.id === "appt-b");
    expect(row?.date).toBe("2030-01-01");
    expect(row?.startTime).toBe("10:00");
  });

  it("sin sesión responde 401 y no toca nada", async () => {
    getCurrentBusinessId.mockResolvedValue(null);
    expect((await patch("appt-a", { action: "cancel" })).status).toBe(401);
    expect((await del("appt-a")).status).toBe(401);
    expect(db.rows.every((r) => r.status === "confirmed")).toBe(true);
  });

  it("un turno inexistente devuelve 404", async () => {
    getCurrentBusinessId.mockResolvedValue("biz-a");
    expect((await patch("no-existe", { action: "cancel" })).status).toBe(404);
    expect((await del("no-existe")).status).toBe(404);
  });
});
