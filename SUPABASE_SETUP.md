# Supabase setup

Esta plantilla usa Supabase Auth para clientes y tablas privadas para la tarjeta
de puntos. El catalogo sigue siendo publico.

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
