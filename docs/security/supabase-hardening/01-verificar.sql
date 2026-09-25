-- ============================================================================
-- 01 — Verificación (SOLO LECTURA). Correr en el SQL Editor de Supabase ANTES
-- de aplicar 02, y de nuevo DESPUÉS para comparar. No modifica nada.
-- ============================================================================

-- 1) ¿El rol postgres ignora RLS? (debe dar rolbypassrls = true)
select rolname, rolbypassrls, rolsuper
from pg_roles
where rolname in ('postgres', 'anon', 'authenticated', 'service_role');

-- 2) Schemas expuestos a la Data API (buscar pgrst.db_schemas en rolconfig)
select rolname, rolconfig from pg_roles where rolname = 'authenticator';

-- 3) Estado de RLS y dueño de cada tabla
select n.nspname as schema, c.relname as tabla, pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity as rls, c.relforcerowsecurity as forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public', 'nexo', 'crm')
order by 1, 2;

-- 4) Privilegios de anon / authenticated sobre tablas
select table_schema, table_name, grantee, string_agg(privilege_type, ',') as privs
from information_schema.role_table_grants
where grantee in ('anon', 'authenticated') and table_schema in ('public', 'nexo', 'crm')
group by 1, 2, 3
order by 1, 2;

-- 5) Policies existentes (se espera 0 hoy)
select schemaname, tablename, policyname from pg_policies
where schemaname in ('public', 'nexo', 'crm');

-- 6) Conexiones activas por rol (confirma con qué rol entra Prisma)
select usename, count(*) from pg_stat_activity
where datname = current_database() group by 1 order by 2 desc;
