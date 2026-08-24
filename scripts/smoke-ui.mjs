import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SUMI_SMOKE_URL || "http://127.0.0.1:8080";
const devOwnerStorageKey = "sumi:dev-owner";
const menuSettingsStorageKey = "sumi:menu:habibi-bites:settings";
const localAppData = process.env.LOCALAPPDATA || "";
const explicitExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const programFiles = process.env.ProgramFiles || "C:\\Program Files";
const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
const knownChromiumShells = [
  explicitExecutable,
  join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
  join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
  localAppData && join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
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
    if (message.type() === "error") {
      const sourceUrl = message.location().url;
      consoleErrors.push(sourceUrl ? `${message.text()} :: ${sourceUrl}` : message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(`${baseUrl}/#/menu`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.SumiDebug?.admin === "function");
  const smokeEnvironment = await page.evaluate(() => window.SumiDebug.admin());
  if (!smokeEnvironment.remoteDisabled || smokeEnvironment.hasSupabase) {
    throw new Error("Smoke UI refused to run: start the app with VITE_DISABLE_REMOTE=true.");
  }

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

  await page.goto(`${baseUrl}/?employee-preview=1#/menu`, { waitUntil: "networkidle" });
  await page.waitForSelector("body.employee-workspace #staffConsumptionCard:not([hidden])");
  const employeeWorkspace = await page.evaluate(() => ({
    pageWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    menuTop: document.querySelector(".brand-switch")?.getBoundingClientRect().top ?? -1,
    menuAvailable: getComputedStyle(document.querySelector(".public-list")).display !== "none",
    scanVisible: Boolean(document.querySelector("#staffScanButton")?.offsetParent),
    manualVisible: Boolean(document.querySelector("#staffManualButton")?.offsetParent),
    lastConsumptionVisible: Boolean(document.querySelector("#staffLastConsumption")?.offsetParent),
    menuToolsHidden: getComputedStyle(document.querySelector(".menu-tools")).display === "none"
  }));
  if (employeeWorkspace.pageWidth > employeeWorkspace.viewportWidth) {
    throw new Error(`Employee workspace has horizontal overflow: ${employeeWorkspace.pageWidth}px > ${employeeWorkspace.viewportWidth}px.`);
  }
  if (!employeeWorkspace.menuAvailable || employeeWorkspace.menuTop < employeeWorkspace.viewportHeight) {
    throw new Error("Employee workspace did not place the public menu below the first viewport.");
  }
  if (!employeeWorkspace.scanVisible || !employeeWorkspace.manualVisible || !employeeWorkspace.lastConsumptionVisible || !employeeWorkspace.menuToolsHidden) {
    throw new Error("Employee workspace is missing an essential operational control or exposes non-essential header tools.");
  }
  await page.locator("#staffManualButton").click();
  await page.waitForSelector("#consumptionModal:not([hidden])");
  if (await page.locator("#consumptionCustomerPicker").getAttribute("hidden") !== null) {
    throw new Error("Employee manual customer lookup did not open in manual mode.");
  }
  await page.locator("#consumptionClose").click();
  await page.waitForFunction(() => document.querySelector("#consumptionModal")?.hidden);
  await page.goto(`${baseUrl}/#/menu`, { waitUntil: "networkidle" });

  await page.evaluate(
    ({ ownerKey, settingsKey }) => {
      window.localStorage.setItem(ownerKey, "true");
      window.localStorage.removeItem(settingsKey);
    },
    { ownerKey: devOwnerStorageKey, settingsKey: menuSettingsStorageKey }
  );
  // Force a full document navigation after leaving employee preview so body
  // classes and auth-derived surfaces are recalculated from the owner fixture.
  await page.goto(`${baseUrl}/?owner-preview=1#/admin/menu`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.SumiDebug?.admin === "function");
  const ownerFixture = await page.evaluate(() => ({
    url: window.location.href,
    debug: window.SumiDebug.admin(),
    bodyClass: document.body.className,
    adminHidden: document.querySelector("#adminPanel")?.hidden,
  }));
  if (!ownerFixture.debug.localDevOwner || !ownerFixture.debug.adminAccess) {
    throw new Error(`Local owner fixture was not authorized: ${JSON.stringify(ownerFixture)}`);
  }
  await page.waitForSelector("#adminPanel:not([hidden])");

  const mobileAdminRoutes = [
    ["home", "#adminHome"],
    ["customers", "#adminCustomersSection"],
    ["consumptions", "#adminConsumptionsSection"],
    ["menu", "#adminMenuSection"],
    ["content", "#adminContentSection"],
    ["library", "#adminLibrarySection"],
    ["rewards", "#adminRewardsSection"],
    ["qrs", "#adminQrsSection"],
    ["settings", "#adminSettingsSection"]
  ];
  for (const [route, sectionSelector] of mobileAdminRoutes) {
    await page.goto(`${baseUrl}/#/admin/${route}`, { waitUntil: "networkidle" });
    await page.waitForSelector(`${sectionSelector}:not([hidden])`);
    const layout = await page.evaluate((selector) => {
      const section = document.querySelector(selector);
      const panel = document.querySelector("#adminPanel");
      const sidebar = document.querySelector(".sidebar");
      const rect = section?.getBoundingClientRect();
      const panelRect = panel?.getBoundingClientRect();
      const sidebarRect = sidebar?.getBoundingClientRect();
      return {
        pageWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
        viewportWidth: window.innerWidth,
        sectionLeft: rect?.left ?? -1,
        sectionRight: rect?.right ?? -1,
        panelLeft: panelRect?.left ?? -1,
        panelRight: panelRect?.right ?? -1,
        sidebarLeft: sidebarRect?.left ?? -1,
        sidebarRight: sidebarRect?.right ?? -1
      };
    }, sectionSelector);
    if (layout.pageWidth > layout.viewportWidth) {
      throw new Error(`Mobile admin ${route} has page overflow: ${layout.pageWidth}px > ${layout.viewportWidth}px.`);
    }
    if (layout.sectionLeft < 0 || layout.sectionRight > layout.viewportWidth + 1 || layout.panelLeft < 0 || layout.panelRight > layout.viewportWidth + 1) {
      throw new Error(`Mobile admin ${route} content is outside the viewport.`);
    }
    if (layout.sidebarLeft < 0 || layout.sidebarRight > layout.viewportWidth + 1) {
      throw new Error(`Mobile admin ${route} navigation is outside the viewport.`);
    }
  }

  await page.goto(`${baseUrl}/#/admin/home`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminHome:not([hidden])");
  const visibleRecentRows = await page.locator("#homeRecentPanel .home-activity-row").count();
  if (visibleRecentRows > 3) {
    throw new Error(`Recent activity renders ${visibleRecentRows} rows initially; expected at most 3.`);
  }

  await page.goto(`${baseUrl}/#/admin/library`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminLibrarySection:not([hidden])");
  const activeLibraryFilterContrast = await page.locator("#adminLibraryFilters .admin-library-filter.is-active").first().evaluate((element) => {
    const parseRgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = (value) => {
      const channels = parseRgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const style = getComputedStyle(element);
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  if (activeLibraryFilterContrast < 4.5) {
    throw new Error(`Active library filter contrast is ${activeLibraryFilterContrast.toFixed(2)}; expected at least 4.5.`);
  }

  await page.goto(`${baseUrl}/#/admin/menu`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminMenuSection:not([hidden])");
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
  await page.waitForFunction(() => !document.querySelector("#editorPanel")?.classList.contains("open"));
  const backgroundTooltip = page.locator("#adminContentBackgroundTooltip");
  const staticTooltipText = await backgroundTooltip.getAttribute("data-tooltip");
  if (!staticTooltipText?.includes("Conserva el producto, el fondo y los objetos") || staticTooltipText.includes("Dinámico")) {
    throw new Error("Static background mode did not expose its contextual tooltip.");
  }
  await page.locator("#adminContentBackgroundMode").selectOption("dynamic");
  const dynamicTooltipText = await backgroundTooltip.getAttribute("data-tooltip");
  if (!dynamicTooltipText?.includes("cambie el ambiente del fondo") || dynamicTooltipText.includes("Estático")) {
    throw new Error("Dynamic background mode did not expose its contextual tooltip.");
  }
  await page.locator("#adminViewLibraryButton").click();
  await page.waitForURL(/#\/admin\/library/);
  await page.waitForSelector("#adminLibrarySection:not([hidden])");
  await page.goto(`${baseUrl}/#/admin/content`, { waitUntil: "networkidle" });
  await page.waitForSelector("#adminContentSection:not([hidden])");
  await page.waitForFunction(() => !document.querySelector("#editorPanel")?.classList.contains("open"));
  const createContentButton = page.locator("#adminCreateContentButton");
  if (await createContentButton.count() !== 1 || !await createContentButton.isEnabled()) {
    throw new Error("Content generation control is missing or disabled.");
  }
  // Deliberately do not click: a smoke test must never consume AI credits or
  // create remote tasks. The paid/write path is covered only by an explicitly
  // approved integration test with a dedicated fixture account.
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

  console.log(`Smoke UI passed: ${cardCount} public cards, search, language, signup modal, detail route, mobile overflow, admin guard, isolated employee workspace/manual lookup, all 9 mobile admin routes, recent activity limit, active filter contrast, contextual background tooltip, redemption disclosure/search/filter, create dish, recommend/popular, save, visibility, preview, content library, and delete checked.`);
} finally {
  await browser.close();
}
