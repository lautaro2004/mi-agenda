import { z } from "zod";

import { SITE_TEMPLATES, type SiteTemplate } from "@/lib/types";

// Sin dependencias de servidor: lo usan el panel (cliente), la API y el
// render público. Es el REGISTRO EXPLÍCITO de bloques permitidos por
// plantilla — lo guardado en la base solo referencia estos tipos por nombre,
// nunca código ni componentes arbitrarios.

export const BANNER_KIND = "banner";

export interface BuiltinSectionDef {
  kind: string;
  label: string;
  description: string;
  // No se puede ocultar (la plantilla pierde su función sin ella).
  locked?: boolean;
  // Siempre primera (la portada). No se puede mover ni nada puede pasar delante.
  pinnedFirst?: boolean;
  // Dónde se edita el CONTENIDO de la sección (se reutilizan las pantallas
  // existentes, no se duplican).
  editHref: string;
  editLabel: string;
}

const HERO_EDIT = { editHref: "/dashboard/sitio", editLabel: "Editar apariencia" };

export const SITE_SECTIONS: Record<SiteTemplate, BuiltinSectionDef[]> = {
  institutional: [
    { kind: "hero", label: "Portada", description: "Título principal y acceso a reservar.", locked: true, pinnedFirst: true, ...HERO_EDIT },
    { kind: "about", label: "Sobre el negocio", description: "La descripción de tu negocio.", editHref: "/dashboard/negocio", editLabel: "Editar negocio" },
    { kind: "services", label: "Servicios", description: "Tus servicios con precio y reserva.", editHref: "/dashboard/servicios", editLabel: "Editar servicios" },
    { kind: "menu", label: "Carta digital", description: "Acceso a tu carta (si está activa).", editHref: "/dashboard/sitio/carta", editLabel: "Editar carta" },
    { kind: "gallery", label: "Galería", description: "Tus bloques de fotos.", editHref: "/dashboard/sitio/galeria", editLabel: "Editar galería" },
    { kind: "process", label: "Cómo funciona", description: "Pasos para reservar o contactarte.", editHref: "/dashboard/sitio", editLabel: "Ver apariencia" },
    { kind: "booking", label: "Reservas", description: "Sección para reservar o consultar.", locked: true, editHref: "/dashboard/servicios", editLabel: "Editar servicios" },
    { kind: "schedule", label: "Horarios", description: "Tus días y horarios de atención.", editHref: "/dashboard/horarios", editLabel: "Editar horarios" },
    { kind: "faq", label: "Preguntas frecuentes", description: "Tus preguntas frecuentes.", editHref: "/dashboard/preguntas-frecuentes", editLabel: "Editar preguntas" },
    { kind: "cta", label: "Cierre", description: "Llamado final a reservar o escribirte.", editHref: "/dashboard/sitio", editLabel: "Ver apariencia" },
  ],
  booking: [
    { kind: "hero", label: "Portada", description: "Título principal y reserva rápida.", locked: true, pinnedFirst: true, ...HERO_EDIT },
    { kind: "services", label: "Servicios", description: "Tus servicios reservables.", editHref: "/dashboard/servicios", editLabel: "Editar servicios" },
    { kind: "info", label: "Información importante", description: "Datos de contacto y condiciones.", editHref: "/dashboard/negocio", editLabel: "Editar negocio" },
    { kind: "inquiry", label: "Formulario de consultas", description: "Formulario de contacto.", locked: true, editHref: "/dashboard/consultas", editLabel: "Ver consultas" },
    { kind: "menu", label: "Carta digital", description: "Acceso a tu carta (si está activa).", editHref: "/dashboard/sitio/carta", editLabel: "Editar carta" },
    { kind: "gallery", label: "Galería", description: "Tus bloques de fotos.", editHref: "/dashboard/sitio/galeria", editLabel: "Editar galería" },
    { kind: "schedule", label: "Horarios", description: "Tus días y horarios de atención.", editHref: "/dashboard/horarios", editLabel: "Editar horarios" },
    { kind: "faq", label: "Preguntas frecuentes", description: "Tus preguntas frecuentes.", editHref: "/dashboard/preguntas-frecuentes", editLabel: "Editar preguntas" },
  ],
  leads: [
    { kind: "hero", label: "Portada", description: "Título principal y botón al formulario.", locked: true, pinnedFirst: true, editHref: "/dashboard/sitio", editLabel: "Editar textos" },
    { kind: "steps", label: "Pasos de funcionamiento", description: "Cómo funciona, en 3 pasos.", editHref: "/dashboard/sitio", editLabel: "Editar textos" },
    { kind: "services", label: "Servicios y beneficios", description: "Tus servicios y por qué elegirte.", editHref: "/dashboard/servicios", editLabel: "Editar servicios" },
    { kind: "gallery", label: "Galería", description: "Tus bloques de fotos.", editHref: "/dashboard/sitio/galeria", editLabel: "Editar galería" },
    { kind: "faq", label: "Preguntas frecuentes", description: "Tus preguntas frecuentes.", editHref: "/dashboard/preguntas-frecuentes", editLabel: "Editar preguntas" },
    { kind: "form", label: "Formulario de contacto", description: "Cierre con el formulario de captación.", locked: true, editHref: "/dashboard/sitio", editLabel: "Editar formulario" },
  ],
};

