# Visión del producto — Nexo

**Última actualización:** 2026-09-17.
**Reemplaza** la versión anterior de este documento (escrita en la etapa de MVP de "Mi Agenda", cuando CRM todavía no existía como producto separado — quedó desactualizada en varios puntos concretos, corregidos acá).

---

## 1. Nuestra misión

Eliminar la necesidad de gestionar manualmente la atención y las reservas de un negocio por WhatsApp.

Cualquier negocio debe poder automatizar la atención inicial de sus clientes con Inteligencia Artificial, reduciendo tiempos de respuesta y mejorando la experiencia tanto del cliente como del negocio — sin tener que aprender un sistema complejo.

## 2. Nuestra visión

> **Nexo es el frente digital y comercial del negocio: representa la marca, atrae y atiende clientes desde distintos canales, comprende sus necesidades, los deriva al agente o flujo adecuado, y automatiza parte de la operación.**

La tecnología trabaja en segundo plano. El dueño del negocio conecta su WhatsApp, configura su negocio charlando con la IA (ver `docs/architecture/ai.md`), y empieza a recibir reservas — sin diseñar nada, sin escribir código, sin curva de aprendizaje.

Hoy esa representación pasa por dos canales reales: el **sitio público** (`/s/[slug]`, dos plantillas) y **WhatsApp** (conexión real vía Baileys, IA respondiendo). Los dos comparten el mismo motor de reservas y el mismo contexto de negocio (ver `docs/product/inventario-actual.md`, la fotografía verificada de lo que existe hoy). El resto de este documento explica cómo pensamos evolucionar esa representación **en profundidad**, no simplemente agregando plantillas o funcionalidades sueltas.

## 3. Principio rector

Cada decisión de producto — grande o chica — se mide contra una sola vara:

> **Nexo debe crecer en profundidad y valor, no simplemente en cantidad de funcionalidades.**

En la práctica esto significa preferir sistemáticamente:

- Una abstracción reutilizable antes que cuatro soluciones puntuales parecidas.
- Profundizar un canal/flujo existente antes que sumar uno nuevo que todavía no atendemos bien.
- Reutilizar infraestructura ya construida antes que crear una paralela.
- Una funcionalidad que refuerza la identidad de Nexo (representar, atender, automatizar) antes que una que empieza a construir, sin querer, un producto distinto adentro de Nexo.

La sección 8 de este documento da el criterio explícito para aplicar este principio caso por caso.

## 4. Público objetivo

Hoy, negocios pequeños y medianos que trabajan con turnos: barberías, peluquerías, centros de estética, consultorios, gimnasios, estudios profesionales, talleres, servicios técnicos, y negocios de alquiler de espacios (el caso real de referencia, "El Andén", es una cancha de fútbol 5/7 — ver `inventario-actual.md`).

La arquitectura debe permitir incorporar nuevos rubros sin reescribir lo existente. La sección 6 de este documento (presencia web) es, concretamente, el plan para que eso sea cierto también para negocios que no venden turnos — sin que cada rubro nuevo signifique un sistema aparte.

## 5. La familia de productos de Kodexa (ya existe, no es un plan a futuro)

Esto **ya está decidido y ya está construido**, no es una intención: Kodexa tiene hoy dos productos reales, en repositorios separados, que comparten identidad (mismas tablas `User`/`Session`/`Account`/`Membership`/`Business` en un único Postgres, separadas por schema) pero son aplicaciones Next.js independientes, con su propia instancia de autenticación y su propia base de código:

- **Nexo** (`nexo/`) — este producto. Schema `nexo`.
- **CRM** (`crm/`, nombre de trabajo interno **"Nodo"** en parte de la documentación de arquitectura, aunque el repo y el `package.json` todavía lo llaman "Kodexa CRM" — el nombre comercial definitivo no está cerrado). Schema `crm`. Ya tiene Companies, Contacts, Leads, Opportunities, Pipelines, Tasks (con adjuntos y comentarios), Tags, campos personalizables, y su propia suscripción/facturación independiente de la de Nexo.

Ya existe además un primer puente real entre ambos: cada turno reservado en Nexo puede sincronizarse (hoy manual, botón "Sincronizar con Nexo" en el CRM) como un `Lead` real en el CRM, con origen identificable e idempotente — sin que Nexo sepa que el CRM existe, y sin que el CRM pueda escribir nunca en las tablas de Nexo (adapter de solo lectura). Ver `docs/architecture/crm-fase4-nexo-leads.md` para el detalle técnico.

