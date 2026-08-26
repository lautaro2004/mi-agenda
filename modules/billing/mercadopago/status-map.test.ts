import { describe, expect, it } from "vitest";

import { mapMercadoPagoStatus } from "./status-map";

describe("mapMercadoPagoStatus", () => {
  it("authorized -> active", () => {
    expect(mapMercadoPagoStatus("authorized")).toBe("active");
  });

  it("paused -> past_due", () => {
    expect(mapMercadoPagoStatus("paused")).toBe("past_due");
  });

  it("cancelled -> canceled", () => {
    expect(mapMercadoPagoStatus("cancelled")).toBe("canceled");
  });

  it("pending -> null (todavía no hay nada que reflejar)", () => {
    expect(mapMercadoPagoStatus("pending")).toBeNull();
  });

  it("un valor desconocido -> null (nunca inventa un estado interno)", () => {
    expect(mapMercadoPagoStatus("algo_que_mercadopago_agregue_despues")).toBeNull();
  });
});
