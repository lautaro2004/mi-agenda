# Fase 3 — Migración a `public` / `nexo` / `crm`: ejecutada y verificada

**Estado: EJECUTADA Y VERIFICADA.** La preparación (edición de `prisma/schema.prisma`, SQL exacto, backup de seguridad) se mostró y se confirmó explícitamente con el usuario antes de tocar la base — ver sección I. Con esa confirmación, se aplicó `migration.sql` contra la base real y se verificó el resultado con consultas de solo lectura y con el propio Prisma Client de la aplicación. Todo coincide exactamente con lo esperado: mismos datos, mismos IDs, mismas FKs, cero errores de aplicación.
**Fecha:** 2026-09-16
**Continúa:** [`migracion-schemas-fase1.md`](./migracion-schemas-fase1.md), [`migracion-schemas-fase2.md`](./migracion-schemas-fase2.md).

---

## Hallazgo crítico, antes que nada

`.env` y `.env.local` apuntan al **mismo proyecto Supabase real** (`aws-0-ca-central-1.pooler.supabase.com`) — no hay una base de staging separada en este entorno. Se confirmó además, por lectura directa (query de solo lectura, ver sección B), que esta base **tiene datos reales**: 8 negocios, 8 usuarios, 4 turnos, 320 mensajes de entrenamiento, etc. No es una base de prueba vacía.

Esto cambia el nivel de cuidado exigido respecto de lo que la Fase 1 asumía ("validar en staging antes de producción"): acá no hay un staging al que migrar primero. Se decidió, en consecuencia, **no ejecutar ninguna sentencia que modifique la base** en esta fase, y limitar toda interacción con la base real a **consultas de solo lectura** (introspección de catálogo — `pg_tables`, `pg_namespace`, `information_schema`, `SELECT COUNT(*)`) para verificar el estado real antes de proponer el SQL final. Se detalla todo lo que se corrió, exactamente, en la sección B.

---

## A. Qué se hizo en esta fase

1. Se re-leyeron `migracion-schemas-fase1.md`, `migracion-schemas-fase2.md` y `prisma/schema.prisma` para partir del estado real, no de lo recordado.
2. Se modificó `prisma/schema.prisma`:
   - Se agregó `schemas = ["public", "nexo", "crm"]` al bloque `datasource db`.
   - Se agregó `@@schema("public")` a `User`, `Session`, `Account`, `Verification`, `Business`, `Membership`, `Lead` (7 modelos).
   - Se agregó `@@schema("nexo")` a los 26 modelos restantes.
   - No se agregó ningún modelo de `crm` (según lo pedido: "no crees modelos de CRM todavía salvo que sean estrictamente necesarios").
   - No se cambió ningún nombre de modelo, campo, ni `@@map` existente.
3. Se corrió `npx prisma validate` — **pasó limpio**, incluyendo `"crm"` en el array `schemas` sin ningún modelo asignado a ese schema. Esto resuelve empíricamente la incertidumbre que había quedado abierta en la Fase 2 (sección C.3 de ese documento): **Prisma 7.8 sí acepta un schema declarado sin modelos**. No hizo falta la alternativa de contingencia (dejar `crm` fuera del array de Prisma) — se deja documentado igual por si una versión futura de Prisma cambia este comportamiento.
4. Se corrió `npx prisma format` — solo realineó espaciado (cambio cosmético, sin efecto semántico).
5. Se corrió `npx prisma generate` — generó el cliente nuevo sin errores. **Advertencia importante, no una falla:** este cliente ya asume que 26 tablas viven en `nexo` y 7 en `public`, pero la base física **todavía tiene las 33 en `public`** (la migración no se aplicó). Si algún proceso corriendo ahora mismo (`next dev`, un deploy, un cron) llega a usar este cliente regenerado antes de que se aplique la migración de la sección C, **toda query contra un modelo de `nexo` va a fallar** con un error del tipo `relation "nexo.Service" does not exist`. No se detectó ningún servidor corriendo desde esta sesión, pero **no hay forma de confirmar desde acá si hay un `next dev`/deploy activo en otro proceso** — se lo marca como punto a confirmar antes de dar por buena esta preparación (ver sección H).
6. Se corrió el checklist de aplicación pedido, contra el cliente ya regenerado:
   - `npx tsc --noEmit` → **0 errores**.
   - `npm run lint` → **0 errores**, 8 warnings preexistentes (`no-unused-vars` en variables ya prefijadas `_` a propósito en código no relacionado con esta migración — no se tocaron).
   - `npm test` (`vitest run`) → **149/149 tests pasando**, 17 archivos de test. Los tests mockean Prisma (confirmado en la Fase 1), así que este resultado valida que ningún módulo de la aplicación depende de una forma específica del cliente que haya cambiado con el multi-schema.
   - `next build` **no se corrió** — `app/sitemap.ts` usa `prisma.business` para generar el sitemap en build time, lo que abriría una conexión real (de solo lectura, pero real) contra la base durante el build. Se prefirió no hacerlo sin confirmación explícita, dado el hallazgo de la sección anterior (una sola base, con datos reales). Queda pendiente si se confirma que es seguro correrlo.
