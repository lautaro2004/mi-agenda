import { beforeEach, describe, expect, it, vi } from "vitest";

// Prueba de integración de confirmación, recordatorio y resumen diario contra
// un prisma en memoria (mismo criterio que app/api/appointments/[id]/route.test.ts):
// el proveedor de email está simulado para inspeccionar qué se envía.

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  appointments: [] as Row[],
  settings: [] as Row[],
  businesses: [] as Row[],
  memberships: [] as Row[],
}));

const sendViaResend = vi.hoisted(() => vi.fn());
vi.mock("./provider", () => ({ sendViaResend: (m: unknown) => sendViaResend(m) }));

function matchField(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== "object" || cond instanceof Date) return value === cond;
  const c = cond as Record<string, unknown>;
  if ("in" in c) return (c.in as unknown[]).includes(value);
  if ("notIn" in c) return !(c.notIn as unknown[]).includes(value);
  if ("not" in c) return value !== c.not;
  if ("gte" in c || "lte" in c) {
    return (c.gte === undefined || (value as number) >= (c.gte as number)) && (c.lte === undefined || (value as number) <= (c.lte as number));
  }
  return false;
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((w) => matches(row, w));
    return matchField(row[key], cond);
  });
}

function table(rows: () => Row[]) {
  return {
    findMany: async ({ where }: { where?: Row } = {}) => rows().filter((r) => matches(r, where)),
    findFirst: async ({ where }: { where?: Row } = {}) => rows().find((r) => matches(r, where)) ?? null,
    updateMany: async ({ where, data }: { where?: Row; data: Row }) => {
      const hit = rows().filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      ...table(() => state.appointments),
      findMany: async ({ where }: { where?: Row }) =>
        state.appointments
          .filter((r) => matches(r, where))
          .map((r) => ({ ...r, business: state.businesses.find((b) => b.id === r.businessId) })),
      findUnique: async ({ where }: { where: { id: string } }) => {
        const r = state.appointments.find((a) => a.id === where.id);
        return r ? { ...r, business: state.businesses.find((b) => b.id === r.businessId) } : null;
      },
    },
    emailNotificationSettings: {
      ...table(() => state.settings),
      findUnique: async ({ where }: { where: { businessId: string } }) => state.settings.find((s) => s.businessId === where.businessId) ?? null,
    },
    business: { findUnique: async ({ where }: { where: { id: string } }) => state.businesses.find((b) => b.id === where.id) ?? null },
    membership: {
      findFirst: async ({ where }: { where: { businessId: string } }) => {
        const m = state.memberships.find((x) => x.businessId === where.businessId);
        return m ? { user: { email: m.email } } : null;
      },
    },
  },
}));

const { sendBookingConfirmation, sendDueReminders } = await import("./booking-emails");
const { sendDailySummaries } = await import("./daily-summary");

let seq = 0;
function appt(businessId: string, overrides: Row = {}): Row {
  const row: Row = {
    id: `appt-${++seq}`,
    businessId,
    customerName: "Ana",
    customerEmail: "ana@cliente.com",
    serviceName: "Corte",
    date: "2030-06-10",
    startTime: "10:00",
    endTime: "11:00",
    notes: null,
    status: "confirmed",
    depositAmount: null,
    totalAmount: null,
    confirmationEmailSentAt: null,
    reminderEmailSentAt: null,
    ...overrides,
  };
  state.appointments.push(row);
  return row;
}

function settings(businessId: string, overrides: Row = {}) {
  state.settings.push({
    businessId,
    bookingConfirmationEnabled: true,
    reminderEnabled: false,
    reminderLeadMinutes: 60,
    dailySummaryEnabled: false,
    dailySummaryHour: 8,
    lastDailySummaryDate: null,
    ...overrides,
  });
}

// 2030-06-10 en Argentina (UTC-3): 09:05 → 12:05Z, 08:10 → 11:10Z.
const at = (iso: string) => new Date(iso);

