#!/usr/bin/env node
"use strict";
/* R85C：評審截圖工具（之後每輪評審都用它，不再依賴暫存區的一次性腳本）。
 *
 * 用法：
 *   node scripts/review-capture-r85.cjs --out <資料夾> [--port 5123] [--root <要拍的 repo 資料夾>]
 *        [--sizes 1366x768,390x844] [--only kitchen,weather] [--motion] [--extra <追加畫面.cjs>] [--list]
 *
 *   --out     截圖與 index.md／index.json 放這裡（不存在就建立）。
 *   --port    本機靜態伺服器的埠（預設 5123；給 0 就用系統挑的空埠）。
 *   --root    要拍哪一份遊戲（預設就是這支腳本所在的 repo）；拿來拍改版前後對照。
 *   --sizes   只拍某些尺寸（預設 1366x768、1366x600、390x844、844x390 四種）。
 *   --only    只拍某些畫面或某幾張（畫面 id 或每張的 id，逗號分隔；結尾加 * 表示前綴，例如 branch-plant-*）。
 *   --motion  不開「減少動態」（預設開著，截圖才穩定、每次重拍一樣）。
 *   --extra   追加畫面：檔案 module.exports = [{ id, title, opening, shots: [...] }]，格式同下方 SCENES。
 *   --list    只列出會拍哪些畫面，不開瀏覽器。
 *
 * 做法：
 *   - 每個畫面每個尺寸開一個乾淨的瀏覽器分頁（沒有舊存檔、擋掉 service worker），按開場鈕，
 *     再用遊戲本身的存檔欄位與測試輔助（__farm、FarmWorld、StoryR76、ChoicesR77、FarmWaitplay……）擺到要看的狀態。
 *     擺法照 scripts/ 既有測試（test-content-r84-card-sweep.js、r84-pace、r83-branches、r75b-layout、r78-choices-layout……），不改遊戲邏輯。
 *   - 拍之前等圖片解碼、兩個畫格、鏡頭停住；每張都檢查「是不是預期畫面」（該出現的節點有沒有出現），不是就記成失敗。
 *   - 瀏覽器用軟體繪圖（--disable-gpu），GPU 留給影片產線。
 *   - 檔名：<三位序號>-<尺寸>-<畫面 id>.png；同一個畫面的四個尺寸排在一起。index.md 列序號、尺寸、畫面名稱、該看什麼。
 *   - 有頁面錯誤或不是預期畫面時，結束碼是 1（截圖照樣留著，index.md 會標出來）。
 *
 * 擴充點：
 *   - 壞天氣畫面用遊戲的接水規則準備滿桶，再確認畫面上有可操作的水桶。
 *   - 其他新畫面：在 SCENES 加一項，或用 --extra 從外部檔案追加。 */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const REPO = path.resolve(__dirname, "..");
const DEFAULT_SIZES = [[1366, 768], [1366, 600], [390, 844], [844, 390]];
const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".cjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".woff2": "font/woff2" };

function parseArgs(argv) {
  const o = { port: 5123, root: REPO, sizes: DEFAULT_SIZES, only: [], motion: false, extra: "", list: false, out: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], next = () => { if (i + 1 >= argv.length) throw Error(a + " 後面要接值"); return argv[++i]; };
    if (a === "--out") o.out = path.resolve(next());
    else if (a === "--port") o.port = Number(next());
    else if (a === "--root") o.root = path.resolve(next());
    else if (a === "--sizes") o.sizes = next().split(",").map((s) => s.trim().split("x").map(Number)).filter((v) => v.length === 2 && v.every((n) => n > 0));
    else if (a === "--only") o.only = next().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--motion") o.motion = true;
    else if (a === "--extra") o.extra = path.resolve(next());
    else if (a === "--list") o.list = true;
    else if (a === "--help" || a === "-h") { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); process.exit(0); }
    else throw Error("看不懂的參數：" + a);
  }
  if (!o.list && !o.out) throw Error("要給 --out <資料夾>");
  if (!Number.isInteger(o.port) || o.port < 0 || o.port > 65535) throw Error("--port 要是 0～65535 的整數");
  if (!fs.existsSync(path.join(o.root, "index.html"))) throw Error("--root 底下找不到 index.html：" + o.root);
  return o;
}

/* ---------- 本機靜態伺服器 ---------- */
function serve(root, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let file;
      try { const u = new URL(req.url, "http://127.0.0.1"); file = path.resolve(root, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); } catch (_) { res.writeHead(400); return res.end(); }
      if (path.relative(root, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    });
    server.once("error", (e) => reject(e.code === "EADDRINUSE" ? Error("埠 " + port + " 已經有人在用；換一個 --port（給 0 會自動挑空埠）") : e));
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
/* 軟體繪圖：Playwright 自帶的 Chromium 優先，沒有就換系統的 Chrome／Edge。 */
async function launch(chromium) {
  const opts = { headless: true, args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader", "--disable-gpu-compositing"] };
  try { return await chromium.launch(opts); } catch (_) { /* 換系統瀏覽器 */ }
  for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"]) {
    if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) { /* 下一個 */ }
  }
  throw Error("找不到可用的瀏覽器（Playwright Chromium、Chrome、Edge 都開不起來）");
}

