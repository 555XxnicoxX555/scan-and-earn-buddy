---
name: supabase-custom-emails
description: Directiva maestra para crear y personalizar correos electrónicos (invitaciones, recuperación, bienvenida) usando Supabase Auth Hooks + Resend + Bundling local.
---

# Supabase Custom Emails Skill

Esta skill define el estándar de oro para la comunicación por email en Blu-Analyzer. Evita errores comunes de renderizado y asegura que el 100% de los correos lleguen con diseño profesional y branding correcto.

## Arquitectura de Email

Blu-Analyzer utiliza una combinación de tres tecnologías para sus correos:
1. **Supabase Auth Hooks**: Interceptan el evento de envío de email de Supabase Auth.
2. **Edge Functions (Deno)**: Reciben el evento del hook y ejecutan la lógica de negocio.
3. **Resend API**: Motor de envío que recibe el HTML final desde la Edge Function.

---

## Implementación de una Edge Function de Email

Para evitar errores de validación (`422 rendering failed`) en Resend, **NUNCA** uses plantillas remotas de Resend con mapeo de variables complejo. Usa **Inyección Directa de HTML**.

### Estructura base de la función (`index.ts`):

```typescript
import { createClient } from "@supabase/supabase-js";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  try {
    const { user, email_data } = await req.json();
    const { token, token_hash, redirect_to, email_action_type } = email_data;

    // 1. Definir variables
    const nombre = user?.user_metadata?.nombre || user.email;
    const actionLink = `${redirect_to}#access_token=${token}&type=reset`; // Ajustar según tipo

    // 2. Cargar HTML (Inyección directa)
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Hola ${nombre}</h1>
          <p>Hacé click acá: <a href="${actionLink}">Botón</a></p>
        </body>
      </html>
    `;

    // 3. Enviar vía Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Blu Analyzer <invitaciones@bluanalyzer.app>",
        to: [user.email],
        subject: "Asunto Personalizado",
        html: htmlBody,
      }),
    });

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
```

---

## Despliegue Crítico (Bundling)

Debido a que Supabase Production usa workers con `--no-remote`, **DEBES empaquetar las funciones localmente** antes de subirlas.

### Paso 1: Bundle con `esbuild`
```bash
npx esbuild supabase/functions/nombre-funcion/index.ts --bundle --format=esm --platform=neutral --main-fields=module,main --outfile=supabase/functions/nombre-funcion/dist.js
```

### Paso 2: Subida vía Management API
Usa un script de utilidad (como `deploy-util.mjs`) que lea `dist.js` y use `PATCH` sobre la API de Supabase para actualizar el cuerpo de la función.

---

## Registro en el Dashboard (Auth Hooks)

Para que la función se ejecute, **DEBES activarla manualmente** en el panel de Supabase:
1. Ve a **Authentication > Auth Hooks**.
2. Haz clic en **Add hook**.
3. Selecciona **Send Email hook**.
4. Usa el tipo **HTTPS endpoint**.
5. Endpoint: `https://[PROJECT_REF].supabase.co/functions/v1/auth-email-hook`.
6. Guarda y verifica que esté **ENABLED**.

---

## Variables Comunes por Evento

| Evento (`email_action_type`) | Variable Clave 1 | Variable Clave 2 |
| :--- | :--- | :--- |
| `invite` | `token` (access token) | `redirect_to` |
| `signup` | `token` (confirmation) | `redirect_to` |
| `recovery` | `token` (reset token) | `redirect_to` |
| `email_change` | `token` (new email) | `redirect_to` |

---

## Mejores Prácticas

- **Fallback de Nombre**: Si `nombre` es null, usa el mail: `${nombre || email}`.
- **Dominios**: Usa siempre `invitaciones@bluanalyzer.app` (asegurarse de que esté verificado en Resend).
- **Log de Errores**: Si `res.status` de Resend no es 2xx, loguea `await res.text()` para diagnóstico inmediato (422 = Error de validación de HTML/Variables).

> [!CAUTION]
> Si no bundleas localmente con `esbuild`, la función fallará con un "worker boot error" al intentar importar `@supabase/supabase-js` en producción.
