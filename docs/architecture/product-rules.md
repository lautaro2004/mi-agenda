# Product Rules

## Objetivo

Este documento define las reglas fundamentales de arquitectura del proyecto.

Estas reglas tienen prioridad sobre cualquier implementación puntual.

Si una nueva funcionalidad entra en conflicto con estas reglas, debe revisarse el diseño antes de implementarse.

---

# 1. Fuente de verdad

PostgreSQL es la única fuente de verdad del sistema.

No se utilizará localStorage para almacenar información persistente del negocio.

No se utilizará memoria del servidor para almacenar información crítica.

---

# 2. Multi Tenant

Todo dato del sistema pertenece a un Business.

No existen datos globales salvo configuraciones internas del sistema.

Toda consulta deberá filtrar por businessId.

---

# 3. Usuarios

Un usuario puede administrar uno o varios negocios.

Toda autenticación se realiza mediante una cuenta de usuario.

Nunca se accederá directamente a un negocio sin validar previamente el usuario autenticado.

---

# 4. Arquitectura

Toda lógica de negocio debe vivir en Services.

Las APIs únicamente coordinan la solicitud.

Los componentes React nunca acceden directamente a Prisma.

---

# 5. Persistencia

Toda configuración debe persistirse en PostgreSQL.

Incluye:

* negocio
* servicios
* horarios
* FAQs
* configuración IA
* preferencias
* suscripciones

---

# 6. APIs

Toda API debe:

* validar datos
* devolver errores consistentes
* utilizar tipos compartidos
* registrar errores relevantes

---

# 7. Inteligencia Artificial

La IA nunca accede directamente a la base de datos.

Siempre recibe contexto preparado por la aplicación.

La IA no debe contener lógica de negocio.

La aplicación es quien toma las decisiones.

---

# 8. WhatsApp

Cada negocio posee una única conexión activa.

El estado de conexión debe persistirse.

La pérdida de una instancia del servidor no debe provocar pérdida de sesión.

---

# 9. Seguridad

Nunca almacenar contraseñas en texto plano.

Nunca exponer secretos al cliente.

Toda operación sensible requiere autenticación.

---

# 10. Calidad

Todo código nuevo debe:

* ser reutilizable
* ser modular
* ser tipado
* ser fácilmente testeable
* mantener compatibilidad con la arquitectura existente

---

# 11. Documentación

Toda modificación importante debe reflejarse en la documentación correspondiente.

La documentación forma parte del producto.
