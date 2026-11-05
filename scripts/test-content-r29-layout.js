'use strict';
/* R29 B 線版面量測（第 6～10 項）：任務目標不被遮、手機橫式 HUD、對話不遮說話者、
   設定捲到底、田格選取與成熟發光、NPC 名牌。用 playwright 在本機起伺服器實測
   （結束關閉），截圖存 docs/content/r29/layout/。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5169;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r29', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const TMP = path.join(ROOT, '.tmp-r29-layout');
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
  await page.waitForTimeout(500);
  const begin = page.locator('#worldBegin');
  if (await begin.count()) { try { await begin.click({ timeout: 2000 }); } catch (e) {} }
  await page.waitForTimeout(500);
  return { ctx, page };
}
const HELP = `
  globalThis.ro = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  globalThis.vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
`;
async function brightRatio(page, rect) {
  const clip = { x: Math.max(0, Math.floor(rect.left)), y: Math.max(0, Math.floor(rect.top)), width: Math.max(8, Math.floor(rect.width)), height: Math.max(8, Math.floor(rect.height)) };
  const buf = await page.screenshot({ clip });
  const b64 = buf.toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + data; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let bright = 0, total = 0;
    for (let i = 0; i < d.length; i += 4) { total++; if (d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 240) bright++; }
    return total ? bright / total : 0;
  }, b64);
}
(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
      const { ctx, page } = await newPage(browser, intercepted, w, h);

      // 10：NPC 名牌固定在 NPC 頭頂（初始任務目標為葛瑞）
      if (w === 1366 && h === 768) {
        await page.evaluate(() => { const s = window.__farm.state(); const m = s.map.tiles.find((t) => t.npc === 'mayor'); window.__farm.focusTile(m.id); });
        await page.waitForTimeout(700);
        const plate = await page.evaluate((src) => {
          eval(src);
          const el = document.querySelector('[data-audit="quest-npc-nameplate"]');
          const marker = document.querySelector('[data-audit="quest-marker"]');
          const player = document.querySelector('#player');
          if (!el || !marker || !player) return null;
          const npc = document.querySelector('.ob[data-kind="npc"][data-tile-id="' + marker.dataset.tileId + '"]');
          if (!npc) return null;
          const pr = ro(el), nr = ro(npc), pl = ro(player);
          return { text: el.textContent.trim(), dx: Math.abs((pr.left + pr.width / 2) - (nr.left + nr.width / 2)), plateBottom: pr.bottom, npcTop: nr.top, vsPlayer: Math.round(inter(pr, pl)) };
        }, HELP);
        assert(plate, '1366×768 任務 NPC 名牌不存在');
        assert(plate.dx <= 8, `1366×768 名牌中心與 NPC 中心距離 ${plate.dx.toFixed(1)}px 超過 8px`);
        assert(plate.plateBottom <= plate.npcTop + 8, `1366×768 名牌不在 NPC 頭頂上方（名牌下緣 ${Math.round(plate.plateBottom)}、NPC 上緣 ${Math.round(plate.npcTop)}）`);
        assert.equal(plate.vsPlayer, 0, `1366×768 名牌壓住主角（交集 ${plate.vsPlayer}px）`);
        console.log(`OK 名牌 1366×768「${plate.text}」在 NPC 頭頂、未壓主角`);
      }

      // 6：收成階段——成熟田格不被任務卡與種子欄遮住
      const harvest = await page.evaluate(() => {
        const s = window.__farm.state();
        s.adventure.claimed = { c1_homecoming: true };
        s.adventure.byTarget.talk = { mayor: 1 };
        s.adventure.counts.plant = 3; s.adventure.counts.water = 3;
        s.adventure.byTarget.harvest = { wheat: 0 };
        for (let i = 0; i < 3; i++) { s.plots[i].cropId = 'wheat'; s.plots[i].plantedAt = Date.now() - 30 * 60 * 1000; delete s.plots[i].wateredAt; }
        const tile = s.map.tiles.find((t) => t.plotIndex === 0);
        const far = s.map.tiles.find((t) => t.x === tile.x + 7 && t.y === tile.y + 4) || s.map.tiles[s.map.tiles.length - 1];
        s.player.tileId = far.id; s.player.x = far.x; s.player.y = far.y;
        window.__farm.refresh();
        if (window.__farm.followPlayer) window.__farm.followPlayer();
        return tile.id;
      });
      await page.waitForTimeout(1400);
      const cover = await page.evaluate(({ src, tid }) => {
        eval(src);
        const tileEl = document.querySelector('.gtile[data-tile-id="' + tid + '"]');
        const cropEl = document.querySelector('[data-kind="crop"][data-tile-id="' + tid + '"]');
        const quest = document.querySelector('#questDock');
        const seed = document.querySelector('#seedHud');
        const target = cropEl && vis(cropEl) ? ro(cropEl) : ro(tileEl);
        const tileRect = ro(tileEl);
        return {
          vsQuest: Math.round(inter(tileRect, ro(quest))), vsSeed: Math.round(inter(tileRect, ro(seed))),
          cropVsQuest: cropEl && vis(cropEl) ? Math.round(inter(target, ro(quest))) : 0,
          cropVsSeed: cropEl && vis(cropEl) ? Math.round(inter(target, ro(seed))) : 0,
          questCls: quest.className, seedCls: seed.className,
        };
      }, { src: HELP, tid: harvest });
      assert.equal(cover.vsQuest, 0, `${w}×${h} 成熟田格被任務卡遮住（交集 ${cover.vsQuest}px，任務卡狀態 ${cover.questCls}）`);
      assert.equal(cover.vsSeed, 0, `${w}×${h} 成熟田格被種子欄遮住（交集 ${cover.vsSeed}px，種子欄狀態 ${cover.seedCls}）`);
      assert.equal(cover.cropVsQuest, 0, `${w}×${h} 成熟作物被任務卡遮住（交集 ${cover.cropVsQuest}px）`);
      assert.equal(cover.cropVsSeed, 0, `${w}×${h} 成熟作物被種子欄遮住（交集 ${cover.cropVsSeed}px）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `harvest-${w}x${h}.png`) });
      console.log(`OK 收成 ${w}×${h} 成熟田格與任務卡、種子欄交集 0`);

      // 10：選取框只框一格 + 成熟發光亮部比例（僅桌機大尺寸量測像素）
      if (w === 1366 && h === 768) {
        const readyRect = await page.evaluate((tid) => {
          const e = document.querySelector('[data-kind="crop"][data-tile-id="' + tid + '"]') || document.querySelector('.gtile[data-tile-id="' + tid + '"]');
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(document.querySelector('[data-kind="crop"][data-tile-id="' + tid + '"]') || e);
          return { left: r.left, top: r.top, width: r.width, height: r.height, filter: cs.filter || '' };
        }, harvest);
        const ratio = await brightRatio(page, readyRect);
        assert(ratio < 0.05, `1366×768 成熟作物近白亮部比例 ${(ratio * 100).toFixed(2)}% 超過 5%（過曝）`);
        console.log(`OK 發光 1366×768 成熟作物近白亮部比例 ${(ratio * 100).toFixed(2)}% ＜ 5%`);
        await page.evaluate(() => {
          const s = window.__farm.state();
          s.plots[0].cropId = 'wheat'; s.plots[0].plantedAt = Date.now(); delete s.plots[0].wateredAt;
          const tile = s.map.tiles.find((t) => t.plotIndex === 0);
          const adj = s.map.tiles.find((t) => t.x === tile.x && t.y === tile.y + 1) || s.map.tiles.find((t) => t.x === tile.x + 1 && t.y === tile.y);
          if (adj) { s.player.tileId = adj.id; s.player.x = adj.x; s.player.y = adj.y; }
          window.__farm.refresh(); if (window.__farm.followPlayer) window.__farm.followPlayer();
          window.__farm.setTool('water'); window.__farm.focusTile(tile.id); window.__farm.clickTile(tile.id);
        });
        await page.waitForTimeout(300);
        const sel = await page.evaluate(() => {
          const sels = [...document.querySelectorAll('.gtile.sel')];
          const any = document.querySelector('.gtile');
          const sr = sels[0] ? sels[0].getBoundingClientRect() : null;
          const ar = any ? any.getBoundingClientRect() : null;
          return { count: sels.length, w: sr ? sr.width : 0, tileW: ar ? ar.width : 0, shadow: sels[0] ? getComputedStyle(sels[0]).boxShadow : '' };
        });
        assert.equal(sel.count, 1, `1366×768 選取格數量 ${sel.count}，應只有一格`);
        assert(Math.abs(sel.w - sel.tileW) <= 2, `1366×768 選取框寬 ${sel.w.toFixed(1)}px 與一格寬 ${sel.tileW.toFixed(1)}px 不符`);
        console.log(`OK 選取 1366×768 選取框只有一格、寬 ${Math.round(sel.w)}px 等於一格寬`);
        await page.evaluate(() => { window.__farm.setTool('hand'); });
      }

      // 8：對話不遮說話者——把鏡頭北移讓說話者在畫面下半部，對話框應改放另一側
      await page.evaluate(() => {
        const s = window.__farm.state();
        const mayor = s.map.tiles.find((t) => t.npc === 'mayor');
        const north = s.map.tiles.find((t) => t.x === mayor.x && t.y === mayor.y - 3) || mayor;
        window.__farm.focusTile(north.id);
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => { window.FarmWorld.speak('鎮長 葛瑞', '收成先留一籃，別全拿去賣。'); });
      await page.waitForFunction(() => { const d = document.querySelector('#worldDialogue'); return d && !d.hidden && getComputedStyle(d).display !== 'none'; }, null, { timeout: 9000 });
      await page.waitForTimeout(750);
      const dlg = await page.evaluate((src) => {
        eval(src);
        const box = document.querySelector('#worldDialogue');
        const npc = document.querySelector('[data-kind="npc"][data-npc="mayor"]');
        if (!box || !npc || !vis(box)) return null;
        const dr = ro(box), nr = ro(npc);
        return { vsNpc: Math.round(inter(dr, nr)), npcInView: nr.top >= -2 && nr.bottom <= innerHeight + 2 && nr.left >= -2 && nr.right <= innerWidth + 2, cls: box.className };
      }, HELP);
      assert(dlg, `${w}×${h} 對話框或說話者不存在`);
      assert.equal(dlg.vsNpc, 0, `${w}×${h} 對話框遮住說話者（交集 ${dlg.vsNpc}px，狀態 ${dlg.cls}）`);
      assert(dlg.npcInView, `${w}×${h} 對話中說話者未完整在畫面內`);
      await page.screenshot({ path: path.join(SHOT_DIR, `dialogue-${w}x${h}.png`) });
      console.log(`OK 對話 ${w}×${h} 對話框與說話者交集 0、說話者完整可見`);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; });
      await page.waitForTimeout(200);

      // 7：手機橫式 HUD
      if (w === 844 && h === 390) {
        await page.evaluate(() => {
          const s = window.__farm.state();
          s.adventure.claimed = {}; s.adventure.quests = {}; s.adventure.byTarget.talk = { mayor: 1 };
          s.adventure.counts.plant = 0; s.adventure.counts.water = 0;
          s.plots.forEach((p) => { p.cropId = null; delete p.wateredAt; });
          if (s.heirloom) s.heirloom.started = false;
          window.__farm.refresh();
        });
        await page.waitForTimeout(600);
        const land = await page.evaluate((src) => {
          eval(src);
          const quest = document.querySelector('#questDock');
          const btn = quest.querySelector('.world-objective-bottom button');
          const scene = ro(document.querySelector('#mapScene'));
          return {
            btnText: btn ? btn.textContent.trim() : '',
            btnScroll: btn ? btn.scrollWidth : 0, btnClient: btn ? btn.clientWidth : 0,
            questCls: quest.className, questH: Math.round(ro(quest).height),
            visiblePct: scene.height / innerHeight * 100,
          };
        }, HELP);
        assert(land.btnText.includes('種下作物'), `844×390 收合任務列動作應完整顯示「種下作物」，實際「${land.btnText}」（任務卡狀態 ${land.questCls}）`);
        assert(land.btnScroll <= land.btnClient + 2, `844×390 動作文字被截斷（內容寬 ${land.btnScroll}px／可視寬 ${land.btnClient}px）`);
        assert(land.visiblePct >= 55, `844×390 世界可視高度 ${land.visiblePct.toFixed(1)}% 低於 55%`);
        console.log(`OK 橫式 844×390 收合任務列完整顯示「${land.btnText}」、世界可視高度 ${land.visiblePct.toFixed(0)}% ≥ 55%`);
        // 浮動交談鈕不蓋住主角
        await page.evaluate(() => { const s = window.__farm.state(); const m = s.map.tiles.find((t) => t.npc === 'mayor'); window.__farm.clickTile(m.id); });
        await page.waitForTimeout(300);
        const talk = await page.evaluate((src) => {
          eval(src);
          const bar = document.querySelector('#sceneActionBar');
          const player = document.querySelector('#player');
          const btn = bar && !bar.hidden ? bar.querySelector('[data-action="talk"]') : null;
          if (!btn || !player) return { has: !!btn, vs: 0 };
          return { has: true, vs: Math.round(inter(ro(bar), ro(player))), text: btn.textContent.trim() };
        }, HELP);
        assert(talk.has, '844×390 選取 NPC 後未出現交談鈕');
        assert.equal(talk.vs, 0, `844×390 交談鈕蓋住主角（交集 ${talk.vs}px）`);
        const landAfter = await page.evaluate((src) => { eval(src); const b = document.querySelector('#questDock .world-objective-bottom button'); const c = document.querySelector('#questDock [data-audit="quest-collapse"]'); return b ? { text: b.textContent.trim(), scroll: b.scrollWidth, client: b.clientWidth, cls: document.querySelector('#questDock').className, vsCollapse: c && vis(c) ? Math.round(inter(ro(b), ro(c))) : 0 } : null; }, HELP);
        assert(landAfter && landAfter.text.includes('種下作物') && landAfter.scroll <= landAfter.client + 2, `844×390 點選 NPC 後任務列動作被截斷（實際「${landAfter && landAfter.text}」內容寬 ${landAfter && landAfter.scroll}px／可視寬 ${landAfter && landAfter.client}px，狀態 ${landAfter && landAfter.cls}）`);
        assert.equal(landAfter.vsCollapse, 0, `844×390 任務列動作被收合鈕蓋住（交集 ${landAfter.vsCollapse}px）`);
        await page.screenshot({ path: path.join(SHOT_DIR, 'landscape-844x390.png') });
        console.log('OK 橫式 844×390 交談鈕未蓋住主角');
        await page.evaluate(() => { window.__farm.cancelJourney(); const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; });
      }

      // 9：設定面板捲到底——最後一行不被「完成」鈕遮住
      await page.evaluate(() => document.querySelector('#settingsBtn').click());
      await page.waitForTimeout(400);
      const settings = await page.evaluate((src) => {
        eval(src);
        const card = document.querySelector('#settingsModal .modal-card');
        const list = document.querySelector('#settingsList');
        const ok = document.querySelector('#settingsOk');
        if (!card || !list || !ok) return null;
        list.scrollTop = list.scrollHeight; card.scrollTop = card.scrollHeight;
        const rows = [...list.querySelectorAll('.setting-row, .save-manager, .settings-series, .offline-review')];
        const last = rows[rows.length - 1];
        const cr = ro(card), or = ro(ok), lr = last ? ro(last) : null;
        const descs = [...list.querySelectorAll('.setting-desc')];
        const lastDesc = descs[descs.length - 1] ? ro(descs[descs.length - 1]) : null;
        return {
          canScroll: list.scrollHeight > list.clientHeight,
          okIn: or.top >= cr.top && or.bottom <= cr.bottom + 1 && or.bottom <= innerHeight + 1,
          lastVsOk: lr ? Math.round(inter(lr, or)) : 0,
          descVsOk: lastDesc ? Math.round(inter(lastDesc, or)) : 0,
        };
      }, HELP);
      assert(settings, `${w}×${h} 設定面板不存在`);
      assert(settings.okIn, `${w}×${h} 設定「完成」鈕未完整落在卡片內`);
      assert.equal(settings.lastVsOk, 0, `${w}×${h} 設定最後一行被「完成」鈕遮住（交集 ${settings.lastVsOk}px）`);
      assert.equal(settings.descVsOk, 0, `${w}×${h} 設定最後一行說明被「完成」鈕遮住（交集 ${settings.descVsOk}px）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `settings-bottom-${w}x${h}.png`) });
      console.log(`OK 設定 ${w}×${h} 捲到底後最後一行未被「完成」鈕遮住${settings.canScroll ? '（面板可內捲）' : ''}`);
      await page.evaluate(() => document.querySelector('#settingsOk').click());
      await page.waitForTimeout(200);
      await ctx.close();
    }
    console.log('VERIFIED test-content-r29-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : '（http://127.0.0.1:' + PORT + '）'));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });

