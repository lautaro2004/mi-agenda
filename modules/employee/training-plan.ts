import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { TrainingPlan, TrainingPlanSectionStatus } from "@/lib/types";
import type { TrainingPlanGenerationValues } from "@/lib/schemas";

// db opcional (default prisma) en las funciones que applyTrainingProposal()
// necesita encadenar dentro de UNA sola transacción — ver
// modules/employee/training/proposal.ts. Mismo patrón que ya usan
// modules/business/service.ts y modules/employee/memory.ts.
type Db = Prisma.TransactionClient;

function toClientPlan(row: {
  id: string;
  businessId: string;
  category: string;
  generatedAt: Date;
  updatedAt: Date;
  sections: {
    id: string;
    key: string;
    title: string;
    description: string;
    status: string;
    order: number;
  }[];
}): TrainingPlan {
  return {
    id: row.id,
    businessId: row.businessId,
    category: row.category,
    generatedAt: row.generatedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sections: row.sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        key: s.key,
        title: s.title,
        description: s.description,
        status: s.status as TrainingPlanSectionStatus,
        order: s.order,
      })),
  };
}

// section.key es la única fuente de verdad para identificar una sección —
// nunca se compara por título. Esto la normaliza a un slug estable para que
// variaciones de mayúsculas/acentos que proponga la IA ("Filosofía y
// Valores" vs "filosofia y valores") resuelvan siempre a la misma key.
function normalizeSectionKey(raw: string): string {
  const slug = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.slice(0, 60) || "seccion";
}

const TITLE_STOP_WORDS = new Set(["y", "de", "del", "la", "el", "los", "las", "en", "con", "para", "su", "sus"]);

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !TITLE_STOP_WORDS.has(w))
  );
}

// Heurística para atrapar duplicados con keys distintas pero el mismo tema
// (ej. "Casos de éxito" vs "Portfolio y Casos de Éxito"): si la mayoría de
// las palabras relevantes del título más corto están en el más largo, se
// consideran el mismo tema.
function isSimilarTitle(a: string, b: string): boolean {
  const wa = titleWords(a);
  const wb = titleWords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  const [smaller, larger] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  const overlap = [...smaller].filter((w) => larger.has(w)).length;
  return overlap / smaller.size >= 0.6;
}

interface SectionCandidate {
  key: string;
  title: string;
  description: string;
}

// Reutilizada tanto al generar el plan por primera vez como al sumar
// secciones a uno existente: descarta cualquier sección propuesta que ya
// esté cubierta (por key normalizada o por similitud de título) en vez de
// crear un duplicado.
function dedupeSections(
  candidates: TrainingPlanGenerationValues["sections"],
  existing: { key: string; title: string }[]
): SectionCandidate[] {
  const known = existing.map((s) => ({ key: s.key, title: s.title }));
  const result: SectionCandidate[] = [];

  for (const candidate of candidates) {
    const key = normalizeSectionKey(candidate.key);
    const isDuplicate = known.some((k) => k.key === key || isSimilarTitle(k.title, candidate.title));
    if (isDuplicate) continue;

    const entry = { key, title: candidate.title, description: candidate.description };
    result.push(entry);
    known.push(entry);
  }

  return result;
}

export async function getTrainingPlan(businessId: string): Promise<TrainingPlan | null> {
  const row = await prisma.trainingPlan.findUnique({
    where: { businessId },
    include: { sections: true },
  });
  return row ? toClientPlan(row) : null;
}

