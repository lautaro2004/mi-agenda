import { describe, expect, it } from "vitest";

import { conversationRepository as repo } from "./repository";

const JID = "5491112345678@s.whatsapp.net";
const base = { id: JID, contactName: "Cliente", contactPhone: "+5491112345678" };
const msg = (id: string, text: string) => ({
  id,
  sender: "customer" as const,
  text,
  timestamp: new Date().toISOString(),
});

describe("conversationRepository — aislamiento por negocio + JID", () => {
  it("dos negocios con el mismo JID tienen conversaciones independientes", () => {
    repo.clear();
    const a = repo.ensureConversation({ ...base, businessId: "biz-a" });
    const b = repo.ensureConversation({ ...base, businessId: "biz-b" });

    expect(a.businessId).toBe("biz-a");
    expect(b.businessId).toBe("biz-b");
    expect(repo.get("biz-a", JID)?.businessId).toBe("biz-a");
    expect(repo.get("biz-b", JID)?.businessId).toBe("biz-b");
    expect(repo.list("biz-a")).toHaveLength(1);
    expect(repo.list("biz-b")).toHaveLength(1);
  });

  it("modificar la conversación de A no afecta la de B", () => {
    repo.clear();
    repo.ensureConversation({ ...base, businessId: "biz-a" });
    repo.ensureConversation({ ...base, businessId: "biz-b" });

    repo.addMessage("biz-a", JID, msg("m1", "hola"), true);
    repo.setManualMode("biz-a", JID, true);
    repo.setStatus("biz-a", JID, "closed");
    repo.toggleLabel("biz-a", JID, "human_required");

    const b = repo.get("biz-b", JID)!;
    expect(b.messages).toHaveLength(0);
    expect(b.unreadCount).toBe(0);
    expect(b.manualMode).toBe(false);
    expect(b.status).toBe("open");
    expect(b.labels).toEqual([]);

    repo.markRead("biz-b", JID);
    expect(repo.get("biz-a", JID)!.unreadCount).toBe(1);
  });

  it("un negocio no ve ni modifica una conversación que solo existe en otro", () => {
    repo.clear();
    repo.ensureConversation({ ...base, businessId: "biz-b" });

    expect(repo.get("biz-a", JID)).toBeUndefined();
    expect(repo.markRead("biz-a", JID)).toBeUndefined();
    expect(repo.setManualMode("biz-a", JID, true)).toBeUndefined();
    expect(repo.get("biz-b", JID)!.manualMode).toBe(false);
  });
});
