import path from "node:path";

import { useMultiFileAuthState as loadMultiFileAuthState } from "baileys";

import { getSessionsDir } from "./dir";
import type { WhatsAppSession, WhatsAppConnectionStatus } from "@/lib/types";


export function getAuthState(businessId: string) {
  const dir = path.join(getSessionsDir(), businessId);
  return loadMultiFileAuthState(dir);
}

class SessionRepository {
  private sessions = new Map<string, WhatsAppSession>();

  get(businessId: string): WhatsAppSession {
    const existing = this.sessions.get(businessId);
    if (existing) return existing;

    const created: WhatsAppSession = {
      id: businessId,
      businessId,
      status: "disconnected",
      phoneNumber: null,
      connectedAt: null,
      lastDisconnectedAt: null,
      lastError: null,
    };
    this.sessions.set(businessId, created);
    return created;
  }

  update(businessId: string, patch: Partial<Omit<WhatsAppSession, "id" | "businessId">>): WhatsAppSession {
    const current = this.get(businessId);
    const updated: WhatsAppSession = { ...current, ...patch };
    this.sessions.set(businessId, updated);
    return updated;
  }

  setStatus(businessId: string, status: WhatsAppConnectionStatus) {
    return this.update(businessId, { status });
  }
}

declare global {
  var __whatsappSessionRepository: SessionRepository | undefined;
}

export const sessionRepository = globalThis.__whatsappSessionRepository ?? new SessionRepository();
globalThis.__whatsappSessionRepository = sessionRepository;
