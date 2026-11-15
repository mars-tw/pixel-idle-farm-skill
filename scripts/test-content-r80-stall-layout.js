"use strict";
/* R80A 版面：1366×768、390×844 的擺攤與作物評比結果，第一屏只讀三行。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), ORIGIN = "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/");
const VIEWS = [[1366, 768, false], [390, 844, true]];
async function launch() {
  const options = { headless: true, args: ["--no-sandbox"] };
  try { return await chromium.launch(options); } catch (_) {}
  for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...options, executablePath }); } catch (_) {}
  throw Error("No browser available");
}
function inside(box, width, height) { return box && box.left >= -1 && box.right <= width + 1 && box.top >= -1 && box.bottom <= height + 1; }
(async () => {
  const browser = await launch();
  try {
    for (const [width, height, mobile] of VIEWS) {
      const tag = width + "x" + height, context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await context.newPage(), errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(ORIGIN); await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(() => { const button = document.querySelector("#worldBegin"); if (button && button.offsetParent) button.click(); }); await page.waitForTimeout(200);
      if (page.clock) await page.clock.install();
      await page.evaluate(() => {
        const state = __farm.state(), now = Date.now(); AdventureAPI.ensure(state, now); state.level = 8; state.upgrades.plotCount = 1;
        const festival = state.adventure.r61.festival; Object.assign(festival, { unlocked: true, startsAt: now - 1000, endsAt: now + 600000, nextAt: 0, baseline: { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } }, supportProvisioned: true, harvestCrop: "wheat", harvestRequired: 3 });
        state.storage.items = { wheat: 11, carrot: 12, tomato: 12, strawberry: 12 }; __farm.refresh(); FarmWorld.refresh(state); FestivalStallR72.open(state, { notify: () => {}, save: () => {} });
      });
      await page.locator("[data-r72b-start]").click();
      if (page.clock) await page.clock.fastForward(62000); else await page.waitForTimeout(62000);
      await page.waitForSelector("[data-r80a-stall-summary]", { timeout: 10000 });
      const stall = await page.evaluate(() => {
        const summary = document.querySelector("[data-r80a-stall-summary]"), details = document.querySelector("[data-r80a-stall-details]"), card = summary.closest(".r72b-card"); card.scrollTop = 0;
        const r = summary.getBoundingClientRect(); return { lines: summary.querySelectorAll(":scope > p").length, text: summary.textContent, detailsOpen: details.open, box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, cardScroll: card.scrollTop };
      });
      assert.equal(stall.lines, 3, tag + " 擺攤第一屏正好三行"); assert.match(stall.text, /星等：/); assert.match(stall.text, /得分：/); assert.match(stall.text, /最該改進：/);
      assert.equal(stall.detailsOpen, false, tag + " 擺攤明細預設收合"); assert.equal(stall.cardScroll, 0); assert.ok(inside(stall.box, width, height), tag + " 擺攤三行不用捲動");

      await page.evaluate(() => {
        const state = __farm.state(); state.adventure.r61.festival.judging = { stars: 2, totalScore: 3, maxScore: 5, scoreSources: { diverse: true, seasonal: true, hasMeal: true, quality: false, hasDried: false }, breakdown: [{ id: "diverse", got: true }, { id: "seasonal", got: true }, { id: "hasMeal", got: true }, { id: "quality", got: false }, { id: "hasDried", got: false }], details: [{ name: "小麥", sources: ["種類不同"] }], rewardText: "金幣 24 枚" };
        const stall = document.getElementById("r72bStallOverlay"); if (stall) stall.remove();
        let box = document.getElementById("worldModal"); if (!box) { box = document.createElement("div"); box.id = "worldModal"; document.body.appendChild(box); }
        box.className = "modal world-modal show"; box.hidden = false; box.style.display = "grid";
        box.innerHTML = '<div class="modal-card"><h2 id="worldModalTitle">作物評比結果</h2><div class="modal-body">舊內容</div></div>';
        const button = document.createElement("button"); button.id = "festivalJudge"; document.body.appendChild(button); button.click(); button.remove();
      });
      await page.waitForSelector("[data-r80a-judge-summary]"); await page.waitForTimeout(20);
      const judging = await page.evaluate(() => {
        const summary = document.querySelector("[data-r80a-judge-summary]"), details = document.querySelector("[data-r80a-judge-details]"), r = summary.getBoundingClientRect();
        return { lines: summary.querySelectorAll(":scope > p").length, text: summary.textContent, detailsOpen: details.open, box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } };
      });
      assert.equal(judging.lines, 3, tag + " 評比第一屏正好三行"); assert.match(judging.text, /星等：/); assert.match(judging.text, /得分：3／5/); assert.match(judging.text, /最該改進：/);
      assert.equal(judging.detailsOpen, false, tag + " 評比明細預設收合"); assert.ok(inside(judging.box, width, height), tag + " 評比三行不用捲動");
      assert.deepEqual(errors, [], tag + " 頁面錯誤：" + errors.join("；"));
      await context.close(); console.log("OK R80A stall layout " + tag);
    }
  } finally { await browser.close(); }
  console.log("VERIFIED content R80A stall layout 2 sizes");
})().catch((error) => { console.error(error); process.exit(1); });
