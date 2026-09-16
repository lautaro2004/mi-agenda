# CRM — Fase 3: Construcción del Core funcional

**Estado: EJECUTADA Y VALIDADA.** El CRM tiene ahora un Core real, navegable, con backend contra Postgres real (cero mocks en producción) — Workspace, Empresas, Contactos, Leads, Pipelines/Oportunidades, Tareas, Actividades, Tags, Campos personalizados, Estados configurables, búsqueda, onboarding y configuración inicial por rubro. 41 tests unitarios (mockeados) + una validación de integración completa contra la base real (9/9, con limpieza total confirmada). `prisma validate`/`generate`/`tsc`/`lint`/`test`/`build`: **todos en verde**.
**Fecha:** 2026-09-17
**Continúa:** [`crm-fase1-diseno.md`](./crm-fase1-diseno.md), [`crm-fase2-bootstrap.md`](./crm-fase2-bootstrap.md).

---

## Resultado final — criterio de terminación (verificado real, no simulado)

| # | Capacidad pedida | Estado |
|---|---|---|
| 1 | Iniciar sesión | ✅ Better Auth real, `app/(auth)/login` |
| 2 | Entrar a su Workspace | ✅ `app/dashboard/layout.tsx` resuelve `resolveWorkspaceContext()` |
| 3 | Ver dashboard | ✅ métricas + actividad reciente reales |
| 4 | Crear una empresa | ✅ CRUD completo `crm.Company` |
| 5 | Crear contactos | ✅ CRUD completo `crm.Contact`, relación a Company |
| 6 | Crear leads | ✅ CRUD completo `crm.Lead` (≠ `public.Lead`) |
| 7 | Crear pipeline | ✅ `crm.Pipeline`/`PipelineStage`, múltiples pipelines |
| 8 | Mover oportunidades | ✅ tablero por etapa, cambio de stage vía selector (sin DnD) |
| 9 | Crear tareas | ✅ CRUD + completar/reabrir |
| 10 | Registrar actividades | ✅ `crm.Activity`, embebida en cada ficha + vista global |
| 11 | Usar tags | ✅ crear/asignar/quitar/filtrar (Companies) |
| 12 | Crear campos personalizados | ✅ definición + valor, por tipo de entidad |
| 13 | Buscar/filtrar | ✅ búsqueda global + filtros por estado/tag |
| 14 | Ver historial de sus entidades | ✅ `ActivityFeed` en cada ficha |
| 15 | Nunca acceder a datos de otro Business | ✅ verificado explícitamente (sección "Tests" + validación real) |

**Todo contra PostgreSQL real — cero mock en el código de producción.** Los mocks existen solo en los archivos `*.test.ts` (convención ya establecida en Nexo y en el bootstrap del CRM).

---

## A. Arquitectura implementada

```
crm/
├── app/
│   ├── (auth)/login, (auth)/registro       — Better Auth, formularios reales
│   ├── onboarding/                          — crea Business+Membership+Workspace+template
│   ├── dashboard/
│   │   ├── layout.tsx                       — resuelve Workspace, sidebar, redirige si falta algo
│   │   ├── page.tsx                         — dashboard (métricas + actividad reciente)
│   │   ├── empresas/, contactos/, leads/, oportunidades/, tareas/, actividades/
│   │   ├── configuracion/                   — etiquetas, campos personalizados, estados, módulos
│   │   └── buscar/
│   └── api/                                 — 30 Route Handlers, todos delgados (ver sección "Endpoints")
├── components/                              — por dominio + components/ui/primitives.tsx (sistema propio)
├── modules/                                 — TODA la lógica de negocio y el multi-tenancy
├── lib/
│   ├── workspace.ts                         — resolveWorkspaceContext() — ÚNICO punto de verdad
│   ├── api-guard.ts                         — requireWorkspace()/parseBody() para las routes
│   ├── schemas.ts                           — Zod, todos los inputs
│   ├── industry-templates.ts                — registro fijo, seeding por rubro
│   └── labels.ts                            — diccionarios de UI
└── prisma/                                  — schema.prisma + 2 migraciones nuevas de esta fase
```

