// Un número que ya generó una consulta de WhatsApp en esta ventana no genera
// otra: es la misma persona siguiendo la charla, no un lead nuevo. Archivo
// aparte para que whatsapp-lead.ts y qualification.ts la compartan sin
// importarse entre sí.
export const WHATSAPP_LEAD_WINDOW_DAYS = 30;
