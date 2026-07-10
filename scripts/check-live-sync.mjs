import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());

function add(list, code, message) {
  list.push({ code, message });
}

async function read(path) {
  return await readFile(path, "utf8");
}

function hasAll(source, markers) {
  return markers.filter((marker) => !source.includes(marker));
}

async function main() {
  const blockers = [];
  const warnings = [];
  const migrationDir = join(root, "supabase", "migrations");
  const migrationFiles = existsSync(migrationDir) ? await readdir(migrationDir) : [];
  const realtimeMigration = migrationFiles.find((file) => file.includes("reward_redemptions_realtime"));
  const appPath = join(root, "app.js");
  const setupPath = join(root, "SUPABASE_SETUP.md");
  const customizationPath = join(root, "CUSTOMIZATION.md");

  if (!realtimeMigration) {
    add(blockers, "realtime_migration_missing", "Falta migracion reward_redemptions_realtime.");
  } else {
    const sql = await read(join(migrationDir, realtimeMigration));
    hasAll(sql, [
      "alter table public.reward_redemptions replica identity full",
      "supabase_realtime",
      "alter publication supabase_realtime add table public.reward_redemptions"
    ]).forEach((marker) => add(blockers, "realtime_migration_marker_missing", `La migracion no contiene: ${marker}`));
  }

  const app = await read(appPath);
  hasAll(app, [
    "startAdminRealtime",
    "stopAdminRealtime",
    "scheduleAdminRealtimeRefresh",
    "adminRefreshIntervalMs = 7000",
    "table: \"reward_redemptions\"",
    "event: \"*\"",
    "Realtime activo",
    "polling activo"
  ]).forEach((marker) => add(blockers, "frontend_live_sync_marker_missing", `app.js no contiene: ${marker}`));

  if (!/adminRefreshTimer\s*=\s*window\.setInterval\(refreshAdminIfVisible,\s*adminRefreshIntervalMs\)/.test(app)) {
    add(blockers, "polling_interval_missing", "No se encontro el polling fallback cada adminRefreshIntervalMs.");
  }

  if (!/\.on\(\s*"postgres_changes"[\s\S]*reward_redemptions[\s\S]*scheduleAdminRealtimeRefresh/.test(app)) {
    add(blockers, "realtime_subscription_missing", "No se encontro suscripcion postgres_changes de reward_redemptions conectada a refresh.");
  }

  if (!/document\.hidden/.test(app)) {
    add(warnings, "visibility_guard_missing", "No se encontro guardia document.hidden para evitar refrescos invisibles.");
  }

  const setup = existsSync(setupPath) ? await read(setupPath) : "";
  const customization = existsSync(customizationPath) ? await read(customizationPath) : "";
  hasAll(`${setup}\n${customization}`, [
    "Supabase Realtime",
    "reward_redemptions",
    "polling"
  ]).forEach((marker) => add(warnings, "live_sync_docs_marker_missing", `Docs no mencionan: ${marker}`));

  const summary = {
    realtimeMigration: realtimeMigration || "",
    pollingMs: 7000,
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
