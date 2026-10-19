const { revealFarmControl } = require("./farm-control-test-helper");
"use strict";
// R79 好玩＋美觀 E2E：陽光光斑實玩、走路改道、任務列等待提示、收成回饋中文化、
// 手機資源列不被系統鈕遮擋、toast 去重與讓位、背景音樂開關、rAF p95 量測。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const evidence = path.join(root, "docs", "evidence", "r79");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".webmanifest": "application/manifest+json" };
let passed = 0, failed = 0;
const results = {};
function check(ok, name, detail) {
  if (ok) { passed++; console.log("PASS " + name); }
  else { failed++; console.log("FAIL " + name + (detail ? " " + JSON.stringify(detail) : "")); }
}
function serve() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    const rel = path.relative(root, file);
    if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
async function open(browser, base, view, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, isMobile: !!view.mobile, hasTouch: !!view.mobile, serviceWorkers: "block", reducedMotion: opts.reducedMotion || "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
  await page.evaluate(() => { const b = document.querySelector("#worldBegin"); if (b) b.click(); });
  return { ctx, page, errors };
}

async function sunpatchPlay(browser, base) {
  const { ctx, page, errors } = await open(browser, base, { w: 1366, h: 768 });
  try {
    await page.evaluate(() => { window.MOVE_MS = 20; });
    // 真實引導：前往鈕走完「和葛瑞交談」與第一次播種
    for (let i = 0; i < 6 && !(await page.evaluate(() => window.__farm.state().stats.plantCount > 0)); i++) {
      await page.locator("#questDock [data-world-go]").click();
      await page.waitForTimeout(1600);
    }
    check(await page.evaluate(() => window.__farm.state().stats.plantCount > 0), "sun: player planted through the real quest button");
    // 第一道光約 4 秒後出現（主迴圈 tick，不手動觸發）
    await page.waitForFunction(() => document.querySelectorAll("#mapWorld .sun-beam").length > 0, null, { timeout: 9000 });
    const first = await page.evaluate(() => ({
      beams: document.querySelectorAll("#mapWorld .sun-beam").length,
      dialogue: (document.querySelector("#worldDialogue:not([hidden])") || {}).textContent || "",
      hint: (document.querySelector("#questDock .world-objective-hint") || {}).textContent || "",
      scene: document.getElementById("mapScene").dataset.sun,
    }));
    check(first.beams >= 1 && first.scene === "on", "sun: first sunpatch appears on its own within ~4s of planting", first);
    check(/陽光/.test(first.dialogue), "sun: first sunpatch is explained once by the mayor", first.dialogue);
    await page.waitForFunction(() => /陽光 \d+ 秒/.test((document.querySelector("#questDock .world-objective-hint") || {}).textContent || ""), null, { timeout: 2500 }).catch(() => {});
    first.hint = await page.evaluate(() => (document.querySelector("#questDock .world-objective-hint") || {}).textContent || "");
    check(/陽光 \d+ 秒/.test(first.hint), "sun: quest dock shows sunpatch countdown", first.hint);
    await page.screenshot({ path: path.join(evidence, "after", "desktop-1366x768-sunpatch.png") });
    // 在光裡收成：把光照的那格設成成熟作物，用手點它（真實 clickTile → 走過去 → 作用幀結算）
    const target = await page.evaluate(() => {
      const s = window.__farm.state();
      const i = s.sun.plots.find((p) => !s.sun.used.includes(p));
      s.plots[i].cropId = "wheat"; s.plots[i].plantedAt = Date.now() - 60000; delete s.plots[i].wateredAt;
      const tile = s.map.tiles.find((t) => t.plotIndex === i);
      return { i, tileId: tile.id, before: s.storage.items.wheat || 0, catches: s.stats.sunCatches || 0 };
    });
    await page.evaluate((id) => { window.__farm.setTool("hand"); window.__farm.clickTile(id); }, target.tileId);
    await page.waitForFunction((i) => !window.__farm.state().plots[i].cropId, target.i, { timeout: 8000 });
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => {
      const s = window.__farm.state();
      return { wheat: s.storage.items.wheat || 0, catches: s.stats.sunCatches, floats: [...document.querySelectorAll(".float")].map((n) => n.textContent), toasts: [...document.querySelectorAll("#toast-zone .toast")].map((n) => n.textContent) };
    });
    check(after.wheat - target.before === 3, "sun: harvest inside sunlight stores wheat yield 2 + 1", { before: target.before, after });
    check(after.catches === target.catches + 1, "sun: sun catch counted once", after);
    check(after.floats.some((t) => /陽光豐收/.test(t)) && after.toasts.some((t) => /陽光 \+1/.test(t)), "sun: catch shows golden float text and toast", after);
    await page.screenshot({ path: path.join(evidence, "after", "desktop-1366x768-sun-catch.png") });
    // 收成回饋：中文連收、飛向倉庫
    const fx = await page.evaluate(() => ({ storageChip: !!document.querySelector(".res.storage"), items: document.querySelectorAll("#screenFxLayer .juice-item").length }));
    check(fx.storageChip, "feedback: storage chip is addressable for harvest fly-to", fx);
    check(errors.length === 0, "sun: no page errors", errors);
  } finally { await ctx.close(); }
}

