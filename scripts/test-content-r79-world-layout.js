"use strict";
/* R79C 版面：1366×768、390×844 實際走一遍——
   手札「帶我去」走到地圖物件旁、在物件旁做決定、走到鄰居旁交東西、完成後物件旁每天的互動與具名新訂單；
   兩種選擇同一個地點名牌不同；招牌只剩一塊名牌；手札頂端標題與關閉鈕固定；升級卡逐項列出解鎖；
   升級面板第一屏三個目標；鎮長只有一種對話框的樣子；晨霧不是水平白條。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), OUT = path.join(ROOT, "docs", "evidence", "r79");
const VIEWS = [[1366, 768, false], [390, 844, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
async function ready(page, origin) { await page.goto(origin); await page.waitForFunction(() => window.__farm && window.ChoicesR77 && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 }); await page.evaluate(() => { const b = document.querySelector("#worldSunBegin, #worldBegin"); if (b && b.offsetParent) b.click(); }); await page.waitForTimeout(500); }
function inside(box, w, h) { return !!box && box.left >= -0.5 && box.top >= -0.5 && box.right <= w + 0.5 && box.bottom <= h + 0.5; }
async function shot(page, tag, name) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, "r79c-" + tag + "-" + name + ".png"), fullPage: false }); }
/* 把擋在前面、不是要找的那句對白一句句點掉（例如回訪對話），直到出現要找的那句。 */
async function untilLine(page, pattern, label) {
  for (let i = 0; i < 40; i++) {
    const text = await page.evaluate(() => document.querySelector(".r76b-dialogue .r76b-dialogue-line")?.textContent || "");
    if (pattern.test(text)) return text;
    if (text) await page.evaluate(() => { const b = document.querySelector(".r76b-dialogue [data-r76b-next]") || document.querySelector(".r76b-dialogue [data-r76b-later]"); if (b) b.click(); });
    await page.waitForTimeout(250);
  }
  throw new Error(label + "：等不到對白 " + pattern);
}
const press = (page, mobile, sel) => mobile ? page.locator(sel).first().tap({ timeout: 8000 }) : page.locator(sel).first().click({ timeout: 8000 });
async function closeDialogue(page, mobile) { if (await page.locator(".r76b-dialogue [data-r76b-next]").count()) await press(page, mobile, ".r76b-dialogue [data-r76b-next]"); await page.waitForFunction(() => !document.querySelector(".r76b-dialogue"), null, { timeout: 8000 }); }
async function clearToasts(page) { await page.waitForFunction(() => !document.querySelector("#toast-zone > *"), null, { timeout: 9000 }).catch(() => page.evaluate(() => { const z = document.querySelector("#toast-zone"); if (z) z.innerHTML = ""; })); }
async function choicesBox(page) {
  return page.evaluate(() => [...document.querySelectorAll(".r76b-dialogue [data-r76b-choice]")].map((b) => {
    const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { id: b.dataset.r76bChoice, text: b.textContent.replace(/\s+/g, " ").trim(), left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, hit: !!top && (top === b || b.contains(top)), smalls: [...b.querySelectorAll("small")].map((n) => n.textContent.trim()) };
  }));
}
async function walkToRoute(page, route) {
  await page.evaluate((key) => { const n = document.querySelector('.r78c-scene-change[data-r78c-route="' + key + '"]'); if (!n) throw new Error("地圖上找不到 " + key); n.click(); }, route);
}

