"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestJson } from "@/lib/api-client";
import {
  NAV_PAGE_LABEL,
  NAV_PROBLEM_MESSAGE,
  NAV_TARGET_LABEL,
  newNavLinkId,
  type NavConfig,
  type NavCtaTarget,
  type NavIssue,
  type NavLink,
  type NavPage,
} from "@/lib/site-nav";

interface EditorResponse {
  config: NavConfig;
  isDefault: boolean;
  issues: NavIssue[];
  sectionOptions: { kind: string; label: string; available: boolean }[];
  pageOptions: { page: NavPage; available: boolean }[];
  contacts: { whatsapp: boolean; phone: boolean };
  bookable: boolean;
  contactKind: string;
  contactAvailable: boolean;
  maxLinks: number;
  socials: { platform: string; label: string }[];
}

type TargetType = NavCtaTarget["type"];

const LINK_TYPES: TargetType[] = ["section", "page", "url", "whatsapp", "phone"];
const CTA_TYPES: TargetType[] = ["whatsapp", "contact_form", "booking", "section", "page", "url", "phone"];

function defaultTarget(type: TargetType, data: EditorResponse): NavCtaTarget {
  switch (type) {
    case "section":
      return { type, kind: data.sectionOptions.find((s) => s.available)?.kind ?? data.sectionOptions[0]?.kind ?? "services" };
    case "page":
      return { type, page: data.pageOptions.find((p) => p.available)?.page ?? "carta" };
    case "url":
      return { type, url: "https://" };
    case "whatsapp":
      return { type };
    case "phone":
      return { type };
    case "contact_form":
      return { type };
    case "booking":
      return { type };
  }
}

