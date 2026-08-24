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

Para QA local existe la bandera `localStorage["sumi:dev-owner"] = "true"`.
Solo funciona en `import.meta.env.DEV` y en `localhost`/`127.0.0.1`; no debe
considerarse un permiso real ni reemplaza la prueba con `business_admins`.

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
- Crear contenido.

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
- Elegir el producto de `Hoy te recomendamos`.
- Marcar un unico producto como `Popular`.

MVP actual:

- Lista editable de productos.
- Busqueda local.
- Entrada al editor de producto desde el icono de lapiz.
- Acciones por fila para recomendar, marcar popular, ocultar/mostrar, editar y
  borrar.

Regla de destacado:

- `Hoy te recomendamos` se guarda por negocio en `business_menu_settings`.
- `Popular` tambien se guarda por negocio y solo puede haber uno activo.
- Si se marca otro producto como Popular, el anterior conserva sus likes reales
  pero pierde el badge de fuego.
- En el menu publico el contador se muestra abajo a la derecha con icono y
  numero; no debe mostrarse texto visible tipo `me gusta`.

## Editor de Producto

Funcion: editar un platillo sin tocar codigo.

Debe permitir:

- Nombre y descripcion por idioma.
- Presentaciones y precios.
- Marca/concepto interno.
- Categoria.
- Foto principal.
- Visibilidad en el menu.
- Estado agotado sin ocultar el producto.
- Vista previa.

IA dentro del editor:

- Traducir textos con `gpt-5-nano` desde el ultimo idioma editado.
- Autocompletar `es`, `en` y `ar` para nombre y descripcion.
- Cualquier mejora/generacion de imagen debe agregarse como una funcion nueva,
  con backend y storage definidos, antes de mostrar un boton en la UI.

Regla de UX:

- El owner edita un idioma principal y la IA ayuda con el resto.
- Las traducciones se guardan por producto y se usan en el menu publico segun el idioma activo.
- Dentro del editor, ningun cambio se aplica al producto real hasta tocar
  `Guardar`. Foto, traducciones, agotado, visibilidad, categoria y precios
  viven primero como borrador.
- Los controles avanzados no deben competir con los campos basicos.

## Crear Contenido y Biblioteca

`Crear contenido` prepara piezas de marketing a partir de un producto visible,
formato, tono e instrucciones del owner. Al tocar el boton principal, la pieza
genera una imagen para la publicacion y la muestra en la misma interfaz. El
resultado se guarda automaticamente en Biblioteca cuando Kie.ai devuelve una
imagen real.

La generacion de imagen se resuelve con `generate-content-image`, una Edge
Function de Supabase que llama a Kie.ai con la API key guardada como secreto
`KIE_API_KEY`. Usa `gpt-image-2-image-to-image` cuando hay foto del producto o
referencia manual, y `gpt-image-2-text-to-image` como fallback si no hay una
referencia visual valida. Si la funcion o la key todavia no estan configuradas,
la app muestra un error controlado y no guarda la foto original como si fuera
una generacion.

La seccion permite subir dos referencias distintas:

- `Subir imagen`: reemplaza la imagen base del producto para esa publicacion.
- `Subir fondo`: aporta ambiente, superficie, luz o contexto. La IA debe usarlo
  como fondo/escena y conservar el producto como protagonista.

Por defecto no hay tono avanzado seleccionado. Los chips `Tono casual`,
`Tono elegante`, `Tono divertido`, `Antojador` y `Para fin de semana` son
opcionales; solo se aplican si el owner los toca.

Si Kie.ai tarda mas de lo esperado, la tarea queda guardada localmente por
`taskId`. Al volver a `Crear contenido` o `Biblioteca`, la app intenta finalizar
esa tarea con la Edge Function y guardar la imagen generada en Storage. Esto
evita que una imagen creada correctamente en Kie.ai se pierda por un timeout de
polling en la interfaz.

Cada negocio tiene 150 creditos mensuales. Cada generacion usa 2 creditos. Al
cambiar el mes, el saldo vuelve a 150 y no se acumula.

Regla visual para publicaciones:

- La comida debe verse rica, realista y protagonista.
- La IA no debe cambiar el producto del menu: no modificar ingredientes,
  forma, toppings, cantidad, textura, plato ni presentacion del alimento.
- Sobre el producto solo se permiten ajustes fotograficos: enfoque,
  iluminacion, nitidez, sombras, color natural, recorte o perspectiva leve.
- Los badges de promocion, precio, direccion o CTA deben ser simples,
  minimalistas y de poco texto.
- El badge no debe tapar el producto ni imponer un estilo minimalista sobre la
  foto del producto.
- El titulo del producto debe aparecer arriba del producto con estilo script
  tipo `New Berolina`.
- Si el brief incluye `2x1`, descuentos, tiempo limitado o stock, eso debe
  convertirse en badges cortos de alta jerarquia, no en parrafos largos.

`Biblioteca` no debe listar fotos o productos del menu. Debe mostrar solamente
contenido creado desde `Crear contenido`, con fecha, formato, imagen generada,
accion para descargar imagen y accion para copiar el texto. Los nuevos assets
viven en Supabase Storage y en la tabla `generated_content_assets`. Registros
viejos de `localStorage` pueden mostrarse como legacy, pero no deben parecer
generaciones IA verificadas.

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

### Flujo auditado de canjes

Los canjes siguen una máquina de estados estricta: `requested -> approved -> redeemed`.
Desde `requested` o `approved` sólo `owner`/`manager` pueden pasar a `cancelled`;
un `employee` puede aprobar una solicitud y marcar como entregado un canje aprobado,
pero nunca cancelar ni editar libremente el registro. La RPC de transición exige el
estado esperado (`expected_status`) y devuelve una operación idempotente si el mismo
estado ya fue aplicado; así se evita entregar un canje solicitado directamente o
pisar una acción concurrente.

La cola de empleados se obtiene mediante `get_staff_redemption_queue`, una RPC separada
que expone únicamente cliente, premio, puntos, estado y fechas necesarias para operar.
La interfaz exige confirmación explícita con cliente, premio, puntos y acción, y bloquea
el doble clic mientras la transición está en curso.
El contexto enviado al solicitar un canje queda limitado por trigger a 8 KB para evitar
que `request_context` se convierta en un canal de carga arbitraria.

Cada alta y transición escribe una fila inmutable en `reward_redemption_events` con
estado anterior/nuevo, actor, rol, etiqueta y fecha exacta. La actividad del owner
muestra esa línea de tiempo; registros históricos sin actor se presentan como
`No disponible` y no se inventa una identidad retroactiva. La tabla no permite
`UPDATE` ni `DELETE` mediante su trigger de protección.
La retención operativa recomendada es conservar el historial durante siete años;
cualquier archivado debe ser fuera de la tabla mediante un proceso controlado y
documentado. El flujo no borra canjes: los cierra con `cancelled` y conserva el
registro de transición.

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
