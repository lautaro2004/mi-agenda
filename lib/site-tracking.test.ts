import { describe, expect, it } from "vitest";
import { buildUtmUrl, referrerHost, touchFromSearch, trackingConfigSchema, trackEventSchema } from "@/lib/site-tracking";

describe("site-tracking", () => {
  it("lee utm y host del referrer, sin URL completa", () => {
    const t = touchFromSearch("?utm_source=Instagram&utm_campaign=Promo_Nov&x=1", "https://l.instagram.com/?u=abc", "kodexa.ar", "/s/lm");
    expect(t.utm_source).toBe("instagram");
    expect(t.utm_campaign).toBe("promo_nov");
    expect(t.referrerHost).toBe("l.instagram.com");
    expect(t.landingPath).toBe("/s/lm");
  });
  it("descarta utm con caracteres raros", () => {
    const t = touchFromSearch("?utm_source=<script>", "", "x.com", "/");
    expect(t.utm_source).toBeUndefined();
  });
  it("no cuenta el propio sitio como referrer", () => {
    expect(referrerHost("https://www.kodexa.ar/s/a", "kodexa.ar")).toBeNull();
  });
  it("valida IDs por formato y no acepta scripts", () => {
    expect(trackingConfigSchema.safeParse({ gtmId: "gtm-abc1234" }).data?.gtmId).toBe("GTM-ABC1234");
    expect(trackingConfigSchema.safeParse({ gtmId: "<script>alert(1)</script>" }).success).toBe(false);
    expect(trackingConfigSchema.safeParse({ metaPixelId: "123456789012345" }).success).toBe(true);
    expect(trackingConfigSchema.safeParse({ metaPixelId: "abc" }).success).toBe(false);
    expect(trackingConfigSchema.safeParse({ ga4Id: "G-ABCDE12345" }).success).toBe(true);
    expect(trackingConfigSchema.safeParse({ gtmId: "" }).data?.gtmId).toBeNull();
  });
  it("evento: tipo permitido", () => {
    expect(trackEventSchema.safeParse({ type: "page_view", path: "/s/a" }).success).toBe(true);
    expect(trackEventSchema.safeParse({ type: "hack", path: "/s/a" }).success).toBe(false);
  });
  it("arma links con utm", () => {
    const r = buildUtmUrl("https://kodexa.ar/s/lm", { utm_source: "Instagram", utm_medium: "social", utm_campaign: "Promo Nov" });
    expect(r.url).toBe("https://kodexa.ar/s/lm?utm_source=instagram&utm_medium=social&utm_campaign=promo_nov");
    expect(buildUtmUrl("no es url", { utm_source: "x" }).error).toBeTruthy();
    expect(buildUtmUrl("https://a.com", {}).error).toBeTruthy();
  });
});

import { extractTrackingIds } from "@/lib/site-tracking";

describe("extractTrackingIds", () => {
  it("saca el id del píxel de Meta del código completo", () => {
    const code = `<script>!function(f,b,e,v,n,t,s){...}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '1234567890123456');fbq('track', 'PageView');</script><noscript><img src="https://www.facebook.com/tr?id=1234567890123456&ev=PageView&noscript=1"/></noscript>`;
    expect(extractTrackingIds(code).metaPixelId).toBe("1234567890123456");
  });
  it("saca el id de GTM", () => {
    expect(extractTrackingIds("(window,document,'script','dataLayer','GTM-ABC123X');").gtmId).toBe("GTM-ABC123X");
  });
  it("saca GA4", () => {
    expect(extractTrackingIds("gtag('config', 'G-ABCDE12345');").ga4Id).toBe("G-ABCDE12345");
  });
  it("no inventa ids", () => {
    expect(extractTrackingIds("hola mundo")).toEqual({ gtmId: null, metaPixelId: null, ga4Id: null });
  });
});
