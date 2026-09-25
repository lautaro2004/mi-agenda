# CRM (Nodo) — Fase 5: Conversión de Leads y flujo comercial

Primer flujo comercial completo de Nodo: `Lead → Contact → Opportunity`,
con detección de posibles duplicados, idempotencia real (a nivel de base,
no solo de UI) y una transacción atómica. No toca `nexo/` ni `public.*`.

## Auditoría previa (antes de cualquier cambio de schema)

Estado real de los modelos relevantes, confirmado leyendo `prisma/schema.prisma`
y los módulos de servicio antes de tocar nada:

| Modelo | Relevante para esta fase |
|---|---|
| `crm.Lead` | `companyId` ya existe (Company se puede reusar); **no** tenía `contactId` — el propio comentario de `modules/leads/service.ts` ya decía explícitamente "se pospone hasta que exista un flujo real de conversión". `status` es texto libre. |
| `crm.Contact` | `companyId` opcional ya existe. Sin relación a `Lead`. |
| `crm.Opportunity` | `companyId`/`contactId` ya existen. **No** tiene `leadId` — y no hace falta agregarlo (ver "Modelo de datos"). |
| `crm.Pipeline` / `PipelineStage` | ya validan pertenencia a Business vía `modules/pipelines/service.ts`; reutilizados tal cual. |
| `crm.Task` | ya tenía el patrón de FKs directas (no polimórficas) hacia 4 entidades — precedente directo para el diseño de esta fase. |
| `crm.Activity` | polimórfica (`relatedType`/`relatedId`), ya soporta `"lead"`/`"contact"`/`"opportunity"` — sin cambios de modelo, solo un `ActivityType` nuevo (`"converted"`). |
| `StatusDefinition` | ya es el mecanismo de estados configurables para Lead. `DEFAULT_LEAD_STATUSES` tenía `new/contacted/qualified/disqualified` — sin `converted`. Curiosamente, `modules/dashboard/service.ts` ya tenía `"converted"` y `"lost"` en su heurística `CLOSED_LEAD_STATUSES` desde la Fase 3, código muerto hasta ahora porque nada seteaba esos valores — esta fase lo activa. |
| `Tag` / `EntityTag` / `CustomField*` | genéricos, reutilizables sin cambios de modelo. |
| `modules/business/members.ts` | `assertUserBelongsToBusiness` (de la fase de Tareas) reusable tal cual para el responsable de la Opportunity. |

**Conclusión de la auditoría**: no hacía falta ningún modelo nuevo. Solo 3
columnas nuevas en `crm.Lead`.

## Modelo de datos

### `crm.Lead` — 3 columnas nuevas

```
convertedAt            DateTime?
convertedContactId     String?
convertedOpportunityId String?  @unique
```

