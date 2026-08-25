import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { auth } from "@/lib/auth/auth";
import { isSuperadminEmail } from "@/lib/auth/superadmin";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  // Un Superadmin no necesita (ni debería necesitar) crear un Business para
  // usar la plataforma — ver sección 2 del pedido. Si todavía no tiene
  // ninguna Membership y es superadmin, va directo a su panel real en vez
  // de quedar parado en un dashboard de negocio vacío. Usuarios normales sin
  // negocio (caso legacy/en progreso) siguen viendo el dashboard igual que
  // hoy — nada cambia para ellos.
  const membership = await prisma.membership.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!membership && isSuperadminEmail(session.user.email)) {
    redirect("/superadmin");
  }

  return (
    <div className="flex h-screen flex-1 overflow-hidden">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-card px-3 lg:flex">
        <SidebarNav />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardTopbar />
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
