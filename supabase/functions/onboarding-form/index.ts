import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ONBOARDING_ALLOWED_ORIGIN = Deno.env.get("ONBOARDING_ALLOWED_ORIGIN") || "https://onboarding.sumi.business";
const STORAGE_BUCKET = "business-onboarding-private";
const MAX_PAYLOAD_BYTES = 512 * 1024;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);
const ALLOWED_CATEGORIES = new Set(["logo", "menu", "product", "reference", "other"]);

type OnboardingRequest = {
  action?: "resolve" | "save" | "submit" | "request-upload" | "complete-upload" | "remove-file";
  token?: string;
  payload?: Record<string, unknown>;
  completionPercent?: number;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  category?: string;
  storagePath?: string;
  fileId?: string;
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function responseOrigin(request: Request) {
  const origin = request.headers.get("origin") || "";
  if (origin === ONBOARDING_ALLOWED_ORIGIN) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return ONBOARDING_ALLOWED_ORIGIN;
}

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": responseOrigin(request),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function cleanToken(value: unknown) {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{32,256}$/.test(token) ? token : "";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeFileName(value: unknown) {
  return String(value || "file")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "file";
}

function requiredPayloadErrors(payload: Record<string, unknown>) {
  const business = (payload.business || {}) as Record<string, unknown>;
  const operations = (payload.operations || {}) as Record<string, unknown>;
  const menu = (payload.menu || {}) as Record<string, unknown>;
  const errors: string[] = [];
  if (!String(business.name || "").trim()) errors.push("Falta el nombre del negocio.");
  if (!String(business.domain || "").trim()) errors.push("Falta el dominio deseado o actual.");
  if (!String(operations.ownerEmail || "").trim()) errors.push("Falta el email del owner.");
  const sourceFiles = Array.isArray(menu.sourceFiles) ? menu.sourceFiles : [];
  const mainProducts = Array.isArray(menu.mainProducts) ? menu.mainProducts : [];
  const catalogs = Array.isArray(menu.catalogs) ? menu.catalogs : [];
  if (!sourceFiles.length && !mainProducts.length && !catalogs.some((catalog) => Array.isArray((catalog as Record<string, unknown>)?.products) && ((catalog as Record<string, unknown>).products as unknown[]).length)) {
    errors.push("Agrega al menos un archivo de menu o un producto.");
  }
  return errors;
}

