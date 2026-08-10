"use client";

import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DeleteIconButtonProps {
  onDelete: () => Promise<void>;
  label: string;
  // Deja que la card que envuelve este botón (ej. un service/FAQ/memory item)
  // se atenúe mientras el borrado está en curso — el botón no sabe nada de
  // esa card, solo avisa cuándo empieza y termina. Así el mismo botón sirve
  // tanto para items sin card (listas de texto simples) como con card.
  onPendingChange?: (pending: boolean) => void;
  className?: string;
}

// Botón de borrado reutilizable: se auto-deshabilita y muestra spinner
// mientras la promesa está en curso (evita doble click y "no sé si pasó
// algo"), y vuelve a quedar clickeable si falla, para poder reintentar.
// Si onDelete resuelve con éxito, el caller es quien saca el item de la
// lista — este componente no asume nada sobre dónde vive esa lista.
export function DeleteIconButton({ onDelete, label, onPendingChange, className }: DeleteIconButtonProps) {
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    onPendingChange?.(true);
    try {
      await onDelete();
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("text-destructive", className)}
      onClick={() => void handleClick()}
      disabled={pending}
      aria-label={label}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