async function redirectWhileWalking(browser, base, view) {
  const { ctx, page, errors } = await open(browser, base, view);
  try {
    await page.evaluate(() => { window.MOVE_MS = 120; });
    // 先往遠處走，走到一半按「前往」
    await page.evaluate(() => {
      const s = window.__farm.state();
      const far = s.map.tiles.filter((t) => window.isWalkable(s, t) && t.x >= 15).sort((a, b) => b.x - a.x)[0];
      window.__farm.setTool("hand"); window.__farm.clickTile(far.id);
    });
    await page.waitForTimeout(260);
    const moving = await page.evaluate(() => window.__farm.moving());
    const go = page.locator("#questDock [data-world-go]");
    if (view.mobile) await go.tap(); else await go.click();
    await page.waitForTimeout(60);
    const toastText = await page.evaluate(() => document.getElementById("toast-zone").textContent);
    await page.waitForFunction(() => window.__farm.state().adventure.counts.talk > 0 || (window.__farm.state().adventure.byTarget.talk || {}).mayor > 0 || window.__farm.state().stats.plantCount > 0 || !!document.querySelector("#worldDialogue:not([hidden])"), null, { timeout: 20000 }).catch(() => {});
    const done = await page.evaluate(() => ({ dialogue: !!document.querySelector("#worldDialogue:not([hidden])"), counts: window.__farm.state().adventure.counts }));
    check(moving, `redirect ${view.name}: player was mid-walk when pressing 前往`);
    check(!/先走完這段路/.test(toastText), `redirect ${view.name}: no 'wait until walk ends' rejection`, toastText);
    check(done.dialogue || done.counts.talk > 0, `redirect ${view.name}: redirected walk reaches the quest NPC and talks`, done);
    check(errors.length === 0, `redirect ${view.name}: no page errors`, errors);
  } finally { await ctx.close(); }
}

async function waitHint(browser, base) {
  const { ctx, page } = await open(browser, base, { w: 390, h: 844, mobile: true, name: "phone" });
  try {
    const hint = await page.evaluate(() => {
      const s = window.__farm.state();
      const A = window.AdventureAPI, now = Date.now();
      A.record(s, { type: "talk", npcId: "mayor" }, now);
      for (let i = 0; i < 3; i++) { window.plant(s, i, "wheat", now); window.waterPlot(s, i, now); }
      A.record(s, { type: "plant", cropId: "wheat", count: 3 }, now); A.record(s, { type: "water" }, now); A.record(s, { type: "water" }, now); A.record(s, { type: "water" }, now);
      A.claim(s, "c1_homecoming", now);
      s.sun = { plots: [], used: [], startsAt: 0, endsAt: 0, nextAt: now + 600000, introduced: true };
      window.__farm.refresh(); window.FarmWorld.refresh(s);
      return null;
    });
    await page.waitForFunction(() => { const h = document.querySelector("#questDock .world-objective-hint"); return h && h.dataset.hint === "wait"; }, null, { timeout: 5000 }).catch(() => {});
    const text = await page.evaluate(() => (document.querySelector("#questDock .world-objective-hint") || {}).textContent || "");
    check(/最快 \d+ 秒成熟/.test(text), "hint: waiting for harvest shows soonest ripening countdown", text);
    const overlap = await page.evaluate(() => {
      const a = document.getElementById("questDock").getBoundingClientRect();
      const b = document.querySelector("#mapScene .seed-hud").getBoundingClientRect();
      return { dockBottom: a.bottom, seedTop: b.top, ok: b.top >= a.bottom - 1 || b.left >= a.right };
    });
    check(overlap.ok, "hint: taller quest dock never covers the seed bar (phone)", overlap);
    await page.screenshot({ path: path.join(evidence, "after", "phone-390x844-wait-hint.png") });
  } finally { await ctx.close(); }
}

