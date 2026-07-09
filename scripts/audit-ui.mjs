import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.js", "utf8");
const css = readFileSync("styles.css", "utf8");
const adminPanelDoc = readFileSync("ADMIN_PANEL.md", "utf8");
const sources = [
  { name: "index.html", text: html },
  { name: "app.js", text: app }
];
const allowedHandledClasses = new Set(["delete-presentation"]);
const allowedStaticDisabledIds = new Set(["photoAiApply", "photoAiDownload"]);

function camelDataName(name) {
  return name
    .replace(/^data-/, "")
    .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

const failures = [];

function containingFormId(sourceText, offset) {
  const before = sourceText.slice(0, offset);
  const lastFormOpen = before.lastIndexOf("<form");
  const lastFormClose = before.lastIndexOf("</form>");
  if (lastFormOpen === -1 || lastFormClose > lastFormOpen) return "";
  const formTagEnd = sourceText.indexOf(">", lastFormOpen);
  if (formTagEnd === -1 || formTagEnd > offset) return "";
  return sourceText.slice(lastFormOpen, formTagEnd).match(/\bid="([^"]+)"/)?.[1] || "";
}

function formSubmitHandled(formId) {
  if (!formId) return false;
  const selectorPattern = new RegExp(`const\\s+([\\w$]+)\\s*=\\s*document\\.querySelector\\("${`#${formId}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)`);
  const variableName = app.match(selectorPattern)?.[1] || "";
  return Boolean(variableName && new RegExp(`${variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?\\.addEventListener\\("submit"`).test(app));
}

const buttons = sources.flatMap((source) =>
  [...source.text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((match, index) => {
    const attrs = match[1];
    const id = attrs.match(/id="([^"]+)"/)?.[1] || "";
    const type = attrs.match(/\btype="([^"]+)"/)?.[1] || "";
    const classes = (attrs.match(/class="([^"]+)"/)?.[1] || "").split(/\s+/).filter(Boolean);
    const dataAttributes = [...attrs.matchAll(/(data-[\w-]+)="([^"]*)"/g)].map((dataMatch) => dataMatch[1]);
    const disabled = /\bdisabled\b/.test(attrs);
    const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const referencedById = id
      ? app.includes(`#${id}`) || app.includes(`${id}.addEventListener`) || app.includes(`getElementById("${id}")`)
      : false;
    const referencedByData = dataAttributes.some((attribute) =>
      app.includes(`[${attribute}]`) || app.includes(camelDataName(attribute))
    );
    const referencedByClass = classes.some((className) =>
      allowedHandledClasses.has(className) && app.includes(`.${className}`)
    );

    const formId = source.name === "index.html" && type === "submit"
      ? containingFormId(source.text, match.index)
      : "";

    return { attrs, classes, dataAttributes, disabled, formId, id, index, referencedByClass, referencedByData, referencedById, source: source.name, text, type };
  })
);

buttons.forEach((button) => {
  if (!button.type) {
    failures.push(`${button.source} button #${button.index}${button.id ? ` (${button.id})` : ""} is missing an explicit type attribute: "${button.text}"`);
    return;
  }
  if (button.disabled) {
    if (button.source === "index.html" && !allowedStaticDisabledIds.has(button.id)) {
      failures.push(`${button.source} button #${button.index}${button.id ? ` (${button.id})` : ""} is disabled without an explicit audit allowance: "${button.text}"`);
    }
    return;
  }
  if (button.id && button.referencedById) return;
  if (button.dataAttributes.length && button.referencedByData) return;
  if (button.classes.length && button.referencedByClass) return;
  if (button.type === "submit" && formSubmitHandled(button.formId)) return;
  failures.push(`${button.source} button #${button.index}${button.id ? ` (${button.id})` : ""} is active but has no obvious handler: "${button.text}"`);
});

const hashLinks = [...html.matchAll(/<a\b([^>]*)>/g)].filter((match) => /\bhref="#"/.test(match[1]));
hashLinks.forEach((match, index) => {
  const attrs = match[1];
  if (/data-admin-nav=/.test(attrs)) return;
  failures.push(`Anchor href="#" #${index} has no allowed navigation data attribute.`);
});

