# CRM — Fase 4: Integración Nexo → Nodo (Leads y origen)

**Estado: EJECUTADA Y VALIDADA.** Primer flujo real de integración entre los dos productos de Kodexa: un turno reservado en Nexo genera un `crm.Lead` real en Nodo, con origen identificable, idempotente, y con aislamiento multi-tenant verificado contra datos reales. `prisma validate`/`generate`/`tsc`/`lint`/`test`/`build`: **todos en verde**. Nexo **no se modificó** en ningún archivo.
**Fecha:** 2026-09-17
**Continúa:** [`crm-fase1-diseno.md`](./crm-fase1-diseno.md), [`crm-fase2-bootstrap.md`](./crm-fase2-bootstrap.md), [`crm-fase3-core.md`](./crm-fase3-core.md).

---

## A. Auditoría de Nexo (Fase 4A) — hecha antes de escribir código

Re-verificado contra el código real de `nexo/` (no contra lo recordado de fases anteriores):

- **Modelo de turnos**: `nexo.Appointment` (`nexo/prisma/schema.prisma:415`). Campos reales confirmados: `id`, `businessId`, `serviceId?`, `serviceName`, `resourceId?`, `customerName`, `customerPhone`, `date` (string), `startTime`/`endTime` (string), `durationMinutes`, `status` (string libre: `pending`/`confirmed`/`cancelled`/`completed`/`no_show`/`pending_payment`/`payment_submitted`/`payment_rejected`), `notes?`, `depositAmount?`, `totalAmount?`, `createdAt`, `updatedAt`.
- **Relación con Business**: `businessId` directo, FK a `public.Business` — el mismo tenant compartido que ya usa el CRM.
- **No existe `customerEmail`** en ningún lado del proyecto (confirmado con grep) — solo teléfono. No se inventó ese dato.
- **No existe ningún campo de origen/canal persistido.** `"customer"` vs `"dashboard"` (visto en `modules/appointments/service.ts::createAppointment`) es únicamente un parámetro de función, usado solo para decidir si se dispara una notificación al dueño — **nunca se escribe en la fila de `Appointment`**. Confirmado con grep del `data` que arma `createAppointment` antes del `prisma.appointment.create`: no incluye ningún campo de origen. **Esto es una limitación real de Nexo**, documentada acá, no resuelta modificando Nexo (ver sección "Nexo — cambios realizados").
- **No existe ningún formulario de contacto genérico ni entidad de marketing/tracking** en Nexo (ya confirmado en la Fase 1 de diseño del CRM, re-confirmado ahora). El único evento de conversión real disponible sigue siendo la reserva de turno.
- **`public.Lead`** es un modelo completamente distinto (pipeline comercial de Kodexa, gente que quiere contratar Nexo/CRM) — no se tocó, no se reutilizó.

**Consecuencia directa de la auditoría:** la sincronización de esta fase trata **todo** `Appointment` de un negocio como una interacción de cliente potencialmente válida para generar un Lead — no hay forma, a nivel de dato, de filtrar solo los "reales" (originados por el cliente) de los cargados a mano por el dueño desde el dashboard de Nexo. Se documenta como limitación conocida y aceptada para esta fase, no como algo a resolver ahora.

---

## B. Modelo de origen (Fase 4B)

Se reutilizó y extendió `crm.Lead` (ya tenía `source: String? @default("manual")`, reservado desde la Fase 3 para este propósito exacto) agregando **un solo campo nuevo**:

```prisma
model Lead {
  // ...
  source    String?  @default("manual")   // "manual" | "nexo_appointment" | "import" (futuro)
  sourceRef String?                        // nuevo — id del registro de origen (hoy: nexo.Appointment.id)
  // ...
  @@unique([businessId, source, sourceRef])
}
```

**Por qué esto y no una tabla `NexoLink` separada** (que sí se había diseñado conceptualmente en la Fase 1): con un solo tipo de origen real hoy (`nexo_appointment`, un Lead ↔ como máximo un Appointment), dos columnas directas en `Lead` + un índice único son la implementación más simple que resuelve exactamente lo pedido ("saber que este lead llegó desde Nexo", con idempotencia real) — sin construir "una arquitectura de marketing completa" ni "un sistema genérico de eventos", tal como se pidió explícitamente. Si en el futuro un Lead necesitara más de una referencia de origen simultánea, ahí sí se justificaría una tabla aparte — no antes.

