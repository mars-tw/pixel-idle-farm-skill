"use strict";
/* R83A 第 7 項：四種尺寸實際開瀏覽器量——
   1. 收合任務卡：每一段看得到的字（逐字框，含被容器裁掉的部分）兩兩交集面積為 0；左邊只剩一種字（短句），
      右邊的狀態（等光再收／按鈕）與進度數字不疊；展開時也不疊字（上下兩行字框只容許行高造成的細縫）。
   2. 對話開著時（下方對話框、逐句對話框），整個畫面沒有「有底色、有框、字卻全被藏起來」的空白卡；對話期間重畫也一樣。
   3. 祖母手記卡收合時看得到這一步的短標題（不只剩 1/3），有第二件可挑時有一顆看得到、點得到的次要小鈕，而且不擠掉短標題。
   4. 任務卡帶玩家去某一格時，右下大鈕不寫身旁不相干的東西（告示牌）；走到目標旁才寫目標。
   5. 同畫面不矛盾：田成熟後不留「還沒成熟／還在長」提示；收掉的空地不留「收成」鈕；任務卡短句與按鈕講同一件事。
   6. 真的按交付鈕把餐籃交給鎮長、真的把舊麥種爭執點到最後，「找鎮長葛瑞交談」照一般規則完成，鎮長頭上的「!」消失；
      按「晚點再說」或一般鎮長對話不算（1366×768 與 390×844）。 */
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

