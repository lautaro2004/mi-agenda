const STEPS = [
  { title: "Dejás tus datos", body: "Completás el formulario en menos de un minuto." },
  { title: "Te contactamos", body: "Te escribimos para entender tu negocio y lo que necesitás." },
  { title: "Nos ocupamos", body: "Coordinamos todo para que empieces sin complicaciones." },
] as const;

// Genérico a propósito (no depende del rubro): el proceso de cualquier
// servicio que se vende por contacto. Fondo sutil para separar del bloque de
// beneficios sin sumar otra card.
export function LeadsStepsSection() {
  return (
    <section className="border-y border-border bg-muted/30 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Cómo funciona
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col items-center text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-[var(--brand-primary,var(--primary))] text-base font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
