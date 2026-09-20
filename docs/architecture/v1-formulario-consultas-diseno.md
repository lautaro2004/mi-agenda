# V1 — Formulario de consultas del sitio público → Lead de Nexo/CRM (diseño técnico)

**Estado:** diseño, sin implementar. Ver `docs/product/roadmap.md` sección "V1" y `docs/product/vision.md` sección 6.4.

Este documento responde a la pregunta "¿cómo se construye V1 reutilizando al máximo lo que ya existe?", **no** es una implementación. No incluye código, solo la forma de los cambios y los archivos que tocaría.

---

## 1. Cómo funciona hoy la sincronización de turnos hacia el CRM (punto de partida)

Antes de diseñar el camino nuevo, esto es lo que ya existe y que el diseño de abajo reutiliza tal cual:

1. **Nexo no sabe que el CRM existe.** No hay ninguna llamada saliente desde Nexo hacia el CRM. Todo el puente vive del lado del CRM.
2. **El CRM define un adapter de solo lectura** sobre las tablas de Nexo: `crm/modules/nexo/appointments.ts` declara un mirror parcial del modelo `Appointment` en su propio `schema.prisma` (con `"nexo"` agregado a su propio array de `schemas`), genera un cliente Prisma para leerlo, y por convención de código (no por Prisma) solo ese archivo puede importar ese modelo — el resto del CRM usa un tipo de dominio propio (`NexoAppointment`).
3. **`crm/modules/nexo/sync-leads.ts::syncLeadsFromNexoAppointments(businessId)`** hace un check-then-create por cada `Appointment` del negocio: si ya existe un `crm.Lead` con `source: "nexo_appointment"` y `sourceRef: appointment.id` (índice único `@@unique([businessId, source, sourceRef])`), no hace nada; si no existe, crea un `Lead` nuevo y le agrega el detalle del turno como una nota (`crm.Activity`), no como columnas nuevas. Nunca actualiza un Lead ya creado, aunque el turno de origen cambie de estado después.
4. **Se dispara manualmente** desde un botón del CRM ("Sincronizar con Nexo"), que llama a `POST /api/nexo/sync-leads` (en el repo del CRM). El `businessId` sale siempre de la sesión (`requireWorkspace()`), nunca del body del request. No hay cron todavía.

**Lo que V1 necesita replicar es exactamente esta forma** (adapter de solo lectura + sync idempotente por `source`/`sourceRef`), aplicada a un segundo tipo de origen (consultas del sitio público) en lugar de turnos.

---

## 2. Auditoría — estado actual verificado

