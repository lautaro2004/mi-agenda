# Informe de seguridad — Supabase Security Advisor / RLS (Nexo)

**Estado:** solo análisis. No se modificó schema, no se habilitó RLS, no se generaron migraciones, no se ejecutó ninguna query contra la base. Todo lo de abajo sale de leer el repo (`nexo/` y `crm/`); lo que **no** se puede saber desde el código está marcado como **[VERIFICAR]** con la query para comprobarlo.

Fecha: 2026-09-24. Base: proyecto Supabase `ljmrsb…` (compartido por Nexo y CRM; `docs/architecture/migracion-schemas-fase3.md` confirma que es la base real, con datos reales, sin staging y sin backup/PITR configurado).

---

## 1. Respuestas a las 10 preguntas

### 1. Cómo se conecta Nexo a PostgreSQL
- Prisma 7 con `@prisma/adapter-pg` (driver `pg`), ver [lib/prisma.ts](../../lib/prisma.ts). Pool de 5 conexiones, singleton lazy.
- Runtime: `DATABASE_URL` → Supavisor **transaction pooler** (`aws-0-ca-central-1.pooler.supabase.com:6543`), usuario `postgres.<project-ref>`.
- CLI (migrate/generate): `DIRECT_URL` → **session pooler** (puerto 5432), ver [prisma.config.ts](../../prisma.config.ts). Nunca se usa en runtime.
- El CRM (`crm/`) usa la misma base con el mismo patrón y las mismas credenciales.

### 2. ¿Prisma server-side o supabase-js desde el frontend?
- **Todos los datos pasan por Prisma en el servidor** (rutas `app/api/**`, Server Components, `modules/**`).
- `@supabase/supabase-js` se usa **únicamente para Storage**, en un solo archivo server-only ([lib/supabase-admin.ts](../../lib/supabase-admin.ts)) con la **service role key**. Consumidores: `lib/site-assets.ts`, `lib/payment-proofs.ts`, `lib/knowledge-documents.ts`, `modules/business/{assets,gallery,...}.ts`. En `crm/`: `lib/supabase-admin.ts` y `modules/tasks/attachments.ts`.
- No hay ningún `createClient` con anon key, ni `.from("<tabla>")`, ni `.rpc()`, ni Realtime, ni Supabase Auth en el código de la app.

### 3. Variables de entorno relacionadas
| Variable | Dónde se usa | Comentario |
|---|---|---|
| `DATABASE_URL` | runtime Prisma (Nexo y CRM) | pooler transaccional, rol `postgres` |
| `DIRECT_URL` | solo Prisma CLI | session pooler |
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase-admin.ts` + `site-assets.ts` (arma URLs públicas de imágenes) | pública por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase-admin.ts` (Storage) | **secreta**, bypassa todo RLS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **declarada en `.env.local`, no referenciada en ningún `.ts/.tsx`** | variable muerta |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Auth (mismo secret en Nexo y CRM) | |
| GitHub secrets `NEXO_SUPABASE_URL` / `NEXO_SUPABASE_KEY` | workflow `keepalive.yml` | **usa la anon key contra la Data API**, ver §3 |

`.env` y `.env.local` están en `.gitignore` (verificado con `git check-ignore`).

### 4. Tablas de Better Auth
Todas en schema `public`, mapeadas a minúsculas:
`user`, `session`, `account`, `verification`. Better Auth corre con `prismaAdapter` (`lib/auth/auth.ts`), email+password, **sin** plugin de organizaciones. `Membership` **no** es de Better Auth: es la tabla propia de Nexo que une `user` ↔ `Business` (lo que el Advisor lista como "Member" es `Membership`; en el schema no existe ninguna tabla `Member`). `_prisma_migrations` (el Advisor la muestra como `__prisma_migrations`) es de Prisma.