/* ---------- 頁面內的小工具（照 test-content-r84-card-sweep.js 的 __r84h）---------- */
function installHelpers() {
  const deep = (v) => JSON.parse(JSON.stringify(v)), KEEP = ["map", "player", "camera", "settings"];
  const DAY = 86400000, dayKey = (t) => new Date(t).toISOString().slice(0, 10);
  const h = {
    DAY, dayKey,
    snapshot() { window.__rc85Base = JSON.stringify(__farm.state()); },
    /* 回到開場後那一份存檔：上一張改過的東西不帶到下一張。 */
    reset() {
      const s = __farm.state(), base = JSON.parse(window.__rc85Base);
      for (const k of Object.keys(s)) if (!KEEP.includes(k) && !(k in base)) delete s[k];
      for (const k of Object.keys(base)) if (!KEEP.includes(k)) s[k] = deep(base[k]);
      Object.assign(s.player, base.player); s.player.action = "idle";
      window.__rc85Focus = ""; h.clean(); return s;
    },
    /* 收掉自己跳出來的對話、泡泡、提示、側欄與視窗。 */
    clean(keep) {
      keep = keep || {};
      if (!keep.dialogue) { document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove()); const w = document.querySelector("#worldDialogue"); if (w) w.hidden = true; }
      if (!keep.panel) document.querySelector(".side-panel")?.classList.remove("world-panel-open");
      if (!keep.modal) for (const id of ["dailyModal", "worldModal", "settingsModal"]) document.getElementById(id)?.classList.remove("show");
      if (!keep.toast) { const z = document.querySelector("#toast-zone"); if (z) z.innerHTML = ""; }
      if (!keep.overlay) document.querySelectorAll(".r75b-cook-overlay").forEach((n) => n.remove());
    },
    /* 天氣固定：等級高了遊戲會自己擲天氣，評審截圖除了天氣那幾張都固定晴朗。 */
    weather(s, id, t) { s.weather = { id: id || "clear", untilMs: (t || Date.now()) + 3 * 3600000 }; },
    clear(s) { for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; delete p.sunGrown; } },
    noSun(s, t) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); },
    preview(s, plots, t) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: plots, previewAt: t + 40000, nextAt: t + 40000 }); },
    lit(s, plots, t) { Object.assign(s.sun, { plots, used: [], startsAt: t - 1000, endsAt: t + 40000, durationMs: 41000, previewPlots: [], previewAt: 0, nextAt: t + 80000 }); },
    crop(s, i, id, t, o) { o = o || {}; const p = s.plots[i]; p.cropId = id; p.plantedAt = o.ripe ? t - 3600000 : t - (o.ago || 0); if (o.wet) p.wateredAt = p.plantedAt + 1; else delete p.wateredAt; if (o.care) p.careMode = o.care; if (o.sunGrown) p.sunGrown = true; else delete p.sunGrown; },
    level(s, n) { while (CONFIG.levelFromXp(s.xp) < n) s.xp += 50; s.level = CONFIG.levelFromXp(s.xp); },
    daily(s) { Object.assign(s.adventure.r61.daily, { selected: ["harvest", "market", "forage"], chosen: true }); s.adventure.earlyGoals.marketPreview = true; s.adventure.counts.forage = Math.max(1, s.adventure.counts.forage || 0); },
    /* 主線停在 id 這一件之前（給空字串＝全部領過），祖母手記沒開，田空著、沒有光。 */
    main(s, id, t) {
      s.heirloom.started = false; s.coins = 999; h.level(s, 10); s.stats.plantCount = Math.max(20, s.stats.plantCount || 0);
      for (const q of AdventureAPI.quests(s, t)) { if (q.id === id) break; s.adventure.claimed[q.id] = true; }
      h.daily(s); AdventureAPI.ensure(s, t); h.clear(s); h.noSun(s, t);
    },
    heir(s, t) { s.adventure.claimed = {}; AdventureAPI.ensure(s, t); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; s.stats.harvested = {}; h.clear(s); h.noSun(s, t); },
    /* 舊麥種：祖母餐籃已送到（送達時間放在三天前，故事二選一不會自己跳出來；要看對話那一張另外處理）。 */
    story(s, t, choice, deliveredAt) {
      s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; FarmHeirloom.deliver(s, "table", deliveredAt || t - 3 * DAY); s.storage.items.wheat = 0; h.clear(s); h.noSun(s, t);
      if (choice) StoryR76.r81Choose(s, choice, t);
    },
    finishStory(s, t, choice) { h.story(s, t, choice); const info = StoryR76.r81Order(s, t); s.storage.items[info.itemId] = info.need; StoryR76.r81Deliver(s, t); StoryR76.r81SceneSeen(s, t); for (const k of Object.keys(s.storage.items)) s.storage.items[k] = 0; },
    tile(i) { return __farm.state().map.tiles.find((x) => x.plotIndex === i); },
    station(name) { return __farm.state().map.tiles.find((x) => x.station === name); },
    xy(x, y) { return __farm.state().map.tiles.find((t) => t.x === x && t.y === y); },
    stand(tile) { const s = __farm.state(); Object.assign(s.player, { tileId: tile.id, x: tile.x, y: tile.y }); if (__farm.cancelJourney) __farm.cancelJourney(); },
    /* 鏡頭帶到那一格；遊戲的鏡頭焦點幾秒後會回去跟著主角，拍之前會再帶一次（settle）。 */
    focus(tile) { if (!tile) return; window.__rc85Focus = tile.id; h.refocus(); },
    refocus() { const id = window.__rc85Focus; if (!id) return; __farm.focusTile(id); const c = __farm.state().camera; if (c && c.focusTileId === id) c.focusUntil = Date.now() + 120000; },
    /* 擺完狀態：天氣（沒指定就晴朗）、光的倒數、取消選取，整個畫面重畫一次。 */
    done(s, o) {
      o = o || {}; const t = Date.now();
      if (!o.keepWeather) h.weather(s, "clear", t);
      FarmSunplay.refreshLightCountdown(s.sun, t);
      if (!o.keepSelection) s.interaction.selectedTileId = null;
      __farm.refresh(); FarmWorld.refresh(s);
      if (window.ChoicesR77 && ChoicesR77.paintScenes) ChoicesR77.paintScenes(s);
    },
    visible(sel) { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 2 && r.height > 2 && c.display !== "none" && c.visibility !== "hidden" && Number(c.opacity) > 0; },
  };
  window.__rc85 = h;
}

