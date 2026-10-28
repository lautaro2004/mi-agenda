import { describe, expect, it } from "vitest";

import { buildSocialLinks, normalizeSocialUrl } from "./social";

describe("normalizeSocialUrl", () => {
  it("acepta URLs completas y las deja en https", () => {
    expect(normalizeSocialUrl("instagram", "https://www.instagram.com/lmrappi/")).toBe("https://www.instagram.com/lmrappi/");
    expect(normalizeSocialUrl("facebook", "http://facebook.com/mi.pagina")).toBe("https://facebook.com/mi.pagina");
    expect(normalizeSocialUrl("youtube", "youtu.be/abc123")).toBe("https://youtu.be/abc123");
    expect(normalizeSocialUrl("linkedin", "linkedin.com/company/kodexa")).toBe("https://linkedin.com/company/kodexa");
    expect(normalizeSocialUrl("tiktok", "https://www.tiktok.com/@lmrappi")).toBe("https://www.tiktok.com/@lmrappi");
  });

  it("arma la URL a partir de un @usuario en Instagram y TikTok", () => {
    expect(normalizeSocialUrl("instagram", "@lm.rappi")).toBe("https://www.instagram.com/lm.rappi");
    expect(normalizeSocialUrl("tiktok", "lmrappi")).toBe("https://www.tiktok.com/@lmrappi");
    expect(normalizeSocialUrl("facebook", "@algo")).toBeNull();
  });

  it("rechaza dominios de otra red (nunca el ícono equivocado)", () => {
    expect(normalizeSocialUrl("instagram", "https://facebook.com/x")).toBeNull();
    expect(normalizeSocialUrl("facebook", "https://instagram.com/x")).toBeNull();
    expect(normalizeSocialUrl("instagram", "https://instagram.com.evil.com/x")).toBeNull();
    expect(normalizeSocialUrl("instagram", "https://evilinstagram.com/x")).toBeNull();
  });

  it("rechaza esquemas peligrosos, credenciales, espacios y vacío", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://instagram.com/x", "https://u:p@instagram.com/x", "https://instagram.com/a b", "", "   "]) {
      expect(normalizeSocialUrl("instagram", bad)).toBeNull();
    }
    expect(normalizeSocialUrl("instagram", null)).toBeNull();
  });

  it("acepta subdominios legítimos (m., es-la.)", () => {
    expect(normalizeSocialUrl("facebook", "https://m.facebook.com/pagina")).toBe("https://m.facebook.com/pagina");
  });
});

describe("buildSocialLinks", () => {
  it("devuelve solo las redes configuradas y válidas, en orden fijo", () => {
    const links = buildSocialLinks({
      instagramUrl: "https://instagram.com/lmrappi",
      facebookUrl: "",
      tiktokUrl: "@lmrappi",
      youtubeUrl: "https://instagram.com/mal-puesto",
      linkedinUrl: null,
    });
    expect(links.map((l) => l.platform)).toEqual(["instagram", "tiktok"]);
    expect(links[0]).toMatchObject({ label: "Instagram", href: "https://instagram.com/lmrappi" });
  });

  it("sin redes no devuelve nada", () => {
    expect(buildSocialLinks({})).toEqual([]);
  });
});
