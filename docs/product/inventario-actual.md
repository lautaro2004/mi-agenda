# Inventario funcional y técnico de Nexo — estado actual

**Fecha del relevamiento:** 2026-09-13
**Método:** lectura directa del código fuente (schema completo de Prisma, módulos, rutas de API, componentes), consulta a la base de datos real, y los documentos internos de `docs/` usados solo como contexto (nunca como prueba de que algo existe — se verificó todo contra el código).

Este documento es una fotografía de lo que existe **hoy**. No propone funcionalidades nuevas. Donde no se pudo confirmar algo con certeza, se dice explícitamente.

---

## 1. Módulos y funcionalidades actuales

### 1.1 Cuenta y onboarding

- **Registro/login** (`/registro`, `/login`): email + contraseña únicamente.
- **Cuenta personal** (`/dashboard/cuenta`): editar nombre, ver email, subir foto de perfil (avatar), cambiar contraseña.
- **Onboarding** (`/onboarding/*`): wizard de 6 pasos — bienvenida, negocio, horarios, servicios, preguntas frecuentes, suscripción. No hay gate a nivel de middleware que fuerce completarlo (`middleware.ts` solo exige que haya sesión); si existe algún gate, vive más adentro (no confirmado en el layout de dashboard).

### 1.2 Negocio (`/dashboard/negocio`)

Editar identidad (logo, nombre, rubro, descripción corta), contacto (teléfono, WhatsApp, dirección), redes (Instagram, Facebook), y una vista previa de "presencia pública". Un solo color de marca (`brandColor`, hex) que se usa como variable CSS en el sitio público.

### 1.3 Horarios (`/dashboard/horarios`)

Un `Schedule` por día de la semana: habilitado/deshabilitado, horario de apertura/cierre, y un corte opcional (`hasBreak` + inicio/fin). Es la fuente real de la disponibilidad de turnos (ver 1.5).

### 1.4 Servicios y recursos (`/dashboard/servicios`, `/dashboard/recursos`)

- **Servicios**: nombre, descripción, categoría, duración, precio, imagen, activo/inactivo. Único por negocio+nombre.
- **Recursos** (`/dashboard/recursos`): CRUD completo — crear, editar, activar/desactivar, **eliminar** (con soft-delete automático: si el recurso ya tiene turnos asociados, en vez de borrarlo lo desactiva y avisa que lo hizo). Un recurso (cancha, sala, silla, profesional) puede prestarse a varios servicios (relación N:M vía `ServiceResource`).
- Un servicio **sin** recursos asignados usa la agenda general del negocio (un turno a la vez por horario); un servicio **con** recursos reparte la disponibilidad entre ellos y asigna automáticamente el primero libre.

### 1.5 Turnos / agenda (`/dashboard/turnos`)

- Es una **lista filtrable y buscable**, no un calendario. Filtros por estado (pendiente, confirmado, pendiente de pago, comprobante enviado, comprobante rechazado, cancelado, completado, "todos") y búsqueda por texto.
- Acciones reales: **crear** un turno manualmente, **reprogramar**, **cancelar**. Revisión de comprobantes de seña integrada en la misma pantalla (ver 1.6).
- **No existe** una acción para marcar un turno como "completado" o "no asistió" — esos dos estados existen en el modelo de datos pero nada en el código los escribe nunca desde la UI del dueño (verificado por búsqueda exhaustiva).
- **Reserva pública sin WhatsApp**: el sitio público (`/s/[slug]` y `/s/[slug]/reservar`) tiene un widget de reserva real que usa exactamente el mismo motor de disponibilidad/creación que usa la IA por WhatsApp — un cliente puede reservar sin pasar nunca por WhatsApp.
- El cálculo de disponibilidad respeta: horario habilitado del día, corte (break), turnos ya existentes en estados activos, y conflictos a nivel de recurso cuando el servicio los usa.

### 1.6 Señas y comprobantes de pago

- Configuración por negocio (`Business.depositRequired`, tipo fijo o porcentaje, alias/CBU/banco/titular/CUIT, instrucciones) — un único método de cobro configurado, no una lista.
- Cuando un negocio requiere seña, todo turno nuevo queda en `pending_payment` en vez de confirmarse directo.
- El cliente sube un comprobante (imagen) ya sea por WhatsApp o desde el sitio público; el turno pasa a `payment_submitted`.
- El dueño lo revisa desde la misma pantalla de Turnos (no hay una pantalla dedicada de "pagos"): **aprobar** confirma el turno y notifica al cliente por WhatsApp; **rechazar** (con motivo opcional) vuelve el turno a `payment_rejected` y le avisa al cliente que puede reenviar. Ambas acciones son idempotentes.
- Comprobantes huérfanos (subidos pero nunca vinculados a un turno) se limpian automáticamente después de 7 días vía cron.

### 1.7 Sitio público (`/s/[slug]`)

- Generado 100% a partir de datos reales del negocio, sin contenido inventado.
- **Dos plantillas**, elegidas automáticamente según si el negocio vende turnos como producto principal o no (o fijadas a mano desde Configuración):
  - `institutional`: hero, "sobre nosotros", servicios, galería, proceso, sección de reserva, horarios, FAQ, CTA final.
  - `booking`: hero orientado a reservar, servicios reservables, info importante, galería, horarios, FAQ (máx. 5), con una barra de reserva fija (sticky) y WhatsApp flotante.
