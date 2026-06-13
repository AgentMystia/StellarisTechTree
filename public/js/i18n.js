// 国际化：中英双语字典 + 语言状态 + 静态文本应用机制。
// 术语来源：学科/类别名取自游戏 localisation，badge 取自 paradoxwikis，其余为标准 UI 译名。
const STRINGS = {
  zh: {
    "title.page": "群星 Stellaris · 科技树",
    "brand.title": "群星 · 科技树",
    "area.physics": "物理学", "area.society": "社会学", "area.engineering": "工程学",
    "area.full.physics": "物理学研究", "area.full.society": "社会学研究", "area.full.engineering": "工程学研究",
    "search.placeholder": "搜索科技（中文名 / ID）…",
    "sidebar.tier": "层级 Tier", "sidebar.category": "类别 Category",
    "sidebar.flags": "标记", "sidebar.display": "显示",
    "flag.rare": "稀有", "flag.dangerous": "危险", "flag.start": "起始科技", "flag.reverse": "可逆向工程",
    "display.repeatable": "显示可重复科技", "display.dimUnrelated": "淡化无关节点",
    "toolbar.fit": "适应", "toolbar.fit.tooltip": "适应窗口",
    "toolbar.zoomIn.tooltip": "放大", "toolbar.zoomOut.tooltip": "缩小",
    "graph.hint": "拖拽平移 · 滚轮缩放 · 点击节点查看详情",
    "drawer.title": "可重复科技（REPEATABLE）", "drawer.expand": "展开 ▾", "drawer.collapse": "收起 ▴",
    "badge.rare": "稀有", "badge.danger": "危险", "badge.start": "起始",
    "badge.reverse": "可逆向", "badge.repeatable": "可重复",
    "node.startMark": "起始",
    "detail.cost": "研究成本", "detail.weight": "基础权重", "detail.tier": "层级",
    "detail.source": "来源", "detail.source.core": "原版",
    "detail.featureFlags": "功能标记", "detail.prereq": "前置科技",
    "detail.prereq.none": "无（起始或事件解锁）", "detail.prereq.anyOf": "（任一）",
    "detail.unlock": "解锁科技", "detail.link.otherBranch": "（其他分支）", "detail.effects": "实际效果",
    "stats.mainTech": "主科技", "stats.repeatable": "可重复",
    "stats.edges": "前置关系", "stats.edges.suffix": "条",
    "lang.toggle": "EN", "lang.toggle.tooltip": "Switch to English",
    "ai.badge.tooltip": "本项目全程由 GLM-5.2 自主完成",
  },
  en: {
    "title.page": "Stellaris · Tech Tree",
    "brand.title": "Stellaris · Tech Tree",
    "area.physics": "Physics", "area.society": "Society", "area.engineering": "Engineering",
    "area.full.physics": "Physics Research", "area.full.society": "Society Research", "area.full.engineering": "Engineering Research",
    "search.placeholder": "Search tech (name / ID)…",
    "sidebar.tier": "Tier", "sidebar.category": "Category",
    "sidebar.flags": "Flags", "sidebar.display": "Display",
    "flag.rare": "Rare", "flag.dangerous": "Dangerous", "flag.start": "Starting Tech", "flag.reverse": "Reverse-Engineerable",
    "display.repeatable": "Show repeatable techs", "display.dimUnrelated": "Dim unrelated nodes",
    "toolbar.fit": "Fit", "toolbar.fit.tooltip": "Fit to view",
    "toolbar.zoomIn.tooltip": "Zoom in", "toolbar.zoomOut.tooltip": "Zoom out",
    "graph.hint": "Drag to pan · Scroll to zoom · Click node for details",
    "drawer.title": "Repeatable Technologies (REPEATABLE)", "drawer.expand": "Expand ▾", "drawer.collapse": "Collapse ▴",
    "badge.rare": "Rare", "badge.danger": "Dangerous", "badge.start": "Starting",
    "badge.reverse": "Reverse-Eng.", "badge.repeatable": "Repeatable",
    "node.startMark": "Start",
    "detail.cost": "Research Cost", "detail.weight": "Base Weight", "detail.tier": "Tier",
    "detail.source": "Source", "detail.source.core": "Vanilla",
    "detail.featureFlags": "Feature Flags", "detail.prereq": "Prerequisites",
    "detail.prereq.none": "None (starting or event-locked)", "detail.prereq.anyOf": "(any of)",
    "detail.unlock": "Unlocks", "detail.link.otherBranch": "(other branch)", "detail.effects": "Effects",
    "stats.mainTech": "Main techs", "stats.repeatable": "Repeatable",
    "stats.edges": "Prerequisites", "stats.edges.suffix": "",
    "lang.toggle": "中", "lang.toggle.tooltip": "切换到中文",
    "ai.badge.tooltip": "Built entirely by GLM-5.2",
  },
};

const STORAGE_KEY = "stellaris-lang";
let lang = localStorage.getItem(STORAGE_KEY)
  || (navigator.language && navigator.language.startsWith("en") ? "en" : "zh");
const subs = new Set();

export function getLang() { return lang; }

export function t(key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.zh[key] || key;
}

/** 按当前语言取科技显示名（英文无则回退中文，再无回退 id）。 */
export function nameOf(tech) {
  if (!tech) return "";
  if (lang === "en") return tech.name_en || tech.name || tech.id;
  return tech.name || tech.name_en || tech.id;
}

export function descOf(tech) {
  if (!tech) return "";
  return lang === "en" ? (tech.desc_en || tech.desc || "") : (tech.desc || tech.desc_en || "");
}

export function setLang(l) {
  if (l === lang) return;
  lang = l;
  localStorage.setItem(STORAGE_KEY, l);
  document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  applyStatic();
  subs.forEach((cb) => { try { cb(lang); } catch (e) { console.error(e); } });
}

export function toggleLang() { setLang(lang === "zh" ? "en" : "zh"); }

export function onLangChange(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

/** 应用静态 HTML 文本：[data-i18n] / [data-i18n-title] / [data-i18n-placeholder]。 */
export function applyStatic() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}

// 初始 <html lang>
document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
