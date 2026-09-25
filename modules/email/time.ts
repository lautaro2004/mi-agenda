// Nexo opera en Argentina (moneda ARS) y no guarda zona horaria por negocio:
// fecha y hora de los turnos son strings locales "YYYY-MM-DD"/"HH:MM".
// Argentina no usa horario de verano, así que el offset es fijo (UTC-3).
export const BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires";
const OFFSET = "-03:00";

export function getLocalNow(now: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

// Instante real de un turno guardado como fecha + hora locales.
export function appointmentStart(date: string, startTime: string): Date {
  return new Date(`${date}T${startTime}:00${OFFSET}`);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00${OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return getLocalNow(d).date;
}

export function formatDateEs(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00${OFFSET}`));
}
