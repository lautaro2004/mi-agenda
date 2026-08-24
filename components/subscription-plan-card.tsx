import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPriceInCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { PLAN_SUBTITLE_BY_SLUG, buildPlanFeatureLines, type PublicPlan } from "@/lib/subscription-client";

// Compartida por /dashboard/suscripcion y /onboarding/suscripcion — ambas
// muestran los mismos planes reales (GET /api/plans), nunca datos inventados.
export function PlanCard({ plan, isCurrent }: { plan: PublicPlan; isCurrent: boolean }) {
  const subtitle = PLAN_SUBTITLE_BY_SLUG[plan.slug];

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-5",
        isCurrent ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">
          {plan.name}
          {subtitle && <span className="ml-1.5 font-medium text-primary">— {subtitle}</span>}
        </h3>
        {isCurrent && <Badge>Tu plan actual</Badge>}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {plan.monthlyPrice > 0 ? formatPriceInCurrency(plan.monthlyPrice, plan.currency) : "Gratis"}
        </span>
        {plan.monthlyPrice > 0 && <span className="text-sm text-muted-foreground">/ mes</span>}
      </div>

      {plan.description && <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>}

      <ul className="mt-4 space-y-2 text-sm text-foreground">
        {buildPlanFeatureLines(plan).map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4">
        {isCurrent ? (
          <Button className="w-full" variant="outline" disabled>
            Plan actual
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button className="flex-1" disabled>
              Elegir plan
            </Button>
            <Badge variant="outline" className="shrink-0">
              Próximamente
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
