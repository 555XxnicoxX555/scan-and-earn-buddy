import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

const STORAGE_BUCKET = "business-onboarding-private";
const STEPS = [
  ["Paso 1 de 5", "Contanos sobre el negocio", "Estos datos nos permiten configurar la primera versión de Sumi."],
  ["Paso 2 de 5", "Ordenemos el menú", "Subí lo que ya tenés. Sumi se ocupa de convertirlo en una estructura editable."],
  ["Paso 3 de 5", "Definamos la fidelización", "Una primera regla clara alcanza; después puede ajustarse desde el panel."],
  ["Paso 4 de 5", "Alineemos la identidad", "Estas preferencias guían la plantilla sin obligarte a definir un manual de marca."],
  ["Paso 5 de 5", "Revisá la entrega", "Confirmá la información que recibirá el equipo de implementación."]
];

const defaultPayload = {
  business: { name: "", legalName: "", businessType: "restaurante", serviceModes: ["local", "take-away"], address: "", hours: "", domain: "https://tu-dominio.com/", whatsapp: "", instagram: "", website: "", logoFile: "", tagline: "" },
  operations: { ownerEmail: "", managerEmails: [], employeeEmails: [], estimatedCustomersPerMonth: 0, estimatedConsumptionsPerDay: 0 },
  menu: { sourceFiles: [], catalogNames: ["Catálogo principal"], categoryNames: [], mainProducts: [], featuredProducts: [] },
  loyalty: { earnRatePercent: 10, signupBonusPoints: 40, referralReferrerPoints: 0, referralReferredPoints: 0, tierThresholds: { silver: 500, gold: 1000, platinum: 2000 }, streak: { bonusWeeks: 3, bonusPoints: 0 } },
  rewards: [{ name: "", description: "", pointsCost: 0, stock: null, active: true }],
  languages: { selected: ["es"], defaultLang: "es", autoTranslateInitial: true, reviewTranslationsBeforePublish: true },
  content: { commonPhrases: [], frequentPromotions: [], starProducts: [] },
  qr: { rootTarget: "https://tu-dominio.com/", initialUses: ["mesa", "mostrador"], primaryGoal: "menu", tone: "directo", mainText: "Pedí, sumá y canjeá." },
  brandCall: { paletteNotes: "", visualStyle: "", formalityLevel: "", dislikes: [], referenceBusinesses: [] }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  route: "",
  token: "",
  invite: null,
  submission: null,
  files: [],
  payload: structuredClone(defaultPayload),
  step: 0,
  saveTimer: 0,
  saving: false,
  dirty: false,
  invites: [],
  selectedInviteId: ""
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function displayError(error, fallback = "Ocurrió un error inesperado.") {
  return String(error?.message || error?.error || error || fallback).replace(/^FunctionsHttpError:\s*/i, "");
}

function deepMerge(base, incoming) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return structuredClone(base);
  const result = structuredClone(base);
  Object.entries(incoming).forEach(([key, value]) => {
    result[key] = value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])
      ? deepMerge(result[key], value)
      : structuredClone(value);
  });
  return result;
}

function getPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function setPath(target, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((value, key) => {
    if (!value[key] || typeof value[key] !== "object") value[key] = {};
    return value[key];
  }, target);
  parent[last] = value;
}

function lineList(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function fileSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toast(message) {
  const element = $("#onboardingToast");
  element.textContent = message;
  element.classList.add("is-visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("is-visible"), 2600);
}

function setSaveState(message, tone = "") {
  const element = $("#saveState");
  element.textContent = message;
  element.className = `ob-save-state${tone ? ` is-${tone}` : ""}`;
}

function routeFromHash() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash === "admin" || hash.startsWith("admin/")) return { name: "admin" };
  const match = hash.match(/^i\/([A-Za-z0-9_-]{32,256})$/);
  return match ? { name: "invite", token: match[1] } : { name: "invalid" };
}

