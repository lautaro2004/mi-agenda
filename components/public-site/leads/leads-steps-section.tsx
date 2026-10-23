import { ClipboardList, MessageCircle, Rocket } from "lucide-react";

const STEPS = [
  { icon: ClipboardList, title: "Dejás tus datos", body: "Completás el formulario en menos de un minuto." },
  { icon: MessageCircle, title: "Te contactamos", body: "Te escribimos para entender tu negocio y lo que necesitás." },
  { icon: Rocket, title: "Nos ocupamos", body: "Coordinamos todo para que empieces sin complicaciones." },
] as const;

// Recorrido en fila (en mobile, en columna) unido por una línea punteada: es
// una secuencia real, por eso lleva número. Genérico a propósito — no
// depende del rubro.
export function LeadsStepsSection() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="max-w-[20ch] text-3xl font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-4xl">
          Cómo funciona
        </h2>

        <ol className="relative mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {/* Línea que une los pasos (horizontal en desktop, vertical en mobile). */}
          <div
            aria-hidden
            className="absolute top-7 right-[16%] left-[16%] hidden border-t-2 border-dashed border-[var(--brand-primary,var(--primary))]/30 sm:block"
          />
          <div
            aria-hidden
            className="absolute top-7 bottom-7 left-7 border-l-2 border-dashed border-[var(--brand-primary,var(--primary))]/30 sm:hidden"
          />
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex gap-5 sm:flex-col sm:items-center sm:gap-0 sm:text-center">
              <span className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-primary,var(--primary))] text-white shadow-lg">
                <step.icon className="size-6" />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border-2 border-background bg-foreground text-xs font-semibold text-background">
                  {index + 1}
                </span>
              </span>
              <div className="sm:mt-5">
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
