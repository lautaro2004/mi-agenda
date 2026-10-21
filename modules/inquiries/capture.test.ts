import { beforeEach, describe, expect, it, vi } from "vitest";

const inquiry = { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { inquiry, $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));
const notifyInquiryReceived = vi.fn();
vi.mock("@/modules/notifications/service", () => ({ notifyInquiryReceived: (...a: unknown[]) => notifyInquiryReceived(...a) }));
const syncInquiryToNodo = vi.fn();
vi.mock("@/modules/inquiries/nodo-sync", () => ({ syncInquiryToNodo: (...a: unknown[]) => syncInquiryToNodo(...a) }));

const { captureLead, phoneKey } = await import("./capture");

const input = {
  businessId: "biz_1",
  channel: "whatsapp" as const,
  conversationRef: "5491155550000@s.whatsapp.net",
  name: "Ana",
  phone: "+5491155550000",
  need: "Presupuesto de coloración",
  summary: "Pregunta por coloración para el sábado",
};

beforeEach(() => {
  vi.clearAllMocks();
  inquiry.findFirst.mockResolvedValue(null);
  queryRaw.mockResolvedValue([]);
  syncInquiryToNodo.mockResolvedValue("not_configured");
});

describe("captureLead", () => {
  it("crea el interesado, notifica al dueño y lo envía a Nodo", async () => {
    inquiry.create.mockResolvedValue({ id: "inq_1" });
    const r = await captureLead(input);
    expect(r).toEqual({ ok: true, inquiryId: "inq_1", created: true, nodo: "not_configured" });
    expect(inquiry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ businessId: "biz_1", channel: "whatsapp", customerEmail: "", need: input.need, summary: input.summary }),
    });
    expect(notifyInquiryReceived).toHaveBeenCalledWith(expect.objectContaining({ channel: "whatsapp" }));
    expect(syncInquiryToNodo).toHaveBeenCalledWith("biz_1", "inq_1");
  });

  it("no duplica: actualiza el interesado abierto de la misma conversación sin pisar datos", async () => {
    inquiry.findFirst.mockResolvedValue({ id: "inq_1", customerEmail: "ana@mail.com", conversationRef: input.conversationRef });
    const r = await captureLead({ ...input, email: "otro@mail.com", need: "Coloración y corte" });
    expect(r).toMatchObject({ ok: true, inquiryId: "inq_1", created: false });
    expect(inquiry.create).not.toHaveBeenCalled();
    const data = inquiry.update.mock.calls[0][0].data;
    expect(data.need).toBe("Coloración y corte");
    expect(data.customerEmail).toBeUndefined();
    expect(notifyInquiryReceived).not.toHaveBeenCalled();
  });

  it("no duplica por teléfono aunque cambie la conversación", async () => {
    queryRaw.mockResolvedValue([{ id: "inq_9" }]);
    inquiry.findUnique.mockResolvedValue({ id: "inq_9", customerEmail: "", conversationRef: null });
    const r = await captureLead(input);
    expect(r).toMatchObject({ ok: true, inquiryId: "inq_9", created: false });
    expect(inquiry.update.mock.calls[0][0].data.conversationRef).toBe(input.conversationRef);
  });

  it("rechaza datos incompletos sin escribir", async () => {
    const r = await captureLead({ ...input, name: "", need: "" });
    expect(r).toEqual({ ok: false, reason: "invalid", message: "Faltan datos: nombre, necesidad" });
    expect(inquiry.create).not.toHaveBeenCalled();
  });

  it("si la base falla devuelve ok:false (el asistente no confirma nada)", async () => {
    inquiry.create.mockRejectedValue(new Error("db down"));
    const r = await captureLead(input);
    expect(r).toEqual({ ok: false, reason: "error", message: "No se pudo guardar el registro" });
    expect(syncInquiryToNodo).not.toHaveBeenCalled();
  });

  it("compara teléfonos por los últimos 10 dígitos", () => {
    expect(phoneKey("+54 9 11 5555-0000")).toBe(phoneKey("5491155550000"));
  });
});
