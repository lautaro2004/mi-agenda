// No hay ninguna infraestructura de rate limiting en el proyecto todavía
// (sección 5 del pedido: "si ya existe infraestructura" — no existe, se
// audita y se confirma). Esto es deliberadamente simple para el MVP: un
// contador en memoria por proceso, sin dependencias nuevas (Redis/Upstash).
// Limitación real y asumida: en un deploy serverless con múltiples
// instancias o cold starts frecuentes, cada instancia tiene su propio mapa
// — no es un límite global estricto, es un freno best-effort contra spam
// automatizado obvio. Si más adelante hace falta un límite duro y
// distribuido, este es el punto a reemplazar (mismo criterio que otros
// TODOs de infraestructura del proyecto, ver lib/site.ts).
const buckets = new Map<string, { count: number; resetAt: number }>();

// Barrido perezoso: se limpia una entrada vieja cada vez que se toca el mapa
// para esa key, nunca un setInterval de fondo — coherente con que este
// módulo no asume tener un proceso long-lived garantizado.
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

// IP del cliente para armar la key del límite. x-forwarded-for lo setea el
// proxy/CDN del hosting; sin él (dev local) todos comparten "unknown".
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export const RATE_LIMIT_MESSAGE = "Recibimos muchas solicitudes. Probá de nuevo en un rato.";
