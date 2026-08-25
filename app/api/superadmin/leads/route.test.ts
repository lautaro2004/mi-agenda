import { describe, expect, it, vi, beforeEach } from "vitest";

const getSuperadminSession = vi.fn();
vi.mock("@/lib/auth/superadmin", () => ({
  getSuperadminSession: () => getSuperadminSession(),
}));

const listLeads = vi.fn();
const getLeadMetrics = vi.fn();
const getLeadDetail = vi.fn();
const updateLead = vi.fn();
vi.mock("@/modules/leads/service", () => ({
  listLeads: (...args: unknown[]) => listLeads(...args),
  getLeadMetrics: (...args: unknown[]) => getLeadMetrics(...args),
  getLeadDetail: (...args: unknown[]) => getLeadDetail(...args),
  updateLead: (...args: unknown[]) => updateLead(...args),
}));

const { GET: listRoute } = await import("./route");
const { GET: detailRoute, PATCH: patchRoute } = await import("./[id]/route");

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getSuperadminSession.mockReset();
  listLeads.mockReset();
  getLeadMetrics.mockReset();
  getLeadDetail.mockReset();
  updateLead.mockReset();
});

// 10/11 del pedido: "usuario normal no puede acceder" / "API de Superadmin
// protegida" — el mecanismo real es getSuperadminSession() devolviendo null
// (sesión inexistente O email fuera del allowlist, ver lib/auth/superadmin.ts,
// ya probado ahí); esto confirma que CADA ruta de /api/superadmin/leads lo
// respeta de forma independiente, nunca confiando en que el layout ya filtró.
describe("GET /api/superadmin/leads — protegido", () => {
  it("devuelve 403 sin sesión de superadmin", async () => {
    getSuperadminSession.mockResolvedValue(null);

    const response = await listRoute(new Request("http://localhost/api/superadmin/leads"));

    expect(response.status).toBe(403);
    expect(listLeads).not.toHaveBeenCalled();
    expect(getLeadMetrics).not.toHaveBeenCalled();
  });

  it("lista leads cuando SÍ hay sesión de superadmin", async () => {
    getSuperadminSession.mockResolvedValue({ userId: "u1", email: "admin@nexo.com", name: "Admin" });
    listLeads.mockResolvedValue([]);
    getLeadMetrics.mockResolvedValue({ newCount: 0, contactedCount: 0, meetingCount: 0, convertedCount: 0 });

    const response = await listRoute(new Request("http://localhost/api/superadmin/leads"));

    expect(response.status).toBe(200);
  });
});

describe("GET/PATCH /api/superadmin/leads/[id] — protegido", () => {
  it("GET devuelve 403 sin sesión de superadmin", async () => {
    getSuperadminSession.mockResolvedValue(null);

    const response = await detailRoute(new Request("http://localhost/api/superadmin/leads/lead_1"), makeParams("lead_1"));

    expect(response.status).toBe(403);
    expect(getLeadDetail).not.toHaveBeenCalled();
  });

  it("PATCH devuelve 403 sin sesión de superadmin — ni siquiera llega a validar el body", async () => {
    getSuperadminSession.mockResolvedValue(null);

    const response = await patchRoute(
      new Request("http://localhost/api/superadmin/leads/lead_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "CONTACTED" }),
      }),
      makeParams("lead_1")
    );

    expect(response.status).toBe(403);
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("PATCH funciona con sesión de superadmin válida", async () => {
    getSuperadminSession.mockResolvedValue({ userId: "u1", email: "admin@nexo.com", name: "Admin" });
    updateLead.mockResolvedValue({ id: "lead_1", status: "CONTACTED" });

    const response = await patchRoute(
      new Request("http://localhost/api/superadmin/leads/lead_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "CONTACTED" }),
      }),
      makeParams("lead_1")
    );

    expect(response.status).toBe(200);
    expect(updateLead).toHaveBeenCalledWith("lead_1", expect.objectContaining({ status: "CONTACTED" }));
  });
});
