'use strict';
/* R62 B 線（計畫第 6～10 項）版面量測：
   6 田格陽光倒數是淡黃底「☀ 剩餘秒數」小標籤，跟作物進度條不重疊；空土格只有陽光標示；
   7 主線二選一泡泡出現時，選項不被名牌擋、文字完整、真的點得到；
   8 收穫祭進行中，橫幅獨立一列在任務卡最上方（跟任務卡一樣寬），任務內容不被擠成窄欄；
   9 手札（故事面板）頂部有「鄰居好感」入口，點了直接看到四位鄰居的愛心、下一段故事與送禮；
   10 手機開場（彈窗開著）頂部標誌與資源列完整在畫面內。
   四種尺寸：1366×768、1366×600、390×844、844×390。
   本機沙箱無法 listen／無 Playwright 瀏覽器時可用環境變數改走 file 與系統 Chrome（比照 R60）：
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
  globalThis.inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  globalThis.vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
`;

(async () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r58b.css'), 'utf8');
  assert.match(css, /R62B/, 'content-r58b.css 末尾應有 R62B 規則');
  assert.match(css, /\.r40-sun-secs::before\s*\{\s*content:\s*"☀/, '陽光倒數標籤前面應有太陽圖示');
  assert.match(css, /\.r40-sun-secs\s*\{[^}]*background:\s*#ffe9a8/, '陽光倒數標籤應是淡黃底');
  assert.match(css, /\.npc-bubble:has\(\.r60a-story-choices\)/, '二選一泡泡應在名牌之上');
  assert.match(css, /body:has\(\.npc-bubble \.r60a-story-choices\)[^{]*\.npc-nameplate-near/, '二選一期間應先藏起附近名牌');
  assert.match(css, /#questDock:has\(\.r61a-festival-banner\)/, '有收穫祭橫幅時任務卡應改直向排列');
  assert.match(css, /#questDock \.r61a-festival-banner\s*\{[^}]*width:\s*100%/, '收穫祭橫幅應跟任務卡一樣寬');
  assert.match(css, /\.r62b-neighbor-entry/, '手札鄰居好感入口應有樣式');
  const worldUi = fs.readFileSync(path.join(ROOT, 'src/world-ui.js'), 'utf8');
  assert.match(worldUi, /data-r62b-neighbors/, '手札應有鄰居好感入口按鈕');
  assert.match(worldUi, /鄰居好感/, '入口文字應寫鄰居好感');
  assert.match(worldUi, /openNeighborsJournal/, '入口應接到鄰居區塊');

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

      /* ---- 第 10 項：開場彈窗開著時，頂部標誌與資源列完整（390×844 為必要驗收） ---- */
      const top = await page.evaluate((src) => {
        eval(src);
        const modal = document.querySelector('#worldModal');
        return {
          iw: innerWidth, ih: innerHeight, modalOpen: !!(modal && modal.classList.contains('show')),
          header: ro(document.querySelector('header')), logo: ro(document.querySelector('.farm-logo')),
          logoReady: (() => { const i = document.querySelector('.farm-logo'); return !!i && i.complete && i.naturalWidth > 0; })(),
          resBar: ro(document.querySelector('#resBar')),
          chips: [...document.querySelectorAll('#resBar .res')].map(ro),
          card: modal && modal.querySelector('.modal-card') ? ro(modal.querySelector('.modal-card')) : null,
        };
      }, HELP);
      assert.equal(top.modalOpen, true, `${tag} 第 10 項量測時開場彈窗應開著`);
      if (view.w === 390 && view.h === 844) {
        assert.ok(top.logo.top >= 0 && top.logo.left >= 0 && top.logo.right <= top.iw && top.logo.bottom <= top.ih, `${tag} 第 10 項：標誌應完整在畫面內：${JSON.stringify(top.logo)}`);
        assert.equal(top.logoReady, true, `${tag} 第 10 項：標誌圖片應已載入`);
        assert.ok(top.header.top >= 0 && top.header.left >= 0 && top.header.right <= top.iw, `${tag} 第 10 項：頂部列應完整在畫面內：${JSON.stringify(top.header)}`);
        assert.ok(top.resBar.left >= 0 && top.resBar.right <= top.iw && top.resBar.top >= 0, `${tag} 第 10 項：資源列應完整在畫面內：${JSON.stringify(top.resBar)}`);
        assert.ok(top.chips.length >= 1 && top.chips.every((c) => c.left >= 0 && c.right <= top.iw && c.top >= 0), `${tag} 第 10 項：每顆資源應完整在畫面內：${JSON.stringify(top.chips)}`);
        assert.ok(!top.card || top.card.top >= top.header.bottom - 1, `${tag} 第 10 項：開場彈窗不應蓋住頂部（彈窗頂 ${top.card && Math.round(top.card.top)}／頂部底 ${Math.round(top.header.bottom)}）`);
        console.log(`OK ${tag} 第 10 項：彈窗開著時標誌與 ${top.chips.length} 顆資源完整在畫面內、彈窗不蓋頂部`);
      }

      await page.evaluate(() => { const b = document.querySelector('#worldBegin'); if (b) b.click(); });
      await page.waitForTimeout(500);

      /* ---- 第 6 項：陽光倒數樣式、跟作物標示不重疊、空土格只有陽光 ---- */
      const tileIds = await page.evaluate(() => {
        const s = window.__farm.state(), now = Date.now();
        s.plots[0].cropId = 'wheat'; s.plots[0].plantedAt = now - 1000; s.plots[0].wateredAt = 0;
        if (s.plots[1]) { s.plots[1].cropId = null; s.plots[1].plantedAt = 0; }
        s.sun = { plots: [0, 1], startsAt: now - 1000, endsAt: now + 14000, nextAt: now + 60000, used: [], introduced: true };
        window.__farm.refresh();
        const t0 = s.map.tiles.find((t) => t.plotIndex === 0);
        const t1 = s.map.tiles.find((t) => t.plotIndex === 1);
        if (window.__farm.focusTile) window.__farm.focusTile(t0.id);
        return { planted: t0.id, empty: t1.id };
      });
      await page.waitForTimeout(900);
      const sun = await page.evaluate(({ src, ids }) => {
        eval(src);
        const read = (tid) => {
          const mk = document.querySelector('.r40-sun-tile[data-tile-id="' + tid + '"]');
          const tileEl = document.querySelector('.gtile[data-tile-id="' + tid + '"]');
          if (!mk) return { mark: null };
          const secs = mk.querySelector('.r40-sun-secs');
          return {
            mark: ro(mk), tile: tileEl ? ro(tileEl) : null,
            secsText: secs ? secs.textContent.trim() : '', secsRect: secs ? ro(secs) : null,
            bg: secs ? getComputedStyle(secs).backgroundColor : '',
            before: secs ? getComputedStyle(secs, '::before').content : '',
            sunBar: ro(mk.querySelector('.r40-sun-bar')),
            childClasses: [...mk.children].map((c) => c.className),
          };
        };
        return { planted: read(ids.planted), empty: read(ids.empty), bars: [...document.querySelectorAll('.ob-bar')].filter(vis).map(ro) };
      }, { src: HELP, ids: tileIds });
      for (const [name, row] of [['有作物', sun.planted], ['空土', sun.empty]]) {
        assert.ok(row.mark, `${tag} 第 6 項：${name}的受光格應有陽光標示`);
        assert.match(row.secsText, /^\d+ 秒$/, `${tag} 第 6 項：${name}陽光標示應寫剩餘秒數（實際「${row.secsText}」）`);
        assert.ok(row.before.includes('☀'), `${tag} 第 6 項：${name}陽光標示前面應有太陽圖示（::before=${row.before}）`);
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(row.bg || '');
        assert.ok(m && Number(m[1]) >= 200 && Number(m[2]) >= 170 && Number(m[3]) <= 215, `${tag} 第 6 項：${name}陽光標示應是淡黃底（實際 ${row.bg}）`);
        assert.ok(row.tile && row.secsRect.left >= row.tile.left - 1 && row.secsRect.right <= row.tile.right + 1 && row.secsRect.top >= row.tile.top - 1 && row.secsRect.bottom <= row.tile.bottom + 1, `${tag} 第 6 項：${name}陽光標示應留在田格內：${JSON.stringify(row.secsRect)} vs ${JSON.stringify(row.tile)}`);
        const hitBar = sun.bars.filter((b) => ((function (a, c) { return Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left)) * Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top)); })(row.secsRect, b)) > 0);
        assert.equal(hitBar.length, 0, `${tag} 第 6 項：${name}陽光標示不應跟作物進度條重疊`);
        assert.ok(row.sunBar.top >= row.secsRect.bottom - 1, `${tag} 第 6 項：${name}陽光進度條應在倒數標籤下方、不重疊`);
      }
      assert.ok(sun.empty.childClasses.length >= 1 && sun.empty.childClasses.every((c) => /r40-sun/.test(c)), `${tag} 第 6 項：空土格上只應有陽光標示（實際子元素 ${JSON.stringify(sun.empty.childClasses)}）`);
      // 作物標示維持原樣：點選有作物的受光格，狀態標籤照常寫作物狀況與陽光說明，且不跟陽光倒數標籤重疊。
      await page.evaluate((tid) => {
        window.MOVE_MS = 30;
        const s = window.__farm.state();
        const tile = s.map.tiles.find((t) => t.id === tid);
        const adj = s.map.tiles.find((t) => Math.abs(t.x - tile.x) + Math.abs(t.y - tile.y) === 1 && window.isWalkable(s, t));
        if (adj) { s.player.tileId = adj.id; s.player.x = adj.x; s.player.y = adj.y; window.__farm.refresh(); }
        window.__farm.setTool('hand');
        window.__farm.clickTile(tid);
      }, tileIds.planted);
      await page.waitForTimeout(800);
      const labelCheck = await page.evaluate(({ src, tid }) => {
        eval(src);
        const label = document.querySelector('[data-audit="tile-state-label"]');
        const mk = document.querySelector('.r40-sun-tile[data-tile-id="' + tid + '"]');
        const secs = mk && mk.querySelector('.r40-sun-secs');
        return {
          text: label && vis(label) ? label.textContent.trim() : '',
          label: label && vis(label) ? ro(label) : null,
          pill: secs ? ro(secs) : null,
        };
      }, { src: HELP, tid: tileIds.planted });
      assert.match(labelCheck.text, /在光裡：生長加速/, `${tag} 第 6 項：選取受光作物的標籤應照常說明陽光效果（實際「${labelCheck.text}」）`);
      assert.ok(labelCheck.label && labelCheck.pill, `${tag} 第 6 項：作物標籤與陽光倒數應同時存在`);
      assert.equal(((a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)))(labelCheck.label, labelCheck.pill), 0, `${tag} 第 6 項：作物標籤不應跟陽光倒數重疊`);
      console.log(`OK ${tag} 第 6 項：陽光標示為淡黃底「☀ ${sun.planted.secsText}」、跟作物標示不重疊、空土格只有陽光標示`);

      /* ---- 第 8 項：收穫祭橫幅獨立一列、不擠壓任務卡 ---- */
      await page.evaluate(() => {
        const s = window.__farm.state(), now = Date.now(), A = window.AdventureAPI;
        A.ensure(s, now);
        s.adventure.r61.festival.unlocked = true;
        s.adventure.r61.festival.startsAt = now - 1000;
        s.adventure.r61.festival.endsAt = now + 240000;
        s.adventure.r61.festival.nextAt = 0;
        s.adventure.r61.festival.completed = false;
        s.adventure.r61.festival.baseline = null;
        window.__farm.refresh(); if (window.FarmWorld) window.FarmWorld.refresh(s);
      });
      await page.waitForTimeout(700);
      const fest = await page.evaluate((src) => {
        eval(src);
        const dock = document.querySelector('#questDock');
        const banner = dock.querySelector('.r61a-festival-banner');
        const title = dock.querySelector('.world-objective-title');
        return {
          dock: ro(dock), banner: banner ? ro(banner) : null, bannerText: banner ? banner.textContent.trim() : '',
          title: title ? ro(title) : null, titleText: title ? title.textContent.trim() : '',
        };
      }, HELP);
      assert.ok(fest.banner, `${tag} 第 8 項：收穫祭進行中應有橫幅`);
      assert.match(fest.bannerText, /收穫祭進行中/, `${tag} 第 8 項：橫幅應寫收穫祭進行中（實際「${fest.bannerText}」）`);
      assert.ok(fest.banner.left >= fest.dock.left - 1 && fest.banner.right <= fest.dock.right + 1, `${tag} 第 8 項：橫幅應留在任務卡寬度內：${JSON.stringify(fest.banner)} vs ${JSON.stringify(fest.dock)}`);
      assert.ok(fest.banner.width >= fest.dock.width * 0.6, `${tag} 第 8 項：橫幅應接近任務卡全寬（橫幅 ${Math.round(fest.banner.width)}／任務卡 ${Math.round(fest.dock.width)}）`);
      assert.ok(fest.title && fest.banner.bottom <= fest.title.top + 2, `${tag} 第 8 項：橫幅應獨立一列在任務內容上方（橫幅底 ${Math.round(fest.banner.bottom)}／標題頂 ${fest.title && Math.round(fest.title.top)}）`);
      // R63B 同步（第 5、7 項）：手機任務卡預設一行、標題單行省略，寬度比例只驗桌機；手機改由 R63 測試驗單行與不重疊
      if (!view.mobile) assert.ok(fest.title.width >= fest.banner.width * 0.8, `${tag} 第 8 項：任務標題不應被擠成窄欄（標題 ${Math.round(fest.title.width)}／橫幅 ${Math.round(fest.banner.width)}）`);
      assert.ok(fest.titleText.length >= 2, `${tag} 第 8 項：任務標題應可讀（實際「${fest.titleText}」）`);
      console.log(`OK ${tag} 第 8 項：橫幅全寬一列在任務卡上方（${Math.round(fest.banner.width)}／${Math.round(fest.dock.width)}）、任務標題寬 ${Math.round(fest.title.width)} 不被擠`);

      /* ---- 第 9 項：手札鄰居好感入口 ---- */
      await page.evaluate(() => {
        const s = window.__farm.state();
        window.NeighborsR61.ensure(s, Date.now());
        s.adventure.r58.favor.child = 2;
        s.storage.items.strawberry = 2;
        window.__farm.refresh();
        window.FarmWorld.openPanel('story');
      });
      await page.waitForTimeout(900);
      const entry = await page.evaluate((src) => {
        eval(src);
        const pane = document.querySelector('.side-pane[data-pane="story"]');
        const btn = pane && pane.querySelector('[data-r62b-neighbors]');
        const body = document.querySelector('.side-panel.world-panel-open .side-body') || document.querySelector('.side-body');
        const firstCard = pane && [...pane.querySelectorAll('.adventure-quest, .r58-card')].find((c) => c.getBoundingClientRect().height > 0);
        return {
          found: !!btn, text: btn ? btn.textContent.trim() : '',
          btn: btn ? ro(btn) : null, body: body ? ro(body) : null,
          firstCardTop: firstCard ? ro(firstCard).top : null,
          inBody: !!(btn && body && ro(btn).top >= ro(body).top - 1 && ro(btn).bottom <= ro(body).bottom + 1),
        };
      }, HELP);
      assert.equal(entry.found, true, `${tag} 第 9 項：手札頂部應有鄰居好感入口`);
      assert.match(entry.text, /鄰居好感/, `${tag} 第 9 項：入口應寫鄰居好感（實際「${entry.text}」）`);
      assert.ok(entry.firstCardTop === null || entry.btn.top <= entry.firstCardTop + 2, `${tag} 第 9 項：入口應在手札最上方（入口頂 ${Math.round(entry.btn.top)}／第一張卡頂 ${entry.firstCardTop && Math.round(entry.firstCardTop)}）`);
      await page.locator('.side-pane[data-pane="story"] [data-r62b-neighbors]').click();
      await page.waitForFunction(() => {
        const sec = document.querySelector('[data-r61b-neighbors]');
        const pane = document.querySelector('.side-pane.sel');
        return !!sec && pane && pane.dataset.pane === 'journal' && sec.querySelectorAll('[data-r61b-neighbor]').length === 4;
      }, null, { timeout: 8000 });
      await page.waitForTimeout(700);
      const neigh = await page.evaluate((src) => {
        eval(src);
        const body = document.querySelector('.side-panel.world-panel-open .side-body') || document.querySelector('.side-body');
        const br = ro(body);
        const cards = [...document.querySelectorAll('[data-r61b-neighbor]')].map((c) => ({ id: c.dataset.r61bNeighbor, text: c.textContent, rect: ro(c), gift: !!c.querySelector('[data-r62b-gift-open], [data-r61b-gift-open]') }));
        const first = cards[0];
        return {
          cards, body: br,
          firstVisible: !!(first && first.rect.top >= br.top - 2 && first.rect.top < br.bottom && first.rect.left >= br.left - 2 && first.rect.right <= br.right + 2),
          giftButtons: document.querySelectorAll('[data-r61b-neighbor] [data-r61b-gift-open]').length,
          storyButtons: document.querySelectorAll('[data-r61b-neighbor] [data-r61b-play], [data-r61b-neighbor] [data-r61b-replay], [data-r61b-neighbor] [data-r61b-locked]').length,
        };
      }, HELP);
      assert.equal(neigh.cards.length, 4, `${tag} 第 9 項：點入口後應看到四位鄰居（實際 ${neigh.cards.length}）`);
      assert.ok(neigh.cards.every((c) => /好感/.test(c.text) && /下一段故事|三段故事/.test(c.text)), `${tag} 第 9 項：每張鄰居卡應有好感與下一段故事：${JSON.stringify(neigh.cards.map((c) => c.text.slice(0, 60)))}`);
      assert.equal(neigh.giftButtons, 4, `${tag} 第 9 項：四位鄰居都應有送禮按鈕（實際 ${neigh.giftButtons}）`);
      assert.ok(neigh.storyButtons >= 4, `${tag} 第 9 項：每位鄰居應有故事按鈕（實際 ${neigh.storyButtons}）`);
      assert.equal(neigh.firstVisible, true, `${tag} 第 9 項：點入口後第一張鄰居卡應直接在可視區：${JSON.stringify(neigh)}`);
      console.log(`OK ${tag} 第 9 項：手札入口點了直接看到四位鄰居（愛心、下一段故事、送禮齊全）`);

      assert.deepEqual(errors, [], `${tag} 頁面錯誤`);
      await ctx.close();

      /* ---- 第 7 項：二選一泡泡不被名牌擋（桌機與手機直式各量一次，獨立新頁面重現對話情境） ---- */
      if ((view.w === 1366 && view.h === 768) || (view.w === 390 && view.h === 844)) {
        const ctx7 = await browser.newContext({ viewport: { width: view.w, height: view.h }, isMobile: view.mobile, hasTouch: view.mobile, serviceWorkers: 'block' });
        const page = await ctx7.newPage();
        const errors7 = []; page.on('pageerror', (e) => errors7.push(String(e)));
        await page.goto(base);
        await page.waitForFunction(() => window.__farm && !document.querySelector('#startupLoading'), null, { timeout: 30000 });
        await page.evaluate(() => { const b = document.querySelector('#worldBegin'); if (b) b.click(); });
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true;
          window.MOVE_MS = 30;
          const s = window.__farm.state();
          const mayor = s.map.tiles.find((t) => t.npc === 'mayor');
          const adj = s.map.tiles.find((t) => Math.abs(t.x - mayor.x) + Math.abs(t.y - mayor.y) === 1 && window.isWalkable(s, t)) || mayor;
          s.player.tileId = adj.id; s.player.x = adj.x; s.player.y = adj.y;
          window.__farm.refresh();
          window.__farm.setTool('hand');
          window.__farm.clickTile(mayor.id);
        });
        await page.waitForFunction(() => !!document.querySelector('.npc-bubble .r60a-story-choices button'), null, { timeout: 20000 });
        await page.waitForTimeout(700);
        const bubble = await page.evaluate((src) => {
          eval(src);
          const box = document.querySelector('.npc-bubble');
          const btns = [...box.querySelectorAll('.r60a-story-choices button')].map((b) => {
            const r = ro(b);
            const hitEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return {
              text: b.textContent.trim(), rect: r,
              pe: getComputedStyle(b).pointerEvents,
              hitIsButton: !!(hitEl && (hitEl === b || b.contains(hitEl))),
              textFits: b.scrollWidth <= b.clientWidth + 1 && b.scrollHeight <= b.clientHeight + 2,
            };
          });
          const plates = [...document.querySelectorAll('.npc-nameplate-near, .qmarker .npc-nameplate, .npc-footname')].filter(vis).map(ro);
          const plateHit = btns.filter((b) => plates.some((p) => inter(b.rect, p) > 0)).length;
          return { z: getComputedStyle(box).zIndex, btns, plateHit, plateCount: plates.length };
        }, HELP);
        assert.equal(bubble.btns.length, 2, `${tag} 第 7 項：二選一泡泡應有兩個選項（實際 ${bubble.btns.length}）`);
        assert.ok(Number(bubble.z) >= 9500, `${tag} 第 7 項：泡泡層級應在名牌之上（z-index ${bubble.z}）`);
        for (const b of bubble.btns) {
          assert.equal(b.pe, 'auto', `${tag} 第 7 項：選項「${b.text}」應可以點（pointer-events=${b.pe}）`);
          assert.equal(b.hitIsButton, true, `${tag} 第 7 項：選項「${b.text}」中心點最上層應是選項本身、不被名牌擋`);
          assert.equal(b.textFits, true, `${tag} 第 7 項：選項「${b.text}」文字應完整可讀`);
        }
        assert.equal(bubble.plateHit, 0, `${tag} 第 7 項：不應有名牌壓住選項（有名牌重疊的選項 ${bubble.plateHit} 個）`);
        await page.locator('.npc-bubble .r60a-story-choices button').first().click({ timeout: 8000 });
        await page.waitForFunction(() => !document.querySelector('.npc-bubble'), null, { timeout: 8000 });
        assert.deepEqual(errors7, [], `${tag} 第 7 項頁面錯誤`);
        console.log(`OK ${tag} 第 7 項：兩個選項都不被名牌擋、文字完整、真的點得到（點完泡泡關閉）`);
        await ctx7.close();
      }
    }
  } finally { await browser.close(); if (server) server.close(); }
  console.log('VERIFIED content R62 layout');
})().catch((e) => { console.error(e); process.exit(1); });
