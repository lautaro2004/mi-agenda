"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { SimulatorChat } from "@/components/ai-studio/simulator-chat";

export default function SimulatorPage() {
  return (
    <div>
      <PageHeader
        title="Simulador"
        description="Probá a tu empleado como si fueras un cliente, antes de que hable con clientes reales. Usa el mismo motor que WhatsApp; nada de lo que pase acá se guarda salvo que vos lo confirmes."
      />

      <div className="rounded-2xl border border-border bg-card p-6">
        <SimulatorChat />
      </div>
    </div>
  );
}
