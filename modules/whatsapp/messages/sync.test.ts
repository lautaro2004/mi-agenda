import { describe, expect, it } from "vitest";
import type { WAMessage } from "baileys";


import { fallbackContactName, formatPhoneFromJid, isLidJid, resolvePhoneJid } from "./sync";

const msg = (key: Record<string, unknown>) => ({ key }) as unknown as WAMessage;

describe("teléfono de contactos de WhatsApp", () => {
  it("un LID no se muestra como si fuera un teléfono", () => {
    expect(isLidJid("128969311527129@lid")).toBe(true);
    expect(formatPhoneFromJid("128969311527129@lid")).toBe("");
    expect(fallbackContactName("128969311527129@lid")).toBe("Contacto de WhatsApp");
  });

  it("un JID de teléfono se formatea normal", () => {
    expect(formatPhoneFromJid("5491155551234@s.whatsapp.net")).toBe("+5491155551234");
    expect(fallbackContactName("5491155551234@s.whatsapp.net")).toBe("+5491155551234");
  });

  it("usa remoteJidAlt cuando WhatsApp informa el teléfono real", async () => {
    const m = msg({ remoteJid: "128969311527129@lid", remoteJidAlt: "5491155551234@s.whatsapp.net" });
    await resolvePhoneJid(m);
    expect(m.key.remoteJid).toBe("5491155551234@s.whatsapp.net");
  });

  it("si no hay Alt, consulta el mapeo LID→teléfono", async () => {
    const m = msg({ remoteJid: "128969311527129@lid" });
    await resolvePhoneJid(m, async () => "5491122223333@s.whatsapp.net");
    expect(m.key.remoteJid).toBe("5491122223333@s.whatsapp.net");
  });

  it("sin forma de resolverlo (o si el mapeo falla) queda el LID, sin romper", async () => {
    const a = msg({ remoteJid: "1@lid" });
    await resolvePhoneJid(a, async () => null);
    expect(a.key.remoteJid).toBe("1@lid");
    const b = msg({ remoteJid: "2@lid" });
    await resolvePhoneJid(b, async () => {
      throw new Error("boom");
    });
    expect(b.key.remoteJid).toBe("2@lid");
  });

  it("no toca chats normales", async () => {
    const m = msg({ remoteJid: "5491155551234@s.whatsapp.net" });
    await resolvePhoneJid(m, async () => "otro@s.whatsapp.net");
    expect(m.key.remoteJid).toBe("5491155551234@s.whatsapp.net");
  });
});
