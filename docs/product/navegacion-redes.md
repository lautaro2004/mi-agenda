# Navegación configurable y redes sociales del sitio público

## Modelo
- `SiteNav` (1 por negocio, `config` JSON validado con zod en `lib/site-nav.ts`). Sin fila = navegación automática (compatible con los sitios existentes).
- Redes: columnas de `Business` (`instagramUrl`, `facebookUrl`, `tiktokUrl`, `youtubeUrl`, `linkedinUrl`). Única fuente de verdad; `SiteNav` solo guarda DÓNDE se muestran (footer / navbar).

## Reglas
- Destinos: sección (por tipo estable, ancla `sec-<tipo>`), página interna (carta / reservas), URL externa (solo http/https), WhatsApp con mensaje, teléfono; el CTA suma "formulario de contacto" y "reservar".
- WhatsApp y teléfono salen de los datos del negocio (no se duplican números).
- Un enlace activo que no se puede cumplir (sección oculta/sin contenido, sin WhatsApp, etc.) NO se muestra en el sitio público y se marca en el panel; al ocultar una sección se avisa qué enlaces la usan.
- Por defecto: Servicios / Carta / Horarios / Preguntas solo si existen y son visibles; "Horarios" y el botón de reservar no aparecen si el negocio no usa agenda.
- Redes: cada URL se valida contra el dominio de su red (nunca el ícono equivocado), se normaliza y se abre con `rel="noopener noreferrer"`.

## Pendiente (próximas entregas)
Analítica propia y atribución UTM; GA4/GTM con consentimiento.
