"use strict";
/* R85A：一個下一步、一顆主按鈕、目標在畫面內。
   規則（Node）：
   1. AdventureAPI.oneStep 是唯一的「下一步」：步驟就是 nowStep（沒有就是主線這一步 guide）；標題寫現在要做的那一件，
      數字只在這一步正好是主線某一列時寫那一列自己的數字，折光、等光這類一次性的步驟不配數字（R84 圖 75、34、52、129）。
   2. 各處接線：任務卡（一般卡、今日三件事）、手札「現在做」與「帶我去」都讀 world-ui 的 presentStep；按下去都走 goStep；
      右下大鈕不再抄任務卡主鈕那一句；祭典那一句跟按鈕同一個動作；來信不把鏡頭從田上拉走；集章小卡讓開一般提示。
   瀏覽器（1366×768、1366×600、390×844、844×390）：
   - 新存檔、第一道光（折光）、在光裡收成、今日三件事（種、收、交付、兩件挑一件）、早市取捨、祖母手記（種、等光）、祭典：
     任務卡標題、任務卡按鈕、手札「現在做」與「帶我去」、右下大鈕講同一件事；同一個動作只有一顆主按鈕、畫面上最多兩組可按的動作；
     手札標題的數字跟底下列出的子項數一致（R84 圖 136、147）；任務卡上能按的東西都有框或底色。
   - 目標在畫面內：按下一步後目標田在畫面上、不被任務卡／祖母手記卡／其他固定介面蓋住；展開的祖母手記卡不蓋田（圖 158、159、162）；
     早市取捨那一格連名牌都不被切在畫面邊緣（圖 103）；在光裡收成後田不離開畫面（圖 93）；大鈕不指向畫面外（圖 133、161）。
   - 844×390 第一枚印章小卡跟祖母來信提示不重疊（R84 未解 9）。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
global.window = global;
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const C = require("../src/config.js");
const State = require("../src/state.js");
const A = require("../src/adventure.js");
const G = require("../src/game.js");
const H = require("../src/heirloom.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const SP = require("../src/sunplay-r75.js");
require("../src/story-r76.js");

const T0 = Date.parse("2026-11-18T08:00:00Z");
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh(now) { const s = State.defaultState(now || T0); A.ensure(s, now || T0); M.ensure(s, now || T0); K.ensure(s, now || T0); s.heirloom.started = false; return s; }
const clearPlots = (s) => { for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } };
const setSun = (s, v) => { s.sun = Object.assign(s.sun || {}, v); return s.sun; };
const sunOff = (s, t) => setSun(s, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000, introduced: true });

/* 每一個狀態都要守的規則：步驟就是 nowStep（或主線這一步）；數字一定是標題那一列自己的。 */
function sameStep(s, t, label) {
  const one = A.oneStep(s, t), now = A.nowStep(s, t), q = A.summary(s, t).currentQuest, g = A.guide(s, t);
  assert.ok(one && one.title, label + "：有一個下一步 " + JSON.stringify(one));
  if (now) {
    assert.deepEqual(one.step, now, label + "：步驟就是 nowStep");
    assert.equal(one.actionLabel, now.actionLabel, label + "：按鈕字就是那一步的按鈕字");
    assert.equal(one.text, now.text, label + "：說明就是那一步的說明");
  } else if (q) {
    assert.equal(one.step, null, label + "：沒有前導步驟時就是主線這一步");
    assert.equal(one.actionLabel, g.actionLabel, label + "：按鈕字是主線這一步的");
    assert.equal(one.text, g.stepText, label + "：說明是主線這一步的");
  }
  if (q && one.progress) {
    const rows = g.route ? [g.step] : (q.objectives || []).concat(q.requirements || []);
    if (/^✓ 回報/.test(one.progress)) assert.ok(q.canClaim, label + "：寫回報時真的可以回報");
    else assert.ok(rows.some((r) => r && !r.complete && r.name === one.title && Math.min(r.current, r.required) + "/" + r.required === one.progress), label + "：「" + one.title + " " + one.progress + "」出自同一列 " + JSON.stringify(rows));
  }
  if (q && !one.progress) assert.ok(one.step, label + "：沒有數字時一定是一次性的那一步（光、祖母手記、故事）");
  return one;
}

test("1-1 新存檔：主線第一步找鎮長，標題、數字、按鈕同一列", () => {
  const s = fresh(), t = T0 + 5;
  const one = sameStep(s, t, "新存檔");
  assert.deepEqual([one.title, one.progress, one.actionLabel, one.source], ["找鎮長葛瑞交談", "0/1", "前往交談", "quest"]);
});

