import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

const businessConfig = window.SUMI_BUSINESS_CONFIG;

if (!businessConfig) {
  throw new Error("Missing SUMI_BUSINESS_CONFIG. Load a business config before app.js.");
}

const categoryOrder = businessConfig.categoryOrder;
const labels = businessConfig.labels;
const categoryLabels = businessConfig.categoryLabels;
const descriptionTranslations = businessConfig.descriptionTranslations;
const nameTranslations = businessConfig.nameTranslations;
const menuItems = businessConfig.menuItems;
const rewardCatalog = businessConfig.rewardCatalog;
const businessId = businessConfig.businessId || "business";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;
const brandSwitcher = businessConfig.brandSwitcher || Object.keys(categoryOrder).map((name) => ({ name, labels: {} }));
const languages = businessConfig.languages || [
  { code: "es", label: "Espanol", helper: "Continuar en espanol", flag: "mx", dir: "ltr" },
  { code: "en", label: "English", helper: "Continue in English", flag: "us", dir: "ltr" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", helper: "\u0645\u062a\u0627\u0628\u0639\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629", flag: "lb", dir: "rtl" }
];

let currentLang = businessConfig.defaultLang || "es";
let currentBrand = businessConfig.defaultBrand || brandSwitcher[0]?.name || Object.keys(categoryOrder)[0];
let currentCategory = businessConfig.defaultCategory || categoryOrder[currentBrand]?.[0];
let currentDetailId = businessConfig.defaultDetailId || menuItems[0]?.id;
let pointsBalance = businessConfig.initialPoints || 0;
let selectedPresentationIndex = 0;
let currentSession = null;
let currentCustomer = null;
let currentAdminView = "home";
const favoriteItems = new Set();
const dishList = document.querySelector("#dishList");
const searchInput = document.querySelector("#searchInput");
const categoryStrip = document.querySelector("#categoryStrip");
const categoryTitle = document.querySelector("#categoryTitle");
const categoryCount = document.querySelector("#categoryCount");
const detailView = document.querySelector("#detailView");
const detailPhoto = document.querySelector("#detailPhoto");
const detailCategory = document.querySelector("#detailCategory");
const detailName = document.querySelector("#detailName");
const detailArabic = document.querySelector("#detailArabic");
const detailDescription = document.querySelector("#detailDescription");
const detailOptions = document.querySelector("#detailOptions");
const pairings = document.querySelector("#pairings");
const recommendedCard = document.querySelector("#recommendedCard");
const shareButton = document.querySelector("#shareButton");
const favoriteButton = document.querySelector("#favoriteButton");
const brandSwitch = document.querySelector(".brand-switch");
let brandButtons = document.querySelectorAll("[data-brand]");
const restaurantName = document.querySelector(".restaurant-lockup strong");
const restaurantSubtitle = document.querySelector(".restaurant-lockup span");
const searchToggle = document.querySelector("#searchToggle");
const languageToggle = document.querySelector("#languageToggle");
const currentLanguageFlag = document.querySelector("#currentLanguageFlag");
const signupCta = document.querySelector("#signupCta");
const profileToggle = document.querySelector("#profileToggle");
const loyaltyCard = document.querySelector(".loyalty-card");
const pointsBalanceEl = document.querySelector("#pointsBalance");
const loyaltyKicker = document.querySelector("#loyaltyKicker");
const levelName = document.querySelector("#levelName");
const nextReward = document.querySelector("#nextReward");
const levelProgress = document.querySelector("#levelProgress");
const rewardStrip = document.querySelector("#rewardStrip");
const scanQrButton = document.querySelector("#scanQrButton");
const addPurchaseButton = document.querySelector("#addPurchaseButton");
const rewardsButton = document.querySelector("#rewardsButton");
const earnDetailPoints = document.querySelector("#earnDetailPoints");
const toast = document.querySelector("#toast");
const languageOptions = document.querySelector(".language-options");
const signupModal = document.querySelector("#signupModal");
const signupClose = document.querySelector("#signupClose");
const signupForm = document.querySelector("#signupForm");
const signupError = document.querySelector("#signupError");
const signupName = document.querySelector("#signupName");
const signupEmail = document.querySelector("#signupEmail");
const signupPassword = document.querySelector("#signupPassword");
const signupConfirm = document.querySelector("#signupConfirm");
const signupModeToggle = document.querySelector("#signupModeToggle");
const signupRecoveryButton = document.querySelector("#signupRecoveryButton");
const signupRecoveryText = document.querySelector("#signupRecoveryText");
const qrModal = document.querySelector("#qrModal");
const qrClose = document.querySelector("#qrClose");
const customerQrCanvas = document.querySelector("#customerQrCanvas");
const qrError = document.querySelector("#qrError");
const qrCustomerId = document.querySelector("#qrCustomerId");
const profileModal = document.querySelector("#profileModal");
const profileClose = document.querySelector("#profileClose");
const profileName = document.querySelector("#profileName");
const profileEmail = document.querySelector("#profileEmail");
const profilePoints = document.querySelector("#profilePoints");
const profileLevel = document.querySelector("#profileLevel");
const profileHistoryList = document.querySelector("#profileHistoryList");
const profileHistoryCount = document.querySelector("#profileHistoryCount");
const profileAdminButton = document.querySelector("#profileAdminButton");
const profileQrButton = document.querySelector("#profileQrButton");
const profileLogoutButton = document.querySelector("#profileLogoutButton");
const adminPanel = document.querySelector("#adminPanel");
const adminHome = document.querySelector("#adminHome");
const adminMenuSection = document.querySelector("#adminMenuSection");
const adminStats = document.querySelector("#adminStats");
const adminActions = document.querySelector("#adminActions");
const adminDishRows = document.querySelector("#adminDishRows");
const adminSearchInput = document.querySelector("#adminSearchInput");
const adminMenuCount = document.querySelector("#adminMenuCount");
const adminNavItems = document.querySelectorAll("[data-admin-nav]");
const adminGreeting = document.querySelector("#adminGreeting");
const adminSummary = document.querySelector("#adminSummary");
const adminSuggestionButton = document.querySelector("#adminSuggestionButton");
const editorPanel = document.querySelector("#editorPanel");
const backButton = document.querySelector("#backButton");
const editorTitle = document.querySelector("#editorTitle");
const dishNameInput = document.querySelector("#dishName");
const dishDescriptionInput = document.querySelector("#dishDescription");
const descCount = document.querySelector("#descCount");
const dishPhoto = document.querySelector("#dishPhoto");
const presentations = document.querySelector("#presentations");
const brandSelect = document.querySelector("#brandSelect");
const categorySelect = document.querySelector("#categorySelect");
const visibleToggle = document.querySelector("#visibleToggle");
let lastSignupTrigger = null;
let lastQrTrigger = null;
let lastProfileTrigger = null;
let signupMode = "register";
const customerStorageKey = `sumi:loyalty:${businessId}:customerId`;

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) element.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function fallbackId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCustomerId() {
  try {
    const existing = window.localStorage.getItem(customerStorageKey);
    if (existing) return existing;
    const next = window.crypto?.randomUUID?.() || fallbackId();
    window.localStorage.setItem(customerStorageKey, next);
    return next;
  } catch {
    return window.crypto?.randomUUID?.() || fallbackId();
  }
}

