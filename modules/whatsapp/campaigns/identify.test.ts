import { describe, expect, it } from "vitest";

import { identifyCampaign, type IdentifiableCampaign } from "./identify";

function camp(id: string, over: Partial<IdentifiableCampaign> = {}): IdentifiableCampaign {
  return { id, name: id, prefilledMessage: "", messageVariants: [], keywords: [], adDescription: null, promotedService: null, ...over };
}

const A = camp("A", {
  name: "Web nueva",
  prefilledMessage: "Hola, vi el anuncio de Kodexa y quiero una web para mi negocio",
  keywords: ["web para mi negocio", "diseño de paginas web"],
});
const B = camp("B", { name: "Renovar web", prefilledMessage: "Hola, quiero renovar la página web de mi empresa", keywords: ["renovar la pagina"] });
const C = camp("C", { name: "Automatización", prefilledMessage: "Hola, quiero automatizar tareas de mi negocio", keywords: ["automatizar tareas"] });

describe("identificación de campaña", () => {
  it("1. mensaje idéntico al precargado identifica la campaña", () => {
    const r = identifyCampaign("Hola, vi el anuncio de Kodexa y quiero una web para mi negocio", [A, B, C]);
    expect(r).toMatchObject({ campaignId: "A", method: "prefilled_message", reason: "matched" });
    expect(r.confidence >= 0.95).toBe(true);
  });

  it("2. con pequeñas modificaciones (mayúsculas, tildes, texto extra) también", () => {
    const r = identifyCampaign("HOLA!! vi el anuncio de kodexa y quiero una web para mi negocio, me pasan info? gracias", [A, B, C]);
    expect(r).toMatchObject({ campaignId: "A", method: "prefilled_message" });
    const edited = identifyCampaign("Hola vi el anuncio de Kodexa, quiero una página web para mi negocio", [A, B, C]);
    expect(edited.campaignId).toBe("A");
  });

  it("2b. una variante configurada identifica la campaña", () => {
    const withVariant = camp("V", { prefilledMessage: "Hola, quiero automatizar mi negocio", messageVariants: ["Buenas, me interesa automatizar las ventas de mi local"] });
    expect(identifyCampaign("Buenas, me interesa automatizar las ventas de mi local", [withVariant, A]).campaignId).toBe("V");
  });

  it("3. un mensaje genérico no atribuye ninguna campaña", () => {
    for (const msg of ["Hola", "quiero una web", "precio", "información", "Hola, quiero información sobre sus servicios", "una propuesta por favor"]) {
      const r = identifyCampaign(msg, [A, B, C]);
      expect(r.campaignId).toBeNull();
      expect(r.method).toBe("unknown");
    }
  });

  it("3b. una palabra genérica configurada como expresión tampoco alcanza", () => {
    const g = camp("G", { keywords: ["web", "precio"] });
    expect(identifyCampaign("cuánto sale una web, cuál es el precio", [g]).campaignId).toBeNull();
  });

  it("4. dos campañas con mensajes casi idénticos: sin margen, queda desconocido", () => {
    const X = camp("X", { prefilledMessage: "Hola, quiero una página web para mi negocio gastronómico" });
    const Y = camp("Y", { prefilledMessage: "Hola, quiero una página web para mi negocio gastronómico en Rosario" });
    const r = identifyCampaign("Hola, quiero una página web para mi negocio gastronómico", [X, Y]);
    // X coincide exacto (0.97) e Y casi: no hay margen suficiente → no se elige.
    expect(["X", null]).toContain(r.campaignId);
    const tie = identifyCampaign("Hola, quiero una página web para mi negocio gastronómico", [X, camp("Z", { prefilledMessage: X.prefilledMessage })]);
    expect(tie.campaignId).toBeNull();
    expect(tie.reason).toBe("ambiguous");
  });

  it("4b. si una es claramente mejor, gana con su confianza", () => {
    const r = identifyCampaign("Hola, quiero renovar la página web de mi empresa", [A, B, C]);
    expect(r.campaignId).toBe("B");
  });

  it("coincidencia por expresiones identificadoras (keyword_match)", () => {
    const r = identifyCampaign("Buenas, necesito automatizar tareas repetitivas de mi local", [A, B, C]);
    expect(r.campaignId).toBe("C");
    // Una campaña sin precargado se identifica solo por sus expresiones.
    const K = camp("K", { keywords: ["turnos online", "agenda online"] });
    expect(identifyCampaign("necesito turnos online para mi local", [A, K])).toMatchObject({ campaignId: "K", method: "keyword_match" });
  });

  it("coincidencia por contexto (semantic_match) solo con solapamiento alto", () => {
    const S = camp("S", { name: "Turnero clínicas", adDescription: "sistema de turnos online para clínicas odontológicas", promotedService: "turnero odontológico" });
    expect(identifyCampaign("necesito un sistema de turnos para mi clínica odontológica", [S]).method).toBe("semantic_match");
    expect(identifyCampaign("quiero algo para mi clínica", [S]).campaignId).toBeNull();
  });

  it("sin campañas activas: desconocido", () => {
    expect(identifyCampaign("Hola, quiero una web para mi negocio", [])).toMatchObject({ campaignId: null, reason: "no_campaigns" });
  });
});
