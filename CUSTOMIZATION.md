# Guia de personalizacion y replica

Este proyecto esta pensado como una app base replicable para varios negocios.
La regla principal es simple: el motor de la app vive en `app.js`, `styles.css`
e `index.html`; los datos de cada negocio viven en `businesses/<negocio>/`.

Para una implementacion completa de cliente con Supabase, Resend, Auth Hooks,
deploy y pruebas, leer primero:

```text
CLIENT_IMPLEMENTATION_RUNBOOK.md
```

## Que editar para un nuevo negocio

Para crear una nueva version:

1. Copia `businesses/sumi/` a una nueva carpeta, por ejemplo:

   ```txt
   businesses/cafe-nuevo/
   ```

2. Edita `businesses/cafe-nuevo/config.js`.

3. Cambia en `index.html` la linea de configuracion:

   ```html
   <script src="businesses/sumi/config.js"></script>
   ```

   por:

   ```html
   <script src="businesses/cafe-nuevo/config.js"></script>
   ```

4. Ejecuta la app localmente:

   ```bash
   npm run dev
   ```

5. Genera version de produccion:

   ```bash
   npm run build
   ```

## Mapa de archivos de la plantilla

Esta app funciona como plantilla y tambien como lugar de pruebas. Antes de
adaptarla para un negocio, separar mentalmente estos niveles:

- `businesses/<negocio>/config.js`: datos editables del negocio. Es el archivo
  principal para marca, menu, categorias, traducciones, premios y textos.
- `business.config.example.json`: esquema maestro recomendado para recolectar
  marca, menu, premios, reglas de puntos, QRs e idiomas antes de adaptar.
  `brand.colors.primary`, `brand.colors.ink` y `brand.colors.cream` se aplican
  a las variables CSS principales de la app y tambien al QR estilo marca.
- `docs/client-onboarding-form.md`: formulario para el negocio. La llamada se
  reserva para identidad visual y decisiones subjetivas.
- `docs/setup-client.md`: pasos para crear una instancia real, aplicar
  migraciones, seeds, variables y dominio.
- `docs/codex-client-prompt.md`: prompt operativo para pedir una adaptacion
  completa sin adivinar archivos.
- `assets/menu/`: imagenes locales de productos. Cada archivo debe coincidir
  con el `id` del producto cuando se usa el helper `productImage(id)`.
- `index.html`: estructura base, iconos SVG, carga de la config activa y
  superficies principales de la app.
- `styles.css`: sistema visual compartido. Tocar solo si la mejora debe quedar
  para toda la plantilla.
- `app.js`: comportamiento compartido: router, menu publico, panel admin,
  editor, traducciones, carga de fotos, persistencia local y Supabase.
- `supabase/functions/`: Edge Functions compartidas, por ejemplo emails y
  traduccion IA.
- `supabase/migrations/`: tablas y politicas para clientes, puntos, premios,
  QRs, contenido y owners.
- `supabase/seed.client.sql` y `supabase/seed.demo.sql`: semillas separadas
  para clientes reales y pruebas internas.
- `ADMIN_PANEL.md`, `SUPABASE_SETUP.md` y este archivo: documentacion viva de
  la plantilla.

Regla practica: si cambia contenido de un negocio, editar `businesses/` y
`assets/`. Si cambia una capacidad reusable para todos los negocios, editar
`app.js`, `styles.css`, `index.html` y documentarlo.

## Flujo de adaptacion de la plantilla

Esta repo debe servir para dos cosas al mismo tiempo:

- Plantilla base: funcionalidades compartidas que se reutilizan en cada negocio.
- Lugar de pruebas: negocio demo `sumi` donde se validan cambios antes de
  replicarlos.

Para adaptar un negocio sin romper la plantilla:

1. Mantener `businesses/sumi/` como demo y banco de pruebas.
2. Copiar `business.config.example.json` como `business.config.json`.
3. Completar marca, contacto, menu, premios, QRs, creditos IA y roles iniciales
   en ese JSON. `operations.adminOwnerEmail` genera el owner y
   `operations.employeeEmails` genera empleados de caja cuando esos usuarios ya
   existen en Auth.
4. Ejecutar `npm run prepare:client -- --config business.config.json --dry-run`.
5. Si el resumen es correcto, ejecutar
   `npm run prepare:client -- --config business.config.json`.
6. Revisar `businesses/<cliente>/config.js` y
   `supabase/seed.client.generated.sql` antes de publicar o correr SQL.
7. Guardar fotos finales en `assets/menu/` con nombres estables.
8. Cambiar temporalmente el `<script src="businesses/.../config.js">` de
   `index.html` para probar ese cliente.
9. Ejecutar `npm run dev` durante ajustes y `npm run build` antes de entregar.
10. Si durante un cliente aparece una mejora reusable, implementarla en la
    plantilla base y documentarla aqui.

Donde editar segun el tipo de cambio:

- Nuevo producto, precio, categoria o premio: `businesses/<cliente>/config.js`.
- Foto final versionada: `assets/menu/<id-del-producto>.<ext>`.
- Texto de navegacion, CTA o mensajes por idioma: `labels` dentro de
  `businesses/<cliente>/config.js`.
- Marca visual especifica del cliente: primero `businesses/<cliente>/config.js`;
  tocar `styles.css` solo si la plantilla necesita soportar un nuevo patron.
- Nueva seccion o comportamiento comun del panel: `index.html`, `styles.css`,
  `app.js` y documentacion.
- Nueva tabla, politica o backend compartido: `supabase/migrations/`,
  `supabase/functions/` y `SUPABASE_SETUP.md`.

No usar el editor admin como fuente final unica para entregar un cliente. El
editor guarda cambios en `localStorage` para pruebas rapidas. Antes de entregar
un negocio nuevo, pasar los cambios definitivos a `businesses/<cliente>/config.js`
o a la capa backend que se decida para ese cliente.

## Que contiene la config

En `businesses/<negocio>/config.js` se editan:

