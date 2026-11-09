'use strict';
/* R64 B 線（計畫第 8、9 項）版面量測：
   8 桌面「今日三件事 1/3」完整顯示不截斷、主線下一步在三件事下方整行；手機展開任務卡 ≤ 畫面高 50% 內部捲動；
   9 鄰居好感面板（送禮／故事）右上角有關閉鈕（至少 44px），按下回到手札鄰居區塊。
   四種尺寸：1366×768、1366×600、390×844、844×390。
   本機沙箱改走 file 與系統 Chrome（比照 R63）：
   FARM_TEST_FILE=1 FARM_TEST_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
function serve() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const file = path.resolve(ROOT, '.' + (u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname)));
    const rel = path.relative(ROOT, file);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server)); });
}

const VIEWS = [
  { w: 1366, h: 768, mobile: false },
  { w: 1366, h: 600, mobile: false },
  { w: 390, h: 844, mobile: true },
  { w: 844, h: 390, mobile: true },
];
const HELP = `
  globalThis.ro = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
`;

(async () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r58b.css'), 'utf8');
  assert.match(css, /R64B（第 8 項）：桌面任務卡/, 'content-r58b.css 應有 R64B 桌面任務卡規則');
  assert.match(css, /R64B（第 8 項）：手機展開任務卡/, 'content-r58b.css 應有 R64B 手機展開規則');
  assert.match(css, /max-height:\s*50dvh/, '手機展開任務卡應限制 50dvh');
  assert.match(css, /\.r64b-neighbor-close \{ min-width: 44px !important; min-height: 44px !important;/, '鄰居面板關閉鈕應至少 44px');
  const neighbors = fs.readFileSync(path.join(ROOT, 'src/neighbors-r61.js'), 'utf8');
  assert.match(neighbors, /data-r64b-neighbor-close|dataset\.r64bNeighborClose/, '鄰居面板應標記關閉鈕');
  assert.match(neighbors, /returnToJournal/, '關閉鄰居面板應回到手札');

  let useFile = process.env.FARM_TEST_FILE === '1';
  let server = null;
  if (!useFile) {
    try { server = await serve(); } catch (e) { useFile = true; }
    if (server) server.on('error', () => {});
  }
  const base = useFile ? 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html' : `http://127.0.0.1:${server.address().port}/index.html`;
  let browser;
  const launch = { headless: true };
  if (process.env.FARM_TEST_CHROME) { launch.executablePath = process.env.FARM_TEST_CHROME; launch.args = ['--no-sandbox']; }
  try { browser = await chromium.launch(launch); } catch (e) {
    browser = null;
    for (const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
      if (fs.existsSync(p)) { try { browser = await chromium.launch({ headless: true, executablePath: p, args: ['--no-sandbox'] }); break; } catch (err) {} }
    }
    if (!browser) throw e;
    if (!useFile && server) { /* http 已啟動，沿用 http 模式 */ }
    else useFile = true;
  }
  try {
    for (const view of VIEWS) {
      const tag = `${view.w}×${view.h}`;
      const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, isMobile: view.mobile, hasTouch: view.mobile, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(base);
      await page.waitForFunction(() => window.__farm && !document.querySelector('#startupLoading'), null, { timeout: 30000 });
      await page.waitForTimeout(900);
      await page.evaluate(() => { const b = document.querySelector('#worldBegin'); if (b) b.click(); });
      await page.waitForTimeout(900);

      /* ---- 準備「今日三件事＋主線下一步」狀態 ---- */
      await page.evaluate(() => {
        const s = window.__farm.state(), A = window.AdventureAPI;
        A.ensure(s, Date.now());
        s.adventure.claimed.c1_homecoming = true; s.adventure.quests.c1_homecoming.status = 'claimed';
        s.adventure.claimed.c1_first_harvest = true; s.adventure.quests.c1_first_harvest.status = 'claimed';
        window.__farm.refresh(); if (window.FarmWorld) window.FarmWorld.refresh(s);
        const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true;
      });
      await page.waitForTimeout(800);
      await page.waitForFunction(() => { const z = document.querySelector('#toast-zone'); return !z || !z.children.length; }, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(300);

      /* ---- 第 8 項：手機先展開任務卡 ---- */
      if (view.mobile) {
        const folded = await page.evaluate(() => document.querySelector('#questDock').className);
        if (/quest-(auto-)?collapsed|quest-target-collapsed/.test(folded)) {
          await page.locator("[data-audit='quest-collapse']").click();
          await page.waitForTimeout(500);
        }
      }

      const dock = await page.evaluate((src) => {
        eval(src);
        const box = document.querySelector('#questDock');
        const title = box.querySelector('.world-objective-title');
        const progress = box.querySelector('[data-audit="quest-progress"]');
        const routes = box.querySelector('.world-objective-routes');
        const next = box.querySelector('.r67a-now');
        return {
          ih: innerHeight, dock: ro(box),
          dockScrollH: box.scrollHeight, dockClientH: box.clientHeight,
          overflowY: getComputedStyle(box).overflowY,
          title: title ? { text: title.textContent.trim(), sw: title.scrollWidth, cw: title.clientWidth, r: ro(title) } : null,
          progress: progress ? progress.textContent.trim() : '',
          routes: routes ? ro(routes) : null,
          next: next ? { text: next.textContent.trim(), r: ro(next) } : null,
          collapsed: box.classList.contains('quest-collapsed') || box.classList.contains('quest-auto-collapsed') || box.classList.contains('quest-target-collapsed'),
        };
      }, HELP);
      assert.ok(dock.title, `${tag} 應有任務卡標題`);
      if (!view.mobile) {
        /* 桌面：標題完整、主線下一步整行在三件事下方 */
        assert.match(dock.title.text, /今日三件事/, `${tag} 第 8 項：桌面應顯示今日三件事（實際「${dock.title.text}」）`);
        assert.match(dock.progress, /^\d+\/3$/, `${tag} 第 8 項：進度應完整顯示（實際「${dock.progress}」）`);
        assert.ok(dock.title.sw <= dock.title.cw + 1, `${tag} 第 8 項：標題不應被截斷（捲動寬 ${dock.title.sw}／可視寬 ${dock.title.cw}「${dock.title.text}」）`);
        assert.ok(dock.routes, `${tag} 第 8 項：應有今日三件事清單`);
        assert.ok(dock.next, `${tag} 第 8 項：應有現在做`);
        if (dock.collapsed) assert.equal(dock.routes.height, 0, `${tag} 第 8 項：收合時第三層清單應完整收起`);
        else assert.ok(dock.next.r.bottom <= dock.routes.top + 2, `${tag} 第 8 項：現在做應在三件清單上方（現在做底 ${Math.round(dock.next.r.bottom)}／清單頂 ${Math.round(dock.routes.top)}）`);
        assert.ok(dock.next.r.width >= dock.dock.width * 0.85, `${tag} 第 8 項：主線下一步應整行寬（${Math.round(dock.next.r.width)}／卡寬 ${Math.round(dock.dock.width)}）`);
        assert.ok(dock.next.r.left >= dock.dock.left - 1 && dock.next.r.right <= dock.dock.right + 1, `${tag} 第 8 項：主線下一步不可超出任務卡`);
        console.log(`OK ${tag} 第 8 項：桌面標題完整「${dock.title.text}」、「現在做」整行在三件清單上方`);
      } else {
        /* 手機展開：最多 50% 畫面高，超過內部捲動 */
        assert.equal(dock.collapsed, false, `${tag} 第 8 項：手機任務卡應已展開`);
        assert.ok(dock.dock.height <= dock.ih * 0.5 + 1, `${tag} 第 8 項：展開任務卡高 ${Math.round(dock.dock.height)} 超過畫面 50%（${Math.round(dock.ih * 0.5)}）`);
        if (dock.dockScrollH > dock.dockClientH + 2) assert.ok(['auto', 'scroll'].includes(dock.overflowY), `${tag} 第 8 項：內容超過時應可內部捲動（overflowY=${dock.overflowY}）`);
        console.log(`OK ${tag} 第 8 項：手機展開任務卡高 ${Math.round(dock.dock.height)}px ≤ 50%（${Math.round(dock.ih * 0.5)}px）`);
      }

      /* ---- 第 9 項：鄰居面板關閉鈕回到手札（每尺寸都驗，直式手機另在下方補強） ---- */
      await page.evaluate(() => {
        const s = window.__farm.state();
        window.NeighborsR61.ensure(s, Date.now());
        s.storage.items = s.storage.items || {}; s.storage.items.wheat = 2;
        if (window.FarmWorld) window.FarmWorld.openPanel('journal');
        window.__farm.refresh();
      });
      await page.waitForFunction(() => !!document.querySelector('[data-r61b-neighbors]'), null, { timeout: 15000 });
      await page.evaluate(() => { const b = document.querySelector("[data-r61b-gift-open='child']"); if (b) b.click(); });
      await page.waitForFunction(() => !!document.querySelector('[data-r64b-neighbor-close]'), null, { timeout: 15000 });
      const closeInfo = await page.evaluate((src) => {
        eval(src);
        const btn = document.querySelector('[data-r64b-neighbor-close]');
        const modal = document.querySelector('#worldModal');
        return { btn: btn ? ro(btn) : null, label: btn ? btn.getAttribute('aria-label') || '' : '', modalShown: !!modal && (modal.classList.contains('show') || vis(modal)) };
      }, HELP);
      assert.ok(closeInfo.btn, `${tag} 第 9 項：鄰居面板應有右上角關閉鈕`);
      assert.ok(closeInfo.btn.width >= 44 - 1 && closeInfo.btn.height >= 44 - 1, `${tag} 第 9 項：關閉鈕應至少 44px（實際 ${Math.round(closeInfo.btn.width)}×${Math.round(closeInfo.btn.height)}）`);
      assert.match(closeInfo.label, /回到手札/, `${tag} 第 9 項：關閉鈕應說明回到手札`);
      await page.locator('[data-r64b-neighbor-close]').click();
      await page.waitForTimeout(700);
      const back = await page.evaluate(() => {
        const modal = document.querySelector('#worldModal');
        const panel = document.querySelector('.side-panel');
        return {
          modalShown: !!modal && modal.classList.contains('show'),
          panelOpen: !!panel && panel.classList.contains('world-panel-open'),
          hasNeighbors: !!document.querySelector('[data-r61b-neighbors]'),
        };
      });
      assert.equal(back.modalShown, false, `${tag} 第 9 項：按下關閉鈕後鄰居面板應關閉`);
      assert.equal(back.panelOpen, true, `${tag} 第 9 項：按下關閉鈕後應回到手札面板`);
      assert.equal(back.hasNeighbors, true, `${tag} 第 9 項：回到手札後應看得到鄰居區塊`);
      console.log(`OK ${tag} 第 9 項：鄰居面板關閉鈕 ${Math.round(closeInfo.btn.width)}×${Math.round(closeInfo.btn.height)}px，按下回到手札`);

      assert.deepEqual(errors, [], `${tag} 頁面錯誤`);
      await ctx.close();
    }
  } finally { await browser.close(); if (server) server.close(); }
  console.log('VERIFIED content R64 layout');
})().catch((e) => { console.error(e); process.exit(1); });