/* ---------- 共用的擺法 ---------- */
const ev = (page, fn, arg) => page.evaluate(fn, arg);
async function setup(page, fn, arg, o) {
  await page.evaluate(() => __rc85.reset());
  await page.evaluate(fn, arg);
  await page.evaluate((o) => __rc85.done(__farm.state(), o), o || {});
  await page.waitForTimeout(650); /* 讓遊戲自己的定時同步（任務卡、光的決定、鏡頭避讓）跑過幾輪 */
}
async function cleanAfter(page, keep) { await page.evaluate((k) => __rc85.clean(k), keep || {}); }
/* fn 是 async 函式（例如 focusStation）就在 Node 這邊跑；一般函式就丟進頁面裡跑。 */
async function focus(page, fn, arg) { if (fn.constructor.name === "AsyncFunction") await fn(page); else await page.evaluate(fn, arg); await stableCamera(page); }
async function stableCamera(page) {
  let last = "";
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(120); const pos = await page.evaluate(() => (document.getElementById("mapWorld") || {}).style?.transform || ""); if (pos === last) break; last = pos; }
}
const needs = (sel, what) => async (page) => (await page.evaluate((s) => __rc85.visible(s), sel)) ? "" : "畫面上沒有 " + (what || sel);
const needsAll = (...checks) => async (page) => { for (const c of checks) { const m = await c(page); if (m) return m; } return ""; };
const srcHas = (sel, re, what) => async (page) => { const src = await page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getAttribute("src") || "" : null; }, sel); return src === null ? "畫面上沒有 " + what : new RegExp(re).test(src) ? "" : what + " 的圖不是預期的那張：" + src; };

/* 舊麥種種植線的各階段（照 test-content-r84-pace.js 的 setRoute）。 */
function plantRoute(stage) {
  /* 在頁面裡跑：stage 由 page.evaluate 的參數帶進去（函式本身不能抓外面的變數）。 */
  return (stage) => {
    const h = __rc85, s = __farm.state(), now = Date.now(), DAY = h.DAY, day = h.dayKey;
    h.finishStory(s, now, "plant");
    const plant = stage === "empty" ? {} : { plantedAt: now - 2 * DAY, lightDays: stage === "planted" ? [] : stage === "one-light" ? [day(now - DAY)] : [day(now - 2 * DAY), day(now - DAY)], harvestedAt: stage === "harvested" ? now - 1000 : 0, stock: stage === "harvested" ? 1 : 0 };
    s.r82branches = { route: "plant", plant, seal: {} };
    StoryR76.r82Ensure(s, now);
  };
}
const focusStation = (name) => async (page) => page.evaluate((n) => __rc85.focus(__rc85.station(n)), name);

/* ---------- 壞天氣（B 線擴充點）---------- */
const WEATHER_SHOTS = [
  { id: "rain", title: "壞天氣：雨天", look: "雨天田上沒有光斑時，畫面上有沒有事可做；雨線與暗色只在場景裡，不蓋任務卡與按鈕。" },
  { id: "storm", title: "壞天氣：暴風雨", look: "暴風雨的雨線與暗色只在場景裡；任務卡與按鈕仍清楚。" },
  { id: "fog", title: "壞天氣：霧天", look: "霧氣不讓田與名牌糊成一片；介面仍清楚。" },
  { id: "snow", title: "壞天氣：雪天", look: "雪點只在場景裡；田、作物與名牌看得出來。" },
];
async function badWeatherPlay(page, weatherId) {
  await setup(page, (id) => {
    const h = __rc85, state = __farm.state(), now = Date.now();
    h.level(state, 6);
    h.weather(state, id, now);
    h.noSun(state, now);
    h.stand(h.tile(0));
    for (const i of [0, 1, 2]) h.crop(state, i, "wheat", now);
    const rain = window.FarmRainplay;
    for (let t = now - rain.FILL_MS; t <= now; t += rain.STEP_CAP_MS) rain.update(state, t);
  }, weatherId, { keepWeather: true });
  await page.locator('.r85b-barrel[data-stage="full"]').waitFor({ state: "visible" });
  await cleanAfter(page);
}

/* ---------- 要拍的畫面 ----------
   每個畫面：opening 是開場鈕（begin＝一般開場、sun＝祖母手記開場）；shots 依序拍，每張的 setup 自己擺狀態，check 回傳空字串代表是預期畫面。 */
