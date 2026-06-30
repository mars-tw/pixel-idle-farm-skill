/* =========================================================================
 * test-rpg-v4-e2e.js — Stage 4 RPG 場景 gate E2E（真瀏覽器）
 *
 * 對應 references/production-directive-stage4-game-audit.md：
 *   1. 大世界：地圖 ≥16×12，世界像素 > 視口（camera 可平移）
 *   2. camera follow：角色移動 → 世界平移、角色維持在視口內
 *   3. 視覺：地面磚全用 v4 terrain atlas、物件/角色用 atlas sprite、主地圖 0 emoji、無 CSS 格線
 *   4. 動作走位路由：選工具 → 點地圖 → 角色走過去 → 動作 → 結算（種植/清除）
 *   5. 故事地圖驅動：序章任務鏈（讀告示→種麥→澆水→收成）逐步推進，地圖任務標記指向目標
 *   6. y-sort 遮擋：角色 z-index = 腳底 baseline，建築/物件依 baseline 分層
 *   7. 390px 無水平溢出、無 console / pageerror
 * 執行：node scripts/test-rpg-v4-e2e.js   （需 devDependency: playwright）
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".css": "text/css" };

let failed = 0;
function assert(cond, msg) { if (cond) console.log("  ✓ " + msg); else { console.error("  ✗ " + msg); failed++; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// 等角色走完（moving 變 false）
async function waitArrive(page, max) {
  const t0 = Date.now();
  while (Date.now() - t0 < (max || 6000)) {
    if (!(await page.evaluate(() => window.__farm.moving()))) return true;
    await sleep(120);
  }
  return false;
}

async function run() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.error("需要 devDependency: playwright"); process.exit(2); }

  const server = await startServer();
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port + "/index.html";
  const browser = await chromium.launch();

  for (const vp of [{ w: 1280, h: 900, name: "桌面 1280x900" }, { w: 390, h: 844, name: "手機 390x844" }]) {
    console.log("\n== 視窗 " + vp.name + " ==");
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errors.push("console: " + m.text()); });
    page.on("pageerror", (e) => errors.push("pageerror: " + (e && e.message)));

    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await page.waitForFunction(() => window.Atlas && window.Atlas.isReady && window.Atlas.isReady(), { timeout: 20000 });
    await page.evaluate(() => document.querySelectorAll(".modal.show").forEach((m) => m.classList.remove("show")));
    await sleep(300);

    // 1. 大世界 ≥16×12 + 世界像素 > 視口
    const world = await page.evaluate(() => {
      const st = window.__farm.state();
      const scene = document.getElementById("mapScene"), wEl = document.getElementById("mapWorld");
      return { w: st.map.width, h: st.map.height,
        worldW: wEl.offsetWidth, worldH: wEl.offsetHeight,
        sceneW: scene.clientWidth, sceneH: scene.clientHeight };
    });
    assert(world.w >= 16 && world.h >= 12, `地圖 ≥16×12（${world.w}×${world.h}）`);
    assert(world.worldW > world.sceneW || world.worldH > world.sceneH,
      `世界像素大於視口可平移（world ${world.worldW}×${world.worldH} > scene ${world.sceneW}×${world.sceneH}）`);

    // 2. camera follow：移動角色 → camera 平移
    const cam = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const F = window.__farm; const st = F.state();
      const before = { x: st.camera.x, y: st.camera.y };
      // 直接把角色放到地圖最下方一個可走磚再重定位（避免長距離等待）
      const far = st.map.tiles.filter((t) => window.isWalkable(st, t)).sort((a, b) => b.y - a.y)[0];
      st.player.tileId = far.id; st.player.x = far.x; st.player.y = far.y;
      F.refresh(); await sleep(300);
      const after = { x: F.state().camera.x, y: F.state().camera.y };
      const wt = getComputedStyle(document.getElementById("mapWorld")).transform;
      return { before, after, farY: far.y, transform: wt };
    });
    assert(cam.before.y !== cam.after.y || cam.before.x !== cam.after.x,
      `camera 隨角色移動而平移（y ${cam.before.y}→${cam.after.y}）`);
    assert(cam.transform && cam.transform !== "none", "世界層套用 transform 位移（camera）");

    // 3. 視覺：地面磚 atlas / 物件 sprite / 0 emoji / 無格線
    const render = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll("#groundLayer .gtile")];
      const obs = [...document.querySelectorAll("#mapWorld .ob")];
      const reEmoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      let imgTiles = 0, objImg = 0, emoji = 0;
      for (const t of tiles) if (getComputedStyle(t).backgroundImage.includes("url(")) imgTiles++;
      for (const o of obs) {
        if (getComputedStyle(o).backgroundImage.includes("url(")) objImg++;
        if (reEmoji.test(o.textContent || "")) emoji++;
      }
      const ps = document.getElementById("playerSprite");
      const ti = getComputedStyle(tiles[0]);
      // 取同一列相鄰兩磚，驗證精確貼合（無格線間隙）
      const st = window.__farm.state();
      const t00 = tiles.find((t) => t.dataset.tileId === "t0_0");
      const t10 = tiles.find((t) => t.dataset.tileId === "t1_0");
      const abut = t00 && t10 ? Math.abs((t10.offsetLeft) - (t00.offsetLeft + t00.offsetWidth)) : 99;
      return { tiles: tiles.length, imgTiles, obs: obs.length, objImg, emoji,
        playerImg: getComputedStyle(ps).backgroundImage.includes("url("),
        pos: ti.position, abut, tileBorder: ti.borderTopWidth };
    });
    assert(render.tiles >= 16 * 12 * 0.9, `地面磚渲染（${render.tiles}）`);
    assert(render.imgTiles === render.tiles, `全部地面磚使用 v4 terrain atlas（${render.imgTiles}/${render.tiles}）`);
    assert(render.obs >= 8, `物件 sprite 數量（建築/障礙/站點/作物/動物，共 ${render.obs}）`);
    assert(render.objImg === render.obs, `全部物件以 atlas sprite 呈現（${render.objImg}/${render.obs}）`);
    assert(render.emoji === 0, `主地圖物件 0 emoji（實際 ${render.emoji}）`);
    assert(render.playerImg, "角色 Miri 使用 atlas sprite");
    assert(render.pos === "absolute" && render.abut <= 1, `地面磚絕對定位精確貼合無格線（鄰磚間隙 ${render.abut}px）`);
    assert(parseFloat(render.tileBorder) === 0, "地面磚無邊框線");

    // 4. y-sort 遮擋：角色與物件 z-index = 腳底 baseline（整數、隨 y 增）
    const zsort = await page.evaluate(() => {
      const pl = document.getElementById("player");
      const obs = [...document.querySelectorAll("#mapWorld .ob")];
      const zs = obs.map((o) => parseInt(getComputedStyle(o).zIndex)).filter((z) => !isNaN(z));
      return { playerZ: parseInt(getComputedStyle(pl).zIndex), obZ: zs.length, distinct: new Set(zs).size };
    });
    assert(!isNaN(zsort.playerZ) && zsort.playerZ > 0, `角色 z-index 依腳底 baseline（${zsort.playerZ}）`);
    assert(zsort.obZ >= 8 && zsort.distinct >= 4, `物件依 baseline 分層 y-sort（${zsort.distinct} 種 z）`);

    // 5. 390px 無水平溢出
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 2, `無水平溢出（scrollWidth - innerWidth = ${overflow}）`);

    // 6. 動作走位路由：hand 點空農土 → 走過去 → 種植 + VFX + 故事推進到 first_water
    //    先把故事推進到 plant_wheat（讀告示牌）
    const sign = await page.evaluate(async () => {
      const F = window.__farm; F.setTool("hand");
      const before = F.state().story.questId;
      const marker = window.questMarkerTile(F.state(), Date.now());
      const signTile = F.state().map.tiles.find((t) => t.station === "sign");
      F.clickTile(signTile.id);
      return { before, marker, signId: signTile.id };
    });
    await waitArrive(page);
    await sleep(300);
    const afterSign = await page.evaluate(() => window.__farm.state().story.questId);
    assert(sign.marker === sign.signId, "序章任務標記指向告示牌");
    assert(sign.before === "intro_reopen_farm" && afterSign === "plant_wheat",
      `讀告示牌推進序章（${sign.before}→${afterSign}）`);

    const sow = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state(); st.coins = 999; F.setTool("hand");
      const marker = window.questMarkerTile(st, Date.now());
      const soil = st.map.tiles.find((t) => t.plotIndex === 0);
      const before = F.vfxSpawns();
      F.clickTile(soil.id);
      return { soilId: soil.id, marker, before };
    });
    await waitArrive(page);
    await sleep(300);
    const sowRes = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const soil = st.map.tiles.find((t) => t.plotIndex === 0);
      return { planted: !!st.plots[soil.plotIndex].cropId, quest: st.story.questId, vfx: F.vfxSpawns() };
    });
    assert(sow.marker === sow.soilId, "種麥任務標記指向空農土");
    assert(sowRes.planted, "走到農土播種成功");
    assert(sowRes.vfx > sow.before, `種植時地圖出現 VFX（${sow.before}→${sowRes.vfx}）`);
    assert(sowRes.quest === "first_water", `種麥推進到澆水任務（${sowRes.quest}）`);

    // 7. 站點水井：走過去汲水 → 麥田變濕 + 故事推進到 first_harvest
    const well = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      const wellTile = st.map.tiles.find((t) => t.station === "well");
      F.clickTile(wellTile.id);
      return { wellId: wellTile.id };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    const wellRes = await page.evaluate(() => {
      const st = window.__farm.state();
      const p = st.plots[0];
      return { wet: (p.wateredAt || 0) >= (p.plantedAt || 1), quest: st.story.questId };
    });
    assert(wellRes.wet, "水井：走過去汲水後麥田變濕");
    assert(wellRes.quest === "first_harvest", `澆水推進到收成任務（${wellRes.quest}）`);

    // 8. 收成：時間快轉使麥成熟 → 走過去收成 → 故事推進到 first_delivery
    const harvest = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      const crop = window.CROPS[st.plots[0].cropId];
      st.plots[0].plantedAt = Date.now() - crop.growMs - 5000; // 快轉成熟
      F.refresh();
      const marker = window.questMarkerTile(st, Date.now());
      const soil = st.map.tiles.find((t) => t.plotIndex === 0);
      F.setTool("hand"); F.clickTile(soil.id);
      return { marker, soilId: soil.id };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    const harvestRes = await page.evaluate(() => {
      const st = window.__farm.state();
      return { empty: !st.plots[0].cropId, quest: st.story.questId,
        harvested: Object.values(st.stats.harvested || {}).reduce((s, n) => s + (n || 0), 0) };
    });
    assert(harvest.marker === harvest.soilId, "收成任務標記指向成熟麥田");
    assert(harvestRes.harvested > 0 && harvestRes.empty, "走到成熟麥田收成成功");
    assert(harvestRes.quest === "first_delivery", `收成推進到交付任務（${harvestRes.quest}）`);

    // 9. 清除工具路由（強制進入清路任務）：清掉樹樁 → 變草地 + 故事完成
    const clear = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      st.story.questId = "clear_old_path"; st.coins = 9999; F.refresh();
      const marker = window.questMarkerTile(st, Date.now());
      const stump = st.map.tiles.find((t) => t.object === "stump");
      F.setTool("clear"); F.clickTile(stump.id);
      return { marker, stumpId: stump.id };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    const clearRes = await page.evaluate(() => {
      const st = window.__farm.state();
      return { quest: st.story.questId, anyStump: st.map.tiles.some((t) => t.object === "stump") };
    });
    assert(clear.marker === clear.stumpId, "清路任務標記指向樹樁");
    assert(!clearRes.anyStump, "清除工具：走過去清掉樹樁");
    assert(clearRes.quest === null, "清路完成序章任務鏈（questId=null）");

    // 10. 無 console / pageerror
    assert(errors.length === 0, "無 console 錯誤 / pageerror" + (errors.length ? "：" + errors.slice(0, 3).join(" | ") : ""));

    await page.close();
  }

  await browser.close();
  server.close();
  if (failed > 0) { console.error("\n❌ " + failed + " 項失敗"); process.exit(1); }
  console.log("\n✅ Stage 4 RPG v4 E2E 全部通過");
}

run().catch((e) => { console.error(e); process.exit(1); });
