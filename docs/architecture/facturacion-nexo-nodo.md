# Facturación unificada Nexo + Nodo

**Fecha:** 2026-10-26 · Estado: en implementación por etapas (ver al final).

## 1. Auditoría (estado previo)

### Modelo (Nexo, schema `nexo`)
- `Plan`: precio único mensual (`monthlyPrice`, `currency`), límites **solo de Nexo** (créditos IA, servicios, web pública, WhatsApp, señas, etc.), `active`, y su `preapproval_plan` de Mercado Pago (`mercadoPagoPlanId` + estado de sincronización).
- `Subscription`: **una por negocio** (`businessId @unique`). Estados `trialing | active | past_due | canceled | expired`, período, `provider` (`manual | mercadopago | promo_code | benefit`), `providerSubscriptionId` (= id del preapproval), estado crudo de MP, y `benefitExpiresAt` / `previousPlanId` para bonificaciones.
- Plan base **"Agenda interna"** (`BASE_PLAN_SLUG`): todo negocio nuevo lo recibe (`ensureBaseSubscription`). **Es el nivel gratuito de Nexo.**

### Mercado Pago (`modules/billing/mercadopago/`)
- Cada `Plan` pago se sincroniza como `preapproval_plan` **mensual fijo** (`frequency: 1, months`). Un cambio de precio crea un `preapproval_plan` nuevo; los suscriptores existentes siguen en el viejo.
- Checkout: el navegador tokeniza la tarjeta (Card Payment Brick, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`) y el servidor crea el `preapproval` con `card_token_id`, `external_reference = businessId`. **El plan se activa solo si la respuesta directa de MP dice `authorized`**, nunca por volver del checkout.
- Webhook (`/api/webhooks/mercadopago`): valida firma (`x-signature`, `MERCADOPAGO_WEBHOOK_SECRET`), registra cada notificación una vez (`MercadoPagoWebhookEvent`), relee el preapproval desde la API y mapea `authorized→active`, `paused→past_due`, `cancelled→canceled`.
- Variables: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`.

### Asignación, códigos y bonificaciones
- **Única escritura:** `assignSubscription()`, que hace upsert de la fila **completa**. Promo codes y bonificaciones (`grantTemporaryPlan`) pasan por ahí, y un cron (`revert-expired-benefits`) vuelve al plan anterior al vencer.

### Nodo (CRM)
- No cobra. Lee de la facturación de Nexo solo si existe la suscripción (`NexoSubscription`, espejo de solo lectura).
- **Único punto de acceso:** `resolveWorkspaceContext()` (sesión → Membership → Workspace), usado por el layout (páginas) y por `requireWorkspace()` (todas las APIs). Ya distingue `no_access` (miembro sin `"crm"` en `Membership.products`).
- **Comunicación entre apps:**
  - Nexo → Nodo: `NODO_URL` + `NEXO_NODO_SYNC_SECRET`.
  - Nodo → Nexo: no existía.
- **Sesiones:** misma base y tablas de usuarios/sesión (mismo `BETTER_AUTH_SECRET`), pero **cookies por dominio**. Una sesión de Nodo no sirve en Nexo.

### Migraciones y base compartida
- **Cada proyecto migra su schema:** Nexo (`nexo`, `public`) y Nodo (`crm`).
- **Nodo declara modelos espejo** de tablas de Nexo; nunca los migra ni escribe.
- **Cambiar columnas de Nexo exige actualizar el espejo de Nodo** en el mismo release.

### Pruebas
- Vitest en los dos (en Nexo, la facturación tiene ~15 archivos de tests).
- No hay tests contra el sandbox de Mercado Pago.

### Riesgos encontrados (existentes)
1. **El webhook acepta notificaciones de cualquier preapproval del negocio,** no solo del vigente. Un preapproval viejo cancelado puede marcar como cancelada la suscripción nueva (cambio de plan, eventos fuera de orden).
2. **No procesa `subscription_authorized_payment`.** Según la documentación de MP, un cobro rechazado deja la **cuota** en `recycling` (4 reintentos en ~10 días) y luego en `processed` con pago `rejected`. El preapproval no necesariamente pasa a `paused`, así que un pago rechazado puede no reflejarse nunca como atraso. Tras 3 cuotas rechazadas, MP cancela la suscripción.
3. **El bloqueo de doble contratación solo mira `status === "active"`.** Con `past_due` se puede crear un segundo preapproval mientras el primero sigue vivo (doble cobro).
4. **`assignSubscription` reemplaza la fila completa.** Una bonificación otorgada a quien paga por MP borra el vínculo con su preapproval, que sigue cobrando.
5. **Logs de diagnóstico temporales en el checkout** (últimos 6 caracteres de token y de credencial). No exponen secretos, pero el propio código dice "sacar".
6. **Cancelación (`cancelled→canceled`) corta el acceso a la IA de inmediato,** aunque el período esté pago.

## 2. Modelo implementado

### Tres cosas separadas
| Qué | Dónde | Quién lo escribe |
|---|---|---|
| **Plan contratado** | `Subscription.planId` (+ `planPriceId`, `billingInterval`) | Checkout, superadmin, bonificaciones. **La falta de pago nunca lo pisa.** |
| **Estado de la suscripción** | `Subscription.status`, `pastDueSince`, `currentPeriodEnd` | Webhook de Mercado Pago y conciliación |
| **Acceso efectivo** | `nexoAccess` / `crmAccess` / `nexoPlan` en `BusinessSubscription` | **Calculado** en cada lectura por `resolveProductAccess` (`lib/billing-access.ts`), nunca persistido |

Como el acceso efectivo se recalcula desde el estado, la degradación y la recuperación son **idempotentes**: procesar el mismo evento varias veces da el mismo resultado, y regularizar el pago restaura el acceso solo.

### Productos y planes
- `Plan.products`: `["nexo"]` (default, todos los planes existentes), `["crm"]` (Nodo) o `["nexo","crm"]` (pack).
- `Plan.crmMaxUsers`: usuarios incluidos en Nodo (obligatorio si el plan incluye Nodo).
- `Plan.trialDays`: prueba gratuita (`free_trial` del plan de MP).
- `PlanPrice`: un precio por período (`month` / `year`), cada uno con su `preapproval_plan`. El mensual refleja el de siempre (`Plan.monthlyPrice` / `Plan.mercadoPagoPlanId`, **probado en producción**, no se crea otro). El anual es un `preapproval_plan` propio de 12 meses.

### Reglas de acceso por producto
| Estado | Nexo | Nodo |
|---|---|---|
| Activa / prueba vigente, producto en el plan | Plan contratado | Acceso normal |
| Pago atrasado, dentro de 7 días (`pastDueSince`) | Plan contratado + aviso | Acceso normal + aviso |
| Atraso de más de 7 días | **Plan gratuito** (Agenda interna) | **Bloqueado** → pantalla de planes |
| Cancelada, dentro del período pagado | Plan contratado | Acceso normal |
| Cancelada y vencida / vencida / prueba vencida | Plan gratuito | Bloqueado |
| Plan sin el producto | Plan gratuito (ej. quien contrata solo Nodo) | Bloqueado |

**Nexo nunca se bloquea:** funciona con el plan gratuito. Sus límites (`publicWebEnabled`, `whatsappEnabled`, `maxServices`, créditos de IA, etc.) **solo impiden acciones nuevas**, no borran nada: la web queda guardada (el sitio público responde 404), los servicios existentes siguen, la sesión de WhatsApp no se elimina, y todo vuelve al contratar de nuevo un plan que lo incluya. El gratuito tiene sus propios límites: nunca hereda funciones premium por tenerlas configuradas.

**Nodo** no tiene plan gratuito: bloqueado no borra registros, módulos, campos, relaciones, automatizaciones ni informes.

### Atraso, gracia y fuera de orden
- **Una cuota rechazada** (`subscription_authorized_payment`: `recycling` o `processed` + `rejected`) pasa la suscripción a `past_due` y fija `pastDueSince` **una sola vez**.
- **Una cuota aprobada** vuelve a `active`, limpia `pastDueSince` y avanza el período.
- **Cuotas de un período anterior** y **notificaciones de un preapproval que ya no es el vigente** se ignoran.
- **Si el webhook nunca llega:** pasados 3 días de la fecha de cobro sin noticias de MP, se considera atraso desde esa fecha. Si MP dio señales después de la fecha de cobro, no se infiere nada.

### Cambio de comportamiento para clientes actuales de Nexo (pedido explícito)
- **Antes:** `past_due` era una gracia sin límite y una cancelación cortaba la IA de inmediato.
- **Ahora:** 7 días de gracia, y la cancelación mantiene el acceso hasta el fin del período pagado.
- **Los `past_due` existentes empiezan su gracia** el día de la migración (`pastDueSince = now`), no antes.

### Pendiente antes de activar en producción
- **Cron de conciliación con MP:** relee preapproval y cuotas de las suscripciones vencidas o atrasadas. Es la red de seguridad de la regla "el webhook nunca llegó". Correrlo una vez apenas se despliegue, antes de que pasen los 3 + 7 días.
- **Lado Nodo:**
  - espejo de `Plan` / `Subscription` / `PlanPrice`;
  - control de acceso en `resolveWorkspaceContext` (páginas y APIs);
  - pantalla de planes;
  - checkout vía API interna;
  - límite de usuarios;
  - avisos.
- **Superadmin:** pantallas de Planes y Empresas con productos, precios y estado.
- **Transición de los usuarios actuales de Nodo:** bonificación configurable + reporte de impacto.