Separación UI → API → módulos → persistencia respetada en todos los casos: ninguna `app/api/*/route.ts` tiene lógica de negocio — todas llaman a una función de `modules/*` y devuelven `NextResponse.json(...)`. Las páginas de servidor (`app/dashboard/**/page.tsx`) llaman a los módulos **directamente** (sin pasar por la API interna — un Server Component no necesita un round-trip HTTP a sí mismo); las mutaciones desde el cliente sí van por la API.

---

## B. Modelo multi-tenant — cómo se implementó

```
usuario autenticado
       ↓  auth.api.getSession()
public.Membership.findFirst({ userId })
       ↓
public.Business (businessId)
       ↓
crm.Workspace.findUnique({ businessId })
       ↓
entidades CRM (businessId FK → crm.Workspace.businessId)
```

Esto vive en **un único lugar**: `lib/workspace.ts::resolveWorkspaceContext()`. Devuelve un tipo discriminado (`unauthenticated | no_business | no_workspace | ok`) — nunca un valor "parcial" que una página o una API pueda malinterpretar. Tanto `app/dashboard/layout.tsx` como **todas** las Route Handlers pasan por acá (vía `lib/api-guard.ts::requireWorkspace()` para las API, directo para las páginas server).

**Nunca se confía en un `businessId`/`workspaceId` enviado por el cliente.** Se verificó explícitamente: ninguna de las 30 rutas de API acepta esos campos en el body — siempre se resuelven desde la sesión. Los esquemas Zod (`lib/schemas.ts`) ni siquiera los declaran como campos válidos.

**Todo módulo de dominio recibe `businessId` como primer argumento** y lo aplica en cada `where` de Prisma — confirmado módulo por módulo (`companies`, `contacts`, `leads`, `opportunities`, `tasks`, `activities`, `tags`, `custom-fields`, `status-definitions`, `pipelines`, `search`). Las relaciones entre entidades (`Contact.companyId`, `Lead.companyId`, `Opportunity.pipelineId`/`stageId`/`companyId`/`contactId`, `EntityTag.tagId`, `CustomFieldValue.definitionId`) se validan explícitamente contra el `businessId` actual **antes** de escribir — nunca se asume que un id recibido pertenece al negocio correcto (ver `assertCompanyBelongs`, `assertBelongsToBusiness`, el chequeo de `Tag`/`CustomFieldDefinition` en sus respectivos módulos).

---

## C. Modelo de datos — cambios de Prisma en esta fase

Dos migraciones nuevas, ambas exclusivamente en `crm.*`, ninguna toca `public.*` ni `nexo.*`:

1. **`20260916180000_init_crm_core`** — 13 tablas: `Workspace`, `Pipeline`, `PipelineStage`, `Company`, `Contact`, `Lead`, `Opportunity`, `Task`, `Activity`, `StatusDefinition`, `CustomFieldDefinition`, `CustomFieldValue`, `Tag`.
2. **`20260917090000_add_entity_tag`** — `EntityTag` (asociación polimórfica etiqueta↔entidad), pospuesta deliberadamente en la Fase 2 ("no construir el tagging hasta que se conecte a una pantalla real" — esta fase sí lo necesitaba).

**Un cambio en el espejo de `public.Business`:** se agregó el campo `logoUrl String?` al modelo `Business` del schema del CRM. **No es una migración** — la columna ya existe físicamente en la tabla (Nexo la usa para el sitio público); solo se agregó la declaración de campo para que el CRM pueda leerla en el futuro (Workspace → nombre/logo del negocio). Documentado explícitamente en `prisma/schema.prisma` con el motivo.

Aplicadas con el mismo mecanismo ya validado en la Fase 2 (`prisma db execute --file` + `prisma migrate resolve --applied`) — **nunca** `prisma migrate dev`, tal como se pidió. Se re-confirmó que la convivencia con `_prisma_migrations` de Nexo sigue funcionando sin fricción (mismo comportamiento documentado en la Fase 2).

---

## D. Mapa de modelos (19 totales, sin contar `EntityTag` que ya está arriba)