test("1-2 第一道光（R84 圖 75、34、52、129）：按鈕是折光時，標題也是折光，不配「找鎮長葛瑞交談 0/1」", () => {
  const s = fresh(), t = T0 + 10; s.coins = 99;
  assert.equal(G.plant(s, 0, "wheat", t).ok, true); A.record(s, { type: "plant", cropId: "wheat" }, t);
  setSun(s, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [1], previewAt: t + 9000, nextAt: t + 9000, refractions: 0, introduced: true });
  SP.normalize(s).r75Sunplay.firstRefracted = false;
  const one = sameStep(s, t + 1, "第一道光");
  assert.equal(one.action, "refract");
  assert.deepEqual([one.title, one.progress, one.actionLabel], ["把光折到小麥上", "", "把光折過來"]);
  assert.notEqual(A.questFocus(s, t + 1).name, one.title, "主線那一列還是找鎮長，但標題不再借它");
});

test("1-3 在光裡收成、等光、早市取捨：標題寫光的那一步、不配主線數字；收成正好是主線那一列時才配那一列的數字", () => {
  const s = fresh(), t = T0 + 20; s.coins = 99; clearPlots(s);
  A.record(s, { type: "plant", cropId: "wheat" }, t);
  s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t - 3600000; s.plots[0].wateredAt = t - 3600000;
  setSun(s, { plots: [0], used: [], startsAt: t - 1000, endsAt: t + 60000, previewPlots: [], previewAt: 0, nextAt: t + 600000, introduced: true });
  let one = sameStep(s, t, "在光裡收成（第 1 章第一列）");
  assert.deepEqual([one.title, one.progress, one.actionLabel], ["在光裡收成小麥", "", "在光裡收成"]);
  /* 第一個任務完成後（今日三件事），在光裡收成就是「收成老農班伯的開市小麥」那一列。 */
  s.adventure.claimed.c1_homecoming = true; A.ensure(s, t);
  one = sameStep(s, t + 1, "在光裡收成（開市小麥）");
  assert.deepEqual([one.title, one.progress], ["收成老農班伯的開市小麥", "0/2"]);
  /* 熟了、光快到：等光那一步。 */
  setSun(s, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: t + 20000, nextAt: t + 20000 });
  one = sameStep(s, t + 2, "熟麥等光");
  assert.equal(one.action, "catch_sun"); assert.equal(one.progress, "", "等光不配數字");
});

test("1-4 今日三件事：交給班伯那一步寫回報、兩件挑一件仍是同一個下一步", () => {
  const s = fresh(), t = T0 + 30; clearPlots(s); sunOff(s, t);
  s.adventure.claimed.c1_homecoming = true; A.ensure(s, t);
  s.storage.items.wheat = 2; s.stats.harvested = { wheat: 2 }; s.adventure.byTarget.harvest.wheat = 2; s.materials.wood = 6; s.materials.stone = 2;
  const one = sameStep(s, t + 1, "交給班伯");
  assert.equal(one.action, "deliver");
  assert.deepEqual([one.title, one.progress, one.actionLabel], ["找老農班伯回報", "✓ 回報老農班伯", "帶去交付"]);
});

test("1-5 祖母手記、舊麥種故事、第 4 章：各自的標題；第 4 章交番茄配番茄那一列的數字", () => {
  const h = fresh(), t = T0 + 40; h.heirloom.started = true; h.heirloom.delivered = false; h.heirloom.sunWheat = 0; clearPlots(h); sunOff(h, t);
  let one = sameStep(h, t, "祖母手記");
  assert.equal(one.source, "heirloom"); assert.equal(one.title, one.step.title); assert.equal(one.progress, "");
  const d = fresh(); d.heirloom.sunWheat = 2; d.storage.items.wheat = 4;
  assert.equal(H.deliver(d, "table", t).ok, true);
  one = sameStep(d, t + 1, "舊麥種故事");
  assert.equal(one.source, "r81_story"); assert.equal(one.title, "去決定藍布舊麥種");
  const c4 = fresh(); for (const q of A.quests(c4, t)) if (q.chapter <= 3) c4.adventure.claimed[q.id] = true; A.ensure(c4, t);
  c4.storage.items.tomato = 1; c4.level = 8; c4.coins = 999; clearPlots(c4); sunOff(c4, t);
  one = sameStep(c4, t + 2, "第 4 章");
  if (one.step && one.step.questAware) assert.deepEqual([one.title, one.progress], ["番茄", "1/3"], "第 4 章交番茄：番茄 1/3");
});

