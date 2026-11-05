'use strict';
/* R38 B 線（第 6～10 項）：矮螢幕對話不擋 HUD、陽光格看得懂、訂單主次、
   河畔復興卡片、手機文字與目標方向。用 playwright 實量。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5210;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r38-layout');
fs.mkdirSync(TMP, { recursive: true });
process.env.TEMP = TMP; process.env.TMP = TMP; process.env.TMPDIR = TMP;

// ---------- Node：引用、卡片與箭頭字串 ----------
{
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r38b.css'), 'utf8');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const wui = fs.readFileSync(path.join(ROOT, 'src/world-ui.js'), 'utf8');
  assert(idx.includes('src/content-r38b.css'), 'index.html 應引用 content-r38b.css');
  assert(sw.includes('./src/content-r38b.css'), 'sw.js 快取清單應含 content-r38b.css');
  assert(css.includes('.sun-beam .sun-mote'), '應處理陽光實心圓來源 .sun-mote');
  assert(/\.sun-beam \.sun-mote\s*\{\s*display:\s*none/.test(css), '純白實心圓應移除');
  assert(css.includes('.riverside-card'), '河畔復興應有卡片樣式');
  assert(css.includes('.objective-arrow'), '手機應有目標方向箭頭樣式');
  assert(wui.includes('worldProjectsCard') && wui.includes('用材料修好釣台、花圃與野餐桌'), '河畔卡片應有標題與一句說明（world-ui.js）');
  assert(wui.includes('objectiveArrow') && wui.includes('updateObjectiveArrow'), 'world-ui.js 應建立並更新目標方向箭頭');
  assert(wui.includes('worldProjectsButton'), '河畔卡片內仍應保留原按鈕 id');
  console.log('OK Node：content-r38b.css／index／sw 引用與河畔卡片、方向箭頭字串齊全');
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
`;

(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    // ---------- 第 6 項：1366×600 對話不擋資源列、按鈕間距 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 600);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; window.FarmWorld.speak('鎮長葛瑞', '先去看看田邊的狀況，收成好了再回來找我。'); });
      await page.waitForTimeout(500);
      const m = await page.evaluate((src) => {
        eval(src);
        const box = document.querySelector('#worldDialogue');
        if (!box || !vis(box)) return null;
        const res = [...document.querySelectorAll('header .res-bar .res, #resBar .res')].filter(vis).map((e) => ({ t: (e.textContent || '').trim().slice(0, 8), r: ro(e) }));
        const close = box.querySelector('.dialogue-close'), cont = box.querySelector('.dialogue-continue');
        return { box: ro(box), res, hits: res.map((x) => ({ t: x.t, v: inter(ro(box), x.r) })).filter((x) => x.v > 0),
          close: close ? ro(close) : null, cont: cont ? ro(cont) : null };
      }, HELP);
      assert(m, '1366x600 對話框應顯示');
      assert(m.box.top <= 24, `對話框 top ${m.box.top} 應 ≤ 24`);
      assert(m.box.height <= 600 * 0.20 + 1, `對話框高 ${Math.round(m.box.height)} 應 ≤ 螢幕 20%（120）`);
      assert.deepEqual(m.hits, [], `對話框蓋住資源列：${JSON.stringify(m.hits)}`);
      assert(m.close && m.cont, '對話框應有「略過」與「繼續」');
      const gap = m.cont.left - m.close.right;
      assert(gap >= 48, `「略過」與「繼續」間距 ${Math.round(gap)}px 應 ≥ 48px`);
      console.log(`OK 第 6 項 1366x600：對話框 top=${Math.round(m.box.top)}、高=${Math.round(m.box.height)}，與 ${m.res.length} 格資源列交集 0，按鈕間距 ${Math.round(gap)}px ≥ 48`);
      await ctx.close();
    }

    // ---------- 第 7 項：陽光田格近白像素 < 3% ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
      const tileId = await page.evaluate(() => {
        const s = window.__farm.state();
        s.plots[0].cropId = 'wheat'; s.plots[0].plantedAt = Date.now() - 60 * 1000; delete s.plots[0].wateredAt;
        s.sun = { plots: [0], startsAt: Date.now() - 1000, endsAt: Date.now() + 120000, used: [], introduced: true, nextAt: Date.now() + 120000 };
        window.__farm.refresh();
        const tile = s.map.tiles.find((t) => t.plotIndex === 0);
        window.__farm.focusTile(tile.id);
        return tile.id;
      });
      await page.waitForSelector('.sun-beam[data-plot-index="0"]', { timeout: 15000 });
      await page.waitForTimeout(900);
      const info = await page.evaluate((src) => {
        eval(src);
        const beam = document.querySelector('.sun-beam[data-plot-index="0"]');
        const mote = beam.querySelector('.sun-mote');
        const poolCs = getComputedStyle(beam.querySelector('.sun-pool'));
        const before = getComputedStyle(beam, '::before');
        const tileEl = document.querySelector('.gtile[data-tile-id="' + beam.dataset.tileId + '"]');
        return { moteDisplay: mote ? getComputedStyle(mote).display : 'missing', blend: poolCs.mixBlendMode,
          iconShadow: before.boxShadow, iconBg: before.backgroundColor, tile: tileEl ? ro(tileEl) : null,
          cropVisible: !!document.querySelector('[data-kind="crop"][data-tile-id="' + beam.dataset.tileId + '"], .ob.crop[data-tile-id="' + beam.dataset.tileId + '"]') };
      }, HELP);
      assert.equal(info.moteDisplay, 'none', '純白實心圓（.sun-mote）應隱藏');
      assert.equal(info.blend, 'normal', `光池混色應為 normal（不衝白），實際 ${info.blend}`);
      assert(info.iconShadow && info.iconShadow !== 'none', '陽光像素圖示（::before 像素點陣）應存在');
      assert(info.tile && info.tile.width > 10, '陽光田格應在畫面內');
      const clip = { x: Math.max(0, info.tile.left), y: Math.max(0, info.tile.top), width: Math.min(info.tile.width, 1366 - info.tile.left), height: Math.min(info.tile.height, 768 - info.tile.top) };
      const shot = await page.screenshot({ clip });
      const ratio = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let white = 0, total = 0;
        for (let i = 0; i < d.length; i += 4) { total++; if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) white++; }
        return total ? white / total : 1;
      }, shot.toString('base64'));
      assert(ratio < 0.03, `陽光田格近白像素比例 ${(ratio * 100).toFixed(2)}% 應 < 3%`);
      console.log(`OK 第 7 項：實心圓已移除、光池 mix-blend=${info.blend}、像素圖示存在、作物可見=${info.cropVisible}，田格近白像素 ${(ratio * 100).toFixed(2)}% < 3%（格 ${tileId}）`);
      await ctx.close();
    }

    // ---------- 第 8 項：訂單主次與手機面板底部 ----------
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      const tag = `${w}x${h}`;
      const { ctx, page } = await newPage(browser, intercepted, w, h);
      await page.evaluate(() => {
        const s = window.__farm.state();
        s.adventure.claimed = Object.assign({}, s.adventure.claimed, { c1_first_harvest: true });
        s.storage = s.storage || {}; s.storage.items = s.storage.items || {}; s.storage.items.wheat = 50;
        window.__farm.refresh();
        window.FarmWorld.openPanel('orders');
      });
      await page.waitForTimeout(1500);
      const m = await page.evaluate((src) => {
        eval(src);
        const order = [...document.querySelectorAll('.side-pane[data-pane="orders"] .order')].find(vis);
        if (!order) return null;
        const ful = order.querySelector('.ful'), trash = order.querySelector('.trash');
        const pane = document.querySelector('.side-pane[data-pane="orders"]');
        const body = document.querySelector('.side-panel.world-panel-open .side-body');
        const orders = [...pane.querySelectorAll('.order')].filter(vis);
        const last = orders[orders.length - 1];
        return { ful: ful ? { r: ro(ful), size: parseFloat(getComputedStyle(ful).fontSize) } : null,
          trash: trash ? { r: ro(trash), size: parseFloat(getComputedStyle(trash).fontSize), bg: getComputedStyle(trash).backgroundColor, deco: getComputedStyle(trash).textDecorationLine } : null,
          flavorSize: (() => { const f = order.querySelector('.o-flavor'); return f ? parseFloat(getComputedStyle(f).fontSize) : null; })(),
          paneBg: getComputedStyle(pane).backgroundImage, bodyBottom: body ? ro(body).bottom : null,
          paneBottom: pane ? ro(pane).bottom : null, hasOrder: true };
      }, HELP);
      assert(m && m.hasOrder, `${tag} 訂單面板應有訂單卡`);
      assert(m.ful && m.trash, `${tag} 開放後訂單應有「交付」與「丟棄」（ful=${!!m.ful} trash=${!!m.trash}）`);
      const gap = Math.max(m.trash.r.top - m.ful.r.bottom, m.trash.r.left - m.ful.r.right);
      assert(gap >= 12, `${tag} 「丟棄」與「交付」間距 ${Math.round(gap)}px 應 ≥ 12px`);
      assert(m.trash.size < m.ful.size || m.trash.r.height < m.ful.r.height, `${tag} 「丟棄」應為次要小字（${m.trash.size}px／${Math.round(m.trash.r.height)}px 對 ${m.ful.size}px／${Math.round(m.ful.r.height)}px）`);
      console.log(`OK 第 8 項 ${tag}：丟棄為次要小字 ${m.trash.size}px，與交付間距 ${Math.round(gap)}px ≥ 12`);
      // 丟棄確認流程保留
      const confirm = await page.evaluate(() => {
        const t = document.querySelector('.side-pane[data-pane="orders"] .order .trash');
        if (!t) return 'no-trash';
        t.click();
        return 'clicked';
      });
      if (confirm === 'clicked') {
        await page.waitForTimeout(500);
        const hasConfirm = await page.evaluate(() => !!document.querySelector('.side-pane[data-pane="orders"] .trash-confirm') && !!document.querySelector('.side-pane[data-pane="orders"] .trash-cancel'));
        assert(hasConfirm, `${tag} 點「丟棄」後應出現保留／確認丟棄`);
        console.log(`OK 第 8 項 ${tag}：丟棄確認（保留／確認丟棄）仍在`);
      }
      if (w === 390) {
        assert(!/gradient/.test(m.paneBg), `390x844 訂單面板底不應有漸層，實際 ${m.paneBg}`);
        const blank = m.bodyBottom - m.paneBottom;
        assert(blank <= 48, `390x844 訂單面板底部空白 ${Math.round(blank)}px 應 ≤ 48px`);
        if (m.flavorSize !== null) assert(m.flavorSize >= 12, `390x844 訂單說明字級 ${m.flavorSize}px 應 ≥ 12px`);
        console.log(`OK 第 8／10 項 390x844：訂單面板無漸層、底部空白 ${Math.round(blank)}px、訂單說明 ${m.flavorSize}px`);
      }
      await ctx.close();
    }

    // ---------- 第 9 項：河畔復興卡片四尺寸完整可見 ----------
    for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
      const tag = `${w}x${h}`;
      const { ctx, page } = await newPage(browser, intercepted, w, h);
      await page.evaluate(() => window.FarmWorld.openPanel('upgrades'));
      await page.waitForSelector('#worldProjectsCard', { timeout: 10000, state: 'attached' });
      await page.evaluate(() => {
        const card = document.querySelector('#worldProjectsCard');
        const showMore = document.querySelector('.side-pane[data-pane="upgrades"] .r32-show-more');
        if (showMore && getComputedStyle(card).display === 'none') showMore.click();
      });
      await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('#worldProjectsCard').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(600);
      const m = await page.evaluate((src) => {
        eval(src);
        const card = document.querySelector('#worldProjectsCard');
        const body = document.querySelector('.side-panel.world-panel-open .side-body');
        if (!card || !vis(card)) return null;
        return { r: ro(card), body: body ? ro(body) : null, text: card.textContent.replace(/\s+/g, ' ').trim(),
          btnIn: !!card.querySelector('#worldProjectsButton') };
      }, HELP);
      assert(m, `${tag} 河畔復興卡片應存在且可見`);
      assert(m.text.includes('河畔復興計畫') && m.text.includes('釣台'), `${tag} 卡片應有標題與說明，實際「${m.text.slice(0, 60)}」`);
      assert(m.btnIn, `${tag} 卡片內應有按鈕`);
      assert(m.r.top >= -1 && m.r.left >= -1 && m.r.bottom <= h + 1 && m.r.right <= w + 1, `${tag} 卡片捲動後應完整在視口內：${JSON.stringify(m.r)} 對 ${w}x${h}`);
      if (m.body) assert(m.r.top >= m.body.top - 1 && m.r.bottom <= m.body.bottom + 1, `${tag} 卡片應完整在面板內（不被切掉）：卡 ${Math.round(m.r.top)}-${Math.round(m.r.bottom)}／面板 ${Math.round(m.body.top)}-${Math.round(m.body.bottom)}`);
      console.log(`OK 第 9 項 ${tag}：河畔卡片完整可見「${m.text.slice(0, 34)}…」`);
      await ctx.close();
    }

    // ---------- 第 10 項：手機字級與目標方向箭頭 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 390, 844);
      const fonts = await page.evaluate(() => {
        const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
        const out = [];
        for (const sel of ['.tool-bar .tool', '.side-tabs .side-tab']) for (const e of document.querySelectorAll(sel)) if (vis(e) && e.textContent.trim()) out.push({ sel, size: parseFloat(getComputedStyle(e).fontSize), text: e.textContent.trim().slice(0, 8) });
        return out;
      });
      const low = fonts.filter((f) => f.size < 12);
      assert(fonts.length >= 3, `390x844 工具列可量按鈕太少（${fonts.length}）`);
      assert.deepEqual(low, [], `390x844 工具列文字小於 12px：${JSON.stringify(low)}`);
      console.log(`OK 第 10 項 390x844：工具列 ${fonts.length} 顆文字最小 ${Math.min(...fonts.map((f) => f.size))}px ≥ 12px`);
      // 把鏡頭移到離目標最遠的角落，箭頭應在邊緣出現
      await page.evaluate(() => {
        const s = window.__farm.state();
        const dock = document.querySelector('#questDock');
        const tid = dock && dock.dataset.targetId;
        const tt = tid ? s.map.tiles.find((t) => t.id === tid) : null;
        const corners = [s.map.tiles[0], s.map.tiles[s.map.tiles.length - 1], s.map.tiles.find((t) => t.x === 0 && t.y === s.map.height - 1), s.map.tiles.find((t) => t.x === s.map.width - 1 && t.y === 0)].filter(Boolean);
        const far = tt ? corners.sort((a, b) => (Math.abs(b.x - tt.x) + Math.abs(b.y - tt.y)) - (Math.abs(a.x - tt.x) + Math.abs(a.y - tt.y)))[0] : corners[0];
        if (far) window.__farm.focusTile(far.id);
      });
      await page.waitForTimeout(2200);
      const arrow = await page.evaluate((src) => {
        eval(src);
        const a = document.querySelector('#objectiveArrow');
        if (!a || !vis(a)) return null;
        return { r: ro(a), text: a.textContent.trim(), target: a.dataset.targetId || '' };
      }, HELP);
      assert(arrow, '390x844 目標在畫面外時應顯示方向箭頭');
      assert(arrow.r.left >= -1 && arrow.r.top >= -1 && arrow.r.right <= 391 && arrow.r.bottom <= 845, `方向箭頭應在畫面邊緣內：${JSON.stringify(arrow.r)}`);
      console.log(`OK 第 10 項 390x844：目標方向箭頭存在（目標 ${arrow.target}，位置 ${Math.round(arrow.r.left)},${Math.round(arrow.r.top)}）`);
      await ctx.close();
    }
    console.log('VERIFIED test-content-r38-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : `（http://127.0.0.1:${PORT}）`));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
