// ELK 分层布局预计算：给每个学科 JSON 的节点算出 x/y 坐标，前端零运行时布局成本。
// 用法：node tools/layout.js   （需先 npm install elkjs）
"use strict";

const fs = require("fs");
const path = require("path");
// 纯 JS 版，无需 Java 子进程
const ELK = require("elkjs/lib/elk.bundled.js");
const elk = new ELK();

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "public", "data");
const AREAS = ["physics", "society", "engineering"];

// 节点卡片尺寸 —— 前端渲染必须用同样的值
const NODE_W = 152;
const NODE_H = 78;
// tier → 分区，确保层级严格自上而下
const LAYOUT_OPTS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.partitioning.activate": "true",
  "elk.layered.spacing.nodeNodeBetweenLayers": "70",
  "elk.spacing.nodeNode": "26",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.nodePlacement.fuzzyStraightLineCorrection": "true",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
};

function layoutArea(data) {
  const ids = new Set(data.nodes.map((n) => n.id));

  // 只保留两端都在本学科主节点集合内的边（external 边跳过，避免 ELK 报错）
  const internalEdges = [];
  data.edges.forEach((e, i) => {
    if (!e.external && ids.has(e.source) && ids.has(e.target)) {
      internalEdges.push({ raw: e, elkId: "e" + i });
    }
  });

  const children = data.nodes.map((t) => ({
    id: t.id,
    width: NODE_W,
    height: NODE_H,
    layoutOptions: { "elk.partitioning.partition": String(t.tier) },
  }));
  const edges = internalEdges.map(({ elkId, raw }) => ({
    id: elkId,
    sources: [raw.source],
    targets: [raw.target],
  }));

  const graph = {
    id: "root",
    layoutOptions: LAYOUT_OPTS,
    children,
    edges,
  };

  return elk.layout(graph).then((result) => {
    const pos = new Map();
    for (const n of result.children) pos.set(n.id, { x: n.x, y: n.y });
    for (const t of data.nodes) {
      const p = pos.get(t.id);
      t.x = p.x;
      t.y = p.y;
    }
    // 边的布线点（sections），供前端画平滑曲线
    const esec = new Map();
    for (const e of result.edges || []) esec.set(e.id, e.sections || []);
    data.edges.forEach((e) => {
      // external 边无 sections
      e.sections = null;
    });
    internalEdges.forEach(({ elkId, raw }) => {
      raw.sections = esec.get(elkId) || null;
    });

    // 图的整体尺寸
    data.width = result.width;
    data.height = result.height;
    data.nodeSize = { w: NODE_W, h: NODE_H };

    console.log(
      `  ${data.area}: ${children.length} 节点, ${edges.length} 边, ` +
        `画布 ${Math.round(result.width)}×${Math.round(result.height)}`
    );
  });
}

function layoutRepeatablesGrid(data) {
  // 可重复科技单独网格排列（默认折叠）
  const cols = 7;
  data.repeatables.forEach((t, i) => {
    t.x = (i % cols) * (NODE_W + 18);
    t.y = Math.floor(i / cols) * (NODE_H + 18);
  });
  data.nodeSize = { w: NODE_W, h: NODE_H };
}

(async () => {
  console.log("▶ ELK 布局中 ...");
  for (const area of AREAS) {
    const file = path.join(DATA, area + ".json");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    layoutRepeatablesGrid(data);   // 可重复科技网格坐标
    await layoutArea(data);        // 主图 ELK 坐标
    fs.writeFileSync(file, JSON.stringify(data));
  }
  console.log("✓ 布局完成。");
})().catch((err) => {
  console.error("布局失败:", err);
  process.exit(1);
});
