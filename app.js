import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import QrScanner from "qr-scanner";

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
const initialMenuItems = menuItems.map((dish) => ({
  ...dish,
  translations: dish.translations ? JSON.parse(JSON.stringify(dish.translations)) : undefined,
  presentations: Array.isArray(dish.presentations)
    ? dish.presentations.map((presentation) => ({ ...presentation }))
    : []
}));
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
const menuStateStorageKey = `sumi:menu:${businessId}:state`;
const contentLibraryStorageKey = `sumi:content:${businessId}:library`;
const dishLikesStorageKey = `sumi:likes:${businessId}:counts`;
const dishLikedItemsStorageKey = `sumi:likes:${businessId}:mine`;
const menuSettingsStorageKey = `sumi:menu:${businessId}:settings`;
const pendingContentTasksStorageKey = `sumi:content:${businessId}:pending-tasks`;
const localDevOwnerStorageKey = "sumi:dev-owner";
const editorImageMaxSize = 1400;
const editorImageQuality = 0.78;
const aiMonthlyCreditLimit = 150;
const aiGenerationCreditCost = 2;

function serializedMenuItems() {
  return menuItems.map((dish) => ({
    id: dish.id,
    name: dish.name,
    description: dish.description,
    brand: dish.brand,
    category: dish.category,
    photo: dish.photo,
    visible: dish.visible !== false,
    soldOut: Boolean(dish.soldOut),
    lastEditedAt: dish.lastEditedAt || "",
    lastEditedBy: dish.lastEditedBy || "",
    translations: dish.translations,
    presentations: dish.presentations
  }));
}

function applyMenuItemsState(items) {
  if (!Array.isArray(items)) return false;
  const baseItems = new Map(initialMenuItems.map((dish) => [dish.id, dish]));
  const restoredItems = items
    .filter((savedItem) => savedItem?.id)
    .map((savedItem) => {
      const baseItem = baseItems.get(savedItem.id) || {};
      const item = {
        ...baseItem,
        translations: baseItem.translations ? JSON.parse(JSON.stringify(baseItem.translations)) : undefined,
        presentations: Array.isArray(baseItem.presentations)
          ? baseItem.presentations.map((presentation) => ({ ...presentation }))
          : []
      };
      item.id = savedItem.id;
      item.name = savedItem.name ?? item.name;
      item.description = savedItem.description ?? item.description;
      item.brand = savedItem.brand ?? item.brand;
      item.category = savedItem.category ?? item.category;
      item.photo = savedItem.photo ?? item.photo;
      item.visible = savedItem.visible !== false;
      item.soldOut = Boolean(savedItem.soldOut);
      item.lastEditedAt = savedItem.lastEditedAt || item.lastEditedAt || "";
      item.lastEditedBy = savedItem.lastEditedBy || item.lastEditedBy || "";
      if (savedItem.translations && typeof savedItem.translations === "object") {
        item.translations = JSON.parse(JSON.stringify(savedItem.translations));
      }
      item.translations = item.translations && typeof item.translations === "object" ? item.translations : {};
      item.translations.es = {
        name: item.name || item.translations.es?.name || "",
        description: item.description || item.translations.es?.description || ""
      };
      if (Array.isArray(savedItem.presentations) && savedItem.presentations.length) {
        item.presentations = savedItem.presentations.map((presentation) => ({
          name: presentation.name || "Presentacion",
          price: presentation.price || "0",
          note: presentation.note || ""
        }));
      }
      if (!Array.isArray(item.presentations) || !item.presentations.length) {
        item.presentations = [{ name: "Plato", price: "0", note: "" }];
      }
      return item;
    });
  menuItems.splice(0, menuItems.length, ...restoredItems);
  return true;
}

function loadPersistedMenuState() {
  try {
    const state = JSON.parse(window.localStorage.getItem(menuStateStorageKey) || "{}");
    if (!applyMenuItemsState(state.items)) return;
  } catch {
    window.localStorage.removeItem(menuStateStorageKey);
  }
}

function persistMenuState() {
  const items = serializedMenuItems();
  window.localStorage.setItem(menuStateStorageKey, JSON.stringify({ items }));
}

async function loadRemoteMenuCatalog() {
  if (!supabase) {
    loadPersistedMenuState();
    return false;
  }
  const { data, error } = await supabase
    .from("business_menu_catalog")
    .select("items")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !Array.isArray(data?.items)) {
    return false;
  }
  applyMenuItemsState(data.items);
  window.localStorage.setItem(menuStateStorageKey, JSON.stringify({ items: serializedMenuItems() }));
  return true;
}

