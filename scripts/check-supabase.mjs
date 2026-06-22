import { readFileSync } from "node:fs";

const requiredTables = [
  "businesses",
  "customer_profiles",
  "loyalty_accounts",
  "point_events",
  "reward_redemptions"
];

function parseEnv() {
  const raw = readFileSync(".env", "utf8");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index);
        const value = line.slice(index + 1).replace(/^"|"$/g, "");
        return [key, value];
      })
  );
}

async function checkTable(url, key, table) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  return {
    table,
    ok: response.ok,
    status: response.status,
    body: response.ok ? "" : await response.text()
  };
}

const env = parseEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const results = await Promise.all(requiredTables.map((table) => checkTable(supabaseUrl, publishableKey, table)));

for (const result of results) {
  const status = result.ok ? "ok" : `missing (${result.status})`;
  console.log(`${result.table}: ${status}`);
}

const failures = results.filter((result) => !result.ok);
if (failures.length) {
  console.error("\nSupabase loyalty schema is not ready. Apply supabase/migrations/20260622000100_loyalty_accounts.sql.");
  process.exit(1);
}

console.log("\nSupabase loyalty schema is ready.");