/* 頁面內的量測工具。 */
function install() {
  const cs = (n) => getComputedStyle(n);
  /* 看得到：自己不是 visibility:hidden，往上沒有 display:none 或透明度 0。 */
  const shown = (el) => { if (!el || cs(el).visibility === "hidden") return false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = cs(n); if (c.display === "none" || Number(c.opacity) === 0) return false; } return true; };
  const box = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
  /* 字框被 root 以內會裁切的容器（overflow 或 clip-path）裁掉之後剩下的部分；小於 1×3px 視為看不到。 */
  const clip = (el, root, r) => {
    let { left, top, right, bottom } = r;
    for (let n = el; n; n = n === root ? null : n.parentElement) {
      const c = cs(n);
      if (c.clipPath && c.clipPath !== "none") return null;
      if (c.display !== "contents" && (c.overflowX !== "visible" || c.overflowY !== "visible")) { const b = n.getBoundingClientRect(); /* display: contents 沒有自己的框，不裁切 */ left = Math.max(left, b.left); top = Math.max(top, b.top); right = Math.min(right, b.right); bottom = Math.min(bottom, b.bottom); }
    }
    return right - left >= 1 && bottom - top >= 3 ? { left, top, right, bottom } : null;
  };
  function runs(root) {
    const out = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode, text = t.textContent.trim(); if (!text) continue;
      const el = t.parentElement; if (!shown(el)) continue;
      const range = document.createRange(); range.selectNodeContents(t);
      for (const r of range.getClientRects()) { if (r.width < 1 || r.height < 1) continue; const c = clip(el, root, r); if (c) out.push({ text: text.slice(0, 30), el, cls: String(el.className || el.tagName).slice(0, 60), r: c }); }
    }
    return out;
  }
  /* 兩兩交集。strict：面積 > 0 就算疊；loose：只有上下重疊超過較矮字框 25% 才算（展開時上下兩行的行高細縫不算疊字）。 */
  function hits(list, strict) {
    const out = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].r, b = list[j].r, w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w <= 0 || h <= 0) continue;
      if (!strict && h <= 0.25 * Math.min(a.bottom - a.top, b.bottom - b.top)) continue;
      out.push(list[i].text + " × " + list[j].text + "（" + Math.round(w) + "×" + Math.round(h) + "）");
    }
    return out;
  }
  const painted = (c) => { const bg = c.backgroundColor, bw = parseFloat(c.borderTopWidth) || 0; return (bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg)) || c.backgroundImage !== "none" || (bw > 0 && c.borderTopStyle !== "none" && !/rgba\([^)]*,\s*0\)$/.test(c.borderTopColor)); };
  /* 空白卡：自己看得到、有底色或邊框、在畫面裡至少 24×24，裡面有字，但每一段字都被藏起來，也沒有看得到的圖。 */
  function blank() {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (/^(SCRIPT|STYLE|svg|path|IMG|CANVAS|VIDEO)$/i.test(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
      if (!shown(el)) continue;
      const c = cs(el); if (!painted(c)) continue;
      const texts = []; const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) if (walker.currentNode.textContent.trim()) texts.push(walker.currentNode);
      if (!texts.length) continue;
      if (texts.some((t) => shown(t.parentElement))) continue;
      if ([...el.querySelectorAll("img")].some((img) => shown(img))) continue;
      out.push((el.id ? "#" + el.id : "") + "." + String(el.className || el.tagName).slice(0, 50) + " " + JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }));
    }
    return out;
  }
  function dock() {
    /* R84 整合同步：遊戲每次重畫會依情況重新決定卡片樣子（光的決定精簡卡、目標被蓋住時自動收成一列），
       C 線把前十分鐘的光改密後重畫更頻繁；setFold 指定的樣子若在等待中被改回，量之前在同一步重新套用，量的內容與門檻不變。 */
    const fold = window.__r83Fold; if (fold) { const d0 = document.querySelector("#questDock"); d0.classList.remove("quest-collapsed", "quest-auto-collapsed", "quest-target-collapsed", "r80b-decision-compact"); if (fold === "collapsed") d0.classList.add("quest-collapsed"); window.__r83Fold = ""; }
    const d = document.querySelector("#questDock"), list = runs(d), collapsed = /quest-(auto-|target-)?collapsed/.test(d.className);
    /* 按鈕、狀態字、進度，以及收合時排在右側的標題列（只留進度，今日三件事另留這四個字）都算右側狀態，不算左邊的字。 */
    const headSel = ".r68a-objective-head, .r67a-objective-head, .world-chapter";
    const control = (el) => !!el.closest(".quest-collapse-btn, button, .r80b-now-copy, [data-audit='quest-progress']") || (collapsed && !!el.closest(headSel + ", .r69a-collapsed-summary"));
    const statusEl = [...d.querySelectorAll(":scope > :is(.r67a-now,.r68a-now) .r69a-collapsed-summary")].find((n) => shown(n) && n.getBoundingClientRect().width > 0) || null;
    /* 祭典收合時 R70A 把章節標題用 clip-path 收成看不到的一條（留給輔助閱讀），不算畫面上的標題列。 */
    const headEl = [...d.querySelectorAll(headSel)].find((n) => n.parentElement === d && shown(n) && n.getBoundingClientRect().width > 0 && cs(n).clipPath === "none") || null;
    /* 收合列左邊那一種字：一般任務卡是 R82A 的短句；祖母手記卡是這一步的短標題（R75 規定一列模式要看得到標題）。 */
    const shortEl = [...d.querySelectorAll(".r82a-guidance-short")].find(shown) || (d.dataset.quest === "first_sun_basket" ? [...d.querySelectorAll(":scope > .world-objective-title")].find(shown) : null) || null;
    const fullEl = [...d.querySelectorAll(".r82a-guidance-full")].find(shown) || null;
    const main = [...d.querySelectorAll("[data-world-go], [data-choice-open], .r80b-now-copy, [data-early-goal], [data-r69a-festival-go]")].find(shown) || null;
    const alt = [...d.querySelectorAll("[data-r83a-heirloom-alt]")].find(shown) || null;
    const progress = [...d.querySelectorAll("[data-audit='quest-progress']")].find(shown) || null;
    return {
      cls: d.className, quest: d.dataset.quest || "", collapsed, height: Math.round(box(d).height), overflow: d.scrollWidth - d.clientWidth,
      runs: list.map((x) => x.text + "@" + [x.r.left, x.r.top, x.r.right, x.r.bottom].map(Math.round).join(",")),
      strict: hits(list, true), loose: hits(list, false),
      leftTexts: [...new Set(list.filter((x) => !control(x.el)).map((x) => x.text))],
      short: shortEl ? shortEl.textContent.trim() : "", shortBox: shortEl ? box(shortEl) : null, shortCut: (() => { const c = shortEl && (shortEl.closest("small, .world-objective-detail") || shortEl); return !!c && c.scrollWidth > c.clientWidth + 1; })(), full: fullEl ? fullEl.textContent.trim() : "", title: (d.querySelector(".r82a-guidance-full") || { textContent: "" }).textContent.trim(),
      main: main ? main.textContent.trim() : "", mainStep: main ? main.dataset.r78bStep || "" : "", mainChoice: !!(main && main.hasAttribute("data-choice-open")), mainFestival: !!(main && main.hasAttribute("data-r69a-festival-go")), mainBox: main ? box(main) : null,
      alt: alt ? { text: alt.textContent.trim(), title: alt.title, box: box(alt), hit: (() => { const b = box(alt), top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!top && (top === alt || alt.contains(top)); })() } : null,
      progress: progress ? progress.textContent.trim() : "", dockBox: box(d),
      headBox: headEl ? box(headEl) : null, statusBox: statusEl ? box(statusEl) : null, statusText: statusEl ? statusEl.textContent.trim() : "", headTexts: headEl ? [...new Set(list.filter((x) => headEl.contains(x.el)).map((x) => x.text))] : [],
    };
  }
  window.__r83 = { runs, hits, blank, dock, shown };
}

const G = (page) => page.evaluate(() => { const g = AdventureAPI.nextGuidance(__farm.state(), Date.now()); return g ? { text: g.text, short: g.short, title: g.title || "", action: g.action, label: g.actionLabel, alt: g.alternative ? g.alternative.id : "" } : null; });
async function clearOverlays(page) { await page.evaluate(() => { document.querySelectorAll(".r76b-dialogue,.npc-bubble").forEach((n) => n.remove()); const d = document.querySelector("#worldDialogue"); if (d) d.hidden = true; document.querySelector(".side-panel")?.classList.remove("world-panel-open"); for (const id of ["dailyModal", "worldModal", "settingsModal"]) document.getElementById(id)?.classList.remove("show"); const z = document.querySelector("#toast-zone"); if (z) z.innerHTML = ""; }); await page.waitForTimeout(60); }
async function setFold(page, mode) {
  /* 一般提示（例如祖母寄來的信）開著時任務卡會改成一列模式；量「展開」前先等提示走完。 */
  if (mode === "expanded") await page.waitForFunction(() => !document.querySelector("#toast-zone > *"), null, { timeout: 9000 }).catch(() => page.evaluate(() => { document.querySelector("#toast-zone").innerHTML = ""; }));
  await page.evaluate((mode) => { const d = document.querySelector("#questDock"); d.classList.remove("quest-collapsed", "quest-auto-collapsed", "quest-target-collapsed", "r80b-decision-compact"); if (mode === "collapsed") d.classList.add("quest-collapsed"); window.__r83Fold = mode; }, mode);
  await page.waitForTimeout(80);
}
async function rerender(page) { await page.evaluate(() => { const s = __farm.state(); __farm.refresh(); FarmWorld.refresh(s); }); await page.waitForTimeout(150); }