7. Se hicieron consultas de **solo lectura** contra la base real (detalle completo en la sección B) para verificar el estado físico actual antes de escribir el SQL final — no asumido, confirmado.
8. Se escribió el SQL exacto de la migración y su rollback, **sin ejecutarlos**: `prisma/migrations/20260916000000_move_nexo_tables_to_schemas/migration.sql` y `rollback.sql` en la misma carpeta (este último no es parte del mecanismo de Prisma Migrate, es solo el script de referencia para revertir a mano — Prisma no tiene down-migrations nativas).
9. Se analizaron los campos de `Business` para identificar cuáles son conceptualmente específicos de Nexo (sección E) — sin refactorizar nada.

## I. Confirmación del usuario y ejecución

Se presentó el hallazgo del encabezado, el SQL exacto (sección C original, reproducida abajo) y las 5 confirmaciones pedidas, y se preguntó explícitamente antes de tocar la base. Respuestas del usuario:

1. **¿Hay algo corriendo contra esta base ahora?** → No.
2. **¿Backup/PITR de Supabase confirmado?** → No hay backup configurado. Dado esto, y antes de ejecutar nada, se tomó un **volcado de seguridad propio**: como `pg_dump` no está disponible en este entorno, se conectó por `pg` (solo lectura) y se exportó cada una de las 33 tablas a JSON (`SELECT * FROM ...`), **705 filas en total**, guardado en `prisma/_backup_pre_fase3_20260916/`. Se agregó esa carpeta a `.gitignore` de inmediato (`/prisma/_backup_pre_*/`) porque contiene PII real de clientes (emails, teléfonos, nombres, transcripciones de entrenamiento) — **no debe commitearse nunca**. Ver sección J para qué hacer con ella ahora que la migración ya se verificó.
3. **¿Aplicar la migración?** → Sí, confirmado.

Con eso, se ejecutó:

```
npx prisma db execute --file prisma/migrations/20260916000000_move_nexo_tables_to_schemas/migration.sql
→ Script executed successfully.

npx prisma migrate resolve --applied 20260916000000_move_nexo_tables_to_schemas
→ Migration 20260916000000_move_nexo_tables_to_schemas marked as applied.
```

(El segundo comando es necesario porque el SQL se aplicó con `db execute`, no con `migrate deploy` — sin esto, Prisma Migrate seguiría considerando esta migración "pendiente" y trataría de volver a aplicarla en el próximo `migrate deploy`, ahora contra tablas que ya no existen en `public`.)

## J. Verificación post-migración (todo de solo lectura)

**Schemas resultantes:** `public`, `nexo`, `crm` — los 3 existen ahora.

**Distribución real de tablas, confirmada contra `pg_tables`:**
- `public`: 8 tablas — `Business`, `Lead`, `Membership`, `_prisma_migrations`, `account`, `session`, `user`, `verification`.
- `nexo`: 26 tablas — exactamente las 26 de la sección C.
- `crm`: 0 tablas — creado, vacío, reservado, tal como se planeó.

