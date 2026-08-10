import type { BusinessSchedule, Service, WeekDay } from "@/lib/types";
import type { BusinessContext } from "@/modules/ai/providers/base";
import type { MessageIntent } from "@/modules/ai/types";
import { isBookableService } from "@/modules/business/service";

const DAY_NAMES: Record<WeekDay, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const ES_STOP_WORDS = new Set([
  "de", "el", "la", "los", "las", "en", "que", "y", "a", "es", "un", "una",
  "con", "para", "por", "no", "se", "lo", "te", "su", "al", "del", "me",
  "si", "mi", "tu", "o", "yo", "como", "más", "pero", "le", "ya", "muy",
  "hay", "fue", "ser", "son", "han", "tiene", "tienen", "puedo", "hola",
  "buenas", "buenos", "buen", "dias", "tardes", "noches",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ES_STOP_WORDS.has(w));
}

function scoreOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((w) => setB.has(w)).length;
}

function findMatchingService(message: string, services: Service[]): Service | undefined {
  const messageTokens = tokenize(message);
  let best: { service: Service; score: number } | undefined;
  for (const service of services) {
    const serviceTokens = tokenize(`${service.name} ${service.description} ${service.category}`);
    const score = scoreOverlap(messageTokens, serviceTokens) + scoreOverlap(serviceTokens, messageTokens);
    if (score > 0 && (!best || score > best.score)) {
      best = { service, score };
    }
  }
  return best?.service;
}

function formatSchedule(schedule: BusinessSchedule): string {
  const enabled = schedule.filter((d) => d.enabled);
  if (!enabled.length) return "";
  return enabled
    .map((d) => {
      let line = `${DAY_NAMES[d.day]}: ${d.openTime} a ${d.closeTime}`;
      if (d.hasBreak) line += ` (almuerzo ${d.breakStart}–${d.breakEnd})`;
      return line;
    })
    .join(", ");
}

function checkFaqs(message: string, context: BusinessContext): string | undefined {
  const messageTokens = tokenize(message);
  if (messageTokens.length === 0) return undefined;

  let best: { answer: string; score: number } | undefined;
  for (const faq of context.faqs) {
    const questionTokens = tokenize(faq.question);
    const score = scoreOverlap(messageTokens, questionTokens);
    if (score >= 2 && (!best || score > best.score)) {
      best = { answer: faq.answer, score };
    }
  }
  return best?.answer;
}

export interface RuleResult {
  text: string;
  rule: string;
  escalateToHuman?: boolean;
  labelHint?: "appointment_request" | "human_required" | "pricing" | "service_inquiry";
}

export function applyRules(
  message: string,
  intent: MessageIntent,
  context: BusinessContext
): RuleResult | null {
  // FAQ check runs for every intent
  const faqAnswer = checkFaqs(message, context);
  if (faqAnswer) {
    return { text: faqAnswer, rule: "faq_match" };
  }

  switch (intent) {
    case "pricing": {
      if (!context.services.length) return null;
      const match = findMatchingService(message, context.services);
      if (match) {
        const durationText = isBookableService(match) ? ` y dura aproximadamente ${match.durationMinutes} minutos` : "";
        return {
          text: `El ${match.name} tiene un valor de $${match.price.toLocaleString("es-AR")}${durationText}.${match.description ? ` ${match.description}.` : ""}`,
          rule: "pricing_service_match",
          labelHint: "pricing",
        };
      }
      const allPrices = context.services
        .map((s) => `${s.name}: $${s.price.toLocaleString("es-AR")}`)
        .join(", ");
      return {
        text: `Estos son nuestros servicios y precios: ${allPrices}.`,
        rule: "pricing_all_services",
        labelHint: "pricing",
      };
    }

    case "schedule": {
      const scheduleText = formatSchedule(context.schedule);
      if (!scheduleText) return null;
      return {
        text: `Nuestros horarios de atención son: ${scheduleText}.`,
        rule: "schedule_configured",
      };
    }

    case "location": {
      const { address } = context.business;
      if (!address?.trim()) return null;
      return {
        text: `Nos encontramos en ${address}.${context.business.phone ? ` Podés contactarnos al ${context.business.phone}.` : ""}`,
        rule: "location_configured",
      };
    }

    case "service": {
      if (!context.services.length) return null;
      const match = findMatchingService(message, context.services);
      if (match) {
        const durationText = isBookableService(match) ? `Tiene una duración de ${match.durationMinutes} minutos y un ` : "Tiene un ";
        return {
          text: `Sí, ofrecemos ${match.name}. ${match.description ? match.description + " " : ""}${durationText}costo de $${match.price.toLocaleString("es-AR")}.`,
          rule: "service_specific_match",
          labelHint: "service_inquiry",
        };
      }
      const names = context.services.map((s) => s.name).join(", ");
      return {
        text: `Ofrecemos los siguientes servicios: ${names}. ¿Querés más información sobre alguno en particular?`,
        rule: "service_list",
        labelHint: "service_inquiry",
      };
    }

    case "appointment": {
      // Handled by the booking flow in the gateway — do not escalate here
      return null;
    }

    case "human": {
      return {
        text: "¡Claro! Te comunico con alguien de nuestro equipo enseguida.",
        rule: "human_requested",
        escalateToHuman: true,
        labelHint: "human_required",
      };
    }

    case "other":
      return null;
  }
}
