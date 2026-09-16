# Fase 1 — Reestructuración a PostgreSQL schemas (`public` / `nexo` / `crm`)

**Estado:** análisis, sin ejecutar. Ningún cambio de código ni de base de datos se aplicó todavía.
**Fecha:** 2026-09-15
**Método:** lectura directa de `prisma/schema.prisma` (910 líneas, 33 modelos — corregido en Fase 2, ver nota ahí), `prisma.config.ts`, `lib/prisma.ts`, `lib/auth/auth.ts`, `lib/auth/superadmin.ts`, `modules/business/current.ts`, `modules/business/membership.ts`, `modules/billing/subscription.ts`, `lib/superadmin/queries.ts`, `middleware.ts`, las 20 migraciones existentes en `prisma/migrations/`, y grep exhaustivo de `prisma.<model>`, `$queryRaw`/`$executeRaw`/`$transaction` en todo `nexo/`. `docs/architecture/database.md` existente se descartó como fuente: describe modelos (`Customer`, `Conversation`, `WhatsAppConnection`) que no existen en el schema real — es aspiracional, no una fotografía del código.

No se tocó ninguna tabla, no se corrió ninguna migración. Este documento es el insumo para decidir antes de ejecutar.

---

## Resumen ejecutivo

- El proyecto usa **Prisma 7.8 + `@prisma/adapter-pg` 7.9** (driver adapters), con la URL de conexión resuelta en runtime por `lib/prisma.ts` (no por `url = env(...)` en `schema.prisma` — ese campo ni siquiera está declarado hoy; `prisma.config.ts` se lo da al CLI). Prisma multi-schema (`schemas = [...]` + `@@schema(...)`) es una feature GA desde Prisma 5.15 (2024) para PostgreSQL — no requiere `previewFeatures`, y es compatible con driver adapters.
- **No hay una sola línea de SQL crudo** (`$queryRaw`/`$executeRaw`) en todo el proyecto. Todo acceso a datos pasa por el Prisma Client tipado. Esto es la razón principal por la que esta migración es de bajo riesgo a nivel aplicación: ningún módulo conoce ni necesita conocer el nombre físico del schema de Postgres — eso lo resuelve el cliente generado.
- El movimiento de tablas entre schemas de Postgres (`ALTER TABLE ... SET SCHEMA ...`) es una operación **de metadata, no de datos**: no reescribe filas, no rompe FKs, no toca índices ni constraints, y es prácticamente instantánea sin importar el tamaño de la tabla. Es el mecanismo correcto para esta migración — y es reversible con el mismo comando en sentido inverso.
- El riesgo real no está en Postgres ni en Prisma: está en que `prisma migrate dev` **no sabe** que mover un modelo de schema es un rename — por defecto genera un diff destructivo (`DROP TABLE` + `CREATE TABLE`). El plan de abajo evita esto generando la migración vacía y escribiéndola a mano.

---

## A. Mapa actual

### A.1 Inventario de los 33 modelos y sus relaciones directas

