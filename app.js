const photos = {
  hummus: "assets/products/hummus.jpg",
  eggs: "assets/products/eggs.jpg",
  shawarma: "assets/products/shawarma.jpg",
  coffee: "assets/products/coffee.jpg",
  turkishCoffee: "assets/products/turkishCoffee.jpg",
  pizza: "assets/products/pizza.jpg",
  dessert: "assets/products/dessert.jpg",
  salad: "assets/products/salad.jpg",
  rice: "assets/products/rice.jpg",
  potatoes: "assets/products/potatoes.jpg",
  argile: "assets/products/argile.jpg",
  coldCoffee: "assets/products/coldCoffee.jpg",
  frappe: "assets/products/frappe.jpg",
  smoothie: "assets/products/smoothie.jpg",
  water: "assets/products/water.jpg",
  croissant: "assets/products/croissant.jpg"
};

const categoryOrder = {
  "Habibi Bites": ["Entradas", "Desayunos", "Comida Rapida", "Argile & Cafe", "Pizzas Libanesas"],
  "Croissant de Lune": ["Cafe", "Cafe Frio", "Frappe", "Smoothies", "Dulces Tentaciones", "Bebidas"]
};

const labels = {
  es: {
    recommended: "Hoy te recomendamos",
    search: "Buscar en el menu",
    results: "Resultados",
    dishes: "platillos",
    choose: "Elige tu presentacion",
    pairings: "Va perfecto con",
    badge: "Mas pedido",
    loyalty: "Tarjeta Sumi",
    addPurchase: "Sumar compra",
    rewards: "Ver premios",
    earnDetail: "Sumar puntos por esta compra",
    qrEarned: "QR escaneado",
    purchaseEarned: "Compra registrada",
    redeemed: "Premio solicitado",
    bronze: "Nivel Bronce",
    silver: "Nivel Plata",
    gold: "Nivel Oro",
    subtitles: { "Habibi Bites": "Comida libanesa", "Croissant de Lune": "Cafe & postres" }
  },
  en: {
    recommended: "Today we recommend",
    search: "Search menu",
    results: "Results",
    dishes: "items",
    choose: "Choose a presentation",
    pairings: "Perfect with",
    badge: "Best seller",
    loyalty: "Sumi Card",
    addPurchase: "Add purchase",
    rewards: "Rewards",
    earnDetail: "Earn points for this order",
    qrEarned: "QR scanned",
    purchaseEarned: "Purchase registered",
    redeemed: "Reward requested",
    bronze: "Bronze Level",
    silver: "Silver Level",
    gold: "Gold Level",
    subtitles: { "Habibi Bites": "Lebanese food", "Croissant de Lune": "Coffee & desserts" }
  },
  ar: {
    recommended: "نوصي اليوم",
    search: "ابحث في القائمة",
    results: "نتائج",
    dishes: "أطباق",
    choose: "اختر التقديم",
    pairings: "يناسب معه",
    badge: "الأكثر طلبا",
    loyalty: "بطاقة Sumi",
    addPurchase: "إضافة شراء",
    rewards: "المكافآت",
    earnDetail: "اكسب نقاط هذه الطلبية",
    qrEarned: "تم مسح QR",
    purchaseEarned: "تم تسجيل الشراء",
    redeemed: "تم طلب المكافأة",
    bronze: "المستوى البرونزي",
    silver: "المستوى الفضي",
    gold: "المستوى الذهبي",
    subtitles: { "Habibi Bites": "طعام لبناني", "Croissant de Lune": "قهوة وحلويات" }
  }
};

