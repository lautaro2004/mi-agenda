import { describe, expect, it } from "vitest";

import { classify } from "./classifier";

const opts = { hasBookableServices: true };

describe("clasificador: qué mensajes se ignoran", () => {
  it("un saludo se responde (no queda sin contestación)", () => {
    for (const msg of ["Hola", "hola", "Hola!", "Buenas", "Buen día", "Buenas tardes", "Hola, qué tal?", "holaaa"]) {
      expect(classify(msg, "IDLE", [], opts).ignored).toBe(false);
    }
  });

  it("agradecimientos, confirmaciones sueltas y emojis sin contexto siguen ignorándose", () => {
    for (const msg of ["gracias", "ok", "dale", "👍", "[Mensaje no soportado]"]) {
      expect(classify(msg, "IDLE", [], opts).ignored).toBe(true);
    }
  });
});
