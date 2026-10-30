import { beforeEach, describe, expect, it, vi } from "vitest";

// Persistencia de leads con campaña de origen. Usa vitest (mocks de Prisma).
const inquiry = { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { inquiry, $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));
const notifyInquiryReceived = vi.fn();
vi.mock("@/modules/notifications/service", () => ({ notifyInquiryReceived: (...a: unknown[]) => notifyInquiryReceived(...a) }));
const syncInquiryToNodo = vi.fn();
vi.mock("@/modules/inquiries/nodo-sync", () => ({ syncInquiryToNodo: (...a: unknown[]) => syncInquiryToNodo(...a) }));
const isLeadQualificationActive = vi.fn();
vi.mock("@/modules/inquiries/qualification", () => ({ isLeadQualificationActive: (...a: unknown[]) => isLeadQualificationActive(...a) }));

const { captureLead } = await import("./capture");

const campaign = { id: "camp_1", name: "Desarrollo web", method: "prefilled_message", requestKind: "proposal" as const, data: { company: "Resto Sol" }, initialStatus: "NEW" as const };
const input = {
  businessId: "biz_1",
  channel: "whatsapp" as const,
  conversationRef: "5491155550000@s.whatsapp.net",
  name: "Ana",
  phone: "+5491155550000",
  email: "ana@mail.com",
  need: "Una web para mi restaurante",
  campaign,
};

beforeEach(() => {
  vi.clearAllMocks();
  inquiry.findFirst.mockResolvedValue(null);
  queryRaw.mockResolvedValue([]);
  syncInquiryToNodo.mockResolvedValue("synced");
  isLeadQualificationActive.mockResolvedValue(false);
});

describe("captureLead con campaña", () => {
  it("12/14. crea el lead guardando campaña, método, tipo, datos y conversación", async () => {
    inquiry.create.mockResolvedValue({ id: "inq_1" });
    const r = await captureLead(input);
    expect(r).toMatchObject({ ok: true, inquiryId: "inq_1", created: true });
    expect(inquiry.create.mock.calls[0][0].data).toMatchObject({
      campaignId: "camp_1",
      campaignName: "Desarrollo web",
      attributionMethod: "prefilled_message",
      requestKind: "proposal",
      campaignData: { company: "Resto Sol" },
      conversationRef: input.conversationRef,
      status: "NEW",
    });
  });

  it("13. un lead existente se actualiza sin duplicarse ni cambiar su campaña de origen", async () => {
    inquiry.findFirst.mockResolvedValue({ id: "inq_1", customerEmail: "", conversationRef: input.conversationRef, campaignId: "camp_viejo", requestKind: "lead" });
    const r = await captureLead(input);
    expect(r).toMatchObject({ ok: true, inquiryId: "inq_1", created: false });
    expect(inquiry.create).not.toHaveBeenCalled();
    const data = inquiry.update.mock.calls[0][0].data;
    expect(data.campaignId).toBeUndefined(); // no se pisa
    expect(data.requestKind).toBe("proposal"); // "propuesta" gana sobre "lead"
  });

  it("15. sincroniza con Nodo", async () => {
    inquiry.create.mockResolvedValue({ id: "inq_1" });
    await captureLead(input);
    expect(syncInquiryToNodo).toHaveBeenCalledWith("biz_1", "inq_1");
  });

  it("16. si Nodo falla, el lead queda guardado en Nexo", async () => {
    inquiry.create.mockResolvedValue({ id: "inq_1" });
    syncInquiryToNodo.mockResolvedValue("error");
    const r = await captureLead(input);
    expect(r).toEqual({ ok: true, inquiryId: "inq_1", created: true, nodo: "error" });
    expect(inquiry.create).toHaveBeenCalledTimes(1);
  });

  it("17. reintentar la sincronización no crea otro lead (se reutiliza el abierto)", async () => {
    inquiry.create.mockResolvedValueOnce({ id: "inq_1" });
    await captureLead(input);
    inquiry.findFirst.mockResolvedValue({ id: "inq_1", customerEmail: "ana@mail.com", conversationRef: input.conversationRef, campaignId: "camp_1", requestKind: "proposal" });
    const retry = await captureLead(input);
    expect(retry).toMatchObject({ created: false, inquiryId: "inq_1" });
    expect(inquiry.create).toHaveBeenCalledTimes(1);
    expect(notifyInquiryReceived).toHaveBeenCalledTimes(1);
  });

  it("si la campaña desactiva Nodo no se envía", async () => {
    inquiry.create.mockResolvedValue({ id: "inq_1" });
    const r = await captureLead({ ...input, campaign: { ...campaign, syncNodo: false } });
    expect(r).toMatchObject({ ok: true, nodo: "not_configured" });
    expect(syncInquiryToNodo).not.toHaveBeenCalled();
  });
});