const categoryLabels = {
  es: {
    "Comida Rapida": "Comida Rápida",
    "Argile & Cafe": "Argile & Café",
    "Pizzas Libanesas": "Pizzas Libanesas",
    Cafe: "Café",
    "Cafe Frio": "Café Frío",
    Frappe: "Frappé",
    "Dulces Tentaciones": "Dulces Tentaciones"
  },
  en: {
    Entradas: "Starters",
    Desayunos: "Breakfast",
    "Comida Rapida": "Fast Food",
    "Argile & Cafe": "Argile & Coffee",
    "Pizzas Libanesas": "Lebanese Pizzas",
    Cafe: "Coffee",
    "Cafe Frio": "Cold Coffee",
    Frappe: "Frappe",
    Smoothies: "Smoothies",
    "Dulces Tentaciones": "Sweet Treats",
    Bebidas: "Drinks"
  },
  ar: {
    Entradas: "مقبلات",
    Desayunos: "فطور",
    "Comida Rapida": "وجبات سريعة",
    "Argile & Cafe": "أركيلة وقهوة",
    "Pizzas Libanesas": "مناقيش لبنانية",
    Cafe: "قهوة",
    "Cafe Frio": "قهوة باردة",
    Frappe: "فرابيه",
    Smoothies: "سموذي",
    "Dulces Tentaciones": "حلويات",
    Bebidas: "مشروبات"
  }
};

const descriptionTranslations = {
  en: {
    "Hummus tradicional con tahini, limon y aceite de oliva extra virgen.": "Traditional hummus with tahini, lemon and extra virgin olive oil.",
    "Hummus suave, carne molida especiada, pinones tostados y aceite de oliva.": "Smooth hummus, spiced ground beef, toasted pine nuts and olive oil.",
    "Jocoque cremoso con aceite de oliva y zaatar fresco.": "Creamy labneh with olive oil and fresh zaatar.",
    "Jocoque mezclado con ajo machacado y aceite de oliva.": "Labneh mixed with crushed garlic and olive oil.",
    "Carne de res marinada, cebolla, perejil, jitomate, tahini y reduccion de granada.": "Marinated beef, onion, parsley, tomato, tahini and pomegranate reduction.",
    "Espresso doble con agua caliente. Cuerpo limpio y aroma intenso.": "Double espresso with hot water. Clean body and intense aroma."
  },
  ar: {
    "Hummus tradicional con tahini, limon y aceite de oliva extra virgen.": "حمص تقليدي مع طحينة وليمون وزيت زيتون.",
    "Hummus suave, carne molida especiada, pinones tostados y aceite de oliva.": "حمص ناعم مع لحم متبل وصنوبر وزيت زيتون.",
    "Jocoque cremoso con aceite de oliva y zaatar fresco.": "لبنة كريمية مع زيت زيتون وزعتر.",
    "Jocoque mezclado con ajo machacado y aceite de oliva.": "لبنة مع ثوم مهروس وزيت زيتون.",
    "Carne de res marinada, cebolla, perejil, jitomate, tahini y reduccion de granada.": "لحم بقري متبل مع بصل وبقدونس وطماطم وطحينة ودبس رمان.",
    "Espresso doble con agua caliente. Cuerpo limpio y aroma intenso.": "إسبريسو مزدوج مع ماء ساخن ونكهة قوية."
  }
};

const nameTranslations = {
  es: {
    "Cafe Turco": "Café Turco",
    "Cafe Frio 16 oz": "Café Frío 16 oz",
    "Higado encebollado": "Hígado encebollado",
    "Pina, jugo verde o naranja, exprimido al momento.": "Piña, jugo verde o naranja, exprimido al momento."
  },
  en: {
    "Hummus con carne": "Hummus with Beef",
    "Papas asadas": "Roasted Potatoes",
    "Ensalada Libanesa": "Lebanese Salad",
    "Arroz con fideos": "Rice with Vermicelli",
    "Huevo a la cazuela": "Baked Eggs",
    "Shawarma de carne": "Beef Shawarma",
    "Shawarma de pollo": "Chicken Shawarma",
    "Cafe Turco": "Turkish Coffee",
    "Cafe Frio 16 oz": "Iced Coffee 16 oz",
    "Chocolate caliente": "Hot Chocolate",
    "Jugos naturales": "Fresh Juices",
    "Agua natural": "Still Water"
  },
  ar: {
    Hummus: "حمص",
    "Hummus con carne": "حمص باللحم",
    Jocoque: "لبنة",
    "Jocoque con ajo": "لبنة بالثوم",
    "Papas asadas": "بطاطا مشوية",
    "Ensalada Libanesa": "سلطة لبنانية",
    "Arroz con fideos": "أرز بالشعيرية",
    "Shawarma de carne": "شاورما لحم",
    "Shawarma de pollo": "شاورما دجاج",
    "Cafe Turco": "قهوة تركية",
    Americano: "أمريكانو",
    Cappuccino: "كابتشينو",
    Espresso: "إسبريسو"
  }
};

