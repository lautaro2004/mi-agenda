"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

// Barra fija inferior, solo mobile (sección 16 de la tarea: gran parte del
// tráfico llega desde WhatsApp, el CTA de reservar tiene que ser siempre
// fácil de encontrar sin tener que scrollear hasta arriba). Ancla directo a
// la sección embebida de reserva — nunca duplica el widget.
export function BookingStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur-md sm:hidden">
      <Button
        className="h-11 w-full bg-[var(--brand-primary,var(--primary))] text-base hover:bg-[var(--brand-primary,var(--primary))]/90"
        render={<a href="#reservar" />}
        nativeButton={false}
      >
        Reservar ahora
        <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
      </Button>
    </div>
  );
}
