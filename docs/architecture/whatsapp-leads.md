# Leads desde WhatsApp (Nexo → Consultas → Nodo)

**Estado:** implementado, pendiente de aplicar migración y desplegar.
**Fecha:** 2026-10-22
**Continúa:** [`crm-fase4-nexo-leads.md`](./crm-fase4-nexo-leads.md).

## Qué hace

Cuando un negocio tiene WhatsApp conectado, cada **contacto nuevo con un mensaje real** se guarda como Consulta (`nexo.Inquiry`, `source: "whatsapp"`), **con la IA prendida o apagada** (modo manual). Si el negocio tiene Nodo (`crm.Workspace`), la sincronización automática del CRM la convierte en `crm.Lead`. Si no, queda solo en Nexo → Consultas.

## Decisiones

- **Qué es un lead:** primer mensaje con contenido de un número que no generó una consulta de WhatsApp en los últimos 30 días (`WHATSAPP_LEAD_WINDOW_DAYS`). Se ignoran saludos, confirmaciones, emojis, stickers y audios sin texto (mismos criterios que el triage de la IA). Sin costo de IA. Ver `modules/inquiries/whatsapp-lead.ts`.
- **Dónde corre:** en `handleCustomerMessage`, **antes** del corte por IA apagada / conversación en modo manual, y sin `await` (nunca demora ni rompe la respuesta de la IA).
- **Nexo nunca escribe en `crm.*`:** mismo contrato que la Fase 4. Nodo lee `nexo.Inquiry` (modelo espejo de solo lectura) y crea el Lead (`source: "nexo_inquiry"`, idempotente por `sourceRef`). Consultas web y de WhatsApp comparten ese source; el canal queda en la nota del Lead.
- **Sincronización automática:** `POST /api/cron/sync-nexo-leads` en Nodo (protegido con `CRON_SECRET`), cada 5 minutos vía GitHub Actions (`crm/.github/workflows/sync-nexo-leads.yml`). Recorre todos los Workspaces y solo los registros de los últimos 7 días. El botón manual "Sincronizar con Nexo" sigue revisando todo el historial.
- **Interruptor de IA persistido:** `Business.whatsappAiEnabled`. Antes vivía solo en memoria y volvía a "prendida" en cada reinicio del servidor.

## Calificación con IA (etapa 2)

Opcional por negocio (Consultas → "Calificación de leads con IA"): un interruptor + una descripción libre del lead ideal (`Business.leadQualificationEnabled`, `Business.leadIdealProfile`). Código: `modules/inquiries/qualification.ts`.

- **Estados** (`Inquiry.qualificationStatus`): `null` (no aplica: formulario web, o negocio sin calificación) · `"pending"` · `"qualified"` · `"discarded"`, más `qualificationReason` (frase para el dueño).
- **Nacen `pending`:** con la calificación activa, `captureWhatsappLead` crea la consulta en `"pending"`.
- **Cuándo analiza:** cada mensaje del cliente reprograma un análisis para cuando el chat queda 30 s quieto (`QUIET_MS`, debounce en memoria). La IA ve los últimos 30 mensajes, incluidas las respuestas manuales del dueño, y **propone** `qualified` / `discarded` / `unclear` (JSON validado con zod). `unclear` deja la consulta `pending` y guarda el motivo. Ante la duda el prompt prefiere `unclear` a descartar.
- **Costo acotado:** máximo 6 análisis por consulta (`MAX_ATTEMPTS_PER_INQUIRY`); después queda `pending` y decide el dueño. Uso registrado como `lead_qualification` en `AiUsageEvent`.
- **El dueño manda:** puede marcar calificado/descartado a mano desde Consultas. La IA solo escribe sobre consultas que siguen `pending` (`updateMany` con ese filtro), así que nunca pisa una decisión manual.
- **Nodo:** sincroniza solo `null` y `"qualified"`. El cron filtra consultas por `updatedAt` (no `createdAt`) para levantar calificaciones tardías.
- **Al desactivar** la calificación, las `pending` vuelven a `null` y se sincronizan como antes.

## Limitaciones

- Las conversaciones de WhatsApp siguen en memoria: la deduplicación se apoya en `Inquiry` (persistida), no en la conversación.
- Contactos con JID `@lid` usan el identificador que ya guarda la conversación como "teléfono" (misma limitación que el resto del módulo de WhatsApp).
- El lock contra mensajes simultáneos y el debounce/contador de la calificación son por proceso (suficiente: una conexión de WhatsApp vive en un solo proceso). Si el servidor se reinicia con un análisis programado, la consulta sigue `pending` hasta el próximo mensaje del cliente.
- La calificación aplica solo a consultas de WhatsApp (son las que tienen un chat para analizar); las del formulario web pasan siempre.