function numericCustomerSuffix(customerId) {
  const normalized = String(customerId || "").replace(/-/g, "");
  let hash = 0;
  for (const character of normalized) {
    hash = (hash * 31 + character.charCodeAt(0)) % 10000;
  }
  return String(hash).padStart(4, "0");
}

function visibleCustomerAlias(customerId) {
  const profileName = currentCustomer?.profile?.name || currentSession?.user?.user_metadata?.name || "Cliente";
  const firstName = String(profileName).trim().split(/\s+/)[0] || "Cliente";
  return `${firstName}-${numericCustomerSuffix(customerId)}`;
}

function customerQrPayload(customerId) {
  return JSON.stringify({
    type: "sumi-loyalty-customer",
    version: 1,
    businessId,
    customerId
  });
}

function isAuthenticated() {
  return Boolean(currentSession?.user && currentCustomer?.profile && currentCustomer?.account);
}

function isOwner() {
  return currentCustomer?.adminMembership?.role === "owner";
}

function displayError(error) {
  if (!error) return labels[currentLang].authGenericError;
  if (typeof error === "string") return error;
  const message = error.message ? String(error.message).trim() : "";
  if (message && message !== "{}") return message;
  if (error.status === 500 || error.name === "AuthRetryableFetchError") {
    return labels[currentLang].authEmailDeliveryError || labels[currentLang].authGenericError;
  }
  return labels[currentLang].authGenericError;
}

function tierLabel(tier) {
  const normalized = String(tier || "bronze").toLowerCase();
  const tierMap = {
    bronze: labels[currentLang].bronze,
    silver: labels[currentLang].silver,
    gold: labels[currentLang].gold,
    platinum: labels[currentLang].platinum || "Nivel Platino"
  };
  return tierMap[normalized] || tierMap.bronze;
}

function activeQrId() {
  return currentCustomer?.account?.public_qr_id || getCustomerId();
}

