"use client";

import * as React from "react";
import { CheckCircle2, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestJson } from "@/lib/api-client";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" });

interface RedeemResponse {
  planName: string;
  bonusExpiresAt: string;
}

// Compartido por /dashboard/suscripcion y /onboarding/suscripcion (sección 6
// del pedido) — colapsado por default para no ensuciar la pantalla de
// planes con un campo que la mayoría de los negocios no usa.
export function SubscriptionPromoCodeForm({ onApplied }: { onApplied?: () => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<RedeemResponse | null>(null);

  async function handleApply() {
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestJson<RedeemResponse>("/api/business/promo-codes/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setSuccess(result);
      setCode("");
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos aplicar el código.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-foreground">
          ¡Código aplicado! Tu plan <strong>{success.planName}</strong> está bonificado hasta el{" "}
          <strong>{dateFormatter.format(new Date(success.bonusExpiresAt))}</strong>.
        </p>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Ticket className="size-3.5" />
        ¿Tenés un código de promoción?
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">¿Tenés un código de promoción?</p>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="NEXO-PRO-3M-8K4F"
          className="font-mono uppercase sm:flex-1"
          aria-invalid={!!error}
          onKeyDown={(e) => e.key === "Enter" && void handleApply()}
        />
        <Button type="button" disabled={submitting || !code.trim()} onClick={() => void handleApply()}>
          {submitting ? "Aplicando..." : "Aplicar"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
