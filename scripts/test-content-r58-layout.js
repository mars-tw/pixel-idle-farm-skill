'use strict';
/* R58 版面：完成兩步教學後，「今日三件事」三個目標看得到、按得到（R63B 起手機預設收成一行，點一下展開）；
   收合鈕文字與狀態一致（自動收合時寫「展開」，按一次即展開）。 */
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

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    for (const view of [{ w: 390, h: 844, mobile: true }, { w: 1366, h: 768, mobile: false }]) {
      const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, isMobile: view.mobile, hasTouch: view.mobile, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
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
      // 短提示（toast）與對話期間任務卡照 R28 收成一行；等提示消失再量。
      await page.waitForFunction(() => !document.querySelector('#toast-zone > .toast') && !document.querySelector('#worldDialogue:not([hidden])'), null, { timeout: 15000 });
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const box = document.querySelector('#questDock');
        const vis = (e) => { if (!e) return false; const s = getComputedStyle(e), b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.height > 0 && b.bottom <= innerHeight && b.right <= innerWidth + 1; };
        const goals = [...box.querySelectorAll('[data-early-task]')];
        const btn = box.querySelector('[data-audit="quest-collapse"]');
        const folded = box.classList.contains('quest-collapsed') || box.classList.contains('quest-auto-collapsed');
        return { goals: goals.length, visible: goals.filter(vis).length, btn: btn && btn.textContent.trim(), folded };
      });
      assert.equal(r.goals, 3, `${view.w}×${view.h} 今日三件事應有 3 個目標`);
      // R63B 同步（第 5 項）：手機任務卡預設只顯示一行，今日三件事點一下展開才看得到；桌機維持直接可見
      // R67A 同步：手機收合為一行，第三層三件清單完整收起；展開後才顯示三項。
      assert.equal(r.visible, view.mobile ? 0 : 3, `${view.w}×${view.h} 今日三件事可見目標數（實際 ${r.visible}）`);
      assert.equal(r.btn, r.folded ? '展開' : '收合', `${view.w}×${view.h} 收合鈕文字與狀態不一致`);
      // R63B 同步：先確保展開（三個目標看得到），再驗收合／展開一按即切換
      if (r.btn === '展開') { await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(200); const x = await page.evaluate(() => ({ t: document.querySelector('[data-audit="quest-collapse"]').textContent.trim(), n: [...document.querySelectorAll('#questDock [data-early-task]')].filter((g) => g.getBoundingClientRect().height > 0).length })); assert.ok(x.t === '收合' && x.n === 3, `${view.w}×${view.h} 展開後應看到 3 個目標（實際 ${JSON.stringify(x)}）`); }
      await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(200);
      const c = await page.evaluate(() => document.querySelector('[data-audit="quest-collapse"]').textContent.trim());
      assert.equal(c, '展開', `${view.w}×${view.h} 按收合後應顯示「展開」`);
      await page.locator('[data-audit="quest-collapse"]').click(); await page.waitForTimeout(200);
      const e = await page.evaluate(() => ({ t: document.querySelector('[data-audit="quest-collapse"]').textContent.trim(), n: [...document.querySelectorAll('#questDock [data-early-task]')].filter((g) => g.getBoundingClientRect().height > 0).length }));
      assert.ok(e.t === '收合' && e.n === 3, `${view.w}×${view.h} 再按一次應展開並看到 3 個目標`);
      assert.deepEqual(errors, [], `${view.w}×${view.h} 頁面錯誤`);
      console.log(`OK ${view.w}×${view.h} 今日三件事 3 個目標可見、收合鈕一按即切換`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log('VERIFIED content R58 layout');
})().catch((e) => { console.error(e); process.exit(1); });
