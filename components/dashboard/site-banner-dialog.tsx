"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SiteBannerView } from "@/components/public-site/site-banner";
import { requestJson } from "@/lib/api-client";
import { ASSET_LIMITS } from "@/lib/asset-limits";
import {
  BANNER_CTA_LABEL,
  BANNER_CTA_TYPES,
  BANNER_VARIANTS,
  BANNER_VARIANT_LABEL,
  DEFAULT_WHATSAPP_MESSAGE,
  bannerInputSchema,
} from "@/lib/site-banners";
import { cn } from "@/lib/utils";
import type { SiteBanner, SiteBannerCtaType, SiteBannerVariant } from "@/lib/types";

export interface BannerSectionOption {
  kind: string;
  label: string;
}

interface SiteBannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // undefined = crear uno nuevo.
  banner?: SiteBanner;
  sections: BannerSectionOption[];
  contacts: { whatsapp: boolean; phone: boolean };
  onSaved: (banner: SiteBanner) => void;
}

interface ImageSlotProps {
  label: string;
  hint: string;
  url: string | null;
  required?: boolean;
  onUploaded: (url: string) => void;
  onRemove?: () => void;
}

// Sube apenas se elige el archivo (para poder previsualizarlo), pero la
// imagen todavía NO queda asociada a ningún banner: recién al "Guardar". Si
// se reemplaza o se cancela, el diálogo descarta la subida en el servidor.
function ImageSlot({ label, hint, url, required, onUploaded, onRemove }: ImageSlotProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const limits = ASSET_LIMITS.banner;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!limits.mimeTypes.includes(file.type)) {
      setError(`Formato no permitido. Usá ${limits.mimeTypes.map((m) => m.split("/")[1].toUpperCase()).join(", ")}.`);
      return;
    }
    if (file.size > limits.maxBytes) {
      setError(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/business/banners/upload", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !data?.url) throw new Error(data?.error ?? "No pudimos subir la imagen.");
      onUploaded(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir la imagen.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground">
        {label} {required ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">(opcional)</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-2 flex items-start gap-3">
        <div
          className={cn(
            "flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted text-muted-foreground",
            url && "border-solid"
          )}
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={limits.mimeTypes.join(",")}
            className="hidden"
            disabled={uploading}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? "Subiendo…" : url ? "Reemplazar" : "Subir imagen"}
          </Button>
          {url && onRemove && !uploading && (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onRemove}>
              <X className="size-3.5" data-icon="inline-start" />
              Quitar
            </Button>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function SiteBannerDialog({ open, onOpenChange, banner, sections, contacts, onSaved }: SiteBannerDialogProps) {
  const [name, setName] = React.useState("");
  const [variant, setVariant] = React.useState<SiteBannerVariant>("text");
  const [desktopUrl, setDesktopUrl] = React.useState<string | null>(null);
  const [mobileUrl, setMobileUrl] = React.useState<string | null>(null);
  const [alt, setAlt] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [ctaEnabled, setCtaEnabled] = React.useState(false);
  const [ctaType, setCtaType] = React.useState<SiteBannerCtaType>("contact_form");
  const [ctaLabel, setCtaLabel] = React.useState("");
  const [ctaValue, setCtaValue] = React.useState("");
  const [previewMode, setPreviewMode] = React.useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Imágenes subidas en esta sesión del diálogo y todavía no guardadas.
  const sessionUploads = React.useRef<Set<string>>(new Set());

  // Se reinicia cada vez que se abre.
  React.useEffect(() => {
    if (!open) return;
    sessionUploads.current = new Set();
    setName(banner?.name ?? "");
    setVariant(banner?.variant ?? "text");
    setDesktopUrl(banner?.desktopImageUrl ?? null);
    setMobileUrl(banner?.mobileImageUrl ?? null);
    setAlt(banner?.imageAlt ?? "");
    setTitle(banner?.title ?? "");
    setDescription(banner?.description ?? "");
    setActive(banner?.active ?? true);
    setCtaEnabled(!!banner?.cta);
    setCtaType(banner?.cta?.type ?? "contact_form");
    setCtaLabel(banner?.cta?.label ?? "");
    setCtaValue(banner?.cta?.value ?? "");
    setPreviewMode("desktop");
    setError(null);
  }, [open, banner]);

  function discard(url: string | null | undefined) {
    if (!url || !sessionUploads.current.has(url)) return;
    sessionUploads.current.delete(url);
    void fetch("/api/business/banners/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => undefined);
  }

  function handleUploaded(slot: "desktop" | "mobile", url: string) {
    sessionUploads.current.add(url);
    if (slot === "desktop") {
      discard(desktopUrl);
      setDesktopUrl(url);
    } else {
      discard(mobileUrl);
      setMobileUrl(url);
    }
  }

  function close() {
    // Cancelar: se descartan las imágenes subidas que no se llegaron a guardar.
    for (const url of Array.from(sessionUploads.current)) discard(url);
    onOpenChange(false);
  }

  async function save() {
    setError(null);
    const cta = ctaEnabled ? { type: ctaType, label: ctaLabel, value: ctaType === "section" || ctaType === "url" || ctaType === "whatsapp" ? ctaValue || null : null } : null;
    const payload = {
      name,
      variant,
      desktopImageUrl: desktopUrl ?? "",
      mobileImageUrl: mobileUrl,
      imageAlt: alt,
      title: variant === "image" ? null : title,
      description: variant === "image" ? null : description,
      active,
      cta,
    };
    const check = bannerInputSchema.safeParse(payload);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Revisá los datos del banner.");
      return;
    }

    setSaving(true);
    try {
      const { banner: saved } = await requestJson<{ banner: SiteBanner }>(
        banner ? `/api/business/banners/${banner.id}` : "/api/business/banners",
        { method: banner ? "PATCH" : "POST", body: JSON.stringify(payload) }
      );
      // Ya quedaron asociadas: no hay nada que descartar.
      sessionUploads.current = new Set();
      toast.success(banner ? "Banner actualizado." : "Banner creado.");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar el banner.");
    } finally {
      setSaving(false);
    }
  }

  const previewBanner = {
    variant,
    desktopImageUrl: desktopUrl ?? "",
    mobileImageUrl: mobileUrl,
    imageAlt: alt,
    title: variant === "image" ? null : title || null,
    description: variant === "image" ? null : description || null,
  };
  const previewCta = ctaEnabled && ctaLabel.trim() ? { href: "#", label: ctaLabel.trim(), newTab: false } : null;
  const showTextFields = variant !== "image";

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{banner ? "Editar banner" : "Nuevo banner"}</DialogTitle>
          <DialogDescription>
            Armá el banner acá y después ubicalo en tu página desde &ldquo;Secciones de la página&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label htmlFor="banner-name">Nombre interno</Label>
            <Input id="banner-name" className="mt-1.5" placeholder="Ej: Promo de invierno" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Solo lo ves vos, para identificarlo en el panel.</p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Diseño</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Diseño del banner">
              {BANNER_VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={variant === v}
                  onClick={() => setVariant(v)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    variant === v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="block text-sm font-medium text-foreground">{BANNER_VARIANT_LABEL[v].label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{BANNER_VARIANT_LABEL[v].description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ImageSlot
              label="Imagen de escritorio"
              hint="Horizontal, por ejemplo 1600×600. PNG, JPG o WebP, máx. 4 MB."
              required
              url={desktopUrl}
              onUploaded={(url) => handleUploaded("desktop", url)}
            />
            <ImageSlot
              label="Imagen móvil"
              hint="Si no la subís, se usa la de escritorio adaptada al celular."
              url={mobileUrl}
              onUploaded={(url) => handleUploaded("mobile", url)}
              onRemove={() => {
                discard(mobileUrl);
                setMobileUrl(null);
              }}
            />
          </div>

          <div>
            <Label htmlFor="banner-alt">Texto alternativo</Label>
            <Input id="banner-alt" className="mt-1.5" placeholder="Describí la imagen para quien no la puede ver" value={alt} maxLength={160} onChange={(e) => setAlt(e.target.value)} />
          </div>

          {showTextFields ? (
            <div className="grid gap-4">
              <div>
                <Label htmlFor="banner-title">Título <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="banner-title" className="mt-1.5" value={title} maxLength={90} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="banner-description">Descripción <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Textarea id="banner-description" className="mt-1.5" rows={2} value={description} maxLength={240} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              En el diseño &ldquo;Solo imagen&rdquo; no se muestra texto encima: la imagen tiene que traer el diseño completo.
            </p>
          )}

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Botón</p>
                <p className="text-xs text-muted-foreground">
                  {variant === "image" ? "Toda la imagen funciona como enlace." : "Un botón de acción dentro del banner."}
                </p>
              </div>
              <Switch checked={ctaEnabled} onCheckedChange={setCtaEnabled} aria-label="Mostrar botón" />
            </div>

            {ctaEnabled && (
              <div className="mt-4 grid gap-4">
                <div>
                  <Label>Destino</Label>
                  <Select value={ctaType} onValueChange={(v) => setCtaType(v as SiteBannerCtaType)}>
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue>{BANNER_CTA_LABEL[ctaType]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {BANNER_CTA_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {BANNER_CTA_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="banner-cta-label">Texto del botón</Label>
                  <Input id="banner-cta-label" className="mt-1.5" placeholder="Ej: Quiero reservar" value={ctaLabel} maxLength={32} onChange={(e) => setCtaLabel(e.target.value)} />
                </div>

                {ctaType === "section" && (
                  <div>
                    <Label>Sección</Label>
                    <Select value={ctaValue} onValueChange={(v) => setCtaValue(v ?? "")}>
                      <SelectTrigger className="mt-1.5 w-full">
                        <SelectValue>{sections.find((s) => s.kind === ctaValue)?.label ?? "Elegí una sección"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((s) => (
                          <SelectItem key={s.kind} value={s.kind}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {ctaType === "whatsapp" && (
                  <div>
                    <Label htmlFor="banner-cta-wa">Mensaje predefinido</Label>
                    <Textarea id="banner-cta-wa" className="mt-1.5" rows={2} maxLength={200} placeholder={DEFAULT_WHATSAPP_MESSAGE} value={ctaValue} onChange={(e) => setCtaValue(e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {contacts.whatsapp
                        ? "Se abre el WhatsApp de tu negocio con este mensaje."
                        : "Todavía no cargaste el WhatsApp de tu negocio: cargalo en Negocio para poder usar este destino."}
                    </p>
                  </div>
                )}

                {ctaType === "url" && (
                  <div>
                    <Label htmlFor="banner-cta-url">URL</Label>
                    <Input id="banner-cta-url" className="mt-1.5" inputMode="url" placeholder="https://…" value={ctaValue} maxLength={500} onChange={(e) => setCtaValue(e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">Se abre en otra pestaña.</p>
                  </div>
                )}

                {ctaType === "phone" && (
                  <p className="text-xs text-muted-foreground">
                    {contacts.phone
                      ? "Se llama al teléfono de tu negocio."
                      : "Todavía no cargaste el teléfono de tu negocio: cargalo en Negocio para poder usar este destino."}
                  </p>
                )}
                {ctaType === "contact_form" && (
                  <p className="text-xs text-muted-foreground">Lleva al formulario de contacto de tu página.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Banner activo</p>
              <p className="text-xs text-muted-foreground">Un banner inactivo no se muestra en tu sitio.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Banner activo" />
          </div>

          {desktopUrl && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Vista previa</p>
                <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
                  {(["desktop", "mobile"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewMode(mode)}
                      className={cn("rounded-md px-2.5 py-1", previewMode === mode ? "bg-muted font-medium text-foreground" : "text-muted-foreground")}
                    >
                      {mode === "desktop" ? "Escritorio" : "Móvil"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 overflow-hidden rounded-xl border border-border bg-background py-4">
                <div className={cn("mx-auto", previewMode === "mobile" ? "max-w-[360px]" : "max-w-full")}>
                  <SiteBannerView banner={previewBanner} cta={previewCta} preview={previewMode} />
                </div>
              </div>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />}
            {banner ? "Guardar cambios" : "Crear banner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
