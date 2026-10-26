import { Check, Clock, MessageCircle } from "lucide-react";

import { LeadForm } from "@/components/public-site/leads/lead-form";
import { cn } from "@/lib/utils";
import type { LeadFormConfig } from "@/lib/lead-form";

interface LeadsContactPanelProps {
  title: string;
  body: string;
  reasons: string[];
  formTitle: string;
  formSubtitle: string;
  ctaLabel: string;
  formConfig: LeadFormConfig;
  tone: "light" | "dark";
  slug: string;
  whatsappHref: string | null;
}

// Cierre y conversión de la plantilla: panel oscuro con los motivos a la
// izquierda y el formulario (único de la página, configurable por negocio)
// a la derecha. Es el destino de todos los botones del sitio (#contacto).
export function LeadsFinalCta({
  title,
  body,
  reasons,
  formTitle,
  formSubtitle,
  ctaLabel,
  formConfig,
  tone,
  slug,
  whatsappHref,
}: LeadsContactPanelProps) {
  return (
    <section id="contacto" className="scroll-mt-20 px-3 py-16 sm:px-4 sm:py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-foreground px-5 py-10 text-background sm:px-10 sm:py-14 lg:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-[var(--brand-primary,var(--primary))] opacity-40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -bottom-32 size-72 rounded-full bg-[var(--brand-primary,var(--primary))] opacity-20 blur-3xl"
        />

        <div className="relative grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-14">
          <div data-reveal>
            <h2 className="max-w-[16ch] text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{title}</h2>
            <p className="mt-4 max-w-[44ch] text-base leading-relaxed text-background/75 sm:text-lg">{body}</p>
            <ul className="mt-7 flex flex-col gap-3">
              {reasons.map((reason) => (
                <li key={reason} className="flex items-center gap-2.5 text-[0.95rem]">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary,var(--primary))]",
                      tone === "light" ? "text-white" : "text-neutral-950"
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {reason}
                </li>
              ))}
            </ul>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-background/80 underline-offset-4 hover:text-background hover:underline"
              >
                <MessageCircle className="size-4" />
                ¿Preferís WhatsApp? Escribinos directo
              </a>
            )}
          </div>

          <div data-reveal className="rounded-[1.5rem] bg-background text-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-3 px-5 pt-6 sm:px-6">
              <div>
                <h3 className="text-xl font-semibold tracking-tight">{formTitle}</h3>
                {formSubtitle && <p className="mt-1 text-sm text-muted-foreground">{formSubtitle}</p>}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Clock className="size-3" />1 min
              </span>
            </div>
            <LeadForm slug={slug} config={formConfig} submitLabel={ctaLabel} tone={tone} />
          </div>
        </div>
      </div>
    </section>
  );
}
