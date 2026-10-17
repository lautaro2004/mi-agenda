import { describe, expect, it, vi, beforeEach } from "vitest";

const getSession = vi.fn();
const findFirst = vi.fn();
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth/auth", () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }));
vi.mock("@/lib/prisma", () => ({ prisma: { membership: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));

const { getCurrentBusinessId, hasRole } = await import("./current");

beforeEach(() => {
  getSession.mockReset();
  findFirst.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" } });
});

describe("getCurrentBusinessId — acceso por producto y rol", () => {
  it("solo resuelve membresías con acceso a Nexo", async () => {
    findFirst.mockResolvedValue({ businessId: "b1", role: "owner" });
    expect(await getCurrentBusinessId()).toBe("b1");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1", products: { has: "nexo" } } }));
  });

  it("un empleado solo-Nodo no resuelve negocio en Nexo", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getCurrentBusinessId()).toBeNull();
  });

  it("minRole: un miembro no puede configurar; un admin sí, pero no facturar", async () => {
    findFirst.mockResolvedValue({ businessId: "b1", role: "member" });
    expect(await getCurrentBusinessId({ minRole: "admin" })).toBeNull();
    expect(await getCurrentBusinessId()).toBe("b1");

    findFirst.mockResolvedValue({ businessId: "b1", role: "admin" });
    expect(await getCurrentBusinessId({ minRole: "admin" })).toBe("b1");
    expect(await getCurrentBusinessId({ minRole: "owner" })).toBeNull();
  });

  it("sin sesión → null", async () => {
    getSession.mockResolvedValue(null);
    expect(await getCurrentBusinessId()).toBeNull();
  });

  it("roles desconocidos se tratan como miembro", () => {
    expect(hasRole("raro", "admin")).toBe(false);
    expect(hasRole("raro", "member")).toBe(true);
  });
});
