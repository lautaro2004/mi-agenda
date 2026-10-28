import Link from "next/link";

import { BrandIcon, SocialLinks } from "@/components/public-site/social-icons";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import type { SocialLink } from "@/lib/social";
import type { Business } from "@/lib/types";

// "socials" ya viene filtrado (solo redes válidas) y es [] si el dueño las
// sacó del footer en Sitio web > Navegación.
export function PublicFooter({ business, slug, socials = [] }: { business: Business; slug: string; socials?: SocialLink[] }) {
  const contactLines = [business.phone, business.address].filter(Boolean);
  const whatsappHref = buildWhatsappHref(business.whatsappNumber);
  const hasSocial = !!whatsappHref || socials.length > 0;

  return (
    <footer className="border-t border-border px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div className="flex max-w-sm flex-col items-center gap-3 sm:items-start">
            <Link href={`/s/${slug}`} className="flex items-center gap-2.5 font-semibold text-foreground">
              {business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="size-8 rounded-lg border border-border object-cover"
                />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand-primary,var(--primary))] text-sm text-primary-foreground">
                  {business.name.charAt(0).toUpperCase() || "?"}
                </span>
              )}
              {business.name}
            </Link>
            {business.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">{business.description}</p>
            )}
          </div>

          {(contactLines.length > 0 || hasSocial) && (
            <div className="flex flex-col items-center gap-3 sm:items-end">
              {contactLines.length > 0 && (
                <p className="text-sm text-muted-foreground">{contactLines.join(" · ")}</p>
              )}
              {hasSocial && (
                <div className="flex items-center gap-3">
                  {whatsappHref && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      title="WhatsApp"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <BrandIcon name="whatsapp" />
                    </a>
                  )}
                  <SocialLinks links={socials} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground/70">
            Sitio creado con <Link href="/" className="hover:text-muted-foreground hover:underline">Nexo</Link>
            {" · "}
            <Link href="/privacidad" className="hover:text-muted-foreground hover:underline">Privacidad</Link>
            {" · "}
            <Link href="/terminos" className="hover:text-muted-foreground hover:underline">Términos</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