if (!/function renderRecommendation\(\)[\s\S]*?if \(!dish\)[\s\S]*?recommendedCard\.disabled = true/.test(app)) {
  failures.push("renderRecommendation must handle an empty menu without leaving the recommendation button active.");
}

if (!/function renderList\(\)[\s\S]*?normalizeCurrentCategory\(items\)[\s\S]*?const filtered = items\.filter/.test(app)) {
  failures.push("renderList must normalize the active category before filtering visible items.");
}

if (!/if \(actionType === "delete"\)[\s\S]*?renderAdminContent\(\);[\s\S]*?renderAdminLibrary\(\);/.test(app)) {
  failures.push("Deleting a dish must refresh content and library admin surfaces.");
}

if (!/signupForm\.addEventListener\("submit"[\s\S]*?setSignupLoading\(true\)[\s\S]*?finally[\s\S]*?setSignupLoading\(false\)/.test(app)) {
  failures.push("Signup/login submit must guard against double submission and restore its loading state.");
}

if (!/rewardStrip\.addEventListener\("click"[\s\S]*?button\.dataset\.pending === "true"[\s\S]*?aria-busy[\s\S]*?finally/.test(app)) {
  failures.push("Reward redemption must guard against duplicate clicks while the request is pending.");
}

if (!/function validateEditorDraftForSave\(draft\)[\s\S]*?El nombre del platillo es obligatorio[\s\S]*?Completa nombre y precio de cada presentacion/.test(app)) {
  failures.push("Product editor must validate required text and presentation rows before saving.");
}

if (!/adminNewDishButton\.addEventListener\("click"[\s\S]*?navigate\("admin-editor", \{ dishId: "new" \}\)/.test(app)) {
  failures.push("Create dish button must navigate to the new product editor route.");
}

if (!/function isLocalDevOwner\(\)[\s\S]*?hostname === "localhost"[\s\S]*?hostname === "127\.0\.0\.1"[\s\S]*?import\.meta\.env\.DEV && localHost && window\.localStorage\.getItem\(localDevOwnerStorageKey\) === "true"/.test(app)) {
  failures.push("Local owner test mode must be guarded by DEV, localhost, and an explicit localStorage flag.");
}

if (!/function newDishDraft\(\)[\s\S]*?name: ""[\s\S]*?description: ""[\s\S]*?presentations: \[\{ name: "", price: "", note: "" \}\]/.test(app)) {
  failures.push("New product drafts must start empty so Guardar cannot create placeholder menu items.");
}

if (!/previewDishButton\.addEventListener\("click"[\s\S]*?validateEditorDraftForSave\(dish\)/.test(app)) {
  failures.push("Product preview must use the same validation as save.");
}

if (!/@media \(max-width: 380px\)[\s\S]*?\.editor-actions-toolbar[\s\S]*?grid-template-columns: 1fr/.test(css)) {
  failures.push("Editor action toolbar must collapse on very small screens.");
}

if (!/\.help-box button,\s*\.primary,\s*\.outline,\s*\.ghost\s*\{[\s\S]*?min-height: 44px/.test(css)) {
  failures.push("Primary, outline, ghost, and help buttons must meet the 44px touch-target baseline.");
}

if (!/@media \(prefers-reduced-motion: reduce\)/.test(css)) {
  failures.push("CSS must respect prefers-reduced-motion for motion-sensitive users.");
}

if (!/if \(navigator\.share\)[\s\S]*?await navigator\.share\(shareData\);[\s\S]*?if \(error\.name === "AbortError"\) return;[\s\S]*?navigator\.clipboard\.writeText\(shareUrl\)/.test(app)) {
  failures.push("Share fallback must only show copied feedback after clipboard succeeds.");
}

if (/Mejorar con IA|Generar o mejorar imagen del producto/.test(html + app + adminPanelDoc)) {
  const photoAiImplemented = app.includes("improveEditorPhotoWithAi")
    && app.includes('supabase.functions.invoke("improve-product-photo"')
    && html.includes('id="photoAiModal"');
  if (!photoAiImplemented) {
    failures.push("The UI/admin docs must not expose unimplemented image-generation buttons.");
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`UI audit passed: ${buttons.length} buttons checked.`);
