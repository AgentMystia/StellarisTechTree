// 双语验证：截中文/英文两套图，DOM 核验文本已切换。
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const BASE = "http://localhost:8765";
const OUT = path.join(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // 强制初始中文
  await page.addInitScript(() => localStorage.setItem("stellaris-lang", "zh"));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(OUT, "i18n-01-zh-physics.png") });
  await page.evaluate(() => document.querySelector(".node").click());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "i18n-02-zh-detail.png") });
  const zhName = await page.evaluate(() => document.querySelector(".dp-title h2").textContent);

  // 切换到英文
  await page.click("#langToggle");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "i18n-03-en-detail.png") });
  const enName = await page.evaluate(() => document.querySelector(".dp-title h2").textContent);
  const enTitle = await page.evaluate(() => document.getElementById("graphTitle").textContent);
  const enSearchPh = await page.evaluate(() => document.getElementById("searchInput").placeholder);
  const sampleNode = await page.evaluate(() => document.querySelector(".node-name").textContent);
  const langBtn = await page.evaluate(() => document.getElementById("langToggle").textContent.trim());
  const sidebarTier = await page.evaluate(() => document.querySelector('[data-i18n="sidebar.tier"]').textContent);

  await page.evaluate(() => document.getElementById("detailPanel").classList.remove("open"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "i18n-04-en-physics.png") });

  console.log("zh 首节点名 :", zhName);
  console.log("en 首节点名 :", enName);
  console.log("en 图标题   :", enTitle);
  console.log("en 搜索占位 :", enSearchPh);
  console.log("en 侧栏层级 :", sidebarTier);
  console.log("en 抽样节点 :", sampleNode);
  console.log("语言按钮    :", langBtn, "(en 下应显示「中」)");
  console.log("页面错误    :", errors.length ? errors : "无");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