### 5. Tablas propias de Nexo
- **Schema `nexo` (26 tablas)**: Inquiry, BusinessNotification, GalleryBlock, GalleryImage, SeoConfig, Service, Resource, ServiceResource, Schedule, FAQ, MemoryEntry, TrainingPlan, TrainingPlanSection, TrainingConversation, TrainingMessage, Appointment, PaymentProof, Employee, EmployeeGoal, EmployeeRestriction, EmployeeCapability, AiUsageEvent, Plan, Subscription, MercadoPagoWebhookEvent, PromoCode, PromoCodeRedemption.
- **Schema `public` compartido / plataforma**: `Business` (entidad raíz del tenant, compartida con el CRM), `Membership`, `Lead` (pipeline comercial de Kodexa, landing → Superadmin).
- **Schema `crm` (~25 tablas, app aparte pero misma base)**: Workspace, Company, Contact, Lead, Opportunity, Task, TaskAttachment, EmailSettings, etc. Toda tabla `crm.*` cuelga de `Workspace.businessId`.

### 6. ¿Algo consulta Supabase directamente (API/Action/client component)?
**No para datos.** Solo Storage con service role, desde código servidor. Ninguna de las ~132 files con `"use client"` importa `supabase-admin`; el navegador llama a `/api/*` propias. Única excepción de infraestructura: el workflow de GitHub `keepalive.yml`, que hace `GET {URL}/rest/v1/Plan?select=id&limit=1` con la anon key (Data API / PostgREST).

### 7. Rol de PostgreSQL que usa Prisma
`postgres.<project-ref>` vía Supavisor, o sea el rol **`postgres`** de Supabase. Ese rol tiene `BYPASSRLS` y es dueño de las tablas creadas por las migraciones de Prisma, por lo que **hoy y después de habilitar RLS Prisma sigue viendo todo** (siempre que no se use `FORCE ROW LEVEL SECURITY`). **[VERIFICAR]** ver §6, query 1.

### 8. ¿Depende la app de la Data API de Supabase?
**La aplicación no. El keepalive sí.** Consecuencias:
- Se puede cerrar la Data API (o dejar de exponer los schemas) sin romper Nexo ni CRM.
- El workflow `keepalive.yml` consulta `/rest/v1/Plan` con la anon key. `Plan` está hoy en el schema `nexo` (Fase 3 ejecutada). Por defecto PostgREST solo expone `public` (y `graphql_public`), así que ese ping devolvería 404 salvo que `nexo` esté en "Exposed schemas". Y si `nexo` **sí** está expuesto, todas las tablas `nexo.*` están sin RLS y leíbles con la anon key (el Advisor lo mostraría; el listado que pegaste dice "y posiblemente otras"). **[VERIFICAR]** query 2 y el último run de Actions.

### 9. Aislamiento multi-tenant por `businessId`
Solo a nivel de aplicación, no en la base:
- `getCurrentBusinessId()` ([modules/business/current.ts](../../modules/business/current.ts)): sesión Better Auth → `Membership.findFirst({ userId })` → `businessId`. Nunca viene del cliente.
- Cada función de `modules/**` recibe `businessId` y lo aplica en el `where` (~320 referencias en `app/api`). Los hijos se resuelven por relación (`block: { businessId }`, etc.). Únicos compuestos `@@unique([businessId, ...])`.
- Superadmin: allowlist de emails en `SUPERADMIN_EMAILS`, fail-closed.
- Público: `/s/[slug]` y `/api/public/[slug]/*` resuelven el negocio por slug; webhooks (`MERCADOPAGO_WEBHOOK_SECRET`, HMAC) y crons (`CRON_SECRET`) con secreto.
- No hay RLS, ni `set_config`, ni rol por tenant. El aislamiento es tan bueno como cada `where` escrito a mano.

