"use client";

import * as React from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import type { LeadQualificationSettings } from "@/lib/types";

const PLACEHOLDER =
  "Ej: Dueños de locales gastronómicos (restaurantes, pizzerías, cafeterías, heladerías) de CABA o GBA que todavía no venden por Rappi y quieren sumarse. No sirven: clientes que quieren pedir comida, repartidores buscando trabajo, locales fuera de AMBA.";

// Configuración de la calificación con IA de los leads de WhatsApp. Vive en
// Consultas porque es donde se ve el resultado (Analizando / Calificado /
// Descartado). Ver modules/inquiries/qualification.ts.
export function LeadQualificationCard() {
  const [settings, setSettings] = React.useState<LeadQualificationSettings | null>(null);
  const [draft, setDraft] = React.useState<LeadQualificationSettings>({ enabled: false, idealProfile: "" });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ settings: LeadQualificationSettings }>("/api/business/lead-qualification")
      .then(({ settings }) => {
        setSettings(settings);
        setDraft(settings);
      })
      .catch(() => toast.error("No pudimos cargar la configuración de calificación."));
  }, []);

  const dirty = settings !== null && (draft.enabled !== settings.enabled || draft.idealProfile !== settings.idealProfile);

  async function save() {
    setSaving(true);
    try {
      const { settings: saved } = await requestJson<{ settings: LeadQualificationSettings }>(
        "/api/business/lead-qualification",
        { method: "PUT", body: JSON.stringify(draft) }
      );
      setSettings(saved);
      setDraft(saved);
      toast.success(saved.enabled ? "Calificación activada." : "Calificación guardada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (settings === null) {
    return <Skeleton className="mb-6 h-28 w-full rounded-xl" />;
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Sparkles className="size-4" />
            Calificación de leads con IA
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            La IA lee cada chat nuevo de WhatsApp (aunque no esté respondiendo) y lo compara con tu cliente ideal. A Nodo
            solo pasan los calificados; los descartados quedan acá por si querés revisarlos.
          </p>
        </div>
        <Switch
          checked={draft.enabled}
          onCheckedChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
          aria-label="Activar calificación de leads"
        />
      </div>

      {(draft.enabled || draft.idealProfile) && (
        <div className="mt-4">
          <label htmlFor="lead-ideal-profile" className="text-sm font-medium text-foreground">
            ¿Qué tipo de contacto te sirve?
          </label>
          <Textarea
            id="lead-ideal-profile"
            rows={4}
            className="mt-1.5"
            placeholder={PLACEHOLDER}
            value={draft.idealProfile}
            maxLength={2000}
            onChange={(e) => setDraft((d) => ({ ...d, idealProfile: e.target.value }))}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Cuanto más concreto (rubro, zona, qué busca y qué no te sirve), mejor califica. Cada análisis consume uso de IA.
          </p>
        </div>
      )}

      {dirty && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft(settings)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      )}
    </div>
  );
}
