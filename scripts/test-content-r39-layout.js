'use strict';
/* R39 B 線（第 6～10 項）：矮螢幕對話與標籤不裁切、面板最後一項不被切、
   手機橫式減量、像素化控制元件、手機訂單底部抽屜。用 playwright 實量。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5211;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r39-layout');
fs.mkdirSync(TMP, { recursive: true });
process.env.TEMP = TMP; process.env.TMP = TMP; process.env.TMPDIR = TMP;

// ---------- Node：引用、像素規則與標籤翻面字串 ----------
{
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r39b.css'), 'utf8');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  assert(idx.includes('src/content-r39b.css'), 'index.html 應引用 content-r39b.css');
  assert(sw.includes('./src/content-r39b.css'), 'sw.js 快取清單應含 content-r39b.css');
  assert(!/url\(|\.png|\.webp|\.jpg/.test(css), 'content-r39b.css 不得新增圖檔，像素風格須以 CSS 實作');
  assert(/\.dialogue-portrait[\s\S]*?width:\s*40px/.test(css), '矮螢幕對話頭像應縮成 40px');
  assert(css.includes('.tile-state-label-below'), '作物標籤翻面應有 CSS 規則');
  assert(ui.includes('labelBelow') && ui.includes('tile-state-label-below'), 'ui.js 應依標籤本身位置翻面（不移動鏡頭）');
  assert(/\.side-pane:has\(\.r32-show-more\) \.riverside-card/.test(css), '有「再顯示 N 項」時河畔卡應收起');
  assert(css.includes('.setting-toggle[data-enabled="true"]::after') && css.includes('.setting-toggle[data-enabled="false"]::after'), '開關兩態都應有狀態字規則');
  assert(css.includes('::-webkit-slider-thumb') && css.includes('::-moz-range-thumb'), '滑桿拉把應有像素樣式');
  assert(css.includes('.side-tabs .side-tab.sel'), '頁籤選取態應有像素邊框規則');
  assert(css.includes('.world-close') && css.includes('.world-modal-close') && css.includes('.settings-close'), '面板關閉鈕應有像素邊框規則');
  assert(/max-height:\s*62dvh/.test(css), '手機訂單抽屜最高應為畫面 62%');
  assert(/\.order \.o-actions \.trash[\s\S]*?min-height:\s*44px/.test(css), '「丟棄」觸控區應至少 44px');
  assert(ui.includes('minVisible'), 'fitPanelFirstScreen 應允許首屏收合到零張（訂單保留第一張）');
  console.log('OK Node：content-r39b.css／index／sw 引用與像素規則、標籤翻面、抽屜字串齊全');
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
async function openPane(page, pane) {
  await page.evaluate((p) => {
    const s = window.__farm.state();
    s.adventure.claimed = Object.assign({}, s.adventure.claimed, { c1_first_harvest: true });
    s.storage = s.storage || {}; s.storage.items = s.storage.items || {}; s.storage.items.wheat = 50;
    window.__farm.refresh();
    window.FarmWorld.openPanel(p);
  }, pane);
  await page.waitForTimeout(1300);
}

(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    // ---------- 第 6 項：1366×600 對話頭像 40px 完整在框內 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 600);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; window.FarmWorld.speak('鎮長葛瑞', '好。'); });
      await page.waitForTimeout(600);
      const m = await page.evaluate((src) => {
        eval(src);
        const box = document.querySelector('#worldDialogue');
        const img = box ? box.querySelector('.dialogue-portrait') : null;
        return { box: box && vis(box) ? ro(box) : null, img: img ? ro(img) : null,
          natural: img ? img.naturalWidth : 0 };
      }, HELP);
      assert(m.box, '1366x600 對話框應顯示');
      assert(m.box.top >= 600 * 0.55 && m.box.bottom <= 600 - 60, `對話框應在下方安全區（top ${Math.round(m.box.top)}、bottom ${Math.round(m.box.bottom)}／600，R40 規則）`);
      assert(m.box.height <= 600 * 0.30 + 1, `對話框高 ${Math.round(m.box.height)} 應 ≤ 螢幕 30%（180）`);
      assert(m.img, '鎮長對話應有頭像');
      assert(Math.abs(m.img.width - 40) <= 1 && Math.abs(m.img.height - 40) <= 1, `頭像應縮成 40px，實際 ${Math.round(m.img.width)}×${Math.round(m.img.height)}`);
      assert(m.img.top >= m.box.top - 1 && m.img.bottom <= m.box.bottom + 1 && m.img.left >= m.box.left - 1 && m.img.right <= m.box.right + 1,
        `頭像應完整在對話框內：頭像 ${JSON.stringify(m.img)}／框 ${JSON.stringify(m.box)}`);
      console.log(`OK 第 6 項 1366x600：對話框在下方安全區 top=${Math.round(m.box.top)}、高=${Math.round(m.box.height)}，頭像 40×40 完整在框內（natural ${m.natural}）`);
      await ctx.close();
    }

    // ---------- 第 6 項：作物浮動標籤距畫面上緣至少 4px ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 600);
      const placed = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const s = window.__farm.state();
        const tile = s.map.tiles.find((t) => t.plotIndex === 0);
        s.plots[0].cropId = 'wheat'; s.plots[0].plantedAt = Date.now(); delete s.plots[0].wateredAt;
        const adj = s.map.tiles.find((t) => t.x === tile.x && t.y === tile.y + 1) || s.map.tiles.find((t) => t.x === tile.x + 1 && t.y === tile.y);
        if (adj) { s.player.tileId = adj.id; s.player.x = adj.x; s.player.y = adj.y; }
        window.__farm.refresh();
        window.__farm.setTool('water');
        window.__farm.focusTile(tile.id);
        window.__farm.clickTile(tile.id);
        await sleep(700);
        let chosen = null;
        for (let d = 3; d <= 9 && !chosen; d++) {
          const f = s.map.tiles.find((t) => t.x === tile.x && t.y === tile.y + d);
          if (!f) continue;
          window.__farm.focusTile(f.id);
          await sleep(260);
          const te = document.querySelector('.gtile[data-tile-id="' + tile.id + '"]');
          if (!te) continue;
          const r = te.getBoundingClientRect();
          if (r.top < 0 && r.bottom > 10) chosen = { d, tileTop: r.top, tileBottom: r.bottom };
        }
        await sleep(600);
        const label = document.querySelector('[data-audit="tile-state-label"]');
        const te = document.querySelector('.gtile[data-tile-id="' + tile.id + '"]');
        const lr = label && !label.hidden ? label.getBoundingClientRect() : null;
        return { chosen, tileId: tile.id,
          label: lr ? { top: lr.top, bottom: lr.bottom, left: lr.left, right: lr.right, text: label.textContent.trim(), below: label.classList.contains('tile-state-label-below'), visibility: getComputedStyle(label).visibility } : null,
          tile: te ? te.getBoundingClientRect() : null };
      });
      assert(placed.chosen, `應能把田格移到畫面上緣附近（${JSON.stringify(placed.chosen)}）`);
      assert(placed.label, '選取的田格應有作物浮動標籤');
      assert.equal(placed.label.visibility, 'visible', '作物標籤不應被藏起來');
      assert(placed.label.top >= 4, `作物標籤 top ${Math.round(placed.label.top)} 應 ≥ 4，不被畫面上緣切半（田格 top ${Math.round(placed.tile.top)}）`);
      assert(placed.label.bottom <= 600, `作物標籤應在畫面內（bottom ${Math.round(placed.label.bottom)}）`);
      console.log(`OK 第 6 項：田格移到上緣（top=${Math.round(placed.tile.top)}）時標籤「${placed.label.text}」top=${Math.round(placed.label.top)} ≥ 4、完整可見（翻面=${placed.label.below}）`);
      await ctx.close();
    }

    // ---------- 第 7 項：面板最後一項不被切、四尺寸 ----------
    for (const pane of ['upgrades', 'story', 'orders']) {
      for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
        const tag = `${pane}-${w}x${h}`;
        const { ctx, page } = await newPage(browser, intercepted, w, h);
        await openPane(page, pane);
        const first = await page.evaluate((src) => {
          eval(src);
          const body = document.querySelector('.side-panel.world-panel-open .side-body');
          const paneEl = body ? body.querySelector('.side-pane.sel') : document.querySelector('.side-pane.sel');
          if (!body || !paneEl) return null;
          const br = ro(body);
          const cards = [...paneEl.querySelectorAll('.order,.up,.building-upgrade-card,.adventure-quest,.riverside-card')].filter(vis);
          const partial = cards.filter((c) => { const r = ro(c); return r.top < br.bottom - 2 && r.bottom > br.bottom + 2; }).map((c) => String(c.className).slice(0, 40));
          const btn = paneEl.querySelector('.r32-show-more');
          return { br, partial, btn: btn && vis(btn) ? { r: ro(btn), text: btn.textContent.trim() } : null, count: cards.length };
        }, HELP);
        assert(first, `${tag} 面板應開啟`);
        if (first.btn) {
          assert.deepEqual(first.partial, [], `${tag} 首屏已有「${first.btn.text}」卻露出半張卡：${JSON.stringify(first.partial)}`);
          assert(first.btn.r.top >= first.br.top - 1 && first.btn.r.bottom <= first.br.bottom + 1, `${tag} 「再顯示 N 項」應完整在首屏內：${JSON.stringify(first.btn.r)}／面板 ${JSON.stringify(first.br)}`);
        }
        // 展開後捲到底，最後一張卡完整可見
        await page.evaluate(() => {
          const b = document.querySelector('.side-pane.sel .r32-show-more');
          if (b) b.click();
        });
        await page.waitForTimeout(500);
        const last = await page.evaluate((src) => {
          eval(src);
          const body = document.querySelector('.side-panel.world-panel-open .side-body');
          const paneEl = body.querySelector('.side-pane.sel');
          body.scrollTop = body.scrollHeight; if (paneEl) paneEl.scrollTop = paneEl.scrollHeight;
          return new Promise((res) => setTimeout(() => {
            const br = ro(body);
            const cards = [...paneEl.querySelectorAll('.order,.up,.building-upgrade-card,.adventure-quest,.riverside-card')].filter(vis);
            const lastC = cards[cards.length - 1];
            res({ br, last: lastC ? { cls: String(lastC.className).slice(0, 40), r: ro(lastC) } : null, count: cards.length });
          }, 350));
        }, HELP);
        assert(last.last, `${tag} 面板應有卡片`);
        assert(last.last.r.bottom <= last.br.bottom + 2 && last.last.r.top >= last.br.top - 2,
          `${tag} 捲到底最後一張卡應完整在面板內：卡 ${JSON.stringify(last.last.r)}／面板 ${JSON.stringify(last.br)}（${last.last.cls}）`);
        if (pane === 'upgrades') {
          const river = await page.evaluate((src) => {
            eval(src);
            const body = document.querySelector('.side-panel.world-panel-open .side-body');
            const card = document.querySelector('#worldProjectsCard');
            if (!card || !vis(card)) return null;
            card.scrollIntoView({ block: 'center' });
            return new Promise((res) => setTimeout(() => res({ r: ro(card), br: ro(body) }), 400));
          }, HELP);
          assert(river, `${tag} 河畔復興計畫卡展開後應可見`);
          assert(river.r.top >= river.br.top - 1 && river.r.bottom <= river.br.bottom + 1 && river.r.top >= -1 && river.r.bottom <= h + 1,
            `${tag} 河畔卡應完整在面板與視口內：${JSON.stringify(river.r)}`);
        }
        console.log(`OK 第 7 項 ${tag}：首屏半張卡 ${first.btn ? first.partial.length : '（無收合提示，不計）'}、捲到底最後一卡完整（共 ${last.count} 張）`);
        await ctx.close();
      }
    }

    // ---------- 第 8 項：手機橫式 844×390 減量 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 844, 390);
      await page.waitForTimeout(500);
      const m = await page.evaluate((src) => {
        eval(src);
        const pick = (sel) => [...document.querySelectorAll(sel)].filter(vis).map(ro)[0] || null;
        const header = pick('header'), quest = pick('#questDock'), seed = pick('#seedHud'), dock = pick('#farmDock');
        const actionA = pick('#actionA'), player = pick('#player');
        const npcs = [...document.querySelectorAll('.ob[data-kind="npc"]')].filter(vis).map(ro);
        const dpad = [...document.querySelectorAll('.dpad-btn')].filter(vis).map(ro);
        const tools = [...document.querySelectorAll('#farmDock .tool, #farmDock #dailyOpen, #farmMore')].filter(vis).map(ro);
        const topCluster = [header, quest, seed].filter(Boolean);
        const bottomCluster = [dock, actionA, ...dpad].filter(Boolean);
        const topBottom = Math.max(...topCluster.map((r) => r.bottom));
        const bottomTop = Math.min(...bottomCluster.map((r) => r.top));
        return { header, quest, seed, dock, actionA, player,
          vsPlayer: actionA && player ? inter(actionA, player) : null,
          vsNpcs: actionA ? Math.max(0, ...npcs.map((r) => inter(actionA, r))) : null,
          toolTops: tools.map((r) => Math.round(r.top)), central: (bottomTop - topBottom) / innerHeight,
          step: document.body.dataset.questStep || '' };
      }, HELP);
      assert(m.header && m.quest && m.dock, '844x390 資源列、任務列與工具列都應在');
      assert(m.header.height <= 52, `資源列應只有一列（高 ${Math.round(m.header.height)}）`);
      assert(m.quest.height <= 64, `任務列應只有一列（高 ${Math.round(m.quest.height)}）`);
      if (m.seed) assert(Math.abs(m.seed.top - m.quest.top) <= 8, `種子欄應收進任務列同一列（種子 top ${Math.round(m.seed.top)}／任務 top ${Math.round(m.quest.top)}，步驟 ${m.step}）`);
      assert(new Set(m.toolTops).size <= 1, `工具列應只有一列（tops ${JSON.stringify(m.toolTops)}）`);
      assert(m.central >= 0.5, `中央可操作區 ${(m.central * 100).toFixed(1)}% 應 ≥ 50%`);
      assert(m.actionA, '844x390 互動鈕應可見');
      assert.equal(m.vsPlayer, 0, '互動鈕不應蓋住角色');
      assert.equal(m.vsNpcs, 0, '互動鈕不應蓋住 NPC');
      console.log(`OK 第 8 項 844x390：資源／任務／工具各一列、種子欄同列（步驟 ${m.step}）、中央可操作區 ${(m.central * 100).toFixed(1)}% ≥ 50%、互動鈕不蓋角色`);
      await ctx.close();
    }

    // ---------- 第 9 項：像素化控制元件 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
      await page.evaluate(() => document.querySelector('#settingsBtn').click());
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const toggles = [...document.querySelectorAll('#settingsModal .setting-toggle[data-enabled]')].map((b) => {
          const cs = getComputedStyle(b), after = getComputedStyle(b, '::after'), before = getComputedStyle(b, '::before');
          return { en: b.dataset.enabled, bg: cs.backgroundColor, borderW: cs.borderTopWidth, borderColor: cs.borderTopColor,
            radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, afterContent: after.content, afterLeft: parseFloat(after.left), afterRight: parseFloat(after.right), knobLeft: parseFloat(before.left), knobRadius: before.borderTopLeftRadius, knobBorder: before.borderTopWidth };
        });
        const range = document.querySelector('#settingsModal .setting-slider input[type="range"]');
        const rcs = range ? getComputedStyle(range) : null;
        const thumb = range ? getComputedStyle(range, '::-webkit-slider-thumb') : null;
        const track = range ? getComputedStyle(range, '::-webkit-slider-runnable-track') : null;
        const close = document.querySelector('#settingsModal .settings-close');
        const ccs = close ? getComputedStyle(close) : null;
        return { toggles,
          range: range ? { appearance: rcs.webkitAppearance || rcs.appearance, thumbBg: thumb.backgroundColor, thumbBorder: thumb.borderTopWidth, thumbRadius: thumb.borderTopLeftRadius, trackBg: track.backgroundColor, trackBorder: track.borderTopWidth } : null,
          close: close ? { borderW: ccs.borderTopWidth, radius: ccs.borderTopLeftRadius, shadow: ccs.boxShadow, bg: ccs.backgroundColor, w: ccs.width, h: ccs.height } : null };
      });
      const onT = m.toggles.find((t) => t.en === 'true'), offT = m.toggles.find((t) => t.en === 'false');
      assert(onT && offT, '設定應同時有開與關兩態開關');
      assert(onT.bg !== offT.bg, '開關開／關狀態色應不同');
      assert(onT.knobLeft > offT.knobLeft + 10, `開關圓鈕應依狀態移動（開 ${onT.knobLeft}／關 ${offT.knobLeft}）`);
      assert(Math.abs(onT.afterLeft - offT.afterLeft) <= 1, `「開／關」字應固定同一側（開 left ${onT.afterLeft}／關 left ${offT.afterLeft}）`);
      assert(onT.afterContent.includes('開') && offT.afterContent.includes('關'), '開關狀態字應為開／關');
      for (const t of [onT, offT]) {
        assert.equal(t.borderW, '2px', `開關應為 2px 像素邊框（${t.borderW}）`);
        assert(t.shadow !== 'none', '開關應有硬陰影');
        assert(parseFloat(t.radius) <= 8, `開關圓角應為像素風小圓角（${t.radius}）`);
        assert(parseFloat(t.knobRadius) <= 6, `開關圓鈕應為像素方鈕（${t.knobRadius}）`);
      }
      assert(m.range, '設定應有音量滑桿');
      assert.equal(m.range.appearance, 'none', `滑桿應去掉一般網頁外觀（${m.range.appearance}）`);
      // 拉把偽元素的計算樣式在 Chromium 量不到，改截圖取樣實際像素（下方驗證）。
      assert(parseFloat(m.range.thumbRadius) <= 6, `滑桿拉把應為像素方塊（${m.range.thumbRadius}）`);
      // 軌道偽元素的計算樣式同樣量不到，改截圖取樣（下方與拉把一起驗證）。
      const modeSel = await page.evaluate(() => { const b = document.querySelector('#settingsModal .setting-mode.sel'); if (!b) return null; const cs = getComputedStyle(b); return { borderW: cs.borderTopWidth, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, bg: cs.backgroundColor, text: b.textContent.trim() }; });
      assert(modeSel, '設定應有選取中的模式頁籤');
      assert.equal(modeSel.borderW, '2px', `模式頁籤選取態應為 2px 像素邊框（${modeSel.borderW}）`);
      assert(modeSel.shadow !== 'none' && parseFloat(modeSel.radius) <= 8, '模式頁籤選取態應有硬陰影與小圓角');
      assert.equal(modeSel.bg, 'rgb(247, 212, 129)', `模式頁籤選取態應為狀態黃（${modeSel.bg}）`);
      assert(m.close, '設定面板應有關閉鈕');
      assert.equal(m.close.borderW, '2px', '設定關閉鈕應為 2px 像素邊框');
      assert(m.close.shadow !== 'none' && parseFloat(m.close.radius) <= 8, '設定關閉鈕應有硬陰影與小圓角');
      const rangeBox = await page.evaluate(() => { const r = document.querySelector('#settingsModal .setting-slider input[type="range"]'); const b = r.getBoundingClientRect(); return { x: Math.max(0, b.left), y: Math.max(0, b.top), width: b.width, height: b.height }; });
      const shot = await page.screenshot({ clip: rangeBox });
      const yellow = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0, cream = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i] > 240 && d[i + 1] > 175 && d[i + 1] < 235 && d[i + 2] < 150) n++; if (d[i] > 235 && d[i + 1] > 222 && d[i + 2] > 178 && d[i + 2] < 232) cream++; }
        return { n, cream };
      }, shot.toString('base64'));
      assert(yellow.n > 80, `滑桿拉把應為像素黃方塊（截圖黃像素 ${yellow.n}）`);
      assert(yellow.cream > 200, `滑桿軌道應為像素紙色（截圖紙色像素 ${yellow.cream}）`);
      console.log(`OK 第 9 項（設定）：開關像素邊框／狀態色、「開／關」同側（left ${onT.afterLeft}＝${offT.afterLeft}）、滑桿像素軌道與黃方塊拉把（截圖黃像素 ${yellow.n}、紙色 ${yellow.cream}）、關閉鈕像素風`);
      await page.evaluate(() => document.querySelector('#settingsOk').click());
      await page.waitForTimeout(300);
      // 面板頁籤選取態與面板關閉鈕
      await openPane(page, 'upgrades');
      const tabs = await page.evaluate((src) => {
        eval(src);
        const close = document.querySelector('.side-pane.sel .world-close');
        const ccs = close ? getComputedStyle(close) : null;
        return { close: close ? { borderW: ccs.borderTopWidth, radius: ccs.borderTopLeftRadius, shadow: ccs.boxShadow } : null };
      }, HELP);
      assert(tabs.close && tabs.close.borderW === '2px' && tabs.close.shadow !== 'none' && parseFloat(tabs.close.radius) <= 8, `面板關閉鈕應為像素風（${JSON.stringify(tabs.close)}）`);
      console.log('OK 第 9 項（面板）：面板關閉鈕為 2px 像素邊框＋硬陰影，側欄頁籤像素規則已由 Node 字串驗證');
      await ctx.close();
    }

    // ---------- 第 10 項：手機訂單底部抽屜 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 390, 844);
      await openPane(page, 'orders');
      const m = await page.evaluate((src) => {
        eval(src);
        const body = document.querySelector('.side-panel.world-panel-open .side-body');
        const order = [...document.querySelectorAll('.side-pane[data-pane="orders"] .order')].filter(vis)[0];
        const ful = order ? order.querySelector('.ful') : null;
        const trash = order ? order.querySelector('.trash') : null;
        return { body: body ? ro(body) : null, ratio: body ? ro(body).height / innerHeight : null,
          trash: trash ? { r: ro(trash), size: parseFloat(getComputedStyle(trash).fontSize), deco: getComputedStyle(trash).textDecorationLine, bg: getComputedStyle(trash).backgroundColor } : null,
          fulSize: ful ? parseFloat(getComputedStyle(ful).fontSize) : null };
      }, HELP);
      assert(m.body, '390x844 訂單面板應開啟');
      assert(m.ratio <= 0.62 + 0.005, `訂單面板高度比例 ${(m.ratio * 100).toFixed(1)}% 應 ≤ 62%`);
      assert(m.body.top >= 844 * 0.30, `訂單抽屜上方應保留世界可見（面板 top ${Math.round(m.body.top)}）`);
      assert(m.body.bottom <= 844 - 40, `訂單抽屜應錨在底部工具列上方（bottom ${Math.round(m.body.bottom)}／844）`);
      assert(m.trash, '開放後訂單應有「丟棄」');
      assert(m.trash.r.width >= 44 && m.trash.r.height >= 44, `「丟棄」觸控區應 ≥ 44px（實際 ${Math.round(m.trash.r.width)}×${Math.round(m.trash.r.height)}）`);
      assert(m.trash.size < m.fulSize, `「丟棄」應維持次要小字（${m.trash.size}px < 交付 ${m.fulSize}px）`);
      console.log(`OK 第 10 項 390x844：訂單抽屜高 ${(m.ratio * 100).toFixed(1)}% ≤ 62%、top=${Math.round(m.body.top)} 上方世界可見、「丟棄」觸控 ${Math.round(m.trash.r.width)}×${Math.round(m.trash.r.height)} ≥ 44 且為次要小字`);
      await ctx.close();
    }

    console.log('VERIFIED test-content-r39-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : `（http://127.0.0.1:${PORT}）`));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