Este hecho — que la separación de productos ya es real, no aspiracional — es el ancla de todo lo que sigue en este documento. No estamos decidiendo *si* separar; estamos decidiendo *cómo* Nexo sigue siendo profundo en lo suyo sabiendo que ya tiene con quién repartir responsabilidades.

### Qué es cada producto

| Producto | Responsabilidad | Lo que NO hace |
|---|---|---|
| **Nexo** | Representa al negocio de cara al cliente, atiende (IA + WhatsApp + sitio público), automatiza la operación básica (reservas, señas, recordatorios simples). | No gestiona el ciclo de vida comercial completo de una relación (eso es el CRM). No gestiona catálogo/inventario/checkout de productos (eso sería Commerce). |
| **CRM ("Nodo")** | Organiza y desarrolla relaciones comerciales: leads, contactos, oportunidades, pipeline, tareas, seguimiento de equipo. | No atiende clientes en tiempo real ni reemplaza el sitio público o WhatsApp de Nexo — consume lo que Nexo genera. |
| **Commerce** (no existe todavía, ni como código ni como diseño) | Catálogo de productos, inventario, pedidos, checkout, comercio digital real. | No es una funcionalidad de Nexo ni del CRM — sería un tercer producto, conectado a ambos. |

Explícitamente, **no queremos que Nexo se convierta en un CRM gigante, ni en un Shopify, ni en un ERP.** Puede conectarse con esos sistemas y actuar como su capa de interacción con el cliente final — pero la profundidad de "gestionar una relación comercial a largo plazo" o "vender productos con inventario" no le corresponde a Nexo. Le corresponde a un producto especializado que ya existe (CRM) o que podría existir (Commerce).

---

## 6. La presencia web de Nexo: hacia dónde evoluciona

### 6.1 Punto de partida real (no asumir nada más)

Hoy Nexo genera automáticamente un sitio público por negocio (`/s/[slug]`), con dos plantillas (`institutional` y `booking`), elegidas automáticamente según si el negocio vende turnos como producto principal. El template `booking` ya muestra información del negocio, servicios, recursos, horarios, preguntas frecuentes, galería, información de señas, reservas (con motor de disponibilidad real, compartido con WhatsApp) y WhatsApp. El SEO de cada sitio se genera con IA, con un fallback determinístico. Todo esto está verificado y documentado en `inventario-actual.md` — es la base real sobre la que pensamos evolucionar, no un punto de partida hipotético.

Lo que **no** existe hoy y es relevante para todo lo que sigue: no hay ningún formulario de contacto/consulta genérico en el sitio público (el único evento de conversión real es reservar un turno), y no hay ningún concepto de "producto" o "propiedad" en el modelo de datos — solo `Service` y `Resource`.

### 6.2 Qué NO queremos construir

No queremos cuatro (o veinte) plantillas completamente separadas — "template cancha", "template inmobiliaria", "template tienda", "template gimnasio" — como sistemas aislados que haya que mantener y evolucionar por separado. Eso multiplica el costo de cada mejora futura por la cantidad de rubros, exactamente lo contrario del principio rector (sección 3).

### 6.3 La abstracción: Listado → Preview → Detalle → Acción

En vez de plantillas por rubro, la evolución que tiene sentido es una **capacidad transversal**: un mismo patrón de presentación (`Listado → Preview → Detalle → Acción`) aplicado sobre distintos tipos de contenido (`Service`, `Resource`, y eventualmente `Product`/`Property`/lo que haga falta), con componentes reutilizables (card, galería, ficha de detalle, CTA de acción) y datos específicos por tipo.

```
Negocio
   │
   ├── contenido (Service | Resource | ...)
   │
   ├── listado (con o sin categorías)
   │
   ├── card / preview
   │
   └── página de detalle → acción (reservar / consultar / comprar)
```

Esto **ya es, en parte, cómo funciona hoy** el template `booking` (servicios listados, con su propio detalle implícito y su acción de reserva) — la evolución no es inventar el concepto, es **generalizarlo** para que un nuevo tipo de contenido (ej. un producto, una propiedad) pueda sumarse reusando el mismo patrón de UI y el mismo esqueleto de datos, en vez de programarse desde cero.

### 6.4 Profundizar el template Booking antes de expandir a nuevos rubros

Antes de pensar en productos o propiedades, hay valor real en profundizar lo que ya existe. El foco de hoy es casi puramente `elegir servicio/recurso → elegir horario → reservar`. Hay una oportunidad concreta de agregar una capa de atención para quien todavía no está listo para reservar:

- **WhatsApp contextual**: no solo el botón flotante que ya existe, sino CTAs específicos ("¿Tenés dudas sobre disponibilidad, precios o el servicio? Consultar por WhatsApp") que entran al mismo ecosistema de atención de Nexo (la IA ya sabe responder preguntas sobre el negocio — esto es exponer mejor un camino que la IA ya puede resolver, no construir una IA nueva).
- **Formulario de consultas**: hoy no existe ningún formulario de contacto genérico en el sitio público — es una pieza real, chica y de alto apalancamiento: conecta con el mismo sistema de atención (`Web → Nexo → clasifica consulta → respuesta / lead / reserva / derivación`), y es además la pieza que el puente Nexo→CRM necesita para tener una segunda fuente de leads más allá de las reservas (hoy el CRM solo puede sincronizar turnos, precisamente porque esta pieza no existe — ver `crm-fase4-nexo-leads.md`, sección "Limitaciones conocidas").

Otros elementos (ubicación, información importante, CTA de reserva más prominente, ficha de detalle por servicio/recurso) tienen valor desigual y deben evaluarse individualmente con el criterio de la sección 8 — no entran todos de una.

### 6.5 Nuevos tipos de negocio: evolución, no reescritura

Productos e inmobiliarias/catálogos son los dos casos que más claramente necesitan algo distinto de "servicio con horario". Ambos encajan en la misma abstracción de la sección 6.3:

- **Productos**: nombre, descripción, precio, imágenes, categoría, disponibilidad/variantes si corresponde. Listado con categorías → card → detalle → "comprar/consultar". Importante: esto **no** es "construir un ecommerce". Es la misma capacidad de listar/mostrar contenido que ya tiene Nexo, aplicada a un tipo de contenido nuevo. El día que un negocio necesite catálogo real con inventario, pedidos y checkout, eso es Commerce (sección 5) — no una funcionalidad que Nexo deba construir puertas adentro.
- **Propiedades / catálogos con mucha información visual**: el mismo patrón (listado → preview → detalle), con una ficha de detalle más rica (galería, características, ubicación) y una acción distinta ("consultar" o, a futuro, "agendar visita" — que en el fondo es una reserva, reusando el motor que ya existe).

No construimos ninguno de los dos todavía. La pregunta que importa no es "¿construimos productos o propiedades primero?" — es si, cuando llegue el momento, la abstracción de la sección 6.3 es lo suficientemente buena para que el caso nuevo se resuelva extendiendo, no reescribiendo.

### 6.6 Contenido estructurado: dónde termina Nexo y dónde empieza otra cosa

Al pensar en `Service | Resource | Product | Property | ...` conviene distinguir tres capas, para no mezclarlas:

1. **Entidades nativas de Nexo**, con lógica propia real (disponibilidad, reservas, señas) — hoy `Service` y `Resource`. Un futuro `Product` simple (sin inventario/checkout) podría sumarse acá si su única función es "mostrarse y generar una consulta/reserva".
2. **Contenido que simplemente se muestra** en el sitio — esto es, en el fondo, lo que la abstracción de la sección 6.3 resuelve de forma genérica (cards, listados, detalle), sin necesitar lógica de negocio propia por tipo.
3. **Objetos completamente dinámicos/configurables** (campos custom, tipos de contenido que el propio dueño define) — esto ya existe, pero **en el CRM** (`CustomFieldDefinition`/`CustomFieldValue`, ver `crm-fase1-diseno.md`), no en Nexo. Si algún negocio necesitara ese nivel de flexibilidad para su sitio público, la pregunta correcta es si esa necesidad pertenece al CRM (gestión interna) o si de verdad justifica traer esa complejidad a Nexo — no asumir automáticamente que sí.

No vamos a construir un "motor universal de entidades" dentro de Nexo. Sería exactamente el tipo de complejidad desproporcionada que el principio rector (sección 3) pide evitar, y ya tenemos un lugar natural (el CRM) para la configurabilidad genérica.

---

## 7. La web como una puerta más al mismo sistema de atención

Este es el cambio de enfoque más importante de este documento: dejar de pensar la web de Nexo como "una página que muestra información" y empezar a pensarla como **una de las interfaces por las que Nexo representa al negocio y genera interacciones** — al mismo nivel que WhatsApp, no como algo secundario.

```
                 NEGOCIO
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
         WEB    WHATSAPP   (futuro: INSTAGRAM, otros canales)
          │         │         │
          └─────────┼─────────┘
                    ↓
                  NEXO
                    ↓
             entiende intención
                    ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
     Consulta     Reserva      (futuro) Compra
        ↓           ↓           ↓
      Agente      Turnos     Commerce
```