const SCENES = [
  { id: "first-minute", title: "新存檔第一分鐘（一般開場）", opening: "begin", shots: [
    { id: "first-minute", title: "新存檔第一分鐘・一般開場", look: "任務卡標題、按鈕、右下大鈕講同一件事（R84 未解 1）；只有一顆主按鈕；鎮長在畫面內。",
      run: async (page) => { await page.waitForTimeout(1800); await cleanAfter(page, { dialogue: true }); }, check: needs("#questDock", "任務卡") },
  ] },
  { id: "first-minute-heirloom", title: "新存檔第一分鐘（祖母手記開場）", opening: "sun", shots: [
    { id: "first-minute-heirloom", title: "新存檔第一分鐘・祖母手記開場", look: "祖母手記卡第一步（種第一株）與任務卡一致；卡片不蓋住要種的田。",
      run: async (page) => { await page.waitForTimeout(1800); await cleanAfter(page, { dialogue: true }); }, check: needs("#questDock", "任務卡") },
  ] },
  { id: "field", title: "田的四個階段", opening: "begin", shots: [
    { id: "field-planted", title: "田：剛種下", look: "三格小麥剛種下、澆過水；作物、田格與任務卡不互相蓋住。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); for (const i of [0, 1, 2]) h.crop(s, i, "wheat", t, { wet: true, ago: 2500 }); h.noSun(s, t); }); await focus(page, () => __rc85.focus(__rc85.tile(1))); await cleanAfter(page); }, check: needs('.gtile[data-tile-id]', "田格") },
    { id: "field-lit", title: "田：光照在田上（照過一次光）", look: "光柱落在第一格、那一格的麥子帶著陽光的樣子；光的倒數與收益看得懂（R84 未解 4）。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); for (const i of [0, 1, 2]) h.crop(s, i, "wheat", t, { wet: true, sunGrown: i === 0, ago: 2000 }); h.lit(s, [0], t); s.r75Sunplay.firstRefracted = true; }); await focus(page, () => __rc85.focus(__rc85.tile(1))); await cleanAfter(page); },
      check: needs('.sun-beam[data-plot-index="0"]', "第一格的光柱") },
    { id: "field-ripe", title: "田：成熟", look: "三格成熟的小麥一眼看得出能收；任務卡寫收成。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); for (const i of [0, 1, 2]) h.crop(s, i, "wheat", t, { ripe: true, wet: true }); h.noSun(s, t); }); await focus(page, () => __rc85.focus(__rc85.tile(1))); await cleanAfter(page); }, check: needs("#questDock", "任務卡") },
    { id: "field-harvested", title: "田：剛收成", look: "手動收成第一格的當下：收成數字與提示看得到、田變空；其他兩格還是成熟。",
      run: async (page) => {
        await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); for (const i of [0, 1, 2]) h.crop(s, i, "wheat", t, { ripe: true, wet: true }); h.noSun(s, t); const p0 = h.tile(0), adj = s.map.tiles.find((x) => x.x === p0.x && x.y === p0.y + 1 && window.isWalkable(s, x)) || s.map.tiles.find((x) => Math.abs(x.x - p0.x) + Math.abs(x.y - p0.y) === 1 && window.isWalkable(s, x)); if (adj) h.stand(adj); });
        await focus(page, () => __rc85.focus(__rc85.tile(1))); await cleanAfter(page);
        await page.evaluate(() => { __farm.setTool("hand"); __farm.clickTile(__rc85.tile(0).id); });
        const ok = await page.waitForFunction(() => !__farm.state().plots[0].cropId, null, { timeout: 6000 }).then(() => true, () => false);
        if (!ok) await page.evaluate(() => { const s = __farm.state(); Game.harvest(s, 0, Date.now()); __farm.refresh(); });
        await page.waitForTimeout(250);
      }, check: async (page) => (await page.evaluate(() => !__farm.state().plots[0].cropId)) ? "" : "第一格沒有收成" },
  ] },
  { id: "chores", title: "田邊小事", opening: "begin", shots: ["sparrow", "weed"].map((chore) => ({
    id: "chores-" + chore, title: "田邊小事：" + (chore === "sparrow" ? "趕麻雀" : "拔雜草"), look: "田邊小事的圖與名牌夠大、常駐；不壓角色、田與按鈕。",
    run: async (page) => {
      await setup(page, () => { const h = __rc85, s = __farm.state(), now = Date.now(); s.coins = 50; s.stats.plantCount = 9; s.flags.r79FirstLightHarvest = true; s.r75Sunplay.firstCaught = true; for (const i of [0, 1]) h.crop(s, i, "wheat", now, { wet: true }); Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: now + 600000 }); h.stand(h.tile(0)); });
      await page.evaluate((id) => { const s = __farm.state(), Wp = FarmWaitplay, now = Date.now(), st = Wp.normalize(s), step = AdventureAPI.nextFarmStep(s, now), tile = Wp.pickTile(s, step, 0, now); st.active = { id, tileId: tile.id, startedAt: now, expiresAt: now + 600000, kind: "grow", claimedAt: 0, goneAt: 0 }; __rc85.focus(tile); }, chore);
      await page.waitForTimeout(800); await stableCamera(page); await cleanAfter(page);
    }, check: needs("#mapWorld .r83c-chore", "田邊小事"),
  })) },
  { id: "story", title: "舊麥種故事與兩條分支", opening: "begin", shots: [
    { id: "story-conflict", title: "舊麥種：二選一的對話", look: "葛瑞與班伯各說各的、兩個選項看得懂；對話框不蓋住藍布包。",
      run: async (page) => {
        await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.story(s, t, "", t - 1000); const b = StoryR76.r81Ensure(s); if (b) delete b.shownAt; }, null);
        await page.waitForFunction(() => document.querySelector('.r76b-dialogue[data-r81c-story="conflict"]'), null, { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(400);
      }, check: needs('.r76b-dialogue[data-r81c-story="conflict"]', "舊麥種二選一的對話") },
    { id: "story-pending", title: "舊麥種：藍布包在鎮長腳邊（等你決定）", look: "地圖上的藍布舊麥種包與名牌「藍布舊麥種・等你決定」；名牌不壓鄰居。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.story(s, t); const b = StoryR76.r81Ensure(s); if (b) b.shownAt = t; }); await focus(page, () => __rc85.focus(__farm.state().map.tiles.find((x) => x.npc === "mayor"))); await cleanAfter(page); },
      check: needs('.r78c-scene-change[data-r78c-route="r81c_story:pending"]', "藍布舊麥種包") },
    { id: "story-plant-order", title: "舊麥種故事：種回田裡・班伯在等", look: "水井右邊 2×2 的藍布老麥田，畫法跟後面分支階段同一套（R84 未解 8：圖 140、145 對 148～150）。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.story(s, t, "plant"); }); await focus(page, focusStation("well")); await cleanAfter(page); },
      check: needsAll(needs('.r78c-scene-change[data-r78c-route="r81c_story:plant"]', "藍布老麥田"), srcHas('.r78c-scene-change[data-r78c-route="r81c_story:plant"] img', "blue-cloth-wheat-field", "藍布老麥田")) },
    { id: "story-plant-scene", title: "舊麥種故事：種回田裡・班伯有話要說", look: "同一塊 2×2 田，名牌換成「班伯有話要說」；畫法不變。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.story(s, t, "plant"); const info = StoryR76.r81Order(s, t); s.storage.items[info.itemId] = info.need; StoryR76.r81Deliver(s, t); }); await focus(page, focusStation("well")); await cleanAfter(page); },
      check: needs('.r78c-scene-change[data-r78c-route="r81c_story:plant"]', "藍布老麥田") },
    ...[["empty", "等你播種", "翻好的土上放著藍布種子包，跟其他階段同一塊田。"], ["planted", "剛種下", "小綠芽。"], ["one-light", "照過 1 次光", "整片青綠、還沒熟。"], ["ripe", "可以收成", "整片金黃、有成熟光點。"], ["harvested", "已收成", "收完只剩一束金麥。"]].map(([stage, name, look]) => ({
      id: "branch-plant-" + stage, title: "種植線：藍布老麥田・" + name, look: look + "四個階段與故事階段同一套畫法、同一塊 2×2 的田；名牌在畫面內。",
      run: async (page) => { await setup(page, plantRoute(), stage); await focus(page, focusStation("well")); await cleanAfter(page); },
      check: async (page) => { const st = await page.evaluate(() => { const n = document.querySelector('.r78c-scene-change[data-r78c-route="r81c_story:plant"]'); return n ? n.dataset.r82bStage || "" : null; }); return st === stage ? "" : "藍布老麥田的階段是 " + st + "，不是 " + stage; },
    })),
    { id: "branch-seal-relic", title: "封存線：第一件鎮誌舊物", look: "舊物在畫面內、名牌「鎮誌 1／3」；小地圖有金色記號。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "seal"); s.r82branches = { route: "seal", plant: {}, seal: { startDay: h.dayKey(t), found: {}, decoratedAt: 0 } }; StoryR76.r82Ensure(s, t); s.flags.r84cRelicSeen = { old_seed_tag: t, faded_photo: t, ledger_page: t }; }); await focus(page, () => __rc85.focus(__rc85.xy(12, 8))); await cleanAfter(page); },
      check: needs('.r78c-scene-change[data-r78c-route="r82b_relic_old_seed_tag:old_seed_tag"]', "第一件舊物") },
    { id: "branch-seal-decorated", title: "封存線：三件找齊・壓穗鎮誌牌", look: "封存箱旁多了壓穗鎮誌牌，至少跟告示牌一樣大、不疊在封存箱上。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(), DAY = h.DAY; h.finishStory(s, t, "seal"); s.r82branches = { route: "seal", plant: {}, seal: { startDay: h.dayKey(t - 2 * DAY), found: { old_seed_tag: t - 3000, faded_photo: t - 2000, ledger_page: t - 1000 }, decoratedAt: t - 1000 } }; StoryR76.r82Ensure(s, t); s.flags.r84cRelicSeen = { old_seed_tag: t, faded_photo: t, ledger_page: t }; }); await focus(page, focusStation("sign")); await cleanAfter(page); },
      check: needs('.r78c-scene-change[data-r82b-branch="decoration"]', "壓穗鎮誌牌") },
  ] },
  { id: "heirloom", title: "祖母手記（收合與展開）", opening: "sun", shots: ["collapsed", "expanded"].map((mode) => ({
    id: "heirloom-" + mode, title: "祖母手記：" + (mode === "collapsed" ? "收合" : "展開"), look: (mode === "collapsed" ? "收合後一列看得懂下一步、主按鈕還在。" : "展開的祖母手記卡不蓋住要看的田（R84 未解 3：圖 158、159、162）。") + "光快落在第一格。",
    run: async (page) => {
      await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t); h.preview(s, [0], t); });
      await focus(page, () => __rc85.focus(__rc85.tile(0))); await cleanAfter(page);
      /* 按卡片上真的那一顆「收合／展開」鈕（玩家自己按的會被記住，手機也不會再自動收起）。 */
      for (let i = 0; i < 2; i++) {
        const state = await page.evaluate(() => { const d = document.querySelector("#questDock"), b = d && d.querySelector("[data-audit='quest-collapse']"); if (!d) return "none"; const folded = d.classList.contains("quest-collapsed") || d.classList.contains("quest-auto-collapsed") || d.classList.contains("quest-target-collapsed"); return { folded, button: !!b }; });
        if (state === "none" || !state.button || state.folded === (mode === "collapsed")) break;
        await page.evaluate(() => document.querySelector("#questDock [data-audit='quest-collapse']").click());
        await page.waitForTimeout(450);
      }
      await cleanAfter(page);
    },
    check: async (page) => {
      const r = await page.evaluate(() => { const d = document.querySelector("#questDock"); return d ? { quest: d.dataset.quest || "", folded: d.classList.contains("quest-collapsed") || d.classList.contains("quest-auto-collapsed") || d.classList.contains("quest-target-collapsed") } : null; });
      if (!r) return "畫面上沒有任務卡";
      if (r.quest !== "first_sun_basket") return "任務卡不是祖母手記（" + r.quest + "）";
      return r.folded === (mode === "collapsed") ? "" : "卡片沒有" + (mode === "collapsed" ? "收合" : "展開");
    },
  })) },
  { id: "market", title: "早市取捨", opening: "begin", shots: [
    { id: "market-choice", title: "早市二選一：現在收去趕早市，或等光再收", look: "田邊動作列兩顆鈕各寫結果；「等光再收」只出現一次；要選的田不被切在畫面左緣（R84 未解 3：圖 103）。",
      run: async (page) => {
        await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(), active = activePlotCount(s); s.coins = 200; s.stats.plantCount = 9; s.orders = []; s.flags.r79FirstLightHarvest = true; s.flags.r79LightChoiceCount = 0; delete s.flags.r79WaitHarvest; s.stats.harvested = { wheat: 3 }; s.sun.spawned = 1; for (let i = 0; i < active; i++) { s.plots[i].cropId = null; s.plots[i].plantedAt = 0; delete s.plots[i].wateredAt; } h.crop(s, 0, "wheat", t, { ripe: true, wet: true, care: "water" }); Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: t + 9000, nextAt: t + 9000, refractions: 0, introduced: true }); }, null, { keepSelection: true });
        await page.evaluate(() => { const p = __rc85.tile(0); __farm.state().interaction.selectedTileId = p.id; __farm.focusTile(p.id); __farm.clickTile(p.id); __farm.cancelJourney(); __farm.renderSceneActions(); });
        await page.waitForTimeout(900); await stableCamera(page); await cleanAfter(page);
      }, check: needs('#sceneActionBar [data-action="wait_light"]', "田邊動作列的「等光再收」") },
  ] },
  { id: "festival", title: "收穫祭", opening: "begin", shots: [
    { id: "festival-card", title: "收穫祭：任務卡與祭典場景", look: "祭典任務卡的文字與按鈕講同一件事（R84 未解 5：圖 32、65、101）；祭典布置在地圖上。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.main(s, "", t); Object.assign(s.adventure.r61.festival, { unlocked: true, startsAt: t - 1000, endsAt: 0, nextAt: 0 }); }); await page.waitForTimeout(500); await cleanAfter(page); },
      check: needs("#questDock .r69a-festival-now", "祭典任務卡") },
    { id: "festival-stall", title: "收穫祭：祭典攤位", look: "攤位面板一次一層、按鈕看得出能按；面板不被裁切。",
      run: async (page) => {
        await setup(page, () => { const h = __rc85, s = __farm.state(), now = Date.now(); h.main(s, "", now); const f = s.adventure.r61.festival; Object.assign(f, { unlocked: true, startsAt: now, endsAt: now + 600000, nextAt: 0, supportProvisioned: true, judging: null, baseline: { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } } }); Object.assign(s.storage.items, { wheat: 6, carrot: 4, tomato: 4 }); });
        await page.evaluate(() => { const s = __farm.state(), world = document.querySelector("#mapWorld"), size = Math.max(24, Math.round(world.offsetWidth / s.map.width)); FarmWorld.paintWorld(s, size, Date.now()); });
        await page.waitForFunction(() => document.querySelector("[data-festival-stall]"), null, { timeout: 8000 }).catch(() => {});
        await page.evaluate(() => { const st = document.querySelector("[data-festival-stall]"); if (st) { const t = __farm.state().map.tiles.find((x) => x.id === st.dataset.tileId); if (t) __farm.focusTile(t.id); st.click(); } });
        await page.waitForTimeout(700); await cleanAfter(page, { modal: true });
      }, check: needs("#worldModal.show", "祭典攤位面板") },
  ] },
  { id: "kitchen", title: "料理（灶台與看火候）", opening: "begin", shots: [
    { id: "kitchen-list", title: "料理：灶台清單", look: "每道料理有自己的成品圖，不再共用同一個爐子（R84 未解 8：圖 21、57）；按鈕看得出能按。",
      run: async (page) => {
        await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.main(s, "", t); Object.assign(s.storage.items, { wheat: 20, carrot: 12, tomato: 8, strawberry: 6, river_mint: 4, rainwater: 3 }); CookingR75.ensure(s, t); });
        await page.evaluate(() => FarmWorld.openKitchen());
        await page.waitForFunction(() => { const imgs = [...document.querySelectorAll(".recipe-row[data-recipe] .r75b-pot-thumb")]; return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(300); await cleanAfter(page, { modal: true });
      }, check: async (page) => { const r = await page.evaluate(() => { const imgs = [...document.querySelectorAll(".recipe-row[data-recipe] .r75b-pot-thumb")]; return { n: imgs.length, uniq: new Set(imgs.map((i) => i.getAttribute("src"))).size }; }); return r.n === 0 ? "灶台清單沒有開" : r.uniq < r.n ? "有料理共用同一張圖（" + r.uniq + "／" + r.n + "）" : ""; } },
    { id: "kitchen-fire", title: "料理：看火候", look: "看火候畫面只有一層、只有一個關閉鈕；金色區、指針、添柴與掀蓋看得懂。",
      run: async (page) => {
        await page.waitForFunction(() => document.querySelector('[data-r75b-start="rustic_bread"]'), null, { timeout: 8000 }).catch(() => {});
        await page.evaluate(() => document.querySelector('[data-r75b-start="rustic_bread"]')?.click());
        await page.waitForFunction(() => document.querySelector(".r75b-cook-overlay"), null, { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(600); await cleanAfter(page, { modal: true, overlay: true });
      }, check: needs(".r75b-cook-overlay .r75b-cook-card", "看火候畫面") },
    { id: "kitchen-result", title: "料理：成果卡", look: "成果卡上的成品圖就是這道料理；等級、效果、兩顆按鈕清楚。",
      run: async (page) => {
        await page.evaluate(() => document.querySelector(".r75b-cook-overlay [data-r75b-direct]")?.click());
        await page.waitForFunction(() => { const i = document.querySelector("[data-r76a-cook-result] img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(300); await cleanAfter(page, { modal: true, overlay: true });
      }, check: needs("[data-r76a-cook-result]", "料理成果卡") },
  ] },
  { id: "journal", title: "手札", opening: "begin", shots: [
    { id: "journal", title: "手札：現在做與章節", look: "「現在做」跟任務卡同一件事；章節進度數字與子項數一致（R84 未解 1：圖 136、147）。",
      run: async (page) => { await page.waitForTimeout(600); await cleanAfter(page); await page.evaluate(() => { __rc85.weather(__farm.state(), "clear"); FarmWorld.openPanel("story"); }); await page.waitForTimeout(800); await cleanAfter(page, { panel: true }); },
      check: needs("#adventurePanel", "手札") },
  ] },
  { id: "map", title: "地圖／小地圖", opening: "begin", shots: [
    { id: "map-minimap", title: "地圖：一般視角與小地圖", look: "小地圖的位置、主角與目標記號；小地圖不蓋住田與按鈕（手機版依設計不放小地圖，看一般視角）。",
      run: async (page) => { await setup(page, () => {}); await page.evaluate(() => { if (__farm.followPlayer) __farm.followPlayer(); }); await stableCamera(page); await cleanAfter(page); },
      check: async (page) => (await page.evaluate(() => { const m = document.getElementById("worldMinimap"); return !!m && (__rc85.visible("#worldMinimap") || (getComputedStyle(m).display === "none" && (innerWidth < 860 || innerHeight <= 480))); })) ? "" : "畫面上沒有 小地圖" },
    { id: "map-fit", title: "地圖：整圖", look: "整張農場一次看完：田、鄰居、建物、名牌都認得出來。",
      run: async (page) => {
        await setup(page, () => {});
        await page.evaluate(() => { const m = document.getElementById("mapScene"); if (m && m.dataset.mapMode !== "fit") document.getElementById("mapFitToggle")?.click(); });
        await page.waitForFunction(() => document.getElementById("mapScene")?.dataset.mapMode === "fit", null, { timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(400); await cleanAfter(page);
      }, check: async (page) => (await page.evaluate(() => document.getElementById("mapScene")?.dataset.mapMode)) === "fit" ? "" : "沒有切到整圖" },
  ] },
  { id: "weather", title: "天氣", opening: "begin", shots: [
    ...WEATHER_SHOTS.map((w) => ({ id: "weather-" + w.id, title: w.title, look: w.look,
      run: async (page) => { await setup(page, (id) => { const h = __rc85, s = __farm.state(), t = Date.now(); h.level(s, 6); h.weather(s, id, t); for (const i of [0, 1, 2]) h.crop(s, i, "wheat", t, { wet: true, ago: 3000 }); h.noSun(s, t); }, w.id, { keepWeather: true }); await focus(page, () => __rc85.focus(__rc85.tile(1))); await cleanAfter(page); },
      check: async (page) => (await page.evaluate((id) => document.getElementById("weatherLayer")?.className === id, w.id)) ? "" : "天氣層不是 " + w.id })),
    ...WEATHER_SHOTS.map((w) => ({ id: "weather-" + w.id + "-play", title: w.title + "・倒滿桶的水", look: "確認水桶已滿、提示可讀，玩家點得到。",
      run: (page) => badWeatherPlay(page, w.id),
      check: async (page) => page.evaluate((id) => {
        const bucket = document.querySelector('.r85b-barrel[data-stage="full"]');
        if (!bucket || __farm.state().r85Rain.spell?.weather !== id) return "天氣或桶內水量不符";
        const box = bucket.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return bucket.contains(hit) ? "" : "水桶按鈕被遮住";
      }, w.id) })),
    { id: "weather-windy", title: "天氣：微風", look: "風吹白線只在田野地面上，不畫在任務卡、按鈕、提示條與面板上（R84 未解 8：圖 32、82、83）。",
      run: async (page) => { await setup(page, () => { const h = __rc85, s = __farm.state(), t = Date.now(); h.level(s, 6); h.weather(s, "windy", t); for (const i of [0, 1, 2]) h.crop(s, i, "wheat", t, { wet: true, ago: 3000 }); h.noSun(s, t); }, null, { keepWeather: true }); await focus(page, () => __rc85.focus(__rc85.tile(1))); await cleanAfter(page); },
      check: async (page) => (await page.evaluate(() => document.getElementById("weatherLayer")?.className === "windy")) ? "" : "天氣層不是 windy" },
  ] },
  { id: "basket", title: "晨耕種子籃的兩種決定", opening: "begin", shots: ["seed", "sun"].map((key) => ({
    id: "basket-" + key, title: "晨耕種子籃：" + (key === "seed" ? "留種小包" : "晨光小瓶"), look: "兩種決定的地圖物件剪影與顏色明顯不同，縮小也分得出來（R84 未解 8：圖 109、116）。",
    run: async (page) => {
      await setup(page, (key) => { const s = __farm.state(), now = Date.now(); AdventureAPI.ensure(s, now); AdventureAPI.resolveMainStoryChoice(s, "mayor", "farm", now); ChoicesR77.act(s, "mayor", now + 1); ChoicesR77.act(s, "mayor", now + 2, key); }, key);
      await focus(page, focusStation("sign")); await cleanAfter(page);
    }, check: srcHas('.r78c-scene-change[data-r78c-route="mayor:farm"] img:not(.r80c-decision-badge)', "decision-mayor-farm-" + key, "晨耕種子籃"),
  })) },
];

/* ---------- 主流程 ---------- */
function selectShots(scenes, only) {
  const hit = (id) => !only.length || only.some((p) => id === p || (p.endsWith("*") && id.startsWith(p.slice(0, -1))));
  return scenes.map((sc) => ({ ...sc, shots: sc.shots.filter((sh) => hit(sc.id) || hit(sh.id)) })).filter((sc) => sc.shots.length);
}
async function openPage(browser, origin, [width, height], scene, opts) {
  const mobile = width < 860;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: opts.motion ? "no-preference" : "reduce", locale: "zh-TW", deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push("頁面錯誤：" + String(e && e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push("console：" + m.text()); });
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__farm && window.AdventureAPI && window.StoryR76 && window.ChoicesR77 && window.FarmWaitplay && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 45000 });
  await page.evaluate((sel) => document.querySelector(sel)?.click(), scene.opening === "sun" ? "#worldSunBegin" : "#worldBegin");
  await page.waitForTimeout(400);
  await page.evaluate(installHelpers);
  await page.evaluate(() => __rc85.snapshot());
  return { context, page, errors };
}
async function settle(page) {
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter((i) => i.src && !i.complete).map((i) => i.decode().catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.evaluate(() => { if (window.__rc85) __rc85.refocus(); });
  await stableCamera(page);
}
function mdCell(s) { return String(s || "").replace(/\|/g, "／").replace(/\r?\n/g, " "); }

async function main() {
  const opts = parseArgs(process.argv);
  let scenes = SCENES.slice();
  if (opts.extra) scenes = scenes.concat(require(opts.extra));
  scenes = selectShots(scenes, opts.only);
  if (opts.list) { for (const sc of scenes) for (const sh of sc.shots) console.log(sc.id + "／" + sh.id + "：" + sh.title); return 0; }
  let chromium;
  try { ({ chromium } = require(require.resolve("playwright", { paths: [opts.root, REPO] }))); } catch (_) { throw Error("找不到 playwright（repo 的 node_modules 裡要有）"); }
  fs.mkdirSync(opts.out, { recursive: true });
  const server = await serve(opts.root, opts.port), origin = "http://127.0.0.1:" + server.address().port;
  const browser = await launch(chromium);
  const rows = [], started = Date.now();
  let n = 0;
  const version = (() => { try { return (fs.readFileSync(path.join(opts.root, "sw.js"), "utf8").match(/CACHE_VERSION = "([^"]+)"/) || [])[1] || ""; } catch (_) { return ""; } })();
  console.log("評審截圖：" + origin + "（" + opts.root + "）→ " + opts.out);
  try {
    for (const scene of scenes) {
      for (const size of opts.sizes) {
        const tag = size[0] + "x" + size[1];
        let ctx = null;
        try {
          ctx = await openPage(browser, origin, size, scene, opts);
          for (const shot of scene.shots) {
            const errBefore = ctx.errors.length, row = { scene: scene.id, shot: shot.id, title: shot.title, look: shot.look, size: tag, file: "", status: "ok", notes: [] };
            try {
              const r = await shot.run(ctx.page);
              if (r === "skip") { if (!shot.optional) { row.status = "fail"; row.notes.push("擺不出這個畫面"); } else { row.status = "skip"; row.notes.push("這個版本還沒有這個玩法，略過"); } }
              else {
                await settle(ctx.page);
                const problem = shot.check ? await shot.check(ctx.page) : "";
                if (problem) { row.status = "fail"; row.notes.push(problem); }
                n++; row.no = n; row.file = String(n).padStart(3, "0") + "-" + tag + "-" + shot.id + ".png";
                await ctx.page.screenshot({ path: path.join(opts.out, row.file) });
              }
            } catch (e) { row.status = "fail"; row.notes.push("拍攝出錯：" + String(e && e.message || e).split("\n")[0]); }
            const errs = ctx.errors.slice(errBefore); if (errs.length) { row.status = "fail"; row.notes.push(...errs.slice(0, 3)); }
            rows.push(row);
            console.log((row.status === "ok" ? "OK  " : row.status === "skip" ? "SKIP" : "FAIL") + " " + (row.file || tag + " " + shot.id) + (row.notes.length ? "：" + row.notes.join("；") : ""));
          }
        } catch (e) {
          for (const shot of scene.shots) if (!rows.some((r) => r.scene === scene.id && r.shot === shot.id && r.size === tag)) rows.push({ scene: scene.id, shot: shot.id, title: shot.title, look: shot.look, size: tag, file: "", status: "fail", notes: ["開不了頁面：" + String(e && e.message || e).split("\n")[0]] });
          console.log("FAIL " + tag + " " + scene.id + "：" + String(e && e.message || e).split("\n")[0]);
        } finally { if (ctx) await ctx.context.close().catch(() => {}); }
      }
    }
  } finally { await browser.close().catch(() => {}); server.close(); }

  const shotRows = rows.filter((r) => r.file), fails = rows.filter((r) => r.status === "fail"), skips = rows.filter((r) => r.status === "skip");
  const md = [
    "# 陽光農場評審截圖",
    "",
    "- 版本：" + (version || "（讀不到 sw.js 版本）"),
    "- 拍攝時間：" + new Date(started).toISOString() + "，耗時 " + Math.round((Date.now() - started) / 1000) + " 秒",
    "- 遊戲來源：" + opts.root,
    "- 尺寸：" + opts.sizes.map((s) => s[0] + "×" + s[1]).join("、") + "；" + (opts.motion ? "動態照常" : "減少動態（畫面穩定）") + "；軟體繪圖",
    "- 張數：" + shotRows.length + " 張；不是預期畫面或有錯誤：" + fails.length + " 項；略過（玩法還沒進來）：" + skips.length + " 項",
    "- 重拍：`node scripts/review-capture-r85.cjs --out <資料夾> [--port 5123]`",
    "",
    "| 序號 | 尺寸 | 畫面 | 該看什麼 | 檔名 | 狀態 |",
    "|---:|---|---|---|---|---|",
    ...rows.map((r) => "| " + (r.no ? String(r.no).padStart(3, "0") : "—") + " | " + r.size.replace("x", "×") + " | " + mdCell(r.title) + " | " + mdCell(r.look) + " | " + (r.file ? "[" + r.file + "](" + r.file + ")" : "—") + " | " + (r.status === "ok" ? "OK" : r.status === "skip" ? "略過：" + mdCell(r.notes.join("；")) : "**要看**：" + mdCell(r.notes.join("；"))) + " |"),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(opts.out, "index.md"), md, "utf8");
  fs.writeFileSync(path.join(opts.out, "index.json"), JSON.stringify({ version, root: opts.root, sizes: opts.sizes, rows }, null, 1), "utf8");
  console.log("完成：" + shotRows.length + " 張，" + fails.length + " 項要看，" + skips.length + " 項略過 → " + path.join(opts.out, "index.md"));
  return fails.length ? 1 : 0;
}

module.exports = { SCENES, WEATHER_SHOTS, installHelpers, serve, launch, parseArgs };
if (require.main === module) main().then((code) => { process.exitCode = code; }, (e) => { console.error("評審截圖失敗：" + (e && e.stack || e)); process.exitCode = 2; });