| Pieza | Estado |
|---|---|
| Formulario de contacto/consulta genérico en el sitio público | **No existe.** `app/s/[slug]/page.tsx` no tiene ninguna sección de este tipo; ambas plantillas (`landing`, `booking`) solo tienen reserva de turno. |
| Modelo de datos para "consulta" (independiente de `Appointment`) | **No existe.** El único modelo con forma similar es `Lead` (`schema("public")`), que es el pipeline comercial **de Kodexa** (prospectos de negocios que quieren contratar Nexo) — no debe reutilizarse para consultas de clientes finales de *un* negocio, sería una colisión semántica grave (dos negocios de dueños distintos terminarían compartiendo la misma tabla de "clientes potenciales"). |
| Patrón de endpoint público + validación | **Existe y es reutilizable.** `getBusinessIdBySlug(slug)` → `zod.safeParse()` → función de servicio → `NextResponse.json`. Ver `app/api/public/[slug]/book/route.ts`. |
| Patrón anti-spam (rate limit + honeypot) | **Existe y es reutilizable**, pero solo en `app/api/leads/route.ts` (formulario comercial de Kodexa) — `book/route.ts` no lo tiene porque reservar un turno ya tiene fricción natural (elegir fecha/hora disponible). Un formulario de "dejanos tu consulta" no tiene esa fricción, así que si se agrega, es el formulario de leads el que hay que imitar, no el de booking. Ver `isRateLimited()` en `lib/rate-limit.ts` y el campo honeypot `website` en `leadFormSchema` (`lib/schemas.ts`). |
| Sistema de notificaciones | **Existe, genérico y extensible sin tocar UI.** `NOTIFICATION_TYPES` es una tupla fija en `modules/notifications/service.ts`; agregar un tipo nuevo (`inquiry_received`) más una función `notifyInquiryReceived()` (mismo molde que `notifyBookingCreated`) no requiere ningún cambio en la campanita del dashboard, que ya es genérica. |
| Componentes de UI reutilizables para el formulario | **Existen y ya se usan tanto en dashboard como en sitio público.** `components/ui/{button,input,select,field}.tsx` (`Field`/`FieldError`/`FieldGroup`/`FieldLabel`), con `react-hook-form` + `zodResolver` + `{...register(...)}}`. Confirmado en `components/public-site/booking-widget.tsx` (líneas 9-12 de imports) y en `lib/schemas.ts` (`manualAppointmentSchema`, `leadFormSchema`). El formulario nuevo debe armarse con exactamente estas piezas, no con un diseño paralelo. |
| WhatsApp contextual (CTA con mensaje prellenado) | **El helper ya existe y ya se usa una vez.** `lib/whatsapp-link.ts::buildWhatsappHref(number, message?)` arma el link `wa.me` con mensaje prellenado. Ya hay un uso real en `components/public-site/booking/booking-important-info.tsx` (una card con ícono + texto que invita a preguntar por WhatsApp *después* de reservar). No hace falta ningún helper nuevo, solo nuevos call-sites. |
| Sincronización Nexo → CRM | **Existe, pero solo para turnos.** Ver sección 1. No hay ningún puente hoy para "consultas", porque el origen no existe. |
| Autenticación/autorización | Sin cambios respecto de `docs/product/inventario-actual.md`: Better Auth, un solo rol implícito (`"owner"`), sin roles reales todavía. **El endpoint nuevo es público (sin sesión)**, igual que `book/route.ts` — no hay nada de auth que audite acá más allá de que el negocio exista (`getBusinessIdBySlug`). |

**Conclusión de la auditoría:** todas las piezas de infraestructura que V1 necesita ya existen, excepto el modelo de datos de la consulta en sí y el endpoint/formulario que lo alimenta. No hace falta inventar mecanismo nuevo alguno (notificaciones, anti-spam, sync al CRM, diseño de UI) — todo se extiende con la misma forma que ya tienen.

---

## 3. Diseño técnico propuesto

### 3.1. Modelo de datos (Nexo, schema `nexo`)

Nuevo modelo `Inquiry` (nombre tentativo — a validar), paralelo a `Appointment` en estructura, **no anidado dentro de él**:

- `id` (`cuid()`), `businessId` (FK a `Business`, `onDelete: Cascade`, mismo patrón que `Appointment`).
- `customerName`, `customerWhatsapp`, `customerEmail`, `message`.
- `status`: string simple (`"new"` por default — sin estado intermedio de pago, a diferencia de `Appointment`, porque una consulta no tiene ciclo de vida de pago). Suficiente para que el dashboard eventualmente pueda marcarla como atendida, sin necesitarlo para V1.
- `createdAt`/`updatedAt`.
- Índice `@@index([businessId])`, igual que `Appointment`.

Migración nueva: `YYYYMMDDHHMMSS_add_inquiry`, siguiendo la convención existente.

**Por qué un modelo nuevo y no reusar `Lead`:** `Lead` (`schema("public")`) es el pipeline de ventas de Kodexa (negocios que quieren contratar Nexo), con su propio ciclo (`LEAD_STATUSES`, conversión a `Business`). Una consulta de un cliente final hacia *un negocio que ya usa Nexo* es un concepto completamente distinto, un nivel más abajo en la jerarquía. Confundirlos mezclaría los leads comerciales de Kodexa con los leads de cada negocio cliente en la misma tabla.

### 3.2. Endpoint nuevo

`POST /api/public/[slug]/inquiry` (nuevo archivo, mismo directorio que `book/route.ts`), mismo esqueleto:

1. `getBusinessIdBySlug(slug)` → 404 si no existe.
2. Rate limit por IP (reusar `isRateLimited`, mismo `key` prefix pattern que `leads`, ej. `inquiry:${ip}`) — a diferencia de `book/route.ts`, este endpoint SÍ lo necesita, porque no tiene la fricción natural de elegir un horario.
3. `inquirySchema.safeParse(body)` (nuevo schema en `lib/schemas.ts`, ver 3.3).
4. Si el honeypot viene con contenido: responder 201 falso sin crear nada (mismo comportamiento silencioso que `leadFormSchema`/`app/api/leads/route.ts`).
5. Crear el registro (`createInquiry` en un módulo de servicio nuevo, `modules/inquiries/service.ts`, espejo de `modules/appointments/service.ts` pero mucho más simple: sin disponibilidad, sin recursos, sin seña).
6. Llamar a `notifyInquiryReceived()` (best-effort, no bloqueante, mismo patrón que el resto de `notify*`).
7. `NextResponse.json({ inquiry: ... }, { status: 201 })`.

### 3.3. Validación

Nuevo `inquirySchema` en `lib/schemas.ts`, modelado sobre `manualAppointmentSchema` (estructura) y `leadFormSchema` (campos de contacto + honeypot):

- `customerName`: string, min 2.
- `customerWhatsapp`: string, min 6 (mismo criterio laxo que `customerPhone` en `manualAppointmentSchema` — no se valida formato de número, solo longitud mínima).
- `customerEmail`: string, `.email()`.
- `message`: string, min 1, max razonable (ej. 500, igual que `leadFormSchema.message`).
- `website`: honeypot opcional, sin restricciones, igual que en `leadFormSchema`.

Solo los 4 campos que pidió el usuario (nombre, WhatsApp, email, consulta) — sin campos configurables por negocio en V1, eso sería una complejidad no pedida.

### 3.4. Cómo se evitan duplicados

Del lado de Nexo no hace falta deduplicar — cada submit del formulario público es una consulta real y distinta, no hay reintentos idempotentes que cuidar (a diferencia de una reserva, que sí puede chocar con un horario ya tomado).

La deduplicación real importa del lado del **CRM**, al sincronizar: mismo mecanismo que ya usa `syncLeadsFromNexoAppointments` — `@@unique([businessId, source, sourceRef])` en `crm.Lead`, con `source: "nexo_inquiry"` y `sourceRef: inquiry.id`. Ese índice ya existe hoy en el schema del CRM (se usa con `source: "nexo_appointment"`) y ya generaliza a cualquier tipo de origen — **no requiere ningún cambio de schema ni migración nueva en el CRM.**

### 3.5. Cómo se asocia al Business

Igual que `Appointment`: `businessId` sale de `getBusinessIdBySlug(slug)` en el servidor, nunca del body del request — mismo criterio de seguridad que ya usa `book/route.ts` (el cliente nunca puede elegir a qué negocio pertenece lo que envía).

### 3.6. Cómo se aprovecha la integración existente con el CRM

Del lado del CRM (repo separado, `crm/`), dos piezas nuevas, ambas espejo exacto de las que ya existen para turnos:

1. **`crm/modules/nexo/inquiries.ts`** (nuevo): mismo patrón que `appointments.ts` — mirror parcial de `Inquiry` en el `schema.prisma` del CRM (agregando el modelo al mismo `schemas = [..., "nexo"]` que ya tiene), cliente Prisma de solo lectura, tipo de dominio propio (`NexoInquiry`) para que el resto del CRM no importe el modelo Prisma directamente.
2. **`syncLeadsFromNexoInquiries(businessId)`** (nuevo, junto a `syncLeadsFromNexoAppointments` en `sync-leads.ts`): mismo check-then-create, `source: "nexo_inquiry"`, el mensaje de la consulta se guarda como `Activity` (nota), igual que el detalle del turno.

**Decisión a validar con el usuario (no la resolví unilateralmente):** si el botón "Sincronizar con Nexo" del CRM debería llamar internamente a ambas funciones (turnos + consultas) en un solo click, o si conviene un segundo botón/acción separada. Mi recomendación es unificarlo en la misma acción (un único sync que trae todas las fuentes disponibles) para no fragmentar la UX del CRM con dos botones que hacen conceptualmente lo mismo — pero es una decisión de UX del CRM, no solo técnica, y vale confirmarla antes de tocar código.

