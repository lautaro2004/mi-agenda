import { MercadoPagoConfig } from "mercadopago";

// ── Cliente server-only de Mercado Pago ─────────────────────────────────
// Único punto que instancia MercadoPagoConfig — modules/billing/mercadopago/
// plans.ts (y, en fases siguientes, subscriptions.ts/webhooks.ts) importan
// SIEMPRE de acá, nunca crean su propia instancia. Mismo criterio de
// singleton perezoso que lib/prisma.ts: diferir la instanciación hasta el
// primer uso real, para que un build sin MERCADOPAGO_ACCESS_TOKEN configurado
// (ej. CI, o este mismo repo en sandbox antes de cargar las credenciales) no
// falle solo por importar este módulo — recién explota cuando algo intenta
// hablar con Mercado Pago de verdad.
//
// El access token NUNCA se exporta ni se expone — este archivo es la única
// puerta de entrada, y ningún componente de cliente puede importarlo (todo
// bajo modules/ es server-only por convención del proyecto, igual que
// modules/business/*, modules/ai/*, etc).

export class MercadoPagoNotConfiguredError extends Error {
  constructor() {
    super(
      "MERCADOPAGO_ACCESS_TOKEN no está configurado. Cargá tus credenciales de sandbox en .env.local antes de usar la integración de Mercado Pago."
    );
    this.name = "MercadoPagoNotConfiguredError";
  }
}

let cachedClient: MercadoPagoConfig | null = null;
let cachedAccessToken: string | null = null;

// Vuelve a instanciar si el access token cambió desde la última vez (ej. un
// test que lo pisa entre casos) — evita quedar atado para siempre al primer
// valor leído si el proceso vive lo suficiente para que cambie.
export function getMercadoPagoClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new MercadoPagoNotConfiguredError();
  }

  if (!cachedClient || cachedAccessToken !== accessToken) {
    cachedClient = new MercadoPagoConfig({ accessToken });
    cachedAccessToken = accessToken;
  }

  return cachedClient;
}

// true/false sin lanzar — para que la UI de Superadmin pueda mostrar "Mercado
// Pago no configurado" en vez de un error crudo cuando todavía no se
// cargaron credenciales (ver app/superadmin/planes/page.tsx).
export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}