async function invokeOwner(action, extra = {}) {
  if (!supabase) throw new Error("Falta configurar Supabase en este entorno.");
  const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!localHost) {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, token: state.token, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) throw new Error(data?.error || `Onboarding no disponible (${response.status}).`);
    return data;
  }
  const { data, error } = await supabase.functions.invoke("onboarding-form", { body: { action, token: state.token, ...extra } });
  if (error) {
    let detail = error.message;
    try {
      const response = error.context;
      if (response && typeof response.json === "function") detail = (await response.json())?.error || detail;
    } catch {}
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function completionPercent() {
  const checks = [
    state.payload.business?.name,
    state.payload.business?.domain,
    state.payload.operations?.ownerEmail,
    state.payload.business?.businessType,
    state.payload.business?.serviceModes?.length,
    state.files.length || state.payload.menu?.mainProducts?.length,
    state.payload.menu?.categoryNames?.length,
    Number(state.payload.loyalty?.earnRatePercent) > 0,
    state.payload.rewards?.some((reward) => reward.name),
    state.payload.brandCall?.visualStyle,
    state.payload.languages?.selected?.length,
    state.payload.qr?.primaryGoal
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function isOwnerLocked() {
  return ["submitted", "approved", "archived"].includes(state.submission?.status);
}

function updateProgress() {
  const completion = completionPercent();
  $("#progressBar").style.width = `${completion}%`;
  $("#progressLabel").textContent = `${completion}% completo`;
}

function renderStep() {
  $$(".ob-step").forEach((section) => { section.hidden = Number(section.dataset.step) !== state.step; });
  $$("[data-step-target]").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.stepTarget) === state.step));
  $("#stepEyebrow").textContent = STEPS[state.step][0];
  $("#stepTitle").textContent = STEPS[state.step][1];
  $("#stepDescription").textContent = STEPS[state.step][2];
  $("#stepCounter").textContent = STEPS[state.step][0];
  $("#previousStepButton").hidden = state.step === 0;
  $("#nextStepButton").textContent = state.step === STEPS.length - 1 ? "Enviar a revisión" : "Continuar";
  $("#nextStepButton").disabled = isOwnerLocked();
  if (state.step === STEPS.length - 1) renderReview();
  updateProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillForm() {
  $$('[data-path]').forEach((field) => {
    const value = getPath(state.payload, field.dataset.path);
    if (field.type === "number") field.value = value ?? "";
    else field.value = value ?? "";
  });
  $$('[data-list-path]').forEach((field) => { field.value = (getPath(state.payload, field.dataset.listPath) || []).join("\n"); });
  $$('[data-array-path]').forEach((field) => { field.checked = (getPath(state.payload, field.dataset.arrayPath) || []).includes(field.value); });
  const locked = isOwnerLocked();
  $$("#onboardingForm input, #onboardingForm select, #onboardingForm textarea").forEach((field) => {
    field.disabled = locked || field.dataset.arrayPath === "languages.selected" && field.value === "es";
  });
  $("#saveDraftButton").disabled = locked;
}

function renderRewards() {
  const rewards = Array.isArray(state.payload.rewards) ? state.payload.rewards : [];
  $("#rewardList").innerHTML = rewards.map((reward, index) => `
    <article class="ob-repeat-item" data-reward-index="${index}">
      <label class="ob-field"><span>Premio</span><input data-reward-field="name" value="${escapeHtml(reward.name)}" placeholder="Café gratis" /></label>
      <label class="ob-field"><span>Descripción</span><input data-reward-field="description" value="${escapeHtml(reward.description)}" placeholder="Condiciones simples" /></label>
      <label class="ob-field"><span>Puntos</span><input data-reward-field="pointsCost" type="number" min="0" value="${Number(reward.pointsCost || 0)}" /></label>
      <label class="ob-field"><span>Stock</span><input data-reward-field="stock" type="number" min="0" value="${reward.stock ?? ""}" placeholder="Sin límite" /></label>
      <button class="ob-button is-danger is-small" type="button" data-remove-reward="${index}" aria-label="Quitar premio">Quitar</button>
    </article>
  `).join("") || '<div class="ob-empty">Todavía no agregaste premios.</div>';
  $$("#rewardList input").forEach((input) => { input.disabled = isOwnerLocked(); });
  $("#addRewardButton").disabled = isOwnerLocked();
}

function renderFiles() {
  $("#ownerFileList").innerHTML = state.files.map((file) => `
    <div class="ob-file-row">
      <strong>${escapeHtml(file.original_name)}</strong>
      <span>${escapeHtml(file.category)} · ${fileSize(file.size_bytes)}</span>
      <button class="ob-button is-danger is-small" type="button" data-remove-file="${escapeHtml(file.id)}" ${isOwnerLocked() ? "disabled" : ""}>Quitar</button>
    </div>
  `).join("");
}

function renderReview() {
  const p = state.payload;
  const rewards = (p.rewards || []).filter((reward) => reward.name);
  const sections = [
    ["Negocio", [["Nombre", p.business?.name || "Pendiente"], ["Dominio", p.business?.domain || "Pendiente"], ["Owner", p.operations?.ownerEmail || "Pendiente"], ["Atención", (p.business?.serviceModes || []).join(", ") || "Sin definir"]]],
    ["Menú", [["Archivos", `${state.files.length} cargados`], ["Categorías", (p.menu?.categoryNames || []).join(", ") || "Sin definir"], ["Productos", `${(p.menu?.mainProducts || []).length} informados`]]],
    ["Fidelización", [["Regla", `${Number(p.loyalty?.earnRatePercent || 0)}% del consumo`], ["Bienvenida", `${Number(p.loyalty?.signupBonusPoints || 0)} pts`], ["Premios", rewards.map((reward) => `${reward.name} (${reward.pointsCost} pts)`).join(", ") || "Sin premios"]]],
    ["Identidad", [["Estilo", p.brandCall?.visualStyle || "A definir"], ["Idiomas", (p.languages?.selected || []).join(", ")], ["Objetivo QR", p.qr?.primaryGoal || "Menú"]]]
  ];
  $("#reviewSummary").innerHTML = sections.map(([title, rows]) => `
    <section class="ob-review-section"><h4>${escapeHtml(title)}</h4><dl>${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl></section>
  `).join("");
  const note = state.submission?.review_note;
  if (note) $("#reviewSummary").insertAdjacentHTML("afterbegin", `<section class="ob-review-section"><h4>Observaciones de Sumi</h4><p>${escapeHtml(note)}</p></section>`);
}

function markDirty() {
  if (isOwnerLocked()) return;
  state.dirty = true;
  setSaveState("Cambios sin guardar", "saving");
  updateProgress();
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => saveDraft(false), 900);
}