async function saveRemoteMenuCatalog() {
  if (!supabase) return false;
  if (!currentSession?.user || currentCustomer?.adminMembership?.role !== "owner") {
    throw new Error("Inicia sesion como owner para publicar el menu para todos.");
  }
  const { error } = await supabase
    .from("business_menu_catalog")
    .upsert({
      business_id: businessId,
      items: serializedMenuItems(),
      updated_by_auth_user_id: currentSession.user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id" });
  if (error) throw error;
  return true;
}

async function publishMenuCatalog() {
  persistMenuState();
  await saveRemoteMenuCatalog();
}

if (!supabase) loadPersistedMenuState();

window.addEventListener("storage", (event) => {
  if (supabase) return;
  if (event.key !== menuStateStorageKey) return;
  loadPersistedMenuState();
  renderRoute();
});

function loadContentLibrary() {
  try {
    const state = JSON.parse(window.localStorage.getItem(contentLibraryStorageKey) || "[]");
    return Array.isArray(state) ? state : [];
  } catch {
    window.localStorage.removeItem(contentLibraryStorageKey);
    return [];
  }
}

function persistContentLibrary() {
  window.localStorage.setItem(contentLibraryStorageKey, JSON.stringify(generatedContentLibrary));
}

let currentLang = businessConfig.defaultLang || "es";
let currentBrand = businessConfig.defaultBrand || brandSwitcher[0]?.name || Object.keys(categoryOrder)[0];
let currentCategory = businessConfig.defaultCategory || categoryOrder[currentBrand]?.[0];
let currentDetailId = businessConfig.defaultDetailId || menuItems[0]?.id;
let pointsBalance = businessConfig.initialPoints || 0;
let selectedPresentationIndex = 0;
let currentSession = null;
let currentCustomer = null;
let currentAdminView = "home";
let selectedContentDishId = menuItems.find(isDishVisible)?.id || menuItems[0]?.id || "";
let selectedContentType = "instagram-square";
let selectedContentTone = "";
let selectedContentReferenceImage = "";
let selectedContentBackgroundImage = "";
let generatedContentLibrary = loadContentLibrary();
let adminLibraryFilter = "all";
let contentDraftOverride = { key: "", caption: "", hashtags: "" };
let activeLibraryAssetId = "";
let contentGenerationState = { status: "idle", result: null, error: "" };
let aiCreditBalance = { remaining: aiMonthlyCreditLimit, monthlyLimit: aiMonthlyCreditLimit, periodMonth: "" };
let menuSettings = { recommendedDishId: "", popularDishId: "", popularByBrand: {}, hasRecord: false };
let loyaltySettings = { earnRate: 0.10 };
let consumptionQrScanner = null;
let activeConsumptionQrId = "";
let activeConsumptionCustomer = null;
let consumptionItems = [];
let consumptionRequestId = "";
let activePresentationDishId = "";
let currentEditorDishId = null;
let editorDraft = null;
let editorPreviewDraft = null;
let currentEditorLang = "es";
let lastEditedEditorLang = "es";
let editorAiBackgroundImage = "";
let editorAiImprovedPhoto = "";
let editorAiOriginalPhoto = "";
let editorAiCompressedPhoto = "";
let currentAdminData = {
  customers: [],
  accounts: [],
  events: [],
  redemptions: [],
  loaded: false,
  error: null
};
const favoriteItems = new Set();
const dishLikeCounts = new Map();
const dishLikeOverrides = new Map();
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
const favoriteCount = document.querySelector("#favoriteCount");
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
const staffConsumptionCard = document.querySelector("#staffConsumptionCard");
const staffScanButton = document.querySelector("#staffScanButton");
const staffConsumptionSubtitle = document.querySelector("#staffConsumptionSubtitle");
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
const signupSubmit = document.querySelector("#signupSubmit");
const signupModeToggle = document.querySelector("#signupModeToggle");
const signupRecoveryButton = document.querySelector("#signupRecoveryButton");
const signupRecoveryText = document.querySelector("#signupRecoveryText");
const qrModal = document.querySelector("#qrModal");
const qrClose = document.querySelector("#qrClose");
const customerQrCanvas = document.querySelector("#customerQrCanvas");
const qrError = document.querySelector("#qrError");
const qrCustomerId = document.querySelector("#qrCustomerId");
const consumptionModal = document.querySelector("#consumptionModal");
const consumptionClose = document.querySelector("#consumptionClose");
const consumptionVideo = document.querySelector("#consumptionVideo");
const consumptionQrInput = document.querySelector("#consumptionQrInput");
const consumptionQrSubmit = document.querySelector("#consumptionQrSubmit");
const consumptionScannerStatus = document.querySelector("#consumptionScannerStatus");
const consumptionCustomerCard = document.querySelector("#consumptionCustomerCard");
const consumptionCustomerName = document.querySelector("#consumptionCustomerName");
const consumptionCustomerMeta = document.querySelector("#consumptionCustomerMeta");
const consumptionAmount = document.querySelector("#consumptionAmount");
const consumptionPointsPreview = document.querySelector("#consumptionPointsPreview");
const consumptionCatalog = document.querySelector("#consumptionCatalog");
const consumptionItemsList = document.querySelector("#consumptionItemsList");
const consumptionSave = document.querySelector("#consumptionSave");
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
const assetModal = document.querySelector("#assetModal");
const assetModalClose = document.querySelector("#assetModalClose");
const assetModalImage = document.querySelector("#assetModalImage");
const assetModalTitle = document.querySelector("#assetModalTitle");
const assetModalMeta = document.querySelector("#assetModalMeta");
const assetModalCaption = document.querySelector("#assetModalCaption");
const assetModalHashtags = document.querySelector("#assetModalHashtags");
const assetModalDownload = document.querySelector("#assetModalDownload");
const assetModalCopy = document.querySelector("#assetModalCopy");
const assetModalSave = document.querySelector("#assetModalSave");
const assetModalDelete = document.querySelector("#assetModalDelete");
const photoAiModal = document.querySelector("#photoAiModal");
const photoAiClose = document.querySelector("#photoAiClose");
const photoAiPreview = document.querySelector("#photoAiPreview");
const photoAiCompare = document.querySelector("#photoAiCompare");
const photoAiBefore = document.querySelector("#photoAiBefore");
const photoAiAfter = document.querySelector("#photoAiAfter");
const photoAiAfterWrap = document.querySelector("#photoAiAfterWrap");
const photoAiCompareRange = document.querySelector("#photoAiCompareRange");
const photoAiCompareHandle = document.querySelector("#photoAiCompareHandle");
const photoAiPrompt = document.querySelector("#photoAiPrompt");
const photoAiBackgroundInput = document.querySelector("#photoAiBackgroundInput");
const photoAiBackgroundStatus = document.querySelector("#photoAiBackgroundStatus");
const photoAiStatus = document.querySelector("#photoAiStatus");
const photoAiGenerate = document.querySelector("#photoAiGenerate");
const photoAiDownload = document.querySelector("#photoAiDownload");
const photoAiRegenerate = document.querySelector("#photoAiRegenerate");
const photoAiApply = document.querySelector("#photoAiApply");
const adminPanel = document.querySelector("#adminPanel");
const adminHome = document.querySelector("#adminHome");
const adminMenuSection = document.querySelector("#adminMenuSection");
const adminCustomersSection = document.querySelector("#adminCustomersSection");
const adminContentSection = document.querySelector("#adminContentSection");
const adminLibrarySection = document.querySelector("#adminLibrarySection");
const adminRewardsSection = document.querySelector("#adminRewardsSection");
const adminAnalyticsSection = document.querySelector("#adminAnalyticsSection");
const adminSettingsSection = document.querySelector("#adminSettingsSection");
const adminStats = document.querySelector("#adminStats");
const adminActions = document.querySelector("#adminActions");
const adminDishRows = document.querySelector("#adminDishRows");
const adminSearchInput = document.querySelector("#adminSearchInput");
const adminNewDishButton = document.querySelector("#adminNewDishButton");
const adminMenuCount = document.querySelector("#adminMenuCount");
const adminCustomerSearchInput = document.querySelector("#adminCustomerSearchInput");
const adminCustomerRows = document.querySelector("#adminCustomerRows");
const adminViewLibraryButton = document.querySelector("#adminViewLibraryButton");
const adminAiCreditPill = document.querySelector("#adminAiCreditPill");
const adminCreateContentButton = document.querySelector("#adminCreateContentButton");
const adminContentCount = document.querySelector("#adminContentCount");
const adminContentRows = document.querySelector("#adminContentRows");
const adminContentPreview = document.querySelector("#adminContentPreview");
const adminContentDishThumb = document.querySelector("#adminContentDishThumb");
const adminContentDishTitle = document.querySelector("#adminContentDishTitle");
const adminContentDishMeta = document.querySelector("#adminContentDishMeta");
const adminContentDishSelect = document.querySelector("#adminContentDishSelect");
const adminContentTypeTitle = document.querySelector("#adminContentTypeTitle");
const adminContentTypeMeta = document.querySelector("#adminContentTypeMeta");
const adminContentTypeSelect = document.querySelector("#adminContentTypeSelect");
const adminContentReferenceThumb = document.querySelector("#adminContentReferenceThumb");
const adminContentReferenceMeta = document.querySelector("#adminContentReferenceMeta");
const adminContentReferenceInput = document.querySelector("#adminContentReferenceInput");
const adminContentReferenceClear = document.querySelector("#adminContentReferenceClear");
const adminContentBackgroundInput = document.querySelector("#adminContentBackgroundInput");
const adminContentBackgroundClear = document.querySelector("#adminContentBackgroundClear");
const adminContentInstructions = document.querySelector("#adminContentInstructions");
const adminToneRow = document.querySelector("#adminToneRow");
const adminLibrarySearchInput = document.querySelector("#adminLibrarySearchInput");
const adminLibraryTitle = document.querySelector("#adminLibraryTitle");
const adminLibrarySubtitle = document.querySelector("#adminLibrarySubtitle");
const adminLibraryFilters = document.querySelector("#adminLibraryFilters");
const adminLibraryGrid = document.querySelector("#adminLibraryGrid");
const adminRewardsCount = document.querySelector("#adminRewardsCount");
const adminRewardRows = document.querySelector("#adminRewardRows");
const adminRedemptionsCount = document.querySelector("#adminRedemptionsCount");
const adminRedemptionRows = document.querySelector("#adminRedemptionRows");
const adminSettingsGrid = document.querySelector("#adminSettingsGrid");
const adminNavItems = document.querySelectorAll("[data-admin-nav]");
const adminExitButton = document.querySelector("#adminExitButton");
const adminHelpButton = document.querySelector("#adminHelpButton");
const adminGreeting = document.querySelector("#adminGreeting");
const adminSummary = document.querySelector("#adminSummary");
const adminSuggestionButton = document.querySelector("#adminSuggestionButton");
const editorPanel = document.querySelector("#editorPanel");
const backButton = document.querySelector("#backButton");
const editorTitle = document.querySelector("#editorTitle");
const editorMeta = document.querySelector("#editorMeta");
const dishNameInput = document.querySelector("#dishName");
const dishDescriptionInput = document.querySelector("#dishDescription");
const descCount = document.querySelector("#descCount");
const editorLanguageTabs = document.querySelectorAll(".tab[data-lang]");
const translateButton = document.querySelector("#translateButton");
const dishPhoto = document.querySelector("#dishPhoto");
const dishPhotoInput = document.querySelector("#dishPhotoInput");
const improvePhotoButton = document.querySelector("#improvePhotoButton");
const addPresentationButton = document.querySelector("#addPresentationButton");
const presentations = document.querySelector("#presentations");
const brandSelect = document.querySelector("#brandSelect");
const categorySelect = document.querySelector("#categorySelect");
const visibleToggle = document.querySelector("#visibleToggle");
const previewDishButton = document.querySelector("#previewDishButton");
const soldOutButton = document.querySelector("#soldOutButton");
const saveDishButton = document.querySelector("#saveDishButton");
let lastSignupTrigger = null;
let lastQrTrigger = null;
let lastProfileTrigger = null;
let signupMode = "register";
const customerStorageKey = `sumi:loyalty:${businessId}:customerId`;
const contentTypes = [
  {
    id: "instagram-square",
    title: "Post cuadrado para Instagram",
    meta: "1080 x 1080 - Foto + copy + hashtags",
    platform: "IG"
  },
  {
    id: "instagram-story",
    title: "Story vertical",
    meta: "1080 x 1920 - Foto vertical + sticker + CTA",
    platform: "ST"
  },
  {
    id: "instagram-reel",
    title: "Reel cover",
    meta: "1080 x 1920 - Portada vertical para reel",
    platform: "RC"
  }
];

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

function slugify(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `platillo-${Date.now().toString(36)}`;
}

function uniqueDishId(baseName) {
  const base = slugify(baseName);
  if (!menuItems.some((dish) => dish.id === base)) return base;
  let index = 2;
  while (menuItems.some((dish) => dish.id === `${base}-${index}`)) index += 1;
  return `${base}-${index}`;
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

function favoriteUserId() {
  return currentSession?.user?.id || currentCustomer?.profile?.id || "";
}

function loadLocalDishLikes() {
  try {
    const counts = JSON.parse(window.localStorage.getItem(dishLikesStorageKey) || "{}");
    dishLikeCounts.clear();
    Object.entries(counts).forEach(([dishId, count]) => {
      const numericCount = Number(count);
      if (Number.isFinite(numericCount) && numericCount > 0) {
        dishLikeCounts.set(dishId, numericCount);
      }
    });
    favoriteItems.clear();
    const liked = JSON.parse(window.localStorage.getItem(dishLikedItemsStorageKey) || "[]");
    if (Array.isArray(liked)) liked.forEach((dishId) => favoriteItems.add(String(dishId)));
  } catch {
    window.localStorage.removeItem(dishLikesStorageKey);
    window.localStorage.removeItem(dishLikedItemsStorageKey);
  }
}

function persistLocalDishLikes() {
  const counts = Object.fromEntries(dishLikeCounts.entries());
  window.localStorage.setItem(dishLikesStorageKey, JSON.stringify(counts));
  window.localStorage.setItem(dishLikedItemsStorageKey, JSON.stringify([...favoriteItems]));
}

function loadLocalMenuSettings() {
  try {
    const state = JSON.parse(window.localStorage.getItem(menuSettingsStorageKey) || "{}");
    menuSettings = {
      recommendedDishId: String(state.recommendedDishId || ""),
      popularDishId: String(state.popularDishId || ""),
      popularByBrand: state.popularByBrand && typeof state.popularByBrand === "object" ? state.popularByBrand : {},
      hasRecord: Boolean(state.hasRecord)
    };
  } catch {
    window.localStorage.removeItem(menuSettingsStorageKey);
    menuSettings = { recommendedDishId: "", popularDishId: "", popularByBrand: {}, hasRecord: false };
  }
}

function persistLocalMenuSettings() {
  window.localStorage.setItem(menuSettingsStorageKey, JSON.stringify(menuSettings));
}

function dishLikeCount(dishId) {
  return (dishLikeCounts.get(dishId) || 0) + (dishLikeOverrides.get(dishId) || 0);
}

function topLikedDishId(brand = currentBrand) {
  let topId = "";
  let topCount = 0;
  for (const dish of menuItems.filter((item) => item.brand === brand && isDishVisible(item))) {
    const count = dishLikeCount(dish.id);
    if (count > topCount) {
      topId = dish.id;
      topCount = count;
    }
  }
  return topCount > 0 ? topId : "";
}

function likeLabel(count) {
  return `${count} ${count === 1 ? "like" : "likes"}`;
}

function effectiveRecommendedDishId() {
  return menuSettings.recommendedDishId
    || businessConfig.recommendedByBrand?.[currentBrand]
    || currentItems()[0]?.id
    || "";
}

function explicitPopularDishId(brand = currentBrand) {
  const byBrand = menuSettings.popularByBrand || {};
  const brandPopularId = String(byBrand[brand] || "");
  const brandPopularDish = menuItems.find((dish) => dish.id === brandPopularId && dish.brand === brand && isDishVisible(dish));
  if (brandPopularDish) return brandPopularId;
  const legacyPopularDish = menuItems.find((dish) => dish.id === menuSettings.popularDishId && dish.brand === brand && isDishVisible(dish));
  return legacyPopularDish ? menuSettings.popularDishId : "";
}

function effectivePopularDishId(brand = currentBrand) {
  return explicitPopularDishId(brand) || topLikedDishId(brand);
}

function likeIndicatorMarkup(dishId, options = {}) {
  const count = dishLikeCount(dishId);
  const dish = menuItems.find((item) => item.id === dishId);
  const popular = dishId === effectivePopularDishId(dish?.brand || currentBrand);
  const className = `${options.className || ""} like-indicator ${popular ? "is-popular" : ""}`.trim();
  if (popular) {
    const popularLabel = options.showPopularLabel === false ? "" : "<em>Popular</em>";
    return `
      <span class="${className}" aria-label="Popular, ${escapeAttribute(likeLabel(count))}">
        <span class="flame" aria-hidden="true">&#128293;</span>
        <strong>${escapeHtml(count)}</strong>
        ${popularLabel}
      </span>
    `;
  }
  return `
    <span class="${className}" aria-label="${escapeAttribute(likeLabel(count))}">
      <span class="heart-emoji" aria-hidden="true">♥</span>
      <strong>${escapeHtml(count)}</strong>
    </span>
  `;
}

function triggerLikeAnimation() {
  favoriteButton?.classList.remove("like-pop");
  favoriteCount?.classList.remove("like-pop");
  window.requestAnimationFrame(() => {
    favoriteButton?.classList.add("like-pop");
    favoriteCount?.classList.add("like-pop");
    window.setTimeout(() => {
      favoriteButton?.classList.remove("like-pop");
      favoriteCount?.classList.remove("like-pop");
    }, 720);
  });
}

async function refreshDishLikes() {
  if (!supabase) {
    loadLocalDishLikes();
    return;
  }
  const { data, error } = await supabase
    .from("dish_likes")
    .select("dish_id, auth_user_id")
    .eq("business_id", businessId);
  if (error) {
    loadLocalDishLikes();
    return;
  }
  const userId = favoriteUserId();
  dishLikeCounts.clear();
  favoriteItems.clear();
  dishLikeOverrides.clear();
  (data || []).forEach((row) => {
    dishLikeCounts.set(row.dish_id, (dishLikeCounts.get(row.dish_id) || 0) + 1);
    if (userId && row.auth_user_id === userId) favoriteItems.add(row.dish_id);
  });
  const { data: overrides } = await supabase
    .from("dish_like_overrides")
    .select("dish_id, count_delta")
    .eq("business_id", businessId);
  (overrides || []).forEach((row) => {
    dishLikeOverrides.set(row.dish_id, Number(row.count_delta) || 0);
  });
  persistLocalDishLikes();
}

async function loadBusinessMenuSettings() {
  if (!supabase) {
    loadLocalMenuSettings();
    return;
  }
  const { data, error } = await supabase
    .from("business_menu_settings")
    .select("recommended_dish_id, popular_dish_id, popular_by_brand")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) {
    loadLocalMenuSettings();
    return;
  }
  if (!data) {
    menuSettings = { recommendedDishId: "", popularDishId: "", popularByBrand: {}, hasRecord: false };
    return;
  }
  menuSettings = {
    recommendedDishId: data.recommended_dish_id || "",
    popularDishId: data.popular_dish_id || "",
    popularByBrand: data.popular_by_brand && typeof data.popular_by_brand === "object" ? data.popular_by_brand : {},
    hasRecord: true
  };
  persistLocalMenuSettings();
}

async function saveBusinessMenuSettings(nextSettings) {
  menuSettings = {
    recommendedDishId: nextSettings.recommendedDishId || "",
    popularDishId: nextSettings.popularDishId || "",
    popularByBrand: nextSettings.popularByBrand && typeof nextSettings.popularByBrand === "object" ? nextSettings.popularByBrand : {},
    hasRecord: true
  };
  persistLocalMenuSettings();
  if (!supabase || !isOwner() || isLocalDevOwner()) return;
  const { error } = await supabase
    .from("business_menu_settings")
    .upsert({
      business_id: businessId,
      recommended_dish_id: menuSettings.recommendedDishId || null,
      popular_dish_id: menuSettings.popularDishId || null,
      popular_by_brand: menuSettings.popularByBrand || {},
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id" });
  if (error) throw error;
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
    qrId: customerId
  });
}

function isAuthenticated() {
  return Boolean(currentSession?.user && currentCustomer?.profile && currentCustomer?.account);
}

function isLocalDevOwner() {
  const hostname = window.location.hostname;
  const localHost = hostname === "localhost" || hostname === "127.0.0.1";
  return Boolean(import.meta.env.DEV && localHost && window.localStorage.getItem(localDevOwnerStorageKey) === "true");
}

function isOwner() {
  return isLocalDevOwner() || currentCustomer?.adminMembership?.role === "owner";
}

function isStaff() {
  return isOwner() || currentCustomer?.adminMembership?.role === "employee";
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

function primaryPresentationPrice(dish) {
  const presentation = dish.presentations?.[0];
  return presentation?.price ? `$${presentation.price}` : priceRange(dish);
}

function presentationBadges(dish, options = {}) {
  const limit = options.limit || Infinity;
  const presentationsList = (dish.presentations || []).slice(0, limit);
  const extraCount = (dish.presentations || []).length - presentationsList.length;
  const badges = presentationsList
    .map((presentation) => `
      <b>
        <span>${escapeHtml(presentation.name || "Presentacion")}</span>
        <strong>$${escapeHtml(presentation.price || "0")}</strong>
      </b>
    `)
    .join("");
  return `${badges}${extraCount > 0 ? `<b><span>+${extraCount}</span><strong>mas</strong></b>` : ""}`;
}

function formatEditorDateTime(value) {
  if (!value) return "sin cambios guardados";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin cambios guardados";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
  if (sameDay) return `hoy ${time}`;
  const day = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
  return `${day} ${time}`;
}

function editorAccountName() {
  return currentCustomer?.profile?.name
    || currentSession?.user?.user_metadata?.name
    || currentSession?.user?.email
    || "Owner";
}

function renderEditorMeta(dish = editorDish()) {
  if (!editorMeta || !dish) return;
  const visibility = isDishVisible(dish) ? "Visible en el menu" : "Oculto del menu";
  const editedAt = formatEditorDateTime(dish.lastEditedAt);
  const editedBy = dish.lastEditedBy || "Sin editor";
  editorMeta.innerHTML = `<span class="dot"></span> ${escapeHtml(visibility)} &middot; Ultima edicion: ${escapeHtml(editedAt)} por ${escapeHtml(editedBy)}`;
}

function visibleAdminItems() {
  const query = adminSearchInput?.value.trim().toLowerCase() || "";
  return menuItems.filter((dish) => {
    const haystack = `${dish.name} ${dish.description} ${dish.category} ${dish.brand}`.toLowerCase();
    return !query || haystack.includes(query);
  });
}

function normalizedAssetText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function assetDuplicateKey(item) {
  if (!item || item.legacy) return "";
  const stableTask = item.imageTaskId ? `task:${item.imageTaskId}` : "";
  if (stableTask) return stableTask;
  return [
    item.dishId || normalizedAssetText(item.dishName),
    item.formatId || "",
    normalizedAssetText(item.caption),
    normalizedAssetText(item.hashtags)
  ].join("|");
}

function sameDuplicateBurst(current, previous) {
  if (!current?.createdAt || !previous?.createdAt) return true;
  const currentTime = new Date(current.createdAt).getTime();
  const previousTime = new Date(previous.createdAt).getTime();
  if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) return true;
  return Math.abs(currentTime - previousTime) <= 30 * 60 * 1000;
}

function dedupeLibraryItems(items) {
  const byTask = new Set();
  const byRequest = new Map();
  return [...items]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .filter((item) => {
      if (item.legacy) return true;
      if (item.imageTaskId) {
        if (byTask.has(item.imageTaskId)) return false;
        byTask.add(item.imageTaskId);
      }
      const key = item.requestKey || [
        item.dishId || normalizedAssetText(item.dishName),
        item.formatId || "",
        normalizedAssetText(item.caption),
        normalizedAssetText(item.hashtags)
      ].join("|");
      const previous = byRequest.get(key);
      if (previous && sameDuplicateBurst(item, previous)) return false;
      byRequest.set(key, item);
      return true;
    });
}

function libraryItems() {
  const query = adminLibrarySearchInput?.value.trim().toLowerCase() || "";
  const searched = dedupeLibraryItems(generatedContentLibrary).filter((item) => {
    const haystack = `${item.dishName} ${item.brand} ${item.category} ${item.formatTitle} ${item.caption} ${item.hashtags}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  return searched.filter((item) => {
    if (adminLibraryFilter === "instagram") return item.formatId === "instagram-square";
    if (adminLibraryFilter === "stories") return item.formatId === "instagram-story";
    if (adminLibraryFilter === "reels") return item.formatId === "instagram-reel";
    if (adminLibraryFilter === "ready") return true;
    return true;
  });
}

function libraryFilterDefinitions(items = generatedContentLibrary) {
  const visibleItems = dedupeLibraryItems(items);
  const count = (filter) => visibleItems.filter((item) => {
    if (filter === "instagram") return item.formatId === "instagram-square";
    if (filter === "stories") return item.formatId === "instagram-story";
    if (filter === "reels") return item.formatId === "instagram-reel";
    if (filter === "ready") return true;
    return true;
  }).length;
  return [
    { id: "all", label: "Todo", count: count("all") },
    { id: "instagram", label: "Instagram", count: count("instagram") },
    { id: "stories", label: "Stories", count: count("stories") },
    { id: "reels", label: "Reels", count: count("reels") },
    { id: "ready", label: "Listos para publicar", count: count("ready") }
  ];
}

function libraryFormatBadge(item) {
  if (item.formatId === "instagram-story") return "Story · 9:16";
  if (item.formatId === "instagram-reel") return "Reel · 9:16";
  return "Instagram · 1:1";
}

function isVerticalContentAsset(item) {
  return item?.formatId === "instagram-story" || item?.formatId === "instagram-reel";
}

function relativeTimeLabel(value) {
  if (!value) return "ahora";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "ahora";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 8) return `Hace ${days} d`;
  return formatEventDate(value);
}

function libraryStatusLabel(item) {
  return "LISTO";
}

function legacyLibraryItems() {
  return loadContentLibrary().map((item) => ({
    ...item,
    legacy: true,
    imageUrl: item.photo,
    image_path: "",
    imageSource: item.imageSource || "legacy-local"
  }));
}

function mapGeneratedAsset(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    dishId: row.dish_id,
    dishName: row.dish_name,
    brand: businessConfig.businessName || businessConfig.landing?.primaryName || businessId,
    category: row.category || "",
    photo: row.image_url,
    imageUrl: row.image_url,
    imagePath: row.image_path,
    sourcePhoto: row.source_photo,
    referencePhoto: row.source_photo,
    imageSource: "kie-ai",
    imageModel: row.model,
    imageTaskId: row.task_id,
    requestKey: row.request_key || "",
    formatId: row.format_id,
    formatTitle: row.format_title,
    formatMeta: "",
    caption: row.caption,
    hashtags: row.hashtags || "",
    creditsUsed: row.credits_used || aiGenerationCreditCost,
    legacy: false
  };
}

function loadPendingContentTasks() {
  try {
    const tasks = JSON.parse(window.localStorage.getItem(pendingContentTasksStorageKey) || "[]");
    return Array.isArray(tasks) ? tasks.filter((task) => task?.taskId) : [];
  } catch {
    window.localStorage.removeItem(pendingContentTasksStorageKey);
    return [];
  }
}

function savePendingContentTasks(tasks) {
  window.localStorage.setItem(pendingContentTasksStorageKey, JSON.stringify(tasks.filter((task) => task?.taskId)));
}

function rememberPendingContentTask(task) {
  if (!task?.taskId) return;
  const tasks = loadPendingContentTasks().filter((item) => (
    item.taskId !== task.taskId
    && (!task.requestKey || item.requestKey !== task.requestKey)
  ));
  tasks.unshift({ ...task, createdAt: task.createdAt || new Date().toISOString() });
  savePendingContentTasks(tasks.slice(0, 10));
}

function forgetPendingContentTask(taskId) {
  savePendingContentTasks(loadPendingContentTasks().filter((task) => task.taskId !== taskId));
}

function pendingContentTaskForRequest(requestKey) {
  if (!requestKey) return null;
  return loadPendingContentTasks().find((task) => task.requestKey === requestKey) || null;
}

async function loadGeneratedContentLibrary() {
  const legacy = legacyLibraryItems();
  if (!supabase || !isOwner() || isLocalDevOwner()) {
    generatedContentLibrary = dedupeLibraryItems(legacy);
    return generatedContentLibrary;
  }

  const { data, error } = await supabase
    .from("generated_content_assets")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  generatedContentLibrary = dedupeLibraryItems([...(data || []).map(mapGeneratedAsset), ...legacy]);
  return generatedContentLibrary;
}

async function loadAiCreditBalance() {
  if (!supabase || !isOwner() || isLocalDevOwner()) {
    aiCreditBalance = { remaining: aiMonthlyCreditLimit, monthlyLimit: aiMonthlyCreditLimit, periodMonth: new Date().toISOString().slice(0, 7) };
    return aiCreditBalance;
  }

  const { data, error } = await supabase.rpc("ensure_business_ai_credit_balance", {
    target_business_id: businessId
  });

  if (error) throw error;
  aiCreditBalance = {
    remaining: data?.credits_remaining ?? aiMonthlyCreditLimit,
    monthlyLimit: data?.monthly_limit ?? aiMonthlyCreditLimit,
    periodMonth: data?.period_month || new Date().toISOString().slice(0, 7)
  };
  return aiCreditBalance;
}

function updateAiCreditBalanceFromGeneration(result) {
  if (!result || typeof result.creditsRemaining !== "number") return;
  aiCreditBalance = {
    remaining: result.creditsRemaining,
    monthlyLimit: result.monthlyLimit || aiCreditBalance.monthlyLimit || aiMonthlyCreditLimit,
    periodMonth: result.periodMonth || aiCreditBalance.periodMonth
  };
}

function backgroundGenerationPendingError(message) {
  const error = new Error(message);
  error.code = "generation_background_pending";
  return error;
}

function resetContentGenerationState() {
  if (contentGenerationState.status === "generating") return;
  contentGenerationState = { status: "idle", result: null, error: "" };
}

function downloadFileNameFromUrl(url) {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const name = pathname.split("/").filter(Boolean).pop();
    if (name && /\.[a-z0-9]+$/i.test(name)) return name;
  } catch {
    // Use the generic name below.
  }
  return `sumi-contenido-${Date.now()}.png`;
}

async function downloadAsset(url) {
  if (!url) return;
  const filename = downloadFileNameFromUrl(url);
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("No se pudo descargar la imagen.");
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return;
  } catch {
    showToast("No se pudo descargar la imagen desde este origen.");
    return;
  }
}

function contentIdeas() {
  return menuItems
    .filter(isDishVisible)
    .slice(0, 6)
    .map((dish, index) => {
      const themes = ["Producto estrella", "Promo de la tarde", "Historia del plato", "Antojo rapido", "Post de fin de semana", "Combo sugerido"];
      const hooks = [
        `Hoy sale ${dish.name}: ${dish.description}`,
        `${dish.name} listo para antojo serio, con precio desde ${priceRange(dish)}.`,
        `Si buscas algo de ${dish.category}, ${dish.name} es la jugada.`
      ];
      return {
        dish,
        theme: themes[index % themes.length],
        hook: hooks[index % hooks.length]
      };
    });
}

function selectedContentDish() {
  const visibleItems = menuItems.filter(isDishVisible);
  return visibleItems.find((dish) => dish.id === selectedContentDishId) || visibleItems[0];
}

function selectedContentFormat() {
  return contentTypes.find((type) => type.id === selectedContentType) || contentTypes[0];
}

function contentDraftKey(dish, format) {
  return [
    dish?.id || "",
    format?.id || "",
    selectedContentTone,
    selectedContentReferenceImage ? "manual-product" : "menu-product",
    selectedContentBackgroundImage ? "manual-background" : "generated-background",
    adminContentInstructions?.value.trim() || ""
  ].join("|");
}

function normalizedRequestText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function contentGenerationRequestKey(dish, format, draft = null) {
  const instructions = adminContentInstructions?.value.trim() || "";
  return [
    businessId,
    dish?.id || normalizedRequestText(dish?.name),
    format?.id || "",
    normalizedRequestText(instructions),
    selectedContentTone || "neutral",
    selectedContentReferenceImage ? "manual-product" : "menu-product",
    selectedContentBackgroundImage ? "manual-background" : "generated-background",
    normalizedRequestText(draft?.overlay || promotionalBadgeText(dish, format, instructions))
  ].join("|");
}

function resetContentDraftOverride() {
  contentDraftOverride = { key: "", caption: "", hashtags: "" };
}

function applyContentDraftOverride(dish, format, draft) {
  const key = contentDraftKey(dish, format);
  if (contentDraftOverride.key !== key) return draft;
  const caption = contentDraftOverride.caption.trim() || draft.caption;
  const hashtags = contentDraftOverride.hashtags.trim() || draft.hashtags;
  return {
    ...draft,
    caption,
    hashtags,
    variants: [caption]
  };
}

function contentToneProfile(toneId = selectedContentTone) {
  const profiles = {
    neutral: {
      label: "sin tono avanzado",
      captionStyle: "claro, comercial y breve",
      imageStyle: "fotografia gastronomica profesional, realista, con producto protagonista y buena luz",
      badgeStyle: "badges simples, pocos y funcionales, solo para la promocion o dato clave",
      sceneStyle: "mesa cuidada de restaurante, fondo limpio y calido, sin exagerar estilo",
      badgePlacement: "esquinas o laterales con aire visual, nunca en el centro ni sobre el producto",
      colorDirection: "crema, madera calida, oliva suave y contraste limpio",
      opener: (dish) => `${dish.name} listo para disfrutar`
    },
    casual: {
      label: "casual",
      captionStyle: "cercano, simple y conversacional",
      imageStyle: "natural, relajado, sin solemnidad, como una recomendacion honesta del local",
      badgeStyle: "badge simple con lenguaje cotidiano, directo y amable",
      sceneStyle: "mesa real de restaurante, luz de dia o tarde, sensacion espontanea y familiar",
      badgePlacement: "esquina superior izquierda o margen lateral izquierdo, con alto contraste pero sin verse publicitario agresivo",
      colorDirection: "crema, verde oliva, madera clara y acentos naranja suaves",
      opener: (dish) => `${dish.name} para caer sin pensarlo`
    },
    elegante: {
      label: "elegante",
      captionStyle: "premium, sobrio y cuidado",
      imageStyle: "refinado, editorial, con composicion limpia y detalles delicados",
      badgeStyle: "badge sobrio, con pocas palabras, espaciado y acabado premium",
      sceneStyle: "fotografia editorial con fondo limpio, vajilla cuidada, sombras suaves y mucho aire visual",
      badgePlacement: "esquina superior derecha o inferior derecha, pequeno y preciso, con borde fino",
      colorDirection: "marfil, negro suave, dorado apagado y cafe profundo",
      opener: (dish) => `${dish.name} con una presentacion cuidada`
    },
    divertido: {
      label: "divertido",
      captionStyle: "ligero, alegre y con energia",
      imageStyle: "vivo, fresco, con energia positiva, sin verse infantil",
      badgeStyle: "badge alegre y breve, con un toque jugueton pero profesional",
      sceneStyle: "mesa con energia, ingredientes frescos, contraste alegre y composicion dinamica",
      badgePlacement: "esquina superior izquierda con forma organica o sticker premium, nunca en el centro",
      colorDirection: "crema, naranja, verde fresco y pequenos acentos amarillos",
      opener: (dish) => `${dish.name} para levantar cualquier mesa`
    },
    antojador: {
      label: "antojador",
      captionStyle: "sensorial, apetecible y directo al antojo",
      imageStyle: "muy apetecible, con textura, brillo, cercania y foco en el producto",
      badgeStyle: "badge apetitoso, corto y sensorial, sin tapar el producto",
      sceneStyle: "close-up apetitoso con vapor, textura, brillo natural y profundidad de campo",
      badgePlacement: "margen inferior lateral o esquina superior lateral, contrastado y visible",
      colorDirection: "marron profundo, crema calida, dorado suave y sombras ricas",
      opener: (dish) => `${dish.name} para un antojo serio`
    },
    finde: {
      label: "para fin de semana",
      captionStyle: "social, invitador y pensado para compartir",
      imageStyle: "calido, social, de plan de fin de semana, ideal para venir con amigos",
      badgeStyle: "badge social, de plan con amigos o fin de semana, sin texto excesivo",
      sceneStyle: "mesa compartida con vasos, pan, manos desenfocadas en segundo plano y sensacion de encuentro",
      badgePlacement: "badge principal en esquina superior izquierda o derecha, con presencia clara; micro-chip secundario en esquina opuesta si hay espacio",
      colorDirection: "madera calida, crema, oliva, terracota y luz de atardecer",
      opener: (dish) => `${dish.name} para compartir el fin de semana`
    }
  };
  return profiles[toneId] || profiles.neutral;
}

function contentDraft(dish, format) {
  const instructions = adminContentInstructions?.value.trim();
  const tone = contentToneProfile();
  const userBrief = instructions ? ` ${instructions}` : "";
  const caption = `${tone.opener(dish)}. ${dish.description}${userBrief} Ven por el tuyo hoy.`;
  const hashtags = `#HabibiBites #Condesa #${dish.category.replace(/\s+/g, "")} #${dish.name.replace(/\s+/g, "")}`;
  return applyContentDraftOverride(dish, format, {
    caption,
    hashtags,
    variants: [caption],
    overlay: promotionalBadgeText(dish, format, instructions)
  });
}

function promotionalBadgeText(dish, format, instructions = "") {
  return promotionHighlights(dish, instructions).primary;
}

function secondaryBadgeText(dish) {
  const highlights = promotionHighlights(dish, adminContentInstructions?.value);
  if (highlights.secondary) return highlights.secondary;
  if (selectedContentTone === "finde") return "Ideal para compartir";
  if (selectedContentTone === "antojador") return "Antojo caliente";
  if (selectedContentTone === "elegante") return dish.category;
  if (selectedContentTone === "divertido") return "Nuevo favorito";
  return "";
}

function normalizePromoText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function titleCaseShort(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function promotionHighlights(dish, instructions = "") {
  const raw = String(instructions || "").trim();
  const normalized = normalizePromoText(raw);
  const hasLimitedTime = /solo por tiempo limitado|tiempo limitado|limitad[ao]/.test(normalized);
  const hasStockLimit = /hasta agotar stock|agotar stock/.test(normalized);
  const hasFriends = /amigos|compartir|compartido|compartirlo/.test(normalized);
  const hasPita = /pan pita|pita|vegetales|verduras/.test(normalized);
  const twoForOne = normalized.match(/\b(?:2\s*x\s*1|2\s*por\s*1|dos\s*por\s*uno)\b/);
  if (twoForOne) {
    return {
      primary: "2x1",
      secondary: hasLimitedTime ? "Tiempo limitado" : hasFriends ? "Para compartir" : "Promo limitada",
      tertiary: hasStockLimit ? "Hasta agotar stock" : hasPita ? "Con pan pita" : "",
      instruction: "Convertir 2x1 en el badge promocional mas grande despues del titulo; agregar un chip lateral secundario si el brief menciona tiempo limitado, stock, amigos o acompanamiento."
    };
  }
  const percent = raw.match(/\b\d{1,2}\s*%/);
  if (percent) {
    return {
      primary: `${percent[0].replace(/\s+/g, "")} OFF`,
      secondary: "Promo especial",
      tertiary: hasStockLimit ? "Hasta agotar stock" : "",
      instruction: "Convertir el descuento porcentual en un badge protagonista y muy legible."
    };
  }
  const price = raw.match(/(?:\$|usd\s*)\s*\d+(?:[.,]\d+)?/i);
  if (price) {
    return {
      primary: price[0].replace(/\s+/g, " ").trim(),
      secondary: "Precio especial",
      tertiary: hasStockLimit ? "Hasta agotar stock" : "",
      instruction: "Dar gran protagonismo al precio como badge lateral, con alto contraste y lectura inmediata."
    };
  }
  if (/\bnuevo\b|\bnueva\b|\bestreno\b/.test(normalized)) {
    return {
      primary: "Nuevo",
      secondary: normalized.includes("amigos") ? "Veni con amigos" : "En el menu",
      tertiary: hasStockLimit ? "Hasta agotar stock" : "",
      instruction: "Comunicar novedad con un badge corto y llamativo, no con una frase larga."
    };
  }
  if (raw) {
    return {
      primary: titleCaseShort(raw),
      secondary: selectedContentTone === "finde" ? "Para compartir" : "",
      tertiary: hasStockLimit ? "Hasta agotar stock" : "",
      instruction: "Resumir la instruccion del usuario en un badge muy corto, maximo cuatro palabras."
    };
  }
  return {
    primary: dish.name,
    secondary: selectedContentTone === "finde" ? "Para compartir" : "",
    tertiary: "",
    instruction: "Usar un badge corto de apoyo, sin competir con el titulo del producto."
  };
}

function contentImageAspectRatio(format) {
  if (format.id === "instagram-story" || format.id === "instagram-reel") return "9:16";
  return "1:1";
}

function buildContentImagePrompt(dish, format, draft) {
  const instructions = adminContentInstructions?.value || "";
  const highlights = promotionHighlights(dish, instructions);
  const badgeText = highlights.primary;
  const tone = contentToneProfile();
  const secondaryText = secondaryBadgeText(dish);
  const tertiaryText = highlights.tertiary || "";
  const backgroundGuidance = selectedContentBackgroundImage
    ? "Usar la imagen de fondo subida por el usuario como referencia de ambiente, luz, superficie y contexto; mantener el producto del menu como protagonista y no reemplazarlo por elementos del fondo."
    : "Crear un fondo gastronomico coherente con el producto, limpio y con aire visual para textos laterales.";
  return [
    `Crear una imagen publicitaria para ${format.title}.`,
    `Producto principal: ${dish.name}. Categoria: ${dish.category}. Descripcion: ${dish.description}.`,
    `Usar la imagen del producto como referencia visual principal y tratar el producto como identidad bloqueada.`,
    `No cambiar el producto: no modificar ingredientes, forma, cantidad, textura, toppings, color real, plato, pan, salsas ni presentacion del alimento.`,
    `Solo se permiten ajustes fotograficos sobre el producto: enfoque, nitidez, iluminacion, sombras suaves, color grading natural, recorte y perspectiva leve.`,
    `Si hace falta integrar el producto en otro entorno, mantener el alimento igual y adaptar unicamente fondo, superficie, luz ambiental y elementos secundarios.`,
    backgroundGuidance,
    `Composicion limpia para restaurante, luz calida, fotografia de producto de alta calidad, lista para publicarse.`,
    `Estructura obligatoria: titulo del producto arriba del producto, producto protagonista en centro o tercio inferior, badges solo en laterales o esquinas.`,
    `Titulo obligatorio: escribir "${dish.name}" arriba del producto, grande, legible, con tipografia script estilo "New Berolina", elegante y gastronomica.`,
    `El titulo no debe ser un badge, no debe tapar la comida y debe quedar en la zona superior con suficiente contraste.`,
    `Tono seleccionado: ${tone.label}. Aplicar una direccion ${tone.captionStyle}.`,
    `Direccion visual del tono: ${tone.imageStyle}.`,
    `Escena del tono: ${tone.sceneStyle}.`,
    `Paleta sugerida: ${tone.colorDirection}.`,
    `El texto y el badge deben sentirse claramente en tono ${tone.label}: ${tone.badgeStyle}.`,
    `Mensaje completo del usuario solo como contexto, no como texto completo en la imagen: "${instructions || "sin instrucciones adicionales"}".`,
    `Badge principal obligatorio: usar exactamente "${badgeText}" como texto grande, corto y de lectura inmediata.`,
    `Regla de promocion: ${highlights.instruction}`,
    `Si hay promocion, precio, descuento o 2x1, ese badge debe ser el segundo elemento mas protagonista despues del titulo y el producto.`,
    secondaryText ? `Agregar un chip secundario breve con este texto: "${secondaryText}", en una esquina o lateral opuesto al badge principal.` : `No agregar chip secundario si no aporta informacion concreta.`,
    tertiaryText ? `Agregar un micro-chip terciario pequeno con este texto: "${tertiaryText}", solo si hay aire visual y nunca cerca del centro.` : `No inventar chips extra.`,
    `No escribir parrafos ni frases largas dentro de la imagen. Maximo 3 bloques de texto: titulo del producto, badge principal y uno o dos chips cortos.`,
    `El producto debe ocupar el centro o la zona protagonista de la imagen y debe seguir reconociendose como el mismo producto de la referencia.`,
    `Nunca colocar badges, textos, precios, logos ni promociones en el centro de la imagen.`,
    `Colocacion de badges para este tono: ${tone.badgePlacement}.`,
    `Los badges deben tener bordes suaves, sombra sutil, buena legibilidad y no tapar producto, salsa, pan, toppings ni el borde principal del plato.`,
    `Evitar hallucinations del producto: no agregar ni quitar garbanzos, crema, frutas, chocolate, carne, huevos, pan, decoraciones o ingredientes no presentes en la referencia salvo que el usuario lo pida explicitamente.`,
    `No incluir precio ni CTA salvo que el usuario lo haya escrito explicitamente en el texto del badge o instrucciones.`,
    `El estilo minimalista aplica solo a badges, textos, precio, direccion o promocion; la foto del producto debe conservar riqueza visual y textura realista.`,
    `Evitar exceso de texto, fondos recargados, multiples logos, marcas de agua, iconos genericos grandes y errores tipograficos.`,
    `Priorizar jerarquia visual: 1 titulo "${dish.name}", 2 producto apetitoso, 3 badge promocional lateral.`,
    `Caption de referencia: ${draft.caption}`
  ].join(" ");
}

function fallbackGeneratedContentImage(dish, format, draft) {
  return selectedContentReferenceImage || dish.photo;
}

function contentReferenceImage(dish) {
  return selectedContentReferenceImage || dish.photo;
}

function contentBackgroundImage() {
  return selectedContentBackgroundImage || "";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result || ""));
    reader.addEventListener("error", () => reject(reader.error || new Error("No se pudo leer la imagen.")));
    reader.readAsDataURL(blob);
  });
}

async function contentReferenceImageForGeneration(dish) {
  const reference = contentReferenceImage(dish);
  if (!reference) return "";
  if (/^data:image\//i.test(reference) || /^https?:\/\//i.test(reference)) return reference;
  try {
    const response = await fetch(new URL(reference, window.location.href).href);
    if (!response.ok) return "";
    return await blobToDataUrl(await response.blob());
  } catch {
    return "";
  }
}

async function contentBackgroundImageForGeneration() {
  const reference = contentBackgroundImage();
  if (!reference) return "";
  if (/^data:image\//i.test(reference) || /^https?:\/\//i.test(reference)) return reference;
  try {
    const response = await fetch(new URL(reference, window.location.href).href);
    if (!response.ok) return "";
    return await blobToDataUrl(await response.blob());
  } catch {
    return "";
  }
}

async function startContentImageGeneration(dish, format, draft) {
  if (!supabase || !currentSession?.access_token) {
    throw new Error("Conecta Supabase y entra como owner para generar imagenes.");
  }
  const requestKey = contentGenerationRequestKey(dish, format, draft);
  const pendingTask = pendingContentTaskForRequest(requestKey);
  if (pendingTask) {
    return {
      imageUrl: "",
      storagePath: "",
      source: "kie-ai",
      model: pendingTask.model || "",
      taskId: pendingTask.taskId,
      creditsUsed: 0,
      creditsRemaining: aiCreditBalance.remaining,
      monthlyLimit: aiCreditBalance.monthlyLimit,
      periodMonth: aiCreditBalance.periodMonth,
      asset: null
    };
  }
  const referenceImage = await contentReferenceImageForGeneration(dish);
  const backgroundImage = await contentBackgroundImageForGeneration();
  const requestBody = {
    businessId,
    dish: {
      id: dish.id,
      name: dish.name,
      category: dish.category,
      description: dish.description,
      price: primaryPresentationPrice(dish),
      photo: dish.photo,
      referenceImage,
      referenceSource: selectedContentReferenceImage ? "manual-upload" : "menu-photo",
      backgroundImage,
      backgroundSource: selectedContentBackgroundImage ? "manual-background-upload" : ""
    },
    format: {
      id: format.id,
      title: format.title,
      meta: format.meta,
      aspectRatio: contentImageAspectRatio(format)
    },
    brief: {
      instructions: adminContentInstructions?.value.trim() || "",
      tone: selectedContentTone,
      toneLabel: contentToneProfile().label,
      includePrice: false,
      includeCta: false,
      badgeText: promotionalBadgeText(dish, format, adminContentInstructions?.value),
      caption: draft.caption,
      hashtags: draft.hashtags,
      prompt: buildContentImagePrompt(dish, format, draft),
      requestKey
    }
  };

  const { data, error } = await supabase.functions.invoke("generate-content-image", {
    body: requestBody
  });

  if (error) {
    let body = null;
    if (error.context?.json) {
      body = await error.context.json().catch(() => null);
    }
    const nextError = new Error(body?.error || error.message || "No se pudo generar la imagen.");
    nextError.code = body?.code || "";
    nextError.creditsRemaining = body?.creditsRemaining;
    nextError.monthlyLimit = body?.monthlyLimit;
    nextError.periodMonth = body?.periodMonth;
    throw nextError;
  }

  if (data?.status !== "processing" || !data?.taskId || data?.source !== "kie-ai") {
    throw new Error("Kie.ai no pudo iniciar una tarea valida.");
  }

  const pendingInput = {
    ...requestBody,
    dish: {
      ...requestBody.dish,
      referenceImage: "",
      backgroundImage: ""
    }
  };
  rememberPendingContentTask({
    taskId: data?.taskId || "",
    model: data?.model || "",
    requestKey,
    input: pendingInput
  });

  return {
    imageUrl: "",
    storagePath: "",
    source: data.source,
    model: data?.model || "",
    taskId: data?.taskId || "",
    creditsUsed: 0,
    creditsRemaining: data?.creditsRemaining,
    monthlyLimit: data?.monthlyLimit,
    periodMonth: data?.periodMonth,
    asset: null
  };
}

async function findGeneratedAssetByTask(taskId) {
  if (!taskId || !supabase || !isOwner() || isLocalDevOwner()) return null;
  const { data, error } = await supabase
    .from("generated_content_assets")
    .select("*")
    .eq("business_id", businessId)
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGeneratedAsset(data) : null;
}

async function finalizeGeneratedContentTask(task) {
  if (!task?.taskId || !supabase || !currentSession?.access_token || !isOwner() || isLocalDevOwner()) return null;
  const { data, error } = await supabase.functions.invoke("generate-content-image", {
    body: {
      action: "finalize",
      businessId,
      task: {
        taskId: task.taskId,
        model: task.model || ""
      },
      ...(task.input || {})
    }
  });
  if (error) {
    let body = null;
    if (error.context?.json) body = await error.context.json().catch(() => null);
    const nextError = new Error(body?.error || error.message || "No se pudo finalizar la imagen.");
    nextError.code = body?.code || "";
    throw nextError;
  }
  if (data?.asset) {
    forgetPendingContentTask(task.taskId);
    updateAiCreditBalanceFromGeneration({
      creditsRemaining: data.creditsRemaining,
      monthlyLimit: data.monthlyLimit,
      periodMonth: data.periodMonth
    });
    return mapGeneratedAsset(data.asset);
  }
  return null;
}

async function waitForGeneratedAsset(taskId) {
  const pendingTask = loadPendingContentTasks().find((task) => task.taskId === taskId) || { taskId };
  for (let attempt = 0; attempt < 72; attempt += 1) {
    await wait(attempt < 6 ? 2500 : 5000);
    const item = await findGeneratedAssetByTask(taskId);
    if (item) {
      forgetPendingContentTask(taskId);
      return item;
    }
    if (attempt % 3 === 0) {
      const finalized = await finalizeGeneratedContentTask(pendingTask).catch((error) => {
        if (error.code === "kie_image_still_processing") return null;
        throw error;
      });
      if (finalized) return finalized;
    }
  }
  throw backgroundGenerationPendingError("La imagen sigue generandose en segundo plano. Puedes cerrar esta pagina y verla luego en Biblioteca.");
}

async function recoverPendingGeneratedContentTasks() {
  const tasks = loadPendingContentTasks();
  if (!tasks.length || !supabase || !isOwner() || isLocalDevOwner()) return [];
  const recovered = [];
  for (const task of tasks) {
    try {
      const item = await findGeneratedAssetByTask(task.taskId) || await finalizeGeneratedContentTask(task);
      if (item) recovered.push(item);
    } catch (error) {
      if (error.code !== "kie_image_still_processing") {
        console.warn("No se pudo recuperar una generacion pendiente", error);
      }
    }
  }
  if (recovered.length) {
    generatedContentLibrary = dedupeLibraryItems([
      ...recovered,
      ...generatedContentLibrary.filter((item) => !recovered.some((asset) => asset.id === item.id))
    ]);
    await loadAiCreditBalance().catch(() => aiCreditBalance);
  }
  return recovered;
}

function createContentLibraryItem(dish, format, draft, imageResult = {}) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    dishId: dish.id,
    dishName: dish.name,
    brand: dish.brand,
    category: dish.category,
    photo: imageResult.imageUrl || dish.photo,
    sourcePhoto: dish.photo,
    referencePhoto: contentReferenceImage(dish),
    imageSource: imageResult.source || "local-preview",
    imageModel: imageResult.model || "",
    imageTaskId: imageResult.taskId || "",
    formatId: format.id,
    formatTitle: format.title,
    formatMeta: format.meta,
    caption: draft.caption,
    hashtags: draft.hashtags,
    variants: draft.variants,
    overlay: draft.overlay
  };
}

async function generateAdminContent() {
  const dish = selectedContentDish();
  const format = selectedContentFormat();
  if (!dish || !format) return null;
  const draft = contentDraft(dish, format);
  const queuedImage = await startContentImageGeneration(dish, format, draft);
  const asset = await waitForGeneratedAsset(queuedImage.taskId);
  await loadAiCreditBalance().catch(() => aiCreditBalance);
  const imageResult = {
    ...queuedImage,
    imageUrl: asset.imageUrl,
    storagePath: asset.imagePath,
    model: asset.imageModel || queuedImage.model,
    taskId: asset.imageTaskId || queuedImage.taskId,
    creditsUsed: asset.creditsUsed || aiGenerationCreditCost,
    creditsRemaining: aiCreditBalance.remaining,
    monthlyLimit: aiCreditBalance.monthlyLimit,
    periodMonth: aiCreditBalance.periodMonth,
    asset
  };
  updateAiCreditBalanceFromGeneration(imageResult);
  return { dish, format, draft, imageResult };
}

function shortQrAlias(profile, account) {
  const name = (profile?.name || "Cliente").split(/\s+/)[0].replace(/[^\w-]/g, "") || "Cliente";
  const digits = String(account?.public_qr_id || account?.id || profile?.id || "")
    .replace(/\D/g, "")
    .slice(-4)
    .padStart(4, "0");
  return `${name}-${digits}`;
}

function accountForCustomer(customerId) {
  return currentAdminData.accounts.find((account) => account.customer_id === customerId);
}

function eventsForCustomer(customerId) {
  return currentAdminData.events.filter((event) => event.customer_id === customerId);
}

function redemptionsForCustomer(customerId) {
  return currentAdminData.redemptions.filter((redemption) => redemption.customer_id === customerId);
}

function customerSearchMatches(profile, account) {
  const query = adminCustomerSearchInput?.value.trim().toLowerCase() || "";
  if (!query) return true;
  const haystack = `${profile.name} ${profile.email} ${shortQrAlias(profile, account)} ${account?.public_qr_id || ""}`.toLowerCase();
  return haystack.includes(query);
}

async function loadAdminData() {
  if (isLocalDevOwner()) {
    currentAdminData = { customers: [], accounts: [], events: [], redemptions: [], loaded: true, error: null };
    return currentAdminData;
  }

  if (!supabase || !isOwner()) {
    currentAdminData = { customers: [], accounts: [], events: [], redemptions: [], loaded: false, error: null };
    return currentAdminData;
  }

  const [
    customersResult,
    accountsResult,
    eventsResult,
    redemptionsResult
  ] = await Promise.all([
    supabase
      .from("customer_profiles")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("point_events")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("reward_redemptions")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  const error = customersResult.error || accountsResult.error || eventsResult.error || redemptionsResult.error;
  if (error) throw error;

  currentAdminData = {
    customers: customersResult.data || [],
    accounts: accountsResult.data || [],
    events: eventsResult.data || [],
    redemptions: redemptionsResult.data || [],
    loaded: true,
    error: null
  };
  return currentAdminData;
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
    { data: redemptions, error: redemptionsError },
    { data: adminMembership, error: adminError },
    { data: businessLoyaltySettings, error: loyaltySettingsError }
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
      .from("reward_redemptions")
      .select("*")
      .eq("customer_id", profile.id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("business_admins")
      .select("business_id, role")
      .eq("auth_user_id", session.user.id)
      .eq("business_id", businessId)
      .in("role", ["owner", "employee"])
      .order("role", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("business_loyalty_settings")
      .select("earn_rate")
      .eq("business_id", businessId)
      .maybeSingle()
  ]);

  if (accountError) throw accountError;
  if (eventsError) throw eventsError;
  if (redemptionsError) throw redemptionsError;
  if (adminError) throw adminError;
  if (loyaltySettingsError) {
    loyaltySettings = { earnRate: 0.10 };
  }

  currentCustomer = {
    profile,
    account,
    events: events || [],
    redemptions: redemptions || [],
    adminMembership
  };
  pointsBalance = account?.points_balance || 0;
  if (!loyaltySettingsError) {
    loyaltySettings = {
      earnRate: Number(businessLoyaltySettings?.earn_rate ?? businessLoyaltySettings?.earnRate ?? 0.10) || 0.10
    };
  }
  return currentCustomer;
}

function renderAuthState() {
  const authenticated = isAuthenticated();
  const staff = authenticated && isStaff();
  if (loyaltyCard) loyaltyCard.hidden = !authenticated || staff;
  if (staffConsumptionCard) staffConsumptionCard.hidden = !staff;
  if (staffConsumptionSubtitle) {
    staffConsumptionSubtitle.textContent = `Escanea el QR, carga el monto y acredita ${Math.round((loyaltySettings.earnRate || 0) * 100)}% en puntos.`;
  }
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

function setSignupLoading(isLoading) {
  if (!signupSubmit) return;
  signupSubmit.disabled = isLoading;
  signupSubmit.textContent = isLoading
    ? signupMode === "login" ? "Ingresando..." : "Creando..."
    : signupMode === "login" ? labels[currentLang].loginSubmit : labels[currentLang].signupSubmit;
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
      errorCorrectionLevel: "H",
      color: {
        dark: "#461904",
        light: "#ffffff"
      }
    });
    drawBusinessMarkOnQr(customerQrCanvas);
  } catch {
    qrError.textContent = label.qrError || "No se pudo generar el QR. Intenta de nuevo.";
  }
}

function drawBusinessMarkOnQr(canvas) {
  const context = canvas?.getContext?.("2d");
  if (!context) return;
  const mark = String(businessConfig.admin?.brandMark || businessConfig.landing?.sealMark || businessConfig.businessName || businessId || "HB")
    .trim()
    .slice(0, 4)
    .toUpperCase();
  const size = Math.round(canvas.width * 0.24);
  const x = Math.round((canvas.width - size) / 2);
  const y = Math.round((canvas.height - size) / 2);
  context.save();
  context.fillStyle = "#fff9ec";
  context.strokeStyle = "#ff890a";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(x, y, size, size, Math.round(size * 0.22));
  context.fill();
  context.stroke();
  context.fillStyle = "#461904";
  context.font = `900 ${Math.max(15, Math.round(size * 0.34))}px Georgia, serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(mark, canvas.width / 2, canvas.height / 2 + 1);
  context.restore();
}

function fallbackRequestId(prefix = "consumption") {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseConsumptionQrValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return { error: "Pega o escanea un QR valido." };
  try {
    const payload = JSON.parse(raw);
    if (payload.businessId && payload.businessId !== businessId) {
      return { error: "Este QR pertenece a otro negocio." };
    }
    const qrId = payload.qrId || payload.customerId || payload.publicQrId || "";
    return qrId ? { qrId: String(qrId) } : { error: "El QR no contiene un cliente valido." };
  } catch {
    return { qrId: raw };
  }
}

function selectedConsumptionAmount() {
  const value = Number(consumptionAmount?.value || 0);
  return Number.isFinite(value) ? value : 0;
}

function estimatedConsumptionPoints() {
  const amount = selectedConsumptionAmount();
  const rate = Number(loyaltySettings.earnRate || 0.10);
  if (amount <= 0 || rate <= 0) return 0;
  return Math.max(1, Math.floor(amount * rate));
}

function updateConsumptionPointsPreview() {
  if (!consumptionPointsPreview) return;
  const ratePercent = Math.round((loyaltySettings.earnRate || 0) * 100);
  consumptionPointsPreview.textContent = `${estimatedConsumptionPoints()} pts a acreditar (${ratePercent}% del monto)`;
}

function resetConsumptionFlow() {
  activeConsumptionQrId = "";
  activeConsumptionCustomer = null;
  consumptionItems = [];
  consumptionRequestId = fallbackRequestId();
  activePresentationDishId = "";
  consumptionModal?.classList.remove("is-ready");
  if (consumptionQrInput) consumptionQrInput.value = "";
  if (consumptionAmount) consumptionAmount.value = "";
  if (consumptionCustomerCard) consumptionCustomerCard.hidden = true;
  renderConsumptionCatalog();
  renderConsumptionItems();
  updateConsumptionPointsPreview();
}

async function openConsumptionModal(trigger = staffScanButton) {
  if (!isStaff()) {
    showToast("Esta cuenta no puede cargar consumos.");
    return;
  }
  lastQrTrigger = trigger;
  resetConsumptionFlow();
  consumptionModal.hidden = false;
  document.body.classList.add("consumption-open");
  await startConsumptionScanner();
  window.requestAnimationFrame(() => consumptionQrInput?.focus());
}

function closeConsumptionModal() {
  stopConsumptionScanner();
  consumptionModal.hidden = true;
  document.body.classList.remove("consumption-open");
  lastQrTrigger?.focus();
}

async function startConsumptionScanner() {
  if (!consumptionVideo || consumptionQrScanner) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    if (consumptionScannerStatus) consumptionScannerStatus.textContent = "Camara no disponible. Pega el codigo QR abajo.";
    return;
  }
  consumptionScannerStatus.textContent = "Pidiendo permiso de camara...";
  consumptionQrScanner = new QrScanner(
    consumptionVideo,
    (result) => handleConsumptionQrScan(result?.data || result),
    {
      preferredCamera: "environment",
      highlightScanRegion: true,
      returnDetailedScanResult: true,
      maxScansPerSecond: 8
    }
  );
  try {
    await consumptionQrScanner.start();
    consumptionScannerStatus.textContent = "Apunta la camara al QR del cliente.";
  } catch {
    consumptionScannerStatus.textContent = "No se pudo abrir la camara. Pega el codigo QR abajo.";
  }
}

function stopConsumptionScanner() {
  if (!consumptionQrScanner) return;
  consumptionQrScanner.destroy();
  consumptionQrScanner = null;
}

async function handleConsumptionQrScan(value) {
  const parsed = parseConsumptionQrValue(value);
  if (parsed.error) {
    consumptionScannerStatus.textContent = parsed.error;
    return;
  }
  if (parsed.qrId === activeConsumptionQrId && activeConsumptionCustomer) return;
  stopConsumptionScanner();
  await lookupConsumptionCustomer(parsed.qrId);
}

function renderConsumptionCustomer() {
  if (!activeConsumptionCustomer || !consumptionCustomerCard) return;
  consumptionModal?.classList.add("is-ready");
  consumptionCustomerCard.hidden = false;
  consumptionCustomerName.textContent = activeConsumptionCustomer.customer_name || "Cliente";
  consumptionCustomerMeta.textContent = `${activeConsumptionCustomer.points_balance || 0} pts actuales - ${tierLabel(activeConsumptionCustomer.tier)}`;
}

async function lookupConsumptionCustomer(qrId) {
  if (!supabase) {
    showToast("Configura Supabase para buscar clientes por QR.");
    return;
  }
  activeConsumptionQrId = qrId;
  consumptionScannerStatus.textContent = "Buscando cliente...";
  const { data, error } = await supabase.rpc("lookup_loyalty_customer_by_qr", {
    target_business_id: businessId,
    target_qr_id: qrId
  });
  if (error) {
    activeConsumptionQrId = "";
    activeConsumptionCustomer = null;
    consumptionScannerStatus.textContent = displayError(error);
    return;
  }
  const customer = Array.isArray(data) ? data[0] : data;
  if (!customer) {
    activeConsumptionQrId = "";
    activeConsumptionCustomer = null;
    consumptionScannerStatus.textContent = "No encontramos ese QR.";
    return;
  }
  activeConsumptionCustomer = customer;
  renderConsumptionCustomer();
  consumptionScannerStatus.textContent = "Cliente listo. Carga el monto y los productos.";
  consumptionAmount?.focus();
}

function consumptionProductLabel(dish) {
  return dishText(dish, "es")?.name || dish.name;
}

function closePresentationPopover() {
  activePresentationDishId = "";
  renderConsumptionCatalog();
}

function presentationListForDish(dish) {
  return Array.isArray(dish.presentations) && dish.presentations.length
    ? dish.presentations
    : [{ name: "Producto" }];
}

function addConsumptionItem(dish, presentation = presentationListForDish(dish)[0]) {
  const key = `${dish.id}|${presentation.name || "Producto"}`;
  const existing = consumptionItems.find((item) => item.key === key);
  if (existing) existing.quantity += 1;
  else {
    consumptionItems.push({
      key,
      dishId: dish.id,
      name: consumptionProductLabel(dish),
      presentationName: presentation.name || "Producto",
      quantity: 1
    });
  }
  activePresentationDishId = "";
  renderConsumptionCatalog();
  renderConsumptionItems();
}

function updateConsumptionItem(key, delta) {
  consumptionItems = consumptionItems
    .map((item) => item.key === key ? { ...item, quantity: item.quantity + delta } : item)
    .filter((item) => item.quantity > 0);
  renderConsumptionItems();
}

function renderConsumptionCatalog() {
  if (!consumptionCatalog) return;
  const items = menuItems.filter(isDishVisible).slice(0, 80);
  consumptionCatalog.innerHTML = items.length
    ? items.map((dish) => {
      const presentationsList = presentationListForDish(dish);
      const showPopover = activePresentationDishId === dish.id && presentationsList.length > 1;
      return `
        <div class="consumption-product-wrap ${showPopover ? "is-open" : ""}">
          <button class="consumption-product" type="button" data-consumption-dish="${escapeAttribute(dish.id)}" aria-expanded="${showPopover}">
            <span style="background-image:url('${dish.photo}')"></span>
            <strong>${escapeHtml(consumptionProductLabel(dish))}</strong>
          </button>
          ${showPopover ? `
            <div class="consumption-presentation-popover" role="menu" aria-label="Presentaciones de ${escapeAttribute(consumptionProductLabel(dish))}">
              ${presentationsList.map((presentation, index) => `
                <button type="button" role="menuitem" data-consumption-presentation-dish="${escapeAttribute(dish.id)}" data-consumption-presentation-index="${index}">
                  ${escapeHtml(presentation.name || "Producto")}
                </button>
              `).join("")}
            </div>
          ` : ""}
        </div>
      `;
    }).join("")
    : `<div class="admin-empty">No hay productos visibles.</div>`;
}

function renderConsumptionItems() {
  if (!consumptionItemsList) return;
  consumptionItemsList.innerHTML = consumptionItems.length
    ? consumptionItems.map((item) => `
      <article class="consumption-item-row">
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.presentationName)} - ${item.quantity} unidad${item.quantity === 1 ? "" : "es"}</small>
        </span>
        <span class="consumption-item-actions">
          <button type="button" data-consumption-item-dec="${escapeAttribute(item.key)}">-</button>
          <button type="button" data-consumption-item-inc="${escapeAttribute(item.key)}">+</button>
        </span>
      </article>
    `).join("")
    : `<div class="admin-empty">Todavia no agregaste productos.</div>`;
}

async function saveConsumption() {
  if (!activeConsumptionCustomer || !activeConsumptionQrId) {
    showToast("Escanea primero el QR del cliente.");
    return;
  }
  const amount = selectedConsumptionAmount();
  if (amount <= 0) {
    showToast("Carga un monto mayor a cero.");
    consumptionAmount?.focus();
    return;
  }
  if (!consumptionItems.length) {
    showToast("Agrega al menos un producto consumido.");
    return;
  }
  if (!supabase) {
    showToast("Configura Supabase para registrar consumos.");
    return;
  }
  consumptionSave.disabled = true;
  consumptionSave.textContent = "Registrando...";
  const payloadItems = consumptionItems.map(({ dishId, name, presentationName, quantity }) => ({
    dishId,
    name,
    presentationName,
    quantity
  }));
  const { data, error } = await supabase.rpc("record_customer_consumption", {
    target_business_id: businessId,
    target_qr_id: activeConsumptionQrId,
    purchase_total: amount,
    purchase_items: payloadItems,
    request_id: consumptionRequestId
  });
  consumptionSave.disabled = false;
  consumptionSave.textContent = "Registrar consumo";
  if (error) {
    showToast(displayError(error));
    return;
  }
  const result = data || {};
  showToast(`${result.customerName || "Cliente"} sumo ${result.pointsEarned || estimatedConsumptionPoints()} pts.`);
  if (currentAdminData.loaded) {
    currentAdminData.loaded = false;
    await ensureAdminData();
  }
  resetConsumptionFlow();
  await startConsumptionScanner();
}

function localCategory(category) {
  return categoryLabels[currentLang]?.[category] || category;
}

function languageDirection(lang) {
  return languages.find((language) => language.code === lang)?.dir || "ltr";
}

function legacyTranslatedName(dish, lang) {
  return nameTranslations[lang]?.[dish.name] || "";
}

function legacyTranslatedDescription(dish, lang) {
  return descriptionTranslations[lang]?.[dish.description] || "";
}

function ensureDishTranslations(dish) {
  if (!dish.translations || typeof dish.translations !== "object") {
    dish.translations = {};
  }

  ["es", "en", "ar"].forEach((lang) => {
    const existing = dish.translations[lang] || {};
    dish.translations[lang] = {
      name: existing.name || (lang === "es" ? dish.name : legacyTranslatedName(dish, lang)) || dish.name,
      description: existing.description || (lang === "es" ? dish.description : legacyTranslatedDescription(dish, lang)) || dish.description
    };
  });

  return dish.translations;
}

function dishText(dish, lang) {
  const translations = ensureDishTranslations(dish);
  return translations[lang] || translations.es;
}

function localName(dish) {
  return dishText(dish, currentLang)?.name || legacyTranslatedName(dish, currentLang) || dish.name;
}

function localDescription(dish) {
  return dishText(dish, currentLang)?.description || legacyTranslatedDescription(dish, currentLang) || dish.description;
}

function isSoldOut(dish) {
  return Boolean(dish?.soldOut);
}

function isDishVisible(dish) {
  return dish?.visible !== false;
}

function currentItems() {
  return menuItems.filter((dish) => dish.brand === currentBrand && isDishVisible(dish));
}

function normalizeCurrentCategory(items = currentItems()) {
  const categories = categoryOrder[currentBrand] || [];
  if (!categories.length) {
    currentCategory = "";
    return;
  }
  const hasCurrent = items.some((dish) => dish.category === currentCategory);
  if (hasCurrent) return;
  currentCategory = categories.find((category) => items.some((dish) => dish.category === category)) || categories[0];
}

function currentLevel() {
  if (pointsBalance >= 2000) return { name: labels[currentLang].platinum || "Nivel Platino", next: null, floor: 2000, target: 2000 };
  if (pointsBalance >= 1000) return { name: labels[currentLang].gold, next: labels[currentLang].platinum || "Nivel Platino", floor: 1000, target: 2000 };
  if (pointsBalance >= 500) return { name: labels[currentLang].silver, next: labels[currentLang].gold, floor: 500, target: 1000 };
  return { name: labels[currentLang].bronze, next: labels[currentLang].silver, floor: 0, target: 500 };
}

function activeRewardRedemption(rewardId) {
  return currentCustomer?.redemptions?.find((redemption) =>
    redemption.reward_id === rewardId && redemption.status !== "cancelled"
  );
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

function libraryAssetById(id) {
  return generatedContentLibrary.find((item) => item.id === id);
}

function writeLegacyLibraryItems(items) {
  window.localStorage.setItem(contentLibraryStorageKey, JSON.stringify(items));
}

function updateLegacyLibraryItem(itemId, updates) {
  const legacy = loadContentLibrary().map((item) =>
    item.id === itemId ? { ...item, ...updates } : item
  );
  writeLegacyLibraryItems(legacy);
}

function removeLegacyLibraryItem(itemId) {
  writeLegacyLibraryItems(loadContentLibrary().filter((item) => item.id !== itemId));
}

function renderAssetModal(asset) {
  if (!asset || !assetModalImage || !assetModalTitle || !assetModalMeta || !assetModalCaption || !assetModalHashtags) return;
  const dialog = assetModalImage.closest(".asset-dialog");
  dialog?.classList.toggle("is-vertical-asset", isVerticalContentAsset(asset));
  assetModalImage.classList.toggle("is-vertical-asset", isVerticalContentAsset(asset));
  assetModalImage.style.backgroundImage = `url("${asset.imageUrl || asset.photo}")`;
  assetModalTitle.textContent = asset.dishName || "Pieza creada";
  assetModalMeta.textContent = `${libraryFormatBadge(asset)} - ${relativeTimeLabel(asset.createdAt)} - ${libraryStatusLabel(asset)}`;
  assetModalCaption.value = asset.caption || "";
  assetModalHashtags.value = asset.hashtags || "";
}

function openAssetModal(assetId, { focusDraft = false } = {}) {
  const asset = libraryAssetById(assetId);
  if (!asset || !assetModal) return;
  activeLibraryAssetId = asset.id;
  renderAssetModal(asset);
  assetModal.hidden = false;
  document.body.classList.add("asset-open");
  window.requestAnimationFrame(() => {
    if (focusDraft) {
      assetModalCaption?.focus();
      assetModalCaption?.select();
    } else {
      assetModalClose?.focus();
    }
  });
}

function closeAssetModal() {
  if (!assetModal) return;
  assetModal.hidden = true;
  document.body.classList.remove("asset-open");
  activeLibraryAssetId = "";
}

async function updateLibraryAssetDraft(assetId, updates) {
  const asset = libraryAssetById(assetId);
  if (!asset) return null;
  const cleanUpdates = {
    caption: updates.caption?.trim() || "",
    hashtags: updates.hashtags?.trim() || ""
  };
  if (asset.legacy) {
    updateLegacyLibraryItem(assetId, cleanUpdates);
  } else {
    const { error } = await supabase
      .from("generated_content_assets")
      .update(cleanUpdates)
      .eq("id", assetId)
      .eq("business_id", businessId);
    if (error) throw error;
  }
  generatedContentLibrary = generatedContentLibrary.map((item) =>
    item.id === assetId ? { ...item, ...cleanUpdates } : item
  );
  return libraryAssetById(assetId);
}

async function deleteLibraryAsset(assetId) {
  const asset = libraryAssetById(assetId);
  if (!asset) return;
  if (asset.legacy) {
    removeLegacyLibraryItem(assetId);
  } else {
    if (asset.imagePath) {
      await supabase.storage.from("generated-content").remove([asset.imagePath]).catch(() => null);
    }
    const { error } = await supabase
      .from("generated_content_assets")
      .delete()
      .eq("id", assetId)
      .eq("business_id", businessId);
    if (error) throw error;
  }
  generatedContentLibrary = generatedContentLibrary.filter((item) => item.id !== assetId);
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

function trapConsumptionFocus(event) {
  trapModalFocus(consumptionModal, event);
}

function trapProfileFocus(event) {
  trapModalFocus(profileModal, event);
}

function trapAssetFocus(event) {
  trapModalFocus(assetModal, event);
}

function trapPhotoAiFocus(event) {
  trapModalFocus(photoAiModal, event);
}

function renderLoyalty() {
  renderAuthState();
  if (!isAuthenticated() || isStaff()) return;
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
      (reward) => {
        const redemption = activeRewardRedemption(reward.id);
        const available = pointsBalance >= reward.cost && !redemption;
        const status = redemption
          ? redemption.status === "redeemed" ? "Entregado" : redemption.status === "approved" ? "Aprobado" : "Solicitado"
          : `${reward.cost} pts`;
        return `
        <button class="reward-chip ${available ? "available" : ""} ${redemption ? "is-requested" : ""}" data-reward="${escapeAttribute(reward.id)}" type="button" ${redemption ? "aria-disabled=\"true\"" : ""}>
          <strong>${escapeHtml(reward.name)}</strong>
          <span>${escapeHtml(status)}</span>
        </button>
      `;
      }
    )
    .join("");
}

function recommendedDish() {
  const recommendedId = effectiveRecommendedDishId();
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
  const categories = categoryOrder[currentBrand] || [];
  categoryStrip.innerHTML = categories
    .map((category) => {
      const count = items.filter((dish) => dish.category === category).length;
      return `<button class="${category === currentCategory ? "active" : ""}" data-category="${escapeAttribute(category)}" type="button" aria-pressed="${category === currentCategory}">${escapeHtml(localCategory(category))} &middot; ${count}</button>`;
    })
    .join("");
}

function renderRecommendation() {
  const dish = recommendedDish();
  if (!dish) {
    document.querySelector(".recommendation p").textContent = labels[currentLang].recommended;
    recommendedCard.dataset.id = "";
    recommendedCard.disabled = true;
    recommendedCard.classList.add("is-empty");
    recommendedCard.style.backgroundImage = "";
    recommendedCard.innerHTML = `
      <span class="badge">Sin productos</span>
      <strong>Menu en pausa</strong>
      <small>Activa o crea un producto para volver a mostrar recomendaciones.</small>
    `;
    return;
  }
  const soldOut = isSoldOut(dish);
  const prices = presentationBadges(dish, { limit: 4 });
  document.querySelector(".recommendation p").textContent = labels[currentLang].recommended;
  recommendedCard.dataset.id = dish.id;
  recommendedCard.disabled = false;
  recommendedCard.classList.remove("is-empty");
  recommendedCard.classList.toggle("is-hot", dish.id === effectivePopularDishId(dish.brand));
  recommendedCard.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.75)), url('${dish.photo}')`;
  recommendedCard.innerHTML = `
    <span class="badge">${escapeHtml(soldOut ? "Agotado" : labels[currentLang].badge)}</span>
    <strong>${escapeHtml(localName(dish))}</strong>
    <small>${escapeHtml(localDescription(dish))}</small>
    <span class="hero-prices">${prices}</span>
    <span class="hero-like-tray">${likeIndicatorMarkup(dish.id)}</span>
  `;
}

