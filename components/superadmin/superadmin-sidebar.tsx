"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { SUPERADMIN_NAV } from "@/lib/superadmin/nav";
import { cn } from "@/lib/utils";

// Deliberadamente NO reusa SidebarNav (components/dashboard/sidebar-nav.tsx):
// ese componente está hardcodeado a DASHBOARD_NAV y a acciones de cuenta de
// un negocio (no aplica acá, esto no es un negocio). Mismo lenguaje visual,
// nav propio.
export function SuperadminSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-2 py-4 font-semibold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-4" />
        </span>
        <span>Superadmin</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 py-2">
        {SUPERADMIN_NAV.map((item) => {
          const isActive = item.href === "/superadmin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/dashboard"
        className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        ← Volver al dashboard
      </Link>
    </div>
  );
}
