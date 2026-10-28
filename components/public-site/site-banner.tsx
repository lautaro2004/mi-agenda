import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResolvedCta } from "@/lib/site-banners";
import type { SiteBanner } from "@/lib/types";

interface SiteBannerViewProps {
  banner: Pick<SiteBanner, "variant" | "desktopImageUrl" | "mobileImageUrl" | "imageAlt" | "title" | "description">;
  // Ya resuelto en el servidor (ver resolveBannerCta). null = sin botón.
  cta: ResolvedCta | null;
  // Solo para la vista previa del panel: fuerza qué imagen se usa en vez de
  // dejarlo al ancho real de la pantalla, y desactiva los enlaces.
  preview?: "desktop" | "mobile";
}

// Presentacional puro (sin datos ni hooks) para que el mismo componente
// sirva al sitio público y a la vista previa del panel — lo que el dueño ve
// al editar es lo que se publica.
function BannerImage({ banner, preview, className }: Pick<SiteBannerViewProps, "banner" | "preview"> & { className?: string }) {
  const mobile = banner.mobileImageUrl;
  const src = preview === "mobile" && mobile ? mobile : banner.desktopImageUrl;
  return (
    <picture>
      {/* Sin imagen móvil, la de escritorio se adapta sola (object-cover / w-full). */}
      {!preview && mobile && <source media="(max-width: 639px)" srcSet={mobile} />}
      <img src={src} alt={banner.imageAlt} loading="lazy" decoding="async" className={className} />
    </picture>
  );
}

function linkProps(cta: ResolvedCta, preview?: string) {
  if (preview) return { href: "#", onClick: undefined, "aria-disabled": true as const, tabIndex: -1 };
  return cta.newTab
    ? { href: cta.href, target: "_blank" as const, rel: "noopener noreferrer" }
    : { href: cta.href };
}

export function SiteBannerView({ banner, cta, preview }: SiteBannerViewProps) {
  if (banner.variant === "image") {
    // La imagen ES el diseño: no se superpone texto. Con CTA, toda la imagen
    // es el enlace (el texto del botón queda como nombre accesible).
    const image = (
      <BannerImage banner={banner} preview={preview} className="block h-auto w-full rounded-2xl object-cover" />
    );
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {cta ? (
          <a {...linkProps(cta, preview)} aria-label={`${cta.label}: ${banner.imageAlt}`} className="block overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2">
            {image}
          </a>
        ) : (
          image
        )}
      </div>
    );
  }

  if (banner.variant === "compact") {
    const hasText = !!(banner.title || banner.description || cta);
    if (!hasText) {
      return (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BannerImage banner={banner} preview={preview} className="h-24 w-full rounded-2xl object-cover sm:h-32" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-3 sm:gap-5 sm:p-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-xl sm:size-20">
            <BannerImage banner={banner} preview={preview} className="size-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            {banner.title && <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">{banner.title}</h2>}
            {banner.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{banner.description}</p>}
          </div>
          {cta && (
            <a
              {...linkProps(cta, preview)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand-primary,var(--primary))] px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {cta.label}
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>
    );
  }

  // "text": título, descripción y botón sobre la imagen, con degradé para
  // que el texto se lea con cualquier foto.
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="relative isolate min-h-[260px] overflow-hidden rounded-2xl bg-muted sm:min-h-[320px]">
        <BannerImage banner={banner} preview={preview} className="absolute inset-0 -z-10 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/40 to-black/10" aria-hidden />
        <div className={cn("flex min-h-[260px] max-w-xl flex-col items-start justify-center gap-3 p-6 sm:min-h-[320px] sm:p-10")}>
          {banner.title && (
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-white sm:text-4xl">{banner.title}</h2>
          )}
          {banner.description && <p className="text-sm text-white/90 sm:text-base">{banner.description}</p>}
          {cta && (
            <a
              {...linkProps(cta, preview)}
              className={cn(
                "mt-1 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-white/90"
              )}
            >
              {cta.label}
              <ArrowRight className="size-4" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
