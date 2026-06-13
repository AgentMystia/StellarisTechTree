// 应用编排：加载全局数据、学科切换、双语 i18n 串联。
import { initStarfield } from "./starfield.js";
import * as graph from "./graph.js";
import * as detail from "./detail-panel.js";
import { initFilters, getFilter, updateCategoryCounts } from "./search-filter.js";
import { applyStatic, toggleLang, onLangChange, getLang, t as tr } from "./i18n.js";

const $ = (id) => document.getElementById(id);

const AREA_META = {
  physics: { color: "#4FC3F7" },
  society: { color: "#66BB6A" },
  engineering: { color: "#FFA726" },
};
const AREA_KEYS = ["physics", "society", "engineering"];

let iconMap = {};
let catMap = {};            // id → category {name, name_en}
let globalTechs = new Map();
let areaCache = {};
let currentArea = "physics";
let currentData = null;
const unlocksOf = new Map(); // id → [unlock ids]（供详情面板）
let searchMatches = null;

async function loadJson(p) {
  const r = await fetch(p);
  if (!r.ok) throw new Error("load failed: " + p);
  return r.json();
}

/** 按当前语言取类别显示名。 */
function catName(id) {
  const c = catMap[id];
  if (!c) return id || "";
  return getLang() === "en" ? (c.name_en || c.name) : (c.name || c.name_en);
}

/** 更新图标题 + 侧栏统计（双语）。 */
function updateChrome() {
  $("graphTitle").innerHTML = `<b>${tr("area.full." + currentArea)}</b>`;
  if (!currentData) return;
  const edgeCount = currentData.edges.filter((e) => !e.external).length;
  const suf = tr("stats.edges.suffix");
  $("sbStats").innerHTML =
    `${tr("stats.mainTech")} <b>${currentData.nodes.length}</b> · ${tr("stats.repeatable")} <b>${(currentData.repeatables || []).length}</b><br>` +
    `${tr("stats.edges")} <b>${edgeCount}</b>` + (suf ? " " + suf : "");
}

async function boot() {
  initStarfield();
  applyStatic(); // 应用初始语言到静态文本

  const [iconData, catData, techsArr] = await Promise.all([
    loadJson("data/icon-sprite.json"),
    loadJson("data/categories.json"),
    loadJson("data/techs.json"),
  ]);
  iconMap = iconData.icons || {};
  for (const c of (catData.categories || [])) catMap[c.id] = c;
  for (const t of techsArr) globalTechs.set(t.id, t);

  // 详情面板
  detail.initDetail({
    iconMap,
    resolveTech: (id) => globalTechs.get(id),
    catName,
    unlocksOf,
    onNavigate: navigateTo,
  });

  // 图
  graph.initGraph({
    onNodeClick: (t) => { graph.setSelected(t.id); detail.show(t); },
  });

  // 筛选
  initFilters({
    categories: catData.categories || [],
    onChange: applyState,
    onSearch: doSearch,
    onToggleRepeatable: (show) => $("repeatDrawer").classList.toggle("collapsed", !show),
  });
  // 可重复抽屉：点击表头 = 切换 checkbox
  $("rdHeader").addEventListener("click", () => {
    const cb = $("showRepeatable");
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event("change"));
  });
  $("repeatDrawer").classList.add("collapsed"); // 默认折叠

  // 学科 tab
  document.querySelectorAll(".area-tab").forEach((b) => {
    b.addEventListener("click", () => switchArea(b.dataset.area));
  });

  // 语言切换
  $("langToggle").addEventListener("click", toggleLang);
  onLangChange(() => { applyStatic(); updateChrome(); });

  await switchArea("physics");
}

async function switchArea(area) {
  if (currentArea === area && currentData) return;
  currentArea = area;
  const meta = AREA_META[area];

  document.querySelectorAll(".area-tab").forEach((b) => b.classList.toggle("active", b.dataset.area === area));

  if (!areaCache[area]) areaCache[area] = await loadJson(`data/${area}.json`);
  currentData = areaCache[area];

  // 反向边 → 解锁映射
  unlocksOf.clear();
  for (const e of currentData.edges) {
    if (e.external) continue;
    if (!unlocksOf.has(e.source)) unlocksOf.set(e.source, []);
    unlocksOf.get(e.source).push(e.target);
  }

  graph.render(currentData, { color: meta.color, iconMap });
  graph.renderRepeatables(currentData, { color: meta.color, iconMap }, (t) => {
    graph.setSelected(t.id);
    detail.show(t);
  });

  // 类别计数
  const counts = {};
  for (const t of currentData.nodes) counts[t.category] = (counts[t.category] || 0) + 1;
  updateCategoryCounts(counts);

  // 顶部 tab 计数
  for (const a of AREA_KEYS) {
    const d = areaCache[a];
    $("cnt-" + a).textContent = d ? d.nodes.length : "";
  }

  updateChrome();
  searchMatches = null;
  applyState();
}

function applyState() {
  graph.applyState(getFilter(), searchMatches);
}

function doSearch(q) {
  if (!q) { searchMatches = null; applyState(); return; }
  const m = new Set();
  for (const t of currentData.nodes) {
    const zh = (t.name || "").toLowerCase();
    const en = (t.name_en || "").toLowerCase();
    if (zh.includes(q) || en.includes(q) || t.id.toLowerCase().includes(q)) m.add(t.id);
  }
  searchMatches = m;
  applyState();
}

async function navigateTo(id) {
  const t = globalTechs.get(id);
  if (!t) return;
  if (t.area !== currentArea) await switchArea(t.area);
  graph.setSelected(id);
  graph.focusNode(id);
  detail.show(t);
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML("afterbegin",
    `<div style="position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:99;background:#2a1414;border:1px solid #ef5350;color:#ef9a9a;padding:14px 22px;border-radius:8px;font-size:13px">加载失败 / Load failed：${err.message}<br>请用本地服务器打开 / Serve via local http server (python3 -m http.server)</div>`);
});
