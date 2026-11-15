"use strict";
/* R78A 版面：桌面與手機第一屏、商品卡三態文字、結算原因與人數對帳。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/");
const VIEWS = [[1366, 768, false], [390, 844, true]];
async function launch() {
  const opts = { headless: true, args: ["--no-sandbox"] };
  try { return await chromium.launch(opts); } catch (_) { /* 改試系統瀏覽器 */ }
  for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) {
    if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) { /* 繼續 */ }
  }
  throw Error("No browser available");
}
function inside(box, width, height) { return !!box && box.left >= -1 && box.right <= width + 1 && box.top >= -1 && box.bottom <= height + 1; }

(async () => {
  const browser = await launch();
  try {
    for (const [width, height, mobile] of VIEWS) {
      const tag = width + "x" + height;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" });
      const page = await context.newPage(); const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(ORIGIN);
      await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(() => { const button = document.querySelector("#worldBegin"); if (button && button.offsetParent) button.click(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const state = __farm.state(), now = Date.now();
        AdventureAPI.ensure(state, now); state.level = 8; state.xp = CONFIG.xpForLevel(8); state.upgrades.plotCount = 1;
        const festival = state.adventure.r61.festival;
        festival.unlocked = true; festival.startsAt = now - 1000; festival.endsAt = now + 600000; festival.nextAt = 0;
        festival.baseline = { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
        festival.supportProvisioned = true; festival.harvestCrop = "wheat"; festival.harvestRequired = 3;
        state.storage.items = { wheat: 11, carrot: 12, tomato: 12, strawberry: 12 };
        __farm.refresh(); FarmWorld.refresh(state);
        FestivalStallR72.open(state, { notify: () => {}, save: () => {} });
      });
      await page.waitForSelector("[data-r78a-market]");
      const first = await page.evaluate(() => {
        const rect = (node) => { const r = node && node.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; };
        const hot = document.querySelector("[data-r78a-market]"), start = document.querySelector("[data-r72b-start]");
        return { hot: rect(hot), start: rect(start), hotCount: document.querySelectorAll(".r78a-hot").length, hotText: hot && hot.textContent, startText: start && start.textContent };
      });
      assert.ok(inside(first.hot, width, height), tag + " 第一屏看得到今天客人愛什麼 " + JSON.stringify(first));
      assert.ok(inside(first.start, width, height), tag + " 第一屏看得到開始叫賣 " + JSON.stringify(first));
      assert.ok(first.hotCount >= 1 && first.hotCount <= 2, tag + " 熱門只能有一至兩項");
      assert.match(first.hotText, /今天客人愛什麼/); assert.match(first.startText, /開始叫賣/);

      if (page.clock) await page.clock.install();
      await page.locator("[data-r72b-start]").click();
      await page.waitForSelector("[data-r78a-card-state]");
      if (page.clock) await page.clock.fastForward(8000); else await page.waitForTimeout(8000);
      const game = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("[data-r78a-card-state]")].map((node) => {
          const small = node.querySelector("small"), r = node.getBoundingClientRect(), sr = small && small.getBoundingClientRect();
          return { state: node.dataset.r78aCardState, text: small && small.textContent, left: r.left, right: r.right, smallLeft: sr && sr.left, smallRight: sr && sr.right, scroll: small && small.scrollWidth, client: small && small.clientWidth };
        });
        return { cards, tags: document.querySelectorAll("[data-r78a-customer-tags] span").length };
      });
      assert.ok(game.cards.length >= 3, tag + " 只顯示本場擺出的商品卡");
      assert.ok(game.cards.some((card) => card.state === "stock"), tag + " 第 8 秒不能全部變成代幣卡 " + JSON.stringify(game.cards));
      assert.ok(game.tags >= 1 && game.tags <= 2, tag + " 每位客人最多兩個需求標籤");
      for (const card of game.cards) {
        assert.match(card.text, /有貨・還剩 \d+ 份|用代幣・只拿一半分|賣完/, tag + " 卡片只用三種短狀態");
        assert.ok(card.smallLeft >= card.left - 1 && card.smallRight <= card.right + 1, tag + " 卡片文字不超出右緣 " + JSON.stringify(card));
      }

      if (page.clock) await page.clock.fastForward(70000); else await page.waitForTimeout(61000);
      await page.waitForSelector("[data-r78a-end-reason]", { timeout: 10000 });
      const result = await page.evaluate(() => {
        const reason = document.querySelector("[data-r78a-end-reason]"), title = document.querySelector(".r72b-title"), counts = document.querySelector("[data-r78a-counts]"), summary = document.querySelector("[data-r77c-customers] summary");
        const r = reason.getBoundingClientRect();
        return { reason: reason.textContent.trim(), first: title.nextElementSibling === reason, box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, counts: counts.textContent, summary: summary.textContent };
      });
      assert.equal(result.first, true, tag + " 結算第一行就是結束原因");
      assert.ok(inside(result.box, width, height), tag + " 結束原因在可見範圍");
      assert.match(result.reason, /時間到|貨賣完|代幣用完/);
      const numbers = result.counts.match(/答對 (\d+) 位・答錯 (\d+) 位・錯過 (\d+) 位・沒輪到 (\d+) 位・共 (\d+) 位/);
      assert.ok(numbers, tag + " 四種人數逐項列出：" + result.counts);
      assert.equal(+numbers[1] + +numbers[2] + +numbers[3] + +numbers[4], +numbers[5], tag + " 客人總數要對帳");
      assert.match(result.summary, new RegExp("（" + numbers[5] + " 位）"), tag + " 明細標題人數一致");
      assert.deepEqual(errors, [], tag + " 頁面錯誤：" + errors.join("；"));
      await context.close();
      console.log("OK R78A stall layout " + tag);
    }
  } finally { await browser.close(); }
  console.log("VERIFIED content R78A stall layout 2 sizes");
})().catch((error) => { console.error(error); process.exit(1); });
