// 搜索 + 筛选控件。维护 filter 状态，变化时回调 app 重新应用。
const $ = (id) => document.getElementById(id);

const state = {
  tiers: new Set(),
  cats: new Set(),
  flags: new Set(),
  repeatable: false,
};

let callbacks = {};

export function initFilters({ categories, onChange, onSearch, onToggleRepeatable }) {
  callbacks = { onChange, onSearch, onToggleRepeatable };

  // 层级 chips
  const tc = $("tierChips");
  tc.innerHTML = "";
  for (let i = 0; i <= 5; i++) {
    const b = document.createElement("button");
    b.className = "tier-chip";
    b.textContent = "T" + i;
    b.dataset.tier = i;
    b.addEventListener("click", () => {
      if (state.tiers.has(i)) { state.tiers.delete(i); b.classList.remove("active"); }
      else { state.tiers.add(i); b.classList.add("active"); }
      emit();
    });
    tc.appendChild(b);
  }

  // 类别列表
  const cl = $("catList");
  cl.innerHTML = "";
  for (const c of categories) {
    const row = document.createElement("div");
    row.className = "cat-item";
    row.dataset.cat = c.id;
    row.innerHTML = `<span class="cat-dot" style="background:${areaColor()}"></span><span>${escapeHtml(c.name)}</span><span class="cat-count" data-count="${c.id}"></span>`;
    row.addEventListener("click", () => {
      if (state.cats.has(c.id)) { state.cats.delete(c.id); row.classList.remove("active"); }
      else { state.cats.add(c.id); row.classList.add("active"); }
      emit();
    });
    cl.appendChild(row);
  }

  // 标记 checkbox
  document.querySelectorAll('.chk input[data-flag]').forEach((box) => {
    box.addEventListener("change", () => {
      const f = box.dataset.flag;
      if (box.checked) state.flags.add(f); else state.flags.delete(f);
      emit();
    });
  });

  // 可重复开关
  $("showRepeatable").addEventListener("change", (e) => {
    state.repeatable = e.target.checked;
    if (callbacks.onToggleRepeatable) callbacks.onToggleRepeatable(state.repeatable);
  });

  // 搜索
  const si = $("searchInput");
  let timer = 0;
  si.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => callbacks.onSearch(si.value.trim().toLowerCase()), 180);
  });
}

function areaColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--area-color").trim() || "#4FC3F7";
}

function emit() {
  if (callbacks.onChange) callbacks.onChange(getFilter());
}

export function getFilter() {
  return {
    tiers: new Set(state.tiers),
    cats: new Set(state.cats),
    flags: new Set(state.flags),
  };
}

export function updateCategoryCounts(counts) {
  for (const [id, n] of Object.entries(counts)) {
    const el = document.querySelector(`.cat-count[data-count="${id}"]`);
    if (el) el.textContent = n;
  }
}

export function clearAll() {
  state.tiers.clear(); state.cats.clear(); state.flags.clear();
  document.querySelectorAll(".tier-chip.active, .cat-item.active").forEach((e) => e.classList.remove("active"));
  document.querySelectorAll('.chk input[data-flag]').forEach((b) => (b.checked = false));
  $("searchInput").value = "";
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
