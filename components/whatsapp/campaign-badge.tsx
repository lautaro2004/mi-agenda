import { Megaphone } from "lucide-react";

import { ATTRIBUTION_METHOD_LABEL } from "@/lib/campaigns";
import type { ConversationCampaignInfo } from "@/lib/types";

// Campaña de origen de una conversación. Una atribución inferida se muestra
// como «probable»: nunca como si fuera confirmada.
export function CampaignBadge({ campaign, detailed = false }: { campaign?: ConversationCampaignInfo; detailed?: boolean }) {
  if (!campaign?.campaignName) return null;
  const confirmed = campaign.confirmed;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
      title={`${confirmed ? "Asignada por el negocio" : "Origen inferido"} · ${ATTRIBUTION_METHOD_LABEL[campaign.method]}`}
    >
      <Megaphone className="size-2.5 shrink-0" aria-hidden />
      <span className="truncate">{campaign.campaignName}</span>
      {detailed ? (
        <span className="shrink-0">· {confirmed ? "confirmada" : "probable"} ({ATTRIBUTION_METHOD_LABEL[campaign.method].toLowerCase()})</span>
      ) : (
        !confirmed && <span className="shrink-0">· probable</span>
      )}
    </span>
  );
}
