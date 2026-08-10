import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { buildWhatsappHref } from "@/lib/whatsapp-link";
import type { Business } from "@/lib/types";

export function PublicFooter({ business, slug }: { business: Business; slug: string }) {
  const contactLines = [business.phone, business.address].filter(Boolean);
  const whatsappHref = buildWhatsappHref(business.whatsappNumber);
  const hasSocial = whatsappHref || business.instagramUrl || business.facebookUrl;

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
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <MessageCircle className="size-[18px]" />
                    </a>
                  )}
                  {business.instagramUrl && (
                    <a
                      href={business.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Instagram
                    </a>
                  )}
                  {business.facebookUrl && (
                    <a
                      href={business.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Facebook
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground/70">
            Sitio creado con <Link href="/" className="hover:text-muted-foreground hover:underline">Mi Agenda</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
