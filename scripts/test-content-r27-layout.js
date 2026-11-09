'use strict';
/* R27 B 線版面量測（第 6～10 項）：建造選單與捲動提示、手機橫式、單格選取、
   單一焦點回饋、對比與一致。用 playwright 在本機起伺服器實測（結束關閉），
   截圖存 docs/content/r27/layout/。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5157;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r27', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const TMP = path.join(ROOT, '.tmp-r27-layout');
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
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); }); return { server, intercepted: false }; }
  catch (e) { return { server: null, intercepted: true }; }
}
async function launchBrowser() {
  const opts = { headless: true, args: ['--no-sandbox'] };
  try { return await chromium.launch(opts); } catch (e) { /* 改用系統瀏覽器 */ }
  for (const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
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
  return { ctx, page };
}
async function openPanel(page, tab) {
  await page.evaluate((t) => window.FarmWorld.openPanel(t), tab);
  await page.waitForTimeout(350);
}
const INTERSECT_JS = `
  globalThis.rectOf = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  globalThis.clip = (r, box) => ({ top: Math.max(r.top, box.top), bottom: Math.min(r.bottom, box.bottom), left: Math.max(r.left, box.left), right: Math.min(r.right, box.right) });
`;

(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
      const { ctx, page } = await newPage(browser, intercepted, w, h);

      // 10：開場彈窗按鈕下方空白 ≤ 卡片高 15%，且按鈕完整在卡片內
      const opening = await page.evaluate(() => {
        const card = document.querySelector('#worldModal .modal-card');
        const btn = document.querySelector('#worldBegin');
        const sun = document.querySelector('#worldSunBegin');
        if (!card || !btn) return null;
        const cr = card.getBoundingClientRect(), br = btn.getBoundingClientRect(), sr = sun ? sun.getBoundingClientRect() : br;
        return { cardH: cr.height, belowPct: (cr.bottom - br.bottom) / cr.height * 100, btnIn: br.top >= cr.top && br.bottom <= cr.bottom + 1, sunIn: sr.top >= cr.top && sr.bottom <= cr.bottom + 1 };
      });
      assert(opening, `${w}×${h} 開場彈窗不存在`);
      assert(opening.btnIn && opening.sunIn, `${w}×${h} 開場按鈕未完整落在卡片內`);
      assert(opening.belowPct <= 15, `${w}×${h} 開場按鈕下方空白 ${opening.belowPct.toFixed(1)}% 超過卡片高 15%`);
      console.log(`OK 開場 ${w}×${h} 按鈕下方空白 ${opening.belowPct.toFixed(1)}% ≤ 15%`);
      await page.locator('#worldBegin').click();
      await page.waitForTimeout(500);

      // 6：R28 僅列已解鎖與下一個將解鎖項目；可見卡片仍須完整落在 HUD 與工具列之間
      const build = await page.evaluate(() => {
        window.__farm.setTool('build');
        const box = document.querySelector('#buildWheel');
        const br = box.getBoundingClientRect();
        const hud = document.querySelector('header').getBoundingClientRect();
        const toolEl = document.querySelector('.tool-bar');
        const tr = toolEl ? toolEl.getBoundingClientRect() : null;
        const btns = [...box.querySelectorAll('.build-wheel-btn')].map((b) => {
          const r = b.getBoundingClientRect(); const t = b.querySelector('.bw-t');
          return { text: b.textContent.trim(), top: r.top, bottom: r.bottom, left: r.left, right: r.right, nameOk: !t || t.scrollWidth <= t.clientWidth + 1 };
        });
        return { hidden: box.hidden, box: { top: br.top, bottom: br.bottom, left: br.left, right: br.right }, hudBottom: hud.bottom, toolTop: tr && tr.height > 0 ? tr.top : innerHeight, btns };
      });
      assert(!build.hidden && build.btns.length === 2, `${w}×${h} 新存檔建造選單應列 Lv1 可建物與下一個解鎖建物（實際 ${build.btns.length}）`);
      assert(build.btns[0].text.includes('可以建造'), `${w}×${h} Lv1 堆肥場缺少明確負擔狀態`);
      assert(build.btns[1].text.includes('需要 Lv 3（還差 2 級）'), `${w}×${h} 下一個建物缺少明確解鎖條件`); // R68B 第 5 項：建造卡改寫等級缺口
      assert(build.box.top >= build.hudBottom - 1, `${w}×${h} 建造選單上緣 ${Math.round(build.box.top)} 超出 HUD 下緣 ${Math.round(build.hudBottom)}`);
      assert(build.box.bottom <= build.toolTop + 1, `${w}×${h} 建造選單下緣 ${Math.round(build.box.bottom)} 超出工具列上緣 ${Math.round(build.toolTop)}`);
      assert(build.box.top >= 0 && build.box.bottom <= h + 1, `${w}×${h} 建造選單超出視窗`);
      for (const b of build.btns) {
        assert(b.top >= build.box.top - 1 && b.bottom <= build.box.bottom + 1 && b.left >= build.box.left - 1 && b.right <= build.box.right + 1, `${w}×${h} 建造卡片未完整在選單內：「${b.text.slice(0, 16)}」`);
        assert(b.nameOk, `${w}×${h} 建造卡片名稱被截斷：「${b.text.slice(0, 16)}」`);
      }
      await page.screenshot({ path: path.join(SHOT_DIR, `build-${w}x${h}.png`) });
      console.log(`OK 建造 ${w}×${h} 選單在 HUD 與工具列之間、${build.btns.length} 張卡片完整可見`);
      await page.evaluate(() => window.__farm.setTool('hand'));
      await page.waitForTimeout(200);
      await page.evaluate(() => { const s = window.__farm.state(); window.AdventureAPI.ensure(s, Date.now()); s.adventure.claimed.c1_first_harvest = true; window.refreshOrders(s, Date.now()); window.__farm.refresh(); });

      // 6：升級、手記（故事）、圖鑑、訂單面板——提示與可見按鈕／文字交集為 0
      const shotFor = { upgrades: 'upgrades', orders: 'orders', story: 'notes', journal: 'journal' };
      for (const tab of ['upgrades', 'orders', 'story', 'journal']) {
        await openPanel(page, tab);
        const m = await page.evaluate((src) => {
          eval(src);
          const body = document.querySelector('.side-panel.world-panel-open .side-body');
          if (!body) return null;
          const br = rectOf(body);
          const hint = document.querySelector('.side-panel > [data-audit="panel-scroll-hint"]');
          const hr = hint && !hint.hidden && getComputedStyle(hint).display !== 'none' && hint.getBoundingClientRect().height > 0 ? rectOf(hint) : null;
          const pane = body.querySelector('.side-pane.sel');
          const els = pane ? [...pane.querySelectorAll('button, .o-reward, .o-meta, .o-client')] : [];
          let maxInter = 0; let who = '';
          if (hr) for (const e of els) {
            const r = rectOf(e); if (r.width <= 0 || r.height <= 0) continue;
            const visible = clip(r, br);
            const v = inter(visible, hr);
            if (v > maxInter) { maxInter = v; who = e.textContent.trim().slice(0, 20); }
          }
          const style = hint ? getComputedStyle(hint) : null;
          return { body: br, hint: hr, hintHidden: !hr, hintVisible: !!hr, hasMore: !!(pane && pane.querySelector('.r32-show-more')), hiddenCards: pane ? pane.querySelectorAll('.r32-panel-hidden').length : 0, maxInter, who, bgImage: style ? style.backgroundImage : '', scrollH: body.scrollHeight, clientH: body.clientHeight };
        }, INTERSECT_JS);
        assert(m, `${w}×${h} ${tab} 面板未開啟`);
        if (m.scrollH > m.clientH) {
          assert.equal(m.hintVisible, false, `${w}×${h} ${tab} 不應再顯示「往下還有內容」（R36 只留一種提示）`);
          if (m.hiddenCards > 0) assert(m.hasMore, `${w}×${h} ${tab} 收起卡片後應以「再顯示 N 項」作為唯一提示`);
          assert.equal(m.maxInter, 0, `${w}×${h} ${tab} 提示與「${m.who}」交集 ${m.maxInter}px 不為 0`);
          assert(m.body.bottom <= h + 1, `${w}×${h} ${tab} 面板底邊 ${Math.round(m.body.bottom)} 超出視窗高 ${h}`);
        }
        await page.screenshot({ path: path.join(SHOT_DIR, `${shotFor[tab]}-${w}x${h}.png`) });
        const bottom = await page.evaluate(() => {
          const body = document.querySelector('.side-panel.world-panel-open .side-body');
          body.scrollTop = body.scrollHeight;
          const pane = body.querySelector('.side-pane.sel');
          const btns = pane ? [...pane.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); const d = b.closest('details'); return r.width > 0 && r.height > 0 && (!d || d.open); }) : [];
          const last = btns[btns.length - 1];
          const hint = document.querySelector('.side-panel > [data-audit="panel-scroll-hint"]');
          if (!last) return { count: btns.length, fully: false, hintHidden: hint ? (hint.hidden || getComputedStyle(hint).display === 'none' || hint.getBoundingClientRect().height === 0) : true };
          const r = last.getBoundingClientRect(), br = body.getBoundingClientRect();
          return { count: btns.length, fully: r.top >= br.top - 1 && r.bottom <= br.bottom + 1, hintHidden: hint ? (hint.hidden || getComputedStyle(hint).display === 'none' || hint.getBoundingClientRect().height === 0) : true, text: last.textContent.trim().slice(0, 20) };
        });
        await page.waitForTimeout(200);
        const bottom2 = await page.evaluate(() => {
          const body = document.querySelector('.side-panel.world-panel-open .side-body');
          body.scrollTop = body.scrollHeight;
          const pane = body.querySelector('.side-pane.sel');
          const btns = pane ? [...pane.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); const d = b.closest('details'); return r.width > 0 && r.height > 0 && (!d || d.open); }) : [];
          const last = btns[btns.length - 1];
          const hint = document.querySelector('.side-panel > [data-audit="panel-scroll-hint"]');
          if (!last) return { count: btns.length, fully: false, hintHidden: hint ? (hint.hidden || getComputedStyle(hint).display === 'none' || hint.getBoundingClientRect().height === 0) : true, text: '' };
          const r = last.getBoundingClientRect(), br = body.getBoundingClientRect();
          return { count: btns.length, fully: r.top >= br.top - 1 && r.bottom <= br.bottom + 1, hintHidden: hint ? (hint.hidden || getComputedStyle(hint).display === 'none' || hint.getBoundingClientRect().height === 0) : true, text: last.textContent.trim().slice(0, 20) };
        });
        if (m.scrollH > m.clientH) assert(bottom2.hintHidden === true, `${w}×${h} ${tab} 捲到底後不應出現「往下還有內容」`);
        if (bottom2.count) assert(bottom2.fully, `${w}×${h} ${tab} 捲到底最後按鈕未完整可見：「${bottom2.text || ''}」`);
        console.log(`OK 面板 ${w}×${h} ${tab} 提示交集 0、捲到底按鈕完整可見`);
      }
      await page.evaluate(() => document.querySelector('.side-panel').classList.remove('world-panel-open'));
      await page.waitForTimeout(200);

      // 7：手機橫式 844×390 專項
      if (w === 844 && h === 390) {
        const land = await page.evaluate((src) => {
          eval(src);
          const q = document.querySelector('#questDock'); const qr = rectOf(q);
          const spans = [...q.querySelectorAll('.world-chapter > span')].map((s) => { const r = rectOf(s); return { t: s.textContent.trim(), h: r.height }; });
          const btn = q.querySelector('[data-world-go]');
          const seed = rectOf(document.querySelector('#seedHud'));
          const hud = rectOf(document.querySelector('header'));
          const dpadEl = document.querySelector('#mobileControls .dpad');
          const dpad = dpadEl ? rectOf(dpadEl) : null;
          const scene = rectOf(document.querySelector('#mapScene'));
          return { quest: qr, spans, btnText: btn ? btn.textContent.trim() : '', btnH: btn ? rectOf(btn).height : 0, seed, hud, dpad, seedVsHud: inter(seed, hud), dpadVsQuest: dpad ? inter(dpad, qr) : 0, worldRatio: scene.width * scene.height / (innerWidth * innerHeight) * 100 };
        }, INTERSECT_JS);
        for (const s of land.spans) assert(s.h <= 18, `844×390 任務卡章節文字斷行：「${s.t}」高 ${s.h}px`);
        assert(land.btnH <= 48, `844×390 任務卡按鈕文字斷行或過高：「${land.btnText}」高 ${land.btnH}px`);
        assert.equal(land.seedVsHud, 0, `844×390 作物快捷列與 HUD 重疊 ${land.seedVsHud}px`);
        assert.equal(land.dpadVsQuest, 0, `844×390 方向鍵與任務卡重疊 ${land.dpadVsQuest}px`);
        assert(land.worldRatio >= 60, `844×390 世界可視面積 ${land.worldRatio.toFixed(1)}% 低於 60%`);
        await page.screenshot({ path: path.join(SHOT_DIR, `landscape-quest-844x390.png`) });
        console.log(`OK 橫式 844×390 章節與按鈕不斷行、快捷列與方向鍵重疊 0、世界可視 ${land.worldRatio.toFixed(0)}%`);
      }

      // 8：種植／澆水只高亮一格、格上方狀態、中央按鈕與工具一致且只有一顆
      const plant = await page.evaluate(async () => {
        const s = window.__farm.state();
        const tile = s.map.tiles.find((t) => t.plotIndex === 0);
        s.plots[0].cropId = 'wheat'; s.plots[0].plantedAt = Date.now(); delete s.plots[0].wateredAt;
        const adj = s.map.tiles.find((t) => t.x === tile.x && t.y === tile.y + 1) || s.map.tiles.find((t) => t.x === tile.x + 1 && t.y === tile.y);
        if (adj) { s.player.tileId = adj.id; s.player.x = adj.x; s.player.y = adj.y; }
        window.__farm.refresh();
        if (window.__farm.followPlayer) window.__farm.followPlayer();
        window.__farm.setTool('water');
        window.__farm.focusTile(tile.id);
        window.__farm.clickTile(tile.id);
        return tile.id;
      });
      await page.waitForTimeout(250);
      const single = await page.evaluate(() => {
        const sels = [...document.querySelectorAll('.gtile.sel')].map((e) => e.dataset.tileId);
        const label = document.querySelector('[data-audit="tile-state-label"]');
        const bar = document.querySelector('#sceneActionBar');
        const actions = bar && !bar.hidden ? [...bar.querySelectorAll('button')].map((b) => b.dataset.action) : [];
        const toolbarSel = document.querySelector('.tool-bar .tool.sel');
        const lr = label ? label.getBoundingClientRect() : null;
        const tileEl = document.querySelector('.gtile.sel');
        const tr = tileEl ? tileEl.getBoundingClientRect() : null;
        return { sels, label: label && !label.hidden ? label.textContent.trim() : null, labelAbove: !!(lr && tr && lr.bottom <= tr.top + 6), labelInView: !!(lr && lr.left >= 0 && lr.top >= 0 && lr.right <= innerWidth && lr.bottom <= innerHeight), actions, toolbar: toolbarSel ? toolbarSel.textContent.trim() : '' };
      });
      assert.equal(single.sels.length, 1, `${w}×${h} 種植／澆水應只高亮一格，實際 ${single.sels.length} 格`);
      assert.match(single.label, /^小麥・已種 [0-2]／3 格・種滿再澆水$/, /* R42：標籤寫出已種格數 */ `${w}×${h} 未種滿三格時應提示種滿再澆水，實際「${single.label}」`);
      assert(single.labelAbove, `${w}×${h} 狀態標籤不在選取格上方`);
      assert(single.labelInView, `${w}×${h} 狀態標籤不在畫面內`);
      assert.deepEqual(single.actions, ['water'], `${w}×${h} 中央浮動按鈕應與澆水工具一致且只有一顆，實際 ${JSON.stringify(single.actions)}（工具列：${single.toolbar}）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `plant-highlight-${w}x${h}.png`) });
      console.log(`OK 單格 ${w}×${h} 只高亮一格、標籤「${single.label}」、中央按鈕與澆水工具一致`);
      await page.evaluate(() => { const s = window.__farm.state(); s.plots[0].cropId = null; window.__farm.cancelJourney(); window.__farm.setTool('hand'); window.__farm.refresh(); });
      await page.waitForTimeout(200);

      // 9：名牌在 NPC 頭頂、不落在玩家身上；設定「完成」完整可見
      await page.evaluate(() => { const s = window.__farm.state(); const mayor = s.map.tiles.find((t) => t.npc === 'mayor'); window.__farm.focusTile(mayor.id); });
      await page.waitForTimeout(700);
      const plate = await page.evaluate((src) => {
        eval(src);
        const el = document.querySelector('[data-audit="quest-npc-nameplate"]');
        const marker = document.querySelector('[data-audit="quest-marker"]');
        const player = document.querySelector('#player');
        if (!el || !marker || !player) return null;
        const npc = document.querySelector('.ob[data-kind="npc"][data-tile-id="' + marker.dataset.tileId + '"]');
        if (!npc) return null;
        const pr = rectOf(el), nr = rectOf(npc), pl = rectOf(player);
        return { text: el.textContent.trim(), dx: Math.abs((pr.left + pr.width / 2) - (nr.left + nr.width / 2)), plateBottom: pr.bottom, npcTop: nr.top, vsPlayer: inter(pr, pl) };
      }, INTERSECT_JS);
      assert(plate, `${w}×${h} 任務 NPC 名牌不存在`);
      assert(plate.dx <= 8, `${w}×${h} 名牌中心與 NPC 頭頂距離 ${plate.dx.toFixed(1)}px 超過 8px`);
      assert(plate.plateBottom <= plate.npcTop + 8, `${w}×${h} 名牌不在 NPC 頭頂上方（牌下緣 ${Math.round(plate.plateBottom)}、NPC 上緣 ${Math.round(plate.npcTop)}）`);
      assert.equal(plate.vsPlayer, 0, `${w}×${h} 名牌落在玩家身上（交集 ${plate.vsPlayer}px）`);
      console.log(`OK 名牌 ${w}×${h}「${plate.text}」在 NPC 頭頂、未落在玩家身上`);
      await page.evaluate(() => document.querySelector('#settingsBtn').click());
      await page.waitForTimeout(300);
      const settings = await page.evaluate(() => {
        const card = document.querySelector('#settingsModal .modal-card'); const ok = document.querySelector('#settingsOk');
        if (!card || !ok) return null;
        const cr = card.getBoundingClientRect(), or = ok.getBoundingClientRect();
        return { fully: or.top >= cr.top && or.bottom <= cr.bottom + 1, text: ok.textContent.trim() };
      });
      assert(settings && settings.fully, `${w}×${h} 設定面板底部「完成」被切掉`);
      await page.evaluate(() => document.querySelector('#settingsOk').click());
      await page.waitForTimeout(200);
      console.log(`OK 設定 ${w}×${h} 底部「完成」完整可見`);

      // 9：任務完成提示顯示完才開對話，兩者不同時可見
      const seqStart = await page.evaluate(() => {
        window.__farm.toast('任務完成，測試提示');
        window.FarmWorld.speak('葛瑞', '收成先留一籃，別全拿去賣。');
        const toast = document.querySelector('#toast-zone .toast');
        const dlg = document.querySelector('#worldDialogue');
        const vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none';
        return { toast: !!(toast && vis(toast.parentElement) && toast.getBoundingClientRect().height > 0), dlg: vis(dlg) };
      });
      assert(seqStart.toast, `${w}×${h} 完成提示未顯示`);
      assert(!seqStart.dlg, `${w}×${h} 完成提示顯示中不應同時開對話`);
      await page.waitForFunction(() => {
        const dlg = document.querySelector('#worldDialogue');
        return dlg && !dlg.hidden && getComputedStyle(dlg).display !== 'none';
      }, null, { timeout: 8000 });
      const seqEnd = await page.evaluate(() => {
        const toasts = [...document.querySelectorAll('#toast-zone .toast')].filter((t) => t.getBoundingClientRect().height > 0);
        return { toastCount: toasts.length };
      });
      assert.equal(seqEnd.toastCount, 0, `${w}×${h} 對話開啟時完成提示仍在（應先顯示完）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `dialogue-${w}x${h}.png`) });
      console.log(`OK 焦點 ${w}×${h} 完成提示先顯示完、才開 NPC 對話`);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; });
      await ctx.close();
    }

    // 10：對比與一致（1366×768 實際渲染量測）
    {
      const { ctx, page } = await newPage(browser, intercepted, 1366, 768);
      await page.locator('#worldBegin').click();
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const s = window.__farm.state();
        s.plots[0].cropId = 'wheat'; s.plots[0].plantedAt = Date.now(); delete s.plots[0].wateredAt;
        window.__farm.refresh();
      });
      await page.waitForTimeout(900);
      await page.evaluate(() => { const dock = document.querySelector('#questDock'); const probe = document.createElement('div'); probe.className = 'world-objective-hint'; probe.id = 'r27HintProbe'; probe.textContent = '最快 1 分鐘成熟'; dock.appendChild(probe); });
      const contrast = await page.evaluate(() => {
        const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) });
        const ratioFor = (el) => {
          if (!el) return null;
          const fg = parse(getComputedStyle(el).color);
          let n = el; let bg = { r: 255, g: 248, b: 223 };
          while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { bg = c.a < 1 ? over(c, { r: 29, g: 60, b: 44 }) : c; break; } n = n.parentElement; }
          const eff = over(fg, bg);
          const [x, y] = [lum(eff), lum(bg)].sort((a, b) => b - a);
          return Number(((x + 0.05) / (y + 0.05)).toFixed(2));
        };
        return {
          hint: ratioFor(document.querySelector('#questDock .world-objective-hint')),
          hintText: document.querySelector('#questDock .world-objective-hint') ? document.querySelector('#questDock .world-objective-hint').textContent.trim() : null,
        };
      });
      assert(contrast.hint != null, `任務卡淡黃提示列不存在（${contrast.hintText}）`);
      assert(contrast.hint >= 4.5, `任務卡提示列對比 ${contrast.hint}:1 低於 4.5:1`);
      console.log(`OK 對比 任務卡提示列 ${contrast.hint}:1 ≥ 4.5:1`);
      await openPanel(page, 'journal');
      const journal = await page.evaluate(() => {
        const el = document.querySelector('.story-kicker');
        if (!el) return null;
        const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2] }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const fg = parse(getComputedStyle(el).color); const bg = { r: 255, g: 248, b: 223 };
        const [x, y] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        return { ratio: Number(((x + 0.05) / (y + 0.05)).toFixed(2)), text: el.textContent.trim() };
      });
      assert(journal && journal.ratio >= 4.5, `手記章節字對比 ${journal && journal.ratio}:1 低於 4.5:1`);
      console.log(`OK 對比 手記章節字 ${journal.ratio}:1 ≥ 4.5:1`);
      const upgradeIcon = await page.evaluate(async () => {
        window.FarmWorld.openPanel('upgrades');
        await new Promise((r) => setTimeout(r, 300));
        const ups = [...document.querySelectorAll('.up')];
        const target = ups.find((u) => u.querySelector('.u-name') && u.querySelector('.u-name').textContent.includes('開墾農地'));
        if (!target) return null;
        const icon = target.querySelector('.u-ic .ui-icon');
        return { hasIcon: !!icon, bg: icon ? getComputedStyle(icon).backgroundImage : '', text: target.querySelector('.u-ic').textContent.trim() };
      });
      assert(upgradeIcon && upgradeIcon.hasIcon && upgradeIcon.bg !== 'none' && upgradeIcon.bg !== '', `開墾農地應使用既有圖示，實際 ${JSON.stringify(upgradeIcon)}`);
      assert(!upgradeIcon.text.includes('🟫'), '開墾農地仍顯示深色方塊圖示');
      console.log('OK 一致 開墾農地已換成既有圖示（非深色方塊）');
      await page.evaluate(() => { document.querySelector('.side-panel').classList.remove('world-panel-open'); document.querySelector('#dailyOpen').click(); });
      await page.waitForTimeout(500);
      const daily = await page.evaluate(() => {
        const p = document.querySelector('.chore-progress'); const fill = p ? p.querySelector('i') : null;
        const kicker = document.querySelector('.daily-kicker');
        if (!p || !fill) return null;
        const lumOf = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); const v = m[1].split(',').map(Number); const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
        return { trackBg: getComputedStyle(p).backgroundColor, fillBg: getComputedStyle(fill).backgroundColor, trackLum: lumOf(getComputedStyle(p).backgroundColor), fillLum: lumOf(getComputedStyle(fill).backgroundColor), height: p.getBoundingClientRect().height, widthPct: fill.style.width, kickerColor: kicker ? getComputedStyle(kicker).color : null };
      });
      assert(daily && daily.height > 0, '每日印章冊進度條不存在');
      assert(daily.trackLum > daily.fillLum, `每日進度條 0% 應看得出空軌（軌道亮度 ${daily.trackLum.toFixed(2)}、填色 ${daily.fillLum.toFixed(2)}）`);
      assert(daily.fillBg !== daily.trackBg, '每日進度條填色與軌道同色，0 與空白分不出');
      console.log(`OK 一致 每日進度條軌道與填色可分（填色寬度 ${daily.widthPct}）`);
      await ctx.close();
    }

    console.log('VERIFIED test-content-r27-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : '（http://127.0.0.1:' + PORT + '）'));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
// end
