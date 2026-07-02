const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const STORAGE_BUCKET = "generated-content";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ImproveInput = {
  businessId?: string;
  dish?: {
    id?: string;
    name?: string;
    category?: string;
    description?: string;
    productImage?: string;
  };
  background?: {
    description?: string;
    image?: string;
  };
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function currentPeriodMonth() {
  return new Date().toISOString().slice(0, 7);
}

function firstUrlFrom(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^https?:\/\//.test(trimmed)) return trimmed;
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return firstUrlFrom(JSON.parse(trimmed));
      } catch {
        return "";
      }
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstUrlFrom(item);
      if (url) return url;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return firstUrlFrom(record.url)
      || firstUrlFrom(record.imageUrl)
      || firstUrlFrom(record.downloadUrl)
      || firstUrlFrom(record.fileUrl)
      || firstUrlFrom(record.resultUrl)
      || firstUrlFrom(record.resultUrls)
      || firstUrlFrom(record.imageUrls)
      || firstUrlFrom(record.urls)
      || firstUrlFrom(record.resultJson)
      || firstUrlFrom(record.result)
      || firstUrlFrom(record.output)
      || firstUrlFrom(record.response)
      || firstUrlFrom(record.data);
  }
  return "";
}

function extractTaskId(payload: unknown) {
  const data = payload as Record<string, unknown>;
  const nestedData = data?.data as Record<string, unknown> | undefined;
  return safeString(data?.taskId)
    || safeString(data?.id)
    || safeString(nestedData?.taskId)
    || safeString(nestedData?.id);
}

async function authenticatedUser(authHeader: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Missing Supabase environment");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY }
  });
  if (!response.ok) return null;
  return await response.json() as { id?: string };
}

async function isBusinessAdmin(authHeader: string, businessId: string, userId: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Missing Supabase environment");
  const query = new URL(`${SUPABASE_URL}/rest/v1/business_admins`);
  query.searchParams.set("business_id", `eq.${businessId}`);
  query.searchParams.set("auth_user_id", `eq.${userId}`);
  query.searchParams.set("role", "eq.owner");
  query.searchParams.set("select", "id");
  query.searchParams.set("limit", "1");

  const response = await fetch(query, {
    headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY }
  });
  if (!response.ok) return false;
  const rows = await response.json() as Array<{ id: string }>;
  return rows.length > 0;
}

async function uploadReferenceImageToKie(dataUrl: string, folder: string) {
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) return "";

  const mimeType = match[1];
  const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const response = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      base64Data: dataUrl,
      uploadPath: folder,
      fileName: `reference-${crypto.randomUUID()}.${extension}`
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Kie.ai reference upload failed", response.status, body);
    return "";
  }
  return firstUrlFrom(body);
}

async function normalizedReferenceImage(value: unknown, folder: string) {
  const image = safeString(value);
  if (!image) return "";
  if (image.startsWith("http")) return image;
  if (image.startsWith("data:image/")) return await uploadReferenceImageToKie(image, folder);
  return "";
}

function buildPrompt(input: ImproveInput) {
  const dishName = safeString(input.dish?.name) || "producto";
  const category = safeString(input.dish?.category);
  const description = safeString(input.dish?.description);
  const background = safeString(input.background?.description) || "fondo gastronomico premium, calido y natural";
  return [
    `Mejorar la foto del producto "${dishName}" para menu digital.`,
    category ? `Categoria: ${category}.` : "",
    description ? `Descripcion del producto: ${description}.` : "",
    `Cambiar o acomodar el fondo segun esta descripcion: ${background}.`,
    `Conservar exactamente el producto principal: forma, ingredientes, toppings, textura, color, plato, porcion y detalles reconocibles.`,
    `No redibujar el producto, no cambiar ingredientes, no agregar toppings, no quitar elementos del plato y no alterar su identidad.`,
    `Solo se permiten ajustes de iluminacion, sombra, color grading, profundidad de campo, recorte y reemplazo o integracion de fondo.`,
    `Si hay imagen de fondo de referencia, usarla solo como entorno/estilo; el producto debe seguir viniendo de la foto original.`,
    `Resultado realista, fotografia gastronomica profesional, sin texto, sin logos, sin badges, sin marcas de agua.`
  ].filter(Boolean).join(" ");
}