(async () => {
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = w + "x" + h;
      const open = async () => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = []; page.on("pageerror", (e) => errors.push(String(e))); await ready(page, origin); return { ctx, page, errors }; };
      const labelsOf = (page, route) => page.evaluate((key) => [...document.querySelectorAll('.r78c-scene-label[data-r78c-route="' + key + '"]')].map((n) => { const r = n.getBoundingClientRect(), cs = getComputedStyle(n); return { text: n.textContent, height: r.height, lineHeight: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4, decision: n.dataset.r79cDecision || "" }; }), route);

      /* 一、選「我先去種田」：手札按「帶我去」→ 走到告示牌旁的晨耕種子籃 → 看草圖 → 在物件旁選「留種小包」。 */
      const A1 = await open(), page = A1.page;
      await page.evaluate(() => { const s = __farm.state(), now = Date.now(); AdventureAPI.ensure(s, now); AdventureAPI.resolveMainStoryChoice(s, "mayor", "farm", now); });
      await untilLine(page, /草圖塞進種子籃/, tag + " 開場對白");
      await closeDialogue(page, mobile);
      await page.waitForFunction(() => [...document.querySelectorAll(".r78c-scene-label")].some((n) => n.textContent === "晨耕種子籃"), null, { timeout: 8000 });
      await clearToasts(page);
      await page.evaluate(() => { FarmWorld.openPanel("journal"); CookingR75.injectChoices(__farm.state()); });
      await page.waitForFunction(() => document.querySelector('[data-r77b-quest="mayor"] [data-r79c-go="mayor"]'), null, { timeout: 8000 });
      const card = await page.evaluate(() => { const box = document.querySelector('[data-r77b-quest="mayor"]'); return { buttons: [...box.querySelectorAll("button")].map((b) => b.dataset.r79cGo ? "go" : b.textContent.trim()), unlock: box.querySelector("[data-r79c-unlock]")?.textContent || "" }; });
      assert.deepEqual(card.buttons, ["go"], tag + " 手札只有「帶我去」");
      assert.match(card.unlock, /留種合作單.*晨光合作單/, tag + " 手札寫出兩種選擇各解鎖什麼");
      await page.evaluate(() => document.querySelector('[data-r77b-quest="mayor"] [data-r79c-go="mayor"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(120);
      await press(page, mobile, '[data-r77b-quest="mayor"] [data-r79c-go="mayor"]');
      await untilLine(page, /鎮長指著草圖/, tag + " 物件旁的現場");
      assert.equal(await page.evaluate(() => !!document.querySelector(".side-panel.world-panel-open")), false, tag + " 帶我去之後手札收起來");
      const near = await page.evaluate(() => { const s = __farm.state(), p = s.map.tiles.find((t) => t.id === s.player.tileId), sign = s.map.tiles.find((t) => t.station === "sign"); return Math.abs(p.x - sign.x) + Math.abs(p.y - sign.y); });
      assert.ok(near <= 2, tag + " 主角真的走到了告示牌旁（距離 " + near + " 格）");
      for (let i = 0; i < 2; i++) await press(page, mobile, ".r76b-dialogue [data-r76b-next]");
      await page.waitForFunction(() => document.querySelectorAll(".r76b-dialogue [data-r76b-choice]").length === 2, null, { timeout: 8000 });
      const decide = await choicesBox(page);
      for (const c of decide) {
        assert.ok(c.width >= 44 && c.height >= 44 && inside(c, w, h) && c.hit, tag + " 決定選項在畫面內、點得到 " + JSON.stringify(c));
        assert.ok(c.smalls.length === 2 && c.smalls.every(Boolean), tag + " 每個選項都寫馬上拿到與之後解鎖");
      }
      assert.match(decide.map((c) => c.text).join("|"), /留種小包.*留種合作單.*晨光小瓶.*晨光合作單/, tag + " 選項寫出各自解鎖的具名訂單");
      assert.deepEqual(await page.evaluate(() => ({ folded: document.querySelector("#questDock").classList.contains("r78b-folded"), seed: getComputedStyle(document.querySelector("#mapScene .seed-hud")).visibility })), { folded: true, seed: "hidden" }, tag + " 對話時任務卡收成一列、種子卡收起來");
      await shot(page, tag, "1-marker-decision");
      await press(page, mobile, '.r76b-dialogue [data-r76b-choice="seed"]');
      await untilLine(page, /名牌換成「晨耕種子籃・留種小包」/, tag + " 決定後的回覆");
      await closeDialogue(page, mobile);
      await page.waitForFunction(() => [...document.querySelectorAll(".r78c-scene-label")].some((n) => n.textContent === "晨耕種子籃・留種小包"), null, { timeout: 8000 });
      const seedLabels = await labelsOf(page, "mayor:farm");
      assert.equal(seedLabels.length, 1, tag + " 同一個物件只有一塊名牌");
      assert.ok(seedLabels[0].height <= seedLabels[0].lineHeight + 8, tag + " 名牌不拆行 " + JSON.stringify(seedLabels[0]));
      await page.evaluate(() => { const s = __farm.state(), t = s.map.tiles.find((x) => x.station === "sign"); if (__farm.focusTile) __farm.focusTile(t.id); }); await page.waitForTimeout(500);
      await shot(page, tag, "2-place-seed");

      /* 二、走到鎮長旁邊交乾貨（第三步在鄰居旁做）。 */
      await clearToasts(page);
      await page.evaluate(() => { __farm.state().storage.items.sun_wheat = 1; FarmWorld.openPanel("journal"); CookingR75.injectChoices(__farm.state()); });
      await page.waitForFunction(() => document.querySelector('[data-r77b-quest="mayor"] [data-r77b-step="3"].is-current [data-r79c-go="mayor"]'), null, { timeout: 8000 });
      await page.evaluate(() => document.querySelector('[data-r77b-quest="mayor"] [data-r79c-go="mayor"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(120);
      await press(page, mobile, '[data-r77b-quest="mayor"] [data-r79c-go="mayor"]');
      await untilLine(page, /乾貨帶來了嗎/, tag + " 鎮長開口要乾貨");
      const give = await choicesBox(page);
      assert.equal(give.length, 1); assert.ok(give[0].hit && inside(give[0], w, h), tag + " 交付鈕點得到");
      assert.match(give[0].text, /把乾貨交給鎮長.*日曬乾貨 1\/1/);
      assert.equal(await page.evaluate(() => !!document.querySelector("#worldDialogue:not([hidden])")), false, tag + " 同時只有一個對話框");
      await shot(page, tag, "3-npc-give");
      await press(page, mobile, '.r76b-dialogue [data-r76b-choice="give"]');
      await untilLine(page, /曬得透/, tag + " 鎮長道謝");
      await closeDialogue(page, mobile);
      await page.waitForFunction(() => /三步都完成了/.test(document.querySelector("#toast-zone")?.textContent || ""), null, { timeout: 8000 });
      assert.equal(await page.evaluate(() => ChoicesR77.questView(__farm.state(), "mayor", Date.now()).status), "done");

      /* 三、做完以後：點地圖上的種子籃走過去，每天一句對白＋每天的互動＋具名的新訂單。 */
      await clearToasts(page);
      await walkToRoute(page, "mayor:farm");
      const todayLine = await page.evaluate(() => ChoicesR77.dailyLine(__farm.state(), "mayor", Date.now()));
      await untilLine(page, new RegExp(todayLine.slice(0, 8).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), tag + " 物件旁今天的對白");
      const menu = await choicesBox(page);
      assert.ok(menu.some((c) => /翻今天的晨耕種子籃/.test(c.text)) && menu.some((c) => /新訂單「留種合作單」/.test(c.text)), tag + " 物件旁列出每天的互動與具名新訂單 " + JSON.stringify(menu.map((c) => c.text)));
      for (const c of menu) assert.ok(c.hit && inside(c, w, h) && c.height >= 44, tag + " 選項在畫面內 " + JSON.stringify(c));
      await shot(page, tag, "4-marker-menu");
      await press(page, mobile, '.r76b-dialogue [data-r76b-choice="daily"]');
      await untilLine(page, /當季種子與 1 點陽光/, tag + " 翻種子籃的結果");
      await closeDialogue(page, mobile);

      /* 四、手札頂端：捲到底，標題與關閉鈕還在上緣、點得到。 */
      await clearToasts(page);
      await page.evaluate(() => { FarmWorld.openPanel("journal"); CookingR75.injectChoices(__farm.state()); const b = document.querySelector(".side-panel.world-panel-open .side-body"); b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(250);
      const head = await page.evaluate(() => {
        const body = document.querySelector(".side-panel.world-panel-open .side-body"), head = body.querySelector(".side-pane.sel > .pane-head"), close = head && head.querySelector(".world-close");
        const br = body.getBoundingClientRect(), hr = head.getBoundingClientRect(), cr = close.getBoundingClientRect(), top = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
        return { scrolled: body.scrollTop, bodyTop: br.top, headTop: hr.top, headBottom: hr.bottom, closeHit: !!top && (top === close || close.contains(top)), title: head.textContent.replace(/\s+/g, " ").trim(), headBg: getComputedStyle(head).backgroundColor };
      });
      assert.ok(head.scrolled > 40, tag + " 手札真的捲下去了");
      assert.ok(head.headTop >= head.bodyTop - 1 && head.headTop <= head.bodyTop + 20, tag + " 標題固定在面板上緣 " + JSON.stringify(head));
      assert.equal(head.closeHit, true, tag + " 關閉鈕點得到");
      assert.ok(head.headBg === "rgba(0, 0, 0, 0)" || head.headBg === "transparent", tag + " 標題本身維持透明底");
      await shot(page, tag, "5-journal-top");
      await press(page, mobile, ".side-panel.world-panel-open .side-pane.sel > .pane-head .world-close");
      await page.waitForFunction(() => !document.querySelector(".side-panel.world-panel-open"), null, { timeout: 4000 });

      /* 五、升級卡逐項列出解鎖（名字＋圖示）；升級面板第一屏三個目標。 */
      await clearToasts(page);
      await page.evaluate(() => __farm.enqueueSettlement(Game.milestoneCard("level_up", { level: 5, state: __farm.state(), now: Date.now() })));
      await page.waitForFunction(() => { const imgs = [...document.querySelectorAll(".milestone-card [data-r79c-unlocks] img")]; return imgs.length && imgs.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 6000 });
      await page.waitForTimeout(350);
      await shot(page, tag, "6-levelup");
      const level = await page.evaluate(() => { const c = document.querySelector(".milestone-card"), r = c.getBoundingClientRect(); return { box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, names: [...c.querySelectorAll(".r79c-unlock")].map((n) => [...n.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join("").trim()), icons: c.querySelectorAll(".r79c-unlock img").length, text: c.textContent }; });
      assert.ok(inside(level.box, w, h), tag + " 升級卡在畫面內");
      assert.ok(level.names.includes("南瓜種子") && level.names.includes("畜舍") && level.icons >= 3, tag + " 升級卡列出作物與設施名字與圖示 " + JSON.stringify(level.names));
      assert.doesNotMatch(level.text, /新的作物與農場能力/);
      await page.evaluate(() => { const c = document.querySelector(".milestone-card"); if (c) c.click(); });
      await page.evaluate(() => { FarmWorld.openPanel("upgrades"); const b = document.querySelector(".side-body"); if (b) b.scrollTop = 0; }); await page.waitForTimeout(400);
      const ups = await page.evaluate(() => {
        const body = document.querySelector(".side-panel.world-panel-open .side-body"), br = body.getBoundingClientRect();
        const cards = [...document.querySelectorAll("#upgrades > .up")].filter((n) => !n.classList.contains("r32-panel-hidden") && n.getBoundingClientRect().height > 0);
        return { count: cards.length, inFirst: cards.filter((n) => { const r = n.getBoundingClientRect(); return r.top >= br.top - 1 && r.bottom <= br.bottom + 1; }).length, effects: cards.map((n) => (n.querySelector(".u-desc")?.textContent || "").trim()) };
      });
      assert.ok(ups.count >= 3 && ups.inFirst >= 3, tag + " 升級面板第一屏就有三個目標 " + JSON.stringify(ups));
      assert.ok(ups.effects.slice(0, 3).every((t) => t.length > 4), tag + " 每個目標都寫效果");
      await shot(page, tag, "7-upgrades");
      await page.evaluate(() => document.querySelector(".side-panel").classList.remove("world-panel-open"));

      /* 六、鎮長對話：名字一律「鎮長葛瑞」、戴禮帽那張頭像、按鈕黃色主要鈕。 */
      await clearToasts(page);
      await page.evaluate(() => FarmWorld.speak("葛瑞", "收成先留一籃，別全拿去賣。"));
      await page.waitForFunction(() => { const d = document.querySelector("#worldDialogue"); return d && !d.hidden && getComputedStyle(d).display !== "none"; }, null, { timeout: 9000 });
      const mayor = await page.evaluate(() => { const d = document.querySelector("#worldDialogue"), img = d.querySelector(".dialogue-portrait"), btn = d.querySelector(".dialogue-continue"); return { name: d.querySelector("b").textContent, img: img ? img.getAttribute("src") : "", bg: getComputedStyle(btn).backgroundColor, cardBg: getComputedStyle(d).backgroundColor }; });
      assert.equal(mayor.name, "鎮長葛瑞", tag + " 名字一律寫全");
      assert.match(mayor.img, /content-r77\/portrait-mayor\.png/, tag + " 頭像跟下方對話框同一張");
      assert.equal(mayor.bg, "rgb(255, 217, 120)", tag + " 繼續鈕是黃色主要鈕");
      assert.equal(mayor.cardBg, "rgb(255, 248, 232)", tag + " 對話框跟下方那一種同一個底色");
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#mapScene .seed-hud")).visibility), "hidden", tag + " 鎮長說話時種子卡收起來（任務卡沿用收成一行）");
      await shot(page, tag, "8-mayor-speak");
      await page.evaluate(() => { const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true; });

      /* 七、晨霧：不是水平白條，邊緣淡、中間透。 */
      await page.evaluate(() => { const s = __farm.state(); s.level = Math.max(5, s.level || 1); s.weather = { id: "fog", untilMs: Date.now() + 999999 }; __farm.refresh(); });
      await page.waitForFunction(() => document.querySelector("#weatherLayer.fog"), null, { timeout: 8000 });
      await page.waitForTimeout(700);
      const fog = await page.evaluate(() => { const l = document.querySelector("#weatherLayer"); return { before: getComputedStyle(l, "::before").backgroundImage, after: getComputedStyle(l, "::after").backgroundImage }; });
      assert.doesNotMatch(fog.before + fog.after, /repeating-linear-gradient/, tag + " 晨霧不再是一條條水平白線");
      assert.match(fog.before, /radial-gradient/); assert.match(fog.after, /radial-gradient/);
      await shot(page, tag, "9-fog");
      assert.deepEqual(A1.errors, [], tag + " 不可有頁面錯誤：" + A1.errors.join("; "));
      await A1.ctx.close();

      /* 八、同一個地點、另一種選擇：選「晨光小瓶」，名牌與底座跟「留種小包」不同；招牌做完地圖上只剩一塊名牌。 */
      const B = await open(), pb = B.page;
      await pb.evaluate(() => { const s = __farm.state(), now = Date.now(); AdventureAPI.ensure(s, now); AdventureAPI.resolveMainStoryChoice(s, "mayor", "farm", now); });
      await untilLine(pb, /草圖塞進種子籃/, tag + " 開場對白（第二種）");
      await closeDialogue(pb, mobile);
      await pb.waitForFunction(() => document.querySelector('.r78c-scene-change[data-r78c-route="mayor:farm"]'), null, { timeout: 8000 });
      await clearToasts(pb);
      await walkToRoute(pb, "mayor:farm");
      await untilLine(pb, /鎮長指著草圖/, tag + " 點地圖物件走過去");
      for (let i = 0; i < 2; i++) await press(pb, mobile, ".r76b-dialogue [data-r76b-next]");
      await pb.waitForFunction(() => document.querySelectorAll(".r76b-dialogue [data-r76b-choice]").length === 2, null, { timeout: 8000 });
      await press(pb, mobile, '.r76b-dialogue [data-r76b-choice="sun"]');
      await untilLine(pb, /晨耕種子籃・晨光小瓶/, tag + " 另一種決定的回覆");
      await closeDialogue(pb, mobile);
      await pb.waitForFunction(() => [...document.querySelectorAll(".r78c-scene-label")].some((n) => n.textContent === "晨耕種子籃・晨光小瓶"), null, { timeout: 8000 });
      const sunLabels = await labelsOf(pb, "mayor:farm");
      assert.equal(sunLabels.length, 1);
      assert.notEqual(sunLabels[0].text, seedLabels[0].text, tag + " 兩種選擇同一個地點名牌不同");
      assert.notEqual(sunLabels[0].decision, seedLabels[0].decision, tag + " 兩種選擇的物件標記不同");
      const bases = await pb.evaluate(() => { const n = document.querySelector('.r78c-scene-change[data-r78c-route="mayor:farm"]'); return getComputedStyle(n, "::before").backgroundColor; });
      assert.equal(bases, "rgba(40, 92, 120, 0.45)", tag + " 晨光小瓶的底座換色（新圖到之前的區分）");
      await pb.evaluate(() => { const s = __farm.state(), t = s.map.tiles.find((x) => x.station === "sign"); if (__farm.focusTile) __farm.focusTile(t.id); }); await pb.waitForTimeout(500);
      await shot(pb, tag, "10-place-sun");
      await pb.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        s.adventure.claimed.c1_homecoming = true; AdventureAPI.ensure(s, now);
        AdventureAPI.resolveMainStoryChoice(s, "merchant", "sign", now);
        document.querySelectorAll(".r76b-dialogue").forEach((n) => n.remove());
        ChoicesR77.act(s, "merchant", now + 1); s.materials.wood = 2; ChoicesR77.act(s, "merchant", now + 2); ChoicesR77.act(s, "merchant", now + 3, "red");
        CookingR75.ensure(s, now); FarmWorld.refresh(s); __farm.refresh();
      });
      for (let i = 0; i < 4; i++) { await pb.waitForTimeout(200); await pb.evaluate(() => document.querySelectorAll(".r76b-dialogue").forEach((n) => n.remove())); }
      await pb.waitForFunction(() => { const n = document.querySelector('.r75b-map-node[data-r75b-sign]'); return n && /莓果紅/.test(n.getAttribute("aria-label") || ""); }, null, { timeout: 8000 });
      await pb.waitForTimeout(800);
      const sign = await pb.evaluate(() => ({ nodes: document.querySelectorAll(".r75b-map-node[data-r75b-sign]").length, routeLabels: document.querySelectorAll('.r78c-scene-label[data-r78c-route^="merchant:"]').length, texts: [...document.querySelectorAll(".r78c-scene-label, .r75b-map-node span")].map((n) => n.textContent).filter((t) => /農場招牌/.test(t)) }));
      assert.equal(sign.nodes, 1); assert.equal(sign.routeLabels, 0, tag + " 招牌做完不再另畫一塊名牌");
      assert.deepEqual(sign.texts, ["農場招牌（莓果紅）"], tag + " 地圖上只有一個農場招牌名牌");
      assert.deepEqual(B.errors, [], tag + " 不可有頁面錯誤：" + B.errors.join("; "));
      await B.ctx.close();
      console.log("OK R79C world layout " + tag);
    }
  } finally { await browser.close(); server.close(); }
  console.log("VERIFIED content R79C world layout 2 sizes");
})().catch((error) => { console.error(error); process.exit(1); });