function renderList() {
  const query = searchInput.value.trim().toLowerCase();
  const items = currentItems();
  normalizeCurrentCategory(items);
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
          const soldOut = isSoldOut(dish);
          const isPopular = dish.id === effectivePopularDishId(dish.brand);
          return `
            <button class="customer-dish-card ${soldOut ? "is-sold-out" : ""} ${isPopular ? "is-hot" : ""}" data-id="${escapeAttribute(dish.id)}" type="button">
              <span class="customer-thumb" style="background-image:url('${dish.photo}')"></span>
              <span class="customer-info">
                <strong>${escapeHtml(localName(dish))}</strong>
                <small>${escapeHtml(localDescription(dish))}</small>
                <span class="customer-presentations">${soldOut ? `<b><span>Agotado</span></b>` : presentationBadges(dish)}</span>
                ${likeIndicatorMarkup(dish.id, { className: "customer-like-count" })}
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
  const activeItems = menuItems.filter(isDishVisible);
  const hiddenItems = menuItems.length - activeItems.length;
  const soldOutItems = activeItems.filter(isSoldOut).length;
  const activeRewards = rewardCatalog.length;
  const customerCount = currentAdminData.loaded ? currentAdminData.customers.length : "-";

  adminGreeting.textContent = `Buenos dias, ${ownerName}`;
  adminSummary.innerHTML = `Gestiona clientes, puntos y menu desde un panel simple. Hoy conviene revisar <strong>${activeRewards} premios</strong> y <strong>${activeItems.length} productos visibles</strong>.`;
  adminStats.innerHTML = `
    <article class="admin-stat"><span>Clientes</span><strong>${escapeHtml(customerCount)}</strong><small>registrados en loyalty</small></article>
    <article class="admin-stat"><span>Productos visibles</span><strong>${activeItems.length}</strong><small>${hiddenItems} ocultos - ${soldOutItems} agotados</small></article>
    <article class="admin-stat"><span>Premios activos</span><strong>${activeRewards}</strong><small>catalogo de lealtad</small></article>
  `;
  adminActions.innerHTML = `
    <button type="button" data-admin-action="consumption"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-qr"></use></svg></span><strong>Cargar consumo</strong><small>Escanear QR, monto y productos consumidos</small></button>
    <button type="button" data-admin-action="customers"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-qr"></use></svg></span><strong>Ver clientes y QR</strong><small>Consultar puntos, alias QR e historial</small></button>
    <button type="button" data-admin-action="rewards"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-library"></use></svg></span><strong>Revisar canjes</strong><small>Aprobar, entregar o cancelar premios</small></button>
    <button type="button" data-admin-action="menu"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-menu"></use></svg></span><strong>Editar menu</strong><small>Productos, precios, fotos y visibilidad</small></button>
    <button type="button" data-admin-action="content"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg></span><strong>Crear contenido</strong><small>Post, copy e imagenes desde platillos</small></button>
    <button type="button" data-admin-action="analytics"><span><svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg></span><strong>Estadisticas</strong><small>Base para consumos, puntos y productos</small></button>
  `;
  document.querySelector("#adminSuggestionTitle").textContent = "Mantene el panel enfocado en las tareas del dia.";
  document.querySelector("#adminSuggestionText").textContent = "Clientes, canjes y menu son las tres areas que el dueno necesita resolver sin perderse en configuraciones.";
  adminSuggestionButton.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg> Preparar contenido`;
}

