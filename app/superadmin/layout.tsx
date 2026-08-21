import { redirect } from "next/navigation";

import { SuperadminSidebar } from "@/components/superadmin/superadmin-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSuperadminSession } from "@/lib/auth/superadmin";

// Gate server-side real, no solo un link oculto: si no hay sesión o la
// sesión no está en el allowlist de SUPERADMIN_EMAILS, ni siquiera se llega
// a renderizar el shell. Cada ruta bajo app/api/superadmin/* repite este
// mismo chequeo de forma independiente (ver lib/auth/superadmin.ts) — este
// layout es defensa en profundidad para la UI, no el único punto de control.
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSuperadminSession();

  if (!admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen flex-1 overflow-hidden">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-card px-3 lg:flex">
        <SuperadminSidebar />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            Conectado como <span className="font-medium text-foreground">{admin.email}</span>
          </p>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
