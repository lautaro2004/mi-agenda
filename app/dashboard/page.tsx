"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck2, CalendarClock, ListChecks, MessageCircleQuestion, MessageSquare } from "lucide-react";

import { AccountStatusCard } from "@/components/dashboard/account-status-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompletionPercentage } from "@/lib/completion";
import { useOnboarding } from "@/lib/onboarding-store";
import { useWhatsApp } from "@/lib/whatsapp-store";
import { authClient } from "@/lib/auth/auth-client";
import type { WhatsAppConnectionStatus } from "@/lib/types";

const WHATSAPP_STATUS_LABEL: Record<WhatsAppConnectionStatus, string> = {
  disconnected: "No conectado",
  connecting: "Conectando…",
  reconnecting: "Reconectando…",
  connected: "Conectado",
  error: "Error",
};

function useTurnoStats() {
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [nextTime, setNextTime] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/appointments?stats=1")
      .then((r) => r.json())
      .then((data: { todayCount?: number; upcoming?: { startTime?: string } | null }) => {
        setTodayCount(data.todayCount ?? 0);
        setNextTime(data.upcoming?.startTime ?? null);
      })
      .catch(() => {
        setTodayCount(0);
      });
  }, []);

  return { todayCount, nextTime };
}

export default function DashboardPage() {
  const { state, hydrated } = useOnboarding();
  const { state: whatsapp, loading: whatsappLoading } = useWhatsApp();
  const { data: session } = authClient.useSession();
  const { business, services, faqs, schedule, subscription } = state;
  const { todayCount, nextTime } = useTurnoStats();

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
          subscriptionStatus={subscription.status}
          configIncomplete={configIncomplete}
          completionPercentage={completionPercentage}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
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
          value={whatsappLoading ? "…" : WHATSAPP_STATUS_LABEL[whatsapp.connection.status]}
          description={whatsapp.connection.phoneNumber ?? undefined}
          href="/dashboard/whatsapp/conexion"
        />
      </motion.div>
    </div>
  );
}
