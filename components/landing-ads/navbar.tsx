"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { trackEvent } from "@/lib/analytics";

// A propósito mucho más liviana que components/landing/navbar.tsx: nada de
// links de navegación (#producto, #como-funciona, etc.) — esta página es de
// tráfico pago (Google/Meta Ads), el objetivo es una sola acción, no
// explorar el resto del sitio. Menos salidas posibles = mejor conversión.
export function LandingAdsNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Image src="/logo-nexo-mark.png" alt="Nexo" width={32} height={32} className="size-8" priority />
          <span className="text-base">Nexo</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            size="sm"
            render={<Link href="/registro" />}
            nativeButton={false}
            onClick={() => trackEvent("click_cta_hero", { placement: "navbar" })}
          >
            Probá Nexo
            <ArrowRight className="ml-1 size-3.5" data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </header>
  );
}
