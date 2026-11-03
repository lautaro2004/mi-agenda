"use client";

import * as React from "react";

import { requestJson } from "@/lib/api-client";

let cached: string | undefined;

// Zona horaria del negocio para el panel (cacheada por sesión de navegador).
// Hasta que carga devuelve undefined → los helpers usan la de Argentina.
export function useBusinessTimeZone(): string | undefined {
  const [tz, setTz] = React.useState<string | undefined>(cached);
  React.useEffect(() => {
    if (cached) return;
    requestJson<{ timeZone: string }>("/api/business/time-zone")
      .then(({ timeZone }) => {
        cached = timeZone;
        setTz(timeZone);
      })
      .catch(() => undefined);
  }, []);
  return tz;
}
