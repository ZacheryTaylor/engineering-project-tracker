const UNLOCK_PIN = "0000";
const STATE_PATH = "data/state.json";
const LS_NAME = "ept-editor-name";
const LS_TOKEN = "ept-github-token";
const LS_OWNER = "ept-github-owner";
const LS_REPO = "ept-github-repo";

const PHASES = ["Kickoff", "Survey", "Design", "Permitting", "Construction", "Closeout"];
const HEALTH = ["On track", "Watch", "At risk"];
const PRIORITY = ["High", "Medium", "Low"];
const STATUS = ["Not started", "In progress", "Blocked", "Done"];

let state = { version: 1, updatedAt: null, updatedBy: null, projects: [] };
let unlocked = false;
let view = "all";
let activeId = null;
let searchQ = "";
let filterPhase = "";
let filterHealth = "";

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(d) {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : t;
}

function daysUntil(d) {
  const t = parseDate(d);
  if (t == null) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((t - now.getTime()) / 86400000);
}

function itemOpen(it) {
  return it.status !== "Done";
}

function collectNeeds() {
  const rows = [];
  for (const p of state.projects) {
    for (const kind of ["milestones", "actions"]) {
      for (const it of p[kind] || []) {
        if (!itemOpen(it)) continue;
        const du = daysUntil(it.dueDate);
        const overdue = du != null && du < 0;
        const soon = du != null && du >= 0 && du <= 7;
        const high = it.priority === "High";
        if (overdue || soon || high) {
          rows.push({ projectId: p.id, project: p.name, kind: kind === "milestones" ? "Milestone" : "Action", ...it, overdue, soon, du });
        }
      }
    }
  }
  rows.sort((a, b) => (a.du ?? 99) - (b.du ?? 99));
  return rows;
}

function metrics() {
  const n = state.projects.length;
  const lots = state.projects.reduce((s, p) => s + Number(p.lots || 0), 0);
  const acres = state.projects.reduce((s, p) => s + Number(p.acres || 0), 0);
  const risk = state.projects.filter((p) => p.health === "At risk").length;
  const needs = collectNeeds();
  const overdue = needs.filter((r) => r.overdue).length;
  return { n, lots, acres, risk, overdue, needs: needs.length };
}

function filteredProjects() {
  const q = searchQ.trim().toLowerCase();
  return state.projects.filter((p) => {
    if (filterPhase && p.phase !== filterPhase) return false;
    if (filterHealth && p.health !== filterHealth) return false;
    if (!q) return true;
    const blob = [p.name, p.client, p.location, p.type, p.pm, p.summary, p.notes].join(" ").toLowerCase();
    return blob.includes(q);
  });
}

function healthClass(h) {
  return "health-" + String(h).replace(/\s+/g, "-");
}

function setLockUI() {
  $("lockBadge").textContent = unlocked ? "Unlocked" : "Locked";
  $("lockBadge").className = "badge " + (unlocked ? "open" : "locked");
  $("btnUnlock").classList.toggle("hidden", unlocked);
  $("btnLockSave").classList.toggle("hidden", !unlocked);
  document.querySelectorAll("[data-edit]").forEach((el) => {
    el.disabled = !unlocked;
  });
}

function repoFromLocation() {
  const host = location.hostname;
  const m = host.match(/^([^.]+)\.github\.io$/i);
  if (m) {
    const owner = m[1];
    const parts = location.pathname.split("/").filter(Boolean);
    const repo = parts[0] || owner + ".github.io";
    return { owner, repo };
  }
  return {
    owner: localStorage.getItem(LS_OWNER) || "ZacheryTaylor",
    repo: localStorage.getItem(LS_REPO) || "engineering-project-tracker",
  };
}

