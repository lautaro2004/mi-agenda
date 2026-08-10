"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Clock, Pencil, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteIconButton } from "@/components/dashboard/delete-icon-button";
import { ServiceDialog } from "@/components/onboarding/service-dialog";
import { cn } from "@/lib/utils";
import { isBookableService, type Service } from "@/lib/types";
import type { ServiceFormValues } from "@/lib/schemas";

interface ServiceCardProps {
  service: Service;
  onEdit: (values: ServiceFormValues) => void;
  onDelete: () => Promise<void>;
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const [deleting, setDeleting] = React.useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
        deleting && "pointer-events-none opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{service.name}</h3>
          {service.category && (
            <Badge variant="outline" className="mt-1.5 gap-1 border-transparent bg-accent text-accent-foreground">
              <Tag className="size-3" />
              {service.category}
            </Badge>
          )}
        </div>
        <span className="shrink-0 text-lg font-semibold tracking-tight text-foreground">
          {currencyFormatter.format(service.price)}
        </span>
      </div>

      {service.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">{service.description}</p>
      )}

      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        {isBookableService(service) ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5" />
            {service.durationMinutes} min
          </span>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1">
          <ServiceDialog
            service={service}
            onSubmit={onEdit}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Editar ${service.name}`}>
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <DeleteIconButton
            onDelete={onDelete}
            label={`Eliminar ${service.name}`}
            onPendingChange={setDeleting}
          />
        </div>
      </div>
    </motion.div>
  );
}
