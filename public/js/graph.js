// 科技树核心渲染：HTML 节点卡片 + SVG 边，CSS transform 缩放平移。
// 模块级单例状态。
import { nameOf, t as tr, onLangChange } from "./i18n.js";

const $ = (id) => document.getElementById(id);

let viewport, world, edgeLayer, nodeLayer;

let areaColor = "#4FC3F7";
let nodeW = 152, nodeH = 78;
let nodes = [];          // 当前 area 的主科技数组
let nodeMap = new Map(); // id → tech
let elMap = new Map();   // id → DOM 元素
let edges = [];          // 边数组
let edgeEls = [];        // 边 path 元素
let prereqsOf = new Map();// id → Set(前置 id)
let unlocksOf = new Map();// id → Set(解锁 id)
let cardEls = [];         // 可重复卡片 [{el, tech}]

let scale = 1, tx = 0, ty = 0;
let worldW = 0, worldH = 0;

let onNodeClickCb = () => {};
let onNodeHoverCb = () => {};

function round(n) { return Math.round(n * 10) / 10; }

export function initGraph({ onNodeClick, onNodeHover }) {
  viewport = $("viewport");
  world = $("world");
  edgeLayer = $("edgeLayer");
  nodeLayer = $("nodeLayer");
  onNodeClickCb = onNodeClick || onNodeClickCb;
  onNodeHoverCb = onNodeHover || onNodeHoverCb;
  bindPanZoom();
  onLangChange(applyLang);
}

function applyTransform() {
  world.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  $("zoomLevel").textContent = Math.round(scale * 100) + "%";
}

function bindPanZoom() {
  // 拖拽平移
  let dragging = false, sx = 0, sy = 0, stx = 0, sty = 0, moved = false;
  viewport.addEventListener("mousedown", (e) => {
    if (e.target.closest(".node")) return;
    dragging = true; moved = false;
    sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
    viewport.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    tx = stx + (e.clientX - sx);
    ty = sty + (e.clientY - sy);
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
    applyTransform();
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
    viewport.classList.remove("dragging");
  });

  // 滚轮缩放（围绕鼠标）
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0012;
    zoomAt(mx, my, Math.exp(delta));
  }, { passive: false });

  // 按钮
  $("btnZoomIn").addEventListener("click", () => zoomAt(viewport.clientWidth/2, viewport.clientHeight/2, 1.25));
  $("btnZoomOut").addEventListener("click", () => zoomAt(viewport.clientWidth/2, viewport.clientHeight/2, 0.8));
  $("btnFit").addEventListener("click", fitView);
}

function zoomAt(mx, my, factor) {
  const ns = Math.min(3, Math.max(0.12, scale * factor));
  // 鼠标处的世界坐标保持不动
  const wx = (mx - tx) / scale;
  const wy = (my - ty) / scale;
  scale = ns;
  tx = mx - wx * scale;
  ty = my - wy * scale;
  applyTransform();
}

export function fitView() {
  if (!worldW || !worldH) return;
  const pad = 50;
  const vw = viewport.clientWidth - pad * 2;
  const vh = viewport.clientHeight - pad * 2;
  scale = Math.min(vw / worldW, vh / worldH, 1.4);
  scale = Math.max(0.12, scale);
  tx = pad + (vw - worldW * scale) / 2;
  ty = pad + (vh - worldH * scale) / 2;
  applyTransform();
}

function iconStyle(tech, iconMap) {
  if (!iconMap || !iconMap[tech.id]) {
    return { bg: "", missing: true };
  }
  const m = iconMap[tech.id];
  return {
    bg: `background-image:url('assets/${m.sheet}');background-position:-${m.x}px -${m.y}px`,
    missing: false,
  };
}

export function render(areaData, { color, iconMap }) {
  areaColor = color;
  document.documentElement.style.setProperty("--area-color", color);
  nodes = areaData.nodes || [];
  nodeW = (areaData.nodeSize && areaData.nodeSize.w) || 152;
  nodeH = (areaData.nodeSize && areaData.nodeSize.h) || 78;
  edges = (areaData.edges || []).filter((e) => e.sections); // 只画有布线的 internal 边
  worldW = areaData.width || 0;
  worldH = areaData.height || 0;

  nodeMap = new Map(nodes.map((n) => [n.id, n]));
  elMap.clear();
  prereqsOf.clear();
  unlocksOf.clear();

  // 邻接表
  for (const e of edges) {
    if (!prereqsOf.has(e.target)) prereqsOf.set(e.target, new Set());
    if (!unlocksOf.has(e.source)) unlocksOf.set(e.source, new Set());
    prereqsOf.get(e.target).add(e.source);
    unlocksOf.get(e.source).add(e.target);
  }

  // 边层 SVG
  nodeLayer.innerHTML = "";
  edgeLayer.innerHTML = "";
  edgeLayer.setAttribute("width", worldW);
  edgeLayer.setAttribute("height", worldH);
  edgeLayer.setAttribute("viewBox", `0 0 ${worldW} ${worldH}`);
  edgeEls = [];
  for (const e of edges) {
    const sec = Array.isArray(e.sections) ? e.sections[0] : e.sections;
    if (!sec || !sec.startPoint) continue;
    const pts = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint];
    const d = "M" + pts.map((p) => `${round(p.x)},${round(p.y)}`).join(" L");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "edge-path");
    path.dataset.source = e.source;
    path.dataset.target = e.target;
    edgeLayer.appendChild(path);
    edgeEls.push({ el: path, source: e.source, target: e.target });
  }

  // 节点
  for (const t of nodes) {
    const el = document.createElement("div");
    el.className = "node";
    if (t.is_rare) el.classList.add("rare");
    if (t.is_dangerous) el.classList.add("danger");
    if (t.is_start_tech) el.classList.add("start");
    el.dataset.id = t.id;
    el.style.left = round(t.x) + "px";
    el.style.top = round(t.y) + "px";

    const ic = iconStyle(t, iconMap);
    const flags = [];
    if (t.is_rare) flags.push(`<span class="fl rare" title="${tr("flag.rare")}"></span>`);
    if (t.is_dangerous) flags.push(`<span class="fl danger" title="${tr("flag.dangerous")}"></span>`);

    el.innerHTML = `
      <div class="node-icon" style="${ic.bg}">${ic.missing ? "?" : ""}</div>
      <div class="node-body">
        <div class="node-name">${escapeHtml(nameOf(t))}</div>
        <div class="node-meta">
          <span class="node-cost">⚡${t.cost != null ? formatNum(t.cost) : "—"}</span>
          <span class="node-tier">T${t.tier}</span>
        </div>
      </div>
      ${t.is_start_tech ? `<span class="start-mark">${tr("node.startMark")}</span>` : ""}
      ${flags.length ? `<div class="node-flag">${flags.join("")}</div>` : ""}
    `;

    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onNodeClickCb(t);
    });
    el.addEventListener("mouseenter", () => { highlightNeighbors(t.id, true); onNodeHoverCb(t); });
    el.addEventListener("mouseleave", () => { highlightNeighbors(t.id, false); });

    nodeLayer.appendChild(el);
    elMap.set(t.id, el);
  }

  fitView();
}

