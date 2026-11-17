"use strict";
/* R84A：任務卡全狀態掃描。
   評審每輪都在不同狀態抓到任務卡破版（R83 圖 76、104、129 展開時「等光再收」壓住說明；圖 72 手機收合左邊空白；
   圖 12、17、18、20、152 收合鈕蓋住主按鈕），前幾輪只修被點名的那一種。這支一次列舉所有會出現在任務卡的下一步：
   主線各步（含第 4 章雙做法）、今日三件事、第一餐選路線、祖母手記各步、舊麥種故事各階段、兩條分支各階段、
   早市取捨、等光、折光、收穫祭，每個狀態在 1366×768、1366×600、390×844、844×390 實際開瀏覽器量。
   每個狀態量四種情境（平常、一般提示開著、下方對話框開著、手札側欄開著）× 卡片的四種樣子：
   遊戲自己選的樣子（預設：手機與矮螢幕自動收合、光的決定時排成精簡卡、目標被蓋住時收成一列）、玩家按「展開」、玩家按「收合」，
   以及遊戲把目標避讓成一列時的樣子。只有手機寬度開著手札、卡片照 R58／R82 的設計整張收起時不量；其他時候整張卡不見算破版。
   除錯用環境變數：R84_VIEW=390x844 只跑一個尺寸、R84_ONLY=正規式 只跑名字符合的狀態、R84_LIST=1 列出每個狀態擺到的下一步。
   每一次量：
   1. #questDock 內所有看得到的字（Range.getClientRects 逐行框，被容器裁掉的部分也算進去：字被擠到按鈕底下裁掉一樣算疊）
      與所有按鈕框（含站在田邊時代替主按鈕的狀態字），兩兩交集面積為 0（按鈕自己的字不算跟自己疊；只容許 0.5px 以內的小數點誤差）；
      看得到的那一行字不可以上下被切掉一半（可以捲動的容器捲一下就看得到，不算）。
   2. 每顆看得到的按鈕：scrollWidth 不超過 clientWidth，按鈕本身不被卡片或容器裁掉。
   3. 卡片上一定看得到至少 4 個字的說明（短句、這一步的標題或標題列），不能只剩按鈕或 1/3；收合時這段就是短句。
   4. 主按鈕（或站在田邊時代替按鈕的狀態字）與「收合／展開」鈕都還在畫面上：不准用藏起來的方式讓上面幾條通過。
   5. 高度維持原本上限：收合、目標避讓、手札開著的一列卡都不超過 53px；光的決定時的精簡卡不超過 R80B 的 104px。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const VIEWS = [[1366, 768, false], [1366, 600, false], [390, 844, true], [844, 390, true]];
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
function serve() { return new Promise((resolve, reject) => { const server = http.createServer((req, res) => { const u = new URL(req.url, "http://127.0.0.1"), file = path.resolve(ROOT, "." + (u.pathname === "/" ? "/index.html" : decodeURIComponent(u.pathname))); if (path.relative(ROOT, file).startsWith("..") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(file).pipe(res); }); server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); }); }
async function launch() { const opts = { headless: true, args: ["--no-sandbox"] }; try { return await chromium.launch(opts); } catch (_) {} for (const executablePath of ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]) if (fs.existsSync(executablePath)) try { return await chromium.launch({ ...opts, executablePath }); } catch (_) {} throw Error("No browser available"); }

/* 頁面內：存檔重設、擺狀態的小工具與量測。 */
function install() {
  const cs = (n) => getComputedStyle(n);
  /* 看得到：自己不是 visibility:hidden，往上沒有 display:none 或透明度 0。 */
  const shown = (el) => { if (!el || cs(el).visibility === "hidden") return false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = cs(n); if (c.display === "none" || Number(c.opacity) === 0) return false; } return true; };
  const R = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  /* 框被 root 以內會裁切的容器（overflow 或 clip-path）裁掉之後剩下的部分；整個被裁掉回傳 null。
     可以捲動的容器（overflow auto／scroll，例如手機展開時限高可捲的任務卡）捲一下就看得到，不算裁掉。 */
  const clip = (el, root, r) => {
    let { left, top, right, bottom } = r;
    for (let n = el; n; n = n === root ? null : n.parentElement) {
      const c = cs(n);
      if (c.clipPath && c.clipPath !== "none") return null;
      const scrolls = /auto|scroll/.test(c.overflowY) && n.scrollHeight > n.clientHeight + 1;
      if (c.display !== "contents" && (c.overflowX !== "visible" || c.overflowY !== "visible")) { const b = n.getBoundingClientRect(); left = Math.max(left, b.left); right = Math.min(right, b.right); if (!scrolls) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); } }
    }
    return right - left >= 1 && bottom - top >= 1 ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
  };
  const cross = (a, b) => { const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0.5 && h > 0.5 ? Math.round(w) + "×" + Math.round(h) : ""; };
  const FOLD = ["quest-collapsed", "quest-auto-collapsed", "quest-target-collapsed"];
  /* 不算「說明字」的東西：按鈕、進度數字、代替按鈕的狀態字、收合摘要。 */
  const CONTROL = "button, [data-audit='quest-progress'], .r80b-now-copy, .r69a-collapsed-summary, .r65b-festival-compact";
  /* 收穫祭的「祭典 1/3｜剩 9 分」在手札開著的一列卡裡就是這張卡的那一句（R70 整合），算說明字。 */
  const SENTENCE = ".r69a-festival-now .r69a-collapsed-summary";
  const MAIN = "[data-world-go], [data-early-goal], [data-r69a-festival-go], [data-choice-open], .r80b-now-copy";
  const letters = (el, root) => {
    let n = 0; const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode, p = t.parentElement; if (!shown(p) || (p.closest(CONTROL) && !p.closest(SENTENCE))) continue;
      const s = t.textContent;
      for (let i = 0; i < s.length; i++) {
        if (!/[\p{L}\p{N}]/u.test(s[i])) continue;
        const range = document.createRange(); range.setStart(t, i); range.setEnd(t, i + 1);
        const r = range.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
        const c = clip(p, root, r); if (c && c.width >= r.width * 0.8 && c.height >= r.height * 0.8) n++;
      }
    }
    return n;
  };
  function measure(d) {
    const dc = cs(d), db = d.getBoundingClientRect();
    if (dc.display === "none" || dc.visibility === "hidden" || db.width < 1 || db.height < 1) return { hidden: true, byDesign: !!document.querySelector(".side-panel.world-panel-open") && innerWidth <= 859, cls: d.className };
    /* 字框用 Range.getClientRects 的逐行框，被容器裁掉的部分也算進去（字被按鈕擠到裁掉，一樣算疊）；整行都被裁掉看不到的不算。
       看得到的那一行如果上下被切掉一半，也算破版。 */
    const texts = [], fail = [], walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode, text = t.textContent.trim(); if (!text) continue;
      const el = t.parentElement; if (!shown(el)) continue;
      const range = document.createRange(); range.selectNodeContents(t);
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue; const c = clip(el, d, r); if (!c) continue;
        if (c.height < r.height * 0.75) fail.push("字「" + text.slice(0, 24) + "」上下被切掉（只看得到 " + Math.round(c.height) + "/" + Math.round(r.height) + "px）");
        texts.push({ text: text.slice(0, 24), el, r: R(r) });
      }
    }
    /* 按鈕，以及站在田邊時代替主按鈕的狀態字（「等光再收」那一塊），都當成按鈕框量。 */
    const buttons = [];
    for (const b of d.querySelectorAll("button, .r80b-now-copy")) {
      if (!shown(b)) continue;
      const full = R(b.getBoundingClientRect()); if (full.width < 1 || full.height < 1) continue;
      const vis = clip(b.parentElement, d, full), name = (b.textContent.trim() || b.getAttribute("aria-label") || "").slice(0, 16);
      if (!vis) { fail.push("按鈕「" + name + "」整顆被裁掉看不到"); continue; }
      if (full.width - vis.width > 1 || full.height - vis.height > 1) fail.push("按鈕「" + name + "」被容器裁掉 " + Math.round(full.width - vis.width) + "×" + Math.round(full.height - vis.height) + "px");
      if (b.scrollWidth > b.clientWidth) fail.push("按鈕「" + name + "」文字超出按鈕 " + (b.scrollWidth - b.clientWidth) + "px");
      buttons.push({ el: b, name, r: full });
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) { const x = cross(texts[i].r, texts[j].r); if (x) fail.push("字「" + texts[i].text + "」×字「" + texts[j].text + "」（" + x + "）"); }
    for (const t of texts) for (const b of buttons) { if (b.el.contains(t.el)) continue; const x = cross(t.r, b.r); if (x) fail.push("字「" + t.text + "」×按鈕「" + b.name + "」（" + x + "）"); }
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) { if (buttons[i].el.contains(buttons[j].el) || buttons[j].el.contains(buttons[i].el)) continue; const x = cross(buttons[i].r, buttons[j].r); if (x) fail.push("按鈕「" + buttons[i].name + "」×按鈕「" + buttons[j].name + "」（" + x + "）"); }
    /* 說明字：收合時是短句；一般任務卡是短句或完整句；祖母手記收合時是這一步的短標題；手札開著的一列卡是標題列。 */
    const total = letters(d, d);
    const shortEl = [...d.querySelectorAll(".r82a-guidance-short")].find(shown) || null;
    const main = [...d.querySelectorAll(MAIN)].find((n) => shown(n) && n.getBoundingClientRect().width > 0 && clip(n, d, n.getBoundingClientRect()));
    const mainInDom = !!d.querySelector(MAIN);
    const toggle = d.querySelector("[data-audit='quest-collapse']");
    const toggleShown = !!(toggle && shown(toggle) && toggle.getBoundingClientRect().width > 0 && clip(toggle, d, toggle.getBoundingClientRect()));
    if (total < 4) fail.push("說明字只看得到 " + total + " 個字（不能只剩按鈕或進度）");
    /* R44：對話開著、這一步就是去找人說話時，「前往交談」那顆鈕刻意先藏起來（人已經在說話了）；田裡的動作鈕不在此列。 */
    const r44 = (n) => !!document.querySelector("#worldDialogue:not([hidden])") && /^(talk|claim)$/.test(d.dataset.stepType || "") && n.matches("[data-world-go]") && (!n.dataset.r78bStep || n.dataset.r78bStep === "report") && cs(n).visibility === "hidden";
    if (mainInDom && !main && !r44(d.querySelector(MAIN))) { const n = d.querySelector(MAIN); let why = ""; for (let x = n; x && x !== d.parentElement; x = x.parentElement) { const c = cs(x); if (c.display === "none") { why = "display:none @" + (x.className || x.tagName); break; } if (c.visibility === "hidden") { why = "visibility:hidden @" + (x.className || x.tagName); break; } } if (!why) why = "被裁掉"; fail.push("主按鈕「" + n.textContent.trim().slice(0, 12) + "」被藏起來（" + String(why).slice(0, 60) + "）"); }
    if (!toggleShown) fail.push("收合／展開鈕不見了");
    /* 主按鈕與收合鈕不能被別的畫面層（手札側欄、提示、對話框）蓋住：點中心點，最上層要是它自己。 */
    const covered = (n) => { const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return "在畫面外"; if (y < db.top || y > db.bottom) return ""; /* 限高可捲的卡片裡、捲到下面才看得到的鈕 */ const top = document.elementFromPoint(x, y); return top && (top === n || n.contains(top)) ? "" : String(top ? (top.id ? "#" + top.id : "") + "." + (top.className || top.tagName) : "沒有東西").slice(0, 40); };
    for (const n of [main, toggleShown ? toggle : null]) { if (!n) continue; const by = covered(n); if (by) fail.push("「" + n.textContent.trim().slice(0, 10) + "」被蓋住（" + by + "）"); }
    const folded = FOLD.some((c) => d.classList.contains(c));
    if (folded && d.dataset.quest !== "first_sun_basket" && (!shortEl || letters(shortEl, d) < 4)) fail.push("收合短句只看得到 " + (shortEl ? letters(shortEl, d) : 0) + " 個字");
    /* 祖母手記收合時，左邊那一句是這一步的短標題（R75、R83A）。 */
    const heirTitle = d.dataset.quest === "first_sun_basket" ? d.querySelector(":scope > .world-objective-title") : null;
    if (folded && heirTitle && letters(heirTitle, d) < 4) fail.push("祖母手記收合時短標題只看得到 " + letters(heirTitle, d) + " 個字");
    if (!folded && d.classList.contains("r80b-decision-compact") && db.height > 104.5) fail.push("精簡卡高度 " + Math.round(db.height) + "px 超過 104px 上限");
    if (folded && db.height > 53) fail.push("收合高度 " + Math.round(db.height) + "px 超過 53px 上限");
    if (document.querySelector(".side-panel.world-panel-open") && db.height > 53 && d.dataset.quest !== "early_free_choice") fail.push("手札開著時一列卡高度 " + Math.round(db.height) + "px 超過 53px 上限");
    if (d.scrollWidth - d.clientWidth > 1) fail.push("卡片水平溢出 " + (d.scrollWidth - d.clientWidth) + "px");
    return { hidden: false, cls: d.className, height: Math.round(db.height), letters: total, main: main ? main.textContent.trim().slice(0, 16) : "", fail: [...new Set(fail)] };
  }
  /* 卡片的樣子：預設（遊戲自己選的）、展開、收合，以及任務目標被卡片蓋住時遊戲自己收成的一列（目標避讓；會不會出現要看鏡頭位置，所以每個狀態都量）。 */
  function variants() {
    const d = document.querySelector("#questDock"), saved = d.className, natural = ["quest-auto-collapsed", "quest-target-collapsed", "r80b-decision-compact"].filter((c) => d.classList.contains(c));
    const out = [];
    const take = (name, apply) => { d.className = saved; apply(); out.push(Object.assign({ variant: name }, measure(d))); d.className = saved; };
    take("預設", () => {});
    take("展開", () => d.classList.remove(...FOLD, "r80b-decision-compact"));
    take("收合", () => { d.classList.remove("quest-auto-collapsed"); d.classList.add("quest-collapsed"); });
    take("目標避讓", () => { d.classList.remove("quest-collapsed", "quest-auto-collapsed", "r80b-decision-compact"); d.classList.add("quest-target-collapsed"); });
    return { natural, list: out };
  }
  const deep = (v) => JSON.parse(JSON.stringify(v));
  const KEEP = ["map", "player", "camera", "settings"];
  const h = {
    /* 每個狀態從開場後的同一份存檔開始，上一個狀態改過的東西不帶到下一個。 */
    snapshot() { window.__r84Base = JSON.stringify(__farm.state()); },
    reset() {
      const s = __farm.state(), base = JSON.parse(window.__r84Base);
      for (const k of Object.keys(s)) if (!KEEP.includes(k) && !(k in base)) delete s[k];
      for (const k of Object.keys(base)) if (!KEEP.includes(k)) s[k] = deep(base[k]);
      Object.assign(s.player, base.player); s.player.action = "idle";
      document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove());
      const w = document.querySelector("#worldDialogue"); if (w) w.hidden = true;
      document.querySelector(".side-panel")?.classList.remove("world-panel-open");
      for (const id of ["dailyModal", "worldModal", "settingsModal"]) document.getElementById(id)?.classList.remove("show");
      const z = document.querySelector("#toast-zone"); if (z) z.innerHTML = "";
      return s;
    },
    clear(s) { for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; delete p.sunGrown; } },
    noSun(s, t) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); },
    preview(s, plots, t) { Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: plots, previewAt: t + 40000, nextAt: t + 40000 }); },
    lit(s, plots, t) { Object.assign(s.sun, { plots, used: [], startsAt: t - 1000, endsAt: t + 40000, previewPlots: [], previewAt: 0, nextAt: t + 80000 }); },
    crop(s, i, id, t, o) { o = o || {}; const p = s.plots[i]; p.cropId = id; p.plantedAt = o.ripe ? t - 3600000 : t - (o.ago || 0); if (o.wet) p.wateredAt = p.plantedAt + 1; else delete p.wateredAt; if (o.care) p.careMode = o.care; if (o.sunGrown) p.sunGrown = true; },
    level(s, n) { while (CONFIG.levelFromXp(s.xp) < n) s.xp += 50; s.level = CONFIG.levelFromXp(s.xp); },
    daily(s) { Object.assign(s.adventure.r61.daily, { selected: ["harvest", "market", "forage"], chosen: true }); s.adventure.earlyGoals.marketPreview = true; s.adventure.counts.forage = Math.max(1, s.adventure.counts.forage || 0); },
    /* 主線停在 id 這一件：之前的都領過，祖母手記沒有開（不搶任務卡），田空著、沒有光。 */
    main(s, id, t) {
      s.heirloom.started = false; s.coins = 999; h.level(s, 10); s.stats.plantCount = Math.max(20, s.stats.plantCount || 0);
      for (const q of AdventureAPI.quests(s, t)) { if (q.id === id) break; s.adventure.claimed[q.id] = true; }
      h.daily(s); AdventureAPI.ensure(s, t); h.clear(s); h.noSun(s, t);
    },
    heir(s, t) { s.adventure.claimed = {}; AdventureAPI.ensure(s, t); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; s.stats.harvested = {}; h.clear(s); h.noSun(s, t); },
    story(s, t, choice) { s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; FarmHeirloom.deliver(s, "table", t); s.storage.items.wheat = 0; h.clear(s); h.noSun(s, t); if (choice) StoryR76.r81Choose(s, choice, t); },
    finishStory(s, t, choice) { h.story(s, t, choice); const info = StoryR76.r81Order(s, t); s.storage.items[info.itemId] = info.need; StoryR76.r81Deliver(s, t); StoryR76.r81SceneSeen(s, t); for (const k of Object.keys(s.storage.items)) s.storage.items[k] = 0; },
    done(s) { const t = Date.now(); FarmSunplay.refreshLightCountdown(s.sun, t); s.interaction.selectedTileId = null; __farm.refresh(); FarmWorld.refresh(s); },
    guide() { const g = AdventureAPI.nextGuidance(__farm.state(), Date.now()), d = document.querySelector("#questDock"); return { quest: d.dataset.quest || "", action: g ? g.action : "", scope: g ? g.guidanceScope || "" : "", short: g ? g.short : "", alt: g && g.alternative ? g.alternative.id : "", lightChoice: g ? g.lightChoice || "" : "", festival: !!d.querySelector(".r69a-festival-now"), route: !!d.querySelector("[data-choice-open]"), copy: !!d.querySelector(".r80b-now-copy"), festivalGo: (d.querySelector("[data-r69a-festival-go]") || { dataset: {} }).dataset.r69aFestivalGo || "", nextFestival: !!d.querySelector(".r68a-festival-summary[data-active=\"false\"]"), branch: (() => { const s = __farm.state(), p = StoryR76.r82PlantStatus(s, Date.now()), z = StoryR76.r82SealStatus(s, Date.now()); return p.eligible ? "plant:" + p.stage : z.eligible ? "seal:" + z.foundCount + (z.decorated ? ":decorated" : "") : ""; })() }; },
    variants,
  };
  window.__r84h = h;
}

