import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

const configPath = resolve(process.cwd(), argValue("--config", "business.config.json"));
const allowTemplate = process.argv.includes("--allow-template");

function text(value) {
  return String(value || "").trim();
}

function add(list, code, message) {
  list.push({ code, message });
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    String(readFileSync(filePath, "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        return [key, value];
      })
  );
}

function urlHost(value) {
  try {
    return new URL(text(value)).host;
  } catch {
    return "";
  }
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const blockers = [];
  const warnings = [];
  const businessId = text(config.businessId);
  const slug = slugify(businessId);
  const publicAppUrl = text(config.publicAppUrl || config.qr?.defaultTarget);
  const targetConfig = join(root, "businesses", slug, "config.js");
  const generatedSeed = join(root, "supabase", "seed.client.generated.sql");
  const env = { ...readEnvFile(join(root, ".env")), ...readEnvFile(join(root, ".env.local")) };

  if (!businessId) add(blockers, "business_id_missing", "Falta businessId en el config.");
  if (slug !== businessId) add(blockers, "business_id_not_slugified", `businessId debe estar slugificado. Usa ${slug}.`);
  if (!publicAppUrl || !urlHost(publicAppUrl)) add(blockers, "public_url_missing", "Falta publicAppUrl o qr.defaultTarget valido.");

  if (!existsSync(targetConfig)) {
    add(allowTemplate ? warnings : blockers, "generated_config_missing", `Falta ${targetConfig}. Ejecuta npm run prepare:client -- --config ${configPath}.`);
  } else {
    const generated = await readFile(targetConfig, "utf8");
    if (!generated.includes(`config.businessId = ${JSON.stringify(businessId)}`)) {
      add(blockers, "generated_config_business_mismatch", `El config generado no parece corresponder a ${businessId}.`);
    }
    if (publicAppUrl && !generated.includes(publicAppUrl)) {
      add(warnings, "generated_config_url_mismatch", "El config generado no contiene la URL publica esperada; regenera con prepare:client.");
    }
  }

  if (!existsSync(generatedSeed)) {
    add(allowTemplate ? warnings : blockers, "generated_seed_missing", "Falta supabase/seed.client.generated.sql.");
  } else {
    const seed = await readFile(generatedSeed, "utf8");
    if (!seed.includes(`'${businessId.replace(/'/g, "''")}'`)) {
      add(blockers, "generated_seed_business_mismatch", "El seed generado no contiene el businessId esperado.");
    }
    if (!seed.includes("business_admins")) {
      add(warnings, "generated_seed_admins_missing", "El seed generado no incluye bloque business_admins; revisar owner/employees.");
    }
  }

  const migrationDir = join(root, "supabase", "migrations");
  const requiredMigrationMarkers = [
    "loyalty_accounts",
    "staff_consumption",
    "business_admin_dashboard",
    "reward_redemption_request_hardening",
    "staff_consumption_guardrails",
    "reward_redemptions_realtime"
  ];
  const migrationFiles = existsSync(migrationDir)
    ? readdirSync(migrationDir)
    : [];
  requiredMigrationMarkers.forEach((marker) => {
    if (!migrationFiles.some((file) => file.includes(marker))) {
      add(blockers, "migration_missing", `Falta migracion con marcador ${marker}.`);
    }
  });

  const envPublicUrl = text(env.VITE_PUBLIC_APP_URL);
  if (!envPublicUrl) {
    add(warnings, "env_public_url_missing", "Falta VITE_PUBLIC_APP_URL en .env/.env.local.");
  } else if (urlHost(envPublicUrl) !== urlHost(publicAppUrl)) {
    add(allowTemplate ? warnings : blockers, "env_public_url_mismatch", "VITE_PUBLIC_APP_URL no coincide con publicAppUrl.");
  }

  if (!text(env.VITE_SUPABASE_URL)) add(warnings, "env_supabase_url_missing", "Falta VITE_SUPABASE_URL para probar contra Supabase.");
  if (!text(env.VITE_SUPABASE_PUBLISHABLE_KEY)) add(warnings, "env_supabase_key_missing", "Falta VITE_SUPABASE_PUBLISHABLE_KEY para probar contra Supabase.");

  if (!allowTemplate && /tu-dominio|cliente-demo|nombre del negocio/i.test(`${publicAppUrl} ${businessId} ${config.brand?.name || ""}`)) {
    add(blockers, "template_values_present", "Todavia hay valores de plantilla en config real.");
  }

  const summary = {
    config: configPath,
    businessId,
    targetConfig,
    generatedSeed,
    publicAppUrl,
    envPublicUrl,
    migrationsChecked: requiredMigrationMarkers,
    blockers,
    warnings,
    ready: blockers.length === 0
  };

  console.log(JSON.stringify(summary, null, 2));
  if (blockers.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
