# Plan Esencial+ y agenda inteligente

## Qué es
Esencial+ es un plan de Nexo (ARS 30.000 de referencia, 300 créditos de IA) que suma a la agenda dos funciones que dependen de flags del plan, no de código:

| Flag (`nexo.Plan`) | Habilita |
|---|---|
| `smartBookingEnabled` | Agenda inteligente: reglas del negocio, aprobación de turnos, pantalla *Agenda inteligente* |
| `webAiChatEnabled` | Chat web con IA para reservar (además exige `publicWebEnabled`) |

Ambos flags son opt-in (default `false`). Esencial+ **no** incluye WhatsApp + IA, señas, entrenamiento, Carta + QR ni los 1.000 créditos de Profesional. Los créditos (`aiCredits`) y los flags se editan desde superadmin → Planes, sin tocar código.

Los permisos se validan siempre en el servidor (`canUseSmartBooking`, `canUseWebAiChat` en `modules/billing/subscription.ts`). Las reglas guardadas se conservan si el plan baja, pero dejan de aplicarse.

## Principio de diseño
Las reglas **solo restringen y ordenan**. El motor real (`getAvailableSlots`) decide qué horarios existen; `lib/smart-booking.ts` (puro, sin base) decide cuáles ofrecer, en qué orden y si la reserva se confirma o espera aprobación. Un horario ocupado o fuera de horario nunca aparece. Quien crea el turno revalida (`evaluateBooking`) y `createAppointment` sigue siendo la barrera contra reservas simultáneas.

## Reglas (`nexo.SmartBookingRules`, una fila por negocio)
- **Modo**: `auto` (confirma solo), `assisted` (recomendado: confirma lo que cumple, consulta excepciones), `manual` (todo requiere aprobación).
- Horarios preferidos, llenar de corrido, sugerir antes un preferido más temprano, margen entre turnos.
- Rangos reservados (atención espontánea: no se ofrecen online; el dueño puede agendar desde el dashboard).
- Rangos que requieren aprobación y/o todo lo que caiga fuera de los preferidos.
- Vencimiento de solicitudes: `approvalTimeoutHours` (24) y `approvalMinLeadHours` (2).

Las define el dueño (rol admin). Los mensajes de clientes nunca las modifican.

### Instrucciones en lenguaje natural
En la pantalla, "Contale a la IA cómo trabajás" llama a `POST /api/business/smart-booking/interpret`. La IA **propone**: la respuesta se valida con el mismo esquema, se muestra como lista de cambios y recién se guarda al confirmar con *Guardar cambios*. Límite: 10 consultas por hora y negocio. Operación de uso: `smart_rules_interpret`.

## Aprobación de turnos
- Turno con `status = "pending"` y `approvalExpiresAt` no nulo = esperando aprobación. **Bloquea el horario** (pending es un estado activo).
- Aprobar → `confirmed` (o `pending_payment` si hay seña). Rechazar o vencer → `cancelled`. Todas las transiciones son `updateMany` condicionales (idempotentes).
- Vence a `min(ahora + timeout, inicio − anticipación)`, con piso de 15 min y nunca después del inicio. El barrido corre dentro del cron de 10 minutos (`/api/cron/email-notifications`).
- La seña, si corresponde, se pide recién cuando el dueño aprueba.

## Canales
Todos aplican las mismas reglas:
- **Sitio público**: `/api/public/[slug]/availability` y `/book`. La reserva pública vive en `modules/appointments/public-booking.ts` (compartida con el chat).
- **Chat web con IA**: `POST /api/public/[slug]/chat`, widget `components/public-site/booking-chat.tsx` (home y `/reservar`).
- **WhatsApp**: `modules/ai/booking/flow.ts` (reservas nuevas; reagendar no usa las reglas todavía).

## Chat web con IA
- El modelo solo conversa y pide dos acciones (`availability`, `book`); el servidor valida todo (`modules/smart-booking/chat-engine.ts`).
- Redacta con dos pasadas: la segunda recibe el **resultado real**. Si falla, usa un texto fijo coherente. Nunca afirma una reserva que el servidor no guardó; si queda pendiente de aprobación lo dice.
- Si el negocio pide seña, el chat no reserva y deriva al formulario.
- Créditos: 1 por mensaje atendido (`web_booking_chat`), mes calendario de Argentina contra `Plan.aiCredits`. La segunda pasada (`web_booking_chat_result`) registra costo pero no consume. Sin créditos o sin proveedor de IA → respuesta de degradación y el formulario sigue funcionando.
- Límites: mensaje de 500 caracteres, 10 turnos de historial, 30 mensajes cada 15 min por IP y negocio. Los mensajes del cliente se tratan como datos, no como instrucciones.

## Seguridad y aislamiento
- Todo se resuelve por `businessId` obtenido del slug o de la sesión; el cliente nunca elige el negocio.
- Sin migraciones destructivas: `20261026220000_smart_booking_plan`, `20261026230000_smart_booking_rules`, `20261027000000_appointment_approval`. Aplicarlas en Supabase **antes** de desplegar.

## Limitaciones conocidas
- Margen y "de corrido" cuentan los turnos de todos los recursos juntos.
- Reagendar por WhatsApp no aplica las reglas.
- El rate limit es en memoria por instancia (best-effort).
- La hora actual del día se compara por hora completa (conservador) al filtrar horarios pasados en el chat.
- Pendiente: aviso por mail al cliente cuando se recalcula el precio en ARS.

## Cómo probar
`npx prisma generate; npx tsc --noEmit; npx vitest run`. Cobertura relevante: `lib/smart-booking.test.ts`, `modules/smart-booking/*.test.ts`, `modules/appointments/approval.test.ts`, `app/api/business/smart-booking/route.test.ts`.

## Combo Nexo + Nodo (descuento sobre la suma)
No es un plan que se cargue a mano: al contratar Nexo + Nodo juntos (o sumar Nexo desde Nodo) Nexo crea solo un plan interno (`Plan.comboDiscountPct` no nulo) que habilita ambos productos. Ese plan no tiene precio propio y no aparece en listados ni en Superadmin.
- **Precio**: `(plan de Nexo + plan de Nodo) × (1 − descuento)`. Nexo va en pesos y Nodo en dólares, así que se calcula con el dólar oficial del día. Los usuarios extra de Nodo se suman a precio de lista, sin descuento.
- **Descuento**: variable `COMBO_DISCOUNT_PCT` (default 20) en Nexo y en Nodo (Nodo solo la usa para mostrar el %). Queda fijado en el combo al crearse (va en el slug): cambiarla afecta solo a combos nuevos.
- **Un solo cálculo**: `modules/billing/pricing.ts` (`computeCharge`) lo usan la cotización, el checkout, el cambio de usuarios, el cambio de plan y el reajuste mensual. El reajuste mantiene el combo actualizado con el dólar.
- **Funciones**: permisos y créditos salen del plan de Nexo; usuarios de Nodo y extras, del de Nodo. Si se edita alguno de los dos planes, los combos copian el cambio (`syncCombosFor`).
- **Migración**: `20261027120000_plan_combo` (columna `comboDiscountPct`). Aplicar en Supabase antes de desplegar Nexo y Nodo.
- **Pantalla de Nodo**: "Sumar Nexo" en el checkout y en Suscripción → Cambiar de plan. Quitar Nexo del combo avisa que se pierde el acceso.
- **Limitaciones**: el combo anual exige que ambos planes tengan precio anual activo. Un cliente que hoy tiene solo Nexo (suscripción de monto fijo en Mercado Pago) todavía no puede sumar Nodo con descuento desde Nexo: hoy el camino es desde Nodo.
