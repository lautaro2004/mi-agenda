import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationMessage } from "@/lib/types";

const businessFindUnique = vi.fn();
const businessUpdate = vi.fn();
const inquiryFindFirst = vi.fn();
const inquiryUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: {
      findUnique: (...a: unknown[]) => businessFindUnique(...a),
      update: (...a: unknown[]) => businessUpdate(...a),
    },
    inquiry: {
      findFirst: (...a: unknown[]) => inquiryFindFirst(...a),
      updateMany: (...a: unknown[]) => inquiryUpdateMany(...a),
    },
  },
}));

const generateResponse = vi.fn();
const getAIProvider = vi.fn();
vi.mock("@/modules/ai/providers", () => ({
  getAIProvider: (...a: unknown[]) => getAIProvider(...a),
}));

const syncInquiryToNodo = vi.fn();
vi.mock("@/modules/inquiries/nodo-sync", () => ({
  syncInquiryToNodo: (...a: unknown[]) => syncInquiryToNodo(...a),
}));

const {
  buildTranscript,
  parseQualificationResponse,
  qualifyPendingInquiry,
  scheduleLeadQualification,
  updateLeadQualificationSettings,
  MAX_ATTEMPTS_PER_INQUIRY,
  QUIET_MS,
} = await import("./qualification");

const PROFILE = "Locales gastronómicos de CABA y GBA que todavía no están en Rappi";

function msg(sender: "customer" | "business" | "ai", text: string): ConversationMessage {
  return { id: `${sender}-${text}`, sender, text, timestamp: "2026-10-22T12:00:00Z" } as ConversationMessage;
}

const CHAT = [msg("customer", "Hola, tengo una pizzería en Caballito"), msg("business", "¿Ya estás en Rappi?"), msg("customer", "No, nunca")];

let inquiryCounter = 0;

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  businessFindUnique.mockReset();
  businessUpdate.mockReset();
  inquiryFindFirst.mockReset();
  inquiryUpdateMany.mockReset();
  generateResponse.mockReset();
  getAIProvider.mockReset().mockReturnValue({ generateResponse: (...a: unknown[]) => generateResponse(...a) });
  syncInquiryToNodo.mockReset().mockResolvedValue("synced");
  businessFindUnique.mockResolvedValue({ leadQualificationEnabled: true, leadIdealProfile: PROFILE, name: "Altas Rappi" });
  // id distinto por test: el contador de intentos es por consulta.
  inquiryFindFirst.mockResolvedValue({ id: `inq_${++inquiryCounter}` });
  inquiryUpdateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseQualificationResponse", () => {
  it("acepta JSON plano y con fence", () => {
    expect(parseQualificationResponse('{"decision":"qualified","reason":"Encaja"}')).toEqual({
      decision: "qualified",
      reason: "Encaja",
    });
    expect(parseQualificationResponse('```json\n{"decision":"discarded","reason":"Es de Córdoba"}\n```')).toEqual({
      decision: "discarded",
      reason: "Es de Córdoba",
    });
  });

  it("rechaza decisiones desconocidas o texto libre", () => {
    expect(parseQualificationResponse('{"decision":"maybe","reason":"x"}')).toBeNull();
    expect(parseQualificationResponse("Creo que sí")).toBeNull();
  });
});

describe("buildTranscript", () => {
  it("etiqueta cliente y negocio, y omite mensajes vacíos", () => {
    expect(buildTranscript([...CHAT, msg("customer", "  ")], "Altas Rappi")).toBe(
      "Cliente: Hola, tengo una pizzería en Caballito\nAltas Rappi: ¿Ya estás en Rappi?\nCliente: No, nunca"
    );
  });
});

