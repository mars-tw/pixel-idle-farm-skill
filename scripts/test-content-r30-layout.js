'use strict';
/* R30 B 線版面量測（第 6～10 項）：設定逐文字節點不裁切、手機 HUD 與開場標誌、
   成熟作物一種畫法、NPC 名牌三角與避讓、全面板最後一項可見。
   用 playwright 在本機起伺服器實測（結束關閉），截圖存 docs/content/r30/layout/。
   第 6 項重點：逐一量測每個文字節點的可見矩形與裁切祖先（不是只量最後一行容器）。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5171;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r30', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const TMP = path.join(ROOT, '.tmp-r30-layout');
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(SHOT_DIR, { recursive: true });
process.env.TEMP = TMP; process.env.TMP = TMP; process.env.TMPDIR = TMP;
const { chromium } = require('playwright');
function serveFile(req, res) {
  const u = new URL(req.url, ORIGIN);
  const file = path.resolve(ROOT, '.' + (u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname)));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}
async function startServer() {
  const server = http.createServer(serveFile);
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); }); return { server, intercepted: false }; }
  catch (e) { return { server: null, intercepted: true }; }
}
async function launchBrowser() {
  const opts = { headless: true, args: ['--no-sandbox'] };
  try { return await chromium.launch(opts); } catch (e) {}
  for (const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (fs.existsSync(p)) { try { return await chromium.launch({ ...opts, executablePath: p }); } catch (e) {} }
  }
  throw new Error('找不到可用的瀏覽器');
}
async function newPage(browser, intercepted, width, height) {
  const mobile = width <= 859 || height <= 480;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  if (intercepted) {
    await ctx.route(ORIGIN + '/**', async (route) => {
      const u = new URL(route.request().url());
      const file = path.resolve(ROOT, '.' + (u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname)));
      const rel = path.relative(ROOT, file);
      if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { await route.fulfill({ status: 404, body: '' }); return; }
      await route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
  }
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__farm && window.Atlas && window.Atlas.isReady() && !document.querySelector('#startupLoading'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}
const HELP = `
  globalThis.ro = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  globalThis.vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
  // 逐文字節點量測：找最近裁切祖先，水平超出即裁切；垂直可捲祖先換算捲動座標，hidden 祖先直接比對可視矩形。
  globalThis.textClipIssues = (root) => {
    const issues = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue || '').trim(); if (!text) continue;
      const parent = node.parentElement; if (!parent) continue;
      const pcs = getComputedStyle(parent);
      if (pcs.display === 'none' || pcs.visibility === 'hidden') continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      let el = parent, clipEl = null, clipCs = null;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { clipEl = el; clipCs = cs; break; }
        el = el.parentElement;
      }
      if (!clipEl) continue;
      const er = clipEl.getBoundingClientRect();
      const by = clipEl.id || String(clipEl.className).slice(0, 36);
      const clipsX = ['hidden', 'auto', 'scroll', 'clip'].includes(clipCs.overflowX);
      const clipsY = ['hidden', 'auto', 'scroll', 'clip'].includes(clipCs.overflowY);
      if (clipsX && (r.left < er.left - 0.6 || r.right > er.right + 0.6)) issues.push({ text: text.slice(0, 24), kind: '水平裁切', by });
      if (clipsY) {
        const scrollable = clipCs.overflowY === 'auto' || clipCs.overflowY === 'scroll';
        if (scrollable) {
          const topIn = r.top - er.top + clipEl.scrollTop;
          const bottomIn = r.bottom - er.top + clipEl.scrollTop;
          if (topIn < -0.6 || bottomIn > clipEl.scrollHeight + 0.6) issues.push({ text: text.slice(0, 24), kind: '垂直超出捲動內容', by });
        } else if (r.top < er.top - 0.6 || r.bottom > er.bottom + 0.6) {
          issues.push({ text: text.slice(0, 24), kind: '垂直裁切', by });
        }
      }
    }
    return issues;
  };
  globalThis.textNodesIn = (root) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) { const t = (node.nodeValue || '').trim(); if (t) out.push(node); }
    return out;
  };
  globalThis.scrollerOf = (el) => {
    let n = el ? el.parentElement : null;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 2) return n;
      n = n.parentElement;
    }
    return null;
  };
`;
async function pixelStats(page, rect) {
  const clip = { x: Math.max(0, Math.floor(rect.left)), y: Math.max(0, Math.floor(rect.top)), width: Math.max(8, Math.floor(rect.width)), height: Math.max(8, Math.floor(rect.height)) };
  const buf = await page.screenshot({ clip });
  const b64 = buf.toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + data; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let bright = 0, sat = 0, total = 0;
    for (let i = 0; i < d.length; i += 4) { total++; const r = d[i], gg = d[i + 1], b = d[i + 2]; if (r > 250 && gg > 250 && b > 240) bright++; const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); if (mx - mn > 60 && mx > 80) sat++; }
    return { brightPct: total ? bright / total * 100 : 0, satPct: total ? sat / total * 100 : 0 };
  }, b64);
}
// 捲到底後量最後一張卡：完整在捲動容器可視區內、不與頁籤列／工具列重疊
async function measurePaneBottom(page, paneSelector, cardSelector) {
  return page.evaluate(async ({ src, paneSelector, cardSelector }) => {
    eval(src);
    const pane = document.querySelector(paneSelector);
    if (!pane || !vis(pane)) return { missing: 'pane 不可見', count: 0 };
    const cards = [...pane.querySelectorAll(cardSelector)].filter(vis);
    if (!cards.length) return { count: 0 };
    const last = cards[cards.length - 1];
    const scroller = scrollerOf(last) || pane;
    scroller.scrollTop = scroller.scrollHeight;
    await new Promise((r) => setTimeout(r, 280));
    scroller.scrollTop = scroller.scrollHeight;
    await new Promise((r) => setTimeout(r, 120));
    const lr = ro(last), sr = ro(scroller);
    const tabs = document.querySelector('.side-tabs');
    const toolbar = document.querySelector('.toolbar');
    return {
      count: cards.length,
      scroller: scroller.id || String(scroller.className).slice(0, 30),
      lastBottom: Math.round(lr.bottom), scrollerBottom: Math.round(sr.bottom), scrollerTop: Math.round(sr.top), lastTop: Math.round(lr.top),
      // 最後一項的下緣完整落在可視區內即不算被裁（高於可視區的卡無法整張同時入鏡，捲到底時以下緣為準）
      inScroller: lr.bottom <= sr.bottom + 1 && lr.bottom > sr.top && lr.top < sr.bottom,
      vsTabs: tabs && vis(tabs) ? Math.round(inter(lr, ro(tabs))) : 0,
      vsToolbar: toolbar && vis(toolbar) ? Math.round(inter(lr, ro(toolbar))) : 0,
      atBottom: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2,
      scrollTop: Math.round(scroller.scrollTop), scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight,
      lastCls: String(last.className).slice(0, 40), lastH: Math.round(lr.height),
    };
  }, { src: HELP, paneSelector, cardSelector });
}
(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
      const { ctx, page } = await newPage(browser, intercepted, w, h);
      const mobile = w <= 859 || h <= 480;

      // 7：開場標誌不被切 + HUD 每個欄位文字節點不超出欄位（點開始前量，開場畫面同框）
      const hud = await page.evaluate((src) => {
        eval(src);
        const logo = document.querySelector('.farm-logo');
        const lr = logo ? ro(logo) : null;
        const res = [...document.querySelectorAll('#resBar .res')].map((el) => {
          const er = ro(el);
          // 只量可見文字節點（手機版面刻意隱藏的次要數字不算裁切）
          const nodes = textNodesIn(el).map((n) => { const rg = document.createRange(); rg.selectNodeContents(n); const rr = rg.getBoundingClientRect(); return { t: n.nodeValue.trim().slice(0, 14), visible: rr.width > 0 || rr.height > 0, out: rr.left < er.left - 0.6 || rr.right > er.right + 0.6 || rr.top < er.top - 0.6 || rr.bottom > er.bottom + 0.6 }; }).filter((n) => n.visible);
          return { cls: el.className.replace('res ', ''), sw: el.scrollWidth, cw: el.clientWidth, text: nodes.map((n) => n.t).join(' '), nodes };
        });
        const storage = res.find((r) => r.cls.includes('storage'));
        return { logo: lr && { left: Math.round(lr.left), right: Math.round(lr.right), w: Math.round(lr.width), h: Math.round(lr.height), fit: getComputedStyle(logo).objectFit }, vw: innerWidth, res, storageText: storage ? storage.text : '' };
      }, HELP);
      assert(hud.logo && hud.logo.left >= 0 && hud.logo.right <= hud.vw, `${w}×${h} 開場標誌超出畫面（left ${hud.logo && hud.logo.left}、right ${hud.logo && hud.logo.right}／寬 ${hud.vw}）`);
      assert(hud.logo.w >= 128, `${w}×${h} 開場標誌被擠壓（寬 ${hud.logo.w}px，應保留可辨識寬度）`);
      assert(hud.logo.fit === 'contain' || hud.logo.fit === 'scale-down', `${w}×${h} 開場標誌圖被裁切（object-fit ${hud.logo.fit}）`);
      for (const r of hud.res) {
        assert(r.sw <= r.cw + 1, `${w}×${h} HUD「${r.cls}」內容寬 ${r.sw}px 超過可視寬 ${r.cw}px（${r.text}）`);
        for (const n of r.nodes) assert(!n.out, `${w}×${h} HUD「${r.cls}」文字「${n.t}」超出欄位矩形`);
      }
      if (mobile) assert(!hud.storageText.includes('背包'), `${w}×${h} 手機容量欄應只剩圖示＋數字，實際「${hud.storageText}」`);
      assert(/\d+\s*\/\s*\d+/.test(hud.storageText), `${w}×${h} 容量欄應顯示「已用/容量」數字，實際「${hud.storageText}」`);
      await page.screenshot({ path: path.join(SHOT_DIR, `opening-${w}x${h}.png`) });
      console.log(`OK HUD ${w}×${h} 標誌完整（寬 ${hud.logo.w}px）、資源列逐節點未超出、容量「${hud.storageText}」`);
      const begin = page.locator('#worldBegin');
      if (await begin.count()) { try { await begin.click({ timeout: 2000 }); } catch (e) {} }
      await page.waitForTimeout(500);
      // 7（續）：手機任務列不得被標題列蓋住上半（橫式定位須跟著標題列實高）
      if (mobile) {
        const dockCover = await page.evaluate((src) => {
          eval(src);
          const dock = document.querySelector('#questDock');
          const header = document.querySelector('header');
          if (!dock || !header || !vis(dock)) return null;
          return { vsHeader: Math.round(inter(ro(dock), ro(header))), dockTop: Math.round(ro(dock).top), headerBottom: Math.round(ro(header).bottom) };
        }, HELP);
        assert(dockCover, `${w}×${h} 任務列不存在`);
        assert.equal(dockCover.vsHeader, 0, `${w}×${h} 任務列被標題列蓋住（交集 ${dockCover.vsHeader}px，任務列上緣 ${dockCover.dockTop}／標題列下緣 ${dockCover.headerBottom}）`);
        console.log(`OK 任務列 ${w}×${h} 未被標題列遮擋（上緣 ${dockCover.dockTop}px）`);
      }

      // 9：NPC 名牌——任務名牌下方三角指向頭頂；靠近名牌有三角、與玩家／其他角色交集 0（重疊自動上移）
      await page.evaluate(() => { const s = window.__farm.state(); const m = s.map.tiles.find((t) => t.npc === 'mayor'); window.__farm.focusTile(m.id); });
      await page.waitForTimeout(800);
      const questPlate = await page.evaluate((src) => {
        eval(src);
        const plate = document.querySelector('[data-audit="quest-npc-nameplate"]');
        const marker = document.querySelector('[data-audit="quest-marker"]');
        const player = document.querySelector('#player');
        if (!plate || !marker || !player) return null;
        const npc = document.querySelector('.ob[data-kind="npc"][data-tile-id="' + marker.dataset.tileId + '"]');
        const pin = marker.querySelector('.qpin');
        if (!npc || !pin) return null;
        const pr = ro(plate), nr = ro(npc), pinR = ro(pin);
        return { dx: Math.abs((pr.left + pr.width / 2) - (nr.left + nr.width / 2)), pinBelow: pinR.top >= pr.bottom - 2, pinDx: Math.abs((pinR.left + pinR.width / 2) - (nr.left + nr.width / 2)), vsPlayer: Math.round(inter(pr, ro(player))), shift: marker.dataset.plateShift || '' };
      }, HELP);
      assert(questPlate, `${w}×${h} 任務 NPC 名牌或三角不存在`);
      assert(questPlate.pinBelow, `${w}×${h} 任務名牌下方沒有指向三角`);
      assert(questPlate.pinDx <= 10, `${w}×${h} 名牌三角未對準 NPC 中心（差 ${questPlate.pinDx.toFixed(1)}px）`);
      assert(questPlate.dx <= 10, `${w}×${h} 任務名牌未對準 NPC 中心（差 ${questPlate.dx.toFixed(1)}px）`);
      assert.equal(questPlate.vsPlayer, 0, `${w}×${h} 任務名牌壓住玩家（交集 ${questPlate.vsPlayer}px）`);
      // 靠近名牌：玩家站到 child 正上方一格（名牌原位會與玩家重疊，須自動上移）
      await page.evaluate(() => {
        const s = window.__farm.state();
        const child = s.map.tiles.find((t) => t.npc === 'child');
        const above = s.map.tiles.find((t) => t.x === child.x && t.y === child.y - 1 && !t.npc) || child;
        s.player.tileId = above.id; s.player.x = above.x; s.player.y = above.y;
        window.__farm.refresh();
        if (window.__farm.followPlayer) window.__farm.followPlayer();
      });
      await page.waitForTimeout(900);
      const nearPlate = await page.evaluate((src) => {
        eval(src);
        const plate = document.querySelector('[data-audit="npc-nameplate"][data-npc="child"]');
        const npc = document.querySelector('.ob[data-kind="npc"][data-npc="child"]');
        const player = document.querySelector('#player');
        if (!plate || !npc || !player) return null;
        const pr = ro(plate), nr = ro(npc);
        const after = getComputedStyle(plate, '::after');
        const others = [...document.querySelectorAll('.ob[data-kind="npc"], .ob[data-kind="animal"]')].filter((n) => n !== npc && vis(n));
        const vsOthers = Math.max(0, ...others.map((n) => Math.round(inter(pr, ro(n)))));
        return {
          tri: after.content !== 'none' && parseFloat(after.borderTopWidth) >= 5,
          dx: Math.abs((pr.left + pr.width / 2) - (nr.left + nr.width / 2)),
          gapToNpc: Math.round(nr.top - pr.bottom),
          vsPlayer: Math.round(inter(pr, ro(player))), vsOthers,
          shift: plate.dataset.plateShift || '',
        };
      }, HELP);
      assert(nearPlate, `${w}×${h} 靠近 NPC 名牌不存在`);
      assert(nearPlate.tri, `${w}×${h} 靠近名牌下方缺少指向三角`);
      assert(nearPlate.dx <= 10, `${w}×${h} 靠近名牌未對準 NPC 中心（差 ${nearPlate.dx.toFixed(1)}px）`);
      assert.equal(nearPlate.vsPlayer, 0, `${w}×${h} 靠近名牌壓住玩家（交集 ${nearPlate.vsPlayer}px，上移 ${nearPlate.shift}px）`);
      assert.equal(nearPlate.vsOthers, 0, `${w}×${h} 靠近名牌壓住其他角色（交集 ${nearPlate.vsOthers}px）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `nameplate-${w}x${h}.png`) });
      console.log(`OK 名牌 ${w}×${h} 三角指向 NPC 頭頂、與玩家及其他角色交集 0${nearPlate.shift ? `（自動上移 ${nearPlate.shift}px）` : ''}`);

      // 8：成熟作物——本體＋小型閃光點、光暈不超出田框、受陽光照射不洗白（光斑開啟下量像素）
      const tileId = await page.evaluate(() => {
        const s = window.__farm.state();
        s.adventure.claimed = { c1_homecoming: true };
        s.adventure.byTarget.talk = { mayor: 1 };
        s.adventure.counts.plant = 3; s.adventure.counts.water = 3;
        s.plots[0].cropId = 'wheat'; s.plots[0].plantedAt = Date.now() - 30 * 60 * 1000; delete s.plots[0].wateredAt;
        s.sun = { plots: [0], startsAt: Date.now() - 1000, endsAt: Date.now() + 15000, nextAt: Date.now() + 60000, used: [], introduced: true };
        const tile = s.map.tiles.find((t) => t.plotIndex === 0);
        const far = s.map.tiles.find((t) => t.x === tile.x + 4 && t.y === tile.y + 3) || s.map.tiles[s.map.tiles.length - 1];
        s.player.tileId = far.id; s.player.x = far.x; s.player.y = far.y;
        window.__farm.refresh();
        window.__farm.focusTile(tile.id);
        if (window.__farm.sunTick) window.__farm.sunTick();
        return tile.id;
      });
      await page.waitForTimeout(1300);
      const mature = await page.evaluate((tid) => {
        const tileEl = document.querySelector('.gtile[data-tile-id="' + tid + '"]');
        const cropEl = document.querySelector('[data-kind="crop"][data-tile-id="' + tid + '"]');
        const dot = document.querySelector('.ob-dot-ready-crop');
        const beam = document.querySelector('.sun-beam[data-plot-index="0"]');
        const pool = beam ? beam.querySelector('.sun-pool') : null;
        const cs = tileEl ? getComputedStyle(tileEl) : null;
        const outerGlow = cs ? cs.boxShadow.split(',').filter((s) => !s.includes('inset') && /(1[0-9]|[2-9][0-9])px/.test(s)).length : 0;
        const r = tileEl.getBoundingClientRect();
        const pr = pool ? pool.getBoundingClientRect() : null;
        return {
          tile: { left: r.left, top: r.top, width: r.width, height: r.height },
          inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          outerGlow, shadow: cs.boxShadow,
          cropFilter: cropEl ? getComputedStyle(cropEl).filter : '',
          dotW: dot ? Math.round(dot.getBoundingClientRect().width) : 0,
          poolVsTile: pr ? { leftGap: Math.round(pr.left - r.left), rightGap: Math.round(r.right - pr.right) } : null,
        };
      }, tileId);
      assert(mature.inView, `${w}×${h} 成熟田格未完整在畫面內`);
      assert.equal(mature.outerGlow, 0, `${w}×${h} 成熟田格仍有超出田框的外光暈（${mature.shadow}）`);
      assert(mature.dotW > 0 && mature.dotW <= 9, `${w}×${h} 成熟閃光點應為小型一點（寬 ${mature.dotW}px）`);
      assert(!/brightness\(1\.[2-9]/.test(mature.cropFilter), `${w}×${h} 成熟作物被高亮洗白（filter ${mature.cropFilter}）`);
      assert(mature.poolVsTile, `${w}×${h} 陽光光斑未出現在成熟田上（無法驗收受光不洗白）`);
      const pix = await pixelStats(page, mature.tile);
      assert(pix.brightPct < 3, `${w}×${h} 成熟田格近白像素 ${pix.brightPct.toFixed(2)}% 超過 3%`);
      assert(pix.satPct >= 8, `${w}×${h} 成熟作物主體不可見（飽和像素僅 ${pix.satPct.toFixed(2)}%）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `harvest-${w}x${h}.png`) });
      console.log(`OK 成熟 ${w}×${h} 近白 ${pix.brightPct.toFixed(2)}%＜3%、主體飽和 ${pix.satPct.toFixed(1)}%、閃光點 ${mature.dotW}px、無外擴光暈`);

      // 6：設定逐文字節點量測——捲到底後每節點不被裁、最後節點在可視區且不與「完成」重疊、上方有留白
      await page.evaluate(() => document.querySelector('#settingsBtn').click());
      await page.waitForTimeout(400);
      const settings = await page.evaluate(async (src) => {
        eval(src);
        const list = document.querySelector('#settingsList');
        const ok = document.querySelector('#settingsOk');
        const details = list.querySelector('details');
        if (details) details.open = true;
        await new Promise((r) => setTimeout(r, 80));
        list.scrollTop = list.scrollHeight;
        await new Promise((r) => setTimeout(r, 200));
        list.scrollTop = list.scrollHeight;
        const issues = textClipIssues(list);
        const nodes = textNodesIn(list);
        const last = nodes[nodes.length - 1];
        const rg = document.createRange(); rg.selectNodeContents(last);
        const lr = rg.getBoundingClientRect();
        const orr = ro(ok);
        return {
          issues: issues.slice(0, 6), issueCount: issues.length, nodeCount: nodes.length,
          lastText: last.nodeValue.trim().slice(0, 20),
          lastInView: lr.top >= -1 && lr.bottom <= innerHeight + 1 && lr.left >= 0 && lr.right <= innerWidth,
          vsOk: Math.round(inter(lr, orr)), gap: Math.round(orr.top - lr.bottom),
        };
      }, HELP);
      assert.equal(settings.issueCount, 0, `${w}×${h} 設定文字節點被裁：${JSON.stringify(settings.issues)}`);
      assert(settings.lastInView, `${w}×${h} 設定捲到底後最後文字「${settings.lastText}」未完整在可視區`);
      assert.equal(settings.vsOk, 0, `${w}×${h} 設定最後文字被「完成」鈕遮住（交集 ${settings.vsOk}px）`);
      assert(settings.gap >= 8, `${w}×${h} 設定「完成」鈕上方留白不足（${settings.gap}px）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `settings-bottom-${w}x${h}.png`) });
      console.log(`OK 設定 ${w}×${h} 逐節點 ${settings.nodeCount} 個無裁切、最後文字與完成鈕留白 ${settings.gap}px`);
      await page.evaluate(() => document.querySelector('#settingsOk').click());
      await page.waitForTimeout(200);

      // 10：訂單／升級／手記／建造面板捲到底最後一項完整可見；手機訂單第一屏至少 1.5 張＋捲動陰影
      // 訂單佈置：若現有訂單不足 2 張，補入合法訂單物件後刷新（僅測試佈置，不改資料邏輯）
      await page.evaluate(() => {
        const s = window.__farm.state();
        // R30 A 線：市集在交給班伯後才開放；先建立「市集已開放」狀態（同 R26～R28 版面測試的佈置）。
        window.AdventureAPI.ensure(s, Date.now()); s.adventure.claimed.c1_first_harvest = true;
        if (window.refreshOrders) window.refreshOrders(s, Date.now());
        if (!Array.isArray(s.orders) || s.orders.length < 2) {
          const now = Date.now();
          const mk = (id, wants, npcId) => ({ id, wants, rarity: 'common', rewardCoins: 30, rewardXp: 2, createdAt: now, expiresAt: now + 30 * 60 * 1000, npcId });
          s.orders = [mk('r30_t1', { wheat: 2 }, 'elder'), mk('r30_t2', { wheat: 3 }, 'merchant'), mk('r30_t3', { carrot: 2 }, 'elder'), mk('r30_t4', { wheat: 1 }, 'child')];
        }
        window.__farm.refresh();
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector('.side-tab[data-tab="orders"]').click());
      await page.waitForTimeout(350);
      if (mobile) {
        const firstScreen = await page.evaluate((src) => {
          eval(src);
          const pane = document.querySelector('.side-pane[data-pane="orders"]');
          const cards = [...pane.querySelectorAll('.order')].filter(vis);
          if (!cards.length || !vis(pane)) return { count: cards.length };
          const pr = ro(pane);
          const visibleH = cards.map((c) => { const r = ro(c); return Math.max(0, Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top)); });
          const shadow = getComputedStyle(pane).boxShadow || '';
          const bodyEl = document.querySelector('.side-body'); const br2 = bodyEl ? ro(bodyEl) : pr; const cutCards = cards.filter((c) => { const r = ro(c); return r.bottom > br2.top && r.top < br2.bottom && (r.bottom > br2.bottom + 1 || r.top < br2.top - 1); }).length; return { count: cards.length, total: pane.querySelectorAll('.order').length, hidden: pane.querySelectorAll('.r32-panel-hidden').length, hasMore: !!pane.querySelector('.r32-show-more'), cutCards, firstFull: visibleH[0] >= ro(cards[0]).height - 1, secondFrac: cards[1] ? visibleH[1] / ro(cards[1]).height : 0, hasShadow: shadow.includes('inset') };
        }, HELP);
        assert(firstScreen.total >= 2, `${w}×${h} 手機訂單抽屜訂單不足（${firstScreen.total} 張）`);
        assert(firstScreen.firstFull, `${w}×${h} 手機訂單第一張未完整顯示在第一屏`);
        assert.equal(firstScreen.cutCards, 0, `${w}×${h} 手機訂單第一屏有被切半的卡（R32 改為完整卡＋再顯示 N 項）`); if (firstScreen.hidden > 0) assert(firstScreen.hasMore, `${w}×${h} 手機訂單首屏收起卡片後缺少「再顯示 N 項」`);
        assert(firstScreen.hasShadow, `${w}×${h} 手機訂單抽屜缺少捲動陰影`);
        console.log(`OK 訂單第一屏 ${w}×${h} 完整卡片無切半（可見 ${firstScreen.count}/${firstScreen.total}）、有捲動陰影`);
      }
      const ordersBottom = await measurePaneBottom(page, '.side-pane[data-pane="orders"]', '.order, .list-more, .orders-empty');
      assert(ordersBottom.count >= 1, `${w}×${h} 訂單面板沒有可量測的卡片`);
      assert(ordersBottom.inScroller, `${w}×${h} 訂單最後一項未完整在捲動區（卡下緣 ${ordersBottom.lastBottom}／容器下緣 ${ordersBottom.scrollerBottom}）`);
      assert.equal(ordersBottom.vsTabs, 0, `${w}×${h} 訂單最後一項被頁籤列遮住（${ordersBottom.vsTabs}px）`);
      assert.equal(ordersBottom.vsToolbar, 0, `${w}×${h} 訂單最後一項被工具列遮住（${ordersBottom.vsToolbar}px）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `orders-bottom-${w}x${h}.png`) });
      console.log(`OK 訂單 ${w}×${h} 捲到底最後一項完整可見（${ordersBottom.scroller}）`);
      await page.evaluate(() => document.querySelector('.side-tab[data-tab="upgrades"]').click());
      await page.waitForTimeout(350);
      const upBottom = await measurePaneBottom(page, '.side-pane[data-pane="upgrades"]', '.up, .building-upgrade-card');
      assert(upBottom.count >= 1, `${w}×${h} 升級面板沒有可量測的卡片`);
      assert(upBottom.inScroller, `${w}×${h} 升級最後一項未完整在捲動區（卡下緣 ${upBottom.lastBottom}／容器下緣 ${upBottom.scrollerBottom}）`);
      assert.equal(upBottom.vsTabs, 0, `${w}×${h} 升級最後一項被頁籤列遮住（${upBottom.vsTabs}px）`);
      assert.equal(upBottom.vsToolbar, 0, `${w}×${h} 升級最後一項被工具列遮住（${upBottom.vsToolbar}px）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `upgrades-bottom-${w}x${h}.png`) });
      console.log(`OK 升級 ${w}×${h} 捲到底最後一項完整可見（${upBottom.scroller}）`);
      await page.evaluate(() => { document.querySelector('.side-tab[data-tab="story"]').click(); const d = document.querySelector('details.legacy-story'); if (d) d.open = true; });
      await page.waitForTimeout(350);
      const storyBottom = await measurePaneBottom(page, '.side-pane[data-pane="story"]', '.story-card, .adv-card, details, .story-item');
      assert(storyBottom.count >= 1, `${w}×${h} 手記面板沒有可量測的卡片`);
      assert(storyBottom.inScroller, `${w}×${h} 手記最後一項未完整在捲動區：${JSON.stringify(storyBottom)}`);
      assert.equal(storyBottom.vsTabs, 0, `${w}×${h} 手記最後一項被頁籤列遮住（${storyBottom.vsTabs}px）`);
      assert.equal(storyBottom.vsToolbar, 0, `${w}×${h} 手記最後一項被工具列遮住（${storyBottom.vsToolbar}px）`);
      console.log(`OK 手記 ${w}×${h} 捲到底最後一項完整可見（${storyBottom.scroller}）`);
      // 建造選單（地塊資訊分頁的建物清單）
      await page.evaluate(() => {
        document.querySelector('.side-tab[data-tab="tile"]').click();
        const s = window.__farm.state();
        const grass = s.map.tiles.find((t) => t.terrain === 'grass' && !t.npc && !t.buildingId && t.plotIndex == null && !t.station && !t.obstacle);
        if (grass) window.__farm.clickTile(grass.id);
      });
      await page.waitForTimeout(700);
      const buildBottom = await measurePaneBottom(page, '.side-pane[data-pane="tile"]', '.build-opt');
      assert(buildBottom.count >= 1, `${w}×${h} 建造清單沒有可量測的項目`);
      assert(buildBottom.inScroller, `${w}×${h} 建造最後一項未完整在捲動區（卡下緣 ${buildBottom.lastBottom}／容器下緣 ${buildBottom.scrollerBottom}）`);
      assert.equal(buildBottom.vsTabs, 0, `${w}×${h} 建造最後一項被頁籤列遮住（${buildBottom.vsTabs}px）`);
      assert.equal(buildBottom.vsToolbar, 0, `${w}×${h} 建造最後一項被工具列遮住（${buildBottom.vsToolbar}px）`);
      console.log(`OK 建造 ${w}×${h} 捲到底最後一項完整可見（${buildBottom.scroller}，共 ${buildBottom.count} 項）`);
      await ctx.close();
    }
    console.log('VERIFIED test-content-r30-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : '（http://127.0.0.1:' + PORT + '）'));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
