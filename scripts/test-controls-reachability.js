/* farm R68 control reachability gate: 164 controls + modal mutual exclusion + viewport hit testing. */
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EVIDENCE = path.join(ROOT, "docs", "evidence", "R68", "controls");
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
};
let failed = 0;
let reachableControlsChecked = 0;
const EXPECTED_REACHABLE_CONTROLS = 272; // R74：9 視口各新增 2 張建物卡＋泡泡入口＋磚資訊升級鈕（236+36）

function assert(condition, message) {
  if (condition) console.log("  ✓ " + message);
  else { console.error("  ✗ " + message); failed++; }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
      const safePath = pathname === "/" ? "/index.html" : pathname;
      const file = path.resolve(ROOT, "." + safePath);
      const rel = path.relative(ROOT, file);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const VIEWPORTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080, touch: false },
  { name: "desktop-1440x780", width: 1440, height: 780, touch: false, evidence: "desktop-1440x780.png" },
  { name: "desktop-1366x600", width: 1366, height: 600, touch: false, evidence: "desktop-1366x600.png" },
  { name: "desktop-1280x640", width: 1280, height: 640, touch: false },
  { name: "touch-laptop-1366x640", width: 1366, height: 640, touch: true, mobile: false },
  { name: "phone-390x844", width: 390, height: 844, touch: true, mobile: true, evidence: "mobile-390x844.png" },
  { name: "tablet-820x1180", width: 820, height: 1180, touch: true, mobile: true },
  // R70：老闆回報橫式 D-pad×種子鍵重疊、守門卻無橫式視口——補盲區
  { name: "phone-landscape-844x390", width: 844, height: 390, touch: true, mobile: true },
  { name: "phone-landscape-932x430", width: 932, height: 430, touch: true, mobile: true },
];

async function closeInitialModal(page) {
  await page.waitForFunction(() => !document.getElementById("startupLoading"));
  const close = page.locator("#howToOk");
  if (await close.isVisible()) await close.click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
}

async function controlMetrics(page, selector) {
  return page.evaluate((query) => [...document.querySelectorAll(query)].filter((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return !el.disabled && cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity !== 0 && r.width > 0 && r.height > 0;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const centerInViewport = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight;
    const hit = centerInViewport ? document.elementFromPoint(x, y) : null;
    return {
      label: el.id || el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 24) || el.className,
      width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      centerInViewport,
      centerHit: !!hit && (hit === el || el.contains(hit)),
      hit: hit ? (hit.id || hit.getAttribute("aria-label") || hit.className || hit.tagName) : "none",
    };
  }), selector);
}

function assertReachable(tag, metrics) {
  reachableControlsChecked += metrics.length;
  assert(metrics.length > 0, `${tag} 有載入關鍵控制`);
  const undersized = metrics.filter((item) => item.width < 44 || item.height < 44);
  const unreachable = metrics.filter((item) => !item.centerInViewport || !item.centerHit);
  assert(undersized.length === 0, `${tag} ${metrics.length} 顆關鍵控制命中目標全數 ≥44px` +
    (undersized.length ? `：${undersized.map((item) => `${item.label} ${Math.round(item.width)}×${Math.round(item.height)}`).join(", ")}` : ""));
  assert(unreachable.length === 0, `${tag} ${metrics.length} 顆關鍵控制中心皆在視口內且命中自身` +
    (unreachable.length ? `：${unreachable.map((item) => `${item.label}(hit=${item.hit}, top=${Math.round(item.top)}, bottom=${Math.round(item.bottom)})`).join(", ")}` : ""));
}

