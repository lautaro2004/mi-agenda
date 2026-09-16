# Fase 4 — Validación y estabilización post-migración

**Pregunta que responde este documento:** ¿podemos considerar estable la arquitectura después de mover los schemas (Fase 3) y empezar a construir el CRM encima?

**Respuesta corta: sí.**

**Fecha:** 2026-09-16
**Continúa:** [`migracion-schemas-fase1.md`](./migracion-schemas-fase1.md), [`migracion-schemas-fase2.md`](./migracion-schemas-fase2.md), [`migracion-schemas-fase3.md`](./migracion-schemas-fase3.md).

---

## Estado general

## ✅ PASS

Ningún comportamiento de Nexo se rompió por la migración de schemas. Se auditó el código en busca de dependencias de la estructura física anterior (ninguna encontrada), se re-verificaron las herramientas de Prisma, y se ejercitó **código real** (no SQL manual) de punta a punta contra la base real ya migrada: Better Auth (registro/login/sesión/logout), Membership/Business, el motor de turnos completo (crear/disponibilidad/reprogramar/cancelar), AI Studio (Employee/Memory), Leads, aislamiento multi-tenant, y una query real de Superadmin — los 9 casos de prueba pasaron, y el `npm run build` completo terminó exitosamente (99/99 páginas).

No se encontró ningún problema introducido por la migración. Se reconfirmaron problemas ya documentados en la Fase 1 como preexistentes (sección "Problemas encontrados" abajo) — ninguno de ellos tiene relación con la estructura física de Postgres, así que la migración no los agrava ni los mejora.

---

## Validaciones realizadas