| Modelo | Schema | Relación clave |
|---|---|---|
| `User`, `Session`, `Account`, `Verification`, `Business`, `Membership` | `public` | Espejo de Nexo — sin cambios de esta fase (salvo `Business.logoUrl`) |
| `Workspace` | `crm` | `businessId` → `public.Business.id` (única raíz que sí apunta directo a `public`) |
| `Company`, `Contact`, `Lead`, `Opportunity`, `Task`, `Activity`, `Pipeline`, `Tag`, `StatusDefinition`, `CustomFieldDefinition` | `crm` | `businessId` → `crm.Workspace.businessId` |
| `PipelineStage` | `crm` | `pipelineId` → `crm.Pipeline.id` |
| `CustomFieldValue` | `crm` | `definitionId` → `crm.CustomFieldDefinition.id` |
| `EntityTag` | `crm` | `tagId` → `crm.Tag.id`, `businessId` propio (scoping directo, sin depender del join) |

---

## E. Endpoints (30 Route Handlers, todos delgados)

```
/api/onboarding                                    POST

/api/companies                                     GET, POST
/api/companies/[id]                                GET, PATCH, DELETE
/api/companies/[id]/archive                        POST

/api/contacts                                       GET, POST
/api/contacts/[id]                                  GET, PATCH, DELETE

/api/leads                                           GET, POST
/api/leads/[id]                                      GET, PATCH, DELETE

/api/pipelines                                       GET, POST
/api/pipelines/[id]                                  GET, PATCH, DELETE
/api/pipelines/[id]/stages                           POST (crear etapa), PATCH (reordenar)
/api/pipelines/[id]/stages/[stageId]                 PATCH, DELETE

/api/opportunities                                   GET, POST
/api/opportunities/[id]                              GET, PATCH, DELETE

/api/tasks                                           GET, POST
/api/tasks/[id]                                      PATCH, DELETE

/api/activities                                      GET, POST

/api/tags                                            GET, POST
/api/tags/[id]                                       DELETE
/api/tags/assign                                     POST
/api/tags/unassign                                   POST

/api/custom-field-definitions                        GET, POST
/api/custom-field-definitions/[id]                   PATCH, DELETE
/api/custom-field-values                             POST

/api/status-definitions                              GET, POST
/api/status-definitions/[id]                         PATCH, DELETE

/api/workspace/modules                               PATCH

/api/search                                           GET
```

Toda mutación pasa por `requireWorkspace()` (sesión + Membership + Workspace) antes de tocar `parseBody()` (validación Zod) antes de llamar al módulo correspondiente — mismo orden en las 30 rutas, sin excepciones.

---

## F. Páginas (41 rutas de `app/`, confirmadas por el build)

`/`, `/login`, `/registro`, `/onboarding`, y bajo `/dashboard`: inicio, `empresas` (+ nueva/[id]/[id]/editar), `contactos` (idem), `leads` (idem), `oportunidades` (+ nueva/[id]/[id]/editar/pipelines), `tareas` (+ nueva), `actividades`, `buscar`, `configuracion` (+ etiquetas/campos-personalizados/estados).

---

## G. Decisiones tomadas (documentadas, no implementadas a ciegas)