- **Carta digital + QR**: un PDF que el dueño sube, visible en `/s/[slug]/carta` solo si está activada Y tiene PDF cargado; se genera un código QR real (paquete `qrcode`) que apunta a esa URL.
- **Galería**: bloques reordenables con una o varias imágenes cada uno.
- **SEO generado por IA**: `modules/business/seo.ts` arma un prompt con datos reales del negocio y llama a Gemini para generar título, meta descripción, H1, Open Graph. El sitio público **nunca** llama a la IA al momento de la visita — solo lee lo ya guardado, o cae a un fallback determinístico (sin IA) si todavía no se generó nada. El JSON-LD (schema.org LocalBusiness) es 100% generado por código, nunca por IA.

### 1.8 AI Studio

- **Entrenamiento** (`/dashboard/ai-studio/training`): un chat real con la IA (no un formulario) en dos modos — "onboarding" y "continuo". Las respuestas del dueño se convierten en propuestas de cambios reales (agregar/editar servicios, FAQs, personalidad del empleado, objetivos, restricciones, memoria) que el dueño debe **confirmar explícitamente** antes de que se apliquen — no se escriben solas. Incluye un **plan de entrenamiento** real (una lista de secciones tipo checklist, generada por la propia IA) que efectivamente dirige sobre qué tema pregunta la IA a continuación — no es decorativo.
- **Empleado** (`/dashboard/ai-studio/employee`): nombre, rol, descripción, y 5 "diales" de personalidad (formalidad, calidez, uso de emojis, longitud de respuesta, nivel comercial) — todos estos **sí** afectan el prompt real. Objetivos y restricciones (listas editables) — también se inyectan al prompt real. **Capacidades** (turnos, consultas, ventas, recordatorios, cancelaciones, reprogramación) — existen en la UI, se guardan, pero **no están conectadas a ninguna lógica real todavía**; la propia interfaz lo dice explícitamente ("la lógica de cada capacidad se irá conectando en próximas etapas").
- **Memoria** (`/dashboard/ai-studio/memory`): entradas manuales (título/contenido/categoría/importancia) y subida de documentos (PDF vía `pdf-parse`, DOCX vía `mammoth`). El procesamiento es **sincrónico** (no hay cola/background job): el texto se extrae en el mismo request, se trunca a 8.000 caracteres, y queda listo o en error — no hay un estado intermedio "procesando" real. No hay búsqueda semántica/embeddings: el texto se inyecta tal cual al prompt.
- **Simulador** (`/dashboard/ai-studio/simulator`): chat de prueba real que usa el mismo armado de prompt y la misma llamada a Gemini que WhatsApp, pero **sin** los efectos secundarios reales (no dispara reglas de negocio ni crea turnos). Nada se guarda salvo que el dueño use la función de "corrección", que si es real: guarda una entrada de memoria permanente que después sí afecta respuestas reales.

### 1.9 WhatsApp (`/dashboard/whatsapp/*`)

- **Conexión**: emparejamiento por código QR (vía `baileys`), estado de conexión (desconectado/conectando/conectado/reconectando/error), reconexión automática con demora fija de 3 segundos, desconexión manual, toggle global de "respuestas automáticas".
- **Conversaciones**: lista con búsqueda, filtro por estado y por etiqueta; detalle con historial completo, respuesta manual, cambio de estado, etiquetas, modo manual por conversación (pausa la IA solo para esa charla), y un panel de "análisis de IA" (clasificación, confianza, última acción).
- **Respuesta automática**: un mensaje entrante pasa primero por un motor de reglas simple; si ninguna regla aplica, recién ahí se llama a Gemini. Si Gemini detecta que hace falta un humano (o si directamente no hay `GEMINI_API_KEY` configurada), la conversación pasa a modo manual y se genera una notificación para el dueño.
- **Importante**: las conversaciones y mensajes de WhatsApp **no se guardan en la base de datos** — viven en memoria del proceso y se pierden en cada reinicio/deploy. Solo las credenciales de sesión de WhatsApp persisten (en el sistema de archivos del servidor, no en la base).

### 1.10 Notificaciones

Campanita en la barra superior del dashboard (no hay pantalla dedicada), con conteo de no leídas, marcar una o todas como leídas, y cada notificación linkea a la pantalla relevante. Se actualiza por **sondeo cada 30 segundos**, no en tiempo real. Exactamente 6 tipos reales: nueva reserva, reserva pendiente, reserva cancelada, comprobante recibido, se necesita un humano, límite de IA alcanzado.

### 1.11 Estadísticas (`/dashboard/estadisticas`)

Calculado en vivo contra Postgres en cada visita (sin cachear). Muestra: turnos totales/confirmados/cancelados/esperando pago, comprobantes (recibidos/aprobados/rechazados), uso de IA (cantidad de respuestas y tokens), y un ranking de los 8 servicios más reservados (con barras simples de CSS, sin librería de gráficos). **No muestra ingresos/facturación ni tasa de conversión**, a pesar de que el modelo de datos ya guarda los montos de cada turno. Esta sección está bloqueada por plan (`Plan.statsEnabled`).

### 1.12 Suscripciones, planes y Mercado Pago

Ver sección 3 (Integraciones) para el detalle de Mercado Pago. En resumen, el dueño puede ver su plan actual, contratar un plan pago con tarjeta real (Mercado Pago), cancelar la suscripción (vuelve a Gratis), y aplicar un código promocional.

