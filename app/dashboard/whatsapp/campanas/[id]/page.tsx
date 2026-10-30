"use client";

import { use, useEffect, useState } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignForm } from "@/components/whatsapp/campaign-form";
import { requestJson } from "@/lib/api-client";
import type { CampaignConfig } from "@/lib/campaigns";

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<CampaignConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    requestJson<{ campaign: CampaignConfig }>(`/api/whatsapp/campaigns/${id}`)
      .then((d) => !cancelled && setCampaign(d.campaign))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "No pudimos cargar la campaña."));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Editar campaña" description="Los cambios no modifican el origen de las conversaciones que ya llegaron." />
      {error && <Card className="p-4 text-sm text-destructive">{error}</Card>}
      {!error && !campaign && <Skeleton className="h-64 w-full" />}
      {campaign && <CampaignForm initial={campaign} />}
    </div>
  );
}