async function saveDraft(showToast = true) {
  if (state.saving || !state.dirty || isOwnerLocked()) return;
  state.saving = true;
  setSaveState("Guardando...", "saving");
  try {
    const data = await invokeOwner("save", { payload: state.payload, completionPercent: completionPercent() });
    state.submission = data.submission;
    state.dirty = false;
    setSaveState(`Guardado ${new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`, "saved");
    if (showToast) toast("Borrador guardado.");
  } catch (error) {
    setSaveState("No se pudo guardar", "error");
    if (showToast) toast(displayError(error));
  } finally {
    state.saving = false;
  }
}

async function submitOwner() {
  const error = $("#submitError");
  error.textContent = "";
  if (!$("#submissionConfirm").checked) {
    error.textContent = "Confirmá que la información está lista para revisión.";
    return;
  }
  const button = $("#nextStepButton");
  button.disabled = true;
  try {
    const data = await invokeOwner("submit", { payload: state.payload, completionPercent: 100 });
    state.submission = data.submission;
    state.dirty = false;
    fillForm();
    renderRewards();
    setSaveState("Enviado a Sumi", "saved");
    toast("Onboarding enviado para revisión.");
    button.textContent = "Enviado";
  } catch (failure) {
    error.textContent = displayError(failure);
    button.disabled = false;
  }
}

