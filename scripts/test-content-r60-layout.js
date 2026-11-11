'use strict';
/* R60 B 線（計畫第 6～9 項）版面量測：
   6 手札先列現在可做的鄰居委託，其餘收在可展開的「之後的委託（N）」，不展開至少一張可做委託完整可見；
   7 手機收成只保留一個主要收成按鈕，文字不斷行；
   8 今日三件事每項標題與說明分開，標題一行、說明最後一行至少兩字；
   9 手機開場右上資源列完整在畫面內。
   四種尺寸：1366×768、1366×600、390×844、844×390。
   本機沙箱無法 listen／無 Playwright 瀏覽器時可用環境變數改走 file 與系統 Chrome（比照 R59）：
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

function lastLineInfo() {
  const el = arguments[0];
  const lines = new Map();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const txt = node.textContent;
    const rng = document.createRange();
    for (let i = 0; i < txt.length; i++) {
      rng.setStart(node, i); rng.setEnd(node, i + 1);
      const rs = [...rng.getClientRects()].filter((r) => r.height > 0);
      if (!rs.length) continue;
      const key = Math.round(rs[0].top);
      lines.set(key, (lines.get(key) || '') + txt[i]);
    }
  }
  const arr = [...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  return { lineCount: arr.length, last: arr.length ? arr[arr.length - 1].trim() : '' };
}

(async () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/content-r58b.css'), 'utf8');
  assert.match(css, /R60B/, 'content-r58b.css 末尾應有 R60B 規則');
  assert.match(css, /\.r60-later-quests/, '應有「之後的委託」群組樣式');
  assert.match(css, /\.r60-later-quests:not\(\[open\]\)/, '未展開時應藏起之後的委託卡');
  assert.match(css, /world-objective-route > b\s*\{\s*display:\s*block/, '今日三件事標題應獨立一行');
  assert.match(css, /world-objective-route > small\s*\{\s*display:\s*block/, '今日三件事說明應獨立成行');
  assert.match(css, /data-action="harvest"[\s\S]{0,200}#actionA/, '手機中央收成出現時應藏起右下互動鈕');
  const worldUi = fs.readFileSync(path.join(ROOT, 'src/world-ui.js'), 'utf8');
  assert.match(worldUi, /之後的委託（/, '手札應有可展開的「之後的委託（N）」小標題');
  assert.match(worldUi, /r60-available-card/, '現在可做的委託應有專屬標記');
  const uiJs = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  assert.match(uiJs, /r60-later-quests/, '首屏收合應避開「之後的委託」群組');

  const useFile = process.env.FARM_TEST_FILE === '1';
  const server = useFile ? null : await serve();
  const base = useFile ? 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html' : `http://127.0.0.1:${server.address().port}/index.html`;
  const launch = { headless: true };
  if (process.env.FARM_TEST_CHROME) { launch.executablePath = process.env.FARM_TEST_CHROME; launch.args = ['--no-sandbox']; }
  const browser = await chromium.launch(launch);
  try {
    for (const view of VIEWS) {
      const tag = `${view.w}×${view.h}`;
      const isRequiredStoryView = (view.w === 1366 && view.h === 768) || (view.w === 390 && view.h === 844);
      const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, isMobile: view.mobile, hasTouch: view.mobile, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(base);
      await page.waitForFunction(() => window.__farm && !document.querySelector('#startupLoading'), null, { timeout: 30000 });

      /* ---- 第 9 項：開場資源列（只在 390×844 為必要驗收，其餘尺寸一併記錄） ---- */
      const resOpen = await page.evaluate(() => {
        const bar = document.querySelector('#resBar');
        const r = bar.getBoundingClientRect();
        const chips = [...bar.querySelectorAll('.res')].map((e) => { const x = e.getBoundingClientRect(); return { right: Math.round(x.right), left: Math.round(x.left) }; });
        return { iw: innerWidth, right: Math.round(r.right), left: Math.round(r.left), chips };
      });
      if (view.w === 390 && view.h === 844) {
        assert.ok(resOpen.right <= resOpen.iw, `${tag} 第 9 項：開場資源列右緣 ${resOpen.right} 應 <= 視窗寬 ${resOpen.iw}`);
        assert.ok(resOpen.chips.every((c) => c.right <= resOpen.iw && c.left >= 0), `${tag} 第 9 項：每顆資源應完整在畫面內：${JSON.stringify(resOpen)}`);
        console.log(`OK ${tag} 第 9 項：開場資源列右緣 ${resOpen.right} <= ${resOpen.iw}`);
      }

      await page.evaluate(() => { const b = document.querySelector('#worldBegin'); if (b) b.click(); });
      await page.evaluate(() => {
        const s = window.__farm.state(), A = window.AdventureAPI, now = Date.now();
        A.record(s, { type: 'talk', npcId: 'mayor' }, now);
        window.plant(s, 0, 'wheat', now); A.record(s, { type: 'plant', cropId: 'wheat', count: 1 }, now);
        A.finishTutorial(s, now);
        window.__farm.refresh(); window.FarmWorld.refresh(s);
      });
      await page.waitForFunction(() => document.querySelector('#questDock')?.dataset.quest === 'early_free_choice', null, { timeout: 5000 });
      await page.waitForTimeout(400);

      /* ---- 第 8 項：今日三件事標題與說明分開 ---- */
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; const t = document.querySelector('#toast-zone'); if (t) t.innerHTML = ''; });
      const collapsed = await page.evaluate(() => { const b = document.querySelector('#questDock'); return b.classList.contains('quest-collapsed') || b.classList.contains('quest-auto-collapsed') || b.classList.contains('quest-target-collapsed'); });
      if (collapsed) { await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(350); }
      await page.evaluate(() => { const d = document.querySelector('#worldDialogue'); if (d) d.hidden = true; });
      const q8 = await page.evaluate((fnSrc) => {
        const lastLineInfoFn = eval('(' + fnSrc + ')');
        const routes = [...document.querySelectorAll('#questDock .world-objective-route')].filter((r) => r.getBoundingClientRect().height > 0);
        return routes.map((rt) => {
          const b = rt.querySelector('b'), sm = rt.querySelector('small');
          const br = b.getBoundingClientRect(), sr = sm.getBoundingClientRect();
          return {
            title: b.textContent.trim(), bDisplay: getComputedStyle(b).display, smDisplay: getComputedStyle(sm).display,
            bLines: [...b.getClientRects()].filter((r) => r.height > 0).length, bBottom: Math.round(br.bottom), smTop: Math.round(sr.top),
            detail: lastLineInfoFn(sm),
          };
        });
      }, lastLineInfo.toString());
      assert.ok(q8.length >= 3, `${tag} 第 8 項：今日三件事應有三項，實際 ${q8.length}：${JSON.stringify(q8)}`);
      for (const row of q8) {
        assert.equal(row.bDisplay, 'block', `${tag} 第 8 項：「${row.title}」標題應獨立成行（display=${row.bDisplay}）`);
        assert.equal(row.smDisplay, 'block', `${tag} 第 8 項：「${row.title}」說明應獨立成行（display=${row.smDisplay}）`);
        assert.equal(row.bLines, 1, `${tag} 第 8 項：「${row.title}」標題應只有一行，實際 ${row.bLines}`);
        assert.ok(row.bBottom <= row.smTop + 1, `${tag} 第 8 項：「${row.title}」標題與說明應上下分開（${row.bBottom} vs ${row.smTop}）`);
        assert.ok(row.detail.last.length >= 2, `${tag} 第 8 項：「${row.title}」說明最後一行不應只有單一字：「${row.detail.last}」`);
      }
      console.log(`OK ${tag} 第 8 項：三項標題各一行、說明分開且最後一行至少兩字`);

      /* ---- 第 7 項：手機收成只有一個主要入口 ----
         R76 整合（規則改了，測試同步，沒有放寬）：任務卡叫玩家把某一格留著等光時，那一格不再把「收成」當建議動作——
         田上寫「先別收」、中央不出收成鈕、右下互動鈕寫「等光」。這一段原本沒有固定光的狀態，
         量到的其實是「先別收」的畫面，靠右下互動鈕寫「收成・小麥田」湊成一個入口；那正是 R76 修掉的矛盾。
         現在把光的狀態固定住，兩種情境各驗一次：等光那一格收成入口 0 個；沒有光要等時仍然恰好 1 個、文字單行（原規則不變）。 */
      if (view.mobile) {
        const measureHarvest = () => page.evaluate(() => {
          const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
          const textLines = (el) => { const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const tops = new Set(); let n; while ((n = walker.nextNode())) { if (!n.textContent.trim()) continue; const rng = document.createRange(); rng.selectNodeContents(n); [...rng.getClientRects()].filter((r) => r.height > 0).forEach((r) => tops.add(Math.round(r.top))); } return tops.size; };
          const sceneBtn = document.querySelector('#sceneActionBar button[data-action="harvest"]');
          const thumb = document.querySelector('#actionA');
          const thumbIsHarvest = !!(thumb && (thumb.dataset.harvest === 'ready' || /收成/.test(thumb.textContent)));
          const scene = sceneBtn && vis(sceneBtn) ? { text: sceneBtn.textContent.trim(), lines: textLines(sceneBtn) } : null;
          const thumbRow = thumb && thumbIsHarvest && vis(thumb) ? { text: thumb.textContent.trim(), lines: textLines(thumb) } : null;
          const label = document.querySelector('[data-audit="tile-state-label"]');
          const step = window.AdventureAPI.nextFarmStep(window.__farm.state(), Date.now()) || {};
          return {
            scene, thumb: thumbRow, count: (scene ? 1 : 0) + (thumbRow ? 1 : 0),
            label: label && !label.hidden ? label.textContent.trim() : null,
            thumbShown: thumb && vis(thumb) ? { text: thumb.textContent.trim(), lines: textLines(thumb) } : null,
            step: { action: step.action, plotIndex: step.plotIndex, holdPlotIndex: step.holdPlotIndex },
          };
        });
        const stepHoldsPlot0 = (step) => step.holdPlotIndex === 0 || (step.plotIndex === 0 && (step.action === 'catch_sun' || step.action === 'refract'));

        // 7a：光快落在這一格，任務卡叫玩家先別收 → 沒有收成入口
        await page.evaluate(() => {
          const s = window.__farm.state(), now = Date.now();
          window.__r60Player = { tileId: s.player.tileId, x: s.player.x, y: s.player.y, facing: s.player.facing };
          const p = s.plots[0]; p.cropId = 'wheat'; p.plantedAt = now - 3600000; p.wateredAt = now - 3600000;
          Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [0], previewAt: now + 60000, nextAt: now + 60000 });
          window.__farm.refresh(); window.FarmWorld.refresh(s);
          const tile = s.map.tiles.find((t) => t.plotIndex === 0);
          /* 直接點成熟田仍然會走過去收（刻意留的逃生口）。這裡只要選取那一格看畫面寫什麼，點完立刻取消走路。 */
          window.__farm.clickTile(tile.id); window.__farm.cancelJourney();
        });
        await page.waitForTimeout(300);
        const held = await measureHarvest();
        assert.ok(stepHoldsPlot0(held.step), `${tag} 第 7 項（等光）：任務卡應把第 1 格留著等光，實際 ${JSON.stringify(held.step)}`);
        assert.match(String(held.label), /^小麥・先別收/, `${tag} 第 7 項（等光）：田上標籤應寫「先別收」，實際「${held.label}」`);
        assert.equal(held.count, 0, `${tag} 第 7 項（等光）：留著等光的那一格不應有收成主按鈕，實際 ${JSON.stringify(held)}`);
        // 站到那一格旁邊、面向它：右下互動鈕寫「等光」，不寫「收成」
        await page.evaluate(() => {
          const s = window.__farm.state();
          const tile = s.map.tiles.find((t) => t.plotIndex === 0);
          const adj = s.map.tiles.find((t) => t.x === tile.x && t.y === tile.y + 1) || s.map.tiles.find((t) => t.x === tile.x + 1 && t.y === tile.y);
          Object.assign(s.player, { tileId: adj.id, x: adj.x, y: adj.y, facing: window.facingTo(adj, tile) });
          window.__farm.cancelJourney(); window.__farm.refresh();
        });
        await page.waitForTimeout(500);
        const facing = await measureHarvest();
        assert.ok(stepHoldsPlot0(facing.step), `${tag} 第 7 項（等光）：站到田邊後任務卡仍應把第 1 格留著等光，實際 ${JSON.stringify(facing.step)}`);
        assert.equal(facing.count, 0, `${tag} 第 7 項（等光）：面向留著等光的那一格時不應有收成主按鈕，實際 ${JSON.stringify(facing)}`);
        assert.ok(facing.thumbShown && /^等光・/.test(facing.thumbShown.text), `${tag} 第 7 項（等光）：右下互動鈕應寫「等光・…」，實際 ${JSON.stringify(facing.thumbShown)}`);
        assert.equal(facing.thumbShown.lines, 1, `${tag} 第 7 項（等光）：右下互動鈕「${facing.thumbShown.text}」文字應只有一行，實際 ${facing.thumbShown.lines}`);
        console.log(`OK ${tag} 第 7 項（等光）：田上「${held.label.split('\n')[0]}」、沒有收成主按鈕、右下互動鈕「${facing.thumbShown.text}」`);

        // 7b：沒有光要等 → 收成主按鈕恰好一個（原規則）
        await page.evaluate(() => {
          const s = window.__farm.state(), now = Date.now();
          Object.assign(s.player, window.__r60Player); delete window.__r60Player;
          Object.assign(s.sun, { plots: [], used: [], startsAt: 0, endsAt: 0, previewPlots: [], previewAt: 0, nextAt: now + 600000 });
          window.__farm.cancelJourney(); window.__farm.refresh(); window.FarmWorld.refresh(s);
          const tile = s.map.tiles.find((t) => t.plotIndex === 0);
          window.__farm.clickTile(tile.id);
        });
        await page.waitForTimeout(700);
        const q7 = await measureHarvest();
        assert.ok(q7.step.action === 'harvest' && !stepHoldsPlot0(q7.step), `${tag} 第 7 項：沒有光要等時任務卡應直接叫玩家收成，實際 ${JSON.stringify(q7.step)}`);
        assert.equal(q7.count, 1, `${tag} 第 7 項：可見的收成主按鈕應只有一個，實際 ${JSON.stringify(q7)}`);
        const kept = q7.scene || q7.thumb;
        assert.equal(kept.lines, 1, `${tag} 第 7 項：保留的收成按鈕「${kept.text}」文字應只有一行，實際 ${kept.lines}`);
        console.log(`OK ${tag} 第 7 項：收成主按鈕只有一個「${kept.text}」且文字單行`);
      }

      /* ---- 第 6 項：手札先給現在能做的 ---- */
      await page.evaluate(() => window.FarmWorld.openPanel('story'));
      await page.waitForTimeout(900);
      const measureStory = () => page.evaluate(() => {
        const body = document.querySelector('.side-panel.world-panel-open .side-body') || document.querySelector('.side-body');
        const br = body.getBoundingClientRect();
        const pane = document.querySelector('.side-pane[data-pane="story"]');
        const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const avail = [...pane.querySelectorAll('.r60-available-card')].map((c) => { const r = c.getBoundingClientRect(); return { id: c.dataset.r58PersonalCard, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), hidden: c.classList.contains('r32-panel-hidden'), inDetails: !!c.closest('.r60-later-quests') }; });
        const details = pane.querySelector('.r60-later-quests');
        const laterVisible = details ? [...details.querySelectorAll('.r58-card')].filter((c) => c.getBoundingClientRect().height > 0).length : 0;
        const summary = pane.querySelector('.r60-later-summary');
        const showMore = pane.querySelector('.r32-show-more');
        const cards = [...pane.querySelectorAll('.adventure-quest,.r58-card,.order,.story-card')].filter((c) => c.getBoundingClientRect().height > 0);
        let overlap = 0;
        [summary, showMore].forEach((bar) => { if (!bar) return; const bb = bar.getBoundingClientRect(); if (bb.height <= 0) return; cards.forEach((c) => { if (c.contains(bar) || bar.contains(c)) return; overlap += inter(bb, c.getBoundingClientRect()); }); });
        const first = avail[0] || null;
        const main = pane.querySelector('[data-r63a-main-story]'); const mainRect = main && main.getBoundingClientRect();
        const eventCard = pane.querySelector('.r60-event-card'); const eventRect = eventCard && eventCard.getBoundingClientRect();
        return {
          body: { top: Math.round(br.top), bottom: Math.round(br.bottom), left: Math.round(br.left), right: Math.round(br.right) },
          avail, laterCount: details ? details.querySelectorAll('.r58-card').length : 0, laterVisible,
          summaryText: summary ? summary.textContent.trim() : '', detailsOpen: details ? details.open : null,
          firstInBody: !!(first && first.top >= br.top - 1 && first.bottom <= br.bottom + 1 && first.left >= br.left - 1 && first.right <= br.right + 1 && !first.hidden),
          mainInBody: !!(mainRect && mainRect.top >= br.top - 1 && mainRect.bottom <= br.bottom + 1),
          eventInBody: !!(eventRect && eventRect.top >= br.top - 1 && eventRect.bottom <= br.bottom + 1),
          overlap: Math.round(overlap),
        };
      });
      let story = await measureStory();
      assert.ok(story.avail.length >= 1, `${tag} 第 6 項：應至少有一張現在可做的委託：${JSON.stringify(story)}`);
      assert.ok(story.avail.every((c) => !c.inDetails), `${tag} 第 6 項：現在可做的委託不應收在「之後的委託」裡`);
      assert.ok(story.avail.every((c) => !c.hidden), `${tag} 第 6 項：現在可做的委託不應被首屏收合藏起：${JSON.stringify(story.avail)}`);
      assert.ok(story.detailsOpen === false, `${tag} 第 6 項：「之後的委託」預設應收合`);
      assert.equal(story.laterVisible, 0, `${tag} 第 6 項：「之後的委託」未展開時不應露出卡片`);
      assert.match(story.summaryText, new RegExp(`之後的委託（${story.laterCount}）`), `${tag} 第 6 項：小標題應寫「之後的委託（N）」，實際「${story.summaryText}」`);
      assert.equal(story.overlap, 0, `${tag} 第 6 項：「再顯示／之後的委託」不應覆蓋任何卡片（交集 ${story.overlap}）`);
      if (isRequiredStoryView) {
        assert.ok(story.firstInBody || story.mainInBody, `${tag} R68：三層主線卡或第一張可做委託至少一張完整在可視區：${JSON.stringify(story)}`);
        console.log(`OK ${tag} 第 6 項：三層主線／可做委託至少一張完整可見，之後的委託 ${story.laterCount} 張已收合且無覆蓋`);
        // 事件卡在上方時，第一張可做委託仍完整可見
        await page.evaluate(() => { const st = window.__farm.state(), A = window.AdventureAPI, now = Date.now(); A.ensure(st, now); st.adventure.r58.nextEventAt = 0; A.maybeTriggerRandomEvent(st, now, (() => { const q = [0.05, 0.5]; return () => (q.length ? q.shift() : 0.5); })()); window.__farm.refresh(); window.FarmWorld.refresh(st); });
        await page.waitForTimeout(800);
        const withEvent = await measureStory();
        if (await page.evaluate(() => !!document.querySelector('.r60-event-card'))) {
          assert.ok(withEvent.mainInBody && withEvent.eventInBody, `${tag} 第 6 項：R63 主線卡與事件卡都應完整在可視區：${JSON.stringify(withEvent)}`);
          assert.equal(withEvent.overlap, 0, `${tag} 第 6 項：事件情境下「之後的委託」不應覆蓋卡片`);
          console.log(`OK ${tag} 第 6 項（事件情境）：R63 主線卡與事件卡完整可見，可做委託接續在下方`);
        } else {
          console.log(`SKIP ${tag} 第 6 項（事件情境）：此時段未觸發小事件`);
        }
        await page.evaluate(() => { const st = window.__farm.state(), A = window.AdventureAPI, ev = A.randomEvents(st, Date.now()).active; if (ev) { const opt = ev.options[ev.options.length - 1]; A.resolveRandomEvent(st, opt.id, Date.now()); window.__farm.refresh(); window.FarmWorld.refresh(st); } });
        await page.waitForTimeout(400);
      } else {
        console.log(`OK ${tag} 第 6 項（分組）：可做 ${story.avail.length} 張、之後的委託 ${story.laterCount} 張已收合`);
      }

      assert.deepEqual(errors, [], `${tag} 頁面錯誤`);
      await ctx.close();
    }
  } finally { await browser.close(); if (server) server.close(); }
  console.log('VERIFIED content R60 layout');
})().catch((e) => { console.error(e); process.exit(1); });
