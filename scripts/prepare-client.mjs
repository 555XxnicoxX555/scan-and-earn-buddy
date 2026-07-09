import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

const inputPath = resolve(process.cwd(), argValue("--config", "business.config.json"));
const dryRun = process.argv.includes("--dry-run");
const overwrite = process.argv.includes("--overwrite");

function requiredString(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function jsString(value) {
  return JSON.stringify(String(value ?? ""));
}

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : String(fallback);
}

function sqlBoolean(value) {
  return value === false ? "false" : "true";
}

function normalizePresentation(presentation = {}) {
  return {
    name: String(presentation.name || presentation.presentationName || "Plato"),
    price: String(presentation.price ?? presentation.pointsCost ?? 0),
    note: String(presentation.note || "")
  };
}

function normalizeProduct(product = {}, catalogName = "Catalogo principal", categoryName = "General", index = 0) {
  const name = requiredString(product.name || product.title, `menu.products[${index}].name`);
  const id = slugify(product.id || name) || `producto-${index + 1}`;
  const presentations = Array.isArray(product.presentations) && product.presentations.length
    ? product.presentations.map(normalizePresentation)
    : [normalizePresentation({ name: product.presentation || "Plato", price: product.price || 0 })];
  const description = String(product.description || product.shortDescription || "");
  return {
    id,
    brand: String(product.catalog || product.brand || catalogName),
    category: String(product.category || categoryName),
    name,
    description,
    presentations,
    photo: String(product.photo || product.image || product.imagePath || "assets/menu/placeholder.png"),
    visible: product.visible !== false,
    soldOut: Boolean(product.soldOut),
    translations: {
      es: { name, description },
      en: {
        name: product.translations?.en?.name || name,
        description: product.translations?.en?.description || description
      },
      ar: {
        name: product.translations?.ar?.name || name,
        description: product.translations?.ar?.description || description
      }
    }
  };
}

function flattenMenuProducts(config) {
  const catalogs = Array.isArray(config.menu?.catalogs) ? config.menu.catalogs : [];
  return catalogs.flatMap((catalog, catalogIndex) => {
    const catalogName = String(catalog.name || `Catalogo ${catalogIndex + 1}`);
    const categories = Array.isArray(catalog.categories) && catalog.categories.length ? catalog.categories : ["General"];
    const products = Array.isArray(catalog.products) ? catalog.products : [];
    return products.map((product, productIndex) =>
      normalizeProduct(product, catalogName, categories[0], productIndex)
    );
  });
}

function categoryOrderFromConfig(config, products) {
  const catalogs = Array.isArray(config.menu?.catalogs) ? config.menu.catalogs : [];
  const order = {};
  catalogs.forEach((catalog, index) => {
    const name = String(catalog.name || `Catalogo ${index + 1}`);
    const categories = Array.isArray(catalog.categories) && catalog.categories.length
      ? catalog.categories.map(String)
      : [...new Set(products.filter((product) => product.brand === name).map((product) => product.category))];
    order[name] = categories.length ? categories : ["General"];
  });
  if (!Object.keys(order).length && products.length) {
    const brand = products[0].brand || "Catalogo principal";
    order[brand] = [...new Set(products.map((product) => product.category))];
  }
  return order;
}

function rewardCatalogFromConfig(config) {
  return (Array.isArray(config.rewards) ? config.rewards : []).map((reward, index) => {
    const name = requiredString(reward.name, `rewards[${index}].name`);
    return {
      id: reward.rewardKey || reward.id || slugify(name) || `premio-${index + 1}`,
      rewardKey: reward.rewardKey || reward.id || slugify(name) || `premio-${index + 1}`,
      name,
      description: reward.description || "",
      cost: Number(reward.pointsCost ?? reward.cost ?? 0),
      stock: reward.stock ?? null,
      imageUrl: reward.imageUrl || reward.image_url || "",
      minTier: reward.minTier || "",
      validUntil: reward.validUntil || "",
      active: reward.active !== false
    };
  });
}

function aiCreditsFromConfig(config) {
  const credits = config.aiCredits || config.content?.aiCredits || {};
  return {
    planName: String(credits.planName || "Plan base"),
    monthlyLimit: Math.max(1, Number(credits.monthlyLimit || 150)),
    generationCreditCost: Math.max(1, Number(credits.generationCreditCost || 2)),
    lowBalanceWarningThreshold: Math.max(1, Number(credits.lowBalanceWarningThreshold || 20))
  };
}

function staffSecurityFromConfig(config) {
  const security = config.operations?.staffSecurity || {};
  return {
    maxEmployeePurchaseTotal: Math.max(1, Number(security.maxEmployeePurchaseTotal || 250000)),
    maxEmployeeDailyTotal: Math.max(1, Number(security.maxEmployeeDailyTotal || 1000000)),
    maxEmployeeDailyCount: Math.max(1, Math.floor(Number(security.maxEmployeeDailyCount || 80))),
    requireQrForEmployee: Boolean(security.requireQrForEmployee)
  };
}