- `businessId`: identificador interno del negocio.
- `publicAppUrl` / `VITE_PUBLIC_APP_URL`: URL publica raiz del negocio para
  emails y QRs, por ejemplo `https://sumi.business/` o `https://tu-dominio.com/`.
  En runtime, `VITE_PUBLIC_APP_URL` tiene prioridad; si no existe, la app usa
  `businessConfig.publicAppUrl` y luego `businessConfig.qr.defaultTarget`.
- `appTitle`: titulo del navegador.
- `defaultLang`: idioma inicial.
- `defaultBrand`: marca/concepto inicial.
- `defaultCategory`: categoria inicial.
- `defaultDetailId`: producto inicial para el detalle.
- `initialPoints`: puntos de ejemplo para la tarjeta.
- `languages`: idiomas disponibles, texto del boton, direccion y bandera.
- `recommendedByBrand`: producto recomendado por marca.
- `brandSwitcher`: marcas o conceptos visibles en el selector.
- `landing`: textos de la pantalla inicial.
- `admin`: textos del panel lateral.
- `categoryOrder`: orden de categorias por marca.
- `labels`: textos generales por idioma.
- `categoryLabels`: traducciones de categorias.
- `nameTranslations`: traducciones de nombres.
- `descriptionTranslations`: traducciones de descripciones.
- `menuItems`: productos, precios, categorias y fotos.
- `rewardCatalog`: premios del sistema de puntos. Cada premio puede tener
  `imageUrl`; si Supabase esta activo, el panel owner guarda ese valor como
  `business_rewards.image_url`.
- Los premios pueden definir `stock`, `validUntil`, `active` y `minTier`.
  Supabase valida esas reglas al aprobar el canje, no solo en la interfaz.

`recommendedByBrand` es el fallback versionado de la plantilla. En produccion,
el owner puede cambiar `Producto destacado` desde el panel admin; ese override
se guarda en Supabase (`business_menu_settings`) sin editar `config.js`.

El producto `Popular` funciona igual: la plantilla puede inferirlo por likes,
pero el owner puede fijarlo desde `#/admin/menu`. Solo hay un Popular activo por
negocio y el resto de productos muestran contador normal.

## Navegacion por secciones

La plantilla usa hash routes para no depender de rewrites del servidor:

- `#/menu`: menu publico.
- `#/menu/:dishId`: detalle publico de producto.
- `#/admin`: inicio del panel.
- `#/admin/menu`: lista editable del menu.
- `#/admin/menu/:dishId/edit`: editor de producto.
- `#/admin/menu/:dishId/preview`: vista previa admin del producto.
- `#/admin/customers`, `#/admin/content`, `#/admin/library`,
  `#/admin/rewards`, `#/admin/settings`: secciones internas.

El router vive en `app.js`:

- `navigate(route, params)`: cambia la URL.
- `parseRoute()`: interpreta el hash actual.
- `renderRoute()`: decide que superficie se muestra.
- `showPublicMenu()` y `showPublicDetail(dishId)`: menu cliente.
- `showAdminSection(view)`, `showAdminEditor(dishId)` y
  `showAdminPreview(dishId)`: panel admin.

No conviene abrir pantallas agregando clases manualmente desde botones nuevos.
La regla es: un click navega con `navigate(...)` y `renderRoute()` decide que se
ve. Esto evita bugs de "volver" entre preview, editor y menu.

## Dominio publico y QR del menu

Cada negocio debe tener definida una URL publica raiz. Para Sumi es:

```txt
https://sumi.business/
```

Para otros clientes usar su dominio o subdominio, por ejemplo:

```txt
https://tu-dominio.com/
```

La variable recomendada es:

```env
VITE_PUBLIC_APP_URL="https://sumi.business"
```

El QR rapido del Inicio apunta a esa URL raiz, no a una ruta interna como
`#/menu`. Esto permite imprimir QRs mas durables: si despues cambia la ruta del
menu, el dominio sigue siendo valido y la app decide que pantalla mostrar.

La seccion `QRs` del panel admin genera piezas para mesa, mostrador, redes o
flyer. El owner elige objetivo, tono, estilo visual, color principal y texto
principal, previsualiza el poster y puede descargarlo como PNG o PDF listo para
imprimir. Los defaults viven en `businessConfig.qr` para que cada negocio pueda
salir con su tematica inicial sin tocar `app.js`.

## QR, staff y carga de consumo

La plantilla diferencia tres experiencias:

- Cliente: ve puntos, premios y su QR de fidelidad.
- `employee`: no ve la tarjeta de puntos; puede escanear QR y cargar consumos.
- `owner`: puede cargar consumos y tambien administrar menu, clientes, premios,
  contenido, ajustes y estadisticas.

El QR del cliente usa `public_qr_id` como identificador publico. El payload
incluye `qrId` y el QR se renderiza con correccion alta para permitir una marca
al centro (`businessConfig.admin.brandMark` o iniciales del negocio). Para
negocios futuros, mantener el logo del centro simple, con fondo claro y sin
ocupar demasiado area, para no afectar la lectura.

El flujo de caja es:

1. El staff elige entre `Escanear QR de cliente` o `Cargar consumo` manual.
2. En modo QR, el cliente muestra su QR y la app lo resuelve con
   `lookup_loyalty_customer_by_qr`.
3. En modo manual, el staff busca al cliente por nombre, email o QR.
4. La pantalla de escaneo/busqueda se repliega y queda la carga de consumo.
5. El empleado ingresa el monto total.
6. Opcionalmente carga categoria, nota interna y productos del catalogo visual.
7. Si un producto tiene una sola presentacion se suma directo.
8. Si tiene varias, aparece un selector contextual debajo de la tarjeta.
9. El empleado confirma con `Registrar consumo`.

Los productos seleccionados son auditoria simple, no POS. El precio de cada
presentacion no afecta los puntos: la unica fuente para puntos es el monto total
ingresado por el empleado. El payload de productos se guarda como:

```js
{ dishId, name, presentationName, quantity }
```

El registro se guarda en `point_events` mediante la RPC
`record_customer_consumption_v2`. Esa fila conserva:

