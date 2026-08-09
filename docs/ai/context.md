# Mi Agenda - Contexto del Proyecto

## Producto

Mi Agenda es un SaaS para automatizar reservas mediante WhatsApp utilizando Inteligencia Artificial.

El objetivo es que cualquier negocio pueda comenzar a atender clientes en menos de 10 minutos.

---

## Stack

Frontend

* Next.js 15

Backend

* Next.js Route Handlers

ORM

* Prisma

Database

* PostgreSQL

AI

* Google Gemini

WhatsApp

* Baileys

Payments

* Mercado Pago

---

## Arquitectura

UI

↓

API Routes

↓

Services

↓

Repositories

↓

Prisma

↓

PostgreSQL

---

## Principios

* PostgreSQL es la única fuente de verdad.
* No utilizar localStorage para datos persistentes.
* Toda funcionalidad debe ser multi-tenant.
* React nunca consulta Prisma.
* Toda lógica del negocio vive en Services.
* Los Repositories son responsables del acceso a datos.
* La IA propone acciones; la aplicación decide.
* WhatsApp no contiene lógica del negocio.

---

## Objetivo actual

Completar el MVP.

Consultar docs/product/roadmap.md para conocer el estado general del proyecto.
