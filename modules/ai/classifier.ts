import type { MessageIntent } from "@/modules/ai/types";

type Pattern = { intent: MessageIntent; re: RegExp };

const PATTERNS: Pattern[] = [
  {
    intent: "human",
    re: /hablar con|hablar a|hablar al|person[ao]|human[ao]|dueñ[ao]|encargad[ao]|alguien de|no entend[eé]|no me entend|quiero hablar|necesito hablar|operador|manager|jef[ae]/i,
  },
  {
    intent: "appointment",
    re: /turno|reserv[ao]|reservar|agendar|sacar (un )?turno|quiero (un |sacar |reservar |pedir )(turno|cita)|quiero (una )?cita|pedir turno|hacer (una )?cita|cancel(ar)? (turno|cita)|fecha disponible|hora disponible|cuándo (puedo|podría|podes|puedo|pueden)/i,
  },
  {
    intent: "pricing",
    re: /precio|costo|cuánto (sale|cuesta|cobran|cobras|cobra|vale|valen)|tarifa|valor|presupuest|plata|pesos|\\$|gratis|gratuito|precio/i,
  },
  {
    intent: "schedule",
    re: /horario|qué (hora|horas|días)|a qué hora|cuándo (abren|cierran|atienden|están|abre|cierra)|están abiertos|días de atención|hora de atención|fin de semana|abierto|cerrado|trabajan/i,
  },
  {
    intent: "location",
    re: /dónde (están|queda|es|se encuentra|quedan)|dirección|ubica(ción|dos|do)|cómo llego|cómo se llega|dónde los encuentro|domicilio|barrio|calle|ubicación/i,
  },
  {
    intent: "service",
    re: /qué (servicios|hacen|ofrecen|hacés|realizan|trabajan)|qué (tipo de |clases de )?servici|qué (traba|ofrec)|qué hac[eé]|tienen (servicio|tratamiento|opción)|servicio|tratamiento/i,
  },
];

export function classifyIntent(text: string): MessageIntent {
  for (const { intent, re } of PATTERNS) {
    if (re.test(text)) return intent;
  }
  return "other";
}