- `purchase_total`: monto total cargado.
- `purchase_items`: productos y cantidades.
- `purchase_category`: categoria operativa del consumo, manual o inferida por
  los productos.
- `purchase_note`: observacion interna breve, por ejemplo mesa, aclaracion o
  motivo de correccion.
- `recorded_by_auth_user_id`: usuario staff/owner que cargo el consumo.
- `qr_id`: QR publico usado.
- `earn_rate`: regla aplicada en ese momento.
- `request_id`: identificador unico de la carga para evitar doble submit.

El resultado devuelve tambien `eventId`, que es el identificador interno de esa
compra/evento de puntos. Para reportes futuros, usar `point_events.id` como ID
interno principal y `request_id` como llave idempotente del intento desde la UI.

La seccion `Consumos` del panel owner funciona como centro de control. Debe
mantener filtros por rango de fecha, cliente, monto minimo/maximo, producto,
categoria, nota, empleado, metodo (`qr`, `manual`, `api`, `adjustment`) y
estado (`confirmed`, `cancelled`, `corrected`). El resumen superior siempre
debe calcularse sobre los resultados filtrados para evitar confundir datos de
hoy con datos historicos. Al abrir un consumo se muestra trazabilidad: monto,
puntos, cliente, empleado, categoria, productos, estado, QR usado, request ID,
fecha exacta y nota interna. Solo owner puede cancelar consumos confirmados.

Correcciones operativas:

- Solo `owner` puede corregir o cancelar consumos desde el panel.
- Corregir un consumo permite cambiar monto, categoria y nota interna; los
  productos se conservan en esta primera version y pueden aclararse en la nota.
- Supabase recalcula los puntos usando el `earn_rate` original del consumo.
- Si la correccion baja puntos y el cliente ya no tiene saldo suficiente, la RPC
  rechaza la operacion para evitar saldos negativos invisibles.
- El consumo original queda con `purchase_status = 'corrected'`.
- La diferencia de puntos se guarda como `point_events.event_type = 'adjustment'`.
- El historial antes/despues vive en `point_event_corrections` con owner,
  valores previos, valores nuevos, diferencia y motivo de correccion.
- Cancelar sigue usando `cancel_customer_consumption`: no borra el consumo,
  cambia estado y registra el ajuste inverso.

Regla visual importante: evitar problemas de superposicion o `overlap` entre el
catalogo, el selector de presentaciones y la lista de productos seleccionados.
El catalogo debe tener su propio alto con scroll, la lista de seleccionados debe
tener su propio contenedor, y los popovers no deben salir hacia controles
superiores como monto o encabezados. En CSS esto suele ser un problema de
`layout overlap`, `stacking context` y `z-index` mal combinado con contenedores
con `overflow`.

## Inicio y estadisticas accionables

El Inicio del admin (`#/admin`) contiene la bienvenida del owner y un panel de
tareas. No existe una seccion separada de Estadisticas: la primera pantalla debe
responder rapido que requiere atencion en el negocio.

Regla de producto para el Inicio: si el owner no puede tomar una decision o
hacer algo con ese dato en menos de 10 segundos, no va en Inicio.

El Inicio muestra solo:

- Canjes pendientes.
- Consumos cargados hoy.
- Clientes nuevos hoy.
- Puntos entregados hoy.
- Accesos rapidos: cargar consumo, escanear QR, generar QR del menu, crear
  promocion y agregar premio.
- Actividad reciente: ultimos consumos, canjes y registros.

No poner en Inicio:

- Rankings de clientes.
- Clientes en riesgo o inactivos.
- Productos mas/menos vendidos.
- Conversiones del menu digital.
- Impacto de contenido.
- Tablas largas o textos tecnicos.

Esa informacion debe vivir en secciones especificas como Clientes, Premios,
Contenido o futuras pantallas de Consumos/Estadisticas avanzadas.

El MVP actual usa datos reales de estas fuentes:

- `point_events` con `event_type = 'purchase'`, `purchase_total`,
  `purchase_items`, `points_delta`, `recorded_by_auth_user_id` y `created_at`.
- `customer_profiles` y `loyalty_accounts` para clientes, niveles y puntos.
- `reward_redemptions` para canjes pendientes.
- `generated_content_assets` para piezas creadas con IA.
- `business_menu_events` para vistas del menu, detalles de productos y registro.

Los canjes pendientes se refrescan con Supabase Realtime sobre
`reward_redemptions` cuando el owner esta dentro del panel admin. Si aparece una
solicitud nueva, el panel recarga datos, avisa con toast y actualiza
`Necesita atencion`. El polling liviano cada 7 segundos queda como respaldo
cuando Realtime esta con demora, falla o no esta habilitado para ese proyecto.

Reglas para personalizar negocios:

1. No inventar metricas si falta tracking. Usar estados vacios con accion:
   `Cargar consumo`, `Crear contenido`, `Gestionar canjes` o `Generar QR`.
2. Mantener las metricas conectadas a una accion navegable.
3. Evitar graficos decorativos y rankings largos en Inicio.
4. Usar `point_events.id` como identificador interno de una compra registrada y
   `request_id` como llave idempotente del intento de carga.
5. Si el volumen crece, mover los calculos pesados a RPCs SQL, pero conservar
   Inicio como pantalla de control rapido.

## Como editar productos

Cada producto se define asi:

```js
item(
  "id-del-producto",
  "Nombre de Marca",
  "Categoria",
  "Nombre visible",
  "Descripcion corta.",
  [{ name: "Presentacion", price: 120, note: "Nota opcional" }],
  photos.nombreFoto
)
```

El `id` tambien busca una foto local en:

```txt
assets/menu/id-del-producto.png
```

Por ejemplo, el producto `shawarma-carne` carga:

```txt
assets/menu/shawarma-carne.png
```

Si el negocio no tiene foto aun, se puede dejar una foto generica o copiar una
imagen existente con el nuevo nombre.

## Editor de productos del panel admin

El editor de producto se abre desde `#/admin/menu/:dishId/edit`. Las filas del
menu admin no abren el editor completo; se entra desde el icono de lapiz para
evitar clicks accidentales.

Desde el editor se puede cambiar:

- Nombre y descripcion por idioma (`es`, `en`, `ar` en la plantilla actual).
- Presentaciones y precios, hasta tres variantes.
- Foto principal, haciendo click o arrastrando una imagen.
- Catalogo/marca interna.
- Categoria.
- Visibilidad en el menu publico.
- Estado agotado/reactivado.

Regla importante: el editor trabaja sobre un borrador local. Ningun cambio se
aplica al producto real ni al menu publico hasta tocar `Guardar`. `Vista previa`
puede mostrar el borrador sin persistirlo; si se vuelve al listado sin guardar,
los cambios se descartan.

Crear un producto nuevo:

1. Ir a `#/admin/menu`.
2. Tocar `Crear platillo`.
3. La app abre `#/admin/menu/new/edit` con un borrador nuevo.
4. Completar nombre, descripcion, foto, categoria y presentaciones.
5. Tocar `Guardar`; recien ahi el producto se agrega a `menuItems`, queda
   persistido en `localStorage` y la URL cambia al ID real del producto.

Los cambios se guardan en memoria y en `localStorage` con la clave
`sumi:menu:<businessId>:state` cuando la app corre sin Supabase. Si Supabase esta
configurado, el catalogo editado se guarda en `business_menu_catalog` por
`business_id`, y esa version remota es la unica fuente que leen clientes,
empleados, owners, pestanas nuevas e incognito.

Cuando existe una fila en `business_menu_catalog`, su lista de productos es
autoritativa para ese negocio. Para volver al menu original de `config.js`, se
debe borrar esa fila en Supabase. En modo sin Supabase, la clave de
`localStorage` sigue siendo autoritativa para la sesion de pruebas.

## Idiomas y traduccion IA

Los idiomas disponibles se definen en `businesses/<negocio>/config.js` dentro
de `languages`. El editor renderiza los tabs dinamicamente desde esa lista; no
hay que tocar `index.html` para agregar o quitar idiomas.

El editor guarda traducciones por producto en:

```js
dish.translations = {
  es: { name: "...", description: "..." },
  en: { name: "...", description: "..." }
}
```

Si el negocio usa `fr`, `pt`, `ar` u otro idioma, se agrega otra clave con el
codigo correspondiente. El idioma principal se define con `defaultLang` o con
`languages[].primary`.

Cuando el owner escribe en cualquier tab, ese idioma queda como ultimo idioma
editado. Al tocar `Traducir con IA`, la app envia ese texto fuente a la Edge
Function:

```txt
supabase/functions/translate-menu-item/index.ts
```

La funcion usa el modelo `gpt-5-nano`, devuelve los `targetLangs` configurados
en `businessConfig.languages`, y exige que el usuario autenticado exista en
`business_admins` para el `businessId` solicitado.

Mapa de implementacion:

- Boton del editor: `#translateButton` en `index.html`.
- Contenedor de tabs: `#editorLanguageTabs` en `index.html`.
- Tabs dinamicos: `.tab[data-lang]` generados en `renderEditorLanguageTabsMarkup()`.
- Estado del ultimo idioma editado: `lastEditedEditorLang` en `app.js`.
- Funcion frontend: `translateEditorDish()` en `app.js`.
- Funcion backend segura: `translate-menu-item` en Supabase Edge Functions.

`business.config.example.json` incluye `defaultLang` y `languages` a nivel raiz.
`scripts/prepare-client.mjs --dry-run` devuelve `missingFlags` para detectar
banderas que falten en `assets/flags/<flag>.svg` antes de entregar el cliente.

Para activar esa funcion en un proyecto real:

```powershell
npx supabase secrets set OPENAI_API_KEY="<openai-api-key>" --project-ref <project-ref>
npx supabase functions deploy translate-menu-item --project-ref <project-ref>
```

La API key de OpenAI nunca debe ir en `.env` de Vite ni en `config.js`, porque
eso la publicaria en el navegador.

## Imagenes del menu y compresion

La plantilla soporta dos tipos de imagen:

- Imagenes versionadas en `assets/menu/`, buenas para entregar un sitio final.
- Imagenes subidas desde el editor admin, buenas para pruebas y cambios rapidos.

Cuando el owner sube una imagen desde el editor, `app.js` la optimiza en el
navegador antes de guardarla:

- Lado maximo: `editorImageMaxSize` en `app.js`.
- Calidad: `editorImageQuality` en `app.js`.
- Formato preferido: WebP, con fallback a JPEG.
- Peso maximo aceptado antes de comprimir: 8 MB.
- Persistencia: `localStorage`, como Data URL optimizada.

Esto reduce mucho las fotos de celular antes de guardarlas en `localStorage`.
Para imagenes finales en `assets/menu/`, conviene exportar manualmente versiones
WebP/JPEG entre 1200 y 1600 px de lado largo y evitar archivos mayores a 300-500
KB por producto.

Si se quiere cambiar la politica global de compresion, editar estas constantes
en `app.js`:

```js
const editorImageMaxSize = 1400;
const editorImageQuality = 0.78;
```

Donde esta implementado:

- `compressEditorImage(file)`: redimensiona y convierte la imagen.
- `updateEditorPhoto(file)`: valida tipo/peso, guarda la imagen optimizada y
  refresca menu, biblioteca, contenido y detalle.
- `dishPhotoInput` y eventos de drag/drop: conectan click y arrastre de imagen.
- `.dish-photo.is-loading` en `styles.css`: muestra estado visual mientras
  comprime.

Limitaciones actuales:

- La imagen optimizada subida desde el editor vive solo en el navegador actual.
- Si se borra `localStorage`, se vuelve a usar la foto definida en
  `businesses/<cliente>/config.js`.
- Para entregar a un cliente, las fotos aprobadas deben quedar versionadas en
  `assets/menu/` o subidas a storage con URL estable.

