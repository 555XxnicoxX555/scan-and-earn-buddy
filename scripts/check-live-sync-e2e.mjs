import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path) {
  try {
    return Object.fromEntries(readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
      }));
  } catch {
    return {};
  }
}

const localEnv = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };
const url = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || localEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const businessId = process.env.SUMI_E2E_BUSINESS_ID || "sumi";

if (!url || !publishableKey || !serviceRoleKey) {
  console.error("check:live-sync:e2e requiere VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const listener = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const actor = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = randomUUID();
const email = `realtime-${runId}@e2e.sumi.business`;
const password = `Sumi-${runId}-A9!`;
const redemptionId = randomUUID();
let userId = "";
let customerId = "";

async function waitForProfile(authUserId) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data } = await service.from("customer_profiles").select("id").eq("auth_user_id", authUserId).eq("business_id", businessId).maybeSingle();
    if (data?.id) return data.id;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("El trigger de alta no creo el perfil E2E.");
}

async function cleanup() {
  if (userId) await service.from("point_events").delete().eq("recorded_by_auth_user_id", userId);
  if (redemptionId) await service.from("reward_redemptions").delete().eq("id", redemptionId);
  if (userId) await service.from("business_admins").delete().eq("auth_user_id", userId).eq("business_id", businessId);
  if (userId) await service.auth.admin.deleteUser(userId);
  await Promise.all([listener.removeAllChannels(), actor.removeAllChannels()]);
}

try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Realtime E2E" } });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  customerId = await waitForProfile(userId);

  const { data: account, error: accountError } = await service.from("loyalty_accounts").select("id").eq("customer_id", customerId).eq("business_id", businessId).single();
  if (accountError) throw accountError;
  const fixtureResults = await Promise.all([
    service.from("business_admins").upsert({ business_id: businessId, auth_user_id: userId, role: "manager" }, { onConflict: "business_id,auth_user_id" }),
    service.from("loyalty_accounts").update({ points_balance: 100 }).eq("id", account.id),
    service.from("reward_redemptions").insert({ id: redemptionId, customer_id: customerId, business_id: businessId, reward_id: `e2e-${runId}`, reward_name: "Premio E2E", points_cost: 10, status: "requested" })
  ]);
  const fixtureError = fixtureResults.find((result) => result.error)?.error;
  if (fixtureError) throw fixtureError;

  const credentials = { email, password };
  const [listenerLogin, actorLogin] = await Promise.all([
    listener.auth.signInWithPassword(credentials),
    actor.auth.signInWithPassword(credentials)
  ]);
  if (listenerLogin.error || actorLogin.error) throw listenerLogin.error || actorLogin.error;

  const realtimeEvent = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime no entrego el UPDATE en 30 segundos.")), 30000);
    let actionStarted = false;
    listener
      .channel(`sumi-e2e-${runId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reward_redemptions", filter: `business_id=eq.${businessId}` }, (payload) => {
        if (payload.new?.id !== redemptionId) return;
        clearTimeout(timeout);
        resolve({ eventType: payload.eventType, id: payload.new.id, status: payload.new.status });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !actionStarted) {
          actionStarted = true;
          const result = await actor.rpc("manage_reward_redemption_status", { target_business_id: businessId, target_redemption_id: redemptionId, next_status: "approved" });
          if (result.error) {
            clearTimeout(timeout);
            reject(result.error);
          }
        }
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          clearTimeout(timeout);
          reject(new Error(`Canal Realtime: ${status}`));
        }
      });
  });

  if (realtimeEvent.status !== "approved") throw new Error("Realtime entrego un estado inesperado.");
  console.log(JSON.stringify({ ready: true, businessId, actors: 2, eventType: realtimeEvent.eventType, status: realtimeEvent.status }, null, 2));
} finally {
  await cleanup();
}
