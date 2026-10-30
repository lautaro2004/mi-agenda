"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { CampaignForm } from "@/components/whatsapp/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nueva campaña" description="Definí cómo se identifica el anuncio y cómo debe actuar el agente." />
      <CampaignForm />
    </div>
  );
}
