'use strict';
/* R65 B 線（計畫第 4～8 項）版面量測：
   4 已修好的釣台／野餐桌／花園改用修好外觀、移除「待修」、換成「已修好」標示與完成小徽章；
   5 1366×600 任務卡收合不露半截內容、桌面主線下一步文字不被「收合」鈕蓋住、彈窗開啟時任務卡不留無底浮字；
   6 390×844 頂部標誌完整、資源列可讀；844×390 上方任務列＋下方工具列合計不超過畫面高 35%；
   7 手機收穫祭收合卡一行顯示「祭典 2/3｜剩 8 分」、三個小目標展開才看；右下互動鈕寫出「互動・祭典攤位」；
   8 新存檔下方不再有孤立白色小方塊（場景動作列只剩被隱藏的鈕時整列收起）。
   四種尺寸：1366×768、1366×600、390×844、844×390。
   本機沙箱改走 route 攔截與系統 Chrome（比照 R25／R64）。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5165;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r65-layout');
fs.mkdirSync(TMP, { recursive: true });
process.env.TEMP = TMP; process.env.TMP = TMP; process.env.TMPDIR = TMP;

const { chromium } = require('playwright');

const VIEWS = [
  { w: 1366, h: 768, mobile: false },
  { w: 1366, h: 600, mobile: false },
  { w: 390, h: 844, mobile: true },
  { w: 844, h: 390, mobile: true },
];
const overlapRect = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const HELP = `
  globalThis.ro = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
  globalThis.textRect = (e) => { if (!e || !e.firstChild) return null; const range = document.createRange(); range.selectNodeContents(e); const r = range.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
`;

async function startServer() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, ORIGIN);
    const file = path.resolve(ROOT, '.' + (u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname)));
    const rel = path.relative(ROOT, file);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
    return { server, intercepted: false };
  } catch (e) {
    return { server: null, intercepted: true };
  }
}

async function launchBrowser() {
  const opts = { headless: true, args: ['--no-sandbox'] };
  if (process.env.FARM_TEST_CHROME) { try { return await chromium.launch({ ...opts, executablePath: process.env.FARM_TEST_CHROME }); } catch (e) { /* 下一個 */ } }
  try { return await chromium.launch(opts); } catch (e) { /* 改用系統瀏覽器 */ }
  for (const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (fs.existsSync(p)) { try { return await chromium.launch({ ...opts, executablePath: p }); } catch (e) { /* 下一個 */ } }
  }
  throw new Error('找不到可用的瀏覽器');
}