function renderAdminMenu() {
  if (!adminDishRows) return;
  const items = visibleAdminItems();
  adminMenuCount.textContent = items.length;
  adminDishRows.innerHTML = items
    .map((dish) => {
      const soldOut = isSoldOut(dish);
      const visible = isDishVisible(dish);
      const status = !visible ? "Oculto" : soldOut ? "Agotado" : "Visible";
      const visibilityLabel = visible ? "Ocultar del menu" : "Mostrar en menu";
      const visibilityIcon = visible ? "#icon-eye-off" : "#icon-eye";
      const recommended = dish.id === effectiveRecommendedDishId();
      const popular = dish.id === effectivePopularDishId(dish.brand);
      return `
      <div class="dish-row admin-dish-row ${visible ? "" : "is-hidden"} ${soldOut ? "is-sold-out" : ""}" data-admin-dish="${escapeAttribute(dish.id)}">
        <span class="dish-title">
          <span class="thumb" style="background-image:url('${dish.photo}')"></span>
          <span class="dish-name">${escapeHtml(dish.name)}</span>
        </span>
        <span class="cell-muted">${escapeHtml(dish.category)}</span>
        <span class="pill">${escapeHtml(dish.brand)}</span>
        <span class="cell-muted">${escapeHtml(priceRange(dish))}</span>
        <span class="status">${status}</span>
        <span class="row-actions" aria-label="Acciones de ${escapeAttribute(dish.name)}">
          <button class="icon-button ${recommended ? "is-active" : ""}" data-admin-row-action="recommend" type="button" aria-label="${recommended ? "Recomendado hoy" : "Poner en Hoy te recomendamos"} ${escapeAttribute(dish.name)}">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg>
          </button>
          <button class="icon-button hot-admin-action ${popular ? "is-active" : ""}" data-admin-row-action="popular" type="button" aria-label="${popular ? "Quitar popular" : "Marcar popular"} ${escapeAttribute(dish.name)}">
            <span aria-hidden="true">🔥</span>
          </button>
          <button class="icon-button" data-admin-row-action="visibility" type="button" aria-label="${visibilityLabel} ${escapeAttribute(dish.name)}">
            <svg class="ui-icon" aria-hidden="true"><use href="${visibilityIcon}"></use></svg>
          </button>
          <button class="icon-button" data-admin-row-action="edit" type="button" aria-label="Editar ${escapeAttribute(dish.name)}">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-pencil"></use></svg>
          </button>
          <button class="icon-button danger" data-admin-row-action="delete" type="button" aria-label="Borrar ${escapeAttribute(dish.name)}">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
          </button>
        </span>
      </div>
    `;
    })
    .join("");
}