**Por qué `@@unique([businessId, source, sourceRef])` y no solo `sourceRef`:** scopear también por `businessId` hace que el propio índice de la base sea, además de la garantía de idempotencia, una garantía de aislamiento — es estructuralmente imposible que dos negocios distintos "compartan" una fila por este mecanismo. Postgres no considera dos `NULL` iguales en un índice único, así que los leads manuales (`sourceRef: null`) nunca chocan entre sí por esto.

---

## C. Capa de integración — `modules/nexo/`

Tal como se pidió, se creó una capa específica y única, y el resto de la aplicación no conoce el modelo Prisma de Nexo:

```
modules/nexo/
├── appointments.ts   — adapter de SOLO LECTURA. Único archivo autorizado a
│                       usar el modelo Prisma `Appointment` (espejo de
│                       nexo.Appointment). Expone un tipo propio
│                       (`NexoAppointment`), nunca el tipo generado por
│                       Prisma. Dos funciones: listNexoAppointments(businessId),
│                       getNexoAppointment(businessId, id) — ambas scopeadas
│                       por businessId siempre.
└── sync-leads.ts     — la lógica de sincronización en sí (sección D).
```

**Mecánica técnica** (mismo patrón ya evaluado y aceptado en la Fase 1 de diseño del CRM): se agregó `"nexo"` al array `schemas` de `crm/prisma/schema.prisma`, y se declaró un modelo `Appointment` **parcial** — solo los 10 campos que el CRM necesita leer (`id`, `businessId`, `serviceName`, `customerName`, `customerPhone`, `date`, `startTime`, `status`, `createdAt`, `updatedAt`), no los 15 reales. La tabla física ya existe (la creó y la migra Nexo) — **no se generó ninguna migración para esto**, solo una declaración de cliente + `prisma generate`.

**El contrato de "solo lectura" es una convención de código, no una restricción que Prisma imponga técnicamente** — se documenta así explícitamente, sin sobrevender la garantía: cualquier archivo del repo del CRM PODRÍA técnicamente llamar a `prisma.appointment.create(...)`, nada a nivel de tipos lo impide. La disciplina real es "solo `modules/nexo/*.ts` importa/usa este modelo", reforzada por code review, no por el compilador. Un hallazgo real de esta fase (sección G) confirma además que el modelo, tal como está declarado, ni siquiera **puede** usarse para escribir sin fallar (columnas `endTime`/`durationMinutes`, NOT NULL en la tabla real, no declaradas en el espejo) — una protección accidental pero real contra escrituras accidentales desde el CRM.

---

## D. Nexo booking → CRM Lead (Fase 4C) — casos definidos

`modules/nexo/sync-leads.ts::syncLeadsFromNexoAppointments(businessId)`:

```
para cada nexo.Appointment de este businessId:
  ¿ya existe un crm.Lead con (businessId, source: "nexo_appointment", sourceRef: appointment.id)?
    SÍ → no tocar nada, skipped++
    NO → crear el Lead (name, phone, status: "new", source, sourceRef)
         + una Activity ("Lead creado desde una reserva en Nexo…")
         created++
```

| Caso del pedido | Comportamiento elegido | Motivo |
|---|---|---|
| **1. Cliente nuevo de Nexo** | Crea un Lead nuevo. | Caso base. |
| **2. Cliente ya existente en Nodo** (mismo teléfono, turno distinto) | **Crea igual un Lead nuevo, uno por Appointment** — no se deduplica por teléfono/email entre distintos turnos. | Deduplicar por cliente es, en esencia, la conversión Lead→Contact (unificar identidad de una persona a través de varias interacciones) — explícitamente pospuesta por el pedido ("no implementar todavía Lead→Contact→Opportunity"). Resolverlo acá hubiera sido construir esa lógica por la puerta de atrás. Documentado como decisión explícita, no un descuido. |
| **3. Mismo booking procesado dos veces** | No duplica — el índice único `(businessId, source, sourceRef)` lo garantiza a nivel de base, no solo de código. | Pedido explícito de idempotencia real, no "probablemente no duplica". |
| **4. Booking cancelado** | **La sincronización es create-only: si el Lead ya existe, no se toca absolutamente nada** (ni `status`, ni datos de contacto), sin importar el `status` actual del Appointment. | "No asumir automáticamente qué debe pasar con el Lead" — en vez de inventar una regla (¿lo descalifico? ¿lo dejo? ¿aviso?), se optó por **nunca pisar una decisión que ya tomó un humano del CRM sobre ese Lead**. El estado real y actual del turno se ve en vivo en el detalle del Lead (ver sección E) — nunca queda una copia vieja mostrando "confirmado" cuando en Nexo ya está cancelado. |
| **5. Booking reprogramado** | No duplica. | `rescheduleAppointment` en Nexo actualiza la MISMA fila (mismo `id`) — nunca crea un Appointment nuevo. El `sourceRef` no cambia, así que la sincronización lo encuentra como "ya existente" sin ninguna lógica especial. |

