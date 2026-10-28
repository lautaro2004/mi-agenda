import { describe, expect, it } from "vitest";

import {
  BANNER_KIND,
  defaultSectionItems,
  insertBannerItem,
  moveItem,
  normalizeSectionItems,
  removeBannerItem,
  setItemVisible,
  validateLayoutItems,
  type SectionItem,
} from "./site-sections";

const NO_BANNERS = new Set<string>();
const kinds = (items: SectionItem[]) => items.map((i) => i.kind);

describe("normalizeSectionItems", () => {
  it("sin nada guardado devuelve el orden de fábrica de la plantilla", () => {
    expect(normalizeSectionItems("leads", undefined, NO_BANNERS)).toEqual(defaultSectionItems("leads"));
    expect(kinds(normalizeSectionItems("leads", null, NO_BANNERS))).toEqual(["hero", "steps", "services", "gallery", "faq", "form"]);
  });

  it("respeta el orden y la visibilidad guardados", () => {
    const stored = [
      { id: "hero", kind: "hero", visible: true },
      { id: "faq", kind: "faq", visible: false },
      { id: "services", kind: "services", visible: true },
    ];
    const result = normalizeSectionItems("booking", stored, NO_BANNERS);
    expect(kinds(result).slice(0, 3)).toEqual(["hero", "faq", "services"]);
    expect(result.find((i) => i.kind === "faq")?.visible).toBe(false);
  });

  it("agrega las secciones que faltan sin perder las guardadas (compatibilidad)", () => {
    const stored = [
      { id: "hero", kind: "hero", visible: true },
      { id: "faq", kind: "faq", visible: true },
    ];
    const result = normalizeSectionItems("leads", stored, NO_BANNERS);
    expect(new Set(kinds(result))).toEqual(new Set(["hero", "steps", "services", "gallery", "faq", "form"]));
    expect(result[0].kind).toBe("hero");
  });

  it("descarta tipos que la plantilla no conoce, repetidos y basura", () => {
    const stored = [
      { id: "hero", kind: "hero", visible: true },
      { id: "hero", kind: "hero", visible: false },
      { id: "x", kind: "script", visible: true },
      "no soy un objeto",
      { id: "faq", kind: "faq" },
    ];
    const result = normalizeSectionItems("leads", stored, NO_BANNERS);
    expect(kinds(result).filter((k) => k === "hero")).toHaveLength(1);
    expect(kinds(result)).not.toContain("script");
  });

  it("descarta banners que ya no existen y conserva los vigentes", () => {
    const stored = [
      { id: "hero", kind: "hero", visible: true },
      { id: "banner-a", kind: BANNER_KIND, bannerId: "a", visible: true },
      { id: "banner-b", kind: BANNER_KIND, bannerId: "gone", visible: true },
    ];
    const result = normalizeSectionItems("leads", stored, new Set(["a"]));
    expect(result.filter((i) => i.kind === BANNER_KIND).map((i) => i.bannerId)).toEqual(["a"]);
  });

  it("un mismo banner puede aparecer en varias posiciones por referencia", () => {
    const stored = [
      { id: "hero", kind: "hero", visible: true },
      { id: "banner-1", kind: BANNER_KIND, bannerId: "a", visible: true },
      { id: "faq", kind: "faq", visible: true },
      { id: "banner-2", kind: BANNER_KIND, bannerId: "a", visible: true },
    ];
    const result = normalizeSectionItems("leads", stored, new Set(["a"]));
    expect(result.filter((i) => i.bannerId === "a")).toHaveLength(2);
  });

  it("las obligatorias nunca quedan ocultas y la portada va primera", () => {
    const stored = [
      { id: "faq", kind: "faq", visible: true },
      { id: "form", kind: "form", visible: false },
      { id: "hero", kind: "hero", visible: false },
    ];
    const result = normalizeSectionItems("leads", stored, NO_BANNERS);
    expect(result[0].kind).toBe("hero");
    expect(result.find((i) => i.kind === "hero")?.visible).toBe(true);
    expect(result.find((i) => i.kind === "form")?.visible).toBe(true);
  });
});