async function setRecommendedDish(dish) {
  await saveBusinessMenuSettings({
    ...menuSettings,
    recommendedDishId: dish.id
  });
  renderAdminPanel();
  renderList();
  showToast(`${dish.name} ahora aparece en Hoy te recomendamos.`);
}

async function togglePopularDish(dish) {
  const nextPopularByBrand = { ...(menuSettings.popularByBrand || {}) };
  const currentExplicitId = explicitPopularDishId(dish.brand);
  const nextPopularId = currentExplicitId === dish.id ? "" : dish.id;
  if (nextPopularId) nextPopularByBrand[dish.brand] = nextPopularId;
  else delete nextPopularByBrand[dish.brand];
  await saveBusinessMenuSettings({
    ...menuSettings,
    popularDishId: nextPopularByBrand[currentBrand] || "",
    popularByBrand: nextPopularByBrand,
    hasRecord: true
  });
  renderAdminPanel();
  renderList();
  if (currentDetailId) {
    const currentDish = menuItems.find((item) => item.id === currentDetailId);
    if (currentDish && detailView.classList.contains("open")) openDetail(currentDish);
  }
  showToast(nextPopularId ? `${dish.name} marcado como popular.` : `${dish.name} ya no es popular.`);
}

function renderAdminCustomers() {
  if (!adminCustomerRows) return;
  if (currentAdminData.error) {
    adminCustomerRows.innerHTML = `<div class="admin-empty">No se pudieron cargar clientes: ${escapeHtml(displayError(currentAdminData.error))}</div>`;
    return;
  }

  const customers = currentAdminData.customers
    .filter((profile) => customerSearchMatches(profile, accountForCustomer(profile.id)));

  adminCustomerRows.innerHTML = customers.length
    ? customers
        .map((profile) => {
          const account = accountForCustomer(profile.id);
          const recentEvents = eventsForCustomer(profile.id);
          const pending = redemptionsForCustomer(profile.id).filter((redemption) => redemption.status === "requested").length;
          return `
            <article class="admin-customer-row">
              <span>
                <strong>${escapeHtml(profile.name)}</strong>
                <small>${escapeHtml(profile.email)}</small>
              </span>
              <b>${escapeHtml(account?.points_balance ?? 0)} pts</b>
              <span class="pill">${escapeHtml(account?.tier || "bronze")}</span>
              <code>${escapeHtml(shortQrAlias(profile, account))}</code>
              <span>
                <strong>${escapeHtml(formatEventDate(profile.created_at))}</strong>
                <small>${recentEvents.length} movimientos &middot; ${pending} canjes pendientes</small>
              </span>
            </article>
          `;
        })
        .join("")
    : `<div class="admin-empty">Todavia no hay clientes para este negocio.</div>`;
}

function renderAdminContent() {
  if (!adminContentRows || !adminContentPreview || !adminContentDishSelect || !adminContentTypeSelect) return;
  const dish = selectedContentDish();
  const format = selectedContentFormat();
  if (!dish) {
    adminCreateContentButton.disabled = true;
    adminContentDishSelect.innerHTML = "";
    adminContentTypeSelect.innerHTML = contentTypes
      .map((type) => `<option value="${escapeAttribute(type.id)}" ${type.id === format.id ? "selected" : ""}>${escapeHtml(type.title)}</option>`)
      .join("");
    adminContentDishThumb.style.backgroundImage = "";
    adminContentDishTitle.textContent = "Sin platillos visibles";
    adminContentDishMeta.textContent = "Muestra un producto del menu para generar contenido";
    adminContentTypeTitle.textContent = format.title;
    adminContentTypeMeta.textContent = format.meta;
    adminContentCount.textContent = "0";
    adminContentPreview.innerHTML = `<div class="admin-empty">Agrega productos al menu para preparar previews.</div>`;
    adminContentRows.innerHTML = `<div class="admin-empty">No hay productos visibles para generar contenido.</div>`;
    return;
  }
  adminCreateContentButton.disabled = false;
  adminCreateContentButton.classList.toggle("button-loading", contentGenerationState.status === "generating");
  if (adminAiCreditPill) {
    adminAiCreditPill.textContent = `${aiCreditBalance.remaining ?? aiMonthlyCreditLimit} creditos`;
  }
  adminCreateContentButton.disabled = contentGenerationState.status === "generating"
    || (aiCreditBalance.remaining ?? aiMonthlyCreditLimit) < aiGenerationCreditCost;
  selectedContentDishId = dish.id;
  const draft = contentDraft(dish, format);

  adminContentDishSelect.innerHTML = menuItems
    .filter(isDishVisible)
    .map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === dish.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
  adminContentTypeSelect.innerHTML = contentTypes
    .map((type) => `<option value="${escapeAttribute(type.id)}" ${type.id === format.id ? "selected" : ""}>${escapeHtml(type.title)}</option>`)
    .join("");

  adminContentDishThumb.style.backgroundImage = `url('${dish.photo}')`;
  adminContentDishTitle.textContent = dish.name;
  adminContentDishMeta.textContent = `${dish.category} - ${primaryPresentationPrice(dish)}`;
  adminContentTypeTitle.textContent = format.title;
  adminContentTypeMeta.textContent = format.meta;
  if (adminContentReferenceThumb && adminContentReferenceMeta && adminContentReferenceClear) {
    adminContentReferenceThumb.style.backgroundImage = `url('${contentReferenceImage(dish)}')`;
    const referenceText = selectedContentReferenceImage
      ? "Producto: imagen subida manualmente."
      : "Producto: foto del menu.";
    const backgroundText = selectedContentBackgroundImage
      ? " Fondo: referencia subida."
      : " Fondo: generado por IA.";
    adminContentReferenceMeta.textContent = `${referenceText}${backgroundText}`;
    adminContentReferenceClear.hidden = !selectedContentReferenceImage;
    if (adminContentBackgroundClear) adminContentBackgroundClear.hidden = !selectedContentBackgroundImage;
  }
  adminContentCount.textContent = draft.variants.length;

  adminToneRow.querySelectorAll("[data-admin-tone]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTone === selectedContentTone);
  });

  adminContentRows.innerHTML = `
    <article class="admin-draft-editor">
      <div class="admin-draft-head">
        <span>Borrador editable</span>
        <button class="ghost compact" type="button" data-admin-copy-draft="${escapeAttribute(`${draft.caption}\n\n${draft.hashtags}`)}">
          <svg class="ui-icon" aria-hidden="true"><use href="#icon-copy"></use></svg>
          Copiar
        </button>
      </div>
      <label>
        <span>Texto</span>
        <textarea data-admin-draft-caption rows="4">${escapeHtml(draft.caption)}</textarea>
      </label>
      <label>
        <span>Hashtags</span>
        <input data-admin-draft-hashtags type="text" value="${escapeAttribute(draft.hashtags)}" />
      </label>
    </article>
  `;

  adminContentPreview.innerHTML = renderContentGenerationPreview(dish, format);
}

