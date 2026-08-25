"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Calendar, Clock, Hash, Tag, Ticket } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";

interface PromoCodeDetail {
  id: string;
  code: string;
  planName: string;
  durationDays: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string;
  active: boolean;
  description: string | null;
  createdAt: string;
}

interface RedemptionRow {
  id: string;
  businessName: string;
  planNameSnapshot: string;
  bonusExpiresAt: string;
  redeemedAt: string;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" });

function formatDuration(days: number): string {
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? "1 mes" : `${months} meses`;
  }
  return `${days} días`;
}

function Row({ icon: Icon, label, value }: { icon: typeof Ticket; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default function PromoCodeDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<{ promoCode: PromoCodeDetail; redemptions: RedemptionRow[] } | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ promoCode: PromoCodeDetail; redemptions: RedemptionRow[] }>(`/api/superadmin/promo-codes/${params.id}`)
      .then(setData)
      .catch(() => setLoadError(true));
  }, [params.id]);

  return (
    <div className="space-y-6">
      <div>
        <Button size="sm" variant="ghost" render={<Link href="/superadmin/codigos" />} nativeButton={false} className="mb-2 -ml-2">
          <ArrowLeft className="size-3.5" data-icon="inline-start" />
          Volver a códigos
        </Button>
        <PageHeader title={data?.promoCode.code ?? "Código promocional"} description="Detalle y beneficio + historial de canjes." />
      </div>

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          No pudimos cargar el código. Recargá la página para volver a intentar.
        </div>
      ) : !data ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-base font-semibold text-foreground">{data.promoCode.code}</p>
              <Badge variant={data.promoCode.active ? "secondary" : "outline"}>
                {data.promoCode.active ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            <dl className="mt-5 space-y-4 text-sm">
              <Row icon={Tag} label="Plan" value={data.promoCode.planName} />
              <Row icon={Clock} label="Beneficio" value={`${formatDuration(data.promoCode.durationDays)} de bonificación`} />
              <Row
                icon={Hash}
                label="Usos disponibles"
                value={data.promoCode.maxUses === null ? "Sin límite" : Math.max(0, data.promoCode.maxUses - data.promoCode.usedCount)}
              />
              <Row icon={Ticket} label="Usos realizados" value={data.promoCode.usedCount} />
              <Row icon={Calendar} label="Fecha de creación" value={dateFormatter.format(new Date(data.promoCode.createdAt))} />
              <Row icon={Calendar} label="Vencimiento" value={dateFormatter.format(new Date(data.promoCode.expiresAt))} />
            </dl>

            {data.promoCode.description && (
              <p className="mt-5 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                {data.promoCode.description}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold text-foreground">Historial de usos</h3>
            <p className="mt-1 text-sm text-muted-foreground">Código → quién lo utilizó → cuándo → qué recibió.</p>

            {data.redemptions.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">Todavía no se usó.</p>
            ) : (
              <div className="mt-5 divide-y divide-border/60">
                {data.redemptions.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{r.businessName}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.planNameSnapshot} · bonificado hasta {dateFormatter.format(new Date(r.bonusExpiresAt))}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{dateFormatter.format(new Date(r.redeemedAt))}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
