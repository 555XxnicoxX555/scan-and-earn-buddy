(() => {
  // Editable business data for this deployment.
  // Clone this folder for another business and update index.html to load its config.
const photos = {
  hummus: "https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=900&q=80",
  eggs: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
  shawarma: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=900&q=80",
  coffee: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80",
  turkishCoffee: "https://images.unsplash.com/photo-1601992425387-6826b5330846?auto=format&fit=crop&w=900&q=80",
  pizza: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80",
  dessert: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  rice: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=900&q=80",
  potatoes: "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?auto=format&fit=crop&w=900&q=80",
  argile: "https://images.unsplash.com/photo-1542444459-db63c59b5956?auto=format&fit=crop&w=900&q=80",
  coldCoffee: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
  frappe: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=80",
  smoothie: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&w=900&q=80",
  water: "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80",
  croissant: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80"
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
    loyalty: "Mis puntos",
    addPurchase: "Sumar compra",
    rewards: "Ver premios",
    earnDetail: "Sumar puntos por esta compra",
    empty: "No hay productos para mostrar.",
    copied: "Link copiado",
    changeLanguage: "Cambiar idioma",
    signupCta: "Ganar puntos",
    signupKicker: "Tarjeta Sumi",
    signupTitle: "Registrate y empieza a ganar puntos",
    signupText: "Crea tu cuenta, guarda tus visitas y desbloquea premios cada vez que compras.",
    signupName: "Nombre",
    signupEmail: "Gmail",
    signupPassword: "Contraseña",
    signupConfirm: "Repetir contraseña",
    signupSubmit: "Crear cuenta",
    signupClose: "Cerrar registro",
    signupPasswordMismatch: "Las contraseñas no coinciden.",
    signupInvalidEmail: "Usa una cuenta de Gmail valida.",
    signupWelcome: "Cuenta creada",
    signupSwitchPrompt: "Ya tienes una cuenta?",
    signupSwitchCta: "Iniciar sesion",
    loginTitle: "Inicia sesion y sigue ganando puntos",
    loginText: "Entra con tu Gmail para ver tus puntos y mantener tus visitas guardadas.",
    loginSubmit: "Iniciar sesion",
    loginSwitchPrompt: "No tienes cuenta?",
    loginSwitchCta: "Crear cuenta",
    loginRecoveryPrompt: "Olvidaste tu contrasena?",
    loginRecoveryCta: "Recuperar contrasena",
    loginWelcome: "Sesion iniciada",
    loginRecoverySent: "Te enviaremos instrucciones para recuperar tu contrasena.",
    qrButtonLabel: "Mostrar QR de cliente",
    qrKicker: "Mis puntos",
    qrTitle: "QR de cliente recurrente",
    qrText: "Muestra este codigo al empleado al finalizar tu consumo para acreditar tus puntos.",
    qrCustomerLabel: "ID de cliente",
    qrClose: "Cerrar QR",
    qrError: "No se pudo generar el QR. Intenta de nuevo.",
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
    loyalty: "My points",
    addPurchase: "Add purchase",
    rewards: "Rewards",
    earnDetail: "Earn points for this order",
    empty: "No items to show.",
    copied: "Link copied",
    changeLanguage: "Change language",
    signupCta: "Earn points",
    signupKicker: "Sumi Card",
    signupTitle: "Sign up and start earning points",
    signupText: "Create your account, save your visits, and unlock rewards every time you buy.",
    signupName: "Name",
    signupEmail: "Gmail",
    signupPassword: "Password",
    signupConfirm: "Repeat password",
    signupSubmit: "Create account",
    signupClose: "Close sign up",
    signupPasswordMismatch: "Passwords do not match.",
    signupInvalidEmail: "Use a valid Gmail account.",
    signupWelcome: "Account created",
    signupSwitchPrompt: "Already have an account?",
    signupSwitchCta: "Sign in",
    loginTitle: "Sign in and keep earning points",
    loginText: "Use your Gmail to see your points and keep your visits saved.",
    loginSubmit: "Sign in",
    loginSwitchPrompt: "No account yet?",
    loginSwitchCta: "Create account",
    loginRecoveryPrompt: "Forgot your password?",
    loginRecoveryCta: "Recover password",
    loginWelcome: "Signed in",
    loginRecoverySent: "We will send you password recovery instructions.",
    qrButtonLabel: "Show customer QR",
    qrKicker: "My points",
    qrTitle: "Returning customer QR",
    qrText: "Show this code to the team after your visit so they can add your points.",
    qrCustomerLabel: "Customer ID",
    qrClose: "Close QR",
    qrError: "We could not generate the QR. Try again.",
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
    loyalty: "نقاطي",
    addPurchase: "إضافة شراء",
    rewards: "المكافآت",
    earnDetail: "اكسب نقاط هذه الطلبية",
    empty: "لا توجد منتجات للعرض.",
    copied: "تم نسخ الرابط",
    changeLanguage: "تغيير اللغة",
    signupCta: "اكسب نقاط",
    signupKicker: "بطاقة Sumi",
    signupTitle: "سجل وابدأ بكسب النقاط",
    signupText: "أنشئ حسابك واحفظ زياراتك وافتح المكافآت مع كل عملية شراء.",
    signupName: "الاسم",
    signupEmail: "Gmail",
    signupPassword: "كلمة المرور",
    signupConfirm: "تأكيد كلمة المرور",
    signupSubmit: "إنشاء الحساب",
    signupClose: "إغلاق التسجيل",
    signupPasswordMismatch: "كلمتا المرور غير متطابقتين.",
    signupInvalidEmail: "استخدم حساب Gmail صالحا.",
    signupWelcome: "تم إنشاء الحساب",
    signupSwitchPrompt: "لديك حساب؟",
    signupSwitchCta: "تسجيل الدخول",
    loginTitle: "سجل الدخول واستمر بكسب النقاط",
    loginText: "ادخل بحساب Gmail لرؤية نقاطك وحفظ زياراتك.",
    loginSubmit: "تسجيل الدخول",
    loginSwitchPrompt: "ليس لديك حساب؟",
    loginSwitchCta: "إنشاء حساب",
    loginRecoveryPrompt: "نسيت كلمة المرور؟",
    loginRecoveryCta: "استعادة كلمة المرور",
    loginWelcome: "تم تسجيل الدخول",
    loginRecoverySent: "سنرسل لك تعليمات استعادة كلمة المرور.",
    qrButtonLabel: "عرض QR العميل",
    qrKicker: "نقاطي",
    qrTitle: "QR العميل المتكرر",
    qrText: "اعرض هذا الرمز للموظف بعد الاستهلاك لإضافة نقاطك.",
    qrCustomerLabel: "معرف العميل",
    qrClose: "إغلاق QR",
    qrError: "تعذر إنشاء QR. حاول مرة أخرى.",
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

const rewardCatalog = [
  { id: "coffee", name: "Cafe gratis", cost: 120 },
  { id: "dessert", name: "Postre sorpresa", cost: 240 },
  { id: "shawarma", name: "Shawarma 2x1", cost: 520 }
];

  window.SUMI_BUSINESS_CONFIG = {
    businessId: "sumi",
    appTitle: "Sumi Menu Admin",
    defaultLang: "es",
    defaultBrand: "Habibi Bites",
    defaultCategory: "Entradas",
    defaultDetailId: "shawarma-carne",
    initialPoints: 420,
    languages: [
      { code: "es", label: "Español", helper: "Continuar en español", flag: "mx", dir: "ltr" },
      { code: "en", label: "English", helper: "Continue in English", flag: "us", dir: "ltr" },
      { code: "ar", label: "العربية", helper: "متابعة بالعربية", flag: "lb", dir: "rtl" }
    ],
    recommendedByBrand: {
      "Habibi Bites": "shawarma-carne",
      "Croissant de Lune": "americano"
    },
    brandSwitcher: [
      { name: "Habibi Bites", labels: { es: "Libanes", en: "Lebanese", ar: "Libanes" } },
      { name: "Croissant de Lune", labels: { es: "Cafe & Desayunos", en: "Coffee & Breakfast", ar: "Cafe & Desayunos" } }
    ],
    landing: {
      venue: "Hipodromo Condesa - CDMX",
      sealLabel: "Habibi Bites & Coffee",
      sealMark: "HB",
      primaryName: "Habibi",
      secondaryName: "Bites & Coffee",
      partnerName: "& Croissant de Lune",
      cuisine: "Libano - Mexico - Francia",
      footer: [
        { title: "Tamaulipas 109", text: "H. Condesa, CDMX" },
        { title: "8:00 - 22:00", text: "todos los dias" }
      ]
    },
    admin: {
      brandMark: "HB",
      brandName: "Habibi Bites",
      ownerLabel: "Panel del dueno",
      helpTitle: "Necesitas ayuda?",
      helpText: "Te respondemos en WhatsApp en menos de una hora.",
      helpButton: "Abrir WhatsApp"
    },
    photos,
    categoryOrder,
    labels,
    categoryLabels,
    descriptionTranslations,
    nameTranslations,
    menuItems,
    rewardCatalog
  };
})();
