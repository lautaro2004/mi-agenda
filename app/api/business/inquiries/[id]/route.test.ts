import { describe, expect, it, vi, beforeEach } from "vitest";

const getCurrentBusinessId = vi.fn();
vi.mock("@/modules/business/current", () => ({
  getCurrentBusinessId: () => getCurrentBusinessId(),
}));

const updateInquiryStatus = vi.fn();
vi.mock("@/modules/inquiries/service", () => ({
  updateInquiryStatus: (...a: unknown[]) => updateInquiryStatus(...a),
}));

const { PATCH } = await import("./route");

function call(body: unknown) {
  return PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "inq_1" }),
  });
}

beforeEach(() => {
  getCurrentBusinessId.mockReset().mockResolvedValue("biz_1");
  updateInquiryStatus.mockReset().mockResolvedValue(true);
});

describe("PATCH /api/business/inquiries/[id]", () => {
  it("401 sin sesión", async () => {
    getCurrentBusinessId.mockResolvedValue(null);
    expect((await call({ status: "RESOLVED" })).status).toBe(401);
    expect(updateInquiryStatus).not.toHaveBeenCalled();
  });

  it("400 con un estado fuera de NEW/IN_PROGRESS/RESOLVED", async () => {
    expect((await call({ status: "DONE" })).status).toBe(400);
  });

  it("404 si la consulta no es del negocio", async () => {
    updateInquiryStatus.mockResolvedValue(false);
    expect((await call({ status: "RESOLVED" })).status).toBe(404);
  });

  it("actualiza scopeado al businessId de la sesión", async () => {
    expect((await call({ status: "IN_PROGRESS" })).status).toBe(200);
    expect(updateInquiryStatus).toHaveBeenCalledWith("biz_1", "inq_1", "IN_PROGRESS");
  });
});
