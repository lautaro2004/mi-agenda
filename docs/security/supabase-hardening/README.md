# Hardening de Supabase — scripts manuales

**Nada de esto está aplicado.** Son scripts para correr a mano en el SQL Editor de Supabase; no son migraciones de Prisma (RLS no se modela en `schema.prisma`) y no están en `prisma/migrations/`. Contexto y análisis: [seguridad-supabase-rls-informe.md](../../architecture/seguridad-supabase-rls-informe.md).

| Orden | Archivo | Qué hace | ¿Rompe el keepalive? |
|---|---|---|---|
| 1 | `01-verificar.sql` | Solo lectura: rol de Prisma, schemas expuestos, RLS, grants | No |
| — | **Backup** | La base tiene datos reales y no hay PITR: `pg_dump` o snapshot antes de seguir | — |
| 2 | `02-habilitar-rls.sql` | RLS deny-all (sin policies) en `public`, `nexo`, `crm` | **No** (anon pasa a ver 0 filas, HTTP 200) |
| 3 | `03-cerrar-data-api.sql` | `REVOKE` a anon/authenticated + sacar schemas de "Exposed schemas" (dashboard) | **Sí** — aplicar solo cuando el keepalive ya no use la anon key |
| — | `99-rollback.sql` | Deshace 02 y 03 | — |

## Checklist para el paso 2
1. Correr `01-verificar.sql` y confirmar que `postgres` tiene `rolbypassrls = true`. Guardar el resultado.
2. Confirmar que `DATABASE_URL` usa el usuario `postgres.<ref>` (no un rol propio). Es lo que hoy figura en `.env.local`.
3. Backup.
4. Correr `02-habilitar-rls.sql`. La consulta final debe devolver 0 filas.
5. Probar de inmediato: login, dashboard (turnos, servicios), sitio público `/s/<slug>`, una reserva pública, un mensaje al bot de WhatsApp, y en el CRM abrir un contacto. Si algo devuelve vacío o falla: `99-rollback.sql`.
6. Volver a correr `01-verificar.sql`: el Security Advisor debería dejar de marcar "RLS Disabled in Public".

## Pendiente antes del paso 3
Reemplazar `.github/workflows/keepalive.yml` (hoy `GET /rest/v1/Plan` con anon key) por algo que no dependa de la Data API, por ejemplo un endpoint propio con `CRON_SECRET` que ejecute `SELECT 1` con Prisma. Después de eso, aplicar el paso 3 y sacar los schemas de "Exposed schemas". Con la anon key ya sin uso, borrar `NEXT_PUBLIC_SUPABASE_ANON_KEY` de `.env.local`.

## Lo que estos scripts NO resuelven
- Rotación de claves si hubo accesos previos con la anon key (revisar logs de API de Supabase).
- Aislamiento por negocio en la base (policies por `businessId`): hoy lo hace la aplicación. Ver sección 4 del informe.
- Policies de `storage.objects` (no se revisaron).
