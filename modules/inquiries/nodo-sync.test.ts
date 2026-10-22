import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const update = vi.fn().mockResolvedValue({});
vi.mock("@/lib/prisma", () => ({ prisma: { inquiry: { update: (...a: unknown[]) => update(...a) } } }));

const { syncInquiryToNodo } = await import("./nodo-sync");

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.NODO_URL = "https://crm.example.com/";
  process.env.NEXO_NODO_SYNC_SECRET = "s3cret";
});
afterEach(() => {
  delete process.env.NODO_URL;
  delete process.env.NEXO_NODO_SYNC_SECRET;
  vi.unstubAllGlobals();
});

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

describe("syncInquiryToNodo", () => {
  it("sin configuración no llama a nada", async () => {
    delete process.env.NODO_URL;
    expect(await syncInquiryToNodo("biz_1", "inq_1")).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía solo ids (Nodo lee la consulta) y guarda el lead creado", async () => {
    fetchMock.mockResolvedValue(reply(200, { outcome: "created", leadId: "lead_1" }));
    expect(await syncInquiryToNodo("biz_1", "inq_1")).toBe("synced");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://crm.example.com/api/internal/nexo-inquiry");
    expect(JSON.parse(init.body)).toEqual({ businessId: "biz_1", inquiryId: "inq_1" });
    expect(init.headers.authorization).toBe("Bearer s3cret");
    expect(update.mock.calls[0][0].data).toMatchObject({ nodoLeadId: "lead_1", nodoSyncError: null });
  });

  it("negocio sin Nodo: no marca nada", async () => {
    fetchMock.mockResolvedValue(reply(200, { outcome: "no_workspace" }));
    expect(await syncInquiryToNodo("biz_1", "inq_1")).toBe("no_workspace");
    expect(update).not.toHaveBeenCalled();
  });

  it("errores de red o de Nodo quedan registrados sin lanzar", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await syncInquiryToNodo("biz_1", "inq_1")).toBe("error");
    expect(update.mock.calls[0][0].data).toEqual({ nodoSyncError: "No se pudo contactar a Nodo" });

    fetchMock.mockResolvedValue(reply(401, { error: "No autorizado." }));
    expect(await syncInquiryToNodo("biz_1", "inq_1")).toBe("error");
    expect(update.mock.calls[1][0].data.nodoSyncError).toBe("Nodo respondió 401: No autorizado.");
  });
});