/* 列舉所有會出現在任務卡的下一步。setup 在頁面裡跑（h = __r84h、s = 存檔、t = 現在），expect 確認真的擺到那個狀態。 */
const STATES = [
  /* 主線各步（第 1 章到第 5 章、做完）。 */
  { name: "主線・新存檔找鎮長", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.noSun(s, t); }, expect: { quest: "c1_homecoming" } },
  { name: "主線・種下第一格", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; s.adventure.byTarget.talk.mayor = 1; h.clear(s); h.noSun(s, t); }, expect: { quest: "c1_homecoming", action: "plant" } },
  { name: "主線・小麥收好找鎮長", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.noSun(s, t); s.storage.items.wheat = 2; }, expect: { quest: "c1_homecoming", action: "report" } },
  { name: "今日三件事・還沒挑", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; s.adventure.claimed.c1_homecoming = true; AdventureAPI.ensure(s, t); h.clear(s); h.crop(s, 0, "wheat", t); h.noSun(s, t); }, expect: { quest: "early_free_choice" } },
  { name: "今日三件事・等光", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; s.adventure.claimed.c1_homecoming = true; AdventureAPI.ensure(s, t); h.clear(s); h.crop(s, 0, "wheat", t); h.preview(s, [0], t); }, expect: { quest: "early_free_choice" } },
  { name: "今日三件事・交小麥給班伯", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; s.adventure.claimed.c1_homecoming = true; AdventureAPI.ensure(s, t); Object.assign(s.adventure.r61.daily, { selected: ["harvest", "market", "forage"], chosen: true }); h.clear(s); h.noSun(s, t); s.storage.items.wheat = 2; }, expect: { quest: "early_free_choice", action: "deliver" } },
  { name: "第一餐選路線", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; s.adventure.claimed.c1_homecoming = true; s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, t); h.daily(s); s.adventure.firstChoice = {}; h.clear(s); h.noSun(s, t); }, expect: { quest: "c1_first_meal" } },
  { name: "第一餐・做麥餅", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; s.adventure.claimed.c1_homecoming = true; s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, t); h.daily(s); h.clear(s); h.noSun(s, t); s.storage.items.wheat = 2; }, expect: { quest: "c1_first_meal", action: "cook" } },
  { name: "第一餐・吃麥餅", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; s.adventure.claimed.c1_homecoming = true; s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, t); h.daily(s); h.clear(s); h.noSun(s, t); s.adventure.meals.rustic_bread = 1; }, expect: { quest: "c1_first_meal", action: "eat" } },
  ...["c2_fishing_dock", "c2_river_basket", "c2_picnic_table", "c3_good_neighbors", "c3_garden", "c3_harvest_picnic", "c4_market_expansion", "c4_tasting_stall", "c4_notice_bench", "c5_festival_tables", "c5_invite_neighbors", "c5_festival_dinner"].map((id) => ({
    name: "主線・" + id, arg: id, setup: (id) => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, id, t); }, expect: { quest: id },
  })),
  /* 第 4 章雙做法：做法甲缺番茄正在長、做法乙的乾貨與石材備了一半。 */
  { name: "第 4 章雙做法・番茄在長", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, "c4_market_expansion", t); h.crop(s, 0, "tomato", t, { wet: true }); s.materials.stone = 2; }, expect: { quest: "c4_market_expansion" } },
  { name: "第 4 章雙做法・番茄熟了", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, "c4_market_expansion", t); h.crop(s, 0, "tomato", t, { ripe: true }); }, expect: { quest: "c4_market_expansion", action: "harvest" } },
  { name: "第 4 章長椅・缺材料", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, "c4_notice_bench", t); s.materials.wood = 0; s.materials.stone = 0; }, expect: { quest: "c4_notice_bench" } },
  { name: "主線・全部做完", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, "", t); }, expect: { quest: "picnic_complete" } },
  /* 光：折光、在光裡照料、等光、早市取捨、催熟（祖母手記沒開，任務卡是主線）。 */
  { name: "折光・光快落在空田", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t, { care: "water" }); h.preview(s, [1], t); s.r75Sunplay.firstRefracted = false; }, expect: { action: "refract" } },
  { name: "折光・熟了先別收", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t, { ripe: true, care: "water" }); h.preview(s, [1], t); s.r75Sunplay.firstRefracted = false; }, expect: { action: "refract" } },
  { name: "光正照著・在光裡澆水", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t); h.lit(s, [0], t); s.r75Sunplay.firstRefracted = true; }, expect: { action: "tend" } },
  { name: "光正照著・在光裡收成", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t, { ripe: true }); h.lit(s, [0], t); s.r75Sunplay.firstRefracted = true; }, expect: { action: "harvest" } },
  { name: "光正照著・還在長", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t, { wet: true }); h.lit(s, [0], t); s.r75Sunplay.firstRefracted = true; }, expect: { action: "wait" } },
  { name: "等光・在光裡澆水", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t); h.preview(s, [0], t); s.r75Sunplay.firstRefracted = true; }, expect: { action: "catch_sun" } },
  { name: "等光再收・教學", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t, { ripe: true, care: "water" }); h.preview(s, [0], t); }, expect: { action: "catch_sun" } },
  { name: "等光再收・已按等光", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t, { ripe: true, care: "water" }); h.preview(s, [0], t); Game.queueLightHarvest(s, 0, t); }, expect: { action: "catch_sun" } },
  { name: "等光再收・先種別格", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); s.stats.harvested.wheat = 3; s.sun.spawned = 1; s.flags.r79FirstLightHarvest = true; delete s.flags.r79LightChoiceCount; h.crop(s, 0, "wheat", t, { ripe: true, care: "water" }); h.preview(s, [0], t); s.adventure.r58.r59.seedPacks.wheat = 2; Game.queueLightHarvest(s, 0, t); }, expect: { action: "plant" } },
  { name: "早市二選一", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); s.stats.harvested.wheat = 3; s.sun.spawned = 1; s.flags.r79FirstLightHarvest = true; delete s.flags.r79LightChoiceCount; h.crop(s, 0, "wheat", t, { ripe: true, care: "water" }); h.preview(s, [0], t); }, expect: { action: "catch_sun", lightChoice: "market" } },
  { name: "早市已選等光", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); s.stats.harvested.wheat = 3; s.sun.spawned = 1; s.flags.r79FirstLightHarvest = true; delete s.flags.r79LightChoiceCount; h.crop(s, 0, "wheat", t, { ripe: true, care: "water" }); h.preview(s, [0], t); Game.queueLightHarvest(s, 0, t); }, expect: { action: "catch_sun" } },
  { name: "用陽光催熟", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t, { wet: true }); h.noSun(s, t); Object.assign(s.r75Sunplay, { sunlight: 2, firstRipened: false, firstRefracted: true }); }, expect: { action: "ripen" } },
  { name: "主線・收成", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.crop(s, 0, "wheat", t, { ripe: true }); h.noSun(s, t); }, expect: { action: "harvest" } },
  /* 祖母手記各步。 */
  { name: "祖母手記・種第一株", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); }, expect: { quest: "first_sun_basket", action: "plant" } },
  { name: "祖母手記・等第一道光（乾）", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t, { care: "water" }); }, expect: { quest: "first_sun_basket", action: "wait" } },
  { name: "祖母手記・等第一道光（濕）", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t, { wet: true }); }, expect: { quest: "first_sun_basket", action: "wait" } },
  { name: "祖母手記・光快落在這株", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t); h.preview(s, [0], t); }, expect: { quest: "first_sun_basket" } },
  { name: "祖母手記・折光", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t); h.preview(s, [1], t); s.r75Sunplay.firstRefracted = false; }, expect: { quest: "first_sun_basket", action: "refract" } },
  { name: "祖母手記・在光裡澆水", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t); h.lit(s, [0], t); s.r75Sunplay.firstRefracted = true; }, expect: { quest: "first_sun_basket", action: "water" } },
  { name: "祖母手記・在光裡播種", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.lit(s, [0], t); }, expect: { quest: "first_sun_basket", action: "plant" } },
  { name: "祖母手記・熟了光快到", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t, { ripe: true, care: "water" }); h.preview(s, [0], t); }, expect: { quest: "first_sun_basket" } },
  { name: "祖母手記・收成", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t, { ripe: true, sunGrown: true }); }, expect: { quest: "first_sun_basket", action: "harvest" } },
  { name: "祖母手記・陽光留在麥穗裡", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); h.crop(s, 0, "wheat", t, { wet: true, sunGrown: true }); }, expect: { quest: "first_sun_basket", action: "wait" } },
  { name: "祖母手記・送餐籃", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; }, expect: { quest: "first_sun_basket", action: "deliver_heirloom" } },
  { name: "祖母手記・兩件挑一件", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); s.adventure.claimed = { c1_homecoming: true }; AdventureAPI.ensure(s, t); s.heirloom.sunWheat = 1; s.stats.harvested = { wheat: 1 }; s.materials.wood = 6; s.materials.stone = 2; }, expect: { quest: "first_sun_basket", alt: "fishing_dock" } },
  { name: "祖母手記・兩件挑一件等光", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.heir(s, t); s.adventure.claimed = { c1_homecoming: true }; AdventureAPI.ensure(s, t); s.heirloom.sunWheat = 1; s.stats.harvested = { wheat: 1 }; s.materials.wood = 6; s.materials.stone = 2; h.crop(s, 0, "wheat", t, { care: "water" }); }, expect: { quest: "first_sun_basket" } },
  /* 舊麥種故事各階段（餐籃送到之後）。 */
  { name: "舊麥種・二選一", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t); }, expect: { action: "story_choice" } },
  { name: "舊麥種・種回田裡缺小麥", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t, "plant"); }, expect: { scope: "r81_story", action: "plant" } },
  { name: "舊麥種・小麥在長", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t, "plant"); h.crop(s, 0, "wheat", t, { wet: true }); }, expect: { scope: "r81_story", action: "wait" } },
  { name: "舊麥種・小麥要澆水", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t, "plant"); h.crop(s, 0, "wheat", t); }, expect: { scope: "r81_story", action: "tend" } },
  { name: "舊麥種・小麥熟了", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t, "plant"); h.crop(s, 0, "wheat", t, { ripe: true }); }, expect: { scope: "r81_story", action: "harvest" } },
  { name: "舊麥種・訂單備齊（班伯）", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t, "plant"); const info = StoryR76.r81Order(s, t); s.storage.items[info.itemId] = info.need; }, expect: { action: "story_order" } },
  { name: "舊麥種・封存缺作物", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t, "seal"); }, expect: { scope: "r81_story" } },
  { name: "舊麥種・訂單備齊（鎮長）", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t, "seal"); const info = StoryR76.r81Order(s, t); s.storage.items[info.itemId] = info.need; }, expect: { action: "story_order" } },
  { name: "舊麥種・聽收尾", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.story(s, t, "plant"); const info = StoryR76.r81Order(s, t); s.storage.items[info.itemId] = info.need; StoryR76.r81Deliver(s, t); }, expect: { action: "story_scene" } },
  /* 兩條分支各階段（故事聽完之後；任務卡回到主線，分支在地圖與手札上）。 */
  { name: "種植線・等你播種", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "plant"); StoryR76.r82Ensure(s, t); }, expect: { branch: "plant:empty" } },
  { name: "種植線・剛種下", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "plant"); const b = StoryR76.r82Ensure(s, t); Object.assign(b.plant, { plantedAt: t - 1000, lightDays: [] }); }, expect: { branch: "plant:growing" } },
  { name: "種植線・照過 1 次光", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "plant"); const b = StoryR76.r82Ensure(s, t); Object.assign(b.plant, { plantedAt: t - 90000000, lightDays: ["2026-11-01"] }); }, expect: { branch: "plant:growing" } },
  { name: "種植線・可以收成", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "plant"); const b = StoryR76.r82Ensure(s, t); Object.assign(b.plant, { plantedAt: t - 190000000, lightDays: ["2026-11-01", "2026-11-02"] }); }, expect: { branch: "plant:ripe" } },
  { name: "種植線・專屬訂單", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "plant"); const b = StoryR76.r82Ensure(s, t); Object.assign(b.plant, { plantedAt: t - 190000000, lightDays: ["2026-11-01", "2026-11-02"], harvestedAt: t - 1000, stock: 2 }); }, expect: { branch: "plant:order" } },
  { name: "種植線・專屬訂單交完", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "plant"); const b = StoryR76.r82Ensure(s, t); Object.assign(b.plant, { plantedAt: t - 190000000, lightDays: ["2026-11-01", "2026-11-02"], harvestedAt: t - 2000, stock: 0, orderAt: t - 1000 }); }, expect: { branch: "plant:done" } },
  { name: "封存線・第一件舊物", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "seal"); StoryR76.r82Ensure(s, t); }, expect: { branch: "seal:0" } },
  { name: "封存線・找到一件", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "seal"); const b = StoryR76.r82Ensure(s, t); const first = StoryR76.R82_RELICS ? StoryR76.R82_RELICS[0].id : Object.keys(b.seal.found)[0]; if (first) b.seal.found[first] = t - 1000; }, expect: { branch: "seal:1" } },
  { name: "封存線・三件找齊擺上鎮誌牌", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.finishStory(s, t, "seal"); const b = StoryR76.r82Ensure(s, t); for (const relic of StoryR76.R82_RELICS) b.seal.found[relic.id] = t - 1000; }, expect: { branch: "seal:3:decorated" } },
  /* 收穫祭：開場的存檔、第五章後的存檔、目標做完可領獎、還沒開場。 */
  { name: "收穫祭・新存檔碰上", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); s.heirloom.started = false; h.clear(s); h.noSun(s, t); Object.assign(s.adventure.r61.festival, { unlocked: true, startsAt: t - 1000, endsAt: 0, nextAt: 0 }); }, expect: { festival: true, festivalGo: "tomato" } },
  { name: "收穫祭・去收作物", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, "", t); Object.assign(s.adventure.r61.festival, { unlocked: true, startsAt: t - 1000, endsAt: 0, nextAt: 0 }); }, expect: { festival: true, festivalGo: "tomato" } },
  { name: "收穫祭・去做料理", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, "", t); Object.assign(s.adventure.r61.festival, { unlocked: true, startsAt: t - 1000, endsAt: 0, nextAt: 0 }); AdventureAPI.festivalStatus(s, t); const f = s.adventure.r61.festival, crop = f.harvestCrop || "tomato"; s.adventure.byTarget.harvest[crop] = (s.adventure.byTarget.harvest[crop] || 0) + 3; }, expect: { festival: true, festivalGo: "cook" } },
  { name: "收穫祭・領獎勵", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, "", t); Object.assign(s.adventure.r61.festival, { unlocked: true, startsAt: t - 1000, endsAt: 0, nextAt: 0 }); AdventureAPI.festivalStatus(s, t); const f = s.adventure.r61.festival, crop = f.harvestCrop || "tomato", a = s.adventure; a.byTarget.harvest[crop] = (a.byTarget.harvest[crop] || 0) + 3; a.counts.cook = (a.counts.cook || 0) + 1; for (const id of ["mayor", "elder"]) a.byTarget.talk[id] = (a.byTarget.talk[id] || 0) + 1; }, expect: { festival: true, festivalGo: "claim" } },
  { name: "收穫祭・下一場預告", setup: () => { const h = __r84h, s = __farm.state(), t = Date.now(); h.main(s, "c5_festival_dinner", t); Object.assign(s.adventure.r61.festival, { unlocked: true, startsAt: 0, endsAt: 0, nextAt: t + 3600000 }); }, expect: { nextFestival: true } },
];

