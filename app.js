import { createClient } from "@supabase/supabase-js";

let qrCodeModuleRequest = null;
let qrScannerModuleRequest = null;

async function qrCodeToCanvas(canvas, value, options) {
  qrCodeModuleRequest ||= import("qrcode")
    .then((module) => module.default || module)
    .catch((error) => {
      qrCodeModuleRequest = null;
      throw error;
    });
  const qrCode = await qrCodeModuleRequest;
  return qrCode.toCanvas(canvas, value, options);
}

async function loadQrScanner() {
  qrScannerModuleRequest ||= import("qr-scanner")
    .then((module) => module.default || module)
    .catch((error) => {
      qrScannerModuleRequest = null;
      throw error;
    });
  return qrScannerModuleRequest;
}

const businessConfig = window.SUMI_BUSINESS_CONFIG;

if (!businessConfig) {
  throw new Error("Missing SUMI_BUSINESS_CONFIG. Load a business config before app.js.");
}

const categoryOrder = businessConfig.categoryOrder;
const rawLabels = businessConfig.labels || {};
const categoryLabels = businessConfig.categoryLabels;
const descriptionTranslations = businessConfig.descriptionTranslations;
const nameTranslations = businessConfig.nameTranslations;
const menuItems = businessConfig.menuItems;
const fallbackRewardCatalog = (businessConfig.rewardCatalog || []).map((reward, index) => normalizeRewardDefinition(reward, index));
let rewardCatalog = [...fallbackRewardCatalog];
const businessId = businessConfig.businessId || "business";
const initialMenuItems = menuItems.map((dish) => ({
  ...dish,
  translations: dish.translations ? JSON.parse(JSON.stringify(dish.translations)) : undefined,
  translationReview: dish.translationReview ? JSON.parse(JSON.stringify(dish.translationReview)) : undefined,
  presentations: Array.isArray(dish.presentations)
    ? dish.presentations.map((presentation) => ({ ...presentation }))
    : []
}));
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const publicAppUrl = String(
  import.meta.env.VITE_PUBLIC_APP_URL
    || businessConfig.publicAppUrl
    || businessConfig.qr?.defaultTarget
    || ""
).trim();
const supabase = supabaseUrl && supabaseAnonKey
  && import.meta.env.VITE_DISABLE_REMOTE !== "true"
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;
const traceLocalInit = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get("trace-init") === "1";

