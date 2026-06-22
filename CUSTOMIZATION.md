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

## Que contiene la config

En `businesses/<negocio>/config.js` se editan:

- `businessId`: identificador interno del negocio.
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
- `rewardCatalog`: premios del sistema de puntos.

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
2. Crear una carpeta nueva en `businesses/`.
3. Pedirle a Codex: "crea una configuracion para <negocio> usando
   `businesses/sumi/config.js` como base".
4. Pasarle a Codex el menu, precios, marca, horarios, direccion y fotos.
5. Probar con `npm run dev`.
6. Construir con `npm run build`.

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

#### Flujo QR de cliente

En la plantilla con Supabase, la tarjeta de puntos solo aparece si el cliente
esta registrado o logeado. El icono QR abre un modal con el `public_qr_id` de la
cuenta de fidelizacion del cliente. Si el proyecto se corre sin Supabase, puede
existir un ID local solo como fallback de demostracion.

El QR contiene un payload v1 con:

- `type`: `sumi-loyalty-customer`
- `version`: `1`
- `businessId`: el `businessId` del negocio
- `customerId`: `public_qr_id` de `loyalty_accounts` cuando hay backend

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
- `loyalty_accounts`: saldo, nivel y `public_qr_id`.
- `point_events`: movimientos de puntos.
- `reward_redemptions`: solicitudes/canjes de premios.

El `business_id` debe separar los datos de cada negocio. El cliente solo puede
leer su propio perfil, cuenta, QR e historial; no puede acreditarse puntos desde
el frontend.

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