/* 收合：不疊字、左邊只有短句、短句與按鈕在卡內同一列、高度維持原本 53px 上限。 */
function checkCollapsed(m, tag, what) {
  const info = JSON.stringify(m);
  assert.equal(m.collapsed, true, tag + " " + what + "：真的在收合狀態");
  assert.deepEqual(m.strict, [], tag + " " + what + "：收合時每段字框交集面積為 0 " + info);
  assert.ok(m.short, tag + " " + what + "：收合時看得到短句 " + info);
  assert.equal(m.shortCut, false, tag + " " + what + "：短句不被裁掉 " + info);
  assert.deepEqual(m.leftTexts, [m.short], tag + " " + what + "：收合列左邊只有一種字（短句） " + info);
  assert.ok(m.height <= 53, tag + " " + what + "：收合高度維持 53px 上限 " + info);
  if (m.statusBox) {
    assert.ok(m.statusBox.left >= m.shortBox.right - 1 && (!m.mainBox || m.statusBox.left >= m.mainBox.right - 1), tag + " " + what + "：收合摘要排在短句與按鈕右邊當狀態 " + info);
    assert.match(m.statusText, /^今日三件事 \d+\/3$/, tag + " " + what + "：收合摘要只寫今日三件事與進度 " + info);
  }
  if (m.headBox) {
    assert.ok(m.headBox.left >= m.shortBox.right - 1, tag + " " + what + "：收合時標題列只留在短句右側當狀態 " + info);
    assert.ok(m.headTexts.every((t) => /^\d+\/\d+$/.test(t) || t === "今日三件事"), tag + " " + what + "：右側狀態只有進度（今日三件事另留這四個字），不畫章節名與任務名 " + info);
  }
  assert.ok(m.overflow <= 1, tag + " " + what + "：不水平溢出 " + info);
  const inside = (b) => b.left >= m.dockBox.left - 1 && b.right <= m.dockBox.right + 1 && b.top >= m.dockBox.top - 1 && b.bottom <= m.dockBox.bottom + 1;
  assert.ok(inside(m.shortBox), tag + " " + what + "：短句在卡內 " + info);
  if (m.mainBox) { assert.ok(inside(m.mainBox), tag + " " + what + "：按鈕在卡內 " + info); assert.ok(Math.min(m.shortBox.bottom, m.mainBox.bottom) - Math.max(m.shortBox.top, m.mainBox.top) > 0, tag + " " + what + "：短句與按鈕同一列 " + info); }
}
function checkExpanded(m, tag, what) {
  assert.equal(m.collapsed, false, tag + " " + what + "：真的在展開狀態");
  assert.deepEqual(m.loose, [], tag + " " + what + "：展開時不疊字 " + JSON.stringify(m));
}
/* 任務卡的字與按鈕講同一件事：按鈕是具體下一步時短句就是 nextGuidance 的短句；按鈕是主線那一步時，短句是完整句裡那一步的名稱；按鈕是「選擇下一步」時短句也是先選路線。 */
function checkSameThing(m, g, tag, what) {
  const info = JSON.stringify({ short: m.short, full: m.full, main: m.main, step: m.mainStep, guidance: g });
  if (!m.short) { assert.ok(m.full, tag + " " + what + "：展開時看得到完整句 " + info); return; } /* 桌面展開讀完整句，短句不顯示。 */
  if (m.mainChoice) assert.equal(m.short, "先選下一步", tag + " " + what + "：按鈕是選擇下一步，短句也是 " + info);
  else if (m.mainFestival) assert.match(m.short, /^祭典|祭典獎勵/, tag + " " + what + "：按鈕是祭典那一步，短句也是祭典 " + info);
  else if (m.mainStep) assert.equal(m.short, g.short, tag + " " + what + "：按鈕是 nextGuidance 那一步，短句也讀它 " + info);
  else { const full = m.full || m.title; if (full) assert.ok(full.includes(m.short), tag + " " + what + "：按鈕是主線這一步，短句是同一步的名稱 " + info); }
}