### 10. Tablas con información sensible
| Nivel | Tablas | Qué hay |
|---|---|---|
| **Crítico** | `account` | hash de password, access/refresh/id tokens |
| **Crítico** | `session` | `token` de sesión (leerla = secuestrar sesiones), IP, user agent |
| **Crítico** | `verification` | tokens de verificación/reset |
| Alto | `user`, `Membership` | emails, mapa usuario↔negocio |
| Alto | `Lead` (public), `Inquiry`, `Appointment`, `crm.Contact/Lead/...` | nombre, WhatsApp, email, mensajes, notas internas de ventas (datos personales de terceros) |
| Alto | `Business` | CBU, alias, CUIT, titular (`deposit*`) — datos bancarios |
| Alto | `PaymentProof` | paths a comprobantes de pago (los archivos están en bucket privado) |
| Medio | `Subscription`, `PromoCode`, `PromoCodeRedemption`, `MercadoPagoWebhookEvent`, `Plan` | billing, ids de Mercado Pago |
| Medio | `MemoryEntry`, `TrainingMessage`, `TrainingConversation`, `Employee*`, `AiUsageEvent` | conocimiento del negocio, transcripciones, consumo de IA |
| Bajo/infra | `_prisma_migrations` | historial de migraciones |

---

## 2. Findings de Supabase: cuáles importan de verdad

| Finding | ¿Relevante? | Por qué |
|---|---|---|
| RLS Disabled in Public — `user`, `session`, `account`, `verification`, `Membership`, `Business`, `Lead`, `_prisma_migrations` | **Sí, crítico** | Con RLS apagado y `anon`/`authenticated` con grants por defecto en `public`, cualquiera con la anon key (JWT "público" por diseño; ya existe como secret de GitHub y en `.env.local`) puede leer **y escribir** vía `/rest/v1/*`. Eso incluye `session.token` (takeover de cuentas), hashes de `account` y datos de leads. La app no usa la Data API, así que esta exposición **no aporta nada y solo es riesgo**. |
| Sensitive Columns Exposed — `account`, `session` | **Sí, mismo problema** | Es la consecuencia de lo anterior; se resuelve con lo mismo. |
| `_prisma_migrations` | Sí, menor | Sin datos sensibles, pero permite borrar/alterar historial vía API. |
| Tablas de `nexo` / `crm` | **[VERIFICAR]** | Solo son riesgo si esos schemas están en "Exposed schemas". Si lo están, son igual de críticos. |

**Nota de honestidad sobre el riesgo real hoy:** que estas tablas estén "abiertas" requiere conocer la anon key. La app no la embebe en el bundle (no está referenciada), pero está en GitHub Secrets, en `.env.local` y es trivial de obtener desde el dashboard. Además el project ref es público (aparece en las URLs de Storage). Tratalo como vulnerabilidad real, no teórica. No puedo saber desde el repo si hubo accesos previos: revisá los logs de API de Supabase (§5, paso 0).

---

## 3. Qué se resuelve sin RLS, qué debe tener RLS

Como la base **solo** se usa por Prisma (rol `postgres`) y Storage (service role), existen dos capas independientes. Recomiendo **las dos**, porque cada una cubre el fallo de la otra:

**Capa A — Sacar las tablas de la Data API (no requiere RLS ni policies)**
1. Dashboard → Settings → API → **Exposed schemas**: dejar sin `public`, `nexo`, `crm` (o desactivar la Data API completa, opción más simple si no vas a usarla nunca).
2. `REVOKE ALL ON ALL TABLES/SEQUENCES/FUNCTIONS IN SCHEMA public, nexo, crm FROM anon, authenticated;` + `ALTER DEFAULT PRIVILEGES … REVOKE …` para que las tablas futuras tampoco hereden grants.
   - Con esto solo, las tablas dejan de ser accesibles por la API. El Advisor debería dejar de marcarlas porque su lint considera solo los schemas expuestos (**[VERIFICAR]** que el finding desaparece; no lo puedo confirmar desde acá).

