"use client";

import * as React from "react";

import { trackEvent } from "@/lib/analytics";

// La página (app/negocio-online/page.tsx) es un Server Component — este es
// el único pedazo cliente necesario solo para disparar el evento al montar.
export function PageViewTracker() {
  React.useEffect(() => {
    trackEvent("page_view", { page: "negocio-online" });
  }, []);

  return null;
}
