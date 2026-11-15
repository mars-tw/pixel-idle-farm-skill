'use strict';
/* R40 B 線（第 6～10 項）：矮螢幕對話回到下方、陽光看得見、大型面板開啟時收合 HUD、
   手機橫式對話與互動對象、選取框只框一格。用 playwright 實量。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5219;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r40-layout');
fs.mkdirSync(TMP, { recursive: true });
process.env.TEMP = TMP; process.env.TMP = TMP; process.env.TMPDIR = TMP;

// ---------- Node：引用與規則字串 ----------
{
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r40b.css'), 'utf8');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  const world = fs.readFileSync(path.join(ROOT, 'src/world-ui.js'), 'utf8');
  assert(idx.includes('src/content-r40b.css'), 'index.html 應引用 content-r40b.css');
  assert(sw.includes('./src/content-r40b.css'), 'sw.js 快取清單應含 content-r40b.css');
  assert(!/url\(|\.png|\.webp|\.jpg/.test(css), 'content-r40b.css 不得新增圖檔，須以 CSS 繪製');
  assert(/max-height:\s*30dvh/.test(css), '矮螢幕對話高應不超過 30%');
  assert(css.includes('bottom: 96px') && css.includes('bottom: 76px'), '矮螢幕對話應放工具列上方安全區');
  assert(css.includes('.r40-sun-tile') && css.includes('.r40-sun-bar') && css.includes('.r40-sun-icon'), '受光格應有邊框、太陽圖示與進度條規則');
  assert(ui.includes('r40-sun-tile') && ui.includes('remainingSeconds'), 'ui.js 應建立受光格標記並寫入剩餘秒數');
  assert(ui.includes('在光裡：生長加速・收成多 1 份＋陽光 2'), '選取受光格提示應說明加速、份數與陽光總數');
  assert(css.includes('body:has(.side-panel.world-panel-open) #questDock'), '大型面板開啟時任務卡應收合');
  assert(/body:has\(\.side-panel\.world-panel-open\)[\s\S]*?\.seed-hud/.test(css), '大型面板開啟時種子欄應隱藏');
  assert(/\.gtile\.sel[\s\S]*?inset 0 0 0 3px/.test(css), '選取框應為內框、不外擴');
  assert(world.includes('compact-bottom'), '矮螢幕對話模式應為下方安全區');
  console.log('OK Node：content-r40b.css／index／sw 引用與對話、陽光、面板收合、選取框規則齊全');
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
const LONG_LINE = '田邊的路清出來了，收成時記得留一點給餐籃，也替雞舍留些乾草，明天蘿拉會來看看新麥子。';
async function speakMayor(page) {
  await page.evaluate((line) => {
    const z = document.querySelector('#toast-zone'); if (z) z.innerHTML = '';
    const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true;
    const s = window.__farm.state();
    const m = s.map.tiles.find((t) => t.npc === 'mayor');
    const adj = s.map.tiles.find((t) => t.x === m.x + 1 && t.y === m.y) || m;
    s.player.tileId = adj.id; s.player.x = adj.x; s.player.y = adj.y;
    window.__farm.refresh();
    if (window.__farm.focusTile) window.__farm.focusTile(m.id);
    window.FarmWorld.speak('鎮長葛瑞', line);
  }, LONG_LINE);
  await page.waitForTimeout(1100);
}
async function measureDialogue(page) {
  return page.evaluate((src) => {
    eval(src);
    const box = document.querySelector('#worldDialogue');
    if (!box || !vis(box)) return null;
    const p = box.querySelector('p');
    const close = box.querySelector('.dialogue-close');
    const cont = box.querySelector('.dialogue-continue');
    const npc = document.querySelector('.ob[data-kind="npc"][data-npc="mayor"]');
    const actionA = document.querySelector('#actionA');
    const br = ro(box);
    return {
      box: br, p: p ? ro(p) : null, close: close ? ro(close) : null, cont: cont ? ro(cont) : null,
      npc: npc ? ro(npc) : null, actionA: actionA && vis(actionA) ? ro(actionA) : null,
      pVsClose: p && close ? inter(ro(p), ro(close)) : null,
      pVsCont: p && cont ? inter(ro(p), ro(cont)) : null,
      closeVsCont: close && cont ? inter(ro(close), ro(cont)) : null,
      npcVsBox: npc ? inter(ro(npc), br) : null,
      npcVsAction: npc && actionA && vis(actionA) ? inter(ro(npc), ro(actionA)) : 0,
      mode: box.dataset.dialogueMode || '',
    };
  }, HELP);
}

(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    // ---------- 第 6 項：矮螢幕對話回到下方（1366×600、844×390） ----------
    for (const [w, h] of [[1366, 600], [844, 390]]) {
      const tag = `${w}x${h}`;
      const { ctx, page } = await newPage(browser, intercepted, w, h);
      await speakMayor(page);
      const d = await measureDialogue(page);
      assert(d && d.box, `${tag} 對話框應顯示`);
      assert(d.box.height <= h * 0.30 + 1, `${tag} 對話框高 ${Math.round(d.box.height)} 應 ≤ 30%（${Math.round(h * 0.3)}）`);
      assert(d.box.bottom <= h - 60, `${tag} 對話框應在工具列上方安全區（bottom ${Math.round(d.box.bottom)}／${h}）`);
      assert(d.box.top >= h * 0.55, `${tag} 對話框應在下方、不是上方窄條（top ${Math.round(d.box.top)}／${h}）`);
      assert.equal(d.pVsClose, 0, `${tag}「略過」不應壓到台詞（交集 ${d.pVsClose}）`);
      assert.equal(d.pVsCont, 0, `${tag}「繼續」不應壓到台詞（交集 ${d.pVsCont}）`);
      assert.equal(d.closeVsCont, 0, `${tag}「略過」與「繼續」不應重疊（交集 ${d.closeVsCont}）`);
      assert(d.p && d.p.height >= 30, `${tag} 台詞應完整兩行（p 高 ${d.p ? Math.round(d.p.height) : 0}）`);
      console.log(`OK 第 6 項 ${tag}：對話在下方安全區 top=${Math.round(d.box.top)}、高=${Math.round(d.box.height)}（${(d.box.height / h * 100).toFixed(1)}%）、文字與按鈕交集 0、台詞兩行`);
      // 第 9 項在 844×390 一併量測說話者
      if (w === 844) {
        assert(d.npc, '844x390 說話者（鎮長）應存在');
        assert(d.npc.top >= -1 && d.npc.bottom <= h + 1 && d.npc.left >= -1 && d.npc.right <= w + 1, `844x390 說話者應完整在畫面內：${JSON.stringify(d.npc)}`);
        assert.equal(d.npcVsBox, 0, `844x390 對話框不應蓋住說話者（交集 ${d.npcVsBox}）`);
        assert.equal(d.npcVsAction, 0, `844x390 互動鈕不應蓋住說話者（交集 ${d.npcVsAction}）`);
        console.log(`OK 第 9 項 844x390：說話者完整在畫面內 top=${Math.round(d.npc.top)}、與對話框／互動鈕交集 0`);
      }
      await ctx.close();
    }

    // ---------- 第 7＋10 項：陽光看得見、選取框只框一格（四尺寸） ----------
    for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
      const tag = `${w}x${h}`;
      const { ctx, page } = await newPage(browser, intercepted, w, h);
      const tileId = await page.evaluate(() => {
        const s = window.__farm.state();
        s.plots[0].cropId = 'wheat'; s.plots[0].plantedAt = Date.now() - 1000;
        s.sun = { plots: [0], startsAt: Date.now() - 1000, endsAt: Date.now() + 15000, nextAt: Date.now() + 60000, used: [], introduced: true };
        window.__farm.refresh();
        if (window.__farm.sunTick) window.__farm.sunTick();
        const tile = s.map.tiles.find((t) => t.plotIndex === 0);
        window.__farm.focusTile(tile.id);
        return tile.id;
      });
      await page.waitForTimeout(900);
      const sun = await page.evaluate(({ src, tid }) => {
        eval(src);
        const tileEl = document.querySelector('.gtile[data-tile-id="' + tid + '"]');
        const mark = document.querySelector('.r40-sun-tile[data-tile-id="' + tid + '"]');
        if (!tileEl || !mark) return { tile: tileEl ? ro(tileEl) : null, mark: null };
        const bar = mark.querySelector('.r40-sun-bar i');
        const icon = mark.querySelector('.r40-sun-icon');
        const secs = mark.querySelector('.r40-sun-secs');
        const cs = getComputedStyle(mark);
        return {
          tile: ro(tileEl), mark: ro(mark),
          borderW: cs.borderTopWidth, borderColor: cs.borderTopColor,
          icon: icon ? icon.textContent.trim() : '', secsText: secs ? secs.textContent.trim() : '',
          secs: Number(mark.dataset.remainingSeconds), barW: bar ? ro(bar).width : 0, barTrackW: ro(mark.querySelector('.r40-sun-bar')).width,
        };
      }, { src: HELP, tid: tileId });
      assert(sun.mark, `${tag} 受光格應有邊框元素（.r40-sun-tile）`);
      assert(Math.abs(sun.mark.width - sun.tile.width) <= 2 && Math.abs(sun.mark.left - sun.tile.left) <= 2, `${tag} 受光標記應只框一格（標記寬 ${Math.round(sun.mark.width)}／田格 ${Math.round(sun.tile.width)}）`);
      assert.equal(sun.borderW, '3px', `${tag} 受光格暖色邊框應為 3px（${sun.borderW}）`);
      assert(sun.icon.length > 0, `${tag} 受光格應有小太陽圖示`);
      assert(sun.secs >= 1 && sun.secs <= 16, `${tag} 受光格應顯示剩餘秒數（${sun.secs}）`);
      assert(sun.secsText.includes(String(sun.secs)), `${tag} 剩餘秒數文字「${sun.secsText}」應與資料一致`);
      assert(sun.barW > 0 && sun.barW <= sun.barTrackW + 1, `${tag} 剩餘進度條應有填色（${Math.round(sun.barW)}／${Math.round(sun.barTrackW)}）`);
      // 近白像素 < 3%（截圖受光格取樣）
      const box = { x: Math.max(0, sun.tile.left), y: Math.max(0, sun.tile.top), width: sun.tile.width, height: sun.tile.height };
      const shot = await page.screenshot({ clip: box });
      const white = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0, total = 0;
        for (let i = 0; i < d.length; i += 4) { total++; if (d[i] > 242 && d[i + 1] > 242 && d[i + 2] > 235) n++; }
        return total ? n / total * 100 : 0;
      }, shot.toString('base64'));
      assert(white < 3, `${tag} 受光格近白像素 ${white.toFixed(2)}% 應 < 3%`);
      // 選取受光格提示
      await page.evaluate((tid) => window.__farm.clickTile(tid), tileId);
      await page.waitForTimeout(500);
      const sel = await page.evaluate(({ src, tid }) => {
        eval(src);
        const label = document.querySelector('[data-audit="tile-state-label"]');
        const selEl = document.querySelector('.gtile.sel');
        const tileEl = document.querySelector('.gtile[data-tile-id="' + tid + '"]');
        const tiles = [...document.querySelectorAll('.gtile')].filter(vis);
        const widths = tiles.slice(0, 8).map((e) => ro(e).width);
        return { text: label ? label.textContent.trim() : '', sel: selEl ? ro(selEl) : null, tile: tileEl ? ro(tileEl) : null, widths };
      }, { src: HELP, tid: tileId });
      /* R76A：選取田格改顯示這株目前的光性收成結果，不再只寫通用加速。 */
      assert(sel.text.includes('喜光・照過光了：收成多 1 份'), `${tag} 選取受光格提示應說明實際收成結果（實際「${sel.text}」）`);
      assert(sel.sel && sel.tile, `${tag} 應有選取格`);
      assert(Math.abs(sel.sel.width - sel.tile.width) <= 2, `${tag} 選取框寬 ${Math.round(sel.sel.width)} 應等於一格寬 ${Math.round(sel.tile.width)}（±2px）`);
      console.log(`OK 第 7＋10 項 ${tag}：受光格邊框／太陽／${sun.secs} 秒進度條齊全、近白 ${white.toFixed(2)}% < 3%、提示實際光性成果、選取框寬 ${Math.round(sel.sel.width)} ≈ 一格 ${Math.round(sel.tile.width)}`);
      await ctx.close();
    }

    // ---------- 第 8 項：大型面板開啟時收合 HUD ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
      const before = await page.evaluate((src) => { eval(src); const q = document.querySelector('#questDock'); const s = document.querySelector('#seedHud'); return { qh: q ? ro(q).height : 0, seedVis: vis(s) }; }, HELP);
      await page.evaluate(() => window.FarmWorld.openPanel('orders'));
      await page.waitForTimeout(900);
      const open = await page.evaluate((src) => { eval(src); const q = document.querySelector('#questDock'); const s = document.querySelector('#seedHud'); return { qh: q ? ro(q).height : 0, seedVis: vis(s) }; }, HELP);
      assert(open.qh <= 56, `開啟訂單面板時任務卡高 ${Math.round(open.qh)} 應 ≤ 56px`);
      assert.equal(open.seedVis, false, '開啟訂單面板時種子欄應隱藏');
      await page.evaluate(() => document.querySelector('#settingsBtn').click());
      await page.waitForTimeout(600);
      const setting = await page.evaluate((src) => { eval(src); const q = document.querySelector('#questDock'); return { qh: q ? ro(q).height : 0 }; }, HELP);
      assert(setting.qh <= 56, `開啟設定時任務卡高 ${Math.round(setting.qh)} 應 ≤ 56px`);
      await page.evaluate(() => document.querySelector('#settingsOk').click());
      await page.waitForTimeout(400);
      await page.evaluate(() => { const t = document.querySelector('.side-tab[data-tab="orders"]'); if (t) t.click(); });
      await page.waitForTimeout(700);
      const after = await page.evaluate((src) => { eval(src); const q = document.querySelector('#questDock'); const s = document.querySelector('#seedHud'); return { qh: q ? ro(q).height : 0, seedVis: vis(s), panelOpen: !!document.querySelector('.side-panel.world-panel-open') }; }, HELP);
      assert.equal(after.panelOpen, false, '關閉面板後 side-panel 應收合');
      assert(after.qh > 56, `關閉後任務卡應恢復展開（高 ${Math.round(after.qh)}，開啟前 ${Math.round(before.qh)}）`);
      console.log(`OK 第 8 項：開啟訂單／設定時任務卡 ${Math.round(open.qh)}px ≤ 56、種子欄隱藏；關閉後恢復 ${Math.round(after.qh)}px`);
      await ctx.close();
    }

    console.log('VERIFIED test-content-r40-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : `（http://127.0.0.1:${PORT}）`));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