Hoy, en la práctica, esto **ya es parcialmente cierto para WhatsApp** (la IA clasifica, responde, reserva, escala a un humano) y **no existe todavía para la web** (el visitante solo puede reservar; no puede "preguntar" y que eso entre al mismo sistema). El formulario de consultas (sección 6.4) es, conceptualmente, el primer paso concreto para que la web deje de ser un canal de un solo camino.

Esto conecta directamente con la visión de **omnicanalidad** que ya veníamos sosteniendo (hoy: Web + WhatsApp; a futuro: + Instagram + lo que haga falta, todo entendido por Nexo) y con la idea de **múltiples agentes especializados** (soporte, comercial, reservas) — no como un producto nuevo, sino como una profundización natural del "Empleado" de IA que Nexo ya tiene hoy (ver `docs/architecture/ai.md` e `inventario-actual.md`, sección de AI Studio): hoy es un único agente configurable; la evolución natural es que la clasificación de intención pueda derivar a distintos "perfiles" de agente según el tipo de consulta, reusando el mismo motor de personalidad/objetivos/restricciones que ya existe, no construyendo uno nuevo por agente.

No es necesario resolver "multiagente" para avanzar en la web — es importante que el diseño del formulario de consultas y de la clasificación de intención no cierre la puerta a que, más adelante, distintas consultas terminen en distintos agentes.

---

## 8. Criterio para decidir qué construir

Ninguna evolución de este documento se prioriza porque sea interesante. Para cada una, las preguntas que importan:

1. ¿Refuerza la identidad de Nexo (representar, atender, automatizar)?
2. ¿Hace que Nexo represente mejor al negocio real, con sus datos reales?
3. ¿Mejora la atención o la conversión de forma medible, no solo "en teoría"?
4. ¿Permite automatizar una acción concreta, o es solo mostrar más información?
5. ¿Aprovecha infraestructura que ya existe (motor de reservas, prompt de IA, sistema de leads) en vez de crear una paralela?
6. ¿Puede reutilizarse en otros rubros sin reescribirse?
7. ¿Cuánta complejidad real introduce, y quién la paga (mantenimiento, soporte, onboarding)?
8. ¿Estamos, sin darnos cuenta, empezando a construir un CRM, un ecommerce o un ERP adentro de Nexo?
9. ¿Esa necesidad estaría mejor resuelta en el CRM o en un futuro Commerce, aprovechando que ya existen/pueden existir como productos separados?

Si una funcionalidad agrega complejidad real pero poca profundidad a la propuesta de valor de Nexo — o si la respuesta a la pregunta 8 empieza a ser "un poco sí" — se marca como candidata a **postergar** o a **separar como producto propio**, no se construye "porque ya que estamos".

---

## 9. Objetivos a mediano plazo (reemplaza la lista anterior, que incluía "CRM integrado" como objetivo de Nexo — ya no aplica: el CRM es un producto separado, ver sección 5)

- Profundizar la presencia web según la sección 6 (formulario de consultas y WhatsApp contextual primero; listado/detalle genérico después; nuevos tipos de contenido recién cuando la abstracción esté probada).
- Fortalecer el puente Nexo → CRM más allá de las reservas (hoy solo sincroniza turnos; el formulario de consultas sería la segunda fuente real).
- Seguir profundizando WhatsApp e IA sobre bases sólidas — en particular, resolver la persistencia de conversaciones (hoy solo vive en memoria, ver `inventario-actual.md`, limitación real), que hoy bloquea explícitamente cualquier integración de WhatsApp con el CRM.
- Multi-sucursal y multi-operador siguen siendo objetivos reales de Nexo (no del CRM) el día que haya negocios reales que los necesiten — no antes.
- Recordatorios automáticos, confirmaciones de asistencia, reportes/analíticas más profundos (hoy las estadísticas del dueño no muestran ingresos ni conversión, ver `inventario-actual.md`) — todos evaluables con el criterio de la sección 8.

## 10. Principio de cierre

Cada decisión técnica o funcional sigue respondiendo, primero, a la pregunta original del proyecto:

> ¿Esto hace que el negocio pueda atender y convertir clientes más rápido y con menos esfuerzo?

Y ahora, además, a la pregunta que evita que Nexo pierda foco a medida que crece:

> ¿Esto profundiza lo que Nexo ya es, o está, sin decirlo, empezando a construir otro producto adentro de Nexo?

La ventaja de la familia de productos de Kodexa no está en que Nexo haga todo — está en que Nexo, el CRM y un futuro Commerce puedan trabajar juntos, compartiendo el contexto real del negocio, cada uno siendo profundo en lo suyo.
