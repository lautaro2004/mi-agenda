"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface ResourceOption {
  id: string;
  name: string;
  available: boolean;
}

interface ResourcePickerProps {
  loading: boolean;
  // null = todavía no se consultó / el servicio no usa recursos (no se
  // renderiza nada). Array (incluso vacío mientras carga) = sí aplica.
  options: ResourceOption[] | null;
  // null/undefined = "asignar automáticamente".
  value: string | null | undefined;
  onChange: (resourceId: string | null) => void;
}

// Selector de recurso compartido entre "Agendar turno" y "Reprogramar" — a
// propósito no hay una segunda versión de esto en ningún lado.
export function ResourcePicker({ loading, options, value, onChange }: ResourcePickerProps) {
  const groupName = React.useId();

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Revisando recursos disponibles…
      </p>
    );
  }

  if (!options || options.length === 0) return null;

  return (
    <Field>
      <FieldLabel>Recurso</FieldLabel>
      <FieldDescription>Este servicio usa varios recursos intercambiables.</FieldDescription>
      <div className="mt-1.5 space-y-1.5">
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <input type="radio" name={groupName} checked={!value} onChange={() => onChange(null)} />
          Asignar automáticamente
        </label>
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm",
              !option.available && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name={groupName}
                disabled={!option.available}
                checked={value === option.id}
                onChange={() => onChange(option.id)}
              />
              {option.name}
            </span>
            <span className={cn("text-xs", option.available ? "text-muted-foreground" : "text-destructive")}>
              {option.available ? "Disponible" : "Ocupado"}
            </span>
          </label>
        ))}
      </div>
    </Field>
  );
}
