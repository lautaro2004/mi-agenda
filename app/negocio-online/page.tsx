import type { Metadata } from "next";

import { getBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import type { Business, Service } from "@/lib/types";

import { LandingAdsNavbar } from "@/components/landing-ads/navbar";
import { LandingAdsHero } from "@/components/landing-ads/hero";
import { LandingAdsProblem } from "@/components/landing-ads/problem";
import { LandingAdsSolution } from "@/components/landing-ads/solution";
import { LandingAdsResult } from "@/components/landing-ads/result";
import { LandingAdsManagement } from "@/components/landing-ads/management";
import { LandingAdsTrust } from "@/components/landing-ads/trust";
import { LandingAdsFinalCta } from "@/components/landing-ads/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { PageViewTracker } from "@/components/landing-ads/page-view-tracker";

// Sin dynamic segment, Next.js la pre-renderiza estática por default — lo
// cual congelaría los datos reales de El Andén (precios, horario) al
// momento del build. revalidate acá pide ISR: se sirve estática (rápida,
// ideal para tráfico de ads) pero se regenera como mucho una vez por hora,
// así los cambios reales del negocio de ejemplo se reflejan solos sin
// necesitar un redeploy.
export const revalidate = 3600;

// Negocio real usado como ejemplo visual (secciones 1 y 4 del pedido) — ver
// modules/business/service.ts#getBusinessState, la misma función que usa
// app/s/[slug]/page.tsx para el sitio público real. Nunca se inventan
// datos: si en algún momento este negocio dejara de existir, la página
// sigue funcionando con un fallback neutro en vez de romperse (ver
// FALLBACK_BUSINESS más abajo) — la disponibilidad de esta landing de ads
// no puede depender de que un negocio de terceros no cambie de slug.
const SHOWCASE_SLUG = "el-anden";

const FALLBACK_BUSINESS: Business = {
  id: "",
  name: "Tu negocio",
  logoUrl: null,
  heroImageUrl: null,
  brandColor: null,
  category: "",
  description: "",
  phone: "",
  whatsappNumber: "",
  address: "",
  instagramUrl: "",
  facebookUrl: "",
  slug: null,
  siteTemplate: null,
  depositRequired: false,
  depositType: null,
  depositFixedAmount: null,
  depositPercentage: null,
  depositAlias: null,
  depositCbu: null,
  depositBankName: null,
  depositAccountHolder: null,
  depositTaxId: null,
  depositInstructions: null,
  menuEnabled: false,
  menuPdfUrl: null,
};

const FALLBACK_SERVICES: Service[] = [];

// Nunca deja que un problema pasajero de conexión a la base (visto en este
// mismo entorno con el pooler de Supabase durante otras tareas de esta
// sesión) tire abajo TODA la landing con un 500 — página de ads, tráfico
// pago: mejor degradar al fallback neutro que perder la visita.
async function loadShowcaseBusiness() {
  try {
    const businessId = await getBusinessIdBySlug(SHOWCASE_SLUG);
    if (!businessId) return null;
    return await getBusinessState(businessId);
  } catch (error) {
    console.error("[negocio-online] No se pudo cargar el negocio de referencia:", error instanceof Error ? error.message : error);
    return null;
  }
}

const PAGE_TITLE = "Tu negocio, online y funcionando";
const PAGE_DESCRIPTION =
  "Creá tu propio sitio, mostrale tus servicios a tus clientes y gestioná todo desde un solo lugar con Nexo.";

export async function generateMetadata(): Promise<Metadata> {
  const showcase = await loadShowcaseBusiness();

  return {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    alternates: { canonical: "/negocio-online" },
    openGraph: {
      type: "website",
      url: "/negocio-online",
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      ...(showcase?.business.heroImageUrl ? { images: [{ url: showcase.business.heroImageUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
    },
  };
}

export default async function NegocioOnlinePage() {
  const showcase = await loadShowcaseBusiness();
  const business = showcase?.business ?? FALLBACK_BUSINESS;
  const services = showcase?.services ?? FALLBACK_SERVICES;
  const schedule = showcase?.schedule ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <PageViewTracker />
      <LandingAdsNavbar />
      <main className="flex-1">
        <LandingAdsHero business={business} services={services} slug={SHOWCASE_SLUG} />
        <LandingAdsProblem />
        <LandingAdsSolution />
        <LandingAdsResult business={business} services={services} schedule={schedule} slug={SHOWCASE_SLUG} />
        <LandingAdsManagement />
        <LandingAdsTrust />
        <LandingAdsFinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
