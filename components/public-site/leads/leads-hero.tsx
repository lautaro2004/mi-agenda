import { CheckCircle2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InquiryForm } from "@/components/public-site/inquiry-form";
import type { Business, SeoConfig, Service } from "@/lib/types";

interface LeadsHeroProps {
  business: Business;
  seo: Pick<SeoConfig, "h1">;
  services: Service[];
  slug: string;
  whatsappHref: string | null;
}

// Plantilla de captación: el formulario ES la pieza de conversión, así que va
// arriba de todo, al lado de la propuesta (en mobile, apilado debajo del
// texto). Quien llega desde un anuncio o desde la bio de Instagram tiene que
// poder dejar sus datos sin scrollear.
export function LeadsHero({ business, seo, services, slug, whatsappHref }: LeadsHeroProps) {
  // Hasta 3 servicios como bullets de propuesta — determinístico, en el
  // orden ya existente.
  const highlights = services.slice(0, 3);

  return (
    <section
      id="contacto"
      className="relative overflow-hidden border-b border-border px-4 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--brand-primary,var(--primary))]/12 via-transparent to-transparent"
        aria-hidden
      />

      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-14">
        <div className="flex flex-col lg:pt-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold tracking-wide text-[var(--brand-primary,var(--primary))] uppercase">
              {business.name}
            </span>
            {business.category && (
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-0.5 text-xs font-medium text-muted-foreground">
                {business.category}
              </span>
            )}
          </div>

          <h1 className="mt-3.5 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
            {seo.h1 || business.name}
          </h1>

          {business.description && (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
              {business.description}
            </p>
          )}

          {highlights.length > 0 && (
            <ul className="mt-6 flex flex-col gap-3">
              {highlights.map((service) => (
                <li key={service.id} className="flex items-start gap-2.5 text-sm text-foreground sm:text-base">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--brand-primary,var(--primary))]" />
                  <span>{service.name}</span>
                </li>
              ))}
            </ul>
          )}

          {whatsappHref && (
            <div className="mt-8">
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 text-base"
                render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <MessageCircle className="size-4" data-icon="inline-start" />
                Prefiero escribir por WhatsApp
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-border bg-card/80 p-1.5 shadow-sm backdrop-blur">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Dejanos tus datos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Te contactamos sin compromiso.</p>
          </div>
          <div className="[&>form]:border-0 [&>form]:bg-transparent">
            <InquiryForm slug={slug} variant="leads" />
          </div>
        </div>
      </div>
    </section>
  );
}
