# CRM — Fase 1: Diseño (sin código, sin schema, sin migraciones)

**Estado:** documento de diseño únicamente. No se modificó `prisma/schema.prisma`, no se creó ninguna migración, no se instaló ninguna dependencia, no se tocó código de producción de Nexo.
**Fecha:** 2026-09-16
**Continúa:** [`migracion-schemas-fase1.md`](./migracion-schemas-fase1.md), [`fase2.md`](./migracion-schemas-fase2.md), [`fase3.md`](./migracion-schemas-fase3.md), [`validacion-post-migracion.md`](./validacion-post-migracion.md).

---

## 0. Punto de partida re-verificado

`prisma/schema.prisma` confirmado sin cambios desde la Fase 3: 33 modelos, 33 `@@schema(...)`, `schemas = ["public", "nexo", "crm"]`. `public` tiene 7 modelos (`User`, `Session`, `Account`, `Verification`, `Business`, `Membership`, `Lead`), `nexo` tiene 26, `crm` no tiene ninguno todavía — el schema físico existe en Postgres (Fase 3) pero no está representado por ningún modelo de Prisma. Se re-confirmó además que no existe ningún formulario de contacto genérico en el sitio público de Nexo (`app/s/[slug]/` solo tiene `page.tsx`, `reservar/`, `carta/` — el único evento de conversión real hoy es una reserva de turno, no un formulario). Esto importa para la sección de integración.

---

## 1. Qué comparte `public`

Sin cambios respecto de lo decidido en Fase 2/3: `User`, `Session`, `Account`, `Verification` (identidad — Better Auth), `Business` (el tenant), `Membership` (User↔Business), y `Lead` (pipeline comercial de **Kodexa**, no confundir con el `Lead` propio del CRM — ver más abajo, es la confusión más peligrosa de todo este documento).

**No se agrega nada nuevo a `public` en este diseño.** Ninguna entidad del CRM calificó para vivir ahí — todas son específicas del producto CRM. Esto es intencional: se mantiene la regla ya establecida ("`public` = identidad + tenant, nunca un cajón de todo lo compartible").

## 2. Qué queda en `nexo`

Sin cambios. Cero modelos nuevos, cero modificaciones. La integración con Nexo (sección 7) se diseña para no requerir tocar `nexo.*` salvo en un único punto, explícitamente justificado y explícitamente **no implementado en esta fase** (ver 7.6).

## 3. Qué va a vivir en `crm`

Ver sección 6 (modelo de datos completo). Resumen: ~28 modelos nuevos, agrupados en Core (Company/Contact/Lead/Opportunity/Pipeline/Task/Activity/Tag), Configurabilidad (CustomField, StatusDefinition, Workspace), Billing propio (Plan/Subscription/MercadoPagoWebhookEvent/PromoCode/PromoCodeRedemption — mismo patrón que `nexo.*`, sin compartir tablas), Email, Calendario, Automatizaciones, e Integración con Nexo.

---

## 4. Identidad compartida

### 4.1 Better Auth sigue en Nexo — el CRM tiene su propia instancia, mismas tablas

Confirmado y no se cambia: Better Auth sigue viviendo embebido en el Next.js de **Nexo**, contra `public.User/Session/Account/Verification`. El CRM va a ser **otro proyecto Next.js** (repo separado, según el propio pedido: `nexo.kodexa.com.ar` / `crm.kodexa.com.ar`), y ese proyecto va a tener **su propia instancia de `betterAuth()`**, embebida en su propio código — nunca un servicio de auth separado, tal como se pidió.

La clave para que esto sea "una identidad, no dos": la instancia de Better Auth del CRM debe apuntar al **mismo `DATABASE_URL`** (mismas tablas físicas `public.User`/etc.) y usar el **mismo valor de `BETTER_AUTH_SECRET`** que Nexo — configurado así desde el primer commit del proyecto CRM, no "después". Esto no es una decisión que dependa de tener SSO: es lo que garantiza que si alguna vez se activa `crossSubDomainCookies` (ver 4.4), las sesiones ya sean compatibles sin ninguna migración de datos.

**Por qué esto no requiere modificar Nexo:** el proyecto CRM trae su propia copia del *código* de Better Auth (`lib/auth/auth.ts` equivalente, en su propio repo) apuntando a la base compartida. Nexo no necesita saber que el CRM existe.

### 4.2 Un `User` = una identidad Kodexa (ya garantizado, cero trabajo nuevo)

Como `User`/`Account` ya están físicamente en `public` (Fase 3), el día que el CRM registre un usuario con el mismo email que ya tiene cuenta en Nexo, **no hay ninguna acción a tomar**: si el CRM usa su propia instancia de Better Auth contra la misma tabla `public.user` (con el `@@unique` en `email` ya existente), Better Auth va a rechazar un segundo registro con ese email exactamente como lo haría dentro de Nexo — el sistema ya impide duplicados sin ningún código nuevo. "No crear usuarios duplicados" es una propiedad que ya tiene la base, no algo que el CRM deba implementar.

### 4.3 Cómo el CRM resuelve el Business actual

Mismo patrón exacto que usa Nexo (`modules/business/current.ts`): sesión → `Membership.findFirst({ where: { userId } })` → `businessId`. El CRM reimplementa esta función en su propio `modules/business/current.ts` — no hay forma de "compartir" código entre dos repos Next.js distintos sin crear un paquete npm privado, que sería sobreingeniería para esta etapa. Es la misma lógica, duplicada intencionalmente entre dos codebases (igual que Better Auth mismo).

**Mejora recomendada para el CRM, sin tocar Nexo:** Nexo usa `findFirst` sin `orderBy` porque hoy, en la práctica, nunca hay más de una `Membership` por usuario (Fase 1). El CRM parte del mismo dato pero es el primer producto que **motiva de verdad** tener más de un negocio por usuario o más de un usuario por negocio (el pedido lo dice explícitamente: "no diseñar algo que nos limite"). Por eso el CRM debería construir desde el MVP un selector de negocio real (aunque solo se necesite el día que exista más de una `Membership`) en vez de copiar el atajo de Nexo. Esto no requiere ningún cambio de schema — `Membership` ya soporta N filas por usuario (Fase 2, sección B.3) — es una decisión de UI/lógica propia del CRM.

