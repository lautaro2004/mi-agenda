# CRM — Mejora del módulo de Tareas

Evoluciona `crm.Task` de un checklist mínimo (título/checkbox/fecha) a una
unidad de trabajo real del CRM: descripción, prioridad, asignación validada
por Membership, relaciones con Company/Contact/Lead/Opportunity, archivos
adjuntos (Supabase Storage) y un historial unificado con Activity. No toca
`nexo/` ni `public.*` en ningún punto.

## Modelo de datos

### `crm.Task` (reescrito)

| Campo | Tipo | Notas |
|---|---|---|
| `title` | String | sin cambios |
| `description` | String? | textarea simple, sin rich-text |
| `status` | String | `todo` \| `in_progress` \| `completed` \| `cancelled` — texto libre validado en TS/Zod, no enum nativo de Postgres (mismo criterio que el resto del proyecto) |
| `priority` | String | `low` \| `medium` \| `high` \| `urgent`, default `medium` |
| `startDate` / `dueAt` / `completedAt` | DateTime? | `completedAt` se setea/limpia automáticamente al completar/reabrir |
| `ownerId` | String? | responsable — validado contra `public.Membership` del mismo Business, nunca confiado del cliente |
| `createdById` | String? | quién la creó |
| `companyId` / `contactId` / `leadId` / `opportunityId` | String? | **FKs directas, no polimórficas** — una tarea puede relacionarse con varias entidades a la vez (ej. Company + Opportunity), algo que `relatedType`/`relatedId` de valor único no puede representar. `onDelete: SetNull` en las cuatro. |

Se eliminaron los campos `relatedType`/`relatedId` que tenía la versión
anterior.

### `crm.TaskAttachment` (nuevo)

Metadata únicamente — nunca el binario. `businessId`, `taskId`, `fileName`,
`storagePath`, `mimeType`, `fileSizeBytes`, `uploadedById`, `createdAt`.
`onDelete: Cascade` con `Task`.

### Decisión: comentarios = `Activity`, no un modelo nuevo

Se evaluó `TaskComment` como modelo separado y se descartó: un comentario es
estructuralmente una `Activity` (`type: "comment"`, `relatedType: "task"`).
Crear un modelo aparte hubiera significado dos sistemas de historial
paralelos para la misma entidad. Se extendió `ActivityType` con los valores
que necesita el historial de una tarea: `comment`, `assigned`,
`priority_changed`, `due_date_changed`, `attachment_added` (además de los ya
existentes `note`/`status_change`). Cada mutación relevante de
`modules/tasks/service.ts` y `modules/tasks/attachments.ts` escribe su propia
Activity — es el único punto de escritura de historial, sin duplicar lógica.

### Migración

`prisma/migrations/20260917200000_task_upgrade/` — agrega columnas, migra
filas existentes (`status: "pending"` → `"todo"`), agrega FKs/índices, crea
`TaskAttachment`. Aplicada con el flujo establecido (`db execute` +
`migrate resolve --applied`, nunca `migrate dev` contra la base compartida).
Verificada en vivo sin pérdida de datos sobre la única fila real existente.

## Multi-tenancy

Todo el módulo sigue el mismo patrón que el resto del CRM:
`businessId` como primer argumento de cada función, aplicado en cada
`where`. Específicamente para Tareas:

- **Asignación**: `assertUserBelongsToBusiness` (`modules/business/members.ts`)
  valida contra `Membership` antes de guardar `ownerId` — tanto al crear
  como al reasignar. Un `userId` de otro Business lanza `user_not_in_business`
  y no se persiste nada.
- **Relaciones**: `assertRelationsBelongToBusiness`
  (`modules/tasks/service.ts`) valida Company/Contact/Lead/Opportunity contra
  el mismo `businessId` antes de asociarlas.
- **Lectura/escritura**: `findFirst({ where: { id, businessId } })` en cada
  operación — un id real de otro Business nunca matchea.
- **Adjuntos**: `assertTaskBelongsToBusiness` en `modules/tasks/attachments.ts`
  antes de subir; `listTaskAttachments`/`getAttachmentDownloadUrl`/
  `deleteTaskAttachment` scopeados por `businessId` en cada query.

