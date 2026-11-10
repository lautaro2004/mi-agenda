"use client";

import * as React from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { requestJson } from "@/lib/api-client";

type Status = "open" | "in_progress" | "resolved";
interface Ticket {
  id: string;
  businessName: string;
  userName: string;
  userEmail: string;
  product: string;
  subject: string | null;
  message: string;
  pagePath: string | null;
  userAgent: string | null;
  status: Status;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const STATUS_LABEL: Record<Status, string> = { open: "Abierto", in_progress: "En curso", resolved: "Resuelto" };
const FILTERS: { value: "" | Status; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "open", label: "Abiertos" },
  { value: "in_progress", label: "En curso" },
  { value: "resolved", label: "Resueltos" },
];
const dateTime = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function SuperadminSupportPage() {
  const [filter, setFilter] = React.useState<"" | Status>("open");
  const [tickets, setTickets] = React.useState<Ticket[] | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setTickets(null);
    requestJson<{ tickets: Ticket[] }>(`/api/superadmin/tickets${filter ? `?status=${filter}` : ""}`)
      .then(({ tickets }) => {
        setTickets(tickets);
        setNotes(Object.fromEntries(tickets.map((t) => [t.id, t.adminNote ?? ""])));
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "No se pudieron cargar los pedidos.");
        setTickets([]);
      });
  }, [filter]);

  React.useEffect(load, [load]);

  async function save(id: string, patch: { status?: Status; adminNote?: string }) {
    setSavingId(id);
    try {
      await requestJson(`/api/superadmin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      toast.success("Guardado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Soporte" description="Pedidos de ayuda que mandan las personas desde Nodo." />

      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Filtrar por estado">
        {FILTERS.map((f) => (
          <Button key={f.value || "all"} size="sm" variant={filter === f.value ? "default" : "outline"} onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      {tickets === null ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : tickets.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">No hay pedidos en este estado.</p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{t.subject || "Sin asunto"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.businessName} · {t.userName} · <span className="select-all">{t.userEmail}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.status === "resolved" ? "secondary" : "default"}>{STATUS_LABEL[t.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{dateTime.format(new Date(t.createdAt))}</span>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-foreground">{t.message}</p>
              <p className="mt-2 text-xs text-muted-foreground break-all">
                {t.product === "nodo" ? "Nodo" : t.product}
                {t.pagePath ? ` · ${t.pagePath}` : ""}
                {t.userAgent ? ` · ${t.userAgent}` : ""}
              </p>

              <Textarea
                className="mt-3"
                rows={2}
                placeholder="Nota interna (solo la ves vos)"
                value={notes[t.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={savingId === t.id} onClick={() => save(t.id, { adminNote: notes[t.id] ?? "" })}>
                  Guardar nota
                </Button>
                {t.status !== "in_progress" && (
                  <Button size="sm" variant="outline" disabled={savingId === t.id} onClick={() => save(t.id, { status: "in_progress" })}>
                    Marcar en curso
                  </Button>
                )}
                {t.status !== "resolved" ? (
                  <Button size="sm" disabled={savingId === t.id} onClick={() => save(t.id, { status: "resolved" })}>
                    Marcar resuelto
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={savingId === t.id} onClick={() => save(t.id, { status: "open" })}>
                    Reabrir
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