| Modelo | Relaciona con (FK saliente) | Referenciado por (FK entrante) |
|---|---|---|
| `User` | — | `Session`, `Account`, `Membership` |
| `Session` | `User` | — |
| `Account` | `User` | — |
| `Verification` | (sin FK; `identifier` es texto libre) | — |
| `Business` | — | `Appointment`, `Employee`, `FAQ`, `GalleryBlock`, `Membership`, `MemoryEntry`, `PaymentProof`, `Resource`, `Schedule`, `Service`, `TrainingPlan`, `TrainingConversation`, `SeoConfig`, `Subscription`, `BusinessNotification`, `PromoCodeRedemption`, `Lead` (opcional, `convertedBusinessId`) |
| `Membership` | `User`, `Business` | — |
| `Service` | `Business` | `Appointment` (opcional), `ServiceResource` |
| `Resource` | `Business` | `Appointment` (opcional), `ServiceResource` |
| `ServiceResource` | `Service`, `Resource` | — (tabla puente N:M) |
| `Schedule` | `Business` | — |
| `FAQ` | `Business` | — |
| `GalleryBlock` | `Business` | `GalleryImage` |
| `GalleryImage` | `GalleryBlock` | — |
| `SeoConfig` | `Business` (1:1) | — |
| `Appointment` | `Business`, `Service` (opc.), `Resource` (opc.) | `PaymentProof` |
| `PaymentProof` | `Business`, `Appointment` (opc., `SetNull`) | — |
| `Employee` | `Business` (1:1) | `EmployeeGoal`, `EmployeeRestriction`, `EmployeeCapability` |
| `EmployeeGoal` | `Employee` | — |
| `EmployeeRestriction` | `Employee` | — |
| `EmployeeCapability` | `Employee` | — |
| `MemoryEntry` | `Business` | — |
| `TrainingPlan` | `Business` (1:1) | `TrainingPlanSection` |
| `TrainingPlanSection` | `TrainingPlan` | — |
| `TrainingConversation` | `Business` | `TrainingMessage` |
| `TrainingMessage` | `TrainingConversation` | — |
| `AiUsageEvent` | (sin FK; `businessId` suelto a propósito) | — |
| `BusinessNotification` | `Business` | — |
| `Plan` | — | `Subscription`, `PromoCode` |
| `Subscription` | `Business` (1:1), `Plan` | — |
| `MercadoPagoWebhookEvent` | (sin FK; tabla de idempotencia standalone) | — |
| `PromoCode` | `Plan` | `PromoCodeRedemption` |
| `PromoCodeRedemption` | `PromoCode`, `Business` | — |
| `Lead` | `Business` (opcional, `convertedBusinessId`, `SetNull`) | — |

### A.2 Quién escribe/lee cada dominio (módulos y rutas)

- **Auth (Better Auth):** `lib/auth/auth.ts` usa `prismaAdapter(getPrisma(), { provider: "postgresql" })` contra `User`/`Session`/`Account`/`Verification`. No hay lógica propia sobre estas tablas fuera de Better Auth — el adapter genera las queries dinámicamente a partir del Prisma Client, sin conocer ni necesitar el schema físico de Postgres.
- **"Negocio actual":** un único punto, `modules/business/current.ts` → `prisma.membership.findFirst({ where: { userId }})`. Confirma el inventario: sin `orderBy` explícito, primera membresía que encuentre. Comportamiento preexistente, no se toca en esta fase.
- **Creación de negocio/membresía:** `modules/business/membership.ts::ensureOwnerMembership` — crea `Business` + `Membership` + llama a `ensureTrialSubscription` (billing). Es el único punto de escritura que cruza `public.Business` (propuesto) con lo que hoy sería `nexo.Subscription` (propuesto) en la misma operación lógica — no en la misma transacción Prisma (son tres `await` secuenciales, no un `$transaction`), así que el cruce de schemas no cambia su comportamiento transaccional actual.
- **Billing/Mercado Pago:** `modules/billing/subscription.ts` (lectura/escritura de `Plan`+`Subscription`, sin relación a ningún modelo de dominio de Nexo salvo `businessId`), `modules/billing/mercadopago/*` (checkout, cancel, webhook-events, sync-plan) — todos usan `prisma.plan`/`prisma.subscription`/`prisma.mercadoPagoWebhookEvent` vía el cliente tipado, cero SQL crudo.
- **Superadmin:** `lib/superadmin/queries.ts` es **exclusivamente de lectura** (confirmado leyendo el archivo) sobre `Business`, `Membership`, `AiUsageEvent`, `TrainingPlan`/`Section`, `Appointment`, `Subscription`, `Plan` — usa `aggregate`/`groupBy`/`findMany` con `include`, nunca joins manuales en SQL. Las escrituras de Plan/Subscription desde Superadmin viven en `modules/billing/subscription.ts`, no acá.
- **Leads:** `modules/leads/service.ts` — CRUD del pipeline comercial, con vínculo opcional a `Business` vía `convertedBusinessId`. Nunca toca ninguna tabla de dominio de Nexo (`Service`, `Appointment`, etc.).
- **WhatsApp:** grep de `prisma.` en `modules/whatsapp/**` → **cero resultados**. Confirma el inventario: conversaciones y mensajes viven en memoria del proceso, no en Postgres. La migración de schemas no afecta este módulo en absoluto (no hay tabla que mover).
- **`$transaction` (Prisma, no SQL crudo):** usado en `modules/business/service.ts`, `modules/business/gallery.ts`, `modules/business/resource.ts`, `modules/appointments/service.ts`, `modules/payments/service.ts`, `modules/employee/training/proposal.ts`, `modules/employee/training-plan.ts`, `modules/employee/profile.ts`. Todos son transacciones **dentro del dominio de Nexo** (ej. crear `Appointment` + `PaymentProof`, o `Employee` + sus `EmployeeGoal`/`Restriction`) — ninguna mezcla escritura en una tabla que se propone como `public` con una que se propone como `nexo` en la misma transacción. Postgres soporta transacciones cross-schema sin ninguna restricción (es la misma base de datos, un solo `BEGIN`/`COMMIT`), así que aunque las hubiera no sería un problema — se documenta igual porque achica la superficie de verificación post-migración.
- **Onboarding:** `middleware.ts` solo exige cookie de sesión (`getSessionCookie`) para `/dashboard/*` y `/superadmin/*` — no hay gate de "wizard completo" a nivel middleware, confirmando el inventario. El wizard en sí opera sobre `Business`/`Schedule`/`Service` — ninguno de sus endpoints hace SQL manual.

