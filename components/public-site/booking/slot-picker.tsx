"use client";

import { Loader2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Con pocos horarios, chips son mucho más rápidos de elegir que abrir un
// select (sección "Disponibilidad" de la tarea). Con muchos, una grilla de
// botones se vuelve incómoda — ahí un select sigue siendo lo más manejable.
// Puramente presentacional: nunca toca fetchSlots ni la lista de "slots" en
// sí, solo cambia CÓMO se elige un valor ya calculado por la lógica
// existente (ver components/public-site/booking-widget.tsx).
const CHIP_THRESHOLD = 12;

interface SlotPickerProps {
  slots: string[] | null;
  loading: boolean;
  value: string;
  onChange: (slot: string) => void;
}

export function SlotPicker({ slots, loading, value, onChange }: SlotPickerProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Buscando horarios disponibles…
      </div>
    );
  }

  if (!slots) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
        Elegí una fecha para ver los horarios.
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
        No hay horarios disponibles para esta fecha.
      </p>
    );
  }

  if (slots.length > CHIP_THRESHOLD) {
    return (
      <Select value={value} onValueChange={(slot) => slot && onChange(slot)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Elegí un horario" />
        </SelectTrigger>
        <SelectContent>
          {slots.map((slot) => (
            <SelectItem key={slot} value={slot}>
              {slot}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onChange(slot)}
          aria-pressed={value === slot}
          className={cn(
            "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
            value === slot
              ? "border-[var(--brand-primary,var(--primary))] bg-[var(--brand-primary,var(--primary))] text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-[var(--brand-primary,var(--primary))]/50"
          )}
        >
          {slot}
        </button>
      ))}
    </div>
  );
}
