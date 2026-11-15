"use strict";
/* R77A 版面：四種尺寸下實際開瀏覽器量。
 * 照顧彈窗三行都看得到、折光預覽光斑與田上標籤不重疊、光落下的光柱與亮斑（低效能改靜態）、
 * 曬架翻面鈕與右下互動鈕至少 44px 且按得到、看火候金色區的位置跟 CSS 變數一致、全部不出界。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), PORT = 5187, ORIGIN = `http://127.0.0.1:${PORT}`;
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, ORIGIN), f = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))), rel = path.relative(ROOT, f);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(f).pipe(res);
    });
    server.once("error", reject); server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("找不到可用瀏覽器"); }
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const inView = (b, w, h) => b.width > 0 && b.height > 0 && b.left >= -1 && b.right <= w + 1 && b.top >= -1 && b.bottom <= h + 1;
/* 在頁面裡用的量尺寸函式（字串形式塞進 evaluate）。 */
const BOX = "const box = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };";

(async () => {
  const css = fs.readFileSync(path.join(ROOT, "src/content-r58b.css"), "utf8"); let depth = 0;
  for (const c of css.replace(/\/\*[\s\S]*?\*\//g, "")) { if (c === "{") depth++; if (c === "}") depth--; assert.ok(depth >= 0, "content-r58b.css 大括號不平衡"); }
  assert.equal(depth, 0, "content-r58b.css 大括號不平衡"); assert.match(css, /\/\* R77A：追光本體看得懂、有事顧/);
  const server = await serve(), browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = `${w}x${h}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e))); page.on("dialog", (d) => { errors.push("DIALOG:" + d.message()); d.dismiss().catch(() => {}); });
      await page.goto(ORIGIN);
      await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(() => {
        document.querySelector("#worldBegin")?.click();
        const s = __farm.state(), now = Date.now();
        s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, now);
        s.level = 4; s.coins = 500; s.storage.items.wheat = 6; s.materials.compost = 3;
        /* R78B 第 1 項同步：新存檔第一次種植不再跳照顧方式（預設勤澆水），第二輪才介紹；這裡測的是照顧彈窗的三行數字，所以先標成已經學過。 */
        s.flags.r78CareIntro = true;
        FarmSunplay.normalize(s); s.r75Sunplay.sunlight = 3; s.r75Sunplay.firstCaught = true;
        __farm.refresh(); FarmWorld.refresh(s);
      });
      await page.waitForTimeout(150);

      /* 一、照顧彈窗：三種照顧方式各一行實際數字，三行都要完整看得到 */
      await page.evaluate(() => document.querySelector(".gtile.farm-plot")?.click());
      await page.waitForFunction(() => __farm.state().plots[0].cropId && document.querySelectorAll(".r74a-care-popover .r77a-care-row").length === 3, null, { timeout: 8000 });
      const care = await page.evaluate(new Function(BOX + `
        const pop = document.querySelector(".r74a-care-popover"), rows = [...pop.querySelectorAll(".r77a-care-row")];
        const s = __farm.state(), f = Game.careForecast(s, 0, Date.now());
        return { pop: box(pop), rows: rows.map((r) => ({ box: box(r), text: r.textContent.trim(), id: r.dataset.careRow, qty: Number(r.dataset.careQty), clip: r.scrollWidth - r.clientWidth, sel: r.classList.contains("sel") })),
          forecast: f.rows.map((r) => ({ id: r.id, qty: r.qty, text: r.text })), selected: s.plots[0].careMode || "" };`));
      assert.ok(inView(care.pop, w, h), `${tag} 照顧彈窗不出界 ${JSON.stringify(care.pop)}`);
      assert.deepEqual(care.rows.map((r) => r.id), ["water", "compost", "natural"]);
      care.rows.forEach((r, i) => {
        assert.ok(inView(r.box, w, h), `${tag} 照顧第 ${i + 1} 行要在畫面內 ${JSON.stringify(r.box)}`);
        assert.ok(r.box.top >= care.pop.top - 1 && r.box.bottom <= care.pop.bottom + 1 && r.box.left >= care.pop.left - 1 && r.box.right <= care.pop.right + 1, `${tag} 照顧第 ${i + 1} 行不可超出彈窗 ${JSON.stringify([r.box, care.pop])}`);
        assert.ok(r.clip <= 1, `${tag} 照顧第 ${i + 1} 行的字不可被切掉（${r.text}）`);
        assert.equal(r.qty, care.forecast[i].qty, `${tag} 照顧第 ${i + 1} 行的份數跟算出來的一樣`);
        assert.match(r.text, /^(勤澆水|施堆肥|放著長)：約 \d+ 秒/, `${tag} 照顧第 ${i + 1} 行寫秒數：${r.text}`);
        assert.equal(/[A-Za-z]/.test(r.text), false, `${tag} 照顧文字不夾英文：${r.text}`);
        assert.equal(r.sel, r.id === care.selected, `${tag} 現在選的那一行有標出來`);
        for (let j = 0; j < i; j++) assert.ok(overlap(r.box, care.rows[j].box) < 2, `${tag} 照顧第 ${j + 1}、${i + 1} 行不可重疊`);
      });
      await page.waitForFunction(() => !document.querySelector(".r74a-care-popover"), null, { timeout: 9000 });

      /* 二、折光預覽：點有作物的田，那一格畫淡色光斑，標籤多一行折過來的結果，按鈕寫手鏡還能折幾次 */
      const tiles = await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        s.plots[0].plantedAt = now;
        Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [1], previewAt: now + 60000, nextAt: now + 60000, refractions: 0 });
        __farm.refresh(); FarmWorld.refresh(s);
        return { tile0: s.map.tiles.find((t) => t.plotIndex === 0).id };
      });
      await page.evaluate((id) => { __farm.setTool("water"); __farm.clickTile(id); }, tiles.tile0);
      await page.waitForFunction(() => document.querySelector('.r77a-refract-ghost[data-plot-index="0"]') && document.querySelector("#tileStateLabel:not([hidden]) .r77a-refract-note") && document.querySelector('#sceneActionBar:not([hidden]) [data-action="refract"] .r77a-refract-left'), null, { timeout: 8000 });
      await page.waitForFunction(() => !__farm.moving || !__farm.moving(), null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      const ghost = await page.evaluate(new Function("id", BOX + `
        const g = document.querySelector(".r77a-refract-ghost"), label = document.getElementById("tileStateLabel"), tile = document.querySelector('.gtile[data-tile-id="' + id + '"]');
        const btn = document.querySelector('#sceneActionBar [data-action="refract"]'), left = btn.querySelector(".r77a-refract-left"), t = btn.querySelector(".sab-t");
        const ring = document.querySelector(".r75a-sun-preview");
        return { ghost: box(g), label: box(label), labelTile: label.dataset.tileId, note: label.querySelector(".r77a-refract-note").textContent.trim(), tile: box(tile), ring: ring ? box(ring) : null,
          btn: box(btn), left: box(left), leftText: left.textContent.trim(), clip: t.scrollWidth - t.clientWidth, leftClip: left.scrollWidth - left.clientWidth, title: btn.title,
          bar: [...document.querySelectorAll("#sceneActionBar .scene-action-btn")].map(box) };`), tiles.tile0);
      assert.equal(ghost.labelTile, tiles.tile0, `${tag} 標籤是選的那一格`);
      assert.equal(ghost.note, "折過來：小麥（喜光）會照到光，收成多 1 份・光裡收成得陽光 2", `${tag} 標籤寫折過來的結果`);
      assert.ok(Math.abs(ghost.ghost.left - ghost.tile.left) <= 3 && Math.abs(ghost.ghost.top - ghost.tile.top) <= 3 && Math.abs(ghost.ghost.width - ghost.tile.width) <= 3, `${tag} 預覽光斑蓋在那一格上 ${JSON.stringify([ghost.ghost, ghost.tile])}`);
      assert.ok(overlap(ghost.ghost, ghost.label) < 4, `${tag} 預覽光斑與標籤不可重疊 ${JSON.stringify([ghost.ghost, ghost.label])}`);
      if (ghost.ring) assert.ok(overlap(ghost.ghost, ghost.ring) < 4, `${tag} 預覽光斑不可壓在原本的預告圈上`);
      assert.ok(inView(ghost.label, w, h), `${tag} 標籤要在畫面內 ${JSON.stringify(ghost.label)}`);
      for (const b of ghost.bar) assert.ok(overlap(b, ghost.label) < 4, `${tag} 標籤不可壓在動作鈕上 ${JSON.stringify({ label: ghost.label, bar: ghost.bar, tile: ghost.tile, h })}`);
      assert.equal(ghost.leftText, "手鏡還能折 1 次");
      assert.ok(ghost.btn.width >= 44 && ghost.btn.height >= 44 && inView(ghost.btn, w, h), `${tag} 折光鈕至少 44px 且在畫面內 ${JSON.stringify(ghost.btn)}`);
      assert.ok(ghost.left.left >= ghost.btn.left - 1 && ghost.left.right <= ghost.btn.right + 1 && ghost.left.bottom <= ghost.btn.bottom + 1, `${tag} 「手鏡還能折」那行要在按鈕裡 ${JSON.stringify([ghost.left, ghost.btn])}`);
      assert.ok(ghost.clip <= 1 && ghost.leftClip <= 1, `${tag} 折光鈕的字不可被切掉`);
      assert.match(ghost.title, /^把光折到這裡・手鏡還能折 1 次。折過來：/, `${tag} 按鈕說明寫完整結果`);
      await page.locator('#sceneActionBar [data-action="refract"]').click();
      await page.waitForFunction(() => !document.querySelector(".r77a-refract-ghost") && document.querySelector('.r75a-sun-preview[data-plot-index="0"]'), null, { timeout: 4000 });
      assert.deepEqual(await page.evaluate(() => __farm.state().sun.previewPlots), [0], `${tag} 折完光改落在選的那一格，預覽光斑收掉`);

      /* 三、光落下來：斜射光柱＋地面亮斑＋剛落下時擴散一次；一格只有一個倒數；快走時變淡；低效能只留靜態亮斑 */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        Object.assign(s.sun, { plots: [0], used: [], startsAt: now, endsAt: now + 16000, durationMs: 16000, previewPlots: [], previewAt: 0, nextAt: now + 60000 });
        __farm.refresh(); FarmWorld.refresh(s);
      });
      await page.waitForFunction(() => document.querySelector('.sun-beam[data-plot-index="0"]:not(.caught) .r77a-sun-shaft'), null, { timeout: 4000 });
      const beam = await page.evaluate(new Function(BOX + `
        const b = document.querySelector('.sun-beam[data-plot-index="0"]:not(.caught)'), spread = b.querySelector(".r77a-sun-spread"), spot = b.querySelector(".r77a-sun-spot"), shaft = b.querySelector(".r77a-sun-shaft");
        return { beams: document.querySelectorAll('.sun-beam[data-plot-index="0"]:not(.caught)').length, timers: document.querySelectorAll('.r40-sun-tile[data-plot-index="0"]').length,
          secs: (document.querySelector('.r40-sun-tile[data-plot-index="0"] .r40-sun-secs') || {}).textContent || "", fresh: b.dataset.r77aFresh,
          spread: spread ? getComputedStyle(spread).animationName : "", spot: getComputedStyle(spot).display, shaft: getComputedStyle(shaft).display, beam: box(b), spotBox: box(spot) };`));
      assert.equal(beam.beams, 1, `${tag} 一格只有一道光`); assert.equal(beam.timers, 1, `${tag} 倒數一格只留一個`);
      assert.match(beam.secs, /^\d+ 秒$/); assert.equal(beam.fresh, "1"); assert.equal(beam.spread, "r77aSunSpread", `${tag} 光剛落下時由圈心擴散`);
      assert.notEqual(beam.spot, "none"); assert.notEqual(beam.shaft, "none");
      assert.ok(beam.spotBox.left >= beam.beam.left - 1 && beam.spotBox.right <= beam.beam.right + 1, `${tag} 地面亮斑在光束範圍內`);
      await page.evaluate(() => { const s = __farm.state(); s.sun.endsAt = Date.now() + 2500; __farm.refresh(); });
      await page.waitForFunction(() => document.querySelector('.sun-beam[data-plot-index="0"].r77a-sun-fading') && document.querySelector('.r40-sun-tile[data-plot-index="0"].r77a-sun-fading'), null, { timeout: 4000 });
      await page.waitForTimeout(800);
      const fade = await page.evaluate(() => {
        const b = document.querySelector('.sun-beam[data-plot-index="0"].r77a-sun-fading'), secs = document.querySelector('.r40-sun-tile[data-plot-index="0"] .r40-sun-secs');
        const html = document.documentElement, before = { tier: html.dataset.performanceTier, low: html.classList.contains("perf-low") };
        html.dataset.performanceTier = "low"; html.classList.add("perf-low");
        const low = { shaft: getComputedStyle(b.querySelector(".r77a-sun-shaft")).display, spot: getComputedStyle(b.querySelector(".r77a-sun-spot")).display, transition: getComputedStyle(b).transitionDuration };
        if (before.tier === undefined) delete html.dataset.performanceTier; else html.dataset.performanceTier = before.tier; html.classList.toggle("perf-low", before.low);
        return { opacity: Number(getComputedStyle(b).opacity), secsShown: !!secs && secs.getBoundingClientRect().width > 0 && getComputedStyle(secs).display !== "none", low };
      });
      assert.ok(fade.opacity <= 0.5, `${tag} 光要走前變淡（opacity ${fade.opacity}）`); assert.equal(fade.secsShown, true, `${tag} 變淡時倒數照常看得到`);
      assert.equal(fade.low.shaft, "none", `${tag} 低效能不畫光柱`); assert.notEqual(fade.low.spot, "none", `${tag} 低效能留靜態亮斑`); assert.equal(fade.low.transition, "0s", `${tag} 低效能不做漸變`);
      await page.evaluate(() => { const s = __farm.state(); Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: Date.now() + 600000 }); __farm.refresh(); FarmWorld.refresh(s); });

      /* 四、曬架翻面：地圖名牌、面板翻面鈕、右下互動鈕「翻面・曬架」「收乾貨・曬架」 */
      const rackSetup = await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        s.plots[0].cropId = null; s.plots[0].plantedAt = 0; delete s.plots[0].careMode; delete s.plots[0].wateredAt;
        const spot = s.map.tiles.find((t) => t.x === 14 && t.y === 5);
        if (spot) { s.player.tileId = spot.id; s.player.x = spot.x; s.player.y = spot.y; s.player.facing = "down"; }
        const started = FarmSunplay.startDrying(s, "wheat", now);
        s.r75Sunplay.rack.startedAt = now - 16000; s.r75Sunplay.rack.readyAt = now + 14000;
        __farm.refresh(); FarmWorld.refresh(s);
        return { spot: !!spot, started: started.ok, near: FarmSunplay.rackNear(s) };
      });
      assert.deepEqual(rackSetup, { spot: true, started: true, near: true }, `${tag} 測試前置：站到曬架旁、曬上小麥`);
      await page.waitForFunction(() => document.getElementById("actionA")?.textContent.trim() === "翻面・曬架" && document.getElementById("r75aRackNode")?.dataset.rackFlip === "open", null, { timeout: 6000 });
      await page.waitForTimeout(300);
      const flipInfo = await page.evaluate(new Function(BOX + `
        const a = document.getElementById("actionA"), node = document.getElementById("r75aRackNode");
        return { a: box(a), rendered: a.getClientRects().length > 0, rack: a.dataset.rack, visible: a.dataset.interactVisible, clip: a.scrollWidth - a.clientWidth, node: box(node), nodeLabel: node.textContent.trim() };`));
      assert.equal(flipInfo.rack, "flip"); assert.equal(flipInfo.visible, "true", `${tag} 右下互動鈕要顯示`);
      /* 右下互動鈕是手機的拇指鈕（桌機用滑鼠點曬架、用鍵盤走路，原本就不畫這顆鈕），手機兩種方向都要量。 */
      if (mobile) assert.equal(flipInfo.rendered, true, `${tag} 手機要畫出右下互動鈕`);
      if (flipInfo.rendered) {
        assert.ok(flipInfo.a.width >= 44 && flipInfo.a.height >= 44 && inView(flipInfo.a, w, h), `${tag} 右下「翻面・曬架」至少 44px 且在畫面內 ${JSON.stringify(flipInfo.a)}`);
        assert.ok(flipInfo.clip <= 1, `${tag} 右下「翻面・曬架」的字不可被切掉`);
      }
      assert.match(flipInfo.nodeLabel, /^還要 \d+ 秒・可以翻面$/); assert.ok(flipInfo.node.width >= 44 && flipInfo.node.height >= 44, `${tag} 曬架命中區至少 44px`);
      await page.evaluate(() => FarmSunplay.openRack());
      await page.waitForFunction(() => document.querySelector("#r75aRackPanel [data-flip]"), null, { timeout: 4000 });
      await page.waitForFunction(() => [...document.querySelectorAll("#r75aRackPanel img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
      const panel = await page.evaluate(new Function(BOX + `
        const p = document.getElementById("r75aRackPanel"), f = p.querySelector("[data-flip]");
        return { panel: box(p), flip: box(f), text: f.textContent.trim(), clip: f.scrollWidth - f.clientWidth, time: p.querySelector("[data-rack-time]").textContent.trim(), buttons: [...p.querySelectorAll("button")].map((b) => ({ text: b.textContent.trim(), box: box(b) })) };`));
      assert.ok(inView(panel.panel, w, h), `${tag} 曬架面板不出界 ${JSON.stringify(panel.panel)}`);
      assert.equal(panel.text, "翻面・多收 1 份"); assert.match(panel.time, /^還要 \d+ 秒・可以翻面$/);
      assert.ok(panel.flip.width >= 44 && panel.flip.height >= 44 && inView(panel.flip, w, h), `${tag} 面板翻面鈕至少 44px 且在畫面內 ${JSON.stringify(panel.flip)}`);
      assert.ok(panel.clip <= 1, `${tag} 面板翻面鈕的字不可被切掉`);
      for (const b of panel.buttons) assert.ok(b.box.width >= 44 && b.box.height >= 44, `${tag} 曬架面板按鈕「${b.text}」至少 44px`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("r75aRackOverlay"), null, { timeout: 4000 });
      /* 手機按右下互動鈕翻面；桌機點地圖上的曬架（翻面時間內點一下就翻，不用先開面板）。 */
      if (flipInfo.rendered) await page.locator("#actionA").click();
      else await page.evaluate(() => document.getElementById("r75aRackNode").click());
      await page.waitForFunction(() => __farm.state().r75Sunplay.rack.flippedAt > 0 && document.getElementById("r75aRackNode").dataset.rackFlip === "done", null, { timeout: 4000 });
      await page.waitForFunction(() => document.getElementById("actionA").dataset.rack === "", null, { timeout: 4000 });
      assert.equal(await page.evaluate(() => !!document.getElementById("r75aRackOverlay")), false, `${tag} 翻面不用開面板`);
      assert.match(await page.evaluate(() => document.getElementById("r75aRackNode").textContent.trim()), /^翻過了・還要 \d+ 秒$/, `${tag} 翻過面的名牌`);
      await page.evaluate(() => { __farm.state().r75Sunplay.rack.readyAt = Date.now() - 1; __farm.refresh(); });
      await page.waitForFunction(() => document.getElementById("actionA").textContent.trim() === "收乾貨・曬架" && document.getElementById("actionA").dataset.rack === "collect" && document.getElementById("r75aRackNode").dataset.rackState === "ready", null, { timeout: 6000 });
      if (flipInfo.rendered) {
        const collectBox = await page.evaluate(new Function(BOX + `return box(document.getElementById("actionA"));`));
        assert.ok(collectBox.width >= 44 && collectBox.height >= 44 && inView(collectBox, w, h), `${tag} 右下「收乾貨・曬架」至少 44px 且在畫面內`);
        await page.locator("#actionA").click();
      } else {
        await page.evaluate(() => document.getElementById("r75aRackNode").click());
        await page.waitForFunction(() => document.querySelector("#r75aRackPanel [data-collect]"), null, { timeout: 4000 });
        await page.locator("#r75aRackPanel [data-collect]").click();
      }
      await page.waitForFunction(() => (__farm.state().storage.items.sun_wheat || 0) === 2 && !__farm.state().r75Sunplay.rack.cropId, null, { timeout: 4000 });
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("r75aRackOverlay"), null, { timeout: 4000 });

      /* 五、看火候：灶台清單寫火性；大火的金色區在 62～86；先大後小第 6 秒移到 30～52；位置都跟 CSS 變數一致 */
      await page.evaluate(() => { const s = __farm.state(); s.storage.items.wheat = 30; s.storage.items.carrot = 10; __farm.refresh(); FarmWorld.refresh(s); FarmWorld.openKitchen(); });
      await page.waitForFunction(() => document.querySelector('[data-r75b-start="rustic_bread"]') && document.querySelector('[data-r77a-fire-line="rustic_bread"]') && document.querySelector('[data-r75b-start="carrot_wheat_stew"]'), null, { timeout: 8000 });
      const lines = await page.evaluate(new Function(BOX + `
        return [...document.querySelectorAll("[data-r77a-fire-line]")].filter((n) => n.getBoundingClientRect().width > 0).map((n) => ({ id: n.dataset.r77aFireLine, kind: n.dataset.r77aFire, text: n.textContent.trim(), box: box(n), clip: n.scrollWidth - n.clientWidth }));`));
      assert.ok(lines.length >= 2, `${tag} 灶台清單要寫火性`);
      for (const l of lines) {
        assert.match(l.text, /^火性・(文火|大火|先大後小)：/, `${tag} 灶台火性：${l.text}`); assert.equal(/[A-Za-z]/.test(l.text), false);
        assert.ok(l.box.left >= -1 && l.box.right <= w + 1 && l.clip <= 1, `${tag} 灶台火性那行不可出界或被切掉 ${JSON.stringify(l)}`);
      }
      assert.equal(lines.find((l) => l.id === "rustic_bread").text, "火性・大火：金色區高，火掉得快");
      const measureFire = () => page.evaluate(new Function(BOX + `
        const o = document.querySelector(".r75b-cook-overlay"), card = o.querySelector(".r75b-cook-card"), track = o.querySelector(".r75b-fire-track"), gold = o.querySelector(".r75b-fire-gold"), next = o.querySelector(".r77a-fire-next");
        const tr = track.getBoundingClientRect(), inner = tr.left + track.clientLeft, iw = track.clientWidth;
        return { card: box(card), goldLeft: (gold.getBoundingClientRect().left - inner) / iw * 100, goldWidth: gold.getBoundingClientRect().width / iw * 100,
          varLeft: track.style.getPropertyValue("--r77a-gold-left"), varWidth: track.style.getPropertyValue("--r77a-gold-width"), min: Number(track.dataset.goldMin), max: Number(track.dataset.goldMax),
          next: next && !next.hidden ? { left: (next.getBoundingClientRect().left - inner) / iw * 100, width: next.getBoundingClientRect().width / iw * 100 } : null,
          kind: (o.querySelector(".r77a-fire-kind") || {}).textContent || "", time: o.querySelector("[data-r75b-time]").textContent.trim(),
          buttons: [...o.querySelectorAll("[data-r75b-wood],[data-r75b-vent],[data-r75b-direct]")].map((b) => ({ text: b.textContent.trim(), box: box(b), clip: b.scrollWidth - b.clientWidth })),
          docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };`));
      const checkGold = (f, min, max, label) => {
        assert.deepEqual([f.min, f.max, f.varLeft, f.varWidth], [min, max, min + "%", (max - min) + "%"], `${tag} ${label} 金色區寫進 CSS 變數`);
        assert.ok(Math.abs(f.goldLeft - min) <= 1 && Math.abs(f.goldWidth - (max - min)) <= 1, `${tag} ${label} 金色區畫在 ${min}～${max}（實際 ${f.goldLeft.toFixed(1)}～${(f.goldLeft + f.goldWidth).toFixed(1)}）`);
        assert.ok(inView(f.card, w, h), `${tag} ${label} 看火候畫面不出界 ${JSON.stringify(f.card)}`); assert.ok(f.docScroll <= 1, `${tag} 不可出現橫向捲動`);
        assert.match(f.time, /^還剩 \d+ 秒$/);
        for (const b of f.buttons) { assert.ok(b.box.width >= 44 && b.box.height >= 44 && inView(b.box, w, h), `${tag} ${label}「${b.text}」至少 44px 且在畫面內`); assert.ok(b.clip <= 1, `${tag} ${label}「${b.text}」的字不可被切掉 ${JSON.stringify(f.buttons)}`); }
        assert.deepEqual(f.buttons.map((b) => b.text), ["添柴・火變大", "掀蓋・火變小", "直接做（家常）"]);
      };
      await page.locator('[data-r75b-start="rustic_bread"]').click();
      await page.waitForFunction(() => document.querySelector(".r75b-cook-overlay .r75b-fire-track"), null, { timeout: 4000 });
      await page.waitForTimeout(700);
      const strong = await measureFire();
      checkGold(strong, 62, 86, "大火"); assert.equal(strong.kind.trim(), "大火：金色區高，火掉得快"); assert.equal(strong.next, null, `${tag} 大火不會換位置`);
      await page.locator(".r75b-cook-overlay [data-r75b-close]").click();
      await page.waitForFunction(() => !document.querySelector(".r75b-cook-overlay"), null, { timeout: 4000 });
      await page.waitForFunction(() => document.querySelector('[data-r75b-start="carrot_wheat_stew"]'), null, { timeout: 4000 });
      await page.locator('[data-r75b-start="carrot_wheat_stew"]').click();
      await page.waitForFunction(() => document.querySelector(".r75b-cook-overlay .r75b-fire-track"), null, { timeout: 4000 });
      await page.waitForTimeout(700);
      const first = await measureFire();
      checkGold(first, 60, 84, "先大後小（前段）"); assert.equal(first.kind.trim(), "先大後小：第 6 秒金色區從高移到低");
      assert.ok(first.next && Math.abs(first.next.left - 30) <= 1 && Math.abs(first.next.width - 22) <= 1, `${tag} 先標出下一段金色區 ${JSON.stringify(first.next)}`);
      await page.waitForFunction(() => Number(document.querySelector(".r75b-cook-overlay .r75b-fire-track")?.dataset.goldMin) === 30, null, { timeout: 9000 });
      await page.waitForTimeout(700);
      const second = await measureFire();
      checkGold(second, 30, 52, "先大後小（後段）"); assert.equal(second.next, null, `${tag} 換過位置就不再預告`);
      await page.locator(".r75b-cook-overlay [data-r75b-close]").click();

      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `${tag} 頁面不可出現橫向捲動`);
      assert.deepEqual(errors, [], `${tag} 不可有頁面錯誤`);
      await ctx.close();
      console.log(`OK R77A ${tag}：照顧三行、折光預覽、光柱與亮斑、曬架翻面、右下互動鈕、三種火性`);
    }
  } finally { await browser.close(); server.close(); }
  console.log("VERIFIED R77A sunplay layout 1366x768 1366x600 390x844 844x390");
})().catch((error) => { console.error(error); process.exit(1); });
