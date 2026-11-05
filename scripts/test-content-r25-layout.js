'use strict';
/* R25 B線版面量測：開場下方空白、對話不遮底部工具列、手機 HUD 單行、
   任務 NPC 名牌、田格五種狀態。用 playwright 開本機伺服器實際量測，結束關閉伺服器。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5131;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

// Playwright 需要可寫的暫存目錄；受限環境下改用專案內暫存，結束時清掉。
const TMP = path.join(ROOT, '.tmp-r25-layout');
fs.mkdirSync(TMP, { recursive: true });
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
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
    return { server, intercepted: false };
  } catch (e) {
    // 沙盒禁止 bind 時，改用 playwright route 攔截提供同一批專案檔案，量測口徑不變。
    return { server: null, intercepted: true };
  }
}

async function launchBrowser() {
  const opts = { headless: true, args: ['--no-sandbox'] };
  try { return await chromium.launch(opts); } catch (e) { /* 改用系統瀏覽器 */ }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) { try { return await chromium.launch({ ...opts, executablePath: p }); } catch (e) { /* 下一個 */ } }
  }
  throw new Error('找不到可用的瀏覽器（playwright chromium 與系統 Chrome／Edge 皆不可用）');
}

async function newPage(browser, intercepted, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
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
  return { ctx, page };
}

async function closeOpening(page) {
  await page.locator('#worldBegin').click();
  await page.waitForTimeout(500);
}

async function measureDialogue(page) {
  await page.evaluate(() => window.FarmWorld.speak('葛瑞', '收成先留一籃，別全拿去賣。門邊總有人，還沒吃飯。'));
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const d = document.querySelector('#worldDialogue');
    const dock = document.querySelector('#farmDock');
    const dr = d.getBoundingClientRect(), kr = dock.getBoundingClientRect(), cs = getComputedStyle(dock);
    const overlap = !(dr.bottom <= kr.top || kr.bottom <= dr.top || dr.right <= kr.left || kr.right <= dr.left);
    return {
      hidden: d.hidden, height: dr.height, heightPct: dr.height / innerHeight * 100,
      dockVisible: cs.display !== 'none' && cs.visibility !== 'hidden' && kr.width > 0 && kr.height > 0,
      overlap,
    };
  });
}

(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    // 6：1366×768 開場卡片下方空白 ≤ 20% 畫面高，且插圖完整顯示（contain）
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
      const m = await page.evaluate(() => {
        const card = document.querySelector('#worldModal .modal-card');
        const img = document.querySelector('.sun-welcome-scene');
        const r = card.getBoundingClientRect();
        return { belowPct: (innerHeight - r.bottom) / innerHeight * 100, fit: getComputedStyle(img).objectFit };
      });
      assert(m.belowPct <= 20, `1366×768 開場卡片下方空白 ${m.belowPct.toFixed(1)}% 超過 20%`);
      assert.equal(m.fit, 'contain', '開場插圖應完整顯示（object-fit: contain），不得裁成色塊');
      console.log(`OK 開場 1366×768 下方空白 ${m.belowPct.toFixed(1)}%、插圖 ${m.fit}`);
      await ctx.close();
    }

    // 7+8+9：對話不遮工具列、手機 HUD 單行、任務 NPC 名牌
    for (const [w, h] of [[390, 844], [844, 390], [1366, 600]]) {
      const { ctx, page } = await newPage(browser, intercepted, w, h);
      await closeOpening(page);
      if (w === 390) {
        const hud = await page.evaluate(() => {
          const s = __farm.state(); s.materials.wood = 3; s.materials.stone = 2; __farm.refreshResources();
          const res = document.querySelector('#resBar');
          const tops = [...new Set([...res.children].map((c) => Math.round(c.getBoundingClientRect().top)))];
          return { tops, matChips: document.querySelectorAll('#resBar .res.mat').length, level: (document.querySelector('#resBar .res.level') || {}).textContent || '' };
        });
        assert.equal(hud.tops.length, 1, `390×844 資源列應只有一行，實際 ${hud.tops.length} 行`);
        assert.equal(hud.matChips, 1, '390×844 多種建材應收合成一格');
        assert(/Lv\s*\d+/.test(hud.level), '等級應顯示數字（Lv N）');
        console.log('OK 手機 HUD 390×844 資源列單行、建材一格、等級有數字');
      }
      const plate = await page.evaluate(() => {
        const s = __farm.state(); const mayor = s.map.tiles.find((t) => t.npc === 'mayor');
        __farm.focusTile(mayor.id);
        return mayor.id;
      });
      await page.waitForTimeout(600);
      const plateM = await page.evaluate(() => {
        const el = document.querySelector('[data-audit="quest-npc-nameplate"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.width > 0 };
      });
      assert(plateM, `${w}×${h} 任務目標 NPC 名牌不存在`);
      assert(plateM.text.includes('葛瑞'), `${w}×${h} 名牌應顯示葛瑞，實際「${plateM.text}」`);
      assert(plateM.inView, `${w}×${h} 任務目標 NPC 名牌不在畫面內`);
      const dlg = await measureDialogue(page);
      assert(!dlg.hidden, `${w}×${h} 對話框未顯示`);
      assert(dlg.dockVisible, `${w}×${h} 對話出現時底部工具列不可見`);
      assert(!dlg.overlap, `${w}×${h} 對話框遮住底部工具列`);
      if (w === 844) assert(dlg.heightPct <= 30, `844×390 對話框高度 ${dlg.heightPct.toFixed(1)}% 超過 30%`);
      console.log(`OK 對話 ${w}×${h} 工具列可見、對話高 ${dlg.heightPct.toFixed(1)}%、名牌「${plateM.text}」在畫面內`);
      await ctx.close();
    }

    // 10：田格五種狀態的繪製參數各不相同
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
      await closeOpening(page);
      const ids = await page.evaluate(() => {
        const s = __farm.state(); const now = Date.now();
        const grow = (window.CROPS.wheat && window.CROPS.wheat.growMs) || 60000;
        const set = (i, cropId, planted, watered) => { const pl = s.plots[i]; pl.cropId = cropId; pl.plantedAt = planted || 0; if (watered) pl.wateredAt = watered; else delete pl.wateredAt; };
        set(0, null, 0, false); set(1, 'wheat', now, false); set(2, 'wheat', now, now);
        set(3, 'wheat', now - Math.floor(grow * 0.5), false); set(4, 'wheat', now - grow * 3, false);
        __farm.refresh();
        return s.map.tiles.filter((t) => t.plotIndex != null && t.plotIndex < 5).map((t) => t.id);
      });
      await page.waitForTimeout(700);
      const rows = await page.evaluate((tileIds) => tileIds.map((id) => {
        const e = document.querySelector(`.gtile[data-tile-id="${id}"]`);
        const cs = getComputedStyle(e);
        const crop = document.querySelector(`.ob[data-kind="crop"][data-tile-id="${id}"]`);
        return { state: e.dataset.plotState, sig: [e.dataset.plotState, cs.backgroundImage, cs.boxShadow, cs.filter, crop ? (crop.dataset.frame || crop.textContent) : ''].join('|') };
      }), ids);
      const states = rows.map((r) => r.state);
      assert.deepEqual([...states].sort(), ['empty', 'growing', 'ready', 'seeded', 'watered'], `田格五狀態標記不齊：${states.join(',')}`);
      assert.equal(new Set(rows.map((r) => r.sig)).size, 5, `田格五種狀態繪製參數應各不相同：${JSON.stringify(rows)}`);
      console.log('OK 田格五種狀態（空地／已播種／已澆水／成長中／可收成）繪製參數各不相同');
      await ctx.close();
    }
    console.log('VERIFIED test-content-r25-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : '（http://127.0.0.1:' + PORT + '）'));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
