import { describe, expect, it } from "vitest";

import { parseAssistantAction, stripActionMarkers } from "./actions";

describe("parseAssistantAction", () => {
  it("detecta el registro de interesado con su JSON", () => {
    const a = parseAssistantAction('[[REGISTRAR_INTERESADO]] {"nombre": "Ana", "necesidad": "Coloración", "resumen": "Quiere color {rubio}"}');
    expect(a).toEqual({
      name: "register_lead",
      data: { nombre: "Ana", necesidad: "Coloración", resumen: "Quiere color {rubio}", email: undefined, motivo: undefined },
    });
  });

  it("detecta la derivación aunque venga con texto alrededor", () => {
    const a = parseAssistantAction('Perfecto.\n[[DERIVAR]] {"resumen": "Reclamo por un turno"}');
    expect(a?.name).toBe("handoff");
    expect(a?.data.resumen).toBe("Reclamo por un turno");
  });

  it("tolera JSON inválido (acción sin datos) y texto sin marcador", () => {
    expect(parseAssistantAction("[[DERIVAR]] {roto")?.data).toEqual({});
    expect(parseAssistantAction("Hola, ¿qué servicio buscás?")).toBeNull();
  });
});

describe("stripActionMarkers", () => {
  it("nunca deja marcadores ni JSON a la vista del cliente", () => {
    expect(stripActionMarkers('Listo.\n[[REGISTRAR_INTERESADO]] {"nombre": "Ana"}')).toBe("Listo.");
  });
});
