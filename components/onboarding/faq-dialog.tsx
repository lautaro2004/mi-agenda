"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { faqSchema, type FaqFormValues } from "@/lib/schemas";
import type { FAQ } from "@/lib/types";

interface FaqDialogProps {
  trigger: React.ReactElement;
  faq?: FAQ;
  onSubmit: (values: FaqFormValues) => void;
}

export function FaqDialog({ trigger, faq, onSubmit }: FaqDialogProps) {
  const [open, setOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FaqFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: faq?.question ?? "",
      answer: faq?.answer ?? "",
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ question: faq?.question ?? "", answer: faq?.answer ?? "" });
    }
  }

  function submit(values: FaqFormValues) {
    onSubmit(values);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{faq ? "Editar pregunta" : "Nueva pregunta frecuente"}</DialogTitle>
          <DialogDescription>
            Esta información será utilizada por la IA para responder a tus clientes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="faq-form">
          <FieldGroup>
            <Field data-invalid={!!errors.question}>
              <FieldLabel htmlFor="faq-question">Pregunta</FieldLabel>
              <Input
                id="faq-question"
                placeholder="Ej: ¿Dónde están ubicados?"
                aria-invalid={!!errors.question}
                {...register("question")}
              />
              <FieldError errors={[errors.question]} />
            </Field>

            <Field data-invalid={!!errors.answer}>
              <FieldLabel htmlFor="faq-answer">Respuesta</FieldLabel>
              <Textarea
                id="faq-answer"
                placeholder="Escribí la respuesta para esta pregunta"
                rows={4}
                aria-invalid={!!errors.answer}
                {...register("answer")}
              />
              <FieldError errors={[errors.answer]} />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="faq-form">
            {faq ? "Guardar cambios" : "Agregar pregunta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