async function uploadFiles(input) {
  const files = [...input.files];
  if (!files.length) return;
  input.disabled = true;
  for (const file of files) {
    setSaveState(`Subiendo ${file.name}...`, "saving");
    try {
      const ticket = await invokeOwner("request-upload", { fileName: file.name, mimeType: file.type, sizeBytes: file.size, category: input.dataset.fileCategory });
      const { error } = await supabase.storage.from(STORAGE_BUCKET).uploadToSignedUrl(ticket.storagePath, ticket.signedToken, file, { contentType: file.type });
      if (error) throw error;
      const registered = await invokeOwner("complete-upload", { storagePath: ticket.storagePath, fileName: file.name, mimeType: file.type, sizeBytes: file.size, category: input.dataset.fileCategory });
      state.files.unshift(registered.file);
      if (input.dataset.fileCategory === "menu") state.payload.menu.sourceFiles = [...new Set([...(state.payload.menu.sourceFiles || []), registered.file.original_name])];
      if (input.dataset.fileCategory === "logo") state.payload.business.logoFile = registered.file.original_name;
      state.dirty = true;
      renderFiles();
    } catch (error) {
      toast(`${file.name}: ${displayError(error)}`);
    }
  }
  input.value = "";
  input.disabled = false;
  await saveDraft(false);
  setSaveState("Archivos cargados", "saved");
}

async function removeOwnerFile(id) {
  try {
    await invokeOwner("remove-file", { fileId: id });
    const removed = state.files.find((file) => file.id === id);
    state.files = state.files.filter((file) => file.id !== id);
    if (removed?.category === "menu") state.payload.menu.sourceFiles = (state.payload.menu.sourceFiles || []).filter((name) => name !== removed.original_name);
    if (removed?.category === "logo" && state.payload.business.logoFile === removed.original_name) state.payload.business.logoFile = "";
    state.dirty = true;
    renderFiles();
    await saveDraft(false);
    toast("Archivo eliminado.");
  } catch (error) { toast(displayError(error)); }
}

async function initOwner(token) {
  state.token = token;
  try {
    const data = await invokeOwner("resolve");
    state.invite = data.invite;
    state.submission = data.submission;
    state.files = data.files || [];
    state.payload = deepMerge(defaultPayload, data.submission?.payload || {});
    if (!state.payload.business.name) state.payload.business.name = data.invite.business_name;
    if (!state.payload.operations.ownerEmail) state.payload.operations.ownerEmail = data.invite.owner_email;
    $("#ownerBusinessName").textContent = state.payload.business.name || data.invite.business_name;
    $("#ownerInviteEmail").textContent = data.invite.owner_email;
    $("#loadingState").hidden = true;
    $("#ownerApp").hidden = false;
    fillForm();
    renderRewards();
    renderFiles();
    renderStep();
    if (isOwnerLocked()) setSaveState(state.submission.status === "submitted" ? "En revisión por Sumi" : "Onboarding finalizado", "saved");
    else if (state.submission?.status === "needs_changes") setSaveState("Sumi solicitó cambios", "error");
    else setSaveState(state.submission ? "Borrador recuperado" : "Listo para comenzar", "saved");
  } catch (error) {
    $("#loadingState").hidden = true;
    $("#errorState").hidden = false;
    $("#errorMessage").textContent = displayError(error);
    setSaveState("Enlace no disponible", "error");
  }
}

function statusLabel(value) {
  return ({ active: "Sin iniciar", draft: "Borrador", submitted: "Enviado", needs_changes: "Necesita cambios", approved: "Aprobado", completed: "Completado", revoked: "Revocado", expired: "Vencido" })[value] || value;
}

