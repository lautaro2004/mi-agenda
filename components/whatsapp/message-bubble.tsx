import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/lib/types";

export function MessageBubble({ message }: { message: ConversationMessage }) {
  const isCustomer = message.sender === "customer";

  return (
    <div className={cn("flex", isCustomer ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
          isCustomer ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        {message.sender === "ai" && (
          <div className="mb-1 flex items-center gap-1 text-xs opacity-70">
            <Sparkles className="size-3" />
            Respuesta automática
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.text}</p>
        <p className={cn("mt-1 text-right text-[11px] opacity-60")}>
          {new Date(message.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
