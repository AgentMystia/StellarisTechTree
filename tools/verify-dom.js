// 确定性 DOM 验证：读取渲染后真实状态，不依赖图像识别。
const { chromium } = require("playwright");
const BASE = "http://localhost:8765";

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const facts = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".node")];
    const edges = [...document.querySelectorAll(".edge-path")];
    const icons = nodes.map((n) => {
      const ic = n.querySelector(".node-icon");
      return ic && ic.style.backgroundImage ? "有" : "无";
    });
    const iconHas = icons.filter((x) => x === "有").length;
    const sample = nodes[0];
    const transform = document.getElementById("world").style.transform;
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      iconSetCount: iconHas,
      iconMissingCount: nodes.length - iconHas,
      sampleName: sample ? sample.querySelector(".node-name")?.textContent : null,
      sampleCost: sample ? sample.querySelector(".node-cost")?.textContent : null,
      sampleTier: sample ? sample.querySelector(".node-tier")?.textContent : null,
      samplePos: sample ? [sample.style.left, sample.style.top] : null,
      worldTransform: transform,
      vpSize: [document.getElementById("viewport").clientWidth, document.getElementById("viewport").clientHeight],
      graphTitle: document.getElementById("graphTitle")?.textContent,
      sbStats: document.getElementById("sbStats")?.textContent.replace(/\s+/g, " "),
      tierChips: document.querySelectorAll(".tier-chip").length,
      catItems: document.querySelectorAll(".cat-item").length,
    };
  });
  console.log("=== 物理学渲染事实 ===");
  console.log(JSON.stringify(facts, null, 2));

  // 点击第一个节点，读详情面板内容
  await page.evaluate(() => document.querySelector(".node").click());
  await page.waitForTimeout(400);
  const detail = await page.evaluate(() => {
    const dp = document.getElementById("detailPanel");
    const isOpen = dp.classList.contains("open");
    const c = document.getElementById("detailContent");
    const name = c.querySelector(".dp-title h2")?.textContent;
    const id = c.querySelector(".dp-id")?.textContent;
    const desc = c.querySelector(".dp-desc")?.textContent?.slice(0, 60);
    const stats = [...c.querySelectorAll(".dp-stat .val")].map((e) => e.textContent.replace(/\s+/g, " "));
    const sections = [...c.querySelectorAll(".dp-section h4")].map((e) => e.textContent);
    const prereqLinks = c.querySelectorAll(".dp-link").length;
    const mods = c.querySelectorAll(".dp-mod").length;
    return { isOpen, name, id, desc, stats, sections, prereqLinks, mods };
  });
  console.log("\n=== 详情面板（点击首个节点）===");
  console.log(JSON.stringify(detail, null, 2));

  // 搜索测试
  await page.fill("#searchInput", "护盾");
  await page.waitForTimeout(300);
  const search = await page.evaluate(() => {
    const match = document.querySelectorAll(".node.match").length;
    const dim = document.querySelectorAll(".node.dim").length;
    const hide = document.querySelectorAll(".node.hide").length;
    return { match, dim, hide };
  });
  console.log("\n=== 搜索「护盾」===", JSON.stringify(search));

  // 社会学节点数
  await page.fill("#searchInput", "");
  await page.click('.area-tab[data-area="society"]');
  await page.waitForTimeout(1200);
  const soc = await page.evaluate(() => ({
    nodes: document.querySelectorAll(".node").length,
    edges: document.querySelectorAll(".edge-path").length,
  }));
  console.log("\n=== 社会学 ===", JSON.stringify(soc));

  console.log("\n=== 页面错误 ===", errors.length ? errors : "无");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