function normalizedIntakePayload(payload, files = []) {
  const source = deepMerge(defaultPayload, payload || {});
  const catalogNames = source.menu?.catalogNames?.length ? source.menu.catalogNames : ["Catálogo principal"];
  const categories = source.menu?.categoryNames || [];
  const products = (source.menu?.mainProducts || []).map((item, index) => {
    if (item && typeof item === "object") return item;
    const text = String(item || "").trim();
    const [name, ...description] = text.split(",").map((part) => part.trim());
    return { id: `producto-${index + 1}`, name: name || `Producto ${index + 1}`, description: description.join(", "), presentations: [] };
  });
  const languagePresets = {
    es: { code: "es", label: "Español", helper: "Continuar en español", flag: "mx", dir: "ltr", primary: true },
    en: { code: "en", label: "English", helper: "Continue in English", flag: "us", dir: "ltr" },
    ar: { code: "ar", label: "العربية", helper: "متابعة بالعربية", flag: "lb", dir: "rtl" },
    pt: { code: "pt", label: "Português", helper: "Continuar em português", flag: "br", dir: "ltr" }
  };
  return {
    business: {
      ...source.business,
      domain: source.business?.domain || source.qr?.rootTarget || "",
      logoFile: files.find((file) => file.category === "logo")?.original_name || source.business?.logoFile || ""
    },
    operations: {
      ...source.operations,
      managerEmails: source.operations?.managerEmails || [],
      employeeEmails: source.operations?.employeeEmails || [],
      staffSecurity: {
        maxEmployeePurchaseTotal: 250000,
        maxEmployeeDailyTotal: 1000000,
        maxEmployeeDailyCount: 80,
        requireQrForEmployee: false,
        reviewer: "",
        ...(source.operations?.staffSecurity || {})
      }
    },
    menu: {
      hasUpdatedMenu: Boolean(files.some((file) => file.category === "menu") || products.length),
      sourceFiles: source.menu?.sourceFiles || files.filter((file) => file.category === "menu").map((file) => file.original_name),
      hasProductPhotos: files.some((file) => file.category === "product"),
      catalogs: catalogNames.map((name, index) => ({ name, categories, products: index === 0 ? products : [] })),
      featuredProducts: source.menu?.featuredProducts || [],
      blockedPromotionProducts: []
    },
    loyalty: {
      earnRate: Math.max(0, Number(source.loyalty?.earnRatePercent || 0)) / 100,
      signupBonusPoints: Number(source.loyalty?.signupBonusPoints || 0),
      referralReferrerPoints: Number(source.loyalty?.referralReferrerPoints || 0),
      referralReferredPoints: Number(source.loyalty?.referralReferredPoints || 0),
      pointsExpire: false,
      pointsExpireMonths: 0,
      levels: ["bronze", "silver", "gold", "platinum"],
      tierThresholds: source.loyalty?.tierThresholds,
      streak: { enabled: true, type: "weekly", ...source.loyalty?.streak, benefitDescription: "" }
    },
    rewards: source.rewards || [],
    languages: {
      defaultLang: "es",
      items: (source.languages?.selected || ["es"]).map((code) => languagePresets[code] || { code, label: code.toUpperCase(), helper: `Continuar en ${code.toUpperCase()}`, flag: code, dir: "ltr" }),
      autoTranslateInitial: true,
      reviewTranslationsBeforePublish: true,
      doNotTranslateTerms: []
    },
    content: { tone: "cercano", socialNetworks: [], importantDates: [], ...source.content },
    aiCredits: { wantsIncludedAi: true, planName: "Plan base", monthlyLimit: 150, generationCreditCost: 2, lowBalanceWarningThreshold: 20 },
    qr: {
      initialUses: ["mesa", "mostrador"],
      style: "editorial",
      color: "marca",
      needsTablePrint: true,
      needsSocialVersion: true,
      ...source.qr,
      rootTarget: source.business?.domain || source.qr?.rootTarget || ""
    },
    brandCall: { paletteNotes: "", typographyNotes: "", mustRespect: [], ...source.brandCall }
  };
}

function inviteStatus(invite) {
  return invite.onboarding_submissions?.[0]?.status || invite.status;
}

function filteredInvites() {
  const search = $("#operatorSearch").value.trim().toLowerCase();
  const status = $("#operatorStatusFilter").value;
  return state.invites.filter((invite) => {
    const matchesSearch = !search || `${invite.business_name} ${invite.owner_email}`.toLowerCase().includes(search);
    const current = inviteStatus(invite);
    return matchesSearch && (status === "all" || current === status);
  });
}