function authRedirectUrl() {
  if (publicAppUrl && !window.location.hostname.includes("localhost")) {
    return publicAppUrl.replace(/\/$/, "");
  }
  return `${window.location.origin}${window.location.pathname}`;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatEventDate(dateValue) {
  try {
    return new Intl.DateTimeFormat(currentLang === "en" ? "en-US" : "es-MX", {
      day: "2-digit",
      month: "short"
    }).format(new Date(dateValue));
  } catch {
    return "";
  }
}

function priceRange(dish) {
  const prices = dish.presentations.map((presentation) => Number(presentation.price)).filter(Number.isFinite);
  if (!prices.length) return "$0";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `$${min}` : `$${min} - $${max}`;
}

function visibleAdminItems() {
  const query = adminSearchInput?.value.trim().toLowerCase() || "";
  return menuItems.filter((dish) => {
    const haystack = `${dish.name} ${dish.description} ${dish.category} ${dish.brand}`.toLowerCase();
    return !query || haystack.includes(query);
  });
}

async function loadCustomerData(session = currentSession, options = {}) {
  if (!supabase || !session?.user) {
    currentCustomer = null;
    pointsBalance = 0;
    return null;
  }

  const retries = options.retries || 0;
  let profile = null;
  let profileError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await supabase
      .from("customer_profiles")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .eq("business_id", businessId)
      .maybeSingle();
    profile = result.data;
    profileError = result.error;
    if (profile || profileError || attempt === retries) break;
    await wait(350);
  }

  if (profileError) throw profileError;
  if (!profile) {
    currentCustomer = null;
    pointsBalance = 0;
    return null;
  }

  const [
    { data: account, error: accountError },
    { data: events, error: eventsError },
    { data: adminMembership, error: adminError }
  ] = await Promise.all([
    supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("customer_id", profile.id)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("point_events")
      .select("*")
      .eq("customer_id", profile.id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("business_admins")
      .select("business_id, role")
      .eq("auth_user_id", session.user.id)
      .eq("business_id", businessId)
      .eq("role", "owner")
      .maybeSingle()
  ]);

  if (accountError) throw accountError;
  if (eventsError) throw eventsError;
  if (adminError) throw adminError;

  currentCustomer = {
    profile,
    account,
    events: events || [],
    adminMembership
  };
  pointsBalance = account?.points_balance || 0;
  return currentCustomer;
}

function renderAuthState() {
  const authenticated = isAuthenticated();
  if (loyaltyCard) loyaltyCard.hidden = !authenticated;
  if (signupCta) signupCta.hidden = authenticated;
  if (profileToggle) {
    profileToggle.hidden = !authenticated;
    profileToggle.setAttribute("aria-label", labels[currentLang].profileButtonLabel || "Abrir perfil");
  }
}

function applyBusinessShell() {
  document.title = businessConfig.appTitle || document.title;

  setText(".venue", businessConfig.landing?.venue);
  setText(".seal-art", businessConfig.landing?.sealMark);
  setText(".logo-seal strong", businessConfig.landing?.primaryName);
  setText(".logo-seal span", businessConfig.landing?.secondaryName);
  setText(".language-screen h2", businessConfig.landing?.partnerName);
  setText(".cuisine", businessConfig.landing?.cuisine);
  document.querySelector(".logo-seal")?.setAttribute("aria-label", businessConfig.landing?.sealLabel || "");

  const footerItems = document.querySelectorAll(".language-footer > div");
  businessConfig.landing?.footer?.forEach((item, index) => {
    setText(`.language-footer > div:nth-child(${index + 1}) strong`, item.title);
    setText(`.language-footer > div:nth-child(${index + 1}) span`, item.text);
  });

  setText(".brand-mark", businessConfig.admin?.brandMark);
  setText(".brand strong", businessConfig.admin?.brandName);
  setText(".brand span", businessConfig.admin?.ownerLabel);
  setText(".help-box h3", businessConfig.admin?.helpTitle);
  setText(".help-box p", businessConfig.admin?.helpText);
  setText(".help-box button", businessConfig.admin?.helpButton);
  setText(".mini-logo", businessConfig.admin?.brandMark);

  languageOptions.innerHTML = languages
    .map(
      (language) => `
        <button class="language-option ${language.code === currentLang ? "selected" : ""}" data-enter-lang="${escapeAttribute(language.code)}" type="button">
          <span class="flag ${escapeAttribute(language.flag)}" aria-hidden="true"></span>
          <span dir="${escapeAttribute(language.dir || "ltr")}">
            <strong>${escapeHtml(language.label)}</strong>
            <small>${escapeHtml(language.helper)}</small>
          </span>
          <i aria-hidden="true">&rarr;</i>
        </button>
      `
    )
    .join("");

  brandSwitch.innerHTML = brandSwitcher
    .map(
      (brand) => `
        <button class="${brand.name === currentBrand ? "active" : ""}" data-brand="${escapeAttribute(brand.name)}" type="button" aria-pressed="${brand.name === currentBrand}">
          <strong>${escapeHtml(brand.name)}</strong>
          <span>${escapeHtml(brand.labels?.[currentLang] || brand.name)}</span>
        </button>
      `
    )
    .join("");
  brandButtons = document.querySelectorAll("[data-brand]");
}

function updateSignupShell() {
  const label = labels[currentLang];
  setText("#signupCtaText", label.signupCta || label.signupKicker);
  setText("#signupKicker", label.signupKicker);
  setText("#signupTitle", signupMode === "login" ? label.loginTitle : label.signupTitle);
  setText("#signupText", signupMode === "login" ? label.loginText : label.signupText);
  setText("#signupNameLabel", label.signupName);
  setText("#signupEmailLabel", label.signupEmail);
  setText("#signupPasswordLabel", label.signupPassword);
  setText("#signupConfirmLabel", label.signupConfirm);
  setText("#signupSubmit", signupMode === "login" ? label.loginSubmit : label.signupSubmit);
  setText("#signupSwitchPrompt", signupMode === "login" ? label.loginSwitchPrompt : label.signupSwitchPrompt);
  setText("#signupModeToggle", signupMode === "login" ? label.loginSwitchCta : label.signupSwitchCta);
  setText("#signupRecoveryPrompt", label.loginRecoveryPrompt);
  setText("#signupRecoveryButton", label.loginRecoveryCta);
  signupClose?.setAttribute("aria-label", label.signupClose || "Cerrar registro");
}

function updateProfileShell() {
  const label = labels[currentLang];
  setText("#profileKicker", label.profileKicker || "Mi cuenta");
  setText("#profileTitle", label.profileTitle || "Perfil de cliente");
  setText("#profilePointsLabel", label.profilePointsLabel || "Puntos disponibles");
  setText("#profileAdminButton", label.profileAdminPanel || "Panel de admin");
  setText("#profileQrButton", label.profileQr || "QR de cliente recurrente");
  setText("#profileLogoutButton", label.profileLogout || "Cerrar sesion");
  setText("#profileHistoryTitle", label.profileHistory || "Historial de puntos");
  profileClose?.setAttribute("aria-label", label.profileClose || "Cerrar perfil");
  profileToggle?.setAttribute("aria-label", label.profileButtonLabel || "Abrir perfil");
}

function setSignupMode(mode) {
  signupMode = mode;
  signupError.textContent = "";
  signupModal.dataset.mode = mode;
  const isLogin = mode === "login";
  signupModal.querySelectorAll("[data-signup-register-only]").forEach((element) => {
    element.hidden = isLogin;
    element.querySelectorAll("input").forEach((input) => {
      input.required = !isLogin;
      if (isLogin) input.value = "";
    });
  });
  signupRecoveryText.hidden = !isLogin;
  updateSignupShell();
}

function updateQrShell() {
  const label = labels[currentLang];
  setText("#qrKicker", label.qrKicker || label.loyalty);
  setText("#qrTitle", label.qrTitle || "Tu QR de cliente");
  setText("#qrText", label.qrText || "Muestra este codigo al empleado para acreditar tus puntos.");
  setText("#qrCustomerLabel", label.qrCustomerLabel || "ID de cliente");
  qrClose?.setAttribute("aria-label", label.qrClose || "Cerrar QR");
  scanQrButton?.setAttribute("aria-label", label.qrButtonLabel || "Mostrar QR de cliente");
}

async function renderCustomerQr() {
  const customerId = activeQrId();
  const label = labels[currentLang];
  qrCustomerId.textContent = visibleCustomerAlias(customerId);
  qrError.textContent = "";

  try {
    await QRCode.toCanvas(customerQrCanvas, customerQrPayload(customerId), {
      width: 192,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#461904",
        light: "#ffffff"
      }
    });
  } catch {
    qrError.textContent = label.qrError || "No se pudo generar el QR. Intenta de nuevo.";
  }
}

