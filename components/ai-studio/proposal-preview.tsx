"use client";

import { BookOpen, Briefcase, CircleHelp, ListChecks, Settings2, Sparkles, Target, Ban, Building2 } from "lucide-react";

import { formatPrice } from "@/lib/currency";
import type { TrainingProposal } from "@/modules/employee/training/proposal";

// Muestra QUÉ se va a guardar antes de que el dueño confirme. Antes la
// tarjeta de "Propuesta" mostraba solo el resumen que escribía la IA ("Armé
// el plan de entrenamiento…"), así que se confirmaba a ciegas: no se veían
// los temas del plan, ni los servicios/precios, ni las preguntas frecuentes
// que se iban a crear.

interface Line {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail?: string;
}

const MAX_DETAIL = 140;
const clip = (text: string | undefined | null) => (text && text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL - 1)}…` : (text ?? undefined));

export function describeProposal(proposal: TrainingProposal): { heading: string; lines: Line[] } {
  if (proposal.kind === "training_plan") {
    return {
      heading: `Plan para ${proposal.data.category} · ${proposal.data.sections.length} temas`,
      lines: proposal.data.sections.map((s) => ({ icon: ListChecks, title: s.title, detail: clip(s.description) })),
    };
  }
  if (proposal.kind === "training_plan_section") {
    return {
      heading: proposal.data.status === "ignored" ? "Dejar este tema para después" : "Marcar tema como completo",
      lines: [],
    };
  }
  const lines: Line[] = proposal.items.map((item): Line => {
    switch (item.kind) {
      case "service": {
        const parts = [
          item.data.price ? formatPrice(item.data.price) : "Sin precio",
          item.data.durationMinutes ? `${item.data.durationMinutes} min` : null,
        ].filter(Boolean);
        return { icon: Briefcase, title: `Servicio: ${item.data.name}`, detail: [parts.join(" · "), clip(item.data.description)].filter(Boolean).join(" — ") };
      }
      case "faq":
        return { icon: CircleHelp, title: item.data.question, detail: clip(item.data.answer) };
      case "business": {
        const fields = Object.entries(item.data).filter(([, v]) => v !== undefined && v !== "");
        return { icon: Building2, title: "Datos del negocio", detail: clip(fields.map(([, v]) => String(v)).join(" · ")) };
      }
      case "employee_profile":
        return { icon: Sparkles, title: "Personalidad del empleado", detail: clip(item.data.name ?? item.data.description ?? undefined) };
      case "employee_goal":
        return { icon: Target, title: "Objetivo", detail: clip(item.data.text) };
      case "employee_restriction":
        return { icon: Ban, title: "Restricción", detail: clip(item.data.text) };
      case "employee_capability":
        return { icon: Settings2, title: `${item.data.enabled ? "Activar" : "Desactivar"} función`, detail: item.data.key };
      case "memory_entry":
        return { icon: BookOpen, title: item.data.title, detail: clip(item.data.content) };
    }
  });
  const count = proposal.items.length;
  return { heading: `${count} ${count === 1 ? "dato" : "datos"} para guardar`, lines };
}

export function ProposalPreview({ proposal }: { proposal: TrainingProposal }) {
  const { heading, lines } = describeProposal(proposal);
  if (lines.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground">{heading}</p>
      <ul className="mt-1.5 max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2 rounded-lg bg-background/70 px-2.5 py-1.5 text-sm">
            <line.icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block font-medium text-foreground">{line.title}</span>
              {line.detail && <span className="block text-xs text-muted-foreground">{line.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
