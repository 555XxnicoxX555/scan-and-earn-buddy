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
- Alias de acceso y estado de la sesion autenticada para Supabase, por ejemplo
  `supabase.<cliente>.migrations`; nunca el token, la contrasena ni la connection
  string.
- Alias del secret remoto de Resend, por ejemplo `resend.<cliente>.transactional`;
  nunca el valor de la API key.
- Remitente deseado para emails.
- Alias del Auth Hook remoto, por ejemplo `supabase.<cliente>.auth-hook`; nunca
  el secret generado.

Nunca guardar ni pegar en Git, prompts, chats, Markdown, logs o portapapeles
persistentes:

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
- Aplicar migraciones mediante una sesion autenticada y de minimo privilegio,
  sin recibir ni imprimir credenciales.
- Preparar los nombres y valores no sensibles de Supabase Secrets; el usuario o
  un broker autorizado introduce los valores secretos directamente en el
  proveedor.
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
6. Registrar el alias de acceso aprobado para migraciones. Si la CLI necesita
   autenticacion, el usuario completa el flujo oficial del proveedor sin pegar
   tokens o contrasenas en el chat.

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

Opcion con CLI usando una sesion ya autenticada:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

El login lo completa el usuario en el flujo oficial. Si el comando solicita una
contrasena, debe introducirla directamente en el prompt oculto o usar el SQL
Editor; no se la entrega a Codex ni se la incluye en el historial del shell.

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

Secrets que deben existir en Supabase:

- `RESEND_API_KEY`: el usuario lo carga directamente en el dashboard o mediante
  un broker allowlisted; el agente solo verifica que el nombre exista.
- `RESEND_FROM_EMAIL`: valor no secreto que puede configurar Codex.
- `APP_PUBLIC_URL`: valor no secreto que puede configurar Codex.

No se pasa la API key a Codex ni se escribe en un comando guardado en el
historial. El centro de mando conserva solamente el alias y el estado de
rotacion/revocacion.

## 7. Desplegar emails Auth

La Edge Function esta en:

```text
supabase/functions/auth-email-hook/index.ts
```

Desplegar:

```powershell
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
8. Guardar el secret directamente en Supabase como `AUTH_HOOK_SECRET`, desde el
   dashboard o un broker allowlisted. Codex recibe unicamente el alias y la
   confirmacion de que el secret existe; despues puede desplegar la funcion con
   la sesion ya autenticada.

No mostrar `AUTH_HOOK_SECRET` a Codex ni guardarlo en archivos, prompts, logs o
comandos persistentes.

## 9. Personalizar el negocio

1. Completar `business.config.json` desde el formulario del cliente.
2. Validar:

   ```powershell
   npm run prepare:client -- --config business.config.json --dry-run
   ```

3. Generar configuracion y seed:

   ```powershell
   npm run prepare:client -- --config business.config.json
   ```

4. Revisar `businesses/<cliente>/config.js` y
   `supabase/seed.client.generated.sql`.
5. Cambiar en `index.html`:

   ```html
   <script src="businesses/sumi/config.js"></script>
   ```

   por:

   ```html
   <script src="businesses/<cliente>/config.js"></script>
   ```

6. Colocar fotos en:

   ```text
   assets/menu/<id-del-producto>.png
   ```

7. Revisar banderas en:

   ```text
   assets/flags/<codigo>.svg
   ```

8. Ejecutar:

   ```powershell
   npm run dev
   npm run build
   ```

9. Revisar el editor admin en:

   ```text
   #/admin/menu
   #/admin/menu/<id-del-producto>/edit
   #/admin/menu/<id-del-producto>/preview
   ```

10. Probar carga de imagen desde el editor. La plantilla comprime la imagen antes
   de guardarla, pero para produccion las fotos versionadas en `assets/menu/`
   deben entregarse ya optimizadas.

## 10. Traduccion IA del menu

Si el negocio usara traduccion IA, el usuario o un broker allowlisted carga
`OPENAI_API_KEY` directamente en los secrets remotos de Supabase. Codex puede
desplegar `translate-menu-item` usando la sesion autenticada y verificar la
presencia del nombre del secret, pero no recibe ni imprime su valor.

No guardar ni mostrar `OPENAI_API_KEY` en `.env`, `config.js`, documentacion,
prompts, logs o comandos persistentes.

## 11. Modelo operativo por cliente

Para los primeros clientes usar un proyecto Supabase por negocio. Sumi administra
la infraestructura y el cliente no necesita gestionar cuentas tecnicas.

Checklist antes de entregar:

1. Proyecto Supabase nuevo, sin `seed.demo.sql`.
2. Migraciones aplicadas.
3. `supabase/seed.client.generated.sql` revisado y ejecutado.
4. Owner creado y vinculado en `business_admins`.
5. Employees creados solo si el negocio ya los necesita.
6. Auth URLs apuntando al dominio publico.
7. `.env` local y variables de hosting apuntando al proyecto correcto.
8. QR del menu apuntando a `VITE_PUBLIC_APP_URL`.
9. Flujo completo probado: registro, consumo, canje, premios, QR y contenido.

Politica comercial inicial:

- No pedir Supabase, API keys ni hosting al cliente.
- Incluir infraestructura y uso razonable en la mensualidad.
- Definir creditos mensuales de IA por plan en `business.config.json`
  (`aiCredits.monthlyLimit`) y costo por generacion
  (`aiCredits.generationCreditCost`).
- Vender creditos extra o plan superior si supera el limite.
- Registrar internamente costos, errores de Edge Functions y uso de IA.

Si mas adelante Sumi pasa a SaaS multi-tenant, revisar RLS, RPCs y monitoreo
antes de mezclar negocios en una misma base.

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
