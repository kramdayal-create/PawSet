"use strict";

const $ = (sel) => document.querySelector(sel);
const SEVERITIES = ["critical", "high", "medium", "low", "info"];

let selectedFile = null;
let lastReport = null;
let activeFilter = "all";

// ---- element refs ----
const dropzone = $("#dropzone");
const fileInput = $("#file-input");
const fileNameEl = $("#file-name");
const authCheck = $("#authorized");
const scanBtn = $("#scan-btn");
const formError = $("#form-error");

// ---- file selection ----
function pickFile(file) {
  if (!file) return;
  const ok = /\.(apk|ipa|aab)$/i.test(file.name);
  if (!ok) {
    showError("Unsupported file type. Choose a .apk or .ipa file.");
    return;
  }
  selectedFile = file;
  fileNameEl.textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
  fileNameEl.hidden = false;
  hideError();
  updateScanButton();
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", (e) => pickFile(e.target.files[0]));

["dragover", "dragenter"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); }));
dropzone.addEventListener("drop", (e) => pickFile(e.dataTransfer.files[0]));

authCheck.addEventListener("change", updateScanButton);

function updateScanButton() {
  scanBtn.disabled = !(selectedFile && authCheck.checked);
}
function showError(msg) { formError.textContent = msg; formError.hidden = false; }
function hideError() { formError.hidden = true; }

// ---- run scan ----
scanBtn.addEventListener("click", runScan);

async function runScan() {
  if (!selectedFile || !authCheck.checked) return;
  hideError();
  $("#upload-card").hidden = true;
  $("#results").hidden = true;
  $("#progress").hidden = false;
  $("#progress-text").textContent = `Analyzing ${selectedFile.name}…`;

  const fd = new FormData();
  fd.append("file", selectedFile);
  fd.append("authorized", "true");

  try {
    const res = await fetch("/api/scan", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Scan failed (${res.status})`);
    lastReport = data;
    render(data);
  } catch (err) {
    $("#progress").hidden = true;
    $("#upload-card").hidden = false;
    showError(err.message || "Scan failed.");
  }
}

// ---- rendering ----
function render(data) {
  $("#progress").hidden = true;
  $("#results").hidden = false;

  // grade + risk
  const grade = data.summary.grade;
  const gradeEl = $("#grade");
  gradeEl.textContent = grade;
  gradeEl.className = "grade " + grade;
  const score = data.summary.risk_score;
  $("#risk-fill").style.width = score + "%";
  $("#risk-value").textContent = `${score} / 100`;

  // app meta
  const a = data.app;
  $("#app-label").textContent = a.label || a.file_name;
  const meta = [
    ["Platform", a.platform],
    ["Package", a.package || "—"],
    ["Version", a.version_name ? `${a.version_name} (${a.version_code || "?"})` : "—"],
    a.platform === "android"
      ? ["SDK", `min ${a.min_sdk || "?"} · target ${a.target_sdk || "?"}`]
      : ["Min iOS", a.min_sdk || "—"],
    a.extra && a.extra.architectures ? ["Arch", a.extra.architectures.join(", ")] : null,
    ["Size", `${(a.file_size / 1048576).toFixed(1)} MB`],
    ["SHA-256", short(a.sha256)],
  ].filter(Boolean);
  $("#app-meta").innerHTML = meta
    .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");

  // severity chips
  const counts = data.summary.severity_counts;
  $("#sev-chips").innerHTML = SEVERITIES.map((s) =>
    `<span class="sev-chip ${s}"><span class="n">${counts[s]}</span> ${s}</span>`).join("");

  // filters
  activeFilter = "all";
  const filters = ["all", ...SEVERITIES.filter((s) => counts[s] > 0)];
  $("#filters").innerHTML = filters.map((f) => {
    const label = f === "all" ? `All (${data.summary.total_findings})` : `${cap(f)} (${counts[f]})`;
    return `<button class="filter-btn ${f === "all" ? "active" : ""}" data-filter="${f}">${label}</button>`;
  }).join("");
  $("#filters").querySelectorAll(".filter-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      $("#filters").querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderFindings();
    }));

  // notes
  if (data.errors && data.errors.length) {
    $("#notes").hidden = false;
    $("#notes-list").innerHTML = data.errors.map((e) => `<li>${esc(e)}</li>`).join("");
  } else {
    $("#notes").hidden = true;
  }

  renderFindings();
}

function renderFindings() {
  const term = ($("#search").value || "").toLowerCase();
  const list = (lastReport.findings || []).filter((f) => {
    if (activeFilter !== "all" && f.severity !== activeFilter) return false;
    if (term) {
      const hay = (f.title + " " + f.description + " " + (f.location || "") + " " +
        (f.masvs || "") + " " + (f.category || "")).toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const container = $("#findings");
  if (!list.length) {
    container.innerHTML = `<div class="card empty">No findings match this filter. 🎉</div>`;
    return;
  }

  container.innerHTML = list.map((f, i) => {
    const tags = [
      f.category ? `<span class="tag">${esc(f.category)}</span>` : "",
      f.masvs ? `<span class="tag">${esc(f.masvs)}</span>` : "",
      f.owasp_mobile ? `<span class="tag">OWASP ${esc(f.owasp_mobile)}</span>` : "",
      f.id ? `<span class="tag">${esc(f.id)}</span>` : "",
    ].join("");
    const evidence = (f.evidence && f.evidence.length)
      ? `<div class="f-label">Evidence</div><ul class="evidence">${
          f.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`
      : "";
    const heur = f.confidence !== "firm"
      ? `<span class="heuristic-tag">heuristic</span>` : "";
    return `
      <div class="finding ${f.severity}" data-i="${i}">
        <div class="f-head">
          <span class="f-badge ${f.severity}">${f.severity}</span>
          <span class="f-title">${esc(f.title)}</span>
          ${heur}
          <span class="f-cat">${esc(f.category || "")}</span>
          <span class="f-chevron">▸</span>
        </div>
        <div class="f-body">
          <p>${esc(f.description)}</p>
          ${f.location ? `<div class="f-label">Location</div><p><code>${esc(f.location)}</code></p>` : ""}
          ${evidence}
          <div class="f-label">Recommendation</div>
          <p class="f-rec">${esc(f.recommendation)}</p>
          <div class="tags">${tags}</div>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".finding").forEach((el) =>
    el.querySelector(".f-head").addEventListener("click", () => el.classList.toggle("open")));
}

$("#search").addEventListener("input", () => { if (lastReport) renderFindings(); });

$("#download").addEventListener("click", () => {
  if (!lastReport) return;
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = (lastReport.app.package || lastReport.app.file_name || "scan").replace(/[^\w.-]/g, "_");
  a.href = url; a.download = `${base}.security-report.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---- helpers ----
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function short(h) { return h ? h.slice(0, 16) + "…" + h.slice(-8) : "—"; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
