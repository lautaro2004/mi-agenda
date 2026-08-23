import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FloatingWhatsappProps {
  href: string | null;
  // La plantilla booking agrega una barra fija "Reservar ahora" al pie en
  // mobile (ver BookingStickyCta) — sin este offset, el círculo de WhatsApp
  // quedaría superpuesto sobre esa barra.
  liftedOnMobile?: boolean;
}

export function FloatingWhatsapp({ href, liftedOnMobile }: FloatingWhatsappProps) {
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
            className={cn(
              "fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6",
              liftedOnMobile && "bottom-20 sm:bottom-6"
            )}
          />
        }
      >
        <MessageCircle className="size-6" />
      </TooltipTrigger>
      <TooltipContent side="left">Hablar por WhatsApp</TooltipContent>
    </Tooltip>
  );
}
