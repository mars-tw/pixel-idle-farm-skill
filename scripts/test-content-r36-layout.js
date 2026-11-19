'use strict';
/* R36 B 線（第 6～10 項）：主角不上屋頂、UI 不蓋田、面板單一捲動提示、
   畫面瑕疵（樹樁暈影／建造發光／手機標誌／設定關閉鈕）、手機橫式減量。
   先以 Node 直接驗建物屋頂碰撞，再用 playwright 實測四種尺寸並截圖存
   docs/content/r36/layout/。結束時關閉伺服器與瀏覽器，失敗 exit 1。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5196;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r36', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r36-layout');
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(SHOT_DIR, { recursive: true });
process.env.TEMP = TMP; process.env.TMP = TMP; process.env.TMPDIR = TMP;

// ---------- 第 6 項（Node）：屋頂碰撞 ----------
{
  const S = require('../src/state');
  const G = require('../src/game');
  const s = S.defaultState(100000);
  const at = (x, y) => s.map.tiles.find((t) => t.x === x && t.y === y);
  for (const [x, y, label] of [[11, 3, '農舍北側'], [12, 3, '農舍北側中央'], [13, 3, '農舍北側'], [12, 5, '穀倉北側'], [13, 5, '穀倉北側'], [11, 0, '攤位北側'], [12, 0, '攤位北側']]) {
    assert.equal(G.isRoofBlocked(s, at(x, y)), true, `${label}（${x},${y}）腳底點應落在屋頂矩形內`);
    assert.equal(G.isWalkable(s, at(x, y)), false, `${label}（${x},${y}）不可站立`);
  }
  for (const [x, y, label] of [[10, 3, '農舍西側'], [14, 3, '農舍東側'], [12, 6, '農舍南側（穀倉占地外）'], [3, 6, '雞舍北側（sprite 不外擴）']]) {
    if (label.includes('穀倉占地外')) continue; // (12,6) 是穀倉 footprint，本來就不可走
    assert.equal(G.isRoofBlocked(s, at(x, y)), false, `${label}（${x},${y}）腳底點不應落在屋頂矩形內`);
  }
  assert.equal(G.isWalkable(s, at(12, 2)), false, '（12,2）是攤位占地，不可站立（與屋頂無關）');
  const stand = G.planMoveToStructure(s, 'farmhouse');
  assert(stand, '農舍應有可站立的互動站位');
  const standTile = G.getTileById(s, stand.standId);
  assert.equal(G.isRoofBlocked(s, standTile), false, `農舍互動站位 ${stand.standId} 不應在屋頂上`);
  assert(stand.path.every((id) => !G.isRoofBlocked(s, G.getTileById(s, id))), '前往農舍的路徑不應踏上屋頂');
  const elder = s.map.tiles.find((t) => t.npc === 'elder');
  const toElder = G.planMoveTo(s, elder.id);
  assert(toElder, '老農班伯應可抵達');
  assert(toElder.path.every((id) => !G.isRoofBlocked(s, G.getTileById(s, id))), '前往班伯的路徑不應踏上屋頂');
  console.log('OK 第 6 項（Node）屋頂格不可站、農舍站位與前往班伯路徑不經屋頂');
}

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
  globalThis.footInStructures = () => {
    const p = document.querySelector('#player'); if (!p) return null;
    const pr = ro(p); const foot = { x: pr.left + pr.width / 2, y: pr.bottom - 2 };
    const hits = [...document.querySelectorAll('.ob[data-kind="structure"], .ob[data-kind="building"]')].filter(vis).filter((e) => { const r = ro(e); return foot.x >= r.left && foot.x <= r.right && foot.y >= r.top && foot.y <= r.bottom; }).map((e) => e.dataset.structureId || e.dataset.kind);
    return { foot, hits, playerRect: pr, tileId: window.__farm.playerTileId() };
  };
`;
async function setupHarvest(page) {
  const tid = await page.evaluate(() => {
    const s = window.__farm.state();
    s.adventure.claimed = { c1_homecoming: true };
    s.adventure.byTarget.talk = { mayor: 1 };
    s.adventure.counts.plant = 3; s.adventure.counts.water = 3;
    for (let i = 0; i < 3; i++) { s.plots[i].cropId = 'wheat'; s.plots[i].plantedAt = Date.now() - 30 * 60 * 1000; delete s.plots[i].wateredAt; }
    s.inventory = s.inventory || {}; s.inventory.wheat = 6;
    const tile = s.map.tiles.find((t) => t.plotIndex === 0);
    const far = s.map.tiles.find((t) => t.x === tile.x + 4 && t.y === tile.y + 3) || s.map.tiles[s.map.tiles.length - 1];
    s.player.tileId = far.id; s.player.x = far.x; s.player.y = far.y;
    window.__farm.refresh();
    window.__farm.focusTile(tile.id);
    return tile.id;
  });
  await page.waitForTimeout(1200);
  return tid;
}
async function measureHarvestCover(page, tag) {
  const m = await page.evaluate((src) => {
    eval(src);
    const targets = [...document.querySelectorAll('.gtile.farm-plot')].filter((e) => ['t2_1', 't3_1', 't4_1'].includes(e.dataset.tileId)).map((e) => ({ id: e.dataset.tileId, r: ro(e), state: e.dataset.plotState }));
    const huds = {};
    for (const [name, sel] of [['種子欄', '#seedHud'], ['任務列', '#questDock'], ['全部鈕', '#seedHud .seed.more']]) {
      const e = document.querySelector(sel);
      if (e && vis(e)) huds[name] = ro(e);
    }
    const overlaps = [];
    for (const t of targets) for (const [name, r] of Object.entries(huds)) { const v = inter(t.r, r); if (v > 0) overlaps.push(`${t.id} 被${name}蓋 ${Math.round(v)}px`); }
    return { targets, huds, overlaps, step: document.body.dataset.questStep || '' };
  }, HELP);
  assert.equal(m.targets.length, 3, `${tag} 收成目標田格應有 3 格，實際 ${m.targets.length}`);
  for (const t of m.targets) assert(t.r.left >= -1 && t.r.top >= -1 && t.r.right <= 2000 && t.r.bottom <= 2000, `${tag} 目標田格 ${t.id} 不在可視範圍`);
  assert.deepEqual(m.overlaps, [], `${tag} 收成階段目標田格被 HUD 蓋住：${m.overlaps.join('；')}`);
  console.log(`OK 第 7 項 ${tag} 收成目標田格與種子欄／任務列／全部鈕交集 0（步驟 ${m.step || '未標記'}）`);
  return m;
}
async function measurePanel(page, tag, tab, label) {
  await page.evaluate((t) => { if (window.FarmWorld && window.FarmWorld.openPanel) window.FarmWorld.openPanel(t); else document.querySelector('.side-tab[data-tab="' + t + '"]').click(); }, tab);
  await page.waitForTimeout(700);
  const before = await page.evaluate((src) => {
    eval(src);
    const body = document.querySelector('.side-body');
    const pane = document.querySelector('.side-pane.sel');
    const hint = document.querySelector('[data-audit="panel-scroll-hint"]');
    const hintVisible = hint ? vis(hint) : false;
    const moreTexts = pane ? [...pane.querySelectorAll('button')].filter(vis).map((b) => b.textContent.trim()).filter((t) => /再顯示|往下還有|顯示更多/.test(t)) : [];
    const docks = ['#farmDock', '.side-tabs', '.tool-bar'].map((s) => document.querySelector(s)).filter((e) => e && vis(e)).map(ro);
    return { body: body && vis(body) ? ro(body) : null, hintVisible, moreTexts, dockTop: docks.length ? Math.min(...docks.map((r) => r.top)) : innerHeight };
  }, HELP);
  assert(before.body, `${tag} ${label}面板未開啟`);
  assert.equal(before.hintVisible, false, `${tag} ${label}面板仍顯示「往下還有內容」（應只留一種提示）`);
  assert(!before.moreTexts.some((t) => t.includes('往下還有')), `${tag} ${label}面板同時出現兩種捲動提示：${before.moreTexts.join('、')}`);
  assert(before.body.bottom <= before.dockTop + 1, `${tag} ${label}面板底邊 ${Math.round(before.body.bottom)} 超過底部工具列上緣 ${Math.round(before.dockTop)}`);
  await page.evaluate(() => { const b = document.querySelector('.side-body'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(400);
  const after = await page.evaluate((src) => {
    eval(src);
    const body = document.querySelector('.side-body');
    const pane = document.querySelector('.side-pane.sel');
    const btns = pane ? [...pane.querySelectorAll('button')].filter(vis) : [];
    const last = btns[btns.length - 1];
    const docks = ['#farmDock', '.side-tabs', '.tool-bar'].map((s) => document.querySelector(s)).filter((e) => e && vis(e)).map(ro);
    return { body: ro(body), last: last ? { text: last.textContent.trim().slice(0, 24), r: ro(last) } : null, dockTop: docks.length ? Math.min(...docks.map((r) => r.top)) : innerHeight };
  }, HELP);
  assert(after.last, `${tag} ${label}面板沒有可見按鈕`);
  assert(after.last.r.top >= after.body.top - 1 && after.last.r.bottom <= after.body.bottom + 1, `${tag} ${label}面板捲到底後最下方按鈕「${after.last.text}」未完整在面板內（${Math.round(after.last.r.top)}～${Math.round(after.last.r.bottom)}／面板 ${Math.round(after.body.top)}～${Math.round(after.body.bottom)}）`);
  assert(after.last.r.bottom <= after.dockTop + 1, `${tag} ${label}面板最下方按鈕與底部工具列交疊`);
  console.log(`OK 第 8 項 ${tag} ${label}面板只剩一種提示、底邊 ${Math.round(before.body.bottom)} ≤ 工具列上緣 ${Math.round(before.dockTop)}、捲到底最後按鈕「${after.last.text}」完整可見`);
  await page.evaluate(() => { const p = document.querySelector('.side-panel'); if (p) p.classList.remove('world-panel-open'); });
  await page.waitForTimeout(300);
}
(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    // ---------- 桌機 1366×768：第 6、7、8、9 項 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
      const tag = '1366x768';
      // 第 6 項：以點擊（公開移動方式）前往班伯，再嘗試移到農舍屋頂中心
      await page.evaluate(() => { const s = window.__farm.state(); const elder = s.map.tiles.find((t) => t.npc === 'elder'); window.__farm.clickTile(elder.id); });
      await page.waitForFunction(() => !window.__farm.moving(), null, { timeout: 30000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; const m = document.querySelector('.modal.show'); if (m) m.classList.remove('show'); });
      let foot = await page.evaluate((src) => { eval(src); return footInStructures(); }, HELP);
      assert(foot && foot.hits.length === 0, `${tag} 走到班伯後主角腳底落在建物屋頂矩形內：${foot && foot.hits.join('、')}（${foot && foot.tileId}）`);
      console.log(`OK 第 6 項 ${tag} 走到班伯後主角在 ${foot.tileId}，腳底不在任何建物屋頂矩形內`);
      await page.screenshot({ path: path.join(SHOT_DIR, 'mid-elder-1366x768.png') });
      await page.evaluate(() => window.__farm.clickTile('t12_5'));
      await page.waitForFunction(() => !window.__farm.moving(), null, { timeout: 30000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => { if (window.__farm.closeModal) { try { window.__farm.closeModal('worldModal'); } catch (e) {} } const m = document.querySelector('.modal.show'); if (m) m.classList.remove('show'); });
      foot = await page.evaluate((src) => { eval(src); const s = window.__farm.state(); const t = s.map.tiles.find((v) => v.id === s.player.tileId); return { ...footInStructures(), walkable: window.isWalkable(s, t), roof: window.Game && window.Game.isRoofBlocked ? window.Game.isRoofBlocked(s, t) : null }; }, HELP);
      assert.equal(foot.walkable, true, `${tag} 嘗試移到屋頂中心後主角應被帶回可走區，實際落在 ${foot.tileId}（不可走）`);
      assert.equal(foot.roof, false, `${tag} 嘗試移到屋頂中心後主角落在屋頂格 ${foot.tileId}`);
      assert.equal(foot.hits.length, 0, `${tag} 嘗試移到屋頂中心後腳底仍在屋頂矩形內：${foot.hits.join('、')}`);
      console.log(`OK 第 6 項 ${tag} 點農舍屋頂中心後主角回到可走區 ${foot.tileId}，腳底不在屋頂矩形內`);
      // 第 7 項
      await setupHarvest(page);
      await measureHarvestCover(page, tag);
      await page.screenshot({ path: path.join(SHOT_DIR, 'harvest-1366x768.png') });
      // 第 8 項
      await measurePanel(page, tag, 'upgrades', '升級');
      await measurePanel(page, tag, 'story', '手記');
      // 第 9 項：樹樁暈影、雲影、建造發光、設定關閉鈕、標誌
      const art = await page.evaluate((src) => {
        eval(src);
        const stump = document.querySelector('.ob[data-object="stump"]');
        const stumpFilter = stump ? getComputedStyle(stump).filter : '';
        const cloud = getComputedStyle(document.querySelector('#weatherLayer'), '::after').backgroundImage;
        const alphas = [...cloud.matchAll(/rgba\([^)]*?,\s*([\d.]+)\)/g)].map((m) => parseFloat(m[1]));
        return { stumpFilter, cloudMax: alphas.length ? Math.max(...alphas) : 0 };
      }, HELP);
      const stumpAlpha = (art.stumpFilter.match(/rgba\([^)]*?,\s*([\d.]+)\)/) || [])[1];
      assert(stumpAlpha !== undefined && parseFloat(stumpAlpha) <= 0.18, `${tag} 樹樁落影仍太深（${art.stumpFilter}）`);
      assert(art.cloudMax <= 0.08, `${tag} 晴天雲影仍太深（最大 alpha ${art.cloudMax}），會像髒污`);
      console.log(`OK 第 9 項 ${tag} 樹樁落影 alpha ${stumpAlpha}、雲影最大 alpha ${art.cloudMax}，皆已改小改淡`);
      await page.evaluate(() => window.__farm.setTool('build'));
      await page.waitForTimeout(900);
      const build = await page.evaluate((src) => {
        eval(src);
        const tile = document.querySelector('.gtile.farm-plot.state-ready');
        const crops = [...document.querySelectorAll('.ob.crop')].map((e) => getComputedStyle(e).filter);
        return { wheel: vis(document.querySelector('#buildWheel')), shadow: tile ? getComputedStyle(tile).boxShadow : '', crops, sunBeams: [...document.querySelectorAll('.sun-beam')].filter(vis).length };
      }, HELP);
      assert(build.wheel, `${tag} 建造選單未開啟`);
      assert.equal(build.sunBeams, 0, `${tag} 建造模式仍有 ${build.sunBeams} 團大面積陽光發光蓋住成熟作物`);
      assert(!/0px 0px (1[0-9]|[2-9]\d)px/.test(build.shadow), `${tag} 建造模式成熟田格仍有大面積外發光（${build.shadow}）`);
      for (const f of build.crops) assert(!/drop-shadow\([^)]*? (1[0-9]|[4-9])px\)/.test(f) || f === 'none', `${tag} 建造模式成熟作物發光糊成一團（${f}）`);
      console.log(`OK 第 9 項 ${tag} 建造模式成熟作物無大面積發光（田格影：${build.shadow.slice(0, 60)}）`);
      await page.screenshot({ path: path.join(SHOT_DIR, 'build-1366x768.png') });
      await page.evaluate(() => window.__farm.setTool('hand'));
      await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector('#settingsBtn').click());
      await page.waitForTimeout(500);
      const settings = await page.evaluate((src) => {
        eval(src);
        const card = document.querySelector('#settingsModal .modal-card');
        const close = document.querySelector('[data-audit="settings-close"]');
        return { card: card ? ro(card) : null, close: close ? { r: ro(close), v: vis(close), label: close.getAttribute('aria-label') || '' } : null, shown: !!document.querySelector('#settingsModal.show') || getComputedStyle(document.querySelector('#settingsModal')).display !== 'none' };
      }, HELP);
      assert(settings.close && settings.close.v, `${tag} 設定面板沒有可見的右上關閉鈕`);
      assert(settings.close.r.top <= settings.card.top + 56 && settings.close.r.right >= settings.card.right - 56, `${tag} 設定關閉鈕不在卡片右上（${JSON.stringify(settings.close.r)}／卡 ${JSON.stringify(settings.card)}）`);
      await page.evaluate(() => document.querySelector('[data-audit="settings-close"]').click());
      await page.waitForTimeout(400);
      const closed = await page.evaluate(() => { const m = document.querySelector('#settingsModal'); return !m.classList.contains('show') && getComputedStyle(m).display === 'none'; });
      assert.equal(closed, true, `${tag} 點設定右上關閉鈕後面板未關閉`);
      console.log(`OK 第 9 項 ${tag} 設定面板有右上關閉鈕（${settings.close.label}）且可關閉`);
      await ctx.close();
    }
    // ---------- 1366×600：第 7、8 項 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 600);
      const tag = '1366x600';
      await setupHarvest(page);
      await measureHarvestCover(page, tag);
      await measurePanel(page, tag, 'upgrades', '升級');
      await measurePanel(page, tag, 'story', '手記');
      await ctx.close();
    }
    // ---------- 844×390：第 7、8、9、10 項 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 844, 390);
      const tag = '844x390';
      const logo = await page.evaluate((src) => { eval(src); const img = document.querySelector('.farm-logo'); return img ? { r: ro(img), vw: innerWidth } : null; }, HELP);
      assert(logo && logo.r.left >= 8 && logo.r.top >= 8, `${tag} 手機開場標誌貼邊（left ${logo && Math.round(logo.r.left)}、top ${logo && Math.round(logo.r.top)}，應至少 8px）`);
      assert(logo.r.right <= logo.vw - 8, `${tag} 手機開場標誌貼右邊（right ${Math.round(logo.r.right)}／${logo.vw}）`);
      console.log(`OK 第 9 項 ${tag} 手機標誌四邊留白（left ${Math.round(logo.r.left)}px、top ${Math.round(logo.r.top)}px）`);
      // 播種步驟：種子欄與任務列同列同高
      await page.waitForTimeout(500);
      const plantRow = await page.evaluate((src) => {
        eval(src);
        const q = document.querySelector('#questDock'), seed = document.querySelector('#seedHud');
        return { step: document.body.dataset.questStep || '', q: q && vis(q) ? ro(q) : null, seed: seed && vis(seed) ? ro(seed) : null };
      }, HELP);
      assert(plantRow.seed, `${tag} 初始步驟（${plantRow.step || '未標記'}）種子欄應顯示並與任務列同列`);
      assert(Math.abs(plantRow.seed.top - plantRow.q.top) <= 8, `${tag} 任務列與種子欄未併成一列（任務 top ${Math.round(plantRow.q.top)}、種子 top ${Math.round(plantRow.seed.top)}）`);
      console.log(`OK 第 10 項 ${tag} 播種步驟任務列與種子欄同列（top 差 ${Math.abs(Math.round(plantRow.seed.top - plantRow.q.top))}px）`);
      await setupHarvest(page);
      const harv = await measureHarvestCover(page, tag);
      // 第 10 項：收成步驟種子欄收起、世界可視面積、互動鈕不蓋田與 NPC
      const mobile = await page.evaluate((src) => {
        eval(src);
        const seed = document.querySelector('#seedHud');
        const sels = '.title, #resBar .res, #questDock, .seed-hud, #farmDock .tool, #farmDock #dailyOpen, #farmMore, .toolbar .btn, #mapFitToggle, .dpad-btn, #actionA';
        const rects = [...document.querySelectorAll(sels)].filter(vis).map(ro).filter((r) => r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight);
        const step = 8; let covered = 0, total = 0;
        for (let y = step / 2; y < innerHeight; y += step) for (let x = step / 2; x < innerWidth; x += step) { total++; if (rects.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) covered++; }
        return { seedVis: seed ? vis(seed) : false, worldPct: total ? 100 - covered / total * 100 : 100, step: document.body.dataset.questStep || '' };
      }, HELP);
      assert.equal(mobile.seedVis, false, `${tag} 收成步驟（${mobile.step}）種子欄應收起，只在播種步驟出現`);
      assert(mobile.worldPct >= 70, `${tag} 世界可視面積 ${mobile.worldPct.toFixed(1)}% 未達 70%`);
      console.log(`OK 第 10 項 ${tag} 收成步驟種子欄收起、世界可視 ${mobile.worldPct.toFixed(1)}% ≥ 70%`);
      await page.evaluate(() => { const s = window.__farm.state(); const elder = s.map.tiles.find((t) => t.npc === 'elder'); window.__farm.clickTile(elder.id); });
      await page.waitForFunction(() => !window.__farm.moving(), null, { timeout: 30000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; });
      const act = await page.evaluate((src) => {
        eval(src);
        const btn = document.querySelector('#actionA');
        if (!btn || !vis(btn)) return { vis: false };
        const br = ro(btn);
        const plots = [...document.querySelectorAll('.gtile.farm-plot')].filter(vis).map(ro);
        const npcs = [...document.querySelectorAll('.ob[data-kind="npc"]')].filter(vis).map(ro);
        return { vis: true, r: br, vsPlots: Math.max(0, ...plots.map((r) => inter(br, r))), vsNpcs: Math.max(0, ...npcs.map((r) => inter(br, r))) };
      }, HELP);
      if (!act.vis) {
        const owner = await page.evaluate(() => {
          const thumb = document.querySelector('#actionA');
          const nodes = Array.from(document.querySelectorAll('[data-r76b-dialogue="elder"] button, #questDock [data-world-go], #sceneActionBar button, .npc-bubble[data-npc="elder"]'));
          const visible = nodes.filter(el => {
            const r = el.getBoundingClientRect(), css = getComputedStyle(el);
            const hit = document.elementFromPoint(r.x + r.width/2,r.y + r.height/2);
            return r.width > 0 && r.height > 0 && css.visibility !== 'hidden' && !el.disabled && (hit === el || el.contains(hit));
          });
          return { reason:thumb.dataset.r85Dup || thumb.dataset.r83aOffTarget, controls:visible.map(el=>el.textContent.trim()),
            talk:!!document.querySelector('[data-r76b-dialogue="elder"]') };
        });
        assert(owner.controls.length > 0 && (owner.talk || ['same','target','pick','offscreen','true'].includes(owner.reason)),
          `${tag} 隱藏大鈕時仍應有能點擊的目前動作：${JSON.stringify(owner)}`);
        console.log(`OK 第 10 項 ${tag} 大鈕讓位，畫面上仍可點擊：${owner.controls.join("、")}`);
      } else {
        assert.equal(act.vsPlots, 0, `${tag} 互動鈕蓋住田格（交集 ${act.vsPlots}px）`);
        assert.equal(act.vsNpcs, 0, `${tag} 互動鈕蓋住 NPC（交集 ${act.vsNpcs}px）`);
        console.log(`OK 第 10 項 ${tag} 互動鈕與田格、NPC 交集皆為 0`);
      }
      await page.screenshot({ path: path.join(SHOT_DIR, 'landscape-844x390.png') });
      await measurePanel(page, tag, 'upgrades', '升級');
      await measurePanel(page, tag, 'story', '手記');
      void harv;
      await ctx.close();
    }
    // ---------- 390×844：第 8 項與標誌 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 390, 844);
      const tag = '390x844';
      const logo = await page.evaluate((src) => { eval(src); const img = document.querySelector('.farm-logo'); return img ? { r: ro(img), vw: innerWidth } : null; }, HELP);
      assert(logo && logo.r.left >= 8 && logo.r.top >= 8 && logo.r.right <= logo.vw - 8, `${tag} 手機標誌四邊未留至少 8px（${JSON.stringify(logo && logo.r)}）`);
      console.log(`OK 第 9 項 ${tag} 手機標誌四邊留白（left ${Math.round(logo.r.left)}px、top ${Math.round(logo.r.top)}px）`);
      await measurePanel(page, tag, 'upgrades', '升級');
      await measurePanel(page, tag, 'story', '手記');
      await ctx.close();
    }
    console.log('VERIFIED test-content-r36-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : `（http://127.0.0.1:${PORT}）`));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
