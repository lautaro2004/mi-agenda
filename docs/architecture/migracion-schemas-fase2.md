# Fase 2 — Identidad compartida de Kodexa + arquitectura definitiva de schemas

**Estado:** análisis y diseño, sin ejecutar. Ningún cambio de código ni de base de datos se aplicó todavía.
**Fecha:** 2026-09-15
**Contexto:** continúa [`migracion-schemas-fase1.md`](./migracion-schemas-fase1.md) (auditoría + primera propuesta de separación). Esta fase toma como ya decidido lo que el usuario confirmó explícitamente: `Lead` queda en `public`, y el billing actual (`Plan`/`Subscription`/`MercadoPagoWebhookEvent`/`PromoCode`/`PromoCodeRedemption`) queda en `nexo` sin crear billing transversal. Lo nuevo de esta fase es el diseño de identidad compartida (Better Auth, sesiones, Membership, entitlement por producto) y el mapa definitivo re-verificado contra el código.

**Corrección sobre la Fase 1:** ese documento dice "32 modelos" en dos lugares. Re-contando contra `prisma/schema.prisma` (`grep -c "^model "` → **33**), es un error de conteo, no una omisión de modelo — la lista de 33 modelos de la Fase 1 y de este documento son las mismas, solo se corrigió el número. Ya corregido en el archivo de Fase 1.

---

## A. Arquitectura propuesta

```
Kodexa
│
├── public   → identidad + tenant compartidos por toda la plataforma
│    User, Session, Account, Verification, Business, Membership, Lead
│
├── nexo     → producto Nexo (IA + WhatsApp + reservas + sitio web), autocontenido
│    26 modelos de dominio, incluido su billing actual (Plan/Subscription/...)
│
└── crm      → reservado, sin modelos todavía
```

**Responsabilidad de cada schema:**

- **`public`** es el *core de cuenta*, no un core de producto. Contiene únicamente lo que responde a la pregunta "¿quién es este usuario, a qué empresa pertenece, y qué empresas prospecto está trabajando Kodexa comercialmente?" — nada de *cómo* Nexo o el CRM operan puertas adentro. Esto es deliberado: el pedido original de Fase 1 ya marcó el riesgo de que `public` se convierta en un cajón de todo lo "conceptualmente compartible", y este documento sostiene el mismo criterio.
- **`nexo`** es 100% autocontenido: todo lo que un negocio usa para operar el producto Nexo, incluido su propio billing. No expone ni necesita exponer nada a `crm`.
- **`crm`** queda vacío en esta fase (Postgres: el schema existe como namespace; Prisma: ver limitación real en la sección C — no puede declararse en `schemas = [...]` sin al menos un modelo). No se diseñan sus modelos funcionales ahora, más allá de lo estrictamente necesario para dejar la arquitectura consistente (ver sección C).

Este mapa reemplaza cualquier ambigüedad de la Fase 1 sobre billing/Lead: ambas cuestiones ya están resueltas por decisión explícita del usuario en el pedido de esta fase, no quedan abiertas.

---

## B. Identidad compartida

Esta es la parte nueva y la más importante de la fase. Se responden las 5 preguntas del pedido en orden, y se distingue explícitamente entre dos cosas que el pedido tiende a tratar como una sola: **identidad única** (un usuario, un email, una contraseña, sin cuentas duplicadas) y **sesión única / SSO** (loguearse una vez y quedar autenticado en ambos productos sin repetir el login). La primera se resuelve enteramente con esta migración de schemas. La segunda **no** — requiere una decisión de infraestructura (dominio) que hoy no existe, y se deja explícitamente para cuando se construya CRM.

### B.1 — ¿Puede Better Auth seguir viviendo dentro de Nexo?

**Sí, sin ningún cambio de arquitectura.** Better Auth en este proyecto no es un servicio: es una librería montada como route handler (`app/api/auth/[...all]/route.ts`) dentro del mismo Next.js de Nexo, que persiste contra Postgres vía `prismaAdapter(getPrisma(), { provider: "postgresql" })` (`lib/auth/auth.ts`). El adapter genera sus queries dinámicamente a partir del Prisma Client — **no conoce ni le importa en qué schema físico de Postgres viven `User`/`Session`/`Account`/`Verification`**, eso lo resuelve el cliente generado, exactamente igual que para cualquier otro modelo. Mover esas 4 tablas a `public` es transparente para Better Auth: cero cambios de configuración, cero cambios de código en `lib/auth/*`.