function localCategory(category) {
  return categoryLabels[currentLang]?.[category] || category;
}

function localName(dish) {
  return nameTranslations[currentLang]?.[dish.name] || dish.name;
}

function localDescription(dish) {
  return descriptionTranslations[currentLang]?.[dish.description] || dish.description;
}

function currentItems() {
  return menuItems.filter((dish) => dish.brand === currentBrand && dish.visible);
}

function currentLevel() {
  if (pointsBalance >= 2000) return { name: labels[currentLang].platinum || "Nivel Platino", next: null, floor: 2000, target: 2000 };
  if (pointsBalance >= 1000) return { name: labels[currentLang].gold, next: labels[currentLang].platinum || "Nivel Platino", floor: 1000, target: 2000 };
  if (pointsBalance >= 500) return { name: labels[currentLang].silver, next: labels[currentLang].gold, floor: 500, target: 1000 };
  return { name: labels[currentLang].bronze, next: labels[currentLang].silver, floor: 0, target: 500 };
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function openSignupModal(trigger = signupCta) {
  lastSignupTrigger = trigger;
  signupModal.hidden = false;
  document.body.classList.add("signup-open");
  setSignupMode("register");
  window.requestAnimationFrame(() => signupEmail.focus());
}

function closeSignupModal() {
  signupModal.hidden = true;
  document.body.classList.remove("signup-open");
  signupError.textContent = "";
  signupForm.reset();
  setSignupMode("register");
  lastSignupTrigger?.focus();
}

function openQrModal(trigger = scanQrButton) {
  if (!isAuthenticated()) {
    openSignupModal(trigger);
    return;
  }
  lastQrTrigger = trigger;
  qrModal.hidden = false;
  document.body.classList.add("qr-open");
  updateQrShell();
  renderCustomerQr();
  window.requestAnimationFrame(() => qrClose.focus());
}

function closeQrModal() {
  qrModal.hidden = true;
  document.body.classList.remove("qr-open");
  qrError.textContent = "";
  lastQrTrigger?.focus();
}

function openProfileModal(trigger = profileToggle) {
  if (!isAuthenticated()) {
    openSignupModal(trigger);
    return;
  }
  lastProfileTrigger = trigger;
  renderProfile();
  profileModal.hidden = false;
  document.body.classList.add("profile-open");
  window.requestAnimationFrame(() => profileClose.focus());
}

function closeProfileModal() {
  profileModal.hidden = true;
  document.body.classList.remove("profile-open");
  lastProfileTrigger?.focus();
}

function trapModalFocus(modal, event) {
  if (modal.hidden || event.key !== "Tab") return;
  const focusable = modal.querySelectorAll("button, input, [href], select, textarea, [tabindex]:not([tabindex='-1'])");
  const items = Array.from(focusable).filter((item) => !item.disabled && item.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function trapSignupFocus(event) {
  trapModalFocus(signupModal, event);
}

function trapQrFocus(event) {
  trapModalFocus(qrModal, event);
}

function trapProfileFocus(event) {
  trapModalFocus(profileModal, event);
}

function renderLoyalty() {
  renderAuthState();
  if (!isAuthenticated()) return;
  pointsBalance = currentCustomer.account?.points_balance || 0;
  const level = currentLevel();
  const progress = level.target === level.floor ? 100 : Math.min(100, ((pointsBalance - level.floor) / (level.target - level.floor)) * 100);
  loyaltyKicker.textContent = labels[currentLang].loyalty;
  pointsBalanceEl.textContent = pointsBalance;
  levelName.textContent = level.name;
  nextReward.textContent = level.next ? `${level.target - pointsBalance} pts para ${level.next.replace("Nivel ", "")}` : "Nivel maximo";
  levelProgress.style.width = `${progress}%`;
  addPurchaseButton.textContent = labels[currentLang].addPurchase;
  rewardsButton.textContent = labels[currentLang].rewards;
  earnDetailPoints.textContent = labels[currentLang].earnDetail;
  rewardStrip.innerHTML = rewardCatalog
    .map(
      (reward) => `
        <button class="reward-chip ${pointsBalance >= reward.cost ? "available" : ""}" data-reward="${escapeAttribute(reward.id)}" type="button">
          <strong>${escapeHtml(reward.name)}</strong>
          <span>${escapeHtml(reward.cost)} pts</span>
        </button>
      `
    )
    .join("");
}

function recommendedDish() {
  const recommendedId = businessConfig.recommendedByBrand?.[currentBrand] || currentItems()[0]?.id;
  return menuItems.find((dish) => dish.id === recommendedId) || currentItems()[0];
}

function updateHeader() {
  const language = languages.find((item) => item.code === currentLang);
  restaurantName.textContent = currentBrand;
  restaurantSubtitle.textContent = labels[currentLang].subtitles[currentBrand];
  searchInput.placeholder = labels[currentLang].search;
  document.documentElement.lang = currentLang;
  document.body.dir = language?.dir || "ltr";
  if (currentLanguageFlag && language?.flag) {
    currentLanguageFlag.className = `header-flag flag ${language.flag}`;
  }
  languageToggle?.setAttribute("aria-label", `${labels[currentLang].changeLanguage || "Cambiar idioma"}: ${language?.label || currentLang}`);
  renderAuthState();

  brandButtons.forEach((button) => {
    const active = button.dataset.brand === currentBrand;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    const brand = brandSwitcher.find((item) => item.name === button.dataset.brand);
    button.querySelector("span").textContent = brand?.labels?.[currentLang] || button.dataset.brand;
  });
}

function renderCategories() {
  const items = currentItems();
  const categories = categoryOrder[currentBrand];
  categoryStrip.innerHTML = categories
    .map((category) => {
      const count = items.filter((dish) => dish.category === category).length;
      return `<button class="${category === currentCategory ? "active" : ""}" data-category="${escapeAttribute(category)}" type="button" aria-pressed="${category === currentCategory}">${escapeHtml(localCategory(category))} &middot; ${count}</button>`;
    })
    .join("");
}

function renderRecommendation() {
  const dish = recommendedDish();
  const prices = dish.presentations.map((p) => `<b>${escapeHtml(p.name)} $${escapeHtml(p.price)}</b>`).join("");
  document.querySelector(".recommendation p").textContent = labels[currentLang].recommended;
  recommendedCard.dataset.id = dish.id;
  recommendedCard.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.75)), url('${dish.photo}')`;
  recommendedCard.innerHTML = `
    <span class="badge">${escapeHtml(labels[currentLang].badge)}</span>
    <strong>${escapeHtml(localName(dish))}</strong>
    <small>${escapeHtml(localDescription(dish))}</small>
    <span class="hero-prices">${prices}</span>
  `;
}

function renderList() {
  const query = searchInput.value.trim().toLowerCase();
  const items = currentItems();
  const filtered = items.filter((dish) => {
    const haystack = `${dish.name} ${dish.description} ${dish.category} ${localName(dish)} ${localDescription(dish)} ${localCategory(dish.category)}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesCategory = query || dish.category === currentCategory;
    return matchesQuery && matchesCategory;
  });

  renderCategories();
  renderRecommendation();
  renderLoyalty();
  renderProfile();
  renderAdminPanel();
  updateHeader();

  categoryTitle.textContent = query ? labels[currentLang].results : localCategory(currentCategory);
  categoryCount.textContent = `${filtered.length} ${labels[currentLang].dishes}`;

  dishList.innerHTML = filtered.length
    ? filtered
        .map((dish) => {
          const firstPresentation = dish.presentations[0];
          return `
            <button class="customer-dish-card" data-id="${escapeAttribute(dish.id)}" type="button">
              <span class="customer-thumb" style="background-image:url('${dish.photo}')"></span>
              <span class="customer-info">
                <strong>${escapeHtml(localName(dish))}</strong>
                <small>${escapeHtml(localDescription(dish))}</small>
                <b>${escapeHtml(firstPresentation.name)} &middot; $${escapeHtml(firstPresentation.price)}</b>
              </span>
            </button>
          `;
        })
        .join("")
    : `<div class="empty-state" role="status">${escapeHtml(labels[currentLang].empty || "No hay productos para mostrar.")}</div>`;
}

