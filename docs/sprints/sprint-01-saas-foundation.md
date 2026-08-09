# Sprint 01 - SaaS Foundation

## Objetivo

Implementar la infraestructura mínima de autenticación para convertir Mi Agenda en un SaaS.

## Alcance

* Implementar Better Auth.
* Crear modelos de autenticación (User, Session y Membership).
* Asociar Business con User mediante Membership.
* Implementar registro, login y logout.
* Proteger el dashboard mediante autenticación.
* Eliminar el uso de localStorage para autenticación.
* Mantener IA, WhatsApp y reservas sin modificaciones.

## Definition of Done

* Registro funcionando.
* Login funcionando.
* Logout funcionando.
* Dashboard protegido.
* Business asociado al usuario autenticado.
* Build y lint sin errores.

## Restricciones

* No modificar IA.
* No modificar WhatsApp.
* No modificar lógica de reservas.
* Reutilizar el código existente siempre que sea posible.
* Detenerse únicamente si aparece un bloqueo técnico o una decisión de arquitectura no contemplada.

## Entregable

Mi Agenda debe permitir que un usuario:

1. Cree una cuenta.
2. Inicie sesión.
3. Acceda al Dashboard.
4. Cierre sesión.

Sin depender de localStorage y con la base preparada para múltiples negocios.