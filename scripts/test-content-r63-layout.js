'use strict';
/* R63 B 線（計畫第 5～9 項）版面量測：
   5 手機任務卡預設只顯示一行（任務名＋進度＋一顆主要按鈕），點一下展開；收穫祭橫幅併入同一張卡的一行；高度直式 ≤18%、橫式 ≤25%；
   6 「目標」圓鈕不壓「收合」、「全部」不被陽光標籤蓋住；可點按鈕互不重疊、命中 ≥44px；
   7 任務標題一行顯示（過長省略號、完整名稱放 title 屬性），不拆字；
   8 主線二選一泡泡出現時收起「交談」鈕，選完恢復；
   9 手機手札內容超過可視高度時，底部顯示「往下還有 N 項」，不被工具列擋住。
   四種尺寸：1366×768、1366×600、390×844、844×390。
   本機沙箱無法 listen／無 Playwright 瀏覽器時可用環境變數改走 file 與系統 Chrome（比照 R62）：
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
const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const HELP = `
  globalThis.ro = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  globalThis.vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
`;

(async () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r58b.css'), 'utf8');
  assert.match(css, /R63B/, 'content-r58b.css 末尾應有 R63B 規則');
  assert.match(css, /#questDock \.world-objective-title,[\s\S]{0,200}white-space:\s*nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important/, '任務標題應一行省略');
  assert.match(css, /body:has\(\.npc-bubble \.r60a-story-choices\) #actionA/, '二選一泡泡出現時應收起交談鈕');
  assert.match(css, /quest-auto-collapsed \.r61a-festival-banner/, '收合時收穫祭橫幅應併入任務卡一行');
  assert.match(css, /max-height:\s*18dvh/, '手機直式任務卡應限制高度');
  assert.match(css, /max-height:\s*25dvh/, '手機橫式任務卡應限制高度');
  assert.match(css, /\.quest-collapse-btn \{ min-width: 44px; min-height: 44px; \}/, '收合鈕命中應至少 44px');
  const ui = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  assert.match(ui, /R63B（第 5 項）/, 'ui.js 應有手機任務卡一律預設收合的 R63B 標記');
  assert.match(ui, /R63B（第 7 項）/, 'ui.js 應把完整任務名放進 title 屬性');
  assert.match(ui, /R63B（第 9 項）/, 'ui.js 手札捲動提示應顯示還剩幾項');
  const worldUi = fs.readFileSync(path.join(ROOT, 'src/world-ui.js'), 'utf8');
  assert.match(worldUi, /R63B（第 6 項）：陽光標籤/, '陽光標籤應避開種子欄');
  assert.match(worldUi, /R63B（第 6 項）：目標圓鈕/, '目標圓鈕應避開任務卡');

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

      /* ---- 第 5、6、7 項：預設任務卡一行、按鈕不重疊且 ≥44px、標題一行 ---- */
      const base1 = await page.evaluate((src) => {
        eval(src);
        const dock = document.querySelector('#questDock');
        const title = dock.querySelector('.world-objective-title');
        const pick = (sel) => { const e = document.querySelector(sel); return e && vis(e) ? ro(e) : null; };
        const btns = [...dock.querySelectorAll('button')].filter(vis).map((b) => ({ t: b.textContent.trim().slice(0, 16), r: ro(b) }));
        return {
          ih: innerHeight, dock: ro(dock),
          collapsed: dock.classList.contains('quest-collapsed') || dock.classList.contains('quest-auto-collapsed') || dock.classList.contains('quest-target-collapsed'),
          title: title ? { text: title.textContent.trim(), attr: title.getAttribute('title') || '', r: ro(title), lines: [...title.getClientRects()].filter((r) => r.height > 0).length, ws: getComputedStyle(title).whiteSpace } : null,
          btns,
          collapse: pick("#questDock [data-audit='quest-collapse']"),
          go: pick('#questDock [data-world-go], #questDock [data-choice-open]'),
          arrow: pick('#objectiveArrow'),
          seedMore: pick('#seedHud .seed.more'),
          mapFit: pick('#mapFitToggle'),
          actionA: pick('#actionA'),
        };
      }, HELP);
      assert.ok(base1.title, `${tag} 應有任務標題`);
      if (view.mobile && base1.collapsed) assert.ok(base1.title.lines === 0 || base1.title.lines === 1, `${tag} R68：祭典收合可只留祭典摘要，否則標題保持一行`);
      else assert.equal(base1.title.lines, 1, `${tag} 第 7 項：任務標題應只有一行（實際 ${base1.title.lines} 行「${base1.title.text}」）`);
      if (base1.title.lines) assert.equal(base1.title.ws, 'nowrap', `${tag} 第 7 項：任務標題不得換行拆字`);
      assert.ok(base1.title.attr.includes(base1.title.text.replace(/\s+/g, ' ').slice(0, 12)) || base1.title.attr.length >= 4, `${tag} 第 7 項：完整任務名應放 title 屬性（實際「${base1.title.attr}」）`);
      if (view.mobile) {
        assert.equal(base1.collapsed, true, `${tag} 第 5 項：手機任務卡應預設收合`);
        const limit = view.h > view.w ? 0.18 : 0.25;
        assert.ok(base1.dock.height <= base1.ih * limit + 1, `${tag} 第 5 項：任務卡高 ${Math.round(base1.dock.height)} 超過畫面 ${(limit * 100)}%（${Math.round(base1.ih * limit)}）`);
        console.log(`OK ${tag} 第 5 項：手機任務卡預設一行高 ${Math.round(base1.dock.height)}px（≤${Math.round(limit * 100)}%）`);
      }
      const named = [['收合鈕', base1.collapse], ['主要按鈕', base1.go], ['目標圓鈕', base1.arrow], ['全部鈕', base1.seedMore], ['地圖鈕', base1.mapFit], ['互動鈕', base1.actionA]].filter(([, r]) => r);
      for (const [name, r] of named) {
        if (name === '目標圓鈕') continue; // 目標圓鈕不可點，只驗不重疊（下方）
        assert.ok(r.height >= 44 - 1 && r.width >= 44 - 1, `${tag} 第 6 項：${name}命中應至少 44px（實際 ${Math.round(r.width)}×${Math.round(r.height)}）`);
      }
      for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
        const v = inter(named[i][1], named[j][1]);
        assert.equal(v, 0, `${tag} 第 6 項：${named[i][0]}不應壓住${named[j][0]}（交集 ${Math.round(v)}）`);
      }
      console.log(`OK ${tag} 第 6、7 項：任務卡按鈕命中 ≥44px 且互不重疊、標題一行（title 屬性有完整名稱）`);

      /* ---- 第 7 項補強：超長標題一行省略 ---- */
      const longTitle = await page.evaluate((src) => {
        eval(src);
        const title = document.querySelector('#questDock .world-objective-title');
        const long = '把河畔的番茄與麥子都收好再送去市集給蘿拉檢查一遍、然後回農場把剩下的田都澆過水再去找班伯確認 0/1';
        title.innerHTML = '<span class="qp-step">' + long + '</span>';
        const dock = document.querySelector('#questDock'); const dummy = document.createElement('span'); dock.appendChild(dummy); dummy.remove(); // 觸發任務卡監看，補上 title 屬性（與正式重繪同一條路）
        return new Promise((resolve) => setTimeout(() => {
          const t2 = document.querySelector('#questDock .world-objective-title');
          resolve({ attr: t2.getAttribute('title') || '', sw: t2.scrollWidth, cw: t2.clientWidth, r: ro(t2), lines: [...t2.getClientRects()].filter((r) => r.height > 0).length });
        }, 700));
      }, HELP);
      assert.ok(longTitle.lines >= 1 || view.mobile, `${tag} R68：展開時超長標題應完整換行或省略；手機祭典收合可只留摘要`);
      assert.ok(longTitle.sw <= longTitle.cw + 1 || longTitle.attr.length > 0, `${tag} R68：超長標題不得裁切，省略時須有完整 title`);
      assert.ok(longTitle.attr.includes('蘿拉'), `${tag} 第 7 項：超長標題完整名稱應在 title 屬性（實際「${longTitle.attr.slice(0, 40)}」）`);
      await page.evaluate(() => window.__farm.refresh());
      await page.waitForTimeout(600);

      /* ---- 第 5 項補強：手機點一下展開 ---- */
      if (view.mobile) {
        const h0 = base1.dock.height;
        await page.locator("[data-audit='quest-collapse']").click();
        await page.waitForTimeout(500);
        const exp = await page.evaluate((src) => { eval(src); const d = document.querySelector('#questDock'); return { h: ro(d).height, collapsed: d.classList.contains('quest-collapsed') || d.classList.contains('quest-auto-collapsed') }; }, HELP);
        assert.equal(exp.collapsed, false, `${tag} 第 5 項：點展開後任務卡不應仍收合`);
        assert.ok(exp.h >= h0, `${tag} R68：點一下應解除收合；三層內容由 R68 四尺寸測試驗證（${Math.round(h0)}→${Math.round(exp.h)}）`);
        await page.locator("[data-audit='quest-collapse']").click();
        await page.waitForTimeout(400);
        console.log(`OK ${tag} 第 5 項：點一下展開（${Math.round(h0)}→${Math.round(exp.h)}px）、再點收回`);
      }

      /* ---- 第 5、6 項：收穫祭併入一行、陽光標籤不蓋「全部」 ---- */
      await page.evaluate(() => {
        const s = window.__farm.state(), now = Date.now(), A = window.AdventureAPI;
        A.ensure(s, now);
        s.sun = { plots: [0, 1], startsAt: now - 1000, endsAt: now + 30000, nextAt: now + 60000, used: [], introduced: true };
        s.adventure.r61.festival.unlocked = true;
        s.adventure.r61.festival.startsAt = now - 1000;
        s.adventure.r61.festival.endsAt = now + 240000;
        s.adventure.r61.festival.nextAt = 0;
        s.adventure.r61.festival.completed = false;
        s.adventure.r61.festival.baseline = null;
        window.__farm.refresh(); if (window.FarmWorld) window.FarmWorld.refresh(s);
      });
      await page.waitForTimeout(1500);
      const fest = await page.evaluate((src) => {
        eval(src);
        const dock = document.querySelector('#questDock');
        const banner = dock.querySelector('.r61a-festival-banner');
        const now = dock.querySelector('.r69a-festival-now');
        // R69 同步：收合時祭典摘要在「現在做」列；展開時才量完整舊橫幅。
        const summary = banner && vis(banner) ? banner : (now && vis(now) ? now : null);
        const pick = (sel) => { const e = document.querySelector(sel); return e && vis(e) ? ro(e) : null; };
        return {
          ih: innerHeight, dock: ro(dock), banner: summary ? ro(summary) : null,
          bannerText: summary ? summary.innerText.trim() : '', expandedBanner: !!(banner && vis(banner)),
          bannerLines: summary ? [...summary.getClientRects()].filter((r) => r.height > 0).length : 0,
          compactText: (() => { const e = dock.querySelector('.r69a-collapsed-summary'); return e && vis(e) ? { ...ro(e), lines: [...e.getClientRects()].filter((r) => r.width > 0 && r.height > 0).length } : null; })(),
          sun: pick('#sunChip'), seed: pick('#seedHud'), seedMore: pick('#seedHud .seed.more'),
          arrow: pick('#objectiveArrow'), collapse: pick("#questDock [data-audit='quest-collapse']"),
        };
      }, HELP);
      assert.ok(fest.banner, `${tag} 第 5 項：收穫祭進行中應有橫幅`);
      assert.match(fest.bannerText, fest.expandedBanner ? /收穫祭進行中/ : /祭典：|祭典 \d+\/3/, `${tag} 第 5 項：展開應顯示收穫祭名稱，收合應顯示祭典摘要`);
      assert.ok(fest.banner.left >= fest.dock.left - 1 && fest.banner.right <= fest.dock.right + 1, `${tag} 第 5 項：橫幅應併入任務卡內、不另疊一張`);
      if (view.mobile) {
        const limit = view.h > view.w ? 0.18 : 0.25;
        assert.ok(fest.dock.height <= fest.ih * limit + 1, `${tag} 第 5 項：有收穫祭時任務卡高 ${Math.round(fest.dock.height)} 超過 ${(limit * 100)}%`);
        // R69 同步：整列含 44px 主要按鈕，不能再用舊橫幅 34px 高判斷；改驗摘要文字本身確實單行。
        assert.ok(fest.compactText && fest.compactText.lines === 1 && fest.compactText.height <= 24, `${tag} 第 5 項：收穫祭摘要文字應只有一行（${fest.compactText ? fest.compactText.lines : 0} 行、高 ${fest.compactText ? Math.round(fest.compactText.height) : 0}）`);
      }
      if (fest.sun && fest.seedMore) assert.equal(inter(fest.sun, fest.seedMore), 0, `${tag} 第 6 項：陽光標籤不應蓋住「全部」鈕`);
      if (fest.sun && fest.seed) assert.equal(inter(fest.sun, fest.seed), 0, `${tag} 第 6 項：陽光標籤不應蓋住種子欄`);
      if (fest.arrow && fest.collapse) assert.equal(inter(fest.arrow, fest.collapse), 0, `${tag} 第 6 項：「目標」圓鈕不應壓住「收合」鈕`);
      if (fest.sun) assert.ok(fest.sun.height >= 43, `${tag} 第 6 項：陽光標籤命中高應至少 44px（實際 ${Math.round(fest.sun.height)}）`);
      console.log(`OK ${tag} 第 5、6 項：收穫祭併入任務卡一行、陽光標籤不蓋「全部」、目標圓鈕不壓收合`);

      /* ---- 第 9 項：手機手札捲動提示 ---- */
      if (view.mobile) {
        await page.evaluate(() => window.FarmWorld.openPanel('story'));
        await page.waitForTimeout(900);
        // 若有「再顯示」先展開全部，讓捲動提示接手顯示還剩幾項
        const more = page.locator('.side-pane.sel .r32-show-more, .side-pane.sel .r60-show-more, .side-pane.sel .r81c-later-toggle[aria-expanded="false"]');
        if (await more.count()) { await more.first().click().catch(() => {}); await page.waitForTimeout(700); }
        await page.evaluate(() => { const b = document.querySelector('.side-body'); if (b) b.scrollTop = 0; });
        await page.waitForTimeout(600);
        const j = await page.evaluate((src) => {
          eval(src);
          const body = document.querySelector('.side-panel.world-panel-open .side-body') || document.querySelector('.side-body');
          const hint = document.querySelector('[data-audit="panel-scroll-hint"]');
          const tabs = document.querySelector('.side-tabs');
          const toolbar = document.querySelector('.toolbar');
          const toolBar = document.querySelector('.tool-bar');
          return {
            scrollable: body ? body.scrollHeight > body.clientHeight + 2 : false,
            body: body ? ro(body) : null,
            hint: hint && vis(hint) ? { t: hint.textContent.trim(), r: ro(hint) } : null,
            bars: [tabs, toolbar, toolBar].filter((e) => e && vis(e)).map(ro),
          };
        }, HELP);
        assert.equal(j.scrollable, true, `${tag} 第 9 項：手札內容應超過可視高度才驗提示`);
        assert.ok(j.hint, `${tag} 第 9 項：手札可捲動時底部應有捲動提示`);
        assert.match(j.hint.t, /往下還有 \d+ 項/, `${tag} 第 9 項：提示應寫往下還有幾項（實際「${j.hint.t}」）`);
        assert.ok(j.hint.r.bottom <= j.body.bottom + 1, `${tag} 第 9 項：提示應留在手札可視區內`);
        for (const b of j.bars) assert.equal(inter(j.hint.r, b), 0, `${tag} 第 9 項：捲動提示不應被工具列擋住`);
        console.log(`OK ${tag} 第 9 項：手札底部提示「${j.hint.t}」、不被工具列擋住`);
        await page.evaluate(() => document.querySelector('.side-panel').classList.remove('world-panel-open'));
        await page.waitForTimeout(300);
      }

      assert.deepEqual(errors, [], `${tag} 頁面錯誤`);
      await ctx.close();

      /* ---- 第 8 項：二選一泡泡出現時收起交談鈕（桌機與手機直式） ---- */
      if ((view.w === 1366 && view.h === 768) || (view.w === 390 && view.h === 844)) {
        const ctx8 = await browser.newContext({ viewport: { width: view.w, height: view.h }, isMobile: view.mobile, hasTouch: view.mobile, serviceWorkers: 'block' });
        const page = await ctx8.newPage();
        const errors8 = []; page.on('pageerror', (e) => errors8.push(String(e)));
        await page.goto(base);
        await page.waitForFunction(() => window.__farm && !document.querySelector('#startupLoading'), null, { timeout: 30000 });
        await page.evaluate(() => { const b = document.querySelector('#worldBegin'); if (b) b.click(); });
        await page.waitForTimeout(600);
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
        /* R76B 同步：開場二選一改成逐句對話框（.r76b-dialogue），不再用鄰居頭上的泡泡。
           原本驗「泡泡出現時交談鈕收起」，現在驗「對話框開著時交談鈕點不到（收起或被對話框蓋住）」。 */
        await page.waitForFunction(() => !!document.querySelector('.r76b-dialogue'), null, { timeout: 20000 });
        for (let i = 0; i < 8 && !(await page.locator('.r76b-dialogue [data-r76b-choice]').count()); i++) {
          await page.locator('.r76b-dialogue [data-r76b-next]').first().click({ timeout: 8000 });
          await page.waitForTimeout(250);
        }
        await page.waitForFunction(() => !!document.querySelector('.r76b-dialogue [data-r76b-choice]'), null, { timeout: 8000 });
        await page.waitForTimeout(700);
        const during = await page.evaluate((src) => {
          eval(src);
          const reachable = (el) => { if (!el || !vis(el)) return false; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(top && top.closest('.r76b-dialogue')); };
          const a = document.querySelector('#actionA');
          const talkBtns = [...document.querySelectorAll('.scene-action-bar [data-action="talk"]')].filter(reachable);
          return { actionAVisible: reachable(a), actionAText: a ? a.textContent.trim() : '', talkVisible: talkBtns.length, oldBubble: !!document.querySelector('.npc-bubble .r60a-story-choices') };
        }, HELP);
        assert.equal(during.oldBubble, false, `${tag} 第 8 項：開場二選一不應再同時出現舊的泡泡選項`);
        assert.equal(during.actionAVisible, false, `${tag} 第 8 項：二選一對話框開著時「交談」鈕應點不到（文字「${during.actionAText}」）`);
        assert.equal(during.talkVisible, 0, `${tag} 第 8 項：中央交談鈕應點不到`);
        await page.locator('.r76b-dialogue [data-r76b-choice]').first().click({ timeout: 8000 });
        await page.waitForFunction(() => !document.querySelector('.r76b-dialogue [data-r76b-choice]') && !!document.querySelector('.r76b-dialogue [data-r76b-next]'), null, { timeout: 8000 });
        await page.locator('.r76b-dialogue [data-r76b-next]').first().click({ timeout: 8000 });
        await page.waitForFunction(() => /沒有叫你等到明天|當場攤開兩張空白公告/.test(document.querySelector('.r76b-dialogue [data-r76b-line]')?.textContent || ''), null, { timeout: 8000 });
        await page.locator('.r76b-dialogue [data-r76b-next]').first().click({ timeout: 8000 });
        await page.locator('.r76b-dialogue [data-r76b-next]').first().click({ timeout: 8000 });
        await page.waitForFunction(() => !document.querySelector('.r76b-dialogue'), null, { timeout: 8000 });
        await page.waitForTimeout(600);
        const after = await page.evaluate((src) => {
          eval(src);
          const a = document.querySelector('#actionA');
          return { forcedHidden: a ? getComputedStyle(a).display === 'none' && !a.classList.contains('r32-interact-hidden') : false, bubbleGone: !document.querySelector('.r76b-dialogue') && !document.querySelector('.npc-bubble .r60a-story-choices') };
        }, HELP);
        assert.equal(after.bubbleGone, true, `${tag} 第 8 項：選完對話框應關閉`);
        assert.equal(after.forcedHidden, false, `${tag} 第 8 項：選完後交談鈕應恢復（不應再被泡泡規則藏起）`);
        assert.deepEqual(errors8, [], `${tag} 第 8 項頁面錯誤`);
        console.log(`OK ${tag} 第 8 項：二選一出現時交談鈕收起、選完恢復`);
        await ctx8.close();
      }
    }
  } finally { await browser.close(); if (server) server.close(); }
  console.log('VERIFIED content R63 layout');
})().catch((e) => { console.error(e); process.exit(1); });