async function createKieTask(input: ImproveInput) {
  const productUrl = await normalizedReferenceImage(input.dish?.productImage, "sumi/product-photo-source");
  if (!productUrl) throw new Error("Missing product image");
  const backgroundUrl = await normalizedReferenceImage(input.background?.image, "sumi/product-background-source");
  const inputUrls = backgroundUrl ? [productUrl, backgroundUrl] : [productUrl];

  const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-image-2-image-to-image",
      input: {
        prompt: buildPrompt(input),
        aspect_ratio: "16:9",
        input_urls: inputUrls
      }
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Kie.ai improve task failed", response.status, body);
    throw new Error("Kie.ai no pudo iniciar la mejora.");
  }

  const taskId = extractTaskId(body);
  if (!taskId) {
    const immediateUrl = firstUrlFrom(body);
    if (immediateUrl) return { taskId: `immediate-${crypto.randomUUID()}`, imageUrl: immediateUrl };
    console.error("Kie.ai improve task missing taskId", body);
    throw new Error("Kie.ai no devolvio una tarea valida.");
  }
  return { taskId, imageUrl: "" };
}

async function pollKieTask(taskId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await wait(attempt < 4 ? 2500 : 5000);
    const query = new URL("https://api.kie.ai/api/v1/jobs/recordInfo");
    query.searchParams.set("taskId", taskId);
    const response = await fetch(query, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Kie.ai improve polling failed", response.status, body);
      continue;
    }
    const imageUrl = firstUrlFrom(body);
    if (imageUrl) return imageUrl;
    const status = safeString((body as Record<string, unknown>)?.status)
      || safeString(((body as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.status);
    if (/fail|error|cancel/i.test(status)) throw new Error("Kie.ai no pudo completar la mejora.");
  }
  throw new Error("La mejora tardo demasiado.");
}

async function uploadImprovedImage(authHeader: string, businessId: string, imageUrl: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Missing Supabase environment");
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error("No se pudo descargar la imagen mejorada.");
  const contentType = imageResponse.headers.get("Content-Type") || "image/png";
  const extension = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const objectPath = `${businessId}/${currentPeriodMonth()}/product-photo-${crypto.randomUUID()}.${extension}`;
  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`, {
    method: "PUT",
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body: await imageResponse.arrayBuffer()
  });
  const uploadBody = await uploadResponse.text();
  if (!uploadResponse.ok) {
    console.error("Supabase upload improved photo failed", uploadResponse.status, uploadBody);
    throw new Error("No se pudo guardar la imagen mejorada.");
  }
  return {
    storagePath: objectPath,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!KIE_API_KEY) return jsonResponse({ error: "Missing KIE_API_KEY" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

  let input: ImproveInput;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const businessId = safeString(input.businessId);
  if (!businessId || !safeString(input.dish?.productImage)) {
    return jsonResponse({ error: "Missing product photo input" }, 400);
  }

  try {
    const user = await authenticatedUser(authHeader);
    if (!user?.id) return jsonResponse({ error: "Unauthorized" }, 401);
    if (!await isBusinessAdmin(authHeader, businessId, user.id)) return jsonResponse({ error: "Forbidden" }, 403);

    const task = await createKieTask(input);
    const imageUrl = task.imageUrl || await pollKieTask(task.taskId);
    const storedImage = await uploadImprovedImage(authHeader, businessId, imageUrl);
    return jsonResponse({
      imageUrl: storedImage.publicUrl,
      storagePath: storedImage.storagePath,
      originalImageUrl: imageUrl,
      taskId: task.taskId,
      model: "gpt-image-2-image-to-image",
      source: "kie-ai"
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "No se pudo mejorar la imagen." }, 500);
  }
});