### 1.13 Leads comerciales y landing

- Dos landings conviven: la principal (`/`) y una de adquisición para tráfico pago (`/negocio-online`).
- Un formulario de "evaluación" captura leads (nombre, negocio, WhatsApp, email, rubro, objetivos, volumen mensual, mensaje, si quiere reunión) sin necesitar cuenta. Nunca crea un negocio automáticamente.
- Superadmin gestiona el pipeline manualmente: NEW → CONTACTED → MEETING → PROPOSAL → CONVERTED → LOST, con notas internas y la posibilidad de vincular el lead a un negocio ya existente (a mano, nunca automático).

### 1.14 Panel de Superadmin (`/superadmin/*`)

- **Empresas**: lista y detalle de cada negocio, asignar plan a mano, otorgar beneficios temporales (plan superior por X días).
- **Planes**: crear/editar planes, ver su estado de sincronización con Mercado Pago.
- **Códigos promocionales**: crear/editar, ver canjes.
- **Leads**: pipeline completo.
- **IA**: único dashboard con gráfico real (barras) — uso de IA (tokens, requests) por operación, en el tiempo, y rankeado por negocio, con filtro por negocio y por operación.

### Relaciones entre módulos (resumen)

`Business` es el centro: de ahí cuelgan Servicios, Recursos, Horarios, FAQs, Galería, Turnos, Empleado (IA), Memoria, Suscripción, Notificaciones. `Plan` → `Subscription` → `Business` habilita/deshabilita funciones (WhatsApp, señas, entrenamiento personalizado, estadísticas, galería, carta digital, cantidad de servicios) mediante un único punto de resolución en código (`resolvePlanFeatures`/`resolveAiAccess`). La configuración del Empleado y la Memoria alimentan el mismo prompt que usan WhatsApp, el Simulador y el Entrenamiento. El widget de reserva público y el flujo de WhatsApp comparten el mismo motor de turnos. Un Lead puede terminar vinculado a un Business existente, pero nunca crea uno.

---

## 2. Usuarios y permisos

- **Un único rol real: "owner"**, hardcodeado como string al crear la membresía (`modules/business/membership.ts`). No hay ningún otro valor de rol en uso en ningún lado del código, y `Membership.role` **nunca se lee para autorizar nada** — solo se usa dos veces, en consultas de Superadmin, para mostrar quién es el dueño.
- **No existe gestión de equipo**: no hay invitaciones, no hay forma de agregar un segundo usuario a un negocio, no hay pantalla para eso. El propio código de creación de membresía es idempotente ("si ya tenés una, te devuelvo esa") — nunca crea una segunda.
- **"Negocio actual"** se resuelve tomando la **primera** membresía que encuentre para ese usuario (`findFirst`, sin orden explícito) — no hay selector de negocio ni sesión que recuerde "cuál es el activo". En la práctica, hoy es un usuario = un negocio.
- El modelo de datos (`Membership` como tabla puente) técnicamente permitiría que un usuario tuviera varios negocios, pero **nada en el código crea nunca una segunda fila** para el mismo usuario — es una capacidad del esquema, no una funcionalidad usada.
- **Multi-tenancy de datos**: sí, real y consistente — toda consulta relevante está filtrada por `businessId`, un negocio nunca ve datos de otro (con una excepción real encontrada: el bus de eventos de WhatsApp por Server-Sent Events no filtra por negocio los eventos de conversación/mensaje que empuja a todos los clientes conectados — ver sección 8).
- **Multi-sucursal / multi-empleado con disponibilidad propia**: no existen. Están explícitamente en el backlog del propio equipo (`docs/product/backlog.md`, prioridad media), no implementados.
- **Superadmin**: no es un rol de base de datos. Es un allowlist de emails en una variable de entorno (`SUPERADMIN_EMAILS`), chequeada en cada layout/ruta de Superadmin contra la sesión activa. Sin esa variable configurada, nadie es superadmin (falla cerrado).

---

## 3. Integraciones

### 3.1 Autenticación — Better Auth

- Solo **email + contraseña**. No hay ningún proveedor social/OAuth configurado (Google, etc. no existen hoy).
- La verificación de email (`emailVerified`) se guarda en la base pero **no se exige en ningún lado** — no hay ninguna verificación de bloqueo por email no verificado.
- **No existe recuperación de contraseña** (ni pantalla, ni endpoint, ni configuración en Better Auth) — coincide con lo que el propio `docs/product/mvp.md` marca como "posterior al MVP".
- **No hay ninguna integración de envío de emails** en todo el proyecto (no hay Resend, SendGrid, Nodemailer, AWS SES ni nada similar en las dependencias, y Better Auth no tiene configurado ningún callback de envío). Esto no es "deshabilitado silenciosamente" — la funcionalidad de email de Better Auth directamente nunca se activó.

### 3.2 Pagos — Mercado Pago

Integración real y funcional, construida e íntegramente verificada en esta misma sesión de trabajo:

