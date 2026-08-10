import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/s/"],
        disallow: ["/dashboard", "/onboarding", "/api", "/login", "/registro"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