**Conteo de filas, tabla por tabla, comparado contra el baseline "antes" de la sección B: 33/33 coinciden exactamente.** Ni una fila de más, ni de menos, en ninguna tabla. (`_prisma_migrations` no se cuenta — no es un modelo de dominio.)

**Foreign keys:** 34 en total después de la migración (34 antes — sin cambios). Se identificaron explícitamente las que ahora cruzan de `nexo` a `public`: **15 FKs cross-schema**, todas `nexo.<tabla>.businessId → public."Business".id` (`Appointment`, `BusinessNotification`, `Employee`, `FAQ`, `GalleryBlock`, `MemoryEntry`, `PaymentProof`, `PromoCodeRedemption`, `Resource`, `Schedule`, `SeoConfig`, `Service`, `Subscription`, `TrainingConversation`, `TrainingPlan`) — todas presentes y funcionando. Las 19 FKs restantes quedaron dentro del mismo schema (ej. `Membership → user` dentro de `public`, `TrainingMessage → TrainingConversation` dentro de `nexo`).

*(Nota interna: la primera versión de esta verificación, vía `information_schema.constraint_column_usage`, reportó 0 FKs cross-schema por un join mal armado — forzaba a que el schema de la tabla referenciada coincidiera con el de la tabla de origen, exactamente lo contrario de lo que hay que detectar. Se corrigió usando `pg_constraint`/`pg_class` directamente, que es la fuente correcta y no ambigua para esto, y dio el resultado real: 15.)*

**ID de muestra sin alterar:** el primer `Business` (`id: cmsl7i2ef000309jrnjlmct65`, `Oeste IT`, `createdAt: 2026-08-09T05:51:45.447Z`) se verificó idéntico a como estaba antes de la migración.

**Prueba funcional de punta a punta, con el Prisma Client real de la aplicación (no SQL manual)** — la validación más importante, porque es exactamente el tipo de query que hace `app/s/[slug]/page.tsx` en producción:

```
prisma.business.findFirst({ include: { services, schedules, appointments, subscription: { plan }, employee, memberships } })
→ business "LAUTY BARBER": 3 services, 7 schedules, 1 appointment, plan "Gratis", employee "Asistente", 1 membership
  (todas las relaciones nexo.* resueltas correctamente desde public.Business)

prisma.membership.findFirst({ include: { user, business } })
→ membership.user.email: oesteit@gmail.com / membership.business.name: "Oeste IT"
  (relación public.Membership -> public.User + public.Business)

prisma.lead.findFirst({ include: { convertedBusiness } })
→ lead encontrado: julian@gmail.com
```

**Resultado: el cliente Prisma multi-schema funciona de punta a punta**, incluidas las relaciones cross-schema `nexo.* → public.Business`, usando exactamente el mismo cliente que ya usa el resto de la aplicación — no hubo que escribir ni una query especial para esto.

## Qué NO se hizo (deliberado)

- No se corrió `prisma migrate dev` (se evitó crear una shadow database contra el único servidor Postgres disponible) — se aplicó el SQL ya escrito y revisado directamente vía `prisma db execute`.
- No se corrió `next build` — sigue pendiente como parte del smoke test de aplicación completo (no se hizo por no tener autorización explícita para esa conexión puntual, distinta de las lecturas de verificación ya autorizadas).
- No se tocó Better Auth, Mercado Pago, Storage, WhatsApp, ni ningún módulo de negocio — solo `prisma/schema.prisma` y la estructura física de la base.
- No se creó ningún modelo de CRM — `crm` quedó creado y vacío.
- No se implementó SSO ni `crossSubDomainCookies` (fuera de alcance, confirmado en Fase 2).
- No se hizo commit de nada — todos los archivos tocados/creados están sin commitear, a la espera de que el usuario los revise (`git status`: `prisma/schema.prisma` modificado; `docs/architecture/*fase*.md`, `prisma/migrations/20260916000000_.../`, `.gitignore` nuevos/modificados). La carpeta `prisma/_backup_pre_fase3_20260916/` quedó gitignored — contiene PII real, no debe subirse nunca; se recomienda borrarla del disco (no solo dejarla gitignored) una vez que el usuario confirme que la aplicación sigue funcionando bien en uso real, o moverla a un lugar seguro fuera del repo si la quiere conservar más tiempo.

