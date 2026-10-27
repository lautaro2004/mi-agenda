"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";
import { requestJson } from "@/lib/api-client";
import {
  BOOKING_MODE_LABEL,
  DEFAULT_SMART_BOOKING_RULES,
  smartBookingRulesSchema,
  type BookingMode,
  type SmartBookingRules,
  type TimeRange,
} from "@/lib/smart-booking";
import { cn } from "@/lib/utils";

interface RulesResponse {
  rules: SmartBookingRules;
  allowed: boolean;
}

const MODES: { value: BookingMode; description: string }[] = [
  {
    value: "assisted",
    description: "Prioriza tus horarios convenientes y propone alternativas. Confirma solo lo que cumple tus reglas; lo que sea una excepción te lo consulta.",
  },
  {
    value: "auto",
    description: "Ofrece solo horarios válidos y confirma la reserva sin intervención tuya, salvo los horarios que marques como \"requieren aprobación\".",
  },
  {
    value: "manual",
    description: "Recibe la solicitud y reserva el horario, pero no confirma nada hasta que lo apruebes vos.",
  },
];

// ── Editor de rangos horarios ───────────────────────────────────────────────

function RangeListEditor({
  ranges,
  onChange,
  disabled,
  addLabel,
  emptyLabel,
}: {
  ranges: TimeRange[];
  onChange: (next: TimeRange[]) => void;
  disabled: boolean;
  addLabel: string;
  emptyLabel: string;
}) {
  const update = (index: number, patch: Partial<TimeRange>) =>
    onChange(ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {ranges.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}
      {ranges.map((range, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">De</span>
          <Input
            type="time"
            aria-label="Desde"
            value={range.from}
            disabled={disabled}
            onChange={(e) => update(index, { from: e.target.value })}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">a</span>
          <Input
            type="time"
            aria-label="Hasta"
            value={range.to}
            disabled={disabled}
            onChange={(e) => update(index, { to: e.target.value })}
            className="w-28"
          />
          <button
            type="button"
            aria-label="Quitar rango"
            disabled={disabled}
            onClick={() => onChange(ranges.filter((_, i) => i !== index))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      {ranges.length < 8 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...ranges, { from: "17:00", to: "20:00" }])}
        >
          <Plus className="size-3.5" data-icon="inline-start" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function NumberRow({
  label,
  hint,
  value,
  min,
  max,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="w-20"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export default function SmartBookingPage() {
  const [rules, setRules] = React.useState<SmartBookingRules | null>(null);
  const [allowed, setAllowed] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");
  const [interpreting, setInterpreting] = React.useState(false);
  const [proposal, setProposal] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    requestJson<RulesResponse>("/api/business/smart-booking")
      .then((data) => {
        setRules(data.rules ?? DEFAULT_SMART_BOOKING_RULES);
        setAllowed(data.allowed);
      })
      .catch(() => {
        setLoadError(true);
        toast.error("No pudimos cargar la configuración.");
      });
  }, []);

  const set = <K extends keyof SmartBookingRules>(key: K, value: SmartBookingRules[K]) =>
    setRules((prev) => (prev ? { ...prev, [key]: value } : prev));

  // La IA solo propone: carga las reglas en el formulario SIN guardar. El dueño
  // revisa los cambios y confirma con "Guardar cambios".
  async function interpret() {
    const text = instruction.trim();
    if (!text || interpreting) return;
    setInterpreting(true);
    setProposal(null);
    try {
      const data = await requestJson<{ ok: boolean; rules?: SmartBookingRules; changes?: string[]; message?: string }>(
        "/api/business/smart-booking/interpret",
        { method: "POST", body: JSON.stringify({ instruction: text }) }
      );
      if (data.ok && data.rules) {
        setRules(data.rules);
        setProposal(data.changes ?? []);
      } else {
        toast.info(data.message ?? "No encontré cambios para proponer.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos interpretar la instrucción.");
    } finally {
      setInterpreting(false);
    }
  }

  async function save() {
    if (!rules) return;
    const parsed = smartBookingRulesSchema.safeParse(rules);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá los valores ingresados.");
      return;
    }
    setSaving(true);
    try {
      await requestJson("/api/business/smart-booking", { method: "PUT", body: JSON.stringify({ rules: parsed.data, instructions: instruction.trim() || undefined }) });
      setProposal(null);
      toast.success("Reglas guardadas. Se aplican a las reservas nuevas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar las reglas.");
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !allowed;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Agenda inteligente"
        description="Definí cómo querés organizar tus turnos. Las mismas reglas se aplican a todas las reservas de tus clientes."
        action={
          <Button onClick={() => void save()} disabled={!rules || readOnly || saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        }
      />

      {loadError && <p className="text-sm text-destructive">No pudimos cargar la configuración. Recargá la página.</p>}

      {!rules && !loadError && (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}

      {rules && (
        <div className="space-y-5">
          {readOnly && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Tu plan actual no incluye la agenda inteligente</p>
                <p className="mt-1 text-muted-foreground">
                  Está disponible desde el plan Esencial+. Tus reglas guardadas se conservan, pero no se aplican hasta que mejores tu plan.
                </p>
                <Button size="sm" className="mt-3" render={<Link href="/dashboard/suscripcion" />} nativeButton={false}>
                  Ver planes
                </Button>
              </div>
            </div>
          )}

          {!readOnly && (
            <Section title="Contale a la IA cómo trabajás" description="Escribí en tus palabras y proponemos las reglas. Nada se guarda hasta que lo revises y confirmes.">
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value.slice(0, 1000))}
                placeholder="Ej: quiero llenar primero de 17 a 21, el mediodía lo dejo libre para atención espontánea y necesito 10 minutos entre turnos."
                rows={3}
              />
              <Button size="sm" variant="outline" className="mt-3" onClick={() => void interpret()} disabled={!instruction.trim() || interpreting}>
                <Sparkles className="size-4" /> {interpreting ? "Interpretando…" : "Proponer reglas"}
              </Button>
              {proposal && (
                <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-medium text-foreground">Propuesta (sin guardar). Revisala y tocá &ldquo;Guardar cambios&rdquo;:</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {proposal.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          <Section title="Modo de gestión" description="Cuánta intervención querés tener en cada reserva.">
            <div className="grid gap-3">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => set("mode", mode.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    rules.mode === mode.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{BOOKING_MODE_LABEL[mode.value]}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{mode.description}</p>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Horarios que preferís" description="Los llenamos primero. Los demás horarios disponibles se siguen ofreciendo, pero después.">
            <RangeListEditor
              ranges={rules.preferredRanges}
              onChange={(next) => set("preferredRanges", next)}
              disabled={readOnly}
              addLabel="Agregar horario preferido"
              emptyLabel="Sin preferencia: se ofrecen todos los horarios por igual."
            />
            <ToggleRow
              label="Llenar la agenda de corrido"
              hint="Prioriza horarios pegados a un turno que ya tenés, sin huecos."
              checked={rules.consecutivePriority}
              disabled={readOnly}
              onChange={(v) => set("consecutivePriority", v)}
            />
            <ToggleRow
              label="Proponer primero un horario preferido más temprano"
              hint="Si alguien pide un horario fuera de tus preferidos y puede cambiarlo, se le pregunta primero por uno mejor."
              checked={rules.earlyAlternatives}
              disabled={readOnly}
              onChange={(v) => set("earlyAlternatives", v)}
            />
          </Section>

          <Section
            title="Espacios para clientes espontáneos"
            description="Estos horarios no se ofrecen online. Vos podés agendar ahí desde el panel."
          >
            <RangeListEditor
              ranges={rules.reservedRanges}
              onChange={(next) => set("reservedRanges", next)}
              disabled={readOnly}
              addLabel="Reservar un espacio"
              emptyLabel="No reservás ningún espacio."
            />
          </Section>

          <Section title="Margen entre servicios">
            <NumberRow
              label="Tiempo libre entre un turno y el siguiente"
              hint="Para limpiar, descansar o prepararte. 0 = sin margen."
              value={rules.bufferMinutes}
              min={0}
              max={120}
              suffix="min"
              disabled={readOnly}
              onChange={(v) => set("bufferMinutes", v)}
            />
          </Section>

          <Section
            title="Aprobación"
            description="Para estos casos la reserva queda pendiente, el horario se guarda y vos decidís desde Turnos."
          >
            <ToggleRow
              label="Pedir aprobación fuera de mis horarios preferidos"
              checked={rules.approvalOutsidePreferred}
              disabled={readOnly || rules.preferredRanges.length === 0}
              hint={rules.preferredRanges.length === 0 ? "Primero definí tus horarios preferidos." : undefined}
              onChange={(v) => set("approvalOutsidePreferred", v)}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Horarios que siempre requieren aprobación</p>
              <RangeListEditor
                ranges={rules.approvalRanges}
                onChange={(next) => set("approvalRanges", next)}
                disabled={readOnly}
                addLabel="Agregar horario"
                emptyLabel="Ninguno."
              />
            </div>
            <NumberRow
              label="Esperar tu respuesta hasta"
              hint="Pasado este tiempo la solicitud se cancela y el horario se libera."
              value={rules.approvalTimeoutHours}
              min={1}
              max={168}
              suffix="horas"
              disabled={readOnly}
              onChange={(v) => set("approvalTimeoutHours", v)}
            />
            <NumberRow
              label="Dejar de esperar antes del turno"
              hint="Si falta menos que esto para el turno, la solicitud vence antes."
              value={rules.approvalMinLeadHours}
              min={0}
              max={72}
              suffix="horas"
              disabled={readOnly}
              onChange={(v) => set("approvalMinLeadHours", v)}
            />
            {rules.mode === "manual" && (
              <p className="text-xs text-muted-foreground">
                En modo manual todas las reservas esperan tu aprobación, sin importar el horario.
              </p>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
