"use client";

import * as React from "react";

// Único boundary que atrapa una excepción en el layout raíz mismo (ver
// app/error.tsx para todo lo demás) — Next.js exige que reemplace <html> y
// <body> por completo porque en este caso el layout que normalmente los
// provee es justamente lo que falló. Sin este archivo, un error acá
// (ej. un Provider de la raíz tirando una excepción durante el render)
// no tenía ningún fallback y quedaba la pantalla en blanco de Next.js.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[app/global-error] Excepción en el layout raíz:", error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Algo salió mal</h1>
          <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#666" }}>
            Tuvimos un problema cargando Mi Agenda. Probá recargar la página.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              backgroundColor: "#111",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
