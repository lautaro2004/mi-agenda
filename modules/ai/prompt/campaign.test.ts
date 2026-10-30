import { describe, expect, it } from "vitest";

import type { CampaignConfig } from "@/lib/campaigns";
import { buildCampaignSection } from "./campaign";

const campaign: CampaignConfig = {
  id: "c1", businessId: "b1", name: "Desarrollo web", description: null, status: "active", channel: "instagram",
  prefilledMessage: "Hola, quiero una web", messageVariants: [], keywords: [], adDescription: "Anuncio de webs para negocios",
  promotedService: "Páginas web para negocios", targetAudience: "Comercios chicos", problemSolved: "No tienen presencia online",
  agentKnowledge: "Entrega en 3 semanas", tone: "Cercano", doNotPromise: "precios cerrados ni plazos garantizados",
  goal: "proposal_request", secondaryGoal: "booking",
  fields: [{ key: "need", required: true }, { key: "email", required: true }, { key: "budget", required: false }, { key: "phone", required: true }],
  syncNodo: true, createOpportunity: false, initialLeadStatus: "NEW", createdAt: "", updatedAt: "",
};

describe("sección de campaña del prompt", () => {
  it("incluye contexto comercial, objetivo, campos y límites", () => {
    const text = buildCampaignSection({ campaign, method: "prefilled_message", hasBookableServices: true });
    expect(text).toContain("Páginas web para negocios");
    expect(text).toContain("NO ofrezcas ni propongas horarios");
    expect(text).toContain("Descripción de la necesidad (obligatorio)");
    expect(text).toContain("Presupuesto estimado (opcional)");
    expect(text).toContain("NO prometas ni asumas: precios cerrados");
    expect(text).toContain("coordinar una reunión");
  });
  it("el origen inferido no se afirma como seguro; el manual sí", () => {
    expect(buildCampaignSection({ campaign, method: "keyword_match", hasBookableServices: false })).toContain("se infirió");
    expect(buildCampaignSection({ campaign, method: "manual", hasBookableServices: false })).toContain("asignó");
  });
  it("lista lo ya recopilado para no repetir preguntas, y no sugiere reunión sin servicios reservables", () => {
    const text = buildCampaignSection({
      campaign, method: "prefilled_message", hasBookableServices: false,
      draft: { name: "Ana", email: "ana@mail.com", pending: "extras", extrasAsked: false, startedAt: "" },
    });
    expect(text).toContain("- Email: ana@mail.com");
    expect(text).toContain("no los vuelvas a pedir");
    expect(text.includes("coordinar una reunión")).toBe(false);
  });
});
