import { describe, expect, it } from "vitest";
import { cleanAgentName } from "./builder";

describe("cleanAgentName", () => {
  it("saca el verbo inicial", () => {
    expect(cleanAgentName("Sos Kodi")).toBe("Kodi");
    expect(cleanAgentName("Soy Kodi")).toBe("Kodi");
  });
  it("respeta nombres normales", () => {
    expect(cleanAgentName("Sofía")).toBe("Sofía");
    expect(cleanAgentName("Sosa")).toBe("Sosa");
  });
});