1. **`Workspace` no tiene campos propios de nombre/logo.** El "nombre" del Workspace es `public.Business.name` (ya existente, no se duplica). El "logo" es `public.Business.logoUrl` — columna física ya existente en Nexo, solo se agregó la declaración al espejo del CRM (sección C). Ningún dato nuevo, ninguna migración de `public`.
2. **Las tablas de dominio del CRM referencian `crm.Workspace`, no `public.Business` directo** (ya decidido en la Fase 2, reafirmado acá): la base exige que exista un `Workspace` antes de poder crear cualquier `Company`/`Lead`/etc.
3. **`crm.Lead` no tiene relación directa a `Contact`.** Un Lead se asocia a `Company`, pero no a `Contact` — el flujo típico de CRM es "Lead se califica → se convierte en Contact/Opportunity". Se documenta como pospuesto hasta que exista un flujo real de conversión que lo necesite, no se agrega el campo sin caso de uso.
4. **"Clientes" (ítem 3 del roadmap del MVP) se resuelve como `Company.status`** (`prospect`/`customer`/`archived`), no como un modelo aparte — evita duplicar la noción de "empresa" en dos tablas.
5. **Sin soft-delete formal en `Company`.** El modelo no tiene un flag dedicado; se reusa `status: "archived"` (mismo criterio de "string libre" que ya usa Appointment/Subscription en Nexo y el resto de este proyecto) en vez de agregar una columna nueva sin necesidad concreta. Un hard-delete real sigue disponible (`DELETE /api/companies/[id]`) para limpiar registros de prueba — no es la acción primaria de la UI.
6. **Roles: se reusa `public.Membership.role`** (ya decidido en la Fase 1 de diseño), sin construir invitación de equipo ni permisos granulares — no existe hoy ningún roster de usuarios del Workspace más allá de quien lo creó, así que "asignar responsable" (`OwnerAssign`) por ahora solo permite auto-asignarse/desasignarse. El campo `ownerId` ya está en cada entidad relevante (`Lead`, `Opportunity`, `Task`, `Company`), listo para cuando exista invitación real.
7. **Reordenar etapas de pipeline con botones subir/bajar, no drag-and-drop.** Sin librería de DnD instalada en esta fase — mismo resultado funcional ("ordenar etapas"), sin sumar una dependencia nueva solo para esto. Igual criterio para "mover oportunidades": un selector de etapa por tarjeta en el tablero, en vez de arrastrar.
8. **Sistema de diseño propio, sin shadcn/radix instalado** (`components/ui/primitives.tsx`) — Tailwind puro. Prioriza tener una base técnica real (backend completo, sin mocks) por sobre una librería de componentes — se puede migrar a un design system más rico en una fase de UI dedicada sin tocar ninguna lógica de negocio (la separación módulos/UI ya lo permite).
9. **Filtro por tag implementado como patrón representativo en Empresas**, no replicado todavía en Contactos/Leads/Oportunidades — el módulo (`listEntityIdsForTag`) es genérico y reutilizable; extenderlo a las otras 3 listas es una repetición mecánica del mismo patrón, no una decisión de diseño nueva. Documentado para que no se lea como una omisión.
10. **`StatusDefinition` cubre Lead y Company; Opportunity usa `PipelineStage`** (ya tiene su propio estado real vía etapas) — evita dos sistemas de "estado configurable" superpuestos para la misma entidad.

## Decisiones postergadas (explícitamente, con motivo)

- **Importación/exportación (Fase 3P):** no implementada, tal como se pidió. Revisión de que el modelo no lo dificulte: **confirmado que no lo dificulta** — todas las entidades tienen campos primitivos (texto/número/fecha/booleano), sin relaciones obligatorias más allá de `businessId` (todo lo demás es opcional), lo que hace un mapeo CSV→CRM directo (una fila = una entidad, columnas = campos escalares + `companyId` resuelto por nombre en un segundo paso). `crm.CustomFieldValue` tampoco complica una exportación (es una tabla EAV estándar, join trivial). Sin bloqueos encontrados.
- **Permisos granulares (Fase 3Q):** ver decisión 6 arriba — el modelo puede evolucionar (`Membership.role` ya es texto libre) sin migración.
- **Integración con Nexo:** cero código de esta fase la toca — ni siquiera se agregó el modelo `NexoLink` diseñado en la Fase 1 (no hacía falta para validar el Core).
- **Email, campañas, Google Calendar, WhatsApp, billing completo, automatizaciones avanzadas:** ninguno se tocó, tal como se pidió explícitamente.

---

## H. Tests

**41 tests, 9 archivos, todos mockeando Prisma** (mismo patrón que Nexo y que la Fase 2 del CRM — `vi.mock("@/lib/prisma", ...)`), ejecutados por `npm test` sin tocar la base real (no hay staging separado, confirmado desde la Fase 3 de Nexo):

| Archivo | Cubre |
|---|---|
| `modules/business/current.test.ts` | Resolución de sesión → Membership (heredado de Fase 2) |
| `modules/workspace/service.test.ts` | `ensureWorkspace` idempotente, `getWorkspace` scopeado |
| `modules/companies/service.test.ts` | Creación, listado/lectura scopeados |
| `modules/contacts/service.test.ts` | Creación, **validación de que `companyId` pertenezca al mismo negocio**, aislamiento |
| `modules/leads/service.test.ts` | Creación (+ Activity), **cambio de estado** (+ Activity de tipo `status_change`), aislamiento |
| `modules/opportunities/service.test.ts` | Creación con validación de pipeline/stage del mismo negocio, **cambio de etapa** (+ Activity `stage_change`), cierre `won` (`closedAt`), aislamiento |
| `modules/tasks/service.test.ts` | Creación, **completar/reabrir**, aislamiento |
| `modules/custom-fields/service.test.ts` | Creación de definición, **`setCustomFieldValue` rechaza una definición de otro Workspace**, lectura combinada definición+valor |
| `modules/security.test.ts` | **Dedicado y explícito**: Business A no puede leer/listar Companies ni Leads de Business B — no es un test implícito dentro de otro módulo, es su propio archivo con ese único propósito, tal como se pidió |

