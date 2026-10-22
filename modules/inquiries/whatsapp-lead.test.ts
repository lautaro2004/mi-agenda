import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const businessFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    inquiry: { findFirst: (...a: unknown[]) => findFirst(...a) },
    business: { findUnique: (...a: unknown[]) => businessFindUnique(...a) },
  },
}));

const createInquiry = vi.fn();
vi.mock("@/modules/inquiries/service", () => ({
  createInquiry: (...a: unknown[]) => createInquiry(...a),
}));

const { captureWhatsappLead, isMeaningfulLeadMessage } = await import("./whatsapp-lead");

const BASE = { businessId: "biz_1", contactName: "Juan", contactPhone: "+5491112345678" };

beforeEach(() => {
  findFirst.mockReset();
  createInquiry.mockReset();
  findFirst.mockResolvedValue(null);
  createInquiry.mockResolvedValue({ id: "inq_1" });
  businessFindUnique.mockReset().mockResolvedValue({ leadQualificationEnabled: false, leadIdealProfile: null });
});

describe("isMeaningfulLeadMessage", () => {
  it.each(["hola", "Buenas!", "ok", "👍", "[Sticker]", "[Audio]", "  ", "si"])("ignora '%s'", (text) => {
    expect(isMeaningfulLeadMessage(text)).toBe(false);
  });

  it.each(["Hola, quiero sumar mi pizzería a Rappi", "cuánto sale?", "Tengo un local en Palermo"])(
    "acepta '%s'",
    (text) => {
      expect(isMeaningfulLeadMessage(text)).toBe(true);
    }
  );
});

describe("captureWhatsappLead", () => {
  it("crea una consulta de WhatsApp para un contacto nuevo con mensaje real", async () => {
    const result = await captureWhatsappLead({ ...BASE, text: "Quiero info para sumar mi local" });

    expect(result).toBe("created");
    expect(createInquiry).toHaveBeenCalledWith({
      businessId: "biz_1",
      customerName: "Juan",
      customerWhatsapp: "+5491112345678",
      customerEmail: null,
      message: "Quiero info para sumar mi local",
      source: "whatsapp",
    });
  });

  it("con la calificación activa, la consulta nace pending (Nodo la espera)", async () => {
    businessFindUnique.mockResolvedValue({ leadQualificationEnabled: true, leadIdealProfile: "Locales de CABA" });
    await captureWhatsappLead({ ...BASE, text: "Quiero info" });
    expect(createInquiry.mock.calls[0][0]).toMatchObject({ source: "whatsapp", qualificationStatus: "pending" });
  });

  it("activada pero sin descripción del lead ideal, no califica", async () => {
    businessFindUnique.mockResolvedValue({ leadQualificationEnabled: true, leadIdealProfile: "  " });
    await captureWhatsappLead({ ...BASE, text: "Quiero info" });
    expect(createInquiry.mock.calls[0][0]).not.toHaveProperty("qualificationStatus");
  });

  it("no crea nada con un saludo suelto", async () => {
    expect(await captureWhatsappLead({ ...BASE, text: "hola" })).toBe("skipped");
    expect(findFirst).not.toHaveBeenCalled();
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("no duplica si el número ya generó una consulta de WhatsApp en la ventana", async () => {
    findFirst.mockResolvedValue({ id: "inq_prev" });
    expect(await captureWhatsappLead({ ...BASE, text: "sigo interesado, cuánto sale?" })).toBe("skipped");
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("busca duplicados scopeado por negocio, número y origen whatsapp", async () => {
    await captureWhatsappLead({ ...BASE, text: "Quiero info" });
    const where = findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ businessId: "biz_1", customerWhatsapp: "+5491112345678", source: "whatsapp" });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("usa el teléfono como nombre si el contacto no tiene nombre", async () => {
    await captureWhatsappLead({ ...BASE, contactName: "", text: "Quiero info" });
    expect(createInquiry.mock.calls[0][0].customerName).toBe("+5491112345678");
  });

  it("no hace nada sin teléfono", async () => {
    expect(await captureWhatsappLead({ ...BASE, contactPhone: "", text: "Quiero info" })).toBe("skipped");
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("dos mensajes simultáneos del mismo número crean una sola consulta", async () => {
    let release: (v: null) => void = () => {};
    findFirst.mockReturnValueOnce(new Promise((r) => (release = r)));
    const first = captureWhatsappLead({ ...BASE, text: "Quiero info" });
    const second = await captureWhatsappLead({ ...BASE, text: "Tengo una pizzería" });
    release(null);
    expect(second).toBe("skipped");
    expect(await first).toBe("created");
    expect(createInquiry).toHaveBeenCalledTimes(1);
  });
});