async function assertModal(page, tag, options = {}) {
  if (options.programmaticOpen) await page.evaluate(() => document.getElementById("howToBtn").click());
  else await page.click("#howToBtn");
  await page.waitForFunction(() => document.getElementById("howToModal").classList.contains("show"));
  const result = await page.evaluate(() => {
    const modal = document.getElementById("howToModal");
    const close = document.getElementById("howToOk");
    const background = document.getElementById("settingsBtn");
    const appShell = document.querySelector(".wrap");
    const backgroundControls = [
      "#genderToggle", "#settingsBtn", "#spriteToggle", "#howToBtn", "#resetBtn",
      "#mobileControls .dpad-btn", "#actionA",
    ].flatMap((selector) => [...document.querySelectorAll(selector)]).filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    const visibleBackgroundControls = backgroundControls.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
    });
    const r = close.getBoundingClientRect();
    const br = background.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const backgroundHit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return {
      closeVisible: r.width >= 44 && r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight,
      closeHit: hit === close || close.contains(hit),
      backgroundBlocked: !(backgroundHit === background || background.contains(backgroundHit)),
      backgroundHit: backgroundHit && (backgroundHit.id || backgroundHit.className || backgroundHit.tagName),
      zIndex: Number(getComputedStyle(modal).zIndex),
      appShellInert: !!appShell && appShell.inert && appShell.hasAttribute("inert"),
      allBackgroundInert: backgroundControls.length > 0 && backgroundControls.every((el) => !!el.closest("[inert]")),
      visibleBackgroundBlocked: visibleBackgroundControls.every((el) => {
        const rect = el.getBoundingClientRect();
        const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
        const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
        const top = document.elementFromPoint(x, y);
        return !!top && modal.contains(top);
      }),
      focusInside: modal.contains(document.activeElement),
      backgroundCount: backgroundControls.length,
      visibleBackgroundCount: visibleBackgroundControls.length,
    };
  });
  assert(result.closeVisible && result.closeHit, `${tag}「怎麼玩」關閉鈕固定在視口內且可點`);
  assert(result.backgroundBlocked && result.zIndex > 9900,
    `${tag} modal 高於遊戲控制並攔截背景點擊（hit=${result.backgroundHit}, z=${result.zIndex}）`);
  assert(result.appShellInert && result.allBackgroundInert && result.visibleBackgroundBlocked && result.focusInside,
    `${tag} modal 開啟時背景 ${result.backgroundCount} 顆控制全數 inert、可見 ${result.visibleBackgroundCount} 顆由 modal 攔截，焦點留在 modal`);
  const playerBefore = await page.evaluate(() => {
    const player = window.__farm.state().player;
    return { x: player.x, y: player.y, facing: player.facing };
  });
  await page.keyboard.press("ArrowRight");
  await page.evaluate(() => {
    const dpad = document.querySelector('.dpad-btn[data-dir="left"]');
    const action = document.getElementById("actionA");
    if (dpad) {
      dpad.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 67, pointerType: "touch" }));
      dpad.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 67, pointerType: "touch" }));
    }
    if (action) action.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForTimeout(80);
  const playerAfter = await page.evaluate(() => {
    const player = window.__farm.state().player;
    return { x: player.x, y: player.y, facing: player.facing };
  });
  assert(JSON.stringify(playerAfter) === JSON.stringify(playerBefore),
    `${tag} modal 開啟時鍵盤、D-pad 與 A 鍵事件不改變玩家狀態`);
  await page.click("#howToOk");
  const restored = await page.evaluate(() => {
    const appShell = document.querySelector(".wrap");
    return !!appShell && !appShell.inert && !appShell.hasAttribute("inert") && !document.body.classList.contains("modal-open");
  });
  assert(restored, `${tag} modal 關閉後解除背景 inert`);
}

async function assertSettingsSeriesLinks(page, tag) {
  await page.locator("#settingsBtn").click();
  await page.waitForFunction(() => document.getElementById("settingsModal").classList.contains("show"));
  const links = page.locator("#settingsSeriesLinks a");
  assert(await links.count() === 3, `${tag} 設定內載入 3 條系列連結`);
  for (let i = 0; i < 3; i++) {
    await links.nth(i).scrollIntoViewIfNeeded();
    assertReachable(`${tag} 系列連結 ${i + 1}`, await controlMetrics(page, `#settingsSeriesLinks a:nth-child(${i + 1})`));
  }
  await page.locator("#settingsOk").click();
  await page.waitForFunction(() => !document.querySelector(".modal.show"));
}

async function assertBuildingUpgradeControls(page, tag) {
  await page.evaluate(() => {
    const state = window.__farm.state();
    state.coins = 10000;
    state.materials = { wood: 100, stone: 100, compost: 100 };
    window.__farm.refresh();
  });
  await page.locator('.side-tab[data-tab="upgrades"]').click();
  for (const id of ["b_coop", "b_barn"]) {
    const selector = `#buildingUpgrades .building-upgrade-btn[data-building-id="${id}"]`;
    const button = page.locator(selector);
    await button.scrollIntoViewIfNeeded();
    assertReachable(`${tag} ${id} 建物卡升級鈕`, await controlMetrics(page, selector));
  }
  await page.evaluate(() => {
    const panel = document.querySelector(".side-panel");
    if (panel) panel.classList.add("panes-collapsed");
    const coop = document.querySelector('.ob[data-structure-id="coop"]');
    if (coop) coop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const bubble = document.getElementById("objectBubble");
    return bubble && !bubble.hidden && bubble.querySelector('[data-action="upgrade"]');
  });
  assertReachable(`${tag} 建物泡泡升級入口`, await controlMetrics(page, '#objectBubble [data-action="upgrade"]'));
  await page.locator('#objectBubble [data-action="upgrade"]').click();
  await page.waitForFunction(() => document.querySelector('#tileContext .building-upgrade-btn[data-building-id="b_coop"]'));
  const contextSelector = '#tileContext .building-upgrade-btn[data-building-id="b_coop"]';
  await page.locator(contextSelector).scrollIntoViewIfNeeded();
  assertReachable(`${tag} 磚資訊建物升級鈕`, await controlMetrics(page, contextSelector));
}

