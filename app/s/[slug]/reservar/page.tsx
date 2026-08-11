import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import { buildFallbackSeoConfig, getSeoConfig } from "@/modules/business/seo";
import { getBrandColor, sanitizeHexColor } from "@/lib/brand-color";
import { getBookingHref, getBookingIntent } from "@/lib/booking-intent";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import { isBookableService } from "@/lib/types";

import { PublicHeader } from "@/components/public-site/header";
import { PublicFooter } from "@/components/public-site/footer";
import { FloatingWhatsapp } from "@/components/public-site/floating-whatsapp";
import { BookingWidget } from "../booking-widget";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servicio?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) return {};

  const [{ business, services }, seoConfig] = await Promise.all([
    getBusinessState(businessId),
    getSeoConfig(businessId),
  ]);
  const seo = seoConfig ?? buildFallbackSeoConfig(business);
  const titlePrefix = getBookingIntent(services) === "meeting" ? "Agendar reunión" : "Reservar";

  return {
    title: `${titlePrefix} — ${business.name}`,
    description: seo.metaDescription,
    alternates: { canonical: `/s/${slug}/reservar` },
  };
}

// Misma fuente de datos que /s/[slug] (getBusinessState), mismo BookingWidget
// — ninguna lógica de disponibilidad/reserva nueva. Esta página solo le da
// un marco enfocado, sin el resto de la landing alrededor.
export default async function ReservarPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { servicio } = await searchParams;

  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) notFound();

  const { business, services, faqs, schedule } = await getBusinessState(businessId);
  const bookableServices = services.filter(isBookableService);

  // Sin nada reservable no hay página de reserva que mostrar — evita un
  // formulario vacío/roto (mismo criterio que la sección de reserva de la
  // página principal, que tampoco se renderiza en ese caso).
  if (bookableServices.length === 0) redirect(`/s/${slug}`);

  const intent = getBookingIntent(services);
  const isMeeting = intent === "meeting";
  const bookingHref = getBookingHref(slug, services, intent);

  const whatsappHref = buildWhatsappHref(business.whatsappNumber);
  const floatingWhatsappHref = buildWhatsappHref(business.whatsappNumber, "Hola, vi su sitio web y quería hacer una consulta.");
  const brandColor = sanitizeHexColor(getBrandColor(business));

  return (
    <div
      className="min-h-screen bg-background"
      style={brandColor ? ({ "--brand-primary": brandColor } as CSSProperties) : undefined}
    >
      <PublicHeader
        business={business}
        slug={slug}
        intent={intent}
        hasFaqs={faqs.length > 0}
        hasSchedule={schedule.some((d) => d.enabled)}
        whatsappHref={whatsappHref}
        bookingHref={bookingHref}
      />

      <main className="mx-auto max-w-lg px-4 py-14 sm:px-6 sm:py-20">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {isMeeting ? "Agendá una reunión" : "Reservá tu turno"}
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground">
            {isMeeting
              ? "Contanos qué necesitás y coordinemos una reunión para conocer tu proyecto."
              : "Elegí el servicio, la fecha y el horario. La disponibilidad es en tiempo real."}
          </p>
        </div>

        <div className="mt-8">
          <BookingWidget slug={slug} services={bookableServices} initialServiceId={servicio} />
        </div>
      </main>

      <PublicFooter business={business} slug={slug} />
      <FloatingWhatsapp href={floatingWhatsappHref} />
    </div>
  );
}
