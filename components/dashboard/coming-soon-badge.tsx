import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-transparent bg-primary/10 font-medium text-primary",
        className
      )}
    >
      <Sparkles className="size-3" />
      Próximamente
    </Badge>
  );
}
