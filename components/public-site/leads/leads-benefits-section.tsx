import type { Service } from "@/lib/types";

// "Qué hacemos por vos": en dos columnas — título fijo a la izquierda,
// servicios como filas a la derecha (con su foto si la tienen). Sin precio ni
// duración: en esta plantilla no se vende un turno, se capta un contacto.
export function LeadsBenefitsSection({
  services,
  title,
  description,
}: {
  services: Service[];
  title: string;
  description?: string | null;
}) {
  if (services.length === 0) return null;

  return (
    <section id="servicios" className="bg-[var(--brand-primary,var(--primary))]/[0.05] px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="max-w-[14ch] text-3xl font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-4xl">
            {title}
          </h2>
          {description && (
            <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-[1.5rem] border border-border bg-background">
          {services.map((service, index) => (
            <li key={service.id} className="flex gap-5 p-5 sm:p-7">
              {service.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={service.imageUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover sm:size-20" />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary,var(--primary))]/10 text-base font-semibold text-[var(--brand-primary,var(--primary))]">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">{service.name}</h3>
                {service.description && (
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-pretty text-muted-foreground">
                    {service.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
