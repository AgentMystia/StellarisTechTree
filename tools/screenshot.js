// 视觉验证截图脚本（开发用）。需先启动 public/ 的 http.server。
const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:8765";
const OUT = path.join(__dirname, "shots");

(async () => {
  const fs = require("fs");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(OUT, "01-physics.png") });
  console.log("✓ physics 截图");

  // 点击一个节点看详情
  const node = await page.$(".node");
  if (node) { await node.click(); await page.waitForTimeout(500); }
  await page.screenshot({ path: path.join(OUT, "02-detail.png") });
  console.log("✓ detail 截图");

  // 搜索
  await page.fill("#searchInput", "护盾");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "03-search.png") });
  console.log("✓ search 截图");
  await page.fill("#searchInput", "");

  // 切社会学
  await page.click('.area-tab[data-area="society"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "04-society.png") });
  console.log("✓ society 截图");

  // 切工程学 + 缩放
  await page.click('.area-tab[data-area="engineering"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "05-engineering.png") });
  console.log("✓ engineering 截图");

  // 展开可重复抽屉
  await page.click("#rdHeader");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "06-repeatables.png") });
  console.log("✓ repeatables 截图");

  console.log("\n控制台错误:", errors.length ? errors : "无");
  await browser.close();
})().catch((e) => { console.error("截图失败:", e.message); process.exit(1); });
