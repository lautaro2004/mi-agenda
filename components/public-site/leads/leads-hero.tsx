import { ArrowDown, Check, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Business, Service } from "@/lib/types";

interface LeadsHeroProps {
  business: Business;
  // Ya resueltos (textos del negocio o fallback) — ver resolveLeadsCopy.
  title: string;
  subtitle: string;
  ctaLabel: string;
  services: Service[];
  // Imagen principal ya resuelta por la página (portada → galería → servicio).
  imageUrl: string | null;
  // Contraste del texto sobre el color de marca (ver readableTextOn).
  tone: "light" | "dark";
  whatsappHref: string | null;
}

// Hero de la plantilla de captación: franja del color de marca del negocio
// (no solo un acento) con la propuesta a la izquierda y una composición
// visual a la derecha: la imagen real del negocio con sus servicios reales
// como tarjetas flotantes. Nunca inventa datos (ni cifras, ni reseñas).
// El botón principal baja al formulario (#contacto, panel final).
export function LeadsHero({ business, title, subtitle, ctaLabel, services, imageUrl, tone, whatsappHref }: LeadsHeroProps) {
  const highlights = services.slice(0, 3);
  const light = tone === "light";
  // "Otro" es el rubro por defecto: mostrarlo como etiqueta no aporta nada.
  const category = business.category && business.category !== "Otro" ? business.category : null;

  return (
    <section className="px-3 pt-3 sm:px-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] bg-[var(--brand-primary,var(--primary))] px-5 pt-12 pb-14 sm:px-10 sm:pt-16 lg:px-14 lg:pb-20",
          light ? "text-white" : "text-neutral-950"
        )}
      >
        {/* Textura sutil: dos círculos grandes en el mismo color, apenas más
            claros, para que la franja no sea un plano liso. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-40 -right-32 size-[34rem] rounded-full",
            light ? "bg-white/[0.07]" : "bg-black/[0.05]"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -bottom-56 left-1/3 size-[28rem] rounded-full",
            light ? "bg-white/[0.05]" : "bg-black/[0.04]"
          )}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              {business.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logoUrl} alt="" className="size-8 rounded-lg bg-white object-contain p-0.5" />
              )}
              <span className="text-sm font-medium">{business.name}</span>
              {category && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs",
                    light ? "bg-white/15 text-white" : "bg-black/[0.07] text-neutral-900"
                  )}
                >
                  {category}
                </span>
              )}
            </div>

            <h1 className="mt-6 max-w-[16ch] text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
              {title}
            </h1>

            {subtitle && (
              <p
                className={cn(
                  "mt-5 max-w-[52ch] text-base leading-relaxed text-pretty sm:text-lg",
                  light ? "text-white/85" : "text-neutral-800"
                )}
              >
                {subtitle}
              </p>
            )}

            {highlights.length > 0 && (
              <ul className="mt-7 flex flex-col gap-2.5">
                {highlights.map((service) => (
                  <li key={service.id} className="flex items-center gap-2.5 text-[0.95rem] font-medium">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full",
                        light ? "bg-white text-[var(--brand-primary,var(--primary))]" : "bg-neutral-950 text-white"
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {service.name}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className={cn(
                  "h-12 px-6 text-base font-semibold shadow-none",
                  light
                    ? "bg-white text-neutral-950 hover:bg-white/90"
                    : "bg-neutral-950 text-white hover:bg-neutral-950/90"
                )}
                render={<a href="#contacto" />}
                nativeButton={false}
              >
                {ctaLabel}
                <ArrowDown className="size-4" data-icon="inline-end" />
              </Button>
              {whatsappHref && (
                <Button
                  size="lg"
                  variant="ghost"
                  className={cn(
                    "h-12 px-5 text-base",
                    light ? "text-white hover:bg-white/10 hover:text-white" : "text-neutral-950 hover:bg-black/5"
                  )}
                  render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                >
                  <MessageCircle className="size-4" data-icon="inline-start" />
                  Escribir por WhatsApp
                </Button>
              )}
            </div>
          </div>

          <HeroVisual business={business} services={services} imageUrl={imageUrl} hasWhatsapp={!!whatsappHref} />
        </div>
      </div>
    </section>
  );
}

// Composición visual. Con imagen: la foto en un marco girado apenas, con dos
// tarjetas flotantes (servicios + canal de respuesta). Sin imagen: las
// tarjetas de servicio apiladas, para que el hero nunca quede con un hueco.
function HeroVisual({
  business,
  services,
  imageUrl,
  hasWhatsapp,
}: {
  business: Business;
  services: Service[];
  imageUrl: string | null;
  hasWhatsapp: boolean;
}) {
  const cardServices = services.slice(0, 3);

  if (!imageUrl) {
    if (cardServices.length === 0) return null;
    return (
      <div className="relative mx-auto w-full max-w-sm py-4 lg:max-w-md" aria-hidden>
        {cardServices.map((service, index) => (
          <div
            key={service.id}
            className="relative rounded-2xl bg-white p-5 text-neutral-950 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]"
            style={{
              marginTop: index === 0 ? 0 : "-0.75rem",
              marginLeft: `${index * 1.5}rem`,
              marginRight: `${(cardServices.length - 1 - index) * 1.5}rem`,
              rotate: `${(index - 1) * 2}deg`,
              zIndex: index,
            }}
          >
            <p className="font-semibold">{service.name}</p>
            {service.description && (
              <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{service.description}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-md pb-10 sm:pb-6 lg:mr-0" aria-hidden>
      <div className="rotate-[1.5deg] overflow-hidden rounded-[1.75rem] border-[6px] border-white bg-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.5)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="aspect-[4/5] w-full object-cover sm:aspect-[5/5]" />
      </div>

      {cardServices.length > 0 && (
        <div className="absolute -bottom-2 -left-3 w-56 -rotate-2 rounded-2xl bg-white p-4 text-neutral-950 shadow-[0_18px_40px_-15px_rgba(0,0,0,0.45)] sm:-left-10">
          <p className="text-xs text-neutral-500">{business.name}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {cardServices.map((service) => (
              <li key={service.id} className="flex items-center gap-2 text-sm font-medium">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--brand-primary,var(--primary))]" />
                <span className="truncate">{service.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWhatsapp && (
        <div className="absolute top-6 -right-3 flex items-center gap-2 rounded-full bg-white py-2 pr-4 pl-2 text-sm font-medium text-neutral-950 shadow-[0_14px_30px_-12px_rgba(0,0,0,0.45)] sm:-right-6">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="size-3.5" />
          </span>
          Respondemos por WhatsApp
        </div>
      )}
    </div>
  );
}
