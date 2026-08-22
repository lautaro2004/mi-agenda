import { listActivePlans } from "@/modules/billing/subscription";
import { PricingCards } from "@/components/landing/pricing-cards";

// Server component a propósito: lee los planes reales directo de Postgres
// (listActivePlans() ya existe — ver modules/billing/subscription.ts, la
// misma función que usa /api/plans para el negocio autenticado) sin
// necesidad de una API pública nueva ni de un fetch client-side. Los montos
// nunca se inventan acá — si todavía no hay planes cargados, PricingCards
// lo muestra como "preparado", no con precios de relleno.
export async function LandingPricing() {
  const plans = await listActivePlans();

  return (
    <section id="planes" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Planes que escalan con tu negocio
          </h2>
          <p className="mt-4 text-muted-foreground">
            Elegí según cuánto necesitás que Nexo trabaje por vos, no según cuántos turnos anotás.
          </p>
        </div>

        <PricingCards plans={plans} />
      </div>
    </section>
  );
}