Verificado además: `advanced.database.generateId: false` en la config actual — los IDs los genera Prisma (`@default(cuid())`), no Better Auth internamente. Esto importa para el futuro: si algún día una segunda app (CRM) también inserta filas en estas tablas, no hay un contador/generador centralizado con el que pueda chocar — cada inserción genera su propio `cuid()` independiente, sin coordinación necesaria entre instancias.

### B.2 — Login compartido: qué se resuelve ahora y qué no

Hay que separar dos preguntas que el pedido junta:

1. **"¿Un usuario tiene una sola cuenta, sin duplicar `usuario@nexo`/`usuario@crm`?"** → Esto se resuelve **completamente** con la Fase 1/2 tal como está diseñada. Una vez que `User`/`Account` viven en `public`, cualquier segunda aplicación (el futuro CRM) que apunte al mismo `DATABASE_URL` y tenga su propio `betterAuth()` configurado contra las mismas tablas **lee y escribe la misma fila de `User`**. No hace falta nada más para que la identidad sea única — es una consecuencia directa de compartir la base, no una feature aparte que haya que construir.

2. **"¿Un usuario logueado en Nexo entra a CRM ya autenticado, sin loguearse de nuevo?"** → Esto es **Single Sign-On real entre dos aplicaciones distintas**, y NO es un efecto automático de compartir tablas. Una sesión de Better Auth es una cookie httpOnly atada al origen/dominio de la app que la creó (`BETTER_AUTH_URL` de Nexo). El navegador no va a mandar esa cookie a una CRM que corra en otro dominio/subdominio salvo que se configure explícitamente para eso.

**Recomendación — la más simple que no cierra el camino a más adelante:**

- **Ahora (esta fase y la ejecución de la Fase 3):** mover las tablas a `public`. Esto por sí solo ya logra el punto 1 (identidad única, sin cuentas duplicadas) el día que exista una segunda app. No requiere tocar `lib/auth/auth.ts` ni `auth-client.ts`.
- **Cuando se construya CRM (fuera de alcance de esta fase, NO implementar ahora):** el punto 2 (SSO real) se resuelve con el mecanismo que Better Auth ya soporta de forma nativa para "múltiples apps, una identidad" — sin microservicio de auth:
  - Cada app (Nexo, CRM) mantiene **su propia instancia de `betterAuth()`**, embebida en su propio Next.js — igual que hoy, nada de un servicio separado.
  - Ambas instancias apuntan al **mismo `DATABASE_URL`** (mismas tablas `public.*`).
  - Ambas comparten el **mismo `BETTER_AUTH_SECRET`** (hoy solo existe en Nexo — el día que exista CRM, su `.env` debe tener el mismo valor, no uno propio).
  - Se habilita la opción nativa de Better Auth `advanced.crossSubDomainCookies` (con un dominio raíz común, ej. `.kodexa.com`) más `trustedOrigins` listando ambas apps — así la cookie de sesión creada por Nexo es válida y legible por CRM sin re-loguearse.
  - **Precondición no técnica:** esto exige que Nexo y CRM vivan bajo el mismo dominio raíz (ej. `nexo.kodexa.com` y `crm.kodexa.com`), lo cual es una decisión de infraestructura/DNS ajena a Prisma — no se puede resolver ni preparar en el schema de la base. Se deja como decisión abierta explícita (sección H).
- **Lo que se recomienda dejar preparado desde ya, sin ejecutarlo todavía:** cuando llegue el momento de crear el proyecto de CRM, usar el mismo valor de `BETTER_AUTH_SECRET` desde el día uno (no generar uno nuevo "porque son proyectos distintos") — es la única decisión de esta sección con costo cero ahora y costo alto de corregir después (rotar un secret compartido entre dos apps en producción es mucho más trabajoso que simplemente no bifurcarlo nunca).

