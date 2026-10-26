# Plantilla de sitio "Captación de clientes" (leads)

**Fecha:** 2026-10-25 · Código: `components/public-site/leads/`, `app/s/[slug]/page.tsx`.

Página cuyo único objetivo es que el visitante deje sus datos (tráfico de anuncios / Instagram). Se elige a mano en Sitio web → Plantilla; nunca se auto-detecta.

## Estructura

Hero en el color de marca (texto claro u oscuro según contraste, `readableTextOn`) con la imagen real del negocio (portada → galería → servicio) y servicios como tarjetas flotantes → Cómo funciona (3 pasos) → Servicios → Galería → FAQ → panel final oscuro con el formulario (`#contacto`). En mobile, una barra fija lleva al formulario (aparece pasado el hero, se oculta con el formulario en pantalla). Animaciones solo CSS y detrás de `prefers-reduced-motion` (`app/globals.css`, `.leads-rise`, `.leads-float`, `[data-reveal]`).

Nunca muestra datos inventados (cifras, reseñas, plazos): todo sale del negocio o de textos genéricos.

## Textos — `LandingCopy`

Generados con IA a pedido (operación `landing_copy`) y editables; sin fila se usan `LEADS_DEFAULT_COPY` + H1 del SEO + descripción. Ver `modules/business/landing-copy.ts`.

## Formulario configurable — `LeadForm`

`lib/lead-form.ts` (sin Prisma, compartido cliente/servidor):

- Nombre y WhatsApp siempre. Email, nombre del negocio, zona y mensaje: obligatorio / opcional / oculto, con etiqueta propia.
- Hasta 5 preguntas propias (texto u opciones; con ≤5 opciones se muestran como chips).
- `buildLeadSubmissionSchema(config)` valida en el navegador **y** en `POST /api/public/[slug]/inquiry` (body con `form: "leads"`), así un obligatorio no se saltea con un POST a mano.
- Las respuestas no tienen columnas: `composeLeadMessage` las antepone al mensaje con las etiquetas del negocio, así llegan a Consultas, a Nodo y a la calificación con IA.

## Resiliencia

El sitio público lee `LandingCopy` y `LeadForm` con fallback: si la tabla no existe (migración sin aplicar) o el JSON es inválido, usa los textos y el formulario estándar. Nunca tira abajo un sitio.

Migraciones: `20261022220000_landing_copy`, `20261025220000_lead_form`.