- **Planes** (`preapproval_plan`): Superadmin crea/edita un Plan de Nexo y eso sincroniza un `preapproval_plan` real en Mercado Pago. Si cambia el precio, se crea una **versión nueva** del plan en MP en vez de mutar el existente (para no afectar a quien ya está suscripto al precio viejo).
- **Contratación**: el dueño paga con tarjeta real dentro de la app (Checkout Bricks / Card Payment Brick de Mercado Pago — la tarjeta nunca toca nuestro backend, se tokeniza en el navegador). Confirmado funcionando de punta a punta contra producción real (se hizo y canceló una suscripción real de prueba).
- **Webhook** (`POST /api/webhooks/mercadopago`): valida la firma con el validador que trae el propio SDK oficial, es idempotente (tabla dedicada para no reprocesar notificaciones repetidas), y siempre relee el estado real desde la API de Mercado Pago antes de escribir — nunca confía ciegamente en el payload de la notificación.
- **Cancelación**: el dueño puede cancelar su suscripción desde `/dashboard/suscripcion`; esto cancela el `preapproval` real en Mercado Pago y el negocio vuelve al plan Gratis.
- **Limitación real de sandbox confirmada** (no es un bug nuestro): crear una suscripción con tarjeta de **prueba** contra el endpoint de Mercado Pago falla con `"Card token service not found"` — se investigó a fondo (múltiples tarjetas de prueba, con y sin plan asociado) y se confirmó, probando con una tarjeta real contra producción, que el problema es una limitación del sandbox de Mercado Pago para este flujo específico, no de la integración.
- **No implementado todavía**: un cron de reconciliación periódica (para detectar cambios de estado que un webhook perdido no reportó), y mejoras de visualización del estado de Mercado Pago en `/superadmin/empresas/[id]` — ambos quedaron explícitamente fuera de alcance de las fases ya hechas.
- Los beneficios temporales y los códigos promocionales **nunca** tocan Mercado Pago — son manejados enteramente por Nexo, por diseño explícito.

### 3.3 IA — Google Gemini

Vía `@google/generative-ai`. Modelo configurable por variable de entorno `GEMINI_MODEL` (hoy: `gemini-3.5-flash-lite`). Se usa para: clasificación/triage de mensajes de WhatsApp, generación de respuestas (WhatsApp, Simulador, Entrenamiento), generación de configuración SEO. No se usa para decisiones de negocio "duras" (la disponibilidad de turnos, por ejemplo, la calcula código determinístico, no la IA).

### 3.4 WhatsApp — Baileys

Conexión no oficial a WhatsApp Web (paquete `baileys`, no es una API oficial de Meta/WhatsApp Business). Las credenciales de sesión se guardan en el sistema de archivos del servidor (no en la base de datos ni en Supabase Storage) — una limitación real para hosting serverless/efímero (ver sección 8).

### 3.5 Almacenamiento — Supabase Storage

Tres buckets: `site-assets` (público — logos, fotos de portada, galería, fotos de servicio), `payment-proofs` (privado — comprobantes, se accede vía URL firmada de corta duración), `knowledge-documents` (privado — documentos subidos a Memoria). Supabase se usa **solo** para storage y como host de la base Postgres — la autenticación la maneja Better Auth, no Supabase Auth.

### 3.6 APIs y webhooks propios

No hay ninguna API pública expuesta a terceros ni documentada para desarrolladores externos (está en el backlog, prioridad baja). El único webhook que Nexo **recibe** es el de Mercado Pago; Nexo no ofrece webhooks salientes a sus clientes.

### 3.7 Tareas programadas (cron)

Tres endpoints internos protegidos por un secreto compartido (`CRON_SECRET`): limpieza de comprobantes de pago huérfanos, limpieza de archivos huérfanos en Storage, y reversión de beneficios temporales vencidos. **No hay un scheduler dentro del repo** (no se encontró `vercel.json`/`netlify.toml` ni configuración equivalente) — deben ser disparados por algo externo (un cron de la plataforma de hosting, configurado fuera del código). No se pudo confirmar con certeza cuál es la plataforma de deploy desde el código del repositorio.

---

## 4. IA

### 4.1 Funcionalidades reales

- Responder mensajes de WhatsApp (reglas simples primero, Gemini como respaldo).
- Clasificar/triage de la intención del mensaje entrante.
- Gestionar el flujo de reserva por turnos (una máquina de estados de código, no la IA improvisando).
- Escalar a un humano cuando corresponde (con una notificación real al dueño).
- Conversación de entrenamiento (configurar el negocio charlando, en dos modos), con propuestas de cambios que el dueño confirma.
- Plan de entrenamiento generado y mantenido por la propia IA (checklist que dirige la conversación).
- Simulador de conversación (mismo pipeline que WhatsApp, sin efectos secundarios) + corrección de respuestas (que sí persiste como memoria real).
- Generación de configuración SEO del sitio público.

### 4.2 Qué información puede consultar

Datos reales del negocio (identidad, servicios, horarios, política de depósito), configuración de personalidad/objetivos/restricciones del Empleado, y las entradas de Memoria activas (manuales + texto extraído de documentos, sin búsqueda semántica — se inyecta todo el texto disponible, truncado a 8.000 caracteres).

### 4.3 Qué acciones puede ejecutar

Crear, reprogramar y cancelar turnos (a través del motor de reservas, no de forma libre), y marcar una conversación para intervención humana. No genera contenido de marketing, no manda campañas, no hace nada fuera de la conversación 1:1 con un cliente o el dueño.

### 4.4 Qué es prototipo / no está conectado