async function hudLayout(browser, base) {
  const views = [
    { name: "phone", w: 390, h: 844, mobile: true },
    { name: "small", w: 320, h: 568, mobile: true },
    { name: "landscape", w: 844, h: 390, mobile: true },
    { name: "laptop", w: 1366, h: 600 },
  ];
  for (const view of views) {
    for (const level of [1, 7]) {
      const { ctx, page } = await open(browser, base, view);
      try {
        const r = await page.evaluate((lv) => {
          const s = window.__farm.state();
          s.level = lv; s.xp = window.LEVEL_XP[lv - 1] || 0; s.materials.wood = 12; s.materials.stone = 4; s.materials.compost = 3;
          window.__farm.refresh(); window.FarmWorld.refresh(s);
          const tb = document.querySelector(".toolbar").getBoundingClientRect();
          const inter = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          const chips = [...document.querySelectorAll("#resBar .res")].map((n) => n.getBoundingClientRect());
          return {
            chips: chips.length,
            overToolbar: chips.filter((c) => inter(c, tb)).length,
            outside: chips.filter((c) => c.left < 0 || c.right > innerWidth + 0.5 || c.top < 0).length,
            docOverflow: document.documentElement.scrollWidth > innerWidth,
            toolbarOverFit: (() => { const f = document.querySelector("#mapFitToggle"); return f ? inter(tb, f.getBoundingClientRect()) : false; })(),
          };
        }, level);
        check(r.chips >= 5 && r.overToolbar === 0 && r.outside === 0 && !r.docOverflow && !r.toolbarOverFit, `hud ${view.name} Lv${level}: resource chips stay clear of system buttons and inside viewport`, r);
        if (level === 7) await page.screenshot({ path: path.join(evidence, "after", `${view.name}-${view.w}x${view.h}-hud-lv7.png`) });
      } finally { await ctx.close(); }
    }
  }
}

async function toastRules(browser, base) {
  for (const view of [{ name: "desktop", w: 1366, h: 768 }, { name: "landscape", w: 844, h: 390, mobile: true }, { name: "phone", w: 390, h: 844, mobile: true }]) {
    const { ctx, page } = await open(browser, base, view);
    try {
      const r = await page.evaluate(() => {
        const t = window.__farm.toast;
        t("同一句"); t("同一句"); t("同一句");
        const same = document.querySelectorAll("#toast-zone .toast").length;
        ["一", "二", "三", "四", "五"].forEach((x) => t("訊息" + x));
        const capped = document.querySelectorAll("#toast-zone .toast").length;
        window.FarmWorld.speak("鎮長 葛瑞", "這是一段比較長的對話，用來確認提示訊息會移到對話框上方，不會壓在一起。");
        t("對話框開著時的提示");
        return { same, capped };
      });
      await page.waitForTimeout(350);
      const geo = await page.evaluate(() => {
        const d = document.getElementById("worldDialogue").getBoundingClientRect();
        const toasts = [...document.querySelectorAll("#toast-zone .toast")].map((n) => n.getBoundingClientRect());
        return { dialogueTop: d.top, overlap: toasts.filter((b) => b.left < d.right && d.left < b.right && b.top < d.bottom && d.top < b.bottom).length, count: toasts.length };
      });
      check(r.same === 1, `toast ${view.name}: identical message within 2.5s shows once`, r);
      check(r.capped <= 3, `toast ${view.name}: at most 3 toasts at once`, r);
      check(geo.overlap === 0, `toast ${view.name}: toasts move above the NPC dialogue`, geo);
      if (view.name !== "desktop") await page.screenshot({ path: path.join(evidence, "after", `${view.name}-${view.w}x${view.h}-toast-dialogue.png`) });
    } finally { await ctx.close(); }
  }
}

