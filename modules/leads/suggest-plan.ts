import type { LeadGoal } from "@/lib/types";

// Lógica aislada a propósito (sección 4 del pedido: "dejar la lógica
// aislada para poder mejorarla posteriormente" — nunca IA acá, reglas
// simples y deterministas). Espeja los gates REALES de Plan (ver
// modules/billing/subscription.ts, resolvePlanFeatures): digitalMenuEnabled
// solo en Profesional, whatsappEnabled desde Esencial — así la sugerencia
// nunca promete algo que el plan no puede cumplir.
//
// Ejemplos del pedido:
//   Reservas + necesidades básicas               → Gratis
//   WhatsApp + automatización + reservas          → Esencial
//   Carta digital/QR + WhatsApp + automatización  → Profesional
export function suggestPlanSlug(goals: readonly LeadGoal[]): "gratis" | "esencial" | "profesional" {
  const set = new Set(goals);

  if (set.has("digital_menu")) return "profesional";
  if (set.has("automate_whatsapp") || set.has("automate_inquiries")) return "esencial";
  return "gratis";
}