### A.3 Migraciones existentes

20 migraciones, desde `20260805055308_init_auth_and_membership` hasta `20260826140000_add_mercadopago_webhook_event`. Todas son `CREATE TABLE`/`ALTER TABLE` estándar dentro de `public` (schema implícito hoy — no hay ningún `CREATE SCHEMA` en el historial). No hay downgrades escritos a mano ni seeds destructivos. `migration_lock.toml` confirma `provider = "postgresql"`.

---

## B. Propuesta de separación

| Modelo | Schema propuesto | Motivo |
|---|---|---|
| `User` | `public` | Identidad de cuenta, gestionada por Better Auth — sin ningún acoplamiento a Nexo. |
| `Session` | `public` | Idem — tabla de Better Auth. |
| `Account` | `public` | Idem — tabla de Better Auth (credenciales). |
| `Verification` | `public` | Idem — tabla de Better Auth (verificación de email/tokens). |
| `Business` | `public` | El tenant en sí. Es exactamente la entidad que ambos productos van a colgar (`public.Business → nexo.*` y, después, `→ crm.*`). |
| `Membership` | `public` | Puente User↔Business. Es identidad/acceso a la cuenta, no un dato operativo de ningún producto — el futuro acceso "qué productos puede usar este User en este Business" se apoya en esta tabla, no en una de Nexo. |
| `Service` | `nexo` | Catálogo de servicios reservables — dominio operativo de Nexo. |
| `Resource` | `nexo` | Recursos físicos reservables — dominio operativo de Nexo. |
| `ServiceResource` | `nexo` | Puente N:M entre dos modelos de Nexo. |
| `Schedule` | `nexo` | Disponibilidad horaria del negocio — específico del motor de turnos de Nexo. |
| `FAQ` | `nexo` | Contenido del sitio público / IA de Nexo. |
| `GalleryBlock` / `GalleryImage` | `nexo` | Contenido del sitio público de Nexo. |
| `SeoConfig` | `nexo` | Config SEO del sitio público de Nexo. |
| `Appointment` | `nexo` | El turno en sí — el corazón operativo de Nexo. |
| `PaymentProof` | `nexo` | Comprobantes de seña, atados 1:1 al flujo de turnos de Nexo. |
| `Employee` / `EmployeeGoal` / `EmployeeRestriction` / `EmployeeCapability` | `nexo` | Configuración del empleado IA — específico de cómo Nexo usa Gemini. |
| `MemoryEntry` | `nexo` | Memoria de la IA de Nexo. |
| `TrainingPlan` / `TrainingPlanSection` / `TrainingConversation` / `TrainingMessage` | `nexo` | Entrenamiento conversacional — específico de AI Studio de Nexo. |
| `AiUsageEvent` | `nexo` (con nota) | Hoy el campo `operation` solo tiene valores de Nexo (`training_onboarding`, `whatsapp_reply`, `simulator`, `seo_generate`) — moverlo a `public` ahora sería anticipar un ledger de costo de IA multi-producto que todavía no existe. Ver nota en sección "Candidatos revisados y descartados". |
| `BusinessNotification` | `nexo` | Los 6 tipos de notificación son 100% eventos del producto Nexo (turno, comprobante, IA). |
| `Plan` | `nexo` (con nota) | Ver sección dedicada abajo — decisión no trivial. |
| `Subscription` | `nexo` (con nota) | Idem. |
| `MercadoPagoWebhookEvent` | `nexo` (con nota) | Idem. |
| `PromoCode` / `PromoCodeRedemption` | `nexo` (con nota) | Idem. |
| `Lead` | `public` (recomendado, ver sección dedicada) | Decisión explícitamente pedida en el punto 5 del pedido — no es trivial, se desarrolla aparte. |

