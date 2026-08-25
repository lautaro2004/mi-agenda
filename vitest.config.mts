import { defineConfig } from "vitest/config";
import path from "node:path";

// Config mínima a propósito: solo el alias "@/" (mismo que tsconfig.json) y
// entorno node — los módulos bajo test acá son lógica de servidor pura
// (modules/promo-codes), no componentes React, así que no hace falta jsdom
// ni ningún setup adicional.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
