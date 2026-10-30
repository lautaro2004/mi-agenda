import { CAMPAIGN_FIELD_LABEL, type CampaignField, type CampaignFieldKey } from "@/lib/campaigns";
import type { ProposalDraft, ProposalField, ProposalPlan } from "@/lib/types";
import { normalizeText } from "@/modules/ai/intent/detect";

// Lógica PURA del flujo de solicitud de propuesta: extrae datos de los
// mensajes del cliente, decide qué falta y qué preguntar. No toca la base ni
// WhatsApp (eso vive en flow.ts), así se puede probar sin infraestructura.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

export function extractEmail(text: string): string | null {
  const match = EMAIL_RE.exec(text);
  return match ? match[0].toLowerCase() : null;
}

const BUDGET_RE = /(?:u\$s|us\$|usd|\$)\s?\d[\d.,]*(?:\s?(?:mil|k|usd|d[oó]lares|pesos))?|\b\d[\d.,]*\s?(?:usd|d[oó]lares|pesos|mil pesos|mil|k)\b/i;
export function extractBudget(text: string): string | null {
  const match = BUDGET_RE.exec(text);
  return match ? match[0].trim().replace(/[.,;]+$/, "") : null;
}

const DEADLINE_RE =
  /\burgente\b|lo antes posible|cuanto antes|\basap\b|esta semana|este mes|pr[oó]xima semana|pr[oó]ximo mes|fin de (?:mes|a[nñ]o)|(?:en|dentro de) \d+ (?:d[ií]as|semanas|meses)|para (?:el )?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)|para (?:el )?\d{1,2}[/-]\d{1,2}/i;
export function extractDeadline(text: string): string | null {
  const match = DEADLINE_RE.exec(text);
  return match ? match[0].trim() : null;
}

const NAME_WORD = "[A-Za-zÁÉÍÓÚÑáéíóúñ]+";
const NAME_RE = new RegExp(`(?:me llamo|mi nombre es|mi nombre:|soy)\\s+(${NAME_WORD}(?:\\s+${NAME_WORD}){0,2})`, "i");
const NAME_STOP = new Set(["de", "del", "la", "el", "dueño", "dueno", "dueña", "duena", "el", "una", "un", "empresa", "cliente", "yo"]);

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function extractName(text: string): string | null {
  const match = NAME_RE.exec(text);
  if (!match) return null;
  const words = match[1].split(/\s+/);
  // "soy de Panadería X" / "soy el dueño" no es un nombre.
  if (NAME_STOP.has(words[0].toLowerCase())) return null;
  const kept: string[] = [];
  for (const word of words) {
    if (NAME_STOP.has(word.toLowerCase())) break;
    kept.push(word);
  }
  return kept.length ? titleCase(kept.join(" ")) : null;
}

const COMPANY_RES = [
  /(?:empresa|negocio|marca|comercio|local|estudio|agencia|restaurante|resto|emprendimiento)\s+(?:se llama|es|llamad[oa]|:)\s+["“]?([^,.\n"”]{2,50})/i,
  /(?:mi|nuestra|la)\s+(?:empresa|marca|agencia|empresa)\s*:\s*["“]?([^,.\n"”]{2,50})/i,
  /(?:soy de|somos de|trabajo en|trabajamos en|de parte de)\s+["“]?([^,.\n"”]{2,50})/i,
];
export function extractCompany(text: string): string | null {
  for (const re of COMPANY_RES) {
    const match = re.exec(text);
    if (match) return match[1].trim();
  }
  return null;
}

// Un nombre que viene del perfil de WhatsApp solo sirve si parece un nombre:
// no un teléfono ni el rótulo genérico.
export function isUsableName(name: string | null | undefined): name is string {
  const value = (name ?? "").trim();
  if (value.length < 2 || value.length > 60) return false;
  if (/^\+?[\d\s-]+$/.test(value)) return false;
  if (/^contacto de whatsapp$/i.test(value)) return false;
  return true;
}

// Una respuesta corta a "¿con qué nombre te anoto?" ("Lucas", "soy Lucas M").
function plainName(text: string): string | null {
  const explicit = extractName(text);
  if (explicit) return explicit;
  const value = text.replace(/[.!¡]+$/g, "").trim();
  if (!value || value.length > 40 || /[\d@:/]/.test(value)) return null;
  const words = value.split(/\s+/);
  if (words.length > 4) return null;
  if (words.some((w) => NAME_STOP.has(w.toLowerCase()))) return null;
  return titleCase(value);
}