function highlightNeighbors(id, on) {
  if (!on) {
    for (const { el } of edgeEls) el.classList.remove("highlight", "dim");
    return;
  }
  const connected = new Set([id, ...(prereqsOf.get(id) || []), ...(unlocksOf.get(id) || [])]);
  for (const e of edgeEls) {
    if (connected.has(e.source) && connected.has(e.target)) e.el.classList.add("highlight");
    else e.el.classList.add("dim");
  }
}

export function setSelected(id) {
  for (const [, el] of elMap) el.classList.remove("selected");
  const el = elMap.get(id);
  if (el) el.classList.add("selected");
}

export function focusNode(id) {
  const t = nodeMap.get(id);
  if (!t) return;
  const cx = t.x + nodeW / 2;
  const cy = t.y + nodeH / 2;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  scale = Math.max(scale, 0.85);
  tx = vw / 2 - cx * scale - 200; // 留出右侧详情面板空间
  ty = vh / 2 - cy * scale;
  applyTransform();
}

// 应用筛选 + 搜索状态
export function applyState(filter, searchMatches) {
  for (const t of nodes) {
    const el = elMap.get(t.id);
    if (!el) continue;
    // 筛选可见性
    let visible = true;
    if (filter.tiers && filter.tiers.size && !filter.tiers.has(t.tier)) visible = false;
    if (visible && filter.cats && filter.cats.size && !filter.cats.has(t.category)) visible = false;
    if (visible && filter.flags && filter.flags.size) {
      let ok = false;
      for (const f of filter.flags) if (t[f]) { ok = true; break; }
      if (!ok) visible = false;
    }
    el.classList.toggle("hide", !visible);
    // 搜索高亮
    el.classList.remove("match", "dim");
    if (visible && searchMatches && searchMatches.size) {
      if (searchMatches.has(t.id)) el.classList.add("match");
      else el.classList.add("dim");
    }
  }
}

// 可重复科技抽屉渲染
export function renderRepeatables(areaData, { color, iconMap }, onCardClick) {
  const body = $("rdBody");
  body.innerHTML = "";
  document.documentElement.style.setProperty("--area-color", color);
  cardEls = [];
  for (const t of areaData.repeatables || []) {
    const card = document.createElement("div");
    card.className = "rd-card";
    const ic = iconStyle(t, iconMap);
    card.innerHTML = `
      <div class="node-icon" style="${ic.bg}">${ic.missing ? "?" : ""}</div>
      <div class="node-body">
        <div class="node-name">${escapeHtml(nameOf(t))}</div>
        <div class="node-meta"><span class="node-cost">⚡${t.cost != null ? formatNum(t.cost) : "—"}</span><span class="node-tier">T${t.tier}</span></div>
      </div>`;
    card.addEventListener("click", () => onCardClick(t));
    body.appendChild(card);
    cardEls.push({ el: card, tech: t });
  }
}

// 语言切换：刷新节点/卡片文字（保留 DOM 与布局）
export function applyLang() {
  for (const [id, el] of elMap) {
    const tech = nodeMap.get(id);
    if (!tech) continue;
    const nm = el.querySelector(".node-name");
    if (nm) nm.textContent = nameOf(tech);
    const sm = el.querySelector(".start-mark");
    if (sm) sm.textContent = tr("node.startMark");
    const fr = el.querySelector(".fl.rare"); if (fr) fr.title = tr("flag.rare");
    const fd = el.querySelector(".fl.danger"); if (fd) fd.title = tr("flag.dangerous");
  }
  for (const { el, tech } of cardEls) {
    const nm = el.querySelector(".node-name");
    if (nm) nm.textContent = nameOf(tech);
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatNum(n) {
  if (n >= 10000) return (n / 1000) + "k";
  return String(n);
}
