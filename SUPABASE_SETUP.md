# Supabase setup

Esta plantilla usa Supabase Auth para clientes y tablas privadas para la tarjeta
de puntos. El catalogo sigue siendo publico.

Para implementar un cliente nuevo de punta a punta, incluyendo Resend, Auth
Hooks, URLs publicas, deploy y checklist de pruebas, leer tambien:

```text
CLIENT_IMPLEMENTATION_RUNBOOK.md
```

## 1. Variables requeridas

Crear o actualizar `.env` con valores publicos del proyecto:

```env
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-or-publishable-key>"
```

No guardar access tokens, service role keys ni passwords de base de datos en el
repo.

## 2. Aplicar migraciones

La migracion requerida esta en:

```text
supabase/migrations/20260622000100_loyalty_accounts.sql
```

Opciones:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
```

O, si se usa una connection string temporal:

```powershell
npx supabase db push --db-url "<postgres-connection-string>"
```

Tambien se puede copiar el SQL en el SQL Editor de Supabase y ejecutarlo una vez.

## 3. Verificacion backend

Despues de aplicar la migracion, estas tablas deben existir:

- `businesses`
- `customer_profiles`
- `loyalty_accounts`
- `point_events`
- `reward_redemptions`
- `dish_likes`
- `dish_like_overrides`
- `business_menu_settings`
- `business_menu_catalog`

Verificar desde el repo:

```powershell
npm run check:supabase
```

Si devuelve `missing (404)`, la migracion todavia no fue aplicada al proyecto
configurado en `.env`.

El registro de cliente debe crear automaticamente:

- Un usuario en Supabase Auth.
- Un `customer_profiles` vinculado a `auth.users`.
- Un `loyalty_accounts` con `public_qr_id`.
- Un primer `point_events` de alta.

## 4. Reglas esperadas

- Invitado: ve el catalogo, no ve `Mis puntos`.
- Cliente logeado: ve `Mis puntos`, QR, perfil e historial.
- El frontend cliente no acredita puntos.
- El QR identifica al cliente; la carga de consumos queda para panel empleado/admin.
- `loyalty_accounts.public_qr_id` es unico, se genera automaticamente con
  `gen_random_uuid()` y es el ID real que viaja dentro del QR.
- El texto visible debajo del QR usa formato `Nombre-1234`; es solo un alias
  legible derivado del `public_qr_id`, no una columna ni una credencial.

## 5. Likes, recomendado y producto popular

El menu publico guarda likes reales por cliente en `dish_likes`. Para demos o
arranques de negocio se pueden sumar likes ficticios no destructivos con
`dish_like_overrides`; por ejemplo, la plantilla usa ese mecanismo para que
`shawarma-carne` arranque con 50 likes.

El panel admin permite elegir:

- Producto de `Hoy te recomendamos`.
- Producto `Popular`.

Ese estado vive en `business_menu_settings` por `business_id`. Solo puede haber
un producto Popular a la vez: si el owner marca otro producto como Popular, el
anterior vuelve a mostrar su contador normal de likes. Si no hay configuracion
guardada, la app usa como fallback el producto con mas likes.

Estas tablas son leibles por `anon` para que el menu publico pueda mostrar
contadores y badges, pero las escrituras estan protegidas por RLS:

- Clientes autenticados pueden dar/quitar su propio like en `dish_likes`.
- Owners del negocio pueden editar `dish_like_overrides` y
  `business_menu_settings`.

El catalogo editable del panel admin se guarda en `business_menu_catalog`.
Cuando existe una fila para el `business_id`, esa lista de productos reemplaza
al fallback versionado de `businesses/<negocio>/config.js` para clientes,
empleados, owners, pestanas nuevas e incognito. La lectura es publica; la
escritura queda limitada por RLS a owners del negocio.

## 6. Emails de Auth con Resend

La Edge Function de emails esta en:

```text
supabase/functions/auth-email-hook/index.ts
```

Secrets necesarios en Supabase:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `AUTH_HOOK_SECRET`
- `APP_PUBLIC_URL`

Para pruebas se puede usar:

```text
Sumi <onboarding@resend.dev>
```

Importante: `onboarding@resend.dev` funciona solo en modo prueba. Resend puede
enviar unicamente al email verificado/dueño de la cuenta de Resend. Si se intenta
registrar cualquier otro Gmail, Supabase Auth fallara porque el hook no puede
entregar el correo de confirmacion.

Cuando el dominio del negocio este verificado en Resend, cambiar
`RESEND_FROM_EMAIL` por un remitente propio, por ejemplo:

```text
Sumi <hola@dominio-del-negocio.com>
```

`APP_PUBLIC_URL` debe ser la URL publicada del catalogo, sin slash final. Se usa
para evitar que los emails de confirmacion redirijan a `localhost`.

Tambien configurar en Supabase:

1. Ir a `Authentication > URL Configuration`.
2. Cambiar `Site URL` por la URL publicada.
3. Agregar la misma URL en `Redirect URLs`.

Desplegar la funcion:

```powershell
npx supabase functions deploy auth-email-hook --project-ref <project-ref> --no-verify-jwt
```

Activar manualmente en Supabase:

1. Ir a `Authentication > Auth Hooks`.
2. Agregar un hook de tipo `Send Email`.
3. Elegir `HTTPS endpoint`.
4. Usar este endpoint:

```text
https://<project-ref>.supabase.co/functions/v1/auth-email-hook
```

5. Click en `Generate secret`.
6. Guardar el secret generado como `AUTH_HOOK_SECRET` en Supabase secrets.
7. Guardar y dejar el hook `Enabled`.

La funcion maneja estos eventos:

- `signup`: confirmacion de cuenta.
- `recovery`: recuperacion de contrasena.
- `invite`: invitacion.
- `email_change`: confirmacion de nuevo email.

## 7. Traduccion IA del menu

El editor de producto usa una Edge Function para traducir nombre y descripcion
sin exponer la API key en el frontend.

Donde se usa:

- UI: `#/admin/menu/<dishId>/edit`.
- Boton: `Traducir con IA`, dentro de `Nombre y descripcion`.
- Frontend: `translateEditorDish()` en `app.js`.
- Backend: `supabase/functions/translate-menu-item/index.ts`.