function normalizedEmails(values = []) {
  return [...new Set(
    values
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  )];
}

function languageDefaults(code) {
  const normalized = String(code || "").trim().toLowerCase();
  const presets = {
    es: { label: "Espanol", helper: "Continuar en espanol", flag: "mx", dir: "ltr" },
    en: { label: "English", helper: "Continue in English", flag: "us", dir: "ltr" },
    ar: { label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", helper: "\u0645\u062a\u0627\u0628\u0639\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629", flag: "lb", dir: "rtl" },
    fr: { label: "Francais", helper: "Continuer en francais", flag: "fr", dir: "ltr" },
    pt: { label: "Portugues", helper: "Continuar em portugues", flag: "br", dir: "ltr" }
  };
  return {
    code: normalized,
    label: presets[normalized]?.label || normalized.toUpperCase(),
    helper: presets[normalized]?.helper || `Continuar en ${normalized.toUpperCase()}`,
    flag: presets[normalized]?.flag || normalized,
    dir: presets[normalized]?.dir || "ltr"
  };
}

function languagesFromConfig(config) {
  const rawLanguages = Array.isArray(config.languages)
    ? config.languages
    : [
        config.defaultLang || config.menu?.languages?.primary || "es",
        ...(config.menu?.languages?.secondary || [])
      ];
  const seen = new Set();
  const languages = rawLanguages
    .map((entry) => {
      const code = typeof entry === "string" ? entry : entry?.code;
      const base = languageDefaults(code);
      return typeof entry === "string" ? base : { ...base, ...entry, code: base.code };
    })
    .filter((language) => language.code && !seen.has(language.code) && seen.add(language.code));
  if (!languages.length) languages.push(languageDefaults("es"));
  const primary = config.defaultLang || languages.find((language) => language.primary)?.code || languages[0].code;
  return languages.map((language) => ({ ...language, primary: language.code === primary }));
}

function overridePatch(config, products, rewards, categoryOrder) {
  const brandName = requiredString(config.brand?.name, "brand.name");
  const businessId = requiredString(config.businessId, "businessId");
  const catalogs = Object.keys(categoryOrder);
  const defaultBrand = catalogs[0] || brandName;
  const defaultCategory = categoryOrder[defaultBrand]?.[0] || "General";
  const aiCredits = aiCreditsFromConfig(config);
  const languages = languagesFromConfig(config);
  const languageCodes = languages.map((language) => language.code);
  const defaultLang = config.defaultLang || languages.find((language) => language.primary)?.code || languageCodes[0] || "es";
  return `

// Client overrides generated by scripts/prepare-client.mjs.
(() => {
  const config = window.SUMI_BUSINESS_CONFIG;
  config.businessId = ${jsString(businessId)};
  config.appTitle = ${jsString(`${brandName} | Sumi`)};
  config.brand = {
    name: ${jsString(brandName)},
    mark: ${jsString(config.brand?.mark || brandName.slice(0, 2).toUpperCase())},
    subtitle: ${jsString(config.brand?.subtitle || config.operations?.businessType || "")},
    logoPath: ${jsString(config.brand?.logoPath || "")},
    colors: ${JSON.stringify({
      primary: config.brand?.colors?.primary || "#ff8a00",
      ink: config.brand?.colors?.ink || "#2b1a10",
      cream: config.brand?.colors?.cream || "#fff8e8"
    }, null, 4)}
  };
  config.defaultLang = ${jsString(defaultLang)};
  config.defaultBrand = ${jsString(defaultBrand)};
  config.defaultCategory = ${jsString(defaultCategory)};
  config.defaultDetailId = ${jsString(products[0]?.id || "")};
  config.initialPoints = ${Number(config.loyalty?.signupBonusPoints || 0)};
  config.aiCredits = ${JSON.stringify(aiCredits, null, 2)};
  config.languages = ${JSON.stringify(languages, null, 2)};
  config.brandSwitcher = ${JSON.stringify(catalogs.map((name) => ({ name, labels: Object.fromEntries(languageCodes.map((code) => [code, name])) })), null, 2)};
  config.landing = {
    venue: ${jsString(config.contact?.address || "")},
    sealLabel: ${jsString(brandName)},
    sealMark: ${jsString(config.brand?.mark || brandName.slice(0, 2).toUpperCase())},
    primaryName: ${jsString(brandName)},
    secondaryName: ${jsString(config.brand?.subtitle || "")},
    partnerName: "",
    cuisine: ${jsString(config.brand?.subtitle || config.operations?.businessType || "")},
    footer: [
      { title: ${jsString(config.contact?.hours || "Horario a confirmar")}, text: "Horario" },
      { title: ${jsString(config.contact?.instagram || config.contact?.website || "")}, text: "Contacto" }
    ]
  };
  config.admin = {
    ...config.admin,
    brandMark: ${jsString(config.brand?.mark || brandName.slice(0, 2).toUpperCase())},
    brandName: ${jsString(brandName)},
    ownerLabel: "Panel del negocio",
    helpUrl: ${jsString(config.contact?.whatsapp ? `https://wa.me/${String(config.contact.whatsapp).replace(/\\D/g, "")}` : "")}
  };
  config.categoryOrder = ${JSON.stringify(categoryOrder, null, 2)};
  if (${products.length}) config.menuItems = ${JSON.stringify(products, null, 2)};
  config.rewardCatalog = ${JSON.stringify(rewards, null, 2)};
  config.publicAppUrl = ${jsString(config.publicAppUrl || config.qr?.defaultTarget || "")};
  config.qr = {
    ...(config.qr || {}),
    defaultTarget: ${jsString(config.qr?.defaultTarget || config.publicAppUrl || "")},
    defaultCta: ${jsString(config.qr?.defaultCta || "Pedi, suma y canjea.")},
    defaultUse: ${jsString(config.qr?.defaultUse || "mesa")},
    defaultGoal: ${jsString(config.qr?.defaultGoal || "menu")},
    defaultTone: ${jsString(config.qr?.defaultTone || "directo")},
    defaultStyle: ${jsString(config.qr?.defaultStyle || "editorial")},
    defaultColor: ${jsString(config.qr?.defaultColor || "marca")},
    uses: ${JSON.stringify(config.qr?.uses || ["mesa", "mostrador", "redes", "flyer"])}
  };
})();
`;
}

function seedSql(config, rewards) {
  const businessId = requiredString(config.businessId, "businessId");
  const brandName = requiredString(config.brand?.name, "brand.name");
  const ownerEmail = String(config.operations?.adminOwnerEmail || "").trim().toLowerCase();
  const employeeEmails = normalizedEmails(config.operations?.employeeEmails || [])
    .filter((email) => email !== ownerEmail);
  const loyalty = config.loyalty || {};
  const streak = loyalty.streak || {};
  const tierThresholds = loyalty.tierThresholds || loyalty.tiers || {};
  const aiCredits = aiCreditsFromConfig(config);
  const staffSecurity = staffSecurityFromConfig(config);
  const rewardRows = rewards.map((reward) => `insert into public.business_rewards (
  business_id, reward_key, name, description, points_cost, stock, image_url, min_tier, active, valid_until
) values (
  ${sqlString(businessId)}, ${sqlString(reward.rewardKey)}, ${sqlString(reward.name)}, ${sqlString(reward.description)},
  ${sqlNumber(reward.cost)}, ${reward.stock === null ? "null" : sqlNumber(reward.stock)}, ${sqlString(reward.imageUrl)}, ${sqlString(reward.minTier)},
  ${sqlBoolean(reward.active)}, ${sqlString(reward.validUntil)}
) on conflict (business_id, reward_key) do update set
  name = excluded.name,
  description = excluded.description,
  points_cost = excluded.points_cost,
  stock = excluded.stock,
  image_url = excluded.image_url,
  min_tier = excluded.min_tier,
  active = excluded.active,
  valid_until = excluded.valid_until;`).join("\n\n");

  return `-- Generated by scripts/prepare-client.mjs from ${inputPath}