---

## B. Verificación contra la base real (solo lectura)

Se conectó con `DIRECT_URL` (conexión directa, no pooleada — la misma que usa el CLI de Prisma para migraciones) usando el paquete `pg` ya presente en `node_modules`, y se corrieron exclusivamente sentencias `SELECT`. El script se usó una vez y se borró (no queda un archivo suelto en el repo).

**Conexión:**

| current_user | current_database |
|---|---|
| `postgres` | `postgres` |

**Permisos** — `has_database_privilege(current_user, current_database(), 'CREATE')` → **`true`**. El rol de conexión puede crear schemas nuevos. Esto resuelve el Riesgo 5 de la Fase 1 y la Decisión abierta 5 de la Fase 2: **confirmado, no es un riesgo pendiente**.

**Schemas existentes hoy:** solo `public`. Ni `nexo` ni `crm` existen todavía en la base — coincide exactamente con lo esperado antes de aplicar la migración.

**Tablas en `public` hoy: 34** — las 33 tablas de los 33 modelos + `_prisma_migrations` (tabla interna de Prisma Migrate, nunca se mueve, no es un modelo del schema). El diff automático contra la lista de 33 modelos esperados dio: **cero faltantes, cero sobrantes** (más allá de `_prisma_migrations`, que es esperado). El nombre físico de cada tabla coincide exactamente con lo que Prisma va a intentar mover (`"Business"`, `"Service"`, `"user"` en minúscula por el `@@map`, etc.).

**Conteo de filas — baseline "antes" (para comparar después de aplicar la migración):**

| Tabla | Filas | Tabla | Filas |
|---|---|---|---|
| AiUsageEvent | 88 | PaymentProof | 0 |
| Appointment | 4 | Plan | 5 |
| Business | 8 | PromoCode | 1 |
| BusinessNotification | 0 | PromoCodeRedemption | 2 |
| Employee | 8 | Resource | 9 |
| EmployeeCapability | 48 | Schedule | 28 |
| EmployeeGoal | 4 | SeoConfig | 3 |
| EmployeeRestriction | 5 | Service | 14 |
| FAQ | 20 | ServiceResource | 9 |
| GalleryBlock | 2 | Subscription | 8 |
| GalleryImage | 3 | TrainingConversation | 9 |
| Lead | 1 | TrainingMessage | 320 |
| Membership | 8 | TrainingPlan | 8 |
| MemoryEntry | 4 | TrainingPlanSection | 39 |
| MercadoPagoWebhookEvent | 1 | account | 10 |
| — | — | session | 26 |
| — | — | user | 10 |
| — | — | verification | 0 |

Total: 645 filas de dominio, sin contar `_prisma_migrations` (24 filas — historial de migraciones, no se toca).

**Foreign keys en `public` hoy: 34**, todas verificadas contra `information_schema` — coinciden exactamente con las relaciones documentadas en la Fase 1 sección A.1 y la Fase 2 sección D. No apareció ninguna FK no documentada.

---

## C. SQL exacto — EJECUTADO (ver sección I para la confirmación y sección J para el resultado verificado)

Archivo: `prisma/migrations/20260916000000_move_nexo_tables_to_schemas/migration.sql`

