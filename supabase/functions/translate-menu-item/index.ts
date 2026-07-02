const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const supportedLanguages = ["es", "en", "ar"] as const;

type SupportedLanguage = typeof supportedLanguages[number];

type TranslationInput = {
  businessId?: string;
  sourceLang?: SupportedLanguage;
  source?: {
    name?: string;
    description?: string;
  };
  targetLangs?: SupportedLanguage[];
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

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === "string" && supportedLanguages.includes(value as SupportedLanguage);
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

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output
    .flatMap((item) => Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [])
    .map((content) => {
      const part = content as { text?: unknown; output_text?: unknown };
      return typeof part.text === "string" ? part.text : typeof part.output_text === "string" ? part.output_text : "";
    })
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "Missing OPENAI_API_KEY" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  let input: TranslationInput;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const businessId = String(input.businessId || "").trim();
  const sourceLang = isSupportedLanguage(input.sourceLang) ? input.sourceLang : "es";
  const name = String(input.source?.name || "").trim();
  const description = String(input.source?.description || "").trim();
  const targetLangs = (Array.isArray(input.targetLangs) ? input.targetLangs : supportedLanguages)
    .filter(isSupportedLanguage);

  if (!businessId || (!name && !description)) {
    return jsonResponse({ error: "Missing translation input" }, 400);
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

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        input: [
          {
            role: "system",
            content: "Translate restaurant menu item copy. Preserve dish identity, culinary terms, proper nouns, and concise menu tone. Return valid JSON only."
          },
          {
            role: "user",
            content: JSON.stringify({
              sourceLang,
              targetLangs,
              item: { name, description },
              outputShape: {
                translations: {
                  es: { name: "string", description: "string" },
                  en: { name: "string", description: "string" },
                  ar: { name: "string", description: "string" }
                }
              }
            })
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "menu_item_translation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                translations: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    es: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["name", "description"]
                    },
                    en: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["name", "description"]
                    },
                    ar: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["name", "description"]
                    }
                  },
                  required: ["es", "en", "ar"]
                }
              },
              required: ["translations"]
            }
          }
        }
      })
    });

    const responseBody = await openaiResponse.json();
    if (!openaiResponse.ok) {
      console.error("OpenAI translation failed", openaiResponse.status, responseBody);
      return jsonResponse({ error: "OpenAI translation failed" }, 502);
    }

    const outputText = extractOutputText(responseBody);
    const parsed = JSON.parse(outputText);
    return jsonResponse(parsed);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unexpected translation error" }, 500);
  }
});