### 3.7. Cambios de UI (sitio público, Nexo)

- Nuevo componente `components/public-site/inquiry-form.tsx` (nombre tentativo), construido con los mismos primitivos (`Field`/`FieldError`/`FieldGroup`/`FieldLabel`, `Input`, `Button`) y el mismo patrón (`useForm` + `zodResolver(inquirySchema)`) que `booking-widget.tsx`.
- Copy exacto pedido por el usuario: título "¿Tenés una consulta? Dejanos tu mensaje y nos ponemos en contacto.", botón "Enviar consulta", confirmación "Consulta enviada correctamente." (mismo estilo de card `border-border bg-card` que el resto del template `booking`).
- Ubicación: dentro del template `booking` (`app/s/[slug]/page.tsx`), no como página aparte — consistente con el pedido explícito del usuario de que esto sea contextual al template existente, no un formulario de contacto genérico separado.
- CTA de WhatsApp contextual nueva: una segunda card en `booking-important-info.tsx` (o al lado de la primera), con el copy "¿Tenés dudas sobre disponibilidad, precios o el servicio? Consultar por WhatsApp", usando `buildWhatsappHref` con un mensaje prellenado distinto al que ya existe (ese es post-reserva; este sería pre-reserva/pre-consulta).

### 3.8. Notificaciones

- Nuevo tipo `"inquiry_received"` agregado a `NOTIFICATION_TYPES` (`modules/notifications/service.ts`).
- Nueva función `notifyInquiryReceived(input)`, mismo molde que `notifyBookingCreated` (título "Nueva consulta", body con nombre + primeras palabras del mensaje, `resourceHref` apuntando a donde el dashboard vaya a listar las consultas — ver 3.9).
- Cero cambios en la UI de la campanita: ya es genérica.

### 3.9. ¿Hace falta una vista en el dashboard?

Para que la notificación tenga a dónde apuntar (`resourceHref`) y para que el dueño pueda ver sus consultas sin depender solo de la notificación, V1 debería incluir una vista mínima de listado (ej. `/dashboard/consultas`, lista simple sin acciones más allá de "marcar como atendida"). No es estrictamente parte de "formulario → Lead", pero sin esto la consulta solo sería visible en la notificación (que expira de la vista) o directamente en el CRM — y el dueño de un negocio que no usa el CRM se quedaría sin ver sus consultas en ningún lado. Lo marco como parte razonable del alcance de V1, a confirmar.

### 3.10. Tests a agregar

Siguiendo el mismo patrón ya establecido en ambos repos (mocks + tests de servicio + walkthrough HTTP):

- `modules/inquiries/service.test.ts`: creación válida, asociación correcta al `businessId`.
- `lib/schemas.test.ts` (o donde vivan hoy los tests de schemas): casos válidos/inválidos de `inquirySchema`, incluyendo honeypot.
- `app/api/public/[slug]/inquiry/route.test.ts`: 404 si el slug no existe, 400 si el body es inválido, 201 + honeypot silencioso si viene lleno, rate limit.
- CRM: `crm/modules/nexo/inquiries.test.ts` (mock del cliente Prisma de solo lectura, mismo patrón que `appointments.test.ts`) y test de `syncLeadsFromNexoInquiries` (idempotencia vía `sourceRef`, igual que el test existente de `syncLeadsFromNexoAppointments`).

---

## 4. Archivos que se modificarían/crearían (resumen)

**Nexo:**
- `prisma/schema.prisma` (+modelo `Inquiry`) + migración nueva.
- `lib/schemas.ts` (+`inquirySchema`).
- `modules/inquiries/service.ts` (nuevo).
- `modules/notifications/service.ts` (+tipo `inquiry_received` +`notifyInquiryReceived`).
- `app/api/public/[slug]/inquiry/route.ts` (nuevo).
- `components/public-site/inquiry-form.tsx` (nuevo).
- `components/public-site/booking/booking-important-info.tsx` (+card de WhatsApp contextual).
- `app/s/[slug]/page.tsx` (montar el formulario nuevo en el template `booking`).
- `app/dashboard/consultas/` (nuevo, listado mínimo — a confirmar si entra en V1, ver 3.9).
- Tests correspondientes a cada pieza de arriba.