// Genera el plan la primera vez. Si ya existe uno, nunca borra progreso:
// solo agrega las secciones nuevas (deduplicadas) que todavía no estuvieran.
export async function generateTrainingPlan(
  businessId: string,
  data: TrainingPlanGenerationValues,
  db: Db = prisma
): Promise<TrainingPlan> {
  const existing = await db.trainingPlan.findUnique({
    where: { businessId },
    include: { sections: true },
  });

  if (!existing) {
    const sections = dedupeSections(data.sections, []);
    const created = await db.trainingPlan.create({
      data: {
        businessId,
        category: data.category,
        sections: { create: sections.map((s, i) => ({ ...s, order: i })) },
      },
      include: { sections: true },
    });
    return toClientPlan(created);
  }

  const newSections = dedupeSections(data.sections, existing.sections);
  const maxOrder = existing.sections.reduce((max, s) => Math.max(max, s.order), -1);

  if (newSections.length > 0) {
    await db.trainingPlanSection.createMany({
      data: newSections.map((s, i) => ({
        planId: existing.id,
        key: s.key,
        title: s.title,
        description: s.description,
        order: maxOrder + 1 + i,
      })),
    });
  }

  const updated = await db.trainingPlan.findUniqueOrThrow({
    where: { id: existing.id },
    include: { sections: true },
  });
  return toClientPlan(updated);
}

export async function setSectionStatus(
  businessId: string,
  key: string,
  status: TrainingPlanSectionStatus,
  db: Db = prisma
): Promise<void> {
  await db.trainingPlanSection.updateMany({
    where: { key: normalizeSectionKey(key), plan: { businessId } },
    data: { status },
  });
}

// El avance de sección no puede depender de que la IA se acuerde de taguear
// cada propuesta con "sectionKey": si no lo hizo, applyTrainingProposal()
// usa esto para inferir cuál sección estaba activa y cerrarla igual.
export async function getActiveSectionKey(businessId: string, db: Db = prisma): Promise<string | null> {
  const plan = await db.trainingPlan.findUnique({
    where: { businessId },
    include: { sections: { where: { status: "in_progress" }, take: 1 } },
  });
  return plan?.sections[0]?.key ?? null;
}

// Escape hatch determinístico para terminar el onboarding: el dueño puede
// decidir "no quiero configurar más por ahora" sin depender de que la IA
// proponga ignorar cada sección restante una por una.
export async function ignoreRemainingSections(businessId: string): Promise<void> {
  await prisma.trainingPlanSection.updateMany({
    where: { plan: { businessId }, status: { in: ["pending", "in_progress"] } },
    data: { status: "ignored" },
  });
}

// Único punto que decide cuál es la "sección activa" (currentSection): si ya
// hay una "in_progress" la deja como está; si no, activa la primera
// "pending" según su orden. No hace nada si no hay plan o no quedan
// secciones pendientes. Se llama al inicio de cada turno del motor de
// entrenamiento (ver runTrainingTurn) — es la garantía determinística de que
// la conversación nunca se queda sin saber de qué hablar.
export async function activateNextPendingSection(businessId: string, db: Db = prisma): Promise<void> {
  const plan = await db.trainingPlan.findUnique({
    where: { businessId },
    include: { sections: true },
  });
  if (!plan) return;

  const alreadyActive = plan.sections.some((s) => s.status === "in_progress");
  if (alreadyActive) return;

  const next = plan.sections
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.order - b.order)[0];
  if (!next) return;

  await db.trainingPlanSection.update({
    where: { id: next.id },
    data: { status: "in_progress" },
  });
}

// A diferencia de activateNextPendingSection() (que sigue el orden
// automático y nunca reemplaza una sección ya activa), esto deja que el
// dueño salte directo a una sección puntual — "pending" o "ignored" — desde
// el dashboard (ver "Completar {sección} →" en TrainingPlanStatus). Cualquier
// otra sección que estuviera "in_progress" vuelve a "pending" (no se pierde,
// sigue disponible para retomarla después).
export async function activateSection(businessId: string, key: string): Promise<void> {
  const normalized = normalizeSectionKey(key);
  await prisma.$transaction([
    prisma.trainingPlanSection.updateMany({
      where: { plan: { businessId }, status: "in_progress" },
      data: { status: "pending" },
    }),
    prisma.trainingPlanSection.updateMany({
      where: { key: normalized, plan: { businessId } },
      data: { status: "in_progress" },
    }),
  ]);
}