test("1-6 隨機掃過前十分鐘的存檔：每一拍都守同一套規則", () => {
  const s = fresh(), t0 = T0 + 50; s.coins = 99;
  let t = t0, checked = 0;
  const steps = [() => G.plant(s, 0, "wheat", t), () => A.record(s, { type: "plant", cropId: "wheat" }, t), () => G.plant(s, 1, "wheat", t), () => G.waterPlot && G.waterPlot(s, 0, t)];
  for (let i = 0; i < 120; i++) {
    t += 5000;
    if (steps[i]) try { steps[i](); } catch (_) { /* 這一步做不了就跳過 */ }
    for (const p of s.plots.slice(0, 3)) if (p.cropId && G.getCropProgress(s, p, t).ready && i % 7 === 3) { try { G.harvest(s, s.plots.indexOf(p), t); } catch (_) {} }
    if (i % 11 === 5) setSun(s, { plots: [i % 3], used: [], startsAt: t - 100, endsAt: t + 8000, previewPlots: [], previewAt: 0, nextAt: t + 30000, introduced: true });
    if (i % 11 === 9) setSun(s, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [(i + 1) % 3], previewAt: t + 6000, nextAt: t + 6000, introduced: true });
    A.ensure(s, t); sameStep(s, t, "第 " + i + " 拍"); checked++;
  }
  assert.ok(checked >= 120);
});

