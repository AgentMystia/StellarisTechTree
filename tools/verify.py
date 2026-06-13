#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一致性校验：检查生成数据的前置引用、图标、宏解析、本地化覆盖。只读。"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "data"


def main():
    techs = json.loads((DATA / "techs.json").read_text(encoding="utf-8"))
    icon_map = json.loads((DATA / "icon-sprite.json").read_text(encoding="utf-8"))["icons"]
    by_id = {t["id"]: t for t in techs}

    problems = []

    # 1. 前置引用都存在
    dangling = []
    for t in techs:
        for p in t.get("prerequisites", []):
            if p not in by_id:
                dangling.append((t["id"], p))
    if dangling:
        problems.append(f"前置引用了不存在的科技 {len(dangling)} 条：{dangling[:8]}")

    # 2. 名称齐全（非 id 占位）
    no_name = [t["id"] for t in techs if not t["name"] or t["name"] == t["id"]]
    if no_name:
        problems.append(f"缺少中文名称 {len(no_name)} 个：{no_name[:8]}")

    # 3. 缺图标
    no_icon = [t["id"] for t in techs if t["id"] not in icon_map]
    print(f"缺图标 {len(no_icon)} 个：{no_icon}")

    # 4. 未解析 cost/weight 宏（数值为 None 但有 raw）
    bad_cost = [t["id"] for t in techs if t.get("cost") is None and t.get("cost_raw")]
    bad_weight = [t["id"] for t in techs if t.get("weight") is None and t.get("weight_raw")]
    if bad_cost:
        problems.append(f"未解析 cost 宏 {len(bad_cost)} 个：{bad_cost[:8]}")
    if bad_weight:
        problems.append(f"未解析 weight 宏 {len(bad_weight)} 个：{bad_weight[:8]}")

    # 统计
    by_area = {}
    for t in techs:
        by_area.setdefault(t["area"], 0)
        by_area[t["area"]] += 1
    print(f"\n科技总数：{len(techs)}")
    for a in ("physics", "society", "engineering"):
        print(f"  {a:12s}: {by_area.get(a, 0)}")
    print(f"前置边：{sum(len(t.get('prerequisites', [])) for t in techs)}")
    print(f"可重复/稀有/危险/起始："
          f"{sum(t['is_repeatable'] for t in techs)}/"
          f"{sum(t['is_rare'] for t in techs)}/"
          f"{sum(t['is_dangerous'] for t in techs)}/"
          f"{sum(t['is_start_tech'] for t in techs)}")

    print("\n" + ("✓ 一致性检查通过" if not problems else "✗ 发现问题："))
    for p in problems:
        print("  -", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
