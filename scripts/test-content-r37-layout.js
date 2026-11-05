'use strict';
/* R37 B 線（第 6～10 項）：UI 不蓋田（四步驟）、角色不疊、建造占地預覽、
   手機 HUD、場景清理。用 node 先驗站位與字串，再以 playwright 實量。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5199;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r37', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const TMP = path.join(ROOT, '.tmp-r37-layout');
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(SHOT_DIR, { recursive: true });
process.env.TEMP = TMP; process.env.TMP = TMP; process.env.TMPDIR = TMP;

// ---------- Node：第 7 項站位、第 6／8／9／10 項字串與引用 ----------
{
  const S = require('../src/state');
  const G = require('../src/game');
  const s = S.defaultState(100000);
  const elder = s.map.tiles.find((t) => t.npc === 'elder');
  assert(elder, '應有老農班伯 NPC 格');
  const plan = G.planMoveTo(s, elder.id);
  assert(plan, '老農班伯應可抵達');
  const stand = G.getTileById(s, plan.standId);
  assert(stand && stand.id !== elder.id, '玩家不得停在 NPC 本人格');
  assert.equal(Math.abs(stand.x - elder.x) + Math.abs(stand.y - elder.y), 1, `玩家應停在班伯相鄰格，實際 ${stand.id}`);
  assert.equal(stand.y, elder.y, `玩家應優先停在班伯左右相鄰格，實際 ${stand.id} 對 ${elder.id}`);
  assert.equal(G.isWalkable(s, stand), true, 'NPC 相鄰站位應可站立');
  console.log('OK 第 7 項（Node）玩家停在班伯左右相鄰格 ' + stand.id + '，不與 NPC 同格');

  const css = fs.readFileSync(path.join(ROOT, 'src/content-r37b.css'), 'utf8');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert(idx.includes('src/content-r37b.css'), 'index.html 應引用 content-r37b.css');
  assert(sw.includes('./src/content-r37b.css'), 'sw.js 快取清單應含 content-r37b.css');
  assert(/body:not\(\[data-quest-step="plant"\]\)[^{]*\.seed:not\(\.more\)/.test(css), '非播種步驟種子欄應收合');
  assert(css.includes('.build-preview.is-ok') && css.includes('.build-preview.is-blocked'), '建造預覽應有可放／不可放兩種狀態');
  assert(/\.ob\[data-object="stump"\]\s*\{\s*filter:\s*(none|drop-shadow\(0 1px 1px rgba\(31, 42, 24, \.0?5\))/.test(css), '樹樁暈影應降到幾乎看不出來');
  assert(/\.npc-nameplate-near\s*\{\s*z-index:\s*9600/.test(css), 'NPC 名牌應抬到建物之上');
  assert(css.includes('font-size: 11px'), '手機底部工具列文字應至少 11px');
  console.log('OK 第 6／8／9／10 項（Node）CSS 規則與 index／sw 引用齊全');
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
async function applyStep(page, kind) {
  await page.evaluate((k) => {
    const s = window.__farm.state();
    s.adventure.claimed = {};
    s.adventure.byTarget = s.adventure.byTarget || {};
    s.adventure.byTarget.talk = { mayor: 1 };
    s.adventure.counts = s.adventure.counts || {};
    s.inventory = s.inventory || {};
    const plotTile = s.map.tiles.find((t) => t.plotIndex === 0);
    if (k === 'plant') {
      s.adventure.counts.plant = 0; s.adventure.counts.water = 0;
      for (let i = 0; i < 3; i++) { s.plots[i].cropId = null; delete s.plots[i].wateredAt; }
    } else if (k === 'water') {
      s.adventure.counts.plant = 3; s.adventure.counts.water = 0;
      for (let i = 0; i < 3; i++) { s.plots[i].cropId = 'wheat'; s.plots[i].plantedAt = Date.now() - 60 * 1000; delete s.plots[i].wateredAt; }
    } else if (k === 'harvest') {
      s.adventure.claimed = { c1_homecoming: true };
      s.adventure.counts.harvest = 0;
      for (let i = 0; i < 3; i++) { s.plots[i].cropId = 'wheat'; s.plots[i].plantedAt = Date.now() - 30 * 60 * 1000; delete s.plots[i].wateredAt; }
      s.inventory.wheat = 6;
    } else if (k === 'claim') {
      s.adventure.claimed = { c1_homecoming: true };
      s.adventure.counts.harvest = 6;
      s.adventure.byTarget.harvest = { wheat: 6 };
      for (let i = 0; i < 3; i++) { s.plots[i].cropId = 'wheat'; s.plots[i].plantedAt = Date.now() - 30 * 60 * 1000; delete s.plots[i].wateredAt; }
      s.inventory.wheat = 6;
      s.storage = s.storage || {}; s.storage.items = s.storage.items || {}; s.storage.items.wheat = 6;
    }
    window.__farm.refresh();
    window.__farm.focusTile(plotTile.id);
  }, kind);
  await page.waitForTimeout(1300);
}
async function measureStep(page, tag, expected) {
  const m = await page.evaluate((src) => {
    eval(src);
    const plots = [...document.querySelectorAll('.gtile.farm-plot')].filter(vis)
      .filter((e) => { const r = ro(e); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; })
      .map((e) => ({ id: e.dataset.tileId, r: ro(e) }));
    const huds = {};
    for (const [name, sel] of [['任務列', '#questDock'], ['種子欄', '#seedHud'], ['全部鈕', '#seedHud .seed.more']]) {
      const e = document.querySelector(sel);
      if (e && vis(e)) huds[name] = ro(e);
    }
    const overlaps = [];
    for (const t of plots) for (const [name, r] of Object.entries(huds)) { const v = inter(t.r, r); if (v > 0) overlaps.push(`${t.id} 被${name}蓋 ${Math.round(v)}px`); }
    const seedChips = [...document.querySelectorAll('#seedHud .seed:not(.more)')].filter(vis).length;
    const moreVisible = !!document.querySelector('#seedHud .seed.more') && vis(document.querySelector('#seedHud .seed.more'));
    return { step: document.body.dataset.questStep || '', plots: plots.length, overlaps, seedChips, moreVisible };
  }, HELP);
  assert.equal(m.step, expected, `${tag} 步驟應為 ${expected}，實際 ${m.step || '未標記'}`);
  assert(m.plots >= 3, `${tag} ${expected} 可視田格太少（${m.plots}）`);
  assert.deepEqual(m.overlaps, [], `${tag} ${expected} 田格被 HUD 蓋住：${m.overlaps.join('；')}`);
  if (expected === 'plant') assert(m.seedChips >= 1, `${tag} 播種步驟種子欄應展開，實際展開種子 ${m.seedChips}`);
  else assert.equal(m.seedChips, 0, `${tag} ${expected} 非播種步驟種子欄應只留小按鈕，實際仍展開 ${m.seedChips} 顆種子`);
  console.log(`OK 第 6 項 ${tag} ${expected}：${m.plots} 格田與任務列／種子欄／全部鈕交集 0，種子展開 ${m.seedChips}`);
  return m;
}
(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    for (const [w, h] of [[1366, 768], [1366, 600]]) {
      const tag = `${w}x${h}`;
      const { ctx, page } = await newPage(browser, intercepted, w, h);
      for (const step of ['plant', 'water', 'harvest', 'claim']) {
        await applyStep(page, step);
        await measureStep(page, tag, step);
      }
      await page.screenshot({ path: path.join(SHOT_DIR, `steps-${tag}.png`) });

      // ---------- 第 7＋10 項：走到班伯、精靈交集、名牌不被房子蓋 ----------
      await page.evaluate(() => { const s = window.__farm.state(); const e = s.map.tiles.find((t) => t.npc === 'elder'); window.__farm.clickTile(e.id); });
      await page.waitForFunction(() => !window.__farm.moving(), null, { timeout: 30000 });
      await page.waitForTimeout(900);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; });
      const npc = await page.evaluate((src) => {
        eval(src);
        const ps = document.querySelector('#playerSprite') || document.querySelector('#player');
        const ns = document.querySelector('.ob[data-kind="npc"][data-npc="elder"]');
        const plate = document.querySelector('[data-audit="npc-nameplate"][data-npc="elder"], [data-audit="quest-npc-nameplate"][data-npc="elder"]');
        const pr = ps ? ro(ps) : null, nr = ns ? ro(ns) : null;
        const s = window.__farm.state();
        const pt = s.map.tiles.find((t) => t.id === s.player.tileId);
        const et = s.map.tiles.find((t) => t.npc === 'elder');
        let plateRect = null, plateStructOverlap = 0;
        if (plate && vis(plate)) {
          plateRect = ro(plate);
          for (const st of document.querySelectorAll('.ob[data-kind="structure"]')) { if (vis(st)) plateStructOverlap = Math.max(plateStructOverlap, inter(plateRect, ro(st))); }
        }
        return { pr, nr, inter: pr && nr ? inter(pr, nr) : null, minArea: pr && nr ? Math.min(pr.width * pr.height, nr.width * nr.height) : 0,
          playerTile: s.player.tileId, elderTile: et.id, dx: Math.abs(pt.x - et.x), dy: Math.abs(pt.y - et.y),
          plate: plateRect ? { z: getComputedStyle(plate).zIndex, structOverlap: plateStructOverlap, cls: plate.className } : null };
      }, HELP);
      assert(npc.pr && npc.nr, `${tag} 玩家或班伯精靈圖不存在`);
      assert.equal(npc.dx + npc.dy, 1, `${tag} 玩家應停在班伯相鄰格，實際 ${npc.playerTile} 對 ${npc.elderTile}`);
      const ratio = npc.minArea ? npc.inter / npc.minArea : 1;
      assert(ratio <= 0.10, `${tag} 玩家與班伯精靈圖交集 ${(ratio * 100).toFixed(1)}% 超過 10%（${Math.round(npc.inter)}px）`);
      assert(npc.plate, `${tag} 班伯名牌不存在`);
      assert.equal(npc.plate.structOverlap, 0, `${tag} 班伯名牌被房子蓋住（與建物交集 ${npc.plate.structOverlap}px）：${JSON.stringify(npc.plate)}`);
      console.log(`OK 第 7 項 ${tag} 玩家停 ${npc.playerTile}（班伯 ${npc.elderTile} 相鄰），精靈交集 ${(ratio * 100).toFixed(1)}% ≤ 10%；名牌在最上層`);
      await page.screenshot({ path: path.join(SHOT_DIR, `elder-${tag}.png`) });

      // ---------- 第 8 項：建造占地預覽 ----------
      const tileIds = await page.evaluate(() => {
        const s = window.__farm.state();
        s.coins = 200; s.level = Math.max(s.level, 3); s.materials = s.materials || {}; s.materials.wood = 20; s.materials.stone = 20;
        window.__farm.refresh();
        window.__farm.setTool('build');
        const btn = document.querySelector('#buildWheel [data-type="compostHeap"]');
        if (btn && !btn.disabled) btn.click();
        const inView = (t) => { const e = document.querySelector('.gtile[data-tile-id="' + t.id + '"]'); if (!e) return false; const r = e.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; };
        const empty = s.map.tiles.find((t) => t.terrain === 'grass' && !t.object && !t.buildingId && !t.structureId && !t.blocked && !t.station && !t.npc && t.plotIndex == null && inView(t));
        const plot = s.map.tiles.find((t) => t.plotIndex === 0);
        return { empty: empty ? empty.id : null, plot: plot ? plot.id : null };
      });
      assert(tileIds.empty && tileIds.plot, `${tag} 找不到空地或田格供建造預覽量測`);
      await page.waitForTimeout(500);
      async function previewAt(tileId) {
        await page.evaluate((id) => window.__farm.focusTile(id), tileIds[tileId]);
        await page.waitForTimeout(700);
        const c = await page.evaluate((id) => { const e = document.querySelector('.gtile[data-tile-id="' + id + '"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, tileIds[tileId]);
        assert(c, `${tag} 田格 ${tileId} 不在畫面`);
        await page.mouse.move(c.x, c.y);
        await page.waitForTimeout(450);
        return page.evaluate((src) => {
          eval(src);
          const e = document.querySelector('[data-audit="build-preview"]');
          if (!e || !vis(e)) return null;
          const cs = getComputedStyle(e);
          return { state: e.dataset.state || '', cls: e.className, tileId: e.dataset.tileId || '', text: e.textContent.trim(), border: cs.borderTopColor, bg: cs.backgroundColor, r: ro(e) };
        }, HELP);
      }
      const okP = await previewAt('empty');
      assert(okP, `${tag} 空地上建造預覽未出現`);
      assert.equal(okP.state, 'ok', `${tag} 空地預覽應為可放（ok），實際 ${okP.state}／${okP.cls}`);
      assert(/花費 .+・剩 .+/.test(okP.text), `${tag} 空地預覽應顯示「花費 X・剩 Y」，實際「${okP.text}」`);
      const badP = await previewAt('plot');
      assert(badP, `${tag} 田格上建造預覽未出現`);
      assert.equal(badP.state, 'blocked', `${tag} 田格預覽應為不可放（blocked），實際 ${badP.state}／${badP.cls}`);
      assert(/花費 .+・剩 .+/.test(badP.text), `${tag} 不可放預覽應顯示「花費 X・剩 Y」，實際「${badP.text}」`);
      assert.notEqual(okP.border, badP.border, `${tag} 可放與不可放預覽顏色應不同（${okP.border}／${badP.border}）`);
      console.log(`OK 第 8 項 ${tag} 空地預覽 ${okP.state}（${okP.text}）、田格預覽 ${badP.state}（${badP.text}），顏色不同`);
      await page.screenshot({ path: path.join(SHOT_DIR, `build-${tag}.png`) });
      await page.evaluate(() => window.__farm.setTool('hand'));
      await ctx.close();
    }

    // ---------- 第 9＋10 項：手機 ----------
    {
      const { ctx, page } = await newPage(browser, intercepted, 844, 390);
      const tag = '844x390';
      const res = await page.evaluate((src) => {
        eval(src);
        const bar = document.querySelector('header .res-bar') || document.querySelector('#resBar');
        const items = bar ? [...bar.querySelectorAll('.res')].filter(vis) : [];
        if (!bar || !items.length) return null;
        const br = ro(bar);
        const first = ro(items[0]), last = ro(items[items.length - 1]);
        return { bar: br, span: last.right - first.left, blank: br.width - (last.right - first.left), count: items.length };
      }, HELP);
      assert(res, `${tag} 資源列不存在`);
      assert(res.blank <= 28, `${tag} 資源列留白 ${Math.round(res.blank)}px 太大（列寬 ${Math.round(res.bar.width)}／內容 ${Math.round(res.span)}）`);
      console.log(`OK 第 9 項 ${tag} 資源列依內容縮短，留白 ${Math.round(res.blank)}px（${res.count} 格）`);
      const stump = await page.evaluate(() => { const e = document.querySelector('.ob[data-object="stump"]'); return e ? getComputedStyle(e).filter : null; });
      if (stump !== null) { const a = (stump.match(/rgba\([^)]*?,\s*([\d.]+)\)/) || [])[1]; assert(stump === 'none' || (a !== undefined && parseFloat(a) <= 0.05), `${tag} 樹樁仍有深色暈影（filter: ${stump}）`); }
      console.log(`OK 第 10 項 ${tag} 樹樁暈影 filter=${stump === null ? '（畫面外，未量到）' : stump}`);
      await page.screenshot({ path: path.join(SHOT_DIR, 'mobile-844x390.png') });
      await ctx.close();
    }
    {
      const { ctx, page } = await newPage(browser, intercepted, 390, 844);
      const tag = '390x844';
      const fonts = await page.evaluate(() => {
        const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
        const out = [];
        for (const sel of ['.toolbar .btn', '.side-tabs .side-tab', '.tool-bar .tool']) {
          for (const e of document.querySelectorAll(sel)) {
            if (!vis(e) || !e.textContent.trim()) continue;
            const r = e.getBoundingClientRect();
            if (r.bottom < innerHeight * 0.55) continue;
            out.push({ sel, text: e.textContent.trim().slice(0, 10), size: parseFloat(getComputedStyle(e).fontSize) });
          }
        }
        return out;
      });
      assert(fonts.length >= 3, `${tag} 底部工具列可量測按鈕太少（${fonts.length}）`);
      for (const f of fonts) assert(f.size >= 11, `${tag} 底部工具列「${f.text}」（${f.sel}）文字 ${f.size}px 小於 11px`);
      console.log(`OK 第 9 項 ${tag} 底部工具列 ${fonts.length} 顆文字最小 ${Math.min(...fonts.map((f) => f.size))}px ≥ 11px`);
      await page.screenshot({ path: path.join(SHOT_DIR, 'mobile-390x844.png') });
      await ctx.close();
    }
    console.log('VERIFIED test-content-r37-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : `（http://127.0.0.1:${PORT}）`));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
