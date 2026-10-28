import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SITE_ASSETS_BUCKET } from "@/lib/site-assets";
import { logAdminAction } from "@/modules/admin/audit";
import { isRemoteWhatsApp, workerFetch } from "@/modules/whatsapp/remote";

// Coincidencia EXACTA (sin distinguir espacios de los bordes) entre lo que
// tipeó el superadmin y el nombre real guardado. Es la única condición que
// habilita el borrado; se evalúa en el servidor.
export function confirmNameMatches(typed: string, actual: string): boolean {
  const expected = actual.trim();
  return expected.length > 0 && typed.trim() === expected;
}

export type DeleteBusinessResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "name_mismatch" | "active_paid_subscription" | "failed"; message: string };

async function collectStoragePaths(prefix: string, depth = 0): Promise<string[]> {
  const storage = getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET);
  const { data, error } = await storage.list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const paths: string[] = [];
  for (const entry of data) {
    // Las carpetas vienen sin id: se recorren (galería anida por bloque).
    if (entry.id === null && depth < 3) paths.push(...(await collectStoragePaths(`${prefix}/${entry.name}`, depth + 1)));
    else if (entry.id !== null) paths.push(`${prefix}/${entry.name}`);
  }
  return paths;
}

// Best-effort: un archivo que no se pudo borrar queda huérfano (el barrido
// periódico lo limpia), nunca impide ni revierte el borrado de la empresa.
async function removeBusinessFiles(businessId: string): Promise<void> {
  try {
    const paths = await collectStoragePaths(businessId);
    if (paths.length === 0) return;
    const { error } = await getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET).remove(paths);
    if (error) console.error("[delete-business] No se pudieron borrar archivos:", error);
  } catch (error) {
    console.error("[delete-business] Error limpiando archivos:", error);
  }
}

async function disconnectWhatsapp(businessId: string): Promise<void> {
  if (!isRemoteWhatsApp()) return;
  try {
    await workerFetch(businessId, "/disconnect", { method: "POST" });
  } catch (error) {
    console.error("[delete-business] No se pudo desconectar WhatsApp:", error);
  }
}

// Borrado definitivo de una empresa de prueba. Los datos del negocio caen en
// cascada por las relaciones de la base; las cuentas de usuario (login) NO se
// borran, solo su membresía. Se niega si hay una suscripción paga vigente en
// Mercado Pago: primero hay que cancelarla para no dejar un cobro huérfano.
export async function deleteBusinessForAdmin(input: {
  businessId: string;
  confirmName: string;
  actorEmail: string;
}): Promise<DeleteBusinessResult> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, name: true, slug: true },
  });
  if (!business) return { ok: false, error: "not_found", message: "Empresa no encontrada." };

  if (!confirmNameMatches(input.confirmName, business.name)) {
    return { ok: false, error: "name_mismatch", message: "El nombre no coincide. No se borró nada." };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { businessId: business.id },
    select: { provider: true, providerSubscriptionId: true, mercadoPagoStatus: true, planId: true, status: true },
  });
  if (
    subscription?.provider === "mercadopago" &&
    subscription.providerSubscriptionId &&
    subscription.mercadoPagoStatus !== "cancelled"
  ) {
    return {
      ok: false,
      error: "active_paid_subscription",
      message: "Tiene una suscripción de Mercado Pago vigente. Cancelala primero para no dejar un cobro activo.",
    };
  }

  const owners = await prisma.membership.findMany({
    where: { businessId: business.id, role: "owner" },
    select: { userId: true },
  });

  await disconnectWhatsapp(business.id);

  try {
    await prisma.business.delete({ where: { id: business.id } });
  } catch (error) {
    console.error("[delete-business] No se pudo borrar la empresa:", error);
    return {
      ok: false,
      error: "failed",
      message: "No pudimos borrar la empresa: tiene datos vinculados que lo impiden. No se borró nada.",
    };
  }

  await removeBusinessFiles(business.id);
  await logAdminAction({
    actorEmail: input.actorEmail,
    action: "business.delete",
    entityType: "business",
    entityId: business.id,
    before: { name: business.name, slug: business.slug, planId: subscription?.planId ?? null, ownerUserIds: owners.map((o) => o.userId) },
  });

  return { ok: true };
}