function renderOperator() {
  const all = state.invites;
  const submitted = all.filter((item) => inviteStatus(item) === "submitted").length;
  const changes = all.filter((item) => inviteStatus(item) === "needs_changes").length;
  const approved = all.filter((item) => ["approved", "completed"].includes(inviteStatus(item))).length;
  $("#operatorKpis").innerHTML = [["Invitaciones", all.length], ["Para revisar", submitted], ["Con cambios", changes], ["Aprobados", approved]].map(([label, value]) => `<article class="ob-kpi"><small>${label}</small><strong>${value}</strong></article>`).join("");
  const list = filteredInvites();
  $("#inviteList").innerHTML = list.map((invite) => {
    const submission = invite.onboarding_submissions?.[0];
    const status = inviteStatus(invite);
    return `<button class="ob-invite-row ${invite.id === state.selectedInviteId ? "is-active" : ""}" type="button" data-invite-id="${invite.id}">
      <strong>${escapeHtml(invite.business_name)}</strong><span>${escapeHtml(invite.owner_email)}</span><span class="ob-status is-${status}">${escapeHtml(statusLabel(status))}</span><small>${submission?.completion_percent || 0}%</small>
    </button>`;
  }).join("") || '<div class="ob-empty">No hay onboardings para este filtro.</div>';
}

async function loadInvites() {
  const { data, error } = await supabase
    .from("onboarding_invites")
    .select("id, owner_email, business_name, status, expires_at, created_at, last_opened_at, completed_at, onboarding_submissions(id,status,payload,completion_percent,review_note,submitted_at,reviewed_at,reviewed_by,updated_at), onboarding_files(id,storage_path,original_name,mime_type,size_bytes,category,created_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.invites = data || [];
  renderOperator();
}

async function openSubmission(id) {
  state.selectedInviteId = id;
  renderOperator();
  const invite = state.invites.find((item) => item.id === id);
  if (!invite) return;
  const submission = invite.onboarding_submissions?.[0];
  const detail = $("#submissionDetail");
  detail.hidden = false;
  $(".ob-console-layout").classList.add("has-detail");
  const fileLinks = await Promise.all((invite.onboarding_files || []).map(async (file) => {
    const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.storage_path, 900);
    return { ...file, url: data?.signedUrl || "" };
  }));
  detail.innerHTML = `
    <header class="ob-detail-header"><div><p class="ob-eyebrow">${escapeHtml(statusLabel(inviteStatus(invite)))}</p><h2>${escapeHtml(invite.business_name)}</h2></div><button class="ob-icon-button" type="button" data-close-detail aria-label="Cerrar">×</button></header>
    <dl class="ob-detail-meta"><dt>Owner</dt><dd>${escapeHtml(invite.owner_email)}</dd><dt>Creado</dt><dd>${formatDate(invite.created_at)}</dd><dt>Vence</dt><dd>${formatDate(invite.expires_at)}</dd><dt>Última apertura</dt><dd>${formatDate(invite.last_opened_at)}</dd><dt>Progreso</dt><dd>${submission?.completion_percent || 0}%</dd></dl>
    <label class="ob-field"><span>Observaciones para el negocio</span><textarea class="ob-review-note" id="operatorReviewNote" placeholder="Explicá exactamente qué falta o qué debe corregirse.">${escapeHtml(submission?.review_note || "")}</textarea></label>
    <div class="ob-detail-actions">
      ${submission ? '<button class="ob-button is-secondary is-small" type="button" data-review-status="needs_changes">Pedir cambios</button><button class="ob-button is-primary is-small" type="button" data-review-status="approved">Aprobar</button><button class="ob-button is-secondary is-small" type="button" data-export-submission>Exportar JSON</button>' : ""}
      ${invite.status === "active" ? '<button class="ob-button is-danger is-small" type="button" data-revoke-invite>Revocar enlace</button>' : ""}
    </div>
    <section><h3>Archivos (${fileLinks.length})</h3><div class="ob-file-links">${fileLinks.map((file) => file.url ? `<a class="ob-file-link" href="${escapeHtml(file.url)}" target="_blank" rel="noopener"><span>${escapeHtml(file.original_name)}</span><small>${fileSize(file.size_bytes)}</small></a>` : `<span>${escapeHtml(file.original_name)}</span>`).join("") || '<p class="ob-empty">Sin archivos.</p>'}</div></section>
    <pre class="ob-detail-json">${escapeHtml(JSON.stringify(submission?.payload || {}, null, 2))}</pre>
  `;
}