describe("validateLayoutItems", () => {
  const base = defaultSectionItems("leads");

  it("acepta la lista de fábrica", () => {
    expect(validateLayoutItems("leads", base, NO_BANNERS)).toEqual({ ok: true, items: base });
  });

  it("acepta ocultar una opcional conservando todas las secciones", () => {
    const items = base.map((i) => (i.kind === "faq" ? { ...i, visible: false } : i));
    const result = validateLayoutItems("leads", items, NO_BANNERS);
    expect(result.ok).toBe(true);
  });

  it("rechaza ocultar una obligatoria", () => {
    const items = base.map((i) => (i.kind === "form" ? { ...i, visible: false } : i));
    expect(validateLayoutItems("leads", items, NO_BANNERS)).toMatchObject({ ok: false });
  });

  it("rechaza que falte una sección (no se pueden perder secciones al guardar)", () => {
    const items = base.filter((i) => i.kind !== "steps");
    expect(validateLayoutItems("leads", items, NO_BANNERS)).toMatchObject({ ok: false });
  });

  it("rechaza secciones de otra plantilla, repetidas y la portada fuera del primer lugar", () => {
    expect(validateLayoutItems("leads", [...base, { id: "about", kind: "about", visible: true }], NO_BANNERS)).toMatchObject({ ok: false });
    expect(validateLayoutItems("leads", [...base, { id: "faq", kind: "faq", visible: true }], NO_BANNERS)).toMatchObject({ ok: false });
    const swapped = [base[1], base[0], ...base.slice(2)];
    expect(validateLayoutItems("leads", swapped, NO_BANNERS)).toMatchObject({ ok: false });
  });

  it("rechaza banners que no pertenecen al negocio", () => {
    const items = insertBannerItem(base, "ajeno", 0);
    expect(validateLayoutItems("leads", items, new Set(["propio"]))).toMatchObject({ ok: false });
    const ok = insertBannerItem(base, "propio", 0);
    expect(validateLayoutItems("leads", ok, new Set(["propio"])).ok).toBe(true);
  });

  it("rechaza ids duplicados", () => {
    const items = [...base, { id: "banner-x", kind: BANNER_KIND, bannerId: "a", visible: true }, { id: "banner-x", kind: BANNER_KIND, bannerId: "a", visible: true }];
    expect(validateLayoutItems("leads", items, new Set(["a"]))).toMatchObject({ ok: false });
  });
});

describe("operaciones del editor", () => {
  const base = defaultSectionItems("institutional");

  it("mueve secciones pero nunca la portada ni por delante de ella", () => {
    const moved = moveItem("institutional", base, 3, 1);
    expect(moved[0].kind).toBe("hero");
    expect(moved[1].kind).toBe(base[3].kind);
    expect(moveItem("institutional", base, 0, 2)).toBe(base);
    expect(moveItem("institutional", base, 2, 0)).toBe(base);
  });

  it("ocultar no borra el ítem y las obligatorias no se ocultan", () => {
    const hidden = setItemVisible("institutional", base, "faq", false);
    expect(hidden).toHaveLength(base.length);
    expect(hidden.find((i) => i.id === "faq")?.visible).toBe(false);
    const shown = setItemVisible("institutional", hidden, "faq", true);
    expect(shown.find((i) => i.id === "faq")?.visible).toBe(true);
    expect(setItemVisible("institutional", base, "booking", false).find((i) => i.id === "booking")?.visible).toBe(true);
  });

  it("agrega y quita banners, y solo se pueden quitar banners", () => {
    const withBanner = insertBannerItem(base, "b1", 1);
    expect(withBanner[2].kind).toBe(BANNER_KIND);
    const id = withBanner[2].id;
    expect(removeBannerItem(withBanner, id)).toHaveLength(base.length);
    expect(removeBannerItem(base, "faq")).toHaveLength(base.length);
  });

  it("un banner nunca se inserta antes de la portada", () => {
    const withBanner = insertBannerItem(base, "b1", -1);
    expect(withBanner[0].kind).toBe("hero");
  });
});
