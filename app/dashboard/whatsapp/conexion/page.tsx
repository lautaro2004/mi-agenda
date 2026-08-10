"use client";

import Image from "next/image";
import { CheckCircle2, Loader2, MessageSquare, Smartphone, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionStatusBadge } from "@/components/whatsapp/connection-status-badge";
import { useWhatsApp } from "@/lib/whatsapp-store";

const LINK_STEPS = [
  "Abrí WhatsApp en tu teléfono",
  "Tocá Menú o Configuración y elegí Dispositivos vinculados",
  "Tocá Vincular un dispositivo",
  "Apuntá tu teléfono hacia esta pantalla para escanear el código",
];

export default function WhatsAppConnectionPage() {
  const { state, loading, connect, disconnect, setAiEnabled } = useWhatsApp();
  const { connection } = state;

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Conexión"
          description="Vinculá el WhatsApp de tu negocio para que Mi Agenda pueda responder a tus clientes."
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <Skeleton className="h-72 rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Conexión"
        description="Vinculá el WhatsApp de tu negocio para que Mi Agenda pueda responder a tus clientes."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">Estado de la conexión</h3>
            <ConnectionStatusBadge status={connection.status} />
          </div>

          {connection.status === "disconnected" && (
            <div className="mt-6 flex flex-col items-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <MessageSquare className="size-6" />
              </div>
              <h4 className="mt-4 text-base font-semibold text-foreground">Tu WhatsApp no está conectado</h4>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Conectá el WhatsApp de tu negocio para que Mi Agenda pueda recibir y responder mensajes
                automáticamente.
              </p>
              <Button className="mt-6" onClick={connect}>
                Conectar WhatsApp
              </Button>
            </div>
          )}

          {(connection.status === "connecting" || connection.status === "reconnecting") && (
            <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
              {connection.qr ? (
                <div className="inline-flex rounded-2xl bg-white p-4 shadow-sm">
                  <Image
                    src={connection.qr}
                    alt="Código QR para vincular WhatsApp"
                    width={224}
                    height={224}
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex aspect-square w-56 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="flex max-w-sm flex-col gap-3">
                <p className="text-sm font-medium text-foreground">
                  {connection.status === "reconnecting"
                    ? "Reconectando con WhatsApp…"
                    : "Escaneá el código con tu teléfono"}
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {LINK_STEPS.map((step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="text-sm text-muted-foreground">
                  {connection.status === "reconnecting"
                    ? "Intentando restablecer la sesión automáticamente…"
                    : "Esperando que escanees el código…"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={disconnect}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {connection.status === "connected" && (
            <div className="mt-6 flex flex-col items-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-6" />
              </div>
              <h4 className="mt-4 text-base font-semibold text-foreground">WhatsApp conectado</h4>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                <Smartphone className="size-4 text-muted-foreground" />
                {connection.phoneNumber}
              </div>
              {connection.connectedAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Conectado desde el{" "}
                  {new Date(connection.connectedAt).toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              <Button variant="outline" className="mt-6" onClick={disconnect}>
                Desconectar
              </Button>
            </div>
          )}

          {connection.status === "error" && (
            <div className="mt-6 flex flex-col items-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <XCircle className="size-6" />
              </div>
              <h4 className="mt-4 text-base font-semibold text-foreground">No pudimos conectar tu WhatsApp</h4>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{connection.lastError}</p>
              <Button className="mt-6" onClick={connect}>
                Reintentar
              </Button>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-8 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Respuestas automáticas</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuando está activado, la IA responde automáticamente a tus clientes por WhatsApp.
                </p>
              </div>
              <Switch
                checked={connection.aiEnabled}
                onCheckedChange={setAiEnabled}
                aria-label="Activar respuestas automáticas"
              />
            </div>
            {!connection.aiEnabled && (
              <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Modo manual activado: vas a tener que responder todas las conversaciones vos mismo.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Etiquetas de conversación</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada conversación se clasifica automáticamente para ayudarte a priorizar tu atención: consulta de
              servicio, solicitud de turno, precios, requiere humano y spam.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
