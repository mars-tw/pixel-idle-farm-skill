"use strict";
/* R75 整合：新玩家開場兩條原本會卡住的路，桌機與手機各跑一次，全程只按畫面上的按鈕。
 * 一、按「去見鎮長葛瑞」開場的玩家，在祖母手記的第一道光就要學到折光（原本這條路完全跳過折光教學），
 *     而且提示跳出來、任務卡收成一行時，標題與按鈕都要看得到。
 * 二、走回農舍：農舍左上角那格四周站著鎮長、上方是屋頂，拿它當目的地永遠找不到路，
 *     「前往灶台」「吃麥餅」「享用」原本一律卡在「先走完這段路」。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), ORIGIN = process.env.R75_ORIGIN || "file://" + path.join(ROOT, "index.html").replace(/\\/g, "/"), VIEWS = [[1366, 768, false], [390, 844, true]];
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
(async () => {
  const browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = `${w}x${h}`;
      const open = async () => {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
        page.on("pageerror", (e) => errors.push(String(e))); page.on("dialog", (d) => { errors.push("DIALOG:" + d.message()); d.dismiss().catch(() => {}); });
        await page.goto(ORIGIN);
        await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
        const press = (sel) => mobile ? page.locator(sel).first().tap({ timeout: 8000 }) : page.locator(sel).first().click({ timeout: 8000 });
        const idle = () => page.waitForFunction(() => !__farm.moving || !__farm.moving(), null, { timeout: 12000 });
        return { ctx, page, errors, press, idle };
      };

      /* 一、祖母手記的第一道光教折光 */
      {
        const { ctx, page, errors, press, idle } = await open();
        const kind = () => page.evaluate(() => HeirloomUI.step(__farm.state()).kind);
        const card = (want, timeout) => page.waitForFunction((k) => { const d = document.querySelector("#questDock"); return d && d.dataset.quest === "first_sun_basket" && d.dataset.stepType === k && HeirloomUI.step(__farm.state()).kind === k; }, want, { timeout });
        await press("#worldSunBegin");
        await card("plant", 8000);
        await press("#questDock [data-world-go]");
        await page.waitForFunction(() => __farm.state().plots.some((p) => p && p.cropId === "wheat"), null, { timeout: 12000 });
        await idle();
        await card("refract", 8000);
        const before = await page.evaluate(() => { const s = __farm.state(), i = s.plots.findIndex((p) => p && p.cropId === "wheat"); return { wheat: i, preview: s.sun.previewPlots.slice(), label: document.querySelector("#questDock [data-world-go]").textContent.trim(), title: document.querySelector("#questDock .world-objective-title").textContent.trim(), first: s.r75Sunplay.firstRefracted === true }; });
        assert.equal(before.label, "把光折過來", `${tag} 任務卡按鈕要寫折光`);
        assert.equal(before.title, "拿祖母的手鏡折光", `${tag} 任務卡標題要寫手鏡折光`);
        assert.ok(before.preview.length && !before.preview.includes(before.wheat), `${tag} 折光前，光的預告要落在空田 ${JSON.stringify(before)}`);
        assert.equal(before.first, false);
        await press("#questDock [data-world-go]");
        await page.waitForFunction(() => __farm.state().r75Sunplay.firstRefracted === true && document.querySelector("#toast-zone > .toast"), null, { timeout: 4000 });
        await page.waitForFunction((i) => document.querySelector(`.r75a-sun-preview[data-plot-index="${i}"]`), before.wheat, { timeout: 2000 }).catch(() => {}); /* 預告圈每 0.25 秒重畫一次 */
        const after = await page.evaluate((wheat) => {
          const s = __farm.state(), box = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
          const dock = document.querySelector("#questDock");
          return { preview: s.sun.previewPlots.slice(), ring: !!document.querySelector(`.r75a-sun-preview[data-plot-index="${wheat}"]`), toast: document.querySelector("#toast-zone > .toast").textContent, dock: box(dock), title: box(dock.querySelector(".world-objective-title")), button: box(dock.querySelector("[data-world-go]")) };
        }, before.wheat);
        assert.deepEqual(after.preview, [before.wheat], `${tag} 按下後光要改落在小麥那一格`);
        assert.equal(after.ring, true, `${tag} 預告圈要跟著移到小麥那一格`);
        assert.match(after.toast, /光折過來了/, `${tag} 折完要有提示`);
        /* 提示顯示期間任務卡收成一行：標題不可被擠成 0 高，按鈕不可被卡片切掉。 */
        assert.ok(after.title.height >= 14 && after.title.width >= 60, `${tag} 收成一行時標題要看得到 ${JSON.stringify(after.title)}`);
        assert.ok(after.button.top >= after.dock.top - 1 && after.button.bottom <= after.dock.bottom + 1 && after.button.left >= after.dock.left - 1 && after.button.right <= after.dock.right + 1, `${tag} 收成一行時按鈕要完整在卡片裡 ${JSON.stringify([after.button, after.dock])}`);
        assert.ok(after.button.width >= 44 && after.button.height >= 44, `${tag} 收成一行時按鈕至少 44px ${JSON.stringify(after.button)}`);
        assert.equal(await kind(), "wait", `${tag} 折完光、光還沒到時，任務卡要請玩家等光`);
        await card("water", 15000);
        await press("#questDock [data-world-go]");
        await page.waitForFunction((i) => __farm.state().plots[i].sunGrown === true, before.wheat, { timeout: 12000 });
        assert.ok(await page.evaluate(() => __farm.state().r75Sunplay.sunlight) >= 1, `${tag} 在光裡澆水要接到陽光`);
        await idle();
        await card("harvest", 20000);
        await press("#questDock [data-world-go]");
        await page.waitForFunction(() => FarmHeirloom.status(__farm.state()).ready, null, { timeout: 12000 });
        assert.equal(await page.evaluate(() => FarmHeirloom.status(__farm.state()).sunWheat), 2, `${tag} 光裡照料過的小麥收成後要記滿 2 份陽光小麥`);
        await card("deliver", 6000);
        assert.deepEqual(errors, [], `${tag} 祖母手記折光：不可有頁面錯誤`);
        await ctx.close();
        console.log(`OK R75 opening ${tag}：祖母手記的第一道光教折光，收成後可裝餐籃`);
      }

      /* 二、從田邊走回農舍 */
      {
        const { ctx, page, errors, press, idle } = await open();
        await press("#worldBegin");
        const setup = await page.evaluate(() => {
          const s = __farm.state(), now = Date.now();
          s.adventure.claimed.c1_homecoming = true; s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, now);
          s.storage.items.wheat = 6; const cooked = AdventureAPI.cook(s, "rustic_bread", now); /* 用真的料理規則做出麥餅，任務才記得做過 */
          FarmSunplay.normalize(s); s.r75Sunplay.firstRefracted = true;
          const tile0 = s.map.tiles.find((t) => t.plotIndex === 0).id;
          __farm.setTool("hand"); __farm.selectSeed("wheat"); __farm.clickTile(tile0); /* 先走到田邊種一株，玩家是從田裡走回農舍的 */
          return { tile0, cooked: !!(cooked && cooked.ok), bread: (s.adventure.meals || {}).rustic_bread || 0 };
        });
        assert.ok(setup.cooked && setup.bread === 1, `${tag} 測試前置：要先做出 1 份農家麥餅 ${JSON.stringify(setup)}`);
        await page.waitForFunction(() => __farm.state().plots[0].cropId === "wheat", null, { timeout: 12000 });
        await idle();
        const route = await page.evaluate(() => {
          const s = __farm.state(); __farm.refresh(); FarmWorld.refresh(s);
          const house = s.map.tiles.filter((t) => t.structureId === "farmhouse");
          return { house: house.length, reachable: house.filter((t) => window.pathToAdjacent(s, s.player.tileId, t.id)).length, step: AdventureAPI.nextFarmStep(s, Date.now()).action };
        });
        assert.ok(route.house >= 1 && route.reachable >= 1, `${tag} 從田邊要走得到農舍的某一面牆 ${JSON.stringify(route)}`);
        assert.equal(route.step, "eat", `${tag} 測試前置：有麥餅時下一步是吃第一餐`);
        await page.waitForFunction(() => { const b = document.querySelector("#questDock [data-early-goal]"); return b && b.textContent.trim() === "吃麥餅"; }, null, { timeout: 8000 });
        await press("#questDock [data-early-goal]");
        await page.waitForFunction(() => { const m = document.querySelector("#worldModal.show"); return m && /農舍灶台/.test(m.textContent) && m.querySelector('[data-eat="rustic_bread"]'); }, null, { timeout: 15000 });
        await idle();
        await press('#worldModal.show [data-eat="rustic_bread"]');
        await page.waitForFunction(() => ((__farm.state().adventure.meals || {}).rustic_bread || 0) === 0, null, { timeout: 15000 });
        assert.equal(await page.evaluate(() => !!__farm.state().adventure.claimed.c1_first_meal), true, `${tag} 吃下麥餅後第一餐任務要完成`);
        assert.deepEqual(errors, [], `${tag} 走回農舍：不可有頁面錯誤`);
        await ctx.close();
        console.log(`OK R75 opening ${tag}：從田邊走回農舍、開灶台、吃下第一餐`);
      }
    }
  } finally { await browser.close(); }
  console.log("VERIFIED R75 opening 1366x768 390x844");
})().catch((error) => { console.error(error); process.exit(1); });
