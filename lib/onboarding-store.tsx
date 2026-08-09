"use client";

import * as React from "react";
import {
  Business,
  BusinessSchedule,
  FAQ,
  type OnboardingState,
  Service,
  Subscription,
} from "@/lib/types";
import { initialOnboardingState } from "@/lib/mock-data";
import { authClient } from "@/lib/auth/auth-client";
import { requestJson } from "@/lib/api-client";

interface OnboardingContextValue {
  state: OnboardingState;
  hydrated: boolean;
  updateBusiness: (business: Partial<Business>) => Promise<void>;
  setSchedule: (schedule: BusinessSchedule) => Promise<void>;
  addService: (service: Omit<Service, "id" | "businessId">) => Promise<void>;
  updateService: (id: string, service: Omit<Service, "id" | "businessId">) => Promise<void>;
  removeService: (id: string) => Promise<void>;
  addFaq: (faq: Omit<FAQ, "id" | "businessId">) => Promise<void>;
  updateFaq: (id: string, faq: Omit<FAQ, "id" | "businessId">) => Promise<void>;
  removeFaq: (id: string) => Promise<void>;
  setSubscription: (subscription: Partial<Subscription>) => void;
  setStep: (step: number) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<OnboardingState>(initialOnboardingState);
  const [hydrated, setHydrated] = React.useState(false);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user?.id;

  React.useEffect(() => {
    if (sessionPending) return;

    if (!userId) {
      setState((prev) => ({ ...initialOnboardingState, subscription: prev.subscription }));
      setHydrated(true);
      return;
    }

    let cancelled = false;

    fetch("/api/business")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data: {
            business: Business;
            schedule: BusinessSchedule;
            services: Service[];
            faqs: FAQ[];
          } | null
        ) => {
          if (cancelled || !data) return;
          setState((prev) => ({
            ...prev,
            business: data.business,
            schedule: data.schedule,
            services: data.services,
            faqs: data.faqs,
          }));
        }
      )
      .catch(() => {
        // Network error — keep local defaults.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, sessionPending]);

  const value = React.useMemo<OnboardingContextValue>(
    () => ({
      state,
      hydrated,
      updateBusiness: async (business) => {
        const { business: updated } = await requestJson<{ business: Business }>("/api/business", {
          method: "PATCH",
          body: JSON.stringify(business),
        });
        setState((prev) => ({ ...prev, business: updated }));
      },
      setSchedule: async (schedule) => {
        const { schedule: updated } = await requestJson<{ schedule: BusinessSchedule }>(
          "/api/business/schedule",
          { method: "PUT", body: JSON.stringify(schedule) }
        );
        setState((prev) => ({ ...prev, schedule: updated }));
      },
      addService: async (service) => {
        const { service: created } = await requestJson<{ service: Service }>(
          "/api/business/services",
          { method: "POST", body: JSON.stringify(service) }
        );
        setState((prev) => ({ ...prev, services: [...prev.services, created] }));
      },
      updateService: async (id, service) => {
        const { service: updated } = await requestJson<{ service: Service }>(
          `/api/business/services/${id}`,
          { method: "PATCH", body: JSON.stringify(service) }
        );
        setState((prev) => ({
          ...prev,
          services: prev.services.map((s) => (s.id === id ? updated : s)),
        }));
      },
      removeService: async (id) => {
        await requestJson(`/api/business/services/${id}`, { method: "DELETE" });
        setState((prev) => ({ ...prev, services: prev.services.filter((s) => s.id !== id) }));
      },
      addFaq: async (faq) => {
        const { faq: created } = await requestJson<{ faq: FAQ }>("/api/business/faqs", {
          method: "POST",
          body: JSON.stringify(faq),
        });
        setState((prev) => ({ ...prev, faqs: [...prev.faqs, created] }));
      },
      updateFaq: async (id, faq) => {
        const { faq: updated } = await requestJson<{ faq: FAQ }>(`/api/business/faqs/${id}`, {
          method: "PATCH",
          body: JSON.stringify(faq),
        });
        setState((prev) => ({
          ...prev,
          faqs: prev.faqs.map((f) => (f.id === id ? updated : f)),
        }));
      },
      removeFaq: async (id) => {
        await requestJson(`/api/business/faqs/${id}`, { method: "DELETE" });
        setState((prev) => ({ ...prev, faqs: prev.faqs.filter((f) => f.id !== id) }));
      },
      setSubscription: (subscription) =>
        setState((prev) => ({
          ...prev,
          subscription: { ...prev.subscription, ...subscription },
        })),
      setStep: (step) => setState((prev) => ({ ...prev, step })),
      completeOnboarding: () => setState((prev) => ({ ...prev, completed: true })),
      reset: () => setState(initialOnboardingState),
    }),
    [state, hydrated]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = React.useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
