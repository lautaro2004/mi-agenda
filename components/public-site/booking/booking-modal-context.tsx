"use client";

import * as React from "react";

import { BookingModal } from "@/components/public-site/booking/booking-modal";
import type { Business, Service } from "@/lib/types";

interface BookingModalContextValue {
  openBookingModal: (serviceId?: string) => void;
}

const BookingModalContext = React.createContext<BookingModalContextValue | null>(null);

export function useBookingModal(): BookingModalContextValue {
  const ctx = React.useContext(BookingModalContext);
  if (!ctx) {
    throw new Error("useBookingModal debe usarse dentro de un BookingModalProvider.");
  }
  return ctx;
}

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

interface BookingModalProviderProps {
  slug: string;
  services: Service[];
  business: BookingBusiness;
  whatsappHref: string | null;
  title?: string;
  children: React.ReactNode;
}

// Único punto que monta <BookingModal> para toda la página pública — el
// header (compartido por los dos templates) y cualquier otro CTA disparan
// la apertura desde acá vía useBookingModal(), así nunca hay más de una
// instancia del modal viva a la vez, sin importar desde qué botón se abrió
// (ver sección "Objetivo" de la tarea: cualquier CTA de reserva abre el
// mismo modal). BookingWidget adentro es EXACTAMENTE el mismo componente que
// ya usaba /s/[slug]/reservar — no se duplica ninguna lógica de reservas.
export function BookingModalProvider({
  slug,
  services,
  business,
  whatsappHref,
  title,
  children,
}: BookingModalProviderProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [initialServiceId, setInitialServiceId] = React.useState<string | undefined>(undefined);
  // Se incrementa en cada apertura (nunca en cada re-render) — se lo pasamos
  // a BookingModal como "key" de su contenido para que el formulario monte
  // de cero cada vez, sin quedar pegado en el estado de éxito de una reserva
  // anterior ni en un servicio preseleccionado viejo.
  const [openToken, setOpenToken] = React.useState(0);

  const openBookingModal = React.useCallback((serviceId?: string) => {
    setInitialServiceId(serviceId);
    setOpenToken((token) => token + 1);
    setIsOpen(true);
  }, []);

  return (
    <BookingModalContext.Provider value={{ openBookingModal }}>
      {children}
      <BookingModal
        slug={slug}
        services={services}
        business={business}
        whatsappHref={whatsappHref}
        title={title}
        open={isOpen}
        onOpenChange={setIsOpen}
        initialServiceId={initialServiceId}
        resetToken={openToken}
      />
    </BookingModalContext.Provider>
  );
}
