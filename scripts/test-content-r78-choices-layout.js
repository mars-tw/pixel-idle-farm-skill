"use strict";
/* R78C 版面：1366×768、390×844 依序開角色事件、第四章雙路線、評比結果、追光手冊第一屏。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), OUT = path.join(ROOT, "docs", "evidence", "r79");
const VIEWS = [[1366, 768, false], [390, 844, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const origin = "http://127.0.0.1", u = new URL(req.url, origin), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
async function ready(page, origin) { await page.goto(origin); await page.waitForFunction(() => window.__farm && window.ChoicesR77 && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 }); await page.evaluate(() => { const b = document.querySelector("#worldSunBegin, #worldBegin"); if (b && b.offsetParent) b.click(); }); await page.waitForTimeout(500); }
function inside(box, w, h) { return box && box.left >= -0.5 && box.top >= -0.5 && box.right <= w + 0.5 && box.bottom <= h + 0.5; }
async function shot(page, tag, name) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, "r78c-" + tag + "-" + name + ".png"), fullPage: false }); }

(async () => {
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = w + "x" + h, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await ready(page, origin);

      /* 一、後續委託：角色現場、結果決定、手札紀錄不重複。 */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now(); AdventureAPI.ensure(s, now);
        AdventureAPI.resolveMainStoryChoice(s, "mayor", "farm", now);
        ChoicesR77.act(s, "mayor", now + 1);
        ChoicesR77.act(s, "mayor", now + 2, "seed");
        FarmWorld.openPanel("journal"); CookingR75.injectChoices(s);
      });
      await page.waitForFunction(() => document.querySelector(".r76b-dialogue [data-r76b-next]"), null, { timeout: 3000 });
      for (let i = 0; i < 2; i++) await page.locator(".r76b-dialogue [data-r76b-next]").click();
      await page.waitForFunction(() => !document.querySelector(".r76b-dialogue"), null, { timeout: 3000 });
      await page.evaluate(() => { FarmWorld.openPanel("journal"); CookingR75.injectChoices(__farm.state()); });
      await page.waitForFunction(() => !document.querySelector("#toast-zone > *"), null, { timeout: 6000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelector('[data-r77b-quest="mayor"] [data-r78c-decision-record]'));
      await page.evaluate(() => document.querySelector('[data-r77b-quest="mayor"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(120);
      const follow = await page.evaluate(() => {
        const box = document.querySelector('[data-r77b-quest="mayor"]'), r = box.getBoundingClientRect(), names = [...box.querySelectorAll(".r77b-step-name")].map((n) => n.textContent.replace(/^✓\s*/, "").trim());
        return { box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, overflow: box.scrollWidth - box.clientWidth, names, records: box.querySelectorAll("[data-r78c-decision-record]").length, text: box.textContent.replace(/\s+/g, " ").trim() };
      });
      assert.ok(inside(follow.box, w, h), tag + " 角色事件卡在畫面內"); assert.ok(follow.overflow <= 1); assert.equal(new Set(follow.names).size, 3, tag + " 同一目標不重複列"); assert.equal(follow.records, 1); assert.match(follow.text, /我選了.*留種小包.*拿到/);
      await shot(page, tag, "1-followup");

      /* 二、第四章：做法甲／做法乙是兩欄，各自有進度與報酬，不再是一列標題。 */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now(); AdventureAPI.ensure(s, now);
        for (const q of AdventureAPI.quests(s, now)) if (q.chapter < 4) { s.adventure.claimed[q.id] = true; s.adventure.quests[q.id].status = "claimed"; s.adventure.quests[q.id].rewardGranted = true; }
        AdventureAPI.ensure(s, now + 1); Object.assign(s.storage.items, { tomato: 1, strawberry: 1, sun_wheat: 1 }); Object.assign(s.materials, { wood: 1, stone: 1 });
        FarmWorld.openPanel("story"); FarmWorld.refresh(s); ChoicesR77.paintChapterRoutes(s);
      });
      await page.waitForFunction(() => document.querySelector('[data-quest="c4_market_expansion"] .r78c-route-grid'));
      await page.evaluate(() => document.querySelector('[data-quest="c4_market_expansion"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(120);
      const routes = await page.evaluate(() => {
        const card = document.querySelector('[data-quest="c4_market_expansion"]'), box = card.querySelector(".r78c-route-grid"), r = card.getBoundingClientRect();
        return { card: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, overflow: box.scrollWidth - box.clientWidth, sections: [...box.querySelectorAll(".r78c-route")].map((n) => ({ text: n.textContent.replace(/\s+/g, " ").trim(), size: parseFloat(getComputedStyle(n).fontSize) })), oldLabel: /兩種做法擇一/.test(box.textContent), resultCount: box.querySelectorAll(".r78c-route-result").length };
      });
      assert.ok(inside(routes.card, w, h)); assert.ok(routes.overflow <= 1); assert.equal(routes.sections.length, 2); assert.match(routes.sections[0].text, /做法甲・鮮貨桌.*番茄.*草莓.*木料.*報酬/); assert.match(routes.sections[1].text, /做法乙・耐放貨架.*石材.*乾貨.*報酬/); assert.equal(routes.oldLabel, false); assert.equal(routes.resultCount, 1);
      await shot(page, tag, "2-chapter4");

      /* 三、作物評比結果：四分三星、缺項提示與加獎文字都能捲到完整可見。 */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now(), f = s.adventure.r61.festival; s.level = 5;
        f.unlocked = true; f.startsAt = now; f.endsAt = now + 600000; f.nextAt = 0; f.supportProvisioned = true; f.judging = null;
        f.baseline = { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
        s.storage.quality.wheat = 1; s.storage.items.carrot = 1; s.adventure.meals.rustic_bread = 1;
        document.querySelectorAll(".r76b-dialogue").forEach((node) => node.remove()); if (__farm.closeModal) __farm.closeModal("worldModal"); FarmWorld.refresh(s);
        const world = document.querySelector("#mapWorld"), size = Math.max(24, Math.round(world.offsetWidth / s.map.width)); FarmWorld.paintWorld(s, size, now);
      });
      await page.waitForFunction(() => document.querySelector("[data-festival-stall]"), null, { timeout: 8000 });
      await page.evaluate(() => document.querySelector("[data-festival-stall]").click());
      for (const id of ["quality:wheat", "carrot", "rustic_bread"]) await page.locator('[data-festival-entry="' + id + '"]').click();
      await page.locator("#festivalJudge").click();
      await page.waitForFunction(() => /作物評比結果/.test(document.querySelector(".modal.show h2")?.textContent || ""));
      const reward = page.locator(".modal.show .modal-body p").filter({ hasText: "獎勵：" }).last(); await reward.scrollIntoViewIfNeeded(); await page.waitForTimeout(120);
      const judge = await page.evaluate(() => {
        const modal = document.querySelector(".modal.show .modal-card"), body = modal.querySelector(".modal-body"), reward = [...body.querySelectorAll("p")].find((n) => /獎勵：/.test(n.textContent)), rb = reward.getBoundingClientRect(), mb = modal.getBoundingClientRect();
        return { modal: { left: mb.left, top: mb.top, right: mb.right, bottom: mb.bottom }, reward: { left: rb.left, top: rb.top, right: rb.right, bottom: rb.bottom, clipX: reward.scrollWidth - reward.clientWidth, clipY: reward.scrollHeight - reward.clientHeight }, text: body.textContent.replace(/\s+/g, " ").trim(), overflowX: body.scrollWidth - body.clientWidth };
      });
      assert.ok(inside(judge.modal, w, h)); assert.ok(judge.overflowX <= 1); assert.ok(judge.reward.top >= judge.modal.top && judge.reward.bottom <= judge.modal.bottom); assert.ok(judge.reward.clipX <= 1 && judge.reward.clipY <= 1); assert.match(judge.text, /總分 4／5.*三星要 4 分/); assert.match(judge.text, /下次提示：.*日曬乾貨/); assert.match(judge.text, /獎勵：.*優質作物加獎 8 金/);
      await shot(page, tag, "3-judge");
      await page.evaluate(() => __farm.closeModal && __farm.closeModal("worldModal"));

      /* 四、追光手冊第一屏：已解鎖作物的印章格直接出現，差額獎勵只說一次。 */
      await page.evaluate(() => {
        const s = __farm.state(); s.level = 2; s.xp = CONFIG.xpForLevel(2); s.upgrades.plotCount = 1; delete s.sunbook; FarmSunbook.normalize(s); FarmWorld.openPanel("journal"); FarmSunbook.inject(s);
        const body = document.querySelector(".side-panel.world-panel-open .side-body"); if (body) body.scrollTop = 0;
      });
      await page.waitForFunction(() => document.querySelector("[data-r76c-sunbook] .r76c-fold[open] [data-r78c-first-stamps]"));
      const book = await page.evaluate(() => {
        const panel = document.querySelector(".side-panel.world-panel-open .side-body"), rows = [...document.querySelectorAll("[data-r78c-first-stamps] [data-r76c-row]")], pr = panel.getBoundingClientRect(), book = document.querySelector("[data-r76c-sunbook]");
        return { rows: rows.map((n) => { const r = n.getBoundingClientRect(); return { id: n.dataset.r76cRow, left: r.left, top: r.top, right: r.right, bottom: r.bottom, cells: n.querySelectorAll("[data-r76c-cell]").length }; }), panel: { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom }, rewardHints: (book.textContent.match(/再蓋 \d+ 枚可領/g) || []).length, overflow: panel.scrollWidth - panel.clientWidth, helpOpen: book.querySelectorAll(".r78c-row-help[open]").length };
      });
      assert.deepEqual(book.rows.map((r) => r.id), ["wheat", "carrot"]); assert.ok(book.rows.every((r) => r.cells >= 2 && r.left >= book.panel.left && r.right <= book.panel.right && r.top >= book.panel.top && r.bottom <= book.panel.bottom), tag + " 第一屏看得到每種作物印章格"); assert.equal(book.rewardHints, 1); assert.equal(book.helpOpen, 0); assert.ok(book.overflow <= 1);
      await shot(page, tag, "4-sunbook");

      assert.deepEqual(errors, [], tag + " 不可有頁面錯誤：" + errors.join("; "));
      await ctx.close(); console.log("OK R78C layout " + tag);
    }
  } finally { await browser.close(); server.close(); }
  console.log("VERIFIED content R78C choices layout 2 sizes");
})().catch((error) => { console.error(error); process.exit(1); });