Cubierto por tests explícitos (ver sección Tests) y por el walkthrough en
vivo: un Business B no puede leer, editar, comentar ni asignar la tarea de
un Business A.

## Archivos adjuntos (Supabase Storage)

Mismo proyecto de Supabase que Nexo, mismo patrón que
`nexo/lib/payment-proofs.ts` (bucket privado, path `{businessId}/{taskId}/
{uuid}-{nombre}`, nunca URL pública ni binario en Postgres, descarga vía
signed URL de 120s generada bajo demanda).

- Bucket: `task-attachments`, privado, creado de forma **perezosa e
  idempotente** (`ensureBucket()` dentro de `uploadTaskAttachment`, no un
  script de infraestructura aparte).
- Tipos permitidos: PDF, DOC/DOCX, XLS/XLSX, ZIP, imágenes (jpeg/png/webp/gif).
- Tamaño máximo: 20MB.
- Cada subida registra una Activity `attachment_added`.
- Endpoints: `POST/GET /api/tasks/[id]/attachments` (subir/listar),
  `GET/DELETE /api/tasks/attachments/[id]` (link de descarga / borrar).

**Nota de proceso**: un intento inicial de crear el bucket con un script
Node standalone (leyendo la service-role key directamente) fue bloqueado por
el clasificador de modo automático de Claude Code ("Credential Leakage").
Se resolvió moviendo la creación del bucket a código de aplicación real
(la función `uploadTaskAttachment`), sin scripts sueltos que toquen
credenciales fuera del path de la app. El bucket se verificó creado y
funcional recién durante el test de integración en vivo y el walkthrough
por HTTP real (subida, descarga, borrado — los tres contra Supabase real).