async function updateReview(status) {
  const invite = state.invites.find((item) => item.id === state.selectedInviteId);
  const submission = invite?.onboarding_submissions?.[0];
  if (!submission) return;
  const note = $("#operatorReviewNote").value.trim();
  if (status === "needs_changes" && !note) return toast("Escribí qué necesita corregir el negocio.");
  const { data: auth } = await supabase.auth.getUser();
  const values = { status, review_note: note || null, reviewed_at: new Date().toISOString(), reviewed_by: auth.user?.id || null };
  const { error } = await supabase.from("onboarding_submissions").update(values).eq("id", submission.id);
  if (error) return toast(displayError(error));
  if (status === "approved") await supabase.from("onboarding_invites").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", invite.id);
  await loadInvites();
  await openSubmission(invite.id);
  toast(status === "approved" ? "Onboarding aprobado." : "Cambios solicitados.");
}

function exportSubmission() {
  const invite = state.invites.find((item) => item.id === state.selectedInviteId);
  const payload = invite?.onboarding_submissions?.[0]?.payload;
  if (!payload) return;
  const normalized = normalizedIntakePayload(payload, invite.onboarding_files || []);
  const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${invite.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "business"}-intake.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createInvite() {
  const businessName = $("#inviteBusinessName").value.trim();
  const ownerEmail = $("#inviteOwnerEmail").value.trim().toLowerCase();
  const errorElement = $("#inviteError");
  errorElement.textContent = "";
  if (!businessName || !ownerEmail) { errorElement.textContent = "Completá el negocio y el email."; return; }
  const token = randomToken();
  const days = Number($("#inviteExpiryDays").value || 30);
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const { error } = await supabase.from("onboarding_invites").insert({ token_hash: await hashToken(token), business_name: businessName, owner_email: ownerEmail, expires_at: expiresAt });
  if (error) { errorElement.textContent = displayError(error); return; }
  $("#inviteDialog").close();
  $("#inviteForm").reset();
  const base = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}`;
  $("#createdInviteLink").value = `${base}#/i/${token}`;
  $("#inviteLinkDialog").showModal();
  await loadInvites();
}

async function initOperator() {
  $("#loadingState").hidden = true;
  $("#operatorApp").hidden = false;
  setSaveState("Consola interna");
  if (!supabase) {
    $("#operatorLoginError").textContent = "Falta configurar Supabase en este entorno.";
    return;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) await enterOperator();
}

async function enterOperator() {
  const { data, error } = await supabase.from("platform_operators").select("auth_user_id, display_name, active").maybeSingle();
  if (error || !data?.active) {
    await supabase.auth.signOut();
    $("#operatorLoginError").textContent = "Esta cuenta no está autorizada como operador de Sumi.";
    return;
  }
  $("#operatorLogin").hidden = true;
  $("#operatorConsole").hidden = false;
  try { await loadInvites(); } catch (failure) { toast(displayError(failure)); }
}