(async () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r58b.css'), 'utf8');
  assert.match(css, /R65B（第 4 項）/, 'content-r58b.css 應有 R65B 第 4 項規則');
  assert.match(css, /R65B（第 5 項）/, 'content-r58b.css 應有 R65B 第 5 項規則');
  assert.match(css, /R65B（第 6 項）/, 'content-r58b.css 應有 R65B 第 6 項規則');
  assert.match(css, /R65B（第 7 項）/, 'content-r58b.css 應有 R65B 第 7 項規則');
  assert.match(css, /R65B（第 8 項）/, 'content-r58b.css 應有 R65B 第 8 項規則');
  const worldUi = fs.readFileSync(path.join(ROOT, 'src/world-ui.js'), 'utf8');
  assert.match(worldUi, /r65b-site-done/, '已修好的設施應有完成小徽章');
  assert.match(worldUi, /r65b-festival-compact/, '收穫祭橫幅應有收合一行摘要');
  const uiJs = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  assert.match(uiJs, /祭典攤位/, '互動鈕應寫出祭典攤位');

  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    for (const view of VIEWS) {
      const tag = `${view.w}×${view.h}`;
      const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, isMobile: view.mobile, hasTouch: view.mobile, serviceWorkers: 'block' });
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
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(ORIGIN + '/index.html');
      await page.waitForFunction(() => window.__farm && !document.querySelector('#startupLoading'), null, { timeout: 30000 });
      await page.waitForTimeout(1000);
      await page.evaluate(() => { const b = document.querySelector('#worldBegin'); if (b) b.click(); });
      await page.waitForTimeout(900);

      if (!view.mobile) {
        /* ---- 第 4 項：已修好的設施換修好外觀與完成標示 ---- */
        const before = await page.evaluate(() => [...document.querySelectorAll('.world-site')].map((e) => ({ pid: e.dataset.projectId, label: e.querySelector('.world-site-label') ? e.querySelector('.world-site-label').textContent : '' })));
        assert.equal(before.length, 3, `${tag} 第 4 項：地圖上應有三處設施（實際 ${before.length}）`);
        for (const s of before) assert.match(s.label, /待修/, `${tag} 第 4 項：未修好前應標待修（${s.pid}「${s.label}」）`);
        await page.evaluate(() => {
          const s = window.__farm.state(), A = window.AdventureAPI;
          A.ensure(s, Date.now());
          for (const id of ['fishing_dock', 'picnic_table', 'garden']) s.adventure.projects[id] = { restored: true, restoredAt: Date.now() };
          window.__farm.refresh(); if (window.FarmWorld) window.FarmWorld.refresh(s);
        });
        await page.waitForTimeout(700);
        const sites = await page.evaluate(() => [...document.querySelectorAll('.world-site')].map((e) => ({
          pid: e.dataset.projectId, restored: e.dataset.restored, frame: e.dataset.frame || '',
          label: e.querySelector('.world-site-label') ? e.querySelector('.world-site-label').textContent : '',
          badge: !!e.querySelector('.r65b-site-done'),
        })));
        assert.equal(sites.length, 3, `${tag} 第 4 項：修好後地圖上應仍有三處設施`);
        for (const s of sites) {
          assert.equal(s.restored, 'true', `${tag} 第 4 項：${s.pid} 應標記已修好`);
          assert.doesNotMatch(s.label, /待修/, `${tag} 第 4 項：${s.pid} 修好後不應再寫待修（「${s.label}」）`);
          assert.match(s.label, /已修好/, `${tag} 第 4 項：${s.pid} 修好後應有完成標示（「${s.label}」）`);
          assert.ok(s.badge, `${tag} 第 4 項：${s.pid} 修好後應有完成小徽章`);
        }
        const dockFrame = sites.find((s) => s.pid === 'fishing_dock'), picnicFrame = sites.find((s) => s.pid === 'picnic_table');
        assert.match(dockFrame.frame, /_repaired$/, `${tag} 第 4 項：釣台應改用修好圖（實際 ${dockFrame.frame}）`);
        assert.match(picnicFrame.frame, /_repaired$/, `${tag} 第 4 項：野餐桌應改用修好圖（實際 ${picnicFrame.frame}）`);
        console.log(`OK ${tag} 第 4 項：三處設施修好後皆為修好圖／已修好標示，無「待修」`);

        /* ---- 第 5 項：任務卡不截不蓋不殘影 ---- */
        await page.evaluate(() => {
          const s = window.__farm.state(), A = window.AdventureAPI;
          A.ensure(s, Date.now());
          s.adventure.claimed.c1_homecoming = true; s.adventure.quests.c1_homecoming.status = 'claimed';
          s.adventure.claimed.c1_first_harvest = true; s.adventure.quests.c1_first_harvest.status = 'claimed';
          window.__farm.refresh(); if (window.FarmWorld) window.FarmWorld.refresh(s);
          const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true;
        });
        await page.waitForTimeout(700);
        // 收合狀態：所有可見子元素都完整留在卡內
        const folded0 = await page.evaluate(() => document.querySelector('#questDock').className);
        if (!/quest-(auto-)?collapsed|quest-target-collapsed/.test(folded0)) {
          await page.locator("[data-audit='quest-collapse']").click();
          await page.waitForTimeout(400);
        }
        const folded = await page.evaluate((src) => {
          eval(src);
          const box = document.querySelector('#questDock');
          const kids = [...box.children].filter((c) => vis(c)).map((c) => ({ cls: String(c.className).slice(0, 40), r: ro(c) }));
          return { cls: box.className, r: ro(box), scrollH: box.scrollHeight, clientH: box.clientHeight, kids };
        }, HELP);
        assert.match(folded.cls, /quest-(auto-)?collapsed|quest-target-collapsed/, `${tag} 第 5 項：應為收合狀態（實際 ${folded.cls}）`);
        for (const k of folded.kids) {
          assert.ok(k.r.bottom <= folded.r.bottom + 2 && k.r.top >= folded.r.top - 2, `${tag} 第 5 項：收合時「${k.cls}」應完整留在卡內（子 ${Math.round(k.r.top)}~${Math.round(k.r.bottom)}／卡 ${Math.round(folded.r.top)}~${Math.round(folded.r.bottom)}）`);
        }
        console.log(`OK ${tag} 第 5 項：收合任務卡高 ${Math.round(folded.r.height)}px，內容不露半截`);
        // 展開狀態：主線下一步文字不被收合鈕蓋住
        await page.locator("[data-audit='quest-collapse']").click();
        await page.waitForTimeout(400);
        const expanded = await page.evaluate((src) => {
          eval(src);
          const box = document.querySelector('#questDock');
          const btn = box.querySelector("[data-audit='quest-collapse']");
          const next = box.querySelector('.r63a-main-next');
          const nextB = next ? next.querySelector('b') || next : null;
          const title = box.querySelector('.world-objective-title');
          return {
            btn: btn ? ro(btn) : null,
            nextText: nextB ? textRect(nextB) : null, nextTextStr: nextB ? nextB.textContent.trim() : '',
            titleText: title ? textRect(title) : null,
          };
        }, HELP);
        if (expanded.nextText && expanded.btn) {
          assert.equal(overlapRect(expanded.nextText, expanded.btn), 0, `${tag} 第 5 項：主線下一步文字「${expanded.nextTextStr.slice(0, 20)}」不應被收合鈕蓋住`);
        }
        if (expanded.titleText && expanded.btn) {
          assert.equal(overlapRect(expanded.titleText, expanded.btn), 0, `${tag} 第 5 項：任務標題文字不應被收合鈕蓋住`);
        }
        console.log(`OK ${tag} 第 5 項：展開時主線下一步與標題文字不被收合鈕蓋住`);
        // 彈窗開啟：任務卡整張一起退場或保持完整卡片，不留無底浮字
        await page.evaluate(() => { const b = document.querySelector('#settingsBtn'); if (b) b.click(); });
        await page.waitForTimeout(600);
        const ghost = await page.evaluate(() => {
          const dock = document.querySelector('#questDock');
          const title = dock.querySelector('.world-objective-title');
          const ds = getComputedStyle(dock), ts = title ? getComputedStyle(title) : null;
          const bg = ds.backgroundColor;
          const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(bg || '');
          const bgOpaque = !!m && (m[4] === undefined || parseFloat(m[4]) > 0.5);
          return {
            modalShown: !!document.querySelector('.modal.show'),
            dockVis: ds.visibility, dockDisplay: ds.display, titleVis: ts ? ts.visibility : 'none',
            bgOpaque, dockRect: dock.getBoundingClientRect().height,
          };
        });
        assert.ok(ghost.modalShown, `${tag} 第 5 項：應已開啟彈窗`);
        assert.ok(ghost.dockDisplay === 'none' || ghost.dockVis === 'hidden' || ghost.titleVis === 'hidden' || ghost.bgOpaque, `${tag} 第 5 項：彈窗開啟時任務卡應整張退場或保持完整卡片（卡 display=${ghost.dockDisplay}／visibility=${ghost.dockVis}／標題=${ghost.titleVis}／底色不透明=${ghost.bgOpaque}）`);
        assert.ok(!(ghost.dockDisplay !== 'none' && ghost.dockVis === 'hidden' && ghost.titleVis === 'visible'), `${tag} 第 5 項：彈窗開啟時不應只剩任務標題浮字`);
        console.log(`OK ${tag} 第 5 項：彈窗開啟時任務卡無殘影浮字`);
        await page.evaluate(() => { const b = document.querySelector('#settingsClose') || document.querySelector('#settingsOk'); if (b) b.click(); });
        await page.waitForTimeout(400);

        /* ---- 第 8 項：白色小方塊 ---- */
        await page.evaluate(() => { const b = document.querySelector('#questDock [data-world-go]'); if (b) b.click(); });
        await page.waitForTimeout(4000);
        const square = await page.evaluate((src) => {
          eval(src);
          const bar = document.querySelector('#sceneActionBar');
          const barInfo = bar ? { hidden: bar.hidden, r: ro(bar), visibleBtns: [...bar.querySelectorAll('button')].filter((b) => vis(b) && b.getBoundingClientRect().width >= 40).length } : null;
          const strays = [];
          document.querySelectorAll('body *').forEach((e) => {
            const r = e.getBoundingClientRect();
            if (r.width < 4 || r.width > 48 || r.height < 4 || r.height > 48) return;
            if (r.left < 560 || r.left > 800 || r.top < 560 || r.top > 730) return;
            const s = getComputedStyle(e);
            if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return;
            const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(s.backgroundColor || '');
            if (m && +m[1] > 230 && +m[2] > 230 && +m[3] > 220 && (m[4] === undefined || parseFloat(m[4]) > 0.5) && !(e.textContent || '').trim()) {
              strays.push({ id: e.id, cls: String(e.className).slice(0, 50), r: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
            }
          });
          return { barInfo, strays };
        }, HELP);
        if (square.barInfo && !square.barInfo.hidden) {
          assert.ok(square.barInfo.visibleBtns >= 1, `${tag} 第 8 項：場景動作列顯示時應有看得見的按鈕（列 ${Math.round(square.barInfo.r.width)}×${Math.round(square.barInfo.r.height)}）`);
          assert.ok(square.barInfo.r.width >= 50, `${tag} 第 8 項：場景動作列不應縮成小方塊（寬 ${Math.round(square.barInfo.r.width)}）`);
        }
        assert.deepEqual(square.strays, [], `${tag} 第 8 項：畫面下方中央不應有孤立白色小方塊 ${JSON.stringify(square.strays)}`);
        console.log(`OK ${tag} 第 8 項：畫面下方無孤立白色小方塊`);
      }

      if (view.mobile && view.h > view.w) {
        /* ---- 第 6 項（直式）：標誌完整、資源列可讀 ---- */
        const top = await page.evaluate((src) => {
          eval(src);
          const logo = document.querySelector('.farm-logo');
          const header = document.querySelector('header');
          const dock = document.querySelector('#questDock');
          const res = [...document.querySelectorAll('#resBar .res')].map((e) => ({ r: ro(e), sw: e.scrollWidth, cw: e.clientWidth, text: e.textContent.trim().slice(0, 20) }));
          return { iw: innerWidth, logo: logo ? ro(logo) : null, header: header ? ro(header) : null, dock: dock ? ro(dock) : null, res };
        }, HELP);
        assert.ok(top.logo, `${tag} 第 6 項：應有農場標誌`);
        assert.ok(top.logo.left >= 0 && top.logo.right <= top.iw, `${tag} 第 6 項：標誌應完整留在畫面內（${Math.round(top.logo.left)}~${Math.round(top.logo.right)}／${top.iw}）`);
        assert.ok(top.logo.width >= 90, `${tag} 第 6 項：標誌不應被擠扁（寬 ${Math.round(top.logo.width)}）`);
        for (const r of top.res) {
          assert.ok(r.r.left >= 0 && r.r.right <= top.iw, `${tag} 第 6 項：資源「${r.text}」應留在畫面內`);
          assert.ok(r.sw <= r.cw + 2, `${tag} 第 6 項：資源「${r.text}」文字不應被截斷（捲動寬 ${r.sw}／可視寬 ${r.cw}）`);
        }
        if (top.header && top.dock) assert.ok(top.header.bottom <= top.dock.top + 2, `${tag} 第 6 項：頂部列不應蓋住任務卡（頂部底 ${Math.round(top.header.bottom)}／任務卡頂 ${Math.round(top.dock.top)}）`);
        console.log(`OK ${tag} 第 6 項：標誌完整、資源列 ${top.res.length} 項皆可讀`);

        /* ---- 第 7 項：收穫祭一行與互動鈕 ---- */
        await page.evaluate(() => {
          const s = window.__farm.state(), now = Date.now(), A = window.AdventureAPI;
          A.ensure(s, now);
          const f = s.adventure.r61.festival;
          f.unlocked = true; f.startsAt = now - 60000; f.endsAt = now + 8 * 60000 + 30000; f.nextAt = 0; f.completed = false; f.goalsClaimed = false; f.judging = null;
          f.baseline = { tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
          s.adventure.byTarget.harvest.tomato = 3;
          s.adventure.counts.cook = 1;
          window.__farm.refresh(); if (window.FarmWorld) window.FarmWorld.refresh(s);
          const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true;
        });
        await page.waitForTimeout(800);
        const festFoldedCls = await page.evaluate(() => document.querySelector('#questDock').className);
        if (!/quest-(auto-)?collapsed|quest-target-collapsed/.test(festFoldedCls)) {
          await page.locator("[data-audit='quest-collapse']").click();
          await page.waitForTimeout(400);
        }
        const fest = await page.evaluate((src) => {
          eval(src);
          const dock = document.querySelector('#questDock');
          // R82A 同步：手機收合一律顯示人工 short；舊祭典進度摘要只留在展開內容。
          const summary = dock.querySelector('.r69a-festival-now .r82a-guidance-short');
          return { ih: innerHeight, dock: ro(dock), banner: summary && vis(summary) ? ro(summary) : null, bannerText: summary && vis(summary) ? summary.innerText.trim() : '', bannerFull: dock.textContent.trim() };
        }, HELP);
        assert.ok(fest.banner, `${tag} 第 7 項：收穫祭進行中應有橫幅`);
        assert.equal(fest.bannerText, '祭典：去找鄰居', `${tag} 第 7 項：收合時應完整顯示當下 short（實際「${fest.bannerText}」）`);
        assert.doesNotMatch(fest.bannerText, /收成 3 份番茄/, `${tag} 第 7 項：收合時三個小目標應先收起（實際「${fest.bannerText}」）`);
        assert.ok(fest.banner.height <= 34, `${tag} 第 7 項：收合時祭典資訊應只有一行（高 ${Math.round(fest.banner.height)}）`);
        assert.ok(fest.dock.height <= fest.ih * 0.18 + 1, `${tag} 第 7 項：收合任務卡高 ${Math.round(fest.dock.height)} 不應超過畫面 18%`);
        console.log(`OK ${tag} 第 7 項：收合卡一行顯示 short「${fest.bannerText.split('\n')[0]}」`);
        // 展開後才看得到三個小目標
        await page.locator("[data-audit='quest-collapse']").click();
        // R66 整合：整批連跑負載高時 500ms 不夠，改為等到展開內容出現（最多 3 秒），斷言不變
        await page.waitForFunction(() => { const b = document.querySelector('#questDock .r61a-festival-banner'); return b && /收成 3 份番茄/.test(b.innerText); }, null, { timeout: 3000 }).catch(() => {});
        const festOpen = await page.evaluate(() => {
          const banner = document.querySelector('#questDock .r61a-festival-banner');
          return banner ? banner.innerText.trim() : '';
        });
        assert.match(festOpen, /收成 3 份番茄/, `${tag} 第 7 項：展開後應看得到三個小目標（實際「${festOpen.slice(0, 80)}」）`);
        console.log(`OK ${tag} 第 7 項：展開後看得到三個小目標`);
        // 互動鈕寫出對象：把玩家放到祭典攤位旁、面向攤位
        await page.evaluate(() => {
          const s = window.__farm.state();
          const stall = (s.map.tiles || []).find((t) => t.id === 't15_9');
          const under = (s.map.tiles || []).find((t) => stall && t.x === stall.x && t.y === stall.y + 1);
          if (stall && under) { s.player.tileId = under.id; s.player.x = under.x; s.player.y = under.y; s.player.facing = 'up'; }
          window.__farm.refresh(); if (window.FarmWorld) window.FarmWorld.refresh(s);
        });
        await page.waitForTimeout(700);
        const action = await page.evaluate(() => {
          const a = document.querySelector('#actionA');
          return a ? { text: a.textContent.trim(), visible: a.dataset.interactVisible, cls: a.className } : null;
        });
        assert.ok(action, `${tag} 第 7 項：應有右下互動鈕`);
        assert.match(action.text, /祭典攤位/, `${tag} 第 7 項：互動鈕應寫出互動對象（實際「${action.text}」）`);
        assert.equal(action.visible, 'true', `${tag} 第 7 項：站在祭典攤位旁時互動鈕應看得見`);
        console.log(`OK ${tag} 第 7 項：互動鈕顯示「${action.text}」`);
      }

      if (view.mobile && view.w > view.h) {
        /* ---- 第 6 項（橫式）：上方任務列＋下方工具列合計 ≤ 35% ---- */
        const bars = await page.evaluate((src) => {
          eval(src);
          const dock = document.querySelector('#questDock');
          const h = (e) => (e && vis(e) ? ro(e).height : 0);
          const bottoms = ['#farmDock', '.tool-bar', '.side-tabs'].map((sel) => h(document.querySelector(sel)));
          return { ih: innerHeight, quest: h(dock), bottom: Math.max(...bottoms), dockCls: dock ? dock.className : '' };
        }, HELP);
        const total = bars.quest + bars.bottom;
        assert.ok(total <= bars.ih * 0.35 + 1, `${tag} 第 6 項：上方任務列 ${Math.round(bars.quest)}＋下方工具列 ${Math.round(bars.bottom)}＝${Math.round(total)} 超過畫面高 35%（${Math.round(bars.ih * 0.35)}）`);
        console.log(`OK ${tag} 第 6 項：任務列 ${Math.round(bars.quest)}＋工具列 ${Math.round(bars.bottom)}＝${Math.round(total)}px ≤ 35%（${Math.round(bars.ih * 0.35)}px）`);
      }

      assert.deepEqual(errors, [], `${tag} 頁面錯誤`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log('VERIFIED content R65 layout');
})().catch((e) => { console.error(e); process.exit(1); });
