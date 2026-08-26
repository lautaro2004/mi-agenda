import { describe, expect, it } from "vitest";
import { MercadoPagoError } from "mercadopago";

import { describeMercadoPagoError } from "./errors";

describe("describeMercadoPagoError", () => {
  it("un MercadoPagoError con cause conocida da un detail entendible y technicalCode = code de la cause", () => {
    const error = new MercadoPagoError({
      status: 400,
      error: "bad_request",
      message: "Invalid card token",
      cause: [{ code: "cc_rejected_other_reason", description: "rechazado" }],
    });

    const info = describeMercadoPagoError(error);

    expect(info.httpStatus).toBe(400);
    expect(info.mpErrorSlug).toBe("bad_request");
    expect(info.detail).toBe("El medio de pago fue rechazado.");
    expect(info.technicalCode).toBe("cc_rejected_other_reason");
    expect(info.causes).toEqual([{ code: "cc_rejected_other_reason", description: "rechazado" }]);
  });

  it("una cause con code desconocido usa la description de Mercado Pago como detail", () => {
    const error = new MercadoPagoError({
      status: 400,
      error: "bad_request",
      message: "x",
      cause: [{ code: 9999, description: "Descripción provista por Mercado Pago" }],
    });

    const info = describeMercadoPagoError(error);

    expect(info.detail).toBe("Descripción provista por Mercado Pago");
    expect(info.technicalCode).toBe("9999");
  });

  it("un MercadoPagoError SIN causes cae a un detail genérico y usa el slug de error como technicalCode", () => {
    const error = new MercadoPagoError({ status: 401, error: "unauthorized", message: "invalid access token" });

    const info = describeMercadoPagoError(error);

    expect(info.causes).toEqual([]);
    expect(info.detail).toBe("Mercado Pago rechazó la operación.");
    expect(info.technicalCode).toBe("unauthorized");
    expect(info.rawMessage).toBe("invalid access token");
  });

  it("una cause sin code (solo description, o vacía) no aporta technicalCode", () => {
    const error = new MercadoPagoError({ status: 400, error: "bad_request", message: "x", cause: [{ description: "algo" }] });

    const info = describeMercadoPagoError(error);

    expect(info.technicalCode).toBe("bad_request");
    expect(info.detail).toBe("Mercado Pago rechazó la operación.");
  });

  it("sin causes y sin slug de error (body de la forma {message, status} — visto en la práctica contra /preapproval), usa el status HTTP como technicalCode", () => {
    // Reproduce el error real observado en sandbox al crear un preapproval:
    // Mercado Pago devolvió {"message":"Card token service not found","status":404}
    // sin campo "error" ni "cause".
    const error = new MercadoPagoError({ status: 404, message: "Card token service not found" });

    const info = describeMercadoPagoError(error);

    expect(info.mpErrorSlug).toBeNull();
    expect(info.technicalCode).toBe("404");
    expect(info.detail).toBe("Mercado Pago rechazó la operación.");
  });

  it("un Error genérico (no viene de Mercado Pago) da httpStatus/mpErrorSlug null y un detail genérico", () => {
    const info = describeMercadoPagoError(new Error("network timeout"));

    expect(info.httpStatus).toBeNull();
    expect(info.mpErrorSlug).toBeNull();
    expect(info.causes).toEqual([]);
    expect(info.rawMessage).toBe("network timeout");
    expect(info.detail).toBe("No pudimos completar la operación con Mercado Pago.");
    expect(info.technicalCode).toBeNull();
  });

  it("un valor no-Error (ej. algo lanzado como string) no rompe — da un rawMessage genérico", () => {
    const info = describeMercadoPagoError("algo raro");
    expect(info.rawMessage).toBe("Error desconocido.");
  });
});
