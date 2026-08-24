import { spawn } from "node:child_process";
import { join } from "node:path";

const host = "127.0.0.1";
const port = 4178;
const baseUrl = `http://${host}:${port}`;
const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const smokeScript = join(process.cwd(), "scripts", "smoke-ui.mjs");

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
}

async function waitForServer(url, child, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`El servidor aislado terminó con código ${child.exitCode}.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("El servidor aislado no respondió dentro del tiempo esperado.");
}

const server = run(process.execPath, [viteBin, "--host", host, "--port", String(port), "--strictPort"], {
  env: { ...process.env, VITE_DISABLE_REMOTE: "true" },
});

try {
  await waitForServer(baseUrl, server);
  const smoke = run(process.execPath, [smokeScript], {
    env: { ...process.env, SUMI_SMOKE_URL: baseUrl },
  });
  const exitCode = await new Promise((resolve, reject) => {
    smoke.once("error", reject);
    smoke.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  if (server.exitCode === null) server.kill("SIGTERM");
}
