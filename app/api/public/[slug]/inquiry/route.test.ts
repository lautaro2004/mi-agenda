import { describe, expect, it, vi, beforeEach } from "vitest";

const getPublicBusinessIdBySlug = vi.fn();
vi.mock("@/modules/business/slug", () => ({
  getPublicBusinessIdBySlug: (...a: unknown[]) => getPublicBusinessIdBySlug(...a),
}));

const createInquiry = vi.fn();
vi.mock("@/modules/inquiries/service", () => ({
  createInquiry: (...a: unknown[]) => createInquiry(...a),
}));

const isRateLimited = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: (...a: unknown[]) => isRateLimited(...a),
}));

const { POST } = await import("./route");

const VALID_BODY = {
  customerName: "Ana Pérez",
  customerWhatsapp: "+54 9 11 5555-5555",
  customerEmail: "ana@example.com",
  message: "¿Tienen turnos el sábado?",
};

function call(body: unknown) {
  return POST(new Request("http://localhost/api/public/mi-negocio/inquiry", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ slug: "mi-negocio" }),
  });
}

beforeEach(() => {
  getPublicBusinessIdBySlug.mockReset().mockResolvedValue("biz_1");
  createInquiry.mockReset().mockResolvedValue({ id: "inq_1" });
  isRateLimited.mockReset().mockReturnValue(false);
});

describe("POST /api/public/[slug]/inquiry", () => {
  it("404 si el slug no existe, sin crear nada", async () => {
    getPublicBusinessIdBySlug.mockResolvedValue(null);
    expect((await call(VALID_BODY)).status).toBe(404);
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("crea la consulta con el businessId del slug, no del body", async () => {
    const res = await call({ ...VALID_BODY, businessId: "biz_ajeno" });
    expect(res.status).toBe(201);
    expect(createInquiry).toHaveBeenCalledWith({ businessId: "biz_1", ...VALID_BODY });
  });

  it("400 si el body es inválido", async () => {
    expect((await call({ ...VALID_BODY, customerEmail: "no-es-email" })).status).toBe(400);
    expect((await call({ ...VALID_BODY, message: "" })).status).toBe(400);
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("honeypot completado: responde éxito pero NO crea nada", async () => {
    const res = await call({ ...VALID_BODY, website: "http://spam.example" });
    expect(res.status).toBe(201);
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("429 si supera el rate limit", async () => {
    isRateLimited.mockReturnValue(true);
    expect((await call(VALID_BODY)).status).toBe(429);
    expect(createInquiry).not.toHaveBeenCalled();
  });

  it("solo expone POST (nada de listar/editar desde la API pública)", async () => {
    const mod = await import("./route");
    for (const method of ["GET", "PATCH", "PUT", "DELETE"]) expect(method in mod).toBe(false);
  });
});