async function sweepView(browser, origin, [width, height, mobile], only) {
  const tag = width + "x" + height, errors = [], failures = [], reached = [];
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  let measured = 0, hiddenByDesign = 0;
  try {
    await page.goto(origin);
    await page.waitForFunction(() => window.__farm && window.StoryR76 && window.AdventureAPI && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
    await page.evaluate(() => document.querySelector("#worldSunBegin,#worldBegin")?.click());
    await page.waitForTimeout(300);
    await page.evaluate(install);
    await page.evaluate(() => __r84h.snapshot());
    for (const st of STATES) {
      if (only && !only.test(st.name)) continue;
      await page.evaluate(() => __r84h.reset());
      await page.evaluate(st.setup, st.arg);
      await page.evaluate(() => __r84h.done(__farm.state()));
      /* 等遊戲自己的定時同步（光的決定、目標避讓、收合）跑過幾輪。 */
      await page.waitForTimeout(650);
      /* 擺好狀態時自己跳出來的提示、泡泡與整頁的故事對話（舊麥種二選一會自動開）先收掉，量玩家關掉之後看到的任務卡。 */
      await page.evaluate(() => { const z = document.querySelector("#toast-zone"); if (z) z.innerHTML = ""; document.querySelectorAll(".npc-bubble,.r76b-dialogue").forEach((n) => n.remove()); });
      const g = await page.evaluate(() => __r84h.guide());
      for (const [k, v] of Object.entries(st.expect || {})) if (g[k] !== v) failures.push(tag + "｜" + st.name + "｜沒有擺到這個狀態：" + k + " 應為 " + JSON.stringify(v) + "，實際 " + JSON.stringify(g));
      reached.push(st.name + "（" + g.quest + "／" + g.action + (g.copy ? "／田邊狀態字" : "") + "）");
      const record = (ctx, out) => { for (const m of out.list) { if (m.hidden) { if (m.byDesign) hiddenByDesign++; else failures.push(tag + "｜" + st.name + "｜" + ctx + "・" + m.variant + "（" + m.cls.replace(/\s+/g, " ").trim() + "）｜整張任務卡不見了"); continue; } measured++; for (const f of m.fail) failures.push(tag + "｜" + st.name + "｜" + ctx + "・" + m.variant + "（" + m.cls.replace(/\s+/g, " ").trim() + "）｜" + f); } };
      record("平常", await page.evaluate(() => __r84h.variants()));
      /* 一般提示開著（祖母寄來的信之類）：任務卡改成一列模式。 */
      record("提示開著", await page.evaluate(() => { const t = document.createElement("div"); t.className = "toast"; t.textContent = "📬 祖母寄來一封信…"; document.querySelector("#toast-zone").appendChild(t); const out = __r84h.variants(); t.remove(); return out; }));
      /* 下方對話框開著。 */
      await page.evaluate(() => FarmWorld.speak("葛瑞", "收成先留一籃，別全拿去賣。"));
      await page.waitForFunction(() => { const d = document.querySelector("#worldDialogue"); return d && !d.hidden; }, null, { timeout: 9000 }).catch(() => {});
      await page.waitForTimeout(320);
      record("對話開著", await page.evaluate(() => { const out = __r84h.variants(); const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true; return out; }));
      /* 手札側欄開著（圖 12、17、20、152）。 */
      await page.evaluate(() => FarmWorld.openPanel("story"));
      await page.waitForTimeout(320);
      record("手札開著", await page.evaluate(() => { const out = __r84h.variants(); document.querySelector(".side-panel")?.classList.remove("world-panel-open"); return out; }));
    }
  } finally { await context.close(); }
  return { tag, errors, failures, reached, measured, hiddenByDesign };
}

module.exports = { STATES, install, serve, launch, VIEWS };
if (require.main === module) (async () => {
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch();
  const only = process.env.R84_ONLY ? new RegExp(process.env.R84_ONLY) : null;
  const views = process.env.R84_VIEW ? VIEWS.filter(([w, h]) => w + "x" + h === process.env.R84_VIEW) : VIEWS;
  let results;
  try { results = await Promise.all(views.map((view) => sweepView(browser, origin, view, only))); }
  finally { await browser.close(); server.close(); }
  let measured = 0, failures = [];
  for (const r of results) {
    console.log("R84A sweep " + r.tag + "：" + r.reached.length + " 個狀態、量了 " + r.measured + " 次（手機開手札時整張卡依設計不顯示 " + r.hiddenByDesign + " 次）、破版 " + r.failures.length + " 筆");
    measured += r.measured; failures = failures.concat(r.failures);
    assert.deepEqual(r.errors, [], r.tag + " 頁面錯誤：" + r.errors.join("；"));
  }
  if (process.env.R84_LIST) console.log(results[0].reached.join("\n"));
  if (failures.length) { console.error(failures.join("\n")); }
  assert.ok(only || results.every((r) => r.reached.length === STATES.length), "每個尺寸都掃完全部狀態");
  assert.deepEqual(failures, [], "任務卡全狀態掃描有 " + failures.length + " 筆破版");
  console.log("VERIFIED content R84A card sweep (" + STATES.length + " states × " + views.length + " sizes, " + measured + " measurements)");
})().catch((error) => { console.error(error && error.message ? error.message.slice(0, 2000) : error); process.exit(1); });
