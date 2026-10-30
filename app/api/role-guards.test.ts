import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guardia de regresión: toda mutación de configuración del negocio exige
// admin y toda mutación de facturación exige dueño (ver
// modules/business/current.ts). Si alguien agrega una ruta nueva en estas
// carpetas sin minRole, este test falla.
const ROOT = path.join(process.cwd(), "app/api");
const ADMIN = ["ai-studio/", "business/assets", "business/email-notifications", "business/faqs", "business/gallery", "business/menu", "business/payment-settings", "business/resources", "business/schedule", "business/smart-booking", "business/seo", "business/services", "business/site-template", "business/inquiries/[id]/nodo-sync", "whatsapp/campaigns", "whatsapp/ai", "whatsapp/connect", "whatsapp/disconnect"];
const OWNER = ["business/promo-codes/redeem", "subscriptions/cancel", "subscriptions/checkout"];

function handlers(file: string) {
  const src = readFileSync(file, "utf8");
  return src.split(/(?=export async function (?:GET|POST|PATCH|PUT|DELETE)\b)/).slice(1).map((chunk) => ({ method: /export async function (\w+)/.exec(chunk)![1], chunk }));
}

describe("rutas de Nexo protegidas por rol", () => {
  const files = (readdirSync(ROOT, { recursive: true }) as string[]).filter((f) => f.endsWith("route.ts")).map((f) => f.split(path.sep).join("/"));
  it.each(files)("%s", (rel) => {
    const key = rel.replace(/\/route\.ts$/, "");
    const role = OWNER.includes(key) ? "owner" : key === "business" || ADMIN.some((p) => key.startsWith(p)) ? "admin" : null;
    if (!role) return;
    for (const { method, chunk } of handlers(path.join(ROOT, rel))) {
      if (method === "GET") continue;
      expect(chunk, `${key} ${method}`).toContain(`getCurrentBusinessId({ minRole: "${role}" })`);
    }
  });
});
