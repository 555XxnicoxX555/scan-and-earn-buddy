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

## 5. Emails de Auth con Resend

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