## Endpoints nuevos/modificados

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/tasks?view=&status=&priority=&q=` | filtros: vista (`all/mine/overdue/today/upcoming/completed`), estado, prioridad, búsqueda por título/descripción |
| `POST` | `/api/tasks` | crea, pasa `createdById` real de la sesión |
| `PATCH` | `/api/tasks/[id]` | pasa `actorUserId` real para el historial |
| `GET` | `/api/workspace/members` | lista de miembros del Business — picker de responsable |
| `GET/POST` | `/api/tasks/[id]/attachments` | listar / subir adjunto |
| `GET/DELETE` | `/api/tasks/attachments/[id]` | link de descarga / borrar |
| `POST` | `/api/activities` (ya existía) | reutilizado para comentarios (`type: "comment"`, `relatedType: "task"`) — sin endpoint dedicado nuevo |

## UI

- **Lista** (`/dashboard/tareas`): tabs por vista (Todas/Mis tareas/
  Vencidas/Hoy/Próximas/Completadas) vía query param `?view=`, búsqueda y
  filtro de prioridad (`TaskFilterBar`), filas tipo card con empresa/
  oportunidad, responsable, badge de prioridad y fecha (roja si está
  vencida), checkbox de completado rápido.
- **Detalle** (`/dashboard/tareas/[id]`): Encabezado (estado editable +
  prioridad), Contexto (descripción), Responsabilidad (selector de
  responsable + creador), Fechas, Relacionado con (chips a Company/Contact/
  Lead/Opportunity), Archivos (subir/descargar/borrar), Comentarios e
  historial (timeline de Activity + form de comentario).
- **Formulario** (`/dashboard/tareas/nueva` y `.../[id]/editar`): título,
  descripción, prioridad, fechas, responsable, y las 4 relaciones — mismo
  componente (`TaskForm`) para alta y edición.
- **Entidades relacionadas**: Company/Contact/Lead/Opportunity muestran una
  card "Tareas relacionadas" (`RelatedTasksList`) en su página de detalle.
- **Dashboard**: además de "Tareas pendientes" (ahora corregido — ver Bug
  encontrado), se agregaron "Tareas vencidas" y "Para hoy", ambas como
  `COUNT` real sobre `Task`, no métricas inventadas.

## Bug encontrado y corregido (no reportado por el usuario)

`modules/dashboard/service.ts` filtraba `pendingTasksCount` por
`status: "pending"` — el valor viejo, previo a este cambio de vocabulario.
Tras la migración a `todo/in_progress/completed/cancelled` esa métrica
hubiera devuelto silenciosamente `0` para siempre. Se detectó al extender el
dashboard y se corrigió antes de que llegara a producción.

## Notificaciones — arquitectura preparada, no implementada

Cada evento relevante (asignación, reasignación, cambio de prioridad/fecha,
completado, comentario, adjunto) ya queda registrado como `Activity` con
`ownerId` (actor) y `relatedId` (tarea). Esa tabla es la fuente de eventos
que un futuro sistema de notificaciones (email/push) consumiría sin
necesitar un modelo nuevo — no se implementa el envío en esta fase.

## Explícitamente NO implementado en esta fase

Google Calendar, email/recordatorios, automatizaciones, tareas recurrentes,
motor de workflow, dependencias entre tareas, subtareas, time tracking,
Kanban de tareas.

## Tests

**Mockeados** (73 tests totales, 24 nuevos de esta fase):

- `modules/tasks/service.test.ts` (18 casos): crear con descripción, crear
  con prioridad (explícita y default), conversión de fechas, asignar a
  usuario del mismo Business + Activity `assigned`, bloquear asignación a
  usuario de otro Business, asociar Company/Contact/Lead/Opportunity (+ sus
  rechazos), cambiar status, cambiar assignee, completar (+ `completedAt`),
  reabrir (+ limpieza de `completedAt`), aislamiento multi-tenant en
  `completeTask`/`updateTask`/`listTasks`, agregar comentario (+ rechazo
  cross-tenant).
- `modules/tasks/attachments.test.ts` (7 casos): subir + Activity, rechazo
  cross-tenant, rechazo de tipo no permitido, rechazo de tamaño excedido,
  aislamiento multi-tenant en listar/descargar/borrar.
- `modules/business/members.test.ts` (3 casos): listar miembros, validar
  pertenencia (caso positivo y negativo).

**Integración en vivo** (contra la base real, no versionada — mismo patrón
que fases anteriores): crear tarea con descripción/prioridad/Company/
Opportunity, asignar a un segundo usuario real del mismo Business, bloquear
asignación a usuario de otro Business, cambiar estado, completar/reabrir,
comentar, **subir/listar/descargar/borrar un adjunto real contra Supabase
Storage**, y aislamiento multi-tenant completo (lectura, edición, comentario
bloqueados desde otro Business). 8/8 pasaron; verificado sin residuo en la
base tras la limpieza.

**Walkthrough manual por HTTP real** (`npm run dev` + `curl`, sesión real
vía Better Auth): signup → onboarding → crear tarea → asignarse →
"Mis tareas" → comentar → subir adjunto real → generar link de descarga →
completar tarea → verificar historial completo (`note` → `assigned` →
`attachment_added` → `comment` → `status_change: Completada`). Confirmó
además que acentos/UTF-8 se persisten correctamente. Datos de prueba
limpiados de Postgres al finalizar.

**Deuda técnica conocida y menor**: el walkthrough manual subió un archivo
de prueba real a Supabase Storage y se borró su fila de `TaskAttachment`
directamente por script de limpieza (en vez de vía `deleteTaskAttachment`),
por lo que el archivo físico (13 bytes, ruta con el `businessId` de prueba
ya eliminado, bucket privado) quedó huérfano en Storage. Sin impacto
funcional ni de seguridad — no es accesible sin la service-role key — pero
se documenta para un barrido de limpieza futuro si se agrega un cron de
huérfanos (mismo patrón que Nexo ya tiene para `payment-proofs`).

## Validación final

| Check | Resultado |
|---|---|
| `prisma validate` | ✅ |
| `prisma generate` | ✅ |
| `tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ sin errores ni warnings |
| `npm test` (mockeados) | ✅ 73/73 |
| `npm run build` | ✅ compila, 43 rutas generadas |
| Test de integración en vivo | ✅ 8/8, sin residuo |
| Walkthrough HTTP real (dev server) | ✅ camino completo verificado |

**Resultado: PASS.**

No se pudo verificar el renderizado visual real en navegador (sin
herramienta de automatización de browser disponible en este entorno) — la
verificación de UI se hizo por inspección de código contra el sistema de
diseño existente (`components/ui/primitives.tsx`) y por el comportamiento
funcional real vía HTTP, no por captura visual. Se recomienda una pasada
visual manual antes de considerar la fase completamente cerrada de cara a
usuarios reales.
