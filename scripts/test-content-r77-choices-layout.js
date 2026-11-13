"use strict";
/* R77B 版面：四種尺寸下，回訪播完後對方多交代一件事；手札「我做過的選擇」看得到三個步驟與進度；
   招牌選色三個選項至少 44px、不出界、不被工具列蓋住；選完地圖招牌換色、河畔委託卡寫出多兩成；
   兩套回訪只剩 R76 那一套（mainStoryRecall 不再補台詞）。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), ORIGIN = "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/"), VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
function overlap(a, b) {
  if (!a || !b) return 0;
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0.5 && h > 0.5 ? Math.round(w * h) : 0;
}
/* 量一組元素：位置、大小、正中央點得到嗎（沒被別的東西蓋住），以及下方工具列與手機方向鍵的位置。 */
function measure(page, selector) {
  return page.evaluate((sel) => {
    const visible = (n) => { if (!n) return null; const cs = getComputedStyle(n), r = n.getBoundingClientRect(); return !n.hidden && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null; };
    const items = [...document.querySelectorAll(sel)].map((n) => {
      const r = n.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, hit: !!top && (n === top || n.contains(top)), text: n.textContent.replace(/\s+/g, " ").trim() };
    });
    return { items, dock: visible(document.querySelector("#farmDock")), pad: visible(document.querySelector("#mobileControls .dpad")), act: visible(document.querySelector("#actionA")) };
  }, selector);
}
(async () => {
  const browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = `${w}x${h}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(ORIGIN);
      await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      const press = (sel) => mobile ? page.locator(sel).first().tap({ timeout: 8000 }) : page.locator(sel).first().click({ timeout: 8000 });
      await page.evaluate(() => { const b = document.querySelector("#worldSunBegin, #worldBegin"); if (b && b.offsetParent) b.click(); });
      await page.waitForTimeout(600);
      assert.equal(await page.evaluate(() => !!(window.ChoicesR77 && ChoicesR77.cardHtml && AdventureAPI.mainStoryRecall.__r77b)), true, `${tag} 後續委託模組要載入並接上`);

      /* 選「先聽鎮上的事」，回訪對白播完後鎮長多交代一件事 */
      const followLines = await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        AdventureAPI.ensure(s, now);
        const r = AdventureAPI.resolveMainStoryChoice(s, "mayor", "town", now - 10 * 60 * 1000);
        if (!r.ok) throw new Error("選擇失敗 " + JSON.stringify(r));
        StoryR76.openFollowup(s, "mayor", {});
        return StoryR76.FOLLOWUPS["mayor:town"].lines.length;
      });
      await page.waitForFunction(() => document.querySelector(".r76b-dialogue [data-r76b-next]"), null, { timeout: 8000 });
      for (let i = 0; i < followLines; i++) await press("[data-r76b-next]");
      await page.waitForFunction(() => /既然你想多認識鎮上/.test(document.querySelector(".r76b-dialogue [data-r76b-line]")?.textContent || ""), null, { timeout: 8000 });
      const brief = await page.evaluate(() => { const c = document.querySelector(".r76b-dialogue-card").getBoundingClientRect(), b = document.querySelector("[data-r76b-next]").getBoundingClientRect(); return { card: { left: c.left, right: c.right, top: c.top, bottom: c.bottom }, btn: { w: b.width, h: b.height } }; });
      assert.ok(brief.card.left >= 0 && brief.card.right <= w && brief.card.top >= 0 && brief.card.bottom <= h, `${tag} 交代對話框不出界 ${JSON.stringify(brief.card)}`);
      assert.ok(brief.btn.w >= 44 && brief.btn.h >= 44, `${tag} 交代對話框按鈕至少 44px`);
      for (let i = 0; i < 3; i++) await press("[data-r76b-next]");
      await page.waitForFunction(() => !document.querySelector(".r76b-dialogue"), null, { timeout: 8000 });
      await page.waitForFunction(() => /多交代了一件事/.test(document.querySelector("#toast-zone")?.textContent || ""), null, { timeout: 8000 });
      const recall = await page.evaluate(() => { const s = __farm.state(), t = Date.now() + 10 * 60 * 1000; return { now: AdventureAPI.mainStoryRecall(s, "mayor", t), orig: AdventureAPI.__r77bOrigMainStoryRecall(s, "mayor", t), status: ChoicesR77.questView(s, "mayor", Date.now()).status }; });
      assert.equal(recall.status, "active", `${tag} 回訪播完後委託開始`);
      assert.ok(recall.orig, `${tag} 原本那套固定回訪台詞存在`);
      assert.equal(recall.now, "", `${tag} 第 8 項：同一個選擇不再用固定台詞提第二次`);

      /* 再準備：班伯只選了還沒回訪；蘿拉「招牌」做到第三步（選顏色） */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        s.adventure.claimed.c1_first_harvest = true;
        AdventureAPI.ensure(s, now);
        if (!AdventureAPI.resolveMainStoryChoice(s, "elder", "sell", now).ok) throw new Error("班伯選擇失敗");
        s.adventure.claimed.c1_homecoming = true;
        AdventureAPI.ensure(s, now);
        if (!AdventureAPI.resolveMainStoryChoice(s, "merchant", "sign", now).ok) throw new Error("蘿拉選擇失敗");
        StoryR76.markFollowupSeen(s, "merchant", now);
        ChoicesR77.onFollowupSeen(s, "merchant", now);
        s.materials.wood = 2;
        if (!ChoicesR77.act(s, "merchant", now).ok) throw new Error("木料交不出去");
        s.adventure.meals.rustic_bread = 1;
        if (!ChoicesR77.act(s, "merchant", now + 1).ok) throw new Error("料理交不出去");
        ChoicesR77.takeNotes();
        s.adventure.projects.fishing_dock = { restored: true, restoredAt: now };
        AdventureAPI.ensure(s, now);
        CookingR75.ensure(s, now);
        __farm.refresh();
        FarmWorld.refresh(s);
      });
      await page.waitForFunction(() => !document.querySelector("#toast-zone > *"), null, { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => { FarmWorld.openPanel("journal"); CookingR75.injectChoices(__farm.state()); });
      await page.waitForFunction(() => document.querySelectorAll('[data-r77b-quest="merchant"] [data-r77b-color]').length === 3, null, { timeout: 8000 });

      /* 手札：鎮長那張卡看得到三個步驟、去哪裡做、幾分之幾 */
      await page.evaluate(() => document.querySelector('[data-r77b-quest="mayor"]').scrollIntoView({ block: "center" }));
      await page.waitForTimeout(150);
      const mayor = await page.evaluate(() => {
        const box = document.querySelector('[data-r77b-quest="mayor"]'), r = box.getBoundingClientRect();
        const steps = [...box.querySelectorAll(".r77b-step")].map((n) => { const b = n.getBoundingClientRect(); return { left: b.left, right: b.right, width: b.width, height: b.height, progress: n.querySelector(".r77b-progress")?.textContent || "", where: n.querySelector(".r77b-where")?.textContent || "" }; });
        return { box: { left: r.left, right: r.right }, overflow: box.scrollWidth - box.clientWidth, state: box.dataset.r77bState, title: box.querySelector(".r77b-quest-title").textContent, steps };
      });
      assert.equal(mayor.state, "active", `${tag} 鎮長的後續委託進行中`);
      assert.match(mayor.title, /鎮上的事.*已完成 0\/3 步/, `${tag} 標題寫出委託名稱與幾步`);
      assert.equal(mayor.steps.length, 3, `${tag} 三個步驟都列出來`);
      assert.equal(mayor.steps[0].progress, "進度 1/4", `${tag} 回訪那次交談算進度`);
      for (const s of mayor.steps) {
        assert.match(s.progress, /\d+\/\d+/, `${tag} 每一步都有幾分之幾`);
        assert.match(s.where, /去哪裡做：/, `${tag} 每一步寫去哪裡做`);
        assert.ok(s.width > 0 && s.height > 0 && s.left >= 0 && s.right <= w + 0.5, `${tag} 步驟不出界 ${JSON.stringify(s)}`);
      }
      assert.ok(mayor.box.left >= 0 && mayor.box.right <= w + 0.5 && mayor.overflow <= 1, `${tag} 委託卡不出界、不橫向捲動`);
      const elderHint = await page.evaluate(() => document.querySelector('[data-r77b-quest="elder"][data-r77b-state="waiting"] .r77b-hint')?.textContent || "");
      assert.match(elderHint, /還有一件事要交代/, `${tag} 還沒回訪的寫出要再去找他聊`);

      /* 招牌選色：三個選項至少 44px、不出界、不被工具列蓋住、點得到 */
      await page.evaluate(() => document.querySelector('[data-r77b-quest="merchant"] [data-r77b-colors]').scrollIntoView({ block: "center" }));
      await page.waitForTimeout(150);
      const colors = await measure(page, '[data-r77b-quest="merchant"] [data-r77b-color]');
      assert.equal(colors.items.length, 3, `${tag} 三個顏色選項`);
      for (const c of colors.items) {
        assert.ok(c.width >= 44 && c.height >= 44, `${tag} 顏色「${c.text}」至少 44px ${JSON.stringify(c)}`);
        assert.ok(c.left >= 0 && c.right <= w + 0.5 && c.top >= 0 && c.bottom <= h + 0.5, `${tag} 顏色「${c.text}」不出界 ${JSON.stringify(c)}`);
        assert.equal(overlap(c, colors.dock), 0, `${tag} 顏色「${c.text}」不被下方工具列蓋住`);
        assert.equal(overlap(c, colors.pad), 0, `${tag} 顏色「${c.text}」不被方向鍵蓋住`);
        assert.equal(overlap(c, colors.act), 0, `${tag} 顏色「${c.text}」不被動作鍵蓋住`);
        assert.equal(c.hit, true, `${tag} 顏色「${c.text}」點得到`);
      }
      await press('[data-r77b-quest="merchant"] [data-r77b-color="red"]');
      await page.waitForFunction(() => document.querySelector('[data-r77b-quest="merchant"][data-r77b-state="done"]'), null, { timeout: 8000 });
      await page.waitForFunction(() => /三步都完成了/.test(document.querySelector("#toast-zone")?.textContent || ""), null, { timeout: 8000 });
      const done = await page.evaluate(() => {
        const box = document.querySelector('[data-r77b-quest="merchant"]');
        return { after: box.querySelector("[data-r77b-after]")?.textContent || "", upgrade: box.querySelector("[data-r77b-upgrade]")?.textContent || "", pressed: box.querySelector('[data-r77b-color="red"]')?.getAttribute("aria-pressed"),
          effect: box.closest(".r75b-choice-card")?.querySelector(".r75b-choice-e")?.textContent || "" };
      });
      assert.match(done.after, /^再後來：/, `${tag} 全部做完手札多一行「再後來」`);
      assert.match(done.after, /莓果紅/, `${tag} 「再後來」寫出選的顏色`);
      assert.match(done.upgrade, /多兩成/, `${tag} 手札寫出加成升級`);
      assert.match(done.effect, /多兩成/, `${tag} 「現在的影響」改成升級後的內容`);
      assert.equal(done.pressed, "true", `${tag} 選中的顏色有標示`);
      await page.waitForFunction(() => { const n = document.querySelector('.r75b-map-node[data-r75b-sign][data-r77b-sign-color="red"]'); return n && /hue-rotate/.test(getComputedStyle(n.querySelector("img")).filter); }, null, { timeout: 8000 });
      const sign = await page.evaluate(() => { const n = document.querySelector('.r75b-map-node[data-r75b-sign]'); return { count: document.querySelectorAll('[data-r75b-sign="farm_sign"]').length, label: n.getAttribute("aria-label") }; });
      assert.equal(sign.count, 1, `${tag} 地圖上仍然只有一塊招牌`);
      assert.match(sign.label, /莓果紅/, `${tag} 地圖招牌換成選的顏色`);

      /* 河畔委託卡寫出升級後的加成字樣 */
      await page.evaluate(() => FarmWorld.openPanel("story"));
      await page.waitForFunction(() => /多兩成/.test(document.querySelector('[data-r77b-bonus="merchant"]')?.textContent || ""), null, { timeout: 8000 });
      /* 故事分頁第一屏放不下的卡片收在「顯示更多」後面，先展開再量 */
      await page.waitForFunction(() => {
        const n = document.querySelector('[data-r77b-bonus="merchant"]');
        if (n && n.getBoundingClientRect().width > 0) return true;
        const more = document.querySelector('.side-pane.sel .r32-show-more, .side-pane.sel .r60-show-more');
        if (more) more.click();
        return false;
      }, null, { timeout: 8000, polling: 300 });
      await page.evaluate(() => document.querySelector('[data-r77b-bonus="merchant"]').scrollIntoView({ block: "center" }));
      await page.waitForTimeout(150);
      const bonus = await page.evaluate(() => { const n = document.querySelector('[data-r77b-bonus="merchant"]'); const r = n.getBoundingClientRect(), card = n.closest(".adventure-quest").getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height, cardLeft: card.left, cardRight: card.right, pane: document.querySelector('.side-pane[data-pane="story"]')?.className || "" }; });
      assert.ok(bonus.width > 0 && bonus.height > 0 && bonus.left >= bonus.cardLeft - 0.5 && bonus.right <= bonus.cardRight + 0.5 && bonus.right <= w + 0.5, `${tag} 委託卡加成字樣看得到、不出界 ${JSON.stringify(bonus)}`);

      assert.deepEqual(errors, [], `${tag} 不可有頁面錯誤：` + errors.join(";"));
      await ctx.close();
      console.log(`OK R77B choices layout ${tag}`);
    }
  } finally { await browser.close(); }
  console.log("VERIFIED content R77B choices layout 4 sizes");
})().catch((e) => { console.error(e); process.exit(1); });
