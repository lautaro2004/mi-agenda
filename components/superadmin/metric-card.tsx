import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | null;
  description?: string;
  unavailableReason?: string;
}

// Variante de StatCard (components/dashboard/stat-card.tsx) sin Link: la
// mayoría de estas métricas no tienen una pantalla de detalle propia, y
// algunas (ingresos, plan/prueba) todavía no tienen ningún dato real detrás
// — value=null las muestra explícitamente como "No disponible" en vez de
// inventar un 0 o un placeholder que parezca un número real.
export function MetricCard({ icon: Icon, label, value, description, unavailableReason }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        {value !== null ? (
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        ) : (
          <p className="text-lg font-medium text-muted-foreground">No disponible</p>
        )}
        <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
        {value !== null && description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        {value === null && unavailableReason && (
          <p className="mt-1 text-xs text-muted-foreground">{unavailableReason}</p>
        )}
      </div>
    </div>
  );
}