function traceInit(stage) {
  if (traceLocalInit) console.debug(`[Sumi init] ${stage}`);
}
const brandSwitcher = businessConfig.brandSwitcher || Object.keys(categoryOrder).map((name) => ({ name, labels: {} }));
const fallbackLanguages = [
  { code: "es", label: "Espanol", helper: "Continuar en espanol", flag: "mx", dir: "ltr" },
  { code: "en", label: "English", helper: "Continue in English", flag: "us", dir: "ltr" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", helper: "\u0645\u062a\u0627\u0628\u0639\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629", flag: "lb", dir: "rtl" }
];
const languages = normalizeBusinessLanguages(businessConfig.languages || fallbackLanguages, businessConfig.defaultLang || "es");
const languageCodes = languages.map((language) => language.code);
const primaryLanguageCode = languages.find((language) => language.primary)?.code || businessConfig.defaultLang || languageCodes[0] || "es";
const labels = normalizeBusinessLabels(rawLabels, languageCodes, primaryLanguageCode);
const translationReviewRequired = Boolean(businessConfig.menu?.reviewTranslationsBeforePublish);
const menuStateStorageKey = `sumi:menu:${businessId}:state`;
const contentLibraryStorageKey = `sumi:content:${businessId}:library`;
const dishLikesStorageKey = `sumi:likes:${businessId}:counts`;
const dishLikedItemsStorageKey = `sumi:likes:${businessId}:mine`;
const menuSettingsStorageKey = `sumi:menu:${businessId}:settings`;
const pendingContentTasksStorageKey = `sumi:content:${businessId}:pending-tasks`;
const menuEventSessionStorageKey = `sumi:menu:${businessId}:event-session`;
const referralStorageKey = `sumi:referral:${businessId}`;
const localDevOwnerStorageKey = "sumi:dev-owner";
const localDevEmployeeStorageKey = "sumi:dev-employee";
const editorImageMaxSize = 1400;
const editorImageQuality = 0.78;
const editorImageMaxPixels = 36_000_000;
const menuImagePublicBucket = "menu-images-public";
const menuImageOriginalBucket = "menu-images-originals";
const localMenuImageDbName = "sumi-menu-images";
const localMenuImageDbVersion = 1;
const localMenuImageStoreName = "originals";
const aiCreditConfig = businessConfig.aiCredits || businessConfig.content?.aiCredits || {};
const aiMonthlyCreditLimit = Math.max(1, Number(aiCreditConfig.monthlyLimit || 150));
const aiGenerationCreditCost = Math.max(1, Number(aiCreditConfig.generationCreditCost || 2));
const aiCreditPlanName = aiCreditConfig.planName || "Plan base";
const aiLowBalanceWarningThreshold = Math.max(aiGenerationCreditCost, Number(aiCreditConfig.lowBalanceWarningThreshold || aiGenerationCreditCost * 5));
let aiCreditEvents = [];

applyBusinessTheme();

function serializedMenuItems() {
  return menuItems.map((dish) => ({
    id: dish.id,
    name: dish.name,
    description: dish.description,
    brand: dish.brand,
    category: dish.category,
    photo: dish.photo,
    photoOriginal: dish.photoOriginal || dish.highQualityPhoto || "",
    photoOriginalName: dish.photoOriginalName || "",
    photoOriginalType: dish.photoOriginalType || "",
    photoOriginalSize: Number(dish.photoOriginalSize || 0),
    photoOriginalStorageKey: dish.photoOriginalStorageKey || "",
    photoStoragePath: dish.photoStoragePath || "",
    photoOriginalStoragePath: dish.photoOriginalStoragePath || "",
    visible: dish.visible !== false,
    soldOut: Boolean(dish.soldOut),
    lastEditedAt: dish.lastEditedAt || "",
    lastEditedBy: dish.lastEditedBy || "",
    translations: dish.translations,
    translationReview: dish.translationReview,
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
        translationReview: baseItem.translationReview ? JSON.parse(JSON.stringify(baseItem.translationReview)) : undefined,
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
      item.photoOriginal = savedItem.photoOriginal || savedItem.highQualityPhoto || item.photoOriginal || item.highQualityPhoto || "";
      item.photoOriginalName = savedItem.photoOriginalName || item.photoOriginalName || "";
      item.photoOriginalType = savedItem.photoOriginalType || item.photoOriginalType || "";
      item.photoOriginalSize = Number(savedItem.photoOriginalSize || item.photoOriginalSize || 0);
      item.photoOriginalStorageKey = savedItem.photoOriginalStorageKey || item.photoOriginalStorageKey || "";
      item.photoStoragePath = savedItem.photoStoragePath || item.photoStoragePath || "";
      item.photoOriginalStoragePath = savedItem.photoOriginalStoragePath || item.photoOriginalStoragePath || "";
      item.visible = savedItem.visible !== false;
      item.soldOut = Boolean(savedItem.soldOut);
      item.lastEditedAt = savedItem.lastEditedAt || item.lastEditedAt || "";
      item.lastEditedBy = savedItem.lastEditedBy || item.lastEditedBy || "";
      if (savedItem.translations && typeof savedItem.translations === "object") {
        item.translations = JSON.parse(JSON.stringify(savedItem.translations));
      }
      if (savedItem.translationReview && typeof savedItem.translationReview === "object") {
        item.translationReview = JSON.parse(JSON.stringify(savedItem.translationReview));
      }
      item.translations = item.translations && typeof item.translations === "object" ? item.translations : {};
      item.translations[primaryLanguageCode] = {
        name: item.name || item.translations[primaryLanguageCode]?.name || "",
        description: item.description || item.translations[primaryLanguageCode]?.description || ""
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
      normalizeTranslationReview(item);
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
  if (!currentSession?.user || !["owner", "manager"].includes(currentCustomer?.adminMembership?.role)) {
    throw new Error("Esta cuenta no puede publicar el menu.");
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

function canPublishRemoteMenuCatalog() {
  return Boolean(supabase && currentSession?.user && ["owner", "manager"].includes(currentCustomer?.adminMembership?.role));
}

async function publishMenuCatalog() {
  persistMenuState();
  if (canPublishRemoteMenuCatalog()) {
    await saveRemoteMenuCatalog();
    return true;
  }
  if (supabase && !isLocalDevOwner()) {
    throw new Error("Esta cuenta no puede publicar el menu.");
  }
  return false;
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

let currentLang = languageCodes.includes(businessConfig.defaultLang) ? businessConfig.defaultLang : primaryLanguageCode;
let currentBrand = businessConfig.defaultBrand || brandSwitcher[0]?.name || Object.keys(categoryOrder)[0];
let currentCategory = businessConfig.defaultCategory || categoryOrder[currentBrand]?.[0];
let currentDetailId = businessConfig.defaultDetailId || menuItems[0]?.id;
let pointsBalance = businessConfig.initialPoints || 0;
let selectedPresentationIndex = 0;
let currentSession = null;
let currentCustomer = null;
let customerRefreshTimer = null;
let customerRefreshInFlight = false;
let adminRefreshTimer = null;
let adminRefreshInFlight = false;
let adminRealtimeChannel = null;
let adminRealtimeStatus = "";
let adminRealtimeRefreshTimer = null;
let currentAdminView = "home";
let selectedContentDishId = menuItems.find(isDishVisible)?.id || menuItems[0]?.id || "";
let selectedContentType = "instagram-square";
let selectedContentTone = "";
let selectedContentReferenceImage = "";
let selectedContentBackgroundImage = "";
let selectedContentBackgroundMode = "static";
let generatedContentLibrary = loadContentLibrary();
let adminContentDataLoading = false;
let adminContentLoadToken = 0;
let adminLibraryFilter = "all";
let contentDraftOverride = { key: "", caption: "", hashtags: "" };
let activeLibraryAssetId = "";
let contentGenerationState = { status: "idle", result: null, error: "" };
let aiCreditBalance = { remaining: aiMonthlyCreditLimit, monthlyLimit: aiMonthlyCreditLimit, periodMonth: "" };
let menuSettings = { recommendedDishId: "", popularDishId: "", popularByBrand: {}, hasRecord: false };
let loyaltySettings = {
  earnRate: 0.10,
  signupBonusPoints: 0,
  referralReferrerPoints: 0,
  referralReferredPoints: 0,
  streakBonusWeeks: 3,
  streakBonusPoints: 0,
  tierSilverPoints: 500,
  tierGoldPoints: 1000,
  tierPlatinumPoints: 2000
};
let consumptionQrScanner = null;
let consumptionScannerStartToken = 0;
let activeConsumptionQrId = "";
let activeConsumptionCustomer = null;
let consumptionMode = "scan";
let consumptionStage = "lookup";
let consumptionCustomerResults = [];
let consumptionCustomerSearchToken = 0;
let consumptionItems = [];
let consumptionRequestId = "";
let lastStaffConsumption = null;
let activePresentationDishId = "";
let currentEditorDishId = null;
let editorDraft = null;
let editorPreviewDraft = null;
let currentEditorLang = primaryLanguageCode;
let lastEditedEditorLang = primaryLanguageCode;
let editorAiBackgroundImage = "";
let editorAiImprovedPhoto = "";
let editorAiOriginalPhoto = "";
let editorAiCompressedPhoto = "";
let editorPendingOriginalPhoto = null;
let editorPendingMenuPhotoBlob = null;
let editorPendingPhotoDraftId = "";
let homeRecentActivityItems = [];
let activeActivityId = "";
const homeRecentActivityPageSize = 3;
let visibleHomeRecentActivity = homeRecentActivityPageSize;
const urgentRedemptionsPageSize = 5;
let visibleUrgentRedemptions = urgentRedemptionsPageSize;
const adminRedemptionsPageSize = 8;
let visibleAdminRedemptions = adminRedemptionsPageSize;
let adminRedemptionSearch = "";
let adminRedemptionStatus = "all";
let adminRewardImageDraft = { file: null, imageUrl: "", imagePath: "", objectUrl: "" };
const customerRefreshIntervalMs = 5000;
const adminRefreshIntervalMs = 7000;
let activeAdminCustomerId = "";
let activeAdminConsumptionId = "";
let adminDataRequest = null;
let adminDataRetryTimer = null;
let adminLastRefreshAt = 0;
let adminLastRefreshError = "";
let currentAdminData = {
  customers: [],
  accounts: [],
  events: [],
  redemptions: [],
  redemptionEvents: [],
  menuEvents: [],
  consumptionCorrections: [],
  loaded: false,
  remoteLoaded: false,
  error: null
};
let staffRedemptionQueue = [];
let redemptionActionInFlight = new Set();
const trackedMenuEvents = new Set();
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
const languageMenu = document.querySelector("#languageMenu");
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
const rewardStatusNote = document.querySelector("#rewardStatusNote");
const scanQrButton = document.querySelector("#scanQrButton");
const addPurchaseButton = document.querySelector("#addPurchaseButton");
const rewardsButton = document.querySelector("#rewardsButton");
const earnDetailPoints = document.querySelector("#earnDetailPoints");
const staffConsumptionCard = document.querySelector("#staffConsumptionCard");
const staffScanButton = document.querySelector("#staffScanButton");
const staffManualButton = document.querySelector("#staffManualButton");
const staffConsumptionSubtitle = document.querySelector("#staffConsumptionSubtitle");
const staffLastConsumption = document.querySelector("#staffLastConsumption");
const staffRedemptionQueueEl = document.querySelector("#staffRedemptionQueue");
const staffRedemptionQueueCount = document.querySelector("#staffRedemptionQueueCount");
const staffIdentity = document.querySelector("#staffIdentity");
const staffLogoutButton = document.querySelector("#staffLogoutButton");
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
const consumptionCustomerPicker = document.querySelector("#consumptionCustomerPicker");
const consumptionCustomerSearch = document.querySelector("#consumptionCustomerSearch");
const consumptionCustomerResultsEl = document.querySelector("#consumptionCustomerResults");
const consumptionQuickProfile = document.querySelector("#consumptionQuickProfile");
const consumptionQuickName = document.querySelector("#consumptionQuickName");
const consumptionQuickMeta = document.querySelector("#consumptionQuickMeta");
const consumptionQuickStats = document.querySelector("#consumptionQuickStats");
const consumptionQuickRewards = document.querySelector("#consumptionQuickRewards");
const consumptionStartForm = document.querySelector("#consumptionStartForm");
const consumptionShowRewards = document.querySelector("#consumptionShowRewards");
const consumptionCustomerCard = document.querySelector("#consumptionCustomerCard");
const consumptionCustomerName = document.querySelector("#consumptionCustomerName");
const consumptionCustomerMeta = document.querySelector("#consumptionCustomerMeta");
const consumptionAmount = document.querySelector("#consumptionAmount");
const consumptionCategory = document.querySelector("#consumptionCategory");
const consumptionNote = document.querySelector("#consumptionNote");
const consumptionPointsPreview = document.querySelector("#consumptionPointsPreview");
const consumptionCatalog = document.querySelector("#consumptionCatalog");
const consumptionItemsList = document.querySelector("#consumptionItemsList");
const consumptionSave = document.querySelector("#consumptionSave");
const adminContentBackgroundMode = document.querySelector("#adminContentBackgroundMode");
const adminContentBackgroundTooltip = document.querySelector("#adminContentBackgroundTooltip");
const profileModal = document.querySelector("#profileModal");
const profileClose = document.querySelector("#profileClose");
const profileName = document.querySelector("#profileName");
const profileEmail = document.querySelector("#profileEmail");
const profilePoints = document.querySelector("#profilePoints");
const profileLevel = document.querySelector("#profileLevel");
const profileStreak = document.querySelector("#profileStreak");
const profileHistoryList = document.querySelector("#profileHistoryList");
const profileHistoryCount = document.querySelector("#profileHistoryCount");
const profileAdminButton = document.querySelector("#profileAdminButton");
const profileQrButton = document.querySelector("#profileQrButton");
const profileReferralButton = document.querySelector("#profileReferralButton");
const profileReferralBox = document.querySelector("#profileReferralBox");
const profileReferralCode = document.querySelector("#profileReferralCode");
const profileReferralText = document.querySelector("#profileReferralText");
const profileLogoutButton = document.querySelector("#profileLogoutButton");
const activityDrawer = document.querySelector("#activityDrawer");
const activityDrawerClose = document.querySelector("#activityDrawerClose");
const activityDrawerKicker = document.querySelector("#activityDrawerKicker");
const activityDrawerTitle = document.querySelector("#activityDrawerTitle");
const activityDrawerBody = document.querySelector("#activityDrawerBody");
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
const adminConsumptionsSection = document.querySelector("#adminConsumptionsSection");
const adminContentSection = document.querySelector("#adminContentSection");
const adminLibrarySection = document.querySelector("#adminLibrarySection");
const adminRewardsSection = document.querySelector("#adminRewardsSection");
const adminQrsSection = document.querySelector("#adminQrsSection");
const adminSettingsSection = document.querySelector("#adminSettingsSection");
const adminHeroActions = document.querySelector("#adminHeroActions");
const analyticsKpiGrid = document.querySelector("#analyticsKpiGrid");
const analyticsActionStrip = document.querySelector("#analyticsActionStrip");
const homeInsightGrid = document.querySelector("#homeInsightGrid");
const homeUrgentPanel = document.querySelector("#homeUrgentPanel");
const homeRecentPanel = document.querySelector("#homeRecentPanel");
const adminDishRows = document.querySelector("#adminDishRows");
const adminSearchInput = document.querySelector("#adminSearchInput");
const adminNewDishButton = document.querySelector("#adminNewDishButton");
const adminMenuCount = document.querySelector("#adminMenuCount");
const adminCustomerSearchInput = document.querySelector("#adminCustomerSearchInput");
const adminCustomerTierFilter = document.querySelector("#adminCustomerTierFilter");
const adminCustomerStatusFilter = document.querySelector("#adminCustomerStatusFilter");
const adminCustomerActivityFilter = document.querySelector("#adminCustomerActivityFilter");
const adminCustomerSortFilter = document.querySelector("#adminCustomerSortFilter");
const adminCustomerRows = document.querySelector("#adminCustomerRows");
const adminCustomerDetailPanel = document.querySelector("#adminCustomerDetailPanel");
const adminCustomerDetailClose = document.querySelector("#adminCustomerDetailClose");
const adminCustomerDetailContent = document.querySelector("#adminCustomerDetailContent");
const adminConsumptionSummary = document.querySelector("#adminConsumptionSummary");
const adminConsumptionDateFromFilter = document.querySelector("#adminConsumptionDateFromFilter");
const adminConsumptionDateToFilter = document.querySelector("#adminConsumptionDateToFilter");
const adminConsumptionClientFilter = document.querySelector("#adminConsumptionClientFilter");
const adminConsumptionMinFilter = document.querySelector("#adminConsumptionMinFilter");
const adminConsumptionMaxFilter = document.querySelector("#adminConsumptionMaxFilter");
const adminConsumptionProductFilter = document.querySelector("#adminConsumptionProductFilter");
const adminConsumptionCategoryFilter = document.querySelector("#adminConsumptionCategoryFilter");
const adminConsumptionNoteFilter = document.querySelector("#adminConsumptionNoteFilter");
const adminConsumptionEmployeeFilter = document.querySelector("#adminConsumptionEmployeeFilter");
const adminConsumptionMethodFilter = document.querySelector("#adminConsumptionMethodFilter");
const adminConsumptionStatusFilter = document.querySelector("#adminConsumptionStatusFilter");
const adminConsumptionFilterReset = document.querySelector("#adminConsumptionFilterReset");
const adminConsumptionRows = document.querySelector("#adminConsumptionRows");
const adminConsumptionDetailPanel = document.querySelector("#adminConsumptionDetailPanel");
const adminConsumptionDetailClose = document.querySelector("#adminConsumptionDetailClose");
const adminConsumptionDetailContent = document.querySelector("#adminConsumptionDetailContent");
const adminViewLibraryButton = document.querySelector("#adminViewLibraryButton");
const adminAiCreditPill = document.querySelector("#adminAiCreditPill");
const adminAiCreditPanel = document.querySelector("#adminAiCreditPanel");
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
const adminRedemptionSearchInput = document.querySelector("#adminRedemptionSearchInput");
const adminRedemptionStatusFilter = document.querySelector("#adminRedemptionStatusFilter");
const adminRedemptionsVisibleCount = document.querySelector("#adminRedemptionsVisibleCount");
const adminRedemptionRows = document.querySelector("#adminRedemptionRows");
const adminLoyaltyRulesForm = document.querySelector("#adminLoyaltyRulesForm");
const loyaltyEarnRateInput = document.querySelector("#loyaltyEarnRateInput");
const loyaltySignupBonusInput = document.querySelector("#loyaltySignupBonusInput");
const loyaltyReferralOwnerInput = document.querySelector("#loyaltyReferralOwnerInput");
const loyaltyReferralGuestInput = document.querySelector("#loyaltyReferralGuestInput");
const loyaltyStreakWeeksInput = document.querySelector("#loyaltyStreakWeeksInput");
const loyaltyStreakBonusInput = document.querySelector("#loyaltyStreakBonusInput");
const loyaltyTierSilverInput = document.querySelector("#loyaltyTierSilverInput");
const loyaltyTierGoldInput = document.querySelector("#loyaltyTierGoldInput");
const loyaltyTierPlatinumInput = document.querySelector("#loyaltyTierPlatinumInput");
const adminRewardForm = document.querySelector("#adminRewardForm");
const adminRewardEditingKey = document.querySelector("#adminRewardEditingKey");
const adminRewardNameInput = document.querySelector("#adminRewardNameInput");
const adminRewardDescriptionInput = document.querySelector("#adminRewardDescriptionInput");
const adminRewardImageInput = document.querySelector("#adminRewardImageInput");
const adminRewardImagePicker = document.querySelector("#adminRewardImagePicker");
const adminRewardImagePreview = document.querySelector("#adminRewardImagePreview");
const adminRewardImageRemove = document.querySelector("#adminRewardImageRemove");
const adminRewardCostInput = document.querySelector("#adminRewardCostInput");
const adminRewardStockInput = document.querySelector("#adminRewardStockInput");
const adminRewardMinTierInput = document.querySelector("#adminRewardMinTierInput");
const adminRewardValidUntilInput = document.querySelector("#adminRewardValidUntilInput");
const adminRewardActiveInput = document.querySelector("#adminRewardActiveInput");
const adminRewardCancelEdit = document.querySelector("#adminRewardCancelEdit");
const adminQrUse = document.querySelector("#adminQrUse");
const adminQrGoal = document.querySelector("#adminQrGoal");
const adminQrTone = document.querySelector("#adminQrTone");
const adminQrStyle = document.querySelector("#adminQrStyle");
const adminQrColor = document.querySelector("#adminQrColor");
const adminQrText = document.querySelector("#adminQrText");
const adminQrDownloadPng = document.querySelector("#adminQrDownloadPng");
const adminQrDownloadPdf = document.querySelector("#adminQrDownloadPdf");
const adminQrRefreshPreview = document.querySelector("#adminQrRefreshPreview");
const adminQrUrl = document.querySelector("#adminQrUrl");
const adminQrPreview = document.querySelector("#adminQrPreview");
const adminSettingsGrid = document.querySelector("#adminSettingsGrid");
const adminNavItems = document.querySelectorAll("[data-admin-nav]");
const adminExitButton = document.querySelector("#adminExitButton");
const adminHelpButton = document.querySelector("#adminHelpButton");
const adminGreeting = document.querySelector("#adminGreeting");
const adminSummary = document.querySelector("#adminSummary");
const editorPanel = document.querySelector("#editorPanel");
const backButton = document.querySelector("#backButton");
const editorTitle = document.querySelector("#editorTitle");
const editorMeta = document.querySelector("#editorMeta");
const dishNameInput = document.querySelector("#dishName");
const dishDescriptionInput = document.querySelector("#dishDescription");
const descCount = document.querySelector("#descCount");
const editorLanguageTabsContainer = document.querySelector("#editorLanguageTabs");
let editorLanguageTabs = document.querySelectorAll(".tab[data-lang]");
const translateButton = document.querySelector("#translateButton");
const dishPhoto = document.querySelector("#dishPhoto");
const dishPhotoInput = document.querySelector("#dishPhotoInput");
const improvePhotoButton = document.querySelector("#improvePhotoButton");
const downloadOriginalPhotoButton = document.querySelector("#downloadOriginalPhotoButton");
const dishPhotoFormatStatus = document.querySelector("#dishPhotoFormatStatus");
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
let customerQrRenderToken = 0;
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
  if (!supabase || !isOwner() || (isLocalDevOwner() && !isRemoteOwner())) return;
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
  const urlPreview = new URLSearchParams(window.location.search).get("owner-preview") === "1";
  return Boolean(import.meta.env.DEV && localHost && (urlPreview || window.localStorage.getItem(localDevOwnerStorageKey) === "true"));
}

function isLocalDevEmployee() {
  const hostname = window.location.hostname;
  const localHost = hostname === "localhost" || hostname === "127.0.0.1";
  const urlPreview = new URLSearchParams(window.location.search).get("employee-preview") === "1";
  return Boolean(import.meta.env.DEV && localHost && (urlPreview || window.localStorage.getItem(localDevEmployeeStorageKey) === "true"));
}

function isOwner() {
  return isLocalDevOwner() || currentCustomer?.adminMembership?.role === "owner";
}

function isManager() {
  return currentCustomer?.adminMembership?.role === "manager";
}

function canAccessAdmin() {
  return isOwner() || isManager();
}

function canAccessAdminView(view) {
  if (isOwner()) return true;
  return isManager() && ["home", "customers", "consumptions", "menu", "rewards"].includes(view);
}

function isRemoteOwner() {
  return Boolean(supabase && currentSession?.user && currentCustomer?.adminMembership?.role === "owner");
}

function isStaff() {
  return isLocalDevEmployee() || canAccessAdmin() || currentCustomer?.adminMembership?.role === "employee";
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

function exposeDebugState() {
  if (!import.meta.env.DEV) return;
  window.SumiDebug = {
    ...(window.SumiDebug || {}),
    admin: () => ({
      businessId,
      hasSupabase: Boolean(supabase),
      remoteDisabled: import.meta.env.VITE_DISABLE_REMOTE === "true",
      sessionEmail: currentSession?.user?.email || "",
      authenticated: isAuthenticated(),
      localDevOwner: isLocalDevOwner(),
      remoteOwner: isRemoteOwner(),
      owner: isOwner(),
      manager: isManager(),
      adminAccess: canAccessAdmin(),
      adminRole: currentCustomer?.adminMembership?.role || "",
      loaded: currentAdminData.loaded,
      remoteLoaded: currentAdminData.remoteLoaded,
      error: currentAdminData.error ? displayError(currentAdminData.error) : "",
      counts: {
        customers: currentAdminData.customers.length,
        accounts: currentAdminData.accounts.length,
        events: currentAdminData.events.length,
        redemptions: currentAdminData.redemptions.length,
        menuEvents: currentAdminData.menuEvents.length
      }
    }),
    reloadAdmin: async () => {
      currentAdminData.loaded = false;
      currentAdminData.remoteLoaded = false;
      currentAdminData.error = null;
      await ensureAdminData();
      renderAdminPanel();
      return window.SumiDebug.admin();
    }
  };
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

function tierValueForPoints(points) {
  const balance = Number(points || 0);
  const thresholds = normalizedTierThresholds(loyaltySettings);
  if (balance >= thresholds.platinum) return "platinum";
  if (balance >= thresholds.gold) return "gold";
  if (balance >= thresholds.silver) return "silver";
  return "bronze";
}

function normalizedTierThresholds(settings = loyaltySettings) {
  const silverInput = Number(settings.tierSilverPoints ?? settings.tier_silver_points ?? 500);
  const goldInput = Number(settings.tierGoldPoints ?? settings.tier_gold_points ?? 1000);
  const platinumInput = Number(settings.tierPlatinumPoints ?? settings.tier_platinum_points ?? 2000);
  const silver = Math.max(0, Math.floor(Number.isFinite(silverInput) ? silverInput : 500));
  const goldRaw = Math.floor(Number.isFinite(goldInput) ? goldInput : 1000);
  const platinumRaw = Math.floor(Number.isFinite(platinumInput) ? platinumInput : 2000);
  const gold = Math.max(silver + 1, goldRaw);
  const platinum = Math.max(gold + 1, platinumRaw);
  return { silver, gold, platinum };
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

function formatFullDateTime(dateValue) {
  if (!dateValue) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(dateValue));
  } catch {
    return "";
  }
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat("es-MX", options).format(Number(value || 0));
}

function menuEventSessionId() {
  try {
    const existing = window.sessionStorage.getItem(menuEventSessionStorageKey);
    if (existing) return existing;
    const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem(menuEventSessionStorageKey, next);
    return next;
  } catch {
    return `session-${Date.now()}`;
  }
}

function recordMenuEvent(eventType, dishId = "", options = {}) {
  if (!supabase) return;
  const eventKey = options.once === false ? "" : `${eventType}:${dishId || "menu"}`;
  if (eventKey && trackedMenuEvents.has(eventKey)) return;
  if (eventKey) trackedMenuEvents.add(eventKey);

  const payload = {
    business_id: businessId,
    event_type: eventType,
    dish_id: dishId || null,
    session_id: menuEventSessionId(),
    customer_id: currentCustomer?.profile?.id || null,
    auth_user_id: currentSession?.user?.id || null
  };

  supabase.from("business_menu_events").insert(payload).then(({ error }) => {
    if (error && eventKey) trackedMenuEvents.delete(eventKey);
  });
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

function localPresentationName(presentation) {
  const translated = presentation?.translations?.[currentLang]?.name;
  if (translated) return translated;
  const source = String(presentation?.name || "Presentacion").trim();
  const key = source.toLocaleLowerCase("es");
  const common = {
    en: {
      plato: "Plate",
      "medio kilo": "Half kilo",
      taza: "Cup",
      unidad: "Unit",
      grande: "Large",
      mediano: "Medium",
      chico: "Small"
    },
    ar: {
      plato: "طبق",
      "medio kilo": "نصف كيلو",
      taza: "كوب",
      unidad: "وحدة",
      grande: "كبير",
      mediano: "متوسط",
      chico: "صغير"
    }
  };
  return common[currentLang]?.[key] || source;
}

function presentationAvailableLabel() {
  if (currentLang === "en") return "Available presentation";
  if (currentLang === "ar") return "الخيار متاح";
  return "Presentacion disponible";
}

function presentationBadges(dish, options = {}) {
  const limit = options.limit || Infinity;
  const presentationsList = (dish.presentations || []).slice(0, limit);
  const extraCount = (dish.presentations || []).length - presentationsList.length;
  const badges = presentationsList
    .map((presentation) => `
      <b>
        <span>${escapeHtml(localPresentationName(presentation))}</span>
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
  if (!supabase || !isOwner() || (isLocalDevOwner() && !isRemoteOwner())) {
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
  if (!supabase || !isOwner() || (isLocalDevOwner() && !isRemoteOwner())) {
    aiCreditBalance = { remaining: aiMonthlyCreditLimit, monthlyLimit: aiMonthlyCreditLimit, periodMonth: new Date().toISOString().slice(0, 7) };
    aiCreditEvents = [];
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
  await loadAiCreditEvents();
  return aiCreditBalance;
}

async function loadAiCreditEvents() {
  if (!supabase || !isOwner() || (isLocalDevOwner() && !isRemoteOwner())) {
    aiCreditEvents = [];
    return aiCreditEvents;
  }
  const period = aiCreditBalance.periodMonth || new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase
    .from("business_ai_credit_events")
    .select("*")
    .eq("business_id", businessId)
    .eq("period_month", period)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    if (import.meta.env.DEV) console.warn("[Sumi credits] events unavailable", displayError(error));
    aiCreditEvents = [];
    return aiCreditEvents;
  }
  aiCreditEvents = Array.isArray(data) ? data : [];
  return aiCreditEvents;
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

function downloadFileNameFromUrl(url, fallbackExtension = "png") {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const name = pathname.split("/").filter(Boolean).pop();
    if (name && /\.[a-z0-9]+$/i.test(name)) return name;
  } catch {
    // Use the generic name below.
  }
  return `sumi-contenido-${Date.now()}.${fallbackExtension}`;
}

function sanitizedDownloadFileName(filename, fallbackExtension = "png") {
  const normalized = String(filename || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  if (normalized && /\.[a-z0-9]+$/i.test(normalized)) return normalized;
  return `${normalized || `sumi-imagen-${Date.now()}`}.${fallbackExtension}`;
}

function imageExtensionFromType(type, fallback = "png") {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif"
  };
  return extensions[String(type || "").toLowerCase()] || fallback;
}

function triggerBlobDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = sanitizedDownloadFileName(filename, imageExtensionFromType(blob.type));
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

async function downloadAsset(url, preferredFilename = "") {
  if (!url) return false;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("No se pudo descargar la imagen.");
    const blob = await response.blob();
    const filename = preferredFilename || downloadFileNameFromUrl(url, imageExtensionFromType(blob.type));
    triggerBlobDownload(blob, filename);
    return true;
  } catch {
    showToast("No se pudo descargar la imagen desde este origen.");
    return false;
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
    selectedContentBackgroundImage ? `manual-background-${selectedContentBackgroundMode}` : `product-background-${selectedContentBackgroundMode}`,
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
    selectedContentBackgroundImage ? `manual-background-${selectedContentBackgroundMode}` : `product-background-${selectedContentBackgroundMode}`,
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
  const isStaticBackground = selectedContentBackgroundMode === "static";
  const backgroundGuidance = isStaticBackground
    ? "MODO FONDO ESTATICO: conservar exactamente el fondo, los objetos, sus posiciones, encuadre, superficie y luz de la imagen de referencia. No mover, agregar, quitar, reemplazar ni reinterpretar ningun objeto. La unica intervencion permitida es superponer los badges promocionales solicitados en los laterales o esquinas."
    : selectedContentBackgroundImage
      ? "MODO FONDO DINAMICO: puedes reinterpretar solamente el ambiente de la imagen de fondo subida (superficie, luz y decoracion secundaria), pero el producto de referencia debe mantenerse exactamente igual, completo y en su misma presentacion."
      : "MODO FONDO DINAMICO: puedes crear o cambiar solamente el ambiente gastronomico; conserva el producto de referencia exactamente igual, completo y reconocible.";
  return [
    `Crear una imagen publicitaria para ${format.title}.`,
    `Producto principal: ${dish.name}. Categoria: ${dish.category}. Descripcion: ${dish.description}.`,
    `Usar la imagen del producto como referencia visual principal y tratar producto, plato, ingredientes y presentacion como pixeles bloqueados.`,
    `No cambiar el producto: no modificar ingredientes, forma, cantidad, textura, toppings, color, plato, pan, salsas, presentacion, posicion ni recorte. No agregar ni quitar objetos de la referencia.`,
    `No regenerar la fotografia: la salida debe mantener el producto y, en modo estatico, todo el fondo sin cambios. Solo agregar los badges promocionales solicitados como overlays.`,
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
      backgroundSource: selectedContentBackgroundImage ? "manual-background-upload" : "",
      backgroundMode: selectedContentBackgroundMode
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
  if (!taskId || !supabase || !isOwner() || (isLocalDevOwner() && !isRemoteOwner())) return null;
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
  if (!task?.taskId || !supabase || !currentSession?.access_token || !isOwner() || (isLocalDevOwner() && !isRemoteOwner())) return null;
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
  if (!tasks.length || !supabase || !isOwner() || (isLocalDevOwner() && !isRemoteOwner())) return [];
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

function slugifyRewardKey(value) {
  return String(value || "premio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "premio";
}

function normalizeRewardDefinition(reward = {}, index = 0) {
  const name = reward.name || reward.reward_name || "Premio";
  const rewardKey = reward.reward_key || reward.rewardKey || reward.id || slugifyRewardKey(name) || `premio-${index + 1}`;
  return {
    id: rewardKey,
    databaseId: reward.databaseId || (reward.reward_key ? reward.id : ""),
    rewardKey,
    name,
    description: reward.description || "",
    cost: Number(reward.points_cost ?? reward.cost ?? 0),
    stock: reward.stock ?? null,
    imageUrl: reward.image_url || reward.imageUrl || "",
    imagePath: reward.image_path || reward.imagePath || "",
    minTier: reward.min_tier || reward.minTier || "",
    validUntil: reward.valid_until || reward.validUntil || "",
    active: reward.active !== false,
    createdAt: reward.created_at || reward.createdAt || "",
    updatedAt: reward.updated_at || reward.updatedAt || ""
  };
}

function rewardTablePayloadFromForm() {
  const name = adminRewardNameInput?.value.trim() || "";
  const cost = Math.max(0, Number(adminRewardCostInput?.value || 0));
  const editingKey = adminRewardEditingKey?.value || "";
  return {
    business_id: businessId,
    reward_key: editingKey || `${slugifyRewardKey(name)}-${Date.now().toString(36)}`,
    name,
    description: adminRewardDescriptionInput?.value.trim() || "",
    points_cost: cost,
    stock: adminRewardStockInput?.value === "" ? null : Math.max(0, Number(adminRewardStockInput?.value || 0)),
    image_url: adminRewardImageDraft.imageUrl || null,
    image_path: adminRewardImageDraft.imagePath || null,
    min_tier: adminRewardMinTierInput?.value || null,
    valid_until: adminRewardValidUntilInput?.value || null,
    active: Boolean(adminRewardActiveInput?.checked)
  };
}

function clearRewardImageDraftObjectUrl() {
  if (adminRewardImageDraft.objectUrl) URL.revokeObjectURL(adminRewardImageDraft.objectUrl);
}

function renderAdminRewardImagePicker() {
  if (!adminRewardImagePreview || !adminRewardImagePicker) return;
  const hasImage = Boolean(adminRewardImageDraft.imageUrl);
  adminRewardImagePreview.classList.toggle("is-empty", !hasImage);
  adminRewardImagePreview.style.backgroundImage = hasImage
    ? `url("${adminRewardImageDraft.imageUrl.replace(/"/g, "\\\"")}")`
    : "";
  adminRewardImagePicker.classList.toggle("has-image", hasImage);
  adminRewardImagePicker.setAttribute("aria-label", hasImage ? "Cambiar imagen del premio" : "Subir o pegar imagen del premio");
  if (adminRewardImageRemove) adminRewardImageRemove.hidden = !hasImage;
}

function setAdminRewardImageDraft({ file = null, imageUrl = "", imagePath = "" } = {}) {
  clearRewardImageDraftObjectUrl();
  const objectUrl = file ? URL.createObjectURL(file) : "";
  adminRewardImageDraft = {
    file,
    imageUrl: objectUrl || imageUrl,
    imagePath: file ? "" : imagePath,
    objectUrl
  };
  renderAdminRewardImagePicker();
}

async function compressRewardImage(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Elige una imagen PNG, JPG o WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen no puede superar 5 MB.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageBitmapUrl(objectUrl);
    const maxSize = 1200;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToImageBlob(canvas, "image/jpeg", 0.84);
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadRewardImage(file, rewardKey) {
  if (!supabase || !isRemoteOwner()) throw new Error("Inicia sesion como owner para subir imagenes.");
  const blob = await compressRewardImage(file);
  const path = `${businessId}/${rewardKey}/${Date.now().toString(36)}.jpg`;
  const { error } = await supabase.storage
    .from("reward-images")
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("reward-images").getPublicUrl(path);
  return { path, imageUrl: data.publicUrl };
}

async function loadBusinessRewards({ owner = false } = {}) {
  if (!supabase) return rewardCatalog;
  try {
    let query = supabase
      .from("business_rewards")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (!owner) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    rewardCatalog = data?.length ? data.map(normalizeRewardDefinition) : [...fallbackRewardCatalog];
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[Sumi rewards] fallback catalog", displayError(error));
    rewardCatalog = [...fallbackRewardCatalog];
  }
  return rewardCatalog;
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

function customerVisibleIdentifier(profile) {
  return profile?.phone || profile?.phone_number || profile?.whatsapp || profile?.email || "Sin contacto";
}

function weekKey(dateValue) {
  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return "";
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay() || 7;
  normalized.setDate(normalized.getDate() - day + 1);
  return normalized.toISOString().slice(0, 10);
}

function weeklyStreakForEvents(events) {
  const purchaseWeeks = new Set(events
    .filter((event) => event.event_type === "purchase" && consumptionStatus(event) !== "cancelled")
    .map((event) => weekKey(event.created_at))
    .filter(Boolean));
  if (!purchaseWeeks.size) return 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const day = cursor.getDay() || 7;
  cursor.setDate(cursor.getDate() - day + 1);
  let streak = 0;
  let key = cursor.toISOString().slice(0, 10);
  if (!purchaseWeeks.has(key)) {
    cursor.setDate(cursor.getDate() - 7);
    key = cursor.toISOString().slice(0, 10);
  }
  while (purchaseWeeks.has(key)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
    key = cursor.toISOString().slice(0, 10);
  }
  return streak;
}

function currentWeekKey() {
  return weekKey(new Date().toISOString());
}

function pluralWeeks(count) {
  return `${count} semana${count === 1 ? "" : "s"}`;
}

function streakProgressModel(streak = 0, lastVisit = "") {
  const goalWeeks = Math.max(1, Number(loyaltySettings.streakBonusWeeks || 3));
  const bonusPoints = Math.max(0, Number(loyaltySettings.streakBonusPoints || 0));
  const safeStreak = Math.max(0, Number(streak || 0));
  const remainingWeeks = Math.max(0, goalWeeks - safeStreak);
  const maintainedThisWeek = Boolean(lastVisit && weekKey(lastVisit) === currentWeekKey());
  const progress = Math.min(100, Math.round((safeStreak / goalWeeks) * 100));
  let title = safeStreak ? `${safeStreak} sem. de racha` : "Sin racha activa";
  let helper = maintainedThisWeek
    ? "Esta semana ya cuenta para mantener la racha."
    : "Carga un consumo esta semana para mantener o iniciar la racha.";
  if (bonusPoints > 0 && remainingWeeks === 0) {
    title = `${safeStreak} sem. - bonus alcanzado`;
    helper = maintainedThisWeek
      ? `Puede recibir bonus de ${bonusPoints} pts si aun no se acredito esta semana.`
      : `Debe consumir esta semana para conservar el bonus de ${bonusPoints} pts.`;
  } else if (bonusPoints > 0) {
    helper = `${remainingWeeks ? `Faltan ${pluralWeeks(remainingWeeks)} para el bonus de ${bonusPoints} pts.` : `Bonus de ${bonusPoints} pts listo.`} ${maintainedThisWeek ? "Semana actual cubierta." : "Necesita consumo esta semana."}`;
  }
  return {
    streak: safeStreak,
    goalWeeks,
    bonusPoints,
    remainingWeeks,
    maintainedThisWeek,
    progress,
    title,
    helper,
    status: maintainedThisWeek ? "Semana actual cubierta" : "Pendiente esta semana"
  };
}

function streakProgressMarkup(progress) {
  return `
    <div class="streak-progress-card ${progress.maintainedThisWeek ? "is-covered" : "is-pending"}">
      <div>
        <span>Racha semanal</span>
        <strong>${escapeHtml(progress.title)}</strong>
        <small>${escapeHtml(progress.helper)}</small>
      </div>
      <b>${escapeHtml(progress.status)}</b>
      <div class="streak-progress-track" aria-hidden="true">
        <i style="width:${escapeAttribute(progress.progress)}%"></i>
      </div>
    </div>
  `;
}

function customerSearchMatches(profile, account) {
  const query = adminCustomerSearchInput?.value.trim().toLowerCase() || "";
  if (!query) return true;
  const haystack = `${profile.name} ${profile.email} ${customerVisibleIdentifier(profile)} ${account?.tier || ""}`.toLowerCase();
  return haystack.includes(query);
}

function normalizeAdminDashboardPayload(payload = {}) {
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }
  return {
    customers: Array.isArray(payload.customers) ? payload.customers : [],
    accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
    events: Array.isArray(payload.events) ? payload.events : [],
    redemptions: Array.isArray(payload.redemptions) ? payload.redemptions : [],
    redemptionEvents: Array.isArray(payload.redemptionEvents) ? payload.redemptionEvents : [],
    menuEvents: Array.isArray(payload.menuEvents) ? payload.menuEvents : [],
    consumptionCorrections: Array.isArray(payload.consumptionCorrections) ? payload.consumptionCorrections : []
  };
}

function normalizeStaffRedemptionQueue(payload) {
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = []; }
  }
  return Array.isArray(payload) ? payload : [];
}

async function loadStaffRedemptionQueue() {
  if (!supabase || !currentSession?.user || !isStaff()) {
    staffRedemptionQueue = [];
    return staffRedemptionQueue;
  }
  const { data, error } = await supabase.rpc("get_staff_redemption_queue", {
    target_business_id: businessId,
    queue_status: "open"
  });
  if (error) throw error;
  staffRedemptionQueue = normalizeStaffRedemptionQueue(data);
  return staffRedemptionQueue;
}

function normalizeLoyaltySettings(row = {}) {
  const thresholds = normalizedTierThresholds(row);
  return {
    earnRate: Number(row.earn_rate ?? row.earnRate ?? 0.10) || 0.10,
    signupBonusPoints: Number(row.signup_bonus_points ?? row.signupBonusPoints ?? 0) || 0,
    referralReferrerPoints: Number(row.referral_referrer_points ?? row.referralReferrerPoints ?? 0) || 0,
    referralReferredPoints: Number(row.referral_referred_points ?? row.referralReferredPoints ?? 0) || 0,
    streakBonusWeeks: Number(row.streak_bonus_weeks ?? row.streakBonusWeeks ?? 3) || 3,
    streakBonusPoints: Number(row.streak_bonus_points ?? row.streakBonusPoints ?? 0) || 0,
    tierSilverPoints: thresholds.silver,
    tierGoldPoints: thresholds.gold,
    tierPlatinumPoints: thresholds.platinum
  };
}

async function loadAdminDashboardRpc() {
  const { data, error } = await supabase.rpc("get_business_admin_dashboard", {
    target_business_id: businessId
  });
  if (error) throw error;
  return normalizeAdminDashboardPayload(data || {});
}

async function loadAdminData() {
  if (!supabase || !canAccessAdmin()) {
    currentAdminData = { customers: [], accounts: [], events: [], redemptions: [], redemptionEvents: [], menuEvents: [], consumptionCorrections: [], loaded: true, remoteLoaded: false, error: null };
    exposeDebugState();
    return currentAdminData;
  }

  if (isLocalDevOwner() && !currentSession?.user) {
    currentAdminData = { customers: [], accounts: [], events: [], redemptions: [], redemptionEvents: [], menuEvents: [], consumptionCorrections: [], loaded: false, remoteLoaded: false, error: null };
    exposeDebugState();
    return currentAdminData;
  }

  try {
    const dashboard = await loadAdminDashboardRpc();
    let redemptionEvents = [];
    try {
      const { data: history, error: historyError } = await supabase.rpc("get_reward_redemption_history", { target_business_id: businessId });
      if (historyError) throw historyError;
      redemptionEvents = Array.isArray(history) ? history : [];
    } catch (historyError) {
      if (import.meta.env.DEV) console.warn("[Sumi admin] redemption history unavailable", displayError(historyError));
    }
    currentAdminData = {
      ...dashboard,
      redemptionEvents,
      loaded: true,
      remoteLoaded: true,
      error: null
    };
    adminLastRefreshAt = Date.now();
    adminLastRefreshError = "";
    if (adminDataRetryTimer) {
      window.clearTimeout(adminDataRetryTimer);
      adminDataRetryTimer = null;
    }
    if (import.meta.env.DEV) {
      console.info("[Sumi admin] dashboard rpc loaded", {
        businessId,
        remoteOwner: isRemoteOwner(),
        localDevOwner: isLocalDevOwner(),
        customers: currentAdminData.customers.length,
        accounts: currentAdminData.accounts.length,
        events: currentAdminData.events.length,
        redemptions: currentAdminData.redemptions.length,
        menuEvents: currentAdminData.menuEvents.length
      });
    }
    exposeDebugState();
    return currentAdminData;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[Sumi admin] dashboard rpc fallback", displayError(error));
    }
  }

  const [
    customersResult,
    accountsResult,
    eventsResult,
    redemptionsResult,
    menuEventsResult,
    correctionsResult
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
      .limit(500),
    supabase
      .from("reward_redemptions")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("business_menu_events")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("point_event_corrections")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1000)
  ]);

  const correctionsMissing = correctionsResult.error && ["42P01", "42703"].includes(correctionsResult.error.code);
  const error = customersResult.error
    || accountsResult.error
    || eventsResult.error
    || redemptionsResult.error
    || menuEventsResult.error
    || (correctionsMissing ? null : correctionsResult.error);
  if (error) throw error;

  currentAdminData = {
    customers: customersResult.data || [],
    accounts: accountsResult.data || [],
    events: eventsResult.data || [],
    redemptions: redemptionsResult.data || [],
    redemptionEvents: [],
    menuEvents: menuEventsResult.data || [],
    consumptionCorrections: correctionsMissing ? [] : correctionsResult.data || [],
    loaded: true,
    remoteLoaded: true,
    error: null
  };
  adminLastRefreshAt = Date.now();
  adminLastRefreshError = "";
  if (adminDataRetryTimer) {
    window.clearTimeout(adminDataRetryTimer);
    adminDataRetryTimer = null;
  }
  if (import.meta.env.DEV) {
    console.info("[Sumi admin] data loaded", {
      businessId,
      remoteOwner: isRemoteOwner(),
      localDevOwner: isLocalDevOwner(),
      customers: currentAdminData.customers.length,
      accounts: currentAdminData.accounts.length,
      events: currentAdminData.events.length,
      redemptions: currentAdminData.redemptions.length,
      menuEvents: currentAdminData.menuEvents.length
    });
  }
  exposeDebugState();
  return currentAdminData;
}

function pendingRedemptionIdSet(data = currentAdminData) {
  return new Set((data.redemptions || [])
    .filter(redemptionIsActionableRequest)
    .map((redemption) => redemption.id)
    .filter(Boolean));
}

function notifyNewPendingRedemptions(previousIds, nextData = currentAdminData) {
  if (!previousIds?.size) return;
  const nextPending = [...pendingRedemptionIdSet(nextData)];
  const newIds = nextPending.filter((id) => !previousIds.has(id));
  if (!newIds.length) return;
  showToast(newIds.length === 1 ? "Nuevo canje pendiente." : `${newIds.length} canjes pendientes nuevos.`);
}

function adminLiveSyncMarkup() {
  if (!supabase || !canAccessAdmin()) return "";
  if (adminRefreshInFlight) {
    return `<span class="admin-live-sync is-loading">Actualizando...</span>`;
  }
  if (adminLastRefreshError) {
    return `<span class="admin-live-sync is-error">Sincronizacion con demora</span>`;
  }
  if (adminRealtimeStatus === "SUBSCRIBED") {
    return `<span class="admin-live-sync">Realtime activo - ${escapeHtml(timeLabel(adminLastRefreshAt || Date.now()))}</span>`;
  }
  if (adminRealtimeStatus === "CHANNEL_ERROR" || adminRealtimeStatus === "TIMED_OUT" || adminRealtimeStatus === "CLOSED") {
    return `<span class="admin-live-sync is-error">Realtime con demora - polling activo</span>`;
  }
  if (adminLastRefreshAt) {
    return `<span class="admin-live-sync">En vivo · ${escapeHtml(timeLabel(adminLastRefreshAt))}</span>`;
  }
  return `<span class="admin-live-sync">En vivo</span>`;
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
  const { data: resolvedAdminMembership, error: resolvedAdminError } = await supabase
    .from("business_admins")
    .select("business_id, role")
    .eq("auth_user_id", session.user.id)
    .eq("business_id", businessId)
    .in("role", ["owner", "manager", "employee"])
    .limit(1)
    .maybeSingle();
  if (resolvedAdminError) throw resolvedAdminError;
  if (!profile) {
    if (!resolvedAdminMembership) {
      currentCustomer = null;
      pointsBalance = 0;
      return null;
    }
    currentCustomer = {
      profile: null,
      account: null,
      events: [],
      redemptions: [],
      adminMembership: resolvedAdminMembership
    };
    pointsBalance = 0;
    try { await loadStaffRedemptionQueue(); } catch (queueError) {
      staffRedemptionQueue = [];
      if (import.meta.env.DEV) console.warn("[Sumi staff] redemption queue unavailable", displayError(queueError));
    }
    await loadBusinessRewards({ owner: ["owner", "manager"].includes(resolvedAdminMembership.role) });
    return currentCustomer;
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
      .in("role", ["owner", "manager", "employee"])
      .limit(1)
      .maybeSingle(),
    supabase
      .from("business_loyalty_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle()
  ]);

  if (accountError) throw accountError;
  if (eventsError) throw eventsError;
  if (redemptionsError) throw redemptionsError;
  if (adminError) throw adminError;
  if (loyaltySettingsError) {
    loyaltySettings = normalizeLoyaltySettings();
  }

  currentCustomer = {
    profile,
    account,
    events: events || [],
    redemptions: redemptions || [],
    adminMembership
  };
  if (["owner", "manager"].includes(adminMembership?.role)) {
  currentAdminData = {
      customers: [],
      accounts: [],
      events: [],
      redemptions: [],
      redemptionEvents: [],
      menuEvents: [],
      consumptionCorrections: [],
      loaded: false,
      remoteLoaded: false,
      error: null
    };
  }
  exposeDebugState();
  pointsBalance = account?.points_balance || 0;
  if (!loyaltySettingsError) {
    loyaltySettings = normalizeLoyaltySettings(businessLoyaltySettings || {});
  }
  if (adminMembership?.role === "employee") {
    try { await loadStaffRedemptionQueue(); } catch (queueError) {
      staffRedemptionQueue = [];
      if (import.meta.env.DEV) console.warn("[Sumi staff] redemption queue unavailable", displayError(queueError));
    }
  } else {
    staffRedemptionQueue = [];
  }
  await loadBusinessRewards({ owner: ["owner", "manager"].includes(adminMembership?.role) });
  return currentCustomer;
}

function renderAuthState() {
  const authenticated = isAuthenticated();
  const localEmployeePreview = isLocalDevEmployee();
  const staff = (authenticated || currentCustomer?.adminMembership?.role || localEmployeePreview) && isStaff();
  // A local employee preview must stay in employee mode even when an owner is
  // already authenticated in the same browser. Real employees reach the same
  // workspace through their membership role.
  const employeeWorkspace = localEmployeePreview || (staff && !canAccessAdmin());
  document.body.classList.toggle("employee-preview", localEmployeePreview);
  document.body.classList.toggle("employee-workspace", employeeWorkspace);
  if (loyaltyCard) loyaltyCard.hidden = !authenticated || staff;
  if (staffConsumptionCard) staffConsumptionCard.hidden = !employeeWorkspace;
  if (staffConsumptionSubtitle) {
    staffConsumptionSubtitle.textContent = `Escanea el QR o busca al cliente y acredita ${Math.round((loyaltySettings.earnRate || 0) * 100)}% en puntos.`;
  }
  if (signupCta) signupCta.hidden = authenticated || localEmployeePreview;
  if (profileToggle) {
    profileToggle.hidden = !authenticated || employeeWorkspace;
    profileToggle.setAttribute("aria-label", labels[currentLang].profileButtonLabel || "Abrir perfil");
  }
  renderStaffWorkspace();
  exposeDebugState();
}

function renderStaffWorkspace() {
  if (staffIdentity) {
    const identity = currentSession?.user?.user_metadata?.name
      || currentSession?.user?.email
      || (isLocalDevEmployee() ? "Vista previa de empleado" : "Cuenta de empleado");
    staffIdentity.textContent = identity;
  }
  if (!staffLastConsumption) return;
  if (!lastStaffConsumption) {
    staffLastConsumption.innerHTML = `
      <span>Último registro</span>
      <strong>Sin consumos en esta sesión</strong>
      <small>El último consumo aparecerá aquí para comprobarlo rápidamente.</small>
    `;
  } else {
    staffLastConsumption.innerHTML = `
    <span>Último registro</span>
    <strong>${escapeHtml(lastStaffConsumption.customerName)} · ${escapeHtml(formatCurrency(lastStaffConsumption.amount))}</strong>
    <small>${escapeHtml(`${lastStaffConsumption.points} pts acreditados · ${formatFullDateTime(lastStaffConsumption.createdAt)}`)}</small>
    `;
  }
  if (staffRedemptionQueueCount) staffRedemptionQueueCount.textContent = String(staffRedemptionQueue.length);
  if (staffRedemptionQueueEl) {
    staffRedemptionQueueEl.innerHTML = staffRedemptionQueue.length
      ? staffRedemptionQueue.map((item) => `
        <article class="staff-queue-row">
          <span><strong>${escapeHtml(item.customer_name || "Cliente")}</strong><small>${escapeHtml(item.reward_name || "Premio")} · ${escapeHtml(formatFullDateTime(item.created_at))}</small></span>
          <b>${escapeHtml(item.points_cost || 0)} pts</b>
          <span class="redemption-actions">
            ${item.status === "requested" ? `<button class="mini-action" type="button" data-staff-redemption-action="approved" data-redemption-id="${escapeAttribute(item.id)}">Aprobar</button>` : ""}
            ${item.status === "approved" ? `<button class="mini-action" type="button" data-staff-redemption-action="redeemed" data-redemption-id="${escapeAttribute(item.id)}">Entregar</button>` : ""}
          </span>
        </article>
      `).join("")
      : `<p class="staff-queue-empty">No hay canjes para resolver.</p>`;
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

  renderLanguageChoices();
  renderEditorLanguageTabsMarkup();

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

function languageChoiceMarkup(language, { compact = false } = {}) {
  const selected = language.code === currentLang;
  return `
    <button class="language-option ${compact ? "is-compact" : ""} ${selected ? "selected" : ""}"
      data-enter-lang="${escapeAttribute(language.code)}" type="button"
      ${compact ? `role="menuitemradio" aria-checked="${selected}"` : `aria-pressed="${selected}"`}>
      <span class="flag ${escapeAttribute(language.flag)}" ${flagStyle(language.flag)} aria-hidden="true"></span>
      <span dir="${escapeAttribute(language.dir || "ltr")}">
        <strong>${escapeHtml(language.label)}</strong>
        ${compact ? "" : `<small>${escapeHtml(language.helper)}</small>`}
      </span>
    </button>
  `;
}

function renderLanguageChoices() {
  const fullMarkup = languages.map((language) => languageChoiceMarkup(language)).join("");
  const menuMarkup = languages.map((language) => languageChoiceMarkup(language, { compact: true })).join("");
  if (languageOptions) languageOptions.innerHTML = fullMarkup;
  if (languageMenu) languageMenu.innerHTML = menuMarkup;
}

function closeLanguageMenu({ restoreFocus = false } = {}) {
  if (!languageMenu || !languageToggle) return;
  languageMenu.hidden = true;
  languageToggle.setAttribute("aria-expanded", "false");
  if (restoreFocus) languageToggle.focus();
}

function setCurrentLanguage(languageCode, { navigateToMenu = false } = {}) {
  if (!languageCodes.includes(languageCode)) return;
  currentLang = languageCode;
  renderLanguageChoices();
  closeLanguageMenu();
  updateSignupShell();
  updateQrShell();
  updateProfileShell();
  if (!qrModal.hidden) renderCustomerQr();
  if (!profileModal.hidden) renderProfile();
  if (navigateToMenu) navigate("menu");
  else renderRoute();
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
    const rendered = await renderCustomerQrCanvas(customerQrPayload(customerId), {
      width: 192,
      margin: 1,
      errorCorrectionLevel: "H",
      color: {
        dark: "#461904",
        light: "#ffffff"
      }
    });
    if (!rendered) return;
    drawBusinessMarkOnQr(customerQrCanvas);
  } catch {
    qrError.textContent = label.qrError || "No se pudo generar el QR. Intenta de nuevo.";
  }
}

async function openAdminCustomerQr(customerId, trigger = adminCustomerRows) {
  const profile = customerProfile(customerId);
  const account = accountForCustomer(customerId);
  const qrId = account?.public_qr_id;
  if (!profile || !qrId) {
    showToast("Ese cliente todavia no tiene QR publico.");
    return;
  }
  lastQrTrigger = trigger;
  qrModal.hidden = false;
  document.body.classList.add("qr-open");
  updateQrShell();
  setText("#qrTitle", `QR de ${profile.name || "cliente"}`);
  setText("#qrText", "Mostra este codigo en caja para cargar consumo o validar al cliente.");
  qrCustomerId.textContent = shortQrAlias(profile, account);
  qrError.textContent = "";
  try {
    const rendered = await renderCustomerQrCanvas(customerQrPayload(qrId), {
      width: 192,
      margin: 1,
      errorCorrectionLevel: "H",
      color: {
        dark: "#461904",
        light: "#ffffff"
      }
    });
    if (!rendered) return;
    drawBusinessMarkOnQr(customerQrCanvas);
  } catch {
    qrError.textContent = "No se pudo generar el QR. Intenta de nuevo.";
  }
  window.requestAnimationFrame(() => qrClose.focus());
}

async function renderCustomerQrCanvas(payload, options) {
  const renderToken = ++customerQrRenderToken;
  const context = customerQrCanvas?.getContext?.("2d");
  context?.clearRect(0, 0, customerQrCanvas.width, customerQrCanvas.height);
  customerQrCanvas?.setAttribute("aria-busy", "true");
  try {
    const pendingCanvas = document.createElement("canvas");
    await qrCodeToCanvas(pendingCanvas, payload, options);
    if (renderToken !== customerQrRenderToken || qrModal?.hidden) return false;
    customerQrCanvas.width = pendingCanvas.width;
    customerQrCanvas.height = pendingCanvas.height;
    customerQrCanvas.getContext("2d")?.drawImage(pendingCanvas, 0, 0);
    return true;
  } finally {
    if (renderToken === customerQrRenderToken) customerQrCanvas?.removeAttribute("aria-busy");
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

function publicMenuUrl() {
  const base = (publicAppUrl || `${window.location.origin}${window.location.pathname}`).replace(/\/$/, "");
  return `${base}/`;
}

function captureReferralCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("ref") || params.get("referido") || "";
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (cleanCode) window.localStorage.setItem(referralStorageKey, cleanCode);
  return cleanCode;
}

function activeReferralCode() {
  return captureReferralCodeFromUrl() || window.localStorage.getItem(referralStorageKey) || "";
}

function customerReferralCode() {
  return currentCustomer?.profile?.referral_code || currentCustomer?.profile?.referralCode || "";
}

function customerReferralLink() {
  const code = customerReferralCode();
  if (!code) return "";
  return `${publicMenuUrl()}?ref=${encodeURIComponent(code)}`;
}

async function downloadMenuQr() {
  try {
    const canvas = document.createElement("canvas");
    await qrCodeToCanvas(canvas, publicMenuUrl(), {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: "#263128",
        light: "#ffffff"
      }
    });
    drawBusinessMarkOnQr(canvas);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${businessId}-menu-qr.png`;
    link.click();
    showToast("QR del menu descargado.");
  } catch (error) {
    showToast(displayError(error) || "No se pudo generar el QR.");
  }
}

function adminQrSuggestedText() {
  const goal = adminQrGoal?.value || "menu";
  const tone = adminQrTone?.value || "directo";
  const suggestions = {
    menu: {
      directo: "Pedi, suma y canjea.",
      elegante: "Tu proxima recompensa empieza aca.",
      divertido: "Mira el menu y gana puntos.",
      premium: "Descubri beneficios exclusivos."
    },
    registro: {
      directo: "Entra al club de beneficios.",
      elegante: "Unite al club y acumula recompensas.",
      divertido: "Sumate y empeza a ganar.",
      premium: "Accede a recompensas del negocio."
    },
    premios: {
      directo: "Descubri premios exclusivos.",
      elegante: "Canjea beneficios en tu proxima visita.",
      divertido: "Tus puntos se convierten en premios.",
      premium: "Beneficios reservados para clientes frecuentes."
    },
    promo: {
      directo: "Escanea y aprovecha la promo.",
      elegante: "Una promocion especial te espera.",
      divertido: "Tu antojo tiene premio.",
      premium: "Una experiencia especial empieza aca."
    }
  };
  return suggestions[goal]?.[tone] || "Pedi, suma y canjea.";
}

function setSelectValueIfAvailable(control, value) {
  if (!control || !value) return;
  const hasOption = [...control.options].some((option) => option.value === value);
  if (hasOption) control.value = value;
}

function applyAdminQrDefaults() {
  if (!adminQrPreview || adminQrPreview.dataset.defaultsApplied === "true") return;
  const qrConfig = businessConfig.qr || {};
  setSelectValueIfAvailable(adminQrUse, qrConfig.defaultUse);
  setSelectValueIfAvailable(adminQrGoal, qrConfig.defaultGoal);
  setSelectValueIfAvailable(adminQrTone, qrConfig.defaultTone);
  setSelectValueIfAvailable(adminQrStyle, qrConfig.defaultStyle);
  setSelectValueIfAvailable(adminQrColor, qrConfig.defaultColor);
  if (adminQrText && qrConfig.defaultCta) adminQrText.value = qrConfig.defaultCta;
  adminQrPreview.dataset.defaultsApplied = "true";
}

function adminQrCanvasSize() {
  return adminQrUse?.value === "redes" ? { width: 1080, height: 1080 } : { width: 900, height: 1200 };
}

function safeHexColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function hexToRgb(color) {
  const normalized = safeHexColor(color, "#000000").slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHexColor(color, mixWith, weight = 0.5) {
  const a = hexToRgb(color);
  const b = hexToRgb(mixWith);
  const ratio = Math.max(0, Math.min(1, Number(weight)));
  return rgbToHex({
    r: a.r * ratio + b.r * (1 - ratio),
    g: a.g * ratio + b.g * (1 - ratio),
    b: a.b * ratio + b.b * (1 - ratio)
  });
}

function applyBusinessTheme() {
  const colors = businessConfig.brand?.colors || {};
  const primary = safeHexColor(colors.primary, "");
  const ink = safeHexColor(colors.ink, "");
  const cream = safeHexColor(colors.cream, "");
  if (!primary && !ink && !cream) return;

  const accent = primary || "#ff890a";
  const text = ink || "#461904";
  const paper = cream || "#fff9ec";
  const root = document.documentElement;
  const themeVars = {
    "--pumpkin-50": paper,
    "--pumpkin-100": mixHexColor(accent, paper, 0.14),
    "--pumpkin-200": mixHexColor(accent, paper, 0.28),
    "--pumpkin-300": mixHexColor(accent, paper, 0.46),
    "--pumpkin-400": mixHexColor(accent, paper, 0.72),
    "--pumpkin-500": accent,
    "--pumpkin-600": mixHexColor(accent, text, 0.82),
    "--pumpkin-700": mixHexColor(accent, text, 0.64),
    "--pumpkin-800": mixHexColor(accent, text, 0.44),
    "--pumpkin-900": mixHexColor(accent, text, 0.28),
    "--pumpkin-950": text,
    "--ink": text,
    "--muted": mixHexColor(text, paper, 0.56),
    "--line": mixHexColor(accent, paper, 0.28),
    "--paper": paper,
    "--panel": mixHexColor(paper, "#ffffff", 0.72),
    "--panel-strong": mixHexColor(accent, paper, 0.16),
    "--gold": accent,
    "--gold-soft": mixHexColor(accent, paper, 0.46),
    "--olive": mixHexColor(accent, text, 0.64),
    "--brown": mixHexColor(accent, text, 0.44)
  };
  Object.entries(themeVars).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}

function adminQrTheme() {
  const brandPrimary = safeHexColor(businessConfig.brand?.colors?.primary, "#ff8a00");
  const brandInk = safeHexColor(businessConfig.brand?.colors?.ink, "#4b1d0d");
  const brandCream = safeHexColor(businessConfig.brand?.colors?.cream, "#fff8e8");
  const themes = {
    marca: { accent: brandPrimary, ink: brandInk, bg: brandCream, soft: "#fff3d8", qrDark: "#263128" },
    ambar: { accent: "#ff8a00", ink: "#4b1d0d", bg: "#fff8e8", soft: "#ffe6b8", qrDark: "#381407" },
    oliva: { accent: "#66752a", ink: "#243126", bg: "#f8f5e7", soft: "#e8edcf", qrDark: "#263128" },
    vino: { accent: "#8d2f20", ink: "#3a120d", bg: "#fff4ec", soft: "#f4d2c4", qrDark: "#32110c" }
  };
  return themes[adminQrColor?.value || "marca"] || themes.marca;
}

function drawQrPosterFrame(ctx, width, height, theme, style) {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);
  if (style === "simple") {
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = Math.max(8, width * 0.012);
    ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
    return;
  }
  if (style === "sello") {
    ctx.fillStyle = theme.ink;
    ctx.fillRect(0, 0, width, height * 0.33);
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.325, width * 0.13, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = theme.soft;
  ctx.fillRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(width * 0.05, height * 0.05, width * 0.9, height * 0.025);
}

async function drawAdminQrPoster(canvas = adminQrPreview) {
  if (!canvas) return null;
  const { width, height } = adminQrCanvasSize();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const theme = adminQrTheme();
  const style = adminQrStyle?.value || "editorial";
  const qrCanvas = document.createElement("canvas");
  await qrCodeToCanvas(qrCanvas, publicMenuUrl(), {
    width: Math.round(Math.min(width, height) * 0.48),
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: theme.qrDark,
      light: "#ffffff"
    }
  });
  drawBusinessMarkOnQr(qrCanvas);

  drawQrPosterFrame(ctx, width, height, theme, style);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = style === "sello" ? "#fff8e8" : theme.ink;
  ctx.font = `900 ${Math.round(width * 0.048)}px Georgia, serif`;
  ctx.fillText(businessConfig.admin?.brandName || businessConfig.landing?.primaryName || businessId, width / 2, height * 0.14);
  ctx.fillStyle = style === "sello" ? "#fff8e8" : theme.ink;
  ctx.font = `900 ${Math.round(width * 0.028)}px system-ui, sans-serif`;
  ctx.letterSpacing = "0px";
  ctx.fillText((adminQrUse?.value || "mesa").toUpperCase(), width / 2, height * 0.19);
  ctx.fillStyle = style === "sello" ? "#fff8e8" : theme.ink;
  ctx.font = `900 ${Math.round(width * 0.052)}px Georgia, serif`;
  const text = adminQrText?.value.trim() || adminQrSuggestedText();
  wrapCanvasText(ctx, text, width / 2, height * 0.29, width * 0.78, Math.round(width * 0.062));
  const qrSize = qrCanvas.width;
  const qrY = style === "simple" ? height * 0.43 : height * 0.46;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect((width - qrSize) / 2 - width * 0.018, qrY - width * 0.018, qrSize + width * 0.036, qrSize + width * 0.036);
  ctx.drawImage(qrCanvas, (width - qrSize) / 2, qrY, qrSize, qrSize);
  ctx.fillStyle = theme.ink;
  ctx.font = `800 ${Math.round(width * 0.024)}px system-ui, sans-serif`;
  ctx.fillText(publicMenuUrl(), width / 2, height * 0.91);
  return canvas;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let cursorY = y;
  words.forEach((word, index) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
    if (index === words.length - 1 && line) ctx.fillText(line, x, cursorY);
  });
}

async function renderAdminQrs() {
  if (!adminQrPreview) return;
  applyAdminQrDefaults();
  if (adminQrUrl) adminQrUrl.textContent = `Destino: ${publicMenuUrl()}`;
  if (adminQrText && !adminQrText.value.trim()) adminQrText.value = adminQrSuggestedText();
  await drawAdminQrPoster(adminQrPreview).catch((error) => {
    if (import.meta.env.DEV) console.warn("[Sumi QR] preview failed", error);
  });
}

async function downloadAdminQrPoster() {
  try {
    const canvas = document.createElement("canvas");
    await drawAdminQrPoster(canvas);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${businessId}-qr-${adminQrUse?.value || "mesa"}.png`;
    link.click();
    showToast("QR descargado.");
  } catch (error) {
    showToast(displayError(error) || "No se pudo generar el QR.");
  }
}

function bytesFromAscii(text) {
  return new TextEncoder().encode(text);
}

function bytesFromBase64(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function pdfBlobFromCanvas(canvas) {
  const jpegData = canvas.toDataURL("image/jpeg", 0.92).split(",")[1] || "";
  const imageBytes = bytesFromBase64(jpegData);
  const pageWidth = Math.round(canvas.width * 0.75);
  const pageHeight = Math.round(canvas.height * 0.75);
  const parts = [];
  const offsets = [0];
  let cursor = 0;
  const add = (part) => {
    const bytes = typeof part === "string" ? bytesFromAscii(part) : part;
    parts.push(bytes);
    cursor += bytes.length;
  };
  const addObject = (number, bodyParts) => {
    offsets[number] = cursor;
    add(`${number} 0 obj\n`);
    bodyParts.forEach(add);
    add("\nendobj\n");
  };

  add("%PDF-1.4\n");
  addObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  addObject(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  addObject(3, [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] `,
    "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"
  ]);
  addObject(4, [
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} `,
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    imageBytes,
    "\nendstream"
  ]);
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`;
  addObject(5, [`<< /Length ${bytesFromAscii(content).length} >>\nstream\n${content}\nendstream`]);
  const xrefOffset = cursor;
  add(`xref\n0 6\n0000000000 65535 f \n`);
  for (let number = 1; number <= 5; number += 1) {
    add(`${String(offsets[number]).padStart(10, "0")} 00000 n \n`);
  }
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return new Blob([concatBytes(parts)], { type: "application/pdf" });
}

async function downloadAdminQrPdf() {
  try {
    const canvas = document.createElement("canvas");
    await drawAdminQrPoster(canvas);
    const blob = pdfBlobFromCanvas(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${businessId}-qr-${adminQrUse?.value || "mesa"}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("QR descargado en PDF.");
  } catch (error) {
    showToast(displayError(error) || "No se pudo generar el PDF.");
  }
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

function selectedConsumptionCategory() {
  const explicitCategory = String(consumptionCategory?.value || "").trim();
  if (explicitCategory) return explicitCategory;
  return consumptionItems
    .map((item) => dishById(item.dishId)?.category)
    .find(Boolean) || "";
}

function selectedConsumptionNote() {
  return String(consumptionNote?.value || "").trim();
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

function renderConsumptionCategoryOptions() {
  if (!consumptionCategory) return;
  const current = consumptionCategory.value || "";
  const categories = [...new Set(menuItems.filter(isDishVisible).map((dish) => dish.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  consumptionCategory.innerHTML = [
    `<option value="">Inferir por productos</option>`,
    ...categories.map((category) => `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`)
  ].join("");
  consumptionCategory.value = categories.includes(current) ? current : "";
}

function resetConsumptionFlow(options = {}) {
  consumptionMode = options.mode || "scan";
  consumptionStage = "lookup";
  activeConsumptionQrId = "";
  activeConsumptionCustomer = null;
  consumptionCustomerResults = [];
  consumptionCustomerSearchToken += 1;
  consumptionItems = [];
  consumptionRequestId = fallbackRequestId();
  activePresentationDishId = "";
  consumptionModal?.classList.remove("is-ready", "is-summary", "is-form");
  consumptionModal?.classList.toggle("is-manual", consumptionMode === "manual");
  consumptionModal?.classList.toggle("is-scan", consumptionMode === "scan");
  if (consumptionQrInput) consumptionQrInput.value = "";
  if (consumptionCustomerSearch) consumptionCustomerSearch.value = "";
  if (consumptionCustomerPicker) consumptionCustomerPicker.hidden = consumptionMode !== "manual";
  if (consumptionAmount) consumptionAmount.value = "";
  if (consumptionNote) consumptionNote.value = "";
  renderConsumptionCategoryOptions();
  if (consumptionCustomerCard) consumptionCustomerCard.hidden = true;
  if (consumptionQuickProfile) consumptionQuickProfile.hidden = true;
  renderConsumptionCustomerResults();
  renderConsumptionCatalog();
  renderConsumptionItems();
  updateConsumptionPointsPreview();
}

function setConsumptionStage(stage) {
  consumptionStage = stage;
  const ready = stage === "summary" || stage === "form";
  consumptionModal?.classList.toggle("is-ready", ready);
  consumptionModal?.classList.toggle("is-summary", stage === "summary");
  consumptionModal?.classList.toggle("is-form", stage === "form");
  if (consumptionQuickProfile) consumptionQuickProfile.hidden = stage !== "summary";
  if (consumptionCustomerCard) consumptionCustomerCard.hidden = stage !== "form" || !activeConsumptionCustomer;
}

async function openConsumptionModal(trigger = staffScanButton) {
  if (!isStaff()) {
    showToast("Esta cuenta no puede cargar consumos.");
    return;
  }
  lastQrTrigger = trigger;
  resetConsumptionFlow({ mode: "scan" });
  consumptionModal.hidden = false;
  document.body.classList.add("consumption-open");
  setText("#consumptionTitle", "Escanear cliente");
  if (consumptionScannerStatus) consumptionScannerStatus.textContent = "Apunta la camara al QR del cliente.";
  await startConsumptionScanner();
  window.requestAnimationFrame(() => consumptionQrInput?.focus());
}

async function openManualConsumptionModal(trigger = adminPanel) {
  if (!isStaff()) {
    showToast("Esta cuenta no puede cargar consumos.");
    return;
  }
  lastQrTrigger = trigger;
  resetConsumptionFlow({ mode: "manual" });
  consumptionModal.hidden = false;
  document.body.classList.add("consumption-open");
  stopConsumptionScanner();
  setText("#consumptionTitle", "Cargar consumo");
  if (consumptionScannerStatus) consumptionScannerStatus.textContent = "Busca un cliente y carga el consumo sin escanear QR.";
  await loadConsumptionCustomerResults("");
  window.requestAnimationFrame(() => consumptionCustomerSearch?.focus());
}

function openConsumptionModalForCustomer(customerId, trigger = adminCustomerRows) {
  if (!isStaff()) {
    showToast("Esta cuenta no puede cargar consumos.");
    return;
  }
  const profile = customerProfile(customerId);
  const account = accountForCustomer(customerId);
  const qrId = account?.public_qr_id;
  if (!profile || !account || !qrId) {
    showToast("Ese cliente todavia no tiene QR publico para cargar consumo.");
    return;
  }
  const customerPurchases = eventsForCustomer(customerId)
    .filter((event) => event.event_type === "purchase" && consumptionStatus(event) !== "cancelled")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  lastQrTrigger = trigger;
  resetConsumptionFlow({ mode: "manual" });
  activeConsumptionQrId = qrId;
  activeConsumptionCustomer = {
    customer_id: profile.id,
    customer_name: profile.name || "Cliente",
    customer_email: profile.email || "",
    points_balance: account.points_balance || 0,
    tier: account.tier || "bronze",
    public_qr_id: qrId,
    last_visit: customerPurchases[0]?.created_at || "",
    visit_count: customerPurchases.length,
    weekly_streak: weeklyStreakForEvents(customerPurchases)
  };
  consumptionModal.hidden = false;
  document.body.classList.add("consumption-open");
  stopConsumptionScanner();
  renderConsumptionCustomer();
  if (consumptionScannerStatus) consumptionScannerStatus.textContent = "Cliente seleccionado. Carga el monto y los productos.";
  window.requestAnimationFrame(() => consumptionAmount?.focus());
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
  const startToken = ++consumptionScannerStartToken;
  consumptionScannerStatus.textContent = "Pidiendo permiso de camara...";
  try {
    const QrScanner = await loadQrScanner();
    if (startToken !== consumptionScannerStartToken || consumptionModal?.hidden) return;
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
    await consumptionQrScanner.start();
    consumptionScannerStatus.textContent = "Apunta la camara al QR del cliente.";
  } catch {
    consumptionQrScanner?.destroy();
    consumptionQrScanner = null;
    consumptionScannerStatus.textContent = "No se pudo abrir la camara. Pega el codigo QR abajo.";
  }
}

function stopConsumptionScanner() {
  consumptionScannerStartToken += 1;
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
  setConsumptionStage("form");
  consumptionCustomerCard.hidden = false;
  consumptionCustomerName.textContent = activeConsumptionCustomer.customer_name || "Cliente";
  consumptionCustomerMeta.textContent = `${activeConsumptionCustomer.points_balance || 0} pts actuales - ${tierLabel(activeConsumptionCustomer.tier)}`;
}

function customerLastVisitLabel(customer) {
  if (!customer?.last_visit) return "Sin visitas cargadas";
  return formatFullDateTime(customer.last_visit);
}

function customerAvailableRewards(customer) {
  const balance = Number(customer?.points_balance || 0);
  const tier = customer?.tier || "bronze";
  return rewardCatalog.filter((reward) =>
    rewardIsVisibleToCustomer(reward)
    && balance >= Number(reward.cost || 0)
    && customerTierMeetsReward(tier, reward.minTier)
  );
}

function rewardIsVisibleToCustomer(reward) {
  if (!reward || reward.active === false) return false;
  if (reward.stock !== null && Number(reward.stock) <= 0) return false;
  if (reward.validUntil) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validUntil = new Date(`${reward.validUntil}T23:59:59`);
    if (Number.isFinite(validUntil.getTime()) && validUntil < today) return false;
  }
  return true;
}

function tierRank(tier) {
  return { bronze: 0, silver: 1, gold: 2, platinum: 3 }[tier || "bronze"] ?? 0;
}

function customerTierMeetsReward(customerTier, minTier) {
  if (!minTier) return true;
  return tierRank(customerTier) >= tierRank(minTier);
}

function renderConsumptionQuickProfile() {
  if (!activeConsumptionCustomer || !consumptionQuickProfile) return;
  const rewards = customerAvailableRewards(activeConsumptionCustomer);
  const streakProgress = streakProgressModel(activeConsumptionCustomer.weekly_streak || 0, activeConsumptionCustomer.last_visit || "");
  consumptionQuickName.textContent = activeConsumptionCustomer.customer_name || "Cliente";
  consumptionQuickMeta.textContent = `${activeConsumptionCustomer.points_balance || 0} pts actuales - ${tierLabel(activeConsumptionCustomer.tier)}`;
  consumptionQuickStats.innerHTML = [
    ["Ultima visita", customerLastVisitLabel(activeConsumptionCustomer)],
    ["Racha", streakProgress.title],
    ["Esta semana", streakProgress.maintainedThisWeek ? "Cubierta" : "Pendiente"],
    ["Premios disponibles", `${rewards.length}`]
  ].map(([label, value]) => `
    <span>
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `).join("");
  consumptionQuickRewards.innerHTML = rewards.length
    ? `${streakProgressMarkup(streakProgress)}${rewards.slice(0, 4).map((reward) => `
      <span>${escapeHtml(reward.name)} <b>${escapeHtml(reward.cost)} pts</b></span>
    `).join("")}`
    : `${streakProgressMarkup(streakProgress)}<span>No tiene premios disponibles por puntos todavia.</span>`;
  setConsumptionStage("summary");
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
  activeConsumptionCustomer = normalizeConsumptionCustomer(customer);
  renderConsumptionQuickProfile();
  consumptionScannerStatus.textContent = "Cliente identificado. Revisa la ficha rapida antes de cargar.";
  consumptionStartForm?.focus();
}

function normalizeConsumptionCustomer(customer) {
  if (!customer) return null;
  return {
    customer_id: customer.customer_id,
    customer_name: customer.customer_name || "Cliente",
    customer_email: customer.customer_email || "",
    points_balance: customer.points_balance || 0,
    tier: customer.tier || "bronze",
    public_qr_id: customer.public_qr_id || customer.qr_id || "",
    last_visit: customer.last_visit || "",
    visit_count: Number(customer.visit_count || 0),
    weekly_streak: Number(customer.weekly_streak || 0)
  };
}

function renderConsumptionCustomerResults(message = "") {
  if (!consumptionCustomerResultsEl) return;
  if (message) {
    consumptionCustomerResultsEl.innerHTML = `<div class="consumption-customer-empty">${escapeHtml(message)}</div>`;
    return;
  }
  consumptionCustomerResultsEl.innerHTML = consumptionCustomerResults.length
    ? consumptionCustomerResults.map((customer) => `
      <button class="consumption-customer-option" type="button" data-consumption-customer="${escapeAttribute(customer.customer_id)}">
        <span>
          <strong>${escapeHtml(customer.customer_name || "Cliente")}</strong>
          <small>${escapeHtml(customer.customer_email || "Sin email")} - ${escapeHtml(tierLabel(customer.tier))}</small>
        </span>
        <b>${escapeHtml(customer.points_balance || 0)} pts</b>
      </button>
    `).join("")
    : `<div class="consumption-customer-empty">Busca o selecciona un cliente registrado.</div>`;
}

async function loadConsumptionCustomerResults(query = "") {
  if (consumptionMode !== "manual") return;
  if (!supabase) {
    renderConsumptionCustomerResults("Configura Supabase para buscar clientes.");
    return;
  }
  const token = consumptionCustomerSearchToken + 1;
  consumptionCustomerSearchToken = token;
  renderConsumptionCustomerResults("Buscando clientes...");
  const { data, error } = await supabase.rpc("lookup_loyalty_customers_for_consumption", {
    target_business_id: businessId,
    search_query: query
  });
  if (token !== consumptionCustomerSearchToken) return;
  if (error) {
    consumptionCustomerResults = [];
    renderConsumptionCustomerResults(displayError(error));
    return;
  }
  consumptionCustomerResults = (Array.isArray(data) ? data : [])
    .map(normalizeConsumptionCustomer)
    .filter((customer) => customer?.customer_id && customer?.public_qr_id);
  renderConsumptionCustomerResults(consumptionCustomerResults.length ? "" : "No encontramos clientes con esa busqueda.");
}

function selectConsumptionCustomer(customerId) {
  const customer = consumptionCustomerResults.find((item) => item.customer_id === customerId);
  if (!customer?.public_qr_id) {
    showToast("Ese cliente no tiene QR publico para cargar consumo.");
    return;
  }
  stopConsumptionScanner();
  activeConsumptionQrId = customer.public_qr_id;
  activeConsumptionCustomer = customer;
  renderConsumptionCustomer();
  if (consumptionScannerStatus) consumptionScannerStatus.textContent = "Cliente seleccionado. Carga el monto y los productos.";
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
  const selectedCategory = String(consumptionCategory?.value || "").trim();
  const items = menuItems
    .filter(isDishVisible)
    .filter((dish) => !selectedCategory || dish.category === selectedCategory)
    .slice(0, 80);
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
    : `<div class="admin-empty">No hay productos visibles${selectedCategory ? ` en ${escapeHtml(selectedCategory)}` : ""}.</div>`;
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
    : `<div class="admin-empty">Puedes registrar solo el monto o agregar productos como detalle.</div>`;
}

async function saveConsumption() {
  if (!activeConsumptionCustomer || !activeConsumptionQrId) {
    showToast(consumptionMode === "manual" ? "Selecciona primero un cliente." : "Escanea primero el QR del cliente.");
    return;
  }
  const amount = selectedConsumptionAmount();
  if (amount <= 0) {
    showToast("Carga un monto mayor a cero.");
    consumptionAmount?.focus();
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
  const { data, error } = await supabase.rpc("record_customer_consumption_v2", {
    target_business_id: businessId,
    target_qr_id: activeConsumptionQrId,
    purchase_total: amount,
    request_id: consumptionRequestId,
    purchase_items: payloadItems,
    purchase_category: selectedConsumptionCategory() || null,
    purchase_note: selectedConsumptionNote() || null,
    entry_method: consumptionMode === "scan" ? "qr" : "manual"
  });
  consumptionSave.disabled = false;
  consumptionSave.textContent = "Registrar consumo";
  if (error) {
    showToast(displayError(error));
    return;
  }
  const result = data || {};
  const earnedPoints = Number(result.pointsEarned || estimatedConsumptionPoints());
  const streakBonusPoints = Number(result.streakBonusPoints || 0);
  const streakText = streakBonusPoints ? ` + ${streakBonusPoints} bonus de racha` : "";
  showToast(`${result.customerName || "Cliente"} sumo ${earnedPoints} pts${streakText}.`);
  lastStaffConsumption = {
    eventId: result.eventId || "",
    customerName: result.customerName || activeConsumptionCustomer.customer_name || "Cliente",
    amount,
    points: earnedPoints + streakBonusPoints,
    createdAt: new Date().toISOString()
  };
  renderStaffWorkspace();
  if (currentAdminData.loaded) {
    currentAdminData.loaded = false;
    await ensureAdminData();
  }
  const previousMode = consumptionMode;
  resetConsumptionFlow({ mode: previousMode });
  if (previousMode === "scan") {
    await startConsumptionScanner();
  } else {
    await loadConsumptionCustomerResults("");
    consumptionCustomerSearch?.focus();
  }
}

function localCategory(category) {
  return categoryLabels[currentLang]?.[category] || category;
}

function normalizeBusinessLanguages(rawLanguages, defaultLang = "es") {
  const source = Array.isArray(rawLanguages) && rawLanguages.length ? rawLanguages : fallbackLanguages;
  const seen = new Set();
  const normalized = source
    .map((language) => ({
      code: String(language?.code || "").trim().toLowerCase(),
      label: String(language?.label || language?.code || "").trim(),
      helper: String(language?.helper || "").trim(),
      flag: String(language?.flag || language?.code || "").trim().toLowerCase(),
      dir: language?.dir === "rtl" ? "rtl" : "ltr",
      primary: Boolean(language?.primary)
    }))
    .filter((language) => language.code && !seen.has(language.code) && seen.add(language.code));
  if (!normalized.length) return fallbackLanguages;
  if (!normalized.some((language) => language.code === defaultLang)) {
    normalized[0].primary = true;
  }
  return normalized.map((language) => ({
    ...language,
    label: language.label || language.code.toUpperCase(),
    helper: language.helper || `Continuar en ${language.label || language.code.toUpperCase()}`,
    flag: language.flag || language.code
  }));
}

function normalizeBusinessLabels(raw, codes, primaryCode) {
  const primaryLabels = raw?.[primaryCode] || raw?.es || Object.values(raw || {})[0] || {};
  return codes.reduce((acc, code) => {
    acc[code] = {
      ...primaryLabels,
      ...(raw?.[code] || {})
    };
    return acc;
  }, {});
}

function languageDirection(lang) {
  return languages.find((language) => language.code === lang)?.dir || "ltr";
}

function languageDefinition(lang) {
  return languages.find((language) => language.code === lang) || languages[0];
}

function flagStyle(flag) {
  const safeFlag = String(flag || "").replace(/[^a-z0-9-]/gi, "").toLowerCase();
  return safeFlag ? `style="background-image:url('assets/flags/${escapeAttribute(safeFlag)}.svg')"` : "";
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

  languageCodes.forEach((lang) => {
    const existing = dish.translations[lang] || {};
    dish.translations[lang] = {
      name: existing.name || (lang === primaryLanguageCode ? dish.name : legacyTranslatedName(dish, lang)) || dish.name,
      description: existing.description || (lang === primaryLanguageCode ? dish.description : legacyTranslatedDescription(dish, lang)) || dish.description
    };
  });

  return dish.translations;
}

function translationHasText(text = {}) {
  return Boolean(String(text.name || "").trim() || String(text.description || "").trim());
}

function normalizeTranslationReview(dish) {
  if (!dish) return {};
  const translations = ensureDishTranslations(dish);
  if (!dish.translationReview || typeof dish.translationReview !== "object") {
    dish.translationReview = {};
  }
  languageCodes.forEach((lang) => {
    const existing = dish.translationReview[lang] || {};
    const isPrimary = lang === primaryLanguageCode;
    const hasText = translationHasText(translations[lang]);
    dish.translationReview[lang] = {
      status: existing.status || (isPrimary ? "base" : hasText ? "reviewed" : "missing"),
      source: existing.source || (isPrimary ? "manual" : "existing"),
      updatedAt: existing.updatedAt || ""
    };
  });
  return dish.translationReview;
}

function markTranslationReview(dish, lang, status, source = "manual") {
  if (!dish || !lang) return;
  const review = normalizeTranslationReview(dish);
  review[lang] = {
    status,
    source,
    updatedAt: new Date().toISOString()
  };
}

function markEditorTranslationReviewed(lang = currentEditorLang) {
  const dish = editorDish();
  if (!dish) return;
  markTranslationReview(dish, lang, lang === primaryLanguageCode ? "base" : "reviewed", "manual");
}

function markSecondaryTranslationsOutdated(dish) {
  if (!translationReviewRequired || !dish) return;
  const translations = ensureDishTranslations(dish);
  languageCodes
    .filter((lang) => lang !== primaryLanguageCode && translationHasText(translations[lang]))
    .forEach((lang) => markTranslationReview(dish, lang, "needs_review", "source_changed"));
}

function editorTranslationStatus(lang) {
  const dish = editorDish();
  const translations = dish ? ensureDishTranslations(dish) : {};
  const review = dish ? normalizeTranslationReview(dish) : {};
  if (lang === primaryLanguageCode) return { label: "Base", className: "base" };
  if (!translationHasText(translations[lang])) return { label: "Falta", className: "missing" };
  const status = review[lang]?.status;
  if (status === "needs_review") return { label: "Revisar", className: "needs-review" };
  return { label: "Listo", className: "reviewed" };
}

function dishText(dish, lang) {
  const translations = ensureDishTranslations(dish);
  return translations[lang] || translations[primaryLanguageCode] || translations[languageCodes[0]];
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
  const thresholds = normalizedTierThresholds(loyaltySettings);
  if (pointsBalance >= thresholds.platinum) {
    return { name: labels[currentLang].platinum || "Nivel Platino", next: null, floor: thresholds.platinum, target: thresholds.platinum };
  }
  if (pointsBalance >= thresholds.gold) {
    return { name: labels[currentLang].gold, next: labels[currentLang].platinum || "Nivel Platino", floor: thresholds.gold, target: thresholds.platinum };
  }
  if (pointsBalance >= thresholds.silver) {
    return { name: labels[currentLang].silver, next: labels[currentLang].gold, floor: thresholds.silver, target: thresholds.gold };
  }
  return { name: labels[currentLang].bronze, next: labels[currentLang].silver, floor: 0, target: thresholds.silver };
}

function redemptionStatusLabel(status) {
  const labelsMap = {
    requested: "Pendiente",
    approved: "Aprobado",
    redeemed: "Entregado",
    cancelled: "Rechazado"
  };
  return labelsMap[status] || status || "Pendiente";
}

function redemptionDisplayStatusLabel(redemption) {
  return redemptionIsExpired(redemption) ? "Vencido" : redemptionStatusLabel(redemption?.status);
}

function redemptionStatusTone(status) {
  const tones = {
    requested: "warn",
    approved: "good",
    redeemed: "neutral",
    cancelled: "bad"
  };
  return tones[status] || "neutral";
}

function redemptionsByReward(rewardId) {
  return [...(currentCustomer?.redemptions || [])]
    .filter((redemption) => redemption.reward_id === rewardId)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function redemptionIsExpired(redemption) {
  if (!redemption?.requested_expires_at || redemption.status !== "requested") return false;
  return new Date(redemption.requested_expires_at).getTime() < Date.now();
}

function redemptionIsActionableRequest(redemption) {
  return redemption?.status === "requested" && !redemptionIsExpired(redemption);
}

function pendingRewardRedemption(rewardId) {
  return redemptionsByReward(rewardId).find(redemptionIsActionableRequest);
}

function activeRewardRedemption(rewardId) {
  return pendingRewardRedemption(rewardId);
}

function closedRewardRedemption(rewardId) {
  return redemptionsByReward(rewardId).find((redemption) => redemption.status !== "requested" || redemptionIsExpired(redemption)) || null;
}

function showToast(message) {
  toast.textContent = message;
  toast.dataset.state = "visible";
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("show");
    toast.dataset.state = "hidden";
  }, 2200);
}

function openSignupModal(trigger = signupCta) {
  lastSignupTrigger = trigger;
  signupModal.hidden = false;
  document.body.classList.add("signup-open");
  setSignupMode("register");
  recordMenuEvent("signup_start", "", { once: false });
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
  customerQrRenderToken += 1;
  qrModal.hidden = true;
  document.body.classList.remove("qr-open");
  qrError.textContent = "";
  customerQrCanvas?.removeAttribute("aria-busy");
  customerQrCanvas?.getContext?.("2d")?.clearRect(0, 0, customerQrCanvas.width, customerQrCanvas.height);
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

function trapActivityFocus(event) {
  trapModalFocus(activityDrawer, event);
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
  const latestRedemption = [...(currentCustomer?.redemptions || [])]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  if (rewardStatusNote) {
    rewardStatusNote.hidden = !latestRedemption;
    rewardStatusNote.className = `reward-status-note tone-${redemptionStatusTone(latestRedemption?.status)}`;
    rewardStatusNote.textContent = latestRedemption
      ? `Ultimo canje: ${latestRedemption.reward_name} - ${redemptionDisplayStatusLabel(latestRedemption)}.`
      : "";
  }
  rewardStrip.innerHTML = rewardCatalog
    .filter(rewardIsVisibleToCustomer)
    .map(
      (reward) => {
        const pendingRedemption = activeRewardRedemption(reward.id);
        const closedRedemptionForReward = closedRewardRedemption(reward.id);
        const meetsTier = customerTierMeetsReward(currentCustomer?.account?.tier || "bronze", reward.minTier);
        const available = pointsBalance >= reward.cost && meetsTier && !pendingRedemption;
        const status = pendingRedemption
          ? "Pendiente de aprobacion"
          : !meetsTier
            ? `Requiere ${tierLabel(reward.minTier)}`
            : pointsBalance >= reward.cost
            ? closedRedemptionForReward
              ? `Pedir de nuevo (${reward.cost} pts)`
              : `${reward.cost} pts`
            : `${reward.cost - pointsBalance} pts restantes`;
        return `
        <button class="reward-chip ${available ? "available" : ""} ${pendingRedemption ? "is-requested" : ""}" data-reward="${escapeAttribute(reward.id)}" type="button" ${pendingRedemption ? "disabled aria-disabled=\"true\"" : ""}>
          ${reward.imageUrl ? `<span class="reward-chip-thumb" style="background-image:url(&quot;${escapeAttribute(reward.imageUrl)}&quot;)" aria-hidden="true"></span>` : ""}
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
    currentLanguageFlag.style.backgroundImage = `url('assets/flags/${language.flag}.svg')`;
  }
  languageToggle?.setAttribute("aria-label", `${labels[currentLang]?.changeLanguage || "Cambiar idioma"}: ${language?.label || currentLang}`);
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
    .map((category, index) => {
      const count = items.filter((dish) => dish.category === category).length;
      const active = category === currentCategory;
      const localizedCategory = localCategory(category);
      return `
        <button
          class="category-pill ${active ? "active" : ""}"
          data-category="${escapeAttribute(category)}"
          type="button"
          aria-label="${escapeAttribute(`${localizedCategory}, ${count} ${labels[currentLang].dishes}`)}"
          aria-pressed="${active}"
          aria-controls="publicMenuProducts"
          tabindex="${active || (!currentCategory && index === 0) ? "0" : "-1"}"
        >
          <span class="category-pill-label">${escapeHtml(localizedCategory)}</span>
          <span class="category-pill-count" aria-hidden="true">${count}</span>
        </button>
      `;
    })
    .join("");
}

function activateCategory(category, { focus = false } = {}) {
  if (!category) return;
  const hasSearchQuery = Boolean(searchInput.value.trim());
  if (category === currentCategory && !hasSearchQuery) {
    if (focus) {
      categoryStrip.querySelectorAll("[data-category]").forEach((button) => {
        if (button.dataset.category === category) button.focus({ preventScroll: true });
      });
    }
    return;
  }

  currentCategory = category;
  searchInput.value = "";
  renderList();

  window.requestAnimationFrame(() => {
    const selectedButton = [...categoryStrip.querySelectorAll("[data-category]")]
      .find((button) => button.dataset.category === category);
    selectedButton?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    if (focus) selectedButton?.focus({ preventScroll: true });
  });
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
  `;
}

function setLoadingState(element, isLoading) {
  if (!element) return;
  element.toggleAttribute("aria-busy", isLoading);
}

function skeletonRowsMarkup(count = 4, label = "Cargando contenido") {
  return `
    <div class="ui-skeleton-stack" role="status" aria-label="${escapeAttribute(label)}">
      ${Array.from({ length: count }, (_, index) => `
        <div class="ui-skeleton-row" aria-hidden="true">
          <span class="ui-skeleton ui-skeleton-thumb"></span>
          <span class="ui-skeleton-copy">
            <span class="ui-skeleton ui-skeleton-line is-wide"></span>
            <span class="ui-skeleton ui-skeleton-line ${index % 2 ? "is-short" : ""}"></span>
          </span>
          <span class="ui-skeleton ui-skeleton-chip"></span>
        </div>
      `).join("")}
      <span class="sr-only">${escapeHtml(label)}</span>
    </div>
  `;
}

function skeletonCardsMarkup(count = 4, label = "Cargando resumen") {
  return `
    <div class="ui-skeleton-card-grid" role="status" aria-label="${escapeAttribute(label)}">
      ${Array.from({ length: count }, () => `
        <article class="ui-skeleton-card" aria-hidden="true">
          <span class="ui-skeleton ui-skeleton-line is-short"></span>
          <span class="ui-skeleton ui-skeleton-metric"></span>
          <span class="ui-skeleton ui-skeleton-line"></span>
        </article>
      `).join("")}
      <span class="sr-only">${escapeHtml(label)}</span>
    </div>
  `;
}

function skeletonAssetsMarkup(count = 6, label = "Cargando biblioteca") {
  return `
    <div class="ui-skeleton-assets" role="status" aria-label="${escapeAttribute(label)}">
      ${Array.from({ length: count }, (_, index) => `
        <article class="ui-skeleton-asset" aria-hidden="true">
          <span class="ui-skeleton ui-skeleton-asset-media ${index % 3 === 1 ? "is-vertical" : ""}"></span>
          <span class="ui-skeleton ui-skeleton-line is-wide"></span>
          <span class="ui-skeleton ui-skeleton-line is-short"></span>
        </article>
      `).join("")}
      <span class="sr-only">${escapeHtml(label)}</span>
    </div>
  `;
}

function adminDataErrorMarkup(title, error = currentAdminData.error) {
  return `
    <div class="admin-empty admin-error-state" role="alert">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(displayError(error))}</span>
      <button class="outline" type="button" data-admin-retry-data="true">Reintentar</button>
    </div>
  `;
}

function renderPublicMenuSkeleton() {
  hideAllSurfaces();
  document.body.classList.add("menu-loading");
  categoryTitle.textContent = "Cargando menu";
  categoryCount.textContent = "";
  categoryStrip.innerHTML = Array.from({ length: 4 }, () => `<span class="ui-skeleton ui-skeleton-filter" aria-hidden="true"></span>`).join("");
  recommendedCard.disabled = true;
  recommendedCard.classList.add("is-loading");
  recommendedCard.removeAttribute("style");
  recommendedCard.innerHTML = `
    <span class="ui-skeleton ui-skeleton-badge" aria-hidden="true"></span>
    <span class="ui-skeleton ui-skeleton-hero-title" aria-hidden="true"></span>
    <span class="ui-skeleton ui-skeleton-hero-copy" aria-hidden="true"></span>
    <span class="sr-only">Cargando producto destacado</span>
  `;
  setLoadingState(dishList, true);
  dishList.innerHTML = skeletonRowsMarkup(5, "Cargando productos del menu");
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

  document.body.classList.remove("menu-loading");
  recommendedCard.classList.remove("is-loading");
  setLoadingState(dishList, false);

  categoryTitle.textContent = query ? labels[currentLang].results : localCategory(currentCategory);
  categoryCount.textContent = `${filtered.length} ${labels[currentLang].dishes}`;

  dishList.innerHTML = filtered.length
    ? filtered
        .map((dish) => {
          const soldOut = isSoldOut(dish);
          const isPopular = dish.id === effectivePopularDishId(dish.brand);
          return `
            <button class="customer-dish-card ${soldOut ? "is-sold-out" : ""} ${isPopular ? "is-hot" : ""}" data-id="${escapeAttribute(dish.id)}" type="button">
              <span class="customer-thumb"><img src="${escapeAttribute(dish.photo)}" alt="" loading="lazy" decoding="async" /></span>
              <span class="customer-info">
                <strong>${escapeHtml(localName(dish))}</strong>
                <small>${escapeHtml(localDescription(dish))}</small>
                <span class="customer-presentations">${soldOut ? `<b><span>Agotado</span></b>` : presentationBadges(dish)}</span>
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
  if (profileStreak) {
    const streak = weeklyStreakForEvents(currentCustomer.events || []);
    const purchases = (currentCustomer.events || [])
      .filter((event) => event.event_type === "purchase" && consumptionStatus(event) !== "cancelled")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const streakProgress = streakProgressModel(streak, purchases[0]?.created_at || "");
    profileStreak.textContent = `Racha semanal: ${streakProgress.title}. ${streakProgress.helper}`;
  }
  const referralCode = customerReferralCode();
  if (profileReferralBox) profileReferralBox.hidden = !referralCode;
  if (profileReferralCode) profileReferralCode.textContent = referralCode || "Sin codigo";
  if (profileReferralText) {
    const ownerPoints = loyaltySettings.referralReferrerPoints || 0;
    const guestPoints = loyaltySettings.referralReferredPoints || 0;
    profileReferralText.textContent = referralCode
      ? `Comparte tu link: tu ganas ${ownerPoints} pts y tu invitado ${guestPoints} pts.`
      : "Tu codigo se generara al completar el registro.";
  }
  profileAdminButton.hidden = !canAccessAdmin();
  const profileMovements = [
    ...(currentCustomer.events || []).map((event) => ({
      kind: "points",
      created_at: event.created_at,
      title: event.description || event.event_type,
      meta: formatEventDate(event.created_at),
      value: `${event.points_delta > 0 ? "+" : ""}${event.points_delta} pts`
    })),
    ...(currentCustomer.redemptions || []).map((redemption) => ({
      kind: "redemption",
      created_at: redemption.created_at,
      title: `Canje ${redemptionDisplayStatusLabel(redemption)}: ${redemption.reward_name}`,
      meta: formatEventDate(redemption.created_at),
      value: `${redemption.points_cost || 0} pts`
    }))
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  profileHistoryCount.textContent = profileMovements.length;
  profileHistoryList.innerHTML = profileMovements.length
    ? profileMovements
        .slice(0, 30)
        .map((event) => {
          return `
            <div class="profile-event ${event.kind === "redemption" ? "is-redemption" : ""}">
              <span>
                <strong>${escapeHtml(event.title)}</strong>
                <small>${escapeHtml(event.meta)}</small>
              </span>
              <b>${escapeHtml(event.value)}</b>
            </div>
          `;
        })
        .join("")
    : `<p class="profile-empty">${escapeHtml(labels[currentLang].profileHistoryEmpty || "Todavia no hay movimientos.")}</p>`;
}

function renderAdminHome() {
  if (!adminPanel) return;
  const ownerName = currentCustomer?.profile?.name || (isManager() ? "Manager" : "Owner");
  const today = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

  adminGreeting.textContent = `Bienvenido, ${ownerName}`;
  adminSummary.textContent = "Estas son las senales que ayudan a decidir que vender, que cliente recuperar y que accion tomar hoy.";
  document.querySelector("#adminDate").textContent = `Inicio - ${today}`;
  if (adminHeroActions) {
    adminHeroActions.innerHTML = `
      <button class="primary" type="button" data-analytics-action="consumption">
        <svg class="ui-icon" aria-hidden="true"><use href="#icon-user"></use></svg>
        Cargar consumo
      </button>
      ${isOwner() ? `<button class="outline" type="button" data-analytics-action="content">
        <svg class="ui-icon" aria-hidden="true"><use href="#icon-spark"></use></svg>
        Crear contenido
      </button>` : ""}
    `;
  }
}

function renderAdminMenu() {
  if (!adminDishRows) return;
  const items = visibleAdminItems();
  adminMenuCount.textContent = items.length;
  adminDishRows.innerHTML = items.length
    ? items
    .map((dish) => {
      const soldOut = isSoldOut(dish);
      const visible = isDishVisible(dish);
      const status = !visible ? "Oculto" : soldOut ? "Agotado" : "Visible";
      const visibilityLabel = visible ? "Ocultar del menu" : "Mostrar en menu";
      const visibilityIcon = visible ? "#icon-eye-off" : "#icon-eye";
      const recommended = dish.id === effectiveRecommendedDishId();
      const popular = dish.id === effectivePopularDishId(dish.brand);
      return `
      <div class="dish-row admin-dish-row ${visible ? "" : "is-hidden"} ${soldOut ? "is-sold-out" : ""}" data-admin-dish="${escapeAttribute(dish.id)}" role="row">
        <span class="dish-title" role="cell">
          <span class="thumb"><img src="${escapeAttribute(dish.photo)}" alt="" loading="lazy" decoding="async" /></span>
          <span class="dish-name">${escapeHtml(dish.name)}</span>
        </span>
        <span class="cell-muted" role="cell">${escapeHtml(dish.category)}</span>
        <span class="pill ui-pill" role="cell">${escapeHtml(dish.brand)}</span>
        <span class="cell-muted" role="cell">${escapeHtml(priceRange(dish))}</span>
        <span class="status ui-pill" role="cell">${status}</span>
        <span class="row-actions" role="cell" aria-label="Acciones de ${escapeAttribute(dish.name)}">
          <button class="icon-button ${recommended ? "is-active" : ""}" data-admin-row-action="recommend" type="button" aria-pressed="${recommended}" aria-label="${recommended ? "Producto destacado" : "Destacar producto"} ${escapeAttribute(dish.name)}">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-pin"></use></svg>
          </button>
          <button class="icon-button hot-admin-action ${popular ? "is-active" : ""}" data-admin-row-action="popular" type="button" aria-pressed="${popular}" aria-label="${popular ? "Quitar popular" : "Marcar popular"} ${escapeAttribute(dish.name)}">
            <span aria-hidden="true">🔥</span>
          </button>
          <button class="icon-button" data-admin-row-action="visibility" type="button" aria-pressed="${visible}" aria-label="${visibilityLabel} ${escapeAttribute(dish.name)}">
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
    .join("")
    : `<div class="admin-empty" role="row"><span role="cell">No hay productos que coincidan con la busqueda.</span></div>`;
}

async function setRecommendedDish(dish) {
  await saveBusinessMenuSettings({
    ...menuSettings,
    recommendedDishId: dish.id
  });
  renderAdminPanel();
  renderList();
  showToast(`${dish.name} ahora aparece como producto destacado.`);
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
    setLoadingState(adminCustomerRows, false);
    adminCustomerRows.innerHTML = adminDataErrorMarkup("No se pudieron cargar los clientes");
    return;
  }
  if (supabase && currentSession?.user && canAccessAdmin() && !currentAdminData.remoteLoaded) {
    setLoadingState(adminCustomerRows, true);
    adminCustomerRows.innerHTML = skeletonRowsMarkup(5, "Cargando clientes del negocio");
    return;
  }

  setLoadingState(adminCustomerRows, false);
  syncCustomerTierFilter();
  const rows = filteredCustomerAnalytics();

  adminCustomerRows.innerHTML = rows.length
    ? rows.map((customer) => customerRowMarkup(customer)).join("")
    : `<div class="admin-empty" role="row"><span role="cell">No hay clientes que coincidan con estos filtros.</span></div>`;

  if (activeAdminCustomerId) renderAdminCustomerDetail();
}

function syncCustomerTierFilter() {
  if (!adminCustomerTierFilter) return;
  const current = adminCustomerTierFilter.value || "all";
  const tiers = [...new Set(currentAdminData.accounts.map((account) => account.tier || "bronze"))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  adminCustomerTierFilter.innerHTML = [
    `<option value="all">Todos</option>`,
    ...tiers.map((tier) => `<option value="${escapeAttribute(tier)}">${escapeHtml(tierLabel(tier))}</option>`)
  ].join("");
  adminCustomerTierFilter.value = tiers.includes(current) ? current : "all";
}

function filteredCustomerAnalytics() {
  const tier = adminCustomerTierFilter?.value || "all";
  const status = adminCustomerStatusFilter?.value || "all";
  const activity = adminCustomerActivityFilter?.value || "all";
  const sort = adminCustomerSortFilter?.value || "lastVisit";

  return buildCustomerAnalytics(purchaseEvents())
    .filter((customer) => customerSearchMatches(customer.profile, customer.account))
    .filter((customer) => tier === "all" || (customer.account?.tier || "bronze") === tier)
    .filter((customer) => status === "all"
      || customer.status.tone === status
      || (status.startsWith("operational:") && customer.status.operational === status.replace("operational:", "")))
    .filter((customer) => {
      if (activity === "points") return Number(customer.account?.points_balance || 0) > 0;
      if (activity === "inactive") return customer.status.tone === "warn" || customer.status.tone === "bad" || customer.status.tone === "neutral";
      if (activity === "streak") return customer.streak > 0;
      return true;
    })
    .sort((a, b) => {
      if (sort === "name") return String(a.profile.name || "").localeCompare(String(b.profile.name || ""));
      if (sort === "points") return Number(b.account?.points_balance || 0) - Number(a.account?.points_balance || 0);
      if (sort === "visits") return b.visits - a.visits;
      if (sort === "spent") return b.totalSpent - a.totalSpent;
      return new Date(b.lastVisit || 0) - new Date(a.lastVisit || 0);
    });
}

function customerRowMarkup(customer) {
  const points = Number(customer.account?.points_balance || 0);
  const tier = tierLabel(customer.account?.tier || "bronze");
  const pending = redemptionsForCustomer(customer.profile.id).filter(redemptionIsActionableRequest).length;
  const activeClass = activeAdminCustomerId === customer.profile.id ? "is-active" : "";
  const streakProgress = streakProgressModel(customer.streak, customer.lastVisit);
  return `
    <article class="admin-customer-row ${activeClass}" data-customer-id="${escapeAttribute(customer.profile.id)}" role="row">
      <span class="admin-row-field admin-row-identity" data-label="Cliente" role="cell">
        <span class="admin-row-field-value">
          <strong>${escapeHtml(customer.profile.name || "Cliente")}</strong>
          <small>${escapeHtml(customerVisibleIdentifier(customer.profile))}</small>
        </span>
      </span>
      <span class="admin-row-field" data-label="Puntos" role="cell"><b class="admin-row-field-value">${escapeHtml(formatNumber(points))} pts</b></span>
      <span class="admin-row-field" data-label="Nivel" role="cell"><span class="pill ui-pill admin-row-field-value">${escapeHtml(tier)}</span></span>
      <span class="admin-row-field" data-label="Ultima visita" role="cell">
        <span class="admin-row-field-value">
          <strong>${customer.lastVisit ? escapeHtml(formatEventDate(customer.lastVisit)) : "Sin consumo"}</strong>
          <small>${escapeHtml(customer.status.label)}</small>
        </span>
      </span>
      <span class="admin-row-field" data-label="Racha" role="cell">
        <span class="admin-row-field-value">
          <strong>${escapeHtml(streakProgress.title)}</strong>
          <small>${escapeHtml(streakProgress.status)}</small>
        </span>
      </span>
      <span class="admin-row-field" data-label="Consumos" role="cell">
        <span class="admin-row-field-value">
          <strong>${escapeHtml(customer.visits)}</strong>
          <small>${pending ? `${escapeHtml(pending)} canjes pendientes` : "Sin canjes pendientes"}</small>
        </span>
      </span>
      <span class="admin-row-field" data-label="Total" role="cell"><b class="admin-row-field-value">${escapeHtml(formatCurrency(customer.totalSpent))}</b></span>
      <span class="row-actions customer-row-actions" role="cell">
        <button class="mini-action" type="button" data-customer-action="detail" data-customer-id="${escapeAttribute(customer.profile.id)}">Ver</button>
        <button class="mini-action" type="button" data-customer-action="consume" data-customer-id="${escapeAttribute(customer.profile.id)}">Cargar</button>
      </span>
    </article>
  `;
}

function customerDetailModel(customerId) {
  const customer = buildCustomerAnalytics(purchaseEvents()).find((item) => item.profile.id === customerId);
  if (!customer) return null;
  const purchases = eventsForCustomer(customerId)
    .filter((event) => event.event_type === "purchase")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const redemptions = redemptionsForCustomer(customerId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { ...customer, purchases, redemptions };
}

function purchaseItemsLabel(event) {
  const items = parsePurchaseItems(event);
  const status = consumptionStatus(event);
  const category = purchaseCategoryLabel(event);
  const note = purchaseNote(event);
  if (!items.length) return "Sin productos cargados";
  return items
    .slice(0, 4)
    .map((item) => `${item.name || "Producto"} x${item.quantity || 1}`)
    .join(", ");
}

function renderAdminCustomerDetail() {
  if (!adminCustomerDetailPanel || !adminCustomerDetailContent) return;
  const model = activeAdminCustomerId ? customerDetailModel(activeAdminCustomerId) : null;
  if (!model) {
    adminCustomerDetailPanel.hidden = true;
    adminCustomerDetailContent.innerHTML = "";
    return;
  }
  const points = Number(model.account?.points_balance || 0);
  const streakProgress = streakProgressModel(model.streak, model.lastVisit);
  const canCancelRedemptions = isOwner() || isManager();
  adminCustomerDetailPanel.hidden = false;
  adminCustomerDetailContent.innerHTML = `
    <div class="customer-detail-hero">
      <span class="status-dot tone-${escapeAttribute(model.status.tone)}">${escapeHtml(model.status.label)}</span>
      <h2>${escapeHtml(model.profile.name || "Cliente")}</h2>
      <p>${escapeHtml(customerVisibleIdentifier(model.profile))}</p>
    </div>
    <div class="customer-detail-metrics">
      <div><span>Puntos</span><strong>${escapeHtml(formatNumber(points))}</strong></div>
      <div><span>Nivel</span><strong>${escapeHtml(tierLabel(model.account?.tier || "bronze"))}</strong></div>
      <div><span>Consumos</span><strong>${escapeHtml(model.visits)}</strong></div>
      <div><span>Total gastado</span><strong>${escapeHtml(formatCurrency(model.totalSpent))}</strong></div>
      <div><span>Ticket promedio</span><strong>${escapeHtml(formatCurrency(model.averageTicket))}</strong></div>
      <div><span>Racha</span><strong>${escapeHtml(streakProgress.title)}</strong></div>
    </div>
    <div class="customer-detail-block">
      ${streakProgressMarkup(streakProgress)}
    </div>
    <div class="customer-detail-block">
      <h3>Actividad</h3>
      <dl class="activity-detail-list">
        ${detailRows([
          { label: "Alta", value: formatFullDateTime(model.profile.created_at) || "Sin dato" },
          { label: "Estado operativo", value: operationalCustomerStatus(model.profile)?.label || "Activo" },
          { label: "Ultima visita", value: model.lastVisit ? formatFullDateTime(model.lastVisit) : "Sin consumo" },
          { label: "Producto favorito", value: model.favoriteProduct || "Sin patron aun" },
          { label: "Canjes pedidos", value: model.redemptions.length }
        ])}
      </dl>
    </div>
    <div class="customer-detail-block">
      <h3>Ultimos consumos</h3>
      ${model.purchases.length ? `
        <div class="customer-detail-list">
          ${model.purchases.slice(0, 5).map((event) => `
            <article>
              <span>
                <strong>${escapeHtml(formatCurrency(event.purchase_total))}</strong>
                <small>${escapeHtml(purchaseItemsLabel(event))}</small>
              </span>
              <b>+${escapeHtml(event.points_delta || 0)} pts</b>
              <small>${escapeHtml(formatFullDateTime(event.created_at))}</small>
            </article>
          `).join("")}
        </div>
      ` : `<div class="admin-empty compact">Todavia no tiene consumos cargados.</div>`}
    </div>
    <div class="customer-detail-block">
      <h3>Canjes</h3>
      ${model.redemptions.length ? `
        <div class="customer-detail-list">
          ${model.redemptions.slice(0, 5).map((redemption) => `
            <article class="customer-redemption-row">
              <span>
                <strong>${escapeHtml(redemption.reward_name || "Premio")}</strong>
                <small>${escapeHtml(formatFullDateTime(redemption.created_at))} - ${escapeHtml(redemptionDisplayStatusLabel(redemption))}</small>
              </span>
              <b>${escapeHtml(redemption.points_cost || 0)} pts</b>
              <span class="redemption-actions">
                ${redemptionIsActionableRequest(redemption) ? `<button class="mini-action" type="button" data-redemption-action="approved" data-redemption-id="${escapeAttribute(redemption.id)}">Aprobar</button>` : ""}
                ${redemption.status === "approved" ? `<button class="mini-action" type="button" data-redemption-action="redeemed" data-redemption-id="${escapeAttribute(redemption.id)}">Entregado</button>` : ""}
                ${canCancelRedemptions && redemption.status !== "cancelled" && redemption.status !== "redeemed" ? `<button class="mini-action danger" type="button" data-redemption-action="cancelled" data-redemption-id="${escapeAttribute(redemption.id)}">Rechazar</button>` : ""}
              </span>
            </article>
          `).join("")}
        </div>
      ` : `<div class="admin-empty compact">Sin canjes registrados.</div>`}
    </div>
    <div class="customer-detail-actions">
      <button class="primary" type="button" data-customer-action="consume" data-customer-id="${escapeAttribute(model.profile.id)}">Cargar consumo</button>
      <button class="outline" type="button" data-customer-action="qr" data-customer-id="${escapeAttribute(model.profile.id)}">Ver QR</button>
    </div>
    <div class="customer-status-editor">
      <label>
        <span>Estado de cliente</span>
        <select data-customer-status-select="${escapeAttribute(model.profile.id)}">
          ${customerOperationalStatusOptions.map((option) => `
            <option value="${escapeAttribute(option.value)}" ${customerOperationalStatusValue(model.profile) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
          `).join("")}
        </select>
      </label>
      <button class="outline" type="button" data-customer-action="status" data-customer-id="${escapeAttribute(model.profile.id)}">Guardar estado</button>
    </div>
    <div class="customer-adjust-editor">
      <div>
        <span>Ajuste manual de puntos</span>
        <small>Solo owner. Queda registrado en actividad y no puede dejar saldo negativo.</small>
      </div>
      <label>
        <span>Puntos</span>
        <input type="number" step="1" inputmode="numeric" placeholder="+50 o -20" data-customer-points-delta="${escapeAttribute(model.profile.id)}" />
      </label>
      <label>
        <span>Motivo</span>
        <input type="text" maxlength="120" placeholder="Ej. compensacion por error" data-customer-points-reason="${escapeAttribute(model.profile.id)}" />
      </label>
      <button class="outline" type="button" data-customer-action="adjust-points" data-customer-id="${escapeAttribute(model.profile.id)}">Aplicar ajuste</button>
    </div>
  `;
}

function openAdminCustomerDetail(customerId) {
  activeAdminCustomerId = customerId || "";
  renderAdminCustomers();
  renderAdminCustomerDetail();
}

function closeAdminCustomerDetail() {
  activeAdminCustomerId = "";
  renderAdminCustomers();
  renderAdminCustomerDetail();
}

function updateLocalCustomerStatus(customerId, status) {
  const profile = currentAdminData.customers.find((customer) => customer.id === customerId);
  if (profile) profile.status = status;
}

async function updateAdminCustomerStatus(customerId, status, trigger = null) {
  if (!customerId) return;
  const normalizedStatus = customerOperationalStatusOptions.some((option) => option.value === status)
    ? status
    : "active";
  if (!isOwner()) {
    showToast("Solo el owner puede cambiar el estado del cliente.");
    return;
  }
  if (trigger) trigger.disabled = true;
  try {
    if (!supabase || !isRemoteOwner()) {
      updateLocalCustomerStatus(customerId, normalizedStatus);
      showToast("Estado del cliente actualizado.");
      renderAdminCustomers();
      renderAdminCustomerDetail();
      return;
    }

    const { data, error } = await supabase
      .from("customer_profiles")
      .update({ status: normalizedStatus })
      .eq("id", customerId)
      .eq("business_id", businessId)
      .select("id, status")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("No se encontro el cliente para actualizar.");
    updateLocalCustomerStatus(customerId, data.status || normalizedStatus);
    currentAdminData.loaded = false;
    currentAdminData.remoteLoaded = false;
    showToast("Estado del cliente actualizado.");
    renderAdminCustomers();
    renderAdminCustomerDetail();
  } catch (error) {
    showToast(displayError(error));
  } finally {
    if (trigger) trigger.disabled = false;
  }
}

function updateLocalCustomerPoints(customerId, delta, reason = "", payload = {}) {
  const account = currentAdminData.accounts.find((item) => item.customer_id === customerId);
  if (!account) return null;
  const nextBalance = Math.max(0, Number(account.points_balance || 0) + Number(delta || 0));
  account.points_balance = nextBalance;
  account.tier = tierValueForPoints(nextBalance);
  account.updated_at = new Date().toISOString();

  const event = payload.event || {
    id: fallbackId(),
    customer_id: customerId,
    business_id: businessId,
    event_type: "adjustment",
    points_delta: Number(delta || 0),
    description: reason ? `Ajuste manual: ${reason}` : "Ajuste manual de puntos",
    recorded_by_auth_user_id: currentSession?.user?.id || null,
    request_id: payload.requestId || fallbackRequestId("manual-adjustment"),
    created_at: new Date().toISOString()
  };
  currentAdminData.events = [event, ...currentAdminData.events.filter((item) => item.id !== event.id)];

  if (currentCustomer?.account?.id === account.id) {
    currentCustomer.account = { ...currentCustomer.account, ...account };
    pointsBalance = account.points_balance || 0;
  }

  return { account, event };
}

function recalculateLocalAccountTiers() {
  currentAdminData.accounts.forEach((account) => {
    account.tier = tierValueForPoints(account.points_balance || 0);
  });
  if (currentCustomer?.account) {
    currentCustomer.account = {
      ...currentCustomer.account,
      tier: tierValueForPoints(currentCustomer.account.points_balance || 0)
    };
  }
}

async function adjustAdminCustomerPoints(customerId, trigger = null) {
  if (!customerId || !adminCustomerDetailPanel) return;
  if (!isOwner()) {
    showToast("Solo el owner puede ajustar puntos.");
    return;
  }
  const deltaInput = [...adminCustomerDetailPanel.querySelectorAll("[data-customer-points-delta]")]
    .find((element) => element.dataset.customerPointsDelta === customerId);
  const reasonInput = [...adminCustomerDetailPanel.querySelectorAll("[data-customer-points-reason]")]
    .find((element) => element.dataset.customerPointsReason === customerId);
  const delta = Number(deltaInput?.value || 0);
  const reason = String(reasonInput?.value || "").trim();
  if (!Number.isInteger(delta) || delta === 0) {
    showToast("Ingresa un ajuste entero distinto de cero.");
    deltaInput?.focus();
    return;
  }

  const account = currentAdminData.accounts.find((item) => item.customer_id === customerId);
  if (!account) {
    showToast("No se encontro la cuenta de puntos.");
    return;
  }
  if (Number(account.points_balance || 0) + delta < 0) {
    showToast("El ajuste no puede dejar saldo negativo.");
    deltaInput?.focus();
    return;
  }

  if (trigger) trigger.disabled = true;
  try {
    const requestId = `manual-adjust:${businessId}:${customerId}:${fallbackRequestId("points")}`;
    if (!supabase || !isRemoteOwner()) {
      updateLocalCustomerPoints(customerId, delta, reason, { requestId });
      showToast("Puntos ajustados.");
      if (deltaInput) deltaInput.value = "";
      if (reasonInput) reasonInput.value = "";
      renderAdminPanel();
      renderAdminCustomerDetail();
      renderLoyalty();
      return;
    }

    const { data, error } = await supabase.rpc("adjust_customer_points", {
      target_business_id: businessId,
      target_customer_id: customerId,
      adjustment_points: delta,
      adjustment_reason: reason,
      request_id: requestId
    });
    if (error) throw error;

    const updatedAccount = data?.account || null;
    const event = data?.event || null;
    if (updatedAccount?.id) {
      const localAccount = currentAdminData.accounts.find((item) => item.id === updatedAccount.id);
      if (localAccount) Object.assign(localAccount, updatedAccount);
      if (currentCustomer?.account?.id === updatedAccount.id) {
        currentCustomer.account = { ...currentCustomer.account, ...updatedAccount };
        pointsBalance = updatedAccount.points_balance || 0;
      }
    }
    if (event?.id) {
      currentAdminData.events = [event, ...currentAdminData.events.filter((item) => item.id !== event.id)];
    }
    currentAdminData.loaded = false;
    currentAdminData.remoteLoaded = false;
    await ensureAdminData();
    if (deltaInput) deltaInput.value = "";
    if (reasonInput) reasonInput.value = "";
    showToast(data?.idempotent ? "Ajuste ya registrado." : "Puntos ajustados.");
    renderAdminPanel();
    renderAdminCustomerDetail();
    renderLoyalty();
  } catch (error) {
    showToast(displayError(error));
  } finally {
    if (trigger) trigger.disabled = false;
  }
}

function purchaseEvents() {
  return currentAdminData.events.filter((event) => event.event_type === "purchase");
}

function consumptionStatus(event) {
  return event.purchase_status || "confirmed";
}

function consumptionMethod(event) {
  return event.consumption_entry_method || (event.qr_id ? "qr" : "manual");
}

function consumptionMethodLabel(method) {
  const labelsMap = {
    qr: "QR",
    manual: "Manual",
    api: "API",
    adjustment: "Ajuste"
  };
  return labelsMap[method] || "Manual";
}

function consumptionStatusLabel(status) {
  const labelsMap = {
    confirmed: "Confirmado",
    cancelled: "Cancelado",
    corrected: "Corregido"
  };
  return labelsMap[status] || "Confirmado";
}

function employeeLabel(authUserId) {
  if (!authUserId) return "Sin empleado";
  const owner = currentAdminData.customers.find((profile) => profile.auth_user_id === authUserId);
  if (owner?.name) return owner.name;
  return `Empleado ${String(authUserId).slice(0, 8)}`;
}

function consumptionDateKey(event) {
  if (!event.created_at) return "";
  return new Date(event.created_at).toISOString().slice(0, 10);
}

function purchaseCategory(event) {
  return String(event.purchase_category || "").trim();
}

function purchaseNote(event) {
  return String(event.purchase_note || "").trim();
}

function purchaseCategoryLabel(event) {
  const category = purchaseCategory(event);
  if (category) return category;
  const firstKnownCategory = parsePurchaseItems(event)
    .map((item) => dishById(item.dishId)?.category)
    .find(Boolean);
  return firstKnownCategory || "Sin categoria";
}

function filteredConsumptionEvents() {
  const dateFrom = adminConsumptionDateFromFilter?.value || "";
  const dateTo = adminConsumptionDateToFilter?.value || "";
  const clientQuery = (adminConsumptionClientFilter?.value || "").trim().toLowerCase();
  const productQuery = (adminConsumptionProductFilter?.value || "").trim().toLowerCase();
  const noteQuery = (adminConsumptionNoteFilter?.value || "").trim().toLowerCase();
  const minAmount = Number(adminConsumptionMinFilter?.value || 0);
  const maxAmountRaw = adminConsumptionMaxFilter?.value || "";
  const maxAmount = maxAmountRaw === "" ? Infinity : Number(maxAmountRaw);
  const category = adminConsumptionCategoryFilter?.value || "all";
  const employee = adminConsumptionEmployeeFilter?.value || "all";
  const method = adminConsumptionMethodFilter?.value || "all";
  const status = adminConsumptionStatusFilter?.value || "all";

  return purchaseEvents()
    .filter((event) => {
      const key = consumptionDateKey(event);
      return (!dateFrom || key >= dateFrom) && (!dateTo || key <= dateTo);
    })
    .filter((event) => {
      const amount = Number(event.purchase_total || 0);
      return amount >= minAmount && amount <= maxAmount;
    })
    .filter((event) => category === "all" || purchaseCategoryLabel(event) === category)
    .filter((event) => method === "all" || consumptionMethod(event) === method)
    .filter((event) => status === "all" || consumptionStatus(event) === status)
    .filter((event) => employee === "all" || String(event.recorded_by_auth_user_id || "") === employee)
    .filter((event) => {
      if (!clientQuery) return true;
      const profile = customerProfile(event.customer_id);
      const haystack = `${profile?.name || ""} ${profile?.email || ""}`.toLowerCase();
      return haystack.includes(clientQuery);
    })
    .filter((event) => {
      if (!productQuery) return true;
      return purchaseItemsLabel(event).toLowerCase().includes(productQuery);
    })
    .filter((event) => {
      if (!noteQuery) return true;
      return `${purchaseNote(event)} ${event.request_id || ""} ${event.qr_id || ""}`.toLowerCase().includes(noteQuery);
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function syncSelectOptions(select, values, labelForValue, fallbackLabel = "Todos") {
  if (!select) return;
  const current = select.value || "all";
  select.innerHTML = [
    `<option value="all">${escapeHtml(fallbackLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(labelForValue(value))}</option>`)
  ].join("");
  select.value = values.includes(current) ? current : "all";
}

function syncConsumptionFilterOptions() {
  const employees = [...new Set(purchaseEvents().map((event) => event.recorded_by_auth_user_id).filter(Boolean))];
  const categories = [...new Set(purchaseEvents().map(purchaseCategoryLabel).filter((category) => category && category !== "Sin categoria"))]
    .sort((a, b) => a.localeCompare(b));
  syncSelectOptions(adminConsumptionEmployeeFilter, employees, employeeLabel);
  syncSelectOptions(adminConsumptionCategoryFilter, categories, (category) => category, "Todas");
}

function topProductFromConsumptions(events) {
  const map = new Map();
  events.forEach((event) => {
    parsePurchaseItems(event).forEach((item) => {
      addRankValue(map, item.dishId || item.name, item.name || "Producto", Number(item.quantity || 1));
    });
  });
  return sortedRank(map)[0] || null;
}

function consumptionCorrectionsForEvent(eventId) {
  return (currentAdminData.consumptionCorrections || [])
    .filter((correction) => correction.original_event_id === eventId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function adminConsumptionCategoryOptions(selected = "") {
  const categories = [...new Set([
    ...menuItems.map((dish) => dish.category).filter(Boolean),
    ...purchaseEvents().map(purchaseCategoryLabel).filter((category) => category && category !== "Sin categoria")
  ])].sort((a, b) => a.localeCompare(b));
  return [
    `<option value="">Sin categoria</option>`,
    ...categories.map((category) => `<option value="${escapeAttribute(category)}" ${category === selected ? "selected" : ""}>${escapeHtml(category)}</option>`)
  ].join("");
}

function consumptionCorrectionHistoryMarkup(eventId) {
  const corrections = consumptionCorrectionsForEvent(eventId);
  if (!corrections.length) {
    return `<div class="admin-empty compact">Todavia no hay correcciones registradas.</div>`;
  }
  return `
    <div class="customer-detail-list">
      ${corrections.map((correction) => `
        <article>
          <span>
            <strong>${escapeHtml(formatCurrency(correction.previous_purchase_total))} -> ${escapeHtml(formatCurrency(correction.next_purchase_total))}</strong>
            <small>${escapeHtml(formatFullDateTime(correction.created_at))} · ${escapeHtml(employeeLabel(correction.corrected_by_auth_user_id))}</small>
          </span>
          <b>${Number(correction.points_delta_adjustment || 0) >= 0 ? "+" : ""}${escapeHtml(correction.points_delta_adjustment || 0)} pts</b>
          <small>${escapeHtml(correction.correction_note || "Sin nota de correccion")}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function consumptionCorrectionFormMarkup(event) {
  const status = consumptionStatus(event);
  if (status === "cancelled") {
    return `<div class="admin-empty compact">Los consumos cancelados no se pueden corregir.</div>`;
  }
  const category = purchaseCategory(event);
  return `
    <div class="consumption-correction-form" data-consumption-correction-form="${escapeAttribute(event.id)}">
      <label>
        <span>Monto corregido</span>
        <input type="number" min="1" step="1" inputmode="decimal" value="${escapeAttribute(event.purchase_total || "")}" data-consumption-correction-total="${escapeAttribute(event.id)}" />
      </label>
      <label>
        <span>Categoria</span>
        <select data-consumption-correction-category="${escapeAttribute(event.id)}">
          ${adminConsumptionCategoryOptions(category)}
        </select>
      </label>
      <label>
        <span>Nota interna</span>
        <input type="text" maxlength="180" value="${escapeAttribute(purchaseNote(event))}" data-consumption-correction-note="${escapeAttribute(event.id)}" placeholder="Mesa, aclaracion o motivo operativo" />
      </label>
      <label>
        <span>Motivo de correccion</span>
        <input type="text" maxlength="180" data-consumption-correction-reason="${escapeAttribute(event.id)}" placeholder="Ej: monto mal cargado" />
      </label>
      <button class="primary" type="button" data-consumption-action="correct" data-consumption-id="${escapeAttribute(event.id)}">Guardar correccion</button>
    </div>
  `;
}

function renderAdminConsumptionSummary(events = filteredConsumptionEvents()) {
  if (!adminConsumptionSummary) return;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter((event) => consumptionDateKey(event) === todayKey);
  const totalFiltered = events.reduce((sum, event) => sum + Number(event.purchase_total || 0), 0);
  const totalToday = todayEvents.reduce((sum, event) => sum + Number(event.purchase_total || 0), 0);
  const totalPoints = events.reduce((sum, event) => sum + Number(event.points_delta || 0), 0);
  const averageTicket = events.length ? totalFiltered / events.length : 0;
  const topProduct = topProductFromConsumptions(events);

  adminConsumptionSummary.innerHTML = [
    ["Total filtrado", formatCurrency(totalFiltered), `${formatNumber(events.length)} consumos en vista`],
    ["Hoy", formatCurrency(totalToday), `${formatNumber(todayEvents.length)} consumos hoy`],
    ["Ticket promedio", formatCurrency(averageTicket), "segun filtros activos"],
    ["Puntos entregados", `${formatNumber(totalPoints)} pts`, "segun filtros activos"],
    ["Producto mas cargado", topProduct ? topProduct.label : "Sin productos", topProduct ? `${formatNumber(topProduct.value)} unidades` : "solo monto"]
  ].map(([label, value, note]) => `
    <article class="consumption-summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `).join("");
}

function consumptionRowMarkup(event) {
  const profile = customerProfile(event.customer_id);
  const activeClass = activeAdminConsumptionId === event.id ? "is-active" : "";
  const status = consumptionStatus(event);
  return `
    <article class="admin-consumption-row ${activeClass}" data-consumption-id="${escapeAttribute(event.id)}" role="row">
      <span class="admin-row-field admin-row-identity" data-label="Cliente" role="cell">
        <span class="admin-row-field-value">
          <strong>${escapeHtml(profile?.name || "Cliente")}</strong>
          <small>${escapeHtml(profile?.email || "Sin email")}</small>
        </span>
      </span>
      <span class="admin-row-field" data-label="Total" role="cell"><b class="admin-row-field-value">${escapeHtml(formatCurrency(event.purchase_total))}</b></span>
      <span class="admin-row-field" data-label="Productos" role="cell"><span class="cell-muted admin-row-field-value">${escapeHtml(purchaseItemsLabel(event))}</span></span>
      <span class="admin-row-field" data-label="Puntos" role="cell"><b class="admin-row-field-value">+${escapeHtml(event.points_delta || 0)} pts</b></span>
      <span class="admin-row-field" data-label="Empleado" role="cell"><span class="cell-muted admin-row-field-value">${escapeHtml(employeeLabel(event.recorded_by_auth_user_id))}</span></span>
      <span class="admin-row-field" data-label="Metodo" role="cell"><span class="pill ui-pill admin-row-field-value">${escapeHtml(consumptionMethodLabel(consumptionMethod(event)))}</span></span>
      <span class="admin-row-field" data-label="Fecha" role="cell">
        <span class="admin-row-field-value">
          <strong>${escapeHtml(formatEventDate(event.created_at))}</strong>
          <small class="${status === "cancelled" ? "text-danger" : ""}">${escapeHtml(consumptionStatusLabel(status))}</small>
        </span>
      </span>
      <span class="row-actions" role="cell">
        <button class="mini-action" type="button" data-consumption-action="detail" data-consumption-id="${escapeAttribute(event.id)}">Ver</button>
      </span>
    </article>
  `;
}

function renderAdminConsumptions() {
  if (!adminConsumptionRows) return;
  if (currentAdminData.error) {
    setLoadingState(adminConsumptionRows, false);
    setLoadingState(adminConsumptionSummary, false);
    adminConsumptionSummary.innerHTML = "";
    adminConsumptionRows.innerHTML = adminDataErrorMarkup("No se pudieron cargar los consumos");
    return;
  }
  if (supabase && currentSession?.user && canAccessAdmin() && !currentAdminData.remoteLoaded) {
    setLoadingState(adminConsumptionRows, true);
    setLoadingState(adminConsumptionSummary, true);
    adminConsumptionSummary.innerHTML = skeletonCardsMarkup(4, "Cargando resumen de consumos");
    adminConsumptionRows.innerHTML = skeletonRowsMarkup(5, "Cargando consumos del negocio");
    return;
  }

  setLoadingState(adminConsumptionRows, false);
  setLoadingState(adminConsumptionSummary, false);
  syncConsumptionFilterOptions();
  const rows = filteredConsumptionEvents();
  renderAdminConsumptionSummary(rows);
  adminConsumptionRows.innerHTML = rows.length
    ? rows.map(consumptionRowMarkup).join("")
    : `<div class="admin-empty" role="row"><span role="cell">No hay consumos que coincidan con estos filtros.</span></div>`;
  if (activeAdminConsumptionId) renderAdminConsumptionDetail();
}

function renderAdminConsumptionDetail() {
  if (!adminConsumptionDetailPanel || !adminConsumptionDetailContent) return;
  const event = activeAdminConsumptionId
    ? purchaseEvents().find((item) => item.id === activeAdminConsumptionId)
    : null;
  if (!event) {
    adminConsumptionDetailPanel.hidden = true;
    adminConsumptionDetailContent.innerHTML = "";
    return;
  }
  const profile = customerProfile(event.customer_id);
  const items = parsePurchaseItems(event);
  const status = consumptionStatus(event);
  const category = purchaseCategoryLabel(event);
  const note = purchaseNote(event);
  adminConsumptionDetailPanel.hidden = false;
  adminConsumptionDetailContent.innerHTML = `
    <div class="customer-detail-hero">
      <span class="status-dot ${status === "cancelled" ? "tone-danger" : "tone-good"}">${escapeHtml(consumptionStatusLabel(status))}</span>
      <h2>${escapeHtml(formatCurrency(event.purchase_total))}</h2>
      <p>${escapeHtml(profile?.name || "Cliente")} · ${escapeHtml(formatFullDateTime(event.created_at))}</p>
    </div>
    <div class="customer-detail-metrics">
      <div><span>Puntos</span><strong>+${escapeHtml(event.points_delta || 0)}</strong></div>
      <div><span>Metodo</span><strong>${escapeHtml(consumptionMethodLabel(consumptionMethod(event)))}</strong></div>
      <div><span>Empleado</span><strong>${escapeHtml(employeeLabel(event.recorded_by_auth_user_id))}</strong></div>
      <div><span>Estado</span><strong>${escapeHtml(consumptionStatusLabel(status))}</strong></div>
      <div><span>Categoria</span><strong>${escapeHtml(category)}</strong></div>
    </div>
    <div class="customer-detail-block">
      <h3>Productos</h3>
      ${items.length ? `
        <div class="customer-detail-list">
          ${items.map((item) => `
            <article>
              <span>
                <strong>${escapeHtml(item.name || "Producto")}</strong>
                <small>${escapeHtml(item.presentationName || "Presentacion")}</small>
              </span>
              <b>x${escapeHtml(item.quantity || 1)}</b>
            </article>
          `).join("")}
        </div>
      ` : `<div class="admin-empty compact">Este consumo se cargo solo por monto.</div>`}
    </div>
    <div class="customer-detail-block">
      <h3>Trazabilidad</h3>
      <dl class="activity-detail-list">
        ${detailRows([
          { label: "ID interno", value: event.id },
          { label: "Request ID", value: event.request_id || "Sin dato" },
          { label: "QR usado", value: event.qr_id || "Sin dato" },
          { label: "Fecha exacta", value: formatFullDateTime(event.created_at) || "Sin dato" },
          { label: "Cliente", value: profile?.email || profile?.name || "Sin dato" },
          { label: "Nota interna", value: note || "Sin observacion" },
          { label: "Rol al cargar", value: event.staff_role_at_recording || "Sin dato" },
          { label: "Revision staff", value: event.staff_review_status || "Sin dato" },
          { label: "Total diario staff", value: event.staff_daily_total_after ? formatCurrency(event.staff_daily_total_after) : "Sin dato" },
          { label: "Cargas diarias staff", value: event.staff_daily_count_after || "Sin dato" }
        ])}
      </dl>
    </div>
    <div class="customer-detail-block">
      <h3>Historial de correcciones</h3>
      ${consumptionCorrectionHistoryMarkup(event.id)}
    </div>
    <div class="customer-detail-block">
      <h3>Corregir consumo</h3>
      ${consumptionCorrectionFormMarkup(event)}
    </div>
    <div class="customer-detail-actions">
      <button class="primary" type="button" data-customer-action="consume" data-customer-id="${escapeAttribute(event.customer_id)}">Cargar otro consumo</button>
      <button class="outline" type="button" data-activity-action="view-customer" data-customer-id="${escapeAttribute(event.customer_id)}">Ver cliente</button>
      ${status === "confirmed" ? `<button class="outline danger" type="button" data-consumption-action="cancel" data-consumption-id="${escapeAttribute(event.id)}">Cancelar consumo</button>` : ""}
    </div>
  `;
}

async function cancelConsumption(consumptionId) {
  const event = purchaseEvents().find((item) => item.id === consumptionId);
  if (!event) return;
  if (!window.confirm("Cancelar este consumo y descontar los puntos generados?")) return;
  if (!supabase || !isOwner()) {
    showToast("Solo owner puede cancelar consumos.");
    return;
  }
  const { data, error } = await supabase.rpc("cancel_customer_consumption", {
    target_business_id: businessId,
    target_event_id: consumptionId
  });
  if (error) {
    showToast(displayError(error));
    return;
  }
  const updatedEvent = data?.event;
  if (updatedEvent) Object.assign(event, updatedEvent);
  currentAdminData.loaded = false;
  currentAdminData.remoteLoaded = false;
  await ensureAdminData();
  renderAdminPanel();
  activeAdminConsumptionId = consumptionId;
  renderAdminConsumptionDetail();
  showToast("Consumo cancelado y puntos descontados.");
}

async function correctConsumption(consumptionId, trigger = null) {
  const event = purchaseEvents().find((item) => item.id === consumptionId);
  if (!event) return;
  if (!supabase || !isOwner()) {
    showToast("Solo owner puede corregir consumos.");
    return;
  }
  const correctionField = (attribute) => [...(adminConsumptionDetailPanel?.querySelectorAll(`[${attribute}]`) || [])]
    .find((element) => element.getAttribute(attribute) === consumptionId);
  const totalInput = correctionField("data-consumption-correction-total");
  const categoryInput = correctionField("data-consumption-correction-category");
  const noteInput = correctionField("data-consumption-correction-note");
  const reasonInput = correctionField("data-consumption-correction-reason");
  const nextTotal = Number(totalInput?.value || 0);
  const reason = String(reasonInput?.value || "").trim();
  if (nextTotal <= 0) {
    showToast("Carga un monto corregido mayor a cero.");
    totalInput?.focus();
    return;
  }
  if (!reason) {
    showToast("Agrega un motivo de correccion.");
    reasonInput?.focus();
    return;
  }
  if (trigger) trigger.disabled = true;
  try {
    const { data, error } = await supabase.rpc("correct_customer_consumption", {
      target_business_id: businessId,
      target_event_id: consumptionId,
      next_purchase_total: nextTotal,
      next_purchase_items: parsePurchaseItems(event),
      next_purchase_category: categoryInput?.value || null,
      next_purchase_note: noteInput?.value?.trim() || null,
      correction_note: reason
    });
    if (error) throw error;

    const updatedEvent = data?.event || null;
    const updatedAccount = data?.account || null;
    const adjustmentEvent = data?.adjustmentEvent || null;
    const correction = data?.correction || null;
    if (updatedEvent?.id) {
      const localEvent = currentAdminData.events.find((item) => item.id === updatedEvent.id);
      if (localEvent) Object.assign(localEvent, updatedEvent);
    }
    if (adjustmentEvent?.id) {
      currentAdminData.events = [adjustmentEvent, ...currentAdminData.events.filter((item) => item.id !== adjustmentEvent.id)];
    }
    if (updatedAccount?.id) {
      const localAccount = currentAdminData.accounts.find((item) => item.id === updatedAccount.id);
      if (localAccount) Object.assign(localAccount, updatedAccount);
      if (currentCustomer?.account?.id === updatedAccount.id) {
        currentCustomer.account = { ...currentCustomer.account, ...updatedAccount };
        pointsBalance = updatedAccount.points_balance || 0;
      }
    }
    if (correction?.id) {
      currentAdminData.consumptionCorrections = [
        correction,
        ...(currentAdminData.consumptionCorrections || []).filter((item) => item.id !== correction.id)
      ];
    }
    currentAdminData.loaded = false;
    currentAdminData.remoteLoaded = false;
    await ensureAdminData();
    activeAdminConsumptionId = consumptionId;
    renderAdminPanel();
    renderAdminConsumptionDetail();
    renderLoyalty();
    showToast("Consumo corregido y saldo actualizado.");
  } catch (error) {
    showToast(displayError(error));
  } finally {
    if (trigger) trigger.disabled = false;
  }
}

function openAdminConsumptionDetail(consumptionId) {
  activeAdminConsumptionId = consumptionId || "";
  renderAdminConsumptions();
  renderAdminConsumptionDetail();
}

function closeAdminConsumptionDetail() {
  activeAdminConsumptionId = "";
  renderAdminConsumptions();
  renderAdminConsumptionDetail();
}

function resetAdminConsumptionFilters() {
  [
    adminConsumptionDateFromFilter,
    adminConsumptionDateToFilter,
    adminConsumptionClientFilter,
    adminConsumptionMinFilter,
    adminConsumptionMaxFilter,
    adminConsumptionProductFilter,
    adminConsumptionNoteFilter
  ].forEach((filter) => {
    if (filter) filter.value = "";
  });
  [
    adminConsumptionCategoryFilter,
    adminConsumptionEmployeeFilter,
    adminConsumptionMethodFilter,
    adminConsumptionStatusFilter
  ].forEach((filter) => {
    if (filter) filter.value = "all";
  });
  renderAdminConsumptions();
}

function parsePurchaseItems(event) {
  if (Array.isArray(event.purchase_items)) return event.purchase_items;
  if (typeof event.purchase_items === "string") {
    try {
      const parsed = JSON.parse(event.purchase_items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function dishById(dishId) {
  return menuItems.find((dish) => dish.id === dishId);
}

function addRankValue(map, key, label, amount = 1, extra = {}) {
  if (!key) return;
  const current = map.get(key) || { key, label, value: 0, ...extra };
  current.value += amount;
  map.set(key, { ...current, ...extra, label: current.label || label });
}

function sortedRank(map, direction = "desc") {
  return [...map.values()].sort((a, b) => direction === "asc" ? a.value - b.value : b.value - a.value);
}

function operationalCustomerStatus(profile = {}) {
  const status = String(profile.status || "active").toLowerCase();
  if (status === "blocked") return { label: "Bloqueado", tone: "bad", operational: "blocked" };
  if (status === "deleted") return { label: "Eliminado", tone: "bad", operational: "deleted" };
  if (status === "incomplete") return { label: "Sin completar", tone: "neutral", operational: "incomplete" };
  return null;
}

const customerOperationalStatusOptions = [
  { value: "active", label: "Activo" },
  { value: "incomplete", label: "Sin completar" },
  { value: "blocked", label: "Bloqueado" },
  { value: "deleted", label: "Eliminado" }
];

function customerOperationalStatusValue(profile = {}) {
  const value = String(profile.status || "active").toLowerCase();
  return customerOperationalStatusOptions.some((option) => option.value === value) ? value : "active";
}

function customerStatus(lastVisit, profile = {}) {
  const operationalStatus = operationalCustomerStatus(profile);
  if (operationalStatus) return operationalStatus;
  if (!lastVisit) return { label: "Sin visitas", tone: "neutral" };
  const days = (Date.now() - new Date(lastVisit).getTime()) / 86400000;
  if (days <= 30) return { label: "Activo", tone: "good" };
  if (days <= 60) return { label: "En riesgo", tone: "warn" };
  return { label: "Inactivo", tone: "bad" };
}

function buildCustomerAnalytics(purchases) {
  const purchasesByCustomer = new Map();
  purchases.forEach((event) => {
    if (!event.customer_id) return;
    if (consumptionStatus(event) === "cancelled") return;
    const list = purchasesByCustomer.get(event.customer_id) || [];
    list.push(event);
    purchasesByCustomer.set(event.customer_id, list);
  });

  return currentAdminData.customers.map((profile) => {
    const account = accountForCustomer(profile.id);
    const customerPurchases = purchasesByCustomer.get(profile.id) || [];
    const totalSpent = customerPurchases.reduce((sum, event) => sum + Number(event.purchase_total || 0), 0);
    const lastVisit = customerPurchases
      .map((event) => event.created_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || "";
    const itemMap = new Map();
    customerPurchases.forEach((event) => {
      parsePurchaseItems(event).forEach((item) => {
        addRankValue(itemMap, item.dishId || item.name, item.name || "Producto", Number(item.quantity || 1));
      });
    });
    const favorite = sortedRank(itemMap)[0];
    return {
      profile,
      account,
      visits: customerPurchases.length,
      totalSpent,
      averageTicket: customerPurchases.length ? totalSpent / customerPurchases.length : 0,
      lastVisit,
      streak: weeklyStreakForEvents(customerPurchases),
      favoriteProduct: favorite?.label || "",
      status: customerStatus(lastVisit, profile)
    };
  });
}

function contentCreatedAt(asset) {
  return asset.createdAt || asset.created_at || asset.created || asset.updatedAt || "";
}

function contentDishId(asset) {
  return asset.dishId || asset.dish_id || asset.menuItemId || "";
}

function buildContentImpact(purchases) {
  return dedupeLibraryItems(generatedContentLibrary)
    .map((asset) => {
      const createdAt = contentCreatedAt(asset);
      const dishId = contentDishId(asset);
      if (!createdAt || !dishId) return null;
      const createdTime = new Date(createdAt).getTime();
      if (!Number.isFinite(createdTime)) return null;
      const beforeStart = createdTime - 7 * 86400000;
      const afterEnd = createdTime + 7 * 86400000;
      let before = 0;
      let after = 0;
      purchases.forEach((event) => {
        const eventTime = new Date(event.created_at).getTime();
        if (!Number.isFinite(eventTime)) return;
        const quantity = parsePurchaseItems(event)
          .filter((item) => item.dishId === dishId)
          .reduce((sum, item) => sum + Number(item.quantity || 1), 0);
        if (!quantity) return;
        if (eventTime >= beforeStart && eventTime < createdTime) before += quantity;
        if (eventTime >= createdTime && eventTime <= afterEnd) after += quantity;
      });
      const delta = before ? Math.round(((after - before) / before) * 100) : after > 0 ? 100 : 0;
      return {
        id: asset.id,
        dishId,
        label: asset.dishName || dishById(dishId)?.name || "Pieza de contenido",
        format: contentTypes.find((type) => type.id === asset.type)?.platform || asset.format || "Post",
        before,
        after,
        delta,
        createdAt
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function buildAnalyticsModel() {
  const purchases = purchaseEvents();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = now.getTime() - 30 * 86400000;
  const revenue = purchases.reduce((sum, event) => sum + Number(event.purchase_total || 0), 0);
  const pointsIssued = currentAdminData.events
    .filter((event) => Number(event.points_delta || 0) > 0)
    .reduce((sum, event) => sum + Number(event.points_delta || 0), 0);
  const customerStats = buildCustomerAnalytics(purchases);
  const activeCustomers = customerStats.filter((customer) => customer.lastVisit && new Date(customer.lastVisit).getTime() >= thirtyDaysAgo);
  const riskCustomers = customerStats.filter((customer) => customer.status.tone === "warn");
  const inactiveCustomers = customerStats.filter((customer) => customer.status.tone === "bad");
  const newCustomersThisMonth = currentAdminData.customers.filter((customer) => new Date(customer.created_at) >= monthStart);
  const pendingRedemptions = currentAdminData.redemptions.filter(redemptionIsActionableRequest);

  const productMap = new Map();
  const categoryMap = new Map();
  purchases.forEach((event) => {
    parsePurchaseItems(event).forEach((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const dish = dishById(item.dishId);
      const productKey = item.dishId || item.name;
      addRankValue(productMap, productKey, item.name || dish?.name || "Producto", quantity, {
        dishId: item.dishId || "",
        category: dish?.category || "Sin categoria"
      });
      addRankValue(categoryMap, dish?.category || "Sin categoria", dish?.category || "Sin categoria", quantity);
    });
  });

  const consumedProducts = sortedRank(productMap);
  const consumedById = new Map(consumedProducts.map((item) => [item.dishId || item.key, item.value]));
  const lowConsumptionProducts = menuItems
    .filter(isDishVisible)
    .map((dish) => ({
      key: dish.id,
      dishId: dish.id,
      label: dish.name,
      value: consumedById.get(dish.id) || 0,
      category: dish.category
    }))
    .sort((a, b) => a.value - b.value || a.label.localeCompare(b.label));

  const rewardMap = new Map();
  currentAdminData.redemptions.forEach((redemption) => {
    addRankValue(rewardMap, redemption.reward_id || redemption.reward_name, redemption.reward_name || "Premio", 1, {
      status: redemption.status
    });
  });

  const menuEvents = currentAdminData.menuEvents || [];
  const menuViews = menuEvents.filter((event) => event.event_type === "menu_view");
  const detailViews = menuEvents.filter((event) => event.event_type === "dish_detail_view");
  const signupStarts = menuEvents.filter((event) => event.event_type === "signup_start");
  const signupCompletes = menuEvents.filter((event) => event.event_type === "signup_complete");
  const detailViewMap = new Map();
  detailViews.forEach((event) => {
    const dish = dishById(event.dish_id);
    addRankValue(detailViewMap, event.dish_id, dish?.name || event.dish_id || "Producto", 1, {
      dishId: event.dish_id
    });
  });
  const detailViewRank = sortedRank(detailViewMap);
  const productConversions = detailViewRank.map((item) => {
    const purchasesForDish = consumedById.get(item.dishId) || 0;
    return {
      ...item,
      purchases: purchasesForDish,
      conversion: item.value ? purchasesForDish / item.value : 0
    };
  });
  const opportunity = productConversions
    .filter((item) => item.value >= 2)
    .sort((a, b) => a.conversion - b.conversion || b.value - a.value)[0]
    || lowConsumptionProducts.find((item) => item.value === 0)
    || null;

  return {
    purchases,
    revenue,
    averageTicket: purchases.length ? revenue / purchases.length : 0,
    pointsIssued,
    customerStats,
    activeCustomers,
    riskCustomers,
    inactiveCustomers,
    newCustomersThisMonth,
    pendingRedemptions,
    consumedProducts,
    lowConsumptionProducts,
    categories: sortedRank(categoryMap),
    topCustomers: [...customerStats].sort((a, b) => b.totalSpent - a.totalSpent || b.visits - a.visits),
    rewards: sortedRank(rewardMap),
    contentImpact: buildContentImpact(purchases),
    menu: {
      events: menuEvents,
      menuViews,
      detailViews,
      signupStarts,
      signupCompletes,
      detailViewRank,
      productConversions,
      signupConversion: menuViews.length ? signupCompletes.length / menuViews.length : 0
    },
    opportunity
  };
}

function analyticsEmpty(title, body, action = "") {
  return `
    <div class="analytics-empty">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
      ${action}
    </div>
  `;
}

function analyticsActionButton(label, action, extraAttributes = "") {
  return `<button class="ghost compact" type="button" data-analytics-action="${escapeAttribute(action)}" ${extraAttributes}>${escapeHtml(label)}</button>`;
}

function renderAnalyticsRank(items, options = {}) {
  const list = (items || []).slice(0, options.limit || 5);
  if (!list.length) return analyticsEmpty(options.emptyTitle || "Sin datos todavia", options.emptyBody || "Los datos aparecen cuando el equipo usa el flujo.");
  const max = Math.max(...list.map((item) => Number(item.value || 0)), 1);
  return `
    <div class="analytics-rank-list">
      ${list.map((item, index) => {
        const percent = Math.max(4, Math.round((Number(item.value || 0) / max) * 100));
        const meta = options.meta ? options.meta(item) : "";
        const action = options.action ? options.action(item) : "";
        return `
          <article class="analytics-rank-row">
            <span class="analytics-rank-number">${index + 1}</span>
            <span class="analytics-rank-copy">
              <strong>${escapeHtml(item.label)}</strong>
              ${meta ? `<small>${meta}</small>` : ""}
              <i style="--bar:${percent}%"></i>
            </span>
            <b>${escapeHtml(options.value ? options.value(item) : item.value)}</b>
            ${action}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderAnalyticsTable(rows, options = {}) {
  const list = (rows || []).slice(0, options.limit || 6);
  if (!list.length) return analyticsEmpty(options.emptyTitle || "Sin filas para mostrar", options.emptyBody || "Cuando haya actividad real, aparece aca.");
  const columns = options.columns || [];
  const template = columns.map((column, index) => column.width || (index === 0 ? "minmax(180px, 1.2fr)" : "minmax(90px, 0.8fr)")).join(" ");
  return `
    <div class="analytics-table" role="table" style="--analytics-columns:${escapeAttribute(template)}">
      <div class="analytics-table-head" role="row">
        ${columns.map((column) => `<span role="columnheader">${escapeHtml(column.label)}</span>`).join("")}
      </div>
      ${list.map((row) => `
        <div class="analytics-table-row" role="row">
          ${columns.map((column) => `<span role="cell">${column.render(row)}</span>`).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function conversionPercent(value) {
  if (!Number.isFinite(Number(value))) return "0%";
  return `${Math.round(Number(value) * 100)}%`;
}

function conversionTone(item) {
  if (!item.value) return "neutral";
  if (item.conversion >= 0.35) return "good";
  if (item.conversion >= 0.12) return "warn";
  return "bad";
}

function renderHomeInsights(model) {
  if (!homeInsightGrid) return;
  const hasMenuTracking = model.menu.events.length > 0;
  const opportunity = model.opportunity;
  const conversionRows = [...model.menu.productConversions]
    .sort((a, b) => b.value - a.value || a.conversion - b.conversion)
    .slice(0, 6);
  const riskRows = model.riskCustomers.slice(0, 5);
  const opportunityBody = opportunity
    ? `
      <div class="analytics-opportunity">
        <span class="analytics-status is-${escapeAttribute(opportunity.value > 0 ? conversionTone(opportunity) : "warn")}">
          ${escapeHtml(opportunity.value > 0 ? "Visto, pero vende poco" : "Sin consumos")}
        </span>
        <strong>${escapeHtml(opportunity.label)}</strong>
        <small>${escapeHtml(opportunity.value > 0
          ? `${opportunity.value} vistas · ${opportunity.purchases || 0} compras · ${conversionPercent(opportunity.conversion)} conversion`
          : `Producto visible sin consumos registrados · ${opportunity.category || "Sin categoria"}`)}</small>
        ${analyticsActionButton("Crear promocion", "content", opportunity.dishId ? `data-dish-id="${escapeAttribute(opportunity.dishId)}"` : "")}
      </div>
    `
    : analyticsEmpty("Sin oportunidad clara", "Cuando haya vistas o consumos, Sumi va a sugerir que producto empujar.", analyticsActionButton("Crear contenido", "content"));

  homeInsightGrid.innerHTML = `
    <section class="analytics-panel analytics-panel-wide">
      <div class="admin-card-head">
        <div>
          <h2>Menu digital</h2>
          <p>Vistas del menu, productos consultados y compras cargadas.</p>
        </div>
        ${analyticsActionButton("Ver menu", "menu")}
      </div>
      ${hasMenuTracking ? renderAnalyticsTable(conversionRows, {
        limit: 6,
        emptyTitle: "Todavia no hay vistas de productos",
        emptyBody: "Cuando los clientes abran detalles del menu, se compara contra compras cargadas.",
        columns: [
          { label: "Producto", width: "minmax(180px, 1.5fr)", render: (row) => `<strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(dishById(row.dishId)?.category || "Sin categoria")}</small>` },
          { label: "Vistas", render: (row) => escapeHtml(row.value) },
          { label: "Compras", render: (row) => escapeHtml(row.purchases || 0) },
          { label: "Conversion", render: (row) => `<span class="analytics-status is-${escapeAttribute(conversionTone(row))}">${escapeHtml(conversionPercent(row.conversion))}</span>` }
        ]
      }) : analyticsEmpty("Sin tracking de menu aun", "Abre el menu publico y detalles de productos para empezar a medir interes.", analyticsActionButton("Abrir menu", "public-menu"))}
    </section>

    <section class="analytics-panel">
      <div class="admin-card-head">
        <div>
          <h2>Oportunidad</h2>
          <p>Que conviene empujar ahora.</p>
        </div>
      </div>
      ${opportunityBody}
    </section>

    <section class="analytics-panel">
      <div class="admin-card-head">
        <div>
          <h2>Clientes en riesgo</h2>
          <p>Clientes que conviene recuperar.</p>
        </div>
        ${analyticsActionButton("Ver clientes", "customers")}
      </div>
      ${riskRows.length ? renderAnalyticsRank(riskRows.map((customer) => ({
        label: customer.profile?.name || customer.profile?.email || "Cliente",
        value: customer.lastVisit ? Math.max(1, Math.floor((Date.now() - new Date(customer.lastVisit).getTime()) / 86400000)) : 0,
        visits: customer.visits,
        totalSpent: customer.totalSpent,
        status: customer.status?.label
      })), {
        limit: 5,
        meta: (item) => `${item.visits} visitas · ${formatCurrency(item.totalSpent)} gastados · ${item.status}`,
        value: (item) => `${item.value} d`
      }) : analyticsEmpty("Sin clientes en riesgo", "Cuando alguien deje de venir 31 dias o mas, aparece aca.", analyticsActionButton("Ver clientes", "customers"))}
    </section>
  `;
}

function isToday(dateValue) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function timeLabel(dateValue) {
  if (!dateValue) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(dateValue));
  } catch {
    return "";
  }
}

function customerName(customerId) {
  return currentAdminData.customers.find((profile) => profile.id === customerId)?.name || "Cliente";
}

function customerProfile(customerId) {
  return currentAdminData.customers.find((profile) => profile.id === customerId) || null;
}

function customerAnalytics(customerId) {
  const events = eventsForCustomer(customerId).filter((event) => event.event_type === "purchase");
  const totalSpent = events.reduce((sum, event) => sum + Number(event.purchase_total || 0), 0);
  const sortedVisits = [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const account = accountForCustomer(customerId);
  return {
    account,
    visits: events.length,
    totalSpent,
    averageTicket: events.length ? totalSpent / events.length : 0,
    lastVisit: sortedVisits[0]?.created_at || "",
    previousVisit: sortedVisits[1]?.created_at || ""
  };
}

function shortUserId(value) {
  return value ? String(value).slice(0, 8) : "No registrado";
}

function recentHomeActivity(model) {
  const purchases = model.purchases.slice(0, 5).map((event) => ({
    id: `purchase:${event.id}`,
    kind: "purchase",
    sourceId: event.id,
    type: "Consumo",
    title: `${customerName(event.customer_id)} - ${formatCurrency(event.purchase_total)}`,
    meta: `${timeLabel(event.created_at)} - +${event.points_delta || 0} pts`,
    date: event.created_at
  }));
  const redemptions = currentAdminData.redemptions.slice(0, 5).map((redemption) => ({
    id: `redemption:${redemption.id}`,
    kind: "redemption",
    sourceId: redemption.id,
    type: redemptionIsActionableRequest(redemption) ? "Canje pendiente" : "Canje",
    title: `${customerName(redemption.customer_id)} - ${redemption.reward_name}`,
    meta: `${timeLabel(redemption.created_at)} - ${redemption.status} - ${((currentAdminData.redemptionEvents || []).find((event) => event.redemption_id === redemption.id)?.actor_label || "No disponible")}`,
    date: redemption.created_at
  }));
  const signups = currentAdminData.customers.slice(0, 5).map((profile) => ({
    id: `signup:${profile.id}`,
    kind: "signup",
    sourceId: profile.id,
    type: "Registro",
    title: profile.name || profile.email || "Nuevo cliente",
    meta: `${timeLabel(profile.created_at)} - cliente nuevo`,
    date: profile.created_at
  }));
  return [...purchases, ...redemptions, ...signups]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);
}

function detailRows(rows) {
  return `
    <dl class="activity-detail-list">
      ${rows
        .filter((row) => row.value !== undefined && row.value !== null && row.value !== "")
        .map((row) => `
          <div>
            <dt>${escapeHtml(row.label)}</dt>
            <dd>${row.html ? row.value : escapeHtml(row.value)}</dd>
          </div>
        `)
        .join("")}
    </dl>
  `;
}

function activityTrace({ id, createdAt, actor, origin }) {
  return `
    <section class="activity-detail-section">
      <h2>Trazabilidad</h2>
      ${detailRows([
        { label: "ID interno", value: id || "No disponible" },
        { label: "Fecha exacta", value: formatFullDateTime(createdAt) || "No disponible" },
        { label: "Responsable", value: actor || "No registrado" },
        { label: "Origen", value: origin || "Panel Sumi" }
      ])}
    </section>
  `;
}

function activityCustomerSummary(customerId) {
  const profile = customerProfile(customerId);
  const analytics = customerAnalytics(customerId);
  return `
    <section class="activity-detail-section">
      <h2>Cliente</h2>
      ${detailRows([
        { label: "Nombre", value: profile?.name || "Cliente" },
        { label: "Email", value: profile?.email || "No disponible" },
        { label: "Puntos actuales", value: `${analytics.account?.points_balance ?? 0} pts` },
        { label: "Nivel", value: tierLabel(analytics.account?.tier || "bronze") },
        { label: "Visitas registradas", value: analytics.visits },
        { label: "Ticket promedio", value: analytics.averageTicket ? formatCurrency(analytics.averageTicket) : "Sin consumos" },
        { label: "Ultima visita anterior", value: analytics.previousVisit ? formatFullDateTime(analytics.previousVisit) : "No disponible" }
      ])}
    </section>
  `;
}

function purchaseActivityDetail(event) {
  const items = parsePurchaseItems(event);
  const itemText = items.length
    ? items.map((item) => `${item.quantity || 1}x ${item.name}${item.presentationName ? ` (${item.presentationName})` : ""}`).join(", ")
    : "No se cargaron productos";
  return {
    kicker: "Consumo",
    title: `${customerName(event.customer_id)} · ${formatCurrency(event.purchase_total)}`,
    body: `
      <section class="activity-summary-card">
        <span>Monto cargado</span>
        <strong>${escapeHtml(formatCurrency(event.purchase_total))}</strong>
        <small>${escapeHtml(`+${event.points_delta || 0} pts otorgados`)}</small>
      </section>
      <section class="activity-detail-section">
        <h2>Detalle del consumo</h2>
        ${detailRows([
          { label: "Productos", value: itemText },
          { label: "Metodo de carga", value: event.qr_id ? "QR de cliente" : "Carga de caja" },
          { label: "Regla aplicada", value: event.earn_rate ? `${Math.round(Number(event.earn_rate) * 100)}% del monto` : "Regla vigente del negocio" },
          { label: "Request ID", value: event.request_id || "No disponible" }
        ])}
      </section>
      ${activityCustomerSummary(event.customer_id)}
      ${activityTrace({
        id: event.id,
        createdAt: event.created_at,
        actor: event.recorded_by_auth_user_id ? `Usuario ${shortUserId(event.recorded_by_auth_user_id)}` : "No registrado",
        origin: event.qr_id ? "Escaneo QR / caja" : "Panel admin"
      })}
      <div class="activity-detail-actions">
        <button class="primary" type="button" data-activity-action="view-customer" data-customer-id="${escapeAttribute(event.customer_id)}">Ver cliente</button>
        <button class="outline" type="button" data-activity-action="load-consumption">Cargar otro consumo</button>
      </div>
    `
  };
}

function signupActivityDetail(profile) {
  const analytics = customerAnalytics(profile.id);
  return {
    kicker: "Registro",
    title: `${profile.name || "Nuevo cliente"} · cliente nuevo`,
    body: `
      <section class="activity-summary-card">
        <span>Nuevo cliente</span>
        <strong>${escapeHtml(profile.name || "Cliente")}</strong>
        <small>${escapeHtml(formatFullDateTime(profile.created_at))}</small>
      </section>
      <section class="activity-detail-section">
        <h2>Datos del registro</h2>
        ${detailRows([
          { label: "Email", value: profile.email || "No disponible" },
          { label: "Canal", value: "Menu digital / registro publico" },
          { label: "Puntos de bienvenida", value: `${analytics.account?.points_balance ?? 0} pts actuales` },
          { label: "QR visible", value: shortQrAlias(profile, analytics.account) }
        ])}
      </section>
      ${activityCustomerSummary(profile.id)}
      ${activityTrace({
        id: profile.id,
        createdAt: profile.created_at,
        actor: "Cliente",
        origin: "Registro publico"
      })}
      <div class="activity-detail-actions">
        <button class="primary" type="button" data-activity-action="view-customer" data-customer-id="${escapeAttribute(profile.id)}">Ver cliente</button>
        <button class="outline" type="button" data-activity-action="load-consumption">Cargar consumo</button>
      </div>
    `
  };
}

function redemptionActivityDetail(redemption) {
  const requested = redemptionIsActionableRequest(redemption);
  const approved = redemption.status === "approved";
  const expiresAt = redemption.requested_expires_at ? formatFullDateTime(redemption.requested_expires_at) : "";
  const history = (currentAdminData.redemptionEvents || [])
    .filter((event) => event.redemption_id === redemption.id)
    .sort((a, b) => new Date(a.occurred_at || 0) - new Date(b.occurred_at || 0));
  const latestEvent = history[history.length - 1];
  return {
    kicker: "Canje",
    title: `${customerName(redemption.customer_id)} · ${redemption.reward_name}`,
    body: `
      <section class="activity-summary-card">
        <span>Premio</span>
        <strong>${escapeHtml(redemption.reward_name)}</strong>
        <small>${escapeHtml(`${redemption.points_cost} pts · ${redemption.status}`)}</small>
      </section>
      <section class="activity-detail-section">
        <h2>Detalle del canje</h2>
        ${detailRows([
          { label: "Estado", value: redemptionDisplayStatusLabel(redemption) },
          { label: "Costo", value: `${redemption.points_cost} pts` },
          { label: "Premio ID", value: redemption.reward_id },
          { label: "Solicitado", value: formatFullDateTime(redemption.created_at) },
          { label: redemptionIsExpired(redemption) ? "Vencio" : "Vence", value: expiresAt || "Sin vencimiento" }
        ])}
      </section>
      ${activityCustomerSummary(redemption.customer_id)}
      <section class="activity-detail-section">
        <h2>Historial de transiciones</h2>
        ${history.length ? `<div class="redemption-history-list">${history.map((event) => `
          <div class="redemption-history-row"><strong>${escapeHtml(event.from_status ? `${redemptionStatusLabel(event.from_status)} → ` : "")}${escapeHtml(redemptionStatusLabel(event.to_status))}</strong><small>${escapeHtml(event.actor_label || "No disponible")} · ${escapeHtml(event.actor_role || "unknown")} · ${escapeHtml(formatFullDateTime(event.occurred_at) || "No disponible")}</small></div>
        `).join("")}</div>` : `<p class="cell-muted">No disponible para este registro histórico.</p>`}
      </section>
      ${activityTrace({
        id: redemption.id,
        createdAt: redemption.created_at,
        actor: latestEvent ? `${latestEvent.actor_label || "No disponible"} (${latestEvent.actor_role || "unknown"})` : "No disponible",
        origin: latestEvent ? "Transición auditada" : "Solicitud de premio"
      })}
      <div class="activity-detail-actions">
        ${requested ? `<button class="primary" type="button" data-redemption-action="approved" data-redemption-id="${escapeAttribute(redemption.id)}">Aprobar</button>` : ""}
        ${approved ? `<button class="primary" type="button" data-redemption-action="redeemed" data-redemption-id="${escapeAttribute(redemption.id)}">Marcar entregado</button>` : ""}
        ${(isOwner() || isManager()) && redemption.status !== "cancelled" && redemption.status !== "redeemed" ? `<button class="outline danger" type="button" data-redemption-action="cancelled" data-redemption-id="${escapeAttribute(redemption.id)}">Rechazar</button>` : ""}
        <button class="outline" type="button" data-activity-action="view-customer" data-customer-id="${escapeAttribute(redemption.customer_id)}">Ver cliente</button>
      </div>
    `
  };
}

function activityDetail(activityId) {
  const item = homeRecentActivityItems.find((activity) => activity.id === activityId);
  if (!item) return null;
  if (item.kind === "purchase") {
    const event = currentAdminData.events.find((entry) => entry.id === item.sourceId);
    return event ? purchaseActivityDetail(event) : null;
  }
  if (item.kind === "redemption") {
    const redemption = currentAdminData.redemptions.find((entry) => entry.id === item.sourceId);
    return redemption ? redemptionActivityDetail(redemption) : null;
  }
  if (item.kind === "signup") {
    const profile = currentAdminData.customers.find((entry) => entry.id === item.sourceId);
    return profile ? signupActivityDetail(profile) : null;
  }
  return null;
}

function openActivityDrawer(activityId) {
  const detail = activityDetail(activityId);
  if (!detail || !activityDrawer) return;
  activeActivityId = activityId;
  activityDrawerKicker.textContent = detail.kicker;
  activityDrawerTitle.textContent = detail.title;
  activityDrawerBody.innerHTML = detail.body;
  activityDrawer.hidden = false;
  document.body.classList.add("activity-open");
  window.requestAnimationFrame(() => activityDrawerClose.focus());
}

function closeActivityDrawer() {
  if (!activityDrawer) return;
  activeActivityId = "";
  activityDrawer.hidden = true;
  document.body.classList.remove("activity-open");
}

function renderAdminAnalytics() {
  if (!analyticsKpiGrid) return;
  if (currentAdminData.error) {
    setLoadingState(analyticsKpiGrid, false);
    analyticsKpiGrid.innerHTML = adminDataErrorMarkup("No se pudo cargar el inicio");
    analyticsActionStrip.innerHTML = "";
    homeUrgentPanel.innerHTML = "";
    homeRecentPanel.innerHTML = "";
    if (homeInsightGrid) homeInsightGrid.innerHTML = "";
    return;
  }
  if (supabase && currentSession?.user && canAccessAdmin() && !currentAdminData.remoteLoaded) {
    setLoadingState(analyticsKpiGrid, true);
    analyticsKpiGrid.innerHTML = skeletonCardsMarkup(4, "Cargando indicadores del negocio");
    analyticsActionStrip.innerHTML = "";
    homeUrgentPanel.innerHTML = skeletonRowsMarkup(3, "Cargando tareas urgentes");
    homeRecentPanel.innerHTML = skeletonRowsMarkup(3, "Cargando actividad reciente");
    if (homeInsightGrid) homeInsightGrid.innerHTML = "";
    return;
  }

  setLoadingState(analyticsKpiGrid, false);
  const model = buildAnalyticsModel();
  const todayPurchases = model.purchases.filter((event) => isToday(event.created_at));
  const todayCustomers = currentAdminData.customers.filter((profile) => isToday(profile.created_at));
  const todayPoints = currentAdminData.events
    .filter((event) => isToday(event.created_at) && Number(event.points_delta || 0) > 0)
    .reduce((sum, event) => sum + Number(event.points_delta || 0), 0);
  const todayRevenue = todayPurchases.reduce((sum, event) => sum + Number(event.purchase_total || 0), 0);
  const pendingRedemptions = model.pendingRedemptions
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!pendingRedemptions.length) {
    visibleUrgentRedemptions = urgentRedemptionsPageSize;
  } else if (visibleUrgentRedemptions > pendingRedemptions.length) {
    visibleUrgentRedemptions = Math.max(urgentRedemptionsPageSize, pendingRedemptions.length);
  }
  const visiblePendingRedemptions = pendingRedemptions.slice(0, visibleUrgentRedemptions);
  const hiddenPendingRedemptions = Math.max(0, pendingRedemptions.length - visiblePendingRedemptions.length);
  const recentActivity = recentHomeActivity(model);
  homeRecentActivityItems = recentActivity;
  if (!recentActivity.length) {
    visibleHomeRecentActivity = homeRecentActivityPageSize;
  } else if (visibleHomeRecentActivity > recentActivity.length) {
    visibleHomeRecentActivity = Math.max(homeRecentActivityPageSize, recentActivity.length);
  }
  const visibleRecentActivity = recentActivity.slice(0, visibleHomeRecentActivity);
  const hiddenRecentActivity = Math.max(0, recentActivity.length - visibleRecentActivity.length);

  analyticsKpiGrid.innerHTML = [
    ["Canjes pendientes", pendingRedemptions.length, pendingRedemptions.length ? "requieren aprobacion" : "sin solicitudes abiertas"],
    ["Consumos hoy", todayPurchases.length, `${formatCurrency(todayRevenue)} cargados`],
    ["Clientes nuevos hoy", todayCustomers.length, "registrados desde el menu"],
    ["Puntos hoy", formatNumber(todayPoints), "entregados por actividad"]
  ].map(([label, value, note], index) => `
    <article class="analytics-kpi-card" data-kpi-tone="${index % 4}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `).join("");

  analyticsActionStrip.innerHTML = `
    <button class="analytics-action-card" type="button" data-analytics-action="consumption">
      <span>Accion rapida</span>
      <strong>Cargar consumo</strong>
      <small>Buscar cliente y registrar el consumo manualmente.</small>
    </button>
    <button class="analytics-action-card" type="button" data-analytics-action="scan-customer">
      <span>Accion rapida</span>
      <strong>Escanear QR de cliente</strong>
      <small>Abrir camara para identificar al cliente en caja.</small>
    </button>
    ${isOwner() ? `<button class="analytics-action-card" type="button" data-analytics-action="menu-qr">
      <span>Accion rapida</span>
      <strong>Generar QR del menu</strong>
      <small>Descargar un QR simple para mesa o mostrador.</small>
    </button>
    <button class="analytics-action-card" type="button" data-analytics-action="content">
      <span>Accion rapida</span>
      <strong>Crear promocion</strong>
      <small>Preparar una pieza de contenido para redes.</small>
    </button>` : ""}
    <button class="analytics-action-card" type="button" data-analytics-action="rewards">
      <span>Accion rapida</span>
      <strong>${isOwner() ? "Agregar premio" : "Gestionar canjes"}</strong>
      <small>${isOwner() ? "Ir a premios y canjes de fidelizacion." : "Revisar solicitudes y entregas pendientes."}</small>
    </button>
  `;

  homeUrgentPanel.innerHTML = `
    <div class="admin-card-head">
      <div>
        <h2>Necesita atencion</h2>
        <p>Solo lo que conviene resolver ahora. ${adminLiveSyncMarkup()}</p>
      </div>
      ${analyticsActionButton("Ver premios", "rewards")}
    </div>
    ${pendingRedemptions.length ? `
      <div class="home-urgent-list">
        ${visiblePendingRedemptions.map((redemption) => `
          <article class="home-urgent-row">
            <span>
              <strong>${escapeHtml(customerName(redemption.customer_id))}</strong>
              <small>${escapeHtml(redemption.reward_name)} - ${escapeHtml(timeLabel(redemption.created_at))}</small>
            </span>
            <b>${escapeHtml(redemption.points_cost || redemption.reward_cost || "")}${redemption.points_cost || redemption.reward_cost ? " pts" : ""}</b>
            <span class="redemption-actions">
              <button class="mini-action" type="button" data-redemption-action="approved" data-redemption-id="${escapeAttribute(redemption.id)}">Aprobar</button>
              <button class="mini-action danger" type="button" data-redemption-action="cancelled" data-redemption-id="${escapeAttribute(redemption.id)}">Rechazar</button>
            </span>
          </article>
        `).join("")}
        ${hiddenPendingRedemptions ? `
          <button class="home-load-more" type="button" data-home-action="more-redemptions">
            Ver mas (${hiddenPendingRedemptions} pendientes)
          </button>
        ` : ""}
      </div>
    ` : analyticsEmpty("Sin urgencias por ahora", "No hay canjes pendientes ni acciones criticas para resolver en este momento.", analyticsActionButton("Cargar consumo", "consumption"))}
  `;

  homeRecentPanel.innerHTML = `
    <div class="admin-card-head">
      <div>
        <h2>Actividad reciente</h2>
        <p>Ultimos consumos, canjes y registros.</p>
      </div>
      ${analyticsActionButton("Ver clientes", "customers")}
    </div>
    ${recentActivity.length ? `
      <div class="home-activity-list">
        ${visibleRecentActivity.map((item) => `
          <button class="home-activity-row" type="button" data-activity-id="${escapeAttribute(item.id)}" aria-label="Abrir detalle de ${escapeAttribute(item.title)}">
            <span>${escapeHtml(item.type)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.meta)}</small>
          </button>
        `).join("")}
        ${hiddenRecentActivity ? `
          <button class="home-load-more" type="button" data-home-action="more-activity">
            Ver mas (${hiddenRecentActivity} registros)
          </button>
        ` : ""}
      </div>
    ` : analyticsEmpty("Todavia no hay actividad", "Cuando entren registros, consumos o canjes, aparecen en este resumen.", analyticsActionButton("Cargar consumo", "consumption"))}
  `;
  renderHomeInsights(model);
}

function renderAiCreditPanel() {
  if (!adminAiCreditPanel) return;
  const monthlyLimit = Number(aiCreditBalance.monthlyLimit || aiMonthlyCreditLimit);
  const remaining = Number(aiCreditBalance.remaining ?? monthlyLimit);
  const used = Math.max(0, monthlyLimit - remaining);
  const usagePercent = monthlyLimit > 0 ? Math.min(100, Math.round((used / monthlyLimit) * 100)) : 0;
  const generationsLeft = Math.floor(remaining / aiGenerationCreditCost);
  const tone = remaining < aiGenerationCreditCost ? "danger" : remaining <= aiLowBalanceWarningThreshold || usagePercent >= 80 ? "warn" : "good";
  const lastEvent = aiCreditEvents[0];
  const lastEventText = lastEvent
    ? `${Math.abs(Number(lastEvent.credits_delta || 0))} creditos - ${lastEvent.reason || "generacion"} - ${relativeTimeLabel(lastEvent.created_at)}`
    : "Sin movimientos este mes";
  adminAiCreditPanel.innerHTML = `
    <article class="ai-credit-summary tone-${tone}">
      <div>
        <span>${escapeHtml(aiCreditPlanName)}</span>
        <strong>${escapeHtml(`${remaining}/${monthlyLimit}`)}</strong>
        <small>${escapeHtml(`${generationsLeft} generaciones disponibles · ${aiGenerationCreditCost} creditos por generacion`)}</small>
      </div>
      <div class="ai-credit-meter" aria-label="${escapeAttribute(`${usagePercent}% usado`)}">
        <span style="width:${usagePercent}%"></span>
      </div>
    </article>
    <article class="ai-credit-detail">
      <span>Uso del mes</span>
      <strong>${escapeHtml(`${used} creditos usados`)}</strong>
      <small>${escapeHtml(`Periodo ${aiCreditBalance.periodMonth || new Date().toISOString().slice(0, 7)}`)}</small>
    </article>
    <article class="ai-credit-detail">
      <span>Ultimo movimiento</span>
      <strong>${escapeHtml(lastEventText)}</strong>
      <small>${escapeHtml(remaining < aiGenerationCreditCost ? "Compra creditos extra o sube el limite mensual." : "El descuento se registra solo si la IA inicia correctamente.")}</small>
    </article>
  `;
}

function renderAdminContent() {
  if (!adminContentRows || !adminContentPreview || !adminContentDishSelect || !adminContentTypeSelect) return;
  if (adminContentDataLoading) {
    setLoadingState(adminContentRows, true);
    setLoadingState(adminContentPreview, true);
    adminContentRows.innerHTML = skeletonRowsMarkup(4, "Cargando contenido del negocio");
    adminContentPreview.innerHTML = `
      <div class="ui-skeleton-preview" role="status" aria-label="Preparando vista previa">
        <span class="ui-skeleton ui-skeleton-asset-media" aria-hidden="true"></span>
        <span class="ui-skeleton ui-skeleton-line is-wide" aria-hidden="true"></span>
        <span class="sr-only">Preparando vista previa</span>
      </div>
    `;
    return;
  }
  setLoadingState(adminContentRows, false);
  setLoadingState(adminContentPreview, false);
  renderAiCreditPanel();
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
  if (adminContentBackgroundMode) adminContentBackgroundMode.value = selectedContentBackgroundMode;
  if (adminContentBackgroundTooltip) {
    const isDynamicBackground = selectedContentBackgroundMode === "dynamic";
    adminContentBackgroundTooltip.dataset.tooltip = isDynamicBackground
      ? "Conserva el producto, pero permite que la IA cambie el ambiente del fondo."
      : "Conserva el producto, el fondo y los objetos. La IA solo añade badges promocionales.";
    adminContentBackgroundTooltip.setAttribute(
      "aria-label",
      `Ayuda sobre el modo de fondo ${isDynamicBackground ? "dinámico" : "estático"}`
    );
  }

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
    const backgroundText = selectedContentBackgroundMode === "static"
      ? " Fondo estatico: se conserva sin cambios."
      : selectedContentBackgroundImage
        ? " Fondo dinamico: la IA puede ambientarlo."
        : " Fondo dinamico: la IA crea solo el ambiente.";
    adminContentReferenceMeta.textContent = `${referenceText}${backgroundText}`;
    adminContentReferenceClear.hidden = !selectedContentReferenceImage;
    if (adminContentBackgroundClear) adminContentBackgroundClear.hidden = !selectedContentBackgroundImage;
  }
  adminContentCount.textContent = draft.variants.length;

  adminToneRow.querySelectorAll("[data-admin-tone]").forEach((button) => {
    const active = button.dataset.adminTone === selectedContentTone;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
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
  if (adminContentDataLoading) {
    if (adminLibraryTitle) adminLibraryTitle.textContent = "Cargando biblioteca";
    if (adminLibrarySubtitle) adminLibrarySubtitle.textContent = "Estamos preparando tus piezas guardadas.";
    if (adminLibraryFilters) adminLibraryFilters.innerHTML = "";
    setLoadingState(adminLibraryGrid, true);
    adminLibraryGrid.innerHTML = skeletonAssetsMarkup();
    return;
  }
  setLoadingState(adminLibraryGrid, false);
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
        <button class="admin-library-filter ui-filter-pill ${adminLibraryFilter === filter.id ? "is-active" : ""}" type="button" data-library-filter="${filter.id}" aria-pressed="${adminLibraryFilter === filter.id ? "true" : "false"}">
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
            <button class="admin-asset-preview ${isVerticalContentAsset(item) ? "is-vertical" : ""}" type="button" data-admin-open-content="${escapeAttribute(item.id)}" aria-label="Abrir pieza de ${escapeAttribute(item.dishName)}">
              <img src="${escapeAttribute(item.imageUrl || item.photo)}" alt="" loading="lazy" decoding="async" />
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

function renderAdminRedemptions() {
  if (!adminRedemptionRows) return;
  const search = adminRedemptionSearch.trim().toLowerCase();
  const total = currentAdminData.redemptions.length;
  const filtered = currentAdminData.redemptions.filter((redemption) => {
    const statusMatches = adminRedemptionStatus === "all" || redemption.status === adminRedemptionStatus;
    if (!statusMatches) return false;
    if (!search) return true;
    const customer = currentAdminData.customers.find((profile) => profile.id === redemption.customer_id);
    const haystack = [customer?.name, customer?.email, redemption.reward_name, redemption.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
  const visible = filtered.slice(0, visibleAdminRedemptions);
  const canCancelRedemptions = isOwner() || isManager();
  const hidden = Math.max(0, filtered.length - visible.length);

  if (adminRedemptionsVisibleCount) {
    adminRedemptionsVisibleCount.textContent = filtered.length === total
      ? `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`
      : `${filtered.length} de ${total} resultados`;
  }
  if (!filtered.length) {
    adminRedemptionRows.innerHTML = `<div class="admin-empty">No hay canjes que coincidan con este filtro.</div>`;
    return;
  }

  adminRedemptionRows.innerHTML = `${visible.map((redemption) => {
    const customer = currentAdminData.customers.find((profile) => profile.id === redemption.customer_id);
    const requested = redemptionIsActionableRequest(redemption);
    const approved = redemption.status === "approved";
    return `
      <article class="admin-list-row admin-redemption-row">
        <span>
          <strong>${escapeHtml(redemption.reward_name)}</strong>
          <small>${escapeHtml(customer?.name || "Cliente")} &middot; ${escapeHtml(formatEventDate(redemption.created_at))}</small>
        </span>
        <span class="status">${escapeHtml(redemptionDisplayStatusLabel(redemption))}</span>
        <span class="redemption-actions">
          <button class="mini-action" type="button" data-redemption-action="approved" data-redemption-id="${escapeAttribute(redemption.id)}" ${requested ? "" : "disabled"}>Aprobar</button>
          <button class="mini-action" type="button" data-redemption-action="redeemed" data-redemption-id="${escapeAttribute(redemption.id)}" ${approved ? "" : "disabled"}>Entregado</button>
          ${canCancelRedemptions ? `<button class="mini-action danger" type="button" data-redemption-action="cancelled" data-redemption-id="${escapeAttribute(redemption.id)}" ${redemption.status === "cancelled" || redemption.status === "redeemed" ? "disabled" : ""}>Cancelar</button>` : ""}
        </span>
      </article>
    `;
  }).join("")}${hidden ? `
    <button class="home-load-more" type="button" data-redemptions-more="true">
      Ver mas (${hidden} canjes)
    </button>
  ` : ""}`;
}

function renderAdminRewards() {
  if (!adminRewardRows || !adminRedemptionRows) return;
  if (currentAdminData.error) {
    setLoadingState(adminRewardRows, false);
    setLoadingState(adminRedemptionRows, false);
    adminRewardRows.innerHTML = adminDataErrorMarkup("No se pudieron cargar los premios");
    adminRedemptionRows.innerHTML = adminDataErrorMarkup("No se pudieron cargar los canjes");
    return;
  }
  if (supabase && currentSession?.user && canAccessAdmin() && !currentAdminData.remoteLoaded) {
    if (adminRewardsCount) adminRewardsCount.textContent = "...";
    if (adminRedemptionsCount) adminRedemptionsCount.textContent = "...";
    setLoadingState(adminRewardRows, true);
    setLoadingState(adminRedemptionRows, true);
    adminRewardRows.innerHTML = skeletonRowsMarkup(3, "Cargando premios");
    adminRedemptionRows.innerHTML = skeletonRowsMarkup(3, "Cargando canjes");
    return;
  }
  setLoadingState(adminRewardRows, false);
  setLoadingState(adminRedemptionRows, false);
  if (loyaltyEarnRateInput) loyaltyEarnRateInput.value = Math.round((loyaltySettings.earnRate || 0) * 100);
  if (loyaltySignupBonusInput) loyaltySignupBonusInput.value = loyaltySettings.signupBonusPoints || 0;
  if (loyaltyReferralOwnerInput) loyaltyReferralOwnerInput.value = loyaltySettings.referralReferrerPoints || 0;
  if (loyaltyReferralGuestInput) loyaltyReferralGuestInput.value = loyaltySettings.referralReferredPoints || 0;
  if (loyaltyStreakWeeksInput) loyaltyStreakWeeksInput.value = loyaltySettings.streakBonusWeeks || 3;
  if (loyaltyStreakBonusInput) loyaltyStreakBonusInput.value = loyaltySettings.streakBonusPoints || 0;
  if (loyaltyTierSilverInput) loyaltyTierSilverInput.value = loyaltySettings.tierSilverPoints || 500;
  if (loyaltyTierGoldInput) loyaltyTierGoldInput.value = loyaltySettings.tierGoldPoints || 1000;
  if (loyaltyTierPlatinumInput) loyaltyTierPlatinumInput.value = loyaltySettings.tierPlatinumPoints || 2000;

  adminRewardsCount.textContent = rewardCatalog.length;
  adminRewardRows.innerHTML = rewardCatalog.length
    ? rewardCatalog
        .map((reward) => `
          <article class="admin-list-row admin-reward-row ${reward.active ? "" : "is-inactive"}">
            <span class="admin-reward-thumb ${reward.imageUrl ? "" : "is-empty"}" ${reward.imageUrl ? `style="background-image:url(&quot;${escapeAttribute(reward.imageUrl)}&quot;)"` : ""} aria-hidden="true"></span>
            <span>
              <strong>${escapeHtml(reward.name)}</strong>
              <small>${escapeHtml(reward.description || "Premio activo")} ${reward.stock !== null ? `- Stock: ${escapeHtml(reward.stock)}` : ""} ${reward.validUntil ? `- Vigente hasta ${escapeHtml(reward.validUntil)}` : ""}</small>
            </span>
            <b>${escapeHtml(reward.cost)} pts</b>
            <span class="status">${escapeHtml(reward.active ? "Activo" : "Inactivo")}</span>
            <span class="redemption-actions">
              <button class="mini-action" type="button" data-reward-action="edit" data-reward-key="${escapeAttribute(reward.rewardKey)}">Editar</button>
              <button class="mini-action" type="button" data-reward-action="toggle" data-reward-key="${escapeAttribute(reward.rewardKey)}">${reward.active ? "Pausar" : "Activar"}</button>
              <button class="mini-action danger" type="button" data-reward-action="delete" data-reward-key="${escapeAttribute(reward.rewardKey)}">Eliminar</button>
            </span>
          </article>
        `)
        .join("")
    : `<div class="admin-empty">No hay premios configurados. Crea el primero desde este panel.</div>`;

  adminRedemptionsCount.textContent = currentAdminData.redemptions.length;
  renderAdminRedemptions();
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
    <article class="admin-setting-card">
      <span>Fidelizacion</span>
      <strong>Reglas en su seccion</strong>
      <small>Porcentaje, registro, referidos, rachas y premios se editan en Fidelizacion.</small>
    </article>
  `;
}

function resetAdminRewardForm() {
  if (!adminRewardForm) return;
  adminRewardForm.reset();
  setAdminRewardImageDraft();
  if (adminRewardEditingKey) adminRewardEditingKey.value = "";
  if (adminRewardActiveInput) adminRewardActiveInput.checked = true;
  if (adminRewardCancelEdit) adminRewardCancelEdit.hidden = true;
}

function editAdminReward(rewardKey) {
  const reward = rewardCatalog.find((item) => item.rewardKey === rewardKey);
  if (!reward || !adminRewardForm) return;
  adminRewardEditingKey.value = reward.rewardKey;
  adminRewardNameInput.value = reward.name || "";
  adminRewardDescriptionInput.value = reward.description || "";
  setAdminRewardImageDraft({ imageUrl: reward.imageUrl || "", imagePath: reward.imagePath || "" });
  adminRewardCostInput.value = reward.cost || "";
  adminRewardStockInput.value = reward.stock ?? "";
  adminRewardMinTierInput.value = reward.minTier || "";
  if (adminRewardValidUntilInput) adminRewardValidUntilInput.value = reward.validUntil || "";
  adminRewardActiveInput.checked = reward.active !== false;
  adminRewardCancelEdit.hidden = false;
  adminRewardNameInput.focus();
}

async function saveAdminReward(event) {
  event?.preventDefault();
  const payload = rewardTablePayloadFromForm();
  if (!payload.name || payload.points_cost <= 0) {
    showToast("Completa nombre y puntos del premio.");
    return;
  }
  if (!isOwner()) {
    showToast("Esta cuenta no tiene permisos de owner.");
    return;
  }
  const previousImagePath = adminRewardImageDraft.imagePath;
  let uploadedImagePath = "";
  if (!supabase || !isRemoteOwner()) {
    if (adminRewardImageDraft.file) {
      payload.image_url = await fileToDataUrl(adminRewardImageDraft.file);
      payload.image_path = null;
    }
    const normalized = normalizeRewardDefinition({
      ...payload,
      id: payload.reward_key,
      reward_key: payload.reward_key
    });
    rewardCatalog = [
      normalized,
      ...rewardCatalog.filter((reward) => reward.rewardKey !== normalized.rewardKey)
    ];
    resetAdminRewardForm();
    renderAdminRewards();
    renderLoyalty();
    showToast("Premio actualizado localmente.");
    return;
  }
  try {
    if (adminRewardImageDraft.file) {
      const uploaded = await uploadRewardImage(adminRewardImageDraft.file, payload.reward_key);
      payload.image_url = uploaded.imageUrl;
      payload.image_path = uploaded.path;
      uploadedImagePath = uploaded.path;
    }
  } catch (error) {
    showToast(displayError(error));
    return;
  }
  const { error } = await supabase
    .from("business_rewards")
    .upsert(payload, { onConflict: "business_id,reward_key" });
  if (error) {
    if (uploadedImagePath) await supabase.storage.from("reward-images").remove([uploadedImagePath]).catch(() => null);
    showToast(displayError(error));
    return;
  }
  if (uploadedImagePath && previousImagePath && previousImagePath !== uploadedImagePath) {
    await supabase.storage.from("reward-images").remove([previousImagePath]).catch(() => null);
  }
  await loadBusinessRewards({ owner: true });
  resetAdminRewardForm();
  renderAdminRewards();
  renderLoyalty();
  showToast("Premio guardado.");
}

async function toggleAdminReward(rewardKey) {
  const reward = rewardCatalog.find((item) => item.rewardKey === rewardKey);
  if (!reward) return;
  if (!isOwner()) {
    showToast("Esta cuenta no tiene permisos de owner.");
    return;
  }
  const payload = {
    business_id: businessId,
    reward_key: reward.rewardKey,
    name: reward.name,
    description: reward.description || "",
    points_cost: reward.cost,
    stock: reward.stock,
    image_url: reward.imageUrl || null,
    image_path: reward.imagePath || null,
    min_tier: reward.minTier || null,
    valid_until: reward.validUntil || null,
    active: !reward.active
  };
  if (!supabase || !isRemoteOwner()) {
    reward.active = payload.active;
    renderAdminRewards();
    renderLoyalty();
    return;
  }
  const { error } = await supabase
    .from("business_rewards")
    .upsert(payload, { onConflict: "business_id,reward_key" });
  if (error) {
    showToast(displayError(error));
    return;
  }
  await loadBusinessRewards({ owner: true });
  renderAdminRewards();
  renderLoyalty();
  showToast(payload.active ? "Premio activado." : "Premio pausado.");
}

async function deleteAdminReward(rewardKey) {
  const reward = rewardCatalog.find((item) => item.rewardKey === rewardKey);
  if (!reward) return;
  if (!isOwner()) {
    showToast("Esta cuenta no tiene permisos de owner.");
    return;
  }
  if (!window.confirm(`Eliminar ${reward.name}? Los canjes historicos se conservan.`)) return;
  if (!supabase || !isRemoteOwner()) {
    rewardCatalog = rewardCatalog.filter((item) => item.rewardKey !== rewardKey);
    renderAdminRewards();
    renderLoyalty();
    return;
  }
  const query = supabase
    .from("business_rewards")
    .delete()
    .eq("business_id", businessId)
    .eq("reward_key", reward.rewardKey);
  const imagePath = reward.imagePath;
  const { error } = reward.databaseId ? await query.eq("id", reward.databaseId) : await query;
  if (error) {
    showToast(displayError(error));
    return;
  }
  if (imagePath) await supabase.storage.from("reward-images").remove([imagePath]).catch(() => null);
  await loadBusinessRewards({ owner: true });
  renderAdminRewards();
  renderLoyalty();
  showToast("Premio eliminado.");
}

async function saveLoyaltyRules(event) {
  event?.preventDefault();
  const rawThresholds = {
    tierSilverPoints: Math.floor(Number(loyaltyTierSilverInput?.value || 500)),
    tierGoldPoints: Math.floor(Number(loyaltyTierGoldInput?.value || 1000)),
    tierPlatinumPoints: Math.floor(Number(loyaltyTierPlatinumInput?.value || 2000))
  };
  if (
    rawThresholds.tierSilverPoints < 0
    || rawThresholds.tierGoldPoints <= rawThresholds.tierSilverPoints
    || rawThresholds.tierPlatinumPoints <= rawThresholds.tierGoldPoints
  ) {
    showToast("Los niveles deben cumplir Plata < Oro < Platino.");
    return;
  }
  const nextSettings = {
    earnRate: Math.max(0, Number(loyaltyEarnRateInput?.value || 0)) / 100,
    signupBonusPoints: Math.max(0, Number(loyaltySignupBonusInput?.value || 0)),
    referralReferrerPoints: Math.max(0, Number(loyaltyReferralOwnerInput?.value || 0)),
    referralReferredPoints: Math.max(0, Number(loyaltyReferralGuestInput?.value || 0)),
    streakBonusWeeks: Math.max(1, Number(loyaltyStreakWeeksInput?.value || 3)),
    streakBonusPoints: Math.max(0, Number(loyaltyStreakBonusInput?.value || 0)),
    ...rawThresholds
  };
  loyaltySettings = nextSettings;
  recalculateLocalAccountTiers();
  renderAuthState();
  if (!supabase || !isOwner()) {
    renderAdminRewards();
    showToast("Reglas actualizadas localmente.");
    return;
  }
  const imagePath = reward.imagePath;
  const { error } = await supabase
    .from("business_loyalty_settings")
    .upsert({
      business_id: businessId,
      earn_rate: nextSettings.earnRate,
      signup_bonus_points: nextSettings.signupBonusPoints,
      referral_referrer_points: nextSettings.referralReferrerPoints,
      referral_referred_points: nextSettings.referralReferredPoints,
      streak_bonus_weeks: nextSettings.streakBonusWeeks,
      streak_bonus_points: nextSettings.streakBonusPoints,
      tier_silver_points: nextSettings.tierSilverPoints,
      tier_gold_points: nextSettings.tierGoldPoints,
      tier_platinum_points: nextSettings.tierPlatinumPoints,
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id" });
  if (error) {
    showToast(displayError(error));
    return;
  }
  if (imagePath) await supabase.storage.from("reward-images").remove([imagePath]).catch(() => null);
  showToast("Reglas de fidelizacion actualizadas.");
  currentAdminData.loaded = false;
  currentAdminData.remoteLoaded = false;
  renderAdminRewards();
}

async function updateRedemptionStatus(redemptionId, status) {
  const redemption = currentAdminData.redemptions.find((item) => item.id === redemptionId)
    || staffRedemptionQueue.find((item) => item.id === redemptionId);
  if (!redemption) return;
  if (redemptionActionInFlight.has(redemptionId)) return;
  const expectedStatus = redemption.status;
  const actionLabel = status === "approved" ? "aprobar" : status === "redeemed" ? "marcar como entregado" : "cancelar";
  if (status === "cancelled" && !isOwner() && !isManager()) {
    showToast("Los empleados no pueden cancelar canjes.");
    return;
  }
  if (![
    ["requested", "approved"],
    ["approved", "redeemed"],
    ["requested", "cancelled"],
    ["approved", "cancelled"]
  ].some(([from, to]) => from === expectedStatus && to === status)) {
    showToast("La transición de este canje ya no está disponible.");
    return;
  }
  const customerLabel = currentAdminData.customers.find((profile) => profile.id === redemption.customer_id)?.name
    || redemption.customer_name
    || "Cliente";
  const confirmed = window.confirm(
    `Confirmar acción\n\nCliente: ${customerLabel}\nPremio: ${redemption.reward_name || "Premio"}\nPuntos: ${redemption.points_cost || 0}\nAcción: ${actionLabel}`
  );
  if (!confirmed) return;
  redemptionActionInFlight.add(redemptionId);
  try {
    let updatedRedemption = { ...redemption, status };
    let updatedAccount = null;
    if (supabase) {
    const { data, error } = await supabase.rpc("manage_reward_redemption_status_v2", {
      target_business_id: businessId,
      target_redemption_id: redemptionId,
      expected_status: expectedStatus,
      next_status: status
    });
      if (error) {
        showToast(displayError(error));
        return;
      }
      updatedRedemption = data?.redemption || updatedRedemption;
      updatedAccount = data?.account || null;
      if (data?.expired) {
        Object.assign(redemption, updatedRedemption);
        try { await loadStaffRedemptionQueue(); } catch { /* queue refresh is best effort */ }
        renderStaffWorkspace();
        showToast("La solicitud había vencido y fue cancelada por el sistema.");
        return;
      }
    }

    Object.assign(redemption, updatedRedemption);
    if (updatedAccount?.id) {
    const account = currentAdminData.accounts.find((item) => item.id === updatedAccount.id);
    if (account) Object.assign(account, updatedAccount);
    if (currentCustomer?.account?.id === updatedAccount.id) {
      currentCustomer.account = { ...currentCustomer.account, ...updatedAccount };
      pointsBalance = updatedAccount.points_balance || 0;
    }
    }
    const customerRedemption = currentCustomer?.redemptions?.find((item) => item.id === redemptionId);
    if (customerRedemption) Object.assign(customerRedemption, updatedRedemption);

    const queueItem = staffRedemptionQueue.find((item) => item.id === redemptionId);
    if (queueItem) Object.assign(queueItem, updatedRedemption);

    if (supabase) {
      currentAdminData.loaded = false;
      await ensureAdminData();
    }
    renderAdminPanel();
    renderAdminRewards();
    renderLoyalty();
    try { await loadStaffRedemptionQueue(); } catch { /* queue refresh is best effort */ }
    renderStaffWorkspace();
    showToast(status === "approved" ? "Canje aprobado." : status === "redeemed" ? "Canje marcado como entregado." : "Canje cancelado.");
  } finally {
    redemptionActionInFlight.delete(redemptionId);
  }
}

async function saveLoyaltyEarnRate(ratePercent) {
  const earnRate = Math.max(0, Number(ratePercent || 0)) / 100;
  loyaltySettings = { ...normalizeLoyaltySettings(loyaltySettings), earnRate };
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
  if (!canAccessAdmin()) return;
  if (!currentAdminData.loaded && !currentAdminData.error && !adminDataRequest && (!supabase || currentSession?.user)) {
    ensureAdminData().then(() => renderAdminPanel());
  }
  if (supabase && currentSession?.user && canAccessAdmin() && !currentAdminData.remoteLoaded && !adminDataRetryTimer) {
    adminDataRetryTimer = window.setTimeout(() => {
      adminDataRetryTimer = null;
      if (!currentAdminData.remoteLoaded && canAccessAdmin()) {
        currentAdminData.loaded = false;
        currentAdminData.error = null;
        ensureAdminData().then(() => renderAdminPanel());
      }
    }, 1200);
  }
  renderAdminHome();
  renderAdminMenu();
  renderAdminCustomers();
  renderAdminConsumptions();
  renderAdminContent();
  renderAdminLibrary();
  renderAdminRewards();
  renderAdminQrs();
  renderAdminAnalytics();
  renderAdminSettings();
  applyAdminRolePermissions();
}

function applyAdminRolePermissions() {
  document.body.classList.toggle("admin-manager", isManager());
  adminNavItems.forEach((item) => {
    item.hidden = !canAccessAdminView(item.dataset.adminNav);
  });
  document.querySelectorAll(".nav-group-label").forEach((label) => {
    let sibling = label.nextElementSibling;
    let hasVisibleItem = false;
    while (sibling && !sibling.classList.contains("nav-group-label")) {
      if (sibling.matches?.("[data-admin-nav]") && !sibling.hidden) hasVisibleItem = true;
      sibling = sibling.nextElementSibling;
    }
    label.hidden = !hasVisibleItem;
  });
  const ownerOnlyCards = [
    adminLoyaltyRulesForm?.closest(".admin-card"),
    adminRewardForm?.closest(".admin-card")
  ].filter(Boolean);
  ownerOnlyCards.forEach((card) => { card.hidden = !isOwner(); });
  if (translateButton) translateButton.hidden = !isOwner();
  if (improvePhotoButton) improvePhotoButton.hidden = !isOwner();
  document.querySelectorAll('[data-customer-action="status"], [data-customer-action="adjust-points"], [data-consumption-action="correct"], [data-consumption-action="cancel"]').forEach((control) => {
    control.hidden = !isOwner();
  });
  document.querySelectorAll('[data-analytics-action="content"], [data-analytics-action="menu-qr"], [data-analytics-action="qrs"]').forEach((control) => {
    control.hidden = !isOwner();
  });
  const panelLabel = document.querySelector(".sidebar .brand span");
  if (panelLabel) panelLabel.textContent = isManager() ? "Panel operativo" : "Panel del dueño";
}

const adminRouteViews = new Set(["home", "customers", "consumptions", "menu", "content", "library", "rewards", "qrs", "settings"]);

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
  if (parts[0] === "admin" && parts[1] === "analytics") return { name: "admin-section", view: "home", legacyAnalytics: true };
  if (parts[0] === "admin" && adminRouteViews.has(parts[1])) return { name: "admin-section", view: parts[1] };
  if (parts.length === 1 && menuItems.some((dish) => dish.id === parts[0])) return { name: "menu-detail", dishId: parts[0] };
  return { name: "menu" };
}

async function ensureAdminData() {
  const needsRemoteReload = Boolean(supabase && currentSession?.user && canAccessAdmin() && !currentAdminData.remoteLoaded);
  if ((currentAdminData.loaded || currentAdminData.error) && !needsRemoteReload) return;
  if (adminDataRequest) return adminDataRequest;
  adminDataRequest = (async () => {
    try {
      await loadAdminData();
    } catch (error) {
      currentAdminData = {
        customers: [],
        accounts: [],
        events: [],
        redemptions: [],
        menuEvents: [],
        consumptionCorrections: [],
        loaded: true,
        remoteLoaded: false,
        error
      };
      exposeDebugState();
      showToast(displayError(error));
    } finally {
      adminDataRequest = null;
    }
  })();
  return adminDataRequest;
}

async function reloadAdminData({ silent = false } = {}) {
  if (!supabase || !currentSession?.user || !canAccessAdmin()) return;
  const previousData = currentAdminData;
  const previousPendingIds = pendingRedemptionIdSet(previousData);
  const wasRemoteLoaded = Boolean(previousData.remoteLoaded);

  if (silent) {
    if (adminDataRequest) return;
    try {
      await loadAdminData();
      notifyNewPendingRedemptions(wasRemoteLoaded ? previousPendingIds : new Set(), currentAdminData);
      renderAdminPanel();
    } catch (error) {
      currentAdminData = previousData;
      adminLastRefreshError = displayError(error);
      exposeDebugState();
      renderAdminPanel();
    }
    return;
  }

  currentAdminData.loaded = false;
  currentAdminData.remoteLoaded = false;
  currentAdminData.error = null;
  try {
    await ensureAdminData();
    notifyNewPendingRedemptions(wasRemoteLoaded ? previousPendingIds : new Set(), currentAdminData);
    renderAdminPanel();
  } catch (error) {
    if (!silent) showToast(displayError(error));
  }
}

function shouldAutoRefreshAdmin() {
  const route = parseRoute();
  return Boolean(supabase && currentSession?.user && canAccessAdmin() && route.name.startsWith("admin"));
}

function stopAdminAutoRefresh() {
  if (adminRefreshTimer) {
    window.clearInterval(adminRefreshTimer);
    adminRefreshTimer = null;
  }
  stopAdminRealtime();
}

async function refreshAdminIfVisible() {
  if (adminRefreshInFlight || !shouldAutoRefreshAdmin() || document.hidden) return;
  adminRefreshInFlight = true;
  renderAdminPanel();
  try {
    await reloadAdminData({ silent: true });
  } finally {
    adminRefreshInFlight = false;
    renderAdminPanel();
  }
}

function scheduleAdminRealtimeRefresh() {
  if (adminRealtimeRefreshTimer || !shouldAutoRefreshAdmin() || document.hidden) return;
  adminRealtimeRefreshTimer = window.setTimeout(async () => {
    adminRealtimeRefreshTimer = null;
    await refreshAdminIfVisible();
  }, 300);
}

function stopAdminRealtime() {
  if (adminRealtimeRefreshTimer) {
    window.clearTimeout(adminRealtimeRefreshTimer);
    adminRealtimeRefreshTimer = null;
  }
  if (!adminRealtimeChannel || !supabase) {
    adminRealtimeChannel = null;
    adminRealtimeStatus = "";
    return;
  }
  const channel = adminRealtimeChannel;
  adminRealtimeChannel = null;
  adminRealtimeStatus = "";
  supabase.removeChannel(channel);
}

function startAdminRealtime() {
  if (!supabase || !currentSession?.user || !canAccessAdmin() || adminRealtimeChannel || !shouldAutoRefreshAdmin()) return;
  adminRealtimeStatus = "CONNECTING";
  const channelName = `sumi-admin-redemptions-${businessId}-${currentSession.user.id}`;
  adminRealtimeChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reward_redemptions",
        filter: `business_id=eq.${businessId}`
      },
      () => scheduleAdminRealtimeRefresh()
    )
    .subscribe((status) => {
      adminRealtimeStatus = status;
      if (status === "SUBSCRIBED") {
        adminLastRefreshError = "";
        renderAdminPanel();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        renderAdminPanel();
      }
    });
}

function startAdminAutoRefresh() {
  if (adminRefreshTimer || !shouldAutoRefreshAdmin()) return;
  startAdminRealtime();
  adminRefreshTimer = window.setInterval(refreshAdminIfVisible, adminRefreshIntervalMs);
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
  stopAdminAutoRefresh();
  stopConsumptionScanner();
  document.body.classList.remove("landing-active", "admin-active", "admin-manager");
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
  recordMenuEvent("menu_view");
}

function showPublicDetail(dishId) {
  const dish = menuItems.find((item) => item.id === dishId);
  if (!dish) {
    navigate("menu", {}, { replace: true });
    return;
  }
  showPublicMenu();
  openDetail(dish.id);
  recordMenuEvent("dish_detail_view", dish.id);
}

async function showAdminSection(view = "home") {
  if (!canAccessAdmin() || !canAccessAdminView(view)) {
    showToast("Esta cuenta no tiene permisos para abrir esa seccion.");
    navigate("menu", {}, { replace: true });
    return false;
  }
  hideAllSurfaces();
  traceInit(`admin:${view}:surfaces-hidden`);
  closeProfileModal();
  document.body.classList.add("admin-active");
  adminPanel.hidden = false;
  setAdminView(view);
  traceInit(`admin:${view}:view-set`);
  const renderLoadingState = Boolean(supabase && currentSession?.user && !isLocalDevOwner());
  const contentLoadToken = ++adminContentLoadToken;
  adminContentDataLoading = Boolean(renderLoadingState && isOwner() && (view === "content" || view === "library"));
  if (renderLoadingState) {
    renderAdminPanel();
    traceInit(`admin:${view}:loading-render`);
  }
  await ensureAdminData();
  traceInit(`admin:${view}:data-ready`);
  await loadBusinessRewards({ owner: canAccessAdmin() });
  traceInit(`admin:${view}:rewards-ready`);
  if (view === "home" || view === "content" || view === "library") {
    try {
      await ensureAdminContentData();
    } finally {
      if (contentLoadToken === adminContentLoadToken) adminContentDataLoading = false;
    }
  }
  traceInit(`admin:${view}:content-ready`);
  renderAdminPanel();
  traceInit(`admin:${view}:second-render`);
  startAdminAutoRefresh();
  traceInit(`admin:${view}:refresh-ready`);
  window.requestAnimationFrame(() => adminPanel.focus?.());
  traceInit(`admin:${view}:complete`);
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
  if (!canAccessAdminView("menu")) {
    showToast("Esta cuenta no tiene permisos para editar el menu.");
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
    if (route.legacyAnalytics) {
      navigate("admin-section", { view: "home" }, { replace: true });
      return;
    }
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
  const validViews = new Set(["home", "customers", "consumptions", "menu", "content", "library", "rewards", "qrs", "settings"]);
  currentAdminView = validViews.has(view) && canAccessAdminView(view) ? view : "home";
  adminHome.hidden = currentAdminView !== "home";
  adminCustomersSection.hidden = currentAdminView !== "customers";
  adminConsumptionsSection.hidden = currentAdminView !== "consumptions";
  adminMenuSection.hidden = currentAdminView !== "menu";
  adminContentSection.hidden = currentAdminView !== "content";
  adminLibrarySection.hidden = currentAdminView !== "library";
  adminRewardsSection.hidden = currentAdminView !== "rewards";
  if (adminQrsSection) adminQrsSection.hidden = currentAdminView !== "qrs";
  adminSettingsSection.hidden = currentAdminView !== "settings";
  adminNavItems.forEach((item) => {
    const active = item.dataset.adminNav === currentAdminView;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
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

async function createMenuWebpVariant(sourceUrl) {
  const image = await loadImageBitmapUrl(sourceUrl);
  if (image.naturalWidth * image.naturalHeight > editorImageMaxPixels) {
    throw new Error("La imagen tiene demasiados pixeles. Usa una imagen de hasta 36 megapixeles.");
  }
  const scale = Math.min(1, editorImageMaxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen.");
  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToImageBlob(canvas, "image/webp", editorImageQuality);
  if (!blob || blob.type !== "image/webp") {
    throw new Error("Este navegador no puede crear la version WebP del menu.");
  }
  return { blob, dataUrl: await imageBlobToDataUrl(blob), width, height };
}

async function compressEditorImage(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await createMenuWebpVariant(objectUrl);
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
    return await createMenuWebpVariant(sourceUrl);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function openLocalMenuImageDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("El navegador no permite conservar la imagen original localmente."));
      return;
    }
    const request = window.indexedDB.open(localMenuImageDbName, localMenuImageDbVersion);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(localMenuImageStoreName)) {
        db.createObjectStore(localMenuImageStoreName, { keyPath: "key" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("No se pudo abrir el almacen local de imagenes.")));
  });
}

async function storeLocalOriginalPhoto(key, file) {
  const db = await openLocalMenuImageDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(localMenuImageStoreName, "readwrite");
      transaction.objectStore(localMenuImageStoreName).put({
        key,
        blob: file,
        name: file.name || "imagen-original",
        type: file.type || "application/octet-stream",
        size: file.size || 0,
        savedAt: new Date().toISOString()
      });
      transaction.addEventListener("complete", resolve);
      transaction.addEventListener("abort", () => reject(transaction.error || new Error("No se pudo conservar la imagen original.")));
      transaction.addEventListener("error", () => reject(transaction.error || new Error("No se pudo conservar la imagen original.")));
    });
  } finally {
    db.close();
  }
}

async function readLocalOriginalPhoto(key) {
  if (!key) return null;
  const db = await openLocalMenuImageDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(localMenuImageStoreName, "readonly")
        .objectStore(localMenuImageStoreName)
        .get(key);
      request.addEventListener("success", () => resolve(request.result || null));
      request.addEventListener("error", () => reject(request.error || new Error("No se pudo leer la imagen original.")));
    });
  } finally {
    db.close();
  }
}

async function deleteLocalOriginalPhoto(key) {
  if (!key || !window.indexedDB) return;
  const db = await openLocalMenuImageDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(localMenuImageStoreName, "readwrite");
      transaction.objectStore(localMenuImageStoreName).delete(key);
      transaction.addEventListener("complete", resolve);
      transaction.addEventListener("abort", () => reject(transaction.error));
      transaction.addEventListener("error", () => reject(transaction.error));
    });
  } finally {
    db.close();
  }
}

function safeStorageSegment(value, fallback = "imagen") {
  const safe = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || fallback;
}

function originalImageExtension(file) {
  const mimeExtension = imageExtensionFromType(file?.type, "");
  if (mimeExtension) return mimeExtension;
  const nameExtension = String(file?.name || "").match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "avif", "gif"].includes(nameExtension) ? nameExtension : "bin";
}

function publicMenuImageUrl(path) {
  return supabase?.storage.from(menuImagePublicBucket).getPublicUrl(path).data.publicUrl || "";
}

async function uploadMenuImageBlob(bucket, path, blob, contentType) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return path;
}

async function uploadImportedMenuPhoto(dishId, originalFile, menuBlob) {
  const version = `${Date.now().toString(36)}-${window.crypto?.randomUUID?.() || fallbackId()}`;
  const directory = `${businessId}/${safeStorageSegment(dishId)}/${version}`;
  const originalPath = `${directory}/original.${originalImageExtension(originalFile)}`;
  const menuPath = `${directory}/menu.webp`;
  const uploadedPaths = [];
  const uploadedOriginalPaths = [];
  try {
    await uploadMenuImageBlob(menuImageOriginalBucket, originalPath, originalFile, originalFile.type || "application/octet-stream");
    uploadedOriginalPaths.push(originalPath);
    await uploadMenuImageBlob(menuImagePublicBucket, menuPath, menuBlob, "image/webp");
    uploadedPaths.push(menuPath);
    return {
      photo: publicMenuImageUrl(menuPath),
      photoOriginal: "",
      photoStoragePath: menuPath,
      photoOriginalStoragePath: originalPath,
      uploadedPaths,
      uploadedOriginalPaths
    };
  } catch (error) {
    await removeRemoteMenuImages(uploadedPaths, uploadedOriginalPaths);
    throw error;
  }
}

async function uploadGeneratedMenuPhoto(dishId, originalUrl, menuBlob) {
  const version = `${Date.now().toString(36)}-${window.crypto?.randomUUID?.() || fallbackId()}`;
  const directory = `${businessId}/${safeStorageSegment(dishId)}/${version}`;
  const response = await fetch(originalUrl, { mode: "cors" });
  if (!response.ok) throw new Error("No se pudo conservar la imagen original generada.");
  const originalBlob = await response.blob();
  const originalType = originalBlob.type || "image/png";
  const originalPath = `${directory}/original.${imageExtensionFromType(originalType)}`;
  const menuPath = `${directory}/menu.webp`;
  const uploadedPaths = [];
  const uploadedOriginalPaths = [];
  try {
    await uploadMenuImageBlob(menuImageOriginalBucket, originalPath, originalBlob, originalType);
    uploadedOriginalPaths.push(originalPath);
    await uploadMenuImageBlob(menuImagePublicBucket, menuPath, menuBlob, "image/webp");
    uploadedPaths.push(menuPath);
    return {
      photo: publicMenuImageUrl(menuPath),
      photoOriginal: "",
      photoOriginalName: downloadFileNameFromUrl(originalUrl, imageExtensionFromType(originalType)),
      photoOriginalType: originalType,
      photoOriginalSize: originalBlob.size,
      photoStoragePath: menuPath,
      photoOriginalStoragePath: originalPath,
      uploadedPaths,
      uploadedOriginalPaths
    };
  } catch (error) {
    await removeRemoteMenuImages(uploadedPaths, uploadedOriginalPaths);
    throw error;
  }
}

async function removeRemoteMenuImages(publicPaths = [], originalPaths = []) {
  if (!supabase) return;
  const uniquePublicPaths = [...new Set(publicPaths.filter(Boolean))];
  const uniqueOriginalPaths = [...new Set(originalPaths.filter(Boolean))];
  if (uniquePublicPaths.length) {
    await supabase.storage.from(menuImagePublicBucket).remove(uniquePublicPaths).catch(() => null);
  }
  if (uniqueOriginalPaths.length) {
    await supabase.storage.from(menuImageOriginalBucket).remove(uniqueOriginalPaths).catch(() => null);
  }
}

function originalPhotoName(dish) {
  if (dish?.photoOriginalName) return dish.photoOriginalName;
  const source = dish?.photoOriginal || dish?.highQualityPhoto || dish?.photo || "";
  return downloadFileNameFromUrl(source, imageExtensionFromType(dish?.photoOriginalType));
}

function formatImageBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function renderEditorPhotoState(dish = editorDish()) {
  if (!dish) return;
  const hasOriginal = Boolean(editorPendingOriginalPhoto || dish.photoOriginalStorageKey || dish.photoOriginalStoragePath || dish.photoOriginal || dish.highQualityPhoto || dish.photo);
  if (downloadOriginalPhotoButton) downloadOriginalPhotoButton.disabled = !hasOriginal;
  if (!dishPhotoFormatStatus) return;
  if (editorPendingOriginalPhoto) {
    const originalSize = formatImageBytes(editorPendingOriginalPhoto.size);
    const optimizedSize = formatImageBytes(editorPendingMenuPhotoBlob?.size);
    dishPhotoFormatStatus.textContent = `Menu: WebP${optimizedSize ? ` · ${optimizedSize}` : ""}. Original: ${originalSize || "calidad completa"}.`;
    return;
  }
  const originalSize = formatImageBytes(dish.photoOriginalSize);
  dishPhotoFormatStatus.textContent = dish.photoOriginal || dish.photoOriginalStorageKey || dish.photoOriginalStoragePath || dish.highQualityPhoto
    ? `Menu: imagen optimizada. Original conservado${originalSize ? ` · ${originalSize}` : ""}.`
    : "Las nuevas cargas se sirven en WebP y conservan el original para descargar.";
}

async function downloadEditorOriginalPhoto() {
  const dish = editorDish();
  if (!dish) return;
  if (editorPendingOriginalPhoto) {
    triggerBlobDownload(editorPendingOriginalPhoto, editorPendingOriginalPhoto.name);
    return;
  }
  if (dish.photoOriginalStorageKey) {
    try {
      const stored = await readLocalOriginalPhoto(dish.photoOriginalStorageKey);
      if (!stored?.blob) throw new Error("No se encontro el original local.");
      triggerBlobDownload(stored.blob, stored.name || originalPhotoName(dish));
      return;
    } catch (error) {
      showToast(displayError(error));
      return;
    }
  }
  if (dish.photoOriginalStoragePath && supabase) {
    const { data, error } = await supabase.storage
      .from(menuImageOriginalBucket)
      .createSignedUrl(dish.photoOriginalStoragePath, 60, { download: originalPhotoName(dish) });
    if (error || !data?.signedUrl) {
      showToast(displayError(error || new Error("No se pudo autorizar la descarga original.")));
      return;
    }
    await downloadAsset(data.signedUrl, originalPhotoName(dish));
    return;
  }
  await downloadAsset(dish.photoOriginal || dish.highQualityPhoto || dish.photo, originalPhotoName(dish));
}

async function originalPhotoForAi(dish) {
  if (editorPendingOriginalPhoto) return fileToDataUrl(editorPendingOriginalPhoto);
  if (dish?.photoOriginalStorageKey) {
    const stored = await readLocalOriginalPhoto(dish.photoOriginalStorageKey).catch(() => null);
    if (stored?.blob) return imageBlobToDataUrl(stored.blob);
  }
  if (dish?.photoOriginalStoragePath && supabase) {
    const { data } = await supabase.storage
      .from(menuImageOriginalBucket)
      .createSignedUrl(dish.photoOriginalStoragePath, 120);
    if (data?.signedUrl) return data.signedUrl;
  }
  return dish?.photoOriginal || dish?.highQualityPhoto || dish?.photo || "";
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
  await loadAiCreditBalance().catch(() => aiCreditBalance);
  if ((aiCreditBalance.remaining ?? aiMonthlyCreditLimit) < aiGenerationCreditCost) {
    setPhotoAiStatus("No quedan creditos suficientes para generar otra mejora.", "error");
    showToast("No quedan creditos suficientes este mes.");
    renderAdminContent();
    return;
  }

  const productImage = await imageReferenceForGeneration(await originalPhotoForAi(dish));
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
    updateAiCreditBalanceFromGeneration(data);
    await loadAiCreditEvents().catch(() => aiCreditEvents);
    editorAiImprovedPhoto = data.imageUrl;
    editorAiCompressedPhoto = "";
    showPhotoAiComparison(editorAiOriginalPhoto || dish.photo, editorAiImprovedPhoto);
    photoAiPreview.classList.add("is-result");
    photoAiApply.disabled = false;
    if (photoAiDownload) photoAiDownload.disabled = false;
    if (photoAiRegenerate) photoAiRegenerate.hidden = true;
    setPhotoAiStatus(`Mejora lista. Quedan ${aiCreditBalance.remaining ?? aiMonthlyCreditLimit} creditos.`, "success");
    renderAdminContent();
    showToast("Mejora lista. Compara y decide si conservarla.");
  } catch (error) {
    if (error?.context?.json) {
      const body = await error.context.json().catch(() => null);
      if (body?.code === "insufficient_credits") {
        updateAiCreditBalanceFromGeneration(body);
        renderAdminContent();
        setPhotoAiStatus("No quedan creditos suficientes para generar otra mejora.", "error");
        showToast("No quedan creditos suficientes este mes.");
        return;
      }
    }
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
  let uploadedPaths = [];
  let uploadedOriginalPaths = [];
  try {
    const menuVariant = await compressEditorImageUrl(editorAiImprovedPhoto);
    const remoteVariant = canPublishRemoteMenuCatalog()
      ? await uploadGeneratedMenuPhoto(dish.id, editorAiImprovedPhoto, menuVariant.blob)
      : {
          photo: menuVariant.dataUrl,
          photoOriginal: editorAiImprovedPhoto,
          photoOriginalName: downloadFileNameFromUrl(editorAiImprovedPhoto, "png"),
          photoOriginalType: "image/png",
          photoOriginalSize: 0,
          photoStoragePath: "",
          photoOriginalStoragePath: "",
          uploadedPaths: [],
          uploadedOriginalPaths: []
        };
    uploadedPaths = remoteVariant.uploadedPaths;
    uploadedOriginalPaths = remoteVariant.uploadedOriginalPaths;
    editorAiCompressedPhoto = remoteVariant.photo;
    const previousPhotoState = {
      photo: dish.photo,
      photoOriginal: dish.photoOriginal,
      highQualityPhoto: dish.highQualityPhoto,
      photoOriginalName: dish.photoOriginalName,
      photoOriginalType: dish.photoOriginalType,
      photoOriginalSize: dish.photoOriginalSize,
      photoOriginalStorageKey: dish.photoOriginalStorageKey,
      photoStoragePath: dish.photoStoragePath,
      photoOriginalStoragePath: dish.photoOriginalStoragePath
    };
    dish.photo = remoteVariant.photo;
    dish.photoOriginal = remoteVariant.photoOriginal;
    dish.highQualityPhoto = remoteVariant.photoOriginal;
    dish.photoOriginalName = remoteVariant.photoOriginalName;
    dish.photoOriginalType = remoteVariant.photoOriginalType;
    dish.photoOriginalSize = remoteVariant.photoOriginalSize;
    dish.photoOriginalStorageKey = "";
    dish.photoStoragePath = remoteVariant.photoStoragePath;
    dish.photoOriginalStoragePath = remoteVariant.photoOriginalStoragePath;
    try {
      await publishMenuCatalog();
    } catch (error) {
      Object.assign(dish, previousPhotoState);
      try { persistMenuState(); } catch { /* Keep the in-memory rollback even if local storage is full. */ }
      await removeRemoteMenuImages(uploadedPaths, uploadedOriginalPaths);
      throw error;
    }
    await removeRemoteMenuImages(
      [previousPhotoState.photoStoragePath],
      [previousPhotoState.photoOriginalStoragePath]
    );
    if (previousPhotoState.photoOriginalStorageKey) {
      await deleteLocalOriginalPhoto(previousPhotoState.photoOriginalStorageKey).catch(() => null);
    }
    draft.photo = remoteVariant.photo;
    draft.photoOriginal = remoteVariant.photoOriginal;
    draft.highQualityPhoto = remoteVariant.photoOriginal;
    draft.photoOriginalName = dish.photoOriginalName;
    draft.photoOriginalType = dish.photoOriginalType;
    draft.photoOriginalSize = remoteVariant.photoOriginalSize;
    draft.photoOriginalStorageKey = "";
    draft.photoStoragePath = remoteVariant.photoStoragePath;
    draft.photoOriginalStoragePath = remoteVariant.photoOriginalStoragePath;
    clearPendingEditorPhoto();
    editorDraft = cloneDishForEditor(draft);
    dishPhoto.style.backgroundImage = `url('${remoteVariant.photo}')`;
    renderEditorPhotoState(editorDraft);
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
    if (uploadedPaths.length || uploadedOriginalPaths.length) {
      await removeRemoteMenuImages(uploadedPaths, uploadedOriginalPaths);
    }
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
    translationReview: dish.translationReview
      ? JSON.parse(JSON.stringify(dish.translationReview))
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
  const emptyTranslations = Object.fromEntries(languageCodes.map((lang) => [lang, { name: "", description: "" }]));
  const translationReview = Object.fromEntries(languageCodes.map((lang) => [
    lang,
    {
      status: lang === primaryLanguageCode ? "base" : "missing",
      source: lang === primaryLanguageCode ? "manual" : "empty",
      updatedAt: ""
    }
  ]));
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
    translations: emptyTranslations,
    translationReview,
    isNew: true
  };
}

async function updateEditorPhoto(file) {
  if (!file) return;
  const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
  if (!supportedTypes.has(file.type)) {
    showToast("Carga una imagen JPG, PNG, WebP, AVIF o GIF.");
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
    const menuVariant = await compressEditorImage(file);
    editorPendingOriginalPhoto = file;
    editorPendingMenuPhotoBlob = menuVariant.blob;
    editorPendingPhotoDraftId = String(currentEditorDishId || dish.id || "new");
    dish.photo = menuVariant.dataUrl;
    dish.photoOriginal = "";
    dish.highQualityPhoto = "";
    dish.photoOriginalName = file.name;
    dish.photoOriginalType = file.type;
    dish.photoOriginalSize = file.size;
    dish.photoOriginalStorageKey = "";
    dish.photoStoragePath = "";
    dish.photoOriginalStoragePath = "";
    dishPhoto.style.backgroundImage = `url('${menuVariant.dataUrl}')`;
    renderEditorPhotoState(dish);
    showToast("WebP listo para el menu. El original se conserva para descargar.");
  } catch (error) {
    showToast(displayError(error));
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
  const primaryText = translations[primaryLanguageCode] || translations[currentEditorLang] || {};
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
  const primaryText = translations[primaryLanguageCode] || translations[currentEditorLang];
  draft.name = primaryText?.name?.trim() || draft.name;
  draft.description = primaryText?.description?.trim() || draft.description;
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
  markEditorTranslationReviewed(currentEditorLang);
  if (currentEditorLang === primaryLanguageCode) {
    markSecondaryTranslationsOutdated(dish);
  }
  return translations[currentEditorLang];
}

function renderEditorLanguageTabs() {
  if (editorLanguageTabsContainer && (!editorLanguageTabs.length || editorLanguageTabs.length !== languages.length)) {
    renderEditorLanguageTabsMarkup();
  }
  editorLanguageTabs.forEach((tab) => {
    const active = tab.dataset.lang === currentEditorLang;
    const status = editorTranslationStatus(tab.dataset.lang);
    tab.classList.toggle("active", active);
    tab.classList.toggle("needs-review", status.className === "needs-review");
    tab.classList.toggle("missing", status.className === "missing");
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const statusElement = tab.querySelector(".translation-status");
    if (statusElement) {
      statusElement.textContent = status.label;
      statusElement.className = `translation-status ${status.className}`;
    }
  });
}

function renderEditorLanguageTabsMarkup() {
  if (!editorLanguageTabsContainer) return;
  editorLanguageTabsContainer.innerHTML = languages.map((language) => {
    const status = editorTranslationStatus(language.code);
    return `
    <button class="tab ${language.code === currentEditorLang ? "active" : ""} ${status.className === "needs-review" ? "needs-review" : ""} ${status.className === "missing" ? "missing" : ""}" data-lang="${escapeAttribute(language.code)}" type="button" role="tab" aria-selected="${language.code === currentEditorLang}" tabindex="${language.code === currentEditorLang ? "0" : "-1"}">
      ${escapeHtml(language.label)}
      <span class="translation-status ${escapeAttribute(status.className)}">${escapeHtml(status.label)}</span>
    </button>
  `;
  }).join("");
  editorLanguageTabs = editorLanguageTabsContainer.querySelectorAll(".tab[data-lang]");
}

editorLanguageTabsContainer?.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab[data-lang]");
  if (!tab || !editorLanguageTabsContainer.contains(tab)) return;
  setEditorLanguage(tab.dataset.lang);
});

editorLanguageTabsContainer?.addEventListener("keydown", (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(editorLanguageTabsContainer.querySelectorAll('.tab[data-lang]:not(:disabled)'));
  const currentIndex = tabs.indexOf(document.activeElement);
  if (currentIndex < 0 || !tabs.length) return;
  event.preventDefault();
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  const nextTab = tabs[nextIndex];
  setEditorLanguage(nextTab.dataset.lang);
  nextTab.focus();
});

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
  renderEditorPhotoState(dish);
}

async function preparePendingEditorPhotoAssets(dishId, draft) {
  if (!editorPendingOriginalPhoto || !editorPendingMenuPhotoBlob) return null;
  const pendingMatchesDraft = editorPendingPhotoDraftId === String(currentEditorDishId || draft?.id || "new");
  if (!pendingMatchesDraft) return null;
  const metadata = {
    photoOriginalName: editorPendingOriginalPhoto.name || "imagen-original",
    photoOriginalType: editorPendingOriginalPhoto.type || "application/octet-stream",
    photoOriginalSize: editorPendingOriginalPhoto.size || 0
  };
  if (canPublishRemoteMenuCatalog()) {
    return {
      ...metadata,
      ...(await uploadImportedMenuPhoto(dishId, editorPendingOriginalPhoto, editorPendingMenuPhotoBlob)),
      photoOriginalStorageKey: "",
      localStorageKey: ""
    };
  }
  const localStorageKey = `${businessId}:${dishId}:${Date.now().toString(36)}-${window.crypto?.randomUUID?.() || fallbackId()}`;
  await storeLocalOriginalPhoto(localStorageKey, editorPendingOriginalPhoto);
  return {
    ...metadata,
    photo: draft.photo,
    photoOriginal: "",
    photoOriginalStorageKey: localStorageKey,
    photoStoragePath: "",
    photoOriginalStoragePath: "",
    uploadedPaths: [],
    localStorageKey
  };
}

function clearPendingEditorPhoto() {
  editorPendingOriginalPhoto = null;
  editorPendingMenuPhotoBlob = null;
  editorPendingPhotoDraftId = "";
}

async function saveEditorDish({ silent = false } = {}) {
  const draft = syncEditorDraftFromControls();
  let dish = menuItems.find((item) => item.id === currentEditorDishId);
  if (!draft) return null;
  if (!validateEditorDraftForSave(draft)) return null;
  if (supabase && !canPublishRemoteMenuCatalog() && !isLocalDevOwner()) {
    showToast("Inicia sesion como owner para publicar el menu para todos.");
    return null;
  }
  const previousItems = serializedMenuItems();
  const previousEditorDishId = currentEditorDishId;
  const translations = ensureDishTranslations(draft);
  const primaryText = translations[primaryLanguageCode] || translations[currentEditorLang];
  const nextId = dish?.id || uniqueDishId(primaryText?.name || draft.name);
  const previousPhotoState = dish ? {
    photoStoragePath: dish.photoStoragePath || "",
    photoOriginalStoragePath: dish.photoOriginalStoragePath || "",
    photoOriginalStorageKey: dish.photoOriginalStorageKey || ""
  } : { photoStoragePath: "", photoOriginalStoragePath: "", photoOriginalStorageKey: "" };
  let preparedPhotoAssets = null;
  try {
    preparedPhotoAssets = await preparePendingEditorPhotoAssets(nextId, draft);
    if (preparedPhotoAssets) {
      Object.assign(draft, {
        photo: preparedPhotoAssets.photo,
        photoOriginal: preparedPhotoAssets.photoOriginal,
        highQualityPhoto: preparedPhotoAssets.photoOriginal,
        photoOriginalName: preparedPhotoAssets.photoOriginalName,
        photoOriginalType: preparedPhotoAssets.photoOriginalType,
        photoOriginalSize: preparedPhotoAssets.photoOriginalSize,
        photoOriginalStorageKey: preparedPhotoAssets.photoOriginalStorageKey,
        photoStoragePath: preparedPhotoAssets.photoStoragePath,
        photoOriginalStoragePath: preparedPhotoAssets.photoOriginalStoragePath
      });
    }
  } catch (error) {
    showToast(displayError(error));
    return null;
  }
  if (!dish) {
    dish = {
      id: nextId,
      brand: draft.brand,
      category: draft.category,
      name: primaryText?.name?.trim() || draft.name,
      description: primaryText?.description?.trim() || draft.description,
      presentations: [],
      photo: draft.photo,
      photoOriginal: draft.photoOriginal || "",
      photoOriginalName: draft.photoOriginalName || "",
      photoOriginalType: draft.photoOriginalType || "",
      photoOriginalSize: Number(draft.photoOriginalSize || 0),
      photoOriginalStorageKey: draft.photoOriginalStorageKey || "",
      photoStoragePath: draft.photoStoragePath || "",
      photoOriginalStoragePath: draft.photoOriginalStoragePath || "",
      visible: Boolean(draft.visible),
      soldOut: Boolean(draft.soldOut),
      lastEditedAt: "",
      lastEditedBy: ""
    };
    menuItems.unshift(dish);
    currentEditorDishId = dish.id;
  }

  dish.name = primaryText?.name?.trim() || dish.name;
  dish.description = primaryText?.description?.trim() || dish.description;
  dish.translations = JSON.parse(JSON.stringify(translations));
  normalizeTranslationReview(draft);
  dish.translationReview = JSON.parse(JSON.stringify(draft.translationReview || {}));
  dish.brand = brandSelect.value;
  dish.category = categorySelect.value;
  dish.photo = draft.photo;
  dish.photoOriginal = draft.photoOriginal || draft.highQualityPhoto || "";
  dish.highQualityPhoto = dish.photoOriginal;
  dish.photoOriginalName = draft.photoOriginalName || "";
  dish.photoOriginalType = draft.photoOriginalType || "";
  dish.photoOriginalSize = Number(draft.photoOriginalSize || 0);
  dish.photoOriginalStorageKey = draft.photoOriginalStorageKey || "";
  dish.photoStoragePath = draft.photoStoragePath || "";
  dish.photoOriginalStoragePath = draft.photoOriginalStoragePath || "";
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
  normalizeTranslationReview(editorDraft);
  try {
    await publishMenuCatalog();
  } catch (error) {
    await removeRemoteMenuImages(
      preparedPhotoAssets?.uploadedPaths || [],
      preparedPhotoAssets?.uploadedOriginalPaths || []
    );
    if (preparedPhotoAssets?.localStorageKey) {
      await deleteLocalOriginalPhoto(preparedPhotoAssets.localStorageKey).catch(() => null);
    }
    applyMenuItemsState(previousItems);
    persistMenuState();
    currentEditorDishId = previousEditorDishId;
    showToast(displayError(error));
    renderAdminMenu();
    renderAdminContent();
    renderAdminLibrary();
    renderList();
    return null;
  }
  if (preparedPhotoAssets) {
    await removeRemoteMenuImages(
      [previousPhotoState.photoStoragePath],
      [previousPhotoState.photoOriginalStoragePath]
    );
    if (previousPhotoState.photoOriginalStorageKey
      && previousPhotoState.photoOriginalStorageKey !== preparedPhotoAssets.photoOriginalStorageKey) {
      await deleteLocalOriginalPhoto(previousPhotoState.photoOriginalStorageKey).catch(() => null);
    }
    clearPendingEditorPhoto();
  }
  normalizeCurrentCategory();

  editorTitle.textContent = dish.name;
  renderEditorMeta(editorDraft);
  descCount.textContent = dishDescriptionInput.value.length;
  updateEditorActionState(editorDraft);
  renderEditorPhotoState(editorDraft);
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
    clearPendingEditorPhoto();
    editorDraft = newDishDraft();
    editorPreviewDraft = null;
  }
  currentEditorLang = primaryLanguageCode;
  lastEditedEditorLang = primaryLanguageCode;
  ensureDishTranslations(editorDraft);
  normalizeTranslationReview(editorDraft);
  renderEditorForm();
  editorPanel.classList.add("open");
}

function openAdminEditor(dishId) {
  const dish = menuItems.find((item) => item.id === dishId) || menuItems[0];
  if (!dish) return;
  const keepPreviewDraft = editorDraft?.id === dish.id && editorPreviewDraft?.id === dish.id;
  currentEditorDishId = dish.id;
  if (!keepPreviewDraft) {
    clearPendingEditorPhoto();
    editorDraft = cloneDishForEditor(dish);
    editorPreviewDraft = null;
  }
  currentEditorLang = primaryLanguageCode;
  lastEditedEditorLang = primaryLanguageCode;
  ensureDishTranslations(editorDraft);
  normalizeTranslationReview(editorDraft);
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
  const sourceLang = lastEditedEditorLang || currentEditorLang || primaryLanguageCode;
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
        targetLangs: languageCodes
      }
    });
    if (error) throw error;
    const translated = data?.translations || {};
    languageCodes.forEach((lang) => {
      const text = normalizeTranslatedText(translated[lang]);
      if (text.name || text.description) {
        translations[lang] = {
          name: text.name || translations[lang]?.name || dish.name,
          description: text.description || translations[lang]?.description || dish.description
        };
        markTranslationReview(
          dish,
          lang,
          lang === primaryLanguageCode ? "base" : translationReviewRequired ? "needs_review" : "reviewed",
          lang === sourceLang ? "manual" : "ai"
        );
      }
    });
    dish.name = translations[primaryLanguageCode]?.name || dish.name;
    dish.description = translations[primaryLanguageCode]?.description || dish.description;
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

async function refreshAuthenticatedCustomer(options = {}) {
  const silent = Boolean(options.silent);
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
    if (!silent) {
      showToast(displayError(error));
    } else if (import.meta.env.DEV) {
      console.warn("[Sumi customer] refresh failed", error);
    }
  }
  renderList();
  renderLoyalty();
  if (profileModal && !profileModal.hidden) renderProfile();
}

function shouldAutoRefreshCustomer() {
  return Boolean(supabase && currentSession?.user && isAuthenticated() && !isStaff());
}

function stopCustomerAutoRefresh() {
  if (!customerRefreshTimer) return;
  window.clearInterval(customerRefreshTimer);
  customerRefreshTimer = null;
}

function startCustomerAutoRefresh() {
  if (customerRefreshTimer || !shouldAutoRefreshCustomer()) return;
  customerRefreshTimer = window.setInterval(async () => {
    if (customerRefreshInFlight || !shouldAutoRefreshCustomer() || document.hidden) return;
    customerRefreshInFlight = true;
    try {
      await refreshAuthenticatedCustomer({ silent: true });
    } finally {
      customerRefreshInFlight = false;
    }
  }, customerRefreshIntervalMs);
}

async function handleSession(session) {
  currentSession = session;
  if (!session?.user) {
    stopCustomerAutoRefresh();
    stopAdminAutoRefresh();
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
  if (shouldAutoRefreshCustomer()) {
    startCustomerAutoRefresh();
  } else {
    stopCustomerAutoRefresh();
  }
  if (shouldAutoRefreshAdmin()) {
    startAdminAutoRefresh();
  } else {
    stopAdminAutoRefresh();
  }
  await refreshDishLikes();
  await loadBusinessMenuSettings();
  const route = parseRoute();
  if (route.name.startsWith("admin")) {
    await renderRoute();
  } else {
    renderList();
  }
}

async function initializeAuth() {
  const previewParams = new URLSearchParams(window.location.search);
  const previewHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const explicitLocalPreview = Boolean(
    import.meta.env.DEV
    && previewHost
    && (previewParams.get("owner-preview") === "1" || previewParams.get("employee-preview") === "1")
  );

  // Explicit preview URLs are deterministic fixtures. They must not wait for
  // a real Supabase session or inherit the role already signed in on localhost.
  if (explicitLocalPreview) {
    currentSession = null;
    currentCustomer = null;
    pointsBalance = 0;
    stopCustomerAutoRefresh();
    stopAdminAutoRefresh();
    loadLocalDishLikes();
    loadLocalMenuSettings();
    renderAuthState();
    await renderRoute();
    traceInit("preview:route-complete");
    return;
  }

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
          <strong>${escapeHtml(localPresentationName(presentation))}</strong>
          <small>${escapeHtml(presentation.translations?.[currentLang]?.note || (currentLang === primaryLanguageCode ? presentation.note : "") || presentationAvailableLabel())}</small>
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
  setCurrentLanguage(button.dataset.enterLang, { navigateToMenu: true });
});

languageMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-enter-lang]");
  if (!button) return;
  setCurrentLanguage(button.dataset.enterLang);
});

signupCta.addEventListener("click", () => openSignupModal(signupCta));
signupClose.addEventListener("click", closeSignupModal);
signupModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-signup-close]")) closeSignupModal();
  const passwordToggle = event.target.closest("[data-password-target]");
  if (!passwordToggle) return;
  const input = document.getElementById(passwordToggle.dataset.passwordTarget || "");
  if (!(input instanceof HTMLInputElement)) return;
  const showPassword = input.type === "password";
  input.type = showPassword ? "text" : "password";
  passwordToggle.setAttribute("aria-label", showPassword ? "Ocultar contrasena" : "Mostrar contrasena");
  passwordToggle.querySelector("use")?.setAttribute("href", showPassword ? "#icon-eye-off" : "#icon-eye");
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
staffManualButton?.addEventListener("click", () => openManualConsumptionModal(staffManualButton));
staffRedemptionQueueEl?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-staff-redemption-action]");
  if (!button || button.disabled) return;
  button.disabled = true;
  updateRedemptionStatus(button.dataset.redemptionId, button.dataset.staffRedemptionAction)
    .finally(() => { button.disabled = false; });
});
staffLogoutButton?.addEventListener("click", async () => {
  if (isLocalDevEmployee()) {
    window.localStorage.removeItem(localDevEmployeeStorageKey);
    window.location.assign(`${window.location.origin}${window.location.pathname}#/menu`);
    return;
  }
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    showToast(displayError(error));
    return;
  }
  currentSession = null;
  currentCustomer = null;
  lastStaffConsumption = null;
  renderAuthState();
  renderList();
  showToast(labels[currentLang].profileLoggedOut || "Sesion cerrada");
});
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

consumptionCustomerSearch?.addEventListener("input", () => {
  window.clearTimeout(consumptionCustomerSearch._sumiTimer);
  consumptionCustomerSearch._sumiTimer = window.setTimeout(() => {
    loadConsumptionCustomerResults(consumptionCustomerSearch.value.trim());
  }, 180);
});

consumptionCustomerResultsEl?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-consumption-customer]");
  if (!button) return;
  selectConsumptionCustomer(button.dataset.consumptionCustomer);
});

consumptionStartForm?.addEventListener("click", () => {
  renderConsumptionCustomer();
  if (consumptionScannerStatus) consumptionScannerStatus.textContent = "Carga el monto. Los productos son opcionales.";
  consumptionAmount?.focus();
});

consumptionShowRewards?.addEventListener("click", () => {
  const rewards = customerAvailableRewards(activeConsumptionCustomer);
  if (!rewards.length) {
    showToast("Este cliente todavia no tiene premios disponibles.");
    return;
  }
  consumptionQuickRewards?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  showToast("Premios disponibles visibles en la ficha.");
});

consumptionAmount?.addEventListener("input", updateConsumptionPointsPreview);
  consumptionCategory?.addEventListener("change", () => {
    activePresentationDishId = "";
    renderConsumptionCatalog();
  });

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

adminHome?.addEventListener("click", (event) => {
  const redemptionButton = event.target.closest("[data-redemption-action]");
  if (redemptionButton && !redemptionButton.disabled) {
    updateRedemptionStatus(redemptionButton.dataset.redemptionId, redemptionButton.dataset.redemptionAction);
    return;
  }

  const homeActionButton = event.target.closest("[data-home-action]");
  if (homeActionButton?.dataset.homeAction === "more-redemptions") {
    visibleUrgentRedemptions += urgentRedemptionsPageSize;
    renderAdminAnalytics();
    return;
  }
  if (homeActionButton?.dataset.homeAction === "more-activity") {
    visibleHomeRecentActivity += homeRecentActivityPageSize;
    renderAdminAnalytics();
    return;
  }

  const button = event.target.closest("[data-analytics-action]");
  if (!button) return;
  const action = button.dataset.analyticsAction;
  if (action === "consumption") {
    openManualConsumptionModal(button);
    return;
  }
  if (action === "scan-customer") {
    openConsumptionModal(button);
    return;
  }
  if (action === "menu-qr") {
    navigate("admin-section", { view: "qrs" });
    return;
  }
  if (action === "public-menu") {
    navigate("menu");
    return;
  }
  if (action === "content") {
    const dishId = button.dataset.dishId;
    if (dishId && menuItems.some((dish) => dish.id === dishId)) selectedContentDishId = dishId;
    navigate("admin-section", { view: "content" });
    return;
  }
  if (["menu", "customers", "consumptions", "rewards", "qrs", "library"].includes(action)) {
    navigate("admin-section", { view: action });
  }
});

adminPanel?.addEventListener("click", async (event) => {
  const retryButton = event.target.closest("[data-admin-retry-data]");
  if (!retryButton || retryButton.disabled) return;
  retryButton.disabled = true;
  await reloadAdminData();
});

homeRecentPanel?.addEventListener("click", (event) => {
  const activityButton = event.target.closest("[data-activity-id]");
  if (!activityButton) return;
  openActivityDrawer(activityButton.dataset.activityId);
});

activityDrawerClose?.addEventListener("click", closeActivityDrawer);
activityDrawer?.addEventListener("click", async (event) => {
  if (event.target.closest("[data-activity-close]")) {
    closeActivityDrawer();
    return;
  }
  const redemptionButton = event.target.closest("[data-redemption-action]");
  if (redemptionButton && !redemptionButton.disabled) {
    await updateRedemptionStatus(redemptionButton.dataset.redemptionId, redemptionButton.dataset.redemptionAction);
    if (activeActivityId) {
      const detail = activityDetail(activeActivityId);
      if (detail) {
        activityDrawerKicker.textContent = detail.kicker;
        activityDrawerTitle.textContent = detail.title;
        activityDrawerBody.innerHTML = detail.body;
      } else {
        closeActivityDrawer();
      }
    }
    return;
  }
  const actionButton = event.target.closest("[data-activity-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.activityAction;
  if (action === "view-customer") {
    closeActivityDrawer();
    const customerId = actionButton.dataset.customerId || "";
    if (adminCustomerSearchInput) adminCustomerSearchInput.value = "";
    activeAdminCustomerId = customerId;
    navigate("admin-section", { view: "customers" });
    if (customerId) window.requestAnimationFrame(() => openAdminCustomerDetail(customerId));
    return;
  }
  if (action === "load-consumption") {
    closeActivityDrawer();
    openManualConsumptionModal(actionButton);
  }
});

adminSearchInput.addEventListener("input", renderAdminMenu);
adminCustomerSearchInput?.addEventListener("input", renderAdminCustomers);
[adminCustomerTierFilter, adminCustomerStatusFilter, adminCustomerActivityFilter, adminCustomerSortFilter]
  .forEach((filter) => filter?.addEventListener("change", renderAdminCustomers));
adminCustomerRows?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-customer-action]");
  const row = event.target.closest("[data-customer-id]");
  const customerId = actionButton?.dataset.customerId || row?.dataset.customerId || "";
  if (!customerId) return;
  const action = actionButton?.dataset.customerAction || "detail";
  if (action === "consume") {
    openConsumptionModalForCustomer(customerId, actionButton || row);
    return;
  }
  if (action === "qr") {
    openAdminCustomerQr(customerId, actionButton || row);
    return;
  }
  openAdminCustomerDetail(customerId);
});
adminCustomerDetailPanel?.addEventListener("click", (event) => {
  const redemptionButton = event.target.closest("[data-redemption-action]");
  if (redemptionButton && !redemptionButton.disabled) {
    updateRedemptionStatus(redemptionButton.dataset.redemptionId, redemptionButton.dataset.redemptionAction);
    return;
  }
  const actionButton = event.target.closest("[data-customer-action]");
  if (!actionButton) return;
  const customerId = actionButton.dataset.customerId || activeAdminCustomerId;
  if (actionButton.dataset.customerAction === "consume") {
    openConsumptionModalForCustomer(customerId, actionButton);
    return;
  }
  if (actionButton.dataset.customerAction === "qr") {
    openAdminCustomerQr(customerId, actionButton);
    return;
  }
  if (actionButton.dataset.customerAction === "status") {
    const select = [...adminCustomerDetailPanel.querySelectorAll("[data-customer-status-select]")]
      .find((element) => element.dataset.customerStatusSelect === customerId);
    updateAdminCustomerStatus(customerId, select?.value || "active", actionButton);
    return;
  }
  if (actionButton.dataset.customerAction === "adjust-points") {
    adjustAdminCustomerPoints(customerId, actionButton);
  }
});
adminCustomerDetailClose?.addEventListener("click", closeAdminCustomerDetail);
[
  adminConsumptionDateFromFilter,
  adminConsumptionDateToFilter,
  adminConsumptionClientFilter,
  adminConsumptionMinFilter,
  adminConsumptionMaxFilter,
  adminConsumptionProductFilter,
  adminConsumptionNoteFilter
].forEach((filter) => filter?.addEventListener("input", renderAdminConsumptions));
[adminConsumptionCategoryFilter, adminConsumptionEmployeeFilter, adminConsumptionMethodFilter, adminConsumptionStatusFilter]
  .forEach((filter) => filter?.addEventListener("change", renderAdminConsumptions));
adminConsumptionFilterReset?.addEventListener("click", resetAdminConsumptionFilters);
adminConsumptionRows?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-consumption-action]");
  const row = event.target.closest("[data-consumption-id]");
  const consumptionId = actionButton?.dataset.consumptionId || row?.dataset.consumptionId || "";
  if (!consumptionId) return;
  openAdminConsumptionDetail(consumptionId);
});
adminConsumptionDetailPanel?.addEventListener("click", (event) => {
  const consumptionButton = event.target.closest("[data-consumption-action]");
  if (consumptionButton?.dataset.consumptionAction === "cancel") {
    cancelConsumption(consumptionButton.dataset.consumptionId);
    return;
  }
  if (consumptionButton?.dataset.consumptionAction === "correct") {
    correctConsumption(consumptionButton.dataset.consumptionId, consumptionButton);
    return;
  }
  const customerButton = event.target.closest("[data-customer-action]");
  if (customerButton?.dataset.customerAction === "consume") {
    openConsumptionModalForCustomer(customerButton.dataset.customerId || "", customerButton);
    return;
  }
  const activityButton = event.target.closest("[data-activity-action]");
  if (activityButton?.dataset.activityAction === "view-customer") {
    const customerId = activityButton.dataset.customerId || "";
    closeAdminConsumptionDetail();
    activeAdminCustomerId = customerId;
    navigate("admin-section", { view: "customers" });
    if (customerId) window.requestAnimationFrame(() => openAdminCustomerDetail(customerId));
  }
});
adminConsumptionDetailClose?.addEventListener("click", closeAdminConsumptionDetail);
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
    await loadAiCreditEvents().catch(() => aiCreditEvents);
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

adminContentBackgroundMode?.addEventListener("change", () => {
  selectedContentBackgroundMode = adminContentBackgroundMode.value === "dynamic" ? "dynamic" : "static";
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

adminLoyaltyRulesForm?.addEventListener("submit", saveLoyaltyRules);
adminRewardForm?.addEventListener("submit", saveAdminReward);
adminRewardCancelEdit?.addEventListener("click", resetAdminRewardForm);

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
  const moreButton = event.target.closest("[data-redemptions-more]");
  if (moreButton) {
    visibleAdminRedemptions += adminRedemptionsPageSize;
    renderAdminRedemptions();
    return;
  }
  const button = event.target.closest("[data-redemption-action]");
  if (!button || button.disabled) return;
  updateRedemptionStatus(button.dataset.redemptionId, button.dataset.redemptionAction);
});

adminRedemptionSearchInput?.addEventListener("input", (event) => {
  adminRedemptionSearch = event.target.value || "";
  visibleAdminRedemptions = adminRedemptionsPageSize;
  renderAdminRedemptions();
});

adminRedemptionStatusFilter?.addEventListener("change", (event) => {
  adminRedemptionStatus = event.target.value || "all";
  visibleAdminRedemptions = adminRedemptionsPageSize;
  renderAdminRedemptions();
});

adminRewardImagePicker?.addEventListener("click", () => adminRewardImageInput?.click());

adminRewardImageInput?.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Elige una imagen PNG, JPG o WebP.");
    event.target.value = "";
    return;
  }
  setAdminRewardImageDraft({ file });
  event.target.value = "";
});

adminRewardImagePicker?.addEventListener("paste", (event) => {
  const item = [...(event.clipboardData?.items || [])].find((candidate) => candidate.type.startsWith("image/"));
  const file = item?.getAsFile();
  if (!file) {
    showToast("Copia una imagen y vuelve a pegarla aqui.");
    return;
  }
  event.preventDefault();
  setAdminRewardImageDraft({ file });
  showToast("Imagen pegada. Guarda el premio para publicarla.");
});

adminRewardImageRemove?.addEventListener("click", () => setAdminRewardImageDraft());

adminRewardRows?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-reward-action]");
  if (!button) return;
  const rewardKey = button.dataset.rewardKey || "";
  if (button.dataset.rewardAction === "edit") {
    editAdminReward(rewardKey);
    return;
  }
  if (button.dataset.rewardAction === "toggle") {
    toggleAdminReward(rewardKey);
    return;
  }
  if (button.dataset.rewardAction === "delete") {
    deleteAdminReward(rewardKey);
  }
});

[adminQrUse, adminQrGoal, adminQrTone, adminQrStyle, adminQrColor].forEach((control) => {
  control?.addEventListener("change", () => {
    if (adminQrText) adminQrText.value = adminQrSuggestedText();
    renderAdminQrs();
  });
});
adminQrText?.addEventListener("input", () => renderAdminQrs());
adminQrRefreshPreview?.addEventListener("click", renderAdminQrs);
adminQrDownloadPng?.addEventListener("click", downloadAdminQrPoster);
adminQrDownloadPdf?.addEventListener("click", downloadAdminQrPdf);

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
  clearPendingEditorPhoto();
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
downloadOriginalPhotoButton?.addEventListener("click", downloadEditorOriginalPhoto);

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

profileReferralButton?.addEventListener("click", async () => {
  const link = customerReferralLink();
  if (!link) {
    showToast("Todavia no hay codigo de referido.");
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    showToast("Link de referido copiado.");
  } catch {
    showToast(link);
  }
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
          business_id: businessId,
          referrer_code: activeReferralCode()
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
    recordMenuEvent("signup_complete", "", { once: false });

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

let categoryDragState = null;
let suppressCategoryClickUntil = 0;

categoryStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button || !categoryStrip.contains(button)) return;
  if (performance.now() < suppressCategoryClickUntil) return;
  activateCategory(button.dataset.category);
});

categoryStrip.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const buttons = [...categoryStrip.querySelectorAll("[data-category]")];
  if (!buttons.length) return;

  const currentButton = event.target.closest("[data-category]");
  const currentIndex = Math.max(0, buttons.indexOf(currentButton));
  const isRtl = document.body.dir === "rtl";
  let nextIndex = currentIndex;

  if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = buttons.length - 1;
  else {
    const visualStep = event.key === "ArrowRight" ? 1 : -1;
    nextIndex = (currentIndex + (isRtl ? -visualStep : visualStep) + buttons.length) % buttons.length;
  }

  event.preventDefault();
  activateCategory(buttons[nextIndex].dataset.category, { focus: true });
});

categoryStrip.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse" || event.button !== 0) return;
  categoryDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startScrollLeft: categoryStrip.scrollLeft,
    moved: false,
  };
});

categoryStrip.addEventListener("pointermove", (event) => {
  if (!categoryDragState || event.pointerId !== categoryDragState.pointerId) return;
  const distance = event.clientX - categoryDragState.startX;
  if (!categoryDragState.moved && Math.abs(distance) > 8) {
    categoryDragState.moved = true;
    categoryStrip.setPointerCapture(event.pointerId);
    categoryStrip.classList.add("is-dragging");
  }
  if (!categoryDragState.moved) return;
  event.preventDefault();
  categoryStrip.scrollLeft = categoryDragState.startScrollLeft - distance;
});

function endCategoryDrag(event) {
  if (!categoryDragState || event.pointerId !== categoryDragState.pointerId) return;
  if (categoryDragState.moved) suppressCategoryClickUntil = performance.now() + 180;
  categoryDragState = null;
  categoryStrip.classList.remove("is-dragging");
  if (categoryStrip.hasPointerCapture(event.pointerId)) categoryStrip.releasePointerCapture(event.pointerId);
}

categoryStrip.addEventListener("pointerup", endCategoryDrag);
categoryStrip.addEventListener("pointercancel", endCategoryDrag);

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
      const { data, error } = await supabase.rpc("request_reward_redemption", {
        target_business_id: businessId,
        target_reward_id: reward.id,
        request_context: {
          source: "customer_card",
          language: currentLang,
          path: window.location.hash || "#/menu"
        }
      });
      if (error) {
        showToast(displayError(error));
        return;
      }
      createdRedemption = data?.redemption || data;
    } else if (currentCustomer?.profile) {
      createdRedemption = {
        id: fallbackId(),
        customer_id: currentCustomer.profile.id,
        business_id: businessId,
        reward_id: reward.id,
        reward_name: reward.name,
        points_cost: reward.cost,
        status: "requested",
        requested_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      };
    }
    if (createdRedemption) {
      currentCustomer.redemptions = [createdRedemption, ...(currentCustomer.redemptions || [])];
      renderLoyalty();
    }
    showToast(`Solicitud enviada: mostra esta pantalla al empleado para confirmar ${reward.name}.`);
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
  if (!languageMenu) return;
  const nextOpen = languageMenu.hidden;
  languageMenu.hidden = !nextOpen;
  languageToggle.setAttribute("aria-expanded", String(nextOpen));
  if (nextOpen) {
    const selected = languageMenu.querySelector('[aria-checked="true"]');
    window.requestAnimationFrame(() => selected?.focus());
  }
});