async function cardStates(page, tag, mobile) {
  let checks = 0;
  const both = async (what, opts) => {
    opts = opts || {};
    await clearOverlays(page);
    await setFold(page, "collapsed"); let m = await page.evaluate(() => __r83.dock()); checkCollapsed(m, tag, what); const g = await G(page); if (!opts.skipSame) checkSameThing(m, g, tag, what + "（收合）"); if (opts.collapsed) opts.collapsed(m, g); checks++;
    await setFold(page, "expanded"); m = await page.evaluate(() => __r83.dock()); checkExpanded(m, tag, what); if (!opts.skipSame) checkSameThing(m, g, tag, what + "（展開）"); checks++;
    /* 展開時有一般提示或下方對話框：任務卡改成一列模式，一樣不疊字（圖 3、4、14 是這一種）。 */
    await clearOverlays(page);
    await page.evaluate(() => { const t = document.createElement("div"); t.className = "toast"; t.textContent = "📬 祖母寄來一封信…"; document.querySelector("#toast-zone").appendChild(t); });
    await page.waitForTimeout(100);
    m = await page.evaluate(() => __r83.dock()); assert.deepEqual(m.strict, [], tag + " " + what + "：提示開著時不疊字 " + JSON.stringify(m)); checks++;
    await clearOverlays(page);
    await page.evaluate(() => FarmWorld.speak("葛瑞", "收成先留一籃，別全拿去賣。"));
    await page.waitForFunction(() => { const d = document.querySelector("#worldDialogue"); return d && !d.hidden; }, null, { timeout: 9000 });
    await page.waitForTimeout(100);
    m = await page.evaluate(() => __r83.dock()); assert.deepEqual(m.strict, [], tag + " " + what + "：對話開著時不疊字 " + JSON.stringify(m)); checks++;
    await clearOverlays(page);
    return m;
  };
  /* 一、新存檔：主線第一步是找鎮長葛瑞交談，按鈕「前往交談」，收合短句不能寫成農務的「去田邊種小麥」（圖 127 同型）。 */
  await page.evaluate(() => { const s = __farm.state(); s.heirloom.started = false; s.sun.introduced = true; });
  await rerender(page);
  await both("新存檔找鎮長", { collapsed: (m) => { assert.equal(m.main, "前往交談", tag + " 新存檔按鈕"); assert.equal(m.short, "找鎮長葛瑞交談", tag + " 新存檔收合短句跟按鈕同一件事 " + JSON.stringify(m)); assert.equal(m.progress, "0/1", tag + " 進度還看得到"); } });
  /* 一之二、同一個存檔碰上河畔收穫祭：收合列換成祭典短句，章節標題不佔畫面。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(), f = s.adventure.r61.festival; Object.assign(f, { unlocked: true, startsAt: t - 1000, endsAt: 0, nextAt: 0 }); });
  await rerender(page);
  assert.ok(await page.evaluate(() => !!document.querySelector("#questDock .r69a-festival-now")), tag + " 進到祭典的現在做");
  await both("祭典進行中");
  await page.evaluate(() => { const f = __farm.state().adventure.r61.festival; Object.assign(f, { unlocked: false, startsAt: 0, endsAt: 0, nextAt: 0 }); });
  /* 二、第一次種下：任務按鈕「把光折過來」（圖 91、97、128）。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); s.coins = 200; s.adventure.byTarget.talk.mayor = 0; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; s.plots[0].careMode = "water"; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [1], previewAt: t + 7000, nextAt: t + 7000, refractions: 0 }); FarmSunplay.refreshLightCountdown(s.sun, t); });
  await rerender(page);
  await both("第一次折光");
  /* 三、熟田等光：按鈕是狀態字「等光再收」，右邊不與 0/1 疊（圖 92、98、100、105、107、130）。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(), p = s.plots[0]; p.cropId = "wheat"; p.plantedAt = t - 3600000; p.wateredAt = t - 3600000; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: t + 7000, nextAt: t + 7000 }); FarmSunplay.refreshLightCountdown(s.sun, t); const tile = s.map.tiles.find((x) => x.plotIndex === 0); __farm.refresh(); FarmWorld.refresh(s); __farm.clickTile(tile.id); __farm.cancelJourney(); });
  await page.waitForTimeout(250);
  await both("熟田等光", { skipSame: true });
  /* 四、今日三件事（圖 3、4、11、13、14）。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); s.adventure.claimed.c1_homecoming = true; AdventureAPI.ensure(s, t); for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: t + 7000, nextAt: t + 7000 }); FarmSunplay.refreshLightCountdown(s.sun, t); s.interaction.selectedTileId = null; });
  await rerender(page);
  assert.equal(await page.evaluate(() => document.querySelector("#questDock").dataset.quest), "early_free_choice", tag + " 進到今日三件事");
  await both("今日三件事");
  /* 四之二、今日三件事做完、第一餐還沒選路線（圖 41、54、55）：按鈕與字講同一件事。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); s.adventure.claimed.c1_first_harvest = true; AdventureAPI.ensure(s, t); Object.assign(s.adventure.r61.daily, { selected: ["harvest", "market", "forage"], chosen: true }); s.adventure.earlyGoals.marketPreview = true; s.adventure.counts.forage = Math.max(1, s.adventure.counts.forage || 0); s.adventure.firstChoice = {}; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); });
  await rerender(page);
  assert.equal(await page.evaluate(() => document.querySelector("#questDock").dataset.quest), "c1_first_meal", tag + " 進到第一餐");
  await both("第一餐選路線");
  /* 五、第 4 章番茄（圖 30）。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); s.coins = 999; s.stats.plantCount = 20; while (CONFIG.levelFromXp(s.xp) < 8) s.xp += 50; s.level = CONFIG.levelFromXp(s.xp); for (const q of AdventureAPI.quests(s, t)) if (q.chapter < 4) s.adventure.claimed[q.id] = true; AdventureAPI.ensure(s, t); for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.storage.items.tomato = 0; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); });
  await rerender(page);
  await both("第 4 章番茄");
  return checks;
}

async function heirloomStates(page, tag, mobile) {
  let checks = 0;
  const fresh = async (setup) => { await page.evaluate(setup); await rerender(page); await clearOverlays(page); };
  /* 祖母手記・種第一株：收合時看得到短句，不只剩 1/3（圖 120）。 */
  await fresh(() => { const s = __farm.state(), t = Date.now(); s.adventure.claimed = {}; AdventureAPI.ensure(s, t); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; s.stats.harvested = {}; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); s.interaction.selectedTileId = null; });
  assert.equal(await page.evaluate(() => document.querySelector("#questDock").dataset.quest), "first_sun_basket", tag + " 祖母手記卡");
  let g = await G(page);
  await setFold(page, "collapsed"); let m = await page.evaluate(() => __r83.dock());
  checkCollapsed(m, tag, "祖母手記種第一株"); assert.equal(m.short, g.title, tag + " 祖母手記收合時看得到這一步的短標題（nextGuidance 的 title），不只剩 1/3 " + JSON.stringify(m)); assert.equal(m.alt, null, tag + " 沒有第二件時不放次要鈕"); checks++;
  await setFold(page, "expanded"); m = await page.evaluate(() => __r83.dock()); checkExpanded(m, tag, "祖母手記種第一株"); checks++;
  /* 第一次收成後兩件挑一件：收合也看得到「還有另一件可挑」，點得到，短句還在。 */
  await fresh(() => { const s = __farm.state(), t = Date.now(); s.adventure.claimed = { c1_homecoming: true }; AdventureAPI.ensure(s, t); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 1; s.stats.harvested = { wheat: 1 }; s.materials.wood = 6; s.materials.stone = 2; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); s.interaction.selectedTileId = null; });
  g = await G(page);
  assert.equal(g.alt, "fishing_dock", tag + " 這個狀態有第二件可挑 " + JSON.stringify(g));
  await setFold(page, "collapsed"); m = await page.evaluate(() => __r83.dock());
  checkCollapsed(m, tag, "祖母手記兩件挑一件"); assert.equal(m.short, g.title, tag + " 兩件挑一件時短標題還在 " + JSON.stringify(m));
  assert.ok(m.alt && /另一件/.test(m.alt.text + m.alt.title), tag + " 收合時看得到「還有另一件可挑」 " + JSON.stringify(m));
  assert.ok(m.alt.hit && m.alt.box.height >= 44 && m.alt.box.width >= 44, tag + " 次要鈕點得到、至少 44px " + JSON.stringify(m.alt));
  checks++;
  /* 較長的短標題（等第一道光落下）配主鈕「看看這株小麥」：收合仍放得下、不裁字。 */
  await fresh(() => { const s = __farm.state(), t = Date.now(); s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; s.plots[0].careMode = "water"; });
  g = await G(page);
  await setFold(page, "collapsed"); m = await page.evaluate(() => __r83.dock());
  checkCollapsed(m, tag, "祖母手記等光"); assert.equal(m.short, g.title, tag + " 等光短標題 " + JSON.stringify(m)); checks++;
  await fresh(() => { const s = __farm.state(); s.plots[0].cropId = null; s.plots[0].plantedAt = 0; });
  await setFold(page, "expanded"); m = await page.evaluate(() => __r83.dock()); checkExpanded(m, tag, "祖母手記兩件挑一件");
  assert.equal(m.alt, null, tag + " 展開時用原本並排的「去修釣台」，不再多一顆小鈕");
  assert.equal(await page.evaluate(() => [...document.querySelectorAll("#questDock [data-r82c-pick-alt]")].filter((b) => __r83.shown(b) && !b.hasAttribute("data-r83a-heirloom-alt")).length), 1, tag + " 展開時有原本的「去修釣台」");
  checks++;
  return checks;
}