async function loadState() {
  const res = await fetch(STATE_PATH + "?t=" + Date.now());
  if (!res.ok) throw new Error("Could not load " + STATE_PATH);
  state = await res.json();
  if (!Array.isArray(state.projects)) state.projects = [];
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function saveToGitHub() {
  const token = localStorage.getItem(LS_TOKEN);
  const name = localStorage.getItem(LS_NAME) || "editor";
  if (!token) throw new Error("Add a GitHub token in Settings.");
  const { owner, repo } = repoFromLocation();
  localStorage.setItem(LS_OWNER, owner);
  localStorage.setItem(LS_REPO, repo);
  state.updatedAt = new Date().toISOString();
  state.updatedBy = name;
  const content = JSON.stringify(state, null, 2) + "\n";
  const metaUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${STATE_PATH}`;
  const getRes = await fetch(metaUrl, { headers: githubHeaders(token) });
  if (!getRes.ok) throw new Error("GitHub read failed: " + getRes.status);
  const meta = await getRes.json();
  const putRes = await fetch(metaUrl, {
    method: "PUT",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `tracker: update by ${name}`,
      content: btoa(unescape(encodeURIComponent(content))),
      sha: meta.sha,
      branch: "main",
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error("GitHub save failed: " + putRes.status + " " + err.slice(0, 180));
  }
}

function renderMetrics() {
  const m = metrics();
  $("metrics").innerHTML = [
    ["Projects", m.n],
    ["Lots", m.lots],
    ["Acres", m.acres.toFixed(1)],
    ["At risk", m.risk],
    ["Overdue items", m.overdue],
    ["Immediate needs", m.needs],
  ].map(([l, n]) => `<div class="metric"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
  $("metaLine").textContent = state.updatedAt
    ? `Last save: ${state.updatedAt.replace("T", " ").slice(0, 16)} UTC by ${state.updatedBy || "—"}`
    : "";
}

function renderAll() {
  renderMetrics();
  const list = filteredProjects();
  $("cards").innerHTML = list.map((p) => `
    <article class="card" data-open="${p.id}">
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.client)} · ${esc(p.location)}</p>
      <div class="pills">
        <span class="pill">${esc(p.phase)}</span>
        <span class="pill ${healthClass(p.health)}">${esc(p.health)}</span>
        <span class="pill">${esc(p.type || "")}</span>
        <span class="pill">${p.lots || 0} lots</span>
      </div>
    </article>`).join("") || `<p class="muted">No projects match the filters.</p>`;
  $("cards").querySelectorAll("[data-open]").forEach((el) => {
    el.onclick = () => openProject(el.getAttribute("data-open"));
  });
}

function renderNeeds() {
  renderMetrics();
  const rows = collectNeeds();
  $("needsBody").innerHTML = rows.map((r) => `
    <tr>
      <td><a href="#" data-open="${r.projectId}">${esc(r.project)}</a></td>
      <td>${esc(r.kind)}</td>
      <td>${esc(r.title)}</td>
      <td>${esc(r.owner)}</td>
      <td>${esc(r.dueDate || "—")}${r.overdue ? " <strong class=\"health-At-risk\">overdue</strong>" : r.soon ? " <span class=\"muted\">soon</span>" : ""}</td>
      <td>${esc(r.priority)}</td>
      <td>${esc(r.status)}</td>
      <td>${esc(r.notes || "")}</td>
    </tr>`).join("") || `<tr><td colspan="8" class="muted">No immediate needs.</td></tr>`;
  $("needsBody").querySelectorAll("[data-open]").forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); openProject(a.getAttribute("data-open")); };
  });
}

function itemRows(project, kind) {
  const items = project[kind] || [];
  return items.map((it, idx) => `
    <tr>
      <td><input data-edit data-k="${kind}" data-i="${idx}" data-f="title" value="${escAttr(it.title)}"></td>
      <td><input data-edit data-k="${kind}" data-i="${idx}" data-f="owner" value="${escAttr(it.owner)}"></td>
      <td><input data-edit type="date" data-k="${kind}" data-i="${idx}" data-f="dueDate" value="${escAttr(it.dueDate || "")}"></td>
      <td>${sel(PRIORITY, it.priority, kind, idx, "priority")}</td>
      <td>${sel(STATUS, it.status, kind, idx, "status")}</td>
      <td><input data-edit data-k="${kind}" data-i="${idx}" data-f="notes" value="${escAttr(it.notes || "")}"></td>
      <td><button data-edit data-del="${kind}:${idx}">Remove</button></td>
    </tr>`).join("") || `<tr><td colspan="7" class="muted">None yet.</td></tr>`;
}

