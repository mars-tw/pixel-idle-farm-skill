'use strict';
/* R26 B線版面量測（第 6～10 項）：長面板安全高度與捲動、手機面板與控制不重疊、
   任務卡可收合、NPC 名牌錨在頭頂、對比與一致。
   用 playwright 在本機起伺服器實測（結束關閉），截圖存 docs/content/r26/layout/。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5146;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r26', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const TMP = path.join(ROOT, '.tmp-r26-layout');
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(SHOT_DIR, { recursive: true });
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
  await page.locator('#worldBegin').click();
  await page.waitForTimeout(500);
  return { ctx, page };
}

const visJs = (sel) => {
  const e = document.querySelector(sel);
  if (!e) return { exists: false, visible: false };
  const s = getComputedStyle(e), r = e.getBoundingClientRect();
  return { exists: true, visible: s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0, display: s.display, visibility: s.visibility };
};

async function openPanel(page, tab) {
  await page.evaluate((t) => window.FarmWorld.openPanel(t), tab);
  await page.waitForTimeout(350);
}

async function panelMeasure(page) {
  return page.evaluate(() => {
    const body = document.querySelector('.side-panel.world-panel-open .side-body');
    const dock = document.querySelector('#farmDock');
    if (!body) return null;
    const br = body.getBoundingClientRect(), dr = dock ? dock.getBoundingClientRect() : null;
    const hint = document.querySelector('[data-audit="panel-scroll-hint"]');
    return {
      top: br.top, bottom: br.bottom, dockTop: dr ? dr.top : innerHeight,
      scrollH: body.scrollHeight, clientH: body.clientHeight,
      hintExists: !!hint, hintHidden: hint ? (hint.hidden || getComputedStyle(hint).display === 'none' || hint.getBoundingClientRect().height === 0) : true, hintVisible: hint ? (!hint.hidden && getComputedStyle(hint).display !== 'none' && hint.getBoundingClientRect().height > 0) : false, hasMore: !!body.querySelector('.side-pane.sel .r32-show-more'), hiddenCards: body.querySelectorAll('.side-pane.sel .r32-panel-hidden').length,
    };
  });
}

async function scrollPanelToBottom(page) {
  await page.evaluate(() => { const b = document.querySelector('.side-panel.world-panel-open .side-body'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const body = document.querySelector('.side-panel.world-panel-open .side-body');
    body.scrollTop = body.scrollHeight;
    const pane = body.querySelector('.side-pane.sel');
    const btns = [...pane.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const last = btns[btns.length - 1];
    if (!last) return { btnCount: btns.length, fully: false };
    const r = last.getBoundingClientRect(), br = body.getBoundingClientRect();
    const hint = document.querySelector('[data-audit="panel-scroll-hint"]');
    return { btnCount: btns.length, lastText: last.textContent.trim().slice(0, 24), fully: r.top >= br.top - 1 && r.bottom <= br.bottom + 1, hintHidden: hint ? (hint.hidden || getComputedStyle(hint).display === 'none' || hint.getBoundingClientRect().height === 0) : true, hintVisible: hint ? (!hint.hidden && getComputedStyle(hint).display !== 'none' && hint.getBoundingClientRect().height > 0) : false };
  });
}

(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
      const mobile = w <= 859 || h <= 480;
      const { ctx, page } = await newPage(browser, intercepted, w, h);

      if (mobile) {
        // 方向鍵與物品格（種子列）間距 ≥ 8px（面板開啟前量測）
        const gap = await page.evaluate(() => {
          const d = document.querySelector('#mobileControls .dpad').getBoundingClientRect();
          const s = document.querySelector('#seedHud').getBoundingClientRect();
          const dx = Math.max(s.left - d.right, d.left - s.right, 0);
          const dy = Math.max(s.top - d.bottom, d.top - s.bottom, 0);
          const overlap = dx === 0 && dy === 0;
          return { gap: overlap ? -1 : Math.max(dx, dy), dx, dy };
        });
        assert(gap.gap >= 8, `${w}×${h} 方向鍵與物品格間距 ${gap.gap}px 小於 8px`);
        console.log(`OK 間距 ${w}×${h} 方向鍵與物品格 ${gap.gap}px ≥ 8px`);

        // 8：任務卡可收合——收成一行摘要（章節進度＋目前步驟），再點展開保留短說明
        await page.waitForSelector('[data-audit="quest-collapse"]', { timeout: 5000 }); const initiallyCollapsed = await page.evaluate(() => { const b = document.querySelector('#questDock'); return b.classList.contains('quest-collapsed') || b.classList.contains('quest-auto-collapsed'); }); if (initiallyCollapsed) { await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(200); await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(200); }
        const before = await page.evaluate(() => document.querySelector('#questDock').getBoundingClientRect().height);
        await page.locator('[data-audit="quest-collapse"]').click();
        await page.waitForTimeout(200);
        const collapsed = await page.evaluate(() => {
          const box = document.querySelector('#questDock');
          const chapter = box.querySelector('.world-chapter');
          const step = box.querySelector('.world-objective-bottom > span');
          const vis = (e) => { if (!e) return false; const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0; };
          return { cls: box.classList.contains('quest-collapsed'), h: box.getBoundingClientRect().height, chapter: vis(chapter), step: vis(step), text: box.textContent };
        });
        assert(collapsed.cls, `${w}×${h} 任務卡未收合`);
        assert(collapsed.h < before, `${w}×${h} 任務卡收合後高度未變小（${before}→${collapsed.h}）`);
        assert(collapsed.chapter && collapsed.step, `${w}×${h} 收合摘要應保留章節進度與目前步驟`);
        await page.screenshot({ path: path.join(SHOT_DIR, `quest-collapsed-${w}x${h}.png`) });
        await page.locator('[data-audit="quest-collapse"]').click();
        await page.waitForTimeout(200);
        const expanded = await page.evaluate(() => {
          const box = document.querySelector('#questDock');
          const detail = box.querySelector('.world-objective-detail');
          const s = detail ? getComputedStyle(detail) : null, r = detail ? detail.getBoundingClientRect() : null;
          return { cls: box.classList.contains('quest-collapsed'), detailVisible: !!(s && s.display !== 'none' && r && r.height > 0) };
        });
        assert(!expanded.cls && expanded.detailVisible, `${w}×${h} 任務卡展開後應保留一行短說明`);
        await page.screenshot({ path: path.join(SHOT_DIR, `quest-expanded-${w}x${h}.png`) });
        console.log(`OK 任務卡 ${w}×${h} 可收合（${Math.round(before)}→${Math.round(collapsed.h)}px）與展開`);
      }

      // 6：升級與訂單面板——下緣不超過底部工具列上緣、可捲動、捲到底最後按鈕完整可見
      await page.evaluate(() => { const s = window.__farm.state(); window.AdventureAPI.ensure(s, Date.now()); s.adventure.claimed.c1_first_harvest = true; window.refreshOrders(s, Date.now()); window.__farm.refresh(); });
      for (const tab of ['upgrades', 'orders']) {
        await openPanel(page, tab);
        const m = await panelMeasure(page);
        assert(m, `${w}×${h} ${tab} 面板未開啟`);
        assert(m.bottom <= m.dockTop + 1, `${w}×${h} ${tab} 面板下緣 ${Math.round(m.bottom)} 超過工具列上緣 ${Math.round(m.dockTop)}`);
        if (tab === 'upgrades') assert(m.scrollH > m.clientH || m.hasMore, `${w}×${h} 升級面板內容應可捲動或以「再顯示 N 項」收起（scrollH ${m.scrollH} ≤ clientH ${m.clientH}）`); // R42：被黏底按鈕蓋到的卡改收起，內容可能剛好不需捲動，但仍須有「再顯示」入口
        if (m.scrollH > m.clientH) { assert.equal(m.hintVisible, false, `${w}×${h} ${tab} 面板不應再顯示「往下還有內容」（R36 只留一種提示）`); if (m.hiddenCards > 0) assert(m.hasMore, `${w}×${h} ${tab} 面板收起卡片後應以「再顯示 N 項」作為唯一提示`); }
        await page.screenshot({ path: path.join(SHOT_DIR, `${tab}-${w}x${h}.png`) });
        const s = await scrollPanelToBottom(page);
        await page.waitForTimeout(150);
        const s2 = await scrollPanelToBottom(page);
        assert(s2.btnCount > 0 && s2.fully, `${w}×${h} ${tab} 捲到底最後一個按鈕未完整可見（「${s2.lastText}」）`);
        if (m.scrollH > m.clientH) assert(s2.hintHidden === true && s2.hintVisible === false, `${w}×${h} ${tab} 捲到底後不應出現「往下還有內容」`);
        console.log(`OK 面板 ${w}×${h} ${tab} 下緣 ${Math.round(m.bottom)} ≤ 工具列上緣 ${Math.round(m.dockTop)}、捲到底最後按鈕「${s2.lastText}」完整可見`);
        if (mobile) {
          const hidden = await page.evaluate((fnSrc) => {
            const vis = eval(fnSrc);
            return { mc: vis('#mobileControls'), bar: vis('#sceneActionBar'), assistant: vis('#smartAssistant'), action: vis('#actionA'), dpad: vis('#mobileControls .dpad') };
          }, visJs.toString());
          for (const [k, v] of Object.entries(hidden)) assert(!v.visible, `${w}×${h} ${tab} 面板開啟時 ${k} 應隱藏，實際 ${JSON.stringify(v)}`);
          console.log(`OK 控制 ${w}×${h} ${tab} 面板開啟時方向鍵、互動鍵與浮動引導鈕皆隱藏`);
        }
        if (tab === 'orders') {
          const clients = await page.evaluate(() => [...document.querySelectorAll('.o-client')].map((e) => ({ t: e.textContent.trim(), sw: e.scrollWidth, cw: e.clientWidth })));
          assert(clients.length > 0, `${w}×${h} 訂單面板沒有訂單人名`);
          for (const c of clients) {
            assert(!c.t.includes('…'), `${w}×${h} 訂單人名被截斷（含「…」）：「${c.t}」`);
            assert(c.sw <= c.cw + 1, `${w}×${h} 訂單人名溢出被截：${c.sw} > ${c.cw}（「${c.t}」）`);
          }
          const metas = await page.evaluate(() => [...document.querySelectorAll('.o-meta')].map((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, ws: getComputedStyle(e).whiteSpace })));
          for (const mt of metas) assert(mt.ws === 'nowrap' && mt.sw <= mt.cw + 1, `${w}×${h} 訂單倒數時間應單行不溢出`);
          console.log(`OK 訂單 ${w}×${h} 人名無「…」截斷（${clients.length} 筆）、倒數時間單行`);
        }
      }

      if (mobile) {
        const icon = await page.evaluate(() => {
          const e = document.querySelector('#dailyOpen .ui-icon');
          if (!e) return null;
          const s = getComputedStyle(e);
          return { display: s.display, bg: s.backgroundImage };
        });
        if (w > h) assert(icon && icon.display !== 'none' && icon.bg !== 'none', `844×390 橫式工具列「日誌」應有圖示，實際 ${JSON.stringify(icon)}`);
      }

      // 9：任務目標 NPC 名牌中心與 NPC 頭頂水平距離 ≤ 8px
      await page.evaluate(() => { const s = __farm.state(); const mayor = s.map.tiles.find((t) => t.npc === 'mayor'); __farm.focusTile(mayor.id); });
      await page.waitForTimeout(700);
      const plate = await page.evaluate(() => {
        const el = document.querySelector('[data-audit="quest-npc-nameplate"]');
        const marker = document.querySelector('[data-audit="quest-marker"]');
        if (!el || !marker) return null;
        const npc = document.querySelector(`.ob[data-kind="npc"][data-tile-id="${marker.dataset.tileId}"]`);
        if (!npc) return null;
        const pr = el.getBoundingClientRect(), nr = npc.getBoundingClientRect();
        return { text: el.textContent.trim(), dx: Math.abs((pr.left + pr.width / 2) - (nr.left + nr.width / 2)), plateTop: pr.bottom, npcTop: nr.top };
      });
      assert(plate, `${w}×${h} 任務目標 NPC 名牌或 NPC 圖片不存在`);
      assert(plate.dx <= 8, `${w}×${h} 名牌中心與 NPC 頭頂水平距離 ${plate.dx.toFixed(1)}px 超過 8px`);
      console.log(`OK 名牌 ${w}×${h}「${plate.text}」與 NPC 頭頂水平距離 ${plate.dx.toFixed(1)}px ≤ 8px`);

      // 對話中截圖（手機時方向鍵等應隱藏）
      await page.evaluate(() => { document.querySelector('.side-panel').classList.remove('world-panel-open'); window.FarmWorld.speak('葛瑞', '收成先留一籃，別全拿去賣。門邊總有人，還沒吃飯。'); });
      await page.waitForTimeout(350);
      const dlg = await page.evaluate((fnSrc) => { const vis = eval(fnSrc); return { d: vis('#worldDialogue'), mc: vis('#mobileControls') }; }, visJs.toString());
      assert(dlg.d.visible, `${w}×${h} 對話框未顯示`);
      if (mobile) assert(!dlg.mc.visible, `${w}×${h} 對話開啟時方向鍵應隱藏`);
      await page.screenshot({ path: path.join(SHOT_DIR, `dialogue-${w}x${h}.png`) });
      console.log(`OK 對話 ${w}×${h} 已截圖${mobile ? '、方向鍵隱藏' : ''}`);

      await ctx.close();
    }

    // 10：主要淡色文字對比 ≥ 4.5:1（在 1366×768 實際渲染元素上計算）
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
      await page.evaluate(() => { const s = window.__farm.state(); window.AdventureAPI.ensure(s, Date.now()); s.adventure.claimed.c1_first_harvest = true; window.refreshOrders(s, Date.now()); window.__farm.refresh(); });
      await openPanel(page, 'orders');
      const rows = await page.evaluate(() => {
        const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
        const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const bgStops = (el) => {
          let n = el;
          while (n) {
            const cs = getComputedStyle(n);
            const img = cs.backgroundImage || '';
            if (img.includes('gradient')) { const stops = [...img.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter(Boolean); if (stops.length) return stops; }
            const c = parse(cs.backgroundColor);
            if (c && c.a > 0) return [c.a < 1 ? over(c, { r: 105, g: 153, b: 75, a: 1 }) : c];
            n = n.parentElement;
          }
          return [{ r: 255, g: 255, b: 255, a: 1 }];
        };
        const check = (label, el) => {
          if (!el) return { label, ratio: 0, missing: true };
          const fg = parse(getComputedStyle(el).color);
          const ratio = Math.min(...bgStops(el).map((bg) => cr(over(fg, bg), bg)));
          return { label, ratio: Number(ratio.toFixed(2)) };
        };
        const out = [];
        out.push(check('訂單人名', document.querySelector('.o-client')));
        out.push(check('訂單獎勵', document.querySelector('.o-reward')));
        out.push(check('訂單倒數', document.querySelector('.o-meta')));
        out.push(check('訂單交付鈕', document.querySelector('.order .ful')));
        // 任務卡文字（深底淺字）
        out.push(check('任務章節', document.querySelector('#questDock .world-chapter')));
        out.push(check('任務說明', document.querySelector('#questDock .world-objective-detail')));
        // 種子價格（物品格小字）
        out.push(check('種子價格', document.querySelector('#seedHud .seed .sc')));
        return out;
      });
      await openPanel(page, 'upgrades');
      const upRows = await page.evaluate(() => {
        const el = document.querySelector('.up .u-desc');
        if (!el) return null;
        const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const fg = parse(getComputedStyle(el).color);
        let n = el, bg = { r: 255, g: 248, b: 223 };
        while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { bg = c; break; } n = n.parentElement; }
        const [x, y] = [lum(fg), lum(bg)].sort((p, q) => q - p);
        return { label: '升級說明', ratio: Number(((x + 0.05) / (y + 0.05)).toFixed(2)) };
      });
      if (upRows) rows.push(upRows);
      // 0% 進度條：淺底深填；完成狀態 ✓ 標籤（以實際 CSS 級聯驗證 ::before）
      const meter = await page.evaluate(() => {
        const track = document.querySelector('#questDock .world-meter');
        const fill = track ? track.querySelector('i') : null;
        if (!track || !fill) return null;
        const lumOf = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); const p = m[1].split(',').map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
        const quest = document.querySelector('.adventure-quest');
        let checkMark = '';
        if (quest) { quest.classList.add('claimed'); checkMark = getComputedStyle(quest.querySelector('.world-chapter span:last-child'), '::before').content; quest.classList.remove('claimed'); }
        return { trackLum: lumOf(getComputedStyle(track).backgroundColor), fillLum: lumOf(getComputedStyle(fill).backgroundColor), checkMark };
      });
      for (const r of rows) {
        assert(!r.missing, `對比量測缺少元素：${r.label}`);
        assert(r.ratio >= 4.5, `${r.label} 對比 ${r.ratio}:1 低於 4.5:1`);
        console.log(`OK 對比 ${r.label} ${r.ratio}:1 ≥ 4.5:1`);
      }
      assert(meter && meter.trackLum > meter.fillLum, '0% 進度條應為淺底深填（底色亮度需高於填色）');
      assert(meter.checkMark.includes('✓'), `完成狀態應有 ✓ 標籤，實際 ::before 內容 ${meter.checkMark}`);
      console.log('OK 進度條 0% 淺底深填、完成狀態有 ✓ 標籤');
      await ctx.close();
    }

    console.log('VERIFIED test-content-r26-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : '（http://127.0.0.1:' + PORT + '）'));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
