'use strict';
/* R59 B 線（計畫第 6～9 項）版面量測：
   6 長清單「再顯示 N 項」不覆蓋卡片、卡內按鈕在框內、可交付委託排前面、灶台捲到底不切半張；
   7 今日三件事標題在展開／收合／提示／面板開啟時都保留；
   8 田上提示標籤 scrollWidth <= clientWidth；
   9 小事件與委託主要按鈕為主色（黃色），停用才灰色。
   四種尺寸：1366×768、1366×600、390×844、844×390。
   本機沙箱無法 listen／無 Playwright 瀏覽器時可用環境變數改走 file 與系統 Chrome（預設仍比照 R58 的本機伺服器寫法）：
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
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const VIEWS = [
  { w: 1366, h: 768, mobile: false },
  { w: 1366, h: 600, mobile: false },
  { w: 390, h: 844, mobile: true },
  { w: 844, h: 390, mobile: true },
];
const YELLOW = 'rgb(255, 207, 100)'; // R59B 主色 #ffcf64
const SECONDARY = 'rgb(243, 234, 212)'; // R82A 手札按鈕改為次要色，同畫面只留一顆黃色主按鈕
const GREY = 'rgb(230, 222, 208)'; // R59B 停用 #e6ded0

async function setup(page, base) {
  await page.goto(base);
  await page.waitForFunction(() => window.__farm && !document.querySelector('#startupLoading'), null, { timeout: 30000 });
  await page.evaluate(() => { const b = document.querySelector('#worldBegin'); if (b) b.click(); });
  await page.evaluate(() => {
    const s = window.__farm.state(), A = window.AdventureAPI, now = Date.now();
    A.record(s, { type: 'talk', npcId: 'mayor' }, now);
    window.plant(s, 0, 'wheat', now); A.record(s, { type: 'plant', cropId: 'wheat', count: 1 }, now);
    A.finishTutorial(s, now);
    window.__farm.refresh(); window.FarmWorld.refresh(s);
  });
  await page.waitForFunction(() => document.querySelector('#questDock')?.dataset.quest === 'early_free_choice', null, { timeout: 5000 });
}

function titleMeasure() {
  const box = document.querySelector('#questDock');
  const folded = box && (/quest-(?:auto-)?collapsed|quest-target-collapsed/.test(box.className) || !!document.querySelector('.side-panel.world-panel-open'));
  // R82A：收合與桌面面板改驗人工 short；手機面板仍整張隱藏。
  const sum = box && folded ? box.querySelector('.r82a-guidance-short') : null; const step = (sum && getComputedStyle(sum).display !== 'none' && sum.getBoundingClientRect().width > 0 ? sum : null) || (box && box.querySelector('.world-objective-title .qp-step'));
  if (!step) return { ok: false, reason: 'no-step', dock: box ? box.textContent.trim().slice(0, 80) : '' };
  const r = step.getBoundingClientRect(), cs = getComputedStyle(step);
  return {
    ok: !!step.textContent.trim() && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
    text: step.textContent.trim(), display: cs.display, w: Math.round(r.width), h: Math.round(r.height),
    dock: box.textContent.trim().slice(0, 80),
  };
}

(async () => {
  // CSS 規則先驗（第 9 項與第 6 項的宣告也要在）
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r58b.css'), 'utf8');
  assert.match(css, /R59B/, 'content-r58b.css 末尾應有 R59B 規則');
  assert.match(css, /\.r32-show-more\s*\{\s*position:\s*sticky/, '「再顯示 N 項」應留在清單末尾的首屏可視帶');
  assert.match(css, /button:not\(:disabled\)[\s\S]{0,300}#ffcf64/i, '主要按鈕啟用時應為主色黃色');
  assert.match(css, /button:disabled[\s\S]{0,300}#e6ded0/i, '主要按鈕停用時才用灰色');

  const useFile = process.env.FARM_TEST_FILE === '1';
  const server = useFile ? null : await serve();
  const base = useFile ? 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html' : `http://127.0.0.1:${server.address().port}/index.html`;
  const launch = { headless: true };
  if (process.env.FARM_TEST_CHROME) { launch.executablePath = process.env.FARM_TEST_CHROME; launch.args = ['--no-sandbox']; }
  const browser = await chromium.launch(launch);
  try {
    for (const view of VIEWS) {
      const tag = `${view.w}×${view.h}`;
      const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, isMobile: view.mobile, hasTouch: view.mobile, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await setup(page, base);

      /* ---- 第 7 項：標題永遠在 ---- */
      await page.waitForFunction(() => !document.querySelector('#toast-zone > .toast') && !document.querySelector('#worldDialogue:not([hidden])'), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(300);
      // R63/R69 手機預設收合；先明確展開，才能依序驗證展開、收合與再次展開三態。
      const startsFolded = await page.evaluate(() => /quest-(?:auto-)?collapsed|quest-target-collapsed/.test(document.querySelector('#questDock')?.className || ''));
      if (startsFolded) { await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(250); }
      let t = await page.evaluate(titleMeasure);
      assert.ok(t.ok, `${tag} 展開時標題應可見：${JSON.stringify(t)}`);
      await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(250);
      t = await page.evaluate(titleMeasure);
      assert.ok(t.ok, `${tag} 收合時標題應可見、不只剩進度：${JSON.stringify(t)}`);
      await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(250);
      // 提示（toast）出現時
      t = await page.evaluate(() => {
        let zone = document.querySelector('#toast-zone');
        if (!zone) { zone = document.createElement('div'); zone.id = 'toast-zone'; document.body.appendChild(zone); }
        const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = '量測用提示'; zone.appendChild(toast);
        const m = (function () { const box = document.querySelector('#questDock'); const step = box.querySelector('.r82a-guidance-short'); const line = step && step.closest('small'); const r = step && step.getBoundingClientRect(), cs = step && getComputedStyle(step); return { ok: !!(step && step.textContent.trim() && cs.display !== 'none' && r.height > 0 && line.scrollWidth <= line.clientWidth + 1 && line.scrollHeight <= line.clientHeight + 1), text: step && step.textContent.trim(), display: cs && cs.display, rect: r && { width:r.width,height:r.height }, line: line && { cw:line.clientWidth,sw:line.scrollWidth,ch:line.clientHeight,sh:line.scrollHeight,display:getComputedStyle(line).display } }; })();
        toast.remove(); return m;
      });
      assert.ok(t.ok, `${tag} 提示出現時 short 下一步應完整可見：${JSON.stringify(t)}`);
      // 面板開啟時（同時做第 6、9 項量測）
      await page.evaluate(() => window.FarmWorld.openPanel('story'));
      await page.waitForTimeout(900);
      t = await page.evaluate(titleMeasure);
      if (view.mobile) assert.equal(t.ok, false, `${tag} R67A：手機面板開啟時任務卡應整張隱藏：${JSON.stringify(t)}`);
      else assert.ok(t.ok, `${tag} 面板開啟時標題應可見：${JSON.stringify(t)}`);
      console.log(`OK ${tag} 第 7 項：展開／收合／提示標題完整，手機面板開啟時整卡隱藏`);

      /* ---- 第 6 項：長清單不壓卡片 ---- */
      // R59 整合：面板開著時小事件出現、手札重繪（卡片整批換新），仍不得讓「再顯示」壓卡（實機截圖曾重現）
      await page.evaluate(() => { const st = window.__farm.state(), A = window.AdventureAPI, now = Date.now(); A.ensure(st, now); st.adventure.r58.nextEventAt = 0; A.maybeTriggerRandomEvent(st, now, (() => { const q = [0.05, 0.5]; return () => (q.length ? q.shift() : 0.5); })()); window.__farm.refresh(); window.FarmWorld.refresh(st); });
      await page.waitForTimeout(700);
      const story = await page.evaluate(() => {
        const pane = document.querySelector('.side-pane[data-pane="story"]');
        const body = document.querySelector('.side-panel.world-panel-open .side-body') || document.querySelector('.side-body');
        const btn = pane.querySelector('.r32-show-more');
        const cards = [...pane.querySelectorAll('.adventure-quest,.r58-card,.order,.story-card')].filter((c) => c.getBoundingClientRect().height > 0);
        const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const br = body.getBoundingClientRect();
        let overlap = 0; if (btn) { const bb = btn.getBoundingClientRect(); cards.forEach((c) => { overlap += inter(bb, c.getBoundingClientRect()); }); }
        const btnOut = [];
        cards.forEach((c, i) => c.querySelectorAll('button').forEach((b) => { const x = b.getBoundingClientRect(), cr = c.getBoundingClientRect(); if (x.left < cr.left - 1 || x.right > cr.right + 1 || x.top < cr.top - 1 || x.bottom > cr.bottom + 1) btnOut.push(i + ':' + b.textContent.trim()); }));
        const fitCards = [...pane.querySelectorAll('.order,.up,.building-upgrade-card,.adventure-quest,.riverside-card,.story-card')].filter((c) => c.getBoundingClientRect().height > 0);
        const partial = fitCards.filter((c) => { const r = c.getBoundingClientRect(); return r.top < br.bottom - 2 && r.bottom > br.bottom + 2; }).length; // R39 規則的卡片範圍
        return { hasBtn: !!btn, btnPos: btn ? getComputedStyle(btn).position : '', overlap: Math.round(overlap), btnOut, partial, cards: cards.length };
      });
      if (story.hasBtn) {
        assert.equal(story.overlap, 0, `${tag} 「再顯示」橫條不應覆蓋任何卡片：${JSON.stringify(story)}`);
        assert.equal(story.btnPos, 'sticky', `${tag} 「再顯示」應留在首屏可視帶，實際 ${story.btnPos}`);
        assert.equal(story.partial, 0, `${tag} 首屏不應露出半張卡：${JSON.stringify(story)}`);
      }
      assert.deepEqual(story.btnOut, [], `${tag} 每張卡的按鈕應在卡片框內：${JSON.stringify(story.btnOut)}`);
      console.log(`OK ${tag} 第 6 項（故事手札）：再顯示交集 0、首屏無半張卡、按鈕在卡內（卡 ${story.cards} 張）`);
      await page.evaluate(() => { const st = window.__farm.state(), A = window.AdventureAPI, ev = A.randomEvents(st, Date.now()).active; if (ev) { const opt = ev.options[ev.options.length - 1]; A.resolveRandomEvent(st, opt.id, Date.now()); window.__farm.refresh(); window.FarmWorld.refresh(st); } }); // 量完即婉拒，事件卡不影響後面「可交付委託排前面」的量測
      await page.waitForTimeout(500);

      /* ---- 第 6 項：可交付委託排前面 ＋ 第 9 項主色 ---- */
      const delivered = await page.evaluate(() => {
        const s = window.__farm.state(), A = window.AdventureAPI, now = Date.now();
        const list = A.personalQuests ? A.personalQuests(s, now) : [];
        const target = list.find((p) => p.unlocked && !p.completed);
        if (!target) return { made: false };
        (target.requirements || []).forEach((r) => { const need = r.required != null ? r.required : (r.count || 1); s.storage.items[r.id] = Math.max(s.storage.items[r.id] || 0, need); });
        window.__farm.refresh(); window.FarmWorld.refresh(s);
        return { made: true, id: target.id };
      });
      await page.waitForTimeout(700);
      if (delivered.made) {
        await page.evaluate(() => window.FarmWorld.openPanel('story')); await page.waitForTimeout(500);
        // 矮螢幕首屏可能只收得下一張卡：先展開清單再量視覺順序（排序看的是完整清單）
        await page.evaluate(() => { const b = document.querySelector('.side-pane[data-pane="story"] .r32-show-more'); if (b) b.click(); });
        await page.waitForTimeout(500);
        const order = await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.r58-section > .r58-card')].filter((c) => c.getBoundingClientRect().height > 0);
          const rows = cards.map((c) => { const b = c.querySelector('button'); return { top: c.getBoundingClientRect().top, enabled: !!(b && !b.disabled), bg: b ? getComputedStyle(b).backgroundColor : '' }; });
          const firstEnabled = rows.findIndex((r) => r.enabled);
          return { rows, firstEnabled };
        });
        assert.ok(order.firstEnabled >= 0, `${tag} 應有可交付委託按鈕啟用`);
        const enabledRow = order.rows[order.firstEnabled];
        const minTop = Math.min(...order.rows.map((r) => r.top));
        assert.ok(Math.abs(enabledRow.top - minTop) <= 1, `${tag} 可交付委託應排在最前面（視覺頂端）：${JSON.stringify(order.rows)}`);
        assert.equal(enabledRow.bg, SECONDARY, `${tag} 手札可交付按鈕應為次要色，實際 ${enabledRow.bg}`);
        console.log(`OK ${tag} 第 6／9 項：可交付委託在最前且手札按鈕不搶主色`);
      } else {
        console.log(`SKIP ${tag} 第 6 項排序：此階段無已解鎖的個人委託可備齊`);
      }
      // 停用按鈕灰色、啟用（灶台任一啟用鈕）主色：第 9 項通則
      const btnColors = await page.evaluate(() => {
        const all = [...document.querySelectorAll('.side-pane[data-pane="story"] .r58-card button, .side-pane[data-pane="story"] .adventure-quest button')];
        const dis = all.find((b) => b.disabled), ena = all.find((b) => !b.disabled);
        return { dis: dis ? getComputedStyle(dis).backgroundColor : null, ena: ena ? getComputedStyle(ena).backgroundColor : null };
      });
      if (btnColors.dis) assert.equal(btnColors.dis, GREY, `${tag} 停用按鈕應為灰色，實際 ${btnColors.dis}`);
      if (btnColors.ena) assert.equal(btnColors.ena, SECONDARY, `${tag} 手札啟用按鈕應為次要色，實際 ${btnColors.ena}`);

      /* ---- 第 6 項：灶台可捲動、捲到底不切半張 ---- */
      await page.evaluate(() => window.FarmWorld.openKitchen()); await page.waitForTimeout(600);
      const kitchen = await page.evaluate(() => {
        const bodyEl = document.querySelector('#worldModal .modal-body');
        const rows = [...document.querySelectorAll('#worldModal .recipe-row')].filter((r) => r.getBoundingClientRect().height > 0);
        if (!bodyEl || !rows.length) return { rows: 0 };
        bodyEl.scrollTop = bodyEl.scrollHeight;
        return new Promise((res) => setTimeout(() => {
          const br = bodyEl.getBoundingClientRect(), last = rows[rows.length - 1].getBoundingClientRect();
          const btns = []; rows.forEach((r) => r.querySelectorAll('button').forEach((b) => { const x = b.getBoundingClientRect(), rr = r.getBoundingClientRect(); btns.push({ t: b.textContent.trim(), disabled: b.disabled, bg: getComputedStyle(b).backgroundColor, inside: x.left >= rr.left - 1 && x.right <= rr.right + 1 && x.top >= rr.top - 1 && x.bottom <= rr.bottom + 1 }); }));
          res({ rows: rows.length, scrollable: bodyEl.scrollHeight > bodyEl.clientHeight + 2, lastBottom: Math.round(last.bottom), bodyBottom: Math.round(br.bottom), lastTop: Math.round(last.top), bodyTop: Math.round(br.top), btns });
        }, 350));
      });
      assert.ok(kitchen.rows > 0, `${tag} 灶台應有料理列`);
      assert.ok(kitchen.scrollable, `${tag} 灶台清單應可捲動：${JSON.stringify(kitchen)}`);
      assert.ok(kitchen.lastBottom <= kitchen.bodyBottom + 2 && kitchen.lastTop >= kitchen.bodyTop - 2, `${tag} 捲到底最後一道料理應完整在可視區：${JSON.stringify(kitchen)}`);
      assert.ok(kitchen.btns.every((b) => b.inside), `${tag} 灶台按鈕應在料理卡框內`);
      kitchen.btns.forEach((b) => assert.equal(b.bg, b.disabled ? GREY : YELLOW, `${tag} 灶台按鈕「${b.t}」顏色不符（${b.bg}）`));
      console.log(`OK ${tag} 第 6／9 項（灶台）：可捲動、最後一道完整、按鈕在框內且顏色正確`);
      await page.evaluate(() => window.__farm.closeModal('worldModal'));

      /* ---- 第 8 項：田上提示不溢出（一般＋陽光長標籤） ---- */
      const labelInfo = await page.evaluate(() => {
        const s = window.__farm.state();
        s.sun = { plots: [0], startsAt: Date.now() - 1000, endsAt: Date.now() + 15000, nextAt: Date.now() + 60000, used: [], introduced: true };
        window.__farm.refresh(); if (window.__farm.sunTick) window.__farm.sunTick();
        const tile = s.map.tiles.find((t) => t.plotIndex === 0);
        window.__farm.clickTile(tile.id);
        return tile.id;
      });
      await page.waitForTimeout(500);
      const label = await page.evaluate(() => { const el = document.querySelector('[data-audit="tile-state-label"]'); return el ? { text: el.textContent, sw: el.scrollWidth, cw: el.clientWidth } : null; });
      assert.ok(label, `${tag} 田上提示標籤應存在`);
      assert.ok(label.sw <= label.cw + 1, `${tag} 標籤文字不應溢出（scrollWidth ${label.sw} > clientWidth ${label.cw}）：「${label.text}」`);
      console.log(`OK ${tag} 第 8 項：標籤不溢出（${label.sw}<=${label.cw}）「${label.text.replace(/\n/g, '／')}」`);

      assert.deepEqual(errors, [], `${tag} 頁面錯誤`);
      await ctx.close();
    }
  } finally { await browser.close(); if (server) server.close(); }
  console.log('VERIFIED content R59 layout');
})().catch((e) => { console.error(e); process.exit(1); });
