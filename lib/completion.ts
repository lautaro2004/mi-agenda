import type { OnboardingState } from "@/lib/types";

export interface CompletionCheck {
  label: string;
  done: boolean;
  href: string;
}

export function getCompletionChecks(state: OnboardingState): CompletionCheck[] {
  const { business, schedule, services, faqs, subscription } = state;

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
    {
      label: "Suscripción activa",
      done: subscription.status === "active",
      href: "/dashboard/suscripcion",
    },
  ];
}

export function getCompletionPercentage(state: OnboardingState): number {
  const checks = getCompletionChecks(state);
  const done = checks.filter((check) => check.done).length;
  return Math.round((done / checks.length) * 100);
}