### Candidatos revisados y descartados para `public` en esta fase

**`Plan` / `Subscription` / `MercadoPagoWebhookEvent` / `PromoCode` / `PromoCodeRedemption` → se recomienda dejarlos en `nexo`, no en `public`, por ahora.**

El pedido dice explícitamente: *"mi preferencia arquitectónica es que [facturación transversal] pueda eventualmente ser compartida... pero no quiero que se mueva una tabla solamente por anticipar el futuro."* Aplicando ese criterio a lo que el código realmente hace hoy:

- Las 6 columnas de feature-gating de `Plan` (`whatsappEnabled`, `depositsEnabled`, `customTrainingEnabled`, `statsEnabled`, `galleryEnabled`, `digitalMenuEnabled`) son, sin excepción, features de Nexo. `resolvePlanFeatures()` en `modules/billing/subscription.ts` no tiene ni un solo campo que un futuro CRM pudiera leer tal cual — un plan de CRM va a necesitar sus propios gates (cantidad de contactos, de usuarios, de automatizaciones...), que no caben en este `Plan` sin reformarlo.
- Si se mueve `Plan`/`Subscription` a `public` ahora "porque conceptualmente algún día será transversal", se termina con un modelo con forma de Nexo viviendo en el schema compartido — exactamente el resultado que el pedido pide evitar ("no quiero terminar con un único schema gigante donde todo esté mezclado", sección 17).
- El camino correcto para la facturación transversal (billing por Business, independiente del producto) es diseñarlo como una decisión propia de una fase posterior — probablemente un modelo `public.Subscription` genuinamente agnóstico de producto, con `nexo.PlanFeatures`/`crm.PlanFeatures` resolviendo el gating de cada uno — no migrar el `Plan` actual tal cual.
- `MercadoPagoWebhookEvent`/`PromoCode`/`PromoCodeRedemption` viajan junto con `Plan`/`Subscription` por ser el mismo dominio funcional (ninguno tiene sentido separado del otro); se recomienda moverlos juntos cuando llegue esa fase, no partirlos ahora.

Esto es una recomendación, no un hecho cerrado — es exactamente el tipo de llamado que el pedido pide dejar documentado y explícito para revisión antes de ejecutar.

### Lead — decisión dedicada (punto 5 del pedido)

Tres opciones evaluadas:

1. **Mover a `nexo`.** Incorrecto: `Lead` no tiene ninguna relación con ningún modelo de dominio de Nexo (`Service`, `Appointment`, etc.), no lo usa ninguna pantalla de `/dashboard/*`, y el propio pedido dice explícitamente "no confundas este modelo con el futuro CRM" — meterlo en `nexo` sugeriría que es una feature del producto Nexo, cuando es leads de **venta de Nexo/Kodexa como empresa**, no de un negocio cliente.
2. **Dejarlo en `public`.** Su única FK es a `Business` (`convertedBusinessId`, opcional, `SetNull`) — la misma tabla que ya vive en `public`. Se gestiona 100% desde `/superadmin/*`, que es por naturaleza cross-producto (el mismo panel que ya lee `AiUsageEvent`, `Plan`, `Subscription`). Es "compartido" no en el sentido de que Nexo y el futuro CRM lo consulten en runtime por igual (no lo harán — CRM tendrá su propio concepto de Lead, de clientes de un Business, no de Kodexa), sino en el sentido de que es una entidad de **operación comercial de la plataforma Kodexa**, igual de ajena a "producto Nexo" que a "producto CRM".
3. **Dejarlo temporalmente donde está y tratarlo como candidato a un futuro sistema administrativo propio de Kodexa** (ni `public`, ni `nexo`, ni `crm` — un schema `kodexa_admin` o similar, fuera de alcance de esta fase). Es conceptualmente la opción "más correcta" a largo plazo (el propio pedido lo sugiere: *"eventualmente convertirse en una entidad propia del sistema administrativo/comercial de Kodexa"*), pero el pedido también dice explícitamente no crear más estructura de la necesaria en esta fase, y la arquitectura objetivo declarada solo tiene tres schemas.

**Recomendación: opción 2 (`public`).** Es la única que no exige inventar un cuarto schema no pedido, no lo mete dentro de `nexo` (que sería el error real a evitar), y es coherente con que su única relación real hoy es a `Business`. Queda marcado explícitamente como punto a confirmar con el usuario antes de ejecutar — es exactamente la clase de decisión "no evidente" que el pedido pide no resolver en silencio.

---

## C. Riesgos

