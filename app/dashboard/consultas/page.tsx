"use client";

import * as React from "react";
import { toast } from "sonner";
import { Mail, MessageSquareText, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import { requestJson } from "@/lib/api-client";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import { formatRelativeTime } from "@/lib/utils";
import type { Inquiry } from "@/lib/types";

const STATUS_LABEL: Record<Inquiry["status"], string> = {
  NEW: "Nueva",
  IN_PROGRESS: "En curso",
  RESOLVED: "Resuelta",
};

const STATUS_BADGE: Record<Inquiry["status"], "default" | "secondary" | "outline"> = {
  NEW: "default",
  IN_PROGRESS: "secondary",
  RESOLVED: "outline",
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = React.useState<Inquiry[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ inquiries: Inquiry[] }>("/api/business/inquiries")
      .then(({ inquiries }) => setInquiries(inquiries))
      .catch(() => {
        setLoadError(true);
        toast.error("No pudimos cargar las consultas.");
      });
  }, []);

  async function changeStatus(id: string, status: Inquiry["status"]) {
    const previous = inquiries;
    setInquiries((prev) => prev?.map((i) => (i.id === id ? { ...i, status } : i)) ?? prev);
    try {
      await requestJson(`/api/business/inquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    } catch {
      setInquiries(previous);
      toast.error("No pudimos actualizar el estado.");
    }
  }

  return (
    <div>
      <PageHeader title="Consultas" description="Mensajes que tus clientes dejaron desde tu sitio web." />

      {inquiries === null && !loadError && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {loadError && <p className="text-sm text-muted-foreground">No pudimos cargar las consultas. Recargá la página.</p>}

      {inquiries?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
          <MessageSquareText className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Todavía no recibiste consultas.</p>
        </div>
      )}

      <div className="space-y-3">
        {inquiries?.map((inquiry) => {
          const whatsappHref = buildWhatsappHref(inquiry.customerWhatsapp);
          return (
            <div key={inquiry.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{inquiry.customerName}</p>
                    <Badge variant={STATUS_BADGE[inquiry.status]}>{STATUS_LABEL[inquiry.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(inquiry.createdAt)}</p>
                </div>
                <Select value={inquiry.status} onValueChange={(value) => changeStatus(inquiry.id, value as Inquiry["status"])}>
                  <SelectTrigger className="w-40" aria-label="Estado de la consulta">
                    <SelectValue>{(value: Inquiry["status"]) => STATUS_LABEL[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as Inquiry["status"][]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{inquiry.message}</p>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Phone className="size-4" />
                  {whatsappHref ? (
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {inquiry.customerWhatsapp}
                    </a>
                  ) : (
                    inquiry.customerWhatsapp
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="size-4" />
                  <a href={`mailto:${inquiry.customerEmail}`} className="underline underline-offset-2">
                    {inquiry.customerEmail}
                  </a>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
