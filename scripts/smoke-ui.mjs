import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SUMI_SMOKE_URL || "http://127.0.0.1:8080";
const devOwnerStorageKey = "sumi:dev-owner";
const menuSettingsStorageKey = "sumi:menu:habibi-bites:settings";
const localAppData = process.env.LOCALAPPDATA || "";
const explicitExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const knownChromiumShells = [
  explicitExecutable,
  localAppData && join(localAppData, "ms-playwright", "chromium_headless_shell-1228", "chrome-headless-shell-win64", "chrome-headless-shell.exe"),
  localAppData && join(localAppData, "ms-playwright", "chromium_headless_shell-1200", "chrome-headless-shell-win64", "chrome-headless-shell.exe")
].filter(Boolean);

const executablePath = knownChromiumShells.find((path) => existsSync(path));
const launchOptions = executablePath ? { executablePath } : {};
const browser = await chromium.launch({ headless: true, ...launchOptions });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(`${baseUrl}/#/menu`, { waitUntil: "networkidle" });
  await page.waitForSelector(".customer-dish-card");
  const cardCount = await page.locator(".customer-dish-card").count();
  if (cardCount < 1) throw new Error("Public menu did not render product cards.");

  await page.locator("#searchToggle").click();
  await page.locator("#searchInput").fill("hummus");
  const searchedCards = await page.locator(".customer-dish-card").count();
  if (searchedCards < 1) throw new Error("Search did not keep matching products visible.");
  await page.locator("#searchInput").fill("");

  const initialLang = await page.evaluate(() => document.documentElement.lang);
  await page.locator("#languageToggle").click();
  await page.waitForSelector("#languageMenu:not([hidden])");
  const languageChoices = page.locator('#languageMenu [data-enter-lang][aria-checked="false"]');
  if (await languageChoices.count() < 1) throw new Error("Language menu did not expose another language.");
  await languageChoices.first().click();
  const nextLang = await page.evaluate(() => document.documentElement.lang);
  if (initialLang === nextLang) throw new Error("Language menu did not update the document language.");

  await page.locator("#signupCta").click();
  await page.waitForSelector("#signupModal:not([hidden])");
  await page.locator("#signupModeToggle").click();
  const loginMode = await page.locator("#signupModal").getAttribute("data-mode");
  if (loginMode !== "login") throw new Error("Signup mode toggle did not switch to login mode.");
  await page.locator("#signupClose").click();
  await page.waitForFunction(() => document.querySelector("#signupModal")?.hidden);

  await page.locator(".customer-dish-card").first().click();
  await page.waitForURL(/#\/menu\//);
  await page.waitForFunction(() => document.querySelector("#detailView")?.classList.contains("open"));

  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  if (bodyWidth > viewportWidth) {
    throw new Error(`Mobile menu/detail has horizontal overflow: body ${bodyWidth}px > viewport ${viewportWidth}px.`);
  }

  await page.locator("#detailBack").click();
  await page.waitForURL("**/#/menu");

  await page.goto(`${baseUrl}/#/admin/menu`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const adminHash = await page.evaluate(() => window.location.hash);
  const adminVisible = await page.locator("#adminPanel:not([hidden])").count();
  if (adminHash !== "#/menu" || adminVisible !== 0) {
    throw new Error("Admin route without owner did not redirect safely to the public menu.");
  }

  await page.evaluate(
    ({ ownerKey, settingsKey }) => {
      window.localStorage.setItem(ownerKey, "true");
      window.localStorage.removeItem(settingsKey);
    },
    { ownerKey: devOwnerStorageKey, settingsKey: menuSettingsStorageKey }
  );
  await page.goto(`${baseUrl}/#/admin/menu`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminPanel:not([hidden])");
  await page.locator("#adminNewDishButton").click();
  await page.waitForURL("**/#/admin/menu/new/edit");
  await page.waitForSelector("#editorPanel.open");

  const dishName = `Smoke Platillo ${Date.now()}`;
  await page.locator("#dishName").fill(dishName);
  await page.locator("#dishDescription").fill("Producto creado por smoke test para validar el editor.");
  await page.locator(".presentation-row input[type='text']").first().fill("Plato");
  await page.locator(".presentation-row input[type='number']").first().fill("123");
  await page.locator("#addPresentationButton").click();
  await page.locator(".presentation-row input[type='text']").nth(1).fill("Grande");
  await page.locator(".presentation-row input[type='number']").nth(1).fill("245");
  await page.locator("#saveDishButton").click();
  await page.waitForURL(/#\/admin\/menu\/[^/]+\/edit/);
  await page.locator("#backButton").click();
  await page.waitForURL("**/#/admin/menu");
  await page.waitForSelector("#adminDishRows");
  const createdRows = await page.locator("#adminDishRows", { hasText: dishName }).count();
  if (createdRows < 1) throw new Error("Create dish flow did not add the product to the admin menu table.");

  const createdRow = page.locator("#adminDishRows .admin-dish-row", { hasText: dishName });
  const createdDishId = await createdRow.getAttribute("data-admin-dish");
  const recommendButtons = await page.locator("[data-admin-row-action='recommend']").count();
  const popularButtons = await page.locator("[data-admin-row-action='popular']").count();
  if (recommendButtons < 1 || popularButtons < 1) {
    throw new Error("Admin menu is missing recommend/popular row actions.");
  }
  await createdRow.locator("[data-admin-row-action='recommend']").click();
  await page.waitForFunction((name) => {
    const rows = [...document.querySelectorAll("#adminDishRows .admin-dish-row")];
    const row = rows.find((item) => item.textContent.includes(name));
    return row?.querySelector("[data-admin-row-action='recommend']")?.classList.contains("is-active");
  }, dishName);
  await createdRow.locator("[data-admin-row-action='popular']").click();
  await page.waitForFunction((name) => {
    const rows = [...document.querySelectorAll("#adminDishRows .admin-dish-row")];
    const row = rows.find((item) => item.textContent.includes(name));
    return row?.querySelector("[data-admin-row-action='popular']")?.classList.contains("is-active");
  }, dishName);
  if (createdDishId) {
    await page.goto(`${baseUrl}/#/menu/${createdDishId}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#detailView")?.classList.contains("open"));
    const popularDetail = await page.evaluate(() => {
      const favoriteCount = document.querySelector("#favoriteCount");
      return {
        text: favoriteCount?.innerText || "",
        popular: Boolean(favoriteCount?.querySelector(".like-indicator.is-popular")),
        saysMeGusta: (favoriteCount?.innerText || "").toLowerCase().includes("me gusta")
      };
    });
    if (!popularDetail.popular || popularDetail.saysMeGusta) {
      throw new Error("Popular detail did not render in the like slot without visible 'me gusta' text.");
    }
    await page.goto(`${baseUrl}/#/admin/menu`, { waitUntil: "networkidle" });
    await page.waitForSelector("#adminDishRows");
  }

  await createdRow.locator("[data-admin-row-action='visibility']").click();
  await page.waitForFunction((name) => {
    const rows = [...document.querySelectorAll("#adminDishRows .admin-dish-row")];
    const row = rows.find((item) => item.textContent.includes(name));
    return row?.textContent.includes("Oculto");
  }, dishName);
  await createdRow.locator("[data-admin-row-action='visibility']").click();
  await page.waitForFunction((name) => {
    const rows = [...document.querySelectorAll("#adminDishRows .admin-dish-row")];
    const row = rows.find((item) => item.textContent.includes(name));
    return row?.textContent.includes("Visible");
  }, dishName);

  await page.locator("#adminDishRows .admin-dish-row", { hasText: dishName }).locator("[data-admin-row-action='edit']").click();
  await page.waitForURL(/#\/admin\/menu\/[^/]+\/edit/);
  await page.locator("#previewDishButton").click();
  await page.waitForURL(/#\/admin\/menu\/[^/]+\/preview/);
  await page.waitForFunction(() => document.querySelector("#detailView")?.classList.contains("open"));
  await page.locator("#detailBack").click();
  await page.waitForURL(/#\/admin\/menu\/[^/]+\/edit/);

  await page.goto(`${baseUrl}/#/admin/content`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminContentSection:not([hidden])");
  await page.locator("#adminViewLibraryButton").click();
  await page.waitForURL(/#\/admin\/library/);
  await page.waitForSelector("#adminLibrarySection:not([hidden])");
  await page.goto(`${baseUrl}/#/admin/content`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminContentSection:not([hidden])");
  await page.locator("#adminCreateContentButton").click();
  await page.waitForFunction(() => {
    const preview = document.querySelector("#adminContentPreview");
    return preview?.textContent.includes("No se pudo generar") || preview?.textContent.includes("Sin creditos");
  });
  await page.goto(`${baseUrl}/#/admin/library`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminLibrarySection:not([hidden])");

  await page.goto(`${baseUrl}/#/admin/rewards`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminRewardsSection:not([hidden])");
  await page.locator("#adminRewardImageInput").setInputFiles("assets/menu/americano.png");
  await page.waitForFunction(() => {
    const preview = document.querySelector("#adminRewardImagePreview");
    return preview && !preview.classList.contains("is-empty") && preview.style.backgroundImage.includes("blob:");
  });
  const redemptionDisclosure = page.locator(".admin-redemptions-disclosure");
  if (await redemptionDisclosure.count() !== 1) throw new Error("Recent redemptions did not render as a disclosure section.");
  if (await redemptionDisclosure.evaluate((element) => element.open)) throw new Error("Recent redemptions should be collapsed initially.");
  await redemptionDisclosure.locator("summary").click();
  await page.waitForSelector("#adminRedemptionSearchInput:visible");
  await page.locator("#adminRedemptionSearchInput").fill("franco");
  const filteredRedemptionCount = await page.locator("#adminRedemptionsVisibleCount").innerText();
  if (!filteredRedemptionCount) throw new Error("Redemption search did not update its result count.");
  await page.locator("#adminRedemptionStatusFilter").selectOption("approved");
  const filteredStatus = await page.locator("#adminRedemptionStatusFilter").inputValue();
  if (filteredStatus !== "approved") throw new Error("Redemption status filter did not update.");

  await page.goto(`${baseUrl}/#/admin/menu`, { waitUntil: "networkidle" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#adminDishRows .admin-dish-row", { hasText: dishName }).locator("[data-admin-row-action='delete']").click();
  await page.waitForFunction((name) => !document.querySelector("#adminDishRows")?.textContent.includes(name), dishName);
  await page.evaluate(
    ({ ownerKey, settingsKey }) => {
      window.localStorage.removeItem(ownerKey);
      window.localStorage.removeItem(settingsKey);
    },
    { ownerKey: devOwnerStorageKey, settingsKey: menuSettingsStorageKey }
  );

  if (consoleErrors.length) {
    throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
  }

  console.log(`Smoke UI passed: ${cardCount} public cards, search, language, signup modal, detail route, mobile overflow, admin guard, redemption disclosure/search/filter, create dish, recommend/popular, save, visibility, preview, content library, and delete checked.`);
} finally {
  await browser.close();
}