1. **`prisma migrate dev` genera un diff destructivo por defecto.** Prisma no tiene una noción nativa de "este modelo se movió de schema, es la misma tabla" — al comparar el estado anterior (todo en `public`) contra el nuevo (`@@schema("nexo")` en 26 modelos), el motor de diff por defecto va a proponer `DROP TABLE public."Service"` + `CREATE TABLE nexo."Service"`, perdiendo todos los datos. **Mitigación:** nunca aplicar el diff autogenerado tal cual — ver plan de migración (sección D), que reemplaza el body por `ALTER TABLE ... SET SCHEMA`.
2. **Shadow database de Prisma Migrate.** `prisma migrate dev` usa una base sombra para detectar drift; si se la usa para *aplicar* (no solo generar) la migración, puede no reflejar fielmente el comportamgeniento real. **Mitigación:** generar con `--create-only` (no aplica nada), editar a mano, y aplicar con `prisma migrate deploy` (que no usa shadow DB) contra un staging real primero.
3. **Plataforma de deploy no confirmada.** No hay `netlify.toml`/`vercel.json` dentro de `nexo/` (sí existe uno en `kodexa-landing/`, proyecto distinto). No se pudo confirmar desde el repo cómo ni cuándo se corre `prisma migrate deploy` en producción. **Impacto:** sin saber esto, no se puede garantizar una ventana de mantenimiento coordinada con el deploy. Antes de ejecutar en producción hay que confirmar esto fuera del repo (con quien administra el hosting/Supabase).
4. **Better Auth no está probado contra schemas no-`public`.** `better-auth/adapters/prisma` genera sus queries dinámicamente a partir del Prisma Client — en teoría es indiferente al schema físico (el cliente ya resuelve eso), pero es una integración de terceros y el pedido es explícito: *"no debemos romper el sistema de login actual"*. **Mitigación:** en el plan de abajo, el smoke test post-migración prioriza registro/login/logout/cambio de contraseña antes que cualquier otra verificación.
5. **Permisos de base de datos.** El rol de conexión (`DATABASE_URL`) necesita `USAGE` + `CREATE` sobre los schemas `nexo`/`crm` nuevos, y `USAGE` cruzado para que las FKs `nexo.* → public."Business"` resuelvan. En Supabase, el rol de aplicación normalmente ya tiene privilegios amplios sobre la base, pero **hay que confirmarlo antes de aplicar en producción** — un `permission denied for schema nexo` a mitad de migración es descubrible recién en el momento, no antes, salvo que se pruebe primero en staging.
6. **`Membership.findFirst` sin `orderBy` (preexistente, no introducido por esta migración).** Ya es no determinístico hoy — cambiar el schema físico de `Membership`/`Business` no lo agrava ni lo mejora. Se documenta para que no se confunda con una regresión de esta fase si alguien lo nota durante el testing.
7. **Fuga de eventos SSE de WhatsApp entre negocios (preexistente, documentada en el inventario).** No tiene relación con Postgres/Prisma (WhatsApp no persiste en la base) — no se toca ni se arregla en esta fase, se deja documentada como ya estaba.
8. **Ventana de indisponibilidad.** Aunque `ALTER TABLE ... SET SCHEMA` es una operación de metadata casi instantánea, sigue tomando un lock a nivel de catálogo sobre cada tabla durante la transacción. Con 26 tablas moviéndose en una sola transacción, el lock total es breve (milisegundos por tabla en la práctica) pero **existe** — se recomienda igual una ventana de bajo tráfico, no por duración esperada sino por prudencia ante lo no probado en este entorno puntual.
9. **`prisma generate` debe correr antes de desplegar el código nuevo.** El `postinstall` del `package.json` ya lo hace (`"postinstall": "prisma generate"`), así que cualquier build nuevo lo resuelve solo — pero si alguien despliega manualmente sin pasar por `npm install`, el cliente viejo seguiría funcionando igual (Prisma Client no valida el schema físico en cada query, confía en las migraciones) hasta el próximo `generate`. Riesgo bajo, mencionado por completitud.

---

## D. Plan de migración

### Fase 0 — Antes de tocar nada
1. Backup/snapshot completo de la base (point-in-time recovery de Supabase, o `pg_dump` manual) — independiente de que la migración sea no-destructiva, es la red de seguridad real.
2. Confirmar con quien administra Supabase/el hosting: (a) que el rol de `DATABASE_URL` tiene `CREATE` sobre la base para poder crear schemas, y (b) cuál es el mecanismo real de deploy/`migrate deploy` (ver Riesgo 3).
3. Levantar una copia de staging de la base de producción (o una rama/preview de Supabase si el plan lo permite) para probar el plan completo de punta a punta antes de tocar producción.

### Fase 1 — Migración aditiva (cero riesgo, se puede aplicar sola primero)
```sql
CREATE SCHEMA IF NOT EXISTS nexo;
CREATE SCHEMA IF NOT EXISTS crm;
```
Esto no mueve nada, no puede romper nada existente. Se puede desplegar y verificar de forma completamente independiente del resto, incluso días antes.

### Fase 2 — Actualizar `prisma/schema.prisma`
1. Agregar `schemas = ["public", "nexo", "crm"]` al bloque `datasource db`.
2. Agregar `@@schema("public")` a: `User`, `Session`, `Account`, `Verification`, `Business`, `Membership`, `Lead` (pendiente de confirmación, ver sección B).
3. Agregar `@@schema("nexo")` a los 25 modelos restantes.
4. `npx prisma validate` — valida sintaxis y relaciones cross-schema sin tocar la base.
5. `npx prisma format`.

