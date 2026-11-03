"use client";

import * as React from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { SiteStats } from "@/components/dashboard/traffic/site-stats";
import { TrackingSettings } from "@/components/dashboard/traffic/tracking-settings";
import { UtmBuilder } from "@/components/dashboard/traffic/utm-builder";
import { useOnboarding } from "@/lib/onboarding-store";

export default function TrafficPage() {
  const { state, hydrated } = useOnboarding();
  const slug = state.business.slug ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tráfico del sitio"
        description="Cuánta gente entra a tu sitio, de dónde viene y qué hace. Sin cookies ni datos personales."
      />
      <SiteStats />
      {hydrated && <UtmBuilder slug={slug} />}
      <TrackingSettings />
    </div>
  );
}