async function dialogueBlank(page, tag) {
  /* 回到 R82 圖 114／120 的情境：祖母手記卡＋下方對話框（以及逐句對話框），對話期間任務卡、種子列都會重畫。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); s.adventure.claimed = { c1_homecoming: true }; AdventureAPI.ensure(s, t); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.interaction.selectedTileId = null; __farm.refresh(); FarmWorld.refresh(s); });
  await clearOverlays(page);
  const sample = (kind) => page.evaluate(async (kind) => {
    const found = new Set();
    if (kind === "speak") FarmWorld.speak("葛瑞", "收成先留一籃，別全拿去賣。");
    else StoryR76.openDialogue(__farm.state(), "elder", ["老麥要配新麥一起曬，種才養得回來。"], { speaker: "老農班伯", dataset: { r61bStory: "elder" } });
    const t0 = performance.now();
    await new Promise((resolve) => { const frame = () => { const dt = performance.now() - t0; if (dt > 120 && dt < 140) __farm.refresh(); if (dt > 360 && dt < 380) { __farm.refresh(); FarmWorld.refresh(__farm.state()); } __r83.blank().forEach((x) => found.add(x)); if (dt < 900) requestAnimationFrame(frame); else resolve(); }; requestAnimationFrame(frame); });
    const open = kind === "speak" ? !document.querySelector("#worldDialogue").hidden : !!document.querySelector(".r76b-dialogue");
    return { open, blank: [...found] };
  }, kind);
  let r = await sample("speak");
  assert.equal(r.open, true, tag + " 下方對話框開著");
  assert.deepEqual(r.blank, [], tag + " 下方對話框開著時沒有空白卡（圖 114／120）");
  await clearOverlays(page);
  r = await sample("story");
  assert.equal(r.open, true, tag + " 逐句對話框開著");
  assert.deepEqual(r.blank, [], tag + " 鄰居故事對話開著時沒有空白卡");
  await clearOverlays(page);
  return 2;
}

async function thumbButton(page, tag) {
  /* 祖母手記正帶玩家去看那株小麥，主角站在告示牌旁、面向告示牌（圖 161）。 */
  const setup = await page.evaluate(() => {
    const s = __farm.state(), t = Date.now();
    s.adventure.claimed = {}; AdventureAPI.ensure(s, t); s.heirloom.started = true; s.heirloom.delivered = false; s.heirloom.sunWheat = 0; s.stats.harvested = {};
    for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; }
    s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; s.plots[0].careMode = "water";
    Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 });
    s.interaction.selectedTileId = null;
    const sign = s.map.tiles.find((x) => x.station === "sign");
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    let stand = null, facing = "";
    for (const [name, [dx, dy]] of Object.entries(dirs)) { const tile = s.map.tiles.find((x) => x.x === sign.x - dx && x.y === sign.y - dy); if (tile && !tile.object && !tile.station && !tile.npc && tile.plotIndex == null && !tile.structureId && !tile.buildingId && tile.terrain !== "water") { stand = tile; facing = name; break; } }
    s.player.tileId = stand.id; s.player.x = stand.x; s.player.y = stand.y; s.player.facing = facing; s.player.action = "idle";
    __farm.refresh(); FarmWorld.refresh(s);
    return { sign: sign.id, stand: stand.id, facing };
  });
  await clearOverlays(page);
  await page.waitForTimeout(700);
  let r = await page.evaluate(() => { const a = document.querySelector("#actionA"), d = document.querySelector("#questDock"), main = d.querySelector("[data-world-go]"); return { text: a.textContent.trim(), shown: __r83.shown(a) && a.getBoundingClientRect().width > 0, off: a.dataset.r83aOffTarget, target: d.dataset.targetId, quest: d.dataset.quest, main: main ? main.textContent.trim() : "" }; });
  assert.equal(r.quest, "first_sun_basket", tag + " 祖母手記正在帶路 " + JSON.stringify(r));
  assert.ok(r.target && r.target !== setup.sign, tag + " 任務卡的目標是那株小麥 " + JSON.stringify(r));
  assert.ok(!(r.shown && /告示牌/.test(r.text)), tag + " 右下大鈕不寫身旁的告示牌 " + JSON.stringify(r));
  /* R85A 同步（R85 計畫 A 線第 2 項，R84 圖 95、128、160：任務卡與右下大鈕寫同一句）：同一個動作只留任務卡那一顆主鈕，
     大鈕不再抄那一句（原本 R83A 讓大鈕改寫任務卡那一步）；身旁不相干的告示牌照舊不寫。玩家按任務卡主鈕。 */
  assert.equal(r.off, "true", tag + " 身旁不相干的東西讓大鈕收起 " + JSON.stringify(r));
  assert.ok(!(r.shown && r.text === r.main), tag + " 大鈕不跟任務卡主鈕寫同一句 " + JSON.stringify(r));
  await page.evaluate(() => { window.__r83Pressed = 0; document.querySelector("#questDock [data-world-go]").addEventListener("click", () => { window.__r83Pressed++; }); });
  await page.locator("#questDock [data-world-go]").first().tap({ timeout: 8000 });
  assert.equal(await page.evaluate(() => window.__r83Pressed), 1, tag + " 任務卡主鈕按得到");
  /* 走到目標田旁、面向它：大鈕寫那一格。 */
  await page.evaluate(() => {
    const s = __farm.state(), target = s.map.tiles.find((x) => x.id === document.querySelector("#questDock").dataset.targetId);
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (const [name, [dx, dy]] of Object.entries(dirs)) { const tile = s.map.tiles.find((x) => x.x === target.x - dx && x.y === target.y - dy); if (tile && !tile.object && !tile.station && !tile.npc && tile.plotIndex == null && !tile.structureId && !tile.buildingId && tile.terrain !== "water") { s.player.tileId = tile.id; s.player.x = tile.x; s.player.y = tile.y; s.player.facing = name; break; } }
    __farm.refresh(); FarmWorld.refresh(s);
  });
  await page.waitForTimeout(700);
  r = await page.evaluate(() => { const a = document.querySelector("#actionA"), main = document.querySelector("#questDock [data-world-go]"); return { text: a.textContent.trim(), off: a.dataset.r83aOffTarget, shown: __r83.shown(a) && a.getBoundingClientRect().width > 0, main: main ? main.textContent.trim() : "" }; });
  assert.notEqual(r.off, "true", tag + " 站在目標田旁時大鈕不算身旁不相干的東西 " + JSON.stringify(r));
  assert.ok(!(r.shown && r.text === r.main), tag + " 也不跟任務卡主鈕寫同一句（R85A 同步） " + JSON.stringify(r));
  return 2;
}