describe("qualifyPendingInquiry", () => {
  const input = { businessId: "biz_1", contactPhone: "+5491112345678", messages: CHAT };

  it("califica y guarda la decisión solo si la consulta sigue pending", async () => {
    generateResponse.mockResolvedValue('{"decision":"qualified","reason":"Pizzería en Caballito, no está en Rappi"}');

    expect(await qualifyPendingInquiry(input)).toBe("qualified");

    const update = inquiryUpdateMany.mock.calls[0][0];
    expect(update.where).toMatchObject({ businessId: "biz_1", qualificationStatus: "pending" });
    expect(update.data).toEqual({
      qualificationStatus: "qualified",
      qualificationReason: "Pizzería en Caballito, no está en Rappi",
    });
    // Uso registrado como operación propia.
    expect(generateResponse.mock.calls[0][3]).toEqual({ businessId: "biz_1", operation: "lead_qualification" });
    // La descripción del lead ideal va en el prompt.
    expect(generateResponse.mock.calls[0][2].systemInstruction).toContain(PROFILE);
    // Proveedor común de Nexo, con su operación propia.
    expect(getAIProvider).toHaveBeenCalledWith("lead_qualification");
    // Recién calificada → se envía a Nodo.
    expect(syncInquiryToNodo).toHaveBeenCalledWith("biz_1", expect.any(String));
  });

  it("busca la consulta pending por canal whatsapp (cubre las del asistente)", async () => {
    generateResponse.mockResolvedValue('{"decision":"unclear","reason":"x"}');
    await qualifyPendingInquiry(input);
    expect(inquiryFindFirst.mock.calls[0][0].where).toMatchObject({ channel: "whatsapp", qualificationStatus: "pending" });
  });

  it("si el dueño ya decidió mientras corría el análisis, no envía nada a Nodo", async () => {
    inquiryUpdateMany.mockResolvedValue({ count: 0 });
    generateResponse.mockResolvedValue('{"decision":"qualified","reason":"Encaja"}');
    await qualifyPendingInquiry(input);
    expect(syncInquiryToNodo).not.toHaveBeenCalled();
  });

  it("'unclear' deja la consulta pending y guarda solo el motivo", async () => {
    generateResponse.mockResolvedValue('{"decision":"unclear","reason":"Todavía no dijo la zona"}');
    expect(await qualifyPendingInquiry(input)).toBe("unclear");
    expect(inquiryUpdateMany.mock.calls[0][0].data).toEqual({ qualificationReason: "Todavía no dijo la zona" });
    expect(syncInquiryToNodo).not.toHaveBeenCalled();
  });

  it("no llama a la IA si la calificación está desactivada", async () => {
    businessFindUnique.mockResolvedValue({ leadQualificationEnabled: false, leadIdealProfile: PROFILE });
    expect(await qualifyPendingInquiry(input)).toBe("disabled");
    expect(generateResponse).not.toHaveBeenCalled();
  });

  it("no llama a la IA si no hay consulta pending para ese número", async () => {
    inquiryFindFirst.mockResolvedValue(null);
    expect(await qualifyPendingInquiry(input)).toBe("no_pending");
    expect(generateResponse).not.toHaveBeenCalled();
  });

  it("no escribe nada si la IA devuelve algo inválido", async () => {
    generateResponse.mockResolvedValue("no sé");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await qualifyPendingInquiry(input)).toBe("ai_error");
    expect(inquiryUpdateMany).not.toHaveBeenCalled();
  });

  it("deja de consumir IA después del tope de intentos por consulta", async () => {
    inquiryFindFirst.mockResolvedValue({ id: "inq_tope" });
    generateResponse.mockResolvedValue('{"decision":"unclear","reason":"Falta info"}');
    for (let i = 0; i < MAX_ATTEMPTS_PER_INQUIRY; i++) {
      expect(await qualifyPendingInquiry(input)).toBe("unclear");
    }
    expect(await qualifyPendingInquiry(input)).toBe("max_attempts");
    expect(generateResponse).toHaveBeenCalledTimes(MAX_ATTEMPTS_PER_INQUIRY);
  });
});

describe("scheduleLeadQualification", () => {
  it("varios mensajes seguidos generan un solo análisis, con la charla completa", async () => {
    vi.useFakeTimers();
    generateResponse.mockResolvedValue('{"decision":"qualified","reason":"Encaja"}');
    const messages = [CHAT[0]];
    const schedule = () =>
      scheduleLeadQualification({ businessId: "biz_1", jid: "549@s.whatsapp.net", contactPhone: "+549", getMessages: () => messages });

    schedule();
    vi.advanceTimersByTime(QUIET_MS - 1000);
    messages.push(CHAT[1], CHAT[2]);
    schedule();
    vi.advanceTimersByTime(QUIET_MS - 1000);
    expect(generateResponse).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(generateResponse).toHaveBeenCalledTimes(1);
    expect(generateResponse.mock.calls[0][0]).toContain("No, nunca");
    vi.useRealTimers();
  });
});

describe("updateLeadQualificationSettings", () => {
  it("al desactivar, libera las consultas pending para que Nodo las sincronice", async () => {
    await updateLeadQualificationSettings("biz_1", { enabled: false, idealProfile: PROFILE });
    expect(inquiryUpdateMany).toHaveBeenCalledWith({
      where: { businessId: "biz_1", qualificationStatus: "pending" },
      data: { qualificationStatus: null, qualificationReason: null },
    });
  });

  it("al activar no toca las consultas existentes", async () => {
    await updateLeadQualificationSettings("biz_1", { enabled: true, idealProfile: PROFILE });
    expect(inquiryUpdateMany).not.toHaveBeenCalled();
  });
});
