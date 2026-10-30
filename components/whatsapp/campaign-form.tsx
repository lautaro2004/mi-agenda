"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Copy, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_CHANNEL_LABEL,
  CAMPAIGN_FIELD_KEYS,
  CAMPAIGN_FIELD_LABEL,
  CAMPAIGN_GOALS,
  CAMPAIGN_GOAL_HELP,
  CAMPAIGN_GOAL_LABEL,
  defaultFieldsForGoal,
  type CampaignChannel,
  type CampaignConfig,
  type CampaignField,
  type CampaignGoal,
  type CampaignStatus,
} from "@/lib/campaigns";
import { requestJson } from "@/lib/api-client";
import { buildCampaignSection } from "@/modules/ai/prompt/campaign";
import { planFromFields, questionFor, startDraft } from "@/modules/ai/proposal/draft";

const STEPS = [
  "General",
  "Anuncio",
  "Contexto comercial",
  "Objetivo",
  "Datos a recopilar",
  "Destino de los leads",
  "Revisión",
] as const;

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

interface FormState {
  name: string;
  description: string;
  channel: CampaignChannel;
  prefilledMessage: string;
  variantsText: string;
  keywordsText: string;
  adDescription: string;
  promotedService: string;
  targetAudience: string;
  problemSolved: string;
  agentKnowledge: string;
  tone: string;
  doNotPromise: string;
  goal: CampaignGoal;
  secondaryBooking: boolean;
  fields: CampaignField[];
  syncNodo: boolean;
  createOpportunity: boolean;
  initialLeadStatus: "NEW" | "IN_PROGRESS";
}

function fromConfig(c?: CampaignConfig): FormState {
  const goal = c?.goal ?? "proposal_request";
  return {
    name: c?.name ?? "",
    description: c?.description ?? "",
    channel: c?.channel ?? "instagram",
    prefilledMessage: c?.prefilledMessage ?? "",
    variantsText: (c?.messageVariants ?? []).join("\n"),
    keywordsText: (c?.keywords ?? []).join("\n"),
    adDescription: c?.adDescription ?? "",
    promotedService: c?.promotedService ?? "",
    targetAudience: c?.targetAudience ?? "",
    problemSolved: c?.problemSolved ?? "",
    agentKnowledge: c?.agentKnowledge ?? "",
    tone: c?.tone ?? "",
    doNotPromise: c?.doNotPromise ?? "",
    goal,
    secondaryBooking: c?.secondaryGoal === "booking",
    fields: c?.fields?.length ? c.fields : defaultFieldsForGoal(goal),
    syncNodo: c?.syncNodo ?? true,
    createOpportunity: c?.createOpportunity ?? false,
    initialLeadStatus: c?.initialLeadStatus ?? "NEW",
  };
}

const lines = (text: string) => text.split(/\n|,/).map((s) => s.trim()).filter(Boolean);

