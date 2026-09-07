"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { DASHBOARD_NAV } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2 px-2 py-4 font-semibold tracking-tight">
        <Image src="/logo-nexo-mark.png" alt="Nexo" width={32} height={32} className="size-8" priority />
        <span>Nexo</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 py-2">
        {DASHBOARD_NAV.map((item) => {
          const isActive =
            item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          const children = "children" in item ? item.children : undefined;

          return (
            <div key={item.href}>
              <Link
                href={children ? children[0].href : item.href}
                onClick={children ? undefined : onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>

              {children && isActive && (
                <div className="mt-1 ml-4 flex flex-col gap-1 border-l border-border pl-3">
                  {children.map((child) => {
                    // El grupo "Sitio web" reutiliza el href del padre como
                    // uno de sus propios hijos ("Apariencia y SEO" vive en
                    // /dashboard/sitio, la misma página que representa el
                    // grupo) — con solo startsWith(), /dashboard/sitio/galeria
                    // también matchea contra ESE hijo (es un prefijo real de
                    // su propio path), marcando dos entradas activas a la
                    // vez. Ese hijo en particular solo puede matchear exacto;
                    // el resto sigue aceptando sub-rutas propias si algún día
                    // las tuvieran.
                    const isChildActive =
                      pathname === child.href || (child.href !== item.href && pathname.startsWith(child.href));

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                          isChildActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <child.icon className="size-3.5" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
