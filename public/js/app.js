// 应用编排：加载全局数据、学科切换、模块串联。
import { initStarfield } from "./starfield.js";
import * as graph from "./graph.js";
import * as detail from "./detail-panel.js";
import { initFilters, getFilter, updateCategoryCounts } from "./search-filter.js";

const $ = (id) => document.getElementById(id);

const AREA_META = {
  physics: { color: "#4FC3F7", name: "物理学", en: "PHYSICS RESEARCH" },
  society: { color: "#66BB6A", name: "社会学", en: "SOCIETY RESEARCH" },
  engineering: { color: "#FFA726", name: "工程学", en: "ENGINEERING RESEARCH" },
};

let iconMap = {};
let catNameMap = {};
let globalTechs = new Map();
let categories = [];
let areaCache = {};
let currentArea = "physics";
let currentData = null;
const unlocksOf = new Map(); // id → [unlock ids]（供详情面板）
let searchMatches = null;

async function loadJson(p) {
  const r = await fetch(p);
  if (!r.ok) throw new Error("无法加载 " + p);
  return r.json();
}

async function boot() {
  initStarfield();

  const [iconData, catData, techsArr] = await Promise.all([
    loadJson("data/icon-sprite.json"),
    loadJson("data/categories.json"),
    loadJson("data/techs.json"),
  ]);
  iconMap = iconData.icons || {};
  categories = catData.categories || [];
  for (const c of categories) catNameMap[c.id] = c.name;
  for (const t of techsArr) globalTechs.set(t.id, t);

  // 详情面板
  detail.initDetail({
    iconMap,
    resolveTech: (id) => globalTechs.get(id),
    catName: (id) => catNameMap[id] || id,
    unlocksOf,
    onNavigate: navigateTo,
  });

  // 图
  graph.initGraph({
    onNodeClick: (t) => { graph.setSelected(t.id); detail.show(t); },
  });

  // 筛选
  initFilters({
    categories,
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

  await switchArea("physics");
}

async function switchArea(area) {
  if (currentArea === area && currentData) return;
  currentArea = area;
  const meta = AREA_META[area];

  document.querySelectorAll(".area-tab").forEach((b) => b.classList.toggle("active", b.dataset.area === area));
  $("graphTitle").innerHTML = `<b>${meta.name}</b> · ${meta.en}`;

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

  // 顶部 & 侧栏统计
  for (const a of Object.keys(AREA_META)) {
    const d = areaCache[a];
    $("cnt-" + a).textContent = d ? d.nodes.length : "";
  }
  const edgeCount = currentData.edges.filter((e) => !e.external).length;
  $("sbStats").innerHTML =
    `主科技 <b>${currentData.nodes.length}</b> · 可重复 <b>${(currentData.repeatables || []).length}</b><br>` +
    `前置关系 <b>${edgeCount}</b> 条`;

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
    if ((t.name || "").toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) m.add(t.id);
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
    `<div style="position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:99;background:#2a1414;border:1px solid #ef5350;color:#ef9a9a;padding:14px 22px;border-radius:8px;font-size:13px">加载失败：${err.message}<br>请用本地服务器打开（python3 -m http.server）</div>`);
});
