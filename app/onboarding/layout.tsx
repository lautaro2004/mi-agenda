import Link from "next/link";
import Image from "next/image";

import { StepIndicator } from "@/components/onboarding/step-indicator";
import { ThemeToggle } from "@/components/theme-toggle";
import { OnboardingContainer, OnboardingHeaderContainer } from "@/components/onboarding/onboarding-container";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-muted/30">
      <header className="border-b border-border bg-background">
        <OnboardingHeaderContainer>
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Image src="/logo-nexo-mark.png" alt="Nexo" width={32} height={32} className="size-8" priority />
            <span>Nexo</span>
          </Link>
          <ThemeToggle />
        </OnboardingHeaderContainer>
      </header>

      <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        <OnboardingContainer>
          <StepIndicator />

          <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm first:mt-0 sm:p-8">
            {children}
          </div>
        </OnboardingContainer>
      </main>
    </div>
  );
}