- Las **"capacidades" del Empleado** (turnos, consultas, ventas, recordatorios, cancelaciones, reprogramación): existen en el modelo de datos y en la UI, se pueden tildar/destildar, pero **no se leen en ningún punto real de la IA o del motor de reservas** — es la propia interfaz la que avisa que todavía no están conectadas.
- La detección de "necesita un humano" se basa en buscar las frases literales `"derivar con"` / `"nuestro equipo"` dentro de la respuesta que generó la propia IA — es una heurística frágil, no una señal estructurada.
- No hay límite de uso de IA aplicado en el camino de WhatsApp (si bien existe el concepto de créditos de IA por plan y una notificación de "límite alcanzado", esa notificación solo se dispara desde el flujo de Entrenamiento, no desde las respuestas de WhatsApp).

---

## 5. Modelo de datos

### 5.1 Entidades principales (Postgres vía Prisma, todas con `businessId` cuando corresponde a un negocio)

**Cuenta/auth:** `User`, `Session`, `Account`, `Verification` (tablas estándar de Better Auth), `Membership` (User↔Business, rol siempre "owner").

**Negocio y sitio:** `Business` (identidad, contacto, config. de seña, config. de carta digital, plantilla de sitio), `Schedule`, `Service`, `Resource`, `ServiceResource` (N:M), `FAQ`, `GalleryBlock`/`GalleryImage`, `SeoConfig` (1:1).

**Turnos y pagos:** `Appointment`, `PaymentProof`.

**IA:** `Employee` (1:1 con Business), `EmployeeGoal`, `EmployeeRestriction`, `EmployeeCapability`, `MemoryEntry`, `TrainingPlan`/`TrainingPlanSection`, `TrainingConversation`/`TrainingMessage`, `AiUsageEvent` (ledger de consumo, sin relación estricta a Business).

**Comercial/facturación:** `Plan`, `Subscription` (1:1 con Business), `MercadoPagoWebhookEvent` (idempotencia), `PromoCode`/`PromoCodeRedemption`, `Lead`.

**Notificaciones:** `BusinessNotification`.

*(No hay modelo de conversaciones/mensajes de WhatsApp — esos viven solo en memoria, ver sección 3.4 y 8.)*

### 5.2 Relaciones clave

`Business` es 1:N con casi todo lo demás (Servicios, Recursos, Horarios, FAQs, Turnos, Galería, Notificaciones) y 1:1 con `Employee`, `SeoConfig`, `Subscription`. `Service`↔`Resource` es N:M vía `ServiceResource`. `Appointment` referencia opcionalmente `Service` y `Resource`, y tiene 1:N con `PaymentProof`. `Subscription` referencia un `Plan`. `Lead` puede vincularse opcionalmente (`SetNull` si se borra) a un `Business` ya convertido.

### 5.3 Rígido vs. configurable

- **Rígido** (definido en código, no editable desde la UI): los valores válidos de cada campo de estado (`Appointment.status`, `Subscription.status`, `Lead.status`, etc. — todos son `String` en el esquema, sin `enum` de Prisma, pero la lista de valores válidos vive fija en el código TypeScript); las 6 columnas de features de `Plan` (no es una tabla de features genérica — cada una está atada a un punto de gate real en el código, agregar una nueva es una migración, no una configuración); el rol único "owner".
- **Configurable por el dueño del negocio**: horarios, servicios, recursos, FAQs, galería, personalidad/objetivos/restricciones/memoria del Empleado, plantilla del sitio, configuración de seña, carta digital.
- **Configurable por Superadmin**: planes (precio, créditos de IA, features incluidas), códigos promocionales, beneficios temporales, plan/estado de cada negocio.

---

## 6. Arquitectura

### 6.1 Stack confirmado (`package.json`)

- **Framework**: Next.js 15.5 (App Router), React 19.2, TypeScript 5.
- **Base de datos**: PostgreSQL (hosteada en Supabase), acceso vía Prisma 7.8 con el adapter `@prisma/adapter-pg` (driver `pg` directo, no el motor binario clásico de Prisma).
- **Autenticación**: Better Auth 1.6.
- **IA**: `@google/generative-ai` (Gemini).
- **WhatsApp**: `baileys`.
- **Pagos**: `mercadopago` (SDK oficial del servidor) + `@mercadopago/sdk-react` (Checkout Bricks del cliente).
- **Storage**: `@supabase/supabase-js`.
- **UI**: Tailwind CSS v4, `@base-ui/react` (primitivas, patrón shadcn), `framer-motion`, `lucide-react`, `sonner` (toasts).
- **Formularios**: `react-hook-form` + `zod`.
- **Documentos**: `pdf-parse`, `mammoth` (extracción de texto para Memoria), `qrcode` (QR de la carta digital).
- **Testing**: `vitest` (unit tests sobre los `modules/*`, mockeando Prisma — no hay tests end-to-end ni de componentes, no hay `@testing-library` instalado).
- **Logging**: `pino`.

### 6.2 Estructura general