### 4.4 Qué NO se hace ahora (SSO real) y qué queda preparado

**No se implementa** `crossSubDomainCookies` ni ningún mecanismo de sesión compartida entre `nexo.kodexa.com.ar` y `crm.kodexa.com.ar` en esta fase — el propio pedido lo excluye. Hoy, un usuario que ya inició sesión en Nexo va a tener que loguearse de nuevo al entrar al CRM (con las mismas credenciales, nunca una cuenta nueva).

**Lo que queda preparado, sin costo, para cuando se decida activarlo:**
- Mismas tablas de sesión (`public.Session`) — ya compartidas desde la Fase 3.
- Mismo `BETTER_AUTH_SECRET` entre ambos proyectos (recomendación de 4.1, a aplicar desde que se cree el repo del CRM).
- `Session` no tiene ninguna noción de "producto" ni de `businessId` — una sesión autentica al usuario, cada producto resuelve su propio "negocio actual" por separado (4.3). Esto significa que activar SSO más adelante **no requiere ningún cambio de modelo de datos**, solo configuración de cookies + `trustedOrigins` en ambas apps, y una decisión de dominio raíz común (infraestructura, no base de datos).

### 4.5 Roles básicos del CRM — reusando un campo que Nexo ya tiene y nunca usa

`Membership.role` existe en `public` desde el origen del proyecto, es un `String` libre, y Nexo **nunca lo lee para autorizar nada** (confirmado en Fase 1 — solo se muestra en dos pantallas de Superadmin). Esto es una oportunidad real: el CRM puede empezar a **leer y escribir valores más variados en esa misma columna** (`"owner" | "admin" | "member" | "viewer"`, por ejemplo) para sus propios permisos básicos, **sin ningún cambio de schema y sin ningún cambio de código en Nexo** — Nexo simplemente sigue sin leer ese campo, exactamente como hace hoy. Las filas de `Membership` que ya existen (todas `"owner"` hoy) siguen siendo válidas: el CRM debe tratar `"owner"` como acceso completo por default y no asumir que toda fila existente tiene un valor "moderno".

Esto es el único punto de todo el diseño donde el CRM **reinterpreta** el significado de un campo compartido sin tocar Nexo — se documenta explícitamente porque, aunque no requiere una modificación de código en Nexo, sí es una decisión que vale la pena que quede escrita: si en el futuro Nexo alguna vez decide usar `role` para algo propio, hay que revisar que no choque con esta convención.

---

## 5. Multi-tenancy y ownership en el CRM

Misma disciplina que ya demostró funcionar en Nexo (y que la Fase 4 validó de punta a punta): **toda** tabla de `crm.*` que sea de dominio (no de catálogo global tipo `Plan`) lleva `businessId String` con FK cross-schema a `public."Business"`, y **toda** query de `modules/crm/*` filtra por ese `businessId` — mismo patrón, mismo nivel de disciplina, cero excepciones. El CRM además hereda la regla que hizo esta migración segura: **cero SQL crudo** (`$queryRaw`/`$executeRaw`) — se adopta como principio del proyecto CRM desde el día uno, no como algo a auditar después.

**Ownership a nivel de usuario (nuevo respecto de Nexo):** dado que el CRM sí anticipa equipos (varios `User` por `Business`, sección 4.3), las entidades centrales (`Lead`, `Opportunity`, `Task`, `Company`) llevan además un `ownerId` opcional (`userId`, FK a `public.User`) — "asignado a". Nexo no tiene este concepto porque nunca tuvo más de un usuario real por negocio; el CRM sí lo necesita desde el MVP para que "asignar un lead a un vendedor" tenga sentido el día que haya más de un usuario, sin tener que agregar el campo después.

---

## 6. Modelo de datos propuesto (`crm.*`)

### 6.1 Mapa general

```
public.Business
       │
       ├── crm.Workspace (1:1 — "¿este Business tiene CRM activado?")
       │         │
       │         └── config: módulos activos, plantilla de rubro, onboarding, pipeline default
       │
       ├── crm.Company ──┐
       ├── crm.Contact ──┤
       ├── crm.Lead ──────┼── todas referencian Business directo (businessId),
       ├── crm.Opportunity┤   y entre sí donde corresponde (ver 6.2)
       ├── crm.Task ──────┤
       ├── crm.Activity ──┘
       │
       ├── crm.Pipeline → crm.PipelineStage
       ├── crm.Tag → crm.EntityTag (polimórfica)
       ├── crm.StatusDefinition (estados configurables no-pipeline)
       ├── crm.CustomFieldDefinition → crm.CustomFieldValue
       │
       ├── crm.Plan → crm.Subscription (independiente de nexo.Plan/Subscription)
       ├── crm.MercadoPagoWebhookEvent, crm.PromoCode, crm.PromoCodeRedemption
       │
       ├── crm.EmailTemplate, crm.EmailMessage, crm.EmailCampaign
       ├── crm.CalendarEvent, crm.CalendarIntegration
       ├── crm.AutomationRule → crm.AutomationRun
       ├── crm.ImportJob
       │
       └── crm.NexoLink (vínculo laxo hacia datos originados en Nexo)
```

### 6.2 Core — bocetos ilustrativos (no son el schema real, solo para fijar la forma)

