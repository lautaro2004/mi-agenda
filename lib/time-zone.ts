// Zona horaria del negocio. Los turnos se guardan como strings locales
// ("YYYY-MM-DD" / "HH:MM"), así que "hoy" y "ahora" se calculan SIEMPRE en la
// zona del negocio, nunca en UTC (el servidor corre en UTC: pasadas las 21 h
// en Argentina, "hoy" en UTC ya es mañana).
export const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const TIME_ZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires) · UTC-3" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo) · UTC-3" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Asuncion", label: "Paraguay (Asunción)" },
  { value: "America/La_Paz", label: "Bolivia (La Paz) · UTC-4" },
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo) · UTC-3" },
  { value: "America/Lima", label: "Perú (Lima) · UTC-5" },
  { value: "America/Bogota", label: "Colombia (Bogotá) · UTC-5" },
  { value: "America/Guayaquil", label: "Ecuador (Guayaquil) · UTC-5" },
  { value: "America/Caracas", label: "Venezuela (Caracas) · UTC-4" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Panama", label: "Panamá · UTC-5" },
  { value: "America/New_York", label: "Estados Unidos (Este)" },
  { value: "America/Los_Angeles", label: "Estados Unidos (Pacífico)" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
];

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(tz: string | null | undefined): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}

/** Fecha "YYYY-MM-DD" de hoy en la zona dada. */
export function todayInZone(tz: string | null | undefined = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Date a medianoche (hora del servidor) con el año/mes/día locales de la zona; sirve para getDay().
export function localDayAsDate(tz: string | null | undefined = DEFAULT_TIME_ZONE, now: Date = new Date()): Date {
  return new Date(`${todayInZone(tz, now)}T00:00:00`);
}
