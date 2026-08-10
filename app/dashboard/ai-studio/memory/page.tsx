"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Brain, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeleteIconButton } from "@/components/dashboard/delete-icon-button";
import { MemoryEntryDialog } from "@/components/ai-studio/memory-entry-dialog";
import { cn } from "@/lib/utils";
import { requestJson } from "@/lib/api-client";
import type { MemoryEntryFormValues } from "@/lib/schemas";
import { MEMORY_IMPORTANCE_META, type MemoryEntry } from "@/lib/types";

const IMPORTANCE_BADGE_VARIANT: Record<MemoryEntry["importance"], "secondary" | "outline" | "default"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
};

export default function MemoryPage() {
  const [entries, setEntries] = React.useState<MemoryEntry[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());

  function setItemDeleting(id: string, pending: boolean) {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  React.useEffect(() => {
    requestJson<{ entries: MemoryEntry[] }>("/api/ai-studio/memory")
      .then(({ entries }) => setEntries(entries))
      .catch(() => {
        setLoadError(true);
        toast.error("No pudimos cargar la memoria del negocio.");
      });
  }, []);

  async function addEntry(values: MemoryEntryFormValues) {
    try {
      const { entry } = await requestJson<{ entry: MemoryEntry }>("/api/ai-studio/memory", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setEntries((prev) => [entry, ...(prev ?? [])]);
      toast.success("Entrada agregada");
    } catch {
      toast.error("No pudimos agregar la entrada. Intentá de nuevo.");
    }
  }

  async function editEntry(id: string, values: MemoryEntryFormValues) {
    try {
      const { entry } = await requestJson<{ entry: MemoryEntry }>(`/api/ai-studio/memory/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setEntries((prev) => prev?.map((e) => (e.id === id ? entry : e)) ?? prev);
      toast.success("Entrada actualizada");
    } catch {
      toast.error("No pudimos actualizar la entrada. Intentá de nuevo.");
    }
  }

  async function toggleActive(entry: MemoryEntry) {
    const previous = entries;
    setEntries((prev) => prev?.map((e) => (e.id === entry.id ? { ...e, active: !e.active } : e)) ?? prev);
    try {
      await requestJson(`/api/ai-studio/memory/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: entry.title,
          content: entry.content,
          category: entry.category,
          importance: entry.importance,
          active: !entry.active,
        }),
      });
    } catch {
      setEntries(previous);
      toast.error("No pudimos actualizar la entrada.");
    }
  }

  async function removeEntry(id: string) {
    // No optimista: recién sacamos la entrada de la lista cuando el servidor
    // confirmó el borrado, para que DeleteIconButton pueda mostrar el
    // spinner/disabled mientras la card real sigue visible y atenuada.
    try {
      await requestJson(`/api/ai-studio/memory/${id}`, { method: "DELETE" });
      setEntries((prev) => prev?.filter((e) => e.id !== id) ?? prev);
      toast.success("Entrada eliminada");
    } catch {
      toast.error("No pudimos eliminar la entrada.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Memoria del negocio"
        description="Información que tu empleado usa automáticamente para responder: políticas, procedimientos, promociones y cualquier dato relevante."
        action={
          <MemoryEntryDialog
            onSubmit={addEntry}
            trigger={
              <Button>
                <Plus className="size-4" data-icon="inline-start" />
                Agregar
              </Button>
            }
          />
        }
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          No pudimos cargar la memoria del negocio. Recargá la página para volver a intentar.
        </div>
      ) : entries === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-muted/30" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Brain className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Todavía no agregaste memoria</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sumá políticas, procedimientos o cualquier dato que tu empleado deba conocer.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "rounded-xl border border-border bg-card p-4",
                  deletingIds.has(entry.id) && "pointer-events-none opacity-50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{entry.title}</h3>
                      <Badge variant="outline">{entry.category}</Badge>
                      <Badge variant={IMPORTANCE_BADGE_VARIANT[entry.importance]}>
                        {MEMORY_IMPORTANCE_META[entry.importance].label}
                      </Badge>
                    </div>
                    <p
                      className={cn(
                        "mt-1 text-sm text-muted-foreground",
                        !entry.active && "text-muted-foreground/60 line-through"
                      )}
                    >
                      {entry.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={entry.active}
                      onCheckedChange={() => void toggleActive(entry)}
                      aria-label={`Activar o desactivar: ${entry.title}`}
                      size="sm"
                    />
                    <MemoryEntryDialog
                      entry={entry}
                      onSubmit={(values) => editEntry(entry.id, values)}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar: ${entry.title}`}>
                          <Pencil className="size-3.5" />
                        </Button>
                      }
                    />
                    <DeleteIconButton
                      label={`Eliminar: ${entry.title}`}
                      onPendingChange={(pending) => setItemDeleting(entry.id, pending)}
                      onDelete={() => removeEntry(entry.id)}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
