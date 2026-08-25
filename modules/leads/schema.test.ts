import { describe, expect, it } from "vitest";

import { leadFormSchema, leadUpdateSchema } from "@/lib/schemas";

const VALID_INPUT = {
  name: "Lautaro",
  businessName: "Barbería del Centro",
  whatsapp: "+54 9 11 5555-5555",
  email: "lautaro@example.com",
  industry: "Peluquería / Barbería",
  goals: ["more_bookings", "automate_whatsapp"],
  monthlyVolume: "20_50",
  message: "Queremos automatizar la atención por WhatsApp.",
  wantsMeeting: true,
};

describe("leadFormSchema — 1. crear lead válido", () => {
  it("acepta un input completo y válido", () => {
    const result = leadFormSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("acepta sin los campos opcionales (monthlyVolume/message)", () => {
    const { monthlyVolume: _monthlyVolume, message: _message, ...rest } = VALID_INPUT;
    const result = leadFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });
});

describe("leadFormSchema — 2. rechazar datos inválidos", () => {
  it("rechaza sin nombre", () => {
    const result = leadFormSchema.safeParse({ ...VALID_INPUT, name: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza email inválido", () => {
    const result = leadFormSchema.safeParse({ ...VALID_INPUT, email: "no-es-un-email" });
    expect(result.success).toBe(false);
  });

  it("rechaza sin ningún goal seleccionado", () => {
    const result = leadFormSchema.safeParse({ ...VALID_INPUT, goals: [] });
    expect(result.success).toBe(false);
  });

  it("rechaza un goal que no existe en LEAD_GOALS", () => {
    const result = leadFormSchema.safeParse({ ...VALID_INPUT, goals: ["inventado"] });
    expect(result.success).toBe(false);
  });

  it("rechaza monthlyVolume fuera de la lista válida", () => {
    const result = leadFormSchema.safeParse({ ...VALID_INPUT, monthlyVolume: "1000" });
    expect(result.success).toBe(false);
  });

  it("rechaza mensaje demasiado largo", () => {
    const result = leadFormSchema.safeParse({ ...VALID_INPUT, message: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("el honeypot completado SÍ pasa el schema (a propósito) — la ruta es quien decide en silencio, ver app/api/leads/route.test.ts", () => {
    const result = leadFormSchema.safeParse({ ...VALID_INPUT, website: "http://spam.example" });
    expect(result.success).toBe(true);
  });
});

describe("leadFormSchema — 12. no permite modificar campos de seguimiento desde el form público", () => {
  it("descarta silenciosamente status/notes/suggestedPlan si vienen en el payload (no existen en el schema)", () => {
    const result = leadFormSchema.safeParse({
      ...VALID_INPUT,
      status: "CONVERTED",
      notes: "inyectado",
      suggestedPlan: "profesional",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("status");
      expect(result.data).not.toHaveProperty("notes");
      expect(result.data).not.toHaveProperty("suggestedPlan");
    }
  });
});

describe("leadUpdateSchema", () => {
  it("acepta una actualización parcial de solo status", () => {
    expect(leadUpdateSchema.safeParse({ status: "CONTACTED" }).success).toBe(true);
  });

  it("acepta objeto vacío (todos los campos son opcionales)", () => {
    expect(leadUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("rechaza un status que no existe en LEAD_STATUSES", () => {
    expect(leadUpdateSchema.safeParse({ status: "ARCHIVED" }).success).toBe(false);
  });
});
