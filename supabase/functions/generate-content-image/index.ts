declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const CREDIT_COST = 2;
const STORAGE_BUCKET = "generated-content";

type EdgeRuntimeGlobal = typeof globalThis & {
  EdgeRuntime?: {
    waitUntil: (promise: Promise<unknown>) => void;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ImageInput = {
  action?: "start" | "finalize";
  businessId?: string;
  dish?: {
    id?: string;
    name?: string;
    category?: string;
    description?: string;
    price?: string;
    photo?: string;
    referenceImage?: string;
    referenceSource?: string;
    backgroundImage?: string;
    backgroundSource?: string;
  };
  format?: {
    id?: string;
    title?: string;
    meta?: string;
    aspectRatio?: string;
  };
  brief?: {
    instructions?: string;
    tone?: string;
    includePrice?: boolean;
    includeCta?: boolean;
    badgeText?: string;
    caption?: string;
    hashtags?: string;
    prompt?: string;
    toneLabel?: string;
    requestKey?: string;
  };
  task?: {
    taskId?: string;
    model?: string;
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

function runInBackground(promise: Promise<unknown>) {
  const runtime = (globalThis as EdgeRuntimeGlobal).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(promise);
    return;
  }
  promise.catch((error) => console.error("Background task failed", error));
}

class KieImageError extends Error {
  code = "kie_image_generation_failed";
}

function kieImageError(message: string) {
  return new KieImageError(message);
}

async function authenticatedUser(authHeader: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY
    }
  });

  if (!response.ok) return null;
  return await response.json() as { id?: string };
}

async function isBusinessAdmin(authHeader: string, businessId: string, userId: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment");
  }

  const query = new URL(`${SUPABASE_URL}/rest/v1/business_admins`);
  query.searchParams.set("business_id", `eq.${businessId}`);
  query.searchParams.set("auth_user_id", `eq.${userId}`);
  query.searchParams.set("role", "eq.owner");
  query.searchParams.set("select", "id");
  query.searchParams.set("limit", "1");

  const response = await fetch(query, {
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY
    }
  });

  if (!response.ok) return false;
  const rows = await response.json() as Array<{ id: string }>;
  return rows.length > 0;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ratioSize(aspectRatio = "1:1") {
  if (aspectRatio === "9:16") return "9:16";
  if (aspectRatio === "16:9") return "16:9";
  return "1:1";
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function currentPeriodMonth() {
  return new Date().toISOString().slice(0, 7);
}

function extractTaskId(payload: unknown) {
  const data = payload as Record<string, unknown>;
  const nestedData = data?.data as Record<string, unknown> | undefined;
  return safeString(data?.taskId)
    || safeString(data?.id)
    || safeString(nestedData?.taskId)
    || safeString(nestedData?.id);
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
      || firstUrlFrom(record.result)
      || firstUrlFrom(record.resultJson)
      || firstUrlFrom(record.output)
      || firstUrlFrom(record.response)
      || firstUrlFrom(record.data);
  }
  return "";
}

async function createKieImageTask(input: ImageInput) {
  const prompt = safeString(input.brief?.prompt);
  const referenceImage = await normalizedReferenceImage(input.dish?.referenceImage || input.dish?.photo);
  const backgroundImage = await normalizedReferenceImage(input.dish?.backgroundImage);
  const model = referenceImage ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image";
  const requestBody: Record<string, unknown> = {
    model,
    input: {
      prompt,
      aspect_ratio: ratioSize(input.format?.aspectRatio)
    }
  };

  const inputUrls = [referenceImage, backgroundImage].filter(Boolean);
  if (inputUrls.length) {
    (requestBody.input as Record<string, unknown>).input_urls = inputUrls;
  }

  const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Kie.ai image generation failed", response.status, body);
    throw kieImageError("Kie.ai image generation failed");
  }

  const taskId = extractTaskId(body);
  if (!taskId) {
    const immediateUrl = firstUrlFrom(body);
    if (immediateUrl) return { imageUrl: immediateUrl, taskId: "", model };
    console.error("Kie.ai image generation did not return a taskId", body);
    throw kieImageError("Missing Kie.ai taskId");
  }

  return { taskId, imageUrl: "", model };
}

async function normalizedReferenceImage(value: unknown) {
  const image = safeString(value);
  if (!image) return "";
  if (image.startsWith("http")) return image;
  if (image.startsWith("data:image/")) {
    return await uploadReferenceImageToKie(image);
  }
  return "";
}

