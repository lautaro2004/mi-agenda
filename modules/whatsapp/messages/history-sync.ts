import type { WAMessage } from "baileys";

import type { ConversationLabel } from "@/lib/types";
import { classifyIntent } from "@/modules/ai/classifier";
import type { MessageIntent } from "@/modules/ai/types";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";

import { extractMessageText, formatPhoneFromJid } from "./sync";

const BUSINESS_INTENTS = new Set<MessageIntent>([
  "appointment",
  "pricing",
  "schedule",
  "location",
  "service",
  "human",
]);

const INTENT_TO_LABEL: Partial<Record<MessageIntent, ConversationLabel>> = {
  appointment: "appointment_request",
  pricing: "pricing",
  service: "service_inquiry",
  human: "human_required",
};

const CUTOFF_SECONDS = 24 * 3600;

function getMsgTimestamp(msg: WAMessage): number {
  return typeof msg.messageTimestamp === "number"
    ? msg.messageTimestamp
    : Number(msg.messageTimestamp ?? 0);
}

export function syncHistoricalMessages(businessId: string, messages: WAMessage[]): void {
  const cutoff = Date.now() / 1000 - CUTOFF_SECONDS;

  // Group recent messages by JID, skip groups and broadcasts
  const byJid = new Map<string, WAMessage[]>();
  for (const msg of messages) {
    const jid = msg.key.remoteJid;
    if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;
    if (!msg.message) continue;
    if (getMsgTimestamp(msg) < cutoff) continue;

    const arr = byJid.get(jid) ?? [];
    arr.push(msg);
    byJid.set(jid, arr);
  }

  for (const [jid, jidMessages] of byJid) {
    // Only import conversations where a customer message matches a business intent
    const detectedIntents = new Set<MessageIntent>();
    for (const msg of jidMessages) {
      if (msg.key.fromMe) continue;
      const text = extractMessageText(msg);
      if (!text) continue;
      const intent = classifyIntent(text);
      if (BUSINESS_INTENTS.has(intent)) detectedIntents.add(intent);
    }

    if (detectedIntents.size === 0) continue;

    const sorted = [...jidMessages].sort((a, b) => getMsgTimestamp(a) - getMsgTimestamp(b));

    const firstMsg = sorted[0];
    const conversation = conversationRepository.importConversation({
      id: jid,
      businessId,
      contactName: firstMsg.pushName || formatPhoneFromJid(jid),
      contactPhone: formatPhoneFromJid(jid),
    });

    for (const msg of sorted) {
      const text = extractMessageText(msg);
      if (!text) continue;
      const ts = getMsgTimestamp(msg);
      conversationRepository.addMessage(
        conversation.id,
        {
          id: msg.key.id || `${jid}-${ts}`,
          sender: msg.key.fromMe ? "business" : "customer",
          text,
          timestamp: new Date(ts * 1000).toISOString(),
        },
        false,
      );
    }

    for (const intent of detectedIntents) {
      const label = INTENT_TO_LABEL[intent];
      if (label && !conversation.labels.includes(label)) {
        conversationRepository.toggleLabel(jid, label);
      }
    }
  }
}
