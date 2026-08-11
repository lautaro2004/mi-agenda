import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var __supabaseAdmin: SupabaseClient | undefined;
}

// Cliente server-only con la service role key: bypassa RLS de Storage a
// propósito. Es seguro porque todas las operaciones de escritura
// (upload/replace/delete) están protegidas ANTES de llegar acá — ver
// modules/business/assets.ts, que siempre resuelve el businessId desde la
// sesión (getCurrentBusinessId), nunca desde un valor enviado por el
// cliente. Nunca importar este módulo desde código que corre en el browser.
function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage no está configurado (faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

// Lazy singleton, mismo patrón que lib/prisma.ts: evita crear el cliente en
// build time (cuando las env vars pueden no estar disponibles) y lo reusa
// entre invocaciones "warm" del mismo contenedor serverless.
export function getSupabaseAdmin(): SupabaseClient {
  if (!globalThis.__supabaseAdmin) {
    globalThis.__supabaseAdmin = createSupabaseAdmin();
  }
  return globalThis.__supabaseAdmin;
}