### Fase 3 — Generar la migración y reescribirla a mano
1. Contra la base de **staging** (nunca directo en producción): `npx prisma migrate dev --create-only --name move_nexo_tables_to_schemas`.
2. Prisma va a generar un `migration.sql` con `DROP TABLE`/`CREATE TABLE` — **se descarta ese contenido** y se reemplaza por:
   ```sql
   BEGIN;

   ALTER TABLE "Service" SET SCHEMA nexo;
   ALTER TABLE "Resource" SET SCHEMA nexo;
   ALTER TABLE "ServiceResource" SET SCHEMA nexo;
   ALTER TABLE "Schedule" SET SCHEMA nexo;
   ALTER TABLE "FAQ" SET SCHEMA nexo;
   ALTER TABLE "GalleryBlock" SET SCHEMA nexo;
   ALTER TABLE "GalleryImage" SET SCHEMA nexo;
   ALTER TABLE "SeoConfig" SET SCHEMA nexo;
   ALTER TABLE "Appointment" SET SCHEMA nexo;
   ALTER TABLE "PaymentProof" SET SCHEMA nexo;
   ALTER TABLE "Employee" SET SCHEMA nexo;
   ALTER TABLE "EmployeeGoal" SET SCHEMA nexo;
   ALTER TABLE "EmployeeRestriction" SET SCHEMA nexo;
   ALTER TABLE "EmployeeCapability" SET SCHEMA nexo;
   ALTER TABLE "MemoryEntry" SET SCHEMA nexo;
   ALTER TABLE "TrainingPlan" SET SCHEMA nexo;
   ALTER TABLE "TrainingPlanSection" SET SCHEMA nexo;
   ALTER TABLE "TrainingConversation" SET SCHEMA nexo;
   ALTER TABLE "TrainingMessage" SET SCHEMA nexo;
   ALTER TABLE "AiUsageEvent" SET SCHEMA nexo;
   ALTER TABLE "BusinessNotification" SET SCHEMA nexo;
   ALTER TABLE "Plan" SET SCHEMA nexo;
   ALTER TABLE "Subscription" SET SCHEMA nexo;
   ALTER TABLE "MercadoPagoWebhookEvent" SET SCHEMA nexo;
   ALTER TABLE "PromoCode" SET SCHEMA nexo;
   ALTER TABLE "PromoCodeRedemption" SET SCHEMA nexo;

   COMMIT;
   ```
   (`Lead` se agrega a esta lista solo si la decisión final fuera moverlo a `nexo` en vez de dejarlo en `public` — según la recomendación de la sección B, no se incluye acá.)
3. `ALTER TABLE ... SET SCHEMA` conserva automáticamente, sin ninguna acción adicional: filas, ids, PKs, FKs (incluidas las que van a quedar cross-schema hacia `public."Business"`), índices, unique constraints y defaults. No requiere `DROP`/`CREATE` de ninguna de estas cosas.
4. `Business`, `Membership`, `User`, `Session`, `Account`, `Verification` (y `Lead`, si se confirma) **no llevan ningún `ALTER`** — ya están en `public`, que es donde quedan.

### Fase 4 — Validar en staging
1. `npx prisma generate`.
2. Aplicar la migración editada contra staging: `npx prisma migrate deploy` (o ejecutar el SQL directo si se prefiere aplicar por fuera del flujo de Migrate y luego `prisma migrate resolve --applied <nombre>` para que el historial de Migrate quede consistente).
3. Smoke test completo contra staging, en este orden de prioridad (según lo que el pedido marca como no-negociable):
   - Registro, login, logout, cambio de contraseña (Better Auth).
   - Middleware: acceso a `/dashboard` con y sin sesión.
   - Onboarding de un negocio nuevo (`ensureOwnerMembership` + `ensureTrialSubscription`).
   - CRUD de Servicios/Recursos/Horarios.
   - Crear/reprogramar/cancelar un turno; flujo de seña con comprobante.
   - Sitio público `/s/[slug]` (lee `Business`+`Service`+`Schedule`+`SeoConfig` — el primer punto real donde se leen juntas tablas de `public` y `nexo`).
   - AI Studio: entrenamiento, memoria, simulador.
   - Superadmin: empresas, planes, códigos promocionales, leads, dashboard de IA.
   - Webhook de Mercado Pago (simulado) y cron endpoints (`revert-expired-benefits`, limpieza de comprobantes/archivos huérfanos).
