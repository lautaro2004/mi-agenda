import { MessageCircle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function FloatingWhatsapp({ href }: { href: string | null }) {
  if (!href) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Hablar por WhatsApp"
            className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6"
          />
        }
      >
        <MessageCircle className="size-6" />
      </TooltipTrigger>
      <TooltipContent side="left">Hablar por WhatsApp</TooltipContent>
    </Tooltip>
  );
}
