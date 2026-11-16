"use strict";
/* R79A 版面：桌面與手機的兩位客人、開場按鈕、商品文字與結算首屏。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/");
const VIEWS = [[1366, 768, false], [390, 844, true]];
async function launch() {
  const options = { headless: true, args: ["--no-sandbox"] };
  try { return await chromium.launch(options); } catch (_) { /* 改試系統瀏覽器 */ }
  for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) {
    if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...options, executablePath }); } catch (_) { /* 繼續 */ }
  }
  throw Error("No browser available");
}
function inside(box, width, height) { return !!box && box.left >= -1 && box.right <= width + 1 && box.top >= -1 && box.bottom <= height + 1; }
function overlaps(a, b) { return a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }

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
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        const state = __farm.state(), now = Date.now();
        AdventureAPI.ensure(state, now); state.level = 8; state.xp = CONFIG.xpForLevel(8); state.upgrades.plotCount = 1;
        const festival = state.adventure.r61.festival;
        festival.unlocked = true; festival.startsAt = now - 1000; festival.endsAt = now + 600000; festival.nextAt = 0;
        festival.baseline = { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
        festival.supportProvisioned = true; festival.harvestCrop = "wheat"; festival.harvestRequired = 3;
        FestivalStallR72.ensure(state, now); state.adventure.r72b.totalPlays = 1;
        state.storage.items = { wheat: 11, carrot: 12, tomato: 12, strawberry: 12 };
        __farm.refresh(); FarmWorld.refresh(state);
        FestivalStallR72.open(state, { notify: () => {}, save: () => {} });
      });
      await page.waitForSelector("[data-r79a-opening-rules]");
      const start = await page.evaluate(() => {
        const rect = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        const button = document.querySelector("[data-r72b-start]");
        const steps = [...document.querySelectorAll(".r77c-step")].filter((node) => node.getBoundingClientRect().bottom > 0).map(rect);
        return { button: rect(button), steps, lines: document.querySelectorAll("[data-r79a-opening-rules] > p").length, text: button.textContent };
      });
      assert.equal(start.lines, 3, tag + " 開場規則必須正好三行");
      assert.ok(inside(start.button, width, height), tag + " 開始叫賣在首屏可見");
      assert.ok(start.steps.every((box) => !overlaps(start.button, box)), tag + " 開始叫賣不能壓到加減鈕");
      assert.match(start.text, /開始叫賣/);

      if (page.clock) await page.clock.install();
      await page.locator("[data-r72b-start]").click();
      if (page.clock) await page.clock.fastForward(1200); else await page.waitForTimeout(1200);
      await page.waitForSelector("[data-r79a-queue]");
      const game = await page.evaluate(() => {
        const rect = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        return {
          scene: rect(document.querySelector("[data-r79a-stall-scene]")),
          customers: [...document.querySelectorAll("[data-r79a-customer]")].map(rect),
          patience: document.querySelectorAll("[data-r79a-patience]").length,
          booth: !!document.querySelector('[data-r79a-booth-art][src*="content-r79/stall-booth.png"]'),
          itemText: [...document.querySelectorAll("[data-r72b-item] small")].map((node) => ({ text: node.textContent, scroll: node.scrollWidth, client: node.clientWidth })),
        };
      });
      assert.equal(game.customers.length, 2, tag + " 同時要看得到兩位客人");
      assert.equal(game.patience, 2, tag + " 兩位客人各有耐心條");
      assert.equal(game.booth, true, tag + " 新攤位圖片路徑已接好");
      assert.ok(inside(game.scene, width, height), tag + " 攤位與隊伍在首屏內");
      assert.ok(game.customers.every((box) => inside(box, width, height)), tag + " 兩位客人完整可見");
      for (const item of game.itemText) { assert.match(item.text, /還剩 \d+ 份|一半分|賣完/); assert.ok(item.scroll <= item.client + 1, tag + " 商品數量不可掉字或橫向溢出：" + item.text); }

      for (let i = 0; i < 36; i++) {
        if (await page.locator("[data-r79a-max-score]").count()) break;
        if (page.clock) await page.clock.fastForward(1200); else await page.waitForTimeout(1200);
        const answer = await page.evaluate(() => {
          const selected = document.querySelector('[data-r79a-customer][aria-pressed="true"]');
          if (!selected) return null;
          const bubble = (selected.querySelector(".r72b-bubble") || {}).textContent || "";
          const buttons = [...document.querySelectorAll("[data-r72b-item]")].filter((button) => !button.disabled);
          if (bubble.startsWith("我要")) {
            const named = buttons.find((button) => { const name = button.querySelector("b"); return name && bubble.includes(name.textContent); });
            if (named) return named.dataset.r72bItem;
          }
          const substitute = buttons.find((button) => button.dataset.r79aSubstitute === "true");
          if (substitute) return substitute.dataset.r72bItem;
          const tastes = { "甜的": "sweet", "酸酸的": "sour", "清爽的": "fresh", "熱熱的": "warm" };
          const needed = Object.keys(tastes).filter((label) => bubble.includes(label)).map((label) => tastes[label]);
          const matched = buttons.find((button) => needed.some((taste) => (button.dataset.r73bTastes || "").split(",").includes(taste)));
          return (matched || buttons[0] || {}).dataset && (matched || buttons[0]).dataset.r72bItem;
        });
        if (!answer) continue;
        await page.locator(`[data-r72b-item="${answer}"]`).click();
      }
      await page.waitForSelector("[data-r79a-max-score]", { timeout: 10000 });
      const result = await page.evaluate(() => {
        const rect = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        const card = document.querySelector(".r72b-card"); card.scrollTop = 0;
        const max = document.querySelector("[data-r79a-max-score]");
        return { max: rect(max), text: max.textContent, rows: document.querySelectorAll(".r77c-customer-row").length, detail: document.querySelector(".r77c-customer-row")?.textContent || "" };
      });
      assert.ok(inside(result.max, width, height), tag + " 結算首屏看得到最高分");
      assert.match(result.text, /最多可以拿 \d+ 分/);
      assert.ok(result.rows >= 10, tag + " 結算至少十位客人，實際 " + result.rows);
      assert.match(result.detail, /需求：.*交付：.*基本 .*熱門加分 .*連續答對加分 .*代幣少 .*合計 /s);
      assert.deepEqual(errors, [], tag + " 頁面錯誤：" + errors.join("；"));
      await context.close();
      console.log("OK R79A stall layout " + tag);
    }
  } finally { await browser.close(); }
  console.log("VERIFIED content R79A stall layout 2 sizes");
})().catch((error) => { console.error(error); process.exit(1); });
