import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { StepIndicator } from "@/components/onboarding/step-indicator";
import { ThemeToggle } from "@/components/theme-toggle";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="size-4" />
            </span>
            <span>Mi Agenda</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <StepIndicator />

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
