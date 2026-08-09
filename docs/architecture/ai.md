# AI Architecture

## Objetivo

La Inteligencia Artificial interpreta el lenguaje natural y genera propuestas.

La IA no ejecuta acciones directamente.

Toda acción debe ser validada por la aplicación.

---

# Responsabilidades

La IA puede:

* Clasificar mensajes.
* Detectar intención.
* Extraer entidades.
* Generar respuestas.
* Resumir conversaciones.
* Sugerir horarios.

---

# La IA NO puede

* Escribir en la base de datos.
* Crear turnos.
* Modificar horarios.
* Cancelar reservas.
* Cobrar pagos.
* Cambiar configuraciones.

Siempre devuelve una propuesta.

La aplicación decide si ejecutarla.

---

# Flujo

WhatsApp

↓

Conversation

↓

Context Builder

↓

Gemini

↓

Structured Response

↓

Application Service

↓

Validación

↓

Acción

---

# Contexto

La IA nunca consulta la base de datos.

Recibe un contexto preparado por la aplicación.

Ejemplo:

* negocio
* horarios
* servicios
* FAQs
* historial
* disponibilidad

---

# Prompts

Los prompts deben:

* ser reutilizables
* ser pequeños
* ser modulares

No generar prompts enormes.

Separar:

* System Prompt
* Context
* User Message

---

# Respuestas

La IA siempre debe responder utilizando estructuras tipadas.

Nunca texto libre cuando la respuesta represente una acción.

Ejemplo:

Intent

↓

BOOK_APPOINTMENT

En lugar de:

"Creo que el usuario quiere reservar."

---

# Logging

Toda interacción debe registrar:

* modelo utilizado
* duración
* tokens
* resultado
* errores

Sin almacenar información sensible innecesaria.

---

# Futuro

Preparar la arquitectura para incorporar:

* RAG
* Memoria
* Múltiples modelos
* Embeddings
* Cache
