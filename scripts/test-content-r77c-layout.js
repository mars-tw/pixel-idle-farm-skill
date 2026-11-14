"use strict";
/* R77C 版面：四尺寸下擺出去的貨清單、客人回顧、兩條路任務卡、手冊第一屏都看得到、不出界。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), ORIGIN = "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/"), VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
function insideX(box, w) { return !!box && box.left >= -1 && box.right <= w + 1; }
(async () => {
  const browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = `${w}x${h}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(ORIGIN);
      await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(() => { const b = document.querySelector("#worldBegin"); if (b && b.offsetParent) b.click(); });
      await page.waitForTimeout(400);

      /* 一、擺出去的貨：清單完整、留給誰看得到、加減鈕至少 44px。 */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        AdventureAPI.ensure(s, now); s.level = 8; s.xp = CONFIG.xpForLevel(8); s.upgrades.plotCount = 1;
        const f = s.adventure.r61.festival;
        f.unlocked = true; f.startsAt = now - 1000; f.endsAt = now + 600000; f.nextAt = 0;
        f.baseline = { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
        f.supportProvisioned = true; f.harvestCrop = "wheat"; f.harvestRequired = 3;
        s.storage.items = { wheat: 12, carrot: 12, tomato: 12, strawberry: 12 };
        __farm.refresh(); FarmWorld.refresh(s);
        FestivalStallR72.open(s, { notify: () => {}, save: () => {} });
      });
      await page.waitForSelector("[data-r77c-stall-plan]", { timeout: 8000 });
      const plan = await page.evaluate(() => {
        const rows = [...document.querySelectorAll("[data-r77c-stall-row]")].map((n) => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, text: n.textContent.replace(/\s+/g, " ").trim() }; });
        const steps = [...document.querySelectorAll(".r77c-step")].map((n) => { const r = n.getBoundingClientRect(); return { w: r.width, h: r.height }; });
        const planBox = document.querySelector("[data-r77c-stall-plan]").getBoundingClientRect();
        return { rows, steps, plan: { left: planBox.left, right: planBox.right } };
      });
      assert.ok(plan.rows.length >= 4, `${tag} 擺出去的貨每一樣都要列出來：${plan.rows.length}`);
      for (const row of plan.rows) assert.ok(insideX(row, w), `${tag} 擺出清單不出界 ${JSON.stringify(row)}`);
      assert.ok(plan.steps.length >= 8, `${tag} 每樣貨都要有加減鈕`);
      for (const s of plan.steps) assert.ok(s.w >= 44 && s.h >= 44, `${tag} 加減鈕至少 44px ${JSON.stringify(s)}`);
      assert.ok(insideX(plan.plan, w), `${tag} 擺出清單整塊不出界`);
      const totalLine = () => page.evaluate(() => { const n = document.querySelector("[data-r77c-stall-total]"); if (!n) return null; const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, text: n.textContent.trim() }; });
      const beforeTotal = await totalLine();
      assert.ok(beforeTotal && /擺出|代幣/.test(beforeTotal.text), `${tag} 開攤前要先講一共擺出幾份 ${JSON.stringify(beforeTotal)}`);
      assert.ok(insideX(beforeTotal, w), `${tag} 擺出總量那一行不出界 ${JSON.stringify(beforeTotal)}`);
      const beforeQty = await page.evaluate(() => document.querySelector('[data-r77c-qty="wheat"]').textContent);
      await page.locator('[data-r77c-plus="wheat"]').click();
      const afterQty = await page.evaluate(() => document.querySelector('[data-r77c-qty="wheat"]').textContent);
      assert.notEqual(afterQty, beforeQty, `${tag} 按加號擺出量要變`);
      const afterTotal = await totalLine();
      assert.notEqual(afterTotal.text, beforeTotal.text, `${tag} 按加號以後擺出總量要跟著變`);

      /* 二、客人回顧：真的玩一小段再結算，逐位看得到。 */
      if (page.clock) await page.clock.install();
      await page.locator("[data-r72b-start]").click();
      await page.waitForSelector("[data-r72b-item]", { timeout: 8000 });
      if (page.clock) await page.clock.fastForward(2000);
      for (let i = 0; i < 3; i++) {
        const id = await page.evaluate(() => {
          const bubble = (document.querySelector(".r72b-bubble") || {}).textContent || "";
          const btns = [...document.querySelectorAll("[data-r72b-item]")];
          if (bubble.startsWith("我要")) { const b = btns.find((x) => { const t = x.querySelector("b"); return t && bubble.includes(t.textContent); }); if (b) return b.dataset.r72bItem; }
          const map = { "甜的": "sweet", "酸酸的": "sour", "清爽的": "fresh", "熱熱的": "warm" };
          const tastes = Object.keys(map).filter((t) => bubble.includes(t)).map((t) => map[t]);
          const b = btns.find((x) => !x.disabled && tastes.some((t) => (x.dataset.r73bTastes || "").split(",").includes(t))) || btns.find((x) => !x.disabled);
          return b ? b.dataset.r72bItem : null;
        });
        if (!id) break;
        await page.locator(`[data-r72b-item="${id}"]`).click().catch(() => {});
        if (page.clock) await page.clock.fastForward(1200);
      }
      if (page.clock) await page.clock.fastForward(70000);
      await page.waitForSelector("[data-r77c-customers]", { timeout: 10000 });
      await page.locator("[data-r77c-customers] summary").click();
      const review = await page.evaluate(() => {
        const box = document.querySelector("[data-r77c-customers]").getBoundingClientRect();
        const rows = [...document.querySelectorAll(".r77c-customer-row")].map((n) => n.textContent.replace(/\s+/g, " ").trim());
        return { left: box.left, right: box.right, rows, summaryH: document.querySelector("[data-r77c-customers] summary").getBoundingClientRect().height };
      });
      assert.ok(insideX(review, w), `${tag} 客人回顧不出界`);
      assert.ok(review.rows.length >= 1, `${tag} 結算要有逐位客人紀錄`);
      assert.match(review.rows.join(" "), /想要：/, `${tag} 每位客人要寫想要什麼`);
      /* 時鐘不用卸載，關掉這個分頁就會跟著收掉。 */
      await page.evaluate(() => { const c = document.querySelector(".r72b-close"); if (c) c.click(); });

      /* 三、兩條路的任務卡：手札裡看得到兩種做法與或字進度。 */
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        AdventureAPI.ensure(s, now);
        for (const q of AdventureAPI.quests(s, now)) if (q.chapter < 4) s.adventure.claimed[q.id] = true;
        AdventureAPI.ensure(s, now);
        Object.assign(s.storage.items, { tomato: 3, sun_wheat: 1 });
        s.materials.wood = 2;
        __farm.refresh(); FarmWorld.refresh(s); FarmWorld.openPanel("story");
      });
      await page.waitForTimeout(600);
      /* 首屏收合會把後面的卡藏在「再顯示」後面（橫式最明顯）：照玩家的做法先展開再量。 */
      for (let i = 0; i < 3; i++) {
        const more = page.locator(".side-panel [data-audit='panel-show-more']").first();
        if (await more.count() === 0) break;
        await more.click().catch(() => {});
        await page.waitForTimeout(300);
      }
      const card = await page.evaluate(() => {
        const el = document.querySelector('#adventurePanel [data-quest="c4_market_expansion"]');
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        const r = el.getBoundingClientRect(), panel = document.querySelector(".side-panel.world-panel-open .side-body");
        const pr = panel ? panel.getBoundingClientRect() : { left: 0, right: innerWidth };
        return { left: r.left, right: r.right, panelLeft: pr.left, panelRight: pr.right, text: el.textContent.replace(/\s+/g, " ").trim() };
      });
      assert.ok(card, `${tag} 第 4 章任務卡看得到`);
      assert.match(card.text, /做法甲・鮮貨桌/, `${tag} 任務卡要有做法甲：${card.text}`);
      assert.match(card.text, /做法乙・耐放貨架.*任何乾貨/, `${tag} 任務卡要有做法乙與各自進度：${card.text}`);
      assert.doesNotMatch(card.text, /兩種做法擇一/, `${tag} 不再把兩種做法塞成清單一列`);
      assert.ok(card.left >= card.panelLeft - 1 && card.right <= card.panelRight + 1, `${tag} 任務卡不出面板`);

      /* 四、手冊第一屏：打開就知道差多少。 */
      await page.evaluate(() => FarmWorld.openPanel("journal"));
      await page.waitForSelector("[data-r76c-sunbook]", { timeout: 8000 });
      await page.evaluate(() => { const d = document.querySelector(".r76c-fold"); if (d && !d.open) document.querySelector(".r76c-sum").click(); });
      await page.waitForSelector("[data-r78c-first-stamps]", { timeout: 8000 });
      const top = await page.evaluate(() => {
        const n = document.querySelector("[data-r78c-first-stamps]"), r = n.getBoundingClientRect(), next = document.querySelector("[data-r76c-next]");
        const panel = document.querySelector(".side-panel.world-panel-open .side-body"), pr = panel ? panel.getBoundingClientRect() : { left: 0, right: innerWidth };
        const bar = document.querySelector(".r76c-bar");
        return { left: r.left, right: r.right, panelLeft: pr.left, panelRight: pr.right, rows: n.querySelectorAll("[data-r76c-row]").length, text: next ? next.textContent : "", repeats: (document.querySelector("[data-r76c-sunbook]").textContent.match(/再蓋 \d+ 枚可領/g) || []).length, barMax: bar ? bar.getAttribute("aria-valuemax") : null, barTop: bar ? bar.getBoundingClientRect().top : 0, topY: r.top };
      });
      assert.ok(top.rows >= 1, `${tag} 第一屏先看得到作物印章格`);
      assert.match(top.text, /(再蓋 \d+ 枚可領：|有獎勵可以領了|四份獎勵都領完了)/, `${tag} 進度區寫一次差幾枚領什麼：${top.text}`);
      assert.ok(top.repeats <= 1, `${tag} 同一句差額提示不重複`);
      assert.equal(top.barMax, "15", `${tag} 進度條分母要是 15`);
      assert.ok(top.topY <= top.barTop, `${tag} 印章格要排在進度條前面`);
      assert.ok(top.left >= top.panelLeft - 1 && top.right <= top.panelRight + 1, `${tag} 印章格不出面板`);

      assert.deepEqual(errors, [], `${tag} 頁面錯誤：` + errors.join(";"));
      await ctx.close();
      console.log(`OK R77C layout ${tag}`);
    }
  } finally { await browser.close(); }
  const css = fs.readFileSync(path.join(ROOT, "src/content-r58b.css"), "utf8");
  assert.match(css, /R77C/, "樣式要有 R77C 段落");
  assert.ok(css.indexOf("R77C") > css.indexOf("R76C"), "R77C 樣式要接在檔尾");
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, "CSS 大括號要平衡");
  console.log("VERIFIED content R77C layout 4 sizes");
})().catch((e) => { console.error(e); process.exit(1); });
