# Base de Datos

## Principios

La base de datos representa la única fuente de verdad del sistema.

Todo dato persistente debe almacenarse aquí.

---

# Entidades principales

## User

Representa una cuenta de acceso.

Puede administrar uno o varios negocios.

---

## Business

Representa un negocio.

Todas las entidades funcionales pertenecen a un Business.

---

## Service

Servicio ofrecido por el negocio.

Ejemplo:

* Corte
* Consulta
* Reparación

---

## Schedule

Define disponibilidad.

---

## FAQ

Información utilizada por la IA para responder consultas.

---

## Appointment

Turnos del negocio.

---

## Customer

Clientes que interactúan mediante WhatsApp.

---

## Conversation

Historial de conversaciones.

---

## WhatsAppConnection

Estado de conexión con WhatsApp.

---

## Subscription

Información comercial.

Plan contratado.

Estado.

Fecha de renovación.

---

# Relaciones

User

↓

Business

↓

Services

↓

Appointments

↓

Customers

↓

Conversations

---

Todas las entidades funcionales deben depender de Business.