Para negocios con muchas fotos, la siguiente mejora natural es guardar la imagen
optimizada en Supabase Storage y persistir solo la URL publica en el producto.

## Generacion de publicaciones con Kie.ai

La seccion `Crear contenido` genera una pieza de marketing desde el producto,
formato, tono e instrucciones seleccionadas. El boton principal `Generar`:

1. Construye el caption y hashtags.
2. Construye un prompt visual para la imagen.
3. Llama a la Edge Function segura:

```txt
supabase/functions/generate-content-image/index.ts
```

4. Recibe un `taskId`, mantiene la vista en estado de carga y consulta
   `generated_content_assets` hasta que la pieza aparezca.
5. Muestra el resultado en la interfaz y lo deja guardado automaticamente en
   Biblioteca cuando la generacion fue exitosa.

Desde julio de 2026, el flujo no guarda fallbacks locales ni fotos originales
como si fueran piezas generadas. La Edge Function solo crea el registro en
`generated_content_assets` cuando Kie.ai devolvio una imagen real y esa imagen
quedo copiada en Supabase Storage.

La generacion corre en segundo plano dentro de Supabase Edge Functions usando
`EdgeRuntime.waitUntil`. Eso permite que el owner cierre la pagina despues de
tocar `Generar`; si la tarea termina bien, la pieza aparece luego en Biblioteca.

La API key de Kie.ai no debe ir en `app.js`, `.env` de Vite ni `config.js`.
Debe configurarse como secreto de Supabase:

```powershell
npx supabase secrets set KIE_API_KEY="<kie-api-key>" --project-ref <project-ref>
npx supabase functions deploy generate-content-image --project-ref <project-ref>
```

La funcion usa la API de Kie.ai con modelos `gpt-image-2`:

- Crear tarea: `POST https://api.kie.ai/api/v1/jobs/createTask`
- Consultar resultado: `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...`
- Autenticacion: `Authorization: Bearer <KIE_API_KEY>`
- Modelo con referencia visual: `gpt-image-2-image-to-image`
- Modelo sin referencia visual valida: `gpt-image-2-text-to-image`

El prompt se arma en `buildContentImagePrompt(dish, format, draft)` dentro de
`app.js`. Debe respetar estas reglas de plantilla:

- La imagen debe tener al producto en el centro o como protagonista visual.
- Todas las piezas deben incluir el nombre del producto arriba del plato, con
  tipografia script estilo `New Berolina`, grande, legible y sin tapar comida.
- Por defecto se usa la foto del producto del menu como referencia.
- El owner puede subir una referencia manual desde `Crear contenido`.
- La referencia manual para generacion no se comprime ni redimensiona en el
  navegador. Se envia a la Edge Function como Data URL original para que Kie.ai
  reciba la mayor cantidad de detalle posible.
- La compresion con `compressEditorImage(file)` aplica solo a fotos subidas al
  menu desde el editor de producto.
- El centro de la imagen queda reservado para el producto. Badges, precios,
  promociones, direcciones o CTAs nunca deben ir centrados; deben vivir en
  esquinas, margenes o zonas laterales.
- Cada tono de `Crear contenido` tiene reglas propias de escena, paleta,
  ubicacion de badges y estilo de texto en `contentToneProfile()`.
- El badge principal debe llamar la atencion con buen contraste, pero seguir
  siendo minimalista. Puede haber un micro-chip secundario si hay aire visual.
- El texto completo que escribe el usuario es contexto para la IA, no debe
  copiarse entero dentro de la imagen. La imagen debe tener como maximo dos
  bloques de texto: titulo del producto y badge promocional.
- Si el texto contiene `2x1`, precio o descuento, `promotionHighlights()` lo
  convierte en el badge principal y debe tener alto protagonismo visual.
- La foto del producto no debe forzarse a un estilo minimalista; debe seguir
  siendo rica, apetitosa y realista.
- Los badges con promocion, precio, direccion o CTA si deben ser minimalistas:
  poco texto, buen contraste, bordes suaves y sin tapar el producto.
- El resultado se adapta al formato elegido:
  - `instagram-square`: relacion `1:1`.
  - `instagram-story`: relacion `9:16`.
  - `instagram-reel`: relacion `9:16` para portada de reel.
- El paso 2 de `Crear contenido` debe mantenerse limitado a tres formatos:
  `Post cuadrado para Instagram`, `Story vertical` y `Reel cover`.
- Si Kie.ai no esta configurado o falla, se muestra error controlado y no se
  guarda la foto original como si fuera una generacion.
- Si Kie.ai falla, no se descuentan creditos.
- Si la UI deja de esperar antes de que Kie.ai termine, se muestra un estado de
  segundo plano. La pieza puede aparecer luego en Biblioteca sin mantener la
  pestana abierta.

Creditos:

- Cada negocio define sus creditos en `business.config.json` con
  `aiCredits.monthlyLimit`.
- La plantilla demo usa 150 creditos por mes.
- Cada generacion consume `aiCredits.generationCreditCost`; la plantilla demo
  usa 2 creditos.
- El saldo se restablece al limite mensual configurado al cambiar de mes; no se
  acumula.
- El control real ocurre en Supabase mediante
  `business_ai_settings`, `business_ai_credit_balances`,
  `business_ai_credit_events` y la Edge Function.
- `scripts/prepare-client.mjs` copia estos valores al config generado y al seed
  del cliente.

Referencias de diseno usadas para loading states:

- `crutchcorn/sync-skeleton`: shimmer CSS-only sincronizado.
- `samuelli/progress-bar`: barra indeterminada vanilla liviana.
- `russmaxdesign/loading-button`: patron simple de boton en loading.

Donde editar la experiencia:

- Boton principal: `#adminCreateContentButton` en `index.html`.
- Click y estado de carga: listener de `adminCreateContentButton` en `app.js`.
- Tonos y copy base: `contentToneProfile()` y `contentDraft()` en `app.js`.
- Extraccion de promos/precios para badges: `promotionHighlights()` en `app.js`.
- Prompt visual: `buildContentImagePrompt()` en `app.js`.
- Referencia manual sin compresion: `readContentReferenceImage()` en `app.js`.
- Persistencia de biblioteca: `insertGeneratedContentAsset()` en
  `supabase/functions/generate-content-image/index.ts`.
