#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stellaris 网页科技树 —— 数据构建管线

从游戏目录（只读）解析科技定义、中文本地化、图标，输出到 public/data 与 public/assets。
绝不以写模式打开游戏目录。
"""

import json
import os
import re
import sys
from pathlib import Path

from PIL import Image  # Pillow 12.x，支持 DDS 解码

# --------------------------------------------------------------------------- #
# 路径
# --------------------------------------------------------------------------- #
SCRIPT_DIR = Path(__file__).resolve().parent
GAME = Path(os.environ.get(
    "STELLARIS_PATH",
    Path.home() / ".local/share/Steam/steamapps/common/Stellaris",
))
PUBLIC = SCRIPT_DIR / "public"
DATA = PUBLIC / "data"
ASSETS = PUBLIC / "assets"

TECH_DIR = GAME / "common" / "technology"
SV_DIR = GAME / "common" / "scripted_variables"
LOC_DIR = GAME / "localisation" / "simp_chinese"
LOC_DIR_EN = GAME / "localisation" / "english"
ICON_DIR = GAME / "gfx" / "interface" / "icons" / "technologies"

AREAS = ("physics", "society", "engineering")

# 文件名 → DLC/来源 显示名（中英双语，用于详情面板标注来源）
DLC_MAP = [
    (r"_phys_tech\.txt$|_soc_tech\.txt$|_eng_tech\.txt$|_megastructures\.txt$|_strategic_resources", "原版", "Core"),
    (r"ancient_relics", "远古遗物", "Ancient Relics"),
    (r"apocalypse", "启示录", "Apocalypse"),
    (r"astral_planes", "星象位面", "Astral Planes"),
    (r"biogenesis", "生命起源", "Biogenesis"),
    (r"cosmic_storm", "宇宙风暴", "Cosmic Storms"),
    (r"distant_stars", "遥远群星", "Distant Stars"),
    (r"extreme_frontiers", "极限边疆", "Extreme Frontiers"),
    (r"fallen_empire", "堕落帝国", "Fallen Empire"),
    (r"first_contact", "第一次接触", "First Contact"),
    (r"grand_archive", "大档案馆", "Grand Archive"),
    (r"horizonsignal", "地平线信号", "Horizon Signal"),
    (r"leviathans", "利维坦", "Leviathans"),
    (r"machine_age", "机械纪元", "Machine Age"),
    (r"megacorp", "巨型企业", "Megacorp"),
    (r"overlord", "霸主", "Overlord"),
    (r"plantoids", "植物族", "Plantoids"),
    (r"shroud", "虚境", "Shroud"),
    (r"strange_worlds", "奇异世界", "Strange Worlds"),
    (r"synthetic_dawn", "机械黎明", "Synthetic Dawn"),
    (r"_weapon_tech\.txt$", "原版", "Core"),  # 武器归入 Core
    (r"_repeatable", "原版", "Core"),          # 可重复归入 Core
]
CORE_DLC = {"zh": "原版", "en": "Core"}


def dlc_from_filename(name: str) -> dict:
    for pat, zh, en in DLC_MAP:
        if re.search(pat, name):
            return {"zh": zh, "en": en}
    return dict(CORE_DLC)


# --------------------------------------------------------------------------- #
# Paradox 脚本：tokenizer + 递归解析器
# --------------------------------------------------------------------------- #
def tokenize(text: str):
    """把 Paradox 脚本文本切成 token：('word', s) / ('str', s) / 单字符 '{}='。"""
    tokens = []
    i, n = 0, len(text)
    delims = set(' \t\r\n{}=#"')
    while i < n:
        c = text[i]
        if c in ' \t\r\n':
            i += 1
        elif c == '#':
            while i < n and text[i] != '\n':
                i += 1
        elif c == '"':
            j = i + 1
            buf = []
            while j < n and text[j] != '"':
                buf.append(text[j])
                j += 1
            tokens.append(('str', ''.join(buf)))
            i = j + 1
        elif c in '{}=':
            tokens.append((c, c))
            i += 1
        else:
            j = i
            while j < n and text[j] not in delims:
                j += 1
            tokens.append(('word', text[i:j]))
            i = j
    return tokens


def parse_block(tokens, pos):
    """解析一个 {} 块或顶层，返回 (obj, pos)。
    若块内含 key=value 赋值 → dict（重复 key 收为 list）；
    否则（纯裸值，如 prerequisites 列表）→ list。"""
    result = {}
    items = []
    n = len(tokens)
    while pos < n:
        typ, val = tokens[pos]
        if typ == '}':
            # 块内既有赋值又有裸值（如 prerequisites = { tech_a OR={...} }）时，
            # 把裸值收进 '_items' 一并返回，避免丢失必须前置。
            if result and items:
                result['_items'] = items
                return result, pos + 1
            return (result if result else items, pos + 1)
        if typ in ('word', 'str'):
            nxt = tokens[pos + 1] if pos + 1 < n else (None, None)
            if nxt[0] == '=':
                key, pos = val, pos + 2
                value, pos = parse_value(tokens, pos)
                if key in result:
                    cur = result[key]
                    result[key] = cur + [value] if isinstance(cur, list) else [cur, value]
                else:
                    result[key] = value
            else:
                items.append(val)
                pos += 1
        else:
            pos += 1  # 意外的 token，跳过
    return (result if result else items, pos)


def parse_value(tokens, pos):
    typ, val = tokens[pos]
    if typ == '{':
        return parse_block(tokens, pos + 1)
    pos += 1
    return val, pos  # str / word（含数字、@宏、yes/no）


def parse_script(path: Path) -> dict:
    text = path.read_text(encoding='utf-8-sig', errors='replace')
    obj, _ = parse_block(tokenize(text), 0)
    return obj if isinstance(obj, dict) else {}


# --------------------------------------------------------------------------- #
# 宏（scripted_variables）
# --------------------------------------------------------------------------- #
MACRO_RE = re.compile(r'^@(\w+)\s*=\s*(-?\d+\.?\d*)\s*$', re.MULTILINE)


def load_macros() -> dict:
    macros = {}
    if not SV_DIR.exists():
        return macros
    for f in sorted(SV_DIR.glob('*.txt')):
        for m in MACRO_RE.finditer(f.read_text(encoding='utf-8-sig', errors='replace')):
            name = '@' + m.group(1)
            raw = m.group(2)
            macros[name] = float(raw) if '.' in raw else int(raw)
    return macros


def resolve_macro(token, macros):
    """token 若是 @宏，返回 (数值, 原文)；否则 (字面值或None, 原文)。"""
    if token is None:
        return None, None
    if isinstance(token, str) and token.startswith('@'):
        return macros.get(token, None), token
    # 数字串
    if isinstance(token, str) and re.fullmatch(r'-?\d+\.?\d*', token):
        return float(token) if '.' in token else int(token), token
    return token, token


def yn(v):
    # 字段可能重复定义（如 tech_psi_jump_drive_1 有两次 is_dangerous = yes），
    # 解析器把重复键收成 list —— 任一为 yes 即视为真。
    if isinstance(v, list):
        return any(x == 'yes' for x in v)
    return v == 'yes'


# --------------------------------------------------------------------------- #
# 科技解析
# --------------------------------------------------------------------------- #
def listify(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def _collect_strs(d):
    """递归收集结构里的所有 str 叶子（用于 OR/AND 嵌套块）。"""
    out = []
    if isinstance(d, dict):
        for v in d.values():
            out.extend(_collect_strs(v))
    elif isinstance(d, list):
        for v in d:
            out.extend(_collect_strs(v))
    elif isinstance(d, str):
        out.append(d)
    return out


def extract_prereqs(block_val):
    """从 prerequisites 块提取前置。
    块内可能含 OR={...}（任一即可）等嵌套条件块，例如：
        prerequisites = { tech_a  OR = { tech_b  tech_c } }
    返回 (direct, alts)：
      direct = 直接列出的必须前置（bare 值 / '_items'）
      alts   = 每个 OR/AND 组里的所有 tech id 列表
    对树布局而言，全部作为前置边；alts 供详情面板标注「任一」。"""
    direct = []
    alts = []
    if block_val is None:
        return direct, alts
    if isinstance(block_val, str):
        return [block_val], alts
    if isinstance(block_val, list):  # 纯裸值列表（最常见）
        return [x for x in block_val if isinstance(x, str)], alts
    if isinstance(block_val, dict):  # 含 OR/AND，可能带 '_items'
        direct = [x for x in block_val.get('_items', []) if isinstance(x, str)]
        for k, v in block_val.items():
            if k == '_items':
                continue
            grp = _collect_strs(v)
            if grp:
                alts.append(grp)
    return direct, alts


def flatten_modifier(mod):
    """把 modifier 块的标量叶子抽成 [{key, value}] 列表，供详情面板展示游戏效果。"""
    out = []
    if isinstance(mod, dict):
        for k, v in mod.items():
            if isinstance(v, (dict, list)):
                continue  # 嵌套块略过（动态/复杂修正）
            out.append({"key": k, "value": v})
    return out


def parse_all_techs(macros: dict):
    techs = []
    files = sorted(p for p in TECH_DIR.glob('*.txt'))
    for f in files:
        if f.name == '000_documentation.txt':
            continue
        dlc = dlc_from_filename(f.name)
        root = parse_script(f)
        for key, block in root.items():
            if not key.startswith('tech_') or not isinstance(block, dict):
                continue
            area = block.get('area')
            if area not in AREAS:
                continue  # technology_swap 内层 / 无效条目

            # tier（可能是 @宏）
            tier_val, tier_raw = resolve_macro(block.get('tier'), macros)
            tier = int(tier_val) if isinstance(tier_val, (int, float)) else 0

            # cost（标量 或 块{factor=...}）
            cost_obj = block.get('cost')
            if isinstance(cost_obj, dict):
                cost_obj = cost_obj.get('factor')
            cost_val, cost_raw = resolve_macro(cost_obj, macros)

            # weight
            w_val, w_raw = resolve_macro(block.get('weight'), macros)

            # category
            cat = listify(block.get('category'))
            category = cat[0] if cat else None

            # prerequisites（可能含 OR/AND 嵌套块）
            p_direct, p_alts = extract_prereqs(block.get('prerequisites'))
            # 去重保序：直接前置优先，再补 OR 组里的未出现的
            seen = set(p_direct)
            for grp in p_alts:
                for p in grp:
                    if p not in seen:
                        seen.add(p)
                        p_direct.append(p)
            prereqs = p_direct
            prereq_alts = p_alts

            # feature_flags
            flags = listify(block.get('feature_flags'))

            # 可重复判定
            levels = block.get('levels')
            try:
                levels_n = int(levels) if levels is not None and re.fullmatch(r'-?\d+', str(levels)) else None
            except (ValueError, TypeError):
                levels_n = None
            wg = listify(block.get('weight_groups'))
            is_repeatable = (levels_n == -1) or ('repeatable' in wg) or ('repeatable' in f.name.lower())

            tech = {
                "id": key,
                "name": key,            # 占位，后由本地化覆盖
                "desc": "",
                "area": area,
                "tier": tier,
                "category": category,
                "cost": cost_val,
                "cost_raw": cost_raw,
                "weight": w_val,
                "weight_raw": w_raw,
                "prerequisites": prereqs,
                "prereq_alts": prereq_alts,
                "is_rare": yn(block.get('is_rare')),
                "is_dangerous": yn(block.get('is_dangerous')),
                "is_start_tech": yn(block.get('start_tech')),
                "is_repeatable": is_repeatable,
                "is_reverse_engineerable": yn(block.get('is_reverse_engineerable')),
                "feature_flags": flags,
                "modifier": flatten_modifier(block.get('modifier')),
                "levels": levels_n,
                "icon": key,
                "dlc": dlc,
            }
            techs.append(tech)
    return techs


# --------------------------------------------------------------------------- #
# 本地化
# --------------------------------------------------------------------------- #
LOC_LINE_RE = re.compile(r'^\s*([A-Za-z0-9_]+):[0-9]*\s+"(.*)"\s*$')

# Paradox 颜色码 → CSS class
COLOR_CLASS = {
    'H': 'c-h', 'G': 'c-g', 'Y': 'c-y', 'R': 'c-r', 'E': 'c-e',
    'M': 'c-m', 'g': 'c-dg', 'W': 'c-w', 'S': 'c-s', 'L': 'c-l',
    'T': 'c-t', 'P': 'c-p', 'l': 'c-l',
}
SECTION_RE = re.compile(r"\['([A-Za-z0-9_:]+)'\]")
DOLLAR_RE = re.compile(r'\$([A-Za-z0-9_]+)\$')


def load_loc_raw(loc_dir=LOC_DIR) -> dict:
    raw = {}
    if not loc_dir.exists():
        return raw
    for f in sorted(loc_dir.glob('*.yml')):
        try:
            text = f.read_text(encoding='utf-8-sig', errors='replace')
        except OSError:
            continue
        for line in text.splitlines():
            m = LOC_LINE_RE.match(line)
            if m:
                raw[m.group(1)] = m.group(2)
    return raw


def resolve_vars(s: str, loc: dict, depth: int = 0) -> str:
    if depth > 6 or '$' not in s:
        return s

    def repl(m):
        key = m.group(1)
        if key in loc:
            return resolve_vars(loc[key], loc, depth + 1)
        return m.group(0)  # 找不到，保留 $key$

    return DOLLAR_RE.sub(repl, s)


def convert_color(s: str) -> str:
    """把 §X/§! 转成配对 <span>。多余的 §! 忽略，未闭合的 span 末尾补上。"""
    out = []
    open_count = 0
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c == '§' and i + 1 < n:
            code = s[i + 1]
            if code == '!':
                if open_count > 0:
                    out.append('</span>')
                    open_count -= 1
                i += 2
                continue
            cls = COLOR_CLASS.get(code)
            if cls:
                out.append(f'<span class="{cls}">')
                open_count += 1
                i += 2
                continue
            i += 2  # 未知码，吞掉
            continue
        out.append(c)
        i += 1
    out.append('</span>' * open_count)
    return ''.join(out)


def resolve_concepts(s: str, loc: dict, depth: int = 0) -> str:
    """['concept_key'] → 本地化文本；找不到则去掉方括号显示 key。"""
    if depth > 3:
        return s

    def repl(m):
        key = m.group(1)
        if key in loc:
            return loc[key]
        return key

    return SECTION_RE.sub(repl, s)


def process_text(s: str, loc: dict) -> str:
    if not s:
        return ''
    s = resolve_vars(s, loc)
    s = resolve_concepts(s, loc)
    s = convert_color(s)
    return s


# --------------------------------------------------------------------------- #
# 图标：DDS → 按学科雪碧图 PNG
# --------------------------------------------------------------------------- #
CELL = 52
COLS = 16


def build_sprites(techs):
    """按 area 把 tech 图标拼成雪碧图，返回 {tech_id: {sheet, x, y}}。"""
    ASSETS.mkdir(parents=True, exist_ok=True)
    mapping = {}
    icon_cell = CELL  # 科技图标格
    for area in AREAS:
        ids = [t["id"] for t in techs if t["area"] == area and t["icon"]]
        # 去重保序
        seen = set()
        ids = [x for x in ids if not (x in seen or seen.add(x))]
        cols = COLS
        rows = (len(ids) + cols - 1) // cols or 1
        sheet = Image.new('RGBA', (cols * icon_cell, rows * icon_cell), (0, 0, 0, 0))
        missing = []
        for idx, tid in enumerate(ids):
            dds = ICON_DIR / f"{tid}.dds"
            if not dds.exists():
                missing.append(tid)
                continue
            try:
                im = Image.open(dds).convert('RGBA')
            except Exception as e:
                print(f"  ⚠ 无法解码 {dds.name}: {e}", file=sys.stderr)
                missing.append(tid)
                continue
            cx = (idx % cols) * icon_cell
            cy = (idx // cols) * icon_cell
            sheet.paste(im, (cx, cy))
            mapping[tid] = {"sheet": f"sprite-{area}.png", "x": cx, "y": cy}
        out_png = ASSETS / f"sprite-{area}.png"
        sheet.save(out_png)
        print(f"  🖼  {area}: {len(ids)} 图标 → {out_png.name}（缺 {len(missing)}）"
              + (f"：{missing}" if missing else ""))
    # category 雪碧图
    cat_map = build_category_sprite()
    return mapping, cat_map


def build_category_sprite():
    cat_file = TECH_DIR / "category" / "00_category.txt"
    cat_map = {}
    if not cat_file.exists():
        return cat_map
    root = parse_script(cat_file)
    cats = [k for k in root.keys() if isinstance(root[k], dict)]
    cell = 29
    cols = 8
    rows = (len(cats) + cols - 1) // cols or 1
    sheet = Image.new('RGBA', (cols * cell, rows * cell), (0, 0, 0, 0))
    for idx, name in enumerate(sorted(cats)):
        icon_rel = root[name].get('icon')
        if not icon_rel:
            continue
        # icon 形如 "gfx/interface/icons/technologies/categories/category_xxx.dds"
        dds = GAME / icon_rel.strip('"')
        if not dds.exists():
            continue
        try:
            im = Image.open(dds).convert('RGBA')
        except Exception:
            continue
        cx = (idx % cols) * cell
        cy = (idx // cols) * cell
        # 居中放进 29x29
        sheet.paste(im, (cx, cy))
        cat_map[name] = {"sheet": "sprite-categories.png", "x": cx, "y": cy, "size": cell}
    sheet.save(ASSETS / "sprite-categories.png")
    return cat_map


# --------------------------------------------------------------------------- #
# tier / category 元数据
# --------------------------------------------------------------------------- #
def load_tiers(macros):
    f = TECH_DIR / "tier" / "00_tier.txt"
    out = {}
    if f.exists():
        root = parse_script(f)
        for k, v in root.items():
            if isinstance(v, dict):
                pu = v.get('previously_unlocked')
                pu_n, _ = resolve_macro(pu, macros)
                out[k] = {"tier": int(k), "previously_unlocked": pu_n}
    return out


def load_categories(loc, loc_en):
    f = TECH_DIR / "category" / "00_category.txt"
    out = []
    if f.exists():
        root = parse_script(f)
        for k, v in root.items():
            if not isinstance(v, dict):
                continue
            out.append({
                "id": k,
                "name": process_text(loc.get(k, k), loc),
                "desc": process_text(loc.get(k + "_desc", ""), loc),
                "name_en": process_text(loc_en.get(k, k), loc_en),
                "desc_en": process_text(loc_en.get(k + "_desc", ""), loc_en),
            })
    return out


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def main():
    DATA.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    print("▶ 解析宏 (scripted_variables) ...")
    macros = load_macros()
    print(f"  宏：{len(macros)} 个")

    print("▶ 解析科技定义 ...")
    techs = parse_all_techs(macros)
    print(f"  科技：{len(techs)} 个")

    print("▶ 解析本地化（中 / 英）...")
    loc = load_loc_raw(LOC_DIR)           # 简体中文
    loc_en = load_loc_raw(LOC_DIR_EN)     # English
    print(f"  中文键：{len(loc)} 个，英文键：{len(loc_en)} 个")
    # 覆盖名称与描述（双语）
    missing_name = 0
    missing_name_en = 0
    for t in techs:
        name = process_text(loc.get(t["id"]), loc)
        desc = process_text(loc.get(t["id"] + "_desc"), loc)
        if name:
            t["name"] = name
        else:
            missing_name += 1
        t["desc"] = desc
        name_en = process_text(loc_en.get(t["id"]), loc_en)
        if name_en:
            t["name_en"] = name_en
        else:
            missing_name_en += 1
            t["name_en"] = t["id"]
        t["desc_en"] = process_text(loc_en.get(t["id"] + "_desc"), loc_en)
        # modifier 本地化名（双语，尽力）
        for m in t["modifier"]:
            mk = "mod_" + m["key"]
            if mk in loc:
                m["name"] = process_text(loc[mk], loc)
            if mk in loc_en:
                m["name_en"] = process_text(loc_en[mk], loc_en)
    print(f"  缺中文名：{missing_name}，缺英文名：{missing_name_en}")

    print("▶ 转换图标 (DDS → 雪碧图) ...")
    icon_map, cat_map = build_sprites(techs)

    print("▶ 生成 tier/category 元数据 ...")
    tiers = load_tiers(macros)
    categories = load_categories(loc, loc_en)

    # --- 统计与校验 ---
    by_area = {a: [t for t in techs if t["area"] == a] for a in AREAS}
    n_edges = sum(len(t["prerequisites"]) for t in techs)
    unresolved_cost = sum(1 for t in techs if t["cost"] is None and t["cost_raw"])
    unresolved_weight = sum(1 for t in techs if t["weight"] is None and t["weight_raw"])
    n_repeatable = sum(1 for t in techs if t["is_repeatable"])
    n_rare = sum(1 for t in techs if t["is_rare"])
    n_danger = sum(1 for t in techs if t["is_dangerous"])
    n_start = sum(1 for t in techs if t["is_start_tech"])

    print("\n═══ 统计 ═══")
    for a in AREAS:
        print(f"  {a:12s}: {len(by_area[a]):4d} 科技")
    print(f"  前置边总数 : {n_edges}")
    print(f"  可重复/稀有/危险/起始: {n_repeatable}/{n_rare}/{n_danger}/{n_start}")
    print(f"  未解析 cost 宏: {unresolved_cost}，未解析 weight 宏: {unresolved_weight}")

    # --- 输出 ---
    def edges_of(area_techs):
        ids = {t["id"] for t in area_techs}
        edges = []
        for t in area_techs:
            for p in t["prerequisites"]:
                if p in ids:
                    edges.append({"source": p, "target": t["id"]})
                else:
                    # 跨学科/缺失前置也保留（标 external）
                    edges.append({"source": p, "target": t["id"], "external": True})
        return edges

    # 全量扁平（搜索用）
    (DATA / "techs.json").write_text(
        json.dumps(techs, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # 按学科
    for a in AREAS:
        at = by_area[a]
        repeatables = [t for t in at if t["is_repeatable"]]
        main_techs = [t for t in at if not t["is_repeatable"]]
        payload = {
            "area": a,
            "nodes": main_techs,
            "repeatables": repeatables,
            "edges": edges_of(main_techs),
        }
        (DATA / f"{a}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    (DATA / "categories.json").write_text(
        json.dumps({"categories": categories, "sprite": cat_map},
                   ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (DATA / "tiers.json").write_text(
        json.dumps(tiers, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (DATA / "macros.json").write_text(
        json.dumps(macros, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (DATA / "icon-sprite.json").write_text(
        json.dumps({"icons": icon_map, "cell": CELL},
                   ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    print("\n✓ 构建完成。输出：")
    for p in sorted(DATA.glob('*.json')):
        print(f"    data/{p.name}")
    for p in sorted(ASSETS.glob('*.png')):
        print(f"    assets/{p.name}")


if __name__ == "__main__":
    main()