- `app/`: rutas de Next.js — `dashboard/*` (panel del dueño), `onboarding/*`, `superadmin/*`, `s/[slug]` (sitio público por negocio), `api/*` (Route Handlers, backend), páginas de auth y las dos landings.
- `modules/`: la lógica de negocio real, organizada por dominio (`business`, `appointments`, `payments`, `whatsapp`, `ai`, `employee`, `billing` con subcarpeta `mercadopago`, `leads`, `promo-codes`, `notifications`, `analytics`, `account`). Las rutas de API son delgadas y delegan acá — no tienen lógica de negocio propia.
- `components/`: UI, organizada por área (`dashboard`, `public-site`, `landing`, `landing-ads`, `superadmin`, `auth`, `ui` genéricos).
- `lib/`: utilidades transversales (auth, formatters, límites, tipos compartidos, cliente HTTP, etc.).
- `prisma/`: schema único + migraciones.

No hay un backend separado ni microservicios: todo corre dentro de la misma app Next.js (Route Handlers como API).

### 6.3 Multi-tenancy técnico

Aislamiento de datos por `businessId` en cada consulta relevante (no hay un esquema de base separado por negocio, es un único schema compartido con scoping por columna).

### 6.4 Estado y persistencia — puntos a tener en cuenta

- La sesión de WhatsApp (credenciales) se persiste en el **filesystem del servidor**, no en la base. Las conversaciones/mensajes de WhatsApp viven **solo en memoria** del proceso Node — ver limitaciones (sección 8).
- El rate limiting (usado hoy solo en el formulario público de leads) es un contador en memoria por proceso, no distribuido (documentado así explícitamente en el propio código).
- No se confirmó con certeza la plataforma de despliegue desde el repositorio (no hay archivo de configuración de Vercel/Netlify en el repo).

---

## 7. Funcionalidades incompletas

- **Capacidades del Empleado IA** (turnos/consultas/ventas/recordatorios/cancelaciones/reprogramación): existentes en base de datos y UI, **no conectadas** a ninguna lógica real — la propia interfaz lo declara.
- **Estados `completed`/`no_show` de turnos**: existen en el modelo de datos, se pueden filtrar y mostrar, pero no hay ninguna acción en la UI que los produzca.
- **Procesamiento de documentos de Memoria**: sincrónico únicamente; el campo `processingStatus` sugiere un diseño pensado para más estados (ej. "procesando" en cola) que nunca se implementó — hoy solo existe "listo" o "error".
- **Reconciliación periódica de Mercado Pago** (cron que vuelva a consultar el estado real de cada suscripción activa) y **mejoras de visualización de Mercado Pago en Superadmin › Empresas**: identificadas y explícitamente pospuestas durante el desarrollo de la integración de pagos.
- **Notificación de "límite de IA alcanzado"**: el mecanismo existe, pero solo se dispara desde el flujo de Entrenamiento — no desde las respuestas automáticas de WhatsApp, que es el camino de mayor volumen real.
- **"Datos de ejemplo" de WhatsApp**: la pantalla de conversaciones muestra un aviso de que se están viendo "datos de ejemplo" cuando no hay conexión activa, pero no existe ningún dato de ejemplo real en el código — el aviso queda descolgado de la realidad (la lista simplemente aparece vacía).
- **Selector de negocio / múltiples negocios por usuario**: el modelo de datos lo permite (`Membership` es una tabla puente), pero no hay ninguna funcionalidad que cree una segunda membresía ni UI para cambiar de negocio activo.

## Código existente pero no integrado (hallazgos puntuales)

- `EmployeeCapability` y sus 6 claves: escrito y leído por la UI y por el entrenamiento (la IA puede proponer cambios ahí), pero nunca leído por el motor de IA/reservas al responder.
- `lib/mock-data.ts`: no es contenido de demostración inventado — son los valores por defecto/vacíos usados para inicializar el estado de onboarding (uso legítimo, no confundir con datos falsos mostrados a un usuario).

---

## 8. Limitaciones actuales

- **WhatsApp no tiene persistencia de conversaciones**: todo el historial de chat vive en memoria del proceso y se pierde en cada reinicio o despliegue. Solo las credenciales de sesión sobreviven (en filesystem).
- **Arquitectura de WhatsApp no apta para múltiples instancias**: las conexiones de Baileys, las conversaciones y el estado de sesión son todos locales al proceso — correr más de una instancia/pod del servidor no comparte ese estado entre sí.
- **Fuga de datos entre negocios en el bus de eventos de WhatsApp**: el stream de Server-Sent Events que empuja actualizaciones de conversaciones/mensajes en tiempo real no está filtrado por negocio — cualquier cliente conectado recibe eventos de todos los negocios (mitigado en la práctica porque la lista de conversaciones en sí se pide filtrada por negocio, pero el evento en crudo viaja igual).
- **Dos rutas de la API de conversaciones de WhatsApp no verifican que la conversación pertenezca al negocio de quien hace el pedido** (a diferencia de las demás rutas de WhatsApp, que sí lo hacen) — un riesgo real de acceso entre negocios si alguien adivina/obtiene el id de una conversación ajena.
- **Sin recuperación de contraseña ni verificación de email real**: si un usuario pierde su contraseña, hoy no hay forma de recuperarla desde el producto.
- **Sin ningún envío de email**: ninguna notificación, confirmación ni alerta sale por email — todo pasa por WhatsApp o queda solo dentro del dashboard.
- **Un usuario = un negocio, en la práctica**: no hay equipos, no hay invitar a alguien más a gestionar el mismo negocio, no hay roles con permisos distintos (todo lo que no sea Superadmin tiene exactamente los mismos permisos sobre su propio negocio).
- **Sin multi-sucursal ni multi-profesional con agendas independientes**: un negocio es una sola entidad con una sola agenda (los "Recursos" reparten turnos entre canchas/salas/sillas, pero no representan sucursales ni empleados con su propio horario).
- **Rate limiting no distribuido**: el único freno anti-spam que existe (en el formulario de leads) es un contador en memoria por proceso — no es un límite estricto ante múltiples instancias.
- **Estadísticas limitadas**: no hay ingresos, no hay tasa de conversión, no hay gráficos en el dashboard del dueño (sí existe un gráfico real, pero solo en el panel interno de Superadmin, sobre uso de IA agregado de toda la plataforma).
- **`Plan` no es un sistema de features genérico**: cada funcionalidad gateada por plan es una columna booleana fija en el código — agregar una nueva restricción por plan requiere una migración de base y un cambio de código, no es configurable desde una UI genérica.
- **Sin API pública ni integraciones salientes** (Google Calendar, Stripe, Outlook, Zoom, etc.) — todo lo que no sea Mercado Pago/Gemini/WhatsApp/Supabase es, hoy, inexistente (y explícitamente backlog del propio equipo).
- **Reconciliación de Mercado Pago dependiente del webhook**: si una notificación de Mercado Pago se perdiera y no hubiera reintento exitoso, no hay today un barrido periódico que la detecte y corrija sola.

