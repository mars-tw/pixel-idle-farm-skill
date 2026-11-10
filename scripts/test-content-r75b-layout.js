"use strict";
/* R75B 版面：四種尺寸下看火候畫面按鈕夠大、可關閉、不出界；農場招牌出現在地圖上。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), ORIGIN = "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/"), VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
(async () => {
  const browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = `${w}x${h}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(ORIGIN);
      await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(() => {
        document.querySelector("#worldBegin")?.click();
        const s = __farm.state();
        s.adventure.claimed.c1_first_harvest = true;
        AdventureAPI.ensure(s, Date.now());
        s.storage.items.wheat = 20;
        s.adventure.r58.r59.r60.storyChoices.merchant_hello = { npcId: "merchant", choiceId: "sign", at: Date.now(), journal: "測試" };
        s.adventure.r58.r59.r60.storyChoices.mayor_welcome = { npcId: "mayor", choiceId: "farm", at: Date.now(), journal: "測試" };
        CookingR75.ensure(s, Date.now());
        __farm.refresh();
        FarmWorld.refresh(s);
      });
      await page.waitForFunction(() => document.querySelector('[data-r75b-sign="farm_sign"]'), null, { timeout: 8000 });
      const mapNodes = await page.evaluate(() => ({
        sign: document.querySelectorAll('[data-r75b-sign="farm_sign"]').length,
        seedBag: document.querySelectorAll('[data-r75b-seed-bag="wheat_seed"]').length,
        signBox: (() => { const n = document.querySelector('[data-r75b-sign="farm_sign"]'); if (!n) return null; const r = n.getBoundingClientRect(); return { width: r.width, height: r.height }; })(),
      }));
      assert.equal(mapNodes.sign, 1, `${tag} 農場招牌要出現在地圖上`);
      assert.equal(mapNodes.seedBag, 1, `${tag} 農舍門口要有種子袋`);
      assert.ok(mapNodes.signBox && mapNodes.signBox.width > 0 && mapNodes.signBox.height > 0, `${tag} 招牌要看得到`);
      /* 打開灶台，開始煮 */
      await page.evaluate(() => { FarmWorld.openKitchen(); });
      await page.waitForFunction(() => document.querySelector('[data-r75b-start="rustic_bread"]'), null, { timeout: 8000 });
      await page.waitForFunction(() => { const img = document.querySelector(".recipe-row[data-recipe='rustic_bread'] .r75b-pot-thumb"); return img && img.complete && img.naturalWidth > 0; }, null, { timeout: 8000 });
      const kitchen = await page.evaluate(() => ({
        directText: document.querySelector('[data-cook="rustic_bread"]')?.textContent || "",
        potLoaded: (() => { const img = document.querySelector(".r75b-cook-pot"); return true; })(),
        thumb: (() => { const img = document.querySelector(".recipe-row[data-recipe='rustic_bread'] .r75b-pot-thumb"); return img ? { ok: img.complete && img.naturalWidth > 0 } : null; })(),
        gradeText: document.querySelector('[data-r75b-grade="rustic_bread"]')?.textContent || "",
      }));
      assert.match(kitchen.directText, /直接做（家常）/, `${tag} 要保留直接做家常`);
      assert.ok(kitchen.thumb && kitchen.thumb.ok, `${tag} 灶台鐵鍋圖要載入`);
      await page.locator('[data-r75b-start="rustic_bread"]').click();
      await page.waitForFunction(() => document.querySelector(".r75b-cook-overlay"), null, { timeout: 8000 });
      const game = await page.evaluate(() => {
        const card = document.querySelector(".r75b-cook-card").getBoundingClientRect();
        const buttons = [...document.querySelectorAll(".r75b-cook-actions button, .r75b-cook-close")].map((b) => { const r = b.getBoundingClientRect(); return { text: b.textContent.trim(), width: r.width, height: r.height }; });
        const pot = document.querySelector(".r75b-cook-pot");
        const track = document.querySelector(".r75b-fire-track").getBoundingClientRect();
        return { card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom }, buttons, potOk: pot.complete && pot.naturalWidth > 0, track: { width: track.width, height: track.height } };
      });
      assert.ok(game.card.left >= 0 && game.card.right <= w && game.card.top >= 0 && game.card.bottom <= h, `${tag} 小遊戲畫面不出界 ${JSON.stringify(game.card)}`);
      assert.equal(game.buttons.length, 4, `${tag} 要有添柴、掀蓋、直接做、關閉四顆按鈕`);
      for (const b of game.buttons) assert.ok(b.height >= 44 && b.width >= 44, `${tag} 按鈕 ${b.text} 命中區要至少 44px: ${JSON.stringify(b)}`);
      assert.equal(game.potOk, true, `${tag} 小遊戲鐵鍋圖要載入`);
      assert.ok(game.track.width > 100, `${tag} 火候條要看得到`);
      /* 鍵盤：空白鍵添柴不能讓畫面壞掉，關閉鈕可關 */
      await page.keyboard.press("Space");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(60);
      assert.equal(await page.locator(".r75b-cook-overlay").count(), 1, `${tag} 鍵盤操作後畫面還在`);
      await page.locator("[data-r75b-close]").click();
      assert.equal(await page.locator(".r75b-cook-overlay").count(), 0, `${tag} 小遊戲可以關閉`);
      assert.deepEqual(errors, [], `${tag} page errors`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log("VERIFIED content R75B layout");
})().catch((e) => { console.error(e); process.exit(1); });