```prisma
// ── Workspace ─────────────────────────────────────────────────────────────
// 1:1 con Business. Su EXISTENCIA es la señal de "este Business usa CRM" —
// reemplaza la necesidad de una tabla ProductAccess/ProductEntitlement
// formal y compartida (explícitamente fuera de alcance de esta fase):
// nexo.* ya evidencia "usa Nexo" con sus propias filas, crm.Workspace hace
// lo mismo para CRM. Ningún nuevo modelo en `public`.
model Workspace {
  businessId        String   @id
  industryTemplate  String?           // "software" | "gimnasio" | "ferreteria" | ... | null = genérico
  activeModules     String[]          // ["companies","contacts","leads","opportunities","tasks", ...]
  onboardingStep    String?           // null = completo
  defaultPipelineId String?
  createdAt         DateTime @default(now())
  @@schema("crm")
}

// ── Lead del CRM — NO confundir con public.Lead ─────────────────────────
// public.Lead = alguien que quiere CONTRATAR Nexo/CRM (pipeline comercial
// de Kodexa). crm.Lead = un prospecto DEL NEGOCIO QUE USA EL CRM (el
// cliente de Kodexa gestionando SUS propios prospectos). Son dos conceptos
// del mismo nombre en dominios distintos — separados a propósito, no es un
// error de diseño duplicarlo.
model Lead {
  id           String   @id @default(cuid())
  businessId   String
  ownerId      String?               // userId asignado (ver sección 5)
  name         String
  email        String?
  phone        String?
  companyId    String?               // opcional: a qué Company pertenece
  status       String   @default("new")   // valor libre — ver StatusDefinition
  source       String?               // "manual" | "nexo_appointment" | ... (ver NexoLink)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@schema("crm")
}

model Opportunity {
  id          String   @id @default(cuid())
  businessId  String
  ownerId     String?
  companyId   String?
  contactId   String?
  pipelineId  String
  stageId     String
  title       String
  amount      Float?
  status      String   @default("open")  // "open" | "won" | "lost"
  closedAt    DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@schema("crm")
}

model Pipeline {
  id         String            @id @default(cuid())
  businessId String
  name       String
  isDefault  Boolean  @default(false)
  stages     PipelineStage[]
  @@schema("crm")
}

model PipelineStage {
  id         String   @id @default(cuid())
  pipelineId String
  key        String
  label      String
  order      Int
  isWon      Boolean  @default(false)
  isLost     Boolean  @default(false)
  @@unique([pipelineId, key])
  @@schema("crm")
}
```

**Company, Contact, Task, Activity** siguen el mismo patrón (`id`, `businessId`, `ownerId?`, campos propios, `createdAt`/`updatedAt`) — no se detallan campo por campo acá para no fijar de más algo que conviene terminar de definir recién al implementar; la forma ya está establecida por los ejemplos de arriba. `Activity` es polimórfica (`relatedType: "lead" | "contact" | "company" | "opportunity"`, `relatedId`) para no tener 4 tablas de historial idénticas.

### 6.3 Configurabilidad

```prisma
// Reemplaza "estados rígidos" para Lead/Company/Task (Opportunity ya tiene
// su propio estado real vía PipelineStage). Mismo criterio que TODO el
// resto del proyecto (Appointment.status, Subscription.status, etc.):
// String libre en el modelo de dominio, validado/etiquetado acá, nunca un
// enum de Prisma.
model StatusDefinition {
  id         String  @id @default(cuid())
  businessId String
  entityType String            // "lead" | "company" | "task"
  key        String
  label      String
  color      String?
  order      Int
  isDefault  Boolean @default(false)
  @@unique([businessId, entityType, key])
  @@schema("crm")
}

model Tag {
  id         String @id @default(cuid())
  businessId String
  name       String
  color      String?
  @@unique([businessId, name])
  @@schema("crm")
}

model EntityTag {
  tagId      String
  entityType String   // "lead" | "contact" | "company" | "opportunity"
  entityId   String
  @@id([tagId, entityType, entityId])
  @@schema("crm")
}

// Tipos iniciales del MVP: texto, número, moneda, fecha, fecha/hora,
// boolean, selección, selección múltiple, email, teléfono, URL — todos
// representables como texto en CustomFieldValue.value (igual criterio que
// Lead.goals de Nexo con arrays, o Business.category con texto libre:
// "selección múltiple" es el único que necesita array, se maneja con
// String[] en vez de una segunda tabla). Relaciones y archivos: NO entran
// al MVP (ver 12 — post-MVP), agregarían un tipo de dato completamente
// distinto (un id referenciando otra fila, o un archivo en Storage) que
// complica la validación y el filtrado genérico sin un caso de uso todavía
// pedido.
model CustomFieldDefinition {
  id         String @id @default(cuid())
  businessId String
  entityType String   // "lead" | "contact" | "company" | "opportunity"
  key        String
  label      String
  type       String   // "text"|"number"|"currency"|"date"|"datetime"|"boolean"|"select"|"multiselect"|"email"|"phone"|"url"
  options    String[]  // solo para select/multiselect
  required   Boolean  @default(false)
  order      Int
  @@unique([businessId, entityType, key])
  @@schema("crm")
}

model CustomFieldValue {
  id             String @id @default(cuid())
  definitionId   String
  entityId       String
  value          String?       // multiselect: valores separados, o usar un campo array aparte
  @@unique([definitionId, entityId])
  @@schema("crm")
}
```

### 6.4 Billing propio del CRM

**Mismo patrón exacto que `nexo.Plan`/`nexo.Subscription`, sin compartir ni una fila.** No se repite el detalle campo por campo (ya está completo en `prisma/schema.prisma` como referencia de forma) — la única diferencia real son las columnas de feature-gating, que son del CRM, no de Nexo:

| Columna en `nexo.Plan` (hoy) | Equivalente en `crm.Plan` (propuesto) |
|---|---|
| `whatsappEnabled` | *(no aplica)* |
| `depositsEnabled` | *(no aplica)* |
| `customTrainingEnabled` | *(no aplica)* |
| `statsEnabled` | `reportsEnabled` |
| `galleryEnabled` | *(no aplica)* |
| `digitalMenuEnabled` | *(no aplica)* |
| — | `maxUsers` (nuevo — Nexo no tiene equipos) |
| — | `maxContacts` / `maxLeads` |
| — | `automationsEnabled` |
| — | `emailCampaignsEnabled` |
| — | `calendarIntegrationEnabled` |

