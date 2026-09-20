# Nexo

Nexo (anteriormente "Mi Agenda") es una plataforma SaaS que automatiza la gestión de reservas mediante WhatsApp e Inteligencia Artificial.

El objetivo es permitir que cualquier negocio pueda comenzar a recibir y administrar turnos en pocos minutos, sin conocimientos técnicos.

---

## Estado del proyecto

**Versión:** en producción, con negocios reales operando.

El MVP original ya fue superado: además de reservas por WhatsApp, el producto incluye sitio público, AI Studio, suscripciones pagas vía Mercado Pago y un puente con el CRM (Nodo, producto separado). Ver `docs/product/inventario-actual.md` para el detalle verificado de qué existe hoy.

---

## Stack

* Next.js 15
* Prisma ORM
* PostgreSQL
* Google Gemini
* Baileys
* Mercado Pago
* Tailwind CSS
* shadcn/ui

---

## Objetivos del MVP

* Registro de usuarios.
* Inicio de sesión.
* Configuración del negocio.
* Configuración de servicios.
* Configuración de horarios.
* Conexión de WhatsApp.
* Automatización mediante IA.
* Gestión de reservas.
* Dashboard administrativo.
* Suscripción mediante Mercado Pago.

---

## Documentación

Toda la documentación del proyecto se encuentra en la carpeta `docs`.

### Producto

* Vision
* Roadmap
* Backlog
* MVP
* Inventario actual (fotografía verificada de qué existe hoy en el código)

### Arquitectura

* Overview
* Database
* API
* Auth
* AI
* WhatsApp
* Deployment

### Decisiones técnicas

Architecture Decision Records (ADR).

---

## Filosofía

La prioridad del proyecto es construir un producto simple para el usuario, pero con una arquitectura sólida que permita escalar a miles de negocios sin necesidad de reescrituras importantes.