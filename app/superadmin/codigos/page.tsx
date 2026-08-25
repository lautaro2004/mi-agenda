"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Pencil, Plus } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PromoCodeDialog } from "@/components/superadmin/promo-code-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import type { PromoCodeFormValues } from "@/lib/schemas";

interface PromoCodeRow {
  id: string;
  code: string;
  planId: string;
  planName: string;
  durationDays: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string;
  active: boolean;
  description: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDuration(days: number): string {
  if (days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? "1 mes" : `${months} meses`;
  }
  return `${days} días`;
}

function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export default function SuperadminPromoCodesPage() {
  const [promoCodes, setPromoCodes] = React.useState<PromoCodeRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  function load() {
    setLoading(true);
    requestJson<{ promoCodes: PromoCodeRow[] }>("/api/superadmin/promo-codes")
      .then(({ promoCodes }) => setPromoCodes(promoCodes))
      .catch(() => setPromoCodes([]))
      .finally(() => setLoading(false));
  }

  React.useEffect(load, []);

  async function handleCreate(values: PromoCodeFormValues) {
    try {
      await requestJson("/api/superadmin/promo-codes", { method: "POST", body: JSON.stringify(values) });
      toast.success("Código creado");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos crear el código.");
    }
  }

  async function handleUpdate(id: string, values: PromoCodeFormValues) {
    try {
      await requestJson(`/api/superadmin/promo-codes/${id}`, { method: "PATCH", body: JSON.stringify(values) });
      toast.success("Código actualizado");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el código.");
    }
  }

  async function toggleActive(promoCode: PromoCodeRow) {
    try {
      await requestJson(`/api/superadmin/promo-codes/${promoCode.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !promoCode.active }),
      });
      toast.success(promoCode.active ? "Código desactivado" : "Código activado");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el código.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Códigos promocionales"
        description="Regalá un plan de Nexo por un período determinado sin tocar la suscripción a mano."
        action={
          <PromoCodeDialog
            trigger={<Button size="sm"><Plus className="size-4" data-icon="inline-start" />Nuevo código</Button>}
            onSubmit={handleCreate}
          />
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Duración</th>
              <th className="px-4 py-3 font-medium">Usos</th>
              <th className="px-4 py-3 font-medium">Vencimiento</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={7}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : !promoCodes || promoCodes.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  Todavía no creaste ningún código.
                </td>
              </tr>
            ) : (
              promoCodes.map((promoCode) => {
                const expired = isExpired(promoCode.expiresAt);
                const exhausted = promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses;
                return (
                  <tr key={promoCode.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/superadmin/codigos/${promoCode.id}`} className="font-mono text-xs font-medium text-foreground underline-offset-2 hover:underline">
                        {promoCode.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{promoCode.planName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDuration(promoCode.durationDays)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {promoCode.usedCount} / {promoCode.maxUses ?? "∞"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(new Date(promoCode.expiresAt))}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={promoCode.active ? "secondary" : "outline"}>{promoCode.active ? "Activo" : "Inactivo"}</Badge>
                        {expired && <Badge variant="outline" className="text-[11px] text-destructive">Vencido</Badge>}
                        {exhausted && <Badge variant="outline" className="text-[11px]">Agotado</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="icon-sm" variant="ghost" aria-label="Ver detalle" render={<Link href={`/superadmin/codigos/${promoCode.id}`} />} nativeButton={false}>
                          <Eye className="size-3.5" />
                        </Button>
                        <PromoCodeDialog
                          promoCode={promoCode}
                          trigger={
                            <Button size="icon-sm" variant="ghost" aria-label="Editar código">
                              <Pencil className="size-3.5" />
                            </Button>
                          }
                          onSubmit={(values) => handleUpdate(promoCode.id, values)}
                        />
                        <Button size="sm" variant="outline" onClick={() => void toggleActive(promoCode)}>
                          {promoCode.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Un código nunca se elimina — queda como historial de qué negocio lo usó y cuándo. Un código de un solo uso
        simplemente queda agotado.
      </p>
    </div>
  );
}
