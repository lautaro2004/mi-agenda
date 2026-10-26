import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    landingCopy: {
      upsert: (...a: unknown[]) => upsert(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/modules/business/service", () => ({
  getBusinessState: vi.fn().mockResolvedValue({
    business: { name: "Altas Rappi", category: "Otro", description: "Ayudamos a locales a sumarse a Rappi." },
    services: [{ name: "Alta en Rappi", description: "Gestionamos el alta completa" }],
    faqs: [{ question: "¿Cuánto tarda?" }],
  }),
}));

const generateResponse = vi.fn();
const getAIProvider = vi.fn();
vi.mock("@/modules/ai/providers", () => ({ getAIProvider: (...a: unknown[]) => getAIProvider(...a) }));

const { buildLandingCopyPrompt, generateLandingCopy, getLandingCopy, parseLandingCopyResponse } = await import(
  "./landing-copy"
);

const VALID = {
  heroTitle: "Sumá tu local a Rappi sin vueltas",
  heroSubtitle: "Nos ocupamos del alta completa de tu restaurante para que empieces a vender por delivery.",
  ctaLabel: "Sumar mi local",
  steps: [
    { title: "Dejás los datos del local", body: "Completás el formulario en un minuto." },
    { title: "Te contactamos", body: "Te pedimos menú, fotos y datos fiscales." },
    { title: "Empezás a vender", body: "Tu local queda publicado en la app." },
  ],
  servicesTitle: "Qué hacemos por tu local",
  servicesIntro: "",
  closingTitle: "¿Sumamos tu local?",
  closingBody: "Dejanos los datos y te contactamos para arrancar.",
  reasons: ["Sin compromiso", "Te guiamos en todo el proceso", "Consultar no tiene costo"],
  formTitle: "Datos de tu local",
  formSubtitle: "Te contactamos por WhatsApp.",
};

beforeEach(() => {
  upsert.mockReset().mockImplementation(async ({ create }) => ({ generatedAt: create.generatedAt }));
  findUnique.mockReset();
  generateResponse.mockReset();
  getAIProvider.mockReset().mockReturnValue({ generateResponse: (...a: unknown[]) => generateResponse(...a) });
});

describe("parseLandingCopyResponse", () => {
  it("acepta JSON válido, con o sin fence", () => {
    expect(parseLandingCopyResponse(JSON.stringify(VALID))).toMatchObject({ heroTitle: VALID.heroTitle });
    expect(parseLandingCopyResponse("```json\n" + JSON.stringify(VALID) + "\n```")).not.toBeNull();
  });

  it("rechaza textos fuera de límite o con cantidad de pasos incorrecta", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseLandingCopyResponse(JSON.stringify({ ...VALID, heroTitle: "x".repeat(200) }))).toBeNull();
    expect(parseLandingCopyResponse(JSON.stringify({ ...VALID, steps: VALID.steps.slice(0, 2) }))).toBeNull();
    expect(parseLandingCopyResponse("no es json")).toBeNull();
  });
});

describe("buildLandingCopyPrompt", () => {
  it("incluye los datos reales del negocio y prohíbe inventar cifras", async () => {
    const { systemInstruction } = await buildLandingCopyPrompt("biz_1");
    expect(systemInstruction).toContain("Altas Rappi");
    expect(systemInstruction).toContain("Alta en Rappi");
    expect(systemInstruction).toContain("NADA de cifras");
  });
});

describe("generateLandingCopy", () => {
  it("guarda los textos generados con fecha de generación", async () => {
    generateResponse.mockResolvedValue(JSON.stringify(VALID));
    const result = await generateLandingCopy("biz_1");
    expect(result.success).toBe(true);
    expect(getAIProvider).toHaveBeenCalledWith("landing_copy");
    expect(upsert.mock.calls[0][0].create).toMatchObject({ businessId: "biz_1", content: VALID });
    expect(upsert.mock.calls[0][0].create.generatedAt).toBeInstanceOf(Date);
  });

  it("si la IA devuelve algo inválido, no toca lo guardado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    generateResponse.mockResolvedValue('{"heroTitle": "hola"}');
    const result = await generateLandingCopy("biz_1");
    expect(result.success).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("sin proveedor de IA configurado, no escribe nada", async () => {
    getAIProvider.mockReturnValue(null);
    expect((await generateLandingCopy("biz_1")).success).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("getLandingCopy", () => {
  it("ignora un contenido guardado que no cumple el formato (el sitio usa los textos fijos)", async () => {
    findUnique.mockResolvedValue({ content: { heroTitle: "roto" }, generatedAt: null });
    expect(await getLandingCopy("biz_1")).toEqual({ copy: null, generatedAt: null });
  });
});
