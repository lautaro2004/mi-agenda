import type { BookingIntent } from "@/lib/booking-intent";

const STEPS = [
  { n: "01", title: "Contanos tu proyecto", text: "Escribinos o agendá una reunión para contarnos qué necesitás." },
  { n: "02", title: "Definimos la solución", text: "Analizamos tu caso y te proponemos el enfoque más conveniente." },
  { n: "03", title: "Desarrollamos", text: "Avanzamos con lo acordado, en contacto durante todo el proceso." },
  { n: "04", title: "Te acompañamos", text: "Seguimos disponibles después de la entrega para lo que necesites." },
] as const;

// Genérico y no dependiente del negocio puntual: solo aplica cuando el turno
// reservable es un medio para coordinar (intent "meeting", ver
// lib/booking-intent.ts) — ahí sí tiene sentido explicar "cómo se trabaja"
// antes de pedir la reunión. En "booking" (peluquería, cancha, consultorio)
// el turno ES el producto y no hace falta explicar un proceso aparte; en
// "contact" no hay datos de proceso reales que mostrar.
export function ProcessSection({ intent }: { intent: BookingIntent }) {
  if (intent !== "meeting") return null;

  return (
    <section className="border-t border-border bg-muted/20 px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Cómo trabajamos
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.n}>
              <span className="text-sm font-semibold text-[var(--brand-primary,var(--primary))]">{step.n}</span>
              <h3 className="mt-2 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