function renderProfile() {
  updateProfileShell();
  renderAuthState();
  if (!isAuthenticated()) return;

  const profile = currentCustomer.profile;
  const account = currentCustomer.account;
  const level = currentLevel();
  profileName.textContent = profile.name || labels[currentLang].profileTitle || "Cliente";
  profileEmail.textContent = profile.email || currentSession.user.email || "";
  profilePoints.textContent = account.points_balance || 0;
  profileLevel.textContent = level.name;
  profileAdminButton.hidden = !isOwner();
  profileHistoryCount.textContent = currentCustomer.events.length;
  profileHistoryList.innerHTML = currentCustomer.events.length
    ? currentCustomer.events
        .map((event) => {
          const sign = event.points_delta > 0 ? "+" : "";
          return `
            <div class="profile-event">
              <span>
                <strong>${escapeHtml(event.description || event.event_type)}</strong>
                <small>${escapeHtml(formatEventDate(event.created_at))}</small>
              </span>
              <b>${sign}${escapeHtml(event.points_delta)} pts</b>
            </div>
          `;
        })
        .join("")
    : `<p class="profile-empty">${escapeHtml(labels[currentLang].profileHistoryEmpty || "Todavia no hay movimientos.")}</p>`;
}

function renderAdminHome() {
  if (!adminPanel) return;
  const ownerName = currentCustomer?.profile?.name || "Owner";
  const activeItems = menuItems.filter((dish) => dish.visible);
  const hiddenItems = menuItems.length - activeItems.length;
  const topDish = recommendedDish();
  const generatedCount = Math.max(8, Math.round(menuItems.length / 3));

  adminGreeting.textContent = `Buenos dias, ${ownerName}`;
  adminSummary.innerHTML = `Tu menu se vio <strong>347 veces</strong> ayer. Aqui esta el resumen.`;
  adminStats.innerHTML = `
    <article class="admin-stat"><span>Vistas al menu</span><strong>2,184</strong><small>+18% esta semana</small></article>
    <article class="admin-stat"><span>Platillo mas visto</span><strong>${escapeHtml(topDish?.name || "Sin datos")}</strong><small>412 vistas</small></article>
    <article class="admin-stat"><span>Contenido generado</span><strong>${generatedCount} piezas</strong><small>este mes</small></article>
    <article class="admin-stat"><span>Productos en menu</span><strong>${menuItems.length}</strong><small>${hiddenItems} ocultos o agotados</small></article>
  `;
  adminActions.innerHTML = `
    <button type="button" data-admin-action="content"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg></span><strong>Crear post para Instagram</strong><small>Foto + copy con IA · 30s</small></button>
    <button type="button" data-admin-action="soldout"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-menu"></use></svg></span><strong>Marcar un platillo como agotado</strong><small>Se oculta automaticamente</small></button>
    <button type="button" data-admin-action="new"><span>+</span><strong>Agregar un producto nuevo</strong><small>Con traduccion automatica</small></button>
    <button type="button" data-admin-action="prices"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-settings"></use></svg></span><strong>Cambiar precio masivo</strong><small>Toda una categoria a la vez</small></button>
  `;
}