`crm.Subscription`, `crm.MercadoPagoWebhookEvent`, `crm.PromoCode`, `crm.PromoCodeRedemption` — mismos campos, misma lógica (`resolveAiAccess`→`resolveCrmAccess`, `resolvePlanFeatures`→`resolveCrmPlanFeatures`, etc., reimplementadas en el módulo `modules/billing/subscription.ts` del **repo del CRM**, copiando el patrón, no el código). `Subscription.businessId @unique` igual que en Nexo — un Business tiene a lo sumo una `crm.Subscription`, independiente de si tiene o no `nexo.Subscription`.

### 6.5 Email

```prisma
model EmailTemplate {
  id         String @id @default(cuid())
  businessId String
  name       String
  subject    String
  bodyHtml   String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@schema("crm")
}

model EmailMessage {
  id           String    @id @default(cuid())
  businessId   String
  templateId   String?
  contactId    String?
  leadId       String?
  opportunityId String?
  toEmail      String
  subject      String
  bodyHtml     String
  status       String    @default("queued")  // queued | sent | failed | bounced
  providerMessageId String?
  sentAt       DateTime?
  createdAt    DateTime  @default(now())
  @@schema("crm")
}

// MVP "simple y controlado" (tal como pide el pedido): un template + una
// lista estática de destinatarios (por tag o por filtro guardado, no un
// segmentador complejo) + estado agregado. Cada envío individual sigue
// generando su propia fila en EmailMessage — Campaign es solo el
// agrupador/disparador, no una segunda fuente de verdad del historial.
model EmailCampaign {
  id          String   @id @default(cuid())
  businessId  String
  templateId  String
  name        String
  status      String   @default("draft")  // draft | sending | sent | failed
  audienceTagId String?
  sentAt      DateTime?
  createdAt   DateTime @default(now())
  @@schema("crm")
}
```

**Abstracción de proveedor** (no se decide ni se instala nada ahora): igual patrón que ya usa Nexo para IA (`modules/ai/providers/base.ts`, interfaz `AIProvider` con una implementación real de Gemini) — el CRM define una interfaz `EmailProvider` (`send(params): Promise<{ providerMessageId }>`) en `modules/email/providers/base.ts`, con una implementación placeholder/no-op para desarrollo y un punto de extensión claro para Resend (o el que se decida) cuando se implemente de verdad. Mismo criterio de "una interfaz, un solo punto de entrada" que ya probó funcionar bien en este proyecto.

### 6.6 Calendario

```prisma
model CalendarEvent {
  id            String   @id @default(cuid())
  businessId    String
  ownerId       String?           // userId
  relatedType   String?           // "lead" | "contact" | "opportunity" | null
  relatedId     String?
  title         String
  startsAt      DateTime
  endsAt        DateTime
  type          String   @default("meeting")  // meeting | task | reminder
  externalProvider   String?      // "google" | "outlook" | null = solo interno
  externalEventId    String?
  createdAt     DateTime @default(now())
  @@schema("crm")
}

model CalendarIntegration {
  id           String   @id @default(cuid())
  businessId   String
  userId       String            // la cuenta de Google/Outlook es personal, no del Business
  provider     String            // "google" (único soportado en el MVP) | "outlook" (post-MVP)
  accessToken  String
  refreshToken String?
  expiresAt    DateTime?
  createdAt    DateTime @default(now())
  @@unique([businessId, userId, provider])
  @@schema("crm")
}
```

Misma idea de abstracción que en email: interfaz `CalendarProvider` (`createEvent`, `updateEvent`, `deleteEvent`, `listEvents`), un adapter real solo para Google Calendar en el MVP, Outlook queda como una segunda implementación futura de la misma interfaz — no un rediseño.

### 6.7 Automatizaciones (simple, no un workflow engine)

```prisma
// trigger y actions como JSON estructurado, interpretado por un
// intérprete simple y acotado (una lista fija de triggers/acciones
// soportadas en código, NO un lenguaje de reglas genérico ni un motor de
// workflows). Mismo espíritu que modules/ai/rule-engine.ts de Nexo: reglas
// simples evaluadas en código, antes de escalar a algo más complejo.
model AutomationRule {
  id         String   @id @default(cuid())
  businessId String
  name       String
  trigger    Json     // { "type": "lead_created" } | { "type": "status_changed", "entityType": "lead", "to": "vencido" }
  actions    Json      // [{ "type": "assign_user", "userId": "..." }, { "type": "create_task", "title": "..." }]
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())
  @@schema("crm")
}

model AutomationRun {
  id         String   @id @default(cuid())
  ruleId     String
  triggeredByType String
  triggeredById   String
  success    Boolean
  error      String?
  ranAt      DateTime @default(now())
  @@schema("crm")
}
```

### 6.8 Integración con Nexo — el modelo, no el mecanismo (ver sección 7)

```prisma
// Vínculo laxo, no una FK dura hacia nexo.* — a propósito: algunos
// "source" (ej. una futura conversación de WhatsApp) todavía no existen
// como tabla real en Nexo (ver 7.2). Una FK dura obligaría a inventar esa
// tabla ahora o a dejar el campo roto; un string suelto (mismo criterio que
// Lead.suggestedPlan o PaymentProof.reviewedBy en el propio Nexo: id sin FK
// cuando el vínculo no debe poder bloquear ni verse bloqueado por el otro
// lado) permite documentar la intención sin inventar algo prematuro.
model NexoLink {
  id          String   @id @default(cuid())
  businessId  String
  entityType  String   // "lead" | "contact" | "opportunity" | "activity"
  entityId    String
  sourceType  String   // "appointment" (real, hoy) | "conversation" (futuro) | "site_form" (futuro)
  sourceRef   String   // hoy: nexo.Appointment.id
  createdAt   DateTime @default(now())
  @@unique([entityType, entityId, sourceType, sourceRef])
  @@schema("crm")
}
```

### 6.9 Otros

