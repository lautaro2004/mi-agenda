import { describe, expect, it, vi, beforeEach } from "vitest";

const create = vi.fn();
const findMany = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    inquiry: {
      create: (...a: unknown[]) => create(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));

const notifyInquiryReceived = vi.fn();
vi.mock("@/modules/notifications/service", () => ({
  notifyInquiryReceived: (...a: unknown[]) => notifyInquiryReceived(...a),
}));

const { createInquiry, listInquiries, updateInquiryStatus } = await import("./service");

beforeEach(() => {
  create.mockReset();
  findMany.mockReset();
  updateMany.mockReset();
  notifyInquiryReceived.mockReset();
});

describe("createInquiry", () => {
  it("guarda la consulta asociada al businessId y notifica al dueño", async () => {
    create.mockResolvedValue({ id: "inq_1", businessId: "biz_1", customerName: "Ana" });

    await createInquiry({
      businessId: "biz_1",
      customerName: "Ana",
      customerWhatsapp: "+54 9 11 5555-5555",
      customerEmail: "ana@example.com",
      message: "¿Tienen turnos el sábado?",
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ businessId: "biz_1", customerName: "Ana", message: "¿Tienen turnos el sábado?" }),
    });
    expect(notifyInquiryReceived).toHaveBeenCalledWith({ businessId: "biz_1", inquiryId: "inq_1", customerName: "Ana" });
  });
});

describe("listInquiries", () => {
  it("filtra siempre por businessId, más recientes primero", async () => {
    findMany.mockResolvedValue([]);
    await listInquiries("biz_1");
    expect(findMany).toHaveBeenCalledWith({ where: { businessId: "biz_1" }, orderBy: { createdAt: "desc" } });
  });
});

describe("updateInquiryStatus", () => {
  it("scopea el update por businessId y devuelve true si actualizó", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await expect(updateInquiryStatus("biz_1", "inq_1", "RESOLVED")).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "inq_1", businessId: "biz_1" }, data: { status: "RESOLVED" } });
  });

  it("devuelve false si la consulta es de otro negocio o no existe", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(updateInquiryStatus("biz_1", "inq_ajena", "RESOLVED")).resolves.toBe(false);
  });
});
