"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BookingTrigger } from "@/components/public-site/booking/booking-trigger";
import { SocialLinks } from "@/components/public-site/social-icons";
import type { RenderCta, RenderNav } from "@/lib/site-nav";
import type { SocialLink } from "@/lib/social";
import type { Business } from "@/lib/types";

interface PublicHeaderProps {
  business: Business;
  slug: string;
  // Navegación ya resuelta en el servidor (lib/site-nav.ts): solo enlaces
  // activos y que se pueden cumplir.
  nav: RenderNav;
  socials: SocialLink[];
  whatsappHref: string | null;
}

const externalProps = (newTab: boolean) => (newTab ? { target: "_blank", rel: "noopener noreferrer" } : {});

const CTA_STYLE = "bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90";

function CtaButton({ cta, className }: { cta: RenderCta; className?: string }) {
  if (cta.booking) {
    return (
      <BookingTrigger size="sm" className={`${CTA_STYLE} ${className ?? ""}`}>
        {cta.label}
      </BookingTrigger>
    );
  }
  return (
    <Button
      size="sm"
      className={`${CTA_STYLE} ${className ?? ""}`}
      render={<a href={cta.href} {...externalProps(cta.newTab)} />}
      nativeButton={false}
    >
      {cta.label}
    </Button>
  );
}

// Compartido entre /s/[slug] y /s/[slug]/reservar. Los enlaces de sección ya
// vienen como /s/[slug]#ancla (ruta completa), así funcionan igual desde la
// página principal o la de reservas.
export function PublicHeader({ business, slug, nav, socials, whatsappHref }: PublicHeaderProps) {
  const [open, setOpen] = React.useState(false);
  const base = `/s/${slug}`;
  const navSocials = nav.socialsInNav ? socials : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={base} className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoUrl}
              alt={business.name}
              className="size-9 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary,var(--primary))] text-primary-foreground">
              {business.name.charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <span className="truncate">{business.name}</span>
        </Link>

        {nav.links.length > 0 && (
          <nav aria-label="Principal" className="hidden items-center gap-8 text-[0.925rem] font-medium text-muted-foreground md:flex">
            {nav.links.map((link) => (
              <a key={link.id} href={link.href} {...externalProps(link.newTab)} className="transition-colors hover:text-foreground">
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="hidden items-center gap-3 md:flex">
          {navSocials.length > 0 && <SocialLinks links={navSocials} />}
          {nav.showWhatsappButton && whatsappHref && (
            <Button variant="outline" size="sm" render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
              <MessageCircle className="size-3.5" data-icon="inline-start" />
              WhatsApp
            </Button>
          )}
          {nav.cta && <CtaButton cta={nav.cta} />}
        </div>

        <div className="flex items-center md:hidden">
          {nav.cta && <CtaButton cta={nav.cta} className="mr-1" />}
          <Sheet open={open} onOpenChange={setOpen}>
            <Button size="icon" variant="ghost" aria-label="Abrir menú" onClick={() => setOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <SheetContent side="right" className="w-full sm:max-w-xs">
              <SheetHeader>
                <SheetTitle>{business.name}</SheetTitle>
              </SheetHeader>
              {nav.links.length > 0 && (
                <nav aria-label="Principal" className="flex flex-col gap-1 px-4">
                  {nav.links.map((link) => (
                    <SheetClose
                      key={link.id}
                      render={
                        <a
                          href={link.href}
                          {...externalProps(link.newTab)}
                          className="rounded-lg px-2 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                        />
                      }
                    >
                      {link.label}
                    </SheetClose>
                  ))}
                </nav>
              )}
              <div className="mt-auto flex flex-col gap-4 border-t border-border p-4">
                {navSocials.length > 0 && <SocialLinks links={navSocials} className="justify-center" />}
                {nav.showWhatsappButton && whatsappHref && (
                  <Button
                    variant="outline"
                    className="w-full"
                    render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                    nativeButton={false}
                  >
                    <MessageCircle className="size-4" data-icon="inline-start" />
                    Hablar por WhatsApp
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
