import { FLOW_STATE_META, MESSAGE_CATEGORY_META } from "@/lib/types";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<"responded" | "ignored" | "escalated", string> = {
  responded: "Respondido",
  ignored: "Ignorado",
  escalated: "Escalado a humano",
};

const ACTION_CLASS: Record<"responded" | "ignored" | "escalated", string> = {
  responded: "text-green-600 dark:text-green-400",
  ignored: "text-muted-foreground",
  escalated: "text-red-600 dark:text-red-400",
};

export function ConversationTriagePanel({ conversation }: { conversation: Conversation }) {
  const stateMeta = FLOW_STATE_META[conversation.flowState];
  const { lastTriage } = conversation;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Análisis de IA</h3>

      <div className="mt-3 space-y-3">
        {/* Flow state */}
        <div>
          <p className="text-xs text-muted-foreground">Estado del flujo</p>
          <span
            className={cn(
              "mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
              stateMeta.className,
            )}
          >
            {stateMeta.label}
          </span>
        </div>

        {/* Last classification */}
        {lastTriage ? (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Último mensaje</p>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Categoría</span>
              <span className="font-medium text-foreground">
                {MESSAGE_CATEGORY_META[lastTriage.category].label}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Confianza</span>
              <span className="font-medium text-foreground">
                {Math.round(lastTriage.confidence * 100)}%
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${lastTriage.confidence * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Acción</span>
              <span className={cn("font-medium", ACTION_CLASS[lastTriage.action])}>
                {ACTION_LABEL[lastTriage.action]}
              </span>
            </div>

            {lastTriage.ignoreReason && (
              <p className="text-xs text-muted-foreground">
                Motivo: {lastTriage.ignoreReason}
              </p>
            )}
          </div>
        ) : (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Sin mensajes procesados aún.
          </p>
        )}
      </div>
    </div>
  );
}