/* 第 3 項：真的按祖母手記的交付鈕、真的把舊麥種那段對話點到最後，「找鎮長葛瑞交談」照一般規則完成，鎮長頭上的「!」跟著消失。 */
async function mayorTalk(page, tag, mobile) {
  const press = (sel) => mobile ? page.locator(sel).first().tap({ timeout: 8000 }) : page.locator(sel).first().click({ timeout: 8000 });
  const read = () => page.evaluate(() => { const s = __farm.state(), mayor = s.map.tiles.find((t) => t.npc === "mayor"); return { talk: s.adventure.byTarget.talk.mayor || 0, c1: s.adventure.quests.c1_homecoming.status, markerOnMayor: FarmWorld.markerTile(s) === mayor.id, delivered: s.heirloom.delivered === true, toast: document.querySelector("#toast-zone")?.textContent || "" }; });
  /* 已經種過第一格，第 1 章只差找鎮長說話；餐籃材料備齊。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); AdventureAPI.ensure(s, t); AdventureAPI.record(s, { type: "plant", cropId: "wheat" }, t); AdventureAPI.finishTutorial(s, t); s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; __farm.refresh(); FarmWorld.refresh(s); });
  await clearOverlays(page);
  let r = await read();
  assert.deepEqual([r.talk, r.c1, r.markerOnMayor], [0, "active", true], tag + " 交餐籃前：還沒跟鎮長說話，「!」在鎮長頭上 " + JSON.stringify(r));
  await page.evaluate(() => DailyUI.openHeirloom()); await page.waitForSelector("#heirloomDoorstep", { timeout: 8000 });
  await press("#heirloomDoorstep"); await press("#heirloomConfirm");
  await page.waitForFunction(() => __farm.state().heirloom.delivered === true, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  r = await read();
  assert.equal(r.talk, 1, tag + " 交餐籃記一次跟鎮長的交談 " + JSON.stringify(r));
  assert.equal(r.c1, "claimed", tag + " 第 1 章找鎮長任務照一般規則完成 " + JSON.stringify(r));
  assert.equal(r.markerOnMayor, false, tag + " 鎮長頭上的「!」消失 " + JSON.stringify(r));
  await page.evaluate(() => { document.querySelectorAll(".r76b-dialogue").forEach((n) => n.remove()); __farm.closeModal("dailyModal"); });
  return 1;
}
async function mayorStory(page, tag, mobile) {
  const press = (sel) => mobile ? page.locator(sel).first().tap({ timeout: 8000 }) : page.locator(sel).first().click({ timeout: 8000 });
  /* 餐籃已送到（這裡直接改存檔，沒有經過交付鈕，所以還沒記交談），舊麥種的爭執還沒聽。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); AdventureAPI.ensure(s, t); AdventureAPI.record(s, { type: "plant", cropId: "wheat" }, t); AdventureAPI.finishTutorial(s, t); s.heirloom.started = true; s.heirloom.sunWheat = 2; s.storage.items.wheat = 2; FarmHeirloom.deliver(s, "table", t); __farm.refresh(); FarmWorld.refresh(s); });
  await clearOverlays(page);
  const talk = () => page.evaluate(() => ({ talk: __farm.state().adventure.byTarget.talk.mayor || 0, c1: __farm.state().adventure.quests.c1_homecoming.status }));
  assert.deepEqual(await talk(), { talk: 0, c1: "active" }, tag + " 爭執前還沒跟鎮長說話");
  /* 不是舊麥種故事的鎮長對話（沒有 r81c／r82b 標記）不在這裡記。 */
  await page.evaluate(() => StoryR76.openDialogue(__farm.state(), "mayor", ["今天風大。"], { speaker: "鎮長葛瑞" }));
  await press(".r76b-dialogue [data-r76b-next]");
  assert.deepEqual(await talk(), { talk: 0, c1: "active" }, tag + " 一般對話框不重複記交談");
  /* 按「晚點再說」不算聽完。 */
  await page.evaluate(() => StoryR76.openR81Conflict(__farm.state()));
  await press(".r76b-dialogue [data-r76b-later]");
  assert.deepEqual(await talk(), { talk: 0, c1: "active" }, tag + " 晚點再說不算交談");
  /* 一句句點到最後：鎮長在這段開過口，聽完就記一次。 */
  await page.evaluate(() => StoryR76.openR81Conflict(__farm.state()));
  for (let i = 0; i < 12 && await page.locator(".r76b-dialogue [data-r76b-line]").count(); i++) await press(".r76b-dialogue [data-r76b-next]");
  await page.waitForSelector(".r76b-dialogue [data-r76b-choice]", { timeout: 4000 });
  assert.deepEqual(await talk(), { talk: 1, c1: "claimed" }, tag + " 聽完舊麥種爭執，記一次交談、第 1 章完成");
  await page.waitForFunction(() => /跟鎮長葛瑞說上話了/.test(document.querySelector("#toast-zone")?.textContent || ""), null, { timeout: 9000 }).catch(() => { throw new Error(tag + " 第 1 章完成要有提示"); });
  await page.evaluate(() => document.querySelectorAll(".r76b-dialogue").forEach((n) => n.remove()));
  return 1;
}
async function contradictions(page, tag) {
  let checks = 0;
  /* 「還沒成熟」提示留在畫面上時，田熟了：提示要收掉，不跟「可收成」同屏（圖 132）。 */
  await page.evaluate(() => { const s = __farm.state(), t = Date.now(); s.adventure.claimed = { c1_homecoming: true }; AdventureAPI.ensure(s, t); s.heirloom.started = false; for (const p of s.plots) { p.cropId = null; p.plantedAt = 0; delete p.wateredAt; } s.plots[0].cropId = "wheat"; s.plots[0].plantedAt = t; s.plots[0].careMode = "water"; Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: t + 600000 }); __farm.setTool("hand"); __farm.refresh(); FarmWorld.refresh(s); });
  await clearOverlays(page);
  await page.evaluate(() => { const s = __farm.state(), tile = s.map.tiles.find((x) => x.plotIndex === 0); __farm.clickTile(tile.id); __farm.cancelJourney(); });
  await page.waitForFunction(() => /還沒成熟|還在長/.test(document.querySelector("#toast-zone")?.textContent || ""), null, { timeout: 4000 });
  await page.evaluate(() => { const s = __farm.state(), p = s.plots[0]; p.plantedAt = Date.now() - 3600000; p.wateredAt = p.plantedAt; });
  await page.waitForTimeout(700);
  let r = await page.evaluate(() => ({ toast: document.querySelector("#toast-zone")?.textContent || "", label: document.querySelector("#tileStateLabel")?.innerText || "", harvest: !!document.querySelector('#sceneActionBar:not([hidden]) [data-action="harvest"]') }));
  assert.ok(/可收成/.test(r.label) || r.harvest, tag + " 田熟了，標籤或動作列寫可收成 " + JSON.stringify(r));
  assert.doesNotMatch(r.toast, /還沒成熟|還在長/, tag + " 田熟了不留「還沒成熟」提示 " + JSON.stringify(r));
  checks++;
  /* 收掉的空地不留「收成」鈕（圖 83）。 */
  await page.evaluate(() => { const s = __farm.state(), tile = s.map.tiles.find((x) => x.plotIndex === 0); __farm.clickTile(tile.id); __farm.cancelJourney(); __farm.renderSceneActions(); });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => !!document.querySelector('#sceneActionBar:not([hidden]) [data-action="harvest"]'));
  assert.equal(before, true, tag + " 熟田先有收成鈕");
  await page.evaluate(() => { const s = __farm.state(), p = s.plots[0]; p.cropId = null; p.plantedAt = 0; delete p.wateredAt; __farm.refresh(); FarmWorld.refresh(s); });
  await page.waitForTimeout(700);
  r = await page.evaluate(() => ({ harvest: [...document.querySelectorAll('#sceneActionBar [data-action="harvest"]')].filter((b) => __r83.shown(b) && b.getBoundingClientRect().width > 0).length, label: document.querySelector("#tileStateLabel")?.innerText || "" }));
  assert.equal(r.harvest, 0, tag + " 空地不出現收成鈕 " + JSON.stringify(r));
  checks++;
  await clearOverlays(page);
  return checks;
}