**Contactos:** tal como se pidió, no se implementó la conversión Lead→Contact. El Lead sincronizado guarda `name`/`phone` directamente en sus propios campos (ya existían en el modelo) — sin agregar ninguna relación nueva hacia `Contact` "por las dudas".

---

## E. Origen visible en vivo, no sincronizado

En vez de copiar/cachear `serviceName`/`date`/`status` del Appointment dentro del Lead en el momento de la sincronización (lo que los dejaría desactualizados si el turno se cancela o reprograma después), el detalle de un Lead con `source: "nexo_appointment"` hace una **lectura en vivo** de `nexo.Appointment` vía `getNexoAppointment(businessId, lead.sourceRef)` en el momento de renderizar la página. Esto resuelve los Casos 4 y 5 (cancelación/reprogramación) sin ninguna lógica de sincronización especial: lo que se ve siempre es la verdad actual de Nexo, nunca una copia. Documentado explícitamente en el propio código (`app/dashboard/leads/[id]/page.tsx`) y en la UI ("Se lee en vivo desde Nexo…").

---

## F. Multi-tenancy — verificado, no solo declarado

`businessId` **siempre** viene de `resolveWorkspaceContext()` (la sesión del usuario del CRM) — la ruta `POST /api/nexo/sync-leads` no acepta ningún body, no hay forma de pedirle que sincronice "otro" negocio. `listNexoAppointments`/`getNexoAppointment` reciben `businessId` como primer argumento y lo aplican en el `where` de la consulta a `nexo.Appointment` — el mismo campo `businessId` que ya es la columna real de esa tabla en Nexo (mismo tenant compartido, mismo id de `public.Business`).

Verificado con datos reales (sección H): un turno creado para el Business A **nunca** aparece al sincronizar el Business B, y `getNexoAppointment(businessB, <id de un turno de A>)` devuelve `null` — no un error, no el dato — exactamente el comportamiento esperado.

---

## G. Método de sincronización — decisión y motivo

Se evaluaron polling automático (cron) y un botón manual bajo demanda. **Se eligió el botón manual para esta fase** ("Sincronizar con Nexo" en `/dashboard/leads`, `POST /api/nexo/sync-leads`):

- No existe infraestructura de cron en el repo del CRM todavía (a diferencia de Nexo, que sí tiene `CRON_SECRET` y endpoints internos) — construirla ahora sería infraestructura nueva no pedida para "probar primero el flujo funcional".
- Es la forma más simple que demuestra el flujo de punta a punta con datos reales, sin comprometerse a una cadencia ni a un scheduler externo todavía.
- La función `syncLeadsFromNexoAppointments` no tiene ninguna dependencia de "cómo se la llama" — un cron real, en una fase futura, sería literalmente el mismo código detrás de un endpoint `/api/cron/sync-nexo-leads` protegido con un secret (mismo patrón que ya usa Nexo) en vez de un botón. Se documenta como el paso siguiente natural, no se construye ahora.

---

## H. Tests

**8 tests unitarios nuevos** (mockeados, `modules/nexo/sync-leads.test.ts`), sumados a los 41 ya existentes — **49/49 en total**:

| Caso del pedido | Test |
|---|---|
| 1. Booking nuevo → Lead nuevo | ✅ (+ Activity registrada) |
| 2. Mismo booking dos veces → un solo Lead | ✅ (`findUnique` scopeado, `create` nunca llamado la segunda vez) |
| 3/4. Booking de A → Lead en Workspace A, nunca B | ✅ (dos tests: `businessId` propagado correctamente; sincronizar B nunca toca datos de A) |
| 5. Datos incompletos | ✅ (teléfono vacío no crashea, se crea igual con lo disponible) |
| 6. Booking cancelado | ✅ (Lead ya existente: `create` nunca se llama, sin importar el status del Appointment) |
| 7. Booking reprogramado | ✅ (mismo `sourceRef` → tratado como ya existente) |
| 8/9. Fuente y referencia correctamente almacenadas | ✅ (`source`/`sourceRef` exactos en el `data` del create) |

