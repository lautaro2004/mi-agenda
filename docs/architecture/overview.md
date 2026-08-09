# Arquitectura General

## Objetivo

Mi Agenda está diseñado como un SaaS multi-tenant construido sobre una arquitectura modular.

Cada módulo posee una responsabilidad específica y puede evolucionar de manera independiente.

---

# Componentes principales

## Frontend

Aplicación desarrollada con Next.js App Router.

Responsabilidades:

* Interfaces
* Formularios
* Dashboard
* Experiencia del usuario

---

## API

Route Handlers de Next.js.

Responsabilidades:

* Validación
* Autenticación
* Coordinación de servicios

No contienen lógica de negocio.

---

## Services

Representan el núcleo del sistema.

Toda regla de negocio debe implementarse aquí.

Ejemplos:

* Gestión de reservas
* Usuarios
* Negocios
* Servicios
* IA
* WhatsApp

---

## Base de Datos

PostgreSQL mediante Prisma.

Representa la única fuente de verdad.

---

## Inteligencia Artificial

Google Gemini.

Se utiliza únicamente para:

* clasificación
* comprensión
* generación de respuestas

No toma decisiones de negocio.

---

## WhatsApp

Baileys.

Responsable de mantener la conexión con WhatsApp Web.

---

## Pagos

Mercado Pago.

Gestiona suscripciones y estado comercial del negocio.

---

# Flujo general

Usuario

↓

Frontend

↓

API

↓

Services

↓

Prisma

↓

PostgreSQL

↓

Respuesta

---

Los servicios externos (Gemini, Baileys y Mercado Pago) interactúan únicamente a través de la capa de Services.