```sql
BEGIN;

CREATE SCHEMA IF NOT EXISTS nexo;
CREATE SCHEMA IF NOT EXISTS crm;

ALTER TABLE "BusinessNotification"    SET SCHEMA nexo;
ALTER TABLE "GalleryBlock"            SET SCHEMA nexo;
ALTER TABLE "GalleryImage"            SET SCHEMA nexo;
ALTER TABLE "SeoConfig"               SET SCHEMA nexo;
ALTER TABLE "Service"                 SET SCHEMA nexo;
ALTER TABLE "Resource"                SET SCHEMA nexo;
ALTER TABLE "ServiceResource"         SET SCHEMA nexo;
ALTER TABLE "Schedule"                SET SCHEMA nexo;
ALTER TABLE "FAQ"                     SET SCHEMA nexo;
ALTER TABLE "MemoryEntry"             SET SCHEMA nexo;
ALTER TABLE "TrainingPlan"            SET SCHEMA nexo;
ALTER TABLE "TrainingPlanSection"     SET SCHEMA nexo;
ALTER TABLE "TrainingConversation"    SET SCHEMA nexo;
ALTER TABLE "TrainingMessage"         SET SCHEMA nexo;
ALTER TABLE "Appointment"             SET SCHEMA nexo;
ALTER TABLE "PaymentProof"            SET SCHEMA nexo;
ALTER TABLE "Employee"                SET SCHEMA nexo;
ALTER TABLE "EmployeeGoal"            SET SCHEMA nexo;
ALTER TABLE "EmployeeRestriction"     SET SCHEMA nexo;
ALTER TABLE "EmployeeCapability"      SET SCHEMA nexo;
ALTER TABLE "AiUsageEvent"            SET SCHEMA nexo;
ALTER TABLE "Plan"                    SET SCHEMA nexo;
ALTER TABLE "Subscription"            SET SCHEMA nexo;
ALTER TABLE "MercadoPagoWebhookEvent" SET SCHEMA nexo;
ALTER TABLE "PromoCode"               SET SCHEMA nexo;
ALTER TABLE "PromoCodeRedemption"     SET SCHEMA nexo;

COMMIT;
```

**Qué NO se mueve, queda en `public` tal cual está:** `"Business"`, `"Membership"`, `"Lead"`, `"user"`, `"session"`, `"account"`, `"verification"`, `_prisma_migrations`.

**26 tablas se mueven a `nexo`.** 0 tablas se mueven a `crm` — el schema queda creado y vacío, reservado (consistente con "no construir CRM todavía" y con lo ya validado en la sección A.3).

### Confirmaciones pedidas explícitamente antes de ejecutar

1. **¿Pérdida de datos?** No — `ALTER TABLE ... SET SCHEMA` es una operación de catálogo (mueve la entrada de la tabla al namespace `nexo`), no reescribe ni una fila. Las 645 filas de dominio contadas en la sección B quedan intactas, en las mismas tablas, con el mismo contenido.
2. **¿Cambian los IDs?** No — ningún `id` se regenera ni se toca. `ALTER TABLE ... SET SCHEMA` no interactúa con los valores de las columnas en absoluto.
3. **¿Se rompen las FKs?** No — Postgres soporta FKs entre schemas de la misma base sin restricción alguna (ver Fase 2, sección C.1). Las FKs que hoy apuntan a `public."Business"` desde tablas que se van a `nexo` (`Appointment`, `Service`, `Subscription`, etc.) siguen apuntando exactamente al mismo `Business.id` después del `ALTER TABLE` — la FK no se recrea, se mantiene, solo cambia el schema donde vive la tabla que la declara.
4. **¿Permisos del usuario de conexión?** Confirmado en la sección B: `current_user = postgres`, `has_database_privilege(..., 'CREATE') = true`. Suficiente para `CREATE SCHEMA` y `ALTER TABLE ... SET SCHEMA` sobre tablas propias.
5. **¿Backup/rollback disponible?** El rollback de la operación en sí está listo (`rollback.sql`, mismo mecanismo en sentido inverso — ver sección D). Supabase no tenía backup/PITR confirmado (respuesta del usuario, sección I) — como red de seguridad adicional se tomó un volcado JSON propio de las 33 tablas (705 filas) antes de ejecutar, ver sección I.

---

## D. Rollback (procedimiento — no fue necesario aplicarlo, la migración verificó correcta)

Archivo: `prisma/migrations/20260916000000_move_nexo_tables_to_schemas/rollback.sql`

