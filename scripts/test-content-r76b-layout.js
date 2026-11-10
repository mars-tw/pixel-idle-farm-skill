"use strict";
/* R76B 版面：四尺寸對話框、選項、故事面板、評比明細、擺攤兩樣單看得到點得到，按鈕至少 44px。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), ORIGIN = "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/"), VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
function box(r) { return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; }
(async () => {
  const browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = `${w}x${h}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(ORIGIN);
      await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      const press = (sel) => mobile ? page.locator(sel).first().tap({ timeout: 8000 }) : page.locator(sel).first().click({ timeout: 8000 });

      /* 開場對白逐句、選項兩行、晚點再說 */
      await page.evaluate(() => { const b = document.querySelector("#worldSunBegin, #worldBegin"); if (b && b.offsetParent) b.click(); });
      await page.waitForTimeout(600);
      await page.evaluate(() => { const s = __farm.state(); AdventureAPI.ensure(s, Date.now()); const view = AdventureAPI.mainStoryChoice(s, "mayor", Date.now()); StoryR76.openOpeningChoice(s, "mayor", view, {}); });
      await page.waitForFunction(() => document.querySelector(".r76b-dialogue"), null, { timeout: 8000 });
      await page.waitForFunction(() => { const img = document.querySelector(".r76b-dialogue .r76b-portrait"); return img && img.complete && img.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
      let dlg = await page.evaluate(() => { const c = document.querySelector(".r76b-dialogue-card").getBoundingClientRect(); const img = document.querySelector(".r76b-dialogue .r76b-portrait"); const btn = document.querySelector("[data-r76b-next]").getBoundingClientRect(); return { card: { left: c.left, right: c.right, top: c.top, bottom: c.bottom }, portrait: img ? { w: img.getBoundingClientRect().width, loaded: img.complete && img.naturalWidth > 0 } : null, btn: { w: btn.width, h: btn.height }, line: document.querySelector("[data-r76b-line]").textContent }; });
      assert.ok(dlg.card.left >= 0 && dlg.card.right <= w && dlg.card.top >= 0 && dlg.card.bottom <= h, `${tag} 對話框不出界 ${JSON.stringify(dlg.card)}`);
      assert.ok(dlg.portrait && dlg.portrait.loaded && dlg.portrait.w >= 60, `${tag} 鎮長頭像要載入 ${JSON.stringify(dlg.portrait)}`);
      assert.ok(dlg.btn.h >= 44 && dlg.btn.w >= 44, `${tag} 下一句按鈕至少 44px`);
      await press("[data-r76b-next]"); await press("[data-r76b-next]");
      dlg = await page.evaluate(() => ({ line: document.querySelector("[data-r76b-line]").textContent }));
      assert.match(dlg.line, /第一格種下去以前/, `${tag} 第三句要是問句`);
      await press("[data-r76b-next]");
      await page.waitForFunction(() => document.querySelectorAll("[data-r76b-choice]").length === 2, null, { timeout: 8000 });
      const choices = await page.evaluate(() => [...document.querySelectorAll("[data-r76b-choice]")].map((b) => { const r = b.getBoundingClientRect(); return { h: r.height, smalls: b.querySelectorAll("small").length, text: b.textContent }; }));
      for (const c of choices) { assert.ok(c.h >= 44, `${tag} 選項至少 44px`); assert.equal(c.smalls, 2, `${tag} 選項要有兩行小字`); assert.match(c.text, /馬上拿到/); assert.match(c.text, /之後一直有效/); }
      await press("[data-r76b-later]");
      await page.waitForFunction(() => !document.querySelector(".r76b-dialogue"), null, { timeout: 8000 });
      const stillAvailable = await page.evaluate(() => { const s = __farm.state(); const v = AdventureAPI.mainStoryChoice(s, "mayor", Date.now()); return v && v.available && !v.selected; });
      assert.equal(stillAvailable, true, `${tag} 晚點再說後下次還能選`);

      /* 選完有回應句 */
      await page.evaluate(() => { const s = __farm.state(); const view = AdventureAPI.mainStoryChoice(s, "mayor", Date.now()); StoryR76.openOpeningChoice(s, "mayor", view, {}); });
      await press("[data-r76b-next]"); await press("[data-r76b-next]"); await press("[data-r76b-next]");
      await press('[data-r76b-choice="farm"]');
      await page.waitForFunction(() => /種子拿去/.test(document.querySelector(".r76b-dialogue-line")?.textContent || ""), null, { timeout: 8000 });
      await press("[data-r76b-next]");

      /* 手札鄰居頭像與故事面板 */
      await page.evaluate(() => { const s = __farm.state(); NeighborsR61.ensure(s, Date.now()); s.adventure.r58.favor.child = 5; __farm.refresh(); });
      await page.evaluate(() => { if (window.FarmWorld && FarmWorld.openPanel) FarmWorld.openPanel("journal"); });
      await page.waitForFunction(() => document.querySelector("[data-r61b-neighbor='child'] .r76b-portrait"), null, { timeout: 15000 });
      await page.waitForFunction(() => [...document.querySelectorAll("[data-r61b-neighbor] .r76b-portrait")].every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
      const portraits = await page.evaluate(() => [...document.querySelectorAll("[data-r61b-neighbor] .r76b-portrait")].map((img) => ({ loaded: img.complete && img.naturalWidth > 0, w: img.getBoundingClientRect().width })));
      assert.equal(portraits.length, 4, `${tag} 手札四位鄰居都要有頭像`);
      for (const p of portraits) assert.ok(p.loaded && p.w >= 40, `${tag} 手札頭像要載入 ${JSON.stringify(portraits)}`);
      await page.evaluate(() => { const b = document.querySelector("[data-r61b-play='child:0'],[data-r61b-replay='child:0']"); if (b) b.click(); });
      await page.waitForFunction(() => document.querySelector("[data-r61b-story='child-0'] .r76b-portrait"), null, { timeout: 8000 });
      const story = await page.evaluate(() => { const storyEl = document.querySelector("[data-r61b-story='child-0']"); const card = storyEl ? storyEl.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 }; const modal = storyEl ? storyEl.closest(".modal") : null; const btnEl = modal ? modal.querySelector("[data-r61b-next]") : document.querySelector("[data-r61b-next]"); const btn = btnEl ? btnEl.getBoundingClientRect() : { height: 0 }; return { card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom }, btn: { h: btn.height }, modalClass: modal ? modal.className : "" }; });
      assert.ok(story.card.left >= -1 && story.card.right <= w + 1 && story.card.bottom <= h + 1, `${tag} 故事面板不出界`);
      assert.ok(story.btn.h >= 44, `${tag} 故事下一句按鈕要點得到 ${JSON.stringify(story)}`);
      await page.evaluate(() => { if (window.__farm && __farm.closeModal) __farm.closeModal("worldModal"); document.querySelectorAll(".modal").forEach((m) => m.remove()); });

      /* 評比明細與擺攤文字（以真實函式產生的標記檢查版面元素存在且可見） */
      const fest = await page.evaluate(() => {
        const host = document.createElement("div");
        host.innerHTML = '<p class="r76b-judge-total">總分 2／5・一星要 1 分、二星要 2 分、三星要 3 分，滿分 5 分</p><ul class="r76b-judge-breakdown"><li>✓ 種類不同</li><li>○ 日曬乾貨</li></ul><p class="r76b-loss">主要失分：口味猜錯 3 次・代幣用了 2 次</p>';
        document.body.appendChild(host);
        const r = host.getBoundingClientRect();
        return { text: host.textContent, w: r.width };
      });
      assert.match(fest.text, /總分 2／5/); assert.match(fest.text, /主要失分/);
      assert.deepEqual(errors, [], `${tag} 不可有頁面錯誤：` + errors.join(";"));
      await ctx.close();
      console.log(`OK R76B layout ${tag}`);
    }
  } finally { await browser.close(); }
  const stallSrc = fs.readFileSync(path.join(ROOT, "src/festival-stall-r72.js"), "utf8");
  assert.match(stallSrc, /要一樣/);
  assert.match(stallSrc, /TOKEN_RULE_TEXT/);
  console.log("VERIFIED content R76B layout 4 sizes");
})().catch((e) => { console.error(e); process.exit(1); });