-- Review before running in a client Supabase project.

insert into public.businesses (id, name)
values (${sqlString(businessId)}, ${sqlString(brandName)})
on conflict (id) do update set name = excluded.name;

insert into public.business_loyalty_settings (
  business_id,
  earn_rate,
  signup_bonus_points,
  referral_referrer_points,
  referral_referred_points,
  streak_bonus_weeks,
  streak_bonus_points,
  tier_silver_points,
  tier_gold_points,
  tier_platinum_points
) values (
  ${sqlString(businessId)},
  ${sqlNumber(loyalty.earnRate, 0.1)},
  ${sqlNumber(loyalty.signupBonusPoints, 0)},
  ${sqlNumber(loyalty.referralReferrerPoints, 0)},
  ${sqlNumber(loyalty.referralReferredPoints, 0)},
  ${sqlNumber(streak.bonusWeeks, 3)},
  ${sqlNumber(streak.bonusPoints, 0)},
  ${sqlNumber(tierThresholds.silver, 500)},
  ${sqlNumber(tierThresholds.gold, 1000)},
  ${sqlNumber(tierThresholds.platinum, 2000)}
) on conflict (business_id) do update set
  earn_rate = excluded.earn_rate,
  signup_bonus_points = excluded.signup_bonus_points,
  referral_referrer_points = excluded.referral_referrer_points,
  referral_referred_points = excluded.referral_referred_points,
  streak_bonus_weeks = excluded.streak_bonus_weeks,
  streak_bonus_points = excluded.streak_bonus_points,
  tier_silver_points = excluded.tier_silver_points,
  tier_gold_points = excluded.tier_gold_points,
  tier_platinum_points = excluded.tier_platinum_points,
  updated_at = now();

