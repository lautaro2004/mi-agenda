import type { Business, Service } from "@/lib/types";

export interface DepositQuote {
  depositAmount: number;
  totalAmount: number;
}

// Única fuente de verdad de cuánto se le pide de seña al cliente — la usa
// tanto el Booking Flow de WhatsApp (modules/ai/booking/flow.ts, al informar
// el monto antes de pedir el comprobante) como cualquier lugar del dashboard
// que necesite mostrar una previsualización. null en dos casos: el negocio
// no pide seña, o el servicio no tiene precio cargado (no tiene sentido
// pedir un % de $0).
export function computeDepositAmount(
  business: Pick<Business, "depositRequired" | "depositType" | "depositFixedAmount" | "depositPercentage">,
  service: Pick<Service, "price">,
): DepositQuote | null {
  if (!business.depositRequired) return null;

  const totalAmount = service.price;

  const depositAmount =
    business.depositType === "percentage"
      ? Math.round((totalAmount * (business.depositPercentage ?? 0)) / 100)
      : (business.depositFixedAmount ?? 0);

  if (depositAmount <= 0) return null;

  return { depositAmount, totalAmount };
}
