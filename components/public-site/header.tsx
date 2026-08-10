"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BookingIntent } from "@/lib/booking-intent";
import type { Business } from "@/lib/types";

interface PublicHeaderProps {
  business: Business;
  slug: string;
  intent: BookingIntent;
  hasFaqs: boolean;
  hasSchedule: boolean;
  whatsappHref: string | null;
  bookingHref: string;
}

const CTA_LABEL: Record<BookingIntent, string> = {
  booking: "Reservar",
  meeting: "Agendar reunión",
  contact: "Contactar",
};

// Compartido entre /s/[slug] y /s/[slug]/reservar — a propósito los links de
// sección apuntan siempre a /s/[slug]#ancla (ruta completa, no solo #ancla),
// así funcionan igual estés parado en la página principal o en la de
// reserva.
export function PublicHeader({ business, slug, intent, hasFaqs, hasSchedule, whatsappHref, bookingHref }: PublicHeaderProps) {
  const [open, setOpen] = React.useState(false);
  const base = `/s/${slug}`;
  const hasBookable = intent !== "contact";

  const links = [
    { href: `${base}#servicios`, label: "Servicios" },
    ...(hasSchedule ? [{ href: `${base}#horarios`, label: "Horarios" }] : []),
    ...(hasFaqs ? [{ href: `${base}#faq`, label: "Preguntas frecuentes" }] : []),
  ];

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

        <nav className="hidden items-center gap-8 text-[0.925rem] font-medium text-muted-foreground md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {whatsappHref && (
            <Button variant="outline" size="sm" render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
              <MessageCircle className="size-3.5" data-icon="inline-start" />
              WhatsApp
            </Button>
          )}
          {hasBookable && (
            <Button
              size="sm"
              className="bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
              render={<Link href={bookingHref} />}
              nativeButton={false}
            >
              {CTA_LABEL[intent]}
            </Button>
          )}
        </div>

        <div className="flex items-center md:hidden">
          {hasBookable && (
            <Button
              size="sm"
              className="mr-1 bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
              render={<Link href={bookingHref} />}
              nativeButton={false}
            >
              {CTA_LABEL[intent]}
            </Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <Button size="icon" variant="ghost" aria-label="Abrir menú" onClick={() => setOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <SheetContent side="right" className="w-full sm:max-w-xs">
              <SheetHeader>
                <SheetTitle>{business.name}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {links.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={
                      <a href={link.href} className="rounded-lg px-2 py-2.5 text-base font-medium text-foreground hover:bg-muted" />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
              </nav>
              {whatsappHref && (
                <div className="mt-auto border-t border-border p-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                    nativeButton={false}
                  >
                    <MessageCircle className="size-4" data-icon="inline-start" />
                    Hablar por WhatsApp
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