**Validación de integración contra la base real** (temporal, corrida una vez, borrada después — mismo criterio que en todas las fases anteriores): un flujo completo de punta a punta — registro real vía Better Auth → `ensureBusinessMembership` → `ensureWorkspace` → `applyIndustryTemplate("software")` (sembró 1 Pipeline con sus etapas) → crear Company → crear Contact relacionado → crear Lead y cambiarle el estado → crear Opportunity en el pipeline sembrado y moverla de etapa → crear y completar una Task → crear un Tag y asignarlo → definir un Custom Field y setearle un valor → crear un **segundo** negocio completo y confirmar aislamiento total (incluido un intento explícito de `setCustomFieldValue` con un `definitionId` del negocio A desde el negocio B, que correctamente devolvió `null`). **9/9 casos pasaron**, cleanup confirmado (`business A/B residual: false false`).

---

## I. Problemas encontrados

1. **Timeout de test por defecto de vitest (5000ms) insuficiente para operaciones reales que encadenan varias llamadas a Better Auth + Prisma contra la base remota** (registro + `ensureBusinessMembership` + `ensureWorkspace` + `applyIndustryTemplate`, varios round-trips secuenciales). No es un problema de la aplicación — se resolvió corriendo la validación puntual con `--testTimeout=20000`. No afecta a los 41 tests permanentes (mockeados, sin latencia de red).
2. **Un error de tipos al indexar `INDUSTRY_TEMPLATES` con un cast a `never`** en la página de Configuración — corregido casteando al tipo correcto (`IndustryKey`) en vez de `never`. Encontrado y corregido en el mismo checkpoint de `tsc` en el que se introdujo, antes de seguir avanzando.
3. **Dos tests heredados de la Fase 2** (`modules/companies/service.test.ts`, `modules/workspace/service.test.ts`) quedaron desactualizados al extender `getCompany` (ahora incluye relaciones) y `ensureWorkspace` (nuevo `onboardingStep: "industry"` y módulos default ampliados) — se detectaron de inmediato en el primer `npm test` de esta fase y se corrigieron para reflejar el comportamiento real y actual, no el de la Fase 2.

Ningún problema encontrado requirió tocar Nexo ni ninguna tabla de `public.*`/`nexo.*`.

---

## J. Cómo ejecutar localmente

```bash
cd crm
npm install --legacy-peer-deps     # ver crm-fase2-bootstrap.md — bug conocido de npm/vitest
cp .env.example .env.local         # completar con los mismos DATABASE_URL/DIRECT_URL/BETTER_AUTH_SECRET que nexo/.env.local
npm run dev                        # http://localhost:3001
```

Al entrar por primera vez: `/registro` (o `/login` si ya existe la cuenta, misma identidad que Nexo) → `/onboarding` (nombre del negocio si hace falta + tipo de negocio) → `/dashboard`.

Comandos de verificación (todos corridos y en verde en esta fase):

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm test
npm run build
```

---

## Resultado de la fase

## ✅ PASS

- `prisma validate`: ✅
- `prisma generate`: ✅
- `tsc --noEmit`: ✅ 0 errores
- `lint`: ✅ 0 errores, 0 warnings
- `test`: ✅ 41/41 (9 archivos, mockeados, aislamiento probado explícitamente)
- `build`: ✅ 41 rutas, `Compiled successfully`
- Validación de integración real contra Postgres: ✅ 9/9, cero mocks, limpieza total confirmada

**No se modificó Nexo en ningún momento de esta fase.** Las únicas dos migraciones son aditivas y exclusivas de `crm.*`. El único cambio fuera de `crm.*` es una declaración de campo (`Business.logoUrl`) en el schema **del propio repo del CRM**, sobre una columna física que ya existía — cero impacto en Nexo, cero migración.

El CRM tiene ahora un Core real y navegable, construido sobre la identidad compartida y el aislamiento multi-tenant ya validados en las Fases 1 y 2, listo para crecer módulo por módulo (email, calendario, integración con Nexo, billing propio) sin haber comprometido la arquitectura de base.
