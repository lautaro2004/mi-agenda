import { Check, MessageCircle } from "lucide-react";

import { InquiryForm } from "@/components/public-site/inquiry-form";

interface LeadsContactPanelProps {
  businessName: string;
  slug: string;
  whatsappHref: string | null;
}

const REASONS = ["Sin compromiso", "Te respondemos a la brevedad", "Consultar no tiene costo"] as const;

// Cierre y conversión de la plantilla: panel oscuro con los motivos a la
// izquierda y el formulario (único de la página) a la derecha. Es el destino
// de todos los "Quiero que me contacten" (#contacto).
export function LeadsFinalCta({ businessName, slug, whatsappHref }: LeadsContactPanelProps) {
  return (
    <section id="contacto" className="scroll-mt-20 px-3 py-16 sm:px-4 sm:py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-foreground px-5 py-10 text-background sm:px-10 sm:py-14 lg:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-[var(--brand-primary,var(--primary))] opacity-40 blur-3xl"
        />

        <div className="relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-14">
          <div>
            <h2 className="max-w-[16ch] text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
              ¿Arrancamos?
            </h2>
            <p className="mt-4 max-w-[44ch] text-base leading-relaxed text-background/75 sm:text-lg">
              Dejanos tus datos y {businessName} te contacta para contarte todo.
            </p>
            <ul className="mt-7 flex flex-col gap-3">
              {REASONS.map((reason) => (
                <li key={reason} className="flex items-center gap-2.5 text-[0.95rem]">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary,var(--primary))] text-white">
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

          <div className="rounded-[1.5rem] bg-background p-1.5 text-foreground shadow-2xl">
            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
              <h3 className="text-xl font-semibold tracking-tight">Dejanos tus datos</h3>
              <p className="mt-1 text-sm text-muted-foreground">Te contactamos sin compromiso.</p>
            </div>
            <div className="[&>form]:border-0 [&>form]:bg-transparent">
              <InquiryForm slug={slug} variant="leads" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
