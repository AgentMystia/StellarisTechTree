// 详情面板：点击节点展示科技全部信息（双语）。
import { nameOf, descOf, t as tr, getLang, onLangChange } from "./i18n.js";

const $ = (id) => document.getElementById(id);

let cfg = {};
let currentTech = null;

export function initDetail(config) {
  cfg = config;
  $("detailClose").addEventListener("click", hide);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  // 语言切换时，若面板开着，用当前科技重新渲染
  onLangChange(() => { if (currentTech) show(currentTech); });
}

export function show(tech) {
  currentTech = tech;
  const iconMap = cfg.iconMap || {};
  const ic = iconMap[tech.id];
  const iconBg = ic ? `background-image:url('assets/${ic.sheet}');background-position:-${ic.x}px -${ic.y}px` : "";
  const lang = getLang();

  const flags = [];
  if (tech.is_rare) flags.push(`<span class="badge rare">${tr("badge.rare")}</span>`);
  if (tech.is_dangerous) flags.push(`<span class="badge danger">${tr("badge.danger")}</span>`);
  if (tech.is_start_tech) flags.push(`<span class="badge start">${tr("badge.start")}</span>`);
  if (tech.is_reverse_engineerable) flags.push(`<span class="badge" style="border-color:var(--rev);color:var(--rev)">${tr("badge.reverse")}</span>`);
  if (tech.is_repeatable) flags.push(`<span class="badge" style="border-color:var(--text-faint);color:var(--text-faint)">${tr("badge.repeatable")}</span>`);

  const areaName = tr("area." + tech.area);
  const catName = cfg.catName(tech.category);
  const dlcName = tech.dlc ? (tech.dlc[lang] || tech.dlc.en || tech.dlc.zh) : tr("detail.source.core");

  const cost = statBox(tr("detail.cost"), tech.cost, tech.cost_raw);
  const weight = statBox(tr("detail.weight"), tech.weight, tech.weight_raw);
  const tierBox = `<div class="dp-stat"><div class="lbl">${tr("detail.tier")}</div><div class="val">T${tech.tier}</div></div>`;
  const dlcBox = `<div class="dp-stat"><div class="lbl">${tr("detail.source")}</div><div class="val" style="font-size:12px;font-family:var(--font)">${escapeHtml(dlcName)}</div></div>`;

  const prereqHtml = renderPrereqs(tech);
  const unlockHtml = renderUnlocks(tech);
  const modHtml = renderMods(tech);
  const ffHtml = tech.feature_flags && tech.feature_flags.length
    ? `<div class="dp-section"><h4>${tr("detail.featureFlags")}</h4><div class="dp-mods">${tech.feature_flags.map((f) => `<div class="dp-mod"><span class="mk">${escapeHtml(f)}</span></div>`).join("")}</div></div>`
    : "";

  const desc = descOf(tech);

  $("detailContent").innerHTML = `
    <div class="dp-head">
      <div class="dp-icon" style="${iconBg}">${ic ? "" : "？"}</div>
      <div class="dp-title">
        <h2>${escapeHtml(nameOf(tech))}</h2>
        <div class="dp-id">${escapeHtml(tech.id)}</div>
        <div class="dp-badges">
          <span class="badge area">${areaName}</span>
          <span class="badge cat">${escapeHtml(catName)}</span>
          <span class="badge tier">T${tech.tier}</span>
          ${flags.join("")}
        </div>
      </div>
    </div>

    ${desc ? `<div class="dp-desc">${desc}</div>` : ""}

    <div class="dp-grid">${cost}${weight}${tierBox}${dlcBox}</div>

    ${prereqHtml}
    ${unlockHtml}
    ${modHtml}
    ${ffHtml}
  `;

  // 绑定前置/解锁链接点击 → 导航
  $("detailContent").querySelectorAll(".dp-link").forEach((a) => {
    a.addEventListener("click", () => {
      const id = a.dataset.id;
      if (id) cfg.onNavigate(id);
    });
  });

  $("detailPanel").classList.add("open");
}

