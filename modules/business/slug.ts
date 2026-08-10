import { prisma } from "@/lib/prisma";

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

export async function getBusinessIdBySlug(slug: string): Promise<string | null> {
  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } });
  return business?.id ?? null;
}
