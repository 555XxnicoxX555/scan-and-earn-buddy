# Implementacion de un cliente nuevo

Esta guia es el documento operativo para replicar la plantilla en un negocio
nuevo. Cuando abras un clon del repo, puedes decirle a Codex:

```text
Lee CLIENT_IMPLEMENTATION_RUNBOOK.md, CUSTOMIZATION.md y SUPABASE_SETUP.md.
Implementa este cliente nuevo siguiendo esos documentos.
```

## 1. Que debe pedir Codex antes de empezar

Datos del negocio:

- Nombre comercial exacto.
- Nombre corto para header, botones y emails.
- `businessId` en minusculas, sin espacios ni caracteres raros.
- Logo o iniciales.
- Colores de marca y referencias visuales.
- Direccion, ciudad, horarios y contacto.
- URL publicada esperada o dominio final.
- Idiomas necesarios.
- Menu completo con categorias, productos, presentaciones, precios y notas.
- Fotos reales de productos o permiso para placeholders/imagenes generadas.
- Reglas de puntos, niveles y premios.

Datos tecnicos:

- URL publica del sitio publicado, sin slash final.
- Project ID de Supabase.
- Supabase API URL.
- Supabase anon/publishable key.
- Database password o connection string Postgres, solo si Codex debe aplicar migraciones.
- Supabase access token, solo si Codex debe usar CLI contra el proyecto.
- Resend API key.
- Remitente deseado para emails.
- Secret del Auth Hook generado en Supabase.

Nunca guardar en el repo:

- Supabase access token.
- Database password.
- Supabase service role key.
- Resend API key.
- Auth hook secret.
- Connection strings con password.

## 2. Responsabilidades

Codex puede hacer:

- Crear `businesses/<cliente>/config.js`.
- Ajustar `index.html` para cargar la config del cliente.
- Generar o ubicar assets en `assets/menu/` y `assets/flags/`.
- Actualizar `.env` con valores publicos.
- Aplicar migraciones si recibe credenciales temporales suficientes.
- Setear Supabase secrets con CLI.
- Desplegar Edge Functions.
- Ejecutar `npm run build` y `npm run check:supabase`.
- Probar registro, login, QR, perfil e historial.
- Documentar pendientes.

El usuario debe hacer o aprobar:

- Crear el proyecto en Supabase si todavia no existe.
- Copiar credenciales desde Supabase dashboard.
- Crear/verificar dominio en Resend si no se usa `onboarding@resend.dev`.
- Activar manualmente Auth Hooks en Supabase dashboard.
- Configurar `Authentication > URL Configuration` en Supabase.
- Aprobar contenido, imagenes, precios y textos antes de mostrar al cliente final.

## 3. Crear proyecto Supabase

En Supabase:

1. Crear un nuevo proyecto.
2. Elegir region cercana al cliente o al mercado principal.
3. Guardar el Project ID.
4. Ir a `Project Settings > API`.
5. Copiar:
   - Project URL.
   - anon/publishable key.
6. Ir a `Project Settings > Database`.
7. Copiar database password o connection string si Codex aplicara migraciones.

Valores que se ponen en `.env`:

```env
VITE_SUPABASE_PROJECT_ID="<project-ref>"
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-or-publishable-key>"
VITE_PUBLIC_APP_URL="https://url-publica-del-catalogo"
```

`VITE_PUBLIC_APP_URL` debe ser la URL final del sitio, sin slash final. Es clave
para que los emails no redirijan a `localhost`.

## 4. Aplicar base de datos

La migracion principal es:

```text
supabase/migrations/20260622000100_loyalty_accounts.sql
```

Opcion con CLI:

```powershell
$env:SUPABASE_ACCESS_TOKEN="<token-temporal>"
npx supabase link --project-ref <project-ref> --password "<database-password>"
npx supabase db push --linked --password "<database-password>" --yes
```

Opcion manual:

1. Abrir Supabase.
2. Ir a `SQL Editor`.
3. Crear `New query`.
4. Pegar el contenido de la migracion.
5. Ejecutar.

Verificacion:

```powershell
npm run check:supabase
```

Debe devolver `ok` para:

- `businesses`
- `customer_profiles`
- `loyalty_accounts`
- `point_events`
- `reward_redemptions`

## 5. Configurar Auth y redirects

En Supabase:

1. Ir a `Authentication > URL Configuration`.
2. Setear `Site URL` con la URL publica:

   ```text
   https://url-publica-del-catalogo
   ```

3. Agregar la misma URL en `Redirect URLs`.
4. Si se usan previews o staging, agregar tambien esas URLs.

No dejar `localhost` como URL principal en produccion. Si queda `localhost`, los
emails de confirmacion pueden mandar al usuario a una app local apagada.

## 6. Configurar Resend

En Resend:

1. Crear o abrir el proyecto/cuenta.
2. Crear una API key.
3. Para pruebas, se puede usar:

   ```text
   Sumi <onboarding@resend.dev>
   ```

4. Para produccion, verificar dominio del negocio.
5. Definir remitente final, por ejemplo:

   ```text
   Nombre Negocio <hola@dominio.com>
   ```