Esto es deliberadamente la solución más chica que cumple el requisito duro del pedido ("una única identidad, sin cuentas duplicadas") sin construir nada que hoy no se necesita (ni microservicio, ni SSO real, ni gateway de auth). El SSO real queda como una tarea bien definida y acotada para cuando CRM exista, no como deuda técnica indefinida.

### B.3 — Membership: ¿ya está preparado para el futuro?

**Sí, sin ningún cambio de schema.** Se re-verificó `prisma/schema.prisma`:

```prisma
model Membership {
  userId     String
  businessId String
  role       String @default("owner")
  @@unique([userId, businessId])
}
```

La única restricción real es "un usuario no puede tener dos membresías para el mismo negocio" — no hay nada que impida:
- Un mismo `userId` con **varias filas** de `Membership` a distintos `businessId` (múltiples negocios por usuario) — el modelo de datos ya lo permite hoy; lo único que lo impide es la función de aplicación `ensureOwnerMembership` (`modules/business/membership.ts`), que es idempotente por diseño ("si ya tenés una, te devuelvo esa") — una decisión de producto, no una limitación de schema.
- Un mismo `businessId` con **varias filas** de `Membership` de distintos `userId` (equipos, varios usuarios por negocio) — igual de soportado hoy por el schema; lo único no implementado es la UI/API para crear la segunda fila, y el hecho de que `role` sea siempre el string `"owner"` (nunca leído para autorizar nada, confirmado en la Fase 1).

**Conclusión:** `Membership` se mantiene en `public`, sin cambios de estructura, exactamente como está. Es ya el punto de apoyo correcto tanto para "un usuario, varios negocios" como para "un negocio, varios usuarios/equipos" el día que se implementen — construir eso es trabajo de producto (UI, invitaciones, roles reales), no de este schema.

### B.4 — Entitlement por producto (qué tiene habilitado un Business)

La pregunta del pedido es si `Business → [nexo.Subscription, crm.Subscription]` tiene sentido. **Sí, y es la opción correcta para esta fase**, por el mismo criterio que ya se aplicó al billing de Nexo en la Fase 1: cada producto tiene su propia forma de "plan" (Nexo gatea WhatsApp/señas/entrenamiento/estadísticas/galería/carta digital; CRM en algún momento va a gatear contactos/automatizaciones/usuarios/lo que sea) y no existe hoy — ni tiene sentido inventar ahora — una forma genérica que sirva para ambos sin quedar vacía o forzada para uno de los dos.

Estructura resultante, sin construir nada de CRM todavía:

```
public.Business (id)
       │
       ├── nexo.Subscription   (businessId @unique, FK a public.Business)
       │
       └── crm.Subscription    (businessId @unique, FK a public.Business — cuando exista)
```

Cada `Subscription` cuelga de `Business`, no de `User` — esto ya es así en el modelo actual de Nexo (`Subscription.businessId @unique`, no `userId`) y es el patrón correcto a replicar: el que paga/tiene un plan es la empresa (el tenant), no la persona que se loguea. Un mismo `User`, a través de sus `Membership`, puede terminar operando un `Business` con `nexo.Subscription` activa y (más adelante) `crm.Subscription` activa — ambas independientes, sin ningún acoplamiento entre ellas ni una tabla intermedia de "entitlement" compartida. Si en el futuro hace falta una vista unificada ("qué productos tiene activos esta empresa"), eso se resuelve con una query que lea ambas tablas por `businessId` — no requiere una tabla nueva ni tocar el modelo de datos.

**No se construye nada de esto ahora** (ni `crm.Subscription` ni ninguna tabla) — se documenta el patrón para que cuando llegue la fase de CRM, su billing se diseñe siguiendo esta misma forma en vez de reinventarla o, peor, intentar reusar `nexo.Plan`/`nexo.Subscription` directamente (que es exactamente lo que la Fase 1 ya recomendó evitar).

### B.5 — Sesiones

