"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  CalendarCheck2,
  CalendarClock,
  CreditCard,
  ExternalLink,
  Globe,
  GraduationCap,
  ListChecks,
  MessageCircleQuestion,
  MessageSquare,
  Store,
} from "lucide-react";

import { AccountStatusCard } from "@/components/dashboard/account-status-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompletionPercentage } from "@/lib/completion";
import { useOnboarding } from "@/lib/onboarding-store";
import { useBusinessSubscription } from "@/lib/subscription-client";
import { useWhatsApp } from "@/lib/whatsapp-store";
import { authClient } from "@/lib/auth/auth-client";
import type { BillingSubscriptionStatus, WhatsAppConnectionStatus } from "@/lib/types";

const WHATSAPP_STATUS_LABEL: Record<WhatsAppConnectionStatus, string> = {
  disconnected: "No conectado",
  connecting: "Conectando…",
  reconnecting: "Reconectando…",
  connected: "Conectado",
  error: "Error",
};

const SUBSCRIPTION_STATUS_LABEL: Record<BillingSubscriptionStatus, string> = {
  trialing: "Prueba gratuita",
  active: "Activo",
  past_due: "Pago pendiente",
  canceled: "Cancelado",
  expired: "Vencido",
};

function useTurnoStats() {
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [nextTime, setNextTime] = useState<string | null>(null);
  const [pendingPaymentReview, setPendingPaymentReview] = useState<number>(0);

  useEffect(() => {
    fetch("/api/appointments?stats=1")
      .then((r) => r.json())
      .then((data: { todayCount?: number; upcoming?: { startTime?: string } | null; pendingPaymentReview?: number }) => {
        setTodayCount(data.todayCount ?? 0);
        setNextTime(data.upcoming?.startTime ?? null);
        setPendingPaymentReview(data.pendingPaymentReview ?? 0);
      })
      .catch(() => {
        setTodayCount(0);
      });
  }, []);

  return { todayCount, nextTime, pendingPaymentReview };
}

export default function DashboardPage() {
  const { state, hydrated } = useOnboarding();
  const { state: whatsapp, loading: whatsappLoading } = useWhatsApp();
  const { data: session } = authClient.useSession();
  const { business, services, faqs, schedule } = state;
  const { todayCount, nextTime, pendingPaymentReview } = useTurnoStats();
  const { data: subscriptionData } = useBusinessSubscription();

  const configIncomplete = !business.name || !business.category || services.length === 0;
  const scheduledDays = schedule.filter((day) => day.enabled).length;
  const completionPercentage = getCompletionPercentage(state);
  const firstName = session?.user?.name?.split(" ")[0];

  // Ni el % de configuración ni los contadores de servicios/FAQ/horarios son
  // reales hasta que OnboardingProvider terminó su fetch inicial — antes de
  // eso "0 servicios" o "0% configurado" es simplemente el estado que no
  // cargó todavía, no la realidad del negocio. Ver loading !== empty.
  if (!hydrated) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hola 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este es el resumen de la configuración de tu negocio.
          </p>
        </div>
        <Skeleton className="h-[164px] rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[92px] rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Hola{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Este es el resumen de la configuración de tu negocio.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <AccountStatusCard
          business={business}
          subscriptionStatus={subscriptionData?.subscription?.status ?? null}
          configIncomplete={configIncomplete}
          completionPercentage={completionPercentage}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <StatCard
          icon={CreditCard}
          label="Plan"
          value={subscriptionData?.subscription?.plan.name ?? "—"}
          description={
            subscriptionData?.subscription ? SUBSCRIPTION_STATUS_LABEL[subscriptionData.subscription.status] : undefined
          }
          href="/dashboard/suscripcion"
        />
        <StatCard
          icon={Bot}
          label="Uso de IA"
          value={
            subscriptionData?.subscription
              ? `${subscriptionData.aiUsage.requests} / ${subscriptionData.subscription.plan.aiCredits}`
              : "—"
          }
          description="Respuestas este período"
          href="/dashboard/suscripcion"
        />
        <StatCard
          icon={Globe}
          label="Sitio"
          value={business.slug ? "Publicado" : "No publicado"}
          description={business.slug ? `/s/${business.slug}` : "Todavía sin generar"}
          href="/dashboard/sitio"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h3 className="text-sm font-semibold text-foreground">Acciones rápidas</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" render={<Link href="/dashboard/negocio" />} nativeButton={false}>
            <Store className="size-4" data-icon="inline-start" />
            Configurar negocio
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/dashboard/ai-studio/training" />} nativeButton={false}>
            <GraduationCap className="size-4" data-icon="inline-start" />
            Entrenar asistente
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/dashboard/sitio" />} nativeButton={false}>
            <Globe className="size-4" data-icon="inline-start" />
            Editar sitio
          </Button>
          {business.slug ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/s/${business.slug}`} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink className="size-4" data-icon="inline-start" />
              Ver sitio
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              <ExternalLink className="size-4" data-icon="inline-start" />
              Ver sitio
            </Button>
          )}
        </div>
      </motion.div>

      {business.depositRequired && pendingPaymentReview > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.09 }}
          className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                🔴 Hay {pendingPaymentReview} {pendingPaymentReview === 1 ? "comprobante" : "comprobantes"} para
                revisar
              </p>
              <p className="text-xs text-muted-foreground">Pagos pendientes de validar: {pendingPaymentReview}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" render={<Link href="/dashboard/turnos" />} nativeButton={false}>
            Revisar ahora
          </Button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <StatCard
          icon={ListChecks}
          label="Servicios configurados"
          value={String(services.length)}
          href="/dashboard/servicios"
        />
        <StatCard
          icon={MessageCircleQuestion}
          label="Preguntas frecuentes"
          value={String(faqs.length)}
          href="/dashboard/preguntas-frecuentes"
        />
        <StatCard
          icon={CalendarClock}
          label="Días con horario activo"
          value={`${scheduledDays} / 7`}
          href="/dashboard/horarios"
        />
        <StatCard
          icon={CalendarCheck2}
          label="Turnos hoy"
          value={todayCount !== null ? String(todayCount) : "—"}
          description={nextTime ? `Próximo: ${nextTime}` : undefined}
          href="/dashboard/turnos"
        />
        <StatCard
          icon={MessageSquare}
          label="WhatsApp"
          value={whatsappLoading || !whatsapp.connection ? "…" : WHATSAPP_STATUS_LABEL[whatsapp.connection.status]}
          description={whatsapp.connection?.phoneNumber ?? undefined}
          href="/dashboard/whatsapp/conexion"
        />
      </motion.div>
    </div>
  );
}