**CRM (repo separado):**
- `modules/nexo/inquiries.ts` (nuevo, adapter de solo lectura).
- `modules/nexo/sync-leads.ts` (+`syncLeadsFromNexoInquiries`).
- El botón/endpoint de sync existente (`app/api/nexo/sync-leads/route.ts` y su UI) — a decidir si se extiende o se duplica (ver decisión pendiente en 3.6).
- `prisma/schema.prisma` del CRM (+mirror parcial de `Inquiry`, mismo mecanismo que ya tiene para `Appointment` — sin migración nueva, la tabla la crea y posee Nexo).
- Tests correspondientes.

---

## 5. Qué NO se toca en esta etapa

Por instrucción explícita del usuario, quedan fuera de esta pasada:

- V2 (listado/detalle/acción reutilizable), V3 (productos/propiedades), V4 (Instagram/omnicanalidad), V5 (multiagente).
- Cualquier forma de "Commerce".
- Persistencia de conversaciones de WhatsApp — sigue como deuda técnica documentada en `inventario-actual.md`, no se resuelve como parte de V1.
- Clasificación automática por IA de la consulta (el roadmap la menciona como posible evolución de V1, "si tiene sentido, en un intento de respuesta automática" — no es parte de este diseño, que se limita a crear la consulta y notificar).
- Roles/permisos nuevos en Nexo.
- Cualquier cambio al schema del CRM más allá del mirror de solo lectura descripto arriba.

---

## 6. Riesgos y decisiones a validar antes de implementar

1. **Nombre del modelo/feature.** Usé `Inquiry`/"consulta" de forma consistente con el copy que dio el usuario, pero vale confirmarlo antes de generar la migración (renombrar un modelo después de tener datos reales es más costoso que ahora).
2. **Unificar o separar el botón de sync del CRM** (sección 3.6) — recomendación: unificar, pero es una decisión de UX del CRM que conviene confirmar.
3. **Alcance de la vista de dashboard** (`/dashboard/consultas`, sección 3.9) — ¿entra en V1 o se puede diferir dejando la notificación como único punto de acceso inicial? Lo incluí porque sin eso las consultas de negocios que no usan el CRM prácticamente no tendrían dónde vivir, pero es más alcance del que pidió literalmente el enunciado original ("formulario → Lead").
4. **Rate limit en memoria.** `isRateLimited` ya es conocido como no distribuido/por-proceso (documentado en `inventario-actual.md`) — sigue siendo el mecanismo disponible, no se propone resolver esa limitación como parte de V1, solo se señala que se hereda.
5. **Status del modelo `Inquiry`.** Propongo un campo `status` simple desde el día uno (aunque V1 no lo use más que para el default `"new"`) para no tener que migrar el modelo apenas se quiera agregar "marcar como atendida" — a confirmar si se prefiere no incluirlo todavía para mantener el modelo mínimo.

---

## 7. Decisiones cerradas e implementación (2026-09-20)

- Modelo técnico `Inquiry`; en UI "Consultas".
- `Inquiry.status`: solo `NEW` (default), `IN_PROGRESS`, `RESOLVED` (`INQUIRY_STATUSES` en `lib/schemas.ts`).
- CRM: un único botón "Sincronizar con Nexo". Internamente `syncLeadsFromNexoAppointments` y `syncLeadsFromNexoInquiries`, orquestadas por `syncLeadsFromNexo`; `POST /api/nexo/sync-leads` devuelve totales combinados más el desglose. Leads con `source: "nexo_inquiry"`.
- `/dashboard/consultas` incluido con alcance mínimo: listado, datos de contacto y cambio de estado. Sin filtros, asignaciones ni tags.
- CTA de WhatsApp contextual pre-reserva agregada a `BookingImportantInfo` reutilizando `buildWhatsappHref`; no se tocó el motor de WhatsApp.
- La migración `20260920000000_add_inquiry` es aditiva (una tabla nueva); **no se aplicó** a ninguna base todavía. El CRM declara solo el mirror de lectura, sin migración propia.