async function assertNonModalNoOverlap(page, tag) {
  const result = await page.evaluate(() => {
    const selectors = "button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [tabindex]:not([tabindex='-1'])";
    const controls = [...document.querySelectorAll(selectors)].filter((el) => {
      if (el.closest(".modal") || el.disabled || el.closest("[inert]")) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 &&
        rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
    });
    const label = (el) => el.id || el.getAttribute("aria-label") || el.getAttribute("data-tab") ||
      (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24) || el.className || el.tagName;
    const overlaps = [];
    for (let i = 0; i < controls.length; i++) {
      const a = controls[i];
      const ar = a.getBoundingClientRect();
      for (let j = i + 1; j < controls.length; j++) {
        const b = controls[j];
        if (a.contains(b) || b.contains(a)) continue;
        const br = b.getBoundingClientRect();
        const overlapX = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const overlapY = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        if (overlapX > 1 && overlapY > 1) {
          overlaps.push(`${label(a)}<>${label(b)}(ox=${Math.round(overlapX)},oy=${Math.round(overlapY)},a=${Math.round(ar.top)}-${Math.round(ar.bottom)},b=${Math.round(br.top)}-${Math.round(br.bottom)})`);
        }
      }
    }
    return { count: controls.length, overlaps };
  });
  assert(result.count > 0 && result.overlaps.length === 0,
    `${tag} 非 modal 互動元素兩兩不相交（排除父子，共 ${result.count} 顆）` +
      (result.overlaps.length ? `：${result.overlaps.slice(0, 12).join(", ")}` : ""));
}

