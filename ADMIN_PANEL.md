# Panel de Admin del Negocio

El panel de admin es privado para cuentas `owner`. No reemplaza el catalogo
publico ni el perfil del cliente: es la herramienta diaria del negocio para
operar lealtad, menu y contenido.

La regla de diseno del panel es simple: mostrar primero lo que el dueno necesita
resolver hoy y dejar las configuraciones profundas en pantallas secundarias.

## Roles

- `owner`: dueno o responsable del negocio. Puede ver clientes, cuentas,
  historial, canjes y operaciones del `business_id` donde tiene permiso.
- `customer`: cliente final. Puede ver solo su propio perfil, puntos, QR,
  historial y canjes.

`owner` vive en `business_admins`. `customer` se deriva de
`customer_profiles`. No debe existir un tercer rol para el MVP.

## Navegacion Simplificada

La navegacion principal queda en cinco secciones:

- Inicio
- Clientes
- Mi menu
- Premios
- Ajustes

La generacion con IA no queda como seccion principal. Aparece como accion
contextual dentro de Inicio o dentro del editor de producto, porque para el
dueno es una tarea, no un destino.

## Inicio

Funcion: tablero operativo del dia.

Debe mostrar:

- Resumen corto del negocio.
- Productos visibles y productos ocultos/agostados.
- Premios activos y canjes pendientes.
- Producto recomendado o mas conveniente para destacar.
- Atajos a las tareas frecuentes.

Acciones principales:

- Cargar consumo por QR.
- Revisar canjes.
- Editar menu.
- Crear contenido con IA.

Diseno recomendado:

- Maximo tres metricas visibles arriba.
- Cuatro acciones grandes con icono, titulo y descripcion corta.
- Una sugerencia del dia, con una unica accion.

## Clientes

Funcion: centro de control de clientes y cuentas de lealtad.

Debe permitir:

- Buscar por nombre, Gmail o alias visible del QR.
- Abrir ficha de cliente.
- Ver puntos, nivel, QR publico, historial y canjes.
- Cargar consumo escaneando o pegando el QR.
- Hacer ajustes manuales con motivo obligatorio.

MVP visual:

- Lista simple de clientes.
- Ficha lateral o modal con los datos clave.
- Boton primario: `Cargar consumo`.
- Historial con movimientos recientes.

Seguridad:

- El cliente nunca se acredita puntos desde su frontend.
- El owner solo ve clientes del mismo `business_id`.

## Mi Menu

Funcion: mantener el catalogo publico.

Debe permitir:

- Buscar por nombre, categoria o ingrediente.
- Ver productos con foto, categoria, marca, precio y estado.
- Abrir el editor de producto.
- Crear producto nuevo.
- Ocultar/agotar producto sin borrarlo.

MVP actual:

- Lista editable de productos.
- Busqueda local.
- Entrada al editor de producto.

## Editor de Producto

Funcion: editar un platillo sin tocar codigo.

Debe permitir:

- Nombre y descripcion por idioma.
- Presentaciones y precios.
- Marca/concepto interno.
- Categoria.
- Foto principal.
- Visibilidad en el menu.
- Vista previa.

IA dentro del editor:

- Traducir textos.
- Mejorar copy.
- Generar o mejorar imagen del producto.

Regla de UX:

- El owner edita un idioma principal y la IA ayuda con el resto.
- Los controles avanzados no deben competir con los campos basicos.

## Premios

Funcion: administrar el catalogo de beneficios y canjes.

Debe permitir:

- Crear premios.
- Definir costo en puntos.
- Activar/desactivar premios.
- Revisar solicitudes de canje.
- Marcar canjes como `approved`, `redeemed` o `cancelled`.

Fase siguiente:

- Stock limitado de premios.
- Vencimientos.
- Premios por nivel.
- Reglas por sucursal o marca interna.

## Ajustes

Funcion: configuracion estable del negocio.

Debe incluir:

- Nombre del negocio.
- Logo, iniciales y colores.
- Idiomas y banderas.
- Horarios, direccion, telefono y redes.
- Dominio publicado.
- Supabase del cliente.
- Resend/remitente de emails.
- Owners autorizados.

Regla:

- Cambios de seguridad, owners y credenciales deben hacerse con cuidado y quedar
  documentados en el runbook del cliente.

## Seguridad y RLS

- RLS debe estar activo en tablas privadas.
- Owners solo operan el `business_id` donde tienen membresia.
- Customers solo leen sus propios datos.
- `point_events` se crea desde flujos owner/backend, no desde cliente.
- `public_qr_id` identifica al cliente, pero no acredita puntos por si solo.

## Estado Actual del MVP

Implementado:

- Acceso al panel desde el perfil si la cuenta es `owner`.
- Inicio simplificado.
- Vista `Clientes` con lectura owner de perfiles, puntos, nivel, alias QR,
  movimientos y canjes pendientes.
- Vista `Mi menu`.
- Editor visual de producto.
- Vista `Premios` con catalogo configurado y canjes recientes.
- Vista `Ajustes` con resumen de negocio, idiomas, Supabase, dominio, email y
  permisos.
- RLS base para owner/customer.

Preparado para siguiente fase:

- Carga de consumo por QR.
- Acciones reales para aprobar/entregar/cancelar canjes.
- Premios administrables desde UI.
- Ajustes editables desde UI.
- Generacion IA conectada a backend.