test("2-1 接線：任務卡、手札、大鈕只讀同一支；按下去都走 goStep", () => {
  const world = read("src/world-ui.js"), ui = read("src/ui.js"), adv = read("src/adventure.js"), css = read("src/content-r58b.css");
  assert.match(adv, /function oneStep\(state, now\) \{[\s\S]*?const step = nowStep\(state, t\)/, "oneStep 以 nowStep 為準");
  assert.match(adv, /nextGuidance, nowStep, questFocus, oneStep,/, "oneStep 有匯出");
  assert.match(world, /function presentStep\(s, now\) \{[\s\S]*?const one = A\.oneStep\(s, t\)/, "畫面端的 presentStep 讀 A.oneStep");
  assert.match(world, /const present = presentStep\(s, Date\.now\(\)\)/, "任務卡讀 presentStep");
  assert.match(world, /const shownTaskName = present\.kind === "free" \? taskName : present\.title \|\| taskName;/, "任務卡標題就是現在做那一步");
  assert.match(world, /const progressText = present\.kind === "free" \? "" : present\.progress;/, "任務卡數字是那一步自己的");
  assert.match(world, /const goBtn = box\.querySelector\("\[data-world-go\]"\); if \(goBtn\) goBtn\.onclick = \(\) => goStep\(\);/, "任務卡主鈕走 goStep");
  assert.match(world, /function syncMainStoryCard\(\) \{[\s\S]*?const p = presentStep\(current, Date\.now\(\)\);/, "手札開著時同步的現在做讀 presentStep");
  assert.match(world, /const present = main \? presentStep\(current, Date\.now\(\)\) : null;/, "手札目前主線卡讀 presentStep");
  assert.match(world, /b\.dataset\.mainNext \? goStep\(\)/, "手札「帶我去」走 goStep");
  assert.doesNotMatch(world, /function journalQuestStep|function journalGuide/, "手札不再自己算下一步");
  assert.match(world, /window\.FarmWorld\.currentStep = /, "測試與截圖工具讀得到同一個下一步");
  assert.match(ui, /action\.dataset\.r85Dup = offTarget \? "" : r85ThumbDup\(/, "大鈕讓位的判斷");
  assert.doesNotMatch(ui, /if \(guideButton\) targetLabel = guideButton\.textContent\.trim\(\);/, "大鈕不再抄任務卡主鈕那一句");
  assert.match(css, /#actionA:is\(\[data-r85-dup="same"\],\[data-r85-dup="pick"\],\[data-r85-dup="target"\],\[data-r85-dup="offscreen"\]\) \{ visibility: hidden !important; pointer-events: none !important; \}/);
  assert.match(ui, /if \(mailbox && !r85KeepFieldInView\(mailbox\)\) focusCameraOnTile\(mailbox\);/, "來信不把鏡頭從田上拉走（圖 93）");
  assert.match(ui, /clearGuideTarget: \(\) => r85ClearGuideTarget\(\)/, "目標被蓋住時鏡頭讓位");
  assert.match(read("src/sunbook-r76.js"), /document\.querySelectorAll\("#toast-zone > \*"\)\.forEach\(function \(toast\) \{/, "集章小卡讓開一般提示（R84 未解 9）");
  const tail = css.slice(css.lastIndexOf("/* ===== R85A（一個下一步、一顆主按鈕、目標在畫面內）開始 ===== */"));
  assert.ok(tail.length > 50 && /\/\* ===== R85A 結束 ===== \*\//.test(tail), "R85A 樣式接在 content-r58b.css 檔尾");
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, "樣式括號成對");
});

test("2-2 新字是台灣繁中、沒有英文；測試列在 unit 清單", () => {
  for (const text of ["選第一條路線", "早市收成取捨", "田裡的番茄還不夠，先去種。", "田裡的番茄熟了，去收。"]) { assert.doesNotMatch(text, /[A-Za-z]/); assert.doesNotMatch(text, /[,!?;:]/); }
  const guard = read("scripts/guard-validation-writes.js"), list = guard.slice(guard.indexOf("const unit=["), guard.indexOf("];", guard.indexOf("const unit=[")));
  assert.match(list, /"node scripts\/test-content-r85-one-step\.js",/, "新測試在 unit 清單裡");
  assert.ok(list.indexOf("test-content-r85-one-step") > list.indexOf("test-content-r84-consistency"), "接在 R84 後面");
});

/* ---------------- 瀏覽器 ---------------- */
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch(chromium) { const opts = { headless: true, args: ["--no-sandbox", "--disable-gpu"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("找不到可用瀏覽器"); }
const overlap = (a, b) => { if (!a || !b) return 0; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0.5 && h > 0.5 ? Math.round(w * h) : 0; };

function install() {
  const shown = (el) => { if (!el || el.hidden) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false; } return true; };
  const box = (el) => { if (!shown(el)) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
  const alpha = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(",").map(Number); return p.length > 3 ? p[3] : 1; };
  const clean = (n) => n ? n.textContent.replace(/\s+/g, " ").trim() : "";
  window.__r85 = {
    shown, box,
    claim(map) { const s = __farm.state(); s.adventure.claimed = Object.assign({}, map); s.adventure.quests = {}; AdventureAPI.ensure(s, Date.now()); return s; },
    clear() {
      document.querySelectorAll(".r76b-dialogue,.npc-bubble,.r75b-cook-overlay").forEach((n) => n.remove());
      const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true;
      document.querySelector(".side-panel")?.classList.remove("world-panel-open");
      for (const id of ["dailyModal", "worldModal", "settingsModal"]) { if (document.getElementById(id)?.classList.contains("show") && __farm.closeModal) __farm.closeModal(id); document.getElementById(id)?.classList.remove("show"); }
      if (!document.querySelector(".modal.show")) document.body.classList.remove("modal-open");
      if (window.FarmSunbook && FarmSunbook.hideCard) FarmSunbook.hideCard();
      document.querySelector("#toast-zone").innerHTML = "";
    },
    /* 任務卡此刻：標題、數字、現在做、主鈕（或田邊狀態字）、兩件挑一件、能按的東西看不看得出是按鈕。 */
    dock() {
      const d = document.querySelector("#questDock");
      const main = [...d.querySelectorAll("[data-world-go], [data-early-goal], [data-r69a-festival-go], [data-choice-open]")].find((b) => b.tagName === "BUTTON" && shown(b)) || null;
      const copy = [...d.querySelectorAll(".r80b-now-copy")].find(shown) || null;
      const task = d.querySelector(".r71a-task-name") || d.querySelector(".r80b-objective-task") || d.querySelector(".world-objective-title");
      const full = d.querySelector(".r82a-guidance-full"), short = d.querySelector(".r82a-guidance-short");
      const plain = [...d.querySelectorAll("button")].filter(shown).filter((b) => { const c = getComputedStyle(b); const border = parseFloat(c.borderTopWidth) > 0 && c.borderTopStyle !== "none" && alpha(c.borderTopColor) > 0.2; const bg = alpha(c.backgroundColor) > 0.2 || c.backgroundImage !== "none"; return !border && !bg; }).map(clean);
      const picks = [...d.querySelectorAll("[data-r82c-pick-alt], [data-r83a-heirloom-alt]")].filter(shown).map(clean);
      return { quest: d.dataset.quest || "", targetId: d.dataset.targetId || "", task: task ? clean(task).replace(/^任務：/, "") : "", progress: clean([...d.querySelectorAll('[data-audit="quest-progress"]')].find(shown) || null), full: full ? full.textContent.trim() : "", short: short ? short.textContent.trim() : "", main: clean(main), mainBox: box(main), copy: clean(copy), plain, picks, box: box(d) };
    },
    thumb() { const a = document.querySelector("#actionA"); return { text: clean(a), shown: shown(a), box: box(a), dup: a ? a.dataset.r85Dup || "" : "", off: a ? a.dataset.r83aOffTarget || "" : "" }; },
    bar() { const bar = document.querySelector("#sceneActionBar"); return [...(bar ? bar.querySelectorAll("button:not([disabled])") : [])].filter(shown).map(clean); },
    step() { return FarmWorld.currentStep(); },
    /* 目標那一格（含頭上的名牌）在畫面哪裡、被什麼蓋住。 */
    target(id) {
      const tid = id || document.querySelector("#questDock").dataset.targetId;
      const tile = document.querySelector('.gtile[data-tile-id="' + tid + '"]'), t = tile ? tile.getBoundingClientRect() : null;
      const lab = document.querySelector("#tileStateLabel"), l = lab && !lab.hidden && lab.dataset.tileId === tid && shown(lab) ? box(lab) : null;
      const huds = { dock: "#questDock", seed: ".seed-hud", mini: "#worldMinimap", head: "header > *", farmDock: "#farmDock", pad: "#mobileControls .dpad", thumb: "#actionA", chip: "#sunChip", stamp: "#r76cStampCard", settle: "#toast-zone .settlement-card", dialogue: "#worldDialogue" };
      const tb = t && t.width ? { left: t.left, top: t.top, right: t.right, bottom: t.bottom } : null;
      const covered = {};
      for (const [k, sel] of Object.entries(huds)) for (const n of document.querySelectorAll(sel)) { const b = box(n); if (!b || !tb) continue; const w = Math.min(b.right, tb.right) - Math.max(b.left, tb.left), h = Math.min(b.bottom, tb.bottom) - Math.max(b.top, tb.top); if (w > 1 && h > 1) covered[k] = Math.round(w * h); }
      return { id: tid, tile: tb, label: l, covered, vw: innerWidth, vh: innerHeight };
    },
  };
}

async function until(page, fn, arg, ms, label) { try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch (_) { throw new Error(label + "（等了 " + ms + " 毫秒）"); } }
async function clear(page) { await page.evaluate(() => __r85.clear()); await page.waitForTimeout(300); await page.evaluate(() => __r85.clear()); }
async function setup(page, fn) { await page.evaluate(fn); await page.evaluate(() => { const s = __farm.state(); __farm.refresh(); FarmWorld.refresh(s); }); await clear(page); await page.waitForTimeout(500); }
async function journal(page) {
  await page.evaluate(() => FarmWorld.openPanel("story")); await page.waitForTimeout(300);
  const j = await page.evaluate(() => { const card = document.querySelector("#adventurePanel [data-r63a-main-story]"); if (!card) return null; const b = card.querySelector("[data-quest-go]"); return { now: card.querySelector(".r68a-card-now small")?.textContent.trim() || "", button: b ? b.textContent.trim() : "", title: b ? b.title : "", progress: card.querySelector(".r68a-card-head > span:last-child")?.textContent.trim() || "", rows: [...card.querySelectorAll(".r68a-card-requirements span")].map((n) => n.textContent.trim()).filter((t) => /^[✓○]/.test(t)), expect: (() => { const q = AdventureAPI.summary(__farm.state(), Date.now()).currentQuest, rows = (q.objectives || []).concat(q.requirements || []); return rows.filter((row) => row.complete).length + "/" + rows.length; })() }; });
  await page.evaluate(() => document.querySelector(".side-panel")?.classList.remove("world-panel-open")); await page.waitForTimeout(150);
  return j;
}

/* 一、各處講同一件事、只有一顆主按鈕。 */
async function sameThing(page, tag, what, opts) {
  opts = opts || {};
  const r = await page.evaluate(() => ({ dock: __r85.dock(), thumb: __r85.thumb(), bar: __r85.bar(), step: __r85.step() }));
  const info = tag + " " + what + " " + JSON.stringify(r);
  const st = r.step;
  assert.ok(st, info + "：有現在做那一步");
  /* 今日三件事的標題列擠著「今日三件事 n/3」與挑選鈕，只寫這一步的按鈕字（同一步）；數字是今日三件事自己的。 */
  if (r.dock.quest === "early_free_choice") assert.equal(r.dock.task, st.kind === "festival" || st.title === "早市收成取捨" ? st.title : st.label, info + "：今日三件事的標題寫現在做那一步");
  else if (r.dock.quest !== "first_sun_basket") {
    assert.equal(r.dock.task, st.title, info + "：任務卡標題就是現在做那一步");
    assert.equal(r.dock.progress, st.progress, info + "：任務卡數字是那一步自己的（沒有就不寫）");
  }
  if (r.dock.full) assert.equal(r.dock.full, st.text, info + "：任務卡「現在做」就是那一步");
  const action = r.dock.main || r.dock.copy;
  if (action && !r.dock.copy) assert.equal(r.dock.main, st.label, info + "：任務卡主鈕就是那一步的按鈕字");
  assert.deepEqual(r.dock.plain, [], info + "：任務卡上能按的東西都有框或底色");
  if (r.thumb.shown) {
    assert.notEqual(r.thumb.text, r.dock.main, info + "：右下大鈕跟任務卡主鈕不寫同一句");
    assert.ok(!(r.dock.main && r.dock.targetId && r.thumb.dup === "target"), info);
    assert.equal(r.dock.picks.length, 0, info + "：任務卡擺著兩件挑一件時大鈕讓位");
  }
  const groups = [r.dock.main ? "任務卡" : "", r.thumb.shown ? "大鈕" : "", r.bar.length ? "田邊動作列" : ""].filter(Boolean);
  assert.ok(groups.length <= 2, info + "：同一時間最多兩組可按的動作（不出現第三個）" + groups.join("、"));
  if (!opts.skipJournal) {
    const j = await journal(page);
    if (j) {
      const st2 = await page.evaluate(() => __r85.step());
      assert.equal(j.now, st2.text, info + "：手札「現在做」跟任務卡同一步 " + JSON.stringify(j));
      assert.equal(j.title, st2.label, info + "：手札「帶我去」做的是同一件事 " + JSON.stringify(j));
      assert.equal(j.progress, j.expect, info + "：手札標題的數字是這個任務的子項完成幾項 " + JSON.stringify(j));
      if (j.rows.length) assert.equal(j.progress, j.rows.filter((t) => t.startsWith("✓")).length + "/" + j.rows.length, info + "：手札標題的數字跟底下列出的子項數一致（圖 136、147） " + JSON.stringify(j));
    }
  }
  return r;
}

function checkTarget(m, tag, what, allow) {
  const info = tag + " " + what + " " + JSON.stringify(m);
  assert.ok(m.tile, info + "：找得到目標那一格");
  assert.ok(m.tile.left >= -1 && m.tile.top >= -1 && m.tile.right <= m.vw + 1 && m.tile.bottom <= m.vh + 1, info + "：目標整格在畫面內");
  for (const [k, v] of Object.entries(m.covered)) if (!(allow || []).includes(k)) assert.equal(v, 0, info + "：目標不被 " + k + " 蓋住");
  if (m.label) assert.ok(m.label.left >= -1 && m.label.right <= m.vw + 1, info + "：名牌不被切在畫面邊緣（圖 103）");
}
async function measureTarget(page, id) {
  let m = null;
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(300); m = await page.evaluate((id) => __r85.target(id), id); if (m.tile && !Object.keys(m.covered).length && m.tile.left >= -1 && m.tile.right <= m.vw + 1 && m.tile.top >= -1 && m.tile.bottom <= m.vh + 1) break; }
  return m;
}

async function states(page, tag, mobile) {
  let checks = 0;
  /* 1. 新存檔第一分鐘（稍後再看便箋）：主線第一步找鎮長。 */
  await setup(page, () => { const s = __r85.claim({}); s.heirloom.started = false; s.sun.introduced = true; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: Date.now() + 600000 }); });
  let r = await sameThing(page, tag, "新存檔");
  assert.deepEqual([r.step.title, r.step.progress, r.step.label], ["找鎮長葛瑞交談", "0/1", "前往交談"], tag + " 新存檔第一步");
  checks++;

  /* 2. 種下第一格後第一道光（R84 圖 75、34、52、129）：標題、按鈕、手札、大鈕都講折光。 */
  await setup(page, () => { const s = __r85.claim({}), t = Date.now(); s.heirloom.started = false; s.coins = 99; AdventureAPI.record(s, { type: "plant", cropId: "wheat" }, t); for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; s.plots[0].careMode = "water"; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [1], previewAt: t + 15000, nextAt: t + 15000, refractions: 0, introduced: true }); FarmSunplay.normalize(s).r75Sunplay.firstRefracted = false; FarmSunplay.refreshLightCountdown(s.sun, t); });
  r = await sameThing(page, tag, "第一道光");
  assert.deepEqual([r.step.title, r.step.progress, r.step.label], ["把光折到小麥上", "", "把光折過來"], tag + " 第一道光 " + JSON.stringify(r.step));
  checkTarget(await measureTarget(page), tag, "第一道光的那一格"); checks++;

  /* 3. 今日三件事：兩件挑一件時大鈕讓位；交給班伯那一步寫回報。 */
  await setup(page, () => { const s = __r85.claim({ c1_homecoming: true }), t = Date.now(); s.heirloom.started = false; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.storage.items.wheat = 2; s.stats.harvested = { wheat: 2 }; s.adventure.byTarget.harvest.wheat = 2; s.materials.wood = 6; s.materials.stone = 2; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); });
  r = await sameThing(page, tag, "今日三件事交給班伯");
  assert.deepEqual([r.step.title, r.step.label], ["找老農班伯回報", "帶去交付"], tag + " 交給班伯 " + JSON.stringify(r.step));
  checks++;

  /* 4. 早市取捨（圖 103）：那一格連名牌都在畫面內、不貼著邊緣被切掉。 */
  await setup(page, () => { const s = __r85.claim({}), t = Date.now(); s.heirloom.started = false; s.coins = 200; s.stats.plantCount = 9; s.stats.harvested = { wheat: 3 }; s.flags.r79FirstLightHarvest = true; s.flags.r79LightChoiceCount = 0; delete s.flags.r79WaitHarvest; s.sun.spawned = 1; s.orders = [{ id: "shown_wheat", wants: { wheat: 4 }, rewardCoins: 29, rarity: "common", firstBatch: true, expiresAt: null, npcId: "merchant" }]; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].careMode = "water"; s.plots[0].plantedAt = t - 3600000; s.plots[0].wateredAt = t - 3600000; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: t + 25000, nextAt: t + 25000, refractions: 0, introduced: true }); FarmSunplay.refreshLightCountdown(s.sun, t); s.interaction.selectedTileId = null; });
  r = await sameThing(page, tag, "早市取捨");
  assert.equal(r.step.title, "早市收成取捨", tag + " 早市取捨的標題");
  checkTarget(await measureTarget(page), tag, "早市取捨那一格", ["thumb"]); checks++;

  /* 5. 祖母手記・等光，玩家把卡展開（圖 158、159、162）：要看的那株小麥不被卡蓋住。 */
  await setup(page, () => { const s = __r85.claim({ c1_homecoming: true }), t = Date.now(); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; s.stats.harvested = {}; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; s.plots[0].careMode = "water"; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: t + 30000, nextAt: t + 30000 }); FarmSunplay.refreshLightCountdown(s.sun, t); s.interaction.selectedTileId = null; });
  await page.evaluate(() => { const d = document.querySelector("#questDock"); if (/collapsed/.test(d.className)) d.querySelector(".quest-collapse-btn")?.click(); });
  await page.waitForTimeout(400);
  r = await sameThing(page, tag, "祖母手記展開");
  assert.equal(r.dock.quest, "first_sun_basket", tag + " 祖母手記卡");
  assert.ok(!/collapsed/.test(await page.evaluate(() => document.querySelector("#questDock").className)), tag + " 卡真的展開著");
  checkTarget(await measureTarget(page), tag, "祖母手記展開時那株小麥"); checks++;

  /* 6. 大鈕不指向畫面外（圖 133、161）：祖母手記帶去看小麥、主角站在告示牌旁；按任務卡主鈕後鏡頭帶到那一格、不被卡蓋住。 */
  await setup(page, () => { const s = __r85.claim({}), t = Date.now(); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; s.plots[0].careMode = "water"; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); s.interaction.selectedTileId = null;
    const sign = s.map.tiles.find((x) => x.station === "sign"), dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (const [name, [dx, dy]] of Object.entries(dirs)) { const tile = s.map.tiles.find((x) => x.x === sign.x - dx && x.y === sign.y - dy); if (tile && !tile.object && !tile.station && !tile.npc && tile.plotIndex == null && !tile.structureId && !tile.buildingId && tile.terrain !== "water") { s.player.tileId = tile.id; s.player.x = tile.x; s.player.y = tile.y; s.player.facing = name; s.player.action = "idle"; break; } }
    __farm.focusTile(s.player.tileId); });
  await page.waitForTimeout(2800);
  r = await sameThing(page, tag, "主角在告示牌旁", { skipJournal: true });
  const off = await page.evaluate(() => { const m = __r85.target(), a = __r85.thumb(); return { m, a }; });
  if (off.a.shown) { const center = off.m.tile ? (off.m.tile.left + off.m.tile.right) / 2 : -1; assert.ok(!/告示牌/.test(off.a.text), tag + " 大鈕不寫告示牌 " + JSON.stringify(off)); assert.notEqual(off.a.text, r.dock.main, tag + " 大鈕不抄任務卡 " + JSON.stringify(off)); assert.ok(center >= 0 && center <= off.m.vw, tag + " 大鈕不指向畫面外 " + JSON.stringify(off)); }
  await page.locator("#questDock [data-world-go]").first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  checkTarget(await measureTarget(page), tag, "按下一步後鏡頭帶到那株小麥", ["thumb"]); checks++;

  /* 7. 在光裡收成（圖 93）：按任務卡主鈕收成以後，田不離開畫面（來信提示不把鏡頭拉去信箱）。 */
  await setup(page, () => { const s = __r85.claim({}), t = Date.now(); s.heirloom.started = false; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[2].cropId = "wheat"; s.plots[2].plantedAt = t - 3600000; s.plots[2].wateredAt = t - 3600000; Object.assign(s.sun, { plots: [2], used: [], startsAt: t - 1000, endsAt: t + 60000, previewPlots: [], previewAt: 0, nextAt: t + 600000, introduced: true }); s.letters = s.letters || {}; window.__r85Plot = s.map.tiles.find((x) => x.plotIndex === 2).id; });
  r = await sameThing(page, tag, "在光裡收成", { skipJournal: true });
  assert.deepEqual([r.step.title, r.step.progress, r.step.label], ["在光裡收成小麥", "", "在光裡收成"], tag + " 在光裡收成 " + JSON.stringify(r.step));
  await page.locator("#questDock [data-world-go]").first().click({ timeout: 8000 });
  await until(page, () => !__farm.state().plots[2].cropId, null, 15000, tag + " 收成完成");
  await page.waitForTimeout(3000);
  const plot = await page.evaluate(() => __r85.target(window.__r85Plot));
  assert.ok(plot.tile && plot.tile.left >= -1 && plot.tile.right <= plot.vw + 1 && plot.tile.top >= -1 && plot.tile.bottom <= plot.vh + 1, tag + " 收成後田還在畫面上 " + JSON.stringify(plot));
  checks++;

  /* 8. 祭典（圖 32、65、101）：「現在做」那一句跟按鈕是同一個動作。 */
  await setup(page, () => { const s = __r85.claim({}), t = Date.now(); s.heirloom.started = false; for (const q of AdventureAPI.quests(s, t)) if (q.chapter <= 4) s.adventure.claimed[q.id] = true; AdventureAPI.ensure(s, t); Object.assign(s.adventure.r61.festival, { unlocked: true, startsAt: t - 1000, endsAt: 0, nextAt: 0 }); });
  r = await sameThing(page, tag, "祭典", { skipJournal: true });
  const fest = await page.evaluate(() => { const n = document.querySelector("#questDock .r69a-festival-now"); const b = n && n.querySelector("[data-r69a-festival-go]"); return n ? { short: n.querySelector(".r82a-guidance-short")?.textContent.trim() || "", full: n.querySelector(".r82a-guidance-full")?.textContent.trim() || "", button: b ? b.textContent.trim() : "", dock: document.querySelector("#questDock").textContent, extra: [...document.querySelectorAll("#questDock [data-festival-field]")].filter(__r85.shown).length } : null; });
  assert.ok(fest && fest.button, tag + " 祭典的現在做 " + JSON.stringify(fest));
  assert.equal(fest.short, "祭典：" + fest.button, tag + " 祭典短句跟按鈕同一個動作 " + JSON.stringify(fest));
  if (/^去種/.test(fest.button)) assert.match(fest.full, /先去種/, tag + " 長句也說先去種 " + JSON.stringify(fest));
  assert.equal(fest.extra, 0, tag + " 祭典「現在做」已有按鈕時，送種子的說明不再多一顆做同一件事的按鈕");
  if (/小麥/.test(fest.button)) assert.doesNotMatch(fest.dock, /先去種番茄/, tag + " 這一場要收小麥時不寫「先去種番茄」");
  checks++;
  return checks;
}