- **Dónde viven:** `public.Session`, una fila por sesión activa, con `token` único y `userId` (FK a `public.User`). No tiene ninguna columna de `businessId` — una sesión autentica al usuario, no a un negocio. "Cuál es el negocio actual" se resuelve aparte, en cada request, vía `modules/business/current.ts` (`Membership.findFirst`) — no se guarda en la sesión ni en la cookie.
- **Esto es una ventaja para el diseño multi-producto:** como la sesión es agnóstica de negocio y de producto, extender esto a CRM no requiere tocar `Session` en absoluto — CRM resolvería su propio "negocio actual para esta sesión" exactamente igual que Nexo, leyendo la misma tabla `Membership`.
- **¿Nexo y CRM pueden compartir sesiones hoy?** No, porque hoy solo existe Nexo. El día que exista CRM, compartir la *tabla* `Session` es automático (ya está en `public`, mismo `DATABASE_URL`). Compartir la *cookie* (para no tener que loguearse dos veces) es lo que requiere la configuración de `crossSubDomainCookies` + dominio raíz común descripta en B.2 — no antes.
- **¿Hace falta un dominio común de autenticación?** No un *servicio* de autenticación separado (explícitamente descartado por el pedido), pero sí eventualmente un *dominio raíz* común (ej. `kodexa.com` con subdominios `nexo.` y `crm.`) si se quiere SSO real. Es una decisión de DNS/infraestructura, no de base de datos — se dokumenta como abierta (sección H) y no bloquea nada de esta fase.
- **¿Conviene una futura app/base de autenticación común separada?** Con la escala actual (dos productos, mismo equipo, mismo Next.js stack), no — sería la sobreingeniería que el pedido pide evitar explícitamente. El patrón "cada app con su propia instancia de Better Auth, todas contra las mismas tablas `public.*`, mismo secret" cubre el caso de uso sin ese costo. Si Kodexa llegara a tener muchos más productos o necesitara SSO con terceros (ej. un partner externo), ahí sí valdría reevaluar un proveedor de identidad dedicado (Auth0, Clerk, un servicio propio) — pero eso es una decisión de escala futura, no algo a resolver en esta fase ni algo que el diseño actual impida hacer después.

---

## C. Prisma + PostgreSQL — mecánica multi-schema

### C.1 Foreign keys cross-schema

PostgreSQL soporta foreign keys entre schemas de la misma base sin ninguna restricción especial: una FK solo exige que la columna referenciada tenga una constraint única/PK visible para el rol que ejecuta el `ALTER TABLE`/`CREATE TABLE` — el schema en el que vive no importa. `nexo.Appointment.businessId → public."Business".id`, `nexo.Subscription.businessId → public."Business".id`, y a futuro `crm.*.businessId → public."Business".id` son todas FKs perfectamente válidas y sin overhead adicional respecto de una FK dentro del mismo schema.

Prisma 7.8 + `@prisma/adapter-pg` las maneja de forma nativa vía la feature **multi-schema**, GA para PostgreSQL desde Prisma 5.15 (no requiere `previewFeatures` en esta versión). Se declara así:

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["public", "nexo", "crm"]
}

model Business {
  // ...
  @@schema("public")
}

