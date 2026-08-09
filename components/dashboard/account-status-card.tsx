import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import type { OnboardingState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AccountStatusCardProps {
  business: OnboardingState["business"];
  subscriptionStatus: OnboardingState["subscription"]["status"];
  configIncomplete: boolean;
  completionPercentage: number;
}

export function AccountStatusCard({
  business,
  subscriptionStatus,
  configIncomplete,
  completionPercentage,
}: AccountStatusCardProps) {
  let status: {
    label: string;
    description: string;
    icon: typeof CheckCircle2;
    tone: string;
    action?: { label: string; href: string };
  };

  if (subscriptionStatus === "expired") {
    status = {
      label: "Suscripción vencida",
      description: "Renová tu suscripción para seguir usando Mi Agenda.",
      icon: AlertCircle,
      tone: "text-destructive bg-destructive/10",
      action: { label: "Renovar suscripción", href: "/dashboard/suscripcion" },
    };
  } else if (subscriptionStatus === "pending") {
    status = {
      label: "Pendiente de pago",
      description: "Activá tu suscripción para habilitar todas las funciones.",
      icon: Clock,
      tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
      action: { label: "Ir a suscripción", href: "/dashboard/suscripcion" },
    };
  } else if (configIncomplete) {
    status = {
      label: "Configuración incompleta",
      description: "Todavía faltan datos por completar en tu negocio.",
      icon: AlertCircle,
      tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
      action: { label: "Completar configuración", href: "/dashboard/negocio" },
    };
  } else {
    status = {
      label: "Cuenta activa",
      description: "Tu negocio está configurado y tu suscripción está al día.",
      icon: CheckCircle2,
      tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    };
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", status.tone)}>
            <status.icon className="size-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {business.name || "Tu negocio"}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
              {status.label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{status.description}</p>
          </div>
        </div>

        {status.action && (
          <Button render={<Link href={status.action.href} />} nativeButton={false} className="shrink-0">
            {status.action.label}
          </Button>
        )}
      </div>

      <div className="border-t border-border bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Configuración del negocio</span>
          <span className="font-semibold tabular-nums text-foreground">
            {completionPercentage}% configurado
          </span>
        </div>
        <Progress value={completionPercentage} className="mt-2 flex-col items-stretch gap-0">
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      </div>
    </div>
  );
}
