# CRM — Email & Plantillas (foundation)

Decisiones (breves). Alcance: config de remitente, plantillas, envío 1-a-1 desde Contact/Lead/Opportunity, historial en Activity. Sin campañas, automatizaciones ni métricas.

- **Sin dependencias nuevas.** El proveedor real (`resend`) se llama con `fetch` a su API REST. Interfaz mínima `EmailProvider.send()` en `modules/email/providers.ts`; agregar otro proveedor = un objeto más.
- **Proveedores:** `sandbox` (default; NO entrega nada, el envío queda registrado como "simulado") y `resend`. La API key es un secreto de plataforma (`RESEND_API_KEY`, env), NO por tenant; lo único por tenant es remitente/nombre/proveedor. Un tenant no puede leer ni cambiar la key.
- **Estado de configuración = derivado**, no almacenado (evita estados obsoletos): `not_configured` (sin email remitente), `provider_unavailable` (resend sin API key en el server), `ready`, `sandbox`.
- **Tablas (`crm.*`, ambas con `businessId` → Workspace):** `EmailSettings` (1:1 con Workspace) y `EmailTemplate` (nombre único por negocio). No hay tabla de mensajes: el historial es **Activity** (`type: "email"`) con destinatario, asunto y estado (Enviado / Simulado / Falló) en el cuerpo. Deuda conocida: sin `providerMessageId` ni reintentos; si se agregan webhooks/métricas habrá que introducir `EmailMessage`.
- **Destinatario resuelto en el servidor**, nunca del cliente (Contact/Lead → su email; Opportunity → email de su Contacto). Evita usar el CRM como relay abierto. El email de prueba va al email del usuario en sesión.
- **Variables:** `{{contact.name}}`, `{{company.name}}`, `{{lead.name}}`, `{{opportunity.name}}`. Los valores se escapan HTML en el cuerpo. Una variable sin dato para la entidad se deja literal y se avisa; el servidor rechaza el envío si quedan variables sin resolver (el usuario las edita antes de enviar).
- **Preview** en `<iframe sandbox srcDoc>` (sin scripts) — el HTML de la plantilla nunca se inyecta en el DOM de la app.
