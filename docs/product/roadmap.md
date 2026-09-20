# Roadmap — Nexo

**Última actualización:** 2026-09-17.
**Reemplaza** la versión anterior (tabla de sprints pre-MVP, "Autenticación: Pendiente" / "Mercado Pago: Pendiente" / etc.) — quedó completamente desactualizada frente al estado real del producto. Ver `docs/product/vision.md` para el marco de decisión detrás de este roadmap, y `docs/product/inventario-actual.md` para la fotografía verificada de qué existe hoy en el código (fuente de verdad, no este documento).

---

## 1. Estado general (resumen — el detalle completo vive en `inventario-actual.md`)

**Nexo** (este repo): producto en uso, con negocios reales operando (ej. "El Andén"). Núcleo implementado: cuenta/onboarding, negocio/horarios/servicios/recursos, turnos (lista + reserva pública sin WhatsApp), señas y comprobantes, sitio público (2 plantillas, SEO por IA), AI Studio (entrenamiento, personalidad, memoria, simulador), WhatsApp (conexión + respuesta automática, **sin persistencia de conversaciones**), notificaciones, estadísticas básicas, suscripciones pagas vía Mercado Pago (validado en producción), leads comerciales de Kodexa, panel de Superadmin.

**CRM** (`crm/`, repo separado): producto real y separado, no una funcionalidad de Nexo. Ya construido: identidad compartida con Nexo (mismo `User`/`Business`), Workspaces, Companies, Contacts, Leads, Opportunities, Pipelines, Tasks (con adjuntos/comentarios/historial), Tags, campos personalizables, suscripción/facturación propia. Puente real con Nexo: turnos de Nexo se sincronizan (manual) como Leads del CRM, con aislamiento multi-tenant verificado. Ver `crm-fase1` a `crm-fase5` en `docs/architecture/`.

**Commerce**: no existe, ni como código ni como diseño. Mencionado en este roadmap solo como referencia de "a dónde no debe crecer Nexo/CRM todavía".

---

## 2. Roadmap de evolución de la presencia web de Nexo

Las etapas siguientes son las que tienen sentido **hoy**, dado lo que ya existe (sección 1) y el principio rector de `vision.md`. Cada etapa depende de que la anterior esté construida y, cuando sea posible, validada con un negocio real — no se saltea orden.

### V1 — Consolidar la atención dentro del template Booking

*Depende de: nada nuevo, es la evolución directa de lo que ya existe.*

- Formulario de consultas en el sitio público (no existe hoy — ver `vision.md` sección 6.4). Alcance mínimo: nombre, WhatsApp, email, consulta. Diseño técnico propuesto (sin implementar todavía): `docs/architecture/v1-formulario-consultas-diseno.md`.
- La consulta entra al mismo sistema de clasificación que ya usa WhatsApp (reusar, no reimplementar) — como mínimo, debe poder terminar en una notificación real al dueño (mismo mecanismo que ya existe) y, si tiene sentido, en un intento de respuesta automática.
- CTAs de WhatsApp contextual (no solo el botón flotante) en los puntos donde el visitante duda antes de reservar.
- Mejoras puntuales de ficha de detalle por servicio/recurso, solo donde el valor sea claro (ver criterio de `vision.md` sección 8) — no una reescritura completa del template.

**Por qué primero:** es la pieza de menor complejidad y mayor apalancamiento — profundiza un canal que ya existe, y es además el prerequisito de datos para que el puente con el CRM (sección 3) tenga una segunda fuente de leads además de las reservas.

### V2 — Sistema reutilizable de listado → detalle → acción

*Depende de: V1 (mejor entender, con uso real, qué partes de "mostrar contenido" se repiten antes de abstraerlas).*

- Extraer el patrón que el template `booking` ya usa implícitamente para servicios (listado, card, detalle, acción) en componentes reutilizables, no atados a `Service` específicamente.
- Categorías, donde tengan sentido (hoy `Service.category` ya existe como campo libre — evaluar si alcanza o hace falta algo más estructurado).
- Galerías más completas, reusando lo que ya existe (`GalleryBlock`/`GalleryImage`).

**Por qué acá y no antes:** construir la abstracción sin haber visto primero cómo se usa el template actual en producción es el riesgo real de "sobrearquitecturar" que `vision.md` pide evitar explícitamente.

### V3 — Nuevos tipos de contenido (productos, propiedades)

*Depende de: V2 (la abstracción debe existir y estar probada antes de extenderla a un tipo de contenido nuevo).*