function item(id, brand, category, name, description, presentations, photo) {
  return { id, brand, category, name, description, presentations, photo, visible: true };
}

const wrapOptions = [
  { name: "Pan arabe", price: 145, note: "Envuelto, para llevar" },
  { name: "Tabliye", price: 185, note: "Sobre pan tabliye crujiente" },
  { name: "Plato", price: 210, note: "Servido en plato con guarnicion" }
];

const menuItems = [
  item("hummus", "Habibi Bites", "Entradas", "Hummus", "Hummus tradicional con tahini, limon y aceite de oliva extra virgen.", [{ name: "Plato", price: 120 }], photos.hummus),
  item("hummus-carne", "Habibi Bites", "Entradas", "Hummus con carne", "Hummus suave, carne molida especiada, pinones tostados y aceite de oliva.", [{ name: "Plato", price: 175 }], photos.hummus),
  item("jocoque", "Habibi Bites", "Entradas", "Jocoque", "Jocoque cremoso con aceite de oliva y zaatar fresco.", [{ name: "Plato", price: 120 }], photos.hummus),
  item("jocoque-ajo", "Habibi Bites", "Entradas", "Jocoque con ajo", "Jocoque mezclado con ajo machacado y aceite de oliva.", [{ name: "Plato", price: 130 }], photos.hummus),
  item("papas-asadas", "Habibi Bites", "Entradas", "Papas asadas", "Papas asadas con crema de ajo y especias libanesas.", [{ name: "Plato", price: 120 }], photos.potatoes),
  item("ensalada-libanesa", "Habibi Bites", "Entradas", "Ensalada Libanesa", "Mezcla fresca de jitomate, pepino, perejil, hierbabuena y limon.", [{ name: "Plato", price: 125 }], photos.salad),
  item("arroz-fideos", "Habibi Bites", "Entradas", "Arroz con fideos", "Arroz blanco con fideos tostados, clasico libanes.", [{ name: "Plato", price: 100 }], photos.rice),
  item("huevo-cazuela", "Habibi Bites", "Desayunos", "Huevo a la cazuela", "Huevos cocidos en cazuela con aceite de oliva y especias.", [{ name: "Plato", price: 110 }], photos.eggs),
  item("huevo-cazuela-morron-jocoque", "Habibi Bites", "Desayunos", "Huevo a la cazuela con morron y jocoque", "Huevos a la cazuela con morron asado y jocoque cremoso.", [{ name: "Plato", price: 135 }], photos.eggs),
  item("taouk", "Habibi Bites", "Comida Rapida", "Taouk", "Pollo marinado, papas asadas, ensalada de col, pepinillos, crema de ajo.", wrapOptions, photos.shawarma),
  item("kafta", "Habibi Bites", "Comida Rapida", "Kafta", "Mezcla de carne, hummus, mayonesa, jitomate, perejil, cebolla.", wrapOptions, photos.shawarma),
  item("shawarma-pollo", "Habibi Bites", "Comida Rapida", "Shawarma de pollo", "Pollo marinado 24 horas en especias libanesas, lechuga fresca, papas asadas, pepinillos en escabeche, crema de ajo picante y reduccion de granada.", wrapOptions, photos.shawarma),
  item("shawarma-carne", "Habibi Bites", "Comida Rapida", "Shawarma de carne", "Carne de res marinada, cebolla, perejil, jitomate, tahini y reduccion de granada.", wrapOptions, photos.shawarma),
  item("papas", "Habibi Bites", "Comida Rapida", "Papas", "Papas asadas, crema de ajo, ensalada de col, catsup.", [{ name: "Plato", price: 125 }], photos.potatoes),
  item("higado-encebollado", "Habibi Bites", "Comida Rapida", "Higado encebollado", "Higado preparado a la libanesa, hierbabuena, jitomate, crema de ajo.", wrapOptions, photos.shawarma),
  item("cafe-turco", "Habibi Bites", "Argile & Cafe", "Cafe Turco", "Cafe turco molido fino, servido en taza pequena o jarra.", [{ name: "Taza", price: 55 }, { name: "Jarra", price: 85 }], photos.turkishCoffee),
  item("argile", "Habibi Bites", "Argile & Cafe", "Argile", "Doble manzana, sandia-menta o limon-menta.", [{ name: "Servicio", price: 300 }], photos.argile),
  item("dedos-novia", "Habibi Bites", "Argile & Cafe", "Dedos de novia", "Pasta filo rellena de pistache y nueces, banada en almibar de azahar.", [{ name: "1 pieza", price: 40 }, { name: "3 piezas", price: 100 }, { name: "Medio kilo", price: 400 }], photos.dessert),
  item("pizza-zaatar", "Habibi Bites", "Pizzas Libanesas", "Pizza Zaatar", "Masa libanesa al horno con mezcla zaatar y aceite de oliva.", [{ name: "Individual", price: 120 }], photos.pizza),
  item("pizza-zaatar-queso", "Habibi Bites", "Pizzas Libanesas", "Pizza Zaatar con queso", "Masa libanesa con zaatar, aceite de oliva y queso fundido.", [{ name: "Individual", price: 150 }], photos.pizza),
  item("pizza-zaatar-verduras", "Habibi Bites", "Pizzas Libanesas", "Pizza Zaatar con verduras", "Pizza zaatar con jitomate, pepino, lechuga y aceitunas.", [{ name: "Individual", price: 135 }], photos.pizza),
  item("pizza-kafta", "Habibi Bites", "Pizzas Libanesas", "Pizza Kafta", "Masa libanesa con kafta de carne molida y cebolla.", [{ name: "Individual", price: 160 }], photos.pizza),
  item("pizza-queso", "Habibi Bites", "Pizzas Libanesas", "Pizza de queso", "Masa libanesa con queso fundido al horno.", [{ name: "Individual", price: 125 }], photos.pizza),
  item("pizza-jocoque-verduras", "Habibi Bites", "Pizzas Libanesas", "Pizza Jocoque con verduras", "Masa libanesa con jocoque cremoso, jitomate, pepino y aceitunas.", [{ name: "Individual", price: 130 }], photos.pizza),
  item("americano", "Croissant de Lune", "Cafe", "Americano", "Espresso doble con agua caliente. Cuerpo limpio y aroma intenso.", [{ name: "Taza", price: 60 }], photos.coffee),
  item("cappuccino", "Croissant de Lune", "Cafe", "Cappuccino", "Espresso con leche vaporizada y espuma cremosa.", [{ name: "Taza", price: 70 }], photos.coffee),
  item("flat-white", "Croissant de Lune", "Cafe", "Flat White", "Doble espresso con microespuma sedosa.", [{ name: "Taza", price: 75 }], photos.coffee),
  item("espresso", "Croissant de Lune", "Cafe", "Espresso", "Shot puro de cafe molido en el momento.", [{ name: "Shot", price: 45 }], photos.coffee),
  item("chocolate-caliente", "Croissant de Lune", "Cafe", "Chocolate caliente", "Chocolate fundido con leche vaporizada.", [{ name: "Taza", price: 80 }], photos.coffee),
  item("chai-latte", "Croissant de Lune", "Cafe", "Chai Latte", "Te chai especiado con leche vaporizada.", [{ name: "Taza", price: 95 }], photos.coffee),
  item("matcha", "Croissant de Lune", "Cafe", "Matcha", "Te matcha ceremonial con leche vaporizada.", [{ name: "Taza", price: 95 }], photos.coffee),
  item("latte-frio", "Croissant de Lune", "Cafe Frio", "Latte 16 oz", "Latte frio 16 oz. Sabores: sencillo, caramelo, vainilla, avellana, mocha, cajeta y mas.", [{ name: "16 oz", price: 85 }], photos.coldCoffee),
  item("cafe-frio-16", "Croissant de Lune", "Cafe Frio", "Cafe Frio 16 oz", "Cafe frio con sabores: sencillo, caramelo, vainilla, avellana, mocha, toffee, oreo.", [{ name: "16 oz", price: 90 }], photos.coldCoffee),
  item("malteadas", "Croissant de Lune", "Cafe Frio", "Malteadas 16 oz", "Sabores: fresa, lotus, oreo, chocolate, caramelo salado, vainilla, frutos rojos.", [{ name: "16 oz", price: 90 }], photos.coldCoffee),
  item("frappe-16", "Croissant de Lune", "Frappe", "Frappe 16 oz", "Frappe con sabores: sencillo, caramelo, salado, crema irlandesa, vainilla, avellana, mocha, toffee, oreo.", [{ name: "16 oz", price: 90 }], photos.frappe),
  item("smoothie-16", "Croissant de Lune", "Smoothies", "Smoothies 16 oz", "Sabores: pina colada, mango, fresa, mora azul, durazno-maracuya, limonada de frutos rojos, mango-fresa.", [{ name: "16 oz", price: 95 }], photos.smoothie),
  item("brownie-helado", "Croissant de Lune", "Dulces Tentaciones", "Brownie con helado", "Brownie tibio con bola de helado de vainilla.", [{ name: "Postre", price: 100 }], photos.dessert),
  item("croissant-mermelada", "Croissant de Lune", "Dulces Tentaciones", "Croissant con mermelada", "Croissant horneado en casa con mermelada artesanal.", [{ name: "Pieza", price: 65 }], photos.croissant),
  item("crepa-nutella", "Croissant de Lune", "Dulces Tentaciones", "Crepa de Nutella con lechera", "Crepa francesa rellena de Nutella y lechera.", [{ name: "Postre", price: 125 }], photos.dessert),
  item("crepa-nutella-frutos", "Croissant de Lune", "Dulces Tentaciones", "Crepa de Nutella con frutos rojos", "Crepa con Nutella y mezcla de frutos rojos frescos.", [{ name: "Postre", price: 155 }], photos.dessert),
  item("crepa-jamon-queso", "Croissant de Lune", "Dulces Tentaciones", "Crepa de jamon con queso", "Crepa salada con jamon y queso fundido.", [{ name: "Plato", price: 135 }], photos.dessert),
  item("agua-natural", "Croissant de Lune", "Bebidas", "Agua natural", "Botella 600 ml.", [{ name: "600 ml", price: 35 }], photos.water),
  item("jugos", "Croissant de Lune", "Bebidas", "Jugos naturales", "Pina, jugo verde o naranja, exprimido al momento.", [{ name: "Vaso", price: 70 }], photos.smoothie)
];