Secrets que Codex debe setear en Supabase:

```powershell
$env:SUPABASE_ACCESS_TOKEN="<token-temporal>"
npx supabase secrets set `
  RESEND_API_KEY="<resend-api-key>" `
  RESEND_FROM_EMAIL="Nombre Negocio <hola@dominio.com>" `
  APP_PUBLIC_URL="https://url-publica-del-catalogo" `
  --project-ref <project-ref>
```

## 7. Desplegar emails Auth

La Edge Function esta en:

```text
supabase/functions/auth-email-hook/index.ts
```

Desplegar:

```powershell
$env:SUPABASE_ACCESS_TOKEN="<token-temporal>"
npx supabase functions deploy auth-email-hook `
  --project-ref <project-ref> `
  --no-verify-jwt
```

`--no-verify-jwt` es necesario porque Supabase Auth Hooks llaman al endpoint por
HTTPS y la funcion valida la firma del hook con `AUTH_HOOK_SECRET`.

## 8. Activar Auth Hook manualmente

Este paso es manual en Supabase dashboard:

1. Ir a `Authentication > Auth Hooks`.
2. Agregar hook `Send Email`.
3. Elegir `HTTPS endpoint`.
4. URL:

   ```text
   https://<project-ref>.supabase.co/functions/v1/auth-email-hook
   ```

5. Click en `Generate secret`.
6. Copiar el secret completo.
7. Crear el hook y dejarlo `Enabled`.
8. Pasar ese secret a Codex para guardarlo como secret remoto:

   ```powershell
   $env:SUPABASE_ACCESS_TOKEN="<token-temporal>"
   npx supabase secrets set AUTH_HOOK_SECRET="<v1,whsec_...>" --project-ref <project-ref>
   npx supabase functions deploy auth-email-hook --project-ref <project-ref> --no-verify-jwt
   ```

No guardar `AUTH_HOOK_SECRET` en archivos del repo.

## 9. Personalizar el negocio

1. Copiar `businesses/sumi/` a `businesses/<cliente>/`.
2. Editar `businesses/<cliente>/config.js`.
3. Cambiar en `index.html`:

   ```html
   <script src="businesses/sumi/config.js"></script>
   ```

   por:

   ```html
   <script src="businesses/<cliente>/config.js"></script>
   ```

4. Colocar fotos en:

   ```text
   assets/menu/<id-del-producto>.png
   ```

5. Revisar banderas en:

   ```text
   assets/flags/<codigo>.svg
   ```

6. Ejecutar:

   ```powershell
   npm run dev
   npm run build
   ```

7. Revisar el editor admin en:

   ```text
   #/admin/menu
   #/admin/menu/<id-del-producto>/edit
   #/admin/menu/<id-del-producto>/preview
   ```

8. Probar carga de imagen desde el editor. La plantilla comprime la imagen antes
   de guardarla, pero para produccion las fotos versionadas en `assets/menu/`
   deben entregarse ya optimizadas.

## 10. Traduccion IA del menu

Si el negocio usara traduccion IA, configurar el secret remoto:

```powershell
$env:SUPABASE_ACCESS_TOKEN="<token-temporal>"
npx supabase secrets set OPENAI_API_KEY="<openai-api-key>" --project-ref <project-ref>
npx supabase functions deploy translate-menu-item --project-ref <project-ref>
```

No guardar `OPENAI_API_KEY` en `.env`, `config.js` ni documentacion.

La traduccion se ejecuta desde las opciones del producto:

- Ruta: `#/admin/menu/<id>/edit`.
- Seccion: `Nombre y descripcion`.
- Boton: `Traducir con IA`.
- Modelo: `gpt-5-nano`.
- Fuente: ultimo idioma editado por el owner.
- Salida: `es`, `en` y `ar`.

La funcion remota valida que el usuario logeado sea admin del negocio en
`business_admins`. Si el boton falla aunque el secret este configurado, revisar
permisos owner para ese usuario y que la app apunte al Supabase correcto.

Prueba esperada:

1. Entrar como owner.
2. Abrir `#/admin/menu/<id>/edit`.
3. Editar nombre o descripcion en cualquier idioma.
4. Tocar `Traducir con IA`.
5. Confirmar que se autocompletan `es`, `en` y `ar`.
6. Guardar y revisar que el menu publico cambie al alternar idioma.

## 11. Pruebas obligatorias

Antes de mostrar al cliente:

- Landing: botones de idioma entran al catalogo.
- Invitado: no ve `Mis puntos`.
- Invitado: ve CTA `Ganar puntos`.
- Registro: pide nombre, Gmail, contrasena y repetir contrasena.
- Email de confirmacion: llega por Resend.
- Link de email: abre la URL publica, no `localhost`.
- Login: muestra icono de perfil.
- Logeado: ve tarjeta `Mis puntos`.
- QR: abre modal de `QR de cliente recurrente`.
- Perfil: muestra nombre, Gmail, puntos, nivel, QR, historial y logout.
- Logout: vuelve al estado invitado.
- Recuperar contrasena: envia email por Resend.
- Admin menu: solo el icono de lapiz abre el editor.
- Editor: tabs de idioma cambian texto sin perder cambios.
- Editor: `Marcar agotado` persiste y aparece en preview/menu publico.
- Editor: `+ Agregar` suma presentaciones hasta el limite de tres.
- Editor: subir foto grande la optimiza y no rompe el menu.
- Traduccion IA: completa idiomas si `OPENAI_API_KEY` esta configurada.
- `npm run audit:ui`: confirma que no haya botones activos sin handler obvio.
- `npm run smoke:ui`: prueba en navegador menu publico, detalle, guard admin,
  crear platillo, guardar y preview. Requiere el dev server activo en
  `http://127.0.0.1:8080` o definir `SUMI_SMOKE_URL`.
- `npm run check:supabase`: todas las tablas `ok`.
- `npm run build`: termina sin errores.

### Owner local para QA

La app incluye un bypass solo para pruebas locales del panel admin. Se activa
unicamente cuando Vite corre en modo desarrollo, el host es `localhost` o
`127.0.0.1`, y existe esta bandera en `localStorage`:

```js
localStorage.setItem("sumi:dev-owner", "true")
```

No funciona en build de produccion. `npm run smoke:ui` usa esta bandera dentro
de un contexto de navegador temporal para verificar `Crear platillo`, `Guardar`
y `Vista previa` sin depender de una cuenta owner real. Para validar permisos
reales de cliente, siempre probar tambien con una cuenta incluida en
`business_admins`.

## 12. Imagenes y performance

Recomendaciones para fotos finales:

- Lado largo entre 1200 y 1600 px.
- Peso ideal por producto: 300-500 KB o menos.
- Preferir WebP o JPEG optimizado.
- Evitar PNG para fotos, salvo transparencia real.
- Nombrar cada archivo igual al `id` del producto cuando se use
  `productImage(id)`.

El compresor del editor sirve para pruebas y cambios rapidos del owner. Para un
sitio final, no reemplaza una carpeta `assets/menu/` curada y versionada.

Proceso recomendado:

1. Durante la implementacion, usar el editor admin para probar fotos rapido.
2. Validar encuadre en lista, detalle y preview admin.
3. Cuando la foto queda aprobada, exportarla como WebP/JPEG optimizado.
4. Guardarla en `assets/menu/<id-del-producto>.<ext>` o en Storage.
5. Actualizar `businesses/<cliente>/config.js` para que esa URL/asset sea la
   fuente definitiva.
6. Limpiar `localStorage` y probar de nuevo para confirmar que el sitio no
   depende de datos locales del navegador.

Si el cliente necesita administrar fotos desde el panel en produccion, la mejora
pendiente es subir la imagen optimizada a Supabase Storage y guardar su URL en
base de datos. No usar Data URLs en `localStorage` como persistencia final.

## 13. Errores comunes

El email redirige a `localhost`:

- Revisar `VITE_PUBLIC_APP_URL` en `.env`.
- Revisar `APP_PUBLIC_URL` en Supabase secrets.
- Revisar `Authentication > URL Configuration`.
- Reenviar confirmacion o crear otro usuario; los emails viejos conservan links viejos.

`npm run check:supabase` devuelve `missing (404)`:

- La migracion no fue aplicada al proyecto configurado en `.env`.
- Confirmar que `.env` apunta al project ref correcto.

El hook devuelve `401`:

- Falta `AUTH_HOOK_SECRET`.
- El secret del dashboard no coincide con el secret remoto.
- Redesplegar `auth-email-hook` despues de setear secrets.

El hook devuelve `502`:

- Resend rechazo el envio.
- Revisar `RESEND_API_KEY`.
- Revisar `RESEND_FROM_EMAIL`.
- Si se usa dominio propio, confirmar que este verificado en Resend.

`Traducir con IA` devuelve error:

- Falta `OPENAI_API_KEY` como Supabase secret.
- La funcion `translate-menu-item` no fue desplegada.
- El usuario logeado no existe en `business_admins` para ese `business_id`.
- El navegador esta usando `.env` de otro proyecto Supabase.

Las fotos cargan lento:

- Revisar peso real de archivos en `assets/menu/`.
- Usar WebP/JPEG optimizado.
- Evitar subir fotos originales de celular directo a assets.
- Si la foto fue cargada desde el editor, borrar cache/localStorage viejo y
  volver a cargarla para que pase por el compresor nuevo.

Registro creado pero login dice email no confirmado:

- Es normal si Supabase exige confirmacion.
- El usuario debe abrir el email y confirmar.
- Para pruebas automatizadas, no depender de cuentas reales si hay rate limit.

## 14. Entrega

Al finalizar:

- Commit con cambios de config, docs y assets.
- Push a `main` o rama acordada.
- URL publicada funcionando.
- Supabase schema verificado.
- Edge Function activa.
- Auth Hook enabled.
- Email real probado.
- Checklist UI/UX de `CUSTOMIZATION.md` completado.