async function musicToggle(browser, base) {
  const { ctx, page } = await open(browser, base, { w: 1366, h: 768 });
  try {
    const hasFile = fs.existsSync(path.join(root, "assets", "audio", "r79-sunny-farm-loop.ogg"));
    await page.mouse.click(683, 400);
    await page.waitForTimeout(300);
    const on = await page.evaluate(() => window.__farm.musicInfo());
    if (hasFile) check(on.wanted === true && on.paused === false, "music: plays after first user gesture when sound+music are on", on);
    else check(on.failed === true || on.src === null, "music: missing track fails quietly (asset gap reported)", on);
    if (hasFile) check(/r79-sunny-farm-loop\.(ogg|m4a)/.test(on.src || ""), "music: loop source is the R79 track", on);
    await (await revealFarmControl(page, page.locator("#settingsBtn"))).click();
    const btn = page.locator('[data-setting-key="musicEnabled"]');
    check(await btn.count() === 1, "music: settings has a 背景音樂 toggle");
    await btn.click();
    const off = await page.evaluate(() => ({ info: window.__farm.musicInfo(), setting: window.__farm.state().settings.musicEnabled }));
    check(off.setting === false && off.info.wanted === false && (off.info.paused === true || !hasFile), "music: toggle off pauses the music", off);
    await page.screenshot({ path: path.join(evidence, "after", "desktop-1366x768-settings-music.png") });
  } finally { await ctx.close(); }
}

async function staticChecks() {
  const ui = fs.readFileSync(path.join(root, "src", "ui.js"), "utf8");
  check(!/"combo x"|"Level up"/.test(ui), "copy: no English combo/Level up strings in runtime UI");
  check(/連收 ×/.test(ui) && /升級！/.test(ui), "copy: Chinese 連收 ×N and 升級！ present");
}

async function perf(base) {
  const out = {};
  for (const view of [{ name: "desktop", w: 1366, h: 768 }, { name: "mobile", w: 390, h: 844, mobile: true }]) {
    const runs = [];
    for (let run = 0; run < 3; run++) {
      // Isolate measurement from the many functional contexts/audio sessions above.
      // No flags, visual reductions, timing limits or assertions are changed.
      const sampleBrowser = await chromium.launch({ headless: true });
      let ctx;
      try {
        const opened=await open(sampleBrowser,base,view);ctx=opened.ctx;const page=opened.page;
        await page.evaluate(() => {
          const s = window.__farm.state();
          for (let i = 0; i < 6; i++) window.plant(s, i, "wheat", Date.now() - i * 2000);
          s.sun = { plots: [0, 1], used: [], startsAt: Date.now(), endsAt: Date.now() + 16000, nextAt: Date.now() + 60000, introduced: true };
          window.__farm.refresh(); window.__farm.sunTick();
        });
        await page.waitForTimeout(800);
        const intervals = await page.evaluate(() => new Promise((resolve) => {
          const xs = []; let last = performance.now(); const end = last + 4000;
          function f(t) { xs.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else resolve(xs.slice(5)); }
          requestAnimationFrame(f);
        }));
        const sorted = intervals.slice().sort((a, b) => a - b);
        runs.push(+sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2));
      } finally { if(ctx)await ctx.close();await sampleBrowser.close(); }
    }
    const median = runs.slice().sort((a, b) => a - b)[1];
    out[view.name] = { runsP95Ms: runs, medianP95Ms: median, limitMs: 18, browserIsolation:"fresh headless process per sample; identical scene and assertions", trust: "concurrent-load (other agents share this machine)" };
    check(median <= 18, `perf ${view.name}: rAF p95 median of 3 runs ${median}ms <= 18ms (sunpatch + ambient light on)`, out[view.name]);
  }
  results.perf = out;
}

(async () => {
  fs.mkdirSync(path.join(evidence, "after"), { recursive: true });
  const server = await serve();
  let browser = await chromium.launch({ headless: true });
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  try {
    await staticChecks();
    await sunpatchPlay(browser, base);
    await redirectWhileWalking(browser, base, { name: "desktop", w: 1366, h: 768 });
    await redirectWhileWalking(browser, base, { name: "phone", w: 390, h: 844, mobile: true });
    await waitHint(browser, base);
    await hudLayout(browser, base);
    await toastRules(browser, base);
    await musicToggle(browser, base);
    if (!process.env.R79_SKIP_PERF) {await browser.close();browser=null;await perf(base);}
  } finally {
    if(browser)await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  results.summary = { passed, failed };
  fs.writeFileSync(path.join(evidence, "r79-fun-e2e.json"), JSON.stringify(results, null, 2) + "\n");
  console.log("R79 SUMMARY " + JSON.stringify(results.summary));
  if (failed) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