async function assertTouchActionDock(page, tag) {
  const opened = await page.evaluate(() => {
    const state = window.__farm.state();
    const tile = state.map.tiles.find((item) => item.plotIndex === 0);
    const el = tile && document.querySelector(`.gtile[data-tile-id="${tile.id}"]`);
    if (!el) return false;
    el.dispatchEvent(new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
    return true;
  });
  assert(opened, `${tag} 可由觸控農地開啟 action dock`);
  await page.waitForFunction(() => {
    const bar = document.getElementById("sceneActionBar");
    return bar && !bar.hidden && bar.querySelector("button");
  });
  const result = await page.evaluate(() => {
    const actionButtons = [...document.querySelectorAll("#sceneActionBar button")];
    const movementButtons = [...document.querySelectorAll("#mobileControls button")];
    const all = [...actionButtons, ...movementButtons];
    const metrics = all.map((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      const ok = hit === el || el.contains(hit);
      return { width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        hit: ok,
        hitName: hit ? (hit.id || hit.getAttribute("aria-label") || String(hit.className).slice(0, 30) || hit.TAG) : "none",
        stack: ok ? undefined : document.elementsFromPoint(x, y).slice(0, 5).map((e) => e.id || String(e.className).slice(0, 20) || e.tagName),
        mcDisplay: ok ? undefined : getComputedStyle(document.getElementById("mobileControls")).display,
        scrollY: ok ? undefined : (document.querySelector(".wrap").scrollTop + "," + window.scrollY) };
    });
    const overlaps = [];
    for (let i = 0; i < actionButtons.length; i++) {
      const a = actionButtons[i].getBoundingClientRect();
      for (let j = 0; j < movementButtons.length; j++) {
        const b = movementButtons[j].getBoundingClientRect();
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) overlaps.push([i, j, overlapX, overlapY]);
      }
    }
    return { metrics, actionCount: actionButtons.length, movementCount: movementButtons.length,
      overlaps, assistantVisible: getComputedStyle(document.getElementById("smartAssistant")).display !== "none" };
  });
  const scenarioActions = ["plant", "harvest", "water", "clear"];
  const scenarioMetrics = [];
  for (const action of scenarioActions) {
    const prepared = await page.evaluate((scenario) => {
      const state = window.__farm.state();
      state.coins = Math.max(10000, state.coins || 0);
      let tile = state.map.tiles.find((item) => item.plotIndex === 0);
      const plot = state.plots[0];
      if (scenario === "plant") {
        plot.cropId = null; plot.plantedAt = 0; plot.wateredAt = 0;
        window.__farm.setTool("hand");
      } else if (scenario === "harvest") {
        plot.cropId = "wheat"; plot.plantedAt = Date.now() - 60000; plot.wateredAt = 0;
        window.__farm.setTool("hand");
      } else if (scenario === "water") {
        plot.cropId = "wheat"; plot.plantedAt = Date.now(); plot.wateredAt = 0;
        window.__farm.setTool("hand");
      } else {
        tile = state.map.tiles.find((item) => item.object);
        window.__farm.setTool("clear");
      }
      window.__farm.refresh();
      const el = tile && document.querySelector(`.gtile[data-tile-id="${tile.id}"]`);
      if (!el) return false;
      el.dispatchEvent(new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
      return true;
    }, action);
    assert(prepared, `${tag} 可建立 ${action} action-dock 情境`);
    await page.waitForFunction((expected) => {
      const button = document.querySelector(`#sceneActionBar button[data-action="${expected}"]`);
      return button && !button.disabled;
    }, action);
    const metric = await page.evaluate((expected) => {
      const button = document.querySelector(`#sceneActionBar button[data-action="${expected}"]`);
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { action: expected, width: r.width, height: r.height, hit: hit === button || button.contains(hit) };
    }, action);
    scenarioMetrics.push(metric);
  }
  reachableControlsChecked += scenarioMetrics.length;
  assert(scenarioMetrics.length === 4 && scenarioMetrics.every((item) => item.width >= 44 && item.height >= 44 && item.hit),
    `${tag} 種植／收成／澆水／清除 4 顆既有情境控制皆 ≥44px 且中心可命中`);
  assert(result.metrics.every((item) => item.width >= 44 && item.height >= 44 && item.hit),
    `${tag} action dock／D-pad 每顆按鈕 ≥44px 且中心可命中：` + JSON.stringify(result.metrics.filter((item) => !(item.width >= 44 && item.height >= 44 && item.hit))));
  assert(result.overlaps.length === 0 && !result.assistantVisible,
    `${tag} action dock 與 D-pad 不重疊，動作選擇時暫收助手`);
}

async function assertFitMapVisible(page, tag) {
  const result = await page.evaluate(() => {
    const scene = document.getElementById("mapScene");
    const world = document.getElementById("mapWorld");
    const tile = document.querySelector("#groundLayer .gtile");
    const sr = scene.getBoundingClientRect();
    const wr = world.getBoundingClientRect();
    const tr = tile ? tile.getBoundingClientRect() : null;
    return {
      mode: scene.dataset.mapMode,
      scrollW: scene.scrollWidth,
      clientW: scene.clientWidth,
      scrollH: scene.scrollHeight,
      clientH: scene.clientHeight,
      sceneW: sr.width,
      sceneH: sr.height,
      worldW: wr.width,
      worldH: wr.height,
      tileW: tr ? tr.width : 0,
      tileH: tr ? tr.height : 0,
    };
  });
  assert(result.mode === "fit", `${tag} 預設整圖模式（mode=${result.mode}）`);
  assert(result.scrollH <= result.clientH + 2 && result.scrollW <= result.clientW + 2,
    `${tag} 世界完整可見且 #mapScene 零內捲（scroll ${result.scrollW}×${result.scrollH}, client ${result.clientW}×${result.clientH}）`);
  assert(result.worldW <= result.sceneW + 2 && result.worldH <= result.sceneH + 2,
    `${tag} 地圖視覺框完整落在場景內（world ${Math.round(result.worldW)}×${Math.round(result.worldH)}, scene ${Math.round(result.sceneW)}×${Math.round(result.sceneH)}）`);
  assert(result.tileW >= 10 && result.tileH >= 10,
    `${tag} 整圖模式 tile 仍可辨識或可切原尺寸（tile ${Math.round(result.tileW)}×${Math.round(result.tileH)}）`);
}

async function runViewport(browser, base, config) {
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    hasTouch: config.touch,
    isMobile: !!config.mobile,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    await page.goto(base + "?r68-controls=1", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 45000 });
    await closeInitialModal(page);

    const device = await page.evaluate(() => ({
      primaryCoarse: matchMedia("(pointer: coarse)").matches,
      mobileClass: document.documentElement.classList.contains("mobile-controls-enabled"),
      mobileDisplay: getComputedStyle(document.getElementById("mobileControls")).display,
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    }));
    const expectsMobileControls = !!config.mobile;
    assert(device.mobileClass === expectsMobileControls && (device.mobileDisplay !== "none") === expectsMobileControls,
      `${config.name} D-pad 分流正確（primaryCoarse=${device.primaryCoarse}, enabled=${device.mobileClass}）`);
    assert(device.pageScroll <= 2 && device.overflowX <= 2,
      `${config.name} 無頁級捲動／水平溢出（y=${device.pageScroll}, x=${device.overflowX}）`);
    await assertFitMapVisible(page, config.name);

    const selector = [
      "#toolBar .tool", "#questDock button:not([disabled])", expectsMobileControls ? "" : ".toolbar button",
      "#smartAssistant button", "#seedHud .seed:not(.locked)",
      expectsMobileControls ? "#mobileControls button" : "",
    ].filter(Boolean).join(",");
    assertReachable(config.name, await controlMetrics(page, selector));
    await assertNonModalNoOverlap(page, `${config.name} 主場景`);
    await assertModal(page, `${config.name} 主場景`, { programmaticOpen: expectsMobileControls });

    if (config.evidence) {
      fs.mkdirSync(EVIDENCE, { recursive: true });
      await page.screenshot({ path: path.join(EVIDENCE, config.evidence), fullPage: false });
    }

    await page.locator(".side-tabs").scrollIntoViewIfNeeded();
    assertReachable(`${config.name} 側欄 tabs`, await controlMetrics(page, ".side-tabs button"));
    await assertNonModalNoOverlap(page, `${config.name} 側欄分頁`);
    if (expectsMobileControls) {
      await page.locator(".toolbar").scrollIntoViewIfNeeded();
      assertReachable(`${config.name} 底部工具列`, await controlMetrics(page, ".toolbar button"));
      await assertNonModalNoOverlap(page, `${config.name} 底部工具列`);
      await assertSettingsSeriesLinks(page, config.name);
      if (config.evidence) {
        await page.screenshot({ path: path.join(EVIDENCE, "mobile-menu-390x844.png"), fullPage: false });
      }
      await assertModal(page, `${config.name} 底部工具列`);
    }
    if (expectsMobileControls) {
      await page.locator("#mapScene").scrollIntoViewIfNeeded();
      await assertTouchActionDock(page, config.name);
    }
    await assertBuildingUpgradeControls(page, config.name);
    assert(errors.length === 0, `${config.name} 無 pageerror` + (errors.length ? `：${errors.join(" | ")}` : ""));
  } finally {
    await context.close();
  }
}

