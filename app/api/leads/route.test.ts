import { describe, expect, it, vi, beforeEach } from "vitest";

const createLead = vi.fn();
vi.mock("@/modules/leads/service", () => ({
  createLead: (...args: unknown[]) => createLead(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: () => false,
}));

const routeModule = await import("./route");

const VALID_BODY = {
  name: "Lautaro",
  businessName: "Barbería del Centro",
  whatsapp: "+54 9 11 5555-5555",
  email: "lautaro@example.com",
  industry: "Peluquería / Barbería",
  goals: ["more_bookings"],
  wantsMeeting: false,
};

function postRequest(body: unknown) {
  return new Request("http://localhost/api/leads", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  createLead.mockReset();
});

// 12. "no permitir modificar leads desde una API pública" — la ruta pública
// literalmente no tiene ningún handler de edición/borrado, solo alta.
describe("app/api/leads/route.ts — solo expone POST", () => {
  it("no exporta GET/PATCH/PUT/DELETE", () => {
    for (const method of ["GET", "PATCH", "PUT", "DELETE"]) {
      expect(method in routeModule).toBe(false);
    }
  });
});

describe("POST /api/leads", () => {
  it("crea el lead con un input válido", async () => {
    createLead.mockResolvedValue({ id: "lead_1" });

    const response = await routeModule.POST(postRequest(VALID_BODY));

    expect(response.status).toBe(200);
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ name: "Lautaro", wantsMeeting: false }));
  });

  it("rechaza datos inválidos con 400, sin crear el lead", async () => {
    const response = await routeModule.POST(postRequest({ ...VALID_BODY, email: "no-es-email" }));

    expect(response.status).toBe(400);
    expect(createLead).not.toHaveBeenCalled();
  });

  it("honeypot completado: responde éxito pero NO crea el lead (no le avisa al bot)", async () => {
    const response = await routeModule.POST(postRequest({ ...VALID_BODY, website: "http://spam.example" }));

    expect(response.status).toBe(200);
    expect(createLead).not.toHaveBeenCalled();
  });
});
