"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requestJson } from "@/lib/api-client";
import type { Appointment, PaymentProof } from "@/lib/types";

interface PaymentDetail {
  appointment: Appointment;
  proofs: PaymentProof[];
  signedUrl: string | null;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(y, m - 1, d),
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

interface PaymentReviewDialogProps {
  appointmentId: string;
  trigger: React.ReactElement;
  onUpdated: (appointment: Appointment) => void;
}

// Detalle de reserva + comprobante + validación (ver sección 8 de la tarea).
// Cada apertura vuelve a pedir el detalle al servidor (incluida una signed
// URL nueva del comprobante, de corta duración — nunca se cachea ni se
// reusa entre aperturas, ver lib/payment-proofs.ts).
export function PaymentReviewDialog({ appointmentId, trigger, onUpdated }: PaymentReviewDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<PaymentDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showRejectReason, setShowRejectReason] = React.useState(false);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShowRejectReason(false);
    setReason("");
    requestJson<PaymentDetail>(`/api/appointments/${appointmentId}/payment`)
      .then(setDetail)
      .catch(() => toast.error("No pudimos cargar el detalle del pago."))
      .finally(() => setLoading(false));
  }, [open, appointmentId]);

  async function handleConfirm() {
    setBusy(true);
    try {
      const { appointment } = await requestJson<{ appointment: Appointment }>(
        `/api/appointments/${appointmentId}/payment/confirm`,
        { method: "POST" },
      );
      toast.success("Pago confirmado");
      onUpdated(appointment);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos confirmar el pago.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    try {
      const { appointment } = await requestJson<{ appointment: Appointment }>(
        `/api/appointments/${appointmentId}/payment/reject`,
        { method: "POST", body: JSON.stringify({ reason }) },
      );
      toast.success("Comprobante rechazado");
      onUpdated(appointment);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos rechazar el comprobante.");
    } finally {
      setBusy(false);
    }
  }

  const appointment = detail?.appointment;
  const latestProof = detail?.proofs[0] ?? null;
  const canReview = appointment?.status === "payment_submitted";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalle del pago</DialogTitle>
          <DialogDescription>Revisá el comprobante y confirmá o rechazá el pago.</DialogDescription>
        </DialogHeader>

        {loading || !appointment ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
              <p className="font-medium text-foreground">{appointment.customerName}</p>
              <p className="text-muted-foreground">{appointment.customerPhone}</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5">
                <dt className="text-muted-foreground">Servicio</dt>
                <dd className="text-right text-foreground">{appointment.serviceName}</dd>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="text-right text-foreground">
                  {formatDate(appointment.date)} · {appointment.startTime}
                </dd>
                {appointment.totalAmount != null && (
                  <>
                    <dt className="text-muted-foreground">Importe total</dt>
                    <dd className="text-right text-foreground">{formatMoney(appointment.totalAmount)}</dd>
                  </>
                )}
                {appointment.depositAmount != null && (
                  <>
                    <dt className="text-muted-foreground">Seña</dt>
                    <dd className="text-right text-foreground">{formatMoney(appointment.depositAmount)}</dd>
                  </>
                )}
              </dl>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground">Comprobante</h4>
              {!latestProof ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Todavía no recibimos un comprobante para este turno.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {detail?.signedUrl && latestProof.mimeType.startsWith("image/") ? (
                    <a href={detail.signedUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={detail.signedUrl}
                        alt="Comprobante de pago"
                        className="max-h-64 w-full rounded-lg border border-border object-contain"
                      />
                    </a>
                  ) : detail?.signedUrl ? (
                    <a
                      href={detail.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground hover:bg-muted"
                    >
                      <FileText className="size-4" />
                      Ver comprobante ({latestProof.mimeType})
                    </a>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {latestProof.originalFileName ?? "Sin nombre"} · {formatFileSize(latestProof.fileSizeBytes)} ·
                    Recibido {new Date(latestProof.uploadedAt).toLocaleString("es-AR")}
                  </p>
                  {appointment.status === "payment_rejected" && latestProof.rejectionReason && (
                    <p className="rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
                      Motivo del rechazo: {latestProof.rejectionReason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {canReview && (
              <div className="space-y-3">
                {showRejectReason && (
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder='Motivo (opcional). Ej: "El comprobante no es legible."'
                    rows={2}
                  />
                )}
                <DialogFooter>
                  {!showRejectReason ? (
                    <Button type="button" variant="outline" onClick={() => setShowRejectReason(true)} disabled={busy}>
                      Rechazar comprobante
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => void handleReject()} disabled={busy}>
                      {busy && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
                      Confirmar rechazo
                    </Button>
                  )}
                  <Button type="button" onClick={() => void handleConfirm()} disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
                    Confirmar pago
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
