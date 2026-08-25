"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingWidget } from "@/components/public-site/booking-widget";
import { cn } from "@/lib/utils";
import type { Business, Service } from "@/lib/types";

type BookingBusiness = Pick<
  Business,
  | "depositRequired"
  | "depositType"
  | "depositFixedAmount"
  | "depositPercentage"
  | "depositAlias"
  | "depositCbu"
  | "depositBankName"
  | "depositAccountHolder"
  | "depositTaxId"
  | "depositInstructions"
>;

interface BookingModalProps {
  slug: string;
  services: Service[];
  business: BookingBusiness;
  whatsappHref: string | null;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialServiceId?: string;
  resetToken: number;
}

// Bottom sheet en mobile, modal centrado en desktop — un solo componente,
// clases responsive propias (no reutiliza las de components/ui/dialog.tsx
// ni sheet.tsx tal cual: esas tienen el posicionamiento fijo para un solo
// caso cada una, y mezclar sus variantes por breakpoint es frágil). Usa
// @base-ui/react/dialog directo, igual que esos dos wrappers — Escape,
// click afuera y foco atrapado ya vienen resueltos por el primitive, sin
// código nuevo para eso.
//
// El contenido es BookingWidget tal cual (mismo componente que
// /s/[slug]/reservar) — "resetToken" como key fuerza que monte de cero en
// cada apertura, así el formulario nunca arranca con el estado de éxito o
// el servicio preseleccionado de la reserva anterior.
export function BookingModal({
  slug,
  services,
  business,
  whatsappHref,
  title = "Reservar turno",
  open,
  onOpenChange,
  initialServiceId,
  resetToken,
}: BookingModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 transition-opacity duration-150",
            "data-starting-style:opacity-0 data-ending-style:opacity-0"
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-border bg-popover shadow-xl outline-none",
            "data-open:animate-in data-open:slide-in-from-bottom data-open:duration-200",
            "data-closed:animate-out data-closed:slide-out-to-bottom data-closed:duration-150",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border",
            "sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95 sm:data-open:fade-in-0",
            "sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-95 sm:data-closed:fade-out-0"
          )}
        >
          {/* Agarradera visual del bottom sheet — solo mobile, puramente
              decorativa (affordance de "se puede deslizar"). */}
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden" />

          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5 sm:px-5">
            <DialogPrimitive.Title className="text-base font-semibold text-foreground">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              render={<Button variant="ghost" size="icon-sm" aria-label="Cerrar" />}
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {/* key=resetToken: fuerza un mount nuevo por cada apertura. */}
            <BookingWidget
              key={resetToken}
              slug={slug}
              services={services}
              business={business}
              whatsappHref={whatsappHref}
              initialServiceId={initialServiceId}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