**Capa B — RLS habilitado, deny-all, en todas las tablas (defensa en profundidad)**
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY;` **sin ninguna policy** en las ~55 tablas de los tres schemas.
- Sin policies, `anon`/`authenticated` no ven ni escriben nada aunque alguien vuelva a exponer un schema o un grant se restaure por error. Prisma no se entera (BYPASSRLS + dueño).
- Es lo que silencia el finding de forma inequívoca, y protege ante un error humano futuro (alguien expone el schema "un ratito para probar").

**¿Cuáles "deberían tener RLS"?** Todas, en modo deny-all. No hace falta ninguna policy porque **ningún cliente no-servidor debe leer nada**. Las prioridades por sensibilidad: `account`, `session`, `verification`, `user` → `Lead`, `Business`, `Membership` → todo `nexo.*` y `crm.*`.

**¿Cuáles dejar de exponerse por la Data API?** Todas: `public.*`, `nexo.*`, `crm.*`. Ninguna tabla necesita ser visible por PostgREST. (Storage y Auth de Supabase son APIs distintas y no se ven afectadas por "Exposed schemas".)

---

## 4. Policies necesarias para aislar negocios

**Hoy: ninguna.** Deny-all es correcto porque el aislamiento por negocio lo hace el servidor. Escribir policies `business_id = …` no sirve con la arquitectura actual por dos razones concretas:
- Better Auth **no es Supabase Auth**: `auth.uid()` y `auth.jwt()` valen `NULL` para tus usuarios. Una policy `USING (businessId IN (SELECT … WHERE userId = auth.uid()))` no matchea nunca.
- Prisma conecta como `postgres`, que ignora las policies.

**Si más adelante querés RLS como segunda barrera real de tenant** (recomendable a mediano plazo, no ahora), el diseño viable es:
1. Rol dedicado `nexo_app` con `NOBYPASSRLS`, sin ser dueño de las tablas, usado en `DATABASE_URL`. `postgres` queda solo para migraciones (`DIRECT_URL`).
2. Cada request abre una transacción y ejecuta `SELECT set_config('app.business_id', $1, true)` (con `true` = local a la transacción, obligatorio con el pooler transaccional) mediante una extensión de Prisma (`$extends`).
3. Policies tipo:

```sql
-- Tablas con businessId directo (Appointment, Service, Resource, Schedule, FAQ, MemoryEntry,
-- TrainingConversation, PaymentProof, Inquiry, BusinessNotification, GalleryBlock, Subscription,
-- PromoCodeRedemption, SeoConfig, TrainingPlan, Employee, crm.* con businessId ...)
CREATE POLICY tenant_isolation ON nexo."Appointment"
  USING      ("businessId" = current_setting('app.business_id', true))
  WITH CHECK ("businessId" = current_setting('app.business_id', true));

-- Tablas hijas sin businessId propio: por relación
--   GalleryImage → GalleryBlock.businessId ; TrainingMessage → TrainingConversation ;
--   TrainingPlanSection → TrainingPlan ; ServiceResource → Service ;
--   EmployeeGoal/Restriction/Capability → Employee
CREATE POLICY tenant_isolation ON nexo."GalleryImage"
  USING (EXISTS (SELECT 1 FROM nexo."GalleryBlock" b
                 WHERE b.id = "blockId" AND b."businessId" = current_setting('app.business_id', true)));