/* 844×390 第一枚印章小卡跟祖母來信提示同時出現（R84 未解 9）。 */
async function stampVsLetter(page, tag) {
  await clear(page);
  await page.evaluate(() => { __farm.toast("📬 祖母寄來一封信…"); });
  await page.waitForTimeout(150);
  await page.evaluate(() => FarmSunbook.showCard([{ cropId: "radish", stampId: "lit", text: "追光手冊：櫻桃蘿蔔・光裡收成（櫻桃蘿蔔 1／1 枚）", first: true }]));
  await until(page, () => __r85.shown(document.querySelector("#r76cStampCard")), null, 5000, tag + " 小卡出現");
  let worst = 0, last = null;
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    last = await page.evaluate(() => ({ card: __r85.box(document.querySelector("#r76cStampCard")), toasts: [...document.querySelectorAll("#toast-zone > *")].map(__r85.box).filter(Boolean), dock: __r85.box(document.querySelector("#questDock")) }));
    if (!last.card) continue;
    for (const t of last.toasts.concat([last.dock])) worst = Math.max(worst, overlap(last.card, t));
    await page.waitForTimeout(120);
  }
  assert.equal(worst, 0, tag + " 小卡不壓祖母來信提示與任務卡 " + JSON.stringify(last));
  await clear(page);
  return 1;
}

