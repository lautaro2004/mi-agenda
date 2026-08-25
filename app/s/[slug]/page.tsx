import type { CSSProperties } from "react";
import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { getBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import { getActiveServiceResources } from "@/modules/business/resource";
import { listActiveGalleryBlocks } from "@/modules/business/gallery";
import { buildFallbackSeoConfig, buildLocalBusinessJsonLd, getSeoConfig } from "@/modules/business/seo";
import { getBrandColor, sanitizeHexColor } from "@/lib/brand-color";
import { cn } from "@/lib/utils";
import {
  getBookingIntent,
  getFeaturedBookableService,
  getVisibleServices,
  resolveSiteTemplate,
} from "@/lib/booking-intent";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import { isBookableService } from "@/lib/types";

import { BookingModalProvider } from "@/components/public-site/booking/booking-modal-context";
import { PublicHeader } from "@/components/public-site/header";
import { PublicHero } from "@/components/public-site/hero";
import { AboutSection } from "@/components/public-site/about-section";
import { ServicesSection } from "@/components/public-site/services-section";
import { ProcessSection } from "@/components/public-site/process-section";
import { BookingSection } from "@/components/public-site/booking-section";
import { ScheduleSection } from "@/components/public-site/schedule-section";
import { FaqSection } from "@/components/public-site/faq-section";
import { FinalCtaSection } from "@/components/public-site/final-cta-section";
import { PublicFooter } from "@/components/public-site/footer";
import { FloatingWhatsapp } from "@/components/public-site/floating-whatsapp";
import { BookingHero } from "@/components/public-site/booking/booking-hero";
import { BookingPageClient } from "@/components/public-site/booking/booking-page-client";
import { BookingImportantInfo } from "@/components/public-site/booking/booking-important-info";
import { BookingStickyCta } from "@/components/public-site/booking/booking-sticky-cta";
import { GallerySection } from "@/components/public-site/gallery-section";
import { MenuCallout } from "@/components/public-site/menu-callout";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Único punto de lectura del sitio público: Business + SeoConfig + Services +
// FAQs + Schedule, todo ya persistido. Nunca llama a Gemini acá — ver
// modules/business/seo.ts, la generación es un paso aparte, disparado por el
// dueño, nunca por una visita. Los recursos concretos (qué cancha/sala queda
// libre) los resuelve el BookingWidget en el momento, vía las APIs públicas
// — no hace falta traerlos acá para renderizar la página.
async function loadSite(slug: string) {
  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) return null;

  const [state, seo, galleryBlocks] = await Promise.all([
    getBusinessState(businessId),
    getSeoConfig(businessId),
    listActiveGalleryBlocks(businessId),
  ]);

  return { ...state, seo, galleryBlocks };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) return {};

  // Si todavía no se generó SeoConfig, el sitio igual tiene que poder
  // publicarse — nunca se llama a Gemini acá, se usa el fallback
  // determinístico.
  const seo = site.seo ?? buildFallbackSeoConfig(site.business);

  return {
    title: seo.seoTitle,
    description: seo.metaDescription,
    alternates: { canonical: `/s/${slug}` },
    openGraph: {
      title: seo.ogTitle,
      description: seo.ogDescription,
      type: "website",
      url: `/s/${slug}`,
      ...(site.business.logoUrl ? { images: [{ url: site.business.logoUrl }] } : {}),
    },
    twitter: {
      card: "summary",
      title: seo.ogTitle,
      description: seo.ogDescription,
    },
  };
}

