"use strict";
/* R76C 版面：四種尺寸下，追光手冊的入口與內容都點得到、不出界、不互相蓋住，集章小卡不擋任務卡、工具列與料理成果卡。
   平常不存截圖；要看畫面時設環境變數 R76C_SHOTS 指到一個資料夾。 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."), PORT = 5183, ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.R76C_SHOTS || "";
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const TOTAL = 22;

function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, ORIGIN), f = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname)));
      if (path.relative(ROOT, f).startsWith("..") || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(f).pipe(res);
    });
    server.once("error", reject); server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}
async function launch() {
  const opts = { headless: true, args: ["--no-sandbox"] };
  try { return await chromium.launch(opts); } catch (_) { /* 換本機瀏覽器再試 */ }
  for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) {
    if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) { /* 再試下一個 */ }
  }
  throw Error("找不到可用瀏覽器");
}
async function ready(page) {
  await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
  await page.evaluate(() => { const b = document.querySelector("#worldBegin"); if (b) b.click(); });
}
async function shot(page, tag, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${tag.replace("×", "x")}-${name}.png`) });
}
/* 在頁面裡量位置：每個選擇器取第一個看得到的元素；hit 表示元素正中央真的點得到它（沒被別的東西蓋住）。 */
function measure(page, selectors) {
  return page.evaluate((list) => {
    const out = {};
    for (const [key, selector] of Object.entries(list)) {
      const node = [...document.querySelectorAll(selector)].find((n) => {
        const cs = getComputedStyle(n), r = n.getBoundingClientRect();
        return !n.hidden && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
      });
      if (!node) { out[key] = null; continue; }
      const r = node.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out[key] = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, hit: !!top && (node === top || node.contains(top)),
        text: node.textContent.replace(/\s+/g, " ").trim(), clipX: node.scrollWidth - node.clientWidth, clipY: node.scrollHeight - node.clientHeight };
    }
    return out;
  }, selectors);
}
function overlap(a, b) {
  if (!a || !b) return 0;
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0.5 && h > 0.5 ? Math.round(w * h) : 0;
}
function inside(box, w, h) { return !!box && box.left >= -0.5 && box.top >= -0.5 && box.right <= w + 0.5 && box.bottom <= h + 0.5; }
const cardShown = () => { const n = document.querySelector("#r76cStampCard"); return !!n && !n.hidden; };
const cardHidden = () => { const n = document.querySelector("#r76cStampCard"); return !n || n.hidden; };
const AROUND = { header: "header", quest: "#questDock", seed: "#seedHud", chip: "#sunChip", place: "#worldLocation", dock: "#farmDock", pad: "#mobileControls .dpad", act: "#actionA", toast: "#toast-zone > *", panel: ".side-panel.world-panel-open .side-body", result: "[data-r76a-cook-result]" };

/* 小卡的共同檢查：在畫面裡、不蓋住任務卡、陽光標籤、地點標籤與上下工具列、內容沒被裁掉、按鈕夠大而且點得到。 */
async function checkCard(page, tag, w, h, label, wantOpenButton) {
  /* 等兩格畫面再量：量到的是玩家真的看到的那一格，不是版面正在挪動的瞬間。
     量測是另一次呼叫，有時會落在兩格之間：任務卡剛被別的計時器往下推、小卡要到下一格才跟著讓開（實測這種狀態只有 3～7 毫秒，還沒畫到螢幕上）。
     所以量到重疊時等下一格再量一次；連續三次都疊著才算真的蓋住，規則本身（重疊 0）沒有變。 */
  const NEAR = ["header", "quest", "seed", "chip", "place", "dock", "pad", "act", "toast"];
  let m = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    m = await measure(page, Object.assign({ card: "#r76cStampCard", main: "[data-r76c-card-close]", open: "[data-r76c-card-open]" }, AROUND));
    /* R84 整合同步：R84B「一次只有一層」讓別的主要層（例如祖母寄來的信）剛好跳出時，小卡先讓位、稍後再出來；量到看不到時等它回來再量，
       規則本身（小卡要看得到、重疊 0）不變。 */
    if (!m.card && attempt < 2) { await page.waitForFunction(() => { const c = document.querySelector("#r76cStampCard"); return !!c && !c.hidden && c.getBoundingClientRect().width > 0; }, null, { timeout: 4000 }).catch(() => {}); continue; }
    if (!m.card || NEAR.every((key) => overlap(m.card, m[key]) === 0)) break;
  }
  assert.ok(m.card, `${tag} ${label}：小卡看得到`);
  assert.ok(inside(m.card, w, h), `${tag} ${label}：小卡不出界 ${JSON.stringify(m.card)}`);
  for (const key of NEAR) assert.equal(overlap(m.card, m[key]), 0, `${tag} ${label}：小卡不蓋住 ${AROUND[key]}`);
  if (m.panel && m.panel.left - m.card.width >= 24) assert.equal(overlap(m.card, m.panel), 0, `${tag} ${label}：面板左邊放得下時，小卡不蓋住面板`);
  assert.ok(m.card.clipY <= 1 && m.card.clipX <= 1, `${tag} ${label}：小卡內容沒被裁掉 ${JSON.stringify(m.card)}`);
  assert.ok(m.main && m.main.width >= 44 && m.main.height >= 44 && m.main.hit, `${tag} ${label}：小卡點得掉，命中區至少 44px`);
  assert.equal(!!m.open, wantOpenButton, `${tag} ${label}：「打開手冊」鈕${wantOpenButton ? "要有" : "不該出現"}`);
  if (m.open) assert.ok(m.open.width >= 44 && m.open.height >= 44 && m.open.hit, `${tag} ${label}：「打開手冊」點得到，命中區至少 44px`);
  return m;
}

(async () => {
  const server = await serve(), browser = await launch();
  try {
    for (const [w, h, touch] of VIEWS) {
      const tag = `${w}×${h}`, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(ORIGIN); await ready(page);
      await page.evaluate(() => {
        const s = __farm.state(), now = Date.now();
        AdventureAPI.ensure(s, now); s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, now);
        s.level = 5; s.xp = CONFIG.xpForLevel(5); s.coins = 500; s.upgrades.plotCount = 1; s.storage.items = { wheat: 8 }; s.storage.quality = {};
        delete s.sunbook; FarmSunplay.normalize(s); FarmSunbook.normalize(s); s.sunbook.folded = true; /* R78C 預設展開；這支舊測試另外保留「玩家手動收合後再展開」的驗收 */
        /* 這份存檔當成已經看過「第一道陽光」的教學：不然鎮長那句對白會在載入後十幾秒自己跳出來，
           對白開著時右上角的提示會先等它，領獎那句提示就量不到。這裡只測手冊版面，不測那段教學。 */
        s.sun.introduced = true;
        __farm.refresh(); FarmWorld.refresh(s);
      });
      assert.equal(await page.evaluate(() => typeof FarmSunbook === "object" && FarmSunplay.__r76cSunbook === true && CookingR75.__r76cSunbook === true), true, `${tag} 手冊有接上追光與料理`);
      assert.equal(await page.evaluate(() => document.querySelectorAll(".resource-bar [data-r76c-sunbook], header [data-r76c-sunbook], header [class*='r76c']").length), 0, `${tag} 資源列沒有多塞手冊的東西`);

      /* 一、入口：更多 → 圖鑑，最上面那一列。 */
      await page.evaluate(() => FarmWorld.openPanel("journal"));
      await page.waitForSelector("[data-r76c-sunbook]"); await page.waitForTimeout(600);
      const a = await measure(page, Object.assign({ sum: ".r76c-sum", close: ".side-panel.world-panel-open .world-close", count: "[data-r76c-count]", title: ".r76c-sum-title" }, AROUND));
      assert.ok(a.panel, `${tag} 圖鑑面板有打開`);
      assert.ok(a.sum && a.sum.width >= 44 && a.sum.height >= 44, `${tag} 手冊入口命中區至少 44px ${JSON.stringify(a.sum)}`);
      assert.ok(inside(a.sum, w, h) && a.sum.top >= a.panel.top - 0.5 && a.sum.bottom <= a.panel.bottom + 0.5, `${tag} 打開圖鑑就看得到手冊入口，不用捲`);
      assert.ok(a.sum.hit, `${tag} 手冊入口沒被別的東西蓋住`);
      assert.ok(a.sum.clipX <= 1, `${tag} 手冊入口文字沒被裁掉`);
      assert.equal(a.title.text, "追光手冊"); assert.equal(a.count.text, "已蓋 0 枚"); /* R78C：差幾枚與獎勵只留在展開後的進度區一次 */
      assert.ok(a.close && a.close.width >= 44 && a.close.height >= 44 && inside(a.close, w, h) && a.close.hit, `${tag} 面板關閉鈕看得到、點得到 ${JSON.stringify(a.close)}`);
      assert.equal(overlap(a.sum, a.close), 0, `${tag} 手冊入口和關閉鈕不重疊`);
      assert.equal(await page.evaluate(() => document.querySelector(".r76c-fold").open), false, `${tag} 一開始是收起來的，不把圖鑑往下擠`);
      assert.ok(await page.evaluate(() => document.querySelector("#journalPanel").children.length > 1), `${tag} 原本的圖鑑內容還在`);
      await shot(page, tag, "1-entry");

      /* 二、展開：進度條、四份獎勵、每種作物一列。 */
      await page.locator(".r76c-sum").click();
      await page.waitForFunction(() => document.querySelector(".r76c-fold").open);
      /* 瀏覽器是在展開之後的下一拍才通知頁面（toggle 事件），所以等它記下來再往下；兩秒內沒記下來就算失敗。 */
      await page.waitForFunction(() => __farm.state().sunbook.folded === false, null, { timeout: 2000 }).catch(() => assert.fail(`${tag} 展開狀態有記下來`));
      const b = await page.evaluate(() => {
        const box = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const body = document.querySelector(".side-panel.world-panel-open .side-body"), book = document.querySelector("[data-r76c-sunbook]"), bar = document.querySelector(".r76c-bar");
        return {
          body: box(body), book: box(book), overflowX: body.scrollWidth - body.clientWidth, bar: box(bar), now: bar.getAttribute("aria-valuenow"), max: bar.getAttribute("aria-valuemax"),
          ticks: [...book.querySelectorAll(".r76c-tick")].map((n) => Object.assign(box(n), { text: n.textContent })),
          next: book.querySelector("[data-r76c-next]").textContent,
          miles: [...book.querySelectorAll("[data-r76c-mile]")].map((n) => ({ count: n.dataset.r76cMile, text: n.textContent.replace(/\s+/g, " ").trim(), box: box(n), clip: n.scrollWidth - n.clientWidth })),
          rows: [...book.querySelectorAll("[data-r76c-row]")].map((n) => ({ id: n.dataset.r76cRow, box: box(n), clip: n.scrollWidth - n.clientWidth,
            cells: [...n.querySelectorAll("[data-r76c-cell]")].map((c) => Object.assign(box(c), { id: c.dataset.r76cCell, got: c.dataset.got, clip: c.scrollWidth - c.clientWidth, name: c.querySelector(".r76c-cell-name").textContent })),
            hints: [...n.querySelectorAll("[data-r76c-hint]")].map((x) => x.textContent) })),
          more: (book.querySelector(".r76c-more") || {}).textContent || "", small: [...book.querySelectorAll("*")].filter((n) => n.children.length === 0 && n.textContent.trim() && parseFloat(getComputedStyle(n).fontSize) < 11).length,
        };
      });
      assert.ok(b.book.left >= b.body.left - 0.5 && b.book.right <= b.body.right + 0.5 && b.overflowX <= 1, `${tag} 手冊不超出面板、不用左右捲`);
      assert.equal(b.now, "0"); assert.equal(b.max, "15"); assert.match(b.next, /再蓋 3 枚/);
      assert.deepEqual(b.ticks.map((t) => t.text), ["3", "6", "10", "15"]);
      for (const t of b.ticks) assert.ok(t.left >= b.bar.left - 2 && t.right <= b.bar.right + 2, `${tag} 進度刻度 ${t.text} 沒跑出進度條`);
      for (let i = 1; i < b.ticks.length; i++) assert.equal(overlap(b.ticks[i - 1], b.ticks[i]), 0, `${tag} 進度刻度不互相重疊`);
      assert.deepEqual(b.miles.map((m) => m.count), ["3", "6", "10", "15"]);
      for (const m of b.miles) { assert.match(m.text, m.count === "3" ? /集滿 3 枚.*陽光 1 點.*還差 3 枚/ : /集滿 \d+ 枚.*金幣 \d+.*還差 \d+ 枚/, `${tag} 獎勵要寫清楚`); assert.ok(m.clip <= 1, `${tag} 獎勵文字沒被裁掉`); }
      assert.deepEqual(b.rows.map((r) => r.id + ":" + r.cells.map((c) => c.id).join(",")), ["wheat:lit,trait,dried,perfect", "carrot:lit,trait,dried,perfect", "tomato:lit,trait,dried,perfect", "strawberry:lit,trait,dried,perfect", "corn:lit,trait", "pumpkin:lit,trait", "radish:lit", "bell_pepper:lit"]);
      for (const row of b.rows) {
        assert.ok(row.clip <= 1, `${tag} ${row.id} 那一列沒被裁掉`);
        assert.equal(row.hints.length, row.cells.length, `${tag} ${row.id} 每個還沒拿到的印章都有一句怎麼拿`);
        for (const hint of row.hints) assert.match(hint, /^.{4}：.{8,}。$/, `${tag} 提示寫得出怎麼拿：${hint}`);
        row.cells.forEach((cell, i) => {
          assert.equal(cell.got, "0"); assert.ok(cell.clip <= 1, `${tag} ${row.id} 的「${cell.name}」沒被裁掉`);
          assert.ok(cell.left >= row.box.left - 0.5 && cell.right <= row.box.right + 0.5, `${tag} ${row.id} 的印章格在列裡面`);
          if (i > 0) assert.equal(overlap(row.cells[i - 1], cell), 0, `${tag} ${row.id} 的印章格不重疊`);
        });
      }
      assert.match(b.more, /還有 \d+ 種作物沒解鎖/); assert.equal(b.small, 0, `${tag} 手冊裡沒有小於 11px 的字`);
      const b2 = await measure(page, AROUND);
      assert.equal(overlap(b2.panel, b2.dock), 0, `${tag} 展開以後不蓋住下方工具列`);
      await shot(page, tag, "2-open");

      /* 三、面板的關閉鈕真的關得掉。 */
      await page.evaluate(() => { document.querySelector(".side-panel.world-panel-open .side-body").scrollTop = 0; });
      await page.locator(".side-panel.world-panel-open .world-close:visible").click();
      await page.waitForFunction(() => !document.querySelector(".side-panel.world-panel-open"));

      /* 四、真的收成：櫻桃蘿蔔在光裡收，第一枚章，小卡帶一次性的「手札裡有追光手冊」。 */
      const harvest = (cropId, lit, hits) => page.evaluate(([id, inLight, count]) => {
        const s = __farm.state(), now = Date.now(), plot = s.plots[0];
        plot.cropId = null; s.sun.plots = [];
        const planted = Game.plant(s, 0, id, now); if (!planted.ok) throw new Error("種不下去 " + JSON.stringify(planted));
        plot.plantedAt = now - Game.plotGrowMs(s, plot, now) - 1000;
        for (let i = 0; i < count; i++) FarmSunplay.recordExposure(s, 0);
        if (inLight) Object.assign(s.sun, { plots: [0], used: [], startsAt: now - 1, endsAt: now + 60000, durationMs: 60001 });
        const r = Game.harvest(s, 0, now); if (!r.ok) throw new Error("收不起來 " + JSON.stringify(r));
        s.sun.plots = []; __farm.refresh();
        return r.added;
      }, [cropId, lit, hits]);
      assert.ok(await harvest("radish", true, 0) > 0);
      await page.waitForFunction(cardShown, null, { timeout: 5000 });
      const c = await checkCard(page, tag, w, h, "第一枚章", true);
      assert.match(c.card.text, new RegExp(`追光手冊：櫻桃蘿蔔・光裡收成（櫻桃蘿蔔 1／1 枚）`), `${tag} 小卡文字`); /* R82C 同步：小卡改按作物計（原為分母統一 15） */
      assert.match(c.card.text, /手札的圖鑑頁最上面多了一本追光手冊/, `${tag} 第一次拿章要提示手冊在哪`);
      assert.doesNotMatch(c.card.text, /\+0/);
      /* 「陽光照在幾格田」的標籤跟小卡同時出現時，小卡要讓開它。 */
      await page.evaluate(() => { const s = __farm.state(), now = Date.now(); Object.assign(s.sun, { plots: [1], used: [], startsAt: now - 1, endsAt: now + 60000, durationMs: 60001 }); __farm.refresh(); FarmWorld.refresh(s); });
      await page.waitForFunction(() => { const n = document.querySelector("#sunChip"); return !!n && !n.hidden && n.getBoundingClientRect().height > 0; }, null, { timeout: 5000 });
      const c2 = await checkCard(page, tag, w, h, "陽光標籤出現時", true);
      assert.ok(c2.chip, `${tag} 陽光標籤看得到`);
      await shot(page, tag, "3-first-card");
      await page.locator("[data-r76c-card-close]").click();
      await page.waitForFunction(cardHidden);

      /* 五、第二枚章：不再提示，只有一句話，幾秒後自己消失。
         收成同時升級時，升級卡也排在右上角：升級卡還在的時候小卡先等，升級卡收掉才出來，兩張不疊在一起。 */
      await page.evaluate(() => __farm.enqueueSettlement({ kind: "milestone", title: "升到 Lv 6", earned: "金幣 30", unlocked: "草莓", next: "去種草莓" }));
      await page.waitForFunction(() => document.querySelector("#toast-zone .milestone-card"), null, { timeout: 3000 });
      assert.ok(await harvest("carrot", false, 1) > 0);
      await page.waitForTimeout(900);
      assert.equal(await page.evaluate(() => !!document.querySelector("#toast-zone .milestone-card")), true, `${tag} 升級卡還在`);
      assert.equal(await page.evaluate(cardHidden), true, `${tag} 升級卡還在時小卡不出來`);
      await page.waitForFunction(cardShown, null, { timeout: 5000 });
      assert.equal(await page.evaluate(() => { const n = document.querySelector("#toast-zone .settlement-card"); return n ? n.textContent.replace(/\s+/g, " ").trim() : ""; }), "", `${tag} 小卡出來時升級卡已經收掉`);
      const d = await checkCard(page, tag, w, h, "第二枚章", false);
      assert.match(d.card.text, new RegExp(`^追光手冊：胡蘿蔔・光性達成（胡蘿蔔 1／4 枚）全冊再 1 枚領：陽光 1 點、蓄光瓶永久多裝 1 點$`), `${tag} 之後的小卡寫印章與差幾枚領什麼`); /* R82C 同步：括號按作物計，差幾枚寫明全冊 */ /* R78C：3 枚改為非金幣獎勵 */
      await page.waitForFunction(cardHidden, null, { timeout: 8000 });

      /* 六、料理成果卡開著時，小卡先等著，不跟它搶位置；成果卡關掉才出來。 */
      await page.evaluate(() => FarmWorld.openKitchen());
      await page.waitForFunction(() => document.querySelector('[data-r75b-start="rustic_bread"]'));
      await page.locator('[data-r75b-start="rustic_bread"]').click(); await page.locator("[data-r75b-direct]").click();
      await page.waitForFunction(() => document.querySelector("[data-r76a-cook-result]"));
      assert.equal(await page.evaluate(() => CookingR75.cookWithGrade(__farm.state(), "rustic_bread", "perfect", Date.now()).ok), true, `${tag} 煮出絕品`);
      await page.waitForTimeout(900);
      assert.equal(await page.evaluate(cardHidden), true, `${tag} 成果卡開著時小卡不出來`);
      const e0 = await measure(page, { keep: "[data-r76a-keep]" });
      assert.ok(e0.keep && e0.keep.hit, `${tag} 成果卡的按鈕沒被擋住`);
      await page.locator("[data-r76a-keep]").click();
      await page.waitForFunction(() => !document.querySelector(".r75b-cook-overlay"));
      /* 成果卡關掉後會回到灶台視窗；灶台也是整面的視窗，小卡一樣等它關掉。 */
      await page.waitForTimeout(700);
      if (await page.evaluate(() => !!document.querySelector(".modal.show"))) {
        assert.equal(await page.evaluate(cardHidden), true, `${tag} 灶台視窗開著時小卡不出來`);
        await page.locator(".modal.show .world-modal-close").click();
        await page.waitForFunction(() => !document.querySelector(".modal.show"));
      }
      await page.waitForFunction(cardShown, null, { timeout: 5000 });
      const e = await checkCard(page, tag, w, h, "集滿 3 枚", true);
      assert.match(e.card.text, new RegExp(`追光手冊：小麥・煮成絕品（小麥 1／4 枚）`)); /* R82C 同步：小卡改按作物計 */ assert.match(e.card.text, /集滿 3 枚了，到追光手冊領獎勵。/); /* R77C 同步：小卡分母統一 15 */
      await shot(page, tag, "4-milestone-card");

      /* 七、從小卡打開手冊，領第一份獎勵。 */
      await page.locator("[data-r76c-card-open]").click();
      await page.waitForFunction(() => document.querySelector(".side-panel.world-panel-open [data-r76c-sunbook] .r76c-fold[open]"));
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(cardHidden), true, `${tag} 打開手冊以後小卡收掉`);
      const f = await measure(page, Object.assign({ sum: ".r76c-sum", close: ".side-panel.world-panel-open .world-close", flag: "[data-r76c-flag]", count: "[data-r76c-count]" }, AROUND));
      assert.ok(f.sum && f.sum.hit && f.sum.top >= f.panel.top - 0.5, `${tag} 打開後手冊標題就在眼前`);
      assert.ok(f.close && f.close.hit && inside(f.close, w, h), `${tag} 打開後面板關閉鈕看得到`);
      assert.equal(f.count.text, "已蓋 3 枚"); assert.equal(f.flag.text, "有獎勵可領"); assert.ok(f.sum.clipX <= 1, `${tag} 多了「有獎勵可領」標題列也沒被擠壞`);
      const claim = page.locator('[data-r76c-claim="3"]');
      await claim.scrollIntoViewIfNeeded();
      const g = await measure(page, Object.assign({ claim: '[data-r76c-claim="3"]' }, AROUND));
      assert.ok(g.claim && g.claim.width >= 44 && g.claim.height >= 44 && g.claim.hit, `${tag} 領取鈕點得到，命中區至少 44px ${JSON.stringify(g.claim)}`);
      const before = await page.evaluate(() => ({ coins: __farm.state().coins, cap: FarmSunplay.bottleCapacity(__farm.state()) }));
      await claim.click();
      await page.waitForFunction(() => document.querySelector('[data-r76c-mile="3"].is-claimed'));
      const k = await page.evaluate(() => ({ coins: __farm.state().coins, cap: FarmSunplay.bottleCapacity(__farm.state()), mile: document.querySelector('[data-r76c-mile="3"]').textContent.replace(/\s+/g, " ").trim(),
        clip: document.querySelector('[data-r76c-mile="3"]').scrollWidth - document.querySelector('[data-r76c-mile="3"]').clientWidth, flag: !!document.querySelector("[data-r76c-flag]"),
        toast: document.querySelector("#toast-zone").textContent, again: !!document.querySelector('[data-r76c-claim="3"]'), next: document.querySelector("[data-r76c-next]").textContent, now: document.querySelector(".r76c-bar").getAttribute("aria-valuenow") }));
      assert.equal(k.coins, before.coins, `${tag} 3 枚獎勵不再塞入早期金幣`); assert.equal(k.cap, before.cap + 1, `${tag} 蓄光瓶多裝 1 點`);
      assert.match(k.mile, /集滿 3 枚.*拿到：陽光 1 點、蓄光瓶永久多裝 1 點.*已領取/, `${tag} 畫面寫出拿到什麼`); assert.ok(k.clip <= 1, `${tag} 領完的那一列沒被裁掉`);
      assert.match(k.toast, /追光手冊獎勵：陽光 1 點、蓄光瓶永久多裝 1 點。/);
      assert.equal(k.flag, false); assert.equal(k.again, false, `${tag} 領過就沒有領取鈕`); assert.match(k.next, /再蓋 3 枚可領：金幣 240/); assert.equal(k.now, "3");
      /* 領完手冊不能自己關掉：玩家要看得到剛領的那一列寫了什麼。 */
      await page.waitForTimeout(400);
      const k2 = await measure(page, Object.assign({ mile: '[data-r76c-mile="3"]', close: ".side-panel.world-panel-open .world-close" }, AROUND));
      assert.ok(k2.panel, `${tag} 領完以後手札還開著`);
      assert.ok(k2.mile && k2.mile.hit && overlap(k2.mile, k2.panel) > 0, `${tag} 領完以後看得到剛領的那一列 ${JSON.stringify(k2.mile)}`);
      assert.equal(overlap(k2.panel, k2.dock), 0, `${tag} 領完以後面板不蓋住下方工具列`);
      await shot(page, tag, "5-claimed");

      /* 八、存檔後重新載入：印章、領取紀錄、加成都還在。 */
      await page.evaluate(() => __farm.safeSaveNow());
      await page.reload(); await ready(page);
      const back = await page.evaluate(() => { const s = __farm.state(); FarmSunbook.sync(s); return { stamps: Object.keys(s.sunbook.stamps).sort().map((id) => id + ":" + Object.keys(s.sunbook.stamps[id]).sort().join(",")), claimed: Object.keys(s.sunbook.claimed), hinted: s.sunbook.hinted, folded: s.sunbook.folded, cap: FarmSunplay.bottleCapacity(s), counts: FarmSunbook.counts(s) }; });
      assert.deepEqual(back.stamps, ["carrot:trait", "radish:lit", "wheat:perfect"], `${tag} 重新載入後印章還在`);
      assert.deepEqual(back.claimed, ["3"]); assert.equal(back.hinted, true); assert.equal(back.folded, false); assert.equal(back.cap, before.cap + 1); assert.deepEqual(back.counts, { got: 3, total: TOTAL });
      await page.evaluate(() => FarmWorld.openPanel("journal"));
      await page.waitForSelector("[data-r76c-sunbook]");
      assert.equal(await page.evaluate(() => document.querySelector("[data-r76c-count]").textContent), "已蓋 3 枚", "重新載入後摘要只留已蓋枚數");
      assert.equal(await page.evaluate(() => !!document.querySelector('[data-r76c-claim="3"]')), false, `${tag} 重新載入後不能再領一次`);

      assert.deepEqual(errors, [], `${tag} 頁面錯誤`);
      await ctx.close(); console.log(`OK ${tag}`);
    }
  } finally { await browser.close(); server.close(); }
  console.log("VERIFIED content R76C sunbook layout");
})().catch((e) => { console.error(e); process.exit(1); });