async function uploadReferenceImageToKie(dataUrl: string) {
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
      uploadPath: "sumi/reference-images",
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

async function pollKieImageTask(taskId: string, maxAttempts = 90) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(attempt < 4 ? 2500 : 5000);
    const query = new URL("https://api.kie.ai/api/v1/jobs/recordInfo");
    query.searchParams.set("taskId", taskId);

    const response = await fetch(query, {
      headers: {
        Authorization: `Bearer ${KIE_API_KEY}`
      }
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Kie.ai image polling failed", response.status, body);
      continue;
    }

    const imageUrl = firstUrlFrom(body);
    if (imageUrl) return imageUrl;

    const status = safeString((body as Record<string, unknown>)?.status)
      || safeString((body as Record<string, unknown>)?.state)
      || safeString(((body as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.status)
      || safeString(((body as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.state);
    if (/fail|error|cancel/i.test(status)) {
      console.error("Kie.ai image task failed", body);
      throw kieImageError("Kie.ai image task failed");
    }
  }

  throw kieImageError("Kie.ai image task timed out");
}

async function callSupabaseRpc<T>(
  authHeader: string,
  functionName: string,
  payload: Record<string, unknown>
) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = safeString((body as { message?: unknown }).message) || `Supabase RPC ${functionName} failed`;
    throw new Error(message);
  }

  return body as T;
}

async function ensureCredits(authHeader: string, businessId: string) {
  return await callSupabaseRpc<{
    business_id: string;
    period_month: string;
    monthly_limit: number;
    credits_remaining: number;
  }>(authHeader, "ensure_business_ai_credit_balance", {
    target_business_id: businessId
  });
}

async function consumeCredits(authHeader: string, businessId: string, taskId: string) {
  return await callSupabaseRpc<{
    business_id: string;
    period_month: string;
    monthly_limit: number;
    credits_remaining: number;
  }>(authHeader, "consume_business_ai_credits", {
    target_business_id: businessId,
    credits_to_consume: CREDIT_COST,
    event_reason: "content_image_generation",
    kie_task_id: taskId
  });
}

async function uploadGeneratedImage(authHeader: string, businessId: string, imageUrl: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Could not fetch generated image");
  }

  const contentType = imageResponse.headers.get("Content-Type") || "image/png";
  const extension = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const objectPath = `${businessId}/${currentPeriodMonth()}/${crypto.randomUUID()}.${extension}`;
  const imageBytes = await imageResponse.arrayBuffer();
  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`, {
    method: "PUT",
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body: imageBytes
  });

  const uploadBody = await uploadResponse.text();
  if (!uploadResponse.ok) {
    console.error("Supabase Storage upload failed", uploadResponse.status, uploadBody);
    throw new Error("Could not store generated image");
  }

  return {
    storagePath: objectPath,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`
  };
}

async function insertGeneratedContentAsset(
  authHeader: string,
  userId: string,
  input: ImageInput,
  storedImage: { storagePath: string; publicUrl: string },
  task: { taskId: string; model: string }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment");
  }

  const payload = {
    business_id: safeString(input.businessId),
    auth_user_id: userId,
    dish_id: safeString(input.dish?.id) || null,
    dish_name: safeString(input.dish?.name),
    category: safeString(input.dish?.category) || null,
    format_id: safeString(input.format?.id),
    format_title: safeString(input.format?.title),
    caption: safeString(input.brief?.caption) || safeString(input.brief?.badgeText) || safeString(input.dish?.name),
    hashtags: safeString(input.brief?.hashtags),
    image_path: storedImage.storagePath,
    image_url: storedImage.publicUrl,
    source_photo: safeString(input.dish?.photo) || null,
    reference_photo_source: [safeString(input.dish?.referenceSource), safeString(input.dish?.backgroundSource)]
      .filter(Boolean)
      .join(" + ") || null,
    model: task.model,
    task_id: task.taskId,
    request_key: safeString(input.brief?.requestKey) || null,
    credits_used: CREDIT_COST
  };

  const insertUrl = new URL(`${SUPABASE_URL}/rest/v1/generated_content_assets`);
  insertUrl.searchParams.set("on_conflict", "business_id,task_id");
  const response = await fetch(insertUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Generated content asset insert failed", response.status, body);
    throw new Error("Could not save generated content asset");
  }

  return Array.isArray(body) ? body[0] : body;
}

async function findGeneratedContentAssetByTask(authHeader: string, businessId: string, taskId: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !taskId) return null;
  const query = new URL(`${SUPABASE_URL}/rest/v1/generated_content_assets`);
  query.searchParams.set("business_id", `eq.${businessId}`);
  query.searchParams.set("task_id", `eq.${taskId}`);
  query.searchParams.set("select", "*");
  query.searchParams.set("limit", "1");

  const response = await fetch(query, {
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY
    }
  });
  const body = await response.json().catch(() => []);
  if (!response.ok) {
    console.error("Generated content lookup failed", response.status, body);
    return null;
  }
  return Array.isArray(body) ? body[0] || null : null;
}

