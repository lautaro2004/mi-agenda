import type { LandingCopyValues } from "@/lib/schemas";

// Textos fijos de la plantilla de captación — los que se ven si el negocio
// nunca generó ni escribió los suyos. Sin Prisma: lo usan tanto el sitio
// público como el editor del dashboard (componente cliente).
export const LEADS_DEFAULT_COPY: Omit<LandingCopyValues, "heroTitle" | "heroSubtitle"> = {
  ctaLabel: "Quiero que me contacten",
  steps: [
    { title: "Dejás tus datos", body: "Completás el formulario en menos de un minuto." },
    { title: "Te contactamos", body: "Te escribimos para entender tu negocio y lo que necesitás." },
    { title: "Nos ocupamos", body: "Coordinamos todo para que empieces sin complicaciones." },
  ],
  servicesTitle: "Qué hacemos por vos",
  servicesIntro: "",
  closingTitle: "¿Arrancamos?",
  closingBody: "Dejanos tus datos y te contactamos para contarte todo.",
  reasons: ["Sin compromiso", "Te respondemos a la brevedad", "Consultar no tiene costo"],
  formTitle: "Dejanos tus datos",
  formSubtitle: "Te contactamos sin compromiso.",
};

// Textos finales que ve el visitante: los guardados por el negocio si
// existen; si no, título = H1 del SEO (o el nombre), subtítulo = descripción
// del negocio, y el resto los fijos de arriba.
export function resolveLeadsCopy(
  saved: LandingCopyValues | null,
  fallback: { heroTitle: string; heroSubtitle: string }
): LandingCopyValues {
  if (saved) return saved;
  return { ...LEADS_DEFAULT_COPY, heroTitle: fallback.heroTitle, heroSubtitle: fallback.heroSubtitle };
}
