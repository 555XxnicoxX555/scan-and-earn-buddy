# Panel de Admin del Negocio

El panel de admin es privado para el dueño/equipo del negocio. No reemplaza al
catalogo publico ni al perfil del cliente: sirve para operar el programa de
lealtad y mantener datos del negocio.

## Roles

- `owner`: dueño del negocio. Puede ver clientes, cuentas, historial, canjes y
  actualizar saldos/canjes desde herramientas autorizadas.
- `customer`: cliente del negocio. Puede ver su propio perfil, puntos, QR,
  historial y canjes.

`owner` se guarda en `business_admins`, vinculando `auth.users.id` con
`business_id`. `customer` se deriva de `customer_profiles`, por lo que no
necesita una tabla de roles aparte.

## MVP del Panel

El dueño del negocio deberia poder:

- Ver resumen del negocio: clientes registrados, puntos emitidos, puntos
  canjeados, premios pendientes y actividad reciente.
- Buscar clientes por nombre, email o alias visible del QR.
- Abrir ficha de cliente con datos basicos, puntos, nivel, QR publico,
  historial y canjes.
- Acreditar consumo escaneando o pegando el QR del cliente.
- Cargar puntos manualmente con motivo obligatorio.
- Restar puntos por canje, ajuste o expiracion con motivo obligatorio.
- Ver solicitudes de premios y marcarlas como `approved`, `redeemed`,
  `cancelled`.
- Editar premios del catalogo de lealtad en una fase posterior.

## Seguridad

- El cliente no puede acreditarse puntos desde el frontend.
- El QR identifica al cliente, no acredita puntos por si solo.
- Los admins solo ven datos del `business_id` donde tienen membresia.
- RLS permite a owners leer clientes/cuentas/eventos/canjes del negocio.
- RLS permite a owners insertar `point_events`, actualizar `loyalty_accounts` y
  actualizar `reward_redemptions`.
- Crear o quitar owners debe hacerse con credenciales administrativas o un panel
  de owner endurecido; no debe estar disponible para customers.

## Flujo Recomendado Para Acreditar Consumo

1. El cliente muestra su QR de cliente recurrente.
2. El empleado/admin lo escanea desde el panel.
3. El panel resuelve el `public_qr_id` a una cuenta loyalty.
4. El empleado carga importe, productos o puntos.
5. Backend inserta un `point_events` con tipo `purchase`.
6. Backend actualiza `loyalty_accounts.points_balance` y `tier`.
7. El cliente ve el saldo actualizado al refrescar o iniciar sesion.

## Pendiente de UI

- Crear ruta/vista privada de admin.
- Detectar si la sesion actual tiene fila en `business_admins`.
- Separar navegacion cliente/admin.
- Agregar acciones con confirmacion para ajustes de puntos.
- Agregar estados vacios, loading, errores y auditoria visible.
- Agregar listado completo/paginado de clientes e historial.