async function processGeneratedImageTask(
  authHeader: string,
  userId: string,
  input: ImageInput,
  task: { taskId: string; imageUrl: string; model: string }
) {
  try {
    const businessId = safeString(input.businessId);
    const existing = await findGeneratedContentAssetByTask(authHeader, businessId, task.taskId);
    if (existing) return;
    const imageUrl = task.imageUrl || await pollKieImageTask(task.taskId);
    const storedImage = await uploadGeneratedImage(authHeader, businessId, imageUrl);
    const existingAfterUpload = await findGeneratedContentAssetByTask(authHeader, businessId, task.taskId);
    if (existingAfterUpload) return;

    await insertGeneratedContentAsset(authHeader, userId, input, storedImage, {
      taskId: task.taskId,
      model: task.model
    });
    // Credits are consumed only after Kie.ai returns a real image and Storage keeps a copy.
    await consumeCredits(authHeader, businessId, task.taskId);
  } catch (error) {
    console.error("Background image generation failed", error);
  }
}

async function finalizeGeneratedImageTask(
  authHeader: string,
  userId: string,
  input: ImageInput,
  task: { taskId: string; model: string }
) {
  const businessId = safeString(input.businessId);
  const existing = await findGeneratedContentAssetByTask(authHeader, businessId, task.taskId);
  if (existing) return existing;

  let imageUrl = "";
  try {
    imageUrl = await pollKieImageTask(task.taskId, 2);
  } catch (error) {
    if (error instanceof KieImageError && /timed out/i.test(error.message)) {
      return null;
    }
    throw error;
  }

  const storedImage = await uploadGeneratedImage(authHeader, businessId, imageUrl);
  const existingAfterUpload = await findGeneratedContentAssetByTask(authHeader, businessId, task.taskId);
  if (existingAfterUpload) return existingAfterUpload;
  const asset = await insertGeneratedContentAsset(authHeader, userId, input, storedImage, {
    taskId: task.taskId,
    model: task.model
  });
  await consumeCredits(authHeader, businessId, task.taskId);
  return asset;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!KIE_API_KEY) {
    return jsonResponse({ error: "Missing KIE_API_KEY" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  let input: ImageInput;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const action = safeString(input.action) || "start";
  const businessId = safeString(input.businessId);
  const dishName = safeString(input.dish?.name);
  const prompt = safeString(input.brief?.prompt);
  if (!businessId || !dishName || !prompt) {
    return jsonResponse({ error: "Missing image generation input" }, 400);
  }

  try {
    const user = await authenticatedUser(authHeader);
    if (!user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const allowed = await isBusinessAdmin(authHeader, businessId, user.id);
    if (!allowed) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (action === "finalize") {
      const taskId = safeString(input.task?.taskId);
      if (!taskId) return jsonResponse({ error: "Missing taskId" }, 400);
      const asset = await finalizeGeneratedImageTask(authHeader, user.id, input, {
        taskId,
        model: safeString(input.task?.model) || "gpt-image-2-image-to-image"
      });
      if (!asset) {
        return jsonResponse({
          status: "processing",
          code: "kie_image_still_processing",
          taskId
        }, 202);
      }
      const creditBalance = await ensureCredits(authHeader, businessId).catch(() => null);
      return jsonResponse({
        status: "complete",
        taskId,
        asset,
        creditsRemaining: creditBalance?.credits_remaining,
        monthlyLimit: creditBalance?.monthly_limit,
        periodMonth: creditBalance?.period_month,
        source: "kie-ai"
      });
    }

    let creditBalance = await ensureCredits(authHeader, businessId);
    if (creditBalance.credits_remaining < CREDIT_COST) {
      return jsonResponse({
        error: "Insufficient AI credits",
        code: "insufficient_credits",
        creditsRemaining: creditBalance.credits_remaining,
        monthlyLimit: creditBalance.monthly_limit,
        periodMonth: creditBalance.period_month
      }, 402);
    }

    let task: { taskId: string; imageUrl: string; model: string };
    try {
      const createdTask = await createKieImageTask(input);
      task = {
        ...createdTask,
        taskId: createdTask.taskId || `immediate-${crypto.randomUUID()}`
      };
    } catch (error) {
      if (error instanceof KieImageError) {
        return jsonResponse({
          error: "Kie.ai no pudo iniciar la imagen. No se descontaron creditos.",
          code: error.code,
          creditsRemaining: creditBalance.credits_remaining,
          monthlyLimit: creditBalance.monthly_limit,
          periodMonth: creditBalance.period_month
        }, 502);
      }
      throw error;
    }

    runInBackground(processGeneratedImageTask(authHeader, user.id, input, task));
    return jsonResponse({
      status: "processing",
      taskId: task.taskId,
      model: task.model,
      creditsReserved: CREDIT_COST,
      creditsRemaining: creditBalance.credits_remaining,
      monthlyLimit: creditBalance.monthly_limit,
      periodMonth: creditBalance.period_month,
      source: "kie-ai"
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unexpected image generation error" }, 500);
  }
});
