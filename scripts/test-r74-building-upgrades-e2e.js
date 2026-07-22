/* R74：單棟建物升級 UI、回饋與 390×844 / 844×390 / 1366×768 RWD 守門。 */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE = path.join(ROOT, "docs", "evidence", "r74");
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".css": "text/css",
};
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "844x390", width: 844, height: 390, mobile: true },
  { name: "1366x768", width: 1366, height: 768, mobile: false },
];
let failed = 0;
function assert(condition, message) {
  if (condition) console.log("  ✓ " + message);
  else { console.error("  ✗ " + message); failed++; }
}
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
      const file = path.resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
      const rel = path.relative(ROOT, file);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
async function metric(locator) {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null;
    return {
      width: rect.width, height: rect.height,
      inView: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      hit: !!hit && (hit === el || el.contains(hit)),
    };
  });
}
async function openPage(browser, base, config) {
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    hasTouch: config.mobile,
    isMobile: config.mobile,
    serviceWorkers: "block",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base + "?r74-building-upgrades=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.__farm && window.__farm.state && !document.getElementById("startupLoading"), null, { timeout: 45000 });
  const close = page.locator("#howToOk");
  if (await close.isVisible()) await close.click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
  return { context, page, errors };
}
async function preparePlacedBuildings(page) {
  return page.evaluate(() => {
    const state = window.__farm.state();
    state.level = 3;
    state.xp = 30;
    state.coins = 10000;
    state.materials = { wood: 100, stone: 100, compost: 100 };
    state.settings.performanceMode = "high";
    // 使用地圖中央可見草地，避免測試建物落在 seed HUD 或手機 D-pad 下方。
    const preferredTiles = ["t9_8", "t11_8"];
    const tile = () => preferredTiles.map((id) => state.map.tiles.find((item) => item.id === id))
      .find((item) => window.Game.canBuildOn(state, item));
    const base = Date.now();
    const compost = window.Game.buildBuilding(state, tile().id, "compostHeap", base + 1);
    const silo = window.Game.buildBuilding(state, tile().id, "silo", base + 2);
    window.__farm.refresh();
    return { compostId: compost.building.id, siloId: silo.building.id };
  });
}
async function testAt(browser, base, config) {
  const { context, page, errors } = await openPage(browser, base, config);
  const tag = config.width + "×" + config.height;
  try {
    const ids = await preparePlacedBuildings(page);
    await page.locator('.side-tab[data-tab="upgrades"]').click();
    const compostCard = page.locator(`[data-building-upgrade-card="${ids.compostId}"]`);
    const siloCard = page.locator(`[data-building-upgrade-card="${ids.siloId}"]`);
    await compostCard.scrollIntoViewIfNeeded();
    const content = await compostCard.innerText();
    assert(/堆肥場/.test(content) && /Lv 1\/3/.test(content) && /目前.*×0\.90/s.test(content)
      && /下一級.*×0\.84/s.test(content) && /升級成本/.test(content) && /可負擔/.test(content),
    `${tag} 升級分頁顯示堆肥場目前等級、下一級效果、成本與可負擔徽章`);
    assert((await page.locator("#buildingUpgrades .building-upgrade-card").count()) === 4,
      `${tag} 已放置建物清單包含預置 2 棟與本次新建堆肥場／筒倉`);

    const compostButton = compostCard.locator(".building-upgrade-btn");
    const buttonMetric = await metric(compostButton);
    assert(buttonMetric.width >= 44 && buttonMetric.height >= 44 && buttonMetric.inView && buttonMetric.hit,
      `${tag} 堆肥場升級鈕 ≥44px、在視口內且中心可命中`);
    await compostButton.click();
    await page.waitForFunction((id) => window.__farm.state().buildings.find((building) => building.id === id).level === 2, ids.compostId);
    const feedback = await page.evaluate((id) => ({
      level: window.__farm.state().buildings.find((building) => building.id === id).level,
      aura: window.Game.buildingGrowthAura(window.__farm.state()),
      toast: document.getElementById("toast-zone").textContent,
      fanfare: !!document.querySelector("#screenFxLayer .level-fanfare"),
      mapFx: !!document.querySelector("#vfxLayer .map-vfx"),
    }), ids.compostId);
    assert(feedback.level === 2 && Math.abs(feedback.aura - 0.84) < 1e-9,
      `${tag} 真實 click 後堆肥場升到 Lv2 並套用 ×0.84`);
    assert(feedback.toast.includes("堆肥場 升到 Lv 2") && feedback.fanfare && feedback.mapFx,
      `${tag} 成功回饋同時有 toast、level-up 粒子與建物地圖 sparkle`);

    await page.waitForTimeout(2400); // 證據截圖保留乾淨卡面；toast/粒子已在上方即時斷言。
    await siloCard.scrollIntoViewIfNeeded();
    fs.mkdirSync(EVIDENCE, { recursive: true });
    await page.screenshot({ path: path.join(EVIDENCE, `after-${config.name}-building-upgrades.png`) });

    await page.evaluate(() => document.querySelector(".side-panel").classList.add("panes-collapsed"));
    const siloObject = page.locator(`.ob[data-building-id="${ids.siloId}"]`);
    await siloObject.click();
    const bubbleButton = page.locator('#objectBubble .object-bubble-btn[data-action="upgrade"]');
    await bubbleButton.waitFor({ state: "visible" });
    const bubbleMetric = await metric(bubbleButton);
    assert(bubbleMetric.width >= 44 && bubbleMetric.height >= 44 && bubbleMetric.inView && bubbleMetric.hit,
      `${tag} 地圖建物泡泡的「升級」入口 ≥44px 且可點`);
    await bubbleButton.click();
    await page.waitForTimeout(120);
    const bubbleRoute = await page.evaluate(() => ({
      selected: window.__farm.state().interaction.selectedTileId,
      pane: document.querySelector('.side-pane[data-pane="tile"]')?.className || "",
      cardIds: [...document.querySelectorAll("#tileContext [data-building-upgrade-card]")].map((el) => el.dataset.buildingUpgradeCard),
      tileText: document.getElementById("tileContext")?.textContent || "",
    }));
    assert(bubbleRoute.selected && bubbleRoute.pane.includes("sel") && bubbleRoute.cardIds.includes(ids.siloId),
      `${tag} 泡泡入口導向該棟建物磚資訊（selected=${bubbleRoute.selected}, cards=${bubbleRoute.cardIds.join(",") || "none"}）`);
    await page.waitForFunction((id) => {
      const pane = document.querySelector('.side-pane[data-pane="tile"]');
      return pane && pane.classList.contains("sel") && pane.querySelector(`[data-building-upgrade-card="${id}"]`);
    }, ids.siloId);
    const contextCard = page.locator(`#tileContext [data-building-upgrade-card="${ids.siloId}"]`);
    await contextCard.scrollIntoViewIfNeeded();
    assert(/筒倉/.test(await contextCard.innerText()) && /倉庫容量 \+90/.test(await contextCard.innerText())
      && /倉庫容量 \+170/.test(await contextCard.innerText()),
    `${tag} 建物點選流程顯示筒倉目前與下一級容量`);
    const contextButton = contextCard.locator(".building-upgrade-btn");
    const contextMetric = await metric(contextButton);
    assert(contextMetric.width >= 44 && contextMetric.height >= 44 && contextMetric.inView && contextMetric.hit,
      `${tag} 磚資訊內筒倉升級鈕 ≥44px 且可點`);
    const capBefore = await page.evaluate(() => window.Game.storageCapacity(window.__farm.state()));
    await contextButton.click();
    await page.waitForFunction((id) => window.__farm.state().buildings.find((building) => building.id === id).level === 2, ids.siloId);
    const capAfter = await page.evaluate(() => window.Game.storageCapacity(window.__farm.state()));
    assert(capBefore === 120 && capAfter === 200,
      `${tag} 筒倉升級後總倉容 120→200，效果不是純 UI`);
    assert(errors.length === 0, `${tag} 全流程無 pageerror${errors.length ? "：" + errors.join(" | ") : ""}`);
  } finally {
    await context.close();
  }
}

async function run() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (error) { console.error("需要 devDependency: playwright"); process.exit(2); }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  try {
    console.log("== farm R74 單棟建物升級 E2E / RWD ==");
    for (const config of VIEWPORTS) await testAt(browser, base, config);
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) { console.error(`\n❌ R74 E2E 有 ${failed} 項失敗`); process.exit(1); }
  console.log("\n✅ R74 單棟建物升級 E2E / RWD 全綠");
}
run().catch((error) => { console.error(error); process.exit(1); });
