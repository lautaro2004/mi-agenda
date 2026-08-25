"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { useBookingModal } from "@/components/public-site/booking/booking-modal-context";

interface BookingTriggerProps extends React.ComponentProps<typeof Button> {
  // Servicio a preseleccionar (ej. "Reservar" en una card de servicio
  // puntual) — ausente cuando se abre desde un CTA genérico (header, hero,
  // CTA de cierre de página), donde BookingWidget arranca mostrando la
  // selección de servicio primero.
  serviceId?: string;
}

// Reemplaza los <Button render={<Link href={bookingHref}/>}> que antes
// navegaban a /s/[slug]/reservar — cualquier CTA de reserva abre ahora el
// mismo modal en vez de sacar al visitante del sitio (ver auditoría: esa
// navegación completa, con su propio round-trip a Postgres, era la causa
// real de la sensación de lentitud). Un <button> nativo común, sin "render"
// polimórfico: nunca navega, solo abre el modal.
export function BookingTrigger({ serviceId, onClick, ...props }: BookingTriggerProps) {
  const { openBookingModal } = useBookingModal();

  return (
    <Button
      type="button"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        openBookingModal(serviceId);
      }}
    />
  );
}