| Área | Prueba | Resultado | Observaciones |
|---|---|---|---|
| Base de datos | Re-confirmación de schemas/tablas/FKs (heredado de Fase 3, sin cambios desde entonces) | ✅ PASS | `public`: 8 tablas, `nexo`: 26, `crm`: 0. 34 FKs (15 cross-schema `nexo→public`, 19 intra-schema). |
| Código — auditoría estática | `grep` de `$queryRaw`/`$executeRaw` en todo el proyecto | ✅ PASS | Cero resultados — re-confirmado (ya lo estaba en Fase 1 y Fase 3). |
| Código — auditoría estática | Nombres de tabla/schema hardcodeados (`"public"`, `"nexo"`, `information_schema`, `pg_catalog`, `SET SCHEMA`) fuera de las migraciones propias | ✅ PASS | Cero resultados en `app/`, `modules/`, `lib/`, `components/`. |
| Prisma | `prisma validate` | ✅ PASS | Schema válido, incluido `crm` sin modelos. |
| Prisma | `prisma generate` | ✅ PASS | Cliente regenerado sin errores. |
| Prisma | `tsc --noEmit` | ✅ PASS | 0 errores. |
| Prisma | `npm run lint` | ✅ PASS | 0 errores, 8 warnings preexistentes (`no-unused-vars`, sin relación con esta fase). |
| Prisma | `npm test` (vitest, suite existente) | ✅ PASS | 149/149 tests, 17 archivos. |
| Better Auth | `auth.api.signUpEmail` (registro real) → escribe `public.User` + `public.Account` | ✅ PASS | Usuario de prueba creado y verificado por `prisma.user.findUnique`. |
| Better Auth | `auth.api.signInEmail` → `auth.api.getSession` (lectura de sesión real) → `auth.api.signOut` | ✅ PASS | Sesión resuelta correctamente contra `public.Session`. |
| Better Auth | Protección de rutas (`middleware.ts`) | ✅ PASS (por inspección) | Sin cambios de código; solo chequea cookie de sesión, agnóstico de schema físico. No se relanzó un servidor para probar la redirección HTTP en vivo. |
| Membership / Business | `ensureOwnerMembership` (real) — creación de `Business` + `Membership` + `Subscription` trial | ✅ PASS | Verificado idempotente (segunda llamada no duplica). Relación `Membership → User`/`Membership → Business` resuelta con `include`. |
| Business → Nexo | `Service`, `Resource`, `Schedule`, `FAQ` creados vía módulos reales y leídos vía `Business.findUnique({ include })` | ✅ PASS | Confirma FKs cross-schema `nexo.* → public.Business` funcionando en escritura y lectura, no solo en lectura como en la Fase 3. |
| Sitio público | Cadena de datos que arma `/s/[slug]` (`Business` + `services`/`schedules`) | ✅ PASS (capa de datos) | Mismo patrón de `include` validado en Fase 3 y de nuevo acá. **No se cargó la URL real en un navegador** (no había servidor corriendo) — ver "Pendientes". |
| Dashboard | Capa de datos de Servicios/Recursos/Horarios/Turnos/AI Studio (los módulos que cada pantalla llama) | ✅ PASS (capa de datos) | Ejercitada directamente vía los módulos reales (no simulada). `next build` compiló las 99 rutas, incluidas todas las de `/dashboard/*`, sin errores. **No se verificó el render en navegador.** |
| Turnos | Crear, consultar disponibilidad, reprogramar, cancelar, relación con Service/Resource | ✅ PASS | `createAppointment` → `getAvailableSlots` (slot ocupado desaparece) → `rescheduleAppointment` → `cancelAppointment`, con `source: "customer"` disparando notificación real. |
| Turnos | Notificaciones (`nexo.BusinessNotification`) escritas por el flujo de reserva | ✅ PASS | Confirmado con una query directa después de `createAppointment`. |
| Pagos de Nexo | `Plan`/`Subscription` (creación real vía `ensureTrialSubscription`, dentro de `ensureOwnerMembership`) | ✅ PASS | `getSubscriptionWithPlan`, `resolveAiAccess`, `resolvePlanFeatures` (funciones puras + de lectura) ejercitadas con datos reales. |
| Pagos de Nexo | `MercadoPagoWebhookEvent`/`PromoCode`/`PromoCodeRedemption` | ✅ PASS (por código, sin cobro real) | Re-confirmado sin SQL crudo (auditoría estática); no se generó ningún cobro ni webhook real — fuera de alcance, tal como se pidió. |
| AI Studio | `Employee` (creación/actualización), `EmployeeCapability` (auto-creadas), `MemoryEntry` | ✅ PASS | `getEmployeeProfile`/`updateEmployeeProfile`/`createMemoryEntry`/`listMemoryEntries` (código real) contra `nexo.*`, resueltos desde `Business` (`public`). |
| AI Studio | `TrainingPlan`/`TrainingPlanSection`/`TrainingConversation`/`TrainingMessage`/`AiUsageEvent` | ✅ PASS (por lectura, sin generar contenido nuevo) | No se generó un plan de entrenamiento nuevo (dispararía una llamada real a Gemini — fuera de alcance de esta fase). Se confirma la estructura de datos vía las 320 filas de `TrainingMessage` ya existentes (Fase 3) y por la ausencia de SQL crudo en `modules/employee/*`. |
| WhatsApp | Uso de Prisma en `modules/whatsapp/**` y `app/api/whatsapp/**` | ✅ PASS | Cero resultados — re-confirmado. El módulo no toca Postgres en absoluto, así que la migración de schemas no puede haberlo afectado, estructuralmente. No se abrió una conexión de WhatsApp nueva (se evitaron efectos secundarios, tal como se pidió). |
| WhatsApp | Problemas ya documentados (SSE sin filtro por negocio, 2 rutas sin ownership check, conversaciones en memoria, credenciales en filesystem) | ⚠️ Preexistentes, sin cambios | Ver sección "Problemas encontrados" — ninguno depende de schema de Postgres. |
| Superadmin | `lib/superadmin/queries.ts::getAiUsageSummary` (lectura real) | ✅ PASS | Devolvió 88 requests históricos — coincide con `AiUsageEvent` contado en Fase 3. |
| Superadmin | Empresas/Planes/Suscripciones/Promociones/Leads (por código) | ✅ PASS (auditoría estática) | Mismas funciones de `modules/billing/subscription.ts` y `modules/leads/service.ts` ya ejercitadas en esta fase; sin SQL crudo. No se recorrieron las pantallas de Superadmin en navegador. |
| Leads | `createLead`, `listLeads` (código real) | ✅ PASS | Lead de prueba creado en `public.Lead`, encontrado por `listLeads` con filtro de texto, borrado en el cleanup. |
| Multi-tenancy | Aislamiento por `businessId` entre dos negocios reales, mismas queries que usa la app | ✅ PASS | `Service`/`Appointment` del negocio de prueba vs. un negocio real existente: cero superposición confirmada explícitamente (no solo "el campo existe"). |
| Build | `npm run build` | ✅ PASS | `Compiled successfully`, 99/99 páginas generadas, `/sitemap.xml` prerenderizado estático (toca `public.Business` en build time) sin error. Exit code 0. |

---

## Problemas encontrados

### Introducidos por la migración

**Ninguno.** No se encontró ningún comportamiento roto, ninguna query fallando, ningún error de Prisma ni de tipos atribuible a mover las tablas de `public` a `nexo`.

### Preexistentes (ya documentados en Fase 1, no afectados por esta migración — reconfirmados, no corregidos)

- **SSE de WhatsApp sin aislamiento por negocio:** el bus de eventos en tiempo real de conversaciones/mensajes no filtra por `businessId` antes de emitir. No depende de Postgres — no pudo haber sido afectado por el cambio de schema.
- **Dos rutas de la API de conversaciones de WhatsApp sin verificación de ownership:** mismo caso — es una falta de chequeo a nivel de código de la ruta, no una consulta a una tabla que haya cambiado de lugar.
- **Conversaciones y mensajes de WhatsApp solo en memoria del proceso:** por diseño no usan Postgres — la migración de schemas es, por definición, irrelevante para este subsistema.
- **Credenciales de sesión de WhatsApp en el filesystem del servidor:** mismo caso, sin relación con la base de datos.
- **`Membership.findFirst` sin `orderBy` explícito** (resolución de "negocio actual"): no determinístico si un usuario llegara a tener más de una `Membership` (hoy no pasa, la app es idempotente al crear). No es un problema de la migración — el comportamiento es idéntico a como era cuando `Membership` vivía físicamente en el mismo schema que todo lo demás.

