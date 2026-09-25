import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/business/slug", () => ({ getPublicBusinessIdBySlug: async () => "biz-a" }));
vi.mock("@/modules/business/service", () => ({ getBusinessState: async () => ({ schedule: [] }) }));
vi.mock("@/modules/appointments/service", () => ({
  getAvailableSlots: async () => [],
  getResourceAvailabilityForSlot: async () => [],
  createAppointment: vi.fn(),
}));
vi.mock("@/modules/payments/service", () => ({
  PaymentProofValidationError: class extends Error {},
  submitProofForAppointment: vi.fn(),
}));

const { GET: availability } = await import("./availability/route");
const { POST: book } = await import("./book/route");
const { POST: proof } = await import("./payment-proof/route");

const params = { params: Promise.resolve({ slug: "demo" }) };
const from = (ip: string) => ({ "x-forwarded-for": ip });

describe("rutas públicas — rate limit", () => {
  it("availability: 429 al superar 60 pedidos/min desde la misma IP, sin afectar a otra IP", async () => {
    const call = (ip: string) =>
      availability(new Request("http://t/x?date=2030-01-01", { headers: from(ip) }), params);
    for (let i = 0; i < 60; i++) expect((await call("10.0.0.1")).status).toBe(200);
    expect((await call("10.0.0.1")).status).toBe(429);
    expect((await call("10.0.0.2")).status).toBe(200);
  });

  it("book: 429 al superar 10 intentos/15min desde la misma IP", async () => {
    const call = () => book(new Request("http://t/x", { method: "POST", headers: from("10.0.1.1"), body: "{}" }), params);
    for (let i = 0; i < 10; i++) expect((await call()).status).toBe(400);
    expect((await call()).status).toBe(429);
  });

  it("payment-proof: 429 al superar 10 subidas/15min desde la misma IP", async () => {
    const call = () => proof(new Request("http://t/x", { method: "POST", headers: from("10.0.2.1"), body: new FormData() }), params);
    for (let i = 0; i < 10; i++) expect((await call()).status).toBe(400);
    expect((await call()).status).toBe(429);
  });
});
