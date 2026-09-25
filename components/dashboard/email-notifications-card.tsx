"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestJson } from "@/lib/api-client";
import type { EmailNotificationSettingsValues } from "@/lib/schemas";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Row({
  title,
  description,
  checked,
  onChange,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
      </div>
      {checked && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

// Sección "Notificaciones por email" (ver modules/email/). Endpoint propio:
// GET/PATCH /api/business/email-notifications, siempre scopeado a la sesión.
export function EmailNotificationsCard() {
  const [settings, setSettings] = React.useState<EmailNotificationSettingsValues | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ settings: EmailNotificationSettingsValues }>("/api/business/email-notifications")
      .then((data) => setSettings(data.settings))
      .catch(() => toast.error("No pudimos cargar las notificaciones por email."));
  }, []);

  if (!settings) {
    return <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />;
  }

  const update = (patch: Partial<EmailNotificationSettingsValues>) => setSettings({ ...settings, ...patch });

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const data = await requestJson<{ settings: EmailNotificationSettingsValues }>("/api/business/email-notifications", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
      toast.success("Cambios guardados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground">Notificaciones por email</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Los emails a tus clientes se envían solo si dejaron su email al reservar.
      </p>

      <div className="mt-5 divide-y divide-border">
        <Row
          title="Confirmación de reserva"
          description="El cliente recibe un email apenas reserva."
          checked={settings.bookingConfirmationEnabled}
          onChange={(v) => update({ bookingConfirmationEnabled: v })}
        />
        <Row
          title="Recordatorio de turno"
          description="Le avisamos al cliente antes de su turno."
          checked={settings.reminderEnabled}
          onChange={(v) => update({ reminderEnabled: v })}
        >
          <Select
            value={String(settings.reminderLeadMinutes)}
            onValueChange={(v) => update({ reminderLeadMinutes: v === "30" ? 30 : 60 })}
          >
            <SelectTrigger className="w-56" aria-label="Anticipación del recordatorio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutos antes</SelectItem>
              <SelectItem value="60">60 minutos antes</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row
          title="Resumen diario"
          description="Recibís por email la lista de turnos del día (hora de Argentina)."
          checked={settings.dailySummaryEnabled}
          onChange={(v) => update({ dailySummaryEnabled: v })}
        >
          <Select value={String(settings.dailySummaryHour)} onValueChange={(v) => update({ dailySummaryHour: Number(v) })}>
            <SelectTrigger className="w-56" aria-label="Hora del resumen diario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {formatHour(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
