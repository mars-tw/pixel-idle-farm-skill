'use strict';
/* R32 B 線（第 6～10 項）：畫面減量與名牌。用 playwright 在本機起伺服器實測（結束關閉），
   四尺寸量測並截圖存 docs/content/r32/layout/。第 6 項實際把玩家移到鎮長上、下、左、右量測。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5173;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r32', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const TMP = path.join(ROOT, '.tmp-r32-layout');
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
  throw new Error('找不到可用瀏覽器');
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
  const begin = page.locator('#worldBegin');
  if (await begin.count()) { try { await begin.click({ timeout: 2000 }); } catch (e) {} }
  await page.waitForTimeout(600);
  return { ctx, page };
}
const HELP = `
  globalThis.ro = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  globalThis.vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
`;
async function setPlayerNearMayor(page, dx, dy) {
  await page.evaluate(({ dx, dy }) => {
    const s = window.__farm.state();
    const m = s.map.tiles.find((t) => t.npc === 'mayor');
    const t = s.map.tiles.find((x) => x.x === m.x + dx && x.y === m.y + dy) || m;
    s.player.tileId = t.id; s.player.x = t.x; s.player.y = t.y;
    window.__farm.refresh();
    if (window.__farm.focusTile) window.__farm.focusTile(m.id);
  }, { dx, dy });
  await page.waitForTimeout(900);
}
(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
      const { ctx, page } = await newPage(browser, intercepted, w, h);
      const mobile = w <= 859 || h <= 480;
      const tag = `${w}x${h}`;
      // ---- 第 6 項：玩家在鎮長上、下、左、右四種位置量測名牌 ----
      const positions = [['上方', 0, -1], ['下方', 0, 1], ['左方', -1, 0], ['右方', 1, 0]];
      for (const [label, dx, dy] of positions) {
        await setPlayerNearMayor(page, dx, dy);
        const m = await page.evaluate((src) => {
          eval(src);
          const plate = document.querySelector('[data-audit="quest-npc-nameplate"]');
          const marker = document.querySelector('[data-audit="quest-marker"]');
          const npc = document.querySelector('.ob[data-kind="npc"][data-npc="mayor"]');
          const player = document.querySelector('#player');
          if (!plate || !marker || !npc || !player) return null;
          const pin = marker.querySelector('.qpin');
          const pr = ro(plate), nr = ro(npc), plr = ro(player), pinR = pin ? ro(pin) : null;
          const headZone = { left: plr.left, right: plr.right, top: plr.top - 24, bottom: plr.top + 24 };
          return {
            side: marker.dataset.plateSide || plate.dataset.plateSide || '',
            shift: marker.dataset.plateShift || plate.dataset.plateShift || '',
            triDx: pinR ? Math.abs((pinR.left + pinR.width / 2) - (nr.left + nr.width / 2)) : 999,
            centerDx: Math.abs((pr.left + pr.width / 2) - (nr.left + nr.width / 2)),
            vsPlayer: Math.round(inter(pr, plr)),
            vsHeadZone: Math.round(inter(pr, headZone)),
            plateTop: Math.round(pr.top), playerTop: Math.round(plr.top),
          };
        }, HELP);
        assert(m, `${tag} 玩家在鎮長${label}時名牌不存在`);
        // 側放時以指向三角量測，未側放時以名牌中心量測，皆須對準鎮長頭頂。
        const aimDx = m.side ? m.triDx : m.centerDx;
        assert(aimDx <= 16, `${tag} 玩家在鎮長${label}時名牌未對準鎮長頭頂（量測差 ${aimDx.toFixed(1)}px，side=${m.side || '無'}）`);
        assert.equal(m.vsPlayer, 0, `${tag} 玩家在鎮長${label}時名牌壓住玩家（交集 ${m.vsPlayer}px）`);
        assert.equal(m.vsHeadZone, 0, `${tag} 玩家在鎮長${label}時名牌落在玩家頭頂 24px 內（交集 ${m.vsHeadZone}px）`);
        if (label === '上方') {
          assert(m.side === 'left' || m.side === 'right', `${tag} 玩家在鎮長上方時名牌應側放，實際 side=${m.side || '無'}（R30 往上推的錯誤未修）`);
          await page.screenshot({ path: path.join(SHOT_DIR, `nameplate-mayor-above-${tag}.png`) });
        }
        console.log(`OK 名牌 ${tag} 鎮長${label} 對準差 ${aimDx.toFixed(1)}px、與玩家交集 0${m.side ? `、側放 ${m.side}（位移 ${m.shift}px）` : ''}`);
      }
      // ---- 第 7 項：手機常駐元件減量 ----
      if (mobile) {
        const q = await page.evaluate((src) => {
          eval(src);
          const dock = document.querySelector('#questDock');
          return dock ? { h: Math.round(ro(dock).height), collapsed: dock.classList.contains('quest-collapsed') || dock.classList.contains('quest-auto-collapsed') || dock.classList.contains('quest-target-collapsed') } : null;
        }, HELP);
        assert(q && q.collapsed, `${tag} 手機任務卡未預設收合（class 未收合）`);
        assert(q.h <= 64, `${tag} 手機任務卡收合後應為一行（高 ${q.h}px）`);
        // 無目標處：互動鍵隱藏、方向鍵隱藏
        await page.evaluate(() => {
          const s = window.__farm.state();
          const empty = s.map.tiles.find((t) => {
            if (t.terrain !== 'grass' || t.npc || t.plotIndex != null || t.station || t.object || t.structureId || t.buildingId || t.event || t.forage) return false;
            return [[0,1],[0,-1],[1,0],[-1,0]].every(([dx,dy]) => { const n = s.map.tiles.find((x) => x.x === t.x + dx && x.y === t.y + dy); return !n || (!n.npc && n.plotIndex == null && !n.station && !n.object && !n.structureId && !n.buildingId && !n.event && !n.forage); });
          });
          if (empty) { s.player.tileId = empty.id; s.player.x = empty.x; s.player.y = empty.y; window.__farm.refresh(); window.__farm.followPlayer(); }
        });
        await page.waitForTimeout(800);
        const idle = await page.evaluate((src) => {
          eval(src);
          const dpad = document.querySelector('.dpad');
          const act = document.querySelector('#actionA');
          return { dpadVis: vis(dpad), actVis: vis(act), showDpad: document.documentElement.classList.contains('show-dpad'), setting: window.__farm.state().settings.showDpad };
        }, HELP);
        assert.equal(idle.dpadVis, false, `${tag} 方向鍵應預設隱藏`);
        assert.equal(idle.actVis, false, `${tag} 無可互動目標時「互動」鍵應隱藏`);
        assert.equal(idle.setting, false, `${tag} 設定 showDpad 預設應為 false`);
        // 世界可視面積（以實際繪製的 HUD 葉節點聯集估計）
        const cov = await page.evaluate((src) => {
          eval(src);
          const sels = '.title, #resBar .res, #questDock, .seed-hud, .tool-bar .tool, .side-tab, .toolbar .btn, #worldMinimap, #mapFitToggle, .dpad-btn, .dpad-center, #actionA, .world-location, .daily-open';
          const rects = [...document.querySelectorAll(sels)].filter(vis).map(ro).filter((r) => r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight);
          const step = 8; let covered = 0, total = 0;
          for (let y = step / 2; y < innerHeight; y += step) for (let x = step / 2; x < innerWidth; x += step) { total++; if (rects.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) covered++; }
          return { pct: total ? (100 - covered / total * 100) : 100, coveredPct: total ? covered / total * 100 : 0 };
        }, HELP);
        assert(cov.pct >= 70, `${tag} 世界可視面積 ${cov.pct.toFixed(1)}% 未達 70%（HUD 覆蓋 ${cov.coveredPct.toFixed(1)}%）`);
        console.log(`OK 手機減量 ${tag} 任務卡一行 ${q.h}px、方向鍵與互動鍵無目標時隱藏、世界可視 ${cov.pct.toFixed(1)}%`);
        await page.screenshot({ path: path.join(SHOT_DIR, `gameplay-${tag}.png`) });
        // 鎮長是任務卡的目標時，R85 讓卡片負責交談，右下不再重複同一個動作。
        await setPlayerNearMayor(page, 1, 0);
        const mayorAction = await page.evaluate((src) => {
          eval(src);
          const dock = document.querySelector('#questDock');
          const button = dock.querySelector('[data-world-go]');
          const rect = button.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return { target: dock.dataset.targetId, mayor: __farm.state().map.tiles.find((t) => t.npc === 'mayor').id,
            label: button.textContent.trim(), reachable: vis(button) && !button.disabled && button.contains(hit), thumb: vis(document.querySelector('#actionA')) };
        }, HELP);
        assert.equal(mayorAction.target, mayorAction.mayor, tag + ' 交談按鈕指向鎮長');
        assert.equal(mayorAction.label, '前往交談');
        assert.ok(mayorAction.reachable && !mayorAction.thumb, tag + ' 鎮長旁要有一顆可點的交談按鈕 ' + JSON.stringify(mayorAction));
        // 設定開關：開啟「顯示方向鍵」後方向鍵出現
        await page.evaluate(() => document.querySelector('#settingsBtn').click());
        await page.waitForTimeout(400);
        const tog = await page.evaluate(() => {
          const b = document.querySelector('[data-setting-key="showDpad"]');
          if (!b) return null;
          const before = b.dataset.enabled;
          b.click();
          return { before, after: document.querySelector('[data-setting-key="showDpad"]').dataset.enabled, html: document.documentElement.classList.contains('show-dpad'), saved: window.__farm.state().settings.showDpad };
        });
        assert(tog && tog.before === 'false' && tog.after === 'true' && tog.html && tog.saved === true, `${tag} 「顯示方向鍵」開關未正確開啟並存檔：${JSON.stringify(tog)}`); await page.evaluate(() => document.querySelector('#settingsOk').click()); await page.waitForTimeout(300);
        await page.waitForTimeout(300);
        const dpadOn = await page.evaluate((src) => { eval(src); const d = document.querySelector('.dpad'); const mc = document.querySelector('#mobileControls'); let chain = []; let n = d; while (n && n !== document.body) { chain.push((n.id || n.className || n.tagName) + ':' + getComputedStyle(n).visibility + '/' + getComputedStyle(n).display); n = n.parentElement; } return { vis: vis(d), disp: getComputedStyle(d).display, mcDisp: getComputedStyle(mc).display, mcPos: getComputedStyle(mc).position, rect: ro(d), html: document.documentElement.className, coarse: matchMedia('(pointer: coarse)').matches, enabled: document.documentElement.classList.contains('mobile-controls-enabled'), chain, panelOpen: document.querySelector('.side-panel').className, dlgHidden: document.querySelector('#worldDialogue') ? document.querySelector('#worldDialogue').hidden : 'none' }; }, HELP); void 0;
        assert.equal(dpadOn.vis, true, `${tag} 開啟「顯示方向鍵」後方向鍵應顯示`);
        await page.evaluate(() => document.querySelector('#settingsBtn').click()); await page.waitForTimeout(300); await page.evaluate(() => { const b = document.querySelector('[data-setting-key="showDpad"]'); if (b) b.click(); document.querySelector('#settingsOk').click(); });
        await page.waitForTimeout(300);
        // 任務卡點一下展開
        const expanded = await page.evaluate(() => {
          const dock = document.querySelector('#questDock');
          const was = dock.classList.contains('quest-collapsed') || dock.classList.contains('quest-auto-collapsed');
          dock.click();
          return { was, now: dock.classList.contains('quest-collapsed') || dock.classList.contains('quest-auto-collapsed') };
        });
        assert(expanded.was && !expanded.now, `${tag} 手機任務卡點一下應展開：${JSON.stringify(expanded)}`);
        console.log(`OK 手機互動 ${tag} 有目標顯示互動鍵、方向鍵開關可開關、任務卡可展開`);
      }
      // ---- 第 8 項：收成階段 HUD 不蓋任務目標、作物浮動標籤不畫在 HUD 區（桌面兩尺寸） ----
      if (!mobile) {
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
        const harv = await page.evaluate(({ src, tid }) => {
          eval(src);
          const tileEl = document.querySelector('.gtile[data-tile-id="' + tid + '"]');
          if (!tileEl) return null;
          const tr = ro(tileEl);
          const hudSels = ['#questDock', '.seed-hud', '#worldMinimap', '.tool-bar'];
          const huds = hudSels.flatMap((s) => [...document.querySelectorAll(s)]).filter(vis).map((e) => ({ sel: e.id || e.className, r: ro(e) }));
          const vsHud = huds.map((h) => ({ sel: String(h.sel).slice(0, 24), v: Math.round(inter(tr, h.r)) }));
          const labels = [...document.querySelectorAll('.ob-bar, .ob-dot-ready-crop, .tile-state-label')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && vis(e));
          const labelVsHud = labels.map((lab) => { const lr = ro(lab); return Math.max(0, ...huds.map((h) => Math.round(inter(lr, h.r)))); });
          return { inView: tr.left >= 0 && tr.top >= 0 && tr.right <= innerWidth && tr.bottom <= innerHeight, vsHud, labelCount: labels.length, labelVsHud };
        }, { src: HELP, tid: tileId });
        assert(harv && harv.inView, `${tag} 收成田格未完整在畫面內`);
        for (const h of harv.vsHud) assert.equal(h.v, 0, `${tag} 收成田格被 HUD「${h.sel}」蓋住（交集 ${h.v}px）`);
        for (const v of harv.labelVsHud) assert.equal(v, 0, `${tag} 作物浮動標籤畫在 HUD 區（交集 ${v}px）`);
        console.log(`OK 收成安全區 ${tag} 田格與 HUD 交集 0、浮動標籤 ${harv.labelCount} 個皆不在 HUD 區`);
        await page.screenshot({ path: path.join(SHOT_DIR, `harvest-${tag}.png`) });
      }
      // ---- 第 9 項：升級面板首屏完整卡片＋「再顯示 N 項」；第 10 項面板標題 ----
      await page.evaluate(() => document.querySelector('.side-tab[data-tab="upgrades"]').click());
      await page.waitForTimeout(600);
      const panel = await page.evaluate((src) => {
        eval(src);
        const body = document.querySelector('.side-body');
        const pane = document.querySelector('.side-pane[data-pane="upgrades"]');
        if (!body || !pane || !vis(pane)) return null;
        const br = ro(body);
        const cards = [...pane.querySelectorAll('.up, .building-upgrade-card')];
        const visCards = cards.filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0);
        const intersecting = visCards.filter((c) => { const r = ro(c); return r.bottom > br.top && r.top < br.bottom; });
        const cut = intersecting.filter((c) => { const r = ro(c); return r.bottom > br.bottom + 1 || r.top < br.top - 1; }).map((c) => ({ cls: String(c.className).slice(0, 30), bottom: Math.round(ro(c).bottom), bodyBottom: Math.round(br.bottom) }));
        const hidden = pane.querySelectorAll('.r32-panel-hidden').length;
        const btn = pane.querySelector('.r32-show-more');
        const head = pane.querySelector('.pane-head');
        const hcs = head ? getComputedStyle(head) : null;
        return { total: cards.length, visCount: visCards.length, cut, hidden, btnText: btn ? btn.textContent.trim() : '', btnIn: btn ? (ro(btn).bottom <= br.bottom + 1 && ro(btn).top >= br.top - 1) : false, btnRect: btn ? ro(btn) : null, bodyRect: br, cardRects: visCards.map((c) => ro(c)), headBg: hcs ? hcs.backgroundColor : '', headRadius: hcs ? hcs.borderTopLeftRadius : '', headBottom: hcs ? hcs.borderBottomWidth : '' };
      }, HELP);
      assert(panel && panel.total >= 1, `${tag} 升級面板沒有卡片`);
      assert.equal(panel.cut.length, 0, `${tag} 升級面板首屏有被下緣切到的卡片：${JSON.stringify(panel.cut)}`);
      if (panel.hidden > 0) {
        assert(new RegExp(`再顯示 ${panel.hidden} 項`).test(panel.btnText), `${tag} 應以「再顯示 ${panel.hidden} 項」取代半張卡，實際「${panel.btnText}」`);
        assert(panel.btnIn, `${tag} 「再顯示 N 項」按鈕未完整在首屏內`);
      }
      assert(panel.headBg === 'rgba(0, 0, 0, 0)' || panel.headBg === 'transparent', `${tag} 面板標題仍是輸入框底色（${panel.headBg}）`);
      assert(panel.headRadius === '0px', `${tag} 面板標題仍有輸入框圓角（${panel.headRadius}）`);
      assert(parseFloat(panel.headBottom) >= 1, `${tag} 面板標題應為一般標題列（下邊線 ${panel.headBottom}）`);
      console.log(`OK 面板首屏 ${tag} 完整卡片 ${panel.visCount}/${panel.total}、無切半${panel.hidden ? `、再顯示 ${panel.hidden} 項` : ''}、標題為一般標題列`);
      await page.screenshot({ path: path.join(SHOT_DIR, `upgrades-first-${tag}.png`) });
      if (panel.hidden > 0) {
        await page.evaluate(() => document.querySelector('.side-pane[data-pane="upgrades"] .r32-show-more').click());
        await page.waitForTimeout(300);
        const after = await page.evaluate(() => document.querySelectorAll('.side-pane[data-pane="upgrades"] .r32-panel-hidden').length);
        assert.equal(after, 0, `${tag} 點「再顯示 N 項」後應展開全部`);
      }
      await page.evaluate(() => { const p = document.querySelector('.side-panel'); if (p) p.classList.remove('world-panel-open'); });
      await page.waitForTimeout(300);
      // ---- 第 10 項：矮螢幕對話框下方安全區（R40 改規則，不再是上方窄條） ----
      if (h <= 600) {
        await page.evaluate(() => window.FarmWorld.speak('鎮長葛瑞', '田邊的路清出來了，收成時記得留一點給餐籃。'));
        await page.waitForTimeout(500);
        const dlg = await page.evaluate((src) => {
          eval(src);
          const box = document.querySelector('#worldDialogue');
          if (!box || !vis(box)) return null;
          const r = ro(box);
          const cs = getComputedStyle(box); const p = box.querySelector('p'); const close = box.querySelector('.dialogue-close'); const cont = box.querySelector('.dialogue-continue'); const npc = document.querySelector('.ob[data-kind="npc"][data-npc="mayor"]'); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), pct: r.height / innerHeight * 100, mode: box.dataset.dialogueMode || '', maxH: cs.maxHeight, minH: cs.minHeight, csH: cs.height, offH: box.offsetHeight, clientH: box.clientHeight, scrollH: box.scrollHeight, boxSizing: cs.boxSizing, cls: box.className, overflowY: cs.overflowY, pVsBtn: (p && close && cont) ? Math.max(inter(ro(p), ro(close)), inter(ro(p), ro(cont))) : 999, npcVsBox: npc ? Math.round(inter(ro(npc), r)) : 999, npcInView: npc ? (ro(npc).top >= -1 && ro(npc).bottom <= innerHeight + 1 && ro(npc).left >= -1 && ro(npc).right <= innerWidth + 1) : false };
        }, HELP);
        assert(dlg, `${tag} 矮螢幕對話框不存在`);
        assert(dlg.pct <= 30.5, `${tag} 矮螢幕對話框高 ${dlg.height}px 占 ${dlg.pct.toFixed(1)}%，超過 30%`);
        assert(dlg.top >= h * 0.55 && dlg.bottom <= h - 60, `${tag} 矮螢幕對話框應在下方安全區（top ${dlg.top}px、bottom ${dlg.bottom}px／${h}）`);
        assert.equal(dlg.pVsBtn, 0, `${tag} 矮螢幕對話「略過／繼續」不應壓到台詞（交集 ${dlg.pVsBtn}）`);
        assert.equal(dlg.npcVsBox, 0, `${tag} 矮螢幕對話框不應遮住說話者（交集 ${dlg.npcVsBox}）`);
        assert(dlg.npcInView, `${tag} 矮螢幕說話者應在畫面內`);
        console.log(`OK 矮螢幕對話 ${tag} 下方安全區高 ${dlg.height}px（${dlg.pct.toFixed(1)}%）、文字與按鈕交集 0、說話者可見`);
        await page.screenshot({ path: path.join(SHOT_DIR, `dialogue-short-${tag}.png`) });
        await page.evaluate(() => { const b = document.querySelector('#worldDialogue'); if (b) b.hidden = true; });
      }
      if (!mobile) await page.screenshot({ path: path.join(SHOT_DIR, `gameplay-${tag}.png`) });
      await ctx.close();
    }
    console.log('VERIFIED test-content-r32-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : `（http://127.0.0.1:${PORT}）`));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
