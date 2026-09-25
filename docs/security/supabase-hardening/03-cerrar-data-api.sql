-- ============================================================================
-- 03 — Capa A: quitar acceso de anon/authenticated a las tablas.
--
-- NO ESTÁ APLICADO y NO DEBE APLICARSE MIENTRAS EL KEEPALIVE SIGA USANDO LA
-- DATA API: .github/workflows/keepalive.yml consulta /rest/v1/Plan con la anon
-- key, y después de este script ese ping devuelve 401/403 y el workflow falla.
-- Aplicar solo cuando el keepalive ya no dependa de la anon key.
--
-- Además de este SQL, en el dashboard: Settings → API → "Exposed schemas":
-- sacar public, nexo y crm (o desactivar la Data API). Eso no se hace por SQL.
--
-- No afecta a Prisma (rol postgres), ni a Storage (service role, otra API), ni
-- a Better Auth (que usa Prisma, no la Data API).
-- ============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'nexo') then
    execute 'revoke all on all tables in schema nexo from anon, authenticated';
    execute 'revoke all on all sequences in schema nexo from anon, authenticated';
  end if;
  if exists (select 1 from pg_namespace where nspname = 'crm') then
    execute 'revoke all on all tables in schema crm from anon, authenticated';
    execute 'revoke all on all sequences in schema crm from anon, authenticated';
  end if;
end $$;

-- Que las tablas futuras creadas por postgres tampoco hereden grants.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema nexo revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema nexo revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema crm revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema crm revoke all on sequences from anon, authenticated;

-- Se deja intacto USAGE sobre los schemas y los grants sobre funciones a
-- propósito: tocarlos puede afectar extensiones de Supabase y no es necesario
-- para que las tablas queden inaccesibles.
