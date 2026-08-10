// La descripción real del negocio vive acá (no repetida en el hero, que se
// mantiene compacto) — es la única fuente de "quiénes somos" que existe hoy
// (Business.description), así que si está vacía la sección simplemente no
// se renderiza en vez de rellenar con texto genérico inventado.
export function AboutSection({ description }: { description: string }) {
  if (!description) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
      <div className="border-l-2 border-[var(--brand-primary,var(--primary))]/40 pl-5 sm:pl-6">
        <p className="text-lg leading-relaxed text-foreground sm:text-xl">{description}</p>
      </div>
    </section>
  );
}