function bindEvents() {
  $("#onboardingForm").addEventListener("input", (event) => {
    const field = event.target;
    if (field.dataset.path) setPath(state.payload, field.dataset.path, field.type === "number" ? (field.value === "" ? null : Number(field.value)) : field.value);
    if (field.dataset.listPath) setPath(state.payload, field.dataset.listPath, lineList(field.value));
    if (field.dataset.arrayPath) {
      const values = $$(`[data-array-path="${field.dataset.arrayPath}"]:checked`).map((item) => item.value);
      setPath(state.payload, field.dataset.arrayPath, values);
    }
    if (field.dataset.path === "business.name") $("#ownerBusinessName").textContent = field.value || state.invite?.business_name || "Nuevo negocio";
    if (field.dataset.path === "business.domain") state.payload.qr.rootTarget = field.value;
    markDirty();
  });
  $("#onboardingForm").addEventListener("change", (event) => {
    if (event.target.matches("[data-file-category]")) uploadFiles(event.target);
  });
  $("#stepNav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-step-target]");
    if (!button) return;
    state.step = Number(button.dataset.stepTarget);
    renderStep();
  });
  $("#previousStepButton").addEventListener("click", () => { state.step = Math.max(0, state.step - 1); renderStep(); });
  $("#nextStepButton").addEventListener("click", () => {
    if (state.step === STEPS.length - 1) submitOwner();
    else { state.step += 1; renderStep(); }
  });
  $("#saveDraftButton").addEventListener("click", () => { state.dirty = true; saveDraft(true); });
  $("#addRewardButton").addEventListener("click", () => { state.payload.rewards.push({ name: "", description: "", pointsCost: 0, stock: null, active: true }); renderRewards(); markDirty(); });
  $("#rewardList").addEventListener("input", (event) => {
    const item = event.target.closest("[data-reward-index]");
    if (!item || !event.target.dataset.rewardField) return;
    const key = event.target.dataset.rewardField;
    state.payload.rewards[Number(item.dataset.rewardIndex)][key] = event.target.type === "number" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value;
    markDirty();
  });
  $("#rewardList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-reward]");
    if (!button) return;
    state.payload.rewards.splice(Number(button.dataset.removeReward), 1);
    renderRewards(); markDirty();
  });
  $("#ownerFileList").addEventListener("click", (event) => { const button = event.target.closest("[data-remove-file]"); if (button) removeOwnerFile(button.dataset.removeFile); });
  $("#operatorLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#operatorLoginError").textContent = "";
    const { error } = await supabase.auth.signInWithPassword({ email: $("#operatorEmail").value.trim(), password: $("#operatorPassword").value });
    if (error) $("#operatorLoginError").textContent = displayError(error);
    else await enterOperator();
  });
  $("#operatorLogoutButton").addEventListener("click", async () => { await supabase.auth.signOut(); location.reload(); });
  $("#newInviteButton").addEventListener("click", () => $("#inviteDialog").showModal());
  $("#createInviteButton").addEventListener("click", createInvite);
  $("#closeInviteLinkButton").addEventListener("click", () => $("#inviteLinkDialog").close());
  $("#copyInviteLinkButton").addEventListener("click", async () => { await navigator.clipboard.writeText($("#createdInviteLink").value); toast("Enlace copiado."); });
  $("#operatorSearch").addEventListener("input", renderOperator);
  $("#operatorStatusFilter").addEventListener("change", renderOperator);
  $("#inviteList").addEventListener("click", (event) => { const row = event.target.closest("[data-invite-id]"); if (row) openSubmission(row.dataset.inviteId); });
  $("#submissionDetail").addEventListener("click", async (event) => {
    if (event.target.closest("[data-close-detail]")) { $("#submissionDetail").hidden = true; $(".ob-console-layout").classList.remove("has-detail"); state.selectedInviteId = ""; renderOperator(); }
    const statusButton = event.target.closest("[data-review-status]");
    if (statusButton) await updateReview(statusButton.dataset.reviewStatus);
    if (event.target.closest("[data-export-submission]")) exportSubmission();
    if (event.target.closest("[data-revoke-invite]")) {
      const { error } = await supabase.from("onboarding_invites").update({ status: "revoked" }).eq("id", state.selectedInviteId);
      if (error) toast(displayError(error)); else { await loadInvites(); await openSubmission(state.selectedInviteId); toast("Enlace revocado."); }
    }
  });
  window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
}

async function init() {
  bindEvents();
  const route = routeFromHash();
  state.route = route.name;
  if (route.name === "invite") await initOwner(route.token);
  else if (route.name === "admin") await initOperator();
  else {
    $("#loadingState").hidden = true;
    $("#errorState").hidden = false;
    $("#errorMessage").textContent = "Usá el enlace privado que recibiste de Sumi.";
    setSaveState("Ruta no disponible", "error");
  }
}

window.addEventListener("hashchange", () => window.location.reload());
init();
