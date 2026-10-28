import { describe, expect, it } from "vitest";

import {
  canonicalizeNav,
  defaultNavConfig,
  findNavIssues,
  navConfigSchema,
  navLabelsPointingTo,
  resolveNavTarget,
  resolveRenderNav,
  type NavConfig,
  type NavContext,
} from "./site-nav";

const ctx = (over: Partial<NavContext> = {}): NavContext => ({
  slug: "lm-rappi",
  template: "leads",
  visibleKinds: new Set(["hero", "services", "steps", "form"]),
  hasMenu: false,
  hasBookable: false,
  whatsappNumber: "+54 9 11 5555-1234",
  phone: "+54 11 4444 5555",
  ...over,
});

const config = (over: Partial<NavConfig> = {}): NavConfig => ({
  links: [],
  cta: null,
  socialsInFooter: true,
  socialsInNav: false,
  ...over,
});

describe("resolveNavTarget", () => {
  it("secciones visibles usan el ancla estable; ocultas no se pueden cumplir", () => {
    expect(resolveNavTarget({ type: "section", kind: "services" }, ctx())).toEqual({ ok: true, href: "/s/lm-rappi#sec-services", newTab: false });
    expect(resolveNavTarget({ type: "section", kind: "faq" }, ctx())).toEqual({ ok: false, problem: "section_hidden" });
  });

  it("el formulario de contacto apunta a la sección de contacto de la plantilla", () => {
    const r = resolveNavTarget({ type: "contact_form" }, ctx());
    expect(r).toMatchObject({ ok: true });
    expect(resolveNavTarget({ type: "contact_form" }, ctx({ visibleKinds: new Set(["hero"]) }))).toEqual({ ok: false, problem: "no_contact_section" });
  });

  it("WhatsApp y teléfono usan los datos del negocio (sin duplicar números) y fallan sin ellos", () => {
    const wa = resolveNavTarget({ type: "whatsapp", message: "Hola, quiero info" }, ctx());
    expect(wa).toMatchObject({ ok: true, newTab: true });
    expect((wa as { href: string }).href).toContain("https://wa.me/5491155551234?text=");
    expect(resolveNavTarget({ type: "whatsapp" }, ctx({ whatsappNumber: "" }))).toEqual({ ok: false, problem: "no_whatsapp" });
    expect((resolveNavTarget({ type: "phone" }, ctx()) as { href: string }).href.startsWith("tel:")).toBe(true);
    expect(resolveNavTarget({ type: "phone" }, ctx({ phone: null }))).toEqual({ ok: false, problem: "no_phone" });
  });

  it("URLs externas: solo http(s); esquemas peligrosos se rechazan", () => {
    expect(resolveNavTarget({ type: "url", url: "https://ejemplo.com/x" }, ctx())).toMatchObject({ ok: true, newTab: true });
    for (const url of ["javascript:alert(1)", "data:text/html,x", "ftp://x.com", ""]) {
      expect(resolveNavTarget({ type: "url", url }, ctx())).toEqual({ ok: false, problem: "invalid_url" });
    }
  });

  it("páginas internas solo si existen (carta activa / servicios reservables)", () => {
    expect(resolveNavTarget({ type: "page", page: "carta" }, ctx())).toEqual({ ok: false, problem: "page_unavailable" });
    expect(resolveNavTarget({ type: "page", page: "carta" }, ctx({ hasMenu: true }))).toMatchObject({ ok: true, href: "/s/lm-rappi/carta" });
    expect(resolveNavTarget({ type: "booking" }, ctx())).toEqual({ ok: false, problem: "no_booking" });
    expect(resolveNavTarget({ type: "booking" }, ctx({ hasBookable: true }))).toMatchObject({ ok: true, booking: true });
  });
});

describe("defaultNavConfig / resolveRenderNav (compatibilidad)", () => {
  it("un negocio sin agenda NO muestra Horarios ni botón de reservar", () => {
    const c = ctx({ template: "institutional", visibleKinds: new Set(["hero", "services", "schedule", "faq", "booking"]), hasBookable: false });
    const nav = resolveRenderNav(null, c, "contact");
    expect(nav.links.map((l) => l.label)).toEqual(["Servicios", "Preguntas frecuentes"]);
    expect(nav.cta).toBeNull();
    expect(nav.showWhatsappButton).toBe(true);
  });

  it("con agenda y horarios visibles conserva el menú de siempre y el CTA de reservar", () => {
    const c = ctx({ template: "institutional", visibleKinds: new Set(["hero", "services", "schedule", "faq"]), hasMenu: true, hasBookable: true });
    const nav = resolveRenderNav(null, c, "booking");
    expect(nav.links.map((l) => l.label)).toEqual(["Servicios", "Carta", "Horarios", "Preguntas frecuentes"]);
    expect(nav.cta).toMatchObject({ label: "Reservar", booking: true });
  });

  it("intent meeting usa 'Agendar reunión'", () => {
    const c = ctx({ hasBookable: true });
    expect(defaultNavConfig(c, "meeting").cta?.label).toBe("Agendar reunión");
  });

  it("con navegación guardada no se agrega el botón de WhatsApp heredado", () => {
    expect(resolveRenderNav(config(), ctx(), "contact").showWhatsappButton).toBe(false);
  });
});