function renderContentGenerationPreview(dish, format) {
  const aspectClass = format.id === "instagram-story" || format.id === "instagram-reel" ? "is-story" : "";
  const result = contentGenerationState.result;
  const currentImage = result?.imageResult?.imageUrl || contentReferenceImage(dish);
  const status = contentGenerationState.status;
  const currentCredits = aiCreditBalance.remaining ?? aiMonthlyCreditLimit;
  const estimatedCreditsAfterGeneration = Math.max(0, currentCredits - aiGenerationCreditCost);
  const creditsLeft = status === "generating"
    ? estimatedCreditsAfterGeneration
    : result?.imageResult?.creditsRemaining ?? currentCredits;
  const creditsLeftText = `Te quedan ${creditsLeft} creditos`;

  if (status === "generating" || status === "background") {
    const isBackground = status === "background";
    return `
      <div class="admin-preview-shell generation-preview is-generating">
        <div class="generation-preview-head">
          <span>${isBackground ? "En segundo plano" : "Generando"}</span>
          <strong>${escapeHtml(format.title)}</strong>
        </div>
        <div class="generation-skeleton ${aspectClass}">
          <span></span>
          <b></b>
        </div>
        <div class="generation-progress" aria-hidden="true"><span></span></div>
        <p>${escapeHtml(isBackground
          ? "La tarea ya quedo iniciada. Puedes cerrar la pagina y revisar Biblioteca luego."
          : "La IA esta componiendo la publicacion. Puedes cerrar la pagina sin interrumpirla.")}</p>
        <p class="generation-credit-note">${escapeHtml(creditsLeftText)}</p>
      </div>
    `;
  }

  if (status === "error" || status === "no-credits") {
    return `
      <div class="admin-preview-shell generation-preview is-error">
        <div class="generation-preview-head">
          <span>${status === "no-credits" ? "Creditos" : "Error"}</span>
          <strong>${status === "no-credits" ? "Sin creditos disponibles" : "No se pudo generar"}</strong>
        </div>
        <div class="generation-error-plate ${aspectClass}">
          <svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg>
          <strong>Generacion incompleta</strong>
          <span>No se guardo ninguna imagen ni se muestra una foto falsa como resultado.</span>
        </div>
        <p>${escapeHtml(contentGenerationState.error || "Intenta de nuevo en unos minutos.")}</p>
        <p class="generation-credit-note">${escapeHtml(creditsLeftText)}</p>
      </div>
    `;
  }

  const hasResult = status === "success" && result?.imageResult?.imageUrl;
  return `
    <div class="admin-preview-shell generation-preview ${hasResult ? "is-success" : "is-idle"}">
      <div class="generation-preview-head">
        <span>${hasResult ? "Resultado" : "Vista previa"}</span>
        <strong>${escapeHtml(format.title)}</strong>
      </div>
      <div class="admin-post-preview ${aspectClass}" style="background-image:linear-gradient(to bottom, rgba(0,0,0,0.03), rgba(0,0,0,0.28)), url('${currentImage}')">
        ${hasResult ? `<span class="generation-badge">IA</span>` : ""}
      </div>
      <div class="generation-preview-meta">
        <span>${escapeHtml(hasResult ? "Imagen generada lista" : `${dish.category} - ${primaryPresentationPrice(dish)}`)}</span>
        <span>${escapeHtml(hasResult ? `${result.imageResult.creditsUsed || aiGenerationCreditCost} creditos usados` : `${aiGenerationCreditCost} creditos por generacion`)}</span>
      </div>
      <p class="generation-credit-note">${escapeHtml(creditsLeftText)}</p>
      ${hasResult ? `
        <div class="generation-actions">
          <button class="outline" type="button" data-content-download="${escapeAttribute(result.imageResult.imageUrl)}">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-image"></use></svg>
            Descargar
          </button>
          <button class="ghost" type="button" data-content-reset="true">Generar otra</button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderAdminLibrary() {
  if (!adminLibraryGrid) return;
  const items = libraryItems();
  const visibleLibraryItems = dedupeLibraryItems(generatedContentLibrary);
  const totalItems = visibleLibraryItems.length;
  const generatedItems = visibleLibraryItems.filter((item) => !item.legacy).length;
  if (adminLibraryTitle) {
    adminLibraryTitle.textContent = `${totalItems} ${totalItems === 1 ? "pieza creada" : "piezas creadas"}`;
  }
  if (adminLibrarySubtitle) {
    adminLibrarySubtitle.textContent = generatedItems
      ? "Todo lo que has generado con IA. Edita, descarga o publica directo."
      : "Cuando generes una pieza con IA y la guardes, aparecera aca.";
  }
  if (adminLibraryFilters) {
    adminLibraryFilters.innerHTML = libraryFilterDefinitions()
      .map((filter) => `
        <button class="admin-library-filter ${adminLibraryFilter === filter.id ? "is-active" : ""}" type="button" data-library-filter="${filter.id}">
          <span>${escapeHtml(filter.label)}</span>
          <b>${filter.count}</b>
        </button>
      `)
      .join("");
  }
  adminLibraryGrid.innerHTML = items.length
    ? items
        .map((item) => `
          <article class="admin-asset-card ${item.legacy ? "is-legacy" : ""} ${isVerticalContentAsset(item) ? "is-vertical" : ""}">
            <button class="admin-asset-preview ${isVerticalContentAsset(item) ? "is-vertical" : ""}" type="button" data-admin-open-content="${escapeAttribute(item.id)}" style="background-image:url(&quot;${escapeAttribute(item.imageUrl || item.photo)}&quot;)" aria-label="Abrir pieza de ${escapeAttribute(item.dishName)}">
              <span class="asset-format-pill">${escapeHtml(libraryFormatBadge(item))}</span>
              <span class="asset-status-pill">${escapeHtml(libraryStatusLabel(item))}</span>
            </button>
            <div class="admin-asset-body">
              <span>
                <strong>${escapeHtml(item.dishName)}</strong>
                <small>${escapeHtml(relativeTimeLabel(item.createdAt))}</small>
              </span>
              <span class="admin-asset-actions">
                <button class="icon-button" type="button" data-admin-download-content="${escapeAttribute(item.imageUrl || item.photo)}" aria-label="Descargar imagen de ${escapeAttribute(item.dishName)}">
                  <svg class="ui-icon" aria-hidden="true"><use href="#icon-image"></use></svg>
                </button>
                <button class="icon-button" type="button" data-admin-edit-content="${escapeAttribute(item.id)}" aria-label="Editar borrador de ${escapeAttribute(item.dishName)}">
                  <svg class="ui-icon" aria-hidden="true"><use href="#icon-pencil"></use></svg>
                </button>
                <button class="icon-button danger" type="button" data-admin-delete-content="${escapeAttribute(item.id)}" aria-label="Borrar pieza de ${escapeAttribute(item.dishName)}">
                  <svg class="ui-icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
                </button>
              </span>
            </div>
          </article>
        `)
        .join("")
    : `<div class="admin-empty admin-library-empty">Todavia no hay contenido guardado en este filtro. Crea una pieza desde Crear contenido.</div>`;
}

function renderAdminRewards() {
  if (!adminRewardRows || !adminRedemptionRows) return;
  adminRewardsCount.textContent = rewardCatalog.length;
  adminRewardRows.innerHTML = rewardCatalog.length
    ? rewardCatalog
        .map((reward) => `
          <article class="admin-list-row">
            <span>
              <strong>${escapeHtml(reward.name)}</strong>
              <small>${escapeHtml(reward.description || "Premio activo")}</small>
            </span>
            <b>${escapeHtml(reward.cost)} pts</b>
          </article>
        `)
        .join("")
    : `<div class="admin-empty">No hay premios configurados.</div>`;

  adminRedemptionsCount.textContent = currentAdminData.redemptions.length;
  adminRedemptionRows.innerHTML = currentAdminData.redemptions.length
    ? currentAdminData.redemptions
        .map((redemption) => {
          const customer = currentAdminData.customers.find((profile) => profile.id === redemption.customer_id);
          const requested = redemption.status === "requested";
          const approved = redemption.status === "approved";
          return `
            <article class="admin-list-row admin-redemption-row">
              <span>
                <strong>${escapeHtml(redemption.reward_name)}</strong>
                <small>${escapeHtml(customer?.name || "Cliente")} &middot; ${escapeHtml(formatEventDate(redemption.created_at))}</small>
              </span>
              <span class="status">${escapeHtml(redemption.status)}</span>
              <span class="redemption-actions">
                <button class="mini-action" type="button" data-redemption-action="approved" data-redemption-id="${escapeAttribute(redemption.id)}" ${requested ? "" : "disabled"}>Aprobar</button>
                <button class="mini-action" type="button" data-redemption-action="redeemed" data-redemption-id="${escapeAttribute(redemption.id)}" ${approved ? "" : "disabled"}>Entregado</button>
                <button class="mini-action danger" type="button" data-redemption-action="cancelled" data-redemption-id="${escapeAttribute(redemption.id)}" ${redemption.status === "cancelled" || redemption.status === "redeemed" ? "disabled" : ""}>Cancelar</button>
              </span>
            </article>
          `;
        })
        .join("")
    : `<div class="admin-empty">Todavia no hay solicitudes de canje.</div>`;
}

function renderAdminSettings() {
  if (!adminSettingsGrid) return;
  const languageSummary = languages.map((language) => `${language.code.toUpperCase()} / ${language.flag}`).join(", ");
  const supabaseStatus = supabase ? "Conectado" : "Sin credenciales publicas";
  const appUrlStatus = publicAppUrl || window.location.origin;
  const ownerStatus = isOwner() ? "Owner activo" : "Sin permiso owner";

  adminSettingsGrid.innerHTML = `
    <article class="admin-setting-card">
      <span>Negocio</span>
      <strong>${escapeHtml(businessConfig.businessName || businessConfig.landing?.primaryName || businessId)}</strong>
      <small>ID: ${escapeHtml(businessId)}</small>
    </article>
    <article class="admin-setting-card">
      <span>Idiomas</span>
      <strong>${escapeHtml(languages.length)} activos</strong>
      <small>${escapeHtml(languageSummary)}</small>
    </article>
    <article class="admin-setting-card">
      <span>Supabase</span>
      <strong>${escapeHtml(supabaseStatus)}</strong>
      <small>${escapeHtml(supabaseUrl || "Agregar VITE_SUPABASE_URL")}</small>
    </article>
    <article class="admin-setting-card">
      <span>Dominio</span>
      <strong>${escapeHtml(appUrlStatus)}</strong>
      <small>Debe coincidir con Auth redirect URLs.</small>
    </article>
    <article class="admin-setting-card">
      <span>Email</span>
      <strong>Resend via Auth Hook</strong>
      <small>Configurar remitente verificado y secret en Supabase.</small>
    </article>
    <article class="admin-setting-card">
      <span>Permisos</span>
      <strong>${escapeHtml(ownerStatus)}</strong>
      <small>Owners se administran en business_admins.</small>
    </article>
    <article class="admin-setting-card admin-earn-rate-card">
      <span>Puntos por consumo</span>
      <strong>${escapeHtml(Math.round((loyaltySettings.earnRate || 0) * 100))}% del monto</strong>
      <small>Default recomendado para caja. Solo owner puede editarlo.</small>
      <label class="admin-inline-setting">
        <input type="number" min="0" step="1" value="${escapeAttribute(Math.round((loyaltySettings.earnRate || 0) * 100))}" data-earn-rate-input ${isOwner() ? "" : "disabled"} />
        <button type="button" data-save-earn-rate ${isOwner() ? "" : "disabled"}>Guardar</button>
      </label>
    </article>
  `;
}

async function updateRedemptionStatus(redemptionId, status) {
  const redemption = currentAdminData.redemptions.find((item) => item.id === redemptionId);
  if (!redemption) return;

  if (supabase) {
    const { error } = await supabase
      .from("reward_redemptions")
      .update({ status })
      .eq("id", redemptionId)
      .eq("business_id", businessId);
    if (error) {
      showToast(displayError(error));
      return;
    }
  }

  redemption.status = status;
  renderAdminRewards();
  showToast(status === "approved" ? "Canje aprobado." : status === "redeemed" ? "Canje marcado como entregado." : "Canje cancelado.");
}

async function saveLoyaltyEarnRate(ratePercent) {
  const earnRate = Math.max(0, Number(ratePercent || 0)) / 100;
  loyaltySettings = { earnRate };
  renderAuthState();
  if (!supabase || !isOwner()) {
    showToast("Porcentaje actualizado localmente.");
    renderAdminSettings();
    return;
  }
  const { error } = await supabase
    .from("business_loyalty_settings")
    .upsert({
      business_id: businessId,
      earn_rate: earnRate,
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id" });
  if (error) {
    showToast(displayError(error));
    return;
  }
  showToast("Regla de puntos actualizada.");
  renderAdminSettings();
}

function renderAdminPanel() {
  if (!isOwner()) return;
  renderAdminHome();
  renderAdminMenu();
  renderAdminCustomers();
  renderAdminContent();
  renderAdminLibrary();
  renderAdminRewards();
  renderAdminSettings();
}

const adminRouteViews = new Set(["home", "customers", "menu", "content", "library", "rewards", "analytics", "settings"]);

function pathForRoute(route, params = {}) {
  if (route === "landing") return "/";
  if (route === "menu") return "/menu";
  if (route === "menu-detail") return `/menu/${encodeURIComponent(params.dishId || "")}`;
  if (route === "admin") return "/admin";
  if (route === "admin-section") return `/admin/${encodeURIComponent(params.view || "home")}`;
  if (route === "admin-editor") return `/admin/menu/${encodeURIComponent(params.dishId || "")}/edit`;
  if (route === "admin-preview") return `/admin/menu/${encodeURIComponent(params.dishId || "")}/preview`;
  return "/menu";
}

function navigate(route, params = {}, options = {}) {
  const nextHash = `#${pathForRoute(route, params)}`;
  if (window.location.hash === nextHash) {
    renderRoute();
    return;
  }
  if (options.replace) {
    window.location.replace(`${window.location.pathname}${window.location.search}${nextHash}`);
    return;
  }
  window.location.hash = nextHash;
}

function parseRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (!parts.length) return { name: "landing" };
  if (parts[0] === "menu" && parts[1]) return { name: "menu-detail", dishId: parts[1] };
  if (parts[0] === "menu") return { name: "menu" };
  if (parts[0] === "admin" && parts.length === 1) return { name: "admin-section", view: "home" };
  if (parts[0] === "admin" && parts[1] === "menu" && parts[2] && parts[3] === "edit") return { name: "admin-editor", dishId: parts[2] };
  if (parts[0] === "admin" && parts[1] === "menu" && parts[2] && parts[3] === "preview") return { name: "admin-preview", dishId: parts[2] };
  if (parts[0] === "admin" && adminRouteViews.has(parts[1])) return { name: "admin-section", view: parts[1] };
  if (parts.length === 1 && menuItems.some((dish) => dish.id === parts[0])) return { name: "menu-detail", dishId: parts[0] };
  return { name: "menu" };
}

async function ensureAdminData() {
  if (currentAdminData.loaded || currentAdminData.error) return;
  try {
    await loadAdminData();
  } catch (error) {
    currentAdminData = {
      customers: [],
      accounts: [],
      events: [],
      redemptions: [],
      loaded: true,
      error
    };
    showToast(displayError(error));
  }
}

async function ensureAdminContentData() {
  if (!isOwner()) return;
  try {
    await Promise.all([
      loadAiCreditBalance(),
      loadGeneratedContentLibrary()
    ]);
    const recovered = await recoverPendingGeneratedContentTasks();
    if (recovered.length) {
      await loadGeneratedContentLibrary();
      showToast(`${recovered.length} imagen pendiente se guardo en Biblioteca.`);
    }
  } catch (error) {
    showToast(displayError(error));
  }
}

function hideAllSurfaces() {
  document.body.classList.remove("landing-active", "admin-active");
  detailView.classList.remove("open");
  editorPanel.classList.remove("open");
  adminPanel.hidden = true;
}

function showLanding() {
  hideAllSurfaces();
  document.body.classList.add("landing-active");
}

function showPublicMenu() {
  hideAllSurfaces();
  renderList();
}

function showPublicDetail(dishId) {
  const dish = menuItems.find((item) => item.id === dishId);
  if (!dish) {
    navigate("menu", {}, { replace: true });
    return;
  }
  showPublicMenu();
  openDetail(dish.id);
}

async function showAdminSection(view = "home") {
  if (!isOwner()) {
    showToast("Esta cuenta no tiene permisos de owner.");
    navigate("menu", {}, { replace: true });
    return false;
  }
  hideAllSurfaces();
  closeProfileModal();
  document.body.classList.add("admin-active");
  adminPanel.hidden = false;
  setAdminView(view);
  renderAdminPanel();
  await ensureAdminData();
  if (view === "content" || view === "library") {
    await ensureAdminContentData();
  }
  renderAdminPanel();
  window.requestAnimationFrame(() => adminPanel.focus?.());
  return true;
}

async function showAdminEditor(dishId) {
  if (dishId === "new") {
    const canShowAdmin = await showAdminSection("menu");
    if (!canShowAdmin) return;
    openNewAdminEditor();
    return;
  }
  const dish = menuItems.find((item) => item.id === dishId);
  if (!dish) {
    navigate("admin-section", { view: "menu" }, { replace: true });
    return;
  }
  const canShowAdmin = await showAdminSection("menu");
  if (!canShowAdmin) return;
  openAdminEditor(dish.id);
}

async function showAdminPreview(dishId) {
  if (!isOwner()) {
    showToast("Esta cuenta no tiene permisos de owner.");
    navigate("menu", {}, { replace: true });
    return;
  }
  const dish = (dishId === "new" && editorPreviewDraft)
    ? editorPreviewDraft
    : editorPreviewDraft?.id === dishId
    ? editorPreviewDraft
    : menuItems.find((item) => item.id === dishId);
  if (!dish) {
    navigate("admin-section", { view: "menu" }, { replace: true });
    return;
  }
  hideAllSurfaces();
  openDetail(dish, { mode: "admin-preview" });
}

async function renderRoute() {
  const route = parseRoute();
  if (route.name === "landing") {
    showLanding();
    return;
  }
  if (route.name === "menu") {
    showPublicMenu();
    return;
  }
  if (route.name === "menu-detail") {
    showPublicDetail(route.dishId);
    return;
  }
  if (route.name === "admin-section") {
    await showAdminSection(route.view);
    return;
  }
  if (route.name === "admin-editor") {
    await showAdminEditor(route.dishId);
    return;
  }
  if (route.name === "admin-preview") {
    await showAdminPreview(route.dishId);
  }
}

function setAdminView(view) {
  const validViews = new Set(["home", "customers", "menu", "content", "library", "rewards", "analytics", "settings"]);
  currentAdminView = validViews.has(view) ? view : "home";
  adminHome.hidden = currentAdminView !== "home";
  adminCustomersSection.hidden = currentAdminView !== "customers";
  adminMenuSection.hidden = currentAdminView !== "menu";
  adminContentSection.hidden = currentAdminView !== "content";
  adminLibrarySection.hidden = currentAdminView !== "library";
  adminRewardsSection.hidden = currentAdminView !== "rewards";
  adminAnalyticsSection.hidden = currentAdminView !== "analytics";
  adminSettingsSection.hidden = currentAdminView !== "settings";
  adminNavItems.forEach((item) => {
    const active = item.dataset.adminNav === currentAdminView;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
}

async function openAdminPanel(view = "home") {
  navigate("admin-section", { view });
}

function closeAdminPanel() {
  navigate("menu");
}

function imageBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("No se pudo leer la imagen optimizada.")));
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("No se pudo leer la imagen.")));
    reader.readAsDataURL(file);
  });
}

function loadImageBitmapUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("No se pudo cargar la imagen.")));
    image.src = url;
  });
}

function canvasToImageBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function compressEditorImage(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageBitmapUrl(objectUrl);
    const scale = Math.min(1, editorImageMaxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.drawImage(image, 0, 0, width, height);

    const preferredType = file.type === "image/png" && file.size < 450 * 1024 ? "image/png" : "image/webp";
    const blob = await canvasToImageBlob(canvas, preferredType, editorImageQuality)
      || await canvasToImageBlob(canvas, "image/jpeg", editorImageQuality);
    if (!blob) throw new Error("No se pudo comprimir la imagen.");
    return imageBlobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressEditorImageUrl(imageUrl) {
  let sourceUrl = imageUrl;
  let objectUrl = "";
  try {
    if (/^https?:\/\//i.test(imageUrl)) {
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) throw new Error("No se pudo descargar la imagen mejorada.");
      objectUrl = URL.createObjectURL(await response.blob());
      sourceUrl = objectUrl;
    }
    const image = await loadImageBitmapUrl(sourceUrl);
    const scale = Math.min(1, editorImageMaxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToImageBlob(canvas, "image/webp", editorImageQuality)
      || await canvasToImageBlob(canvas, "image/jpeg", editorImageQuality);
    if (!blob) throw new Error("No se pudo comprimir la imagen.");
    return imageBlobToDataUrl(blob);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function readContentReferenceImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Sube una imagen valida para usarla como referencia.");
  }
  return fileToDataUrl(file);
}

async function imageReferenceForGeneration(imageValue) {
  const reference = String(imageValue || "");
  if (!reference) return "";
  if (/^data:image\//i.test(reference) || /^https?:\/\//i.test(reference)) return reference;
  try {
    const response = await fetch(new URL(reference, window.location.href).href);
    if (!response.ok) return "";
    return await blobToDataUrl(await response.blob());
  } catch {
    return "";
  }
}

function openPhotoAiModal() {
  const dish = editorDish();
  if (!dish || !photoAiModal || !photoAiPreview || !photoAiPrompt || !photoAiApply) return;
  editorAiBackgroundImage = "";
  editorAiImprovedPhoto = "";
  editorAiOriginalPhoto = dish.photo;
  editorAiCompressedPhoto = "";
  photoAiPreview.classList.remove("is-loading", "is-result");
  photoAiPreview.style.backgroundImage = `url("${dish.photo}")`;
  if (photoAiCompare) photoAiCompare.hidden = true;
  if (photoAiBefore) photoAiBefore.src = dish.photo;
  if (photoAiAfter) photoAiAfter.removeAttribute("src");
  setPhotoAiComparePosition(50);
  photoAiPrompt.value = "";
  photoAiApply.disabled = true;
  if (photoAiDownload) photoAiDownload.disabled = true;
  if (photoAiRegenerate) photoAiRegenerate.hidden = true;
  if (photoAiBackgroundInput) photoAiBackgroundInput.value = "";
  if (photoAiBackgroundStatus) photoAiBackgroundStatus.textContent = "Sin fondo de referencia.";
  setPhotoAiStatus("Lista para generar una mejora.", "idle");
  photoAiModal.hidden = false;
  document.body.classList.add("photo-ai-open");
  window.requestAnimationFrame(() => photoAiPrompt?.focus());
}

function closePhotoAiModal() {
  if (!photoAiModal) return;
  photoAiModal.hidden = true;
  document.body.classList.remove("photo-ai-open");
}

function setPhotoAiComparePosition(value) {
  const parsedValue = Number(value);
  const numericValue = Number.isFinite(parsedValue)
    ? Math.max(0, Math.min(100, parsedValue))
    : 50;
  const percent = `${numericValue}%`;
  if (photoAiCompareRange) photoAiCompareRange.value = String(numericValue);
  if (photoAiAfterWrap) photoAiAfterWrap.style.clipPath = `inset(0 0 0 ${percent})`;
  if (photoAiCompareHandle) photoAiCompareHandle.style.left = percent;
}

function movePhotoAiCompareFromPointer(event) {
  if (!photoAiCompare || photoAiCompare.hidden) return;
  const rect = photoAiCompare.getBoundingClientRect();
  if (!rect.width) return;
  const position = ((event.clientX - rect.left) / rect.width) * 100;
  setPhotoAiComparePosition(position);
}

function showPhotoAiComparison(beforeUrl, afterUrl) {
  if (!photoAiPreview || !photoAiCompare || !photoAiBefore || !photoAiAfter) return;
  photoAiPreview.style.backgroundImage = "none";
  photoAiBefore.src = beforeUrl;
  photoAiAfter.src = afterUrl;
  photoAiCompare.hidden = false;
  setPhotoAiComparePosition(50);
}

function setPhotoAiStatus(message, state = "idle") {
  if (!photoAiStatus) return;
  photoAiStatus.textContent = message;
  photoAiStatus.dataset.state = state;
}

async function improveEditorPhotoWithAi() {
  const dish = editorDish();
  if (!dish || !photoAiPrompt || !photoAiPreview || !photoAiGenerate || !photoAiApply) return;
  const backgroundDescription = photoAiPrompt.value.trim();
  if (!backgroundDescription && !editorAiBackgroundImage) {
    showToast("Describe el fondo o sube una imagen de referencia.");
    photoAiPrompt.focus();
    return;
  }
  if (!supabase || !currentSession?.access_token) {
    showToast("Conecta Supabase y entra como owner para usar IA.");
    return;
  }

  const productImage = await imageReferenceForGeneration(dish.photo);
  if (!productImage) {
    showToast("No se pudo preparar la imagen del producto.");
    return;
  }

  photoAiGenerate.disabled = true;
  photoAiGenerate.setAttribute("aria-busy", "true");
  photoAiPreview.classList.add("is-loading");
  if (photoAiCompare) photoAiCompare.hidden = true;
  setPhotoAiStatus("Generando mejora con IA...", "loading");
  photoAiApply.disabled = true;
  if (photoAiDownload) photoAiDownload.disabled = true;
  try {
    const { data, error } = await supabase.functions.invoke("improve-product-photo", {
      body: {
        businessId,
        dish: {
          id: dish.id,
          name: dish.name,
          category: dish.category,
          description: dish.description,
          productImage
        },
        background: {
          description: backgroundDescription,
          image: editorAiBackgroundImage
        }
      }
    });
    if (error) {
      let body = null;
      if (error.context?.json) body = await error.context.json().catch(() => null);
      throw new Error(body?.error || error.message || "No se pudo mejorar la imagen.");
    }
    if (!data?.imageUrl || data?.source !== "kie-ai") {
      throw new Error("La IA no devolvio una imagen valida.");
    }
    editorAiImprovedPhoto = data.imageUrl;
    editorAiCompressedPhoto = "";
    showPhotoAiComparison(editorAiOriginalPhoto || dish.photo, editorAiImprovedPhoto);
    photoAiPreview.classList.add("is-result");
    photoAiApply.disabled = false;
    if (photoAiDownload) photoAiDownload.disabled = false;
    if (photoAiRegenerate) photoAiRegenerate.hidden = true;
    setPhotoAiStatus("Mejora lista. Arrastra para comparar.", "success");
    showToast("Mejora lista. Compara y decide si conservarla.");
  } catch (error) {
    const message = displayError(error);
    setPhotoAiStatus(message, "error");
    showToast(message);
  } finally {
    photoAiPreview.classList.remove("is-loading");
    photoAiGenerate.disabled = false;
    photoAiGenerate.removeAttribute("aria-busy");
  }
}

async function applyImprovedEditorPhoto() {
  const draft = editorDish();
  if (!draft || !editorAiImprovedPhoto) return;
  const dish = menuItems.find((item) => item.id === currentEditorDishId);
  if (!dish) {
    showToast("Guarda primero el producto antes de aplicar una imagen IA.");
    return;
  }
  photoAiApply.disabled = true;
  photoAiApply.setAttribute("aria-busy", "true");
  try {
    const compressedPhoto = await compressEditorImageUrl(editorAiImprovedPhoto);
    editorAiCompressedPhoto = compressedPhoto;
    const previousPhoto = dish.photo;
    const previousHighQualityPhoto = dish.highQualityPhoto;
    dish.photo = compressedPhoto;
    dish.highQualityPhoto = editorAiImprovedPhoto;
    try {
      await publishMenuCatalog();
    } catch (error) {
      dish.photo = previousPhoto;
      dish.highQualityPhoto = previousHighQualityPhoto;
      throw error;
    }
    draft.photo = compressedPhoto;
    draft.highQualityPhoto = editorAiImprovedPhoto;
    editorDraft = cloneDishForEditor(draft);
    dishPhoto.style.backgroundImage = `url('${compressedPhoto}')`;
    renderAdminMenu();
    renderAdminContent();
    renderAdminLibrary();
    renderList();
    if (currentDetailId === dish.id && detailView.classList.contains("open")) {
      openDetail(dish, { resetScroll: false });
    }
    closePhotoAiModal();
    showToast("Imagen publicada en el menu.");
  } catch (error) {
    showToast(displayError(error));
  } finally {
    photoAiApply.disabled = false;
    photoAiApply.removeAttribute("aria-busy");
  }
}

function cloneDishForEditor(dish) {
  return {
    ...dish,
    translations: dish.translations
      ? JSON.parse(JSON.stringify(dish.translations))
      : undefined,
    presentations: Array.isArray(dish.presentations)
      ? dish.presentations.map((presentation) => ({ ...presentation }))
      : []
  };
}

function newDishDraft() {
  const brand = currentBrand || brandSwitcher[0]?.name || "Catalogo";
  const category = currentCategory || categoryOrder[brand]?.[0] || Object.values(categoryOrder).flat()[0] || "General";
  const photo = menuItems[0]?.photo || businessConfig.photos?.hummus || "";
  return {
    id: uniqueDishId("nuevo-platillo"),
    brand,
    category,
    name: "",
    description: "",
    presentations: [{ name: "", price: "", note: "" }],
    photo,
    visible: true,
    soldOut: false,
    translations: {
      es: { name: "", description: "" },
      en: { name: "", description: "" },
      ar: { name: "", description: "" }
    },
    isNew: true
  };
}

async function updateEditorPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Carga un archivo de imagen.");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast("La imagen debe pesar menos de 8 MB.");
    return;
  }

  const dish = editorDish();
  if (!dish) return;

  dishPhoto.classList.add("is-loading");
  try {
    const photoUrl = await compressEditorImage(file);
    if (!photoUrl) return;
    dish.photo = photoUrl;
    dishPhoto.style.backgroundImage = `url('${photoUrl}')`;
    showToast("Foto lista. Presiona Guardar para aplicar.");
  } catch {
    showToast("No se pudo optimizar la imagen.");
  } finally {
    dishPhoto.classList.remove("is-loading");
  }
}

function editorDish() {
  return editorDraft;
}

function editorPresentations() {
  return Array.from(presentations.querySelectorAll(".presentation-row"))
    .map((row) => {
      const name = row.querySelector("input[type='text']")?.value.trim();
      const price = row.querySelector("input[type='number']")?.value.trim();
      return name && price ? { name, price, note: "" } : null;
    })
    .filter(Boolean);
}

function validateEditorDraftForSave(draft) {
  const translations = ensureDishTranslations(draft);
  const primaryText = translations.es || translations[currentEditorLang] || {};
  if (!String(primaryText.name || "").trim()) {
    showToast("El nombre del platillo es obligatorio.");
    dishNameInput.focus();
    return false;
  }
  if (!String(primaryText.description || "").trim()) {
    showToast("La descripcion corta es obligatoria.");
    dishDescriptionInput.focus();
    return false;
  }
  const rows = Array.from(presentations.querySelectorAll(".presentation-row"));
  const invalidRow = rows.find((row) => {
    const name = row.querySelector("input[type='text']")?.value.trim();
    const price = row.querySelector("input[type='number']")?.value.trim();
    return !name || !price || Number(price) < 0;
  });
  if (invalidRow) {
    showToast("Completa nombre y precio de cada presentacion.");
    invalidRow.querySelector("input")?.focus();
    return false;
  }
  if (!editorPresentations().length) {
    showToast("Agrega al menos una presentacion.");
    return false;
  }
  return true;
}

function syncEditorDraftFromControls() {
  const draft = editorDish();
  if (!draft) return null;
  commitEditorLanguageFields();
  const translations = ensureDishTranslations(draft);
  const spanishText = translations.es || translations[currentEditorLang];
  draft.name = spanishText?.name?.trim() || draft.name;
  draft.description = spanishText?.description?.trim() || draft.description;
  draft.brand = brandSelect.value;
  draft.category = categorySelect.value;
  draft.visible = visibleToggle.checked;
  draft.soldOut = Boolean(draft.soldOut);
  const nextPresentations = editorPresentations();
  if (nextPresentations.length) draft.presentations = nextPresentations;
  return draft;
}

function commitEditorLanguageFields() {
  const dish = editorDish();
  if (!dish) return null;
  const translations = ensureDishTranslations(dish);
  translations[currentEditorLang] = {
    name: dishNameInput.value.trim(),
    description: dishDescriptionInput.value.trim()
  };
  return translations[currentEditorLang];
}

function renderEditorLanguageTabs() {
  editorLanguageTabs.forEach((tab) => {
    const active = tab.dataset.lang === currentEditorLang;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

function renderEditorLanguageFields(dish = editorDish()) {
  if (!dish) return;
  const text = dishText(dish, currentEditorLang);
  dishNameInput.value = text?.name || "";
  dishDescriptionInput.value = text?.description || "";
  dishNameInput.dir = languageDirection(currentEditorLang);
  dishDescriptionInput.dir = languageDirection(currentEditorLang);
  descCount.textContent = dishDescriptionInput.value.length;
  renderEditorLanguageTabs();
}

function setEditorLanguage(lang) {
  if (!lang || lang === currentEditorLang) return;
  commitEditorLanguageFields();
  currentEditorLang = lang;
  renderEditorLanguageFields();
}

function presentationRowTemplate(presentation = {}) {
  return `
    <div class="presentation-row">
      <span class="drag-handle">::</span>
      <input type="text" value="${escapeAttribute(presentation.name || "")}" aria-label="Presentacion" placeholder="Presentacion" />
      <label><span>$</span><input type="number" value="${escapeAttribute(presentation.price || "")}" aria-label="Precio" placeholder="0" min="0" /></label>
      <button class="delete-presentation" type="button" aria-label="Eliminar presentacion">x</button>
    </div>
  `;
}

function updateEditorActionState(dish = editorDish()) {
  if (!dish || !soldOutButton) return;
  const soldOut = isSoldOut(dish);
  soldOutButton.classList.toggle("is-active", soldOut);
  soldOutButton.setAttribute("aria-pressed", String(soldOut));
  soldOutButton.innerHTML = soldOut
    ? `<svg class="ui-icon" aria-hidden="true"><use href="#icon-slash"></use></svg> Reactivar`
    : `<svg class="ui-icon" aria-hidden="true"><use href="#icon-slash"></use></svg> Marcar agotado`;
  renderEditorMeta(dish);
}

function renderEditorForm() {
  const dish = editorDish();
  if (!dish) return;
  editorTitle.textContent = dish.name || "Nuevo platillo";
  renderEditorMeta(dish);
  renderEditorLanguageFields(dish);
  dishPhoto.style.backgroundImage = `url('${dish.photo}')`;
  visibleToggle.checked = isDishVisible(dish);
  brandSelect.innerHTML = brandSwitcher
    .map((brand) => `<option value="${escapeAttribute(brand.name)}" ${brand.name === dish.brand ? "selected" : ""}>${escapeHtml(brand.name)}</option>`)
    .join("");
  categorySelect.innerHTML = Array.from(new Set(Object.values(categoryOrder).flat()))
    .map((category) => `<option value="${escapeAttribute(category)}" ${category === dish.category ? "selected" : ""}>${escapeHtml(category)}</option>`)
    .join("");
  updateEditorActionState(dish);
  presentations.innerHTML = dish.presentations
    .map((presentation) => presentationRowTemplate(presentation))
    .join("");
}

async function saveEditorDish({ silent = false } = {}) {
  const draft = syncEditorDraftFromControls();
  let dish = menuItems.find((item) => item.id === currentEditorDishId);
  if (!draft) return null;
  if (!validateEditorDraftForSave(draft)) return null;
  if (supabase && (!currentSession?.user || currentCustomer?.adminMembership?.role !== "owner")) {
    showToast("Inicia sesion como owner para publicar el menu para todos.");
    return null;
  }
  const previousItems = serializedMenuItems();
  const previousEditorDishId = currentEditorDishId;
  const translations = ensureDishTranslations(draft);
  const spanishText = translations.es || translations[currentEditorLang];
  if (!dish) {
    const nextId = uniqueDishId(spanishText?.name || draft.name);
    dish = {
      id: nextId,
      brand: draft.brand,
      category: draft.category,
      name: spanishText?.name?.trim() || draft.name,
      description: spanishText?.description?.trim() || draft.description,
      presentations: [],
      photo: draft.photo,
      visible: Boolean(draft.visible),
      soldOut: Boolean(draft.soldOut),
      lastEditedAt: "",
      lastEditedBy: ""
    };
    menuItems.unshift(dish);
    currentEditorDishId = dish.id;
  }

  dish.name = spanishText?.name?.trim() || dish.name;
  dish.description = spanishText?.description?.trim() || dish.description;
  dish.translations = JSON.parse(JSON.stringify(translations));
  dish.brand = brandSelect.value;
  dish.category = categorySelect.value;
  dish.photo = draft.photo;
  dish.visible = Boolean(draft.visible);
  dish.soldOut = Boolean(draft.soldOut);
  dish.lastEditedAt = new Date().toISOString();
  dish.lastEditedBy = editorAccountName();
  if (draft.presentations.length) {
    dish.presentations = draft.presentations.map((presentation) => ({ ...presentation }));
  }
  editorDraft = cloneDishForEditor(dish);
  editorPreviewDraft = null;
  ensureDishTranslations(editorDraft);
  try {
    await publishMenuCatalog();
  } catch (error) {
    applyMenuItemsState(previousItems);
    currentEditorDishId = previousEditorDishId;
    showToast(displayError(error));
    renderAdminMenu();
    renderAdminContent();
    renderAdminLibrary();
    renderList();
    return null;
  }
  normalizeCurrentCategory();

  editorTitle.textContent = dish.name;
  renderEditorMeta(editorDraft);
  descCount.textContent = dishDescriptionInput.value.length;
  updateEditorActionState(editorDraft);
  renderAdminMenu();
  renderAdminContent();
  renderAdminLibrary();
  renderList();
  if (currentDetailId === dish.id && detailView.classList.contains("open")) {
    openDetail(dish, { resetScroll: false });
  }
  if (window.location.hash.includes("/new/edit")) {
    navigate("admin-editor", { dishId: dish.id }, { replace: true });
  }
  if (!silent) showToast("Producto guardado.");
  return dish;
}

function openNewAdminEditor() {
  const keepPreviewDraft = currentEditorDishId === "new" && editorDraft && editorPreviewDraft;
  currentEditorDishId = "new";
  if (!keepPreviewDraft) {
    editorDraft = newDishDraft();
    editorPreviewDraft = null;
  }
  currentEditorLang = "es";
  lastEditedEditorLang = "es";
  ensureDishTranslations(editorDraft);
  renderEditorForm();
  editorPanel.classList.add("open");
}

function openAdminEditor(dishId) {
  const dish = menuItems.find((item) => item.id === dishId) || menuItems[0];
  if (!dish) return;
  const keepPreviewDraft = editorDraft?.id === dish.id && editorPreviewDraft?.id === dish.id;
  currentEditorDishId = dish.id;
  if (!keepPreviewDraft) {
    editorDraft = cloneDishForEditor(dish);
    editorPreviewDraft = null;
  }
  currentEditorLang = "es";
  lastEditedEditorLang = "es";
  ensureDishTranslations(editorDraft);
  renderEditorForm();
  editorPanel.classList.add("open");
}

function normalizeTranslatedText(value) {
  return {
    name: String(value?.name || "").trim(),
    description: String(value?.description || "").trim()
  };
}

async function translateEditorDish() {
  const dish = editorDish();
  if (!dish) return;
  commitEditorLanguageFields();
  const translations = ensureDishTranslations(dish);
  const sourceLang = lastEditedEditorLang || currentEditorLang || "es";
  const source = normalizeTranslatedText(translations[sourceLang]);

  if (!source.name && !source.description) {
    showToast("Escribe nombre o descripcion antes de traducir.");
    return;
  }

  if (!supabase) {
    showToast("Configura Supabase para usar traduccion con IA.");
    return;
  }

  const originalLabel = translateButton.innerHTML;
  translateButton.disabled = true;
  translateButton.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg> Traduciendo...`;

  try {
    const { data, error } = await supabase.functions.invoke("translate-menu-item", {
      body: {
        businessId,
        sourceLang,
        source,
        targetLangs: ["es", "en", "ar"]
      }
    });
    if (error) throw error;
    const translated = data?.translations || {};
    ["es", "en", "ar"].forEach((lang) => {
      const text = normalizeTranslatedText(translated[lang]);
      if (text.name || text.description) {
        translations[lang] = {
          name: text.name || translations[lang]?.name || dish.name,
          description: text.description || translations[lang]?.description || dish.description
        };
      }
    });
    dish.name = translations.es?.name || dish.name;
    dish.description = translations.es?.description || dish.description;
    editorTitle.textContent = dish.name;
    renderEditorLanguageFields(dish);
    showToast("Traducciones listas. Presiona Guardar para aplicar.");
  } catch (error) {
    showToast(displayError(error) || "No se pudo traducir con IA.");
  } finally {
    translateButton.disabled = false;
    translateButton.innerHTML = originalLabel;
  }
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
    await refreshDishLikes();
    await loadBusinessMenuSettings();
    renderAuthState();
    const route = parseRoute();
    if (route.name.startsWith("admin") && !isLocalDevOwner()) {
      navigate("menu", {}, { replace: true });
    } else {
      await renderRoute();
    }
    return;
  }
  await refreshAuthenticatedCustomer();
  await refreshDishLikes();
  await loadBusinessMenuSettings();
  renderList();
}

async function initializeAuth() {
  if (!supabase) {
    loadLocalDishLikes();
    loadLocalMenuSettings();
    renderAuthState();
    await renderRoute();
    return;
  }

  await loadRemoteMenuCatalog();
  const { data, error } = await supabase.auth.getSession();
  if (error) showToast(displayError(error));
  await handleSession(data?.session || null);

  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      handleSession(session);
    }, 0);
  });
}

function openDetail(idOrDish, options = {}) {
  const dish = typeof idOrDish === "object"
    ? idOrDish
    : menuItems.find((item) => item.id === idOrDish);
  if (!dish) return;
  const soldOut = isSoldOut(dish);
  const isAdminPreview = options.mode === "admin-preview";
  const isPopular = dish.id === effectivePopularDishId(dish.brand);
  currentDetailId = dish.id;
  selectedPresentationIndex = 0;
  detailView.classList.toggle("is-sold-out", soldOut);
  detailView.classList.toggle("is-hot", isPopular);
  if (options.resetScroll !== false) detailView.scrollTop = 0;
  detailPhoto.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.78)), url('${dish.photo}')`;
  detailCategory.textContent = localCategory(dish.category);
  detailName.textContent = localName(dish);
  detailArabic.textContent = dishText(dish, "ar")?.name || nameTranslations.ar[dish.name] || "";
  detailDescription.textContent = localDescription(dish);
  shareButton.dataset.shareId = dish.id;
  favoriteButton.dataset.favoriteId = dish.id;
  favoriteButton.classList.toggle("active", favoriteItems.has(dish.id));
  favoriteButton.setAttribute("aria-pressed", String(favoriteItems.has(dish.id)));
  favoriteButton.setAttribute("aria-label", favoriteItems.has(dish.id) ? "Quitar like" : "Dar like");
  if (favoriteCount) favoriteCount.innerHTML = likeIndicatorMarkup(dish.id);
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
  earnDetailPoints.textContent = soldOut ? "No disponible por ahora" : labels[currentLang].earnDetail;
  earnDetailPoints.disabled = soldOut;

  pairings.innerHTML = menuItems
    .filter((item) => isDishVisible(item) && item.brand === dish.brand)
    .filter((item) => item.id !== dish.id)
    .slice(0, 6)
    .map(
      (item) => `
        <${isAdminPreview ? "article" : "button"} class="pairing-card ${isAdminPreview ? "is-static" : ""}" ${isAdminPreview ? "" : `data-id="${escapeAttribute(item.id)}" type="button"`}>
          <span style="background-image:url('${item.photo}')"></span>
          <strong>${escapeHtml(localName(item))}</strong>
          <b>${escapeHtml(priceRange(item))}</b>
        </${isAdminPreview ? "article" : "button"}>
      `
    )
    .join("");

  detailView.classList.add("open");
}

languageOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-enter-lang]");
  if (!button) return;
  currentLang = button.dataset.enterLang;
  updateSignupShell();
  updateQrShell();
  updateProfileShell();
  navigate("menu");
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

staffScanButton?.addEventListener("click", () => openConsumptionModal(staffScanButton));
consumptionClose?.addEventListener("click", closeConsumptionModal);
consumptionModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-consumption-close]")) closeConsumptionModal();
});

consumptionQrSubmit?.addEventListener("click", () => handleConsumptionQrScan(consumptionQrInput.value));
consumptionQrInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleConsumptionQrScan(consumptionQrInput.value);
  }
});

consumptionAmount?.addEventListener("input", updateConsumptionPointsPreview);

consumptionCatalog?.addEventListener("click", (event) => {
  const presentationButton = event.target.closest("[data-consumption-presentation-dish]");
  if (presentationButton) {
    const dish = menuItems.find((item) => item.id === presentationButton.dataset.consumptionPresentationDish);
    const presentation = dish ? presentationListForDish(dish)[Number(presentationButton.dataset.consumptionPresentationIndex)] : null;
    if (dish && presentation) addConsumptionItem(dish, presentation);
    return;
  }

  const button = event.target.closest("[data-consumption-dish]");
  if (!button) return;
  const dish = menuItems.find((item) => item.id === button.dataset.consumptionDish);
  if (!dish) return;
  const presentationsList = presentationListForDish(dish);
  if (presentationsList.length <= 1) {
    addConsumptionItem(dish, presentationsList[0]);
    return;
  }
  activePresentationDishId = activePresentationDishId === dish.id ? "" : dish.id;
  renderConsumptionCatalog();
});

consumptionItemsList?.addEventListener("click", (event) => {
  const inc = event.target.closest("[data-consumption-item-inc]");
  const dec = event.target.closest("[data-consumption-item-dec]");
  if (inc) updateConsumptionItem(inc.dataset.consumptionItemInc, 1);
  if (dec) updateConsumptionItem(dec.dataset.consumptionItemDec, -1);
});

consumptionSave?.addEventListener("click", saveConsumption);

profileToggle.addEventListener("click", () => openProfileModal(profileToggle));
profileClose.addEventListener("click", closeProfileModal);
profileModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-profile-close]")) closeProfileModal();
});

profileQrButton.addEventListener("click", () => {
  closeProfileModal();
  openQrModal(profileQrButton);
});

profileAdminButton.addEventListener("click", () => navigate("admin"));

adminNavItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    const view = item.dataset.adminNav;
    navigate("admin-section", { view });
  });
});

adminExitButton.addEventListener("click", () => navigate("menu"));

adminHelpButton.addEventListener("click", () => {
  const url = businessConfig.admin?.helpUrl;
  if (!url) {
    showToast("Configura admin.helpUrl para abrir WhatsApp.");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
});

adminActions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  const view = button.dataset.adminAction;
  if (view === "consumption") {
    openConsumptionModal(button);
    return;
  }
  if (!["menu", "customers", "rewards", "content", "analytics"].includes(view)) return;
  navigate("admin-section", { view });
});

adminSuggestionButton.addEventListener("click", () => {
  navigate("admin-section", { view: "content" });
});

adminSearchInput.addEventListener("input", renderAdminMenu);
adminCustomerSearchInput.addEventListener("input", renderAdminCustomers);
adminLibrarySearchInput.addEventListener("input", renderAdminLibrary);
adminLibraryFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-library-filter]");
  if (!button) return;
  adminLibraryFilter = button.dataset.libraryFilter || "all";
  renderAdminLibrary();
});

adminNewDishButton.addEventListener("click", () => {
  navigate("admin-editor", { dishId: "new" });
});

adminViewLibraryButton.addEventListener("click", () => {
  navigate("admin-section", { view: "library" });
});