---

## 9. Inventario final

| Área | Funcionalidad | Estado | Descripción breve |
|---|---|---|---|
| Cuenta | Registro / login (email+contraseña) | Implementado | Sin OAuth/social |
| Cuenta | Recuperar contraseña | No implementado | No existe pantalla ni backend |
| Cuenta | Verificación de email | No implementado | El campo existe, no se exige en ningún lado |
| Cuenta | Perfil (avatar, nombre, cambiar contraseña) | Implementado | `/dashboard/cuenta` |
| Onboarding | Wizard de 6 pasos | Implementado | Negocio, horarios, servicios, FAQs, suscripción |
| Negocio | Editar identidad/contacto/redes | Implementado | `/dashboard/negocio` |
| Negocio | Horarios por día + corte | Implementado | Fuente real de disponibilidad |
| Negocio | Servicios (CRUD) | Implementado | |
| Negocio | Recursos (CRUD + soft delete) | Implementado | Canchas/salas/sillas/profesionales |
| Negocio | Multi-sucursal | No implementado | Backlog del equipo |
| Turnos | Lista/filtro/búsqueda | Implementado | Sin vista de calendario |
| Turnos | Crear/reprogramar/cancelar (dueño) | Implementado | |
| Turnos | Marcar completado / no-show | No implementado | Estados existen, sin acción real |
| Turnos | Reserva pública sin WhatsApp | Implementado | Mismo motor que WhatsApp |
| Turnos | Disponibilidad por recurso | Implementado | Auto-asignación al primero libre |
| Pagos | Seña / comprobante (config + revisión) | Implementado | Aprobar/rechazar, notifica por WhatsApp |
| Pagos | Suscripción paga (Mercado Pago) | Implementado | Validado en producción real |
| Pagos | Cancelar suscripción | Implementado | Cancela en MP + vuelve a Gratis |
| Pagos | Reconciliación periódica MP | No implementado | Depende 100% del webhook |
| Pagos | Códigos promocionales | Implementado | Canje único, nunca toca MP |
| Pagos | Beneficios temporales (Superadmin) | Implementado | Plan superior por X días |
| Sitio público | Generación automática (2 plantillas) | Implementado | Institucional / booking |
| Sitio público | Galería | Implementado | Bloques reordenables |
| Sitio público | Carta digital + QR | Implementado | Gated por plan y por PDF cargado |
| Sitio público | SEO generado por IA | Implementado | Con fallback determinístico |
| AI Studio | Entrenamiento conversacional | Implementado | Propuestas requieren confirmación |
| AI Studio | Plan de entrenamiento (checklist) | Implementado | Dirige la conversación real |
| AI Studio | Personalidad del Empleado (5 diales) | Implementado | Afecta el prompt real |
| AI Studio | Objetivos / restricciones | Implementado | Afecta el prompt real |
| AI Studio | Capacidades del Empleado | Prototipo | UI+datos, sin lógica conectada |
| AI Studio | Memoria manual | Implementado | |
| AI Studio | Memoria por documento (PDF/DOCX) | Implementado | Procesamiento sincrónico, sin cola |
| AI Studio | Búsqueda semántica en memoria | No implementado | Texto plano, sin embeddings |
| AI Studio | Simulador de conversación | Implementado | Mismo pipeline que WhatsApp, sin side-effects |
| AI Studio | Corrección de respuestas | Implementado | Persiste como memoria real |
| WhatsApp | Conexión por QR + reconexión | Implementado | Filesystem para credenciales |
| WhatsApp | Respuesta automática (reglas + Gemini) | Implementado | |
| WhatsApp | Historial de conversaciones persistente | No implementado | Solo en memoria del proceso |
| WhatsApp | Escalamiento a humano | Implementado | Heurística de texto, no estructurada |
| WhatsApp | Aislamiento de eventos por negocio (SSE) | Parcial | Snapshot inicial sí, eventos en vivo no |
| Notificaciones | Campanita + 6 tipos reales | Implementado | Sondeo cada 30s, no push real |
| Estadísticas | Turnos/comprobantes/uso IA por negocio | Implementado | Sin ingresos ni conversión |
| Estadísticas | Gráficos (dueño) | No implementado | Solo barras CSS |
| Estadísticas | Gráficos (Superadmin, uso de IA global) | Implementado | Único gráfico real del producto |
| Usuarios | Rol único "owner" | Implementado | Nunca se usa para autorizar |
| Usuarios | Roles múltiples / permisos granulares | No implementado | Backlog del equipo |
| Usuarios | Invitar miembros de equipo | No implementado | Sin UI ni backend |
| Usuarios | Selector de negocio / multi-negocio | No implementado | Esquema lo permite, nada lo usa |
| Usuarios | Superadmin (allowlist por email) | Implementado | Fuera del modelo de datos |
| Integraciones | Envío de emails | No implementado | Ninguna integración en el proyecto |
| Integraciones | Google Calendar / Stripe / Zoom / etc. | No implementado | Backlog del equipo |
| Integraciones | API pública | No implementado | Backlog del equipo |
| Leads | Captura + pipeline manual | Implementado | Nunca crea un negocio automáticamente |
| Superadmin | Empresas / Planes / Códigos / Leads / IA | Implementado | Panel interno completo |