function statBox(label, val, raw) {
  const shown = val != null ? formatNum(val) : "—";
  const rawTxt = raw && raw != val ? `<span class="raw">(${escapeHtml(raw)})</span>` : "";
  return `<div class="dp-stat"><div class="lbl">${label}</div><div class="val">${shown} ${rawTxt}</div></div>`;
}

function renderPrereqs(tech) {
  const direct = (tech.prerequisites || []);
  const alts = tech.prereq_alts || [];
  // direct 里已含 alts 展开的 id（build 阶段去重合并），展示时用 alts 标注「任一」
  const altSet = new Set();
  for (const g of alts) for (const x of g) altSet.add(x);
  const pureDirect = direct.filter((x) => !altSet.has(x));

  const items = [];
  for (const id of pureDirect) items.push(linkOf(id));
  for (const g of alts) {
    const opts = g.map((id) => linkOf(id)).join("");
    items.push(`<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">${opts}<span class="li-alt">${tr("detail.prereq.anyOf")}</span></div>`);
  }
  if (!items.length) {
    return `<div class="dp-section"><h4>${tr("detail.prereq")}</h4><div class="dp-link" style="opacity:.5">${tr("detail.prereq.none")}</div></div>`;
  }
  return `<div class="dp-section"><h4>${tr("detail.prereq")}</h4><div class="dp-links">${items.join("")}</div></div>`;
}

function renderUnlocks(tech) {
  const unlocks = cfg.unlocksOf ? (cfg.unlocksOf.get(tech.id) || []) : [];
  if (!unlocks.length) return "";
  const items = unlocks.map((uid) => linkOf(uid)).join("");
  return `<div class="dp-section"><h4>${tr("detail.unlock")}</h4><div class="dp-links">${items}</div></div>`;
}

function linkOf(id) {
  const t = cfg.resolveTech(id);
  if (!t) {
    return `<div class="dp-link" data-id="${escapeHtml(id)}"><span class="li-id">${escapeHtml(id)}</span><span class="li-alt" style="margin-left:8px">${tr("detail.link.otherBranch")}</span></div>`;
  }
  const iconMap = cfg.iconMap || {};
  const ic = iconMap[id];
  const bg = ic ? `background-image:url('assets/${ic.sheet}');background-position:-${ic.x}px -${ic.y}px` : "";
  return `<div class="dp-link" data-id="${escapeHtml(id)}">
    <div class="li-icon" style="${bg}"></div>
    <span>${escapeHtml(nameOf(t))}</span>
    <span class="li-id">${escapeHtml(id)}</span>
  </div>`;
}

function renderMods(tech) {
  const mods = tech.modifier || [];
  if (!mods.length) return "";
  const lang = getLang();
  const rows = mods.map((m) => {
    const locName = lang === "en" ? (m.name_en || m.name) : (m.name || m.name_en);
    const name = locName ? escapeHtml(locName) : `<span style="font-family:var(--mono);font-size:11px">${escapeHtml(m.key)}</span>`;
    const v = fmtMod(m.value, m.key);
    return `<div class="dp-mod"><span class="mk">${name}</span><span class="mv ${v.cls}">${v.text}</span></div>`;
  }).join("");
  return `<div class="dp-section"><h4>${tr("detail.effects")}</h4><div class="dp-mods">${rows}</div></div>`;
}

function fmtMod(v, key) {
  const n = parseFloat(v);
  if (isNaN(n)) return { text: escapeHtml(v), cls: "" };
  if (/mult|_perc/.test(key)) {
    const pct = (n * 100);
    return { text: (pct >= 0 ? "+" : "") + round1(pct) + "%", cls: pct >= 0 ? "pos" : "neg" };
  }
  return { text: (n >= 0 ? "+" : "") + round1(n), cls: n >= 0 ? "pos" : "neg" };
}

export function hide() {
  currentTech = null;
  $("detailPanel").classList.remove("open");
}

function round1(n) { return Math.round(n * 10) / 10; }
function formatNum(n) { return n >= 10000 ? (n / 1000) + "k" : String(n); }
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
