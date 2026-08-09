"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="size-4" />
          </span>
          <span>Mi Agenda</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#problemas" className="transition-colors hover:text-foreground">
            Problemas
          </a>
          <a href="#por-que-mi-agenda" className="transition-colors hover:text-foreground">
            Por qué Mi Agenda
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Cómo funciona
          </a>
          <a href="#planes" className="transition-colors hover:text-foreground">
            Planes
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            size="sm"
            variant="ghost"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            Iniciar sesión
          </Button>
          <Button size="sm" render={<Link href="/registro" />} nativeButton={false}>
            Empezar gratis
          </Button>
        </div>
      </div>
    </header>
  );
}