```sql
BEGIN;

ALTER TABLE nexo."BusinessNotification"    SET SCHEMA public;
ALTER TABLE nexo."GalleryBlock"            SET SCHEMA public;
ALTER TABLE nexo."GalleryImage"            SET SCHEMA public;
ALTER TABLE nexo."SeoConfig"               SET SCHEMA public;
ALTER TABLE nexo."Service"                 SET SCHEMA public;
ALTER TABLE nexo."Resource"                SET SCHEMA public;
ALTER TABLE nexo."ServiceResource"         SET SCHEMA public;
ALTER TABLE nexo."Schedule"                SET SCHEMA public;
ALTER TABLE nexo."FAQ"                     SET SCHEMA public;
ALTER TABLE nexo."MemoryEntry"             SET SCHEMA public;
ALTER TABLE nexo."TrainingPlan"            SET SCHEMA public;
ALTER TABLE nexo."TrainingPlanSection"     SET SCHEMA public;
ALTER TABLE nexo."TrainingConversation"    SET SCHEMA public;
ALTER TABLE nexo."TrainingMessage"         SET SCHEMA public;
ALTER TABLE nexo."Appointment"             SET SCHEMA public;
ALTER TABLE nexo."PaymentProof"            SET SCHEMA public;
ALTER TABLE nexo."Employee"                SET SCHEMA public;
ALTER TABLE nexo."EmployeeGoal"            SET SCHEMA public;
ALTER TABLE nexo."EmployeeRestriction"     SET SCHEMA public;
ALTER TABLE nexo."EmployeeCapability"      SET SCHEMA public;
ALTER TABLE nexo."AiUsageEvent"            SET SCHEMA public;
ALTER TABLE nexo."Plan"                    SET SCHEMA public;
ALTER TABLE nexo."Subscription"            SET SCHEMA public;
ALTER TABLE nexo."MercadoPagoWebhookEvent" SET SCHEMA public;
ALTER TABLE nexo."PromoCode"               SET SCHEMA public;
ALTER TABLE nexo."PromoCodeRedemption"     SET SCHEMA public;

COMMIT;
```

Mismo tipo de operación en sentido inverso — instantánea, sin pérdida de datos. Además del SQL, revertir implica:

1. Restaurar `prisma/schema.prisma` a la versión previa (sin `@@schema(...)`, sin `schemas = [...]`) — se puede recuperar del historial de archivos/git, o reconstruir quitando cada línea `@@schema(...)` agregada en esta fase.
2. `npx prisma generate` para que el cliente vuelva a asumir todo en `public`.
3. Si ya se había desplegado algo con el cliente nuevo, volver a desplegar con el cliente viejo (o uno regenerado tras revertir el schema).

El volcado JSON tomado en la sección I (`prisma/_backup_pre_fase3_20260916/`) queda como red de seguridad de último recurso mientras se confirma que todo funciona bien en uso real — no hizo falta usarlo.

---

## E. Business como entidad compartida — campos específicos de Nexo

Se pidió identificar, sin refactorizar, qué campos de `Business` son conceptualmente de producto (Nexo) y no de identidad/tenant compartida. Revisando el modelo completo (34 campos propios, sin contar relaciones):

**Genuinamente genéricos de cualquier empresa (6 campos):** `id`, `name`, `description`, `phone`, `address`, `category`, `createdAt`, `updatedAt`. `logoUrl` también entra acá razonablemente — es branding de la empresa, no de un producto puntual.

**Específicos del producto Nexo (17 campos):**
- **Sitio público de Nexo:** `slug`, `siteTemplate`, `heroImageUrl`, `brandColor`, `instagramUrl`, `facebookUrl`, `whatsappNumber` — ninguno tiene sentido para un `Business` que solo use el futuro CRM y nunca publique un sitio.
- **Seña/depósito de turnos (10 campos):** `depositRequired`, `depositType`, `depositFixedAmount`, `depositPercentage`, `depositAlias`, `depositCbu`, `depositBankName`, `depositAccountHolder`, `depositTaxId`, `depositInstructions` — 100% acoplados al flujo de turnos de Nexo, sin ningún significado para CRM.
- **Carta digital:** `menuEnabled`, `menuPdfUrl` — feature del sitio público de Nexo.

