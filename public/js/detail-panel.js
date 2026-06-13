// 详情面板：点击节点展示科技全部信息。
const $ = (id) => document.getElementById(id);

let cfg = {};

export function initDetail(config) {
  cfg = config;
  $("detailClose").addEventListener("click", hide);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
}

export function show(tech) {
  const iconMap = cfg.iconMap || {};
  const ic = iconMap[tech.id];
  const iconBg = ic ? `background-image:url('assets/${ic.sheet}');background-position:-${ic.x}px -${ic.y}px` : "";

  const flags = [];
  if (tech.is_rare) flags.push(`<span class="badge rare">稀有</span>`);
  if (tech.is_dangerous) flags.push(`<span class="badge danger">危险</span>`);
  if (tech.is_start_tech) flags.push(`<span class="badge start">起始</span>`);
  if (tech.is_reverse_engineerable) flags.push(`<span class="badge" style="border-color:var(--rev);color:var(--rev)">可逆向</span>`);
  if (tech.is_repeatable) flags.push(`<span class="badge" style="border-color:var(--text-faint);color:var(--text-faint)">可重复</span>`);

  const areaName = { physics: "物理学", society: "社会学", engineering: "工程学" }[tech.area] || tech.area;
  const catName = cfg.catName(tech.category);

  // 成本 / 权重
  const cost = statBox("研究成本", tech.cost, tech.cost_raw);
  const weight = statBox("基础权重", tech.weight, tech.weight_raw);
  const tierBox = `<div class="dp-stat"><div class="lbl">层级</div><div class="val">T${tech.tier}</div></div>`;
  const dlcBox = tech.dlc && tech.dlc !== "core"
    ? `<div class="dp-stat"><div class="lbl">来源</div><div class="val" style="font-size:12px;font-family:var(--font)">${escapeHtml(tech.dlc)}</div></div>`
    : `<div class="dp-stat"><div class="lbl">来源</div><div class="val" style="font-size:12px;font-family:var(--font)">原版</div></div>`;

  // 前置（含 OR 备选组）
  const prereqHtml = renderPrereqs(tech);
  // 解锁（反向）
  const unlockHtml = renderUnlocks(tech);

  // 效果 modifier
  const modHtml = renderMods(tech);

  // feature flags
  const ffHtml = tech.feature_flags && tech.feature_flags.length
    ? `<div class="dp-section"><h4>功能标记</h4><div class="dp-mods">${tech.feature_flags.map((f) => `<div class="dp-mod"><span class="mk">${escapeHtml(f)}</span></div>`).join("")}</div></div>`
    : "";

  $("detailContent").innerHTML = `
    <div class="dp-head">
      <div class="dp-icon" style="${iconBg}">${ic ? "" : "？"}</div>
      <div class="dp-title">
        <h2>${escapeHtml(tech.name)}</h2>
        <div class="dp-id">${escapeHtml(tech.id)}</div>
        <div class="dp-badges">
          <span class="badge area">${areaName}</span>
          <span class="badge cat">${escapeHtml(catName)}</span>
          <span class="badge tier">T${tech.tier}</span>
          ${flags.join("")}
        </div>
      </div>
    </div>

    ${tech.desc ? `<div class="dp-desc">${tech.desc}</div>` : ""}

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
  for (const id of pureDirect) items.push(linkOf(id, false));
  for (const g of alts) {
    const opts = g.map((id) => linkOf(id, false)).join("");
    items.push(`<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">${opts}<span class="li-alt">（任一）</span></div>`);
  }
  if (!items.length) {
    return `<div class="dp-section"><h4>前置科技</h4><div class="dp-link" style="opacity:.5">无（起始或事件解锁）</div></div>`;
  }
  return `<div class="dp-section"><h4>前置科技</h4><div class="dp-links">${items.join("")}</div></div>`;
}

function renderUnlocks(tech) {
  const id = tech.id;
  const unlocks = cfg.unlocksOf ? (cfg.unlocksOf.get(id) || []) : [];
  if (!unlocks.length) return "";
  const items = unlocks.map((uid) => linkOf(uid, true)).join("");
  return `<div class="dp-section"><h4>解锁科技</h4><div class="dp-links">${items}</div></div>`;
}

function linkOf(id, isUnlock) {
  const t = cfg.resolveTech(id);
  if (!t) {
    return `<div class="dp-link" data-id="${escapeHtml(id)}"><span class="li-id">${escapeHtml(id)}</span><span class="li-alt" style="margin-left:8px">（其他分支）</span></div>`;
  }
  const iconMap = cfg.iconMap || {};
  const ic = iconMap[id];
  const bg = ic ? `background-image:url('assets/${ic.sheet}');background-position:-${ic.x}px -${ic.y}px` : "";
  return `<div class="dp-link" data-id="${escapeHtml(id)}">
    <div class="li-icon" style="${bg}"></div>
    <span>${escapeHtml(t.name)}</span>
    <span class="li-id">${escapeHtml(id)}</span>
  </div>`;
}

function renderMods(tech) {
  const mods = tech.modifier || [];
  if (!mods.length) return "";
  const rows = mods.map((m) => {
    const name = m.name ? escapeHtml(m.name) : `<span style="font-family:var(--mono);font-size:11px">${escapeHtml(m.key)}</span>`;
    const v = fmtMod(m.value, m.key);
    return `<div class="dp-mod"><span class="mk">${name}</span><span class="mv ${v.cls}">${v.text}</span></div>`;
  }).join("");
  return `<div class="dp-section"><h4>实际效果</h4><div class="dp-mods">${rows}</div></div>`;
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
  $("detailPanel").classList.remove("open");
}

function round1(n) { return Math.round(n * 10) / 10; }
function formatNum(n) { return n >= 10000 ? (n / 1000) + "k" : String(n); }
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
