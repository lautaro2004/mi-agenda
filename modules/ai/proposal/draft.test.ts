import { describe, expect, it } from "vitest";

import { applyMessage, extractBudget, extractCompany, extractDeadline, extractEmail, extractName, hasSubstance, nextField, questionFor, startDraft } from "./draft";

describe("extracción de datos", () => {
  it("email, presupuesto, plazo, nombre y empresa", () => {
    expect(extractEmail("mi mail es Lucas@Kodexa.AR, gracias")).toBe("lucas@kodexa.ar");
    expect(extractEmail("no tengo")).toBeNull();
    expect(extractBudget("tengo unos $500.000 para esto")).toBe("$500.000");
    expect(extractBudget("hasta 800 usd")).toBe("800 usd");
    expect(extractDeadline("lo necesito para fin de mes")).toBe("fin de mes");
    expect(extractDeadline("es urgente")).toBe("urgente");
    expect(extractName("me llamo Lucas Maldonado")).toBe("Lucas Maldonado");
    expect(extractName("soy de Panadería Sol")).toBeNull();
    expect(extractCompany("mi empresa se llama Panadería Sol, de Rosario")).toBe("Panadería Sol");
    expect(extractCompany("trabajo en Kodexa")).toBe("Kodexa");
  });

  it("«un mail con una propuesta» no dice qué necesita; «una página web» sí", () => {
    expect(hasSubstance("un mail con una propuesta")).toBe(false);
    expect(hasSubstance("Mandame una propuesta por email")).toBe(false);
    expect(hasSubstance("Quiero un presupuesto para una página web")).toBe(true);
  });
});

describe("recopilación progresiva", () => {
  it("10. sin email, pregunta el dato antes de finalizar (aunque ya tenga necesidad y nombre)", () => {
    const draft = startDraft({ firstMessage: "Quiero un presupuesto para una página web", profileName: "Lucas Maldonado" });
    expect(draft.need).toContain("página web");
    expect(draft.name).toBe("Lucas Maldonado");
    expect(draft.email).toBeUndefined();
    expect(draft.pending).toBe("email");
    expect(nextField({ ...draft, extrasAsked: true })).toBe("email");
  });

  it("9. datos ya proporcionados no se vuelven a pedir", () => {
    const draft = startDraft({
      firstMessage: "Hola, me llamo Ana, quiero un presupuesto para un sistema de turnos, mi mail es ana@mail.com y mi empresa se llama Clínica Sur",
      profileName: "Contacto de WhatsApp",
    });
    expect(draft).toMatchObject({ name: "Ana", email: "ana@mail.com", company: "Clínica Sur" });
    // Solo queda lo opcional.
    expect(draft.pending).toBe("extras");
  });

  it("sin nombre usable del perfil lo pregunta; con uno usable no", () => {
    expect(startDraft({ firstMessage: "quiero una propuesta de una web a ana@mail.com", profileName: "+5491155551234" }).pending).toBe("name");
    expect(startDraft({ firstMessage: "quiero una propuesta de una web a ana@mail.com", profileName: "Ana" }).pending).toBe("extras");
  });

  it("el caso real: «un mail con una propuesta» primero pregunta qué necesita, no una fecha", () => {
    const draft = startDraft({ firstMessage: "un mail con una propuesta", profileName: "Lucas" });
    expect(draft.need).toBeUndefined();
    expect(draft.pending).toBe("need");
    expect(questionFor(draft.pending, draft, { first: true })).toMatch(/qué servicio o proyecto/);
  });

  it("conserva el servicio que el cliente ya había elegido en una reserva", () => {
    const draft = startDraft({ firstMessage: "mejor mandame un presupuesto por mail", profileName: "Lucas", carry: { service: "Landing Page" } });
    expect(draft.need).toBe("Landing Page");
    expect(draft.pending).toBe("email");
  });

  it("responde paso a paso hasta llegar a la confirmación", () => {
    let draft = startDraft({ firstMessage: "un mail con una propuesta", profileName: "Lucas" });
    draft = applyMessage(draft, "una web para mi restaurante").draft;
    expect(draft.pending).toBe("email");
    const bad = applyMessage(draft, "no sé");
    expect(bad.unclear).toBe(true);
    draft = applyMessage(draft, "lucas@mail.com").draft;
    expect(draft.pending).toBe("extras");
    draft = applyMessage(draft, "mi empresa se llama Resto Sol, presupuesto $600.000, para fin de mes").draft;
    expect(draft).toMatchObject({ company: "Resto Sol", budget: "$600.000", deadline: "fin de mes" });
    expect(draft.pending).toBe("confirm");
  });

  it("«listo» saltea lo opcional", () => {
    let draft = startDraft({ firstMessage: "quiero una propuesta de una web a ana@mail.com", profileName: "Ana" });
    draft = applyMessage(draft, "listo").draft;
    expect(draft.pending).toBe("confirm");
    expect(draft.company).toBeUndefined();
  });

  it("corregir un dato en la confirmación vuelve a mostrar el resumen", () => {
    let draft = startDraft({ firstMessage: "quiero una propuesta de una web a ana@mail.com", profileName: "Ana" });
    draft = applyMessage(draft, "listo").draft;
    const fixed = applyMessage(draft, "mi mail es ana.nueva@mail.com");
    expect(fixed.changed).toBe(true);
    expect(fixed.draft).toMatchObject({ email: "ana.nueva@mail.com", pending: "confirm" });
  });

  it("puede pedir recibirla por el chat solo si hay teléfono", () => {
    const draft = startDraft({ firstMessage: "quiero un presupuesto de una web", profileName: "Ana" });
    expect(applyMessage(draft, "prefiero por acá", { phoneAvailable: false }).unclear).toBe(true);
    const ok = applyMessage(draft, "prefiero por acá", { phoneAvailable: true });
    expect(ok.draft.emailWaived).toBe(true);
    expect(ok.draft.pending).toBe("extras");
  });
});