En números: de 34 campos propios de `Business`, **17 (la mitad) son específicos de Nexo**, no de la identidad de la empresa como tal.

**¿Conviene separarlos ahora?** No — y esto es deliberado, no un descuido. Separarlos implicaría: crear un modelo nuevo (ej. `nexo.BusinessProfile`, 1:1 con `public.Business`), migrar esos 17 campos con sus datos reales, y tocar **todos los módulos que hoy leen/escriben `Business` directamente con esos campos** (`modules/business/service.ts`, `modules/business/deposit.ts`, `modules/business/menu.ts`, `modules/business/slug.ts`, el sitio público completo, el onboarding, etc.) — es exactamente el tipo de "refactorización grande" que el pedido de esta fase prohíbe explícitamente ("La prioridad es NO romper Nexo").

**Qué se documenta para más adelante:** cuando se diseñe el primer modelo real de `crm` que necesite su propia versión de "perfil de negocio para ese producto" (ej. `crm.BusinessCrmSettings`), el patrón correcto a replicar es exactamente este — un modelo satélite en el schema del producto, 1:1 con `public.Business`, en vez de seguir agregando columnas de producto a la tabla compartida. Separar retroactivamente los 17 campos de Nexo señalados arriba queda como una refactorización propia de una fase posterior, no de esta.

---

## F. Compatibilidad con Nexo — revisión

Confirmado empíricamente (no solo por inspección) con el cliente ya regenerado contra el `schema.prisma` nuevo:

| Área | Resultado |
|---|---|
| Imports/consultas Prisma | `tsc --noEmit` limpio — ningún import ni llamada a `prisma.<modelo>` rota por el cambio de schema físico. |
| Relaciones | `prisma validate` limpio, incluidas las relaciones cross-schema `nexo.* → public.Business`. |
| Better Auth | No requiere cambios (razonado en Fase 2, sección B.1) — el adapter genera queries desde el Prisma Client, agnóstico del schema físico. Verificado post-migración: `prisma.membership.findFirst({ include: { user } })` resolvió correctamente `public.Membership → public.User` (sección J). **No se hizo, sí queda pendiente:** un login real vía navegador (registro/login/logout/cambio de contraseña por la UI) — la prueba hecha confirma la capa de datos, no el flujo HTTP completo de Better Auth. |
| Membership / Business | Sin cambios de comportamiento — siguen en `public`, mismas queries. |
| Superadmin | `lib/superadmin/queries.ts` usa `aggregate`/`groupBy`/`findMany` con `include`, nada de SQL manual — mismo argumento que Better Auth, sin cambios de código necesarios. |
| Leads | Sin cambios — `Lead` queda en `public`, su única FK (`convertedBusinessId → Business`) es intra-`public`. |
| Mercado Pago | `modules/billing/mercadopago/*` usa `prisma.plan`/`prisma.subscription`/`prisma.mercadoPagoWebhookEvent` vía cliente tipado — sin SQL crudo (confirmado por grep en la Fase 1), sin cambios necesarios. |
| Storage | Subsistema separado (Supabase Storage, buckets) — no tiene relación con schemas de Postgres, no se toca. |
| APIs (`app/api/*`) | Cubiertas por el mismo argumento: cero SQL crudo en todo el proyecto (confirmado de nuevo en esta fase). |
| Cron | Mismos módulos (`revert-expired-benefits`, limpieza de comprobantes/archivos huérfanos) usan Prisma Client tipado. |
| Sitio público `/s/[slug]` | Lee `Business` (`public`) + `Service`/`Schedule`/`SeoConfig` (`nexo`) — el smoke test funcional de la sección J prueba exactamente este patrón (`business.findFirst` con `include: services, schedules`) y funcionó correctamente. **No se hizo, sí queda pendiente:** cargar la URL real `/s/[slug]` en un navegador — la prueba hecha confirma la capa de datos, no el render HTTP completo. |
| Onboarding | `middleware.ts` sin cambios; el wizard opera sobre `Business`/`Schedule`/`Service` vía Prisma Client tipado. |
| Dashboard / AI Studio | Mismos módulos, mismo argumento — sin SQL crudo. |
| WhatsApp | Confirmado de nuevo: cero uso de Prisma en `modules/whatsapp/**` — no afectado en absoluto. |
| Estadísticas | `modules/analytics` (no auditado línea por línea en esta fase, pero sin aparecer en el grep de `$queryRaw`/`$executeRaw` de la Fase 1) — mismo argumento. |

