"use strict";
/* R75A 版面：四種尺寸下實際量蓄光瓶、預告圈、折光／催熟按鈕、曬架與升級卡。
 * R75 整合時改寫：原本這支只比對字串，釘著右上角浮動 HUD（r75a-sun-hud）與田邊泡泡（r75a-plot-action）。
 * 那兩個介面在瀏覽器裡被資源列與田格標籤蓋住，已改成「蓄光瓶＝資源列的籤、折光／催熟＝動作列按鈕、曬架＝農舍旁地圖物件」，
 * 所以釘的對象跟著換；四種尺寸、44px 命中區、不出界的要求沒有放寬，而且從比對字串改成開瀏覽器量。
 * 設 R75_SHOTS=<資料夾> 會順便存截圖；R75_ORIGIN 可改成本機伺服器網址（file:// 下地圖物件圖不一定來得及畫，截圖用）。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), ORIGIN = process.env.R75_ORIGIN || "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/"), VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const SHOTS = process.env.R75_SHOTS || "";
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"), css = fs.readFileSync(path.join(ROOT, "src/content-r58b.css"), "utf8");
for (const name of ["sun_mirror.png", "sun_jar.png", "drying_rack_empty.png", "drying_rack_full.png", "item-sun_wheat.png", "item-sun_carrot.png", "item-sun_tomato.png", "item-sun_strawberry.png"]) { assert(fs.existsSync(path.join(ROOT, "assets/generated/content-r75", name)), name + " missing"); assert(sw.includes(name), name + " not cached"); }
assert.match(css, /\/\* R75A：追光、蓄光瓶與曬架 \*\//);
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
(async () => {
  const browser = await launch();
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const [w, h, mobile] of VIEWS) {
      const tag = `${w}x${h}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) }); };
      page.on("pageerror", (e) => errors.push(String(e))); page.on("dialog", (d) => { errors.push("DIALOG:" + d.message()); d.dismiss().catch(() => {}); });
      await page.goto(ORIGIN);
      await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      const setup = await page.evaluate(() => {
        document.querySelector("#worldBegin")?.click();
        const s = __farm.state(), now = Date.now();
        s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, now);
        s.level = 4; s.coins = 500; s.storage.items.wheat = 6;
        const before = !!document.querySelector(".r75a-jar-chip");
        FarmSunplay.normalize(s); s.r75Sunplay.sunlight = 3; s.r75Sunplay.firstCaught = true;
        const planted = window.plant(s, 0, "wheat", now);
        /* 預告固定在第 2 格、60 秒後才落下，測試期間不會自己變成落光。 */
        Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [1], previewAt: now + 60000, nextAt: now + 60000, refractions: 0 });
        __farm.refresh(); FarmWorld.refresh(s);
        return { before, planted: planted.ok, tile0: s.map.tiles.find((t) => t.plotIndex === 0).id, tile1: s.map.tiles.find((t) => t.plotIndex === 1).id };
      });
      assert.equal(setup.before, false, `${tag} 還沒接過陽光時，資源列不該出現蓄光瓶`);
      assert.equal(setup.planted, true, `${tag} 測試前置：第一格要種得下小麥`);
      await page.waitForFunction(() => document.querySelector(".r75a-jar-chip") && document.querySelector("#r75aRackNode img")?.naturalWidth > 0 && document.querySelector('.r75a-sun-preview[data-plot-index="1"]'), null, { timeout: 8000 });
      await page.waitForTimeout(700);

      /* 一、蓄光瓶籤、預告圈、地圖上的曬架 */
      const hud = await page.evaluate((tile1) => {
        const box = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const chip = document.querySelector(".r75a-jar-chip"), bar = chip.closest(".res-bar") || chip.parentElement;
        const chips = [...bar.children].filter((n) => n.getBoundingClientRect().width > 0).map((n) => ({ cls: n.className, box: box(n) }));
        const preview = document.querySelector('.r75a-sun-preview[data-plot-index="1"]'), tile = document.querySelector(`.gtile[data-tile-id="${tile1}"]`);
        const rack = document.getElementById("r75aRackNode"), world = document.getElementById("mapWorld");
        const others = [...document.querySelectorAll(".r75b-map-node")].map((n) => ({ label: n.getAttribute("aria-label") || "", box: box(n) }));
        return { chip: box(chip), chipText: chip.textContent.trim(), chipImg: chip.querySelector("img").naturalWidth, chips, bar: box(bar), barScroll: bar.scrollWidth - bar.clientWidth,
          preview: box(preview), previewText: preview.textContent, tile: box(tile), rack: box(rack), rackLabel: rack.textContent.trim(), rackState: rack.dataset.rackState, rackInWorld: rack.offsetLeft > 0 && rack.offsetLeft < world.offsetWidth && rack.offsetTop > 0 && rack.offsetTop <= world.offsetHeight, others,
          docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      }, setup.tile1);
      assert.equal(hud.chipText, "陽光 3/5", `${tag} 蓄光瓶籤要寫目前陽光與上限`);
      assert.ok(hud.chipImg > 0, `${tag} 蓄光瓶圖要載入`);
      assert.ok(hud.chip.width > 0 && hud.chip.left >= -1 && hud.chip.right <= w + 1 && hud.chip.top >= -1 && hud.chip.bottom <= h + 1, `${tag} 蓄光瓶籤要在畫面內 ${JSON.stringify(hud.chip)}`);
      for (let i = 0; i < hud.chips.length; i++) for (let j = i + 1; j < hud.chips.length; j++) assert.ok(overlap(hud.chips[i].box, hud.chips[j].box) < 4, `${tag} 資源列的籤不可互相重疊：${hud.chips[i].cls}／${hud.chips[j].cls}`);
      assert.ok(hud.docScroll <= 1, `${tag} 加了蓄光瓶籤後頁面不可出現橫向捲動（多出 ${hud.docScroll}px）`);
      /* R76A：太陽改由一般字型的 ::before 畫，避免像素字型變形；節點文字只留倒數。 */
      assert.match(hud.previewText, /^\d+ 秒$/, `${tag} 預告圈要寫還有幾秒`);
      assert.ok(Math.abs(hud.preview.left - hud.tile.left) <= 2 && Math.abs(hud.preview.top - hud.tile.top) <= 2 && Math.abs(hud.preview.width - hud.tile.width) <= 2, `${tag} 預告圈要蓋在那一格田上 ${JSON.stringify([hud.preview, hud.tile])}`);
      assert.ok(hud.rack.width >= 44 && hud.rack.height >= 44, `${tag} 曬架命中區至少 44px ${JSON.stringify(hud.rack)}`);
      assert.equal(hud.rackLabel, "曬架", `${tag} 空曬架的標籤`); assert.equal(hud.rackState, "empty"); assert.equal(hud.rackInWorld, true, `${tag} 曬架要在地圖範圍內`);
      for (const other of hud.others) assert.ok(overlap(hud.rack, other.box) < 16, `${tag} 曬架不可壓在「${other.label}」上`);
      /* 一進場（鏡頭還在農舍前）：桌機要直接看得到曬架，而且沒有被別的東西蓋住。 */
      const rackHit = await page.evaluate(() => { const n = document.getElementById("r75aRackNode"), r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; const inView = x > 0 && y > 0 && x < innerWidth && y < innerHeight; const top = inView ? document.elementFromPoint(x, y) : null; return { inView, hit: !!top && (top === n || n.contains(top)), topTag: top ? top.tagName + "." + top.className : "" }; });
      if (!mobile) assert.equal(rackHit.inView, true, `${tag} 桌機一進場就要看得到曬架`);
      if (rackHit.inView) assert.equal(rackHit.hit, true, `${tag} 曬架要點得到，目前被 ${rackHit.topTag} 蓋住`);
      await shot("1-map");

      /* 二、點有作物的田：動作列多出「把光折到這裡」與「催熟」 */
      await page.evaluate((id) => { __farm.setTool("water"); __farm.clickTile(id); }, setup.tile0);
      await page.waitForFunction(() => document.querySelector('#sceneActionBar:not([hidden]) [data-action="refract"]') && document.querySelector('#sceneActionBar [data-action="ripen"]'), null, { timeout: 8000 });
      await page.waitForFunction(() => !__farm.moving || !__farm.moving(), null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      const bar = await page.evaluate(() => [...document.querySelectorAll("#sceneActionBar .scene-action-btn")].map((b) => { const r = b.getBoundingClientRect(), img = b.querySelector("img"), t = b.querySelector(".sab-t"); return { action: b.dataset.action, text: b.textContent.trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, img: img ? img.naturalWidth : -1, clipped: t ? t.scrollWidth - t.clientWidth : 0 }; }));
      for (const b of bar) {
        assert.ok(b.width >= 44 && b.height >= 44, `${tag} 動作鈕「${b.text}」至少 44px ${JSON.stringify(b)}`);
        assert.ok(b.left >= -1 && b.right <= w + 1 && b.top >= -1 && b.bottom <= h + 1, `${tag} 動作鈕「${b.text}」要在畫面內 ${JSON.stringify(b)}`);
        assert.ok(b.clipped <= 1, `${tag} 動作鈕「${b.text}」的字不可被切掉（少 ${b.clipped}px）`);
        if (b.action === "refract" || b.action === "ripen") assert.ok(b.img > 0, `${tag} 動作鈕「${b.text}」的圖要載入`);
      }
      for (let i = 0; i < bar.length; i++) for (let j = i + 1; j < bar.length; j++) assert.ok(overlap(bar[i], bar[j]) < 4, `${tag} 動作鈕不可重疊：${bar[i].text}／${bar[j].text}`);
      assert.ok(bar.length <= 3, `${tag} 田格動作列最多三顆鈕，實際 ${bar.length}`);
      await shot("2-actions");
      await page.locator('#sceneActionBar [data-action="refract"]').click();
      await page.waitForFunction(() => !document.querySelector('#sceneActionBar [data-action="refract"]'), null, { timeout: 4000 });
      const refracted = await page.evaluate(() => { const s = __farm.state(); return { preview: s.sun.previewPlots.slice(), used: s.sun.refractions, ring: !!document.querySelector('.r75a-sun-preview[data-plot-index="0"]'), flash: !!document.querySelector(".r75a-beam-flash"), first: s.r75Sunplay.firstRefracted }; });
      assert.deepEqual(refracted.preview, [0], `${tag} 按下後光要改落在選的那一格`); assert.equal(refracted.used, 1); assert.equal(refracted.first, true);
      assert.equal(refracted.ring, true, `${tag} 預告圈要跟著移到新的一格`);
      await shot("3-refracted");
      await page.locator('#sceneActionBar [data-action="ripen"]').click();
      await page.waitForFunction(() => { const s = __farm.state(); return window.getCropProgress(s, s.plots[0], Date.now()).ready; }, null, { timeout: 4000 });
      await page.waitForFunction(() => document.querySelector(".r75a-jar-chip")?.textContent.trim() === "陽光 1/5", null, { timeout: 4000 });

      /* 三、曬架面板：放作物、等待、收下、關閉 */
      await page.evaluate(() => document.getElementById("r75aRackNode").click());
      await page.waitForFunction(() => document.querySelectorAll("#r75aRackPanel [data-dry]").length === 4, null, { timeout: 4000 });
      await page.waitForFunction(() => [...document.querySelectorAll("#r75aRackPanel img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
      const measurePanel = () => page.evaluate(() => {
        const p = document.getElementById("r75aRackPanel").getBoundingClientRect();
        return { panel: { left: p.left, right: p.right, top: p.top, bottom: p.bottom }, buttons: [...document.querySelectorAll("#r75aRackPanel button")].map((b) => { const r = b.getBoundingClientRect(); return { text: b.textContent.trim(), disabled: b.disabled, width: r.width, height: r.height, dry: b.dataset.dry || "" }; }) };
      });
      const checkPanel = (data, label) => {
        assert.ok(data.panel.left >= 0 && data.panel.right <= w && data.panel.top >= 0 && data.panel.bottom <= h, `${tag} 曬架面板（${label}）不出界 ${JSON.stringify(data.panel)}`);
        for (const b of data.buttons) assert.ok(b.width >= 44 && b.height >= 44, `${tag} 曬架面板（${label}）按鈕「${b.text}」至少 44px ${JSON.stringify(b)}`);
      };
      const empty = await measurePanel(); checkPanel(empty, "空架");
      assert.equal(empty.buttons.find((b) => b.dry === "wheat").disabled, false, `${tag} 倉庫有 6 份小麥、陽光 1 點，小麥要可以曬`);
      assert.equal(empty.buttons.find((b) => b.dry === "carrot").disabled, true, `${tag} 沒有紅蘿蔔時，該鈕要停用並寫還差幾份`);
      assert.match(empty.buttons.find((b) => b.dry === "carrot").text, /還差 2 份/);
      await shot("4-rack-empty");
      await page.locator('#r75aRackPanel [data-dry="wheat"]').click();
      await page.waitForFunction(() => document.querySelector("#r75aRackPanel [data-rack-time]"), null, { timeout: 4000 });
      const drying = await measurePanel(); checkPanel(drying, "曝曬中");
      const dryState = await page.evaluate(() => { const s = __farm.state(), n = document.getElementById("r75aRackNode"); return { wheat: s.storage.items.wheat, sun: s.r75Sunplay.sunlight, state: n.dataset.rackState, label: n.textContent.trim(), time: document.querySelector("[data-rack-time]").textContent }; });
      assert.equal(dryState.wheat, 4, `${tag} 放上曬架要用掉 2 份小麥`); assert.equal(dryState.sun, 0, `${tag} 放上曬架要用掉 1 點陽光`);
      assert.equal(dryState.state, "drying"); assert.match(dryState.label, /^曬架・\d+ 秒$/); assert.match(dryState.time, /^還要 \d+ 秒$/);
      await shot("5-rack-drying");
      await page.evaluate(() => { __farm.state().r75Sunplay.rack.readyAt = Date.now() - 1; });
      await page.waitForFunction(() => document.querySelector("#r75aRackPanel [data-collect]") && document.getElementById("r75aRackNode").dataset.rackState === "ready", null, { timeout: 4000 });
      const ready = await measurePanel(); checkPanel(ready, "可收");
      assert.equal(await page.evaluate(() => document.getElementById("r75aRackNode").textContent.trim()), "曬架・可收");
      await shot("6-rack-ready");
      await page.locator("#r75aRackPanel [data-collect]").click();
      await page.waitForFunction(() => (__farm.state().storage.items.sun_wheat || 0) === 1 && document.querySelectorAll("#r75aRackPanel [data-dry]").length === 4, null, { timeout: 4000 });
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("r75aRackOverlay"), null, { timeout: 4000 });
      await page.evaluate(() => document.getElementById("r75aRackNode").click());
      await page.waitForFunction(() => document.querySelector("#r75aRackPanel [data-close]"), null, { timeout: 4000 });
      await page.locator("#r75aRackPanel [data-close]").click();
      await page.waitForFunction(() => !document.getElementById("r75aRackOverlay"), null, { timeout: 4000 });

      /* 四、升級清單裡的手鏡與蓄光瓶卡 */
      await page.evaluate(() => { __farm.refresh(); FarmWorld.openPanel("upgrades"); });
      await page.waitForFunction(() => document.querySelectorAll("#upgrades .r75a-up").length === 2, null, { timeout: 8000 });
      await page.waitForTimeout(900);
      /* 照玩家的做法走：第一章還沒走完時先點開「之後的目標」，有「再顯示 N 項」就按下去。 */
      const later = page.locator("#upgrades details.r55-future-upgrades:not([open]) > summary"); if (await later.count()) await later.first().click();
      await page.waitForTimeout(300);
      const more = page.locator('.side-pane.sel [data-audit="panel-show-more"]'); if (await more.count() && await more.first().isVisible()) await more.first().click();
      await page.waitForTimeout(300);
      const cards = await page.evaluate(() => {
        const body = document.querySelector(".side-panel.world-panel-open .side-body") || document.querySelector("#upgrades");
        return [...document.querySelectorAll("#upgrades .r75a-up")].map((card) => {
          card.scrollIntoView({ block: "center" }); const r = card.getBoundingClientRect(), b = card.querySelector("button"), br = b ? b.getBoundingClientRect() : null, img = card.querySelector(".u-ic img"), other = document.querySelector("#upgrades .up:not(.r75a-up) button.buy"), or = other ? other.getBoundingClientRect() : null, bb = body.getBoundingClientRect();
          return { id: card.dataset.r75aUpgrade, text: card.textContent.replace(/\s+/g, " ").trim(), left: r.left, right: r.right, bodyLeft: bb.left, bodyRight: bb.right, img: img ? img.naturalWidth : 0, button: br ? { width: br.width, height: br.height, right: br.right, text: b.textContent.trim(), disabled: b.disabled } : null, otherHeight: or ? or.height : 0 };
        });
      });
      assert.deepEqual(cards.map((c) => c.id), ["mirror", "bottle"], `${tag} 升級清單要有手鏡與蓄光瓶兩張卡`);
      for (const c of cards) {
        assert.ok(c.left >= c.bodyLeft - 1 && c.right <= c.bodyRight + 1 && c.right <= w + 1, `${tag} 升級卡「${c.id}」不可超出面板 ${JSON.stringify(c)}`);
        assert.ok(c.img > 0, `${tag} 升級卡「${c.id}」圖要載入`);
        assert.ok(c.button && c.button.right <= w + 1 && c.button.width >= 44, `${tag} 升級卡「${c.id}」的購買鈕要在畫面內`);
        if (c.otherHeight) assert.ok(c.button.height >= c.otherHeight - 1, `${tag} 升級卡「${c.id}」的購買鈕不可比其他升級卡的矮`);
      }
      await shot("7-upgrades");
      const coinsBefore = await page.evaluate(() => __farm.state().coins);
      await page.locator('#upgrades [data-r75a-upgrade="mirror"] button').click();
      await page.waitForFunction(() => __farm.state().r75Sunplay.mirrorLevel === 1 && /已完成/.test(document.querySelector('#upgrades [data-r75a-upgrade="mirror"]')?.textContent || ""), null, { timeout: 4000 });
      assert.equal(await page.evaluate(() => __farm.state().coins), coinsBefore - 60, `${tag} 磨亮手鏡要扣 60 金`);
      assert.deepEqual(errors, [], `${tag} 不可有頁面錯誤`);
      await ctx.close();
      console.log(`OK R75A ${tag}：蓄光瓶籤、預告圈、折光／催熟、曬架、升級卡`);
    }
  } finally { await browser.close(); }
  console.log("VERIFIED R75A layout 1366x768 1366x600 390x844 844x390");
})().catch((error) => { console.error(error); process.exit(1); });
