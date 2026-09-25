# Integración Google (Gmail + Calendar) — Nexo y Nodo

**Estado:** implementada (V1), sin aplicar migraciones ni probar contra Google real. Resumen técnico y guía de configuración.

## Arquitectura

- **Un solo cliente OAuth de Kodexa.** Cada usuario autoriza su cuenta; nadie crea su propia app de Google.
- **`public.GoogleConnection`** (una por `businessId + userId`): `googleEmail`, `refreshTokenEnc` (AES-256-GCM, AAD `businessId:userId`), `scopes[]`, `status` (`active`/`revoked`). No se guarda access token: se pide con el refresh token y se cachea en memoria. No se reutiliza la tabla `account` de Better Auth (eso es identidad de login).
- **Núcleo compartido:** `lib/google/*` (excepto `context.ts`) es una **copia idéntica en `nexo/` y `crm/`**; no hay paquete compartido entre repos. Cambios = en ambos. La migración de `GoogleConnection` vive en Nexo (dueño de `public`); el CRM la declara como espejo.
- **Cada app tiene sus rutas OAuth** (`/api/integrations/google/{status,connect,callback,disconnect}`), mismas en ambas, y su propia redirect URI. Como la tabla es compartida, lo conectado en una app lo ve la otra.
- **Autorización incremental:** primero se pide `openid email` + el scope de la función (`gmail.send` o `calendar.events`); ampliar con `include_granted_scopes=true` conserva lo ya otorgado, con `login_hint` de la misma cuenta. Si el scope ya está, no se vuelve a pedir.
- **Seguridad:** `businessId`/`userId` salen siempre de la sesión. `state` firmado (HMAC con `BETTER_AUTH_SECRET`, 10 min) + cookie httpOnly con el nonce. `returnTo` solo admite rutas internas. Los tokens nunca van al frontend, a respuestas API ni a logs.

## Qué usa cada app

| | Nexo | Nodo (CRM) |
|---|---|---|
| Conectar / desconectar | Tarjeta en `/dashboard/negocio` (Gmail) | `/dashboard/configuracion/integraciones` (Gmail + Calendar) |
| Gmail | `sendBusinessEmail()`: Gmail del **dueño** si está conectado; si no (o si falla), Resend con nombre del negocio + Reply-To | — (el email de Nodo migra en una fase posterior) |
| Calendar | — | Eventos de Google en el calendario, crear/editar/eliminar desde Nodo, "Agregar a Google Calendar" en tareas |
| Emails de plataforma | `sendPlatformEmail()` → Resend (sin cambios) | — |

## Migraciones (no aplicadas)

- Nexo: `20260926000000_add_google_connection` (tabla `public.GoogleConnection`, con RLS habilitado).
- Nodo: `20260926100000_calendar_google_link` (`CalendarEvent`: `provider`, `googleEventId`, `googleUserId`, `taskId`; índice único `businessId + googleEventId`).

## Configuración manual en Google Cloud

1. Proyecto de Google Cloud de Kodexa → habilitar **Gmail API** y **Google Calendar API**.
2. **Pantalla de consentimiento OAuth** (tipo External): nombre, logo, dominio verificado, enlaces a la política de privacidad (`/privacidad`) y a los términos (`/terminos`). Mientras esté en "Testing": máximo 100 usuarios de prueba y los refresh tokens vencen a los 7 días. Para producción hay que **publicar y verificar** la app (scopes sensibles; sin evaluación de seguridad CASA porque no se piden scopes restringidos).
3. **Scopes** a declarar: `openid`, `email`, `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/calendar.events`.
4. **Credenciales → ID de cliente OAuth → Aplicación web.** URIs de redireccionamiento autorizados (ambas):
   - `https://<dominio-nexo>/api/integrations/google/callback`
   - `https://<dominio-nodo>/api/integrations/google/callback`
   (más `http://localhost:<puerto>/api/integrations/google/callback` para desarrollo).
5. Cargar en **cada app** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (la de esa app) y `GOOGLE_TOKEN_ENCRYPTION_KEY` (**el mismo valor en Nexo y Nodo**, 32 bytes en base64).

## Fuera de la V1

Sincronización bidireccional, webhooks, `syncToken`, resolución de conflictos, calendarios múltiples, Outlook/iCloud, disponibilidad, invitaciones, eventos recurrentes avanzados, sincronización automática de Tasks o Reminders, y el envío de emails de Nodo por Gmail.