async function inviteContext(rawToken: unknown) {
  const token = cleanToken(rawToken);
  if (!token) return { error: "Enlace de onboarding invalido.", status: 401 } as const;
  const tokenHash = await sha256(token);
  const { data: invite, error } = await admin
    .from("onboarding_invites")
    .select("id, owner_email, business_name, status, expires_at, created_at, last_opened_at, completed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) return { error: "No pudimos validar la invitacion.", status: 500 } as const;
  if (!invite) return { error: "La invitacion no existe o fue revocada.", status: 404 } as const;
  if (invite.status === "revoked") return { error: "La invitacion fue revocada.", status: 410 } as const;
  if (invite.status === "expired" || new Date(invite.expires_at).getTime() < Date.now()) {
    if (invite.status !== "expired") await admin.from("onboarding_invites").update({ status: "expired" }).eq("id", invite.id);
    return { error: "La invitacion vencio. Solicita un enlace nuevo a Sumi.", status: 410 } as const;
  }
  return { token, invite } as const;
}

async function submissionForInvite(inviteId: string) {
  const { data } = await admin
    .from("onboarding_submissions")
    .select("id, schema_version, status, payload, completion_percent, review_note, submitted_at, reviewed_at, updated_at")
    .eq("invite_id", inviteId)
    .maybeSingle();
  return data;
}

async function filesForInvite(inviteId: string) {
  const { data } = await admin
    .from("onboarding_files")
    .select("id, original_name, mime_type, size_bytes, category, created_at")
    .eq("invite_id", inviteId)
    .order("created_at", { ascending: false });
  return data || [];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Metodo no permitido." }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(request, { error: "Onboarding no configurado." }, 503);

  let input: OnboardingRequest;
  try {
    input = await request.json();
  } catch {
    return json(request, { error: "Solicitud invalida." }, 400);
  }

  const context = await inviteContext(input.token);
  if ("error" in context) return json(request, { error: context.error }, context.status);
  const { invite } = context;

  if (input.action === "resolve") {
    await admin.from("onboarding_invites").update({ last_opened_at: new Date().toISOString() }).eq("id", invite.id);
    return json(request, {
      invite,
      submission: await submissionForInvite(invite.id),
      files: await filesForInvite(invite.id)
    });
  }

  if (invite.status === "completed") return json(request, { error: "Este onboarding ya fue completado." }, 409);

  if (input.action === "save" || input.action === "submit") {
    const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {};
    if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_PAYLOAD_BYTES) {
      return json(request, { error: "El formulario supera el tamano permitido." }, 413);
    }
    const completionPercent = Math.max(0, Math.min(100, Math.round(Number(input.completionPercent || 0))));
    const existing = await submissionForInvite(invite.id);
    if (existing?.status === "submitted" || existing?.status === "approved" || existing?.status === "archived") {
      return json(request, { error: "La solicitud ya no admite cambios." }, 409);
    }
    if (input.action === "submit") {
      const errors = requiredPayloadErrors(payload);
      if (errors.length) return json(request, { error: "Completa los datos obligatorios.", fields: errors }, 422);
    }
    const nextStatus = input.action === "submit" ? "submitted" : existing?.status === "needs_changes" ? "needs_changes" : "draft";
    const values = {
      invite_id: invite.id,
      schema_version: 1,
      status: nextStatus,
      payload,
      completion_percent: input.action === "submit" ? 100 : completionPercent,
      submitted_at: input.action === "submit" ? new Date().toISOString() : existing?.submitted_at || null
    };
    const { data, error } = await admin
      .from("onboarding_submissions")
      .upsert(values, { onConflict: "invite_id" })
      .select("id, schema_version, status, payload, completion_percent, review_note, submitted_at, reviewed_at, updated_at")
      .single();
    if (error) return json(request, { error: "No pudimos guardar el formulario." }, 500);
    return json(request, { submission: data });
  }

  if (input.action === "request-upload") {
    const mimeType = String(input.mimeType || "").toLowerCase();
    const sizeBytes = Math.round(Number(input.sizeBytes || 0));
    const category = String(input.category || "other");
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return json(request, { error: "Tipo de archivo no permitido." }, 415);
    if (sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) return json(request, { error: "El archivo supera 15 MB." }, 413);
    if (!ALLOWED_CATEGORIES.has(category)) return json(request, { error: "Categoria de archivo invalida." }, 400);
    const storagePath = `${invite.id}/${crypto.randomUUID()}-${safeFileName(input.fileName)}`;
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data) return json(request, { error: "No pudimos preparar la carga." }, 500);
    return json(request, { storagePath, signedToken: data.token });
  }

  if (input.action === "complete-upload") {
    const storagePath = String(input.storagePath || "");
    const mimeType = String(input.mimeType || "").toLowerCase();
    const sizeBytes = Math.round(Number(input.sizeBytes || 0));
    const category = String(input.category || "other");
    if (!storagePath.startsWith(`${invite.id}/`) || !ALLOWED_MIME_TYPES.has(mimeType) || !ALLOWED_CATEGORIES.has(category) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) {
      return json(request, { error: "Datos de archivo invalidos." }, 400);
    }
    const objectName = storagePath.slice(invite.id.length + 1);
    const { data: storedObjects, error: storageError } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(invite.id, { search: objectName, limit: 2 });
    if (storageError || !storedObjects?.some((object) => object.name === objectName)) {
      return json(request, { error: "El archivo no termino de subirse." }, 409);
    }
    const { data, error } = await admin
      .from("onboarding_files")
      .insert({ invite_id: invite.id, storage_path: storagePath, original_name: safeFileName(input.fileName), mime_type: mimeType, size_bytes: sizeBytes, category })
      .select("id, original_name, mime_type, size_bytes, category, created_at")
      .single();
    if (error) return json(request, { error: "El archivo subio pero no pudo registrarse." }, 500);
    return json(request, { file: data });
  }

  if (input.action === "remove-file") {
    const { data: file } = await admin
      .from("onboarding_files")
      .select("id, storage_path")
      .eq("id", String(input.fileId || ""))
      .eq("invite_id", invite.id)
      .maybeSingle();
    if (!file) return json(request, { error: "Archivo no encontrado." }, 404);
    await admin.storage.from(STORAGE_BUCKET).remove([file.storage_path]);
    await admin.from("onboarding_files").delete().eq("id", file.id);
    return json(request, { removed: true });
  }

  return json(request, { error: "Accion no reconocida." }, 400);
});