function sel(opts, val, kind, idx, f) {
  return `<select data-edit data-k="${kind}" data-i="${idx}" data-f="${f}">${opts.map((o) => `<option${o === val ? " selected" : ""}>${o}</option>`).join("")}</select>`;
}

function bindItemEdits(root, project) {
  root.querySelectorAll("[data-k]").forEach((el) => {
    el.addEventListener("change", () => {
      const k = el.getAttribute("data-k");
      const i = Number(el.getAttribute("data-i"));
      const f = el.getAttribute("data-f");
      project[k][i][f] = el.value;
    });
  });
  root.querySelectorAll("[data-del]").forEach((el) => {
    el.onclick = () => {
      const [k, i] = el.getAttribute("data-del").split(":");
      project[k].splice(Number(i), 1);
      renderWorkspace();
    };
  });
}

function renderWorkspace() {
  const p = state.projects.find((x) => x.id === activeId);
  if (!p) { view = "all"; showView(); return; }
  renderMetrics();
  $("wsTitle").textContent = p.name;
  $("wsFields").innerHTML = `
    <div class="grid-form">
      ${field("Name", "name", p.name)}
      ${field("Client", "client", p.client)}
      ${field("Location", "location", p.location)}
      ${field("Type", "type", p.type)}
      ${selectField("Phase", "phase", PHASES, p.phase)}
      ${selectField("Health", "health", HEALTH, p.health)}
      ${field("PM", "pm", p.pm)}
      ${dateField("Kickoff", "kickoffDate", p.kickoffDate)}
      ${field("Acres", "acres", p.acres, "number")}
      ${field("Lots", "lots", p.lots, "number")}
    </div>
    <div class="field"><label>Summary</label><textarea data-edit data-pf="summary">${esc(p.summary || "")}</textarea></div>
    <div class="field"><label>Notes</label><textarea data-edit data-pf="notes">${esc(p.notes || "")}</textarea></div>`;
  $("msBody").innerHTML = itemRows(p, "milestones");
  $("acBody").innerHTML = itemRows(p, "actions");
  $("wsFields").querySelectorAll("[data-pf]").forEach((el) => {
    el.addEventListener("change", () => {
      const f = el.getAttribute("data-pf");
      p[f] = el.type === "number" ? Number(el.value) : el.value;
    });
  });
  bindItemEdits($("msBody"), p);
  bindItemEdits($("acBody"), p);
  setLockUI();
}

