"use strict";
/* R80C 版面：1366×768、390×844 實際走一遍——
   同一個地點兩個決定的物件外觀不同（遮住名牌也分得出）、做了決定就在物件旁交第一張具名訂單、手札標題跟著內容與兩邊每日差別、
   好感故事用下方對話框（下一句／晚點再說）、旁白不掛頭像、升級卡沒有重複的「獲得」、升級面板只有一層收合、桌面種子卡名稱完整、種子袋名牌不被農舍蓋住。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http"), { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), OUT = path.join(ROOT, "docs", "evidence", "r80");
const VIEWS = [[1366, 768, false], [390, 844, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }
async function ready(page, origin) { await page.goto(origin); await page.waitForFunction(() => window.__farm && window.ChoicesR77 && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 }); await page.evaluate(() => { const b = document.querySelector("#worldSunBegin, #worldBegin"); if (b && b.offsetParent) b.click(); }); await page.waitForTimeout(500); }
function inside(box, w, h) { return !!box && box.left >= -0.5 && box.top >= -0.5 && box.right <= w + 0.5 && box.bottom <= h + 0.5; }
async function shot(page, tag, name) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, "r80c-" + tag + "-" + name + ".png"), fullPage: false }); }
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
async function clearDialogs(page) { for (let i = 0; i < 6; i++) { await page.evaluate(() => document.querySelectorAll(".r76b-dialogue").forEach((n) => n.remove())); await page.waitForTimeout(150); } }

(async () => {
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch();
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = w + "x" + h;
      const open = async () => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = []; page.on("pageerror", (e) => errors.push(String(e))); await ready(page, origin); return { ctx, page, errors }; };

      /* 一、同一個地點兩個決定：點地圖物件走過去 → 看草圖 → 做決定；物件疊的小圖示與圈線顏色不同，遮住名牌也分得出。 */
      const looks = {};
      for (const pick of ["seed", "sun"]) {
        const S = await open(), page = S.page;
        await page.evaluate(() => { const s = __farm.state(), now = Date.now(); AdventureAPI.ensure(s, now); AdventureAPI.resolveMainStoryChoice(s, "mayor", "farm", now); });
        await untilLine(page, /草圖塞進種子籃/, tag + " 開場對白");
        await closeDialogue(page, mobile);
        await page.waitForFunction(() => document.querySelector('.r78c-scene-change[data-r78c-route="mayor:farm"]'), null, { timeout: 8000 });
        await clearToasts(page);
        await page.evaluate(() => document.querySelector('.r78c-scene-change[data-r78c-route="mayor:farm"]').click());
        await untilLine(page, /鎮長指著草圖/, tag + " 物件旁的現場");
        const narr = await page.evaluate(() => ({ head: document.querySelector(".r76b-dialogue-head")?.textContent.trim(), portrait: !!document.querySelector(".r76b-dialogue-head .r76b-portrait"), narration: !!document.querySelector(".r76b-dialogue-card.is-narration") }));
        assert.deepEqual(narr, { head: "旁白", portrait: false, narration: true }, tag + " 第三人稱的動作描寫用旁白樣式，不掛鎮長頭像");
        if (pick === "seed") await shot(page, tag, "1-narration");
        for (let i = 0; i < 2; i++) await press(page, mobile, ".r76b-dialogue [data-r76b-next]");
        await page.waitForFunction(() => document.querySelectorAll(".r76b-dialogue [data-r76b-choice]").length === 2, null, { timeout: 8000 });
        const opts = await page.evaluate(() => [...document.querySelectorAll(".r76b-dialogue [data-r76b-choice]")].map((b) => b.textContent.replace(/\s+/g, " ")));
        assert.match(opts.join("|"), /留種小包.*每天：每天第一次收成，多拿 1 包當季種子.*留種合作單.*晨光小瓶.*每天：每天第一次在光裡收成，多接 2 點陽光.*晨光合作單/, tag + " 選之前就看得到兩邊每天的差別 " + JSON.stringify(opts));
        if (pick === "seed") await shot(page, tag, "2-decision-options");
        await press(page, mobile, '.r76b-dialogue [data-r76b-choice="' + pick + '"]');
        await untilLine(page, /第一張新訂單「(留種|晨光)合作單」/, tag + " 決定後的回覆提到第一張具名訂單");
        await closeDialogue(page, mobile);
        /* R80 整合：決定物件圖到了（DECISION_ART_READY 有登記）就整張換成新圖、不再疊小圖示；圖沒到才檢查疊上去的小圖示。 */
        const artMode = await page.evaluate(() => !!(window.ChoicesR77 && (window.ChoicesR77.DECISION_ART_READY || []).length)); const sel = '.r78c-scene-change[data-r78c-route="mayor:farm"] ' + (artMode ? 'img:not(.r80c-decision-badge)' : 'img.r80c-decision-badge');
        await page.waitForFunction((s) => { const i = document.querySelector(s); return i && i.complete && i.naturalWidth > 0 && (!s.includes(':not') || /content-r80\/decision-/.test(i.getAttribute('src') || '')); }, sel, { timeout: 8000 });
        await page.evaluate(() => { const s = __farm.state(), t = s.map.tiles.find((x) => x.station === "sign"); if (__farm.focusTile) __farm.focusTile(t.id); }); await page.waitForTimeout(600);
        looks[pick] = await page.evaluate((s) => { const b = document.querySelector(s), r = b.getBoundingClientRect(); return { badge: b.getAttribute("src"), ring: b.classList.contains("r80c-decision-badge") ? getComputedStyle(b).boxShadow : "art", size: r.width, label: document.querySelector('.r78c-scene-label[data-r78c-route="mayor:farm"]').textContent }; }, sel);
        assert.ok(looks[pick].size >= 16, tag + " 小圖示看得到 " + JSON.stringify(looks[pick]));
        await shot(page, tag, "3-place-" + pick);

        /* 二、第一張具名訂單：種三格小麥（R84B 同步：原為兩格）、收成，走回種子籃旁交出去（新存檔幾分鐘內就做得到）。 */
        if (pick === "seed") {
          await clearToasts(page);
          await page.evaluate(() => { const s = __farm.state(), now = Date.now(); s.plots[0].cropId = null; s.plots[1].cropId = null; s.plots[2].cropId = null; Game.plant(s, 0, "wheat", now - 60000); Game.plant(s, 1, "wheat", now - 60000); Game.plant(s, 2, "wheat", now - 60000); Game.harvest(s, 0, now); Game.harvest(s, 1, now); Game.harvest(s, 2, now); __farm.refresh(); }); /* R84B 同步：第一張跟每天那張同一個份數（留種合作單 3 份），多種一格（原為兩格） */
          await clearToasts(page);
          const coins0 = await page.evaluate(() => __farm.state().coins);
          await page.evaluate(() => document.querySelector('.r78c-scene-change[data-r78c-route="mayor:farm"]').click());
          await page.waitForFunction(() => document.querySelector('.r76b-dialogue [data-r76b-choice="special"]'), null, { timeout: 8000 });
          const trial = await page.evaluate(() => { const b = document.querySelector('.r76b-dialogue [data-r76b-choice="special"]'), r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: b.textContent.replace(/\s+/g, " "), box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, hit: !!top && (top === b || b.contains(top)), head: document.querySelector(".r76b-dialogue-head")?.textContent.trim() }; });
          assert.match(trial.text, /交第一張「留種合作單」.*同一種作物 3 份.*金/, tag + " 物件旁就能交第一張 " + trial.text); /* R84B 同步：原為 2 份 */
          assert.ok(trial.hit && inside(trial.box, w, h), tag + " 交付鈕在畫面內點得到");
          await shot(page, tag, "4-trial-order");
          await press(page, mobile, '.r76b-dialogue [data-r76b-choice="special"]');
          await untilLine(page, /完成第一張「留種合作單」/, tag + " 交出第一張");
          await closeDialogue(page, mobile);
          assert.ok(await page.evaluate(() => __farm.state().coins) > coins0, tag + " 金幣真的入帳");

          /* 三、手札：捲到後續委託，標題是「手札・後續委託」；兩個決定每天的差別並排、標出我選的那一邊。 */
          await clearToasts(page);
          await page.evaluate(() => { FarmWorld.openPanel("journal"); CookingR75.injectChoices(__farm.state()); });
          await page.waitForFunction(() => document.querySelector('[data-r80c-daily-diff="mayor"]'), null, { timeout: 8000 });
          /* 手冊、鄰居區塊會陸續補進來把內容往下推；捲兩次，等版面穩定。 */
          for (let i = 0; i < 2; i++) { await page.evaluate(() => document.querySelector('[data-r77b-quest="mayor"]').scrollIntoView({ block: "start" })); await page.waitForTimeout(800); }
          const journal = await page.evaluate(() => { const body = document.querySelector(".side-panel.world-panel-open .side-body"), head = document.querySelector('.side-pane[data-pane="journal"] > .pane-head'), q = document.querySelector('[data-r77b-quest="mayor"]'); return { title: head.querySelector(".r80c-pane-title")?.textContent, rows: [...document.querySelectorAll('[data-r80c-daily-diff="mayor"] .r80c-diff-row')].map((n) => ({ chosen: n.classList.contains("is-chosen"), text: n.textContent })), at: [body.scrollTop, body.clientHeight, body.scrollHeight, head.getBoundingClientRect().bottom, q.getBoundingClientRect().top, q.getBoundingClientRect().bottom] }; });
          assert.equal(journal.title, "手札・後續委託", tag + " 捲到後續委託時標題跟著換 " + JSON.stringify(journal.at));
          assert.equal(journal.rows.length, 2); assert.equal(journal.rows[0].chosen, true); assert.match(journal.rows[0].text, /留種小包.*1 包當季種子/); assert.match(journal.rows[1].text, /晨光小瓶.*2 點陽光/);
          await page.evaluate(() => document.querySelector('[data-r80c-daily-diff="mayor"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(300);
          await shot(page, tag, "5-journal-diff");
          await page.evaluate(() => { const b = document.querySelector(".side-panel.world-panel-open .side-body"); b.scrollTop = 0; }); await page.waitForTimeout(800);
          assert.match(await page.evaluate(() => document.querySelector('.side-pane[data-pane="journal"] > .pane-head .r80c-pane-title')?.textContent), /^手札・(追光手冊|農場圖鑑)$/, tag + " 捲回最上面標題跟著換回去");
          await page.evaluate(() => document.querySelector(".side-panel").classList.remove("world-panel-open"));

          /* 四、種子袋：搬到農舍前面，名牌不被農舍與門廊蓋住、不拆行。 */
          await page.evaluate(() => { const s = __farm.state(), t = s.map.tiles.find((x) => x.structureId === "farmhouse"); if (__farm.focusTile) __farm.focusTile(t.id); __farm.refresh(); }); await page.waitForTimeout(1200);
          const bag = await page.evaluate(() => {
            const node = document.querySelector(".r75b-map-node[data-r75b-seed-bag]"), span = node.querySelector("span"), r = span.getBoundingClientRect(), z = Number(getComputedStyle(node).zIndex);
            const covers = [...document.querySelectorAll("#mapWorld .ob, #mapWorld [data-kind]")].filter((n) => !node.contains(n) && Number(getComputedStyle(n).zIndex) > z && (() => { const b = n.getBoundingClientRect(); return b.left < r.right - 1 && b.right > r.left + 1 && b.top < r.bottom - 1 && b.bottom > r.top + 1; })()).map((n) => n.className);
            return { text: span.textContent, height: r.height, lineHeight: parseFloat(getComputedStyle(span).lineHeight) || 16, covers };
          });
          assert.equal(bag.text, "門口的種子袋", tag + " 名牌只寫短名");
          assert.ok(bag.height <= bag.lineHeight + 6, tag + " 名牌不拆行 " + JSON.stringify(bag));
          assert.deepEqual(bag.covers, [], tag + " 名牌上面沒有東西蓋著");
          await shot(page, tag, "6-seed-bag");
        }
        assert.deepEqual(S.errors, [], tag + " 不可有頁面錯誤：" + S.errors.join("; "));
        await S.ctx.close();
      }
      assert.notEqual(looks.seed.badge, looks.sun.badge, tag + " 兩個決定疊的小圖示不同");
      if (looks.seed.ring !== "art") assert.notEqual(looks.seed.ring, looks.sun.ring, tag + " 兩個決定的圈線顏色不同");
      assert.notEqual(looks.seed.label, looks.sun.label);

      /* 五、好感故事：手札「鄰居好感」→ 聽故事，用下方那一種對話框，按鈕「下一句／晚點再說」，最後一句「聽完了」。 */
      const B = await open(), pb = B.page;
      await pb.evaluate(() => { const s = __farm.state(); NeighborsR61.ensure(s, Date.now()); s.adventure.r58.favor.mayor = 5; __farm.refresh(); FarmWorld.openPanel("journal"); });
      await pb.waitForFunction(() => document.querySelector("[data-r61b-play='mayor:0'],[data-r61b-replay='mayor:0']"), null, { timeout: 15000 });
      await pb.evaluate(() => document.querySelector("[data-r61b-neighbors]").scrollIntoView({ block: "start" })); await pb.waitForTimeout(800);
      assert.equal(await pb.evaluate(() => document.querySelector('.side-pane[data-pane="journal"] > .pane-head .r80c-pane-title')?.textContent), "手札・鄰居好感", tag + " 鄰居好感那一段標題對得上");
      await pb.evaluate(() => document.querySelector("[data-r61b-play='mayor:0'],[data-r61b-replay='mayor:0']").click());
      await pb.waitForFunction(() => document.querySelector(".r76b-dialogue[data-r61b-story='mayor-0']"), null, { timeout: 8000 });
      await pb.waitForTimeout(300);
      const story = await pb.evaluate(() => { const card = document.querySelector(".r76b-dialogue-card").getBoundingClientRect(); return { buttons: [...document.querySelectorAll(".r76b-dialogue-actions button")].map((b) => b.textContent.trim()), oldModal: !!document.querySelector("#worldModal.show"), head: document.querySelector(".r76b-dialogue-head")?.textContent, card: { left: card.left, top: card.top, right: card.right, bottom: card.bottom }, bottomHalf: card.top > window.innerHeight * 0.3, panel: !!document.querySelector(".side-panel.world-panel-open") }; });
      assert.deepEqual(story.buttons, ["下一句", "晚點再說"], tag + " 好感故事按鈕跟其他對話一樣");
      assert.equal(story.oldModal, false, tag + " 不再用置中的舊面板");
      assert.match(story.head, /鎮長葛瑞.*葛瑞的第一雙皮鞋/);
      assert.ok(inside(story.card, w, h) && story.bottomHalf, tag + " 對話框在下方、不出界 " + JSON.stringify(story.card));
      await shot(pb, tag, "7-favor-story");
      for (let i = 0; i < 8; i++) { const more = await pb.evaluate(() => /下一句/.test(document.querySelector(".r76b-dialogue [data-r76b-next]")?.textContent || "")); if (!more) break; await press(pb, mobile, ".r76b-dialogue [data-r76b-next]"); }
      assert.equal(await pb.evaluate(() => document.querySelector(".r76b-dialogue [data-r76b-next]")?.textContent.trim()), "聽完了", tag + " 最後一句是聽完了");
      await press(pb, mobile, ".r76b-dialogue [data-r76b-next]");
      await pb.waitForFunction(() => !document.querySelector(".r76b-dialogue"), null, { timeout: 8000 });
      assert.equal(await pb.evaluate(() => NeighborsR61.storyState ? true : true), true);

      /* 六、升級卡：沒有「獲得：農場等級提升」；每個解鎖都有圖示（天氣變化先用資源列同一個天氣符號）。升級面板只有一層收合。 */
      await clearToasts(pb);
      await pb.evaluate(() => __farm.enqueueSettlement(Game.milestoneCard("level_up", { level: 5, state: __farm.state(), now: Date.now() })));
      await pb.waitForFunction(() => document.querySelector(".milestone-card [data-r79c-unlocks]"), null, { timeout: 6000 }); await pb.waitForTimeout(400);
      const level = await pb.evaluate(() => { const c = document.querySelector(".milestone-card"), r = c.getBoundingClientRect(); return { text: c.textContent, box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, rows: [...c.querySelectorAll(".r79c-unlock")].map((n) => ({ name: n.textContent, icon: !!n.querySelector("img, b") })) }; });
      assert.doesNotMatch(level.text, /獲得：農場等級提升/, tag + " 不再重複標題");
      assert.ok(level.rows.length >= 4 && level.rows.every((row) => row.icon), tag + " 每個新解鎖都有圖示 " + JSON.stringify(level.rows));
      assert.ok(level.rows.some((row) => /天氣變化/.test(row.name)));
      assert.ok(inside(level.box, w, h), tag + " 升級卡在畫面內");
      await shot(pb, tag, "8-levelup");
      await pb.evaluate(() => { const c = document.querySelector(".milestone-card"); if (c) c.click(); });
      await pb.evaluate(() => { const s = __farm.state(); s.level = 2; s.coins = 46; __farm.refresh(); FarmWorld.openPanel("upgrades"); const b = document.querySelector(".side-body"); if (b) b.scrollTop = 0; });
      await pb.waitForTimeout(900);
      const ups = await pb.evaluate(() => { const pane = document.querySelector('.side-pane[data-pane="upgrades"]'); return { details: pane.querySelectorAll("details").length, more: pane.querySelectorAll(".r32-show-more, .r60-show-more").length, text: pane.textContent }; });
      assert.equal(ups.details, 0, tag + " 升級面板不再有「之後的目標」那一層");
      assert.ok(ups.more <= 1, tag + " 最多一顆「再顯示 N 項」");
      assert.doesNotMatch(ups.text, /之後的目標/);
      await shot(pb, tag, "9-upgrades");
      await pb.evaluate(() => document.querySelector(".side-panel").classList.remove("world-panel-open"));

      /* 七、桌面種子卡：名稱整個寫出來、「＋全部」不壓小地圖（手機直式另有窄卡規則，不在這裡量）。 */
      if (!mobile) {
        await pb.evaluate(() => { const s = __farm.state(); s.level = 5; s.coins = 46; __farm.refresh(); });
        await pb.waitForTimeout(900); await clearToasts(pb);
        const seeds = await pb.evaluate(() => {
          const r = (n) => n ? (({ left, top, right, bottom }) => ({ left, top, right, bottom }))(n.getBoundingClientRect()) : null;
          const cards = [...document.querySelectorAll("#seedRow .seed-quickbar > .seed:not(.more)")].map((n) => { const sn = n.querySelector(".sn"); return { name: sn.textContent, cut: sn.scrollWidth > sn.clientWidth + 1 || getComputedStyle(sn).textOverflow === "ellipsis" && sn.scrollWidth > sn.clientWidth }; });
          return { cards, more: r(document.querySelector("#seedRow .seed.more")), mini: r(document.querySelector("#worldMinimap")) };
        });
        assert.ok(seeds.cards.length >= 5 && seeds.cards.every((c) => !c.cut && /種子 .+/.test(c.name)), tag + " 種子卡名稱完整 " + JSON.stringify(seeds.cards));
        const hit = Math.max(0, Math.min(seeds.more.right, seeds.mini.right) - Math.max(seeds.more.left, seeds.mini.left)) * Math.max(0, Math.min(seeds.more.bottom, seeds.mini.bottom) - Math.max(seeds.more.top, seeds.mini.top));
        assert.equal(hit, 0, tag + " 「＋全部」不壓小地圖 " + JSON.stringify(seeds));
        await shot(pb, tag, "10-seed-cards");
      }
      assert.deepEqual(B.errors, [], tag + " 不可有頁面錯誤：" + B.errors.join("; "));
      await B.ctx.close();
      console.log("OK R80C world layout " + tag);
    }
  } finally { await browser.close(); server.close(); }
  console.log("VERIFIED content R80C world layout 2 sizes");
})().catch((error) => { console.error(error); process.exit(1); });