model Service {
  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  // ...
  @@schema("nexo")
}
```

Prisma Client genera SQL con el nombre de tabla completamente calificado (`"nexo"."Service"`, `"public"."Business"`) en cada query — el código de aplicación (`prisma.service.findMany(...)`) no cambia en absoluto, ni necesita saber en qué schema físico vive cada modelo. Esto ya se verificó en la Fase 1 (cero SQL crudo en todo el proyecto) y sigue siendo válido acá: es la razón de fondo por la que esta migración no toca ningún módulo de negocio.

### C.2 Relaciones bidireccionales — un costo real, pero acotado

Toda relación de Prisma requiere el campo en ambos lados del modelo (`Business` necesita `services Service[]`, `appointments Appointment[]`, etc., y ya los tiene para los modelos actuales). Esto significa que **cada nuevo modelo de `crm` que se relacione con `Business` va a requerir agregar un campo nuevo a `public.Business`** en `schema.prisma` (ej. `customers Customer[]` cuando exista `crm.Customer`). Es una edición puramente de metadata de Prisma — no dispara ninguna migración sobre la tabla `Business` en sí (la FK y su columna viven siempre del lado "muchos", nunca en `Business`) — pero sí implica que el archivo de schema de `public` se va a tocar cada vez que `crm` (o `nexo`) agregue una entidad nueva relacionada a `Business`. Es un acoplamiento aceptable y esperable en cualquier diseño de tenant compartido — se documenta para que no sorprenda cuando empiece el desarrollo de CRM.

### C.3 Limitación real encontrada: `crm` sin modelos todavía

Este es un problema técnico concreto, no una suposición — se marca explícitamente en vez de asumir que "declarar el schema alcanza", tal como pide el criterio de esta fase:

Prisma valida que todo schema declarado en `schemas = [...]` esté efectivamente usado por al menos un `@@schema(...)` en algún modelo/enum/tipo del archivo. Con `crm` sin ningún modelo, es razonablemente probable que `npx prisma validate` rechace `schemas = ["public", "nexo", "crm"]` con un error del estilo "schema `crm` no se usa en ningún modelo". No se tiene forma de confirmar esto con certeza absoluta sin ejecutar el CLI contra la versión exacta instalada (no hay acceso a internet ni a un entorno para correrlo en este análisis) — se marca como **riesgo a verificar en la Fase 3, antes de escribir la migración real**, no como un hecho.

**Alternativa si la validación falla (la que se recomienda seguir por defecto):**
- A nivel **Postgres**, crear el schema físico `crm` ahora no tiene ningún costo ni downside — Postgres no exige que un schema tenga tablas (`CREATE SCHEMA crm;` es válido y queda vacío indefinidamente sin problema).
- A nivel **Prisma**, **no** incluir `"crm"` en el array `schemas = [...]` hasta que exista el primer modelo real de CRM con `@@schema("crm")` — en ese momento se agrega el string al array en el mismo commit que agrega el primer modelo, nunca antes ni suelto.
- Esto no contradice ni retrasa nada del pedido: el schema físico de Postgres queda "reservado conceptualmente" exactamente como se pidió; lo único que se pospone es una línea de configuración de Prisma que no puede existir de forma consistente sin al menos un modelo detrás.

### C.4 Organización del archivo — recomendación opcional, no obligatoria

Prisma soporta desde hace varias versiones (GA, no preview) partir un schema lógico único en varios archivos `.prisma` dentro de una carpeta (`prisma/schema/`), que el CLI combina automáticamente. Es puramente organizativo — no cambia el SQL generado ni el comportamiento de multi-schema, que es una feature independiente. Se recomienda para cuando se ejecute la Fase 3 (no ahora): `prisma/schema/public.prisma`, `prisma/schema/nexo.prisma`, `prisma/schema/crm.prisma` (este último puede no existir hasta tener contenido, por la limitación de C.3), cada uno con los modelos de su `@@schema`. Esto hace que la separación conceptual `public`/`nexo`/`crm` sea visible también a nivel de archivos, no solo de atributos — reduce el riesgo de que alguien agregue sin querer un modelo de dominio de Nexo con `@@schema("public")` por estar en el archivo equivocado. Requiere ajustar `prisma.config.ts` para apuntar a la carpeta en vez del archivo único — cambio de configuración, no de datos, cero riesgo para la base.

### C.5 `DIRECT_URL` vs `DATABASE_URL` — ya resuelto correctamente

`prisma.config.ts` ya usa `DIRECT_URL ?? DATABASE_URL` para las operaciones del CLI (`migrate`, `generate`), mientras que `lib/prisma.ts` usa `DATABASE_URL` en runtime a través de `PrismaPg`. Este patrón (conexión directa para DDL, conexión pooleada para queries de aplicación) es el recomendado por Supabase/Prisma precisamente para evitar problemas de `ALTER TABLE`/prepared statements contra un pooler — no requiere ningún cambio para esta migración, se confirma que ya está bien configurado.

### C.6 `prisma generate`

Sin cambios de invocación (`postinstall` ya lo corre). El cliente generado va a incluir metadata de schema por modelo; el código de aplicación sigue llamando `prisma.<model>.<method>()` exactamente igual.

---

## D. Mapa definitivo de modelos (33 modelos)

| Modelo | Schema | Motivo | Dependencias (FK) |
|---|---|---|---|
| `User` | `public` | Identidad de cuenta (Better Auth) — sin acoplamiento a ningún producto. | — |
| `Session` | `public` | Sesión de Better Auth — agnóstica de negocio y de producto (B.5). | `User` |
| `Account` | `public` | Credenciales (Better Auth). | `User` |
| `Verification` | `public` | Verificación de email/tokens (Better Auth). | — |
| `Business` | `public` | El tenant — ancla común de `nexo.*` y, a futuro, `crm.*`. | — |
| `Membership` | `public` | Puente User↔Business, ya preparado para multi-negocio y multi-usuario sin cambios (B.3). | `User`, `Business` |
| `Lead` | `public` | Pipeline comercial de Kodexa/Nexo — decidido explícitamente por el usuario en esta fase. No es feature de ningún producto. | `Business` (opcional) |
| `Service` | `nexo` | Catálogo de servicios reservables. | `Business` |
| `Resource` | `nexo` | Recursos físicos reservables. | `Business` |
| `ServiceResource` | `nexo` | Puente N:M `Service`↔`Resource`. | `Service`, `Resource` |
| `Schedule` | `nexo` | Disponibilidad horaria. | `Business` |
| `FAQ` | `nexo` | Contenido del sitio público / IA. | `Business` |
| `GalleryBlock` | `nexo` | Contenido visual del sitio público. | `Business` |
| `GalleryImage` | `nexo` | Imágenes de un bloque de galería. | `GalleryBlock` |
| `SeoConfig` | `nexo` | SEO generado por IA del sitio público. | `Business` |
| `Appointment` | `nexo` | Turno — dominio central de Nexo. | `Business`, `Service` (opc.), `Resource` (opc.) |
| `PaymentProof` | `nexo` | Comprobante de seña. | `Business`, `Appointment` (opc.) |
| `Employee` | `nexo` | Config. del empleado IA. | `Business` |
| `EmployeeGoal` | `nexo` | Objetivos del empleado IA. | `Employee` |
| `EmployeeRestriction` | `nexo` | Restricciones del empleado IA. | `Employee` |
| `EmployeeCapability` | `nexo` | "Capacidades" del empleado IA (hoy sin lógica conectada, ver inventario). | `Employee` |
| `MemoryEntry` | `nexo` | Memoria de la IA. | `Business` |
| `TrainingPlan` | `nexo` | Plan de entrenamiento generado por IA. | `Business` |
| `TrainingPlanSection` | `nexo` | Secciones del plan de entrenamiento. | `TrainingPlan` |
| `TrainingConversation` | `nexo` | Transcripción de entrenamiento. | `Business` |
| `TrainingMessage` | `nexo` | Mensajes de una conversación de entrenamiento. | `TrainingConversation` |
| `AiUsageEvent` | `nexo` | Ledger de consumo de IA — hoy 100% operaciones de Nexo. | — (`businessId` suelto, sin FK) |
| `BusinessNotification` | `nexo` | Notificaciones del dashboard de Nexo. | `Business` |
| `Plan` | `nexo` | Billing actual de Nexo — decidido explícitamente por el usuario en esta fase (sin billing transversal todavía). | — |
| `Subscription` | `nexo` | Suscripción de un Business al producto Nexo. | `Business`, `Plan` |
| `MercadoPagoWebhookEvent` | `nexo` | Idempotencia del webhook de MP de Nexo. | — |
| `PromoCode` | `nexo` | Códigos promocionales del billing de Nexo. | `Plan` |
| `PromoCodeRedemption` | `nexo` | Canjes de código promocional. | `PromoCode`, `Business` |

33 modelos: 7 en `public`, 26 en `nexo`, 0 en `crm` (reservado, ver C.3).

**Inconsistencias encontradas al re-verificar contra el pedido:** ninguna respecto de la lista del usuario — coincide modelo a modelo con lo indicado en el pedido de Fase 2 (salvo la corrección de conteo 32→33 ya señalada, que es aritmética, no de contenido).

---

## E. Plan de migración

El mecanismo físico es el mismo ya validado en la Fase 1 (`ALTER TABLE ... SET SCHEMA`, nunca dejar que `prisma migrate dev` aplique su diff por defecto). Lo que agrega esta fase es la secuencia correcta considerando identidad:

1. **Fase 0 (igual que Fase 1):** backup, confirmar permisos del rol de `DATABASE_URL`/`DIRECT_URL` sobre schemas nuevos, staging disponible.
2. **Crear los schemas físicos en Postgres:** `CREATE SCHEMA IF NOT EXISTS nexo; CREATE SCHEMA IF NOT EXISTS crm;` — aditivo, sin riesgo, incluye `crm` a nivel Postgres aunque no tenga modelos Prisma todavía (ver C.3).
3. **Actualizar `schema.prisma`:**
   - `schemas = ["public", "nexo"]` en el datasource — **sin `"crm"` todavía**, hasta confirmar C.3 (correr `prisma validate` primero; si acepta un schema sin modelos, se agrega `"crm"` sin costo adicional).
   - `@@schema("public")` en los 7 modelos de la sección D.
   - `@@schema("nexo")` en los 26 restantes.
   - (Opcional, recomendado) reorganizar en `prisma/schema/public.prisma` + `prisma/schema/nexo.prisma` (C.4) y ajustar `prisma.config.ts` si se adopta.
4. **`npx prisma validate`** contra staging — confirma sintaxis y relaciones cross-schema (incluida la limitación de C.3) sin tocar ninguna tabla.
5. **Generar y reescribir la migración a mano** (igual que Fase 1 sección D.3): `prisma migrate dev --create-only`, descartar el `DROP`/`CREATE` autogenerado, reemplazar por 26 líneas de `ALTER TABLE "<Modelo>" SET SCHEMA nexo;` dentro de una sola transacción. `Business`, `Membership`, `User`, `Session`, `Account`, `Verification`, `Lead` no llevan `ALTER` — ya están en `public`.
6. **Validar en staging:** smoke test priorizado en identidad primero — registro, login, logout, cambio de contraseña, refresco de sesión (`useSession`), acceso a `/dashboard` con y sin cookie — antes de pasar al resto del smoke test operativo de Nexo (igual checklist que la Fase 1, sección D.4).
7. **Producción:** igual secuencia que Fase 1 (ventana de bajo tráfico, backup inmediato, aplicar, desplegar, smoke test).
8. **No se toca nada de Better Auth ni de Mercado Pago** — el pedido lo excluye explícitamente y no se encontró ninguna dependencia que lo requiera (confirmado en B.1: el adapter de Better Auth es agnóstico de schema físico; confirmado en Fase 1: Mercado Pago solo usa `prisma.plan`/`prisma.subscription`/`prisma.mercadoPagoWebhookEvent` vía cliente tipado).
9. **No se prepara todavía** ninguna configuración de `crossSubDomainCookies`/`trustedOrigins`/dominio compartido (B.2) — no hay una segunda app contra la cual probarlo, y el pedido pide explícitamente no resolver esto ahora.

---

## F. Riesgos

1. **Diff destructivo de `prisma migrate dev`** — igual que Fase 1: nunca aplicar el SQL autogenerado tal cual, siempre reescribir a `ALTER TABLE ... SET SCHEMA`.
2. **`crm` sin modelos en `schemas = [...]`** (C.3) — riesgo nuevo de esta fase, no cubierto en la Fase 1 porque ahí no se planteaba `crm` reservado sin contenido. Mitigación ya definida: no listar `"crm"` en Prisma hasta el primer modelo real; sí crear el schema en Postgres desde ya.
3. **Better Auth con una segunda app (futuro, no de esta fase):** el riesgo real no es esta migración — es que el día que exista CRM, alguien genere un `BETTER_AUTH_SECRET` distinto "porque es otro proyecto", rompiendo silenciosamente la compatibilidad de sesiones entre apps. Se documenta ahora (B.2) para que no se repita ese error cuando llegue el momento, aunque no haya nada que ejecutar hoy.
4. **Sesiones:** ningún riesgo directo de esta migración — `Session` no cambia de comportamiento por vivir en `public` en vez de en el "schema implícito" actual (que ya es `public` hoy). El riesgo real de sesiones está en la fase de SSO (crossSubDomainCookies), explícitamente fuera de alcance.
5. **Foreign keys cross-schema:** sin riesgo técnico real (C.1) — es el caso de uso central de la feature multi-schema de Prisma/Postgres. El único costo es de mantenimiento (C.2: agregar el campo de relación en `Business` cada vez que un modelo nuevo de `nexo`/`crm` lo referencie).
6. **Permisos de Supabase, plataforma de deploy, connection string (`DIRECT_URL`/`DATABASE_URL`)** — mismos riesgos ya señalados en la Fase 1 (secciones C.3 y C.5 de este documento confirman que la config actual de `DIRECT_URL`/`DATABASE_URL` ya es la correcta y no necesita cambios; lo que falta confirmar sigue siendo permisos del rol sobre schemas nuevos y el mecanismo real de `migrate deploy` en producción, ninguno de los dos verificable desde el repositorio).
7. **Prisma Client / `prisma generate`:** riesgo bajo, ya cubierto en Fase 1 (el `postinstall` ya lo automatiza).
8. **Producción:** mismo riesgo de ventana de lock breve por `ALTER TABLE` ya señalado en Fase 1 — no cambia con esta fase.

---

## G. Rollback

Idéntico mecanismo que la Fase 1 (sección E de ese documento), sin cambios: la migración de Fase 3 es una única transacción de `ALTER TABLE ... SET SCHEMA`, reversible con la migración espejo (`ALTER TABLE nexo."X" SET SCHEMA public;` por cada tabla movida) — operación de metadata, instantánea, sin pérdida de datos. Si `crm` llegó a crearse en Postgres sin nunca usarse, `DROP SCHEMA crm;` (schema vacío, sin tablas) es seguro de revertir en cualquier momento sin relación con el resto del rollback.

No hay ningún elemento nuevo en esta fase (identidad, Membership, entitlement) que introduzca un paso de rollback adicional — B.1 a B.5 son decisiones de diseño y configuración de aplicación (Better Auth, dominio, secret compartido), no cambios de schema de base de datos, así que no tienen "reversión de base de datos" propia: revertirlas es simplemente no aplicar la configuración descripta (nada que deshacer porque nada de eso se ejecuta en esta fase).

---

## H. Decisiones abiertas

Solo lo que realmente necesita una decisión antes de ejecutar — las de la Fase 1 sobre `Lead` y billing ya están resueltas por este pedido, no se repiten acá.

1. **`crm` en `schemas = [...]` sin modelos (C.3):** confirmar con `npx prisma validate` en Fase 3 si Prisma lo acepta vacío. Si no, seguir la alternativa ya definida (Postgres sí, Prisma array no, hasta el primer modelo real).
2. **Adoptar o no la organización en `prisma/schema/` por carpeta (C.4):** mejora de mantenibilidad, no bloquea nada — decidir si se hace en la misma Fase 3 o se pospone.
3. **Estrategia de dominio para SSO futuro (B.2, B.5):** si Kodexa va a alojar Nexo y CRM bajo un dominio raíz común (`*.kodexa.com`) — no bloquea esta migración, pero conviene decidirlo antes de que exista CRM para no migrar dominios después.
4. **Plataforma y mecanismo real de deploy / `migrate deploy`** (heredado de Fase 1, sigue sin poder confirmarse desde el repo).
5. **Permisos del rol de `DATABASE_URL`/`DIRECT_URL` sobre schemas nuevos en Supabase** (heredado de Fase 1).
6. **Disponibilidad de staging real** para validar antes de producción (heredado de Fase 1).

Ninguna de estas bloquea seguir refinando el diseño; sí deberían resolverse (al menos las 1, 4 y 5) antes de ejecutar la Fase 3 contra producción.
