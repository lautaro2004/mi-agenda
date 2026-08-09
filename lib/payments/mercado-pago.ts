import type { Subscription } from "@/lib/types";

export interface CheckoutPreference {
  preferenceId: string;
  initPoint: string;
}

/**
 * Placeholder for the future Mercado Pago integration.
 * Currently simulates a successful checkout without calling any external API.
 */
export async function createCheckoutPreference(
  subscription: Subscription
): Promise<CheckoutPreference> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return {
    preferenceId: `mock-${subscription.id}`,
    initPoint: "#",
  };
}