- `ImportJob` (`id`, `businessId`, `entityType`, `status`, `totalRows`, `successCount`, `errorCount`, `errorsJson`, `createdAt`) — tracking mínimo de una importación CSV, no un sistema de jobs en background complejo (se puede correr sincrónico para volúmenes chicos, igual criterio que el procesamiento de documentos de Memoria en Nexo hoy).

**Total: ~28 modelos nuevos en `crm`.** Es una cifra grande porque el alcance pedido para el MVP también lo es (23 features + integración profunda + email + calendario + billing propio) — no es sobre-modelado por su cuenta; cada modelo corresponde a un ítem explícito del pedido.

---

## 7. Integración Nexo ↔ CRM

### 7.1 Mecánica de fondo: una sola base de datos, dos codebases

Nexo y CRM van a ser dos proyectos Next.js separados, pero **ambos hablan con el mismo Postgres** (mismo `DATABASE_URL`, distintos schemas). Esto habilita una opción de integración que no existiría si fueran bases de datos distintas: el proyecto CRM puede declarar, en **su propio** `prisma/schema.prisma`, modelos `@@schema("nexo")` que reflejen (de solo lectura, por convención de código — Prisma no impone read-only a nivel de schema) las tablas de Nexo que necesita consultar, sin necesidad de ninguna API HTTP.

**Esto es una decisión con un trade-off real, no gratuita:** le da a CRM lecturas instantáneas sin latencia de red, pero crea un contrato implícito entre dos repos independientes — si Nexo cambia la forma de `nexo.Appointment` sin coordinarlo, el modelo espejo del CRM puede quedar desalineado (sin error de compilación cruzado, porque son dos `tsc` distintos). Se documenta como aceptado para el arranque (dos productos, mismo equipo) y se recomienda revisarlo si Kodexa llega a tener equipos separados por producto.

### 7.2 Bloqueo real encontrado: no hay dónde leer conversaciones de WhatsApp

Los puntos 2, 3, 4, 5, 6 y 7 del pedido (ver conversaciones de WhatsApp desde CRM, calificarlas, dejar feedback, que ese feedback llegue al entrenamiento de Nexo, vincular una conversación a un Lead/Contact/Oportunidad, consultar historial de interacciones) **dependen todos de que exista una conversación persistida** — y hoy no existe: confirmado en la Fase 1 y otra vez acá, `modules/whatsapp/**` no tiene ni una tabla en Postgres, las conversaciones viven en memoria del proceso de Nexo y se pierden en cada reinicio.

**No se puede diseñar el consumo de algo que Nexo no guarda.** Esto no es una limitación del CRM — es un prerequisito de **Nexo** (persistir conversaciones/mensajes en `nexo.Conversation`/`nexo.Message`, o similar) que:
- es un cambio real y no trivial a Nexo (nueva tabla, nuevo punto de escritura en el flujo de WhatsApp, decisión de qué se persiste y por cuánto tiempo, posible impacto en el bus de eventos SSE ya documentado como con fugas de aislamiento en la Fase 1),
- no está pedido ni autorizado en esta fase,
- debería ser su propia fase de trabajo sobre Nexo, con su propio análisis de riesgo, antes de que el CRM pueda construir nada de lo real de esos 5 puntos.

**Qué se deja preparado igual, sin implementarlo:** el modelo `NexoLink` (6.8) ya contempla `sourceType: "conversation"` como un valor válido futuro, y `Activity` (6.2) puede representar "una conversación calificada" el día que haya algo real que referenciar. El "feedback que debería llegar al entrenamiento de Nexo" (punto 5) es aún más downstream — depende de que primero exista la conversación persistida, y después de un mecanismo de escritura hacia `nexo.MemoryEntry` (que si existe hoy, ver Fase 1) o hacia el mismo lugar donde el Simulador de Nexo ya guarda correcciones. Se anota como dependiente de 7.2, no se diseña en detalle todavía.

### 7.3 Lo que SÍ es viable ahora: turno reservado → Lead en CRM

El pedido dice "formulario de contacto del sitio → Lead", pero ese formulario no existe (0.1). El evento de conversión real que Nexo sí tiene, hoy, es una reserva de turno (`nexo.Appointment` con `source: "customer"`, ya sea desde el sitio público o desde WhatsApp). Se propone que sea **ese** el evento que dispara la creación de un `crm.Lead` (con un `NexoLink` marcando `sourceType: "appointment"`), no un formulario inexistente. Si más adelante se quiere un formulario de contacto genérico en el sitio de Nexo (fuera de la reserva de turno), es una feature nueva de Nexo, a evaluar aparte.

### 7.4 Métricas del sitio de Nexo (punto 12) — también bloqueado, parcialmente

"Visitas" y "fuentes/canales" no existen en Nexo hoy (no hay tracking de tráfico del sitio público, confirmado — `modules/analytics` de Nexo mide turnos/comprobantes/uso de IA, no visitas). Esto también es un prerequisito de Nexo (instrumentación de tráfico, propia o vía un proveedor de analytics), no algo que el CRM pueda inventar leyendo datos que no se guardan.

"Leads generados" y "conversiones" **sí son derivables ya**, a partir de `nexo.Appointment` (7.3) — se pueden mostrar en un dashboard del CRM sin esperar la instrumentación de tráfico.

### 7.5 Mecanismo recomendado para eventos Nexo → CRM (diseño, no implementación)

Para el caso viable (7.3) hay dos formas de que el CRM se entere de un `Appointment` nuevo:

1. **Poll periódico** (CRM lee `nexo.Appointment` cada N minutos filtrando por `createdAt` desde la última corrida) — cero cambios en Nexo, funciona con la lectura directa de 7.1, simple, con latencia de minutos.
2. **Outbox de eventos** — una tabla nueva y chica en `public` (ej. `public.IntegrationEvent`: `id`, `businessId`, `type`, `payload Json`, `createdAt`), que Nexo escribe en el mismo choke point donde ya escribe `BusinessNotification` (mismo patrón "best-effort, nunca bloquea el flujo real" que ya usa `modules/notifications/service.ts`), y que el CRM consume (poll liviano sobre una tabla chica, o algo más sofisticado después). Da eventos casi en tiempo real, sin acoplar a Nexo con una llamada HTTP saliente hacia el CRM (que fallaría si el CRM está caído, en medio de la transacción de reservar un turno — inaceptable).