4. Solo si todo lo anterior pasa, se programa la ventana para producción.

### Fase 5 — Producción
1. Ventana de bajo tráfico (prudencial, no porque se espere downtime largo — ver Riesgo 8).
2. Backup inmediato antes de aplicar (redundante con Fase 0 si pasó tiempo entre el análisis y la ejecución).
3. Aplicar Fase 1 (crear schemas) si no se hizo antes.
4. Aplicar la migración de Fase 3 con `prisma migrate deploy`.
5. Desplegar el código con el `schema.prisma` actualizado (el `postinstall` corre `prisma generate` solo).
6. Repetir el smoke test de Fase 4 contra producción.
7. Actualizar `docs/architecture/database.md` (hoy desactualizado/aspiracional) para reflejar la estructura real post-migración — no es parte de la migración en sí, pero queda pendiente para no dejar la documentación más desalineada de lo que ya está.

---

## E. Estrategia de rollback

Gracias a que Fase 3 es exclusivamente `ALTER TABLE ... SET SCHEMA` dentro de una única transacción:

- **Si falla durante la aplicación:** Postgres revierte la transacción completa automáticamente (`BEGIN`/`COMMIT` con DDL transaccional) — no queda ningún estado intermedio. No se necesita ninguna acción manual.
- **Si se detecta un problema después de haber hecho commit** (ej. algo no probado en el smoke test que falla en producción): rollback = aplicar la migración espejo, moviendo todo de vuelta:
  ```sql
  BEGIN;
  ALTER TABLE nexo."Service" SET SCHEMA public;
  ALTER TABLE nexo."Appointment" SET SCHEMA public;
  -- ... (una línea por tabla, en sentido inverso)
  COMMIT;
  ```
  También es una operación de metadata, también instantánea, también sin pérdida de datos. Junto con revertir `@@schema` en `schema.prisma` y volver a desplegar el código anterior (o el mismo código con el schema revertido, ya que ningún módulo de la aplicación asume un schema físico), el sistema vuelve exactamente al estado anterior.
- **El backup de Fase 0** queda como red de seguridad de último recurso (ej. si además de esta migración algo más salió mal en la misma ventana) — no debería hacer falta usarlo si el rollback de arriba se aplica, pero es la razón por la que se toma igual.
- Explícitamente **no se recomienda `DROP TABLE`/restore completo** como primera respuesta a un problema — el rollback vía `ALTER TABLE ... SET SCHEMA` inverso es más rápido, no tiene ventana de pérdida de datos entre el backup y el momento del problema, y es la operación simétrica de la que causó el problema.

---

## Preguntas abiertas para decidir antes de ejecutar

1. **`Lead` → ¿`public` (recomendado) o dejarlo fuera de esta fase?** Ver justificación en sección B.
2. **`Plan`/`Subscription`/`MercadoPagoWebhookEvent`/`PromoCode`/`PromoCodeRedemption` → ¿confirmar `nexo` por ahora, revisitando cuando se diseñe billing transversal real?** Ver justificación en sección B.
3. **Plataforma y mecanismo de deploy real** (Riesgo 3) — necesario confirmarlo fuera del repo antes de programar la ventana de producción.
4. **Permisos del rol de `DATABASE_URL` sobre schemas nuevos** (Riesgo 5) — confirmar con quien administra el proyecto de Supabase.
5. ¿Se dispone de una base de staging real (o Supabase branch/preview) para la Fase 4, o hay que armar una copia manual con `pg_dump`/`pg_restore` para este propósito?

Ninguna de estas bloquea seguir avanzando con el diseño, pero sí deberían resolverse antes de tocar producción.
