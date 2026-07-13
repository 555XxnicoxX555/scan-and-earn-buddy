import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const requiredFiles = [
  "onboarding.html",
  "onboarding.css",
  "onboarding.js",
  "supabase/functions/onboarding-form/index.ts",
  "supabase/functions/onboarding-form/deno.json"
];
const blockers = [];

function requireMarkers(file, markers) {
  const path = join(root, file);
  if (!existsSync(path)) {
    blockers.push(`Falta ${file}.`);
    return;
  }
  const source = readFileSync(path, "utf8");
  markers.forEach((marker) => {
    if (!source.includes(marker)) blockers.push(`${file} no contiene ${marker}.`);
  });
}

requiredFiles.forEach((file) => {
  if (!existsSync(join(root, file))) blockers.push(`Falta ${file}.`);
});

requireMarkers("onboarding.html", ["ownerApp", "operatorConsole", "inviteDialog", "data-file-category"]);
requireMarkers("onboarding.js", ["request-upload", "uploadToSignedUrl", "platform_operators", "onboarding_invites", "hashchange"]);
requireMarkers("supabase/functions/onboarding-form/index.ts", ["cleanToken", "sha256", "MAX_PAYLOAD_BYTES", "business-onboarding-private"]);
requireMarkers("supabase/migrations/20260710091846_onboarding_b2b_and_manager.sql", ["platform_operators", "onboarding_invites", "onboarding_submissions", "enable row level security", "is_business_manager"]);

console.log(JSON.stringify({ files: requiredFiles, blockers, ready: blockers.length === 0 }, null, 2));
if (blockers.length) process.exit(1);
