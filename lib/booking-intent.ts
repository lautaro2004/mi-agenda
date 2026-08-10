import { isBookableService, type Service } from "@/lib/types";

export type BookingIntent = "booking" | "meeting" | "contact";

// Heurística genérica — no depende del rubro, del nombre del negocio ni de
// ningún caso especial: si el negocio tiene servicios NO reservables
// conviviendo con al menos uno reservable, lo reservable case casi siempre
// es una instancia para COORDINAR esos otros servicios (ej. "Reunión
// inicial" en una agencia que vende proyectos de semanas) — el turno no es
// el producto en sí, es el medio para hablar de él. Si en cambio TODOS los
// servicios son reservables, el turno SÍ es el producto (peluquería, cancha,
// consultorio) y corresponde el copy de reserva directa.
export function getBookingIntent(services: Service[]): BookingIntent {
  const bookable = services.filter(isBookableService);
  if (bookable.length === 0) return "contact";
  const hasNonBookable = services.some((s) => !isBookableService(s));
  return hasNonBookable ? "meeting" : "booking";
}

// Único punto que arma el link "ir a reservar" para todo el sitio público
// (header, hero, CTA intermedio, CTA final) — evita que cada componente
// reconstruya la misma URL por su cuenta. En intent "meeting" el turno
// reservable (ej. "Reunión inicial") no es un servicio comercial más: es el
// mecanismo de conversión, así que el CTA lo preselecciona directamente en
// vez de mandar al visitante a elegir entre servicios que no son turnos.
export function getBookingHref(slug: string, services: Service[], intent: BookingIntent): string {
  const base = `/s/${slug}/reservar`;
  if (intent !== "meeting") return base;
  const meetingService = services.find(isBookableService);
  return meetingService ? `${base}?servicio=${meetingService.id}` : base;
}

// Servicios que corresponde mostrar como cards comerciales en la sección de
// Servicios. En intent "meeting" el/los servicio(s) reservables se excluyen
// de la grilla (ver getBookingHref) porque no compiten visualmente con los
// servicios reales — se ofrecen como CTA de conversión en su lugar. En
// "booking"/"contact" no hay nada que excluir: ahí el turno SÍ es el
// producto, o no hay ningún turno de por medio.
export function getVisibleServices(services: Service[], intent: BookingIntent): Service[] {
  if (intent !== "meeting") return services;
  return services.filter((s) => !isBookableService(s));
}
