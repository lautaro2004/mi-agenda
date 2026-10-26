import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEAD_FORM,
  buildLeadSubmissionSchema,
  composeLeadMessage,
  leadFormConfigSchema,
  resolveLeadFormConfig,
  submissionEmail,
  type LeadFormConfig,
} from "./lead-form";

const RAPPI: LeadFormConfig = {
  fields: {
    customerEmail: { mode: "hidden", label: "Email" },
    companyName: { mode: "required", label: "Nombre de tu local" },
    location: { mode: "required", label: "Barrio" },
    message: { mode: "optional", label: "¿Algo más?" },
  },
  custom: [
    { id: "q_apps", label: "¿Ya vendés por apps de delivery?", type: "select", options: ["Sí", "No"], required: true },
    { id: "q_rubro", label: "Rubro", type: "text", options: [], required: false },
  ],
};

const BASE = { customerName: "Juan Pérez", customerWhatsapp: "+54 9 11 5555-5555" };

describe("buildLeadSubmissionSchema", () => {
  it("con la config estándar exige email y mensaje (comportamiento de siempre)", () => {
    const schema = buildLeadSubmissionSchema(DEFAULT_LEAD_FORM);
    expect(schema.safeParse({ ...BASE }).success).toBe(false);
    expect(schema.safeParse({ ...BASE, customerEmail: "j@x.com", message: "Hola, info" }).success).toBe(true);
  });

  it("respeta obligatorios, ocultos y preguntas propias", () => {
    const schema = buildLeadSubmissionSchema(RAPPI);
    // Sin email ni mensaje: ok (oculto / opcional).
    const ok = schema.safeParse({ ...BASE, companyName: "Pizzería Don Juan", location: "Caballito", answers: { q_apps: "No" } });
    expect(ok.success).toBe(true);
    // Falta una obligatoria — sin el bloque "answers" (POST armado a mano).
    expect(schema.safeParse({ ...BASE, companyName: "Pizzería", location: "Caballito" }).success).toBe(false);
    // …y con el bloque pero sin esa respuesta.
    expect(
      schema.safeParse({ ...BASE, companyName: "Pizzería", location: "Caballito", answers: { q_rubro: "Pizza" } }).success
    ).toBe(false);
    // Opción que no existe.
    expect(
      schema.safeParse({ ...BASE, companyName: "Pizzería", location: "Caballito", answers: { q_apps: "Tal vez" } }).success
    ).toBe(false);
  });

  it("email opcional acepta vacío pero no uno mal escrito", () => {
    const config = { ...DEFAULT_LEAD_FORM, fields: { ...DEFAULT_LEAD_FORM.fields, customerEmail: { mode: "optional" as const, label: "Email" } } };
    const schema = buildLeadSubmissionSchema(config);
    expect(schema.safeParse({ ...BASE, message: "Hola", customerEmail: "" }).success).toBe(true);
    expect(schema.safeParse({ ...BASE, message: "Hola", customerEmail: "no-es-email" }).success).toBe(false);
  });
});

describe("composeLeadMessage", () => {
  it("arma el encabezado con las etiquetas del negocio y las respuestas", () => {
    const submission = buildLeadSubmissionSchema(RAPPI).parse({
      ...BASE,
      companyName: "Pizzería Don Juan",
      location: "Caballito",
      message: "Tengo dos locales",
      answers: { q_apps: "No", q_rubro: "Pizzería" },
    });
    expect(composeLeadMessage(RAPPI, submission)).toBe(
      "Nombre de tu local: Pizzería Don Juan\nBarrio: Caballito\n¿Ya vendés por apps de delivery? No\nRubro: Pizzería\n\nTengo dos locales"
    );
  });

  it("ignora campos ocultos aunque vengan en el envío", () => {
    const config: LeadFormConfig = {
      ...DEFAULT_LEAD_FORM,
      fields: { ...DEFAULT_LEAD_FORM.fields, companyName: { mode: "hidden", label: "Negocio" } },
    };
    const submission = buildLeadSubmissionSchema(config).parse({
      ...BASE,
      customerEmail: "j@x.com",
      companyName: "Esto no debería aparecer",
      message: "Hola",
    });
    expect(composeLeadMessage(config, submission)).toBe("Hola");
  });

  it("sin mensaje ni datos extra deja un texto mínimo", () => {
    const config: LeadFormConfig = {
      fields: { ...RAPPI.fields, companyName: { mode: "optional", label: "Local" }, location: { mode: "optional", label: "Barrio" } },
      custom: [],
    };
    const submission = buildLeadSubmissionSchema(config).parse({ ...BASE });
    expect(composeLeadMessage(config, submission)).toBe("(Sin mensaje)");
  });
});

describe("submissionEmail", () => {
  it("null si está oculto o vacío", () => {
    const s = buildLeadSubmissionSchema(RAPPI).parse({ ...BASE, companyName: "Local", location: "Caballito", answers: { q_apps: "Sí" } });
    expect(submissionEmail(RAPPI, s)).toBeNull();
  });
});

describe("configuración guardada", () => {
  it("una pregunta con opciones necesita al menos 2", () => {
    const bad = { ...RAPPI, custom: [{ ...RAPPI.custom[0], options: ["Sí"] }] };
    expect(leadFormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("un JSON inválido cae en el formulario estándar", () => {
    expect(resolveLeadFormConfig({ fields: "roto" })).toEqual(DEFAULT_LEAD_FORM);
    expect(resolveLeadFormConfig(null)).toEqual(DEFAULT_LEAD_FORM);
  });
});
