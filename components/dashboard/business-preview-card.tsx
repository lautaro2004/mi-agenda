import { MapPin, MessageCircle, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BusinessPreviewCardProps {
  name: string;
  logoUrl: string | null;
  category: string;
  address: string;
  whatsappNumber: string;
}

export function BusinessPreviewCard({ name, logoUrl, category, address, whatsappNumber }: BusinessPreviewCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">Así te ven tus clientes</p>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-muted-foreground">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={`Logo de ${name || "tu negocio"}`} className="size-full object-cover" />
            ) : (
              <Store className="size-6" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{name || "Tu negocio"}</p>
            {category ? (
              <Badge variant="outline" className="mt-1.5">
                {category}
              </Badge>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Sin rubro definido</p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2.5 border-t border-border pt-4">
          <div className="flex items-start gap-2.5 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className={cn(address ? "text-foreground" : "text-muted-foreground")}>
              {address || "Agregá la dirección de tu negocio"}
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-sm">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className={cn(whatsappNumber ? "text-foreground" : "text-muted-foreground")}>
              {whatsappNumber || "Agregá tu número de WhatsApp"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