// Palabras que describen el PEDIDO de propuesta y no el proyecto. Si después
// de sacarlas no queda nada, el cliente todavía no dijo qué necesita.
const REQUEST_WORDS = new Set(
  (
    "quiero queria quisiera necesito necesitaria busco hola buenas buenos dias tardes noches favor " +
    "un una uno el la lo los las de del al a y e o en con para por que me mi mis tu su se te " +
    "mandame mandanos enviame pasame mandar enviar pasar armar armarme hacer hacerme pedir solicitar " +
    "presupuesto presupuestos propuesta propuestas cotizacion cotizar proforma oferta comercial " +
    "mail email correo informacion info detalle mejor dije no si ok dale gracias pues " +
    "algo cosa esto eso ahi aca"
  ).split(" ")
);

export function hasSubstance(text: string): boolean {
  const withoutEmail = text.replace(EMAIL_RE, " ");
  const tokens = normalizeText(withoutEmail)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !REQUEST_WORDS.has(t));
  return tokens.length > 0;
}

function cleanNeed(text: string): string {
  return text.replace(EMAIL_RE, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

const SKIP_RE = /^(listo|nada|ninguno|ninguna|no|no gracias|nada mas|eso es todo|eso|sigamos|salteo|omitir|despues|luego|no tengo)[\s!.]*$/i;
const PREFERS_CHAT_RE = /(prefiero|mejor|por|a traves de|via)\s+(aca|ac[aá]|este chat|whatsapp|wsp|wpp)|no tengo (mail|email|correo)/i;
const YES_RE = /^(si|sí|sii+|dale|ok|okay|confirmo|confirmado|correcto|perfecto|esta bien|está bien|listo|va|de una|enviar|envialo|registralo|mandalo|joya)\b[\s!.,]*$/i;
const NO_RE = /^(no|nop|corregir|cambiar|modificar|esperá|espera|ojo|ahi no|ahí no)\b/i;

export const isYes = (text: string) => YES_RE.test(normalizeText(text)) || YES_RE.test(text.trim());
export const isNo = (text: string) => NO_RE.test(normalizeText(text));

export interface DraftInit {
  firstMessage: string;
  profileName?: string | null;
  // Datos que ya se habían recopilado en otro flujo (ej. el servicio elegido
  // en una reserva que el cliente abandonó): no se pierden ni se vuelven a pedir.
  carry?: { service?: string | null; name?: string | null; email?: string | null; need?: string | null };
  // Qué datos pedir (de la campaña). Sin plan: need + email + nombre y,
  // opcionales, empresa / presupuesto / plazo.
  plan?: ProposalPlan;
  campaign?: { id: string; name: string };
}

export const DEFAULT_PLAN: ProposalPlan = { required: ["need", "email", "name"], optional: ["company", "budget", "deadline"] };

// "phone" lo da el propio chat de WhatsApp: nunca se pregunta.
const NEVER_ASKED = new Set<CampaignFieldKey>(["phone"]);

/** Plan de preguntas a partir de los campos configurados en la campaña. */
export function planFromFields(fields: CampaignField[], extra: Pick<ProposalPlan, "goal" | "offerMeeting"> = {}): ProposalPlan {
  const usable = fields.filter((f) => !NEVER_ASKED.has(f.key));
  const custom = usable.find((f) => f.key === "custom");
  return {
    ...extra,
    required: usable.filter((f) => f.required).map((f) => f.key),
    optional: usable.filter((f) => !f.required).map((f) => f.key),
    ...(custom?.label ? { customLabel: custom.label } : {}),
  };
}

const planOf = (draft: ProposalDraft): ProposalPlan => draft.plan ?? DEFAULT_PLAN;

function has(draft: ProposalDraft, key: CampaignFieldKey): boolean {
  switch (key) {
    case "need": return !!draft.need;
    case "email": return !!draft.email || !!draft.emailWaived;
    case "name": return !!draft.name;
    case "lastName": return !!draft.extra?.lastName || (draft.name ?? "").trim().split(/\s+/).length >= 2;
    case "company": return !!draft.company;
    case "budget": return !!draft.budget;
    case "deadline": return !!draft.deadline;
    case "phone": return true;
    default: return !!draft.extra?.[key];
  }
}

function emptyDraft(init?: DraftInit): ProposalDraft {
  return {
    pending: "need",
    extrasAsked: false,
    startedAt: new Date().toISOString(),
    ...(init?.plan ? { plan: init.plan } : {}),
    ...(init?.campaign ? { campaignId: init.campaign.id, campaignName: init.campaign.name } : {}),
  };
}

export function startDraft(init: DraftInit): ProposalDraft {
  let draft = emptyDraft(init);
  if (isUsableName(init.carry?.name)) draft.name = init.carry!.name!.trim();
  else if (isUsableName(init.profileName)) draft = { ...draft, name: init.profileName.trim(), nameFromProfile: true };
  if (init.carry?.email) draft.email = init.carry.email;
  if (init.carry?.need) draft.need = init.carry.need;
  else if (init.carry?.service) draft.need = init.carry.service;

  draft = absorb(draft, init.firstMessage, { allowNeed: true });
  return { ...draft, pending: nextField(draft) };
}

interface AbsorbOptions {
  allowNeed?: boolean;
}

// Toma de un mensaje TODO lo que se pueda reconocer, sin importar qué se
// preguntó: así el cliente que da varios datos juntos no recibe preguntas
// repetidas.
function absorb(draft: ProposalDraft, message: string, options: AbsorbOptions = {}): ProposalDraft {
  const next: ProposalDraft = { ...draft };
  const email = extractEmail(message);
  if (email) next.email = email;
  const name = extractName(message);
  if (name) {
    next.name = name;
    next.nameFromProfile = false;
  }
  const company = extractCompany(message);
  if (company) next.company = company;
  const budget = extractBudget(message);
  if (budget) next.budget = budget;
  const deadline = extractDeadline(message);
  if (deadline) next.deadline = deadline;

  if (options.allowNeed && !next.need && hasSubstance(message)) {
    // Sin el email/datos sueltos, lo que queda describe el proyecto.
    next.need = cleanNeed(message);
  }
  return next;
}

export function nextField(draft: ProposalDraft): ProposalField {
  const plan = planOf(draft);
  // Se pregunta en el orden en que la campaña definió los campos.
  for (const key of plan.required) {
    if (!has(draft, key)) return key;
  }
  // Los opcionales se ofrecen UNA vez, juntos, y solo si falta alguno.
  if (!draft.extrasAsked && plan.optional.some((k) => !has(draft, k))) return "extras";
  return "confirm";
}

export interface TurnResult {
  draft: ProposalDraft;
  // true si el mensaje aportó o cambió algún dato.
  changed: boolean;
  // true si se preguntó algo y la respuesta no se pudo interpretar.
  unclear: boolean;
}

function sameData(a: ProposalDraft, b: ProposalDraft): boolean {
  return (
    (["name", "email", "company", "need", "details", "budget", "deadline", "emailWaived"] as const).every((k) => a[k] === b[k]) &&
    JSON.stringify(a.extra ?? {}) === JSON.stringify(b.extra ?? {})
  );
}

// "No quiero darlo", "prefiero no decirlo"…: se respeta si el dato es opcional.
const REFUSAL_RE = /^(no quiero|prefiero no|no te lo|no lo voy|no puedo|no doy|no lo se|no s[eé]|paso|sin datos)\b/i;
export const isRefusal = (text: string) => REFUSAL_RE.test(normalizeText(text.trim()));

const SHORT_TEXT_MAX: Partial<Record<CampaignFieldKey, number>> = { company: 60, budget: 40, deadline: 40 };

// Respuesta directa a la pregunta de UN campo (el cliente contesta solo el dato).
function applyDirectAnswer(next: ProposalDraft, key: CampaignFieldKey, text: string): boolean {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length < 2 || isRefusal(value)) return false;
  switch (key) {
    case "company": next.company = value.slice(0, SHORT_TEXT_MAX.company); return true;
    case "budget": next.budget = value.slice(0, SHORT_TEXT_MAX.budget); return true;
    case "deadline": next.deadline = value.slice(0, SHORT_TEXT_MAX.deadline); return true;
    case "lastName": {
      const last = value.split(/\s+/).slice(0, 3).join(" ");
      next.extra = { ...next.extra, lastName: titleCase(last) };
      return true;
    }
    default:
      next.extra = { ...next.extra, [key]: value.slice(0, 160) };
      return true;
  }
}

export function applyMessage(draft: ProposalDraft, message: string, opts: { phoneAvailable?: boolean } = {}): TurnResult {
  const text = message.trim();
  const next = absorb(draft, text);
  let unclear = false;

  switch (draft.pending) {
    case "need":
      if (!next.need) {
        if (hasSubstance(text)) next.need = cleanNeed(text);
        else unclear = true;
      }
      break;
    case "email":
      if (!next.email) {
        if (opts.phoneAvailable && PREFERS_CHAT_RE.test(text)) next.emailWaived = true;
        else unclear = true;
      }
      break;
    case "name":
      if (!extractName(text)) {
        const name = plainName(text);
        if (name) {
          next.name = name;
          next.nameFromProfile = false;
        } else if (!next.name) unclear = true;
      }
      break;
    case "extras":
      next.extrasAsked = true;
      if (!SKIP_RE.test(normalizeText(text)) && !isRefusal(text)) {
        const structured = next.company !== draft.company || next.budget !== draft.budget || next.deadline !== draft.deadline;
        if (!structured && text) next.details = [draft.details, text].filter(Boolean).join(" · ").slice(0, 500);
      }
      break;
    case "edit": {
      // Corrección explícita de lo que se mostró en el resumen.
      const needMatch = /(?:necesito|quiero|busco|es para|se trata de)\s+(.+)/i.exec(text);
      if (needMatch && hasSubstance(needMatch[1])) next.need = cleanNeed(needMatch[1]);
      const companyOnly = /^(?:empresa|negocio|marca)\s*[:=-]\s*(.+)$/i.exec(text);
      if (companyOnly) next.company = companyOnly[1].trim().slice(0, 60);
      if (sameData(draft, next)) unclear = true;
      break;
    }
    case "confirm":
      break;
    default: {
      // Campos configurados por la campaña (rubro, ubicación, apellido, etc.).
      const key = draft.pending as CampaignFieldKey;
      if (!has(next, key) && !applyDirectAnswer(next, key, text)) unclear = true;
      break;
    }
  }

  const changed = !sameData(draft, next);
  const result: ProposalDraft = { ...next, pending: nextField(next) };
  // Estando en confirmación/edición, si cambió algo se vuelve a mostrar el resumen.
  if ((draft.pending === "confirm" || draft.pending === "edit") && (changed || next.extrasAsked)) result.pending = "confirm";
  if (draft.pending === "edit" && unclear) result.pending = "edit";
  return { draft: result, changed, unclear };
}

// ── Textos ────────────────────────────────────────────────────────────────

export function questionFor(field: ProposalField, draft: ProposalDraft, opts: { first?: boolean } = {}): string {
  const lead = opts.first ? "¡Claro, te ayudo con eso! 😊 " : "";
  switch (field) {
    case "need":
      return `${lead}Para armar la propuesta, ¿qué servicio o proyecto necesitás? Contame brevemente de qué se trata.`;
    case "email":
      return `${lead}¿A qué email puede escribirte el equipo con la propuesta?`;
    case "name":
      return `${lead}¿Con qué nombre te anoto?`;
    case "extras": {
      const missing = (draft.plan ?? DEFAULT_PLAN).optional.filter((k) => !has(draft, k));
      const labels = missing.map((k) => (k === "custom" ? (draft.plan?.customLabel ?? CAMPAIGN_FIELD_LABEL.custom) : CAMPAIGN_FIELD_LABEL[k]).toLowerCase().replace(/\?$/, ""));
      const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} o ${labels.at(-1)}` : (labels[0] ?? "algún dato más");
      return `${lead}Si querés, sumá ${list}. Es opcional: si no, respondé *listo*.`;
    }
    case "service":
      return `${lead}¿Qué servicio te interesa?`;
    case "lastName":
      return `${lead}¿Y tu apellido?`;
    case "company":
      return `${lead}¿Cómo se llama tu empresa o negocio?`;
    case "industry":
      return `${lead}¿De qué rubro es tu negocio?`;
    case "location":
      return `${lead}¿En qué ciudad o zona estás?`;
    case "budget":
      return `${lead}¿Tenés un presupuesto estimado en mente?`;
    case "deadline":
      return `${lead}¿Para cuándo lo necesitarías?`;
    case "custom":
      return `${lead}${draft.plan?.customLabel ?? "¿Podés darme un dato más?"}`;
    case "phone":
      return `${lead}Ya tengo tu número por este chat.`;
    case "edit":
      return "¿Qué querés corregir? Decime el dato nuevo, por ejemplo «mi email es …», «me llamo …», «empresa: …» o «necesito …».";
    case "confirm":
      return buildSummary(draft);
  }
}

export function clarificationFor(field: ProposalField): string {
  switch (field) {
    case "email":
      return "No pude reconocer ese email. ¿Podés escribirlo de nuevo? (por ejemplo: nombre@dominio.com)";
    case "name":
      return "No pude identificar tu nombre. ¿Cómo te llamás?";
    case "need":
      return "Para avanzar necesito saber qué servicio o proyecto necesitás. ¿Me lo contás en una frase?";
    case "service":
    case "lastName":
    case "company":
    case "industry":
    case "location":
    case "budget":
    case "deadline":
    case "custom":
      return "Necesito ese dato para registrar tu solicitud. ¿Me lo pasás?";
    case "edit":
      return "No pude identificar qué dato corregir. Probá con «mi email es …», «me llamo …», «empresa: …» o «necesito …».";
    default:
      return "No te entendí del todo. ¿Podés repetirlo?";
  }
}

export function fullName(draft: ProposalDraft): string | undefined {
  const last = draft.extra?.lastName;
  if (!draft.name) return undefined;
  return last && !draft.name.toLowerCase().includes(last.toLowerCase()) ? `${draft.name} ${last}` : draft.name;
}

function extraLines(draft: ProposalDraft): string[] {
  const out: string[] = [];
  const e = draft.extra ?? {};
  if (e.service) out.push(`Servicio de interés: ${e.service}`);
  if (e.industry) out.push(`Rubro: ${e.industry}`);
  if (e.location) out.push(`Ubicación: ${e.location}`);
  if (e.custom) out.push(`${(draft.plan?.customLabel ?? "Dato adicional").replace(/[¿?]/g, "").trim()}: ${e.custom}`);
  return out;
}

export function buildSummary(draft: ProposalDraft): string {
  const lines = [
    fullName(draft) ? `• Nombre: ${fullName(draft)}` : null,
    draft.email ? `• Email: ${draft.email}` : draft.emailWaived ? "• Contacto: por este chat de WhatsApp" : null,
    draft.company ? `• Empresa: ${draft.company}` : null,
    draft.need ? `• Necesidad: ${draft.need}` : null,
    draft.budget ? `• Presupuesto estimado: ${draft.budget}` : null,
    draft.deadline ? `• Plazo: ${draft.deadline}` : null,
    ...extraLines(draft).map((l) => `• ${l}`),
    draft.details ? `• Detalles: ${draft.details}` : null,
  ].filter((l): l is string => l != null);
  return `Esto es lo que voy a registrar para que el equipo ${draft.plan?.goal === "proposal" || !draft.plan ? "prepare tu propuesta" : "se comunique con vos"}:\n\n${lines.join("\n")}\n\n¿Está bien? Respondé *sí* para registrarlo o decime qué querés corregir.`;
}

// Resumen que se guarda en el interesado (lo ve el equipo y, si hay Nodo, el CRM).
export function buildLeadSummary(draft: ProposalDraft): string {
  return [
    draft.campaignName ? `Campaña: ${draft.campaignName}.` : null,
    draft.plan?.goal === "lead" ? "Contacto captado por WhatsApp." : "Solicitud de propuesta por WhatsApp.",
    ...extraLines(draft).map((l) => `${l}.`),
    draft.company ? `Empresa: ${draft.company}.` : null,
    draft.budget ? `Presupuesto estimado: ${draft.budget}.` : null,
    draft.deadline ? `Plazo: ${draft.deadline}.` : null,
    draft.details ? `Detalles: ${draft.details}.` : null,
    draft.emailWaived ? "El cliente prefiere recibirla por WhatsApp." : null,
  ]
    .filter((l): l is string => l != null)
    .join(" ")
    .slice(0, 1000);
}