export default async function PublicSitePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) notFound();

  const { business, services, faqs, schedule, galleryBlocks } = site;
  const seo = site.seo ?? buildFallbackSeoConfig(business);
  // Misma regla en las tres piezas (header, callout, QR): la carta solo
  // "existe" para un visitante cuando está activa Y tiene un PDF real — ver
  // sección 6 de la tarea, nunca mostrar el CTA de una carta a medio
  // configurar.
  const hasMenu = business.menuEnabled && !!business.menuPdfUrl;
  const bookableServices = services.filter(isBookableService);
  // Genérico, no depende del rubro ni del negocio puntual — ver
  // lib/booking-intent.ts. Decide si la web habla de "reservar un turno"
  // (el turno ES el producto) o de "agendar una reunión" (el turno es el
  // medio para coordinar servicios que no son turnos, ej. proyectos).
  const intent = getBookingIntent(services);
  // Sección 13 de la tarea: auto-detecta vía intent (no frágil, ver
  // lib/booking-intent.ts) salvo que el dueño haya elegido una plantilla a
  // mano desde Configuración > Sitio.
  const template = resolveSiteTemplate(business.siteTemplate, intent);
  // En intent "meeting" el servicio reservable (ej. "Reunión inicial") no se
  // muestra como card comercial — se ofrece como CTA de conversión en su
  // lugar (ver getVisibleServices), preseleccionado al abrir el modal.
  const visibleServices = getVisibleServices(services, intent);
  const jsonLd = buildLocalBusinessJsonLd({ business, services, schedule, slug });

  // Servicio a destacar en la hero booking card — determinístico: el primer
  // reservable en el orden ya existente, nunca uno nuevo. Solo se consulta si
  // usa recursos cuando efectivamente hay uno destacado: una query liviana y
  // puntual, no un fetch por cada servicio de la página.
  const featuredService = getFeaturedBookableService(services);
  const featuredServiceResources = featuredService
    ? await getActiveServiceResources(business.id, featuredService.id)
    : [];

  const whatsappHref = buildWhatsappHref(business.whatsappNumber);
  // Mensaje propio (no genérico) para el botón flotante — los demás puntos
  // de contacto por WhatsApp (navbar, footer, CTA intermedio/final) abren un
  // chat sin mensaje o con uno contextualizado a un servicio puntual.
  const floatingWhatsappHref = buildWhatsappHref(business.whatsappNumber, "Hola, vi su sitio web y quería hacer una consulta.");

  // Ver lib/brand-color.ts: si Business.brandColor no está configurado, esto
  // da null y "--brand-primary" nunca se define — todo el acento de marca
  // cae en el --primary del tema, sin ningún cambio visual.
  const brandColor = sanitizeHexColor(getBrandColor(business));
  const modalTitle = intent === "meeting" ? "Agendar reunión" : "Reservar turno";

  return (
    <div
      className={cn("min-h-screen bg-background", template === "booking" && "pb-16 sm:pb-0")}
      style={brandColor ? ({ "--brand-primary": brandColor } as CSSProperties) : undefined}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <BookingModalProvider
        slug={slug}
        services={bookableServices}
        business={business}
        whatsappHref={whatsappHref}
        title={modalTitle}
      >
        <PublicHeader
          business={business}
          slug={slug}
          intent={intent}
          hasFaqs={faqs.length > 0}
          hasSchedule={schedule.some((d) => d.enabled)}
          hasMenu={hasMenu}
          whatsappHref={whatsappHref}
        />

        {template === "booking" ? (
          <main>
            <BookingHero
              business={business}
              whatsappHref={whatsappHref}
              heroImageUrl={business.heroImageUrl}
              usesResources={featuredServiceResources.length > 0}
            />
            <BookingPageClient
              slug={slug}
              services={bookableServices}
              business={business}
              whatsappHref={whatsappHref}
            />
            <BookingImportantInfo business={business} whatsappHref={whatsappHref} />
            {hasMenu && <MenuCallout slug={slug} />}
            <GallerySection blocks={galleryBlocks} />
            <ScheduleSection schedule={schedule} />
            <FaqSection faqs={faqs} limit={5} />
          </main>
        ) : (
          <main>
            <PublicHero
              business={business}
              seo={seo}
              intent={intent}
              whatsappHref={whatsappHref}
              heroImageUrl={business.heroImageUrl}
              featuredService={featuredService}
              featuredServiceUsesResources={featuredServiceResources.length > 0}
            />
            <AboutSection description={business.description} />
            <ServicesSection services={visibleServices} whatsappNumber={business.whatsappNumber} />
            {hasMenu && <MenuCallout slug={slug} />}
            <GallerySection blocks={galleryBlocks} />
            <ProcessSection intent={intent} />
            <BookingSection services={bookableServices} intent={intent} whatsappHref={whatsappHref} />
            <ScheduleSection schedule={schedule} />
            <FaqSection faqs={faqs} />
            <FinalCtaSection intent={intent} whatsappHref={whatsappHref} />
          </main>
        )}

        <PublicFooter business={business} slug={slug} />
        <FloatingWhatsapp href={floatingWhatsappHref} liftedOnMobile={template === "booking"} />
        {template === "booking" && <BookingStickyCta />}
      </BookingModalProvider>
    </div>
  );
}
