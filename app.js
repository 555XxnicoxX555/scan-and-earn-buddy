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
const brandSwitcher = businessConfig.brandSwitcher || Object.keys(categoryOrder).map((name) => ({ name, labels: {} }));
const languages = businessConfig.languages || [
  { code: "es", label: "Español", helper: "Continuar en español", flag: "mx", dir: "ltr" },
  { code: "en", label: "English", helper: "Continue in English", flag: "us", dir: "ltr" },
  { code: "ar", label: "العربية", helper: "متابعة بالعربية", flag: "lb", dir: "rtl" }
];

let currentLang = businessConfig.defaultLang || "es";
let currentBrand = businessConfig.defaultBrand || brandSwitcher[0]?.name || Object.keys(categoryOrder)[0];
let currentCategory = businessConfig.defaultCategory || categoryOrder[currentBrand]?.[0];
let currentDetailId = businessConfig.defaultDetailId || menuItems[0]?.id;
let pointsBalance = businessConfig.initialPoints || 0;
let selectedPresentationIndex = 0;
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
const brandSwitch = document.querySelector(".brand-switch");
let brandButtons = document.querySelectorAll("[data-brand]");
const restaurantName = document.querySelector(".restaurant-lockup strong");
const restaurantSubtitle = document.querySelector(".restaurant-lockup span");
const searchToggle = document.querySelector("#searchToggle");
const languageToggle = document.querySelector("#languageToggle");
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

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) element.textContent = value;
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
        <button class="language-option ${language.code === currentLang ? "selected" : ""}" data-enter-lang="${language.code}" type="button">
          <span class="flag ${language.flag}" aria-hidden="true"></span>
          <span dir="${language.dir || "ltr"}">
            <strong>${language.label}</strong>
            <small>${language.helper}</small>
          </span>
          <i>&rarr;</i>
        </button>
      `
    )
    .join("");

  brandSwitch.innerHTML = brandSwitcher
    .map(
      (brand) => `
        <button class="${brand.name === currentBrand ? "active" : ""}" data-brand="${brand.name}" type="button">
          <strong>${brand.name}</strong>
          <span>${brand.labels?.[currentLang] || brand.name}</span>
        </button>
      `
    )
    .join("");
  brandButtons = document.querySelectorAll("[data-brand]");
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
  if (pointsBalance >= 1000) return { name: labels[currentLang].gold, next: null, floor: 1000, target: 1000 };
  if (pointsBalance >= 500) return { name: labels[currentLang].silver, next: labels[currentLang].gold, floor: 500, target: 1000 };
  return { name: labels[currentLang].bronze, next: labels[currentLang].silver, floor: 0, target: 500 };
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function addPoints(amount, reason) {
  pointsBalance += amount;
  renderLoyalty();
  showToast(`${reason}: +${amount} pts`);
}

function renderLoyalty() {
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
        <button class="reward-chip ${pointsBalance >= reward.cost ? "available" : ""}" data-reward="${reward.id}" type="button">
          <strong>${reward.name}</strong>
          <span>${reward.cost} pts</span>
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

  brandButtons.forEach((button) => {
    const active = button.dataset.brand === currentBrand;
    button.classList.toggle("active", active);
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
      return `<button class="${category === currentCategory ? "active" : ""}" data-category="${category}">${localCategory(category)} · ${count}</button>`;
    })
    .join("");
}

function renderRecommendation() {
  const dish = recommendedDish();
  const prices = dish.presentations.map((p) => `<b>${p.name} $${p.price}</b>`).join("");
  document.querySelector(".recommendation p").textContent = labels[currentLang].recommended;
  recommendedCard.dataset.id = dish.id;
  recommendedCard.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.75)), url('${dish.photo}')`;
  recommendedCard.innerHTML = `
    <span class="badge">${labels[currentLang].badge}</span>
    <strong>${localName(dish)}</strong>
    <small>${localDescription(dish)}</small>
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
  updateHeader();

  categoryTitle.textContent = query ? labels[currentLang].results : localCategory(currentCategory);
  categoryCount.textContent = `${filtered.length} ${labels[currentLang].dishes}`;

  dishList.innerHTML = filtered
    .map((dish) => {
      const firstPresentation = dish.presentations[0];
      return `
        <button class="customer-dish-card" data-id="${dish.id}" type="button">
          <span class="customer-thumb" style="background-image:url('${dish.photo}')"></span>
          <span class="customer-info">
            <strong>${localName(dish)}</strong>
            <small>${localDescription(dish)}</small>
            <b>${firstPresentation.name} · $${firstPresentation.price}</b>
          </span>
        </button>
      `;
    })
    .join("");
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
  detailOptions.innerHTML = dish.presentations
    .map(
      (presentation, index) => `
        <button class="detail-option ${index === 0 ? "selected" : ""}" data-presentation-index="${index}" type="button">
          <span></span>
          <strong>${presentation.name}</strong>
          <small>${presentation.note || "Presentacion disponible"}</small>
          <b>$${presentation.price}</b>
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
        <button class="pairing-card" data-id="${item.id}" type="button">
          <span style="background-image:url('${item.photo}')"></span>
          <strong>${localName(item)}</strong>
          <b>$${item.presentations[0].price}</b>
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
  renderList();
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
  detailOptions.querySelectorAll(".detail-option").forEach((button) => button.classList.remove("selected"));
  option.classList.add("selected");
});

scanQrButton.addEventListener("click", () => {
  addPoints(25, labels[currentLang].qrEarned);
});

addPurchaseButton.addEventListener("click", () => {
  addPoints(40, labels[currentLang].purchaseEarned);
});

earnDetailPoints.addEventListener("click", () => {
  const dish = menuItems.find((item) => item.id === currentDetailId);
  if (!dish) return;
  const presentation = dish.presentations[selectedPresentationIndex] || dish.presentations[0];
  const earned = Math.max(5, Math.round(presentation.price * 0.12));
  addPoints(earned, labels[currentLang].purchaseEarned);
});

rewardStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-reward]");
  if (!button) return;
  const reward = rewardCatalog.find((item) => item.id === button.dataset.reward);
  if (!reward) return;
  if (pointsBalance < reward.cost) {
    showToast(`${reward.cost - pointsBalance} pts restantes`);
    return;
  }
  pointsBalance -= reward.cost;
  renderLoyalty();
  showToast(`${labels[currentLang].redeemed}: ${reward.name}`);
});

rewardsButton.addEventListener("click", () => {
  rewardStrip.scrollIntoView({ block: "center", behavior: "smooth" });
});

document.querySelector("#detailBack").addEventListener("click", () => {
  detailView.classList.remove("open");
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
  if (detailView.classList.contains("open")) openDetail(currentDetailId);
});

applyBusinessShell();
bindBrandButtons();
renderList();
