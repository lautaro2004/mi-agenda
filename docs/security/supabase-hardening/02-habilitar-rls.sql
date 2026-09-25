-- ============================================================================
-- 02 — Capa B: RLS habilitado (deny-all, SIN policies) en public, nexo y crm.
--
-- NO ESTÁ APLICADO. Ejecutar a mano, en el SQL Editor, con un backup previo.
--
-- Por qué es seguro para Nexo/CRM: Prisma conecta como el rol `postgres`
-- (BYPASSRLS y dueño de las tablas), así que sigue viendo todo. NO se usa
-- FORCE ROW LEVEL SECURITY a propósito (con FORCE el dueño también quedaría
-- sujeto a RLS y la app se quedaría sin datos).
--
-- Por qué NO rompe el keepalive: no revoca privilegios ni cambia schemas
-- expuestos. Para anon el efecto es "0 filas" (HTTP 200 con []), no un error.
-- (Si `nexo` no está expuesto, el ping a /rest/v1/Plan ya falla hoy con 404;
-- este script no cambia eso.)
--
-- Idempotente: se puede correr más de una vez. Cubre también las tablas que
-- se creen en el futuro SI se vuelve a correr (o con el event trigger de abajo).
-- ============================================================================

-- Guarda: abortar si postgres NO ignora RLS (dejaría a la app sin datos).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'postgres' and rolbypassrls) then
    raise exception 'El rol postgres no tiene BYPASSRLS: abortado, revisar antes de habilitar RLS.';
  end if;
end $$;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, tableowner
    from pg_tables
    where schemaname in ('public', 'nexo', 'crm')
  loop
    if r.tableowner <> current_user then
      raise notice 'OMITIDA %.% (dueño: %, no % — revisar a mano)', r.schemaname, r.tablename, r.tableowner, current_user;
      continue;
    end if;
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;

-- Resultado esperado: rls = true en todas las tablas y cero policies.
select n.nspname as schema, c.relname as tabla, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public', 'nexo', 'crm') and not c.relrowsecurity;
-- (esta última consulta debería devolver 0 filas)

-- ----------------------------------------------------------------------------
-- OPCIONAL — que las tablas nuevas (Prisma migrate) nazcan con RLS activado.
-- Sin esto, cada migración que cree una tabla debe incluir su propio
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. No verificado en este
-- proyecto: probar primero y confirmar que `prisma migrate deploy` sigue OK.
-- ----------------------------------------------------------------------------
-- create or replace function public.enable_rls_on_new_tables() returns event_trigger
-- language plpgsql as $fn$
-- declare obj record;
-- begin
--   for obj in select * from pg_event_trigger_ddl_commands()
--     where command_tag = 'CREATE TABLE' and schema_name in ('public', 'nexo', 'crm')
--   loop
--     execute format('alter table %s enable row level security', obj.object_identity);
--   end loop;
-- end $fn$;
-- create event trigger enable_rls_on_new_tables on ddl_command_end
--   when tag in ('CREATE TABLE') execute function public.enable_rls_on_new_tables();