async function browserChecks() {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch (error) { throw new Error("缺 playwright：" + error.message); }
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch(chromium);
  let checks = 0;
  try {
    for (const [w, h, mobile] of VIEWS) {
      const tag = w + "×" + h, ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(origin);
      await page.waitForFunction(() => window.__farm && window.StoryR76 && window.AdventureAPI && window.FarmWorld && FarmWorld.currentStep && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
      await page.evaluate(() => document.querySelector("#worldBegin")?.click());
      await page.waitForTimeout(400);
      await page.evaluate(install);
      checks += await states(page, tag, mobile);
      if (w === 844 && h === 390) checks += await stampVsLetter(page, tag);
      assert.deepEqual(errors, [], tag + " 沒有頁面錯誤");
      console.log("PASS 瀏覽器 " + tag);
      await ctx.close();
    }
  } finally { await browser.close(); await new Promise((done) => server.close(done)); }
  return checks;
}

if (process.argv.includes("--rules-only")) {
  if (!process.exitCode) console.log(`R85 one-step rules: ${passed} passed (no browser)`);
} else {
  browserChecks().then((checks) => {
    passed++;
    console.log("PASS 瀏覽器檢查 " + checks + " 項");
    console.log(passed + " passed");
    if (!process.exitCode) console.log("VERIFIED content R85A one step, one button, target in view");
  }).catch((error) => { console.error("FAIL 瀏覽器檢查\n" + (error && error.stack || error)); process.exitCode = 1; });
}
