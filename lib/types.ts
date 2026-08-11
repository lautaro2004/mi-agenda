export type WeekDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEK_DAYS: { id: WeekDay; label: string; short: string }[] = [
  { id: "monday", label: "Lunes", short: "Lun" },
  { id: "tuesday", label: "Martes", short: "Mar" },
  { id: "wednesday", label: "Miércoles", short: "Mié" },
  { id: "thursday", label: "Jueves", short: "Jue" },
  { id: "friday", label: "Viernes", short: "Vie" },
  { id: "saturday", label: "Sábado", short: "Sáb" },
  { id: "sunday", label: "Domingo", short: "Dom" },
];

export const BUSINESS_CATEGORIES = [
  "Peluquería / Barbería",
  "Salón de belleza",
  "Spa / Centro de estética",
  "Consultorio médico",
  "Consultorio odontológico",
  "Estudio de tatuajes",
  "Gimnasio / Entrenador personal",
  "Veterinaria",
  "Otro",
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export interface Business {
  id: string;
  name: string;
  logoUrl: string | null;
  // Apariencia mínima del sitio público — ver lib/site-assets.ts (Supabase
  // Storage) y lib/brand-color.ts. Nunca base64, siempre una URL pública.
  heroImageUrl: string | null;
  brandColor: string | null;
  // String libre, no BusinessCategory: el dashboard sigue restringiendo a
  // BUSINESS_CATEGORIES en su <Select> (businessInfoSchema), pero el rubro
  // contado en el onboarding conversacional puede ser cualquier texto — no
  // tiene sentido rechazar "Desarrollo de software y IT" solo porque no está
  // en la lista cerrada del formulario. La columna en Postgres ya era texto
  // libre; esto solo hace que el tipo de TypeScript refleje la realidad.
  category: string;
  description: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  instagramUrl: string;
  facebookUrl: string;
  // URL pública en /s/[slug]. null hasta que se genera (ver
  // modules/business/slug.ts) — se crea una sola vez y después no cambia
  // solo, aunque el nombre del negocio cambie.
  slug: string | null;
}

export interface BusinessScheduleDay {
  day: WeekDay;
  enabled: boolean;
  openTime: string;
  closeTime: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
}

export type BusinessSchedule = BusinessScheduleDay[];

export type SchedulePreset = "weekdays" | "weekdays-saturday" | "every-day" | "custom";

export const SERVICE_CATEGORIES = [
  "Cortes",
  "Barba",
  "Coloración",
  "Tratamientos",
  "Cuidado facial",
  "Manicura y pedicura",
  "Otro",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export interface Service {
  id: string;
  businessId: string;
  name: string;
  description: string;
  // String libre, no ServiceCategory: SERVICE_CATEGORIES es una lista para
  // el <Select> del dashboard, pensada para rubros de belleza/estética. Un
  // servicio de "Landing Pages" (o cualquier rubro no cubierto por esa
  // lista) sigue siendo un Service real aunque su categoría no esté en el
  // dropdown — la columna en Postgres ya era texto libre.
  category: string;
  durationMinutes: number;
  price: number;
}

// "0" (o ausente al crear) es el sentinel para "no es un servicio reservable
// por turno" — nunca un valor real de duración (serviceSchema, el que valida
// el formulario del dashboard, exige mínimo 5 minutos, así que 0 nunca puede
// significar otra cosa). Vive acá (no en modules/business/service.ts, que
// importa Prisma) para poder usarse también desde componentes cliente como
// ServiceCard sin arrastrar el cliente de Prisma al bundle del browser.
export function isBookableService(service: Pick<Service, "durationMinutes">): boolean {
  return service.durationMinutes > 0;
}

// ---- Resource (recurso físico reservable: cancha, sala, silla...) ----
// N:M con Service vía ServiceResource — ver comentario en schema.prisma.
// Un service sin recursos asociados sigue usando la agenda general del
// negocio exactamente como antes; esto es estrictamente aditivo.

export interface Resource {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface FAQ {
  id: string;
  businessId: string;
  question: string;
  answer: string;
}

// ---- SEO automático (ver modules/business/seo.ts) ----
// Generado por IA a partir de datos reales, guardado una vez, consumido por
// el sitio público sin volver a llamar a Gemini. keywords es uso interno,
// nunca se renderiza como <meta name="keywords">.

export interface SeoConfig {
  seoTitle: string;
  metaDescription: string;
  h1: string;
  ogTitle: string;
  ogDescription: string;
  keywords: string[];
  extraText: string | null;
  generatedAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = "pending" | "active" | "expired";

export interface Subscription {
  id: string;
  businessId: string;
  plan: "unico";
  status: SubscriptionStatus;
  startDate: string | null;
  renewsAt: string | null;
}

export type WhatsAppConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface WhatsAppConnection {
  status: WhatsAppConnectionStatus;
  phoneNumber: string | null;
  connectedAt: string | null;
  lastError: string | null;
  aiEnabled: boolean;
  qr: string | null;
}

export interface WhatsAppSession {
  id: string;
  businessId: string;
  status: WhatsAppConnectionStatus;
  phoneNumber: string | null;
  connectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
}

export const CONVERSATION_LABELS = [
  "service_inquiry",
  "appointment_request",
  "pricing",
  "human_required",
  "spam",
] as const;

export type ConversationLabel = (typeof CONVERSATION_LABELS)[number];

export const CONVERSATION_LABEL_META: Record<ConversationLabel, { label: string; className: string }> = {
  service_inquiry: {
    label: "Consulta de servicio",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  appointment_request: {
    label: "Solicitud de turno",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  pricing: {
    label: "Precios",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  human_required: {
    label: "Requiere humano",
    className: "bg-destructive/10 text-destructive",
  },
  spam: {
    label: "Spam",
    className: "bg-muted text-muted-foreground",
  },
};

export const CONVERSATION_STATUSES = ["open", "waiting", "closed"] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CONVERSATION_STATUS_META: Record<ConversationStatus, { label: string; className: string }> = {
  open: {
    label: "Abierta",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  waiting: {
    label: "Esperando",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  closed: {
    label: "Cerrada",
    className: "bg-muted text-muted-foreground",
  },
};

export type MessageSender = "customer" | "business" | "ai";

export interface ConversationMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
}

// ---- Conversation flow state machine ----

export type ConversationFlowState =
  | "IDLE"
  | "COLLECTING_INTENT"
  | "OFFERING_SLOTS"
  | "WAITING_SLOT_SELECTION"
  | "WAITING_CONFIRMATION"
  | "BOOKED"
  | "HUMAN_HANDOFF";

export const FLOW_STATE_META: Record<ConversationFlowState, { label: string; className: string }> = {
  IDLE: { label: "Inactivo", className: "bg-muted text-muted-foreground" },
  COLLECTING_INTENT: { label: "Recopilando intención", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  OFFERING_SLOTS: { label: "Ofreciendo horarios", className: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  WAITING_SLOT_SELECTION: { label: "Esperando selección", className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  WAITING_CONFIRMATION: { label: "Esperando confirmación", className: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  BOOKED: { label: "Turno reservado", className: "bg-green-500/10 text-green-600 dark:text-green-400" },
  HUMAN_HANDOFF: { label: "Transferido a humano", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

// ---- Message category (triage classification) ----

export type MessageCategory =
  | "APPOINTMENT"
  | "PRICING"
  | "SERVICE"
  | "SCHEDULE"
  | "HUMAN"
  | "IRRELEVANT";

export const MESSAGE_CATEGORY_META: Record<MessageCategory, { label: string }> = {
  APPOINTMENT: { label: "Turno" },
  PRICING: { label: "Precios" },
  SERVICE: { label: "Servicio" },
  SCHEDULE: { label: "Horarios" },
  HUMAN: { label: "Atención humana" },
  IRRELEVANT: { label: "Irrelevante" },
};

export interface ConversationTriage {
  category: MessageCategory;
  confidence: number;
  action: "responded" | "ignored" | "escalated";
  ignoreReason?: string;
  at: string;
}

// ---- Conversation ----

// ---- Booking session (stateful appointment flow) ----

export type BookingStep =
  | "need_service"
  | "need_date"
  | "need_slot"
  | "need_confirmation"
  | "confirmed"
  | "cancel_confirm"
  | "reschedule_date"
  | "reschedule_slot"
  | "reschedule_confirm";

export interface BookingSession {
  step: BookingStep;
  service: string | null;
  serviceId: string | null;
  preferredDate: string | null;
  preferredDateLabel: string | null;
  availableSlots: string[];
  selectedSlot: string | null;
  action?: "new" | "cancel" | "reschedule";
  existingAppointmentId?: string;
  serviceDurationMinutes?: number;
}

// ---- Appointment (persisted in DB) ----

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

export interface Appointment {
  id: string;
  businessId: string;
  serviceId: string | null;
  serviceName: string;
  // null si el servicio no usa recursos (comportamiento actual) o si el
  // negocio nunca configuró Resources — nunca se inventa un valor acá.
  resourceId: string | null;
  customerName: string;
  customerPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Conversation ----

export interface Conversation {
  id: string;
  businessId: string;
  contactName: string;
  contactPhone: string;
  labels: ConversationLabel[];
  status: ConversationStatus;
  manualMode: boolean;
  unreadCount: number;
  updatedAt: string;
  messages: ConversationMessage[];
  importedFromHistory?: boolean;
  flowState: ConversationFlowState;
  lastTriage?: ConversationTriage;
  bookingSession?: BookingSession;
}

export type WhatsAppEvent =
  | { type: "connection"; payload: WhatsAppConnection }
  | { type: "conversation"; payload: Conversation }
  | { type: "message"; payload: { conversationId: string; message: ConversationMessage } };

export interface OnboardingState {
  step: number;
  business: Business;
  schedule: BusinessSchedule;
  services: Service[];
  faqs: FAQ[];
  subscription: Subscription;
  completed: boolean;
}

// ---- AI Employee profile ----

export const EMPLOYEE_FORMALITY_LEVELS = ["casual", "neutral", "formal"] as const;
export type EmployeeFormality = (typeof EMPLOYEE_FORMALITY_LEVELS)[number];
export const EMPLOYEE_FORMALITY_META: Record<EmployeeFormality, { label: string }> = {
  casual: { label: "Casual" },
  neutral: { label: "Neutral" },
  formal: { label: "Formal" },
};

export const EMPLOYEE_WARMTH_LEVELS = ["reserved", "balanced", "warm"] as const;
export type EmployeeWarmth = (typeof EMPLOYEE_WARMTH_LEVELS)[number];
export const EMPLOYEE_WARMTH_META: Record<EmployeeWarmth, { label: string }> = {
  reserved: { label: "Reservada" },
  balanced: { label: "Equilibrada" },
  warm: { label: "Cercana" },
};

export const EMPLOYEE_EMOJI_USAGE_LEVELS = ["none", "low", "medium", "high"] as const;
export type EmployeeEmojiUsage = (typeof EMPLOYEE_EMOJI_USAGE_LEVELS)[number];
export const EMPLOYEE_EMOJI_USAGE_META: Record<EmployeeEmojiUsage, { label: string }> = {
  none: { label: "Sin emojis" },
  low: { label: "Baja" },
  medium: { label: "Media" },
  high: { label: "Alta" },
};

export const EMPLOYEE_RESPONSE_LENGTH_LEVELS = ["short", "medium", "long"] as const;
export type EmployeeResponseLength = (typeof EMPLOYEE_RESPONSE_LENGTH_LEVELS)[number];
export const EMPLOYEE_RESPONSE_LENGTH_META: Record<EmployeeResponseLength, { label: string }> = {
  short: { label: "Corta" },
  medium: { label: "Media" },
  long: { label: "Larga" },
};

export const EMPLOYEE_COMMERCIAL_LEVEL_LEVELS = ["low", "balanced", "high"] as const;
export type EmployeeCommercialLevel = (typeof EMPLOYEE_COMMERCIAL_LEVEL_LEVELS)[number];
export const EMPLOYEE_COMMERCIAL_LEVEL_META: Record<EmployeeCommercialLevel, { label: string }> = {
  low: { label: "Baja" },
  balanced: { label: "Equilibrada" },
  high: { label: "Alta" },
};

export const EMPLOYEE_CAPABILITIES = [
  { id: "appointments", label: "Reservas" },
  { id: "inquiries", label: "Consultas" },
  { id: "sales", label: "Ventas" },
  { id: "reminders", label: "Recordatorios" },
  { id: "cancellations", label: "Cancelaciones" },
  { id: "rescheduling", label: "Reprogramaciones" },
] as const;

export type EmployeeCapabilityKey = (typeof EMPLOYEE_CAPABILITIES)[number]["id"];

export interface EmployeeGoal {
  id: string;
  text: string;
  active: boolean;
}

export interface EmployeeRestriction {
  id: string;
  text: string;
  active: boolean;
}

export interface EmployeeCapability {
  key: EmployeeCapabilityKey;
  enabled: boolean;
}

export interface EmployeeProfile {
  id: string;
  businessId: string;
  name: string;
  role: string;
  description: string;
  formality: EmployeeFormality;
  warmth: EmployeeWarmth;
  emojiUsage: EmployeeEmojiUsage;
  responseLength: EmployeeResponseLength;
  commercialLevel: EmployeeCommercialLevel;
  goals: EmployeeGoal[];
  restrictions: EmployeeRestriction[];
  capabilities: EmployeeCapability[];
}

// ---- Business Memory ----

export const MEMORY_CATEGORIES = [
  "Políticas",
  "Procedimientos",
  "Información comercial",
  "Promociones",
  "Información interna",
  "Datos importantes",
  "Respuestas frecuentes",
  "Observaciones del dueño",
  "Otro",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_IMPORTANCE_LEVELS = ["low", "medium", "high"] as const;
export type MemoryImportance = (typeof MEMORY_IMPORTANCE_LEVELS)[number];
export const MEMORY_IMPORTANCE_META: Record<MemoryImportance, { label: string }> = {
  low: { label: "Baja" },
  medium: { label: "Media" },
  high: { label: "Alta" },
};

export const MEMORY_SOURCES = [
  "manual",
  "training_conversation",
  "document",
  "learned_from_usage",
  "correction",
] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];
export const MEMORY_SOURCE_META: Record<MemorySource, { label: string }> = {
  manual: { label: "Manual" },
  training_conversation: { label: "Conversación de entrenamiento" },
  document: { label: "Documento" },
  learned_from_usage: { label: "Aprendido en uso" },
  correction: { label: "Corrección" },
};

export interface MemoryEntry {
  id: string;
  businessId: string;
  title: string;
  content: string;
  category: MemoryCategory | "";
  importance: MemoryImportance;
  source: MemorySource;
  active: boolean;
}

// ---- Training Plan ----
// Generado por IA según el rubro del negocio; guía la entrevista de
// entrenamiento y queda disponible para que otras features (Documents,
// AI Insights) lo usen más adelante sin cambiar este modelo.

export const TRAINING_PLAN_SECTION_STATUSES = ["pending", "in_progress", "completed", "ignored"] as const;
export type TrainingPlanSectionStatus = (typeof TRAINING_PLAN_SECTION_STATUSES)[number];

// Subconjunto que la IA puede proponer directamente: "pending" e
// "in_progress" son estados que solo asigna el motor de entrenamiento
// (ver activateNextPendingSection), nunca una propuesta.
export const AI_PROPOSABLE_SECTION_STATUSES = ["completed", "ignored"] as const;

export interface TrainingPlanSection {
  id: string;
  key: string;
  title: string;
  description: string;
  status: TrainingPlanSectionStatus;
  order: number;
}

export interface TrainingPlan {
  id: string;
  businessId: string;
  category: string;
  generatedAt: string;
  updatedAt: string;
  sections: TrainingPlanSection[];
}

export const ONBOARDING_STEPS = [
  { id: 1, slug: "negocio", title: "Tu negocio", description: "Contanos sobre tu negocio" },
  { id: 2, slug: "horarios", title: "Horarios", description: "Definí tus horarios de atención" },
  { id: 3, slug: "servicios", title: "Servicios", description: "Agregá los servicios que ofrecés" },
  { id: 4, slug: "preguntas-frecuentes", title: "Preguntas frecuentes", description: "Respondé las dudas más comunes" },
  { id: 5, slug: "suscripcion", title: "Suscripción", description: "Activá tu plan" },
] as const;
