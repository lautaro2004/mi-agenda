-- ============================================================================
-- 99 — Rollback manual. Solo si tras aplicar 02/03 la app se comporta mal.
-- ============================================================================

-- Deshacer 02 (RLS): vuelve al estado anterior (tablas abiertas a la Data API
-- si siguen expuestas — usar solo como medida de emergencia).
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables
           where schemaname in ('public', 'nexo', 'crm') and tableowner = current_user
  loop
    execute format('alter table %I.%I disable row level security', r.schemaname, r.tablename);
  end loop;
end $$;

-- Deshacer 03 (privilegios): restaura los grants por defecto de Supabase.
-- grant all on all tables in schema public to anon, authenticated;
-- grant all on all sequences in schema public to anon, authenticated;
-- (repetir para nexo y crm si se habían revocado)

-- Deshacer el event trigger opcional:
-- drop event trigger if exists enable_rls_on_new_tables;
-- drop function if exists public.enable_rls_on_new_tables();
