import { z } from "zod";

// Slug público del negocio (/s/[slug]). Sin Prisma: lo usan el panel y la ruta.
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Palabras que chocarían con rutas de la app o confundirían a los clientes.
export const RESERVED_SLUGS = new Set([
  "api", "app", "admin", "dashboard", "login", "logout", "registro", "signup", "signin", "s", "superadmin",
  "www", "mail", "static", "assets", "public", "reservar", "carta", "nexo", "nodo", "kodexa", "soporte", "ayuda",
]);

// Pasa a minúsculas, saca tildes y reemplaza espacios/símbolos por guiones.
export function normalizeSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export const slugSchema = z
  .string()
  .transform(normalizeSlug)
  .pipe(
    z
      .string()
      .min(SLUG_MIN, `Mínimo ${SLUG_MIN} caracteres`)
      .max(SLUG_MAX, `Máximo ${SLUG_MAX} caracteres`)
      .regex(SLUG_RE, "Solo minúsculas, números y guiones")
      .refine((s) => !RESERVED_SLUGS.has(s), "Ese nombre está reservado, elegí otro")
  );

// Query string a conservar al redirigir un slug viejo (utm_*, servicio…).
export function redirectQuery(searchParams: Record<string, string | string[] | undefined> | undefined): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v) qs.set(key, v.slice(0, 200));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
