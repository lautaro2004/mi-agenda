# Authentication

## Objetivo

Garantizar que únicamente usuarios autorizados puedan acceder al sistema.

---

# Conceptos

## Usuario

Representa una persona que administra uno o varios negocios.

---

## Sesión

Identifica al usuario autenticado.

Toda solicitud privada depende de una sesión válida.

---

## Business Activo

Cada usuario puede administrar varios negocios.

La sesión mantiene cuál es el negocio activo.

Toda consulta utiliza ese contexto.

---

# Permisos

Inicialmente existirán dos roles:

* Owner
* Admin

Roles adicionales podrán incorporarse después del MVP.

---

# Seguridad

Las contraseñas nunca se almacenan en texto plano.

Todas las contraseñas se almacenan mediante hash.

Nunca exponer información sensible al cliente.

---

# Flujo

Registro

↓

Crear Usuario

↓

Crear Business

↓

Crear Sesión

↓

Dashboard

---

Login

↓

Validar credenciales

↓

Crear sesión

↓

Dashboard

---

Logout

↓

Invalidar sesión

↓

Redirigir al Login

---

# Futuro

Después del MVP se evaluará:

* OAuth
* Magic Links
* MFA
* Equipos
* Invitaciones