**Por qué FKs en `Lead` y no al revés (`Contact.sourceLeadId` /
`Opportunity.leadId`)**: la opción B de conversión ("usar contacto
existente") permite que **más de un Lead** termine apuntando al **mismo**
Contact — un `Contact.sourceLeadId` de valor único no podría representar
eso. Poniendo las FKs en `Lead` (el lado que en la práctica es "muchos"),
la cardinalidad real queda bien modelada sin duplicar campos.

**Por qué `convertedOpportunityId` es `@unique` y `convertedContactId` no**:
una conversión **siempre crea una Opportunity nueva** (nunca reutiliza una
existente — no estaba pedido y sería una superficie de bugs mayor sin
necesidad real), así que la relación Lead↔Opportunity es 1:1 por
construcción; el `@unique` lo hace además una garantía de integridad a
nivel de base, no solo una convención de código. `convertedContactId` NO
es único porque, como se explicó arriba, varios Leads pueden compartir el
mismo Contact de destino.

**Por qué no polimórfico**: mismo criterio que `Task` — un Lead se
convierte en, a lo sumo, un Contact y una Opportunity a la vez (dos
relaciones concretas y acotadas), no en un conjunto abierto de tipos de
entidad. `relatedType`/`relatedId` genérico hubiera sido una complejidad
sin beneficio real acá.

**Eliminaciones** (sección 23 del pedido): ambas FK son `onDelete: SetNull`.
- Borrar el Contact/Opportunity resultante **nunca** borra el Lead
  histórico — el Lead simplemente pierde el link vivo (la UI lo muestra
  como "Contacto eliminado").
- Borrar el Lead **nunca** toca el Contact/Opportunity reales — son
  registros de negocio genuinos que deben sobrevivir independientemente de
  que se borre el Lead que los originó. No hay cascada en ningún sentido
  peligroso.

**Back-relations** agregadas (sin columnas nuevas, solo para poder hacer
`include` directo en las queries existentes):
- `Contact.convertedFromLeads Lead[]` (array — coherente con que no es única).
- `Opportunity.convertedFromLead Lead?` (uno a uno — coherente con el `@unique`).

### Migración

`prisma/migrations/20260917220000_lead_conversion/` — exclusivamente
`crm."Lead"` (3 columnas nullable + 1 índice único + 1 índice normal + 2
FKs). Aplicada con el flujo establecido (`db execute` + `migrate resolve`).
Sin pérdida de datos posible: son columnas nuevas, todas nullable.

## Estado del Lead

Se reutilizó `StatusDefinition` — sin sistema de estados nuevo. Se agregó
`{ key: "converted", label: "Convertido", color: "#6366f1" }` a
`DEFAULT_LEAD_STATUSES` (`lib/industry-templates.ts`), así que todo
Workspace nuevo lo tiene desde el onboarding. "LOST" del flujo conceptual
del pedido ya existe hoy bajo el nombre `disqualified` ("Descartado") —
**no se renombra** (arriesgaría romper datos/reportes existentes por un
cambio cosmético) y se documenta acá como decisión explícita: LOST ==
`disqualified` en el modelo actual.

**Invariante protegido en backend, no solo en UI**: `status: "converted"`
solo lo puede setear la transacción de `convertLead()`, nunca el endpoint
general de edición. `modules/leads/service.ts::updateLead` rechaza
explícitamente:
- Setear `status: "converted"` directamente (`use_convert_endpoint`).
- Cambiar el `status` de un Lead que YA está convertido
  (`lead_already_converted`) — "Convertido" es un estado terminal.

Verificado con una request real en el walkthrough: `PATCH /api/leads/:id`
con `{"status":"new"}` sobre un Lead convertido devuelve `400
lead_already_converted`.

## Conversión (`modules/leads/conversion.ts`)

`convertLead(businessId, leadId, input, actorUserId)` — todo el flujo
corre dentro de una única `prisma.$transaction`:

1. Lee el Lead (scopeado por `businessId`) — si no existe, o si
   `convertedAt` ya está seteado, aborta temprano.
2. Contacto: crea uno nuevo (copiando `name`/`email`/`phone`/`companyId`
   del Lead) o valida y reusa uno existente **del mismo Business**.
3. Oportunidad (opcional): valida que Pipeline y Stage sean del mismo
   Business, valida el responsable vía `assertUserBelongsToBusiness`
   (reutilizada de la fase de Tareas, no reimplementada — ver más abajo),
   crea la Opportunity con `companyId`/`contactId` ya resueltos.
4. **Guarda de idempotencia real**: `UPDATE crm."Lead" SET ... WHERE id=?
   AND businessId=? AND "convertedAt" IS NULL`. Si afecta 0 filas —porque
   otra request ganó la carrera entre el paso 1 y este punto— se aborta
   toda la transacción (el Contact/Opportunity que se hubieran creado en
   ESTE intento se revierten) y se informa como ya convertido. Esto es
   más fuerte que un `if` en JavaScript: la propia base es el árbitro.
5. Tags: copia las del Lead al Contact **solo si el Contact es nuevo**
   (ver "Tags" abajo).
6. Activity: `"converted"` en el Lead, `"note"` en la Opportunity si se
   creó.

### Reutilización de lógica de membresías (sección 12)

`assertUserBelongsToBusiness` (`modules/business/members.ts`, creada en la
fase de Tareas) se extendió para aceptar un cliente Prisma opcional
(`client: PrismaOrTx = prisma`) en vez de duplicarla. `convertLead()` le
pasa el cliente de transacción (`tx`) para que la validación del
responsable participe de la misma atomicidad que el resto del flujo; los
callers existentes (Tasks) no pasan nada y siguen usando el cliente global
de siempre — cambio 100% compatible hacia atrás.

### Transacción atómica (sección 22)

Todo el flujo (validar, crear/reusar Contact, crear Opportunity, marcar el
Lead, copiar tags, escribir Activity) corre en una sola
`prisma.$transaction(async (tx) => {...})`. Si cualquier paso falla
—Pipeline de otro Business, Stage inexistente, responsable ajeno,
carrera de idempotencia—, Prisma revierte TODO: no queda un Contact
huérfano sin Opportunity, ni una Opportunity sin el Lead marcado. Verificado
explícitamente con un test (Stage inválido → cero llamadas a
`lead.updateMany` ni a `activity.create`) y con el test de integración en
vivo.

## Detección de contactos existentes (sección 5)

`findPossibleDuplicateContacts(businessId, leadId)` — lee el propio
email/teléfono del Lead (nunca un criterio enviado por el cliente) y busca
`Contact` del mismo Business que matcheen por `email` **o** `phone`. Nunca
usa el nombre como criterio de identidad (pedido explícito). Sin merge
automático: el wizard solo sugiere, la decisión final de usar/crear/cancelar
la toma la persona. Expuesto vía `GET /api/leads/[id]/possible-contacts`.

## Company (sección 9)

El Lead ya tenía `companyId`. Tanto el Contact nuevo como la Opportunity
creada durante la conversión reciben `companyId: lead.companyId` — se
**reutiliza** siempre, nunca se crea una Company nueva en este flujo.
Verificado en el test de integración real.

## Tags (sección 14)

Se copian del Lead al Contact **solo cuando el Contact es nuevo**. Si se
reusa un Contact existente, no se tocan sus tags — copiar etiquetas a una
ficha que ya existía de antes (con su propio historial y contexto) sería
alterar algo ajeno a esta conversión puntual. No se copian tags a la
Opportunity: es un tipo de entidad distinto, sin garantía de que la misma
taxonomía tenga sentido ahí. Ambas decisiones, explícitamente pedidas para
documentar, quedan registradas acá.

## Custom Fields (sección 15) — pospuesto explícitamente

**No implementado en esta fase.** Motivo: `CustomFieldDefinition` está
scopeado por `entityType` (`@@unique([businessId, entityType, key])`), así
que un campo `budget` en Lead y un campo `budget` en Contact son DOS
definiciones distintas sin relación formal entre sí — no hay ninguna
garantía de que el negocio haya definido campos "equivalentes" en ambos
lados, ni una forma no ambigua de inferir cuáles transferir. Resolverlo
bien requeriría un mecanismo de mapeo explícito (ej. "este campo de Lead
corresponde a este campo de Contact") que hoy no existe y que el pedido
mismo autoriza a postergar si resulta demasiado complejo para esta fase.
Queda como deuda técnica documentada, no como un "olvido".

## UI

- **Lead detail** (`app/dashboard/leads/[id]/page.tsx`): botón "Convertir
  Lead" (oculto y reemplazado por un badge "Convertido" una vez que
  `convertedAt` está seteado); card nueva "Convertido en" con links al
  Contact/Opportunity resultantes; el `<select>` de Estado y el control de
  Responsable se reemplazan por texto/badge de solo lectura cuando el Lead
  ya está convertido.
- **Wizard** (`components/leads/convert-lead-action.tsx`): 3 pasos, no más
  (pedido explícito) — Contacto (nuevo/existente, con aviso de posibles
  coincidencias) → Oportunidad (checkbox + Pipeline/Stage/nombre/
  responsable/valor) → Resumen y confirmación. Usa el `Modal` genérico ya
  existente en `components/ui/modal.tsx` (creado en la Fase 3 de UI y sin
  uso real hasta ahora).
- **Contact detail**: card "Origen" con el/los Lead(s) convertido(s) que
  apuntan a este Contact, si hay alguno.
- **Opportunity detail**: card "Origen" con el Lead convertido que la
  originó, si aplica.

## Multi-tenancy (sección 21) — validado en backend, no solo en UI

Todo el flujo pasa `businessId` como primer argumento y lo aplica en cada
`where` dentro de la transacción (Contact, Pipeline, Stage, Membership).
Verificado explícitamente, en mocks y en vivo:
- Business B no puede convertir usando un Contact de Business A
  (`contact_not_found` — el `findFirst` scopeado nunca matchea).
- Business B no puede usar un Pipeline de Business A (`pipeline_not_found`).
- Business B no puede asignar la Opportunity a un usuario de Business A
  (`user_not_in_business`).
- Un Lead de Business A es invisible/no editable desde Business B (ya
  cubierto por el patrón general `resolveWorkspaceContext()` +
  `findFirst({ businessId })` que usa todo el proyecto).

## Tests

**Mockeados** — `modules/leads/conversion.test.ts` (17 casos, cubre los 13
pedidos explícitamente más extras): Contact nuevo, Contact existente,
Contact + Opportunity con Pipeline/Stage correctos, responsable válido,
responsable de otro Business rechazado, Contact de otro Business
rechazado, Pipeline de otro Business rechazado, idempotencia (ya
convertido) e idempotencia por carrera (`updateMany` con `count: 0`),
reutilización de Company, Activity de conversión, fallo de Stage no deja
datos parciales, transferencia de datos Lead→Contact, copia de tags solo
en Contact nuevo, no-copia de tags en Contact existente, y
`findPossibleDuplicateContacts` (por email/teléfono, nunca por nombre;
vacío si el Lead no tiene ninguno de los dos). Se mantuvieron los 73 tests
de fases anteriores intactos — 73/73 antes de esta fase, 90/90 ahora
(73 + 17 nuevos de conversión).

**Integración en vivo** (`modules/leads/conversion.live.test.ts`, borrado
al terminar — no versionado, mismo patrón de fases anteriores): flujo
completo Lead → Contact nuevo + Opportunity real contra la base
compartida, con Activity, reutilización de Company, idempotencia real
(segundo intento no crea un segundo Contact), y aislamiento multi-tenant
cruzado con un segundo Business (Pipeline ajeno y Contact ajeno, ambos
rechazados). 3/3 pasaron; verificado sin residuo tras la limpieza.

**Walkthrough manual por HTTP real** (`npm run dev` + `curl`, sesión real
vía Better Auth): signup → onboarding → crear Lead → convertir (Contact
nuevo + Opportunity con Pipeline/Stage/valor) → verificar 201 con
`convertedContact`/`convertedOpportunity` poblados → reintentar la
conversión (409 `lead_already_converted`, sin duplicar nada) → intentar
revertir el estado manualmente (400, bloqueado por la guarda de
`updateLead`) → verificar el historial (`"Lead creado"` → `"Lead
convertido"`). Datos de prueba limpiados de Postgres al finalizar.

## Validación final

| Check | Resultado |
|---|---|
| `prisma validate` | ✅ |
| `prisma generate` | ✅ |
| `tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ sin errores ni warnings |
| `npm test` (mockeados) | ✅ 90/90 |
| `npm run build` | ✅ compila, 45 rutas generadas |
| Test de integración en vivo | ✅ 3/3, sin residuo |
| Walkthrough HTTP real (dev server) | ✅ camino completo verificado, incluida idempotencia real |

**Resultado: PASS.**

## Deuda técnica y decisiones postergadas

- **Custom Fields**: transferencia Lead→Contact explícitamente NO
  implementada (ver sección dedicada arriba) — requeriría un mecanismo de
  mapeo entre definiciones de distinto `entityType` que no existe hoy.
- **"LOST"**: el flujo conceptual del pedido lo menciona como estado
  propio; en el modelo actual coincide con `disqualified` ya existente —
  no se creó un estado nuevo ni se renombró el existente.
- Igual que en la fase de Tareas, no se pudo verificar el renderizado
  visual del wizard en un navegador real (sin herramienta de automatización
  de browser en este entorno) — la verificación fue por código contra el
  sistema de diseño existente y por comportamiento funcional real vía
  HTTP (incluyendo la detección de posibles duplicados y la idempotencia),
  no por captura visual.
- Explícitamente NO implementado (pedido en la sección 26): Email, Google
  Calendar, automatizaciones, WhatsApp, IA, billing, campañas, forecasting,
  scoring avanzado, lead nurturing, workflows complejos, merge automático
  de contactos, objetos personalizados.
