# Editor modular del sitio — etapa 1

Banners promocionales y gestión de secciones de la página pública (`/s/[slug]`).

## Qué hace

- **Banners** (Sitio web → Contenido visual): nombre interno, imagen de escritorio, imagen móvil opcional, texto alternativo, título y descripción opcionales, activo/inactivo y botón (CTA) opcional.
  - Diseños: *Solo imagen*, *Con título y botón*, *Compacto*.
  - Destinos del botón: formulario de contacto, sección de la página, WhatsApp con mensaje predefinido, URL externa, llamada.
- **Secciones de la página** (Sitio web): lista ordenada por plantilla con orden (arrastrar o ↑/↓), mostrar/ocultar, agregar y quitar banners y acceso a la edición del contenido de cada sección.

## Modelo

| Tabla | Contenido |
|---|---|
| `nexo.SiteBanner` | Un banner reutilizable por negocio. Imágenes = URLs del bucket `site-assets` (`{businessId}/banner/...`). |
| `nexo.SiteLayout` | Una fila por negocio y plantilla; `items` = arreglo JSON ordenado `{ id, kind, bannerId?, visible }`. |

- El orden se guarda reemplazando el arreglo completo en una sola escritura (`upsert`): no hay posiciones a medias.
- Un banner se referencia por `bannerId`: usarlo en varias posiciones no lo duplica. Borrar el banner lo saca de todos los layouts en la misma transacción.
- Sin fila en `SiteLayout`, o con lo guardado inválido, el sitio usa el orden de fábrica (`SITE_SECTIONS` en `lib/site-sections.ts`). Secciones nuevas de Nexo se agregan solas al final del orden existente.
- Los contenidos de cada sección (servicios, FAQ, galería, horarios…) **no se tocan**: ocultar una sección solo cambia `visible`.

## Reglas

- **Registro explícito de bloques** por plantilla (`lib/site-sections.ts`): lo guardado solo elige entre tipos conocidos; nunca se ejecuta nada de la base.
- Obligatorias (no se ocultan ni se eliminan): portada (siempre primera) y la sección de contacto de la plantilla (`hero` + `booking` / `inquiry` / `form`). Las demás se pueden ocultar; solo los banners se pueden quitar.
- Banners inactivos no se renderizan. Un CTA que no se puede cumplir (WhatsApp o teléfono sin configurar, sección oculta o sin contenido) no genera botón, nunca un botón roto.
- Validación en el servidor: URL externa solo `http(s)` sin credenciales; imágenes solo del propio negocio; WhatsApp/teléfono salen de la configuración del negocio (no se duplican ni se inventan). Enlaces que abren otra pestaña usan `rel="noopener noreferrer"`.
- Permisos: lectura para cualquier miembro, escritura desde rol *admin*; el negocio sale de la sesión. Crear banners y subir imágenes requiere el plan con `galleryEnabled` (mismo permiso que la galería).
- Se invalida la caché de `/s/[slug]` (`revalidatePath`) al guardar.

## Migración

`prisma/migrations/20261028120000_site_banners_layout/migration.sql` — aditiva e idempotente (2 tablas nuevas). Aplicarla en Supabase **antes** de deployar.

## Pendiente (etapa 2)

- Arrastrar para reordenar con teclado más allá de ↑/↓ y reordenar en pantalla de vista previa.
- Más tipos de bloque (texto libre, galería por referencia, testimonios) y editar el contenido de la portada y los pasos dentro del propio editor.
- Programar banners por fechas, estadísticas de clics, copias de un banner por idioma.
- Mover el barrido de imágenes huérfanas (subidas canceladas) a un cron.