// Configuración de la barra de navegación del sitio público. Se edita un
// borrador local y se guarda completo (una sola escritura validada en el
// servidor). Lo que hoy no se puede cumplir se marca acá y el sitio público
// simplemente no lo muestra: nunca queda un enlace roto a la vista.
export function SiteNavEditor() {
  const [data, setData] = React.useState<EditorResponse | null>(null);
  const [draft, setDraft] = React.useState<NavConfig | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const apply = React.useCallback((next: EditorResponse) => {
    setData(next);
    setDraft(next.config);
  }, []);

  React.useEffect(() => {
    requestJson<EditorResponse>("/api/business/site-nav").then(apply).catch(() => setLoadError(true));
  }, [apply]);

  if (loadError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        No pudimos cargar la navegación. Recargá para volver a intentar.
      </div>
    );
  }
  if (!data || !draft) return <Skeleton className="h-64 rounded-2xl" />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.config);
  const issueOf = (id: string) => data.issues.find((i) => i.id === id);

  function setLink(id: string, patch: Partial<NavLink>) {
    setDraft((d) => d && { ...d, links: d.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }
  function moveLink(index: number, delta: number) {
    setDraft((d) => {
      if (!d) return d;
      const to = index + delta;
      if (to < 0 || to >= d.links.length) return d;
      const links = [...d.links];
      [links[index], links[to]] = [links[to], links[index]];
      return { ...d, links };
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      apply(await requestJson<EditorResponse>("/api/business/site-nav", { method: "PUT", body: JSON.stringify(draft) }));
      toast.success("Navegación guardada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar la navegación.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      apply(await requestJson<EditorResponse>("/api/business/site-nav", { method: "DELETE" }));
      toast.success("Volvimos a la navegación automática.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos restablecer la navegación.");
    } finally {
      setSaving(false);
    }
  }

  const renderTarget = ({ target, onChange, types }: { target: NavCtaTarget; onChange: (t: NavCtaTarget) => void; types: TargetType[] }) => {
    const d = data as EditorResponse;
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={target.type} onValueChange={(v) => v && onChange(defaultTarget(v as TargetType, d))}>
          <SelectTrigger className="w-full" aria-label="Tipo de destino">
            <SelectValue>{NAV_TARGET_LABEL[target.type]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((type) => (
              <SelectItem key={type} value={type}>
                {NAV_TARGET_LABEL[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {target.type === "section" && (
          <Select value={target.kind} onValueChange={(v) => v && onChange({ type: "section", kind: v })}>
            <SelectTrigger className="w-full" aria-label="Sección">
              <SelectValue>{d.sectionOptions.find((s) => s.kind === target.kind)?.label ?? "Elegí una sección"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {d.sectionOptions.map((s) => (
                <SelectItem key={s.kind} value={s.kind}>
                  {s.label}
                  {s.available ? "" : " (oculta o sin contenido)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {target.type === "page" && (
          <Select value={target.page} onValueChange={(v) => v && onChange({ type: "page", page: v as NavPage })}>
            <SelectTrigger className="w-full" aria-label="Página">
              <SelectValue>{NAV_PAGE_LABEL[target.page]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {d.pageOptions.map((p) => (
                <SelectItem key={p.page} value={p.page}>
                  {NAV_PAGE_LABEL[p.page]}
                  {p.available ? "" : " (no disponible)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {target.type === "url" && (
          <Input
            value={target.url}
            onChange={(e) => onChange({ type: "url", url: e.target.value })}
            placeholder="https://…"
            aria-label="URL"
            inputMode="url"
            maxLength={500}
          />
        )}
        {target.type === "whatsapp" && (
          <Input
            value={target.message ?? ""}
            onChange={(e) => onChange({ type: "whatsapp", message: e.target.value })}
            placeholder="Mensaje inicial (opcional)"
            aria-label="Mensaje de WhatsApp"
            maxLength={200}
          />
        )}
      </div>
    );
  }

  const targetHint = (target: NavCtaTarget) => {
    if (target.type === "whatsapp" && !data.contacts.whatsapp) return "Falta cargar el WhatsApp del negocio.";
    if (target.type === "phone" && !data.contacts.phone) return "Falta cargar el teléfono del negocio.";
    if (target.type === "booking" && !data.bookable) return "El negocio no tiene servicios reservables.";
    return null;
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="site-nav-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="site-nav-title" className="text-base font-semibold text-foreground">
            Navegación
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Los enlaces del menú superior y el botón destacado. Solo se muestran los que se pueden cumplir.
          </p>
        </div>
        {data.isDefault && <Badge variant="secondary">Automática</Badge>}
      </div>

      <div className="mt-5 space-y-3">
        {draft.links.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No hay enlaces en el menú. Agregá uno o dejá solo el botón destacado.
          </p>
        )}
        {draft.links.map((link, index) => {
          const issue = issueOf(link.id);
          const hint = targetHint(link.target);
          return (
            <div key={link.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={link.label}
                  onChange={(e) => setLink(link.id, { label: e.target.value })}
                  maxLength={30}
                  aria-label="Texto del enlace"
                  placeholder="Texto del enlace"
                />
                <Switch checked={link.active} onCheckedChange={(v) => setLink(link.id, { active: v })} aria-label="Mostrar enlace" />
                <Button size="icon" variant="ghost" aria-label="Subir" disabled={index === 0} onClick={() => moveLink(index, -1)}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Bajar" disabled={index === draft.links.length - 1} onClick={() => moveLink(index, 1)}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Eliminar enlace"
                  onClick={() => setDraft((d) => d && { ...d, links: d.links.filter((l) => l.id !== link.id) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {renderTarget({ target: link.target, types: LINK_TYPES, onChange: (target) => setLink(link.id, { target: target as NavLink["target"] }) })}
              {(issue || hint) && link.active && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {issue ? NAV_PROBLEM_MESSAGE[issue.problem] : hint} No se muestra en el sitio hasta corregirlo.
                </p>
              )}
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          disabled={draft.links.length >= data.maxLinks}
          onClick={() =>
            setDraft((d) => d && { ...d, links: [...d.links, { id: newNavLinkId(), label: "", active: true, target: defaultTarget("section", data) as NavLink["target"] }] })
          }
        >
          <Plus className="size-4" data-icon="inline-start" />
          Agregar enlace
        </Button>
      </div>

      <div className="mt-6 space-y-3 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Botón destacado</h3>
            <p className="text-xs text-muted-foreground">Acción principal en la barra superior.</p>
          </div>
          <Switch
            checked={!!draft.cta?.active}
            aria-label="Mostrar botón destacado"
            onCheckedChange={(v) =>
              setDraft((d) =>
                d && {
                  ...d,
                  cta: d.cta
                    ? { ...d.cta, active: v }
                    : { label: "Contactar", active: v, target: defaultTarget("whatsapp", data) },
                }
              )
            }
          />
        </div>
        {draft.cta && (
          <div className="space-y-2">
            <Input
              value={draft.cta.label}
              onChange={(e) => setDraft((d) => d && d.cta && { ...d, cta: { ...d.cta, label: e.target.value } })}
              maxLength={30}
              aria-label="Texto del botón"
              placeholder="Texto del botón"
            />
            {renderTarget({
              target: draft.cta.target,
              types: CTA_TYPES,
              onChange: (target) => setDraft((d) => d && d.cta && { ...d, cta: { ...d.cta, target } }),
            })}
            {draft.cta.active && (issueOf("cta") || targetHint(draft.cta.target)) && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" />
                {issueOf("cta") ? NAV_PROBLEM_MESSAGE[issueOf("cta")!.problem] : targetHint(draft.cta.target)} El botón no se muestra hasta corregirlo.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3 border-t border-border pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Redes sociales</h3>
          <p className="text-xs text-muted-foreground">
            {data.socials.length > 0
              ? `Configuradas: ${data.socials.map((s) => s.label).join(", ")}. `
              : "Todavía no cargaste ninguna. "}
            Los enlaces se editan en{" "}
            <Link href="/dashboard/negocio" className="font-medium text-foreground underline underline-offset-2">
              Negocio
            </Link>
            .
          </p>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          Mostrar en el pie de página
          <Switch checked={draft.socialsInFooter} onCheckedChange={(v) => setDraft((d) => d && { ...d, socialsInFooter: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Mostrar en la barra superior
          <Switch checked={draft.socialsInNav} onCheckedChange={(v) => setDraft((d) => d && { ...d, socialsInNav: v })} />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button variant="ghost" size="sm" onClick={reset} disabled={saving || data.isDefault}>
          <RotateCcw className="size-4" data-icon="inline-start" />
          Volver a la navegación automática
        </Button>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
          <Button onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
            Guardar navegación
          </Button>
        </div>
      </div>
    </section>
  );
}
