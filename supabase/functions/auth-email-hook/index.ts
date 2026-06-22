const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Sumi <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

type EmailAction = "signup" | "recovery" | "invite" | "email_change" | string;

type AuthEmailPayload = {
  user?: {
    email?: string;
    user_metadata?: {
      name?: string;
      nombre?: string;
      business_id?: string;
    };
  };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: EmailAction;
  };
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

function actionCopy(type: EmailAction) {
  if (type === "recovery") {
    return {
      subject: "Recupera tu cuenta de Sumi",
      title: "Recupera tu contrasena",
      intro: "Recibimos una solicitud para recuperar el acceso a tu cuenta.",
      cta: "Recuperar contrasena",
      note: "Si no solicitaste este cambio, puedes ignorar este correo."
    };
  }

  if (type === "invite") {
    return {
      subject: "Te invitaron a Sumi",
      title: "Acepta tu invitacion",
      intro: "Te invitaron a crear una cuenta para gestionar tu experiencia Sumi.",
      cta: "Aceptar invitacion",
      note: "Este enlace es personal y puede vencer por seguridad."
    };
  }

  if (type === "email_change") {
    return {
      subject: "Confirma tu nuevo email en Sumi",
      title: "Confirma tu nuevo email",
      intro: "Confirma este correo para completar el cambio de email de tu cuenta.",
      cta: "Confirmar email",
      note: "Si no solicitaste este cambio, revisa la seguridad de tu cuenta."
    };
  }

  return {
    subject: "Confirma tu cuenta de Sumi",
    title: "Confirma tu cuenta",
    intro: "Ya casi esta listo. Confirma tu Gmail para empezar a guardar tus puntos.",
    cta: "Confirmar cuenta",
    note: "Despues de confirmar, vuelve al menu para iniciar sesion."
  };
}

function verifyUrl(emailData: NonNullable<AuthEmailPayload["email_data"]>) {
  const tokenHash = emailData.token_hash || emailData.token;
  const type = emailData.email_action_type || "signup";
  const redirectTo = emailData.redirect_to;

  if (!SUPABASE_URL || !tokenHash) return redirectTo || "";

  const url = new URL(`${SUPABASE_URL}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", type);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function htmlTemplate(params: {
  actionUrl: string;
  cta: string;
  intro: string;
  name: string;
  note: string;
  title: string;
}) {
  const name = escapeHtml(params.name);
  const actionUrl = escapeHtml(params.actionUrl);
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;background:#fff9ec;color:#461904;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff9ec;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff1d3;border:1px solid #ffdfa5;border-radius:22px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 10px;">
                <p style="margin:0 0 12px;color:#a1410b;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">Sumi Loyalty</p>
                <h1 style="margin:0;color:#461904;font-family:Georgia,Times,serif;font-size:34px;line-height:1;font-style:italic;">${escapeHtml(params.title)}</h1>
                <p style="margin:18px 0 0;color:#82370c;font-size:15px;line-height:1.55;font-weight:700;">Hola ${name}, ${escapeHtml(params.intro)}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 28px 22px;">
                <a href="${actionUrl}" style="display:inline-block;min-width:210px;padding:15px 22px;border-radius:999px;background:#ff890a;color:#461904;text-decoration:none;font-size:15px;font-weight:900;">${escapeHtml(params.cta)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <p style="margin:0;color:#a1410b;font-size:12px;line-height:1.45;font-weight:700;">${escapeHtml(params.note)}</p>
                <p style="margin:14px 0 0;color:#82370c;font-size:11px;line-height:1.45;">Si el boton no funciona, copia y pega este enlace en tu navegador:<br><span style="word-break:break-all;">${actionUrl}</span></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const payload = (await req.json()) as AuthEmailPayload;
    const email = payload.user?.email;
    const emailData = payload.email_data;

    if (!email || !emailData) {
      return new Response(JSON.stringify({ error: "Invalid auth email payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const type = emailData.email_action_type || "signup";
    const copy = actionCopy(type);
    const name = payload.user?.user_metadata?.name || payload.user?.user_metadata?.nombre || email;
    const actionUrl = verifyUrl(emailData);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: copy.subject,
        html: htmlTemplate({
          actionUrl,
          cta: copy.cta,
          intro: copy.intro,
          name,
          note: copy.note,
          title: copy.title
        })
      })
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend failed", resendResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Resend delivery failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Unexpected email hook error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