// Sección a la que lleva el CTA "ir al formulario de contacto" en cada plantilla.
export const CONTACT_SECTION_KIND: Record<SiteTemplate, string> = {
  institutional: "booking",
  booking: "inquiry",
  leads: "form",
};

export const MAX_SECTION_ITEMS = 40;

export interface SectionItem {
  // Estable. Builtins: el propio tipo ("faq"). Banners: "banner-<uuid>".
  id: string;
  kind: string;
  bannerId?: string;
  visible: boolean;
}

const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;

export const sectionItemSchema = z.object({
  id: z.string().regex(ID_RE),
  kind: z.string().min(1).max(30),
  bannerId: z.string().regex(ID_RE).optional(),
  visible: z.boolean(),
});

export const siteLayoutInputSchema = z.object({
  template: z.enum(SITE_TEMPLATES),
  items: z.array(sectionItemSchema).max(MAX_SECTION_ITEMS),
});

export function isSiteTemplate(value: unknown): value is SiteTemplate {
  return typeof value === "string" && (SITE_TEMPLATES as readonly string[]).includes(value);
}

export function getBuiltinDefs(template: SiteTemplate): BuiltinSectionDef[] {
  return SITE_SECTIONS[template];
}

export function getBuiltinDef(template: SiteTemplate, kind: string): BuiltinSectionDef | undefined {
  return SITE_SECTIONS[template].find((d) => d.kind === kind);
}

export function allBuiltinKinds(): string[] {
  return Array.from(new Set(Object.values(SITE_SECTIONS).flatMap((defs) => defs.map((d) => d.kind))));
}

export function newBannerItemId(): string {
  return `banner-${crypto.randomUUID()}`;
}

export function defaultSectionItems(template: SiteTemplate): SectionItem[] {
  return SITE_SECTIONS[template].map((d) => ({ id: d.kind, kind: d.kind, visible: true }));
}

function enforceInvariants(template: SiteTemplate, items: SectionItem[]): SectionItem[] {
  const defs = SITE_SECTIONS[template];
  let result = items.map((item) => {
    const def = defs.find((d) => d.kind === item.kind);
    return def?.locked && !item.visible ? { ...item, visible: true } : item;
  });
  const pinned = defs.find((d) => d.pinnedFirst);
  if (pinned) {
    const index = result.findIndex((i) => i.kind === pinned.kind);
    if (index > 0) result = [result[index], ...result.slice(0, index), ...result.slice(index + 1)];
  }
  return result;
}

// Lectura TOLERANTE (sitio público y panel): lo guardado puede venir de una
// versión vieja o estar editado a mano. Descarta lo inválido (tipos que la
// plantilla no conoce, banners que ya no existen, repetidos), agrega al
// orden de fábrica las secciones que falten (por ejemplo una sección nueva
// que Nexo agregue después) y garantiza los invariantes. Nunca lanza.
export function normalizeSectionItems(
  template: SiteTemplate,
  stored: unknown,
  validBannerIds: ReadonlySet<string>
): SectionItem[] {
  const defs = SITE_SECTIONS[template];
  const result: SectionItem[] = [];
  const seenKinds = new Set<string>();
  const seenIds = new Set<string>();

  if (Array.isArray(stored)) {
    for (const raw of stored) {
      const parsed = sectionItemSchema.safeParse(raw);
      if (!parsed.success) continue;
      const item = parsed.data;
      if (seenIds.has(item.id)) continue;

      if (item.kind === BANNER_KIND) {
        if (!item.bannerId || !validBannerIds.has(item.bannerId)) continue;
        seenIds.add(item.id);
        result.push({ id: item.id, kind: BANNER_KIND, bannerId: item.bannerId, visible: item.visible });
        continue;
      }

      if (!defs.some((d) => d.kind === item.kind) || seenKinds.has(item.kind)) continue;
      seenKinds.add(item.kind);
      seenIds.add(item.kind);
      result.push({ id: item.kind, kind: item.kind, visible: item.visible });
    }
  }

  // Secciones de fábrica que faltan: se insertan después de la anterior
  // presente del orden por defecto (o al principio si no hay ninguna).
  defs.forEach((def, index) => {
    if (seenKinds.has(def.kind)) return;
    let insertAt = 0;
    for (let i = index - 1; i >= 0; i--) {
      const at = result.findIndex((r) => r.kind === defs[i].kind);
      if (at !== -1) {
        insertAt = at + 1;
        break;
      }
    }
    result.splice(insertAt, 0, { id: def.kind, kind: def.kind, visible: true });
    seenKinds.add(def.kind);
  });

  return enforceInvariants(template, result);
}

