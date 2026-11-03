import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { isPublicWebEnabled } from "@/modules/billing/subscription";
import { slugSchema } from "@/lib/slug";

// Ej: "Mango IT" -> "mango-it". Determinístico, sin dependencias externas.
function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 60) || "negocio";
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (await prisma.business.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

// El slug es la URL pública (/s/[slug]) y se genera UNA sola vez — ver el
// comentario en Business.slug del schema. Perezoso a propósito: cubre tanto
// negocios nuevos como los creados antes de que existiera esta feature, sin
// necesitar backfill de datos aparte. Si el negocio ya tiene slug, se
// devuelve tal cual SIN mirar si el nombre cambió después.
export async function getOrCreateSlug(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { slug: true, name: true },
  });
  if (!business) throw new Error(`Business ${businessId} no existe`);
  if (business.slug) return business.slug;

  const slug = await generateUniqueSlug(business.name || "negocio");
  await prisma.business.update({ where: { id: businessId }, data: { slug } });
  return slug;
}

// cache() de React: cada página pública (ver app/s/[slug]/page.tsx y
// app/s/[slug]/reservar/page.tsx) llama a esto tanto en generateMetadata()
// como en el componente de página — sin memoizar, eso era una consulta a
// Postgres DUPLICADA en cada navegación (una de las causas reales de la
// sensación de lentitud del flujo de reserva, ver auditoría). cache() dedupea
// por argumento dentro de un mismo request/render — no cambia ningún
// comportamiento, solo evita repetir el mismo query dos veces.
export const getBusinessIdBySlug = cache(async (slug: string): Promise<string | null> => {
  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } });
  return business?.id ?? null;
});

// Igual que getBusinessIdBySlug, pero solo resuelve negocios cuyo plan
// incluye web pública (Plan.publicWebEnabled — Esencial en adelante). Un
// negocio en "Agenda interna" sigue teniendo slug pero /s/[slug] y
// /api/public/[slug]/* responden como "no encontrado". Es el único lector
// que usan las páginas y rutas públicas — ninguna reimplementa el chequeo.
export const getPublicBusinessIdBySlug = cache(async (slug: string): Promise<string | null> => {
  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) return null;
  return (await isPublicWebEnabled(businessId)) ? businessId : null;
});

// Slug actual al que debe redirigir un slug viejo (null si no hay redirección).
export const getRedirectTargetSlug = cache(async (oldSlug: string): Promise<string | null> => {
  try {
    const row = await prisma.siteSlugRedirect.findUnique({
      where: { oldSlug },
      select: { business: { select: { slug: true } } },
    });
    return row?.business.slug ?? null;
  } catch {
    return null;
  }
});

export type ChangeSlugResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "invalid" | "taken"; message: string };

// Cambia la URL pública. El slug viejo pasa a redirigir al nuevo (los links ya
// compartidos siguen funcionando) y queda reservado. Si el negocio vuelve a un
// slug propio anterior, se borra esa redirección.
export async function changeSlug(businessId: string, input: string): Promise<ChangeSlugResult> {
  const parsed = slugSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message ?? "Slug inválido" };
  }
  const next = parsed.data;

  const current = await prisma.business.findUnique({ where: { id: businessId }, select: { slug: true } });
  if (!current) return { ok: false, reason: "invalid", message: "Negocio no encontrado." };
  if (current.slug === next) return { ok: true, slug: next };

  const [owner, redirect] = await Promise.all([
    prisma.business.findUnique({ where: { slug: next }, select: { id: true } }),
    prisma.siteSlugRedirect.findUnique({ where: { oldSlug: next }, select: { businessId: true } }),
  ]);
  if (owner && owner.id !== businessId) return { ok: false, reason: "taken", message: "Esa URL ya está en uso, probá con otra." };
  if (redirect && redirect.businessId !== businessId) {
    return { ok: false, reason: "taken", message: "Esa URL perteneció a otro negocio y está reservada." };
  }

  try {
    await prisma.$transaction([
      prisma.siteSlugRedirect.deleteMany({ where: { businessId, oldSlug: next } }),
      prisma.business.update({ where: { id: businessId }, data: { slug: next } }),
      ...(current.slug
        ? [
            prisma.siteSlugRedirect.upsert({
              where: { oldSlug: current.slug },
              update: { businessId },
              create: { oldSlug: current.slug, businessId },
            }),
          ]
        : []),
    ]);
  } catch (error) {
    // Choque de unicidad por una carrera entre dos cambios simultáneos.
    console.error("[slug] No se pudo cambiar el slug:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "taken", message: "No pudimos cambiar la URL. Probá con otra." };
  }
  return { ok: true, slug: next };
}