Ninguno de estos se tocó en esta fase, tal como se pidió explícitamente.

### Pendientes para futuras fases (no bloquean el inicio del CRM, pero quedan anotados)

- **Smoke test en navegador real:** todo lo verificado en esta fase pasa por el código de la aplicación directamente (Prisma Client, funciones de `modules/*`, y la API server-side de Better Auth) o por el proceso de `next build`, pero no se levantó un `next dev`/`next start` y se navegó la UI real (login por formulario, `/s/[slug]` renderizado, `/dashboard` clickeado). Es la única capa que falta para una confirmación 100% end-to-end — recomendado antes de considerar el incidente totalmente cerrado, aunque el riesgo remanente es bajo dado que se probó la capa de datos de la que depende cada pantalla.
- **Generación de un `TrainingPlan` nuevo vía IA:** no se ejercitó a propósito (dispara una llamada real a Gemini, fuera del alcance "sin efectos secundarios reales" de esta fase). La estructura de datos subyacente sí se confirmó (lectura de las 320 filas de `TrainingMessage` existentes).
- **Cobro real de Mercado Pago / webhook real:** no se ejercitó a propósito (el pedido lo excluye explícitamente). Se limitó a auditoría de código.
- **Backup/PITR de Supabase:** el usuario confirmó en la Fase 3 que no hay uno configurado — sigue sin configurarse (no es parte del alcance de esta fase, pero queda como pendiente operativo real).

---

## Cambios realizados en esta fase

**Ninguno permanente en el código de la aplicación.** Esta fase fue exclusivamente de validación. Se crearon y se borraron dentro de la misma corrida:

- Dos archivos temporales de script (introspección/backup), usados y eliminados en la Fase 3 — no aplica a esta fase.
- Un archivo de test temporal, `modules/_tmp_fase4_validation.test.ts`, creado para ejercitar código real contra la base, ejecutado, y **eliminado inmediatamente después** (no quedó en el repo — confirmado con `git status`).
- Datos de prueba en la base real: un `User`, un `Business` (con su `Membership`, `Subscription`, `Service`, `Resource`, `Schedule`×7, `FAQ`, `Appointment`, `BusinessNotification`, `Employee`, `EmployeeCapability`×6, `MemoryEntry`) y un `Lead` — todos creados y **borrados en el `afterAll` del mismo test**, con confirmación explícita de limpieza (`business residual: false | user residual: false | lead residual: false`).

**No se modificó** `prisma/schema.prisma`, ni ningún módulo de `modules/`, ni ninguna ruta de `app/api/`, ni configuración de Better Auth, ni Mercado Pago. Los únicos archivos con cambios pendientes de commit siguen siendo los de la Fase 3 (`prisma/schema.prisma`, `.gitignore`, la carpeta de migración, y los documentos de arquitectura) — nada nuevo se agregó a esa lista en esta fase.

---

## Estado final

**Nexo está estable después de la migración de schemas y en condiciones de que empecemos a construir el CRM encima.**

Justificación, resumida:

1. **Cero problemas introducidos por la migración**, confirmado por auditoría estática (sin SQL crudo, sin referencias hardcodeadas a schemas) y por ejecución real de código (9/9 pruebas funcionales, 149/149 tests existentes, build completo).
2. **Las relaciones cross-schema (`nexo.* → public.Business`) funcionan en lectura y en escritura**, no solo en lectura como se había confirmado en la Fase 3 — esta fase las ejercitó creando datos nuevos de punta a punta (Service, Resource, Schedule, Appointment, Employee, MemoryEntry, BusinessNotification), todo resuelto correctamente desde `public.Business`.
3. **Better Auth funciona igual que antes** — registro, login, lectura de sesión y logout probados con su propia API real, no simulados.
4. **El aislamiento multi-tenant sigue siendo real**, no solo "el campo `businessId` existe en el schema" — se confirmó explícitamente que las queries de un negocio no devuelven datos de otro.
5. **Los problemas que sí existen** (WhatsApp: SSE sin filtro, dos rutas sin ownership, memoria volátil, credenciales en filesystem) **son previos a esta migración y no tienen ninguna relación con ella** — no son motivo para bloquear el inicio del CRM, son deuda técnica de WhatsApp que existía antes y sigue exactamente igual ahora.
6. Lo único que falta es una capa de confirmación visual/navegador, de menor riesgo dado que toda la capa de datos que esa UI consume ya está probada — no se considera bloqueante.

**Recomendación:** proceder con el diseño del CRM (próxima fase) sobre la base actual de `public`/`nexo`/`crm`.