export type LayoutValidation = { ok: true; items: SectionItem[] } | { ok: false; error: string };

// Validación ESTRICTA de lo que manda el cliente al guardar: la lista tiene
// que contener TODAS las secciones de la plantilla exactamente una vez (así
// guardar nunca "pierde" una sección ni deja posiciones inconsistentes),
// banners existentes del negocio, ids únicos, obligatorias visibles y la
// portada primera.
export function validateLayoutItems(
  template: SiteTemplate,
  items: SectionItem[],
  validBannerIds: ReadonlySet<string>
): LayoutValidation {
  const defs = SITE_SECTIONS[template];
  if (items.length > MAX_SECTION_ITEMS) return { ok: false, error: "Hay demasiados bloques en la página." };

  const seenIds = new Set<string>();
  const seenKinds = new Set<string>();
  const clean: SectionItem[] = [];

  for (const item of items) {
    if (seenIds.has(item.id)) return { ok: false, error: "Hay bloques repetidos." };
    seenIds.add(item.id);

    if (item.kind === BANNER_KIND) {
      if (!item.bannerId || !validBannerIds.has(item.bannerId)) {
        return { ok: false, error: "Uno de los banners no existe." };
      }
      clean.push({ id: item.id, kind: BANNER_KIND, bannerId: item.bannerId, visible: item.visible });
      continue;
    }

    const def = defs.find((d) => d.kind === item.kind);
    if (!def) return { ok: false, error: "Hay una sección que esta plantilla no admite." };
    if (item.id !== item.kind) return { ok: false, error: "Identificador de sección inválido." };
    if (seenKinds.has(item.kind)) return { ok: false, error: "Hay secciones repetidas." };
    if (def.locked && !item.visible) return { ok: false, error: `"${def.label}" es obligatoria y no se puede ocultar.` };
    seenKinds.add(item.kind);
    clean.push({ id: item.kind, kind: item.kind, visible: item.visible });
  }

  const missing = defs.find((d) => !seenKinds.has(d.kind));
  if (missing) return { ok: false, error: `Falta la sección "${missing.label}".` };

  const pinned = defs.find((d) => d.pinnedFirst);
  if (pinned && clean[0]?.kind !== pinned.kind) {
    return { ok: false, error: `"${pinned.label}" tiene que ir primera.` };
  }

  return { ok: true, items: clean };
}

// Operaciones puras del editor (el cliente las aplica y manda la lista
// completa; el servidor la revalida).

export function moveItem(template: SiteTemplate, items: SectionItem[], from: number, to: number): SectionItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const pinnedKind = SITE_SECTIONS[template].find((d) => d.pinnedFirst)?.kind;
  if (pinnedKind && (items[from].kind === pinnedKind || to === 0 && items[0].kind === pinnedKind)) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function setItemVisible(template: SiteTemplate, items: SectionItem[], id: string, visible: boolean): SectionItem[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    const def = getBuiltinDef(template, item.kind);
    if (def?.locked) return { ...item, visible: true };
    return { ...item, visible };
  });
}

export function insertBannerItem(items: SectionItem[], bannerId: string, afterIndex: number): SectionItem[] {
  const next = [...items];
  next.splice(Math.min(Math.max(afterIndex + 1, 1), next.length), 0, {
    id: newBannerItemId(),
    kind: BANNER_KIND,
    bannerId,
    visible: true,
  });
  return next;
}

export function removeBannerItem(items: SectionItem[], id: string): SectionItem[] {
  return items.filter((item) => !(item.id === id && item.kind === BANNER_KIND));
}
