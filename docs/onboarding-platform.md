# Onboarding B2B de Sumi

El onboarding para dueños de negocios es una aplicación separada de la app
pública y del panel de cada comercio. Se compila desde `onboarding.html` hacia
`dist-onboarding/` y se publica en:

```text
https://onboarding.sumi.business/
```

No es una landing pública. Cada negocio entra con un enlace privado de un solo
token en formato `#/i/<token>`. En la base solo se guarda el SHA-256 del token.

## Flujo del negocio

1. Un operador crea la invitación desde `#/admin`.
2. Comparte el enlace una sola vez con el owner.
3. El owner completa negocio, menú, fidelización, identidad y revisión.
4. El formulario guarda un borrador automáticamente.
5. Los archivos se suben con URL firmada al bucket privado
   `business-onboarding-private`.
6. Al enviar, la solicitud queda `submitted` y ya no admite cambios.
7. Sumi puede aprobarla o devolverla como `needs_changes` con una observación.
8. Al aprobar, el operador exporta el JSON normalizado al esquema canónico de
   `business-intake.json` para preparar la instancia.

La Edge Function `onboarding-form` usa el token como autenticación específica
del formulario. `verify_jwt` está desactivado deliberadamente: el dueño todavía
no necesita una cuenta Sumi. La función valida hash, vencimiento, tamaño de
payload, tipo/tamaño de archivo y prefijo de Storage. La service role existe
solo dentro de la función.

## Consola interna

La ruta `#/admin` requiere Supabase Auth y una fila activa en
`platform_operators`. Desde allí se puede:

- crear y revocar enlaces;
- buscar y filtrar solicitudes;
- revisar avance, respuestas y archivos firmados;
- pedir cambios con una nota obligatoria;
- aprobar y exportar `business-intake.json`.

El operador inicial se siembra para `globaladsggle@gmail.com` cuando esa cuenta
ya existe en Auth. Los demás operadores se agregan explícitamente a
`platform_operators`; no se infieren por dominio de email.

## Deploy

```powershell
npm run build
npm run check:onboarding:app
```

- Publicar `dist-onboarding/` en `onboarding.sumi.business`.
- Definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el build.
- Definir `ONBOARDING_ALLOWED_ORIGIN=https://onboarding.sumi.business` como
  origen exacto de la Edge Function. En Vercel, `vercel.json` reescribe
  `/api/onboarding` hacia Supabase para que el alias de respaldo funcione sin
  abrir CORS ni usar comodines.
- Aplicar migraciones y desplegar `onboarding-form`.
- Mantener el bucket privado; nunca convertirlo en público para simplificar la
  vista previa.

Proyecto Vercel actual: `sumi-onboarding`. El alias de respaldo es
`https://sumi-onboarding.vercel.app`. Para activar el dominio final en el DNS
externo de `sumi.business`, crear:

```text
Tipo: CNAME
Nombre: onboarding
Destino: c40c21f884b86768.vercel-dns-017.com.
```

Después verificar con:

```powershell
npx vercel domains verify onboarding.sumi.business
```

## Estados

- Invitación: `active`, `completed`, `revoked`, `expired`.
- Entrega: `draft`, `submitted`, `needs_changes`, `approved`, `archived`.

`submitted` y `approved` son de solo lectura para el negocio. `needs_changes`
habilita nuevamente la edición y conserva la nota del operador.
