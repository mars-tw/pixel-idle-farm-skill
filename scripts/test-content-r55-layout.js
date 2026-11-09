'use strict';
/* R55 B 線（第 6～10 項）：手機工具列五格、頂欄精簡、長面板漸層捲動提示、
   橫式可玩區、對話頭像像素顆粒。用 playwright 自架 http server 實測（結束關閉），失敗 exit 1。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5231;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r55-layout');
fs.mkdirSync(TMP, { recursive: true });
process.env.TEMP = TMP; process.env.TMP = TMP; process.env.TMPDIR = TMP;

// ---------- Node：引用、字串與像素規則 ----------
{
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r55b.css'), 'utf8');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  const dockJs = fs.readFileSync(path.join(ROOT, 'src/art-r84.js'), 'utf8');
  assert(idx.includes('src/content-r55b.css'), 'index.html 應引用 content-r55b.css');
  assert(sw.includes('./src/content-r55b.css'), 'sw.js 快取清單應含 content-r55b.css');
  assert(!/url\(|\.png|\.webp|\.jpg/.test(css), 'content-r55b.css 不得新增圖檔');
  assert(css.includes('repeat(5, minmax(56px, 1fr))'), '手機工具列應為五格、每格至少 56px');
  assert(css.includes('#farmDock .tool[aria-label="清除"]'), '清除應移出手機工具列');
  assert(css.includes('#farmDock .tool[aria-label="查看"]'), '查看應移出手機工具列');
  assert(css.includes('linear-gradient'), '捲動提示應有漸層');
  assert(css.includes('.r55-scroll-hint'), '捲動提示應有專屬樣式');
  assert(/\.dialogue-portrait[\s\S]*?image-rendering:\s*pixelated/.test(css), '對話頭像應有 pixelated 規則');
  assert(css.includes('width: 80px'), '對話頭像應以原圖 80px 整數倍顯示');
  assert(css.includes('width: 40px !important'), '矮螢幕對話頭像應以 40px（二分之一）顯示');
  assert(ui.includes('r55-scroll-hint') && ui.includes('r32-show-more') && ui.includes('往下還有'), 'ui.js 應在沒有「再顯示」時才顯示「往下還有」提示');
  assert(dockJs.includes('r55-more-tool') && dockJs.includes('清除') && dockJs.includes('查看'), '「更多」選單應含清除與查看代理鈕');
  console.log('OK Node：content-r55b.css／index／sw 引用與五格、漸層提示、頭像像素規則齊全');
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
  for (const sel of ['#worldBegin', '#worldSunBegin']) {
    const b = page.locator(sel);
    if (await b.count()) { try { await b.click({ timeout: 2500 }); break; } catch (e) {} }
  }
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
    // ---------- 390×844：第 6、7、8、10 項 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 390, 844);
      const tag = '390x844';
      const dock = await page.evaluate((src) => {
        eval(src);
        const btns = [...document.querySelectorAll('#farmDock button')].filter(vis).map((e) => {
          const labelEl = e.querySelector('.tn') || e.querySelector('span:last-child') || e;
          return { text: (e.getAttribute('aria-label') || e.textContent).trim(), r: ro(e), fs: parseFloat(getComputedStyle(e).fontSize), labelFs: parseFloat(getComputedStyle(labelEl).fontSize) };
        });
        return btns;
      }, HELP);
      assert.equal(dock.length, 5, `${tag} 手機工具列應只有五格，實際 ${dock.length}：${dock.map((b) => b.text).join('、')}`);
      for (const need of ['手', '澆水', '建造', '日誌', '更多']) assert(dock.some((b) => b.text.includes(need)), `${tag} 工具列缺「${need}」：${dock.map((b) => b.text).join('、')}`);
      for (const b of dock) {
        assert(b.r.width >= 56, `${tag} 工具格「${b.text}」寬 ${Math.round(b.r.width)}px 小於 56px`);
        assert(b.fs >= 12 && b.labelFs >= 12, `${tag} 工具格「${b.text}」字級 ${b.fs}/${b.labelFs}px 小於 12px`);
      }
      console.log(`OK 第 6 項 ${tag} 工具列五格（${dock.map((b) => b.text.slice(0, 4)).join('、')}），每格寬 ≥56px、字級 ≥12px`);
      await page.locator('#farmMore').click();
      await page.waitForTimeout(350);
      const moreTools = await page.evaluate((src) => {
        eval(src);
        return [...document.querySelectorAll('#farmMenu .r55-more-tool')].filter(vis).map((e) => ({ text: e.textContent.trim(), tool: e.dataset.r55Tool, r: ro(e) }));
      }, HELP);
      assert.equal(moreTools.length, 2, `${tag}「更多」裡應有清除與查看兩鈕，實際 ${JSON.stringify(moreTools)}`);
      assert(moreTools.some((b) => b.tool === 'clear' && b.text.includes('清除')), `${tag}「更多」裡找不到清除`);
      assert(moreTools.some((b) => b.tool === 'inspect' && b.text.includes('查看')), `${tag}「更多」裡找不到查看`);
      await page.locator('.r55-more-tool[data-r55-tool="clear"]').click();
      await page.waitForTimeout(350);
      const selClear = await page.evaluate(() => { const e = document.querySelector('#farmDock .tool[aria-label="清除"]'); return e ? e.classList.contains('sel') : false; });
      assert(selClear, `${tag} 在「更多」點清除後，原工具應被選取`);
      await page.locator('#farmMore').click();
      await page.waitForTimeout(300);
      await page.locator('.r55-more-tool[data-r55-tool="inspect"]').click();
      await page.waitForTimeout(350);
      const selInspect = await page.evaluate(() => { const e = document.querySelector('#farmDock .tool[aria-label="查看"]'); return e ? e.classList.contains('sel') : false; });
      assert(selInspect, `${tag} 在「更多」點查看後，原工具應被選取`);
      console.log(`OK 第 6 項 ${tag}「更多」裡可找到並使用清除與查看`);
      // 第 7 項（直式）：標誌完整、資源一列不超出
      const hdr = await page.evaluate((src) => {
        eval(src);
        const logo = document.querySelector('.farm-logo');
        const res = [...document.querySelectorAll('#resBar .res')].filter(vis).map((e) => ({ t: e.textContent.trim().slice(0, 16), r: ro(e), sw: e.scrollWidth, cw: e.clientWidth }));
        const leaves = [...document.querySelectorAll('#resBar .res *')].filter((e) => e.children.length === 0 && vis(e)).map((e) => ({ t: (e.textContent || '').trim().slice(0, 16), sw: e.scrollWidth, cw: e.clientWidth }));
        return { logo: logo ? { r: ro(logo), complete: logo.complete, nw: logo.naturalWidth } : null, res, leaves, vw: innerWidth };
      }, HELP);
      assert(hdr.logo && hdr.logo.complete && hdr.logo.r.left >= 0 && hdr.logo.r.right <= hdr.vw, `${tag} 標誌未完整顯示：${JSON.stringify(hdr.logo)}`);
      assert.equal(hdr.res.length, 4, `${tag} 資源列應有金幣、等級、背包、材料四項，實際 ${hdr.res.length}`);
      assert(new Set(hdr.res.map((x) => Math.round(x.r.top))).size === 1, `${tag} 資源列不是一列：${JSON.stringify(hdr.res.map((x) => Math.round(x.r.top)))}`);
      for (const x of hdr.res) assert(x.r.left >= 0 && x.r.right <= hdr.vw && x.sw <= x.cw + 1, `${tag} 資源「${x.t}」超出畫面或被截斷：${JSON.stringify(x)}`);
      for (const x of hdr.leaves) if (x.t) assert(x.sw <= x.cw + 1, `${tag} 資源子文字「${x.t}」被截斷：${x.sw}>${x.cw}`);
      console.log(`OK 第 7 項 ${tag} 標誌完整（寬 ${Math.round(hdr.logo.r.width)}px）、資源四項一列不超出畫面`);
      // 第 8 項：訂單面板（無「再顯示」）應有漸層提示，捲到底消失；升級面板有「再顯示」時不得同時出現
      // R55 整合：A 線把市集預告縮成一張後，訂單面板不一定可捲動；改為依序找第一個可捲動且沒有「再顯示」的面板驗證提示
      const measurePane = (src) => {
        eval(src);
        const body = document.querySelector('.side-panel.world-panel-open .side-body');
        const hint = document.querySelector('[data-audit="panel-scroll-hint"]');
        return { scrollable: body ? body.scrollHeight > body.clientHeight + 2 : false, hasMore: !!document.querySelector('.side-pane.sel .r32-show-more'), hint: hint && vis(hint) ? { text: hint.textContent.trim(), bg: getComputedStyle(hint).backgroundImage } : null };
      };
      let ord = null;
      for (const tab of ['orders', 'story', 'journal', 'upgrades']) {
        await page.evaluate((t) => { document.querySelector('.side-panel').classList.remove('world-panel-open'); window.FarmWorld.openPanel(t); }, tab);
        await page.waitForTimeout(700);
        const m = await page.evaluate(measurePane, HELP);
        if (m.scrollable && !m.hasMore) { ord = m; break; }
      }
      assert(ord && ord.scrollable, `${tag} 應至少有一個可捲動且無「再顯示」的面板可驗提示`);
      assert.equal(ord.hasMore, false, `${tag} 訂單面板不應有「再顯示」才驗漸層提示`);
      assert(ord.hint && ord.hint.text.includes('往下還有'), `${tag} 長面板未顯示「往下還有」提示：${JSON.stringify(ord)}`);
      assert(ord.hint.bg.includes('gradient'), `${tag} 捲動提示應有漸層：${ord.hint.bg}`);
      console.log(`OK 第 8 項 ${tag} 訂單長面板顯示漸層「往下還有」提示`);
      await page.evaluate(() => { const b = document.querySelector('.side-panel.world-panel-open .side-body'); if (b) b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(450);
      const ordBottom = await page.evaluate((src) => { eval(src); const h = document.querySelector('[data-audit="panel-scroll-hint"]'); return h ? vis(h) : false; }, HELP);
      assert.equal(ordBottom, false, `${tag} 捲到底後「往下還有」提示應消失`);
      console.log(`OK 第 8 項 ${tag} 捲到底後提示消失`);
      await page.evaluate(() => document.querySelector('.side-panel').classList.remove('world-panel-open'));
      await page.waitForTimeout(300);
      await page.evaluate(() => { const s = window.__farm.state(); window.AdventureAPI.ensure(s, Date.now()); s.adventure.claimed.c1_first_harvest = true; window.__farm.refresh(); window.FarmWorld.openPanel('upgrades'); });
      await page.waitForTimeout(700);
      const up = await page.evaluate((src) => {
        eval(src);
        const hint = document.querySelector('[data-audit="panel-scroll-hint"]');
        return { hasMore: !!document.querySelector('.side-pane.sel .r32-show-more'), hintVisible: hint ? vis(hint) : false };
      }, HELP);
      if (up.hasMore) assert.equal(up.hintVisible, false, `${tag} 有「再顯示 N 項」時不得同時出現「往下還有」`);
      console.log(`OK 第 8 項 ${tag} 升級面板有「再顯示」時不出現「往下還有」（hasMore=${up.hasMore}）`);
      await page.evaluate(() => document.querySelector('.side-panel').classList.remove('world-panel-open'));
      await page.waitForTimeout(300);
      // 第 10 項
      await page.evaluate(() => window.FarmWorld.speak('葛瑞', '收成先留一籃，別全拿去賣。'));
      await page.waitForFunction(() => document.querySelector('.dialogue-portrait'), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      const dlg = await page.evaluate(() => { const img = document.querySelector('.dialogue-portrait'); if (!img) return null; const r = img.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), nw: img.naturalWidth, ir: getComputedStyle(img).imageRendering }; });
      assert(dlg, `${tag} 對話頭像不存在`);
      assert.equal(dlg.ir, 'pixelated', `${tag} 對話頭像 image-rendering 應為 pixelated，實際 ${dlg.ir}`);
      assert(dlg.nw % dlg.w === 0 || dlg.w % dlg.nw === 0, `${tag} 對話頭像非整數倍縮放：原圖 ${dlg.nw}／顯示 ${dlg.w}`);
      console.log(`OK 第 10 項 ${tag} 對話頭像 pixelated、原圖 ${dlg.nw}px 以 ${dlg.w}px 整數倍顯示`);
      await ctx.close();
    }
    // ---------- 844×390：第 7、9、10 項 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 844, 390);
      const tag = '844x390';
      const hdr = await page.evaluate((src) => {
        eval(src);
        const logo = document.querySelector('.farm-logo');
        const res = [...document.querySelectorAll('#resBar .res')].filter(vis).map((e) => ({ t: e.textContent.trim().slice(0, 16), r: ro(e), sw: e.scrollWidth, cw: e.clientWidth }));
        return { logo: logo ? { r: ro(logo), complete: logo.complete } : null, res, vw: innerWidth };
      }, HELP);
      assert(hdr.logo && hdr.logo.complete && hdr.logo.r.right <= hdr.vw, `${tag} 標誌未完整顯示`);
      assert.equal(hdr.res.length, 4, `${tag} 資源列應有四項`);
      assert(new Set(hdr.res.map((x) => Math.round(x.r.top))).size === 1, `${tag} 資源列不是一列`);
      for (const x of hdr.res) assert(x.r.right <= hdr.vw && x.sw <= x.cw + 1, `${tag} 資源「${x.t}」超出或被截斷`);
      console.log(`OK 第 7 項 ${tag} 標誌完整、資源四項一列不超出畫面`);
      // 種子卡：先照主線談完開場（ claimed 第一關）走到播種步驟，種子列才會展開
      await page.evaluate(() => { const s = window.__farm.state(); if (s.adventure.byTarget) s.adventure.byTarget.talk = { mayor: 1 }; if (s.adventure.counts) { s.adventure.counts.plant = 0; s.adventure.counts.water = 0; } if (s.stats) { s.stats.plantCount = 0; s.stats.waterCount = 0; } (s.plots || []).forEach((p) => { if (p) { p.cropId = null; delete p.plantedAt; delete p.wateredAt; } }); window.__farm.refresh(); });
      await page.waitForTimeout(900);
      await page.waitForTimeout(600);
      const seeds = await page.evaluate((src) => {
        eval(src);
        return [...document.querySelectorAll('#seedHud .seed')].filter(vis).map((e) => {
          const sn = e.querySelector('.sn'), sc = e.querySelector('.sc');
          return { t: e.textContent.trim().slice(0, 24), r: ro(e), sn: sn ? { t: sn.textContent.trim(), sw: sn.scrollWidth, cw: sn.clientWidth } : null, sc: sc ? { t: sc.textContent.trim(), sw: sc.scrollWidth, cw: sc.clientWidth } : null };
        });
      }, HELP);
      assert(seeds.length >= 2, `${tag} 種子卡應至少有作物卡與「全部」，實際 ${JSON.stringify(seeds.map((s) => s.t))}`);
      assert(seeds.some((s) => s.t.includes('全部')), `${tag} 種子卡缺「全部」`);
      const cropSeed = seeds.find((s) => s.sc && /金/.test(s.sc.t));
      assert(cropSeed, `${tag} 找不到帶價格的種子卡：${JSON.stringify(seeds)}`);
      for (const s of seeds) {
        assert(s.r.left >= 0 && s.r.right <= 844, `${tag} 種子卡「${s.t}」超出畫面：${JSON.stringify(s.r)}`);
        if (s.sn) assert(s.sn.sw <= s.sn.cw + 1, `${tag} 種子名稱「${s.sn.t}」被截斷：${s.sn.sw}>${s.sn.cw}`);
        if (s.sc) assert(s.sc.sw <= s.sc.cw + 1, `${tag} 種子價格「${s.sc.t}」被截斷：${s.sc.sw}>${s.sc.cw}`);
      }
      console.log(`OK 第 7 項 ${tag} 種子卡名稱「${cropSeed.sn ? cropSeed.sn.t : cropSeed.t}」、價格「${cropSeed.sc.t}」與「全部」完整顯示（共 ${seeds.length} 張可見）`);
      // 第 9 項
      await page.evaluate(() => { const s = window.__farm.state(); const elder = s.map.tiles.find((t) => t.npc === 'elder'); window.__farm.clickTile(elder.id); });
      await page.waitForFunction(() => !window.__farm.moving(), null, { timeout: 30000 });
      await page.waitForTimeout(700);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; });
      const land = await page.evaluate((src) => {
        eval(src);
        const pick = (sel) => [...document.querySelectorAll(sel)].filter(vis).map(ro)[0] || null;
        const header = pick('header'), quest = pick('#questDock'), seed = pick('#seedHud'), dock = pick('#farmDock');
        const actionA = pick('#actionA');
        const npcs = [...document.querySelectorAll('.ob[data-kind="npc"]')].filter(vis).map(ro);
        const plots = [...document.querySelectorAll('.gtile.farm-plot')].filter(vis).map(ro);
        const builds = [...document.querySelectorAll('.ob[data-kind="building"], .ob[data-kind="structure"]')].filter(vis).map(ro);
        const dpad = [...document.querySelectorAll('.dpad-btn')].filter(vis).map(ro);
        const topCluster = [header, quest, seed].filter(Boolean);
        const bottomCluster = [dock, actionA, ...dpad].filter(Boolean);
        const topBottom = Math.max(...topCluster.map((r) => r.bottom));
        const bottomTop = Math.min(...bottomCluster.map((r) => r.top));
        const vs = (rs) => actionA ? Math.max(0, ...rs.map((r) => inter(actionA, r))) : 0;
        return { dock, actionA, central: (bottomTop - topBottom) / innerHeight, vsPlots: vs(plots), vsNpcs: vs(npcs), vsBuilds: vs(builds) };
      }, HELP);
      assert(land.dock && land.dock.height <= 52, `${tag} 工具列高 ${land.dock ? Math.round(land.dock.height) : '無'}px 超過 52px`);
      assert(land.actionA, `${tag} 互動鈕應可見`);
      assert.equal(land.vsPlots, 0, `${tag} 互動鈕蓋住田格（交集 ${land.vsPlots}px）`);
      assert.equal(land.vsNpcs, 0, `${tag} 互動鈕蓋住 NPC（交集 ${land.vsNpcs}px）`);
      assert.equal(land.vsBuilds, 0, `${tag} 互動鈕蓋住建物（交集 ${land.vsBuilds}px）`);
      assert(land.central >= 0.55, `${tag} 中央可操作區 ${(land.central * 100).toFixed(1)}% 未達 55%`);
      console.log(`OK 第 9 項 ${tag} 工具列高 ${Math.round(land.dock.height)}px ≤52、互動鈕不蓋田／NPC／建物、中央可操作區 ${(land.central * 100).toFixed(1)}% ≥55%`);
      await page.evaluate(() => window.FarmWorld.speak('祖母', '回來了就好，先坐下吃點東西。'));
      await page.waitForTimeout(400);
      const dlg2 = await page.evaluate(() => { const img = document.querySelector('.dialogue-portrait'); if (!img) return null; const r = img.getBoundingClientRect(); return { w: Math.round(r.width), nw: img.naturalWidth, ir: getComputedStyle(img).imageRendering }; });
      assert(dlg2 && dlg2.ir === 'pixelated' && (dlg2.nw % dlg2.w === 0 || dlg2.w % dlg2.nw === 0), `${tag} 祖母頭像應 pixelated 且整數倍：${JSON.stringify(dlg2)}`);
      console.log(`OK 第 10 項 ${tag} 祖母頭像 pixelated、原圖 ${dlg2.nw}px 以 ${dlg2.w}px 整數倍顯示`);
      await ctx.close();
    }
    console.log('VERIFIED test-content-r55-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : `（http://127.0.0.1:${PORT}）`));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
