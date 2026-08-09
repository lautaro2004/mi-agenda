"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface StepActionsProps {
  backHref?: string;
  nextLabel?: string;
  loading?: boolean;
  submit?: boolean;
  nextDisabled?: boolean;
  onNext?: () => void;
}

export function StepActions({
  backHref,
  nextLabel = "Continuar",
  loading,
  submit,
  nextDisabled,
  onNext,
}: StepActionsProps) {
  return (
    <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
      {backHref ? (
        <Button variant="ghost" render={<Link href={backHref} />} nativeButton={false}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          Atrás
        </Button>
      ) : (
        <span />
      )}

      <Button type={submit ? "submit" : "button"} onClick={onNext} disabled={loading || nextDisabled}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {nextLabel}
        {!loading && <ArrowRight className="size-4" data-icon="inline-end" />}
      </Button>
    </div>
  );
}
