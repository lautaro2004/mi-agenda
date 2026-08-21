import type { OnboardingState } from "@/lib/types";

export interface CompletionCheck {
  label: string;
  done: boolean;
  href: string;
}

// Suscripción activa quedó afuera de esta lista a propósito: state.subscription
// (mock) ya no existe — el estado real vive en Postgres (ver
// modules/billing/subscription.ts) y se muestra aparte, en su propia tarjeta
// de estado (ver AccountStatusCard / lib/subscription-client.ts), no como un
// ítem más de "configuración completa".
export function getCompletionChecks(state: OnboardingState): CompletionCheck[] {
  const { business, schedule, services, faqs } = state;

  return [
    {
      label: "Información del negocio",
      done: Boolean(business.name && business.category && business.description),
      href: "/dashboard/negocio",
    },
    {
      label: "Datos de contacto",
      done: Boolean(business.phone && business.whatsappNumber),
      href: "/dashboard/negocio",
    },
    {
      label: "Horarios de atención",
      done: schedule.some((day) => day.enabled),
      href: "/dashboard/horarios",
    },
    {
      label: "Servicios",
      done: services.length > 0,
      href: "/dashboard/servicios",
    },
    {
      label: "Preguntas frecuentes",
      done: faqs.length > 0,
      href: "/dashboard/preguntas-frecuentes",
    },
  ];
}

export function getCompletionPercentage(state: OnboardingState): number {
  const checks = getCompletionChecks(state);
  const done = checks.filter((check) => check.done).length;
  return Math.round((done / checks.length) * 100);
}
