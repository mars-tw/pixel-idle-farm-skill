'use strict';
/* R28 B 線版面量測（第 6～10 項）：矮螢幕與手機自動收合、手機橫式控制、
   手機底部抽屜、建造選單可讀可關、設定開關與開場。用 playwright 在本機起
   伺服器實測（結束關閉），截圖存 docs/content/r28/layout/。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5159;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOT_DIR = path.join(ROOT, 'docs', 'content', 'r28', 'layout');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const TMP = path.join(ROOT, '.tmp-r28-layout');
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
const HELP = `
  globalThis.ro = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  globalThis.inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  globalThis.vis = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
`;

(async () => {
  const { server, intercepted } = await startServer();
  const browser = await launchBrowser();
  try {
    for (const [w, h] of [[1366, 768], [1366, 600], [390, 844], [844, 390]]) {
      const { ctx, page } = await newPage(browser, intercepted, w, h);

      // 10：開場便箋內文與第一顆按鈕間空白 ≤ 40px，按鈕完整在卡片內
      const opening = await page.evaluate(() => {
        const card = document.querySelector('#worldModal .modal-card');
        const body = document.querySelector('#worldModal .modal-body');
        const btns = body ? [...body.querySelectorAll('button')] : [];
        const first = btns[0];
        const prev = first ? first.previousElementSibling : null;
        if (!card || !first || !prev) return null;
        const cr = card.getBoundingClientRect();
        return { gap: first.getBoundingClientRect().top - prev.getBoundingClientRect().bottom, allIn: btns.every((b) => { const r = b.getBoundingClientRect(); return r.top >= cr.top && r.bottom <= cr.bottom + 1; }) };
      });
      assert(opening, `${w}×${h} 開場彈窗不存在`);
      assert(opening.gap <= 40, `${w}×${h} 開場內文與按鈕間空白 ${Math.round(opening.gap)}px 超過 40px`);
      assert(opening.allIn, `${w}×${h} 開場按鈕未完整落在卡片內`);
      console.log(`OK 開場 ${w}×${h} 內文與按鈕間空白 ${Math.round(opening.gap)}px ≤ 40px`);
      await page.locator('#worldBegin').click();
      await page.waitForTimeout(500);

      // 6：矮螢幕（高度 ≤ 600）任務卡預設收成一行
      if (h <= 600) {
        const qh = await page.evaluate(() => Math.round(document.querySelector('#questDock').getBoundingClientRect().height));
        assert(qh <= 56, `${w}×${h} 矮螢幕任務卡預設應收成一行（≤56px），實際 ${qh}px`);
        console.log(`OK 矮螢幕 ${w}×${h} 任務卡預設一行高 ${qh}px`);
      }

      // 6：完成提示先顯示、對話不與提示同時出現；提示與對話期間任務卡暫時收合
      await page.evaluate(() => {
        window.__farm.toast('任務完成，測試提示');
        window.FarmWorld.speak('葛瑞', '收成先留一籃，別全拿去賣。');
      });
      await page.waitForTimeout(300);
      const duringToast = await page.evaluate((src) => {
        eval(src);
        const toast = document.querySelector('#toast-zone .toast');
        const dlg = document.querySelector('#worldDialogue');
        const quest = document.querySelector('#questDock');
        const plate = document.querySelector('[data-audit="quest-npc-nameplate"]');
        return {
          toast: vis(toast), dlg: vis(dlg), questH: Math.round(quest.getBoundingClientRect().height),
          toastVsPlate: toast && plate && vis(plate) ? Math.round(inter(ro(toast), ro(plate))) : 0,
        };
      }, HELP);
      assert(duringToast.toast, `${w}×${h} 完成提示未顯示`);
      assert(!duringToast.dlg, `${w}×${h} 完成提示顯示中不應同時顯示對話框`);
      assert(duringToast.questH <= 56, `${w}×${h} 完成提示期間任務卡應暫時收合，實際 ${duringToast.questH}px`);
      assert.equal(duringToast.toastVsPlate, 0, `${w}×${h} 完成提示壓住 NPC 名牌（交集 ${duringToast.toastVsPlate}px）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `completion-${w}x${h}.png`) });
      console.log(`OK 提示 ${w}×${h} 完成提示顯示中、對話未開、任務卡已收合、未壓名牌`);
      await page.waitForFunction(() => {
        const d = document.querySelector('#worldDialogue');
        return d && !d.hidden && getComputedStyle(d).display !== 'none';
      }, null, { timeout: 9000 });
      const duringDlg = await page.evaluate((src) => {
        eval(src);
        const dlg = document.querySelector('#worldDialogue');
        const quest = document.querySelector('#questDock');
        const plate = document.querySelector('[data-audit="quest-npc-nameplate"]');
        const scene = ro(document.querySelector('#mapScene'));
        const overlays = ['header', '#questDock', '#worldDialogue', '.tool-bar', '#toast-zone'].map((s) => document.querySelector(s)).filter(vis).map(ro);
        let blocked = 0;
        for (const o of overlays) blocked += inter(scene, o);
        const toasts = [...document.querySelectorAll('#toast-zone .toast')].filter(vis);
        const titleEl = quest.querySelector('.world-objective-title');
        const nextEl = quest.querySelector('.r82a-guidance-short');
        return {
          titleW: titleEl ? Math.round(titleEl.getBoundingClientRect().width) : 0,
          nextText: nextEl ? nextEl.textContent.trim() : '',
          nextCut: !!nextEl && (nextEl.scrollHeight > nextEl.clientHeight + 1 || nextEl.scrollWidth > nextEl.clientWidth + 1),
          questH: Math.round(quest.getBoundingClientRect().height), toastCount: toasts.length,
          gamePct: (scene.width * scene.height - blocked) / (innerWidth * innerHeight) * 100,
          dlgVsPlate: plate && vis(plate) ? Math.round(inter(ro(dlg), ro(plate))) : 0,
        };
      }, HELP);
      assert(duringDlg.toastCount === 0, `${w}×${h} 對話開啟時完成提示仍在`);
      assert(duringDlg.questH <= 56, `${w}×${h} 對話期間任務卡應暫時收合，實際 ${duringDlg.questH}px`);
      assert(duringDlg.titleW >= 40, `${w}×${h} 收合任務卡標題寬度 ${duringDlg.titleW}px，未顯示標題`);
      assert(duringDlg.nextText && !duringDlg.nextCut, `${w}×${h} 對話期間 short 下一步應完整、不裁切：${JSON.stringify(duringDlg)}`);
      assert(duringDlg.gamePct >= 50, `${w}×${h} 對話中可見遊戲區 ${duringDlg.gamePct.toFixed(1)}% 低於 50%`);
      assert.equal(duringDlg.dlgVsPlate, 0, `${w}×${h} 對話框壓住 NPC 名牌（交集 ${duringDlg.dlgVsPlate}px）`);
      await page.screenshot({ path: path.join(SHOT_DIR, `dialogue-${w}x${h}.png`) });
      console.log(`OK 對話 ${w}×${h} 任務卡收合、可見遊戲區 ${duringDlg.gamePct.toFixed(0)}% ≥ 50%、未壓名牌`);
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; });
      await page.waitForTimeout(250);

      // 7：手機橫式——任務卡不覆蓋任一方向鍵；種子欄不壓小地圖與頂列
      if (w === 844 && h === 390) { await page.evaluate(() => document.querySelector('#settingsBtn').click()); await page.waitForTimeout(350); await page.evaluate(() => { const b = document.querySelector('[data-setting-key="showDpad"]'); if (b && b.dataset.enabled !== 'true') b.click(); }); await page.waitForTimeout(200); await page.evaluate(() => document.querySelector('#settingsOk').click()); await page.waitForTimeout(300);
        const land = await page.evaluate((src) => {
          eval(src);
          const quest = ro(document.querySelector('#questDock'));
          const keys = [...document.querySelectorAll('#mobileControls button')].filter(vis).map((b) => Math.round(inter(ro(b), quest)));
          const seed = ro(document.querySelector('#seedHud'));
          const mini = document.querySelector('#worldMinimap') || document.querySelector('.world-minimap');
          return { keys, seedVsHud: Math.round(inter(seed, ro(document.querySelector('header')))), seedVsMini: mini && vis(mini) ? Math.round(inter(seed, ro(mini))) : 0 };
        }, HELP);
        assert(land.keys.length >= 4, '844×390 方向鍵不存在');
        for (const k of land.keys) assert.equal(k, 0, `844×390 任務卡覆蓋方向鍵（交集 ${k}px）`);
        assert.equal(land.seedVsHud, 0, `844×390 種子欄壓住頂列（交集 ${land.seedVsHud}px）`);
        assert.equal(land.seedVsMini, 0, `844×390 種子欄壓住小地圖（交集 ${land.seedVsMini}px）`);
        await page.screenshot({ path: path.join(SHOT_DIR, `landscape-844x390.png`) });
        console.log('OK 橫式 844×390 任務卡與每顆方向鍵交集 0、種子欄未壓頂列與小地圖');
      }

      // 8：手機直式面板改全寬底部抽屜（僅 390×844）
      if (w === 390 && h === 844) {
        await page.evaluate(() => { const s = window.__farm.state(); window.AdventureAPI.ensure(s, Date.now()); s.adventure.claimed.c1_first_harvest = true; window.refreshOrders(s, Date.now()); window.__farm.refresh(); });
        for (const tab of ['orders', 'upgrades', 'story']) {
          await page.evaluate((t) => window.FarmWorld.openPanel(t), tab);
          await page.waitForTimeout(350);
          const m = await page.evaluate((src) => {
            eval(src);
            const body = document.querySelector('.side-panel.world-panel-open .side-body');
            const hint = document.querySelector('.side-panel > [data-audit="panel-scroll-hint"]');
            const br = ro(body); const hr = hint && vis(hint) ? ro(hint) : null;
            const unionH = hr ? Math.max(br.bottom, hr.bottom) - Math.min(br.top, hr.top) : br.height;
            const orders = [...body.querySelectorAll('.order')];
            const fullOrders = orders.filter((o) => { const r = ro(o); return r.top >= br.top - 1 && r.bottom <= br.bottom + 1; }).length;
            return { wPct: br.width / innerWidth * 100, unionPct: unionH / innerHeight * 100, hintW: hr ? Math.round(hr.width) : null, bodyW: Math.round(br.width), hintLeft: hr ? Math.round(hr.left) : null, bodyLeft: Math.round(br.left), hintGap: hr ? Math.round(hr.top - br.bottom) : null, fullOrders, orderCount: orders.length };
          }, HELP);
          assert(m.wPct >= 95, `390×844 ${tab} 抽屜寬度 ${m.wPct.toFixed(1)}% 未達全寬 95%`);
          assert(m.unionPct <= 70, `390×844 ${tab} 抽屜高度 ${m.unionPct.toFixed(1)}% 超過 70%`);
          if (m.hintW != null) {
            assert(Math.abs(m.hintW - m.bodyW) <= 2 && Math.abs(m.hintLeft - m.bodyLeft) <= 2, `390×844 ${tab} 捲動提示未貼齊抽屜寬度`);
            assert(m.hintGap >= -1 && m.hintGap <= 30, `390×844 ${tab} 捲動提示離抽屜下緣 ${m.hintGap}px，未在抽屜內`);
          }
          if (tab === 'orders') {
            assert(m.fullOrders >= 2, `390×844 訂單抽屜完整顯示訂單 ${m.fullOrders} 張，未達 2 張（共 ${m.orderCount} 張）`);
            await page.screenshot({ path: path.join(SHOT_DIR, `drawer-orders-390x844.png`) });
          }
          console.log(`OK 抽屜 390×844 ${tab} 全寬 ${m.wPct.toFixed(0)}%、高 ${m.unionPct.toFixed(0)}% ≤ 70%${tab === 'orders' ? `、完整訂單 ${m.fullOrders} 張` : ''}、捲動提示在抽屜內`);
          await page.evaluate(() => document.querySelector('.side-panel').classList.remove('world-panel-open'));
          await page.waitForTimeout(200);
        }
      }

      // 9：建造選單文字 ≥ 12px、右上角關閉鈕、不蓋住主角、提示只留一個
      const build = await page.evaluate((src) => {
        eval(src);
        window.__farm.setTool('build');
        const box = document.querySelector('#buildWheel');
        const br = ro(box);
        const fonts = [...box.querySelectorAll('.build-wheel-btn')].flatMap((b) => {
          const t = b.querySelector('.bw-t'); const s = b.querySelector('.bw-t small');
          return [t ? parseFloat(getComputedStyle(t).fontSize) : 99, s ? parseFloat(getComputedStyle(s).fontSize) : 99];
        });
        const close = box.querySelector('[data-audit="build-close"]');
        const player = document.querySelector('#player');
        const hintCount = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && vis(e) && e.textContent.trim() === '選一個建物，再點地面放置').length;
        return { hidden: box.hidden, minFont: Math.min(...fonts), close: close ? ro(close) : null, box: br, vsPlayer: player && vis(player) ? Math.round(inter(br, ro(player))) : 0, hintCount };
      }, HELP);
      assert(!build.hidden, `${w}×${h} 建造選單未開啟`);
      assert(build.minFont >= 12, `${w}×${h} 建造選單最小字級 ${build.minFont}px 低於 12px`);
      assert(build.close, `${w}×${h} 建造選單缺少關閉鈕`);
      assert(build.close.left >= build.box.left + build.box.width / 2 && build.close.top <= build.box.top + 48, `${w}×${h} 建造關閉鈕不在右上角`);
      assert.equal(build.vsPlayer, 0, `${w}×${h} 建造選單蓋住主角（交集 ${build.vsPlayer}px）`);
      assert.equal(build.hintCount, 1, `${w}×${h}「選一個建物」提示出現 ${build.hintCount} 處，應只留一個`);
      await page.screenshot({ path: path.join(SHOT_DIR, `build-${w}x${h}.png`) });
      await page.locator('[data-audit="build-close"]').click();
      await page.waitForTimeout(250);
      const buildClosed = await page.evaluate(() => document.querySelector('#buildWheel').hidden);
      assert(buildClosed, `${w}×${h} 點建造關閉鈕後選單未關閉`);
      console.log(`OK 建造 ${w}×${h} 字級 ${build.minFont}px ≥ 12px、右上角有關閉鈕、未蓋主角、提示只有一個且可關閉`);

      // 10：設定開關為滑塊切換鈕、底部按鈕與「完成」不被切掉
      await page.evaluate(() => document.querySelector('#settingsBtn').click());
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(SHOT_DIR, `settings-${w}x${h}.png`) });
      const settings = await page.evaluate(() => {
        const card = document.querySelector('#settingsModal .modal-card');
        const list = document.querySelector('#settingsList');
        if (list) list.scrollTop = list.scrollHeight;
        card.scrollTop = card.scrollHeight;
        const toggles = [...document.querySelectorAll('#settingsModal .setting-toggle[data-enabled]')].map((b) => {
          const knob = getComputedStyle(b, '::before');
          return { enabled: b.getAttribute('data-enabled'), bg: getComputedStyle(b).backgroundColor, knobLeft: parseFloat(knob.left), radius: getComputedStyle(b).borderRadius };
        });
        const ok = document.querySelector('#settingsOk');
        const cr = card.getBoundingClientRect(); const or = ok.getBoundingClientRect();
        const saveBtns = [...document.querySelectorAll('#settingsModal .save-actions .btn')].slice(-3).map((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; });
        return { toggles, okIn: or.top >= cr.top && or.bottom <= cr.bottom + 1 && or.bottom <= innerHeight + 1, saveBtns };
      });
      assert(settings.toggles.length >= 3, `${w}×${h} 設定開關數量不足`);
      const onT = settings.toggles.find((t) => t.enabled === 'true'); const offT = settings.toggles.find((t) => t.enabled === 'false');
      assert(onT && offT, `${w}×${h} 設定開關應同時有開與關兩態`);
      assert(onT.bg !== offT.bg, `${w}×${h} 設定開關開／關底色相同，看不出狀態`);
      assert(onT.knobLeft > offT.knobLeft + 10, `${w}×${h} 設定開關滑塊未依狀態左右移動（開 ${onT.knobLeft}px／關 ${offT.knobLeft}px）`);
      assert(settings.okIn, `${w}×${h} 設定底部「完成」被切掉`);
      assert(settings.saveBtns.length === 0 || settings.saveBtns.every(Boolean), `${w}×${h} 設定底部三顆按鈕被切掉`);
      console.log(`OK 設定 ${w}×${h} 開關滑塊左右兩態可分、底部按鈕與「完成」完整可見`);
      await page.evaluate(() => document.querySelector('#settingsOk').click());
      await page.waitForTimeout(200);

      await ctx.close();
    }
    console.log('VERIFIED test-content-r28-layout' + (intercepted ? '（本機 bind 受限，改用 route 攔截提供專案檔案）' : '（http://127.0.0.1:' + PORT + '）'));
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