function renderAdminMenu() {
  if (!adminDishRows) return;
  const items = visibleAdminItems();
  adminMenuCount.textContent = items.length;
  adminDishRows.innerHTML = items
    .map((dish) => `
      <button class="dish-row admin-dish-row ${dish.visible ? "" : "is-hidden"}" data-admin-dish="${escapeAttribute(dish.id)}" type="button">
        <span class="dish-title">
          <span class="thumb" style="background-image:url('${dish.photo}')"></span>
          <span class="dish-name">${escapeHtml(dish.name)}</span>
        </span>
        <span class="cell-muted">${escapeHtml(dish.category)}</span>
        <span class="pill">${escapeHtml(dish.brand)}</span>
        <span class="cell-muted">${escapeHtml(priceRange(dish))}</span>
        <span class="status">${dish.visible ? "Visible" : "Oculto"}</span>
        <span class="row-actions" aria-hidden="true">
          <span class="icon-button"><span class="eye-icon"></span></span>
          <span class="icon-button"><span class="pencil-icon"></span></span>
        </span>
      </button>
    `)
    .join("");
}

function renderAdminPanel() {
  if (!isOwner()) return;
  renderAdminHome();
  renderAdminMenu();
}

function setAdminView(view) {
  currentAdminView = view === "menu" ? "menu" : "home";
  adminHome.hidden = currentAdminView !== "home";
  adminMenuSection.hidden = currentAdminView !== "menu";
  adminNavItems.forEach((item) => {
    const active = item.dataset.adminNav === currentAdminView;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
}

function openAdminPanel(view = "home") {
  if (!isOwner()) {
    showToast("Esta cuenta no tiene permisos de owner.");
    return;
  }
  closeProfileModal();
  detailView.classList.remove("open");
  editorPanel.classList.remove("open");
  document.body.classList.remove("landing-active");
  document.body.classList.add("admin-active");
  adminPanel.hidden = false;
  setAdminView(view);
  renderAdminPanel();
  window.requestAnimationFrame(() => adminPanel.focus?.());
}

function closeAdminPanel() {
  document.body.classList.remove("admin-active");
  adminPanel.hidden = true;
  editorPanel.classList.remove("open");
  renderList();
}

function openAdminEditor(dishId) {
  const dish = menuItems.find((item) => item.id === dishId) || menuItems[0];
  if (!dish) return;
  editorTitle.textContent = dish.name;
  dishNameInput.value = dish.name;
  dishDescriptionInput.value = dish.description;
  descCount.textContent = dish.description.length;
  dishPhoto.style.backgroundImage = `url('${dish.photo}')`;
  visibleToggle.checked = Boolean(dish.visible);
  brandSelect.innerHTML = brandSwitcher
    .map((brand) => `<option value="${escapeAttribute(brand.name)}" ${brand.name === dish.brand ? "selected" : ""}>${escapeHtml(brand.name)}</option>`)
    .join("");
  categorySelect.innerHTML = Array.from(new Set(Object.values(categoryOrder).flat()))
    .map((category) => `<option value="${escapeAttribute(category)}" ${category === dish.category ? "selected" : ""}>${escapeHtml(category)}</option>`)
    .join("");
  presentations.innerHTML = dish.presentations
    .map((presentation) => `
      <div class="presentation-row">
        <span class="drag-handle">::</span>
        <input type="text" value="${escapeAttribute(presentation.name)}" aria-label="Presentacion" />
        <label><span>$</span><input type="number" value="${escapeAttribute(presentation.price)}" aria-label="Precio" /></label>
        <button class="delete-presentation" type="button" aria-label="Eliminar presentacion">x</button>
      </div>
    `)
    .join("");
  editorPanel.classList.add("open");
}

async function refreshAuthenticatedCustomer() {
  if (!currentSession?.user) {
    currentCustomer = null;
    pointsBalance = 0;
    renderList();
    return;
  }

  try {
    await loadCustomerData(currentSession, { retries: 4 });
  } catch (error) {
    currentCustomer = null;
    pointsBalance = 0;
    showToast(displayError(error));
  }
  renderList();
}

async function handleSession(session) {
  currentSession = session;
  if (!session?.user) {
    currentCustomer = null;
    pointsBalance = 0;
    closeAdminPanel();
    renderAuthState();
    renderList();
    return;
  }
  await refreshAuthenticatedCustomer();
}

async function initializeAuth() {
  if (!supabase) {
    renderAuthState();
    renderList();
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) showToast(displayError(error));
  await handleSession(data?.session || null);

  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      handleSession(session);
    }, 0);
  });
}

