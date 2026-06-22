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

## 10. Pruebas obligatorias

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
- `npm run check:supabase`: todas las tablas `ok`.
- `npm run build`: termina sin errores.

## 11. Errores comunes

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

Registro creado pero login dice email no confirmado:

- Es normal si Supabase exige confirmacion.
- El usuario debe abrir el email y confirmar.
- Para pruebas automatizadas, no depender de cuentas reales si hay rate limit.

## 12. Entrega

Al finalizar:

- Commit con cambios de config, docs y assets.
- Push a `main` o rama acordada.
- URL publicada funcionando.
- Supabase schema verificado.
- Edge Function activa.
- Auth Hook enabled.
- Email real probado.
- Checklist UI/UX de `CUSTOMIZATION.md` completado.
