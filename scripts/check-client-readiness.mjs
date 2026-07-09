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

const inputPath = resolve(process.cwd(), argValue("--config", "business.config.json"));
const allowTemplate = process.argv.includes("--allow-template");

function text(value) {
  return String(value || "").trim();
}

function isPlaceholder(value) {
  return /tu-dominio|cliente-demo|nombre del negocio|catalogo principal/i.test(text(value));
}

function add(list, code, message) {
  list.push({ code, message });
}

function validUrl(value) {
  try {
    const parsed = new URL(text(value));
    return parsed.protocol === "https:" && parsed.hostname;
  } catch {
    return false;
  }
}

function productsFromCatalogs(config) {
  return (Array.isArray(config.menu?.catalogs) ? config.menu.catalogs : [])
    .flatMap((catalog) => Array.isArray(catalog.products) ? catalog.products : []);
}

function languagesFromConfig(config) {
  const raw = Array.isArray(config.languages) ? config.languages : [];
  return raw
    .map((language) => typeof language === "string" ? { code: language } : language)
    .filter((language) => text(language?.code));
}

async function main() {
  const config = JSON.parse(await readFile(inputPath, "utf8"));
  const blockers = [];
  const warnings = [];
  const products = productsFromCatalogs(config);
  const rewards = Array.isArray(config.rewards) ? config.rewards : [];
  const languages = languagesFromConfig(config);
  const publicAppUrl = text(config.publicAppUrl || config.qr?.defaultTarget);

  if (!text(config.businessId)) add(blockers, "business_id_missing", "Falta businessId.");
  if (!/^[a-z0-9-]+$/.test(text(config.businessId))) {
    add(blockers, "business_id_invalid", "businessId debe estar en minusculas, sin espacios ni caracteres especiales.");
  }
  if (!text(config.brand?.name)) add(blockers, "brand_name_missing", "Falta brand.name.");
  if (!validUrl(publicAppUrl)) add(blockers, "public_url_invalid", "publicAppUrl o qr.defaultTarget debe ser una URL https valida.");
  if (publicAppUrl && !publicAppUrl.endsWith("/")) {
    add(warnings, "public_url_no_trailing_slash", "Conviene guardar la URL publica raiz con slash final para QRs impresos.");
  }
  if (!text(config.operations?.adminOwnerEmail)) {
    add(allowTemplate ? warnings : blockers, "owner_email_missing", "Falta operations.adminOwnerEmail para crear el owner inicial.");
  }
  if (!Array.isArray(config.menu?.catalogs) || !config.menu.catalogs.length) {
    add(blockers, "catalogs_missing", "Falta al menos un catalogo de menu.");
  }
  if (!products.length) {
    add(warnings, "products_missing", "No hay productos iniciales; el negocio arrancara con menu vacio.");
  }
  if (!rewards.length) {
    add(warnings, "rewards_missing", "No hay premios iniciales; Fidelizacion arrancara sin recompensas.");
  }
  if (!languages.length) {
    add(blockers, "languages_missing", "Falta configurar languages.");
  }

  const defaultLang = text(config.defaultLang || languages.find((language) => language.primary)?.code || languages[0]?.code);
  if (defaultLang && !languages.some((language) => language.code === defaultLang)) {
    add(blockers, "default_language_missing", "defaultLang debe existir dentro de languages.");
  }

  languages.forEach((language) => {
    const flag = text(language.flag);
    if (!flag) {
      add(warnings, "language_flag_missing", `El idioma ${language.code} no tiene flag configurada.`);
      return;
    }
    if (!existsSync(join(root, "assets", "flags", `${flag}.svg`))) {
      add(blockers, "language_flag_asset_missing", `Falta assets/flags/${flag}.svg para el idioma ${language.code}.`);
    }
  });

  if (Number(config.loyalty?.earnRate) <= 0) {
    add(blockers, "earn_rate_invalid", "loyalty.earnRate debe ser mayor a 0.");
  }
  if (Number(config.aiCredits?.monthlyLimit) <= 0) {
    add(blockers, "ai_monthly_limit_invalid", "aiCredits.monthlyLimit debe ser mayor a 0.");
  }
  if (Number(config.aiCredits?.generationCreditCost) <= 0) {
    add(blockers, "ai_generation_cost_invalid", "aiCredits.generationCreditCost debe ser mayor a 0.");
  }
  const staffSecurity = config.operations?.staffSecurity || {};
  if (Number(staffSecurity.maxEmployeePurchaseTotal || 250000) <= 0) {
    add(blockers, "staff_purchase_limit_invalid", "operations.staffSecurity.maxEmployeePurchaseTotal debe ser mayor a 0.");
  }
  if (Number(staffSecurity.maxEmployeeDailyTotal || 1000000) <= 0) {
    add(blockers, "staff_daily_total_limit_invalid", "operations.staffSecurity.maxEmployeeDailyTotal debe ser mayor a 0.");
  }
  if (Number(staffSecurity.maxEmployeeDailyCount || 80) <= 0) {
    add(blockers, "staff_daily_count_limit_invalid", "operations.staffSecurity.maxEmployeeDailyCount debe ser mayor a 0.");
  }

  if (!allowTemplate) {
    [
      ["business_id_placeholder", config.businessId, "businessId todavia parece de ejemplo."],
      ["brand_name_placeholder", config.brand?.name, "brand.name todavia parece de ejemplo."],
      ["public_url_placeholder", publicAppUrl, "La URL publica todavia parece de ejemplo."]
    ].forEach(([code, value, message]) => {
      if (isPlaceholder(value)) add(blockers, code, message);
    });
  }

  const summary = {
    config: inputPath,
    businessId: text(config.businessId),
    brandName: text(config.brand?.name),
    publicAppUrl,
    catalogs: Array.isArray(config.menu?.catalogs) ? config.menu.catalogs.length : 0,
    products: products.length,
    rewards: rewards.length,
    languages: languages.map((language) => language.code),
    aiCredits: {
      monthlyLimit: Number(config.aiCredits?.monthlyLimit || 0),
      generationCreditCost: Number(config.aiCredits?.generationCreditCost || 0)
    },
    staffSecurity: {
      maxEmployeePurchaseTotal: Number(staffSecurity.maxEmployeePurchaseTotal || 250000),
      maxEmployeeDailyTotal: Number(staffSecurity.maxEmployeeDailyTotal || 1000000),
      maxEmployeeDailyCount: Number(staffSecurity.maxEmployeeDailyCount || 80),
      requireQrForEmployee: Boolean(staffSecurity.requireQrForEmployee)
    },
    blockers,
    warnings,
    ready: blockers.length === 0
  };

  console.log(JSON.stringify(summary, null, 2));

  if (blockers.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
