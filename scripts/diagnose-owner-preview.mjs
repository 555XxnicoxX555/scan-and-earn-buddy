import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SUMI_DIAGNOSTIC_URL || "http://127.0.0.1:4178";
const localAppData = process.env.LOCALAPPDATA || "";
const programFiles = process.env.ProgramFiles || "C:\\Program Files";
const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
const candidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
  join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
  localAppData && join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
  localAppData && join(localAppData, "ms-playwright", "chromium_headless_shell-1228", "chrome-headless-shell-win64", "chrome-headless-shell.exe"),
  localAppData && join(localAppData, "ms-playwright", "chromium_headless_shell-1200", "chrome-headless-shell-win64", "chrome-headless-shell.exe"),
].filter(Boolean);
const executablePath = candidates.find((candidate) => existsSync(candidate));
console.error(`[diagnose] launching Chromium${executablePath ? ` from ${executablePath}` : " via Playwright default"}`);
const browser = await chromium.launch({
  headless: true,
  timeout: 10000,
  ...(executablePath ? { executablePath } : {}),
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (process.env.SUMI_DIAGNOSTIC_NO_CSS === "true") {
    await page.route("**/styles.css", (route) => route.abort());
  }
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  let crashed = false;
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`));
  page.on("crash", () => { crashed = true; });

  let response = null;
  let navigationError = null;
  try {
    response = await page.goto(`${baseUrl}/?owner-preview=1&trace-init=1#/admin/menu`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
  } catch (error) {
    navigationError = error instanceof Error ? error.stack || error.message : String(error);
  }
  await page.waitForTimeout(1000);

  let state = null;
  let evaluationError = null;
  try {
    state = await Promise.race([
      page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        bodyClass: document.body.className,
        adminHidden: document.querySelector("#adminPanel")?.hidden ?? null,
        adminDisplay: document.querySelector("#adminPanel") ? getComputedStyle(document.querySelector("#adminPanel")).display : null,
        debugAvailable: typeof window.SumiDebug?.admin === "function",
        debug: typeof window.SumiDebug?.admin === "function" ? window.SumiDebug.admin() : null,
        ownerStorage: window.localStorage.getItem("sumi:dev-owner"),
        scriptSources: [...document.scripts].map((script) => script.src || "inline"),
      })),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Page evaluation timed out")), 5_000)),
    ]);
  } catch (error) {
    evaluationError = error instanceof Error ? error.stack || error.message : String(error);
  }

  console.log(JSON.stringify({
    httpStatus: response?.status() ?? null,
    navigationError,
    evaluationError,
    crashed,
    state,
    consoleMessages,
    pageErrors,
    failedRequests,
  }, null, 2));
} finally {
  await browser.close();
}