adminCreateContentButton.addEventListener("click", async () => {
  const originalLabel = adminCreateContentButton.innerHTML;
  if ((aiCreditBalance.remaining ?? aiMonthlyCreditLimit) < aiGenerationCreditCost) {
    contentGenerationState = { status: "no-credits", result: null, error: "No quedan creditos suficientes este mes." };
    renderAdminContent();
    return;
  }
  adminCreateContentButton.disabled = true;
  adminCreateContentButton.setAttribute("aria-busy", "true");
  adminCreateContentButton.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg> Generando...`;
  contentGenerationState = { status: "generating", result: null, error: "" };
  renderAdminContent();
  try {
    const result = await generateAdminContent();
    contentGenerationState = { status: "success", result, error: "" };
    if (result.imageResult.asset) {
      const item = mapGeneratedAsset(result.imageResult.asset);
      generatedContentLibrary = [item, ...generatedContentLibrary.filter((existing) => existing.id !== item.id)];
    }
    await loadGeneratedContentLibrary().catch(() => generatedContentLibrary);
    renderAdminLibrary();
    showToast("Imagen generada y guardada en Biblioteca.");
    renderAdminContent();
  } catch (error) {
    if (error.code === "insufficient_credits") {
      aiCreditBalance.remaining = typeof error.creditsRemaining === "number" ? error.creditsRemaining : aiCreditBalance.remaining;
      contentGenerationState = { status: "no-credits", result: null, error: "No quedan creditos suficientes este mes." };
    } else if (error.code === "generation_background_pending") {
      contentGenerationState = { status: "background", result: null, error: displayError(error) };
      showToast("La imagen sigue generandose en segundo plano.");
      renderAdminContent();
      return;
    } else {
      contentGenerationState = { status: "error", result: null, error: displayError(error) };
    }
    showToast(contentGenerationState.error);
    renderAdminContent();
  } finally {
    adminCreateContentButton.disabled = false;
    adminCreateContentButton.removeAttribute("aria-busy");
    adminCreateContentButton.classList.remove("button-loading");
    adminCreateContentButton.innerHTML = originalLabel;
    renderAdminContent();
  }
});

adminContentDishSelect.addEventListener("change", () => {
  selectedContentDishId = adminContentDishSelect.value;
  resetContentDraftOverride();
  resetContentGenerationState();
  renderAdminContent();
});

adminContentTypeSelect.addEventListener("change", () => {
  selectedContentType = adminContentTypeSelect.value;
  resetContentDraftOverride();
  resetContentGenerationState();
  renderAdminContent();
});

adminContentReferenceInput.addEventListener("change", async () => {
  const file = adminContentReferenceInput.files?.[0];
  if (!file) return;
  try {
    selectedContentReferenceImage = await readContentReferenceImage(file);
    resetContentGenerationState();
    showToast("Referencia visual actualizada.");
    renderAdminContent();
  } catch (error) {
    showToast(displayError(error));
  } finally {
    adminContentReferenceInput.value = "";
  }
});

adminContentBackgroundInput?.addEventListener("change", async () => {
  const file = adminContentBackgroundInput.files?.[0];
  if (!file) return;
  try {
    selectedContentBackgroundImage = await readContentReferenceImage(file);
    resetContentGenerationState();
    showToast("Fondo de referencia actualizado.");
    renderAdminContent();
  } catch (error) {
    showToast(displayError(error));
  } finally {
    adminContentBackgroundInput.value = "";
  }
});

adminContentBackgroundClear?.addEventListener("click", () => {
  selectedContentBackgroundImage = "";
  resetContentGenerationState();
  renderAdminContent();
});

adminContentReferenceClear.addEventListener("click", () => {
  selectedContentReferenceImage = "";
  resetContentGenerationState();
  renderAdminContent();
});

adminContentInstructions.addEventListener("input", () => {
  resetContentDraftOverride();
  resetContentGenerationState();
  renderAdminContent();
});

adminToneRow.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-tone]");
  if (!button) return;
  selectedContentTone = button.dataset.adminTone;
  resetContentDraftOverride();
  resetContentGenerationState();
  renderAdminContent();
});

adminContentPreview.addEventListener("click", async (event) => {
  const downloadButton = event.target.closest("[data-content-download]");
  if (downloadButton) {
    await downloadAsset(downloadButton.dataset.contentDownload);
    return;
  }

  if (event.target.closest("[data-content-reset]")) {
    resetContentGenerationState();
    renderAdminContent();
  }
});

adminContentRows.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-copy-draft]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.adminCopyDraft);
    showToast("Borrador copiado.");
  } catch {
    showToast("No se pudo copiar el borrador.");
  }
});

adminContentRows.addEventListener("input", (event) => {
  if (!event.target.matches("[data-admin-draft-caption], [data-admin-draft-hashtags]")) return;
  const dish = selectedContentDish();
  const format = selectedContentFormat();
  const captionInput = adminContentRows.querySelector("[data-admin-draft-caption]");
  const hashtagsInput = adminContentRows.querySelector("[data-admin-draft-hashtags]");
  contentDraftOverride = {
    key: contentDraftKey(dish, format),
    caption: captionInput?.value || "",
    hashtags: hashtagsInput?.value || ""
  };
  resetContentGenerationState();
  if (dish && format && adminContentPreview) {
    adminContentPreview.innerHTML = renderContentGenerationPreview(dish, format);
  }
});

adminSettingsGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-save-earn-rate]");
  if (!button) return;
  const input = adminSettingsGrid.querySelector("[data-earn-rate-input]");
  saveLoyaltyEarnRate(input?.value || 10);
});

adminLibraryGrid.addEventListener("click", async (event) => {
  const openButton = event.target.closest("[data-admin-open-content]");
  if (openButton) {
    openAssetModal(openButton.dataset.adminOpenContent);
    return;
  }

  const editButton = event.target.closest("[data-admin-edit-content]");
  if (editButton) {
    openAssetModal(editButton.dataset.adminEditContent, { focusDraft: true });
    return;
  }

  const deleteButton = event.target.closest("[data-admin-delete-content]");
  if (deleteButton) {
    const asset = libraryAssetById(deleteButton.dataset.adminDeleteContent);
    if (!asset) return;
    if (!window.confirm(`Borrar "${asset.dishName}" de la biblioteca?`)) return;
    deleteButton.disabled = true;
    try {
      await deleteLibraryAsset(asset.id);
      renderAdminLibrary();
      showToast("Pieza borrada.");
    } catch (error) {
      showToast(displayError(error));
    } finally {
      deleteButton.disabled = false;
    }
    return;
  }

  const downloadButton = event.target.closest("[data-admin-download-content]");
  if (downloadButton) {
    await downloadAsset(downloadButton.dataset.adminDownloadContent);
    return;
  }

  const button = event.target.closest("[data-admin-copy-content]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.adminCopyContent);
    showToast("Contenido copiado.");
  } catch {
    showToast("No se pudo copiar el contenido.");
  }
});

adminRedemptionRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-redemption-action]");
  if (!button || button.disabled) return;
  updateRedemptionStatus(button.dataset.redemptionId, button.dataset.redemptionAction);
});

adminDishRows.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-admin-dish]");
  if (!row) return;
  const dish = menuItems.find((item) => item.id === row.dataset.adminDish);
  if (!dish) return;
  const action = event.target.closest("[data-admin-row-action]");
  if (!action) return;

  const actionType = action.dataset.adminRowAction;
  if (actionType === "edit") {
    navigate("admin-editor", { dishId: dish.id });
    return;
  }

  if (actionType === "recommend") {
    try {
      action.disabled = true;
      await setRecommendedDish(dish);
    } catch (error) {
      showToast(displayError(error));
    } finally {
      action.disabled = false;
    }
    return;
  }

  if (actionType === "popular") {
    try {
      action.disabled = true;
      await togglePopularDish(dish);
    } catch (error) {
      showToast(displayError(error));
    } finally {
      action.disabled = false;
    }
    return;
  }

  if (actionType === "visibility") {
    const previousVisible = isDishVisible(dish);
    dish.visible = !isDishVisible(dish);
    try {
      action.disabled = true;
      await publishMenuCatalog();
      renderAdminPanel();
      renderList();
      renderAdminContent();
      renderAdminLibrary();
      showToast(isDishVisible(dish) ? "Producto visible para todos." : "Producto oculto para todos.");
    } catch (error) {
      dish.visible = previousVisible;
      showToast(displayError(error));
    } finally {
      action.disabled = false;
    }
    return;
  }

  if (actionType === "delete") {
    const shouldDelete = window.confirm(`Borrar ${dish.name} del menu?`);
    if (!shouldDelete) return;
    const index = menuItems.findIndex((item) => item.id === dish.id);
    const previousItems = serializedMenuItems();
    if (index >= 0) menuItems.splice(index, 1);
    if (selectedContentDishId === dish.id) selectedContentDishId = menuItems.find(isDishVisible)?.id || menuItems[0]?.id || "";
    normalizeCurrentCategory();
    if (currentDetailId === dish.id) navigate("admin-section", { view: "menu" }, { replace: true });
    try {
      action.disabled = true;
      await publishMenuCatalog();
      renderAdminPanel();
      renderList();
      renderAdminContent();
      renderAdminLibrary();
      showToast("Producto borrado para todos.");
    } catch (error) {
      applyMenuItemsState(previousItems);
      showToast(displayError(error));
    } finally {
      action.disabled = false;
    }
  }
});

assetModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-asset-close]") || event.target.closest("#assetModalClose")) {
    closeAssetModal();
  }
});

assetModalDownload?.addEventListener("click", async () => {
  const asset = libraryAssetById(activeLibraryAssetId);
  if (asset) await downloadAsset(asset.imageUrl || asset.photo);
});

assetModalCopy?.addEventListener("click", async () => {
  const text = `${assetModalCaption?.value || ""}\n\n${assetModalHashtags?.value || ""}`.trim();
  try {
    await navigator.clipboard.writeText(text);
    showToast("Borrador copiado.");
  } catch {
    showToast("No se pudo copiar el borrador.");
  }
});

assetModalSave?.addEventListener("click", async () => {
  if (!activeLibraryAssetId) return;
  assetModalSave.disabled = true;
  assetModalSave.setAttribute("aria-busy", "true");
  try {
    const updated = await updateLibraryAssetDraft(activeLibraryAssetId, {
      caption: assetModalCaption?.value || "",
      hashtags: assetModalHashtags?.value || ""
    });
    if (updated) renderAssetModal(updated);
    renderAdminLibrary();
    showToast("Borrador actualizado.");
  } catch (error) {
    showToast(displayError(error));
  } finally {
    assetModalSave.disabled = false;
    assetModalSave.removeAttribute("aria-busy");
  }
});

assetModalDelete?.addEventListener("click", async () => {
  const asset = libraryAssetById(activeLibraryAssetId);
  if (!asset) return;
  if (!window.confirm(`Borrar "${asset.dishName}" de la biblioteca?`)) return;
  assetModalDelete.disabled = true;
  try {
    await deleteLibraryAsset(asset.id);
    closeAssetModal();
    renderAdminLibrary();
    showToast("Pieza borrada.");
  } catch (error) {
    showToast(displayError(error));
  } finally {
    assetModalDelete.disabled = false;
  }
});

photoAiModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-photo-ai-close]") || event.target.closest("#photoAiClose")) {
    closePhotoAiModal();
  }
});

photoAiBackgroundInput?.addEventListener("change", async () => {
  const file = photoAiBackgroundInput.files?.[0];
  if (!file) return;
  try {
    editorAiBackgroundImage = await readContentReferenceImage(file);
    if (photoAiBackgroundStatus) photoAiBackgroundStatus.textContent = file.name;
    showToast("Fondo de referencia cargado.");
  } catch (error) {
    editorAiBackgroundImage = "";
    if (photoAiBackgroundStatus) photoAiBackgroundStatus.textContent = "Sin fondo de referencia.";
    showToast(displayError(error));
  } finally {
    photoAiBackgroundInput.value = "";
  }
});

photoAiGenerate?.addEventListener("click", improveEditorPhotoWithAi);
photoAiRegenerate?.addEventListener("click", improveEditorPhotoWithAi);
photoAiDownload?.addEventListener("click", async () => {
  if (!editorAiImprovedPhoto) return;
  await downloadAsset(editorAiImprovedPhoto);
});
photoAiCompareRange?.addEventListener("input", () => {
  setPhotoAiComparePosition(photoAiCompareRange.value);
});
photoAiCompareRange?.addEventListener("pointerdown", (event) => {
  movePhotoAiCompareFromPointer(event);
  photoAiCompareRange.setPointerCapture?.(event.pointerId);
});
photoAiCompareRange?.addEventListener("pointermove", (event) => {
  if (event.buttons !== 1) return;
  movePhotoAiCompareFromPointer(event);
});
photoAiApply?.addEventListener("click", applyImprovedEditorPhoto);

backButton.addEventListener("click", () => {
  editorDraft = null;
  editorPreviewDraft = null;
  navigate("admin-section", { view: "menu" });
});

dishNameInput.addEventListener("input", () => {
  lastEditedEditorLang = currentEditorLang;
});

dishDescriptionInput.addEventListener("input", () => {
  lastEditedEditorLang = currentEditorLang;
  descCount.textContent = dishDescriptionInput.value.length;
});

visibleToggle.addEventListener("change", () => {
  const dish = editorDish();
  if (!dish) return;
  dish.visible = visibleToggle.checked;
  renderEditorMeta(dish);
});

editorLanguageTabs.forEach((tab) => {
  tab.addEventListener("click", () => setEditorLanguage(tab.dataset.lang));
});

translateButton.addEventListener("click", translateEditorDish);

addPresentationButton.addEventListener("click", () => {
  const count = presentations.querySelectorAll(".presentation-row").length;
  if (count >= 3) {
    showToast("Puedes agregar hasta tres presentaciones.");
    return;
  }
  presentations.insertAdjacentHTML("beforeend", presentationRowTemplate({ name: "Nueva presentacion", price: "" }));
  const rows = presentations.querySelectorAll(".presentation-row");
  const lastRow = rows[rows.length - 1];
  lastRow?.querySelector("input")?.focus();
});

presentations.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-presentation");
  if (!deleteButton) return;
  const rows = presentations.querySelectorAll(".presentation-row");
  if (rows.length <= 1) {
    showToast("Debe quedar al menos una presentacion.");
    return;
  }
  deleteButton.closest(".presentation-row")?.remove();
});

previewDishButton.addEventListener("click", () => {
  const dish = syncEditorDraftFromControls();
  if (!dish) return;
  if (!validateEditorDraftForSave(dish)) return;
  editorPreviewDraft = cloneDishForEditor(dish);
  navigate("admin-preview", { dishId: currentEditorDishId === "new" ? "new" : dish.id });
});

soldOutButton.addEventListener("click", () => {
  const dish = editorDish();
  if (!dish) return;
  dish.soldOut = !isSoldOut(dish);
  updateEditorActionState(dish);
  showToast(isSoldOut(dish) ? "Agotado en borrador. Presiona Guardar para aplicar." : "Reactivado en borrador. Presiona Guardar para aplicar.");
});

saveDishButton.addEventListener("click", async () => {
  saveDishButton.disabled = true;
  saveDishButton.setAttribute("aria-busy", "true");
  try {
    await saveEditorDish();
  } finally {
    saveDishButton.disabled = false;
    saveDishButton.removeAttribute("aria-busy");
  }
});

improvePhotoButton?.addEventListener("click", openPhotoAiModal);

dishPhoto.addEventListener("click", () => {
  dishPhotoInput.click();
});

dishPhoto.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  dishPhotoInput.click();
});

dishPhotoInput.addEventListener("change", () => {
  updateEditorPhoto(dishPhotoInput.files?.[0]);
  dishPhotoInput.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  dishPhoto.addEventListener(eventName, (event) => {
    event.preventDefault();
    dishPhoto.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dishPhoto.addEventListener(eventName, () => {
    dishPhoto.classList.remove("drag-over");
  });
});

dishPhoto.addEventListener("drop", (event) => {
  event.preventDefault();
  updateEditorPhoto(event.dataTransfer?.files?.[0]);
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

  setSignupLoading(true);
  try {
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
  } finally {
    setSignupLoading(false);
  }
});

function bindBrandButtons() {
  brandButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentBrand = button.dataset.brand;
      normalizeCurrentCategory();
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
  navigate("menu-detail", { dishId: card.dataset.id });
});

recommendedCard.addEventListener("click", () => {
  if (!recommendedCard.dataset.id) return;
  navigate("menu-detail", { dishId: recommendedCard.dataset.id });
});

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
  if (earnDetailPoints.disabled) return;
  showToast(labels[currentLang].loyaltyShowQrHint || "Muestra tu QR al empleado para acreditar tu consumo.");
  openQrModal(earnDetailPoints);
});

rewardStrip.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-reward]");
  if (!button) return;
  if (button.dataset.pending === "true") return;
  if (!isAuthenticated()) {
    openSignupModal(button);
    return;
  }
  const reward = rewardCatalog.find((item) => item.id === button.dataset.reward);
  if (!reward) return;
  if (activeRewardRedemption(reward.id)) {
    showToast("Este premio ya tiene una solicitud activa.");
    return;
  }
  if (pointsBalance < reward.cost) {
    showToast(`${reward.cost - pointsBalance} pts restantes`);
    return;
  }
  let createdRedemption = null;
  button.dataset.pending = "true";
  button.setAttribute("aria-busy", "true");
  button.disabled = true;
  try {
    if (supabase && currentCustomer?.profile) {
      const { data, error } = await supabase.from("reward_redemptions").insert({
        customer_id: currentCustomer.profile.id,
        business_id: businessId,
        reward_id: reward.id,
        reward_name: reward.name,
        points_cost: reward.cost
      }).select("*").single();
      if (error) {
        showToast(displayError(error));
        return;
      }
      createdRedemption = data;
    } else if (currentCustomer?.profile) {
      createdRedemption = {
        id: fallbackId(),
        customer_id: currentCustomer.profile.id,
        business_id: businessId,
        reward_id: reward.id,
        reward_name: reward.name,
        points_cost: reward.cost,
        status: "requested",
        created_at: new Date().toISOString()
      };
    }
    if (createdRedemption) {
      currentCustomer.redemptions = [createdRedemption, ...(currentCustomer.redemptions || [])];
      renderLoyalty();
    }
    showToast(`${labels[currentLang].redeemed}: ${reward.name}`);
  } finally {
    button.dataset.pending = "false";
    button.removeAttribute("aria-busy");
    button.disabled = false;
  }
});

rewardsButton.addEventListener("click", () => {
  rewardStrip.scrollIntoView({ block: "center", behavior: "smooth" });
});

document.querySelector("#detailBack").addEventListener("click", () => {
  const route = parseRoute();
  if (route.name === "admin-preview") {
    navigate("admin-editor", { dishId: route.dishId });
    return;
  }
  navigate("menu");
});

shareButton.addEventListener("click", async () => {
  const dish = menuItems.find((item) => item.id === shareButton.dataset.shareId);
  if (!dish) return;
  const shareUrl = `${window.location.origin}${window.location.pathname}#/menu/${encodeURIComponent(dish.id)}`;
  const shareData = {
    title: `${localName(dish)} - ${currentBrand}`,
    text: localDescription(dish),
    url: shareUrl
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }

  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(shareUrl);
    showToast(labels[currentLang].copied || "Link copiado");
  } catch {
    const fallbackCopy = document.createElement("textarea");
    fallbackCopy.value = shareUrl;
    fallbackCopy.setAttribute("readonly", "");
    fallbackCopy.style.position = "fixed";
    fallbackCopy.style.left = "-9999px";
    document.body.appendChild(fallbackCopy);
    fallbackCopy.select();
    const copied = document.execCommand("copy");
    fallbackCopy.remove();
    showToast(copied ? (labels[currentLang].copied || "Link copiado") : "No pudimos copiar el link automaticamente.");
  }
});

favoriteButton.addEventListener("click", async () => {
  const id = favoriteButton.dataset.favoriteId;
  if (!id) return;
  if (!isAuthenticated()) {
    showToast("Registrate para marcar este platillo con corazon.");
    openSignupModal(favoriteButton);
    return;
  }
  const isLiked = favoriteItems.has(id);
  favoriteButton.disabled = true;
  try {
    if (supabase && currentSession?.user) {
      if (isLiked) {
        const { error } = await supabase
          .from("dish_likes")
          .delete()
          .eq("business_id", businessId)
          .eq("dish_id", id)
          .eq("auth_user_id", currentSession.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dish_likes")
          .insert({
            business_id: businessId,
            dish_id: id,
            auth_user_id: currentSession.user.id
          });
        if (error && error.code !== "23505") throw error;
      }
      await refreshDishLikes();
    } else {
      const nextCount = Math.max(0, dishLikeCount(id) + (isLiked ? -1 : 1));
      if (isLiked) favoriteItems.delete(id);
      else favoriteItems.add(id);
      if (nextCount) dishLikeCounts.set(id, nextCount);
      else dishLikeCounts.delete(id);
      persistLocalDishLikes();
    }
    favoriteButton.classList.toggle("active", favoriteItems.has(id));
    favoriteButton.setAttribute("aria-pressed", String(favoriteItems.has(id)));
    favoriteButton.setAttribute("aria-label", favoriteItems.has(id) ? "Quitar like" : "Dar like");
    if (favoriteCount) favoriteCount.innerHTML = likeIndicatorMarkup(id);
    if (!isLiked && favoriteItems.has(id)) triggerLikeAnimation();
    renderList();
  } catch (error) {
    showToast(displayError(error));
  } finally {
    favoriteButton.disabled = false;
  }
});

pairings.addEventListener("click", (event) => {
  const card = event.target.closest(".pairing-card");
  if (!card) return;
  if (!card.dataset.id) return;
  navigate("menu-detail", { dishId: card.dataset.id });
});

searchInput.addEventListener("input", renderList);

searchToggle.addEventListener("click", () => {
  searchInput.focus();
  searchInput.scrollIntoView({ block: "center", behavior: "smooth" });
});

languageToggle.addEventListener("click", () => {
  const langs = languages.map((language) => language.code);
  currentLang = langs[(langs.indexOf(currentLang) + 1) % langs.length];
  updateQrShell();
  updateProfileShell();
  if (!qrModal.hidden) renderCustomerQr();
  if (!profileModal.hidden) renderProfile();
  renderRoute();
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
  if (event.key === "Escape" && assetModal && !assetModal.hidden) {
    closeAssetModal();
    return;
  }
  if (event.key === "Escape" && photoAiModal && !photoAiModal.hidden) {
    closePhotoAiModal();
    return;
  }
  trapSignupFocus(event);
  trapQrFocus(event);
  trapConsumptionFocus(event);
  trapProfileFocus(event);
  trapAssetFocus(event);
  trapPhotoAiFocus(event);
  if (event.key === "Escape" && detailView.classList.contains("open")) {
    const route = parseRoute();
    if (route.name === "admin-preview") {
      navigate("admin-editor", { dishId: route.dishId });
      return;
    }
    navigate("menu");
  }
});

applyBusinessShell();
bindBrandButtons();
updateSignupShell();
updateQrShell();
updateProfileShell();
window.addEventListener("hashchange", () => {
  renderRoute();
});
await initializeAuth();
