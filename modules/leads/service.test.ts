import { describe, expect, it, vi, beforeEach } from "vitest";

const leadFindUnique = vi.fn();
const leadCreate = vi.fn();
const leadUpdate = vi.fn();
const leadCount = vi.fn();
const leadFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findUnique: (...args: unknown[]) => leadFindUnique(...args),
      create: (...args: unknown[]) => leadCreate(...args),
      update: (...args: unknown[]) => leadUpdate(...args),
      count: (...args: unknown[]) => leadCount(...args),
      findMany: (...args: unknown[]) => leadFindMany(...args),
    },
  },
}));

const { createLead, updateLead, getLeadMetrics } = await import("./service");

beforeEach(() => {
  leadFindUnique.mockReset();
  leadCreate.mockReset();
  leadUpdate.mockReset();
  leadCount.mockReset();
  leadFindMany.mockReset();
});

const BASE_INPUT = {
  name: "Lautaro",
  businessName: "Barbería del Centro",
  whatsapp: "+54 9 11 5555-5555",
  email: "lautaro@example.com",
  industry: "Peluquería / Barbería",
  goals: ["more_bookings" as const],
};

describe("createLead", () => {
  it("4. crea un lead sin reunión (wantsMeeting: false) con status NEW y el plan calculado", async () => {
    leadCreate.mockResolvedValue({ id: "lead_1" });

    await createLead({ ...BASE_INPUT, wantsMeeting: false });

    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ wantsMeeting: false, suggestedPlan: "gratis" }),
      })
    );
    // status nunca se pasa desde el input — el default "NEW" del schema
    // hace todo el trabajo, createLead ni lo toca.
    const call = leadCreate.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("status");
  });

  it("5. crea un lead solicitando reunión (wantsMeeting: true)", async () => {
    leadCreate.mockResolvedValue({ id: "lead_2" });

    await createLead({ ...BASE_INPUT, goals: ["automate_whatsapp"], wantsMeeting: true });

    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ wantsMeeting: true, suggestedPlan: "esencial" }),
      })
    );
  });

  it("12. el input público no tiene forma de setear notes/suggestedPlan/status a mano (garantía de tipos)", async () => {
    leadCreate.mockResolvedValue({ id: "lead_3" });

    // @ts-expect-error — CreateLeadInput no declara estos campos; si algún
    // día alguien los agrega sin querer, esto deja de compilar.
    await createLead({ ...BASE_INPUT, wantsMeeting: false, status: "CONVERTED", notes: "hackeado" });

    const call = leadCreate.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("status");
    expect(call.data).not.toHaveProperty("notes");
  });
});

describe("updateLead", () => {
  it("devuelve null si el lead no existe", async () => {
    leadFindUnique.mockResolvedValue(null);
    const result = await updateLead("no-existe", { notes: "x" });
    expect(result).toBeNull();
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("6. cambia el estado y setea contactedAt la primera vez que pasa a CONTACTED", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead_1", contactedAt: null, convertedAt: null });
    leadUpdate.mockResolvedValue({ id: "lead_1", status: "CONTACTED" });

    await updateLead("lead_1", { status: "CONTACTED" });

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CONTACTED", contactedAt: expect.any(Date) }) })
    );
  });

  it("no pisa contactedAt si el lead ya había sido contactado antes", async () => {
    const already = new Date("2026-01-01T00:00:00.000Z");
    leadFindUnique.mockResolvedValue({ id: "lead_1", contactedAt: already, convertedAt: null });
    leadUpdate.mockResolvedValue({ id: "lead_1" });

    await updateLead("lead_1", { status: "CONTACTED" });

    const call = leadUpdate.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("contactedAt");
  });

  it("7. guarda notas internas", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead_1", contactedAt: null, convertedAt: null });
    leadUpdate.mockResolvedValue({ id: "lead_1", notes: "Cliente interesado, llamar el lunes" });

    await updateLead("lead_1", { notes: "Cliente interesado, llamar el lunes" });

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notes: "Cliente interesado, llamar el lunes" } })
    );
  });

  it("8. guarda la fecha de reunión y mueve el estado a MEETING", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead_1", contactedAt: null, convertedAt: null });
    leadUpdate.mockResolvedValue({ id: "lead_1", status: "MEETING" });

    const meetingAt = new Date("2026-08-28T15:00:00.000Z");
    await updateLead("lead_1", { meetingAt });

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ meetingAt, status: "MEETING" }) })
    );
  });

  it("no fuerza MEETING si el caller ya pidió otro status explícito junto con la fecha", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead_1", contactedAt: null, convertedAt: null });
    leadUpdate.mockResolvedValue({ id: "lead_1" });

    const meetingAt = new Date("2026-08-28T15:00:00.000Z");
    await updateLead("lead_1", { meetingAt, status: "PROPOSAL" });

    expect(leadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PROPOSAL" }) }));
  });

  it("9. marca convertido y setea convertedAt la primera vez", async () => {
    leadFindUnique.mockResolvedValue({ id: "lead_1", contactedAt: new Date(), convertedAt: null });
    leadUpdate.mockResolvedValue({ id: "lead_1", status: "CONVERTED" });

    await updateLead("lead_1", { status: "CONVERTED", convertedBusinessId: "biz_1" });

    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONVERTED", convertedAt: expect.any(Date), convertedBusinessId: "biz_1" }),
      })
    );
  });
});

describe("getLeadMetrics", () => {
  it("cuenta cada estado del tablero por separado", async () => {
    leadCount.mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(4);

    const metrics = await getLeadMetrics();

    expect(metrics).toEqual({ newCount: 3, contactedCount: 2, meetingCount: 1, convertedCount: 4 });
  });
});
