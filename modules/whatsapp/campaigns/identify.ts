import type { AttributionMethod } from "@/lib/campaigns";
import { normalizeText } from "@/modules/ai/intent/detect";

// Minúsculas, sin tildes y sin puntuación: "¡Hola!, quiero..." == "hola quiero".
function norm(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
}
// Singular simple: "clínicas" y "clínica" cuentan como el mismo término.
const stem = (t: string) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t);

// Identificación de la campaña de origen a partir del PRIMER mensaje de la
// conversación. Con Baileys no hay metadatos de anuncios: lo único que hay es
// el texto que escribió la persona (normalmente el mensaje precargado del
// anuncio, que puede haber editado). Es una INFERENCIA, nunca una certeza.
//
// Estrategia (la mejor señal gana, con márgenes para no elegir al azar):
//  1. prefilled_message: el mensaje contiene (o es casi) el precargado o una
//     variante configurada.
//  2. keyword_match: contiene expresiones identificadoras configuradas. Las
//     palabras sueltas y genéricas ("web", "precio") NO cuentan.
//  3. semantic_match: solapamiento de términos distintivos con la descripción
//     del anuncio / servicio promocionado. Es la señal más débil y solo
//     atribuye con solapamiento alto.

export interface IdentifiableCampaign {
  id: string;
  name: string;
  prefilledMessage: string;
  messageVariants: string[];
  keywords: string[];
  adDescription: string | null;
  promotedService: string | null;
}

export interface CampaignCandidate {
  campaignId: string;
  method: AttributionMethod;
  confidence: number;
}

export interface IdentificationResult {
  campaignId: string | null;
  method: AttributionMethod;
  confidence: number;
  /** Por qué se decidió así (para logs y para mostrar en el panel). */
  reason: "matched" | "no_campaigns" | "no_match" | "ambiguous" | "below_threshold";
  candidates: CampaignCandidate[];
}

/** Confianza mínima y diferencia mínima con la segunda candidata. */
export const MIN_CONFIDENCE = 0.6;
export const MIN_MARGIN = 0.12;

const STOP = new Set(
  (
    "a al algo ante asi con cada como con cual cuando de del desde donde el ella ellos en entre era es esa ese eso esta estoy este esto fue ha han hay la las le les lo los me mi mis mas mucho muy ni no nos nuestro o para pero por porque que quien se si sin sobre son su sus te tengo ti tu tus un una uno unos unas va vi voy y ya yo " +
      "hola buenas buen dia dias tardes noches buenos quiero queria quisiera necesito necesitaba busco gustaria saber ver info"
  ).split(" ")
);

// Palabras demasiado genéricas para identificar una campaña por sí solas.
const GENERIC = new Set(
  (
    "web pagina sitio precio precios costo costos cuanto informacion info consulta consultas servicio servicios presupuesto propuesta turno reserva cita negocio empresa mail email correo whatsapp anuncio publicidad instagram facebook"
  ).split(" ")
);

