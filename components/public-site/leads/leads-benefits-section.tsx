import { CheckCircle2 } from "lucide-react";

import type { Service } from "@/lib/types";

// "Qué hacemos por vos": los servicios del negocio presentados como
// beneficios (sin precio ni duración — en esta plantilla no se vende un
// turno, se capta un contacto). Sin servicios cargados, la sección no existe.
export function LeadsBenefitsSection({ services }: { services: Service[] }) {
  if (services.length === 0) return null;

  return (
    <section id="servicios" className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Qué hacemos por vos
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article key={service.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              {service.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={service.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
              )}
              <div className="p-5 sm:p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-primary,var(--primary))]/10">
                  <CheckCircle2 className="size-5 text-[var(--brand-primary,var(--primary))]" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{service.name}</h3>
                {service.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