**Recomendación: empezar con 1 (poll directo) para el MVP.** Es cero cambios en Nexo, ya es viable con lo que existe hoy, y es suficiente para "Lead creado a partir de un turno" sin necesitar tiempo real. **2 (outbox) queda documentado como el paso siguiente natural** si más adelante se quiere latencia baja o más tipos de evento — y sí requeriría tocar Nexo (agregar el `INSERT` en 2-3 choke points ya identificados: `createAppointment`, quizás el hand-off a humano de WhatsApp). Se marca explícitamente: **no implementar en esta fase**, y si se implementa después, justificarlo puntualmente (es exactamente el tipo de cambio a Nexo que el pedido pide justificar antes de tocar código).

### 7.6 Resumen de qué requeriría tocar Nexo, y el veredicto de cada uno

| Integración pedida | Requiere tocar Nexo? | Se implementa ahora? |
|---|---|---|
| Turno → Lead en CRM (7.3) | No (lectura directa o poll) | Diseñado, no implementado — viable de construir en el CRM sin depender de Nexo |
| Ver conversaciones de WhatsApp desde CRM (7.2) | Sí — persistir conversaciones (no existe) | No — bloqueado, requiere su propia fase sobre Nexo |
| Calificar/feedback de conversación (7.2) | Sí — depende de lo anterior | No — bloqueado |
| Feedback → entrenamiento de Nexo (7.2) | Sí — depende de lo anterior + un punto de escritura nuevo | No — bloqueado |
| Historial de interacciones de Nexo en CRM (7.2) | Sí — depende de persistencia de conversaciones | No — bloqueado |
| Emails, plantillas, campañas (6.5) | No | Diseño listo — 100% del lado del CRM |
| Calendario / Google Calendar (6.6) | No | Diseño listo — 100% del lado del CRM |
| Métricas de visitas/conversión del sitio (7.4) | Sí — instrumentación de tráfico (no existe) | No — bloqueado parcialmente (leads/conversiones sí se pueden mostrar ya) |
| Outbox de eventos en tiempo real (7.5, opción 2) | Sí — nuevo `INSERT` best-effort en 2-3 puntos | No — queda documentado para una fase posterior, si hace falta |

---

## 8. Billing independiente — confirmado, sin billing transversal

Ya cubierto en 6.4. Se reafirma el criterio explícito del pedido: `crm.Plan`/`Subscription`/etc. son tablas propias, sin ningún vínculo con `nexo.Plan`/`Subscription`. Un `Business` puede tener `nexo.Subscription` activa, `crm.Subscription` activa, ambas, o ninguna — de forma completamente independiente, cada una resuelta por el módulo de billing de su propio producto.

## 9. Email — resumen

Ver 6.5. `EmailProvider` como interfaz (mismo patrón que `AIProvider` de Nexo), sin proveedor decidido todavía. Historial completo vía `EmailMessage`, asociable a Contact/Lead/Opportunity. Campañas del MVP son deliberadamente simples: un template + una audiencia por tag, nada de segmentación avanzada.

## 10. Calendario — resumen

Ver 6.6. `CalendarProvider` como interfaz, Google Calendar como única implementación real del MVP, Outlook como segunda implementación futura de la misma interfaz (no un rediseño). `CalendarIntegration` es por usuario (`userId`), no por `Business` — las credenciales de Google Calendar son de una cuenta personal.

## 11. Configuración dinámica — resumen

**No se construye un sistema de plugins genérico** (excluido explícitamente por el pedido). En su lugar: `Workspace.activeModules` (`String[]`) + un registro fijo de módulos en código (mismo patrón que `EMPLOYEE_CAPABILITIES`/`NOTIFICATION_TYPES` de Nexo — una lista cerrada en TypeScript, no una tabla de "módulos disponibles" configurable en runtime). Las pantallas del CRM chequean `activeModules.includes("tasks")` antes de mostrarse, mismo criterio que Nexo ya usa para gatear features por plan (`resolvePlanFeatures`). Las "plantillas por rubro" (`industryTemplate`) son una función de seed (`applyIndustryTemplate(businessId, "gimnasio")` → setea `activeModules` + crea `Pipeline`/`PipelineStage`/`StatusDefinition` por default) — una función, no un modelo de datos nuevo más allá de lo ya definido.

---

## 12. Funcionalidades MVP vs. post-MVP

### MVP (según lo pedido, con los bloqueos de la sección 7 marcados)

1. Empresas/tenants — **ya resuelto**, cero trabajo nuevo (`public.Business`).
2. Usuarios — **ya resuelto**, cero trabajo nuevo (`public.User` + `Membership`).
3. Clientes — se resuelve como un estado/tipo de `Company` (no un modelo aparte, ver 6.2).
4. Contactos — `crm.Contact`.
5. Leads — `crm.Lead` (del CRM, no confundir con `public.Lead`).
6. Oportunidades — `crm.Opportunity`.
7. Pipelines — `crm.Pipeline`/`PipelineStage`.
8. Tareas — `crm.Task`.
9. Actividades — `crm.Activity`.
10. Historial — vista sobre `Activity` (sin modelo aparte en el MVP).
11. Campos personalizados — `CustomFieldDefinition`/`Value`, **solo tipos primitivos** (ver 6.3 y post-MVP).
12. Estados personalizados — `StatusDefinition` (Lead/Company/Task) + `PipelineStage` (Opportunity).
13. Etiquetas — `Tag`/`EntityTag`.
14. Dashboard — capa de aplicación, sin modelo nuevo.
15. Reportes básicos — capa de aplicación, sin modelo nuevo.
16. Importación/exportación — `ImportJob` (mínimo) + lógica de importación CSV.
17. Búsqueda — capa de aplicación (mismo patrón `contains`/`insensitive` que ya usa Nexo en turnos).
18. Roles básicos — reusando `Membership.role` (4.5), sin nueva tabla.
19. Automatizaciones simples — `AutomationRule`/`AutomationRun`, intérprete acotado en código.
20. Onboarding — `Workspace.onboardingStep` + wizard de aplicación.
21. Suscripciones/planes propios — `crm.Plan`/`Subscription`/etc. (6.4).
22. Responsive — sin modelo, front-end.
23. Seguridad — disciplina de `businessId` + cero SQL crudo (sección 5).
24. Integración Nexo — **solo la parte viable:** turno → Lead (7.3/7.5, opción poll). El resto de la integración con WhatsApp queda bloqueado (7.2/7.6).
25. Email — plantillas, envío individual, historial, campañas simples (6.5) — sin proveedor decidido/instalado todavía.
26. Calendario — modelo de eventos + integración Google Calendar (6.6) — implementación real de la integración puede diferirse un sprint sin bloquear el resto.