async function run() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (error) { console.error("需要 devDependency: playwright"); process.exit(2); }
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  try {
    console.log("== farm R68 控制與選單守門 ==");
    const viewportFilter = String(process.env.CONTROLS_VIEWPORT || "").trim();
    const selectedViewports = viewportFilter ? VIEWPORTS.filter((config) => config.name.includes(viewportFilter)) : VIEWPORTS;
    if (!selectedViewports.length) throw new Error(`找不到控制守門視口：${viewportFilter}`);
    for (const config of selectedViewports) await runViewport(browser, base, config);
    if (!viewportFilter) {
      assert(reachableControlsChecked === EXPECTED_REACHABLE_CONTROLS,
        `控制可達性精確覆蓋 ${EXPECTED_REACHABLE_CONTROLS} 項（實測 ${reachableControlsChecked}）`);
      fs.mkdirSync(path.join(ROOT, "docs", "evidence", "R68"), { recursive: true });
      fs.writeFileSync(path.join(ROOT, "docs", "evidence", "R68", "controls-summary.json"), JSON.stringify({
        release: "R68",
        viewports: VIEWPORTS.length,
        reachableControls: reachableControlsChecked,
        expectedReachableControls: EXPECTED_REACHABLE_CONTROLS,
        minimumTargetPx: 44,
        modalMutualExclusion: "PASS",
        nonModalOverlap: "PASS",
        pass: reachableControlsChecked === EXPECTED_REACHABLE_CONTROLS && failed === 0,
      }, null, 2) + "\n");
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) {
    console.error(`\n❌ R68 控制與選單守門失敗：${failed} 項`);
    process.exit(1);
  }
  console.log(`\n✅ R68 控制與選單守門通過（${String(process.env.CONTROLS_VIEWPORT || "").trim() ? "篩選" : `${reachableControlsChecked} 項／7 種`}裝置／視口）`);
}

run().catch((error) => { console.error("R68 控制與選單守門執行失敗：", error); process.exit(1); });