function field(label, f, val, type) {
  return `<div class="field"><label>${label}</label><input data-edit data-pf="${f}" type="${type || "text"}" value="${escAttr(val ?? "")}"></div>`;
}
function dateField(label, f, val) {
  return `<div class="field"><label>${label}</label><input data-edit data-pf="${f}" type="date" value="${escAttr(val || "")}"></div>`;
}
function selectField(label, f, opts, val) {
  return `<div class="field"><label>${label}</label><select data-edit data-pf="${f}">${opts.map((o) => `<option${o === val ? " selected" : ""}>${o}</option>`).join("")}</select></div>`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escAttr(s) { return esc(s); }

function openProject(id) {
  activeId = id;
  view = "project";
  showView();
}

function showView() {
  $("viewAll").classList.toggle("hidden", view !== "all");
  $("viewNeeds").classList.toggle("hidden", view !== "needs");
  $("viewProject").classList.toggle("hidden", view !== "project");
  $("viewNew").classList.toggle("hidden", view !== "new");
  $("navAll").classList.toggle("active", view === "all");
  $("navNeeds").classList.toggle("active", view === "needs");
  if (view === "all") renderAll();
  if (view === "needs") renderNeeds();
  if (view === "project") renderWorkspace();
  setLockUI();
}

function addItem(kind) {
  const p = state.projects.find((x) => x.id === activeId);
  if (!p || !unlocked) return;
  p[kind] = p[kind] || [];
  p[kind].push({
    id: uid(kind.slice(0, 2)),
    title: "New item",
    owner: localStorage.getItem(LS_NAME) || "",
    dueDate: todayISO(),
    priority: "Medium",
    status: "Not started",
    notes: "",
  });
  renderWorkspace();
}

function submitNewProject() {
  if (!unlocked) { toast("Unlock with 0000 first."); return; }
  const name = $("npName").value.trim();
  if (!name) { toast("Project name is required."); return; }
  const p = {
    id: uid("p"),
    name,
    client: $("npClient").value.trim(),
    location: $("npLocation").value.trim(),
    type: $("npType").value.trim(),
    phase: $("npPhase").value,
    health: $("npHealth").value,
    pm: $("npPm").value.trim(),
    kickoffDate: $("npKickoff").value || todayISO(),
    acres: Number($("npAcres").value || 0),
    lots: Number($("npLots").value || 0),
    summary: $("npSummary").value.trim(),
    notes: $("npNotes").value.trim(),
    milestones: [],
    actions: [],
  };
  state.projects.unshift(p);
  openProject(p.id);
  toast("Project created. Lock & Save to share.");
}

function wire() {
  $("navAll").onclick = () => { view = "all"; showView(); };
  $("navNeeds").onclick = () => { view = "needs"; showView(); };
  $("navNew").onclick = () => {
    view = "new";
    showView();
  };
  $("search").oninput = () => { searchQ = $("search").value; renderAll(); };
  $("filterPhase").onchange = () => { filterPhase = $("filterPhase").value; renderAll(); };
  $("filterHealth").onchange = () => { filterHealth = $("filterHealth").value; renderAll(); };
  $("btnUnlock").onclick = () => $("pinModal").classList.add("show");
  $("pinCancel").onclick = () => $("pinModal").classList.remove("show");
  $("pinOk").onclick = () => {
    if ($("pinInput").value === UNLOCK_PIN) {
      unlocked = true;
      $("pinModal").classList.remove("show");
      $("pinInput").value = "";
      setLockUI();
      toast("Unlocked. Remember to Lock & Save.");
      showView();
    } else toast("Wrong PIN.");
  };
  $("btnLockSave").onclick = async () => {
    try {
      await saveToGitHub();
      unlocked = false;
      setLockUI();
      toast("Saved to GitHub and locked.");
    } catch (e) {
      toast(e.message);
    }
  };
  $("btnSettings").onclick = () => {
    $("setName").value = localStorage.getItem(LS_NAME) || "";
    $("setToken").value = localStorage.getItem(LS_TOKEN) || "";
    const r = repoFromLocation();
    $("setOwner").value = localStorage.getItem(LS_OWNER) || r.owner;
    $("setRepo").value = localStorage.getItem(LS_REPO) || r.repo;
    $("setModal").classList.add("show");
  };
  $("setCancel").onclick = () => $("setModal").classList.remove("show");
  $("setSave").onclick = () => {
    localStorage.setItem(LS_NAME, $("setName").value.trim());
    localStorage.setItem(LS_TOKEN, $("setToken").value.trim());
    localStorage.setItem(LS_OWNER, $("setOwner").value.trim());
    localStorage.setItem(LS_REPO, $("setRepo").value.trim());
    $("setModal").classList.remove("show");
    toast("Settings stored in this browser only.");
  };
  $("addMs").onclick = () => addItem("milestones");
  $("addAc").onclick = () => addItem("actions");
  $("npSubmit").onclick = submitNewProject;
  $("backAll").onclick = () => { view = "all"; showView(); };
}

async function init() {
  PHASES.forEach((p) => {
    const o = document.createElement("option");
    o.value = p; o.textContent = p;
    $("filterPhase").appendChild(o);
    $("npPhase").appendChild(o.cloneNode(true));
  });
  HEALTH.forEach((p) => {
    const o = document.createElement("option");
    o.value = p; o.textContent = p;
    $("filterHealth").appendChild(o);
    $("npHealth").appendChild(o.cloneNode(true));
  });
  wire();
  try {
    await loadState();
  } catch (e) {
    toast(e.message);
  }
  showView();
}

init();