function tokens(text: string): string[] {
  return norm(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

function distinctive(text: string): string[] {
  return tokens(text).filter((t) => !GENERIC.has(t));
}

function containsPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  return ` ${haystack} `.includes(` ${phrase} `);
}

/** Qué tan parecido es el mensaje a un identificador (0..1). */
function prefilledScore(message: string, identifier: string): number {
  const msg = norm(message);
  const id = norm(identifier);
  if (!id) return 0;
  const idTokens = tokens(id);
  // Un precargado de una o dos palabras no es evidencia suficiente por sí solo.
  if (idTokens.length < 3) return containsPhrase(msg, id) && id.split(" ").length >= 3 ? 0.9 : 0;
  if (msg === id) return 1;
  if (containsPhrase(msg, id)) return 0.97;

  const msgSet = new Set(tokens(msg));
  const hits = idTokens.filter((t) => msgSet.has(t)).length;
  const coverage = hits / idTokens.length;
  // Palabras propias de la campaña (no genéricas) que aparecen: sin ninguna,
  // un mensaje parecido pero genérico no alcanza.
  const dist = distinctive(id);
  const distHits = dist.filter((t) => msgSet.has(t)).length;
  if (dist.length > 0 && distHits === 0) return 0;
  if (coverage >= 0.85) return 0.9;
  if (coverage >= 0.7) return 0.8;
  if (coverage >= 0.55 && distHits >= 2) return 0.65;
  return 0;
}

function keywordScore(message: string, keywords: string[]): number {
  const msg = norm(message);
  let hits = 0;
  for (const raw of keywords) {
    const kw = norm(raw);
    if (!kw) continue;
    const words = kw.split(" ");
    // Una palabra suelta solo cuenta si no es genérica ("web" no alcanza).
    if (words.length === 1 && (GENERIC.has(kw) || STOP.has(kw))) continue;
    if (containsPhrase(msg, kw)) hits += words.length >= 2 ? 1 : 0.7;
  }
  if (hits === 0) return 0;
  // 1 expresión: 0.62 · 2: 0.72 · 3+: 0.8
  return Math.min(0.8, 0.52 + 0.1 * hits);
}

function semanticScore(message: string, campaign: IdentifiableCampaign): number {
  const msgSet = new Set(distinctive(message));
  if (msgSet.size < 2) return 0;
  const ref = new Set(distinctive([campaign.adDescription, campaign.promotedService, campaign.name].filter(Boolean).join(" ")));
  if (ref.size < 2) return 0;
  const hits = [...ref].filter((t) => msgSet.has(t)).length;
  if (hits < 2) return 0;
  const overlap = hits / Math.min(ref.size, msgSet.size + 2);
  // Techo bajo: es la señal más débil.
  return overlap >= 0.6 ? Math.min(0.65, 0.45 + overlap * 0.25) : 0;
}

export function scoreCampaign(message: string, campaign: IdentifiableCampaign): CampaignCandidate | null {
  const identifiers = [campaign.prefilledMessage, ...campaign.messageVariants].filter((s) => s && s.trim());
  const prefilled = identifiers.reduce((max, id) => Math.max(max, prefilledScore(message, id)), 0);
  if (prefilled > 0) return { campaignId: campaign.id, method: "prefilled_message", confidence: prefilled };

  const keyword = keywordScore(message, campaign.keywords);
  if (keyword > 0) return { campaignId: campaign.id, method: "keyword_match", confidence: keyword };

  const semantic = semanticScore(message, campaign);
  if (semantic > 0) return { campaignId: campaign.id, method: "semantic_match", confidence: semantic };
  return null;
}

/**
 * Elige la campaña de origen entre las ACTIVAS recibidas. Si hay duda
 * (confianza baja o dos campañas parecidas) devuelve origen desconocido en
 * lugar de elegir una al azar.
 */
export function identifyCampaign(message: string, campaigns: IdentifiableCampaign[]): IdentificationResult {
  if (campaigns.length === 0) return { campaignId: null, method: "unknown", confidence: 0, reason: "no_campaigns", candidates: [] };

  const candidates = campaigns
    .map((c) => scoreCampaign(message, c))
    .filter((c): c is CampaignCandidate => c !== null)
    .sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) return { campaignId: null, method: "unknown", confidence: 0, reason: "no_match", candidates };

  const [best, second] = candidates;
  if (best.confidence < MIN_CONFIDENCE) return { campaignId: null, method: "unknown", confidence: best.confidence, reason: "below_threshold", candidates };
  if (second && best.confidence - second.confidence < MIN_MARGIN) return { campaignId: null, method: "unknown", confidence: best.confidence, reason: "ambiguous", candidates };
  return { campaignId: best.campaignId, method: best.method, confidence: Math.round(best.confidence * 100) / 100, reason: "matched", candidates };
}