- Trabajo en segundo plano: `processGeneratedImageTask()` y `runInBackground()`
  en `supabase/functions/generate-content-image/index.ts`.
- Descarga de piezas: `downloadAsset()` en `app.js`, que convierte la imagen a
  blob para forzar descarga sin abrir una ventana nueva.
- Visual del boton: `.admin-generate-button` en `styles.css`.

## Mejora de fotos de producto con IA

El editor de producto incluye `Mejorar con IA` debajo de la foto. Este flujo no
publica cambios automaticamente:

1. El owner abre el modal desde el editor.
2. Describe el fondo o sube una imagen de referencia.
3. La Edge Function `supabase/functions/improve-product-photo/index.ts` llama a
   Kie.ai con `gpt-image-2-image-to-image`.
4. La IA debe conservar producto, ingredientes, porcion, plato y detalles.
5. Solo puede ajustar fondo, iluminacion, sombra, color grading y encuadre.
6. Al terminar, el modal muestra un comparador interactivo antes/despues con
   una linea arrastrable.
7. El owner puede descargar la version de maxima calidad cuando quiera,
   generar otra variante o tocar `Conservar`.
8. Al tocar `Conservar`, la app mantiene la URL de alta calidad para descarga y
   comprime una copia liviana para aplicarla al borrador del editor.
9. El menu solo cambia cuando el owner toca `Guardar`.

Donde editar:

- Modal: `#photoAiModal` en `index.html`.
- Apertura/generacion/aplicacion: `openPhotoAiModal()`,
  `improveEditorPhotoWithAi()` y `applyImprovedEditorPhoto()` en `app.js`.
- Comparador: `showPhotoAiComparison()` y `setPhotoAiComparePosition()` en
  `app.js`.
- Prompt de preservacion del producto: `buildPrompt()` en
  `supabase/functions/improve-product-photo/index.ts`.
- Estilos: `.photo-ai-*` y `.photo-ai-trigger` en `styles.css`.

## Que no tocar normalmente

Evita tocar estos archivos para una simple personalizacion:

- `app.js`
- `styles.css`
- `scripts/build.mjs`
- `src/integrations/supabase/*`

Solo se editan cuando cambia el producto base para todos los negocios.

## Flujo recomendado con Codex

Para un negocio nuevo:

1. Clonar o abrir el repo base.
2. Completar `business.config.json` desde `business.config.example.json`.
3. Validar la configuracion:

   ```powershell
   npm run prepare:client -- --config business.config.json --dry-run
   ```

4. Generar la carpeta del negocio y el seed inicial:

   ```powershell
   npm run prepare:client -- --config business.config.json
   ```

5. Revisar `businesses/<negocio>/config.js` y
   `supabase/seed.client.generated.sql`.
6. Cambiar temporalmente el `<script src="businesses/.../config.js">` de
   `index.html` si queres probar ese negocio localmente.
7. Probar con `npm run dev`.
8. Construir con `npm run build`.

Si el negocio solo cambia marca, menu, precios y fotos, no hace falta forkear el
codigo. Si el negocio necesita una funcionalidad distinta, conviene crear una
rama o fork y luego decidir si esa mejora vuelve al producto base.

## Informacion que necesito para personalizar un negocio

Para crear una configuracion completa necesito:

- Nombre del negocio.
- Logo o iniciales de marca.
- Direccion, ciudad y horarios.
- Marcas/conceptos internos si hay mas de uno.
- Categorias del menu en orden.
- Productos con nombre, descripcion, precio y presentaciones.
- Fotos de productos o permiso para usar imagenes genericas.
- Idiomas deseados.
- Premios o reglas de puntos.
- Colores o estilo visual deseado.

## Brief completo para implementar un negocio nuevo

Antes de crear `businesses/<negocio>/`, conviene completar este cuestionario.
La idea es que Codex o cualquier persona del equipo pueda implementar el negocio
sin tener que volver a preguntar datos basicos.

### 1. Identidad del negocio

- Nombre comercial exacto:
- Nombre corto para botones o encabezados:
- `businessId` deseado, en minusculas y sin espacios:
- Iniciales o texto para el logo pequeno:
- Logo disponible? indicar ruta o link:
- Colores principales de marca:
- Colores secundarios o acentos:
- Estilo visual deseado: elegante, popular, premium, familiar, minimalista,
  nocturno, cafetero, fast casual, etc.
- Tono de comunicacion: cercano, formal, divertido, gastronomico, lujoso, etc.
- Tipografias o referencias visuales existentes:

### 2. Ubicacion, contacto y datos publicos

- Direccion completa:
- Barrio, ciudad y pais:
- Horarios por dia:
- Telefono o WhatsApp:
- Instagram:
- TikTok:
- Sitio web:
- Google Maps:
- Texto corto de ubicacion para portada:
- Mensaje de ayuda o contacto para el panel:

### 3. Estructura de marcas o conceptos

- El negocio tiene una sola marca/concepto o varios?
- Si tiene varios, listar cada marca/concepto:
- Marca inicial que debe abrir por defecto:
- Subtitulo de cada marca en espanol:
- Subtitulo de cada marca en ingles, si aplica:
- Subtitulo de cada marca en otro idioma, si aplica:
- Producto recomendado por cada marca:

### 4. Menu y categorias

Para cada marca/concepto:

- Categorias en el orden exacto en que deben aparecer:
- Categoria inicial:
- Productos por categoria:
- Productos que deben estar ocultos al inicio:
- Productos destacados o mas pedidos:
- Productos que conviene sugerir como acompanamiento:

Para cada producto:

- ID corto, en minusculas y sin espacios:
- Marca/concepto:
- Categoria:
- Nombre visible:
- Descripcion corta:
- Presentaciones, tamanos o variantes:
- Precio de cada presentacion:
- Nota opcional por presentacion:
- Foto disponible? indicar archivo o link:
- Debe estar visible en el menu publico?
- Traducciones disponibles:

Formato recomendado:

```txt
Producto:
ID:
Marca:
Categoria:
Nombre:
Descripcion:
Presentaciones:
- Nombre:
  Precio:
  Nota:
Foto:
Visible:
```

### 5. Fotos y assets

- Hay fotos propias de productos?
- Donde estan guardadas?
- Se permite usar imagenes genericas temporalmente?
- Se permite generar imagenes con IA?
- Formato preferido: PNG, JPG o WebP:
- Naming esperado: `assets/menu/<id-del-producto>.png`
- Logo principal:
- Logo reducido o iniciales:
- Imagenes extra para portada o redes:

Proceso estandar para imagenes de productos:

1. Recibir del negocio fotos reales siempre que existan.
2. Nombrar cada imagen con el mismo `id` del producto.
3. Guardar cada archivo en `assets/menu/<id-del-producto>.png`.
4. Usar encuadre cuadrado o 4:3, con el producto claramente visible.
5. Evitar imagenes oscuras, borrosas, muy recortadas o genericas si el cliente
   necesita validar el plato.
6. Si no hay foto real, generar o usar placeholder temporal y marcarlo como
   pendiente en el brief.
7. Antes de mostrar al cliente, revisar que cada producto visible tenga imagen y
   que la imagen corresponda al producto correcto.
8. No subir imagenes con nombres como `foto1.png` o `nuevo.png`; el naming debe
   ser estable para que la config sea replicable.

Checklist de imagenes antes de presentar al cliente:

- Cada producto visible tiene archivo en `assets/menu/`.
- Los nombres coinciden exactamente con los `id` de `menuItems`.
- Las imagenes cargan en la lista, recomendacion y detalle.
- Los platos se ven bien en mobile y desktop.
- Los placeholders estan identificados como pendientes.

### 5.1 Iconos de interfaz y banderas

La plantilla debe mantener iconos e indicadores consistentes para todos los
negocios:

- Los iconos funcionales de la app viven en HTML/CSS y no se personalizan por
  negocio salvo que cambie la funcionalidad.
- Evitar caracteres pegados desde fuentes externas si se ven corruptos en el
  HTML; usar entidades HTML o clases CSS estables.
- Las banderas del selector de idioma deben ser SVGs en `assets/flags/`.
- Cada idioma nuevo debe agregar su bandera como `assets/flags/<codigo>.svg`.
- Cada idioma se configura en `languages` con `code`, `label`, `helper`,
  `flag` y `dir`.
- La clase CSS de cada bandera debe apuntar al SVG, por ejemplo `.flag.mx`.
- El boton de idioma del header usa `languages[].flag` para mostrar la bandera
  activa; si se agrega un idioma, confirmar que ese asset tambien se vea en el
  header del catalogo.
- Antes de entregar una plantilla o negocio nuevo, revisar visualmente que los
  iconos de buscar, idioma, volver, compartir, favorito, navegacion y acciones
  del editor se vean correctamente.
- Si se agrega una libreria de iconos en el futuro, usar una sola libreria para
  toda la interfaz y documentar esa decision aqui.

Proceso obligatorio de revision UI/UX antes de mostrar al cliente:

1. Revisar landing, menu principal, detalle de producto y cualquier panel editor
   activo.
2. Revisar mobile real y desktop con contenedor tipo telefono.
3. Confirmar que no haya overflow horizontal de pagina.
4. Confirmar que botones icon-only tengan `aria-label`.
5. Confirmar que iconos de buscar, idioma, volver, compartir, favorito,
   navegacion y acciones del editor no dependan de caracteres corruptibles.
6. Confirmar que las banderas carguen desde `assets/flags/`.
7. Confirmar que el idioma seleccionado cambie textos y direccion del documento
   cuando aplique.
8. Si una pantalla usa assets placeholder, confirmar que no tengan texto
   incrustado que compita con la UI final.
9. Confirmar que controles tactiles importantes midan al menos 44px de alto o
   ancho.
10. Confirmar foco visible en teclado y soporte de `prefers-reduced-motion`.
11. Confirmar estado vacio para busquedas sin resultados.
12. Mantener escape de textos que vienen de `config.js` cuando se renderizan con
   `innerHTML`.
13. Confirmar que el registro de puntos sea un CTA opcional del header y no una
   pantalla obligatoria para entrar al menu.

## Skills del proyecto

Si el repo incluye una carpeta `skills/`, se debe tratar como parte del sistema
operativo de la plantilla:

- No ejecutar scripts de skills sin revisarlos antes.
- Validar que cada skill tenga `SKILL.md` con frontmatter `name` y
  `description`.
- Revisar red flags antes de instalar o copiar una skill: `curl`, `wget`,
  `sudo`, acceso a credenciales, `.env`, `.ssh`, `.aws`, instrucciones para
  ignorar reglas o comandos destructivos.
- Corregir codificacion rota o mojibake antes de versionar una skill.
- Mantener instrucciones concisas; mover referencias largas a `references/`.
- Si una skill trae instaladores externos, conservarlos solo si son necesarios y
  nunca ejecutarlos automaticamente.
- Despues de actualizar skills, correr una validacion local de estructura y
  dejar reporte de hallazgos pendientes.

### 6. Idiomas y traducciones

- Idioma principal:
- Idiomas secundarios:
- Se requiere selector de idioma?
- Hay traducciones oficiales del negocio?
- Codex puede proponer traducciones iniciales?
- Terminos que no se deben traducir:
- Moneda y formato de precio:

### 7. Puntos, premios y fidelizacion

- La tarjeta de puntos estara activa?
- El registro de puntos se mostrara como CTA en el header?
- Nombre del programa de puntos:
- Puntos iniciales de ejemplo:
- Regla de acumulacion por compra:
- Regla de acumulacion por consumo cargado por empleado:
- QR de cliente activo? El QR de la plantilla identifica al cliente; no acredita puntos desde el frontend.
- Premios disponibles:
- Costo en puntos por premio:
- Condiciones de canje:
- Niveles deseados: Bronce, Plata, Oro u otros:
- Umbrales de cada nivel:

Las solicitudes de premio se crean con la RPC `request_reward_redemption`.
Esa funcion valida puntos, nivel, stock, vigencia y duplicados pendientes antes
de insertar. Cada solicitud vence a los 15 minutos para que una captura vieja no
pueda aprobarse como si el cliente siguiera en caja.

En Supabase, los umbrales se guardan en `business_loyalty_settings` como
`tier_silver_points`, `tier_gold_points` y `tier_platinum_points`. La funcion
`loyalty_tier_for_points()` y los triggers de `loyalty_accounts` mantienen el
nivel sincronizado cuando cambia el saldo o cuando el owner edita esos umbrales
desde Fidelizacion. Defaults de plantilla: Plata 500, Oro 1000, Platino 2000.
Los flujos de consumo, canje, cancelacion y ajuste manual tambien usan esa
funcion para devolver el nivel actualizado al panel y a la tarjeta del cliente.

#### Rachas semanales

Para gastronomia, la plantilla usa rachas semanales. Cuenta un consumo valido
por semana; los consumos cancelados no cuentan y los corregidos si cuentan. La
racha no debe mostrarse solo como numero: siempre acompanarla con progreso y
accion.

La UI debe responder:

- Cuantas semanas lleva el cliente.
- Si esta semana ya esta cubierta.
- Cuantas semanas faltan para el bonus.
- Cuantos puntos entrega el bonus, si esta configurado.
- Que debe hacer el cliente/empleado ahora: cargar consumo esta semana,
  mantener racha o aprovechar bonus.

Lugares obligatorios:

- Perfil del cliente.
- Ficha de cliente del owner.
- Ficha rapida al escanear QR o cargar consumo.

#### Flujo QR de cliente

En la plantilla con Supabase, la tarjeta de puntos solo aparece si el cliente
esta registrado o logeado. El icono QR abre un modal con el `public_qr_id` de la
cuenta de fidelizacion del cliente. Si el proyecto se corre sin Supabase, puede
existir un ID local solo como fallback de demostracion.

Debajo del QR se muestra un alias legible para el cliente, con formato
`Nombre-1234`. Ese alias se calcula en el frontend usando el nombre del perfil y
un sufijo estable derivado del `public_qr_id`. No reemplaza al identificador real
del backend y no debe usarse como fuente de verdad para acreditar puntos.

El QR contiene un payload v1 con:

- `type`: `sumi-loyalty-customer`
- `version`: `1`
- `businessId`: el `businessId` del negocio
- `qrId`: `public_qr_id` de `loyalty_accounts` cuando hay backend

La lectura de QR todavia acepta `customerId` y `publicQrId` como compatibilidad
con QRs viejos, pero los nuevos QRs de la plantilla deben emitir `qrId`.

El flujo esperado es: el cliente termina de consumir, muestra el QR al empleado,
y el empleado lo escanea para identificar a quien debe acreditarse el consumo.

Para produccion con backend, no se deben acreditar puntos desde el frontend del
cliente. El flujo recomendado es:

1. El QR apunta a un token o ID validable por backend.
2. El empleado escanea el QR desde un panel autorizado.
3. El empleado carga importe, productos o consumo.
4. El backend calcula creditos, guarda el movimiento y actualiza el saldo.
5. El cliente ve sus puntos actualizados al sincronizar datos.

Modelo minimo en Supabase:

- `businesses`: negocios dueños del programa.
- `customer_profiles`: perfil del cliente vinculado a `auth.users`.
  Incluye `status` operativo: `active`, `incomplete`, `blocked` o `deleted`.
  El owner puede cambiarlo desde la ficha de Cliente; clientes bloqueados,
  eliminados o sin completar no pueden solicitar canjes nuevos.
- `loyalty_accounts`: saldo, nivel y `public_qr_id`.
- `point_events`: movimientos de puntos.
- `reward_redemptions`: solicitudes/canjes de premios.

El `business_id` debe separar los datos de cada negocio. El cliente solo puede
leer su propio perfil, cuenta, QR e historial; no puede acreditarse puntos desde
el frontend.

El owner puede ajustar puntos manualmente desde la ficha del cliente. Ese ajuste
usa la RPC `adjust_customer_points`, exige un `request_id`, no permite dejar
saldo negativo y guarda una fila `point_events.event_type = 'adjustment'` con
`recorded_by_auth_user_id`. Para auditoria, el ID interno del ajuste es
`point_events.id`; `request_id` sirve como llave idempotente del intento desde
la UI.

### 8. Datos, Supabase y persistencia

- La version sera estatica con `config.js` o conectada a Supabase?
- Si usa Supabase, proyecto y tablas involucradas:
- Se requiere separar datos por `business_id`?
- Quien podra editar productos y precios?
- Se necesita historial de cambios?
- Se necesita login de administradores?
- Variables de entorno necesarias:
- Datos sensibles que no deben ir al repo:

### 9. Despliegue y mantenimiento

- Dominio o subdominio deseado:
- Entorno de pruebas:
- Entorno de produccion:
- Responsable de aprobar cambios:
- Responsable de actualizar precios:
- Frecuencia esperada de cambios de menu:
- Fecha objetivo de lanzamiento:
- Requiere version QR impresa?
- Requiere analytics o medicion?

### 10. Criterios de aceptacion

La implementacion se considera lista cuando:

- El negocio correcto carga desde `businesses/<negocio>/config.js`.
- El menu muestra categorias, productos, fotos y precios correctos.
- El selector de marca refleja la estructura del negocio.
- La pantalla inicial muestra direccion, horario e identidad correctos.
- Los textos principales estan en los idiomas acordados.
- Los premios y puntos muestran reglas correctas.
- `npm run dev` levanta sin errores.
- `npm run build` genera `dist/` con assets y config del negocio.
- La app se reviso en desktop y mobile.
- El cliente o responsable aprobo contenido, precios y fotos.