---

## Capacidades actuales de Nexo (síntesis para roadmap)

1. Nexo hoy es un producto **de un solo negocio por cuenta**: no hay equipos, roles con permisos distintos, ni multi-sucursal — cualquier plan de "colaboración" o "empresa con varias sedes" parte de cero.
2. La **IA ya gestiona reservas de punta a punta** (clasificar, conversar, crear/reprogramar/cancelar turnos, cobrar seña, escalar a humano) — el roadmap puede construir sobre este motor en vez de crear uno nuevo.
3. El **motor de disponibilidad/reservas es genérico** (recursos intercambiables, servicios con o sin recurso) y ya es compartido entre WhatsApp y el sitio público — es un buen punto de apoyo para nuevos canales de reserva.
4. **WhatsApp no tiene memoria persistente de conversaciones** — cualquier funcionalidad futura que dependa de "historial de charla con un cliente" (CRM, seguimiento, remarketing) necesita primero resolver la persistencia, hoy inexistente.
5. La **personalización de la IA es real pero superficial**: 5 diales de tono + objetivos/restricciones + memoria de texto plano. No hay biblioteca de "skills"/capacidades conectadas todavía, aunque el modelo de datos ya las anticipa (`EmployeeCapability`).
6. **Los planes y el gating por plan son un sistema simple y rígido** (columnas fijas, no un feature-flag genérico) — escalar la cantidad de "cosas que un plan puede activar/desactivar" hoy implica tocar código y migrar la base cada vez.
7. **Mercado Pago ya es un proveedor de pagos real y probado en producción** (no sandbox-only) — altas, cancelaciones y webhooks funcionan; falta reconciliación periódica como red de seguridad.
8. **No existe ningún canal de email** — ni transaccional ni de marketing. Cualquier funcionalidad que hoy se dé por sentada en otros SaaS (recuperar contraseña por email, recibos por email, confirmaciones) no existe.
9. El **sitio público por negocio y su SEO generado por IA ya son un diferencial construido** — con dos plantillas y generación determinística de respaldo si la IA no generó nada.
10. Las **estadísticas actuales son operativas, no de negocio**: cuentan turnos y uso de IA, pero no ingresos ni conversión — cualquier "dashboard de resultados para el dueño" (el argumento comercial más fuerte de un CRM) está sin construir.
11. El modelo de "beneficios temporales" y "códigos promocionales" ya da a Superadmin una palanca comercial manual real, independiente de Mercado Pago — útil como base para campañas o programas de referidos futuros.
12. La **captura de leads y su pipeline** ya existen y están separados de la creación de negocios — es una base de ventas manual, no un CRM de clientes finales del negocio (eso no existe: no hay CRM de clientes de cada negocio, solo de leads comerciales de Nexo mismo).
13. El **panel de Superadmin ya centraliza operación comercial** (planes, empresas, códigos, leads, costos de IA) — es el único lugar con visión cross-tenant del producto hoy.
14. La arquitectura del proyecto (Route Handlers delgados + `modules/` con la lógica real) está pensada para agregar dominios nuevos sin reescribir lo existente, pero **el estado de WhatsApp en memoria y las sesiones en filesystem son el principal obstáculo técnico** para escalar a múltiples instancias/servidores.
15. **No hay integraciones salientes de ningún tipo** (calendarios externos, pagos alternativos, videollamadas) — todo lo que no sea Mercado Pago/Gemini/WhatsApp/Supabase parte de cero.
16. La **AI Studio ya separa claramente "conocimiento" (Memoria/FAQs/Servicios) de "comportamiento" (personalidad/objetivos/restricciones)** — una base conceptual razonable para expandir capacidades reales de la IA más adelante, reemplazando el toggle de "capacidades" hoy inerte.
17. El **rate limiting y la reconciliación de pagos son ambos "mejor esfuerzo", no garantías duras** — cualquier crecimiento serio de tráfico o de volumen de cobros necesita resolver esto antes de escalar.
18. Existe una **landing dedicada a adquisición paga** (`/negocio-online`) ya separada de la landing institucional, con analítica de conversión preparada (aunque sin proveedor de analytics todavía conectado) — lista para conectar campañas reales.