describe("resolveRenderNav con navegación guardada", () => {
  it("respeta orden, omite inactivos y enlaces que no se pueden cumplir", () => {
    const stored = config({
      links: [
        { id: "a", label: "Servicios", active: true, target: { type: "section", kind: "services" } },
        { id: "b", label: "Oculto", active: false, target: { type: "section", kind: "steps" } },
        { id: "c", label: "Roto", active: true, target: { type: "section", kind: "faq" } },
        { id: "d", label: "Escribinos", active: true, target: { type: "whatsapp" } },
      ],
      cta: { label: "Ir al formulario", active: true, target: { type: "contact_form" } },
    });
    const nav = resolveRenderNav(stored, ctx(), "contact");
    expect(nav.links.map((l) => l.label)).toEqual(["Servicios", "Escribinos"]);
    expect(nav.cta).toMatchObject({ label: "Ir al formulario", booking: false });
  });

  it("reordenar secciones no rompe los enlaces: el ancla depende del tipo, no de la posición", () => {
    const stored = config({ links: [{ id: "a", label: "Pasos", active: true, target: { type: "section", kind: "steps" } }] });
    const a = resolveRenderNav(stored, ctx({ visibleKinds: new Set(["hero", "steps", "services"]) }), "contact");
    const b = resolveRenderNav(stored, ctx({ visibleKinds: new Set(["hero", "services", "steps"]) }), "contact");
    expect(a.links[0].href).toBe(b.links[0].href);
  });
});

describe("findNavIssues / navLabelsPointingTo", () => {
  const stored = config({
    links: [
      { id: "a", label: "FAQ", active: true, target: { type: "section", kind: "faq" } },
      { id: "b", label: "Ok", active: true, target: { type: "section", kind: "services" } },
      { id: "c", label: "Inactivo", active: false, target: { type: "section", kind: "faq" } },
    ],
    cta: { label: "Llamar", active: true, target: { type: "phone" } },
  });

  it("detecta enlaces rotos (solo activos) para poder corregirlos", () => {
    expect(findNavIssues(stored, ctx())).toEqual([{ where: "link", id: "a", label: "FAQ", problem: "section_hidden" }]);
    expect(findNavIssues(stored, ctx({ phone: "" })).some((i) => i.where === "cta" && i.problem === "no_phone")).toBe(true);
  });

  it("al ocultar una sección avisa qué enlaces la usan", () => {
    expect(navLabelsPointingTo(stored, new Set(["faq"]))).toEqual(["FAQ"]);
    expect(navLabelsPointingTo(null, new Set(["faq"]))).toEqual([]);
  });
});

describe("navConfigSchema", () => {
  it("acepta una configuración válida y canonicaliza la URL", () => {
    const parsed = navConfigSchema.safeParse(
      config({ links: [{ id: "a", label: " Web ", active: true, target: { type: "url", url: "ejemplo.com" } }] })
    );
    expect(parsed.success).toBe(true);
    const canon = canonicalizeNav(parsed.data as NavConfig);
    expect(canon.links[0].label).toBe("Web");
    expect(canon.links[0].target).toEqual({ type: "url", url: "https://ejemplo.com/" });
  });

  it("rechaza esquemas peligrosos, secciones inexistentes, ids repetidos y exceso de enlaces", () => {
    const bad = (links: NavConfig["links"]) => navConfigSchema.safeParse(config({ links })).success;
    expect(bad([{ id: "a", label: "x", active: true, target: { type: "url", url: "javascript:alert(1)" } }])).toBe(false);
    expect(bad([{ id: "a", label: "x", active: true, target: { type: "section", kind: "../../etc" } }])).toBe(false);
    expect(
      bad([
        { id: "a", label: "x", active: true, target: { type: "phone" } },
        { id: "a", label: "y", active: true, target: { type: "phone" } },
      ])
    ).toBe(false);
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, label: "x", active: true, target: { type: "phone" as const } }));
    expect(bad(many)).toBe(false);
    expect(bad([{ id: "a", label: "", active: true, target: { type: "phone" } }])).toBe(false);
  });

  it("un CTA acepta formulario y reserva, pero un enlace común no", () => {
    expect(navConfigSchema.safeParse(config({ cta: { label: "Ir", active: true, target: { type: "contact_form" } } })).success).toBe(true);
    const asLink = { links: [{ id: "a", label: "x", active: true, target: { type: "booking" } }], cta: null, socialsInFooter: true, socialsInNav: false };
    expect(navConfigSchema.safeParse(asLink).success).toBe(false);
  });
});
