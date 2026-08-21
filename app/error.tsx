"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// Boundary de errores de React Server/Client Components para todo lo que
// cuelga del layout raíz (todas las rutas excepto errores DENTRO del propio
// layout raíz, ver global-error.tsx para eso). Antes de esto no existía
// NINGÚN error.tsx en la app: cualquier excepción no capturada en un
// componente cliente (ej. un estado inesperado del chat de entrenamiento, un
// hook de contexto usado fuera de su Provider) tumbaba toda la pantalla con
// el mensaje genérico de Next.js ("Application error: a client-side
// exception has occurred") sin ninguna forma de recuperarse salvo recargar
// a mano. Esto le da a cada sección de la app su propio límite de falla.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[app/error] Excepción no capturada:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tuvimos un problema mostrando esta pantalla. Tu información ya guardada no se perdió — podés reintentar o
        volver al inicio.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Reintentar
        </Button>
        <Button type="button" variant="outline" render={<Link href="/dashboard" />} nativeButton={false}>
          Ir al panel
        </Button>
      </div>
    </div>
  );
}
