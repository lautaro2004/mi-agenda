# Worker de WhatsApp

Proceso siempre encendido que mantiene las sesiones de Baileys y las
conversaciones. La app Next (Netlify) le habla por HTTP **solo si** define
`WHATSAPP_WORKER_URL`. Sin esa variable todo sigue corriendo dentro de la app
como antes (modo local), así que ambas opciones conviven.

## Variables del worker
| Variable | Para qué |
|---|---|
| `WHATSAPP_WORKER_SECRET` | Secreto compartido (>= 24 caracteres). Obligatorio. |
| `WHATSAPP_SESSIONS_DIR` | Carpeta de credenciales. Debe ser un **volumen persistente** (`/data/whatsapp-sessions`). |
| `DATABASE_URL` / `DIRECT_URL` | Las mismas que la app Nexo (Prisma). |
| Las del asistente de IA (`GEMINI_API_KEY`, etc.) | Las mismas que la app: el asistente responde desde el worker. |
| `PORT` | Lo pone Railway solo. |

## Variables en Netlify (app Nexo)
- `WHATSAPP_WORKER_URL` = URL pública del worker (https://...)
- `WHATSAPP_WORKER_SECRET` = el mismo secreto

## Probar local
```
$env:WHATSAPP_WORKER_SECRET="un-secreto-largo-de-prueba-123456"
npx tsx whatsapp-worker/server.ts
# en otra terminal, la app con:
$env:WHATSAPP_WORKER_URL="http://localhost:8080"; $env:WHATSAPP_WORKER_SECRET="un-secreto-largo-de-prueba-123456"; npm run dev
```
`GET /health` responde `{ "ok": true }` sin secreto.

## Railway
1. New Project → Deploy from GitHub repo (Nexo). Dockerfile Path: `whatsapp-worker/Dockerfile`.
2. Agregar un **Volume** montado en `/data`.
3. Cargar las variables de arriba. Generar dominio público.
4. Una sola réplica (las sesiones viven en memoria del proceso).
5. En Netlify cargar `WHATSAPP_WORKER_URL` y `WHATSAPP_WORKER_SECRET` y redeployar.

## Límites conocidos
- Las conversaciones están en memoria del worker: un reinicio las pierde (igual que antes en la app). Persistirlas en la base es un paso aparte.
- Una sola instancia. Para escalar hace falta sacar el estado a la base.
- Si pasás de modo local a worker, hay que volver a vincular el celular (las credenciales viven en el volumen del worker).