**No se detectó ningún punto del código que requiera un cambio más allá de `prisma/schema.prisma`.** Esto no es una suposición: es lo que separa a este proyecto de un caso típico de migración de schema — la ausencia total de SQL crudo (verificada dos veces, Fase 1 y esta fase) es la razón concreta.

---

## G. Riesgos — estado final

1. **Cliente regenerado antes de migrar la base** — fue un riesgo real durante la ventana entre `prisma generate` y la aplicación del SQL (sección A.5–I). Se cerró: la migración se aplicó y se verificó (sección J) sin que nada intentara usar el cliente nuevo contra la base vieja en el medio.
2. **Sin base de staging** — se mantuvo como riesgo aceptado conscientemente (no había alternativa en este entorno); se compensó con el backup propio (sección I) y la verificación exhaustiva post-migración (sección J), en vez de "probar antes en staging". No se necesitó el rollback.
3. **Backup/PITR de Supabase no confirmado** — el usuario confirmó que no hay uno configurado. Se compensó con el volcado JSON de 705 filas (sección I). **Queda como pendiente real, no de esta migración sino de la operación del proyecto en general:** configurar backups en Supabase para futuras migraciones y como práctica general.
4. **`next build` no probado** — sigue sin correrse; `app/sitemap.ts` toca la base en build time. Bajo riesgo (la migración ya está verificada por otras vías), pero queda como parte del smoke test de aplicación completo todavía no ejecutado (junto con un login real por navegador, sección F).
5. Los riesgos ya cubiertos en Fase 1/2 (diff destructivo de `prisma migrate dev` si alguien lo corriera más adelante sin revisar el SQL, mantenimiento de relaciones bidireccionales al agregar modelos de `crm` después) siguen vigentes como guía a futuro — no aplicaron en esta ejecución porque se evitó `migrate dev` a propósito.

---

## H. Decisiones abiertas — lo que queda después de esta fase

Todo lo que bloqueaba la ejecución ya se resolvió (confirmación del usuario, ausencia de servidor concurrente, backup propio tomado). Lo que queda es trabajo de cierre, no bloqueante:

1. **Smoke test de aplicación en vivo** (no solo vía Prisma Client directo): login/logout/cambio de contraseña por la UI de Better Auth, cargar `/s/[slug]` en el navegador, `/dashboard`, `/superadmin` — recomendado antes de considerar el proyecto "en uso normal" otra vez, aunque las pruebas de datos ya hechas dan alta confianza.
2. **`next build`** — correrlo cuando se decida, para confirmar que `app/sitemap.ts` (y cualquier otra ruta que prerenderice contra la base) sigue generando bien contra el nuevo layout de schemas.
3. **Backup/PITR de Supabase** — configurarlo a nivel de proyecto para el futuro (no específico de esta migración).
4. **`prisma/_backup_pre_fase3_20260916/`** — ya gitignored; decidir si se borra del disco ahora que la migración está verificada, o se conserva un tiempo más como red de seguridad adicional (contiene PII real, no debe subirse a ningún lado).
5. **Commit de los cambios** — todo quedó sin commitear a propósito (`prisma/schema.prisma`, la carpeta de migración, `.gitignore`, los 3 documentos de arquitectura). Confirmar con el usuario antes de hacer el commit, según las reglas de este proyecto de nunca commitear sin que se pida explícitamente.
6. **Decisiones ya resueltas, no vuelven a estar abiertas:** `crm` sin modelos en Prisma (funciona, confirmado), permisos del rol de conexión (`CREATE` disponible, confirmado), separación `Plan`/`Subscription`/`Lead` (decidida por el usuario en el pedido de esta fase), campos de `Business` específicos de Nexo (documentados en la sección E, sin refactorizar).