-- Business: id = app.business_id.  Membership: businessId = app.business_id.
-- Tablas globales (Plan, PromoCode, Lead, MercadoPagoWebhookEvent, AiUsageEvent,
-- user/session/account/verification): SIN policy de tenant; el rol nexo_app necesita
-- acceso explícito y esas tablas se protegen en la capa de aplicación (auth/superadmin).
```

Costos reales de ese diseño (por eso no lo recomiendo hacer ahora): hay que envolver **toda** consulta en transacción (más latencia); las rutas públicas (`/api/public/[slug]/*`, webhook de MP, crons, bot de WhatsApp, superadmin) operan sin negocio "actual" o cross-tenant y necesitan un contexto de sistema explícito; Better Auth necesita leer `user/session/account` antes de saber el negocio; el CRM debería adoptar lo mismo a la vez. Es un proyecto de varios días con tests de integración, no un ajuste.

---

## 5. Estrategia propuesta para producción y su impacto sobre Nexo

Orden recomendado (cada paso es independiente y reversible):

| # | Cambio | Impacto en Nexo/CRM | Riesgo | Reversión |
|---|---|---|---|---|
| 0 | **Backup previo** (snapshot/`pg_dump`; hoy no hay PITR) y revisar logs de API de Supabase de las últimas semanas buscando requests `rest/v1/session|account|user` con la anon key | Ninguno | Ninguno | — |
| 0b | **[VERIFICAR]** queries de §6 (rol, schemas expuestos, RLS actual, grants) | Ninguno, solo lectura | Ninguno | — |
| 1 | **Reemplazar el keepalive**: hoy depende de `/rest/v1/Plan` con anon key. Cambiarlo a un endpoint propio (`/api/cron/...` con `CRON_SECRET`) que haga `SELECT 1` por Prisma, o mantener un ping a un recurso de Data API deliberadamente público (p. ej. una tabla/vista mínima con RLS + policy `SELECT` para `anon`, en un schema expuesto dedicado) | Sin este paso, los pasos 2-3 hacen fallar el workflow (401/403/404) y el proyecto podría pausarse por inactividad si es plan gratuito | Bajo | Volver el workflow atrás |
| 2 | **Capa A**: quitar `public`/`nexo`/`crm` de Exposed schemas (o apagar Data API) y `REVOKE` de `anon`/`authenticated` + default privileges | **Nexo y CRM no cambian** (Prisma y Storage no usan la Data API). Solo el keepalive | Bajo | Re-agregar schemas / re-`GRANT` |
| 3 | **Capa B**: migración SQL manual (no modelable en `schema.prisma`) con `ENABLE ROW LEVEL SECURITY` en todas las tablas de los 3 schemas, **sin `FORCE`**, sin policies | **Ninguno mientras Prisma siga conectando como `postgres`.** Prisma Migrate sigue funcionando (`DIRECT_URL` también es `postgres`). `_prisma_migrations` también se puede proteger sin afectar a `migrate deploy` | Bajo. Único fallo posible: que el usuario de `DATABASE_URL` **no** sea `postgres`/BYPASSRLS → todas las consultas devolverían 0 filas (por eso query 1 antes) | `ALTER TABLE … DISABLE ROW LEVEL SECURITY` |
| 4 | Convención para tablas nuevas: cada migración que cree una tabla debe incluir su `ENABLE RLS`; opcionalmente un event trigger `ON ddl_command_end` que lo haga automático en esos schemas | Evita reabrir el hueco con la próxima feature | Bajo | Borrar el trigger |
| 5 | Borrar `NEXT_PUBLIC_SUPABASE_ANON_KEY` de `.env.local` (no se usa); si el keepalive sigue con Data API, dejar la anon key **solo** en el secret de GitHub | Ninguno | Ninguno | — |
| 6 | **Rotación**: si los logs muestran accesos no esperados con la anon key → rotar JWT secret/keys de Supabase, invalidar sesiones (`DELETE FROM session`), forzar reset de passwords y rotar `BETTER_AUTH_SECRET`. Si no hay evidencia, rotar la anon key igual es barato | Rotar `BETTER_AUTH_SECRET` desloguea a todos (Nexo y CRM comparten secret: hacerlo en ambos a la vez). Rotar service role/JWT requiere actualizar `SUPABASE_SERVICE_ROLE_KEY` en Nexo y CRM | Medio (coordinado) | — |
| 7 | (Mediano plazo, opcional) Rol `nexo_app` NOBYPASSRLS + `set_config` + policies por tenant (§4) | Cambio arquitectónico: transacción por request, contexto de sistema para rutas públicas/webhooks/superadmin, cambios equivalentes en CRM | Alto (ver §4) | Volver a `postgres` |

Storage: los buckets se manejan con service role desde el servidor; `site-assets` es público a propósito (logos/galería), `payment-proofs` y `knowledge-documents` son privados con URL firmada. Nada cambia con los pasos 2-3. Revisar aparte que `storage.objects` no tenga policies permisivas para `anon` (fuera de lo que muestra el repo).

---

## 6. Queries de solo lectura para verificar (correr en el SQL Editor; no modifican nada)

```sql
-- 1) Rol de Prisma y si ignora RLS
select rolname, rolbypassrls, rolsuper from pg_roles where rolname in ('postgres','anon','authenticated','service_role');
select current_user, session_user;  -- ejecutar conectado con DATABASE_URL

-- 2) Schemas expuestos a la Data API
select rolname, rolconfig from pg_roles where rolname = 'authenticator';   -- buscar pgrst.db_schemas

-- 3) Estado de RLS por tabla
select n.nspname as schema, c.relname as tabla, c.relrowsecurity as rls, c.relforcerowsecurity as forzado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public','nexo','crm')
order by 1,2;

-- 4) Grants efectivos de anon/authenticated
select table_schema, table_name, grantee, string_agg(privilege_type, ',') privs
from information_schema.role_table_grants
where grantee in ('anon','authenticated') and table_schema in ('public','nexo','crm')
group by 1,2,3 order by 1,2;

-- 5) Policies existentes (hoy se espera 0)
select schemaname, tablename, policyname from pg_policies where schemaname in ('public','nexo','crm');
```

---

## 7. Hallazgos de la revisión que **RLS no arregla** (bugs a nivel de aplicación)

Como Prisma bypassa RLS, estos siguen abiertos aun con todo lo anterior. Encontrados de paso; no corregí nada.

1. **`PATCH` y `DELETE` `/api/appointments/[id]` sin autenticación ni scope de negocio** ([route.ts](../../app/api/appointments/[id]/route.ts)). `cancelAppointment(id)` hace `prisma.appointment.update({ where: { id } })` sin `businessId`, y `rescheduleAppointment` busca por `id` (`service.ts:275`). El `middleware.ts` solo protege `/dashboard` y `/superadmin`, no `/api`. Cualquiera que conozca un id de turno puede cancelarlo o reprogramarlo, de cualquier negocio. Los cuid no se adivinan, pero se exponen en flujos públicos/WhatsApp. **Prioridad alta**, no depende de nada del resto del informe.
2. **`GET /api/ai/logs` sin auth** ([route.ts](../../app/api/ai/logs/route.ts)) devuelve `aiLogger.recent()` (memoria del proceso). Puede contener contenido de conversaciones. **[VERIFICAR]** qué guarda el logger.
3. **`/api/whatsapp/conversations/[id]` y `/read` sin auth** (leen/modifican el repositorio de conversaciones; el repo de conversaciones no está scopeado por negocio en lo que vi). **[VERIFICAR]** alcance real: la sesión de WhatsApp es un archivo local del servidor, quizá hoy es mono-tenant de hecho.
4. `getCurrentBusinessId()` usa `membership.findFirst` sin `orderBy`: si un usuario llegara a tener dos negocios, el resultado es no determinista. Hoy `ensureOwnerMembership` crea uno solo, así que es bajo.
5. Los endpoints públicos (`/api/public/[slug]/*`, `/api/leads`) no tienen auth por diseño; conviene confirmar que tienen rate limit (existe `lib/rate-limit.ts`) y validación con zod. No lo auditamos en profundidad.

## 8. Fuera de alcance / no verificado
- No se ejecutó ninguna query contra Supabase; el rol y los schemas expuestos son inferencias razonadas (ver §6).
- No se revisó `storage.objects` policies ni la configuración de Auth de Supabase.
- El CRM se revisó solo en cómo se conecta y su modelo de tenant (`Workspace.businessId`); sus rutas no se auditaron una por una.
- El proyecto Waste (`WT-WEBSITE`) usa **otro** proyecto Supabase (`cloqpv…`) con supabase-js sí en uso desde sus Server Actions; queda fuera de este informe.