- Evaluar **un** caso primero (probablemente productos, por ser el más cercano a lo que ya existe: precio, imágenes, disponibilidad) antes que varios a la vez.
- Reusar el motor de listado/detalle/acción de V2 — si un caso nuevo obliga a reescribir en vez de extender, es una señal de que V2 no estaba lo suficientemente bien diseñada, no de que haga falta un template aparte.
- Explícitamente fuera de alcance en esta etapa: inventario real, checkout, pagos de producto — eso es Commerce (`vision.md`, sección 5), no una funcionalidad de Nexo.

**No construir todavía** — depende de que exista demanda real de un negocio que no sea "servicios con turno", y de que V1/V2 ya estén validados.

### V4 — Omnicanalidad más allá de WhatsApp + Web

*Depende de: haber resuelto antes la persistencia de conversaciones de WhatsApp (limitación real documentada en `inventario-actual.md` — hoy vive solo en memoria del proceso). Agregar un canal nuevo sobre una base que ya pierde historial multiplicaría el problema, no lo resolvería.*

- Instagram (mensajes privados; comentarios solo si tiene sentido técnico y comercial, no por defecto).
- Bandeja unificada y contexto compartido entre canales.

**No construir todavía.**

### V5 — Multiagente y routing por intención

*Depende de: V1 (el formulario de consultas es, en la práctica, el primer caso real de "clasificar y derivar" fuera de WhatsApp) y de que el "Empleado" de IA actual (un único agente configurable, ver `inventario-actual.md`) demuestre sus límites reales en producción.*

- Especialización por tipo de consulta (soporte / comercial / reservas), reusando el motor de personalidad/objetivos/restricciones que ya existe — no un sistema nuevo por agente.
- Lead scoring, derivación — evaluables recién cuando haya volumen real que lo justifique.

**No construir todavía.**

### Etapas posteriores, fuera de Nexo

- **CRM**: ya existe como producto separado (sección 1) — su propio roadmap vive en su propio repo, no acá. Lo único que le corresponde a *este* roadmap es seguir fortaleciendo el puente (V1 lo hace posible: más fuentes de leads reales desde Nexo).
- **Commerce**: no existe. Si V3 (productos) demuestra demanda real de catálogo/inventario/checkout, ahí se evalúa como producto propio — no como una ampliación de Nexo.

---

## 3. Dependencias entre etapas (resumen visual)

```
V1 (formulario + WhatsApp contextual)
   │
   ├──→ V2 (listado/detalle/acción reutilizable)
   │        │
   │        └──→ V3 (productos/propiedades) ──→ (evaluar Commerce, producto aparte)
   │
   └──→ V5 (multiagente/routing) — también depende del Empleado IA actual mostrando sus límites

Persistencia de conversaciones de WhatsApp (deuda técnica ya identificada)
   │
   └──→ V4 (omnicanalidad — Instagram, etc.)

Puente Nexo → CRM (ya existe, hoy solo con turnos)
   │
   └──→ se fortalece solo con V1 (nueva fuente real de leads: consultas)
```

## 4. Explícitamente, qué no estamos construyendo ahora

- Cuatro plantillas separadas por rubro (cancha/inmobiliaria/tienda/gimnasio) — se descarta como enfoque, no se posterga (ver `vision.md`, sección 6.2).
- Un "motor universal de entidades"/CMS genérico dentro de Nexo.
- Ecommerce/checkout de productos dentro de Nexo.
- Cualquier forma de CRM dentro de Nexo — ya existe como producto separado.
- Multiagente antes de tener el caso de uso real (V1) que lo motive.
- Instagram/omnicanalidad antes de resolver la persistencia de WhatsApp.

## 5. Próximo paso concreto recomendado

De todo lo anterior, **V1 — formulario de consultas en el sitio público** es la pieza con mejor relación valor/complejidad para empezar: es chica, refuerza un canal que ya existe, no requiere ninguna decisión arquitectónica nueva (reusa el motor de notificaciones y, potencialmente, el de clasificación de IA que ya existen), y es el prerequisito real para que el puente con el CRM tenga más de una fuente de leads. No depende de resolver la persistencia de WhatsApp ni de ninguna otra deuda técnica pendiente.

## 6. Nota sobre otros documentos de este repo

`docs/product/backlog.md` fue corregido (2026-09-17): se retiró el ítem "CRM" que figuraba como prioridad alta del backlog de Nexo, por la misma razón que motivó este documento — el CRM ya es un producto separado, no una funcionalidad pendiente de Nexo.
