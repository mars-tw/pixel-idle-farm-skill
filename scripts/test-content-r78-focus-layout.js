"use strict";
/* R78B 第 7 項：第一分鐘與互動層級的版面驗收（1366×768、1366×600、390×844、844×390）。
   重現評審抓到的畫面，再檢查修好之後的樣子：
   1. 新存檔第一次種植不跳照顧方式；第二輪才出現，而且不蓋被點的田、預告圈、光的提示條，桌面六格田都看得到。
   2. 熟了又有光要來的田，標籤寫出「現在收／等幾秒收」兩個數字；任務卡、田上標籤、提示條寫同一個秒數。
   3. 任務卡主要按鈕的字跟 nextFarmStep 一致（等光再收、在光裡收成、去種番茄、去回報）。
   4. 提示卡（結算／升級卡、照顧彈窗、集章小卡）同一時間最多一張；主要面板或對話開著時任務卡收起。
   5. 升級卡、信件提示不蓋資源列、田、主要按鈕；光裡收成有「多 1 份」「陽光 +N」的大字。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), PORT = 5197, ORIGIN = `http://127.0.0.1:${PORT}`;
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, ORIGIN), f = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))), rel = path.relative(ROOT, f);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(f).pipe(res);
    });
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}
async function launch() {
  const opts = { headless: true, args: ["--no-sandbox"] };
  try { return await chromium.launch(opts); } catch (_) {}
  for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {}
  throw Error("No browser available");
}
const ov = (a, b) => { if (!a || !b) return 0; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0 && h > 0 ? Math.round(w * h) : 0; };
/* 頁面裡的量測工具：只量「真的看得到」的元素（有大小、沒被 display:none 或 visibility:hidden 藏起來）。 */
function install() {
  const vis = (n) => { if (!n || n.hidden) return false; const r = n.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; const cs = getComputedStyle(n); return cs.display !== "none" && cs.visibility !== "hidden"; };
  const box = (n) => { if (!vis(n)) return null; const r = n.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
  const tileEl = (id) => document.querySelector('[data-tile-id="' + id + '"]') || document.getElementById("tile-" + id);
  window.__r78t = {
    tileBox(index) { const t = __farm.state().map.tiles.find((row) => row.plotIndex === index); return t ? box(tileEl(t.id)) : null; },
    snap() {
      const s = __farm.state(), step = AdventureAPI.nextFarmStep(s, Date.now()), active = Game.activePlotCount(s);
      const plots = s.map.tiles.filter((t) => t.plotIndex != null && t.plotIndex < active).sort((a, b) => a.plotIndex - b.plotIndex).map((t) => box(tileEl(t.id)));
      const btn = qa("#questDock [data-r78b-step], #questDock [data-next-tile]").filter(vis)[0] || null;
      const label = q("#tileStateLabel"), wait = q(".r78b-wait-choice"), pop = q(".r78b-sun-pop"), popLine = q(".r78b-sun-pop-line"), sunTile = q(".r40-sun-tile"), dock = q("#questDock"), chip = q("#sunChip");
      return {
        step: step ? { action: step.action, label: step.actionLabel } : null,
        btn: btn ? btn.textContent.trim() : null,
        dock: box(dock), folded: !!(dock && dock.classList.contains("r78b-folded")), requirements: qa("#questDock .r68a-requirements").filter(vis).length,
        focus: document.documentElement.dataset.r78Focus || "",
        cards: qa("#toast-zone .settlement-card, .r74a-care-popover, #r76cStampCard").filter(vis).map((n) => n.id || String(n.className)),
        care: box(q(".r74a-care-popover")), careWhy: q(".r78b-care-why") ? q(".r78b-care-why").textContent.trim() : "", careButtons: qa(".r74a-care-popover [data-care]").length,
        preview: qa(".r75a-sun-preview").map(box).filter(Boolean), chip: box(chip), chipText: vis(chip) ? chip.textContent.trim() : "",
        label: vis(label) ? label.innerText : "", wait: wait && vis(wait) ? wait.textContent.trim() : "",
        hint: qa('#questDock .world-objective-hint[data-hint="sun"]').filter(vis).map((n) => n.textContent.trim())[0] || "",
        plots, header: box(q("header")), actionA: box(q("#actionA")), dialogue: box(q("#worldDialogue")),
        toasts: qa("#toast-zone > *").filter(vis).map((n) => ({ cls: String(n.className), box: box(n) })),
        pop: box(pop), popText: pop ? pop.innerText : "", popFont: popLine ? parseFloat(getComputedStyle(popLine).fontSize) : 0,
        sunTileBg: sunTile ? getComputedStyle(sunTile).backgroundImage : "", sunTileFilter: sunTile ? getComputedStyle(sunTile).filter : "",
        scrollHint: qa(".side-panel.world-panel-open .panel-scroll-hint").filter(vis).map((n) => ({ box: box(n), position: getComputedStyle(n).position, bg: getComputedStyle(n).backgroundColor }))[0] || null,
        sideBody: box(q(".side-panel.world-panel-open .side-body")),
        flag: !!(s.flags && s.flags.r78CareIntro), care0: s.plots[0] ? s.plots[0].careMode || "" : "",
      };
    },
  };
}
const snap = (page) => page.evaluate(() => __r78t.snap());
/* 仲裁每 250 毫秒量一次畫面；兩張卡剛好同一瞬間冒出來時，給它一拍的時間排好隊再判定，判定的是排好之後的畫面。 */
async function oneCard(page, tag, what) {
  let d = await snap(page);
  if (d.cards.length > 1) { await page.waitForTimeout(350); d = await snap(page); }
  assert.ok(d.cards.length <= 1, `${tag} ${what}：同屏提示卡最多一張（看到 ${d.cards.join("、")}）`);
  return d;
}
const sameStep = (d, tag, what, expected) => {
  assert.ok(d.step, `${tag} ${what}：要有下一步`);
  if (expected) assert.equal(d.step.label, expected, `${tag} ${what}：nextFarmStep 的按鈕字`);
  assert.equal(d.btn, d.step.label, `${tag} ${what}：任務卡主要按鈕要跟 nextFarmStep 一致`);
};
const inView = (b, w, h) => !!b && b.left >= -1 && b.top >= -1 && b.right <= w + 1 && b.bottom <= h + 1;

(async () => {
  const server = await serve(), browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = `${w}x${h}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(ORIGIN);
      await page.waitForFunction(() => window.__farm && window.Atlas && window.Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(install);
      /* 先標成「光已經介紹過」，鎮長那段自動對話才不會插進來擋住量測；其餘都是新存檔的原樣。 */
      await page.evaluate(() => { document.querySelector("#worldBegin")?.click(); const s = __farm.state(); s.sun.introduced = true; s.materials.compost = 3; });
      await page.waitForTimeout(400);

      /* ── 一、新存檔第一次種植：只教「種下、光來、收成」，不跳照顧方式，預設勤澆水 ── */
      assert.equal((await snap(page)).flag, false, `${tag} 新存檔還沒學過照顧方式`);
      await page.evaluate(() => document.querySelector(".gtile.farm-plot")?.click());
      await page.waitForFunction(() => __farm.state().plots[0].cropId === "wheat", null, { timeout: 8000 });
      await page.waitForTimeout(700);
      let d = await oneCard(page, tag, "第一次種植");
      assert.equal(d.care, null, `${tag} 第一次種植不跳照顧方式彈窗`);
      assert.equal(d.care0, "water", `${tag} 第一株預設勤澆水`);
      if (d.btn != null) sameStep(d, tag, "第一次種植後");

      /* ── 二、熟了而且有光要來：標籤寫出兩個結果，三處寫同一個秒數，按鈕是「等光再收」 ── */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now(), p = s.plots[0];
        p.cropId = "wheat"; p.plantedAt = now - 3600000; p.wateredAt = now - 3600000;
        Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: now + 7000, nextAt: now + 7000 });
        __farm.refresh(); FarmWorld.refresh(s);
        const tile = s.map.tiles.find((t) => t.plotIndex === 0); __farm.clickTile(tile.id); __farm.cancelJourney();
      });
      await page.waitForTimeout(450);
      /* 三個地方各自每秒更新，等它們落在同一秒再讀（秒數不同就會等到逾時而失敗）。 */
      await page.waitForFunction(() => {
        const d = __r78t.snap(), nums = [];
        const a = /等 (\d+) 秒收/.exec(d.wait); if (!a) return false; nums.push(a[1]);
        const b = /光 (\d+) 秒後落下/.exec(d.chipText); if (b) nums.push(b[1]);
        const c = /等 (\d+) 秒/.exec(d.hint); if (c) nums.push(c[1]);
        return nums.length >= 2 && nums.every((n) => n === nums[0]);
      }, null, { timeout: 4000 }).catch(() => { throw new Error(`${tag} 熟田等光：田上標籤、提示條、任務卡要寫同一個秒數`); });
      d = await snap(page);
      assert.match(d.label, /^小麥・先別收/, `${tag} 熟田等光：標籤第一行`);
      const choice = /^現在收 (\d+) 份｜等 (\d+) 秒收 (\d+) 份＋陽光 (\d+)$/.exec(d.wait);
      assert.ok(choice, `${tag} 熟田等光：標籤要寫出兩個結果（看到「${d.wait}」）`);
      assert.ok(Number(choice[3]) > Number(choice[1]), `${tag} 等光收的份數要比現在收多`);
      assert.ok(Number(choice[2]) >= 1 && Number(choice[2]) <= 7, `${tag} 等的秒數是算出來的`);
      sameStep(d, tag, "熟田等光", "等光再收");
      if (d.hint) assert.match(d.hint, /等 \d+ 秒，光到再收/, `${tag} 任務卡直接寫「等幾秒，光到再收」`);
      assert.ok(d.plots[0], `${tag} 被點的那格田在畫面裡`);

      /* 光落下之後：過期的預告字樣不留著，按鈕換成「在光裡收成」，受光格是硬邊色塊不是整格平塗。 */
      await page.waitForFunction(() => { const s = __farm.state().sun, n = Date.now(); return n >= (s.startsAt || 0) && n < (s.endsAt || 0) && (s.plots || []).length; }, null, { timeout: 12000 });
      await page.waitForTimeout(600);
      d = await snap(page);
      assert.doesNotMatch(d.label, /光會落在這一格|等光到了再|先別收/, `${tag} 光已落下：不留過期提示（看到「${d.label}」）`);
      assert.equal(d.wait, "", `${tag} 光已落下：不再顯示等光的二選一`);
      sameStep(d, tag, "光已落下", "在光裡收成");
      assert.match(d.sunTileBg, /linear-gradient/, `${tag} 受光格用硬邊色塊疊出光斑`);
      assert.doesNotMatch(d.sunTileBg, /radial-gradient/, `${tag} 受光格不用柔邊漸層`);
      assert.equal(d.sunTileFilter, "none", `${tag} 受光格不用模糊`);

      /* 光裡收成：當下有「多 1 份」「陽光 +N」的大字，不蓋資源列。 */
      await page.evaluate(() => { const s = __farm.state(), tile = s.map.tiles.find((t) => t.plotIndex === (s.sun.plots || [0])[0]), p = s.plots[tile.plotIndex]; if (!p.cropId) p.cropId = "wheat"; p.plantedAt = Date.now() - 3600000; p.wateredAt = p.plantedAt; __farm.refresh(); __farm.clickTile(tile.id); });
      await page.waitForSelector(".r78b-sun-pop", { timeout: 8000 });
      await page.waitForTimeout(250);
      d = await oneCard(page, tag, "光裡收成");
      assert.ok(inView(d.pop, w, h), `${tag} 收成大字在畫面裡`);
      assert.match(d.popText, /多 1 份/, `${tag} 收成大字寫多 1 份`);
      assert.match(d.popText, /陽光 \+\d+/, `${tag} 收成大字寫陽光 +N`);
      assert.ok(d.popFont >= 18, `${tag} 收成大字夠大（${d.popFont}px）`);
      assert.equal(ov(d.pop, d.header), 0, `${tag} 收成大字不蓋資源列`);
      assert.equal(d.flag, true, `${tag} 收過第一株之後才算學過，下一輪開始介紹照顧方式`);
      await page.waitForTimeout(1200);
      await oneCard(page, tag, "收成結算中");
      await page.waitForFunction(() => !document.querySelector("#toast-zone .settlement-card"), null, { timeout: 6000 });

      /* ── 三、第二輪種植：照顧方式彈窗貼著被點的田，不蓋那一格、預告圈、光的提示條 ── */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        s.plots.forEach((p, i) => { if (i < 3) { p.cropId = null; p.plantedAt = 0; p.wateredAt = 0; } });
        Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: now + 12000, nextAt: now + 12000 });
        __farm.refresh(); FarmWorld.refresh(s);
        const tile = s.map.tiles.find((t) => t.plotIndex === 0); __farm.setTool("hand"); __farm.clickTile(tile.id);
      });
      await page.waitForFunction(() => __r78t.snap().care, null, { timeout: 9000 });
      await page.waitForTimeout(600);
      d = await oneCard(page, tag, "照顧方式彈窗");
      assert.ok(d.care, `${tag} 第二輪種植出現照顧方式彈窗`);
      assert.equal(d.careButtons, 3, `${tag} 三種照顧方式`);
      assert.ok(d.careWhy.length > 6, `${tag} 彈窗有一行「這次為什麼選這個」`);
      assert.ok(inView(d.care, w, h), `${tag} 彈窗在畫面裡`);
      assert.ok(d.plots[0], `${tag} 被點的田在畫面裡`);
      assert.equal(ov(d.care, d.plots[0]), 0, `${tag} 彈窗不蓋被點的那格田`);
      assert.ok(d.preview.length >= 1, `${tag} 預告圈還在`);
      d.preview.forEach((p) => assert.equal(ov(d.care, p), 0, `${tag} 彈窗不蓋預告圈`));
      assert.ok(d.chip, `${tag} 光的提示條還在`);
      assert.equal(ov(d.care, d.chip), 0, `${tag} 彈窗不與光的提示條重疊`);
      assert.equal(ov(d.care, d.dock), 0, `${tag} 彈窗不蓋任務卡`);
      assert.equal(d.plots.length, 6, `${tag} 開場六格田`);
      if (w >= 860) d.plots.forEach((p, i) => assert.ok(inView(p, w, h), `${tag} 第 ${i + 1} 格田整格看得到`));
      /* 手機直式第 4 格本來就超出畫面右緣；在畫面裡的田一格都不能被彈窗蓋到。 */
      d.plots.forEach((p, i) => assert.equal(ov(d.care, p), 0, `${tag} 彈窗不蓋第 ${i + 1} 格田`));

      /* 提示卡一次一張、其餘排隊：升級卡進來時照顧彈窗先讓開，升級卡走了再回來。 */
      await page.evaluate(() => __farm.enqueueSettlement({ kind: "milestone", title: "升到 Lv 5", earned: "農場等級提升到 5 級", unlocked: "新的作物與農場能力", next: "去種番茄" }));
      await page.waitForFunction(() => document.querySelector("#toast-zone .milestone-card"), null, { timeout: 3000 });
      await page.waitForTimeout(450);
      d = await snap(page);
      assert.equal(d.cards.length, 1, `${tag} 升級卡與照顧彈窗不同時出現（看到 ${d.cards.join("、")}）`);
      assert.match(d.cards[0], /milestone-card/, `${tag} 先顯示升級卡`);
      const mile = d.toasts.find((t) => /milestone-card/.test(t.cls));
      assert.ok(mile && inView(mile.box, w, h), `${tag} 升級卡在畫面裡`);
      assert.equal(ov(mile.box, d.header), 0, `${tag} 升級卡不蓋資源列`);
      assert.equal(ov(mile.box, d.dock), 0, `${tag} 升級卡不蓋任務卡`);
      assert.equal(ov(mile.box, d.actionA), 0, `${tag} 升級卡不蓋右下互動鈕`);
      d.plots.forEach((p, i) => assert.equal(ov(mile.box, p), 0, `${tag} 升級卡不壓第 ${i + 1} 格田`));
      await page.waitForFunction(() => !document.querySelector("#toast-zone .settlement-card"), null, { timeout: 6000 });
      await page.waitForFunction(() => __r78t.snap().care, null, { timeout: 2000 }).catch(() => { throw new Error(`${tag} 升級卡收掉後，排隊的照顧彈窗要回來`); });

      /* ── 四、主要面板開著：任務卡收起，照顧彈窗與集章小卡不留在畫面上 ── */
      await page.evaluate(() => FarmWorld.openPanel("orders"));
      await page.waitForTimeout(700);
      d = await snap(page);
      assert.equal(d.focus, "panel", `${tag} 面板是現在的主要互動層`);
      assert.equal(d.folded, true, `${tag} 面板開著時任務卡收起`);
      assert.equal(d.requirements, 0, `${tag} 任務卡收起時不列條件清單`);
      assert.deepEqual(d.cards.filter((c) => !/settlement-card/.test(c)), [], `${tag} 面板開著時照顧彈窗與集章小卡收起`);
      if (w < 860 && h > w) {
        /* 手機直式：信件提示不疊在任務卡按鈕上。 */
        await page.evaluate(() => __farm.toast("📬 祖母寄來一封信…"));
        await page.waitForTimeout(400);
        d = await snap(page);
        assert.ok(d.toasts.length >= 1 && inView(d.toasts[0].box, w, h), `${tag} 面板開著時信件提示在畫面裡`);
        d.toasts.forEach((t) => assert.equal(ov(t.box, d.dock), 0, `${tag} 信件提示不壓任務卡`));
        await page.waitForFunction(() => !document.querySelector("#toast-zone > *"), null, { timeout: 6000 });
      }
      await page.evaluate(() => FarmWorld.openPanel("journal"));
      await page.waitForTimeout(700);
      d = await snap(page);
      if (w < 860 && d.scrollHint) {
        /* 手機「往下還有」：貼在面板底的不透明頁尾，不是半透明浮在內文上。 */
        assert.equal(d.scrollHint.position, "sticky", `${tag} 往下還有貼在面板底`);
        assert.doesNotMatch(d.scrollHint.bg, /rgba\([^)]*,\s*0?\.\d+\)|transparent/, `${tag} 往下還有是不透明底（${d.scrollHint.bg}）`);
        if (d.sideBody) assert.ok(d.scrollHint.box.bottom <= d.sideBody.bottom + 1, `${tag} 往下還有不超出面板`);
      }
      await page.evaluate(() => { document.querySelector(".side-panel").classList.remove("world-panel-open"); });
      await page.waitForTimeout(500);
      assert.equal((await snap(page)).folded, false, `${tag} 面板關掉後任務卡回來`);

      /* ── 五、對話開著：任務卡收起；一行提示照舊等對話結束才出來，收成結算卡不被推到資源列上或畫面外，也不壓對話框 ── */
      await page.evaluate(() => FarmWorld.speak("葛瑞", "收成先留一籃，別全拿去賣。門邊總有人，還沒吃飯。"));
      await page.waitForFunction(() => __r78t.snap().dialogue, null, { timeout: 4000 });
      await page.waitForTimeout(500);
      await page.evaluate(() => { __farm.toast("📬 鎮上捎來一張便條…"); __farm.enqueueSettlement({ kind: "harvest", coins: 0, xp: 3, sunYield: 1, sunlight: 2, next: "去種小麥" }); });
      await page.waitForFunction(() => document.querySelector("#toast-zone .settlement-card"), null, { timeout: 3000 });
      await page.waitForTimeout(500);
      d = await oneCard(page, tag, "對話中");
      assert.equal(d.focus, "dialogue", `${tag} 對話是現在的主要互動層`);
      assert.equal(d.folded, true, `${tag} 對話時任務卡收起`);
      assert.equal(d.toasts.filter((t) => !/settlement-card/.test(t.cls)).length, 0, `${tag} 對話時一行提示先排隊，不跟對話搶畫面`);
      const talkCards = d.toasts.filter((t) => /settlement-card/.test(t.cls));
      assert.equal(talkCards.length, 1, `${tag} 對話時收成結算卡仍看得到`);
      talkCards.forEach((t) => {
        assert.ok(inView(t.box, w, h), `${tag} 對話時結算卡在畫面裡`);
        assert.equal(ov(t.box, d.header), 0, `${tag} 對話時結算卡不蓋資源列`);
        assert.equal(ov(t.box, d.dialogue), 0, `${tag} 結算卡不壓對話框`);
        assert.equal(ov(t.box, d.dock), 0, `${tag} 對話時結算卡不壓任務卡`);
      });
      await page.evaluate(() => { const b = document.querySelector("#worldDialogue"); if (b) b.hidden = true; });
      await page.waitForFunction(() => !document.querySelector("#toast-zone > *"), null, { timeout: 9000 });

      /* ── 六、第 4 章：番茄 0/3 還沒種寫「去種番茄」，不寫去找人；材料全齊寫「去回報」 ── */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        s.coins = 999; s.stats.plantCount = 20;
        while (CONFIG.levelFromXp(s.xp) < 8) s.xp += 50; s.level = CONFIG.levelFromXp(s.xp);
        for (const quest of AdventureAPI.quests(s, now)) if (quest.chapter < 4) s.adventure.claimed[quest.id] = true;
        AdventureAPI.ensure(s, now);
        s.plots.forEach((p) => { p.cropId = null; p.plantedAt = 0; p.wateredAt = 0; });
        s.storage.items.tomato = 0; s.storage.items.strawberry = 0; s.materials.wood = 0;
        Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: now + 600000 });
        __farm.refresh(); FarmWorld.refresh(s);
      });
      await page.waitForTimeout(600);
      d = await snap(page);
      assert.equal(await page.evaluate(() => AdventureAPI.summary(__farm.state(), Date.now()).currentQuest.id), "c4_market_expansion", `${tag} 進到第 4 章的任務`);
      sameStep(d, tag, "番茄 0/3", "去種番茄");
      await page.evaluate(() => { const s = __farm.state(); s.storage.items.tomato = 3; s.storage.items.strawberry = 2; s.materials.wood = 2; __farm.refresh(); FarmWorld.refresh(s); });
      await page.waitForTimeout(600);
      d = await snap(page);
      sameStep(d, tag, "材料全齊", "去回報");

      assert.deepEqual(errors, [], `${tag} page errors`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log("VERIFIED content R78B focus layout");
})().catch((e) => { console.error(e); process.exit(1); });
