"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CreditCard, HelpCircle, LogOut, Menu, User, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DASHBOARD_NAV } from "@/lib/dashboard-nav";
import { useOnboarding } from "@/lib/onboarding-store";
import { authClient } from "@/lib/auth/auth-client";

export function DashboardTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { state } = useOnboarding();
  const { business } = state;
  const [open, setOpen] = React.useState(false);

  // Mismo flujo de logout que ya existía (authClient.signOut() + redirect a
  // "/" con refresh) — solo se reubica el trigger dentro del menú de perfil
  // ampliado, la lógica no cambia.
  async function handleLogout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const allItems = DASHBOARD_NAV.flatMap((item): { href: string; label: string; icon: LucideIcon }[] =>
    "children" in item ? [item, ...item.children] : [item]
  );
  const current = allItems
    .filter((item) =>
      item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  const userName = session?.user?.name;
  // Iniciales del NEGOCIO, no del usuario — el avatar representa la cuenta
  // del negocio (logo cuando existe), consistente con el label de abajo.
  const initials = business.name
    ? business.name
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "MA";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-4 lg:hidden">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú de navegación"
        >
          <Menu className="size-5" />
        </Button>
      </Sheet>

      <h1 className="flex-1 text-sm font-semibold text-foreground sm:text-base">
        {current?.label ?? "Dashboard"}
      </h1>

      <ThemeToggle />
      <NotificationsBell />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menú de cuenta">
              <Avatar className="size-8">
                {business.logoUrl && <AvatarImage src={business.logoUrl} alt={business.name || "Negocio"} />}
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{business.name || userName || "Tu negocio"}</span>
              <span className="text-xs text-muted-foreground">{session?.user?.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/dashboard/cuenta" />}>
            <User className="size-4" data-icon="inline-start" />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/suscripcion" />}>
            <CreditCard className="size-4" data-icon="inline-start" />
            Suscripción
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/ayuda" />}>
            <HelpCircle className="size-4" data-icon="inline-start" />
            Ayuda / Soporte
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} variant="destructive">
            <LogOut className="size-4" data-icon="inline-start" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