function openDetail(id) {
  const dish = menuItems.find((item) => item.id === id);
  if (!dish) return;
  currentDetailId = id;
  selectedPresentationIndex = 0;
  detailPhoto.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.78)), url('${dish.photo}')`;
  detailCategory.textContent = localCategory(dish.category);
  detailName.textContent = localName(dish);
  detailArabic.textContent = nameTranslations.ar[dish.name] || "";
  detailDescription.textContent = localDescription(dish);
  shareButton.dataset.shareId = dish.id;
  favoriteButton.dataset.favoriteId = dish.id;
  favoriteButton.classList.toggle("active", favoriteItems.has(dish.id));
  favoriteButton.setAttribute("aria-pressed", String(favoriteItems.has(dish.id)));
  detailOptions.innerHTML = dish.presentations
    .map(
      (presentation, index) => `
        <button class="detail-option ${index === 0 ? "selected" : ""}" data-presentation-index="${index}" type="button" aria-pressed="${index === 0}">
          <span></span>
          <strong>${escapeHtml(presentation.name)}</strong>
          <small>${escapeHtml(presentation.note || "Presentacion disponible")}</small>
          <b>$${escapeHtml(presentation.price)}</b>
        </button>
      `
    )
    .join("");

  document.querySelectorAll(".detail-content h2")[0].textContent = labels[currentLang].choose;
  document.querySelectorAll(".detail-content h2")[1].textContent = labels[currentLang].pairings;
  document.querySelector(".detail-chip").textContent = labels[currentLang].badge;
  earnDetailPoints.textContent = labels[currentLang].earnDetail;

  pairings.innerHTML = menuItems
    .filter((item) => item.visible && item.brand === dish.brand)
    .filter((item) => item.id !== dish.id)
    .slice(0, 6)
    .map(
      (item) => `
        <button class="pairing-card" data-id="${escapeAttribute(item.id)}" type="button">
          <span style="background-image:url('${item.photo}')"></span>
          <strong>${escapeHtml(localName(item))}</strong>
          <b>$${escapeHtml(item.presentations[0].price)}</b>
        </button>
      `
    )
    .join("");

  detailView.classList.add("open");
}

languageOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-enter-lang]");
  if (!button) return;
  currentLang = button.dataset.enterLang;
  document.body.classList.remove("landing-active");
  updateSignupShell();
  updateQrShell();
  updateProfileShell();
  renderList();
});

signupCta.addEventListener("click", () => openSignupModal(signupCta));
signupClose.addEventListener("click", closeSignupModal);
signupModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-signup-close]")) closeSignupModal();
});

signupModeToggle.addEventListener("click", () => {
  setSignupMode(signupMode === "login" ? "register" : "login");
  window.requestAnimationFrame(() => signupEmail.focus());
});

signupRecoveryButton.addEventListener("click", async () => {
  const label = labels[currentLang];
  const email = signupEmail.value.trim().toLowerCase();
  signupError.textContent = "";
  if (!email.endsWith("@gmail.com")) {
    signupError.textContent = label.signupInvalidEmail;
    signupEmail.focus();
    return;
  }
  if (!supabase) {
    signupError.textContent = label.authGenericError;
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl()
  });
  if (error) {
    signupError.textContent = displayError(error);
    return;
  }
  showToast(label.loginRecoverySent || "Te enviaremos instrucciones para recuperar tu contrasena.");
});

qrClose.addEventListener("click", closeQrModal);
qrModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-qr-close]")) closeQrModal();
});

profileToggle.addEventListener("click", () => openProfileModal(profileToggle));
profileClose.addEventListener("click", closeProfileModal);
profileModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-profile-close]")) closeProfileModal();
});

profileQrButton.addEventListener("click", () => {
  closeProfileModal();
  openQrModal(profileQrButton);
});

profileAdminButton.addEventListener("click", () => openAdminPanel("home"));

adminNavItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    const view = item.dataset.adminNav;
    if (view === "home" || view === "menu") {
      openAdminPanel(view);
      return;
    }
    showToast("Seccion preparada para la siguiente fase.");
  });
});

adminActions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  if (button.dataset.adminAction === "new" || button.dataset.adminAction === "soldout" || button.dataset.adminAction === "prices") {
    openAdminPanel("menu");
    return;
  }
  showToast("Generacion con IA preparada para la siguiente fase.");
});

adminSuggestionButton.addEventListener("click", () => {
  showToast("Generacion con IA preparada para la siguiente fase.");
});

adminSearchInput.addEventListener("input", renderAdminMenu);

adminDishRows.addEventListener("click", (event) => {
  const row = event.target.closest("[data-admin-dish]");
  if (!row) return;
  openAdminEditor(row.dataset.adminDish);
});

backButton.addEventListener("click", () => {
  editorPanel.classList.remove("open");
  openAdminPanel("menu");
});

dishDescriptionInput.addEventListener("input", () => {
  descCount.textContent = dishDescriptionInput.value.length;
});

profileLogoutButton.addEventListener("click", async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    showToast(displayError(error));
    return;
  }
  closeProfileModal();
  currentSession = null;
  currentCustomer = null;
  renderList();
  showToast(labels[currentLang].profileLoggedOut || "Sesion cerrada");
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const label = labels[currentLang];
  const email = signupEmail.value.trim().toLowerCase();
  signupError.textContent = "";

  if (!email.endsWith("@gmail.com")) {
    signupError.textContent = label.signupInvalidEmail;
    signupEmail.focus();
    return;
  }

  if (!supabase) {
    signupError.textContent = label.authGenericError;
    return;
  }

  if (signupMode === "login") {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: signupPassword.value
    });
    if (error) {
      signupError.textContent = displayError(error);
      return;
    }
    await handleSession(data.session);
    closeSignupModal();
    showToast(label.loginWelcome || "Sesion iniciada");
    return;
  }

  if (signupPassword.value !== signupConfirm.value) {
    signupError.textContent = label.signupPasswordMismatch;
    signupConfirm.focus();
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: signupPassword.value,
    options: {
      data: {
        name: signupName.value.trim(),
        business_id: businessId
      },
      emailRedirectTo: authRedirectUrl()
    }
  });

  if (error) {
    signupError.textContent = displayError(error);
    return;
  }

  if (data.session) {
    await handleSession(data.session);
    showToast(label.signupWelcome || "Cuenta creada");
  } else {
    showToast(label.authSignupCheckEmail || "Revisa tu correo para confirmar la cuenta.");
  }

  closeSignupModal();
  signupForm.reset();
});

function bindBrandButtons() {
  brandButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentBrand = button.dataset.brand;
      currentCategory = categoryOrder[currentBrand][0];
      searchInput.value = "";
      renderList();
    });
  });
}

categoryStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  currentCategory = button.dataset.category;
  searchInput.value = "";
  renderList();
});

dishList.addEventListener("click", (event) => {
  const card = event.target.closest(".customer-dish-card");
  if (!card) return;
  openDetail(card.dataset.id);
});

recommendedCard.addEventListener("click", () => openDetail(recommendedCard.dataset.id));

detailOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-presentation-index]");
  if (!option) return;
  selectedPresentationIndex = Number(option.dataset.presentationIndex);
  detailOptions.querySelectorAll(".detail-option").forEach((button) => {
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
  option.classList.add("selected");
  option.setAttribute("aria-pressed", "true");
});

scanQrButton.addEventListener("click", () => openQrModal(scanQrButton));

addPurchaseButton.addEventListener("click", () => {
  showToast(labels[currentLang].loyaltyShowQrHint || "Muestra tu QR al empleado para acreditar tu consumo.");
  openQrModal(addPurchaseButton);
});

earnDetailPoints.addEventListener("click", () => {
  showToast(labels[currentLang].loyaltyShowQrHint || "Muestra tu QR al empleado para acreditar tu consumo.");
  openQrModal(earnDetailPoints);
});

rewardStrip.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-reward]");
  if (!button) return;
  if (!isAuthenticated()) {
    openSignupModal(button);
    return;
  }
  const reward = rewardCatalog.find((item) => item.id === button.dataset.reward);
  if (!reward) return;
  if (pointsBalance < reward.cost) {
    showToast(`${reward.cost - pointsBalance} pts restantes`);
    return;
  }
  if (supabase && currentCustomer?.profile) {
    const { error } = await supabase.from("reward_redemptions").insert({
      customer_id: currentCustomer.profile.id,
      business_id: businessId,
      reward_id: reward.id,
      reward_name: reward.name,
      points_cost: reward.cost
    });
    if (error) {
      showToast(displayError(error));
      return;
    }
  }
  showToast(`${labels[currentLang].redeemed}: ${reward.name}`);
});

rewardsButton.addEventListener("click", () => {
  rewardStrip.scrollIntoView({ block: "center", behavior: "smooth" });
});

document.querySelector("#detailBack").addEventListener("click", () => {
  detailView.classList.remove("open");
});

shareButton.addEventListener("click", async () => {
  const dish = menuItems.find((item) => item.id === shareButton.dataset.shareId);
  if (!dish) return;
  const shareUrl = `${window.location.origin}${window.location.pathname}#${dish.id}`;
  const shareData = {
    title: `${localName(dish)} - ${currentBrand}`,
    text: localDescription(dish),
    url: shareUrl
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (error) {
      if (error.name !== "AbortError") showToast(labels[currentLang].copied || "Link copiado");
    }
    return;
  }

  await navigator.clipboard?.writeText(shareUrl);
  showToast(labels[currentLang].copied || "Link copiado");
});

