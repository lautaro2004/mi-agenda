"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";

interface ScheduleMeetingDialogProps {
  trigger: React.ReactElement;
  currentMeetingAt: string | null;
  onSchedule: (meetingAt: string) => Promise<void>;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Sección 8 del pedido: sin Google Calendar todavía — solo guarda una fecha
// y hora. "Coordinar reunión" abre esto, confirmar dispara el PATCH que ya
// existe (updateLead), que además mueve el lead a estado MEETING.
export function ScheduleMeetingDialog({ trigger, currentMeetingAt, onSchedule }: ScheduleMeetingDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(() => toLocalInputValue(currentMeetingAt));
  const [submitting, setSubmitting] = React.useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setValue(toLocalInputValue(currentMeetingAt));
  }

  async function handleConfirm() {
    if (!value) return;
    setSubmitting(true);
    try {
      await onSchedule(new Date(value).toISOString());
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Coordinar reunión</DialogTitle>
          <DialogDescription>Guardá fecha y hora — más adelante se puede integrar con Calendar.</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="meeting-at">Fecha y hora</FieldLabel>
          <Input id="meeting-at" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={!value || submitting}>
            {submitting ? "Guardando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
