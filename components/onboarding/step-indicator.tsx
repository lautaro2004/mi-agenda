"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { ONBOARDING_STEPS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StepIndicator() {
  const pathname = usePathname();

  // La raíz /onboarding es la pantalla de chat, no un paso del wizard.
  if (pathname === "/onboarding") return null;

  const currentSlug = pathname.split("/").pop();
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.slug === currentSlug);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;
  const progress = ((activeIndex + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = index < activeIndex;
          const isCurrent = index === activeIndex;

          return (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isCompleted && !isCurrent && "border-border text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="size-3.5" /> : step.id}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline truncate",
                  isCurrent || isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
