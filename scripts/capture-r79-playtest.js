"use strict";
// R79 試玩截圖：新存檔開局 → 前 60 秒的真實操作（引導鈕 go），四視口各截關鍵畫面。
// 用法：node scripts/capture-r79-playtest.js <outDir> [baseUrl]
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const out = path.resolve(process.argv[2] || "docs/evidence/r79/after");
const base = process.argv[3] || "http://127.0.0.1:5105/index.html";
const views = [
  ["desktop-1366x768", 1366, 768, false],
  ["laptop-1366x600", 1366, 600, false],
  ["phone-390x844", 390, 844, true],
  ["landscape-844x390", 844, 390, true],
];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const log = [];
  for (const [name, width, height, mobile] of views) {
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base);
    await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 20000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, `${name}-01-open.png`) });
    // 關掉開場對話（若有）
    for (let i = 0; i < 6; i++) {
      const btn = page.locator(".modal.show button, #worldDialog button, .world-dialog button").first();
      if (await btn.count() && await btn.isVisible().catch(() => false)) {
        await page.screenshot({ path: path.join(out, `${name}-02-dialog-${i}.png`) });
        if (mobile) await btn.tap().catch(() => {}); else await btn.click().catch(() => {});
        await page.waitForTimeout(400);
      } else break;
    }
    await page.screenshot({ path: path.join(out, `${name}-03-world.png`) });
    // 依引導鈕走前幾步
    const t0 = Date.now();
    for (let step = 0; step < 10; step++) {
      const go = page.locator("#questDock [data-world-go]");
      if (!(await go.count()) || !(await go.isVisible().catch(() => false))) break;
      // 像真人一樣等角色走完、動作結算再按下一步（R79 起走路中按也會改道，但連按會打斷進行中的動作）
      await page.waitForFunction(() => !window.__farm.moving(), null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      if (mobile) await go.tap().catch(() => {}); else await go.click().catch(() => {});
      await page.waitForTimeout(1500);
      for (let i = 0; i < 4; i++) {
        const btn = page.locator(".modal.show button, #worldDialog button, .world-dialog button").first();
        if (await btn.count() && await btn.isVisible().catch(() => false)) { if (mobile) await btn.tap().catch(() => {}); else await btn.click().catch(() => {}); await page.waitForTimeout(300); } else break;
      }
      if (step === 2 || step === 6) await page.screenshot({ path: path.join(out, `${name}-04-step${step}.png`) });
    }
    const st = await page.evaluate(() => { const s = window.__farm.state(); return { coins: s.coins, quest: document.querySelector("#questDock") && document.querySelector("#questDock").innerText, plant: s.adventure.counts.plant, water: s.adventure.counts.water }; });
    log.push({ name, ms: Date.now() - t0, st, errors });
    await page.screenshot({ path: path.join(out, `${name}-05-after-steps.png`) });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, "playtest-log.json"), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
