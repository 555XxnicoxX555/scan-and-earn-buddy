import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "supabase", "migrations", "20260824000100_audited_reward_redemptions.sql");
const [migration, app] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(path.join(root, "app.js"), "utf8"),
]);

const checks = [];
function requireMatch(label, source, expression) {
  const passed = expression.test(source);
  checks.push({ label, passed });
  if (!passed) process.exitCode = 1;
}

requireMatch(
  "Las escrituras directas de canjes se revocan para public, anon y authenticated",
  migration,
  /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.reward_redemptions\s+from\s+public,\s*anon,\s*authenticated;/i,
);
requireMatch("Se eliminan las politicas heredadas de escritura", migration, /drop policy if exists "Customers can request own redemptions"[\s\S]*drop policy if exists "Business managers can update business redemptions"/i);
requireMatch("Los actores de auth se preservan como nulos al borrar una cuenta", migration, /references\s+auth\.users\(id\)\s+on delete set null/i);
requireMatch("El historial es append-only", migration, /create trigger reward_redemption_events_no_update[\s\S]*before update or delete/i);
requireMatch("El sistema queda identificado en cancelaciones automaticas", migration, /autoCancelledReason[\s\S]*actor_role\s*:=\s*'system'/i);
requireMatch("La cola de empleados esta limitada", migration, /get_staff_redemption_queue[\s\S]*limit\s+100/i);
requireMatch("La expiracion automatica se procesa por lotes", migration, /with expired as[\s\S]*limit\s+100[\s\S]*for update skip locked/i);
requireMatch("La cola y la expiracion tienen indices dedicados", migration, /reward_redemptions_staff_queue_idx[\s\S]*reward_redemptions_expiration_idx/i);
requireMatch("El contexto de solicitud tiene limite", migration, /pg_column_size\([\s\S]*8192/i);
requireMatch("Los empleados no pueden cancelar", migration, /next_status\s*=\s*'cancelled'\s+and\s+staff_role\s*=\s*'employee'/i);
requireMatch("La aprobacion valida premio activo y vigencia", migration, /if next_status = 'approved'[\s\S]*reward\.active[\s\S]*reward\.valid_until/i);
requireMatch("El historial completo requiere owner o manager", migration, /get_reward_redemption_history[\s\S]*is_business_manager\(target_business_id\)/i);
requireMatch("La interfaz usa el RPC con estado esperado", app, /rpc\("manage_reward_redemption_status_v2"[\s\S]*expected_status:\s*expectedStatus/i);
requireMatch("La interfaz pide confirmacion contextual", app, /window\.confirm\([\s\S]*Cliente:[\s\S]*Premio:[\s\S]*Puntos:[\s\S]*Acci[oó]n:/i);
requireMatch("La proteccion de doble accion siempre se libera", app, /finally\s*\{[\s\S]*redemptionActionInFlight\.delete\(redemptionId\)/i);
requireMatch("La interfaz trata vencimientos automaticos", app, /data\?\.expired[\s\S]*cancelada por el sistema/i);

for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.label}`);
}

if (process.exitCode) {
  throw new Error("La auditoria estatica de canjes encontro invariantes ausentes.");
}

console.log(`\n${checks.length} invariantes estaticos verificados sin red ni escrituras.`);
