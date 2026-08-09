# WhatsApp Architecture

## Objetivo

Administrar de forma confiable la conexión entre Mi Agenda y WhatsApp.

La pérdida de una instancia del servidor no debe provocar la pérdida de la sesión.

---

# Responsabilidades

El módulo de WhatsApp administra:

* conexión
* QR
* autenticación
* envío
* recepción
* reconexión
* estado

No contiene reglas del negocio.

---

# Flujo

Mensaje recibido

↓

Baileys

↓

WhatsApp Module

↓

Conversation Module

↓

AI Module

↓

Application Service

↓

Respuesta

↓

WhatsApp Module

↓

Cliente

---

# Persistencia

La autenticación debe persistirse.

No depender exclusivamente de memoria.

No depender del filesystem.

---

# Estados

DISCONNECTED

CONNECTING

QR_REQUIRED

CONNECTED

RECONNECTING

ERROR

---

# Reconexión

El sistema debe intentar recuperar automáticamente la sesión.

La reconexión no debe requerir escanear nuevamente el QR salvo que la sesión haya expirado.

---

# Escalabilidad

Cada Business posee una conexión independiente.

Nunca compartir sesiones entre negocios.

Preparar la arquitectura para múltiples workers si fuera necesario.

---

# Logging

Registrar:

* conexión
* desconexión
* errores
* duración
* último heartbeat

---

# Futuro

Preparar el módulo para soportar otros proveedores además de Baileys si fuera necesario.
