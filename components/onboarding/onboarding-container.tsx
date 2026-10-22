"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// La pantalla de chat (/onboarding) necesita más ancho que los pasos del
// formulario: con el contenedor de 768px el chat quedaba en ~360px al lado
// del panel del plan, con burbujas angostas y mucho espacio vacío alrededor.
export function OnboardingContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname === "/onboarding";
  return <div className={cn("mx-auto w-full", wide ? "max-w-6xl" : "max-w-3xl")}>{children}</div>;
}

export function OnboardingHeaderContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname === "/onboarding";
  return <div className={cn("mx-auto flex h-16 items-center justify-between px-4 sm:px-6", wide ? "max-w-6xl" : "max-w-3xl")}>{children}</div>;
}