insert into public.business_ai_settings (
  business_id,
  monthly_limit,
  generation_credit_cost
) values (
  ${sqlString(businessId)},
  ${sqlNumber(aiCredits.monthlyLimit, 150)},
  ${sqlNumber(aiCredits.generationCreditCost, 2)}
) on conflict (business_id) do update set
  monthly_limit = excluded.monthly_limit,
  generation_credit_cost = excluded.generation_credit_cost,
  updated_at = now();

insert into public.business_staff_security_settings (
  business_id,
  max_employee_purchase_total,
  max_employee_daily_total,
  max_employee_daily_count,
  require_qr_for_employee
) values (
  ${sqlString(businessId)},
  ${sqlNumber(staffSecurity.maxEmployeePurchaseTotal, 250000)},
  ${sqlNumber(staffSecurity.maxEmployeeDailyTotal, 1000000)},
  ${sqlNumber(staffSecurity.maxEmployeeDailyCount, 80)},
  ${sqlBoolean(staffSecurity.requireQrForEmployee)}
) on conflict (business_id) do update set
  max_employee_purchase_total = excluded.max_employee_purchase_total,
  max_employee_daily_total = excluded.max_employee_daily_total,
  max_employee_daily_count = excluded.max_employee_daily_count,
  require_qr_for_employee = excluded.require_qr_for_employee,
  updated_at = now();

${rewardRows || "-- Sin premios iniciales configurados."}

${ownerEmail ? `-- Ejecutar despues de crear/confirmar el usuario owner en Auth.
insert into public.business_admins (business_id, auth_user_id, role)
select ${sqlString(businessId)}, id, 'owner'
from auth.users
where lower(email) = ${sqlString(ownerEmail)}
on conflict (business_id, auth_user_id) do update set role = excluded.role;` : "-- Completar operations.adminOwnerEmail para generar el owner inicial."}

${employeeEmails.length ? `-- Ejecutar despues de crear/confirmar los usuarios employee en Auth.
insert into public.business_admins (business_id, auth_user_id, role)
select ${sqlString(businessId)}, id, 'employee'
from auth.users
where lower(email) in (${employeeEmails.map(sqlString).join(", ")})
on conflict (business_id, auth_user_id) do update set role = excluded.role;` : "-- Completar operations.employeeEmails si el negocio tendra empleados iniciales."}
`;
}

async function main() {
  const raw = await readFile(inputPath, "utf8");
  const config = JSON.parse(raw);
  const businessId = slugify(requiredString(config.businessId, "businessId"));
  if (businessId !== config.businessId) {
    throw new Error(`businessId debe estar slugificado. Usa: ${businessId}`);
  }
  requiredString(config.brand?.name, "brand.name");

  const products = flattenMenuProducts(config);
  const rewards = rewardCatalogFromConfig(config);
  const categoryOrder = categoryOrderFromConfig(config, products);
  const aiCredits = aiCreditsFromConfig(config);
  const staffSecurity = staffSecurityFromConfig(config);
  const languages = languagesFromConfig(config);
  const missingFlags = languages
    .map((language) => language.flag)
    .filter(Boolean)
    .filter((flag, index, list) => list.indexOf(flag) === index)
    .filter((flag) => !existsSync(join(root, "assets", "flags", `${flag}.svg`)));
  const targetDir = join(root, "businesses", businessId);
  const targetConfig = join(targetDir, "config.js");
  const targetSeed = join(root, "supabase", "seed.client.generated.sql");

  const summary = {
    input: inputPath,
    businessId,
    targetConfig,
    targetSeed,
    products: products.length,
    rewards: rewards.length,
    catalogs: Object.keys(categoryOrder).length,
    languages,
    missingFlags,
    aiCredits,
    staffSecurity,
    dryRun
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (existsSync(targetConfig) && !overwrite) {
    throw new Error(`${targetConfig} ya existe. Usa --overwrite para regenerarlo.`);
  }

  const baseConfig = await readFile(join(root, "businesses", "sumi", "config.js"), "utf8");
  await mkdir(dirname(targetConfig), { recursive: true });
  await writeFile(targetConfig, `${baseConfig.trimEnd()}\n${overridePatch(config, products, rewards, categoryOrder)}`, "utf8");
  await writeFile(targetSeed, seedSql(config, rewards), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