**10. Integración con datos reales de Supabase** (temporal, corrida una vez, borrada después — mismo criterio que todas las fases anteriores): creó dos negocios reales completos (Business + Workspace), un turno **real** en `nexo.Appointment` (única escritura de este repo sobre `nexo.*`, documentada como excepción solo para fixtures de test — la aplicación nunca escribe ahí), sincronizó, confirmó 1 Lead creado con el `sourceRef` correcto, sincronizó de nuevo y confirmó 0 duplicados, sincronizó el segundo negocio y confirmó 0 leads (no tiene turnos propios), y confirmó que `getNexoAppointment` desde el segundo negocio no puede leer el turno del primero. **6/6 casos pasaron**, limpieza total confirmada (turno + ambos negocios + ambos usuarios eliminados).

---

## I. Migraciones

**Una migración nueva, exclusiva de `crm.*`:** `20260917150000_add_lead_source_ref` — `ALTER TABLE crm."Lead" ADD COLUMN "sourceRef"` + el índice único. Aplicada con el mismo mecanismo seguro de las fases anteriores (`db execute` + `migrate resolve --applied`, nunca `migrate dev`). Re-confirmado después de aplicarla: `prisma migrate status` desde el CRM sigue viendo exactamente sus propias migraciones (ahora 3), y desde Nexo sigue viendo las suyas (25) sin ninguna interferencia — mismo comportamiento ya validado en la Fase 2.

**Ninguna migración sobre `public.*` ni `nexo.*`.** El modelo espejo `Appointment` no generó ninguna migración — la tabla ya existe, es propiedad de Nexo.

---

## Nexo — cambios realizados

**Ninguno.** Cero archivos de `nexo/` tocados en esta fase. La limitación real encontrada en la auditoría (Appointment no distingue origen "cliente" vs "dashboard") se documentó y se decidió **no resolverla modificando Nexo** — hubiera significado agregar una columna y un punto de escritura nuevo a un modelo de Nexo para una distinción que esta fase puede vivir sin ella (se sincroniza todo, documentado como limitación aceptada). Si en una fase futura se decide que la distinción es necesaria, debe evaluarse como un cambio propio y justificado de Nexo, no colarse acá.

---

## Limitaciones conocidas (no ocultadas)

1. **No se puede distinguir un turno originado por un cliente real de uno cargado a mano por el dueño desde Nexo** — ambos generan un Lead igual. Ver auditoría (sección A).
2. **No hay deduplicación de clientes entre distintos turnos** — un mismo teléfono que reserva 3 veces genera 3 Leads (Caso 2). Documentado como decisión explícita, pospuesta hasta la conversión Lead→Contact.
3. **Sincronización manual únicamente** — no hay cron todavía (sección G).
4. **Sin email** — Nexo no lo captura, así que ningún Lead sincronizado desde acá lo tiene.
5. **El modelo espejo `Appointment` no puede usarse para crear filas reales** (le faltan columnas NOT NULL de la tabla física) — hallazgo real de esta fase, documentado en la sección C; no es un bug a arreglar, es consistente con que el modelo debe ser (y ahora efectivamente es, aunque sea por un efecto colateral) de solo lectura.

## Decisiones postergadas

- Conversión automática Lead → Contact → Opportunity.
- Deduplicación de clientes por teléfono/email a través de múltiples turnos.
- Sincronización automática (cron/webhook/outbox) — sigue siendo manual.
- Persistencia de origen "customer" vs "dashboard" en Nexo (requeriría modificar Nexo, no se justificó para esta fase).
- Cualquier otra fuente de Nexo más allá de `Appointment` (formularios, WhatsApp — este último bloqueado además por la falta de persistencia de conversaciones, ya documentado en fases anteriores).

---

## Resultado final

## ✅ PASS

| Verificación | Resultado |
|---|---|
| `prisma validate` | ✅ |
| `prisma generate` | ✅ |
| `tsc --noEmit` | ✅ 0 errores |
| `lint` | ✅ 0 errores, 0 warnings |
| `test` | ✅ 49/49 (41 heredados + 8 nuevos de esta fase) |
| `build` | ✅ 42 rutas (+1 sobre la Fase 3: `/api/nexo/sync-leads`) |
| Integración real contra Supabase | ✅ 6/6, limpieza total confirmada |
| Aislamiento multi-tenant | ✅ verificado explícitamente, mock y real |
| Migraciones | ✅ 1 nueva, exclusiva de `crm.*`, convivencia con `_prisma_migrations` de Nexo re-confirmada |
| Cambios en Nexo | **Ninguno** |

**Demostrado exactamente lo pedido:** un cliente reserva un turno en Nexo → el registro vive en `nexo.Appointment` → `modules/nexo/sync-leads.ts` lo sincroniza → aparece como `crm.Lead` real, visible en `/dashboard/leads` con su origen ("Nexo — Reserva") → sin duplicarse si se sincroniza de nuevo → sin que un negocio pueda ver o generar datos en el Workspace de otro.