function productImage(id) {
  return `assets/menu/${id}.png`;
}

menuItems.forEach((dish) => {
  dish.photo = productImage(dish.id);
});

let currentLang = "es";
let currentBrand = "Habibi Bites";
let currentCategory = "Entradas";
let currentDetailId = "shawarma-carne";
let pointsBalance = 420;
let selectedPresentationIndex = 0;

const rewardCatalog = [
  { id: "coffee", name: "Cafe gratis", cost: 120 },
  { id: "dessert", name: "Postre sorpresa", cost: 240 },
  { id: "shawarma", name: "Shawarma 2x1", cost: 520 }
];

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
const brandButtons = document.querySelectorAll("[data-brand]");
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
  return currentBrand === "Habibi Bites"
    ? menuItems.find((dish) => dish.id === "shawarma-carne")
    : menuItems.find((dish) => dish.id === "americano");
}

function updateHeader() {
  restaurantName.textContent = currentBrand;
  restaurantSubtitle.textContent = labels[currentLang].subtitles[currentBrand];
  searchInput.placeholder = labels[currentLang].search;
  document.documentElement.lang = currentLang;
  document.body.dir = currentLang === "ar" ? "rtl" : "ltr";

  brandButtons.forEach((button) => {
    const active = button.dataset.brand === currentBrand;
    button.classList.toggle("active", active);
    button.querySelector("span").textContent =
      button.dataset.brand === "Habibi Bites" ? (currentLang === "en" ? "Lebanese" : "Libanes") : "Cafe & Desayunos";
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

document.querySelectorAll("[data-enter-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    currentLang = button.dataset.enterLang;
    document.body.classList.remove("landing-active");
    renderList();
  });
});

brandButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentBrand = button.dataset.brand;
    currentCategory = categoryOrder[currentBrand][0];
    searchInput.value = "";
    renderList();
  });
});

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
  const langs = ["es", "en", "ar"];
  currentLang = langs[(langs.indexOf(currentLang) + 1) % langs.length];
  renderList();
  if (detailView.classList.contains("open")) openDetail(currentDetailId);
});

renderList();
