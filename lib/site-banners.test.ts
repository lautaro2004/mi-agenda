import { describe, expect, it } from "vitest";

import {
  bannerInputSchema,
  buildTelHref,
  canonicalCtaValue,
  isOwnBannerAssetPath,
  normalizeExternalUrl,
  resolveBannerCta,
  type CtaContext,
} from "./site-banners";

const baseInput = {
  name: "Promo",
  variant: "text" as const,
  desktopImageUrl: "https://x.supabase.co/storage/v1/object/public/site-assets/biz/banner/a.jpg",
  imageAlt: "Promo de invierno",
};

describe("normalizeExternalUrl", () => {
  it("acepta http/https y agrega https si falta el esquema", () => {
    expect(normalizeExternalUrl("https://ejemplo.com/promo")).toBe("https://ejemplo.com/promo");
    expect(normalizeExternalUrl("ejemplo.com")).toBe("https://ejemplo.com/");
    expect(normalizeExternalUrl("http://ejemplo.com")).toBe("http://ejemplo.com/");
  });

  it("rechaza esquemas peligrosos, credenciales y basura", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hola", "mailto:a@b.com", "ftp://x.com", "https://user:pass@x.com", "", "   ", "localhost", "https://a b.com"]) {
      expect(normalizeExternalUrl(bad)).toBeNull();
    }
  });
});

describe("buildTelHref", () => {
  it("arma tel: con el número del negocio", () => {
    expect(buildTelHref("+54 9 11 5555-5555")).toBe("tel:+5491155555555");
    expect(buildTelHref("011 4444-3333")).toBe("tel:01144443333");
  });
  it("devuelve null sin número válido", () => {
    expect(buildTelHref(null)).toBeNull();
    expect(buildTelHref("abc")).toBeNull();
  });
});

describe("isOwnBannerAssetPath", () => {
  it("solo acepta archivos de banner del propio negocio", () => {
    expect(isOwnBannerAssetPath("biz1/banner/a.jpg", "biz1")).toBe(true);
    expect(isOwnBannerAssetPath("biz2/banner/a.jpg", "biz1")).toBe(false);
    expect(isOwnBannerAssetPath("biz1/gallery/a.jpg", "biz1")).toBe(false);
    expect(isOwnBannerAssetPath("biz1/banner/../../biz2/banner/a.jpg", "biz1")).toBe(false);
    expect(isOwnBannerAssetPath("biz1/banner/", "biz1")).toBe(false);
    expect(isOwnBannerAssetPath(null, "biz1")).toBe(false);
  });
});

describe("bannerInputSchema", () => {
  it("acepta un banner sin botón", () => {
    const r = bannerInputSchema.safeParse(baseInput);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cta).toBeNull();
      expect(r.data.mobileImageUrl).toBeNull();
      expect(r.data.active).toBe(true);
    }
  });

  it("exige nombre, imagen de escritorio y texto alternativo", () => {
    expect(bannerInputSchema.safeParse({ ...baseInput, name: " " }).success).toBe(false);
    expect(bannerInputSchema.safeParse({ ...baseInput, desktopImageUrl: "" }).success).toBe(false);
    expect(bannerInputSchema.safeParse({ ...baseInput, imageAlt: "" }).success).toBe(false);
  });

  it("valida cada tipo de destino", () => {
    const cta = (c: object) => bannerInputSchema.safeParse({ ...baseInput, cta: c }).success;
    expect(cta({ type: "contact_form", label: "Contactar" })).toBe(true);
    expect(cta({ type: "section", label: "Ver", value: "faq" })).toBe(true);
    expect(cta({ type: "section", label: "Ver", value: "inexistente" })).toBe(false);
    expect(cta({ type: "section", label: "Ver" })).toBe(false);
    expect(cta({ type: "whatsapp", label: "Escribinos", value: "Hola!" })).toBe(true);
    expect(cta({ type: "whatsapp", label: "Escribinos", value: "x".repeat(201) })).toBe(false);
    expect(cta({ type: "url", label: "Ver", value: "https://ejemplo.com" })).toBe(true);
    expect(cta({ type: "url", label: "Ver", value: "javascript:alert(1)" })).toBe(false);
    expect(cta({ type: "url", label: "Ver", value: "" })).toBe(false);
    expect(cta({ type: "phone", label: "Llamar" })).toBe(true);
    expect(cta({ type: "phone", label: "" })).toBe(false);
    expect(cta({ type: "otro", label: "x" })).toBe(false);
  });

  it("canonicalCtaValue solo guarda el valor que corresponde al tipo", () => {
    expect(canonicalCtaValue({ type: "phone", label: "x", value: "123" })).toBeNull();
    expect(canonicalCtaValue({ type: "contact_form", label: "x", value: "basura" })).toBeNull();
    expect(canonicalCtaValue({ type: "url", label: "x", value: "ejemplo.com" })).toBe("https://ejemplo.com/");
    expect(canonicalCtaValue({ type: "whatsapp", label: "x", value: "" })).toBeNull();
  });
});

describe("resolveBannerCta", () => {
  const ctx: CtaContext = {
    template: "leads",
    whatsappNumber: "+54 9 11 5555-5555",
    phone: "011 4444-3333",
    visibleKinds: new Set(["hero", "faq", "form"]),
  };

  it("formulario de contacto: ancla de la sección de contacto de la plantilla", () => {
    expect(resolveBannerCta({ type: "contact_form", label: "Contactar", value: null }, ctx)).toEqual({ href: "#sec-form", label: "Contactar", newTab: false });
    expect(resolveBannerCta({ type: "contact_form", label: "Contactar", value: null }, { ...ctx, template: "booking", visibleKinds: new Set(["inquiry"]) })?.href).toBe("#sec-inquiry");
  });

  it("sección: solo si está visible en la página", () => {
    expect(resolveBannerCta({ type: "section", label: "Ver", value: "faq" }, ctx)?.href).toBe("#sec-faq");
    expect(resolveBannerCta({ type: "section", label: "Ver", value: "gallery" }, ctx)).toBeNull();
  });

  it("WhatsApp: reutiliza el número del negocio, con mensaje predefinido, en otra pestaña", () => {
    const r = resolveBannerCta({ type: "whatsapp", label: "Escribinos", value: "Quiero la promo" }, ctx);
    expect(r).toEqual({ href: "https://wa.me/5491155555555?text=Quiero%20la%20promo", label: "Escribinos", newTab: true });
    expect(resolveBannerCta({ type: "whatsapp", label: "x", value: null }, ctx)?.href).toContain("?text=");
    expect(resolveBannerCta({ type: "whatsapp", label: "x", value: null }, { ...ctx, whatsappNumber: null })).toBeNull();
  });

  it("URL externa: otra pestaña; inválida no genera botón", () => {
    expect(resolveBannerCta({ type: "url", label: "Ver", value: "https://ejemplo.com" }, ctx)).toEqual({ href: "https://ejemplo.com/", label: "Ver", newTab: true });
    expect(resolveBannerCta({ type: "url", label: "Ver", value: "javascript:alert(1)" }, ctx)).toBeNull();
  });

  it("llamada: usa el teléfono del negocio", () => {
    expect(resolveBannerCta({ type: "phone", label: "Llamar", value: null }, ctx)?.href).toBe("tel:01144443333");
    expect(resolveBannerCta({ type: "phone", label: "Llamar", value: null }, { ...ctx, phone: null })).toBeNull();
  });

  it("sin botón configurado no hay CTA", () => {
    expect(resolveBannerCta(null, ctx)).toBeNull();
  });
});
