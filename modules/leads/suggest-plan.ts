import type { LeadGoal } from "@/lib/types";

// Lógica aislada a propósito (sección 4 del pedido: "dejar la lógica
// aislada para poder mejorarla posteriormente" — nunca IA acá, reglas
// simples y deterministas). Espeja los gates REALES de Plan (ver
// modules/billing/subscription.ts, resolvePlanFeatures): WhatsApp/IA y
// carta digital/QR solo desde Profesional; Esencial es agenda + web — así la
// sugerencia nunca promete algo que el plan no puede cumplir. "Agenda
// interna" (nivel base) no es un plan comercial y nunca se sugiere.
//
// Ejemplos:
//   Reservas + necesidades básicas               → Esencial
//   WhatsApp + automatización + reservas          → Profesional
//   Carta digital/QR + WhatsApp + automatización  → Profesional
export function suggestPlanSlug(goals: readonly LeadGoal[]): "esencial" | "profesional" {
  const set = new Set(goals);

  if (set.has("digital_menu")) return "profesional";
  if (set.has("automate_whatsapp") || set.has("automate_inquiries")) return "profesional";
  return "esencial";
}
