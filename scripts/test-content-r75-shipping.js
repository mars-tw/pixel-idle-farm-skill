"use strict";
/* R75：測試專用入口只留在本機開發網址。
 * 正式網址（這裡用 farm.test 這個假網域代表）與上架包只留遊戲模組實際會用到的介面，
 * 而且只靠這些介面，新玩家照樣能從開場玩到種下第一株小麥。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright"), { ROOT, serve } = require("./r85-browser-helper");
/* R84C 同步：新增遊戲模組要用的 selectTile（任務卡「看看這株」選取那一格、打開田邊動作列），歸在「留下」。 */
const KEEP = ["state", "refreshResources", "renderSceneActions", "refresh", "clickTile", "focusTile", "clearGuideTarget", "selectTile", "safeSaveNow", "setTool", "selectSeed", "moving", "cancelJourney", "followPlayer", "deliveryRoute", "travelAndDo", "toast", "enqueueSettlement", "enqueueResultFeedback", "selectTab", "openModal", "closeModal", "paintMap", "careAnimal"];
const TEST_ONLY = ["player", "playerTileId", "playerAction", "openLetters", "touchFarmPreview", "assistantSuggestions", "renderSettings", "lastOfflineSummary", "exportSaveCode", "importSaveCode", "restoreBackupSave", "performanceInfo", "setPerformanceMode", "setTextSize", "pwaVersion", "showErrorRecovery", "focusQuestTarget", "deliveryDistance", "vfxSpawns", "sunTick", "musicInfo", "activeTab", "stationTile", "applyPromoScene", "settlementStatus"];
const read = (file) => fs.readFileSync(path.join(ROOT, "src", file), "utf8");
async function launch() { const opts = { headless: true, args: ["--no-sandbox", "--host-resolver-rules=MAP farm.test 127.0.0.1"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
(async () => {
  /* 一、原始碼對帳：介面上的每一個名字都要被分到「留下」或「只給測試」，遊戲模組用到的名字一定要留下。 */
  const ui = read("ui.js"), start = ui.indexOf("window.__farm = {"), block = ui.slice(start, ui.indexOf("\n    };", start));
  const defined = [...block.matchAll(/^ {6}(\w+)\s*[:,]/gm)].map((m) => m[1]);
  assert.ok(defined.length >= 40, `介面清單讀取失敗 ${defined.length}`);
  assert.deepEqual(defined.filter((k) => !KEEP.includes(k) && !TEST_ONLY.includes(k)), [], "介面上有還沒分類的名字，請決定它是遊戲要用還是只給測試");
  assert.deepEqual(KEEP.concat(TEST_ONLY).filter((k) => !defined.includes(k)), [], "清單裡有介面上已經不存在的名字");
  const strip = /for \(const key of \[([^\]]+)\]\) delete window\.__farm\[key\]/.exec(ui);
  assert.ok(strip, "ui.js 要有拿掉測試專用入口的那一段");
  assert.deepEqual(strip[1].split(",").map((s) => s.trim().replace(/"/g, "")).sort(), TEST_ONLY.slice().sort(), "ui.js 拿掉的名字要和測試專用清單一致");
  const used = new Set();
  for (const file of fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".js"))) {
    const text = read(file);
    for (const m of text.matchAll(/(?:farm\(\)|__farm)\??\.(\w+)/g)) used.add(m[1]);
    if (["midgame-r66.js", "cooking-r75.js"].includes(file)) for (const m of text.matchAll(/\bf\.(\w+)/g)) used.add(m[1]);
    if (file === "sunplay-r75.js") for (const m of text.matchAll(/\bfarm\.(\w+)/g)) used.add(m[1]);
  }
  assert.deepEqual([...used].filter((k) => !KEEP.includes(k)), [], "遊戲模組用到了會在正式版被拿掉的介面");
  console.log(`OK R75 shipping：介面 ${defined.length} 個名字都已分類，遊戲模組用到的 ${used.size} 個全部留下`);

  /* 二、實際開頁面：本機開發網址保留測試入口，正式網址只留遊戲要用的。 */
  const app = await serve(), port = new URL(app.origin).port, browser = await launch();
  try {
    const open = async (origin) => {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e))); page.on("dialog", (d) => { errors.push("DIALOG:" + d.message()); d.dismiss().catch(() => {}); });
      await page.goto(origin + "/index.html");
      await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      return { ctx, page, errors, keys: await page.evaluate(() => Object.keys(window.__farm)) };
    };
    const dev = await open(app.origin);
    assert.deepEqual(TEST_ONLY.filter((k) => !dev.keys.includes(k)), [], "本機開發網址要保留測試入口");
    await dev.ctx.close();

    const ship = await open(`http://farm.test:${port}`);
    assert.equal(await ship.page.evaluate(() => location.hostname), "farm.test");
    assert.deepEqual(ship.keys.filter((k) => TEST_ONLY.includes(k)), [], "正式網址不可留下測試入口");
    assert.deepEqual(ship.keys.slice().sort(), KEEP.slice().sort(), "正式網址只留遊戲模組會用到的介面");
    assert.ok(await ship.page.evaluate((keep) => keep.every((k) => typeof window.__farm[k] === "function"), KEEP), "留下的介面都要能呼叫");
    /* 只按畫面上的按鈕，從開場玩到種下第一株小麥、學會折光。 */
    const card = (want) => ship.page.waitForFunction((k) => { const d = document.querySelector("#questDock"); return d && d.dataset.quest === "first_sun_basket" && d.dataset.stepType === k; }, want, { timeout: 12000 });
    await ship.page.locator("#worldSunBegin").click({ timeout: 8000 });
    await card("plant");
    await ship.page.locator("#questDock [data-world-go]").click({ timeout: 8000 });
    await ship.page.waitForFunction(() => __farm.state().plots.some((p) => p && p.cropId === "wheat"), null, { timeout: 12000 });
    await ship.page.waitForFunction(() => !__farm.moving(), null, { timeout: 12000 });
    await card("refract");
    await ship.page.locator("#questDock [data-world-go]").click({ timeout: 8000 });
    await ship.page.waitForFunction(() => __farm.state().r75Sunplay.firstRefracted === true, null, { timeout: 6000 });
    assert.deepEqual(ship.errors, [], "正式網址不可有頁面錯誤");
    await ship.ctx.close();
    console.log("OK R75 shipping：正式網址只剩遊戲要用的介面，開場照樣玩得動");
  } finally { await browser.close(); await new Promise((r) => app.server.close(r)); }
  console.log("VERIFIED R75 shipping");
})().catch((error) => { console.error(error); process.exit(1); });
