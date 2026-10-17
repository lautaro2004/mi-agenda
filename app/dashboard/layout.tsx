import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { VerifyEmailBanner } from "@/components/dashboard/verify-email-banner";
import { auth } from "@/lib/auth/auth";
import { isSuperadminEmail } from "@/lib/auth/superadmin";
import { prisma } from "@/lib/prisma";
import { BusinessRoleProvider } from "@/lib/business-role";
import { normalizeRole } from "@/modules/business/current";

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
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    select: { role: true, products: true, business: { select: { name: true } } },
  });
  if (memberships.length === 0 && isSuperadminEmail(session.user.email)) {
    redirect("/superadmin");
  }

  // Empleado invitado desde Nodo SIN acceso a Nexo: no se le muestra el
  // dashboard (las rutas de API ya no le resuelven negocio, ver
  // modules/business/current.ts). Nada cambia para dueños: su Membership
  // tiene products = ['nexo','crm'] por default.
  const nexoMembership = memberships.find((m) => m.products.includes("nexo"));
  if (memberships.length > 0 && !nexoMembership) {
    return <NoNexoAccess businessName={memberships[0].business.name} />;
  }
  const role = normalizeRole(nexoMembership?.role ?? "owner");

  return (
    <BusinessRoleProvider role={role}>
    <div className="flex h-screen flex-1 overflow-hidden">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-card px-3 lg:flex">
        <SidebarNav />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardTopbar />
        {!session.user.emailVerified && <VerifyEmailBanner email={session.user.email} />}
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
    </BusinessRoleProvider>
  );
}

function NoNexoAccess({ businessName }: { businessName: string }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">No tenés acceso a Nexo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu usuario es parte de <strong>{businessName}</strong>, pero el dueño no te habilitó Nexo. Pedile que te dé acceso desde
          Nodo → Configuración → Equipo.
        </p>
      </div>
    </main>
  );
}
