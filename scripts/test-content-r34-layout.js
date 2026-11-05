'use strict';
/* R34 B 線（第 6～10 項）：中期畫面。用 playwright 在本機起伺服器實測（結束關閉），
   截圖存 docs/content/r34/layout/ 並逐項量測：主角遮擋輪廓、池塘岸線、升級卡、
   建造卡與種子欄、任務地面圈、小地圖玩家點、手機 logo。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5179;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r34', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const TMP = path.join(ROOT, '.tmp-r34-layout');
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
  globalThis.placePlayer = (x, y) => { const s = window.__farm.state(); const t = s.map.tiles.find((v) => v.x === x && v.y === y); s.player.tileId = t.id; s.player.x = t.x; s.player.y = t.y; window.__farm.refresh(); };
  globalThis.spriteAlpha = async (el) => {
    const cs = getComputedStyle(el);
    const url = (cs.backgroundImage.match(/url\\("?([^")]+)"?\\)/) || [])[1];
    if (!url) return 0;
    const img = new Image(); img.src = url; await img.decode();
    const w = Math.max(1, Math.round(el.getBoundingClientRect().width)), h = Math.max(1, Math.round(el.getBoundingClientRect().height));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const bw = parseFloat(cs.backgroundSize.split(' ')[0]) || w, bh = parseFloat(cs.backgroundSize.split(' ')[1]) || h;
    const px = parseFloat(cs.backgroundPosition.split(' ')[0]) || 0, py = parseFloat(cs.backgroundPosition.split(' ')[1]) || 0;
    x.drawImage(img, px, py, bw, bh);
    const d = x.getImageData(0, 0, w, h).data; let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++;
    return n;
  };
`;
(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
    // ---- 第 6 項：主角在農舍、穀倉、攤位後方都有全身輪廓 ----
    for (const [label, x, y, shot] of [['農舍', 12, 3, 'player-behind-farmhouse-1366x768.png'], ['穀倉', 12, 5, null], ['攤位', 12, 0, null]]) {
      await page.evaluate(({ src, x, y }) => { eval(src); placePlayer(x, y); }, { src: HELP, x, y });
      await page.waitForTimeout(900);
      const m = await page.evaluate(async (src) => {
        eval(src);
        const player = document.querySelector('#player');
        const locator = document.querySelector('#playerLocator');
        if (!player || !locator) return null;
        const body = locator.querySelector('div');
        const alpha = body ? await spriteAlpha(body) : 0;
        const front = document.querySelector('#playerSprite');
        return {
          occluded: player.dataset.occluded,
          locVis: vis(locator), locRect: ro(locator), playerRect: ro(player),
          clip: body ? getComputedStyle(body).clipPath : '',
          opacity: body ? parseFloat(getComputedStyle(body).opacity) : 0,
          alpha, plate: locator.querySelector('span') ? locator.querySelector('span').textContent.trim() : '',
        };
      }, HELP);
      assert(m, `${label}後方定位輪廓不存在`);
      assert.equal(m.occluded, 'true', `${label}後方主角應被判定遮擋（occluded=${m.occluded}）`);
      assert(m.locVis, `${label}後方定位輪廓不可見`);
      assert(m.locRect.height >= m.playerRect.height * 0.8, `${label}後方輪廓高度 ${Math.round(m.locRect.height)}px 未達本體 ${Math.round(m.playerRect.height)}px 的 80%（只剩腳底橢圓）`);
      assert.equal(m.clip, 'none', `${label}後方輪廓仍被裁切（clip-path=${m.clip}）`);
      assert(m.opacity >= 0.5 && m.opacity < 1 || m.opacity === 1, `${label}後方輪廓不透明度異常 ${m.opacity}`);
      assert(m.alpha > 400, `${label}後方輪廓本體像素太少（${m.alpha}）`);
      assert(m.plate.length > 0, `${label}後方名牌未指向輪廓`);
      console.log(`OK 主角輪廓 ${label}後方 全身高 ${Math.round(m.locRect.height)}px、本體像素 ${m.alpha}、名牌「${m.plate}」`);
      if (shot) await page.screenshot({ path: path.join(SHOT_DIR, shot) });
    }
    // ---- 第 7 項：池塘有岸、水面有材質 ----
    await page.evaluate((src) => { eval(src); placePlayer(1, 10); const s = window.__farm.state(); if (window.__farm.focusTile) window.__farm.focusTile('t0_10'); }, HELP);
    await page.waitForTimeout(900);
    const pond = await page.evaluate((src) => {
      eval(src);
      const tiles = [...document.querySelectorAll('.gtile.water')].filter((e) => ['t0_9', 't0_10', 't1_10', 't2_10', 't0_11', 't1_11', 't2_11'].includes(e.dataset.tileId));
      const edge = tiles.filter((e) => (e.dataset.bank || '').length > 0);
      const before = tiles.length ? getComputedStyle(tiles[0], '::before').backgroundImage : '';
      const rects = tiles.map((e) => ro(e));
      const union = rects.length ? { left: Math.min(...rects.map((r) => r.left)), top: Math.min(...rects.map((r) => r.top)), right: Math.max(...rects.map((r) => r.right)), bottom: Math.max(...rects.map((r) => r.bottom)) } : null;
      return { count: tiles.length, edge: edge.length, banks: edge.map((e) => e.dataset.tileId + ':' + e.dataset.bank), before, union };
    }, HELP);
    assert.equal(pond.count, 7, `池塘應有 7 格水，實際 ${pond.count}`);
    assert(pond.edge >= 6, `池塘岸線格太少（${pond.edge}/7）：${pond.banks.join(' ')}`);
    assert(pond.before.includes('quiet-water'), `池塘水面未疊既有水面材質（${pond.before.slice(0, 80)}）`);
    const shotBuf = await page.screenshot({ path: path.join(SHOT_DIR, 'pond-1366x768.png') });
    const ring = await page.evaluate(async ({ b64, union }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const sx = img.naturalWidth / innerWidth, sy = img.naturalHeight / innerHeight;
      const L = Math.round(union.left * sx), R = Math.round(union.right * sx), T = Math.round(union.top * sy), B = Math.round(union.bottom * sy);
      const colors = new Set();
      const sample = (px, py) => { if (px < 0 || py < 0 || px >= c.width || py >= c.height) return; const d = x.getImageData(px, py, 1, 1).data; colors.add([d[0] >> 4, d[1] >> 4, d[2] >> 4].join(',')); };
      for (let px = L; px <= R; px += 3) { sample(px, T + 2); sample(px, T + 8); sample(px, B - 3); sample(px, B - 9); }
      for (let py = T; py <= B; py += 3) { sample(L + 2, py); sample(L + 8, py); sample(R - 3, py); sample(R - 9, py); }
      return colors.size;
    }, { b64: shotBuf.toString('base64'), union: pond.union });
    assert(ring >= 6, `池塘外框一圈顏色太單一（${ring} 色），仍像平塗方塊`);
    console.log(`OK 池塘 岸線 ${pond.edge}/7 格、外框一圈 ${ring} 色、水面疊 quiet-water 材質`);
    // ---- 第 8 項：升級卡版面 ----
    await page.evaluate(() => { window.__farm.state().coins = 50; window.__farm.refresh(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.side-tab[data-tab="upgrades"]').click());
    await page.waitForTimeout(700);
    const up = await page.evaluate((src) => {
      eval(src);
      const cards = [...document.querySelectorAll('.side-pane[data-pane="upgrades"] .up')];
      const rows = cards.slice(0, 3).map((c) => {
        const d = c.querySelector('.u-desc'); const btn = c.querySelector('button'); const spend = c.querySelector('[data-audit="upgrade-spend-all"]');
        return { card: ro(c), descW: d ? Math.round(ro(d).width) : 0, btn: btn ? ro(btn) : null, spend: spend ? { r: ro(spend), text: spend.textContent.trim() } : null };
      });
      const hint = document.querySelector('[data-audit="panel-scroll-hint"]');
      const buttons = [...document.querySelectorAll('.side-pane[data-pane="upgrades"] button')].filter(vis);
      return { rows, hint: hint && vis(hint) ? ro(hint) : null, btnVsHint: hint && vis(hint) ? buttons.map((b) => Math.round(inter(ro(b), ro(hint)))) : [] };
    }, HELP);
    assert(up.rows.length >= 2, '升級卡數量不足');
    for (const r of up.rows) assert(r.descW >= 150, `升級卡說明被擠成窄欄（${r.descW}px）`);
    const withSpend = up.rows.find((r) => r.spend);
    assert(withSpend, '找不到「升級後不足一輪種子成本」提示');
    assert(withSpend.spend.r.top >= withSpend.btn.bottom - 1, '種子成本提示不在按鈕下方');
    assert(withSpend.spend.r.left >= withSpend.card.left - 1 && withSpend.spend.r.right <= withSpend.card.right + 1 && withSpend.spend.r.bottom <= withSpend.card.bottom + 1, '種子成本提示超出卡片');
    assert(withSpend.spend.r.width >= withSpend.card.width * 0.8, `種子成本提示不是完整一行（寬 ${Math.round(withSpend.spend.r.width)}／卡 ${Math.round(withSpend.card.width)}）`);
    for (const v of up.btnVsHint) assert.equal(v, 0, `面板底部按鈕被「往下還有內容」提示蓋住（交集 ${v}px）`);
    console.log(`OK 升級卡 說明寬 ${up.rows.map((r) => r.descW).join('/')}px、種子成本提示在按鈕下方完整一行、底部按鈕與提示交集 0`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'upgrades-1366x768.png') });
    await page.evaluate(() => { const p = document.querySelector('.side-panel'); if (p) p.classList.remove('world-panel-open'); });
    await page.waitForTimeout(300);
    // ---- 第 9 項：建造卡不斷行、種子欄不跳、任務地面圈 ----
    const seedBefore = await page.evaluate((src) => { eval(src); const e = document.querySelector('#seedHud'); return e ? ro(e) : null; }, HELP);
    await page.evaluate(() => window.__farm.setTool('build'));
    await page.waitForTimeout(1000);
    const build = await page.evaluate((src) => {
      eval(src);
      const seed = document.querySelector('#seedHud');
      const costs = [...document.querySelectorAll('#buildWheel .bw-cost')].map((e) => ({ text: e.textContent.trim(), h: Math.round(ro(e).height), w: Math.round(ro(e).width) }));
      return { seed: seed ? ro(seed) : null, costs, wheelVis: vis(document.querySelector('#buildWheel')) };
    }, HELP);
    assert(build.wheelVis, '建造選單未開啟');
    assert(build.seed && seedBefore, '種子欄不存在');
    assert(Math.abs(build.seed.top - seedBefore.top) <= 2 && Math.abs(build.seed.left - seedBefore.left) <= 2, `種子欄在建造模式跳位置（前 ${Math.round(seedBefore.top)},${Math.round(seedBefore.left)} → 後 ${Math.round(build.seed.top)},${Math.round(build.seed.left)}）`);
    const stone = build.costs.find((c) => c.text.includes('石材'));
    assert(stone, `建造卡找不到石材價格（${JSON.stringify(build.costs)}）`);
    assert(stone.h <= 22, `建造卡「${stone.text}」斷行（高 ${stone.h}px）`);
    console.log(`OK 建造 種子欄固定（${Math.round(build.seed.left)},${Math.round(build.seed.top)}）、價格「${stone.text}」不斷行`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'build-1366x768.png') });
    await page.evaluate(() => window.__farm.setTool('hand'));
    await page.waitForTimeout(400);
    const ringM = await page.evaluate((src) => {
      eval(src);
      const ringEl = document.querySelector('[data-audit="quest-ground-ring"]');
      const npc = document.querySelector('.ob[data-kind="npc"][data-npc="mayor"]');
      const marker = document.querySelector('[data-audit="quest-marker"]');
      if (!ringEl || !npc) return null;
      const rr = ro(ringEl), nr = ro(npc);
      return { ring: rr, npc: nr, ringBorder: parseFloat(getComputedStyle(ringEl).borderTopWidth), readyGlow: marker ? getComputedStyle(marker.querySelector('.qdot')).boxShadow : '' };
    }, HELP);
    assert(ringM, '鎮長腳下任務地面圈不存在');
    assert(ringM.ringBorder >= 2, '任務地面圈邊線太細');
    assert(ringM.ring.top > ringM.npc.top + ringM.npc.height * 0.5, '任務圈不在鎮長腳下（仍像身上光暈）');
    assert(Math.abs((ringM.ring.left + ringM.ring.width / 2) - (ringM.npc.left + ringM.npc.width / 2)) <= 24, '任務圈未對準鎮長');
    console.log('OK 任務高亮 鎮長腳下地面圈（不再是身上綠色光暈）');
    // ---- 第 10 項：小地圖玩家點（桌機） ----
    const mini = await page.evaluate(() => {
      const s = window.__farm.state();
      const c = document.querySelector('#worldMinimap canvas'); if (!c) return null;
      const x = c.getContext('2d');
      const d = x.getImageData(s.player.x * 10, s.player.y * 10, 10, 10).data;
      let red = 0, white = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] > 200 && d[i + 1] > 60 && d[i + 1] < 140 && d[i + 2] < 110) red++; if (d[i] > 245 && d[i + 1] > 235 && d[i + 2] > 210) white++; }
      return { red, white, px: s.player.x, py: s.player.y };
    });
    assert(mini && mini.red >= 30, `小地圖玩家點不夠醒目（紅像素 ${mini && mini.red}）`);
    console.log(`OK 小地圖 玩家點（${mini.px},${mini.py}）紅像素 ${mini.red}、白芯 ${mini.white}`);
    await ctx.close();
    // ---- 第 10 項：手機 logo 不切頂 ----
    const m = await newPage(browser, intercepted, 390, 844);
    const logo = await m.page.evaluate((src) => {
      eval(src);
      const img = document.querySelector('.farm-logo');
      const header = document.querySelector('header');
      if (!img) return null;
      const r = ro(img), hr = ro(header);
      return { r, hr, fit: getComputedStyle(img).objectFit, vw: innerWidth };
    }, HELP);
    assert(logo, '手機 logo 不存在');
    assert(logo.r.top >= 6, `手機 logo 被頂部切到（top ${Math.round(logo.r.top)}px）`);
    assert(logo.r.left >= 6 && logo.r.right <= logo.vw - 2, `手機 logo 水平被切（${Math.round(logo.r.left)}～${Math.round(logo.r.right)}／${logo.vw}）`);
    assert(logo.r.bottom <= logo.hr.bottom + 1, '手機 logo 超出標題列下緣');
    assert.equal(logo.fit, 'contain', `手機 logo 應完整顯示（object-fit ${logo.fit}）`);
    console.log(`OK 手機 logo 完整（top ${Math.round(logo.r.top)}px、left ${Math.round(logo.r.left)}px、${logo.fit}）`);
    await m.page.screenshot({ path: path.join(SHOT_DIR, 'mobile-top-390x844.png') });
    await m.ctx.close();
    console.log('VERIFIED test-content-r34-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : `（http://127.0.0.1:${PORT}）`));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