function toPayload(f: FormState, status: CampaignStatus) {
  return {
    name: f.name,
    description: f.description,
    status,
    channel: f.channel,
    prefilledMessage: f.prefilledMessage,
    messageVariants: f.variantsText.split("\n").map((s) => s.trim()).filter(Boolean),
    keywords: lines(f.keywordsText),
    adDescription: f.adDescription,
    promotedService: f.promotedService,
    targetAudience: f.targetAudience,
    problemSolved: f.problemSolved,
    agentKnowledge: f.agentKnowledge,
    tone: f.tone,
    doNotPromise: f.doNotPromise,
    goal: f.goal,
    secondaryGoal: f.secondaryBooking && f.goal !== "booking" ? "booking" : null,
    fields: f.fields,
    syncNodo: f.syncNodo,
    createOpportunity: f.createOpportunity,
    initialLeadStatus: f.initialLeadStatus,
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{title}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export function CampaignForm({ initial }: { initial?: CampaignConfig }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => fromConfig(initial));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState<null | "draft" | "active">(null);
  const [fieldsTouched, setFieldsTouched] = useState(!!initial?.fields?.length);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = !!initial;
  const wasActive = initial?.status === "active";

  function changeGoal(goal: CampaignGoal) {
    setForm((prev) => ({ ...prev, goal, secondaryBooking: goal === "booking" ? false : prev.secondaryBooking, fields: fieldsTouched ? prev.fields : defaultFieldsForGoal(goal) }));
  }

  function toggleField(key: CampaignField["key"], on: boolean) {
    setFieldsTouched(true);
    setForm((prev) => ({
      ...prev,
      fields: on ? [...prev.fields, { key, required: false, ...(key === "custom" ? { label: "" } : {}) }] : prev.fields.filter((f) => f.key !== key),
    }));
  }
  function patchField(key: CampaignField["key"], patch: Partial<CampaignField>) {
    setFieldsTouched(true);
    setForm((prev) => ({ ...prev, fields: prev.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  }

  const preview = useMemo(() => {
    const plan = planFromFields(form.fields, { goal: form.goal === "lead_capture" ? "lead" : form.goal === "human_handoff" ? "handoff" : "proposal" });
    const sample = form.prefilledMessage.trim() || "Hola, quiero más información";
    const draft = startDraft({ firstMessage: sample, profileName: null, plan, campaign: { id: "preview", name: form.name || "Campaña" } });
    const firstQuestion = questionFor(draft.pending, draft, { first: true });
    const config = { ...(initial ?? ({} as CampaignConfig)), ...toPayload(form, "active"), id: "preview", businessId: "", createdAt: "", updatedAt: "" } as unknown as CampaignConfig;
    const context = buildCampaignSection({ campaign: config, method: "prefilled_message", draft: null, hasBookableServices: true });
    return { firstQuestion, context, sample };
  }, [form, initial]);

  async function save(status: CampaignStatus) {
    setSaving(status === "active" ? "active" : "draft");
    try {
      const payload = toPayload(form, status);
      const res = isEdit
        ? await requestJson<{ campaign: CampaignConfig }>(`/api/whatsapp/campaigns/${initial.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await requestJson<{ campaign: CampaignConfig }>("/api/whatsapp/campaigns", { method: "POST", body: JSON.stringify(payload) });
      toast.success(status === "active" ? "Campaña activa." : "Campaña guardada.");
      router.push("/dashboard/whatsapp/campanas");
      router.refresh();
      return res;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar la campaña.");
    } finally {
      setSaving(null);
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(form.prefilledMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No pudimos copiar. Seleccionalo y copialo a mano.");
    }
  }

  const fieldOf = (key: CampaignField["key"]) => form.fields.find((f) => f.key === key);

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Pasos">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${i === step ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <Card className="space-y-5 p-5">
        {step === 0 && (
          <>
            <Section title="Nombre interno" hint="Solo lo ves vos. Ej.: «Desarrollo web – Instagram octubre».">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Nombre de la campaña" />
            </Section>
            <Section title="Descripción (opcional)">
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={300} rows={2} />
            </Section>
            <Section title="Canal del anuncio">
              <select className={SELECT_CLASS} value={form.channel} onChange={(e) => set("channel", e.target.value as CampaignChannel)}>
                {CAMPAIGN_CHANNELS.map((c) => (
                  <option key={c} value={c}>{CAMPAIGN_CHANNEL_LABEL[c]}</option>
                ))}
              </select>
            </Section>
          </>
        )}

        {step === 1 && (
          <>
            <Section title="Mensaje precargado de WhatsApp" hint="Es el texto que aparece escrito cuando alguien toca el botón de WhatsApp del anuncio. Con él identificamos de qué campaña viene la persona.">
              <Textarea value={form.prefilledMessage} onChange={(e) => set("prefilledMessage", e.target.value)} maxLength={300} rows={2} placeholder="Hola, vi el anuncio y quiero una web para mi negocio" />
            </Section>
            {form.prefilledMessage.trim() && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Para usar en Meta Ads</p>
                <p className="mt-1 text-muted-foreground">Copiá este texto y pegalo como <strong>mensaje inicial</strong> (mensaje de bienvenida / texto predeterminado) del anuncio con botón de WhatsApp.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-2 py-1.5 text-xs break-words">{form.prefilledMessage}</code>
                  <Button type="button" size="sm" variant="outline" onClick={copyMessage}>
                    {copied ? <Check className="size-4" data-icon="inline-start" /> : <Copy className="size-4" data-icon="inline-start" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  La persona puede editar el mensaje antes de enviarlo. Por eso la atribución automática es una inferencia y puede perder precisión.
                </p>
              </div>
            )}
            <Section title="Variantes del mensaje (opcional)" hint="Una por línea. Otras versiones del texto que puedan llegar.">
              <Textarea value={form.variantsText} onChange={(e) => set("variantsText", e.target.value)} rows={3} />
            </Section>
            <Section title="Palabras o expresiones identificadoras (opcional)" hint="Una por línea. Usá frases propias de la campaña («renovar mi página web»). Palabras sueltas y genéricas como «web» o «precio» no sirven para identificar.">
              <Textarea value={form.keywordsText} onChange={(e) => set("keywordsText", e.target.value)} rows={3} />
            </Section>
            <Section title="Descripción del anuncio (opcional)" hint="Ayuda a reconocer mensajes parecidos al anuncio.">
              <Textarea value={form.adDescription} onChange={(e) => set("adDescription", e.target.value)} maxLength={500} rows={2} />
            </Section>
          </>
        )}

        {step === 2 && (
          <>
            <Section title="Servicio o producto que promociona">
              <Input value={form.promotedService} onChange={(e) => set("promotedService", e.target.value)} maxLength={300} />
            </Section>
            <Section title="Público al que está dirigido">
              <Input value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} maxLength={300} />
            </Section>
            <Section title="Problema que resuelve">
              <Textarea value={form.problemSolved} onChange={(e) => set("problemSolved", e.target.value)} maxLength={500} rows={2} />
            </Section>
            <Section title="Qué debe saber el agente" hint="Datos reales que puede usar. No cargues precios o plazos que no quieras que mencione.">
              <Textarea value={form.agentKnowledge} onChange={(e) => set("agentKnowledge", e.target.value)} maxLength={1500} rows={4} />
            </Section>
            <Section title="Tono o enfoque comercial">
              <Input value={form.tone} onChange={(e) => set("tone", e.target.value)} maxLength={300} />
            </Section>
            <Section title="Qué no debe prometer ni asumir">
              <Textarea value={form.doNotPromise} onChange={(e) => set("doNotPromise", e.target.value)} maxLength={800} rows={3} placeholder="Ej.: precios cerrados, plazos de entrega garantizados" />
            </Section>
          </>
        )}

        {step === 3 && (
          <>
            <Section title="Objetivo de la conversación">
              <div className="grid gap-2">
                {CAMPAIGN_GOALS.map((g) => (
                  <label key={g} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${form.goal === g ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="goal" className="mt-1" checked={form.goal === g} onChange={() => changeGoal(g)} />
                    <span>
                      <span className="block text-sm font-medium">{CAMPAIGN_GOAL_LABEL[g]}</span>
                      <span className="block text-xs text-muted-foreground">{CAMPAIGN_GOAL_HELP[g]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Section>
            {form.goal !== "booking" && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Ofrecer una reunión al terminar</p>
                  <p className="text-xs text-muted-foreground">Después de registrar los datos, el agente sugiere coordinar una reunión (solo si el negocio tiene servicios reservables). No agenda nada sin que la persona lo pida y lo confirme.</p>
                </div>
                <Switch checked={form.secondaryBooking} onCheckedChange={(v) => set("secondaryBooking", v)} aria-label="Ofrecer una reunión al terminar" />
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            {form.goal === "booking" || form.goal === "general_inquiry" ? (
              <p className="text-sm text-muted-foreground">Con este objetivo el agente no recopila datos por defecto. Si la persona pide una propuesta, se usan los campos de abajo.</p>
            ) : null}
            <p className="text-sm text-muted-foreground">Elegí qué datos pedir y cuáles son obligatorios. Se preguntan en este orden y de a uno; lo que la persona ya contó no se vuelve a preguntar. El teléfono lo toma del chat de WhatsApp.</p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {CAMPAIGN_FIELD_KEYS.filter((k) => k !== "phone").map((key) => {
                const field = fieldOf(key);
                return (
                  <div key={key} className="flex flex-wrap items-center gap-3 p-3">
                    <label className="flex flex-1 items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!field} onChange={(e) => toggleField(key, e.target.checked)} />
                      {CAMPAIGN_FIELD_LABEL[key]}
                    </label>
                    {field && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Obligatorio
                        <Switch size="sm" checked={field.required} onCheckedChange={(v) => patchField(key, { required: v })} aria-label={`${CAMPAIGN_FIELD_LABEL[key]} obligatorio`} />
                      </label>
                    )}
                    {field && key === "custom" && (
                      <Input className="basis-full" value={field.label ?? ""} onChange={(e) => patchField("custom", { label: e.target.value })} placeholder="Pregunta, ej.: ¿Cuántos empleados tiene tu negocio?" maxLength={80} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <p className="text-sm text-muted-foreground">Cada persona queda guardada como interesado en Nexo (sección Consultas) con la campaña de origen. Si ya existe, se actualiza: no se duplica.</p>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Enviar a Nodo</p>
                <p className="text-xs text-muted-foreground">Solo si el negocio tiene Nodo conectado. Si falla, el interesado queda igual en Nexo.</p>
              </div>
              <Switch checked={form.syncNodo} onCheckedChange={(v) => set("syncNodo", v)} aria-label="Enviar a Nodo" />
            </div>
            <Section title="Estado inicial del interesado">
              <select className={SELECT_CLASS} value={form.initialLeadStatus} onChange={(e) => set("initialLeadStatus", e.target.value as "NEW" | "IN_PROGRESS")}>
                <option value="NEW">Nuevo</option>
                <option value="IN_PROGRESS">En curso</option>
              </select>
            </Section>
            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Oportunidades comerciales (avanzado)</summary>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm">Crear oportunidad en Nodo</p>
                  <p className="text-xs text-muted-foreground">Queda registrada la preferencia. La creación de la oportunidad la hace Nodo y todavía no está implementada: hoy esta opción no genera oportunidades.</p>
                </div>
                <Switch checked={form.createOpportunity} onCheckedChange={(v) => set("createOpportunity", v)} aria-label="Crear oportunidad en Nodo" />
              </div>
            </details>
          </>
        )}

        {step === 6 && (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{form.name || "Sin nombre"}</span>
                <Badge variant="secondary">{CAMPAIGN_GOAL_LABEL[form.goal]}</Badge>
                <Badge variant="outline">{CAMPAIGN_CHANNEL_LABEL[form.channel]}</Badge>
              </div>
              {!form.prefilledMessage.trim() && !lines(form.keywordsText).length && !form.variantsText.trim() && (
                <p className="flex items-start gap-1.5 text-amber-600"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />Para activarla necesitás un mensaje precargado o al menos una expresión identificadora. Podés guardarla como borrador.</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Vista previa</p>
              <p className="mt-1 text-xs text-muted-foreground">Si alguien escribe «{preview.sample}», el agente reconoce la campaña y {form.goal === "booking" ? "usa la agenda del negocio cuando la persona pida reservar" : "responde:"}</p>
              {form.goal !== "booking" && form.goal !== "general_inquiry" && <p className="mt-2 rounded-lg bg-background p-2.5">{preview.firstQuestion}</p>}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">Ver el contexto que recibe el agente</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded bg-background p-2 text-xs whitespace-pre-wrap">{preview.context.trim()}</pre>
              </details>
            </div>
            {wasActive && <p className="text-xs text-muted-foreground">Esta campaña está activa: los cambios aplican a las conversaciones nuevas y a las que ya vienen de ella.</p>}
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="size-4" data-icon="inline-start" />Anterior
        </Button>
        <div className="flex flex-wrap gap-2">
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>Siguiente<ArrowRight className="size-4" data-icon="inline-end" /></Button>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={!!saving} onClick={() => save(initial && initial.status !== "draft" ? initial.status : "draft")}>
                {saving === "draft" && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
                {initial && initial.status !== "draft" ? "Guardar cambios" : "Guardar borrador"}
              </Button>
              {(!initial || initial.status === "draft" || initial.status === "paused") && (
                <Button type="button" disabled={!!saving} onClick={() => save("active")}>
                  {saving === "active" && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
                  Activar campaña
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
