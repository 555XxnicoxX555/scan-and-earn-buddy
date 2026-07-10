import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

const inputPath = resolve(process.cwd(), argValue("--intake", "business-intake.json"));
const allowTemplate = process.argv.includes("--allow-template");

function text(value) {
  return String(value || "").trim();
}

function add(list, code, message) {
  list.push({ code, message });
}

function addBlocking(code, message, blockers, warnings) {
  add(allowTemplate ? warnings : blockers, code, message);
}

function validHttpsUrl(value) {
  try {
    const parsed = new URL(text(value));
    return parsed.protocol === "https:" && parsed.hostname;
  } catch {
    return false;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
}

function isTemplateValue(value) {
  return /tu-dominio|catalogo principal|plan base/i.test(text(value));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function catalogProducts(intake) {
  return array(intake.menu?.catalogs).flatMap((catalog) => array(catalog.products));
}

function requiredString(blockers, value, code, label) {
  if (!text(value)) add(blockers, code, `Falta ${label}.`);
}

function positiveNumber(blockers, value, code, label) {
  if (!(Number(value) > 0)) add(blockers, code, `${label} debe ser mayor a 0.`);
}

async function main() {
  if (!existsSync(inputPath)) {
    throw new Error(`No existe ${inputPath}. Copia docs/business-intake.template.json como business-intake.json y completalo.`);
  }

  const intake = JSON.parse(await readFile(inputPath, "utf8"));
  const blockers = [];
  const warnings = [];
  const products = catalogProducts(intake);
  const languages = array(intake.languages?.items);
  const sourceFiles = array(intake.menu?.sourceFiles);
  const rewards = array(intake.rewards);
  const domain = text(intake.business?.domain || intake.qr?.rootTarget);

  if (!text(intake.business?.name)) {
    addBlocking("business_name_missing", "Falta business.name.", blockers, warnings);
  }
  requiredString(blockers, intake.business?.businessType, "business_type_missing", "business.businessType");
  if (!validHttpsUrl(domain)) add(blockers, "domain_invalid", "business.domain o qr.rootTarget debe ser una URL https valida.");
  if (domain && !domain.endsWith("/")) add(warnings, "domain_no_trailing_slash", "Conviene que el dominio raiz termine con slash para QRs impresos.");
  if (!isEmail(intake.operations?.ownerEmail)) {
    add(allowTemplate ? warnings : blockers, "owner_email_invalid", "operations.ownerEmail debe ser un email valido.");
  }
  array(intake.operations?.employeeEmails).forEach((email, index) => {
    if (!isEmail(email)) add(blockers, "employee_email_invalid", `operations.employeeEmails[${index}] no es un email valido.`);
  });

  if (!text(intake.business?.whatsapp) && !text(intake.business?.instagram) && !text(intake.business?.website)) {
    add(warnings, "contact_channel_missing", "Conviene tener WhatsApp, Instagram o sitio web del negocio.");
  }

  if (!array(intake.menu?.catalogs).length) add(blockers, "menu_catalogs_missing", "Falta menu.catalogs.");
  if (!products.length && !sourceFiles.length) {
    addBlocking("menu_source_missing", "Carga productos iniciales o archivos fuente del menu en menu.sourceFiles.", blockers, warnings);
  }
  array(intake.menu?.catalogs).forEach((catalog, catalogIndex) => {
    if (!text(catalog.name)) add(blockers, "catalog_name_missing", `menu.catalogs[${catalogIndex}].name esta vacio.`);
    if (!array(catalog.categories).length) add(warnings, "catalog_categories_missing", `menu.catalogs[${catalogIndex}] no tiene categorias.`);
  });

  positiveNumber(blockers, intake.loyalty?.earnRate, "earn_rate_invalid", "loyalty.earnRate");
  ["silver", "gold", "platinum"].forEach((tier) => {
    positiveNumber(blockers, intake.loyalty?.tierThresholds?.[tier], `tier_${tier}_invalid`, `loyalty.tierThresholds.${tier}`);
  });

  const completeRewards = rewards.filter((reward) => text(reward.name) && Number(reward.pointsCost) > 0);
  if (!completeRewards.length) add(warnings, "rewards_missing", "Conviene definir al menos un premio con nombre y puntos.");

  if (!languages.length) add(blockers, "languages_missing", "Falta languages.items.");
  const defaultLang = text(intake.languages?.defaultLang);
  if (defaultLang && !languages.some((language) => language.code === defaultLang)) {
    add(blockers, "default_language_missing", "languages.defaultLang debe existir dentro de languages.items.");
  }
  languages.forEach((language) => {
    requiredString(blockers, language.code, "language_code_missing", "language.code");
    requiredString(blockers, language.label, "language_label_missing", `label para idioma ${language.code || "sin codigo"}`);
    requiredString(blockers, language.flag, "language_flag_missing", `flag para idioma ${language.code || "sin codigo"}`);
    if (text(language.flag) && !existsSync(join(root, "assets", "flags", `${language.flag}.svg`))) {
      add(blockers, "language_flag_asset_missing", `Falta assets/flags/${language.flag}.svg para ${language.code}.`);
    }
    if (!["ltr", "rtl"].includes(text(language.dir || "ltr"))) {
      add(blockers, "language_dir_invalid", `language.dir debe ser ltr o rtl para ${language.code}.`);
    }
  });

  positiveNumber(blockers, intake.aiCredits?.monthlyLimit, "ai_monthly_limit_invalid", "aiCredits.monthlyLimit");
  positiveNumber(blockers, intake.aiCredits?.generationCreditCost, "ai_generation_cost_invalid", "aiCredits.generationCreditCost");
  positiveNumber(blockers, intake.aiCredits?.lowBalanceWarningThreshold, "ai_low_balance_invalid", "aiCredits.lowBalanceWarningThreshold");

  const staffSecurity = intake.operations?.staffSecurity || {};
  positiveNumber(blockers, staffSecurity.maxEmployeePurchaseTotal, "staff_purchase_limit_invalid", "operations.staffSecurity.maxEmployeePurchaseTotal");
  positiveNumber(blockers, staffSecurity.maxEmployeeDailyTotal, "staff_daily_total_invalid", "operations.staffSecurity.maxEmployeeDailyTotal");
  positiveNumber(blockers, staffSecurity.maxEmployeeDailyCount, "staff_daily_count_invalid", "operations.staffSecurity.maxEmployeeDailyCount");

  if (!allowTemplate && [domain, intake.business?.name, intake.aiCredits?.planName].some(isTemplateValue)) {
    add(blockers, "template_values_present", "El intake todavia contiene valores de plantilla.");
  }

  const summary = {
    intake: inputPath,
    businessName: text(intake.business?.name),
    domain,
    ownerEmail: text(intake.operations?.ownerEmail),
    catalogs: array(intake.menu?.catalogs).length,
    products: products.length,
    sourceFiles: sourceFiles.length,
    rewards: completeRewards.length,
    languages: languages.map((language) => language.code).filter(Boolean),
    aiCredits: {
      planName: text(intake.aiCredits?.planName),
      monthlyLimit: Number(intake.aiCredits?.monthlyLimit || 0),
      generationCreditCost: Number(intake.aiCredits?.generationCreditCost || 0)
    },
    blockers,
    warnings,
    readyForConfig: blockers.length === 0
  };

  console.log(JSON.stringify(summary, null, 2));
  if (blockers.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
