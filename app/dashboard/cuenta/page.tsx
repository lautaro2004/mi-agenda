"use client";

import Link from "next/link";
import { Building2, Calendar, Mail, MessageSquare, Store, User } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboarding } from "@/lib/onboarding-store";
import { authClient } from "@/lib/auth/auth-client";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" });

// Página de solo lectura a propósito — todo lo que muestra ya existe en
// otro lado (business en OnboardingProvider, sesión en better-auth): esto
// no duplica ninguna consulta, solo junta esos datos en una vista simple.
// Editar el negocio sigue siendo /dashboard/negocio; acá no hay formulario.
export default function MyAccountPage() {
  const { state, hydrated } = useOnboarding();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { business } = state;

  const loading = !hydrated || sessionPending;

  return (
    <div>
      <PageHeader title="Mi cuenta" description="Información de tu usuario y del negocio asociado." />

      {loading ? (
        <div className="max-w-xl space-y-4">
          <Skeleton className="h-[280px] rounded-2xl" />
        </div>
      ) : (
        <div className="max-w-xl rounded-2xl border border-border bg-card p-6">
          <dl className="space-y-4 text-sm">
            <Row icon={User} label="Nombre" value={session?.user?.name ?? "—"} />
            <Row icon={Mail} label="Email" value={session?.user?.email ?? "—"} />
            <Row icon={Building2} label="Negocio asociado" value={business.name || "Sin definir"} />
            <Row icon={Store} label="Rubro" value={business.category || "Sin definir"} />
            <Row icon={MessageSquare} label="WhatsApp configurado" value={business.whatsappNumber || "No configurado"} />
            <Row
              icon={Calendar}
              label="Fecha de alta"
              value={session?.user?.createdAt ? dateFormatter.format(new Date(session.user.createdAt)) : "—"}
            />
          </dl>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button size="sm" variant="outline" render={<Link href="/dashboard/negocio" />} nativeButton={false}>
              Editar datos del negocio
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/dashboard/suscripcion" />} nativeButton={false}>
              Ver suscripción
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