Modelo usado:

- `gpt-5-nano`

Secret requerido en Supabase:

- `OPENAI_API_KEY`

Configurar el secret:

```powershell
npx supabase secrets set OPENAI_API_KEY="<openai-api-key>" --project-ref <project-ref>
```

Desplegar la funcion:

```powershell
npx supabase functions deploy translate-menu-item --project-ref <project-ref>
```

La funcion:

- Usa el modelo `gpt-5-nano`.
- Lee el ultimo idioma editado en el frontend como fuente.
- Devuelve `es`, `en` y `ar`.
- Valida que el usuario autenticado exista en `business_admins` para el
  `business_id` solicitado.

Prueba rapida:

1. Entrar con una cuenta owner.
2. Ir a `#/admin/menu`.
3. Abrir un producto desde el icono de lapiz.
4. Escribir o modificar nombre/descripcion en cualquier tab de idioma.
5. Tocar `Traducir con IA`.
6. Cambiar entre `Espanol`, `English` y `ar` para confirmar que se completaron
   los tres idiomas.

Nunca guardar la API key de OpenAI en `.env`, `config.js`, `app.js`,
documentacion o capturas. Debe vivir solo como secret remoto de Supabase.

## 8. Generacion de imagenes con Kie.ai

`Crear contenido` usa una Edge Function para generar la imagen final de la
publicacion sin exponer la API key de Kie.ai en el navegador.

Donde se usa:

- UI: `#/admin/content`.
- Boton: `Generar`.
- Frontend: `generateAdminContent()` y `generateContentImage()` en `app.js`.
- Backend: `supabase/functions/generate-content-image/index.ts`.

API usada:

- Crear tarea: `POST https://api.kie.ai/api/v1/jobs/createTask`
- Consultar resultado: `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...`

Modelos usados:

- Con foto del producto o referencia manual: `gpt-image-2-image-to-image`
- Sin referencia visual valida: `gpt-image-2-text-to-image`

Secret requerido en Supabase:

- `KIE_API_KEY`

Configurar el secret:

```powershell
npx supabase secrets set KIE_API_KEY="<kie-api-key>" --project-ref <project-ref>
```

Desplegar la funcion:

```powershell
npx supabase functions deploy generate-content-image --project-ref <project-ref>
```

La funcion:

- Valida que el usuario autenticado exista en `business_admins`.
- Valida creditos de negocio: 150 creditos mensuales, 2 por generacion,
  reinicio mensual sin acumulacion.
- Recibe producto, formato, instrucciones y tono seleccionado. Si no hay tono
  seleccionado, usa una direccion neutra; los tonos son opciones avanzadas.
- Usa la foto del producto del menu o una referencia visual subida manualmente.
- Tambien puede recibir una referencia de fondo. `Subir imagen` representa el
  producto/base; `Subir fondo` representa ambiente, superficie, luz o contexto.
- La referencia manual de `Crear contenido` no se comprime en el frontend; la
  compresion queda reservada para fotos subidas al menu.
- Genera un prompt donde la comida es protagonista y los badges son
  minimalistas.
- El prompt trata la imagen del producto como identidad bloqueada: la IA solo
  puede ajustar enfoque, iluminacion, sombras, color natural, recorte y entorno.
  No debe cambiar ingredientes, toppings, forma, cantidad, textura, plato ni
  presentacion del producto.
- Crea una tarea de Kie.ai y responde al frontend con `status: processing` y
  `taskId`.
- Continua el polling, subida a Storage, descuento de creditos y guardado en
  biblioteca con `EdgeRuntime.waitUntil`, por lo que el usuario puede cerrar la
  pagina despues de iniciar la generacion.
- Sube la imagen generada a Supabase Storage en el bucket `generated-content`.
- Crea automaticamente el registro en `generated_content_assets`.
- Consume creditos solo despues de que Kie.ai devuelve una imagen real y Storage
  conserva una copia. Si Kie.ai falla, no se descuentan creditos.
- Devuelve inicialmente `taskId`, `model`, `creditsRemaining` y `status:
  processing`. La UI consulta `generated_content_assets` por `task_id` para
  mostrar el resultado cuando aparece.
- Si Kie.ai termina despues del polling inicial, la UI conserva el `taskId` en
  `localStorage` y vuelve a invocar la misma Edge Function con
  `action: "finalize"` al entrar a `Crear contenido` o `Biblioteca`. Esa accion
  consulta Kie.ai, sube la imagen real a Storage y crea el asset si todavia no
  existe.

Tablas agregadas:

- `business_ai_credit_balances`
- `business_ai_credit_events`
- `generated_content_assets`

Prueba rapida:

1. Entrar con una cuenta owner.
2. Ir a `#/admin/content`.
3. Elegir producto y formato.
4. Escribir una promocion o instruccion breve.
5. Tocar `Generar`.
6. Confirmar que la UI muestra el estado de generacion.
7. Abrir `Biblioteca` y confirmar que aparece la pieza generada
   automaticamente.

Nunca guardar la API key de Kie.ai en `.env` de Vite, `config.js` o `app.js`.
Debe vivir solo como secret remoto de Supabase.