### Post-MVP (explícitamente diferido, con motivo)

- **Custom fields de tipo relación o archivo** — requieren validación/UI completamente distintas de los tipos primitivos (una relación necesita resolver contra qué entidad; un archivo necesita Storage) sin un caso de uso concreto pedido todavía.
- **Integración con Outlook Calendar** — la interfaz ya lo permite (6.6), se agrega como una segunda implementación cuando haya demanda real.
- **Motor de workflows complejo** — el MVP es un intérprete de una lista fija de triggers/acciones, no un lenguaje de reglas genérico.
- **AuditLog de cambios de campo a campo** — `Activity` cubre el historial de interacciones; un log de auditoría más fino (quién cambió qué valor de qué campo) es una feature aparte.
- **Reportes guardados/configurables** — el MVP son reportes fijos sobre datos existentes, no un constructor de reportes.
- **Módulos específicos por rubro** (Membresías/Asistencias de gimnasio, Productos/Proveedores de ferretería) — el pedido es explícito: primero el Core configurable, los módulos de rubro son una fase completamente distinta y posterior.
- **Toda la integración con conversaciones de WhatsApp** (7.2) — bloqueada hasta que Nexo persista conversaciones, fuera del alcance de este documento.
- **Instrumentación de tráfico del sitio de Nexo** (7.4) — bloqueada hasta que Nexo la construya.
- **Outbox de eventos en tiempo real** (7.5, opción 2) — el MVP usa poll; el outbox es la mejora futura si hace falta más velocidad.
- **SSO real entre subdominios** (4.4) — preparado, no activado.

---

## 13. Estructura de carpetas propuesta (proyecto CRM, repo nuevo)

Misma filosofía que Nexo, mismo stack (Next.js App Router, TypeScript, Prisma + `@prisma/adapter-pg`, Tailwind, Better Auth):

```
crm/
├── app/
│   ├── dashboard/                  (companies, contacts, leads, opportunities,
│   │                                 tasks, pipelines, automations, settings, ...)
│   ├── onboarding/
│   ├── api/
│   │   ├── auth/[...all]/          (Better Auth handler — propia instancia)
│   │   ├── companies/, contacts/, leads/, opportunities/, tasks/, ...
│   │   ├── email/, calendar/
│   │   ├── webhooks/mercadopago/
│   │   └── cron/
│   └── login/, registro/
├── modules/
│   ├── crm/
│   │   ├── companies/, contacts/, leads/, opportunities/, pipelines/,
│   │   │   tasks/, activities/, tags/, custom-fields/, statuses/
│   ├── billing/
│   │   └── mercadopago/            (mismo patrón que Nexo, tablas propias)
│   ├── email/
│   │   └── providers/base.ts       (interfaz EmailProvider)
│   ├── calendar/
│   │   └── providers/base.ts       (interfaz CalendarProvider)
│   ├── automations/
│   ├── integrations/
│   │   └── nexo/                   (lectura de nexo.Appointment, NexoLink)
│   ├── business/                   (current.ts, workspace.ts — equivalente
│   │                                 a membership.ts de Nexo)
│   └── account/
├── components/
│   ├── crm/ (por entidad), dashboard/, auth/, ui/
├── lib/
│   ├── auth/auth.ts                (propia instancia, mismo secret que Nexo)
│   ├── prisma.ts                   (mismo patrón: PrismaPg adapter)
│   └── types.ts, schemas.ts
└── prisma/
    ├── schema.prisma                (modelos @@schema("public") espejo +
    │                                 @@schema("crm") propios +, si se adopta
    │                                 7.1, un subset read-only @@schema("nexo"))
    └── migrations/
```

## 14. Estrategia de autenticación (resumen ejecutable)

1. Repo nuevo, `betterAuth()` propia, misma config que `lib/auth/auth.ts` de Nexo (mismo `emailAndPassword.enabled: true`, mismo `generateId: false`).
2. Mismo `DATABASE_URL` (mismo Supabase, apuntando a `public`).
3. **Mismo `BETTER_AUTH_SECRET` desde el día uno** (la única decisión de esta fase con costo cero ahora y costo alto después si se omite).
4. `schema.prisma` del CRM declara sus propios modelos `@@schema("public")` para `User`/`Session`/`Account`/`Verification`/`Business`/`Membership` (necesarios para que el Prisma Client del CRM pueda operar sobre esas tablas — un proyecto Prisma separado necesita su propia declaración de modelo aunque la tabla física ya exista).
5. Sin SSO todavía (4.4) — login independiente por producto, misma identidad subyacente.
6. Autorización: sesión válida → resolver `Membership` → si existe `crm.Workspace` para ese `businessId` y `crm.Subscription` no está `canceled`/`expired` → acceso. Si no existe `Workspace`, redirigir a onboarding del CRM (crea el `Workspace` + `Subscription` trial, mismo patrón que `ensureOwnerMembership`+`ensureTrialSubscription` de Nexo).

## 15. Estrategia de comunicación CRM ↔ Nexo (resumen ejecutable)

