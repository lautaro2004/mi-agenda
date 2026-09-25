import { describe, expect, it, vi, beforeEach } from "vitest";

const getCurrentBusinessId = vi.fn();
vi.mock("@/modules/business/current", () => ({
  getCurrentBusinessId: () => getCurrentBusinessId(),
}));

const { conversationRepository: repo } = await import("@/modules/whatsapp/conversations/repository");
const { GET, PATCH } = await import("./route");
const { POST: markRead } = await import("./read/route");

const JID = "5491112345678@s.whatsapp.net";
const params = { params: Promise.resolve({ id: encodeURIComponent(JID) }) };
const patchReq = (body: unknown) => new Request("http://test", { method: "PATCH", body: JSON.stringify(body) });
const req = () => new Request("http://test");
const msg = (id: string, text: string) => ({
  id,
  sender: "customer" as const,
  text,
  timestamp: new Date().toISOString(),
});

beforeEach(() => {
  getCurrentBusinessId.mockReset();
  repo.clear();
});

describe("/api/whatsapp/conversations/[id] — aislamiento por negocio", () => {
  it("sin sesión: 401 en GET, PATCH y read", async () => {
    getCurrentBusinessId.mockResolvedValue(null);
    expect((await GET(req(), params)).status).toBe(401);
    expect((await PATCH(patchReq({ manualMode: true }), params)).status).toBe(401);
    expect((await markRead(req(), params)).status).toBe(401);
  });

  it("el negocio A accede a su propia conversación", async () => {
    repo.ensureConversation({ id: JID, businessId: "biz-a", contactName: "Cliente", contactPhone: "+54911" });
    getCurrentBusinessId.mockResolvedValue("biz-a");
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    expect((await res.json()).conversation.businessId).toBe("biz-a");
  });

  it("el negocio A recibe 404 (GET/PATCH/read) sobre una conversación del negocio B, sin modificarla", async () => {
    repo.ensureConversation({ id: JID, businessId: "biz-b", contactName: "Cliente", contactPhone: "+54911" });
    repo.addMessage("biz-b", JID, msg("m1", "hola"), true);
    getCurrentBusinessId.mockResolvedValue("biz-a");

    expect((await GET(req(), params)).status).toBe(404);
    expect((await PATCH(patchReq({ manualMode: true, toggleLabel: "human_required" }), params)).status).toBe(404);
    expect((await markRead(req(), params)).status).toBe(404);

    const b = repo.get("biz-b", JID)!;
    expect(b.manualMode).toBe(false);
    expect(b.labels).toEqual([]);
    expect(b.unreadCount).toBe(1);
  });

  it("con el mismo JID en ambos negocios, PATCH/read de A no afecta a B", async () => {
    repo.ensureConversation({ id: JID, businessId: "biz-a", contactName: "Cliente", contactPhone: "+54911" });
    repo.ensureConversation({ id: JID, businessId: "biz-b", contactName: "Cliente", contactPhone: "+54911" });
    repo.addMessage("biz-a", JID, msg("m1", "a"), true);
    repo.addMessage("biz-b", JID, msg("m2", "b"), true);
    getCurrentBusinessId.mockResolvedValue("biz-a");

    expect((await PATCH(patchReq({ manualMode: true }), params)).status).toBe(200);
    expect((await markRead(req(), params)).status).toBe(200);

    expect(repo.get("biz-a", JID)).toMatchObject({ manualMode: true, unreadCount: 0 });
    expect(repo.get("biz-b", JID)).toMatchObject({ manualMode: false, unreadCount: 1 });
  });
});