beforeEach(() => {
  state.appointments = [];
  state.settings = [];
  state.businesses = [
    { id: "biz-a", name: "Negocio A" },
    { id: "biz-b", name: "Negocio B" },
  ];
  state.memberships = [
    { businessId: "biz-a", email: "duena-a@test.com" },
    { businessId: "biz-b", email: "duenio-b@test.com" },
  ];
  sendViaResend.mockReset();
  sendViaResend.mockResolvedValue({ ok: true, simulated: false, messageId: "m1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("confirmación de reserva", () => {
  it("envía al cliente, con el negocio como remitente y Reply-To al dueño", async () => {
    const a = appt("biz-a");
    expect(await sendBookingConfirmation(a.id as string)).toBe("sent");
    const sent = sendViaResend.mock.calls[0][0];
    expect(sent.to).toBe("ana@cliente.com");
    expect(sent.fromName).toBe("Negocio A");
    expect(sent.replyTo).toBe("duena-a@test.com");
    expect(sent.subject).toContain("Tu turno está confirmado");
    expect(sent.idempotencyKey).toBe(`booking-confirmation/${a.id}`);
  });

  it("es idempotente: un reintento no envía un segundo email", async () => {
    const a = appt("biz-a");
    await sendBookingConfirmation(a.id as string);
    expect(await sendBookingConfirmation(a.id as string)).toBe("skipped");
    expect(sendViaResend).toHaveBeenCalledTimes(1);
  });

  it("dos llamadas simultáneas envían un solo email", async () => {
    const a = appt("biz-a");
    await Promise.all([sendBookingConfirmation(a.id as string), sendBookingConfirmation(a.id as string)]);
    expect(sendViaResend).toHaveBeenCalledTimes(1);
  });

  it("no envía sin email del cliente, con la opción apagada o con el turno cancelado", async () => {
    settings("biz-b", { bookingConfirmationEnabled: false });
    expect(await sendBookingConfirmation(appt("biz-a", { customerEmail: null }).id as string)).toBe("skipped");
    expect(await sendBookingConfirmation(appt("biz-b").id as string)).toBe("skipped");
    expect(await sendBookingConfirmation(appt("biz-a", { status: "cancelled" }).id as string)).toBe("skipped");
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("si el proveedor falla, libera la marca para poder reintentar", async () => {
    const a = appt("biz-a");
    sendViaResend.mockResolvedValueOnce({ ok: false, error: "boom" });
    expect(await sendBookingConfirmation(a.id as string)).toBe("failed");
    expect(a.confirmationEmailSentAt).toBeNull();
    expect(await sendBookingConfirmation(a.id as string)).toBe("sent");
  });

  it("un turno con seña pendiente lo aclara en el email", async () => {
    const a = appt("biz-a", { status: "pending_payment", depositAmount: 3000, totalAmount: 10000 });
    await sendBookingConfirmation(a.id as string);
    expect(sendViaResend.mock.calls[0][0].subject).toContain("Recibimos tu reserva");
  });
});

describe("recordatorio de turno", () => {
  it("se envía cuando entra en la ventana de anticipación (60 min)", async () => {
    settings("biz-a", { reminderEnabled: true, reminderLeadMinutes: 60 });
    const a = appt("biz-a");
    expect(await sendDueReminders(at("2030-06-10T12:05:00Z"))).toEqual({ sent: 1, failed: 0 });
    expect(sendViaResend.mock.calls[0][0].subject).toContain("en 1 hora");
    expect(a.reminderEmailSentAt).not.toBeNull();
  });

  it("respeta la anticipación configurada: con 30 min todavía no, y sí más cerca", async () => {
    settings("biz-a", { reminderEnabled: true, reminderLeadMinutes: 30 });
    appt("biz-a");
    expect((await sendDueReminders(at("2030-06-10T12:05:00Z"))).sent).toBe(0);
    expect((await sendDueReminders(at("2030-06-10T12:40:00Z"))).sent).toBe(1);
  });

  it("no envía antes de tiempo ni cuando el turno ya empezó", async () => {
    settings("biz-a", { reminderEnabled: true });
    appt("biz-a");
    expect((await sendDueReminders(at("2030-06-10T11:00:00Z"))).sent).toBe(0);
    expect((await sendDueReminders(at("2030-06-10T13:30:00Z"))).sent).toBe(0);
  });

  it("es idempotente: dos barridos seguidos envían un solo recordatorio", async () => {
    settings("biz-a", { reminderEnabled: true });
    appt("biz-a");
    await sendDueReminders(at("2030-06-10T12:05:00Z"));
    await sendDueReminders(at("2030-06-10T12:15:00Z"));
    expect(sendViaResend).toHaveBeenCalledTimes(1);
  });

  it("un turno cancelado no recibe recordatorio", async () => {
    settings("biz-a", { reminderEnabled: true });
    appt("biz-a", { status: "cancelled" });
    expect((await sendDueReminders(at("2030-06-10T12:05:00Z"))).sent).toBe(0);
  });

  it("al reprogramar (reminderEmailSentAt = null y nuevo horario) se envía el recordatorio nuevo", async () => {
    settings("biz-a", { reminderEnabled: true });
    const a = appt("biz-a");
    await sendDueReminders(at("2030-06-10T12:05:00Z"));

    // Reprogramación (ver rescheduleAppointment): nuevo horario y marca limpia.
    Object.assign(a, { startTime: "16:00", reminderEmailSentAt: null });
    expect((await sendDueReminders(at("2030-06-10T12:20:00Z"))).sent).toBe(0); // aún lejos del nuevo horario
    expect((await sendDueReminders(at("2030-06-10T18:10:00Z"))).sent).toBe(1); // 15:10 AR: dentro de la hora previa a las 16:00
  });

  it("solo procesa negocios con el recordatorio activado y con email del cliente", async () => {
    settings("biz-a", { reminderEnabled: true });
    settings("biz-b", { reminderEnabled: false });
    appt("biz-a", { customerEmail: null });
    appt("biz-b");
    expect((await sendDueReminders(at("2030-06-10T12:05:00Z"))).sent).toBe(0);
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("cada email sale con los datos y el remitente de SU negocio", async () => {
    settings("biz-a", { reminderEnabled: true });
    settings("biz-b", { reminderEnabled: true });
    appt("biz-a", { customerEmail: "a@x.com", serviceName: "Corte A" });
    appt("biz-b", { customerEmail: "b@x.com", serviceName: "Corte B" });
    await sendDueReminders(at("2030-06-10T12:05:00Z"));

    const byTo = Object.fromEntries(sendViaResend.mock.calls.map(([m]) => [m.to, m]));
    expect(byTo["a@x.com"].fromName).toBe("Negocio A");
    expect(byTo["a@x.com"].html).toContain("Corte A");
    expect(byTo["a@x.com"].html).not.toContain("Corte B");
    expect(byTo["b@x.com"].fromName).toBe("Negocio B");
    expect(byTo["b@x.com"].replyTo).toBe("duenio-b@test.com");
  });
});

describe("resumen diario", () => {
  it("se envía al dueño a la hora configurada, solo con los turnos de su negocio", async () => {
    settings("biz-a", { dailySummaryEnabled: true, dailySummaryHour: 8 });
    appt("biz-a", { startTime: "09:00", customerName: "Ana" });
    appt("biz-a", { startTime: "15:00", customerName: "Beto" });
    appt("biz-b", { startTime: "10:00", customerName: "OtroNegocio" });
    appt("biz-a", { status: "cancelled", customerName: "Cancelado" });
    appt("biz-a", { date: "2030-06-11", customerName: "Mañana" });

    expect(await sendDailySummaries(at("2030-06-10T11:10:00Z"))).toEqual({ sent: 1, failed: 0 });
    const sent = sendViaResend.mock.calls[0][0];
    expect(sent.to).toBe("duena-a@test.com");
    expect(sent.html).toContain("2 turnos");
    expect(sent.html).toContain("Ana");
    expect(sent.html).toContain("Beto");
    for (const excluded of ["OtroNegocio", "Cancelado", "Mañana"]) expect(sent.html).not.toContain(excluded);
    expect(sent.idempotencyKey).toBe("daily-summary/biz-a/2030-06-10");
  });

  it("sin turnos igual envía el resumen", async () => {
    settings("biz-a", { dailySummaryEnabled: true });
    expect((await sendDailySummaries(at("2030-06-10T11:10:00Z"))).sent).toBe(1);
    expect(sendViaResend.mock.calls[0][0].html).toContain("No tenés turnos agendados para hoy");
  });

  it("es idempotente: una segunda corrida el mismo día no reenvía", async () => {
    settings("biz-a", { dailySummaryEnabled: true });
    await sendDailySummaries(at("2030-06-10T11:10:00Z"));
    await sendDailySummaries(at("2030-06-10T12:10:00Z"));
    expect(sendViaResend).toHaveBeenCalledTimes(1);
  });

  it("al día siguiente vuelve a enviar", async () => {
    settings("biz-a", { dailySummaryEnabled: true });
    await sendDailySummaries(at("2030-06-10T11:10:00Z"));
    await sendDailySummaries(at("2030-06-11T11:10:00Z"));
    expect(sendViaResend).toHaveBeenCalledTimes(2);
  });

  it("no envía antes de la hora configurada, con la opción apagada, ni pasada la ventana", async () => {
    settings("biz-a", { dailySummaryEnabled: true, dailySummaryHour: 8 });
    settings("biz-b", { dailySummaryEnabled: false, dailySummaryHour: 8 });
    expect((await sendDailySummaries(at("2030-06-10T09:00:00Z"))).sent).toBe(0); // 06:00 AR
    expect((await sendDailySummaries(at("2030-06-10T15:00:00Z"))).sent).toBe(0); // 12:00 AR
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("si el proveedor falla libera la marca para reintentar en la próxima corrida", async () => {
    settings("biz-a", { dailySummaryEnabled: true });
    sendViaResend.mockResolvedValueOnce({ ok: false, error: "boom" });
    expect(await sendDailySummaries(at("2030-06-10T11:10:00Z"))).toEqual({ sent: 0, failed: 1 });
    expect((await sendDailySummaries(at("2030-06-10T11:20:00Z"))).sent).toBe(1);
  });
});
