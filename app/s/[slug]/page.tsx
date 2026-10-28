import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { getPublicBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import { getActiveServiceResources } from "@/modules/business/resource";
import { listActiveGalleryBlocks } from "@/modules/business/gallery";
import { buildFallbackSeoConfig, buildLocalBusinessJsonLd, getSeoConfig } from "@/modules/business/seo";
import { getBrandColor, readableTextOn, sanitizeHexColor } from "@/lib/brand-color";
import { resolveLeadsCopy } from "@/lib/landing-copy";
import { getLandingCopy } from "@/modules/business/landing-copy";
import { getLeadFormConfig } from "@/modules/business/lead-form";
import { DEFAULT_LEAD_FORM } from "@/lib/lead-form";
import { LeadsMobileCta } from "@/components/public-site/leads/leads-mobile-cta";
import { cn } from "@/lib/utils";
import {
  getBookingIntent,
  getFeaturedBookableService,
  getVisibleServices,
  resolveSiteTemplate,
} from "@/lib/booking-intent";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import { isBookableService } from "@/lib/types";
import { groupSchedule } from "@/lib/schedule-format";
import { resolveBannerCta, sectionAnchor } from "@/lib/site-banners";
import { fallbackPublicLayout, loadPublicLayout } from "@/modules/site/layout";
import { SiteBannerView } from "@/components/public-site/site-banner";

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
import { BookingChat } from "@/components/public-site/booking-chat";
import { canUseWebAiChat } from "@/modules/billing/subscription";
import { BookingHero } from "@/components/public-site/booking/booking-hero";
import { BookingServicesSection } from "@/components/public-site/booking/booking-services-section";
import { BookingImportantInfo } from "@/components/public-site/booking/booking-important-info";
import { BookingInquirySection } from "@/components/public-site/booking/booking-inquiry-section";
import { BookingStickyCta } from "@/components/public-site/booking/booking-sticky-cta";
import { GallerySection } from "@/components/public-site/gallery-section";
import { MenuCallout } from "@/components/public-site/menu-callout";
import { LeadsHero } from "@/components/public-site/leads/leads-hero";
import { LeadsBenefitsSection } from "@/components/public-site/leads/leads-benefits-section";
import { LeadsStepsSection } from "@/components/public-site/leads/leads-steps-section";
import { LeadsFinalCta } from "@/components/public-site/leads/leads-final-cta";

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
  const businessId = await getPublicBusinessIdBySlug(slug);
  if (!businessId) return null;

  const [state, seo, galleryBlocks, landingCopy] = await Promise.all([
    getBusinessState(businessId),
    getSeoConfig(businessId),
    listActiveGalleryBlocks(businessId),
    // Nunca tira abajo el sitio: si la tabla todavía no existe (migración
    // sin aplicar) o la lectura falla, la plantilla usa los textos fijos. Se
    // lee para todas las plantillas, así que un error acá afectaría a todos
    // los negocios, no solo a los de captación.
    getLandingCopy(businessId).catch((error) => {
      console.error("[sitio] No se pudieron leer los textos de captación:", error);
      return { copy: null, generatedAt: null };
    }),
  ]);

  return { ...state, seo, galleryBlocks, landingCopy: landingCopy.copy };
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

  const { business, services, faqs, schedule, galleryBlocks, landingCopy } = site;
  const seo = site.seo ?? buildFallbackSeoConfig(business);
  // Misma regla en las tres piezas (header, callout, QR): la carta solo
  // "existe" para un visitante cuando está activa Y tiene un PDF real — ver
  // sección 6 de la tarea, nunca mostrar el CTA de una carta a medio
  // configurar.
  const hasMenu = business.menuEnabled && !!business.menuPdfUrl;
  const bookableServices = services.filter(isBookableService);
  // Chat con IA: lo decide el plan (validado también en la API del chat).
  const showChat = bookableServices.length > 0 && (await canUseWebAiChat(business.id));
  // Genérico, no depende del rubro ni del negocio puntual — ver
  // lib/booking-intent.ts. Decide si la web habla de "reservar un turno"
  // (el turno ES el producto) o de "agendar una reunión" (el turno es el
  // medio para coordinar servicios que no son turnos, ej. proyectos).
  const intent = getBookingIntent(services);
  // Sección 13 de la tarea: auto-detecta vía intent (no frágil, ver
  // lib/booking-intent.ts) salvo que el dueño haya elegido una plantilla a
  // mano desde Configuración > Sitio.
  const template = resolveSiteTemplate(business.siteTemplate, intent);
  // Solo la plantilla de captación usa el formulario configurable. Lectura
  // resiliente (getLeadFormConfig nunca lanza: cae en el estándar).
  const leadFormConfig = template === "leads" ? await getLeadFormConfig(business.id) : null;
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
  // Contraste del texto sobre el color de marca (plantilla de captación).
  const leadsTone = readableTextOn(brandColor);
  const modalTitle = intent === "meeting" ? "Agendar reunión" : "Reservar turno";
  // Textos de la plantilla de captación: los del negocio (generados con IA o
  // escritos a mano en Sitio web) o los fijos — ver lib/landing-copy.ts.
  const leadsCopy = resolveLeadsCopy(landingCopy, {
    heroTitle: seo.h1 || business.name,
    heroSubtitle: business.description ?? "",
  });

  // Orden y visibilidad de las secciones (SiteLayout) + banners activos. Si
  // la lectura falla (ej. migración sin aplicar), el sitio usa el orden de
  // fábrica de la plantilla — nunca se cae por esto.
  const layout = await loadPublicLayout(business.id, template).catch((error) => {
    console.error("[sitio] No se pudo leer el orden de secciones; se usa el de fábrica:", error);
    return fallbackPublicLayout(template);
  });

  // REGISTRO EXPLÍCITO de bloques por plantilla (ver lib/site-sections.ts):
  // lo guardado en la base solo elige entre estos, nunca ejecuta nada. Un
  // renderer devuelve null cuando no hay contenido → la sección no se
  // renderiza ni deja un espacio vacío.
  const hasGallery = galleryBlocks.length > 0;
  const leadsRenderers: Record<string, () => ReactNode> = {
    hero: () => (
      <LeadsHero
        business={business}
        title={leadsCopy.heroTitle}
        subtitle={leadsCopy.heroSubtitle}
        ctaLabel={leadsCopy.ctaLabel}
        services={visibleServices}
        imageUrl={
          // Portada → primera foto de la galería → foto del primer
          // servicio que tenga. Sin ninguna, el hero usa tarjetas.
          business.heroImageUrl ??
          galleryBlocks.find((b) => b.images.length > 0)?.images[0]?.imageUrl ??
          visibleServices.find((s) => s.imageUrl)?.imageUrl ??
          null
        }
        tone={leadsTone}
        whatsappHref={whatsappHref}
      />
    ),
    steps: () => <LeadsStepsSection steps={leadsCopy.steps} tone={leadsTone} />,
    services: () => <LeadsBenefitsSection services={visibleServices} title={leadsCopy.servicesTitle} description={leadsCopy.servicesIntro} />,
    gallery: () => (hasGallery ? <GallerySection blocks={galleryBlocks} /> : null),
    faq: () => (faqs.length > 0 ? <FaqSection faqs={faqs} /> : null),
    form: () => (
      <LeadsFinalCta
        title={leadsCopy.closingTitle}
        body={leadsCopy.closingBody}
        reasons={leadsCopy.reasons}
        formTitle={leadsCopy.formTitle}
        formSubtitle={leadsCopy.formSubtitle}
        ctaLabel={leadsCopy.ctaLabel}
        formConfig={leadFormConfig ?? DEFAULT_LEAD_FORM}
        tone={leadsTone}
        slug={slug}
        whatsappHref={whatsappHref}
      />
    ),
  };
  const bookingRenderers: Record<string, () => ReactNode> = {
    hero: () => (
      <BookingHero
        business={business}
        whatsappHref={whatsappHref}
        heroImageUrl={business.heroImageUrl}
        usesResources={featuredServiceResources.length > 0}
      />
    ),
    services: () => <BookingServicesSection services={bookableServices} whatsappHref={whatsappHref} />,
    info: () => <BookingImportantInfo business={business} whatsappHref={whatsappHref} />,
    inquiry: () => <BookingInquirySection slug={slug} />,
    menu: () => (hasMenu ? <MenuCallout slug={slug} /> : null),
    gallery: () => (hasGallery ? <GallerySection blocks={galleryBlocks} /> : null),
    schedule: () => (groupSchedule(schedule).length > 0 ? <ScheduleSection schedule={schedule} /> : null),
    faq: () => (faqs.length > 0 ? <FaqSection faqs={faqs} limit={5} /> : null),
  };
  const institutionalRenderers: Record<string, () => ReactNode> = {
    hero: () => (
      <PublicHero
        business={business}
        seo={seo}
        intent={intent}
        whatsappHref={whatsappHref}
        heroImageUrl={business.heroImageUrl}
        featuredService={featuredService}
        featuredServiceUsesResources={featuredServiceResources.length > 0}
      />
    ),
    about: () => (business.description ? <AboutSection description={business.description} /> : null),
    services: () => <ServicesSection services={visibleServices} whatsappNumber={business.whatsappNumber} />,
    menu: () => (hasMenu ? <MenuCallout slug={slug} /> : null),
    gallery: () => (hasGallery ? <GallerySection blocks={galleryBlocks} /> : null),
    process: () => <ProcessSection intent={intent} />,
    booking: () => <BookingSection services={bookableServices} intent={intent} whatsappHref={whatsappHref} />,
    schedule: () => (groupSchedule(schedule).length > 0 ? <ScheduleSection schedule={schedule} /> : null),
    faq: () => (faqs.length > 0 ? <FaqSection faqs={faqs} /> : null),
    cta: () => <FinalCtaSection intent={intent} whatsappHref={whatsappHref} />,
  };
  const renderers = template === "leads" ? leadsRenderers : template === "booking" ? bookingRenderers : institutionalRenderers;

  // Primera pasada: qué secciones de la plantilla realmente se muestran
  // (visibles y con contenido). Los CTA de los banners que apuntan a una
  // sección oculta o vacía no se renderizan, en vez de quedar rotos.
  const sectionNodes = layout.items.flatMap((item) => {
    if (!item.visible || item.kind === "banner") return [];
    const node = renderers[item.kind]?.() ?? null;
    return node ? [{ item, node }] : [];
  });
  const visibleKinds = new Set(sectionNodes.map(({ item }) => item.kind));
  const nodeByItemId = new Map(sectionNodes.map(({ item, node }) => [item.id, node]));

  // Segunda pasada: en orden, secciones y banners activos. Un banner
  // referenciado en varias posiciones se renderiza desde el mismo registro.
  const renderedItems = layout.items.flatMap((item): { key: { id: string; anchor?: string }; node: ReactNode }[] => {
    if (!item.visible) return [];
    if (item.kind === "banner") {
      const banner = item.bannerId ? layout.banners.get(item.bannerId) : undefined;
      if (!banner) return [];
      const cta = resolveBannerCta(banner.cta, {
        template,
        whatsappNumber: business.whatsappNumber,
        phone: business.phone,
        visibleKinds,
      });
      return [{ key: { id: item.id }, node: <div className="py-6 sm:py-8"><SiteBannerView banner={banner} cta={cta} /></div> }];
    }
    const node = nodeByItemId.get(item.id);
    return node ? [{ key: { id: item.id, anchor: sectionAnchor(item.kind) }, node }] : [];
  });

  return (
    <div
      className={cn("min-h-screen bg-background", (template === "booking" || template === "leads") && "pb-16 sm:pb-0")}
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

        <main>
          {renderedItems.map(({ key, node }) => (
            <div key={key.id} id={key.anchor} className="scroll-mt-20">
              {node}
            </div>
          ))}
          {template === "leads" && <LeadsMobileCta label={leadsCopy.ctaLabel} tone={leadsTone} />}
        </main>

        <PublicFooter business={business} slug={slug} />
        <FloatingWhatsapp href={floatingWhatsappHref} liftedOnMobile={template === "booking" || template === "leads"} />
        {showChat && <BookingChat slug={slug} businessName={business.name} liftedOnMobile={template === "booking" || template === "leads"} />}
        {template === "booking" && <BookingStickyCta />}
      </BookingModalProvider>
    </div>
  );
}
