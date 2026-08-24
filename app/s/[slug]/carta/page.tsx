import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Misma fuente que /s/[slug] (getBusinessState) — nunca un query aparte.
// notFound() cubre TRES casos con el mismo resultado (sección 6 de la
// tarea: nunca mostrar la carta si no está activa Y con PDF real): negocio
// inexistente, carta desactivada, o activa pero sin PDF cargado todavía.
async function loadMenu(slug: string) {
  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) return null;

  const { business } = await getBusinessState(businessId);
  if (!business.menuEnabled || !business.menuPdfUrl) return null;

  return business;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await loadMenu(slug);
  if (!business) return {};

  return {
    title: `Carta | ${business.name}`,
    description: `Consultá la carta de ${business.name} desde tu celular.`,
    alternates: { canonical: `/s/${slug}/carta` },
  };
}

// Página dedicada, minimalista, pensada para llegar desde un QR en una mesa
// (sección 3/4 de la tarea) — deliberadamente NO reutiliza PublicHeader ni
// el resto del layout del sitio (nada de nav, sin distracciones): logo,
// nombre, el PDF, y listo. 100% Server Component: el visor es un <object>
// nativo con fallback HTML puro, "pantalla completa"/"descargar" son links
// directos al PDF — no hace falta useState ni JS en el cliente para nada de
// esto.
export default async function MenuPage({ params }: PageProps) {
  const { slug } = await params;
  const business = await loadMenu(slug);
  if (!business) notFound();

  const pdfUrl = business.menuPdfUrl!;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex flex-col items-center gap-2 px-4 pt-8 pb-4 text-center sm:pt-10">
        {business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.logoUrl}
            alt={business.name}
            className="size-14 rounded-2xl border border-border object-cover shadow-sm"
          />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--brand-primary,var(--primary))] text-xl font-semibold text-primary-foreground shadow-sm">
            {business.name.charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{business.name}</h1>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Carta</p>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 pb-6 sm:px-6">
        <div className="min-h-[70vh] flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <object data={pdfUrl} type="application/pdf" className="h-[75vh] w-full sm:h-[80vh]">
            {/* Fallback nativo (sección 4 de la tarea): se renderiza solo si
                el navegador no puede mostrar el <object> — sin JS de por
                medio. */}
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                Tu dispositivo no puede mostrar la carta directamente.
              </p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-lg bg-[var(--brand-primary,var(--primary))] px-5 text-sm font-medium text-primary-foreground"
              >
                Ver carta en PDF
              </a>
            </div>
          </object>
        </div>

        <div className="mt-4 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--brand-primary,var(--primary))] px-6 text-sm font-medium text-primary-foreground sm:w-auto"
          >
            Ver en pantalla completa
          </a>
          <a
            href={pdfUrl}
            download
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-medium text-foreground sm:w-auto"
          >
            Descargar carta
          </a>
        </div>
      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        Powered by Nexo
      </footer>
    </div>
  );
}