document.addEventListener("click", (event) => {
  if (!languageMenu || languageMenu.hidden || event.target.closest(".language-control")) return;
  closeLanguageMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && languageMenu && !languageMenu.hidden) {
    closeLanguageMenu({ restoreFocus: true });
    return;
  }
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
  if (event.key === "Escape" && activityDrawer && !activityDrawer.hidden) {
    closeActivityDrawer();
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
  trapActivityFocus(event);
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
captureReferralCodeFromUrl();
bindBrandButtons();
updateSignupShell();
updateQrShell();
updateProfileShell();
window.addEventListener("hashchange", () => {
  renderRoute();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (shouldAutoRefreshAdmin()) {
    startAdminAutoRefresh();
    refreshAdminIfVisible();
  } else {
    stopAdminAutoRefresh();
  }
  if (shouldAutoRefreshCustomer()) {
    startCustomerAutoRefresh();
    refreshAuthenticatedCustomer({ silent: true });
  }
});
document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (!image.matches(".customer-thumb img, .thumb img, .admin-asset-preview > img")) return;
  image.hidden = true;
  image.parentElement?.classList.add("is-image-error");
}, true);
if (parseRoute().name !== "landing") renderPublicMenuSkeleton();
await initializeAuth();
traceInit("module:complete");