- **Lectura de datos de Nexo (ej. Appointment para 7.3):** lectura directa vía Prisma, modelos espejo `@@schema("nexo")` en el schema del CRM, mismo `DATABASE_URL` (7.1) — sin HTTP, con el trade-off de acoplamiento ya documentado.
- **Eventos Nexo → CRM:** poll periódico para el MVP (7.5) — sin tocar Nexo. Outbox (`public.IntegrationEvent`) documentado como mejora futura, requiere tocar Nexo, no se implementa ahora.
- **Nada del CRM escribe en `nexo.*` en ningún escenario de esta fase.** Toda la integración diseñada es de lectura hacia Nexo o de eventos hacia el CRM — nunca al revés.
- **Conversaciones de WhatsApp:** bloqueado, requiere una fase propia sobre Nexo antes de que el CRM pueda construir nada real ahí (7.2).

---

## Riesgos técnicos

1. **`_prisma_migrations` compartida entre dos proyectos Prisma independientes — riesgo real, no verificado.** Nexo y CRM van a ser dos codebases con su propia carpeta `prisma/migrations/`, pero Prisma guarda el historial de migraciones aplicadas en una única tabla `_prisma_migrations`, siempre en `public`, **sin forma de configurar un nombre distinto por proyecto**. Si ambos proyectos corren `prisma migrate deploy` contra la misma base, cada uno va a ver en esa tabla migraciones "aplicadas" que no reconoce en su propia carpeta local (las del otro proyecto) — no tengo forma de confirmar desde acá, sin levantar un segundo proyecto Prisma real, si esto genera solo un warning inofensivo o si el CLI lo trata como drift y se niega a continuar. **No se puede asumir que "simplemente funciona".** Mitigación propuesta: (a) antes de configurar el flujo de migraciones del CRM en serio, probarlo en un entorno descartable con ambos proyectos apuntando a la misma base; (b) si resulta problemático, la migración de `crm.*` puede aplicarse a mano (mismo mecanismo `ALTER`/`CREATE TABLE` ya usado en la Fase 3, sin depender de que `prisma migrate deploy` del CRM conviva bien con el de Nexo) en vez de depender de Prisma Migrate para eso.
2. **Modelos espejo de `nexo.*` en el schema del CRM (7.1) pueden desalinearse** si Nexo cambia esas tablas sin coordinarlo con el equipo del CRM — ya documentado como trade-off aceptado, se repite acá como riesgo de mantenimiento continuo, no de esta fase puntual.
3. **`crm` como schema vacío en `schemas = [...]`:** ya validado empíricamente en la Fase 3 que Prisma 7.8 acepta un schema sin modelos — este riesgo de la Fase 2 ya está resuelto, se menciona solo para no repetir la verificación.
4. **Doble instancia de Better Auth, mismo secret:** si en algún momento alguien rota `BETTER_AUTH_SECRET` en uno de los dos proyectos sin rotar el otro, las sesiones dejan de ser potencialmente compatibles entre productos (aunque hoy no haya SSO activo, esto rompería silenciosamente la preparación para activarlo después) — mitigación: documentar en el README de ambos repos que este valor es compartido y por qué.
5. **Volumen de modelos nuevos (~28) en una sola fase de implementación:** riesgo de alcance, no técnico — se recomienda que la fase de construcción (no esta, de diseño) se divida en sub-entregas (Core primero, billing segundo, email/calendario/automatizaciones después) en vez de intentar migrar todo de una vez.
6. **`ownerId`/roles básicos (4.5, 5) dependen de que el CRM lea `Membership.role`** un campo que hoy Nexo escribe siempre como `"owner"` sin variación — el CRM debe construir su propia UI para invitar usuarios con otros roles (no existe hoy en ningún lado, ni en Nexo ni en el schema actual más allá del campo suelto) — es trabajo real de la fase de construcción, no algo que ya esté resuelto por tener el campo.

## Preguntas abiertas

1. ¿Se prueba el riesgo 1 (`_prisma_migrations` compartida) antes de arrancar la construcción, o se acepta el riesgo y se resuelve si aparece?
2. ¿El repo del CRM vive en el mismo monorepo/organización que Nexo, o es un repositorio completamente separado? (Afecta cómo se comparte el valor de `BETTER_AUTH_SECRET` de forma segura entre ambos, y si conviene un paquete compartido de tipos en algún momento — no ahora.)
3. ¿Se adopta la lectura directa vía modelos espejo (7.1) o se prefiere, desde el arranque, exponer un pequeño API interno en Nexo para las lecturas cross-producto (más desacoplado, pero sí es una modificación a Nexo que habría que justificar y construir)? Este documento recomienda la lectura directa para empezar, pero es una decisión de arquitectura que vale la pena confirmar explícitamente antes de construir.
4. ¿Cuándo se aborda la fase de "persistir conversaciones de WhatsApp en Nexo" (7.2) — es un prerequisito para gran parte de la propuesta de valor de integración, pero es trabajo sobre Nexo, no sobre el CRM, y no está definida su prioridad todavía.
5. ¿"Clientes" (ítem 3 del MVP) necesita distinguirse de `Company` de una forma más rica que un campo de estado/tipo, o alcanza con lo propuesto en 6.2/12?
6. Dominio raíz común (`kodexa.com.ar` con subdominios) para cuando se active SSO (4.4) — no bloquea nada de esta fase, pero conviene decidirlo antes de que existan datos de producción en dos dominios distintos.

---

## Resumen para decidir

El diseño es compatible con la arquitectura ya validada (Fases 1–4): no requiere tocar `nexo.*`, no requiere tocar `public.*`, reutiliza `Business`/`Membership`/`User` tal cual están, y dos de los pedidos de integración más visibles (WhatsApp↔CRM, métricas de tráfico) se identificaron honestamente como bloqueados por trabajo pendiente **en Nexo**, no en el CRM — no se diseñaron por encima de esa realidad. Con eso resuelto, el CRM puede empezar a construirse como un proyecto independiente, compartiendo identidad y empresa, sin ninguna modificación a Nexo en el MVP.