(async () => {
  const server = await serve(), origin = "http://127.0.0.1:" + server.address().port, browser = await launch();
  let checks = 0;
  try {
    for (const [width, height, mobile] of VIEWS) {
      const tag = width + "x" + height, errors = [];
      /* 每一組情境都開新的瀏覽器分頁與空白存檔，前一組改過的任務進度不會帶進下一組。 */
      const run = async (fn) => {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" }), page = await context.newPage();
        page.on("pageerror", (e) => errors.push(String(e)));
        await page.goto(origin);
        await page.waitForFunction(() => window.__farm && window.StoryR76 && window.AdventureAPI && window.Atlas && Atlas.isReady() && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
        await page.evaluate(() => document.querySelector("#worldSunBegin,#worldBegin")?.click());
        await page.waitForTimeout(300);
        await page.evaluate(install);
        try { checks += await fn(page, tag, mobile); } finally { await context.close(); }
      };
      await run(cardStates);
      await run(heirloomStates);
      await run(dialogueBlank);
      if (mobile) await run(thumbButton);
      await run(contradictions);
      if ((width === 1366 && height === 768) || width === 390) { await run(mayorTalk); await run(mayorStory); }
      assert.deepEqual(errors, [], tag + " 頁面錯誤：" + errors.join("；"));
      console.log("OK R83A card layout " + tag);
    }
  } finally { await browser.close(); server.close(); }
  console.log("VERIFIED content R83A card layout (" + checks + " checks)");
})().catch((error) => { console.error(error); process.exit(1); });