favoriteButton.addEventListener("click", () => {
  const id = favoriteButton.dataset.favoriteId;
  if (!id) return;
  if (favoriteItems.has(id)) {
    favoriteItems.delete(id);
  } else {
    favoriteItems.add(id);
  }
  favoriteButton.classList.toggle("active", favoriteItems.has(id));
  favoriteButton.setAttribute("aria-pressed", String(favoriteItems.has(id)));
});

pairings.addEventListener("click", (event) => {
  const card = event.target.closest(".pairing-card");
  if (!card) return;
  openDetail(card.dataset.id);
});

searchInput.addEventListener("input", renderList);

searchToggle.addEventListener("click", () => {
  searchInput.focus();
  searchInput.scrollIntoView({ block: "center", behavior: "smooth" });
});

languageToggle.addEventListener("click", () => {
  const langs = languages.map((language) => language.code);
  currentLang = langs[(langs.indexOf(currentLang) + 1) % langs.length];
  renderList();
  updateQrShell();
  updateProfileShell();
  if (!qrModal.hidden) renderCustomerQr();
  if (!profileModal.hidden) renderProfile();
  if (detailView.classList.contains("open")) openDetail(currentDetailId);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !signupModal.hidden) {
    closeSignupModal();
    return;
  }
  if (event.key === "Escape" && !qrModal.hidden) {
    closeQrModal();
    return;
  }
  if (event.key === "Escape" && !profileModal.hidden) {
    closeProfileModal();
    return;
  }
  trapSignupFocus(event);
  trapQrFocus(event);
  trapProfileFocus(event);
  if (event.key === "Escape" && detailView.classList.contains("open")) {
    detailView.classList.remove("open");
  }
});

applyBusinessShell();
bindBrandButtons();
updateSignupShell();
updateQrShell();
updateProfileShell();
await initializeAuth();
