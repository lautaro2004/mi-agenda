import {
  Business,
  BusinessSchedule,
  FAQ,
  OnboardingState,
  Service,
  Subscription,
  WEEK_DAYS,
} from "@/lib/types";

export const emptyBusiness: Business = {
  id: "business-1",
  name: "",
  logoUrl: null,
  heroImageUrl: null,
  brandColor: null,
  category: "",
  description: "",
  phone: "",
  whatsappNumber: "",
  address: "",
  instagramUrl: "",
  facebookUrl: "",
  slug: null,
};

export const defaultSchedule: BusinessSchedule = WEEK_DAYS.map((day) => ({
  day: day.id,
  enabled: day.id !== "sunday",
  openTime: "09:00",
  closeTime: "18:00",
  hasBreak: day.id !== "saturday",
  breakStart: "13:00",
  breakEnd: "14:00",
}));

export const defaultSubscription: Subscription = {
  id: "sub-1",
  businessId: "business-1",
  plan: "unico",
  status: "pending",
  startDate: null,
  renewsAt: null,
};

export const initialOnboardingState: OnboardingState = {
  step: 1,
  business: emptyBusiness,
  schedule: defaultSchedule,
  services: [],
  faqs: [],
  subscription: defaultSubscription,
  completed: false,
};

export const exampleServices: Service[] = [
  {
    id: "service-1",
    businessId: "business-1",
    name: "Corte de cabello",
    description: "Corte clásico o moderno, incluye lavado.",
    category: "Cortes",
    durationMinutes: 30,
    price: 4500,
  },
  {
    id: "service-2",
    businessId: "business-1",
    name: "Coloración",
    description: "Aplicación de color con productos profesionales.",
    category: "Coloración",
    durationMinutes: 90,
    price: 12000,
  },
  {
    id: "service-3",
    businessId: "business-1",
    name: "Arreglo de barba",
    description: "Perfilado y arreglo de barba con navaja.",
    category: "Barba",
    durationMinutes: 20,
    price: 3000,
  },
];

export const exampleFaqs: FAQ[] = [
  {
    id: "faq-1",
    businessId: "business-1",
    question: "¿Dónde están ubicados?",
    answer: "Estamos en Av. Siempre Viva 742, a dos cuadras de la plaza principal.",
  },
  {
    id: "faq-2",
    businessId: "business-1",
    question: "¿Qué medios de pago aceptan?",
    answer: "Aceptamos efectivo, tarjetas de débito/crédito y transferencias.",
  },
];

export const previewConversations = [
  {
    id: "conv-1",
    name: "Martina Gómez",
    message: "Hola! ¿Tienen turno para corte mañana a la tarde?",
    time: "10:24",
  },
  {
    id: "conv-2",
    name: "Lucas Fernández",
    message: "Perfecto, nos vemos el jueves a las 17hs 👍",
    time: "09:58",
  },
  {
    id: "conv-3",
    name: "Sofía Ramírez",
    message: "¿Cuánto sale la coloración completa?",
    time: "ayer",
  },
];

export const previewAppointments = [
  {
    id: "appt-1",
    client: "Martina Gómez",
    service: "Corte de cabello",
    time: "Hoy · 16:30",
  },
  {
    id: "appt-2",
    client: "Diego Torres",
    service: "Arreglo de barba",
    time: "Hoy · 17:15",
  },
  {
    id: "appt-3",
    client: "Sofía Ramírez",
    service: "Coloración",
    time: "Mañana · 11:00",
  },
];

export const previewAiActivity = [
  {
    id: "ai-1",
    title: "Respondió consulta sobre horarios",
    detail: "3 clientes recibieron respuesta automática fuera de horario.",
  },
  {
    id: "ai-2",
    title: "Sugirió turno disponible",
    detail: "Ofreció horarios alternativos a 1 cliente con agenda completa.",
  },
];

export const PLAN_DETAILS = {
  unico: {
    name: "Plan Único",
    price: 9990,
    currency: "ARS",
    period: "mes",
    features: [
      "Asistente de IA entrenado para tu negocio",
      "Atención automatizada por WhatsApp",
      "Servicios y precios ilimitados",
      "Preguntas frecuentes personalizadas",
      "Gestión de turnos y reprogramaciones",
      "Horarios de atención",
      "Recursos (canchas, salas, profesionales)",
      "Entrenamiento conversacional del asistente",
      "Simulador para probar antes de publicar",
    ],
  },
} as const;
