/* =========================================================================
 * test-rpg-v3-e2e.js — Stage 3 RPG 品質 gate E2E（真瀏覽器）
 *
 * 對應 references/rpg-action-map-gate.md：
 *   - 主地圖 0 emoji 物件、48 磚全用 v3 atlas 背景圖、角色用 atlas
 *   - 動作（種植/澆水/清除/收成/收集）在地圖噴 VFX（#vfxLayer 有 map-vfx）
 *   - 站點：點 order_board 走過去 → 切到訂單分頁；點 well 走過去 → 乾土變濕
 *   - per-building 收集：走到雞舍播動作才收到蛋（collectHome）
 *   - 390px 無水平溢出、無 console / pageerror
 * 執行：node scripts/test-rpg-v3-e2e.js   （需 devDependency: playwright）
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
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
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    page.on("pageerror", (e) => errors.push("pageerror: " + (e && e.message)));

    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    // 等 atlas 載入完成
    await page.waitForFunction(() => window.Atlas && window.Atlas.isReady && window.Atlas.isReady(), { timeout: 15000 });
    await page.evaluate(() => { const b = document.getElementById("howToOk"); if (b) b.click();
      document.querySelectorAll(".modal.show").forEach((m) => m.classList.remove("show")); });
    await sleep(300);

    // 1. v3 atlas + 無 emoji
    const render = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll("#mapScene .tile")];
      const reEmoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
      let imgTiles = 0, emoji = 0, objImg = 0;
      for (const t of tiles) {
        if (getComputedStyle(t).backgroundImage.includes("url(")) imgTiles++;
        const obj = t.querySelector(".t-obj");
        if (obj) { if (reEmoji.test(obj.textContent || "")) emoji++;
          if (getComputedStyle(obj).backgroundImage.includes("url(")) objImg++; }
      }
      const ps = document.getElementById("playerSprite");
      return { tiles: tiles.length, imgTiles, emoji, objImg,
        playerImg: getComputedStyle(ps).backgroundImage.includes("url(") };
    });
    assert(render.tiles >= 40, "地圖磚渲染（" + render.tiles + "）");
    assert(render.imgTiles === render.tiles, "全部磚使用 v3 terrain atlas 背景（" + render.imgTiles + "/" + render.tiles + "）");
    assert(render.emoji === 0, "主地圖物件 0 emoji（實際 " + render.emoji + "）");
    assert(render.objImg >= 6, "站點/障礙以 props atlas 呈現（" + render.objImg + " 個物件圖）");
    assert(render.playerImg, "角色 Miri 使用 atlas sprite");

    // 2. 390px 無水平溢出
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 2, "無水平溢出（scrollWidth - innerWidth = " + overflow + "）");

    // 3. 站點 order_board：走過去 → 切到訂單分頁
    const board = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const F = window.__farm; F.setTool("hand");
      const id = F.stationTile("order_board"); const start = F.playerTileId();
      F.clickTile(id); await sleep(2600);
      return { id, start, after: F.playerTileId(), tab: F.activeTab() };
    });
    assert(!!board.id && board.after !== board.start, "點訂單看板：角色走過去（" + board.start + "→" + board.after + "）");
    assert(board.tab === "orders", "抵達後切到訂單分頁（" + board.tab + "）");

    // 4. 站點 well：乾土作物 → 走過去汲水 → 變濕 + VFX
    const well = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const F = window.__farm; const st = F.state();
      st.plots[0].cropId = "wheat"; st.plots[0].plantedAt = Date.now() - 1000; st.plots[0].wateredAt = 0;
      F.refresh();
      const vfxBefore = F.vfxSpawns();
      const id = F.stationTile("well");
      F.clickTile(id); await sleep(3000);
      const p = F.state().plots[0];
      return { wet: (p.wateredAt || 0) >= p.plantedAt, vfxAfter: F.vfxSpawns(), vfxBefore };
    });
    assert(well.wet, "水井：走過去汲水後乾土變濕");
    assert(well.vfxAfter > well.vfxBefore, "水井：地圖出現澆水 VFX（" + well.vfxBefore + "→" + well.vfxAfter + "）");

    // 5. 動作 VFX：種植時噴種子 VFX
    const sow = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const F = window.__farm; const st = F.state();
      st.coins = 999; st.plots[1].cropId = null; st.player.tileId = "t4_3"; st.player.x = 4; st.player.y = 3; F.refresh();
      // 找一個空農土磚（plotIndex===1）
      const soil = F.state().map.tiles.find((t) => t.plotIndex === 1);
      const before = F.vfxSpawns();
      F.setTool("hand"); F.clickTile(soil.id); await sleep(2600);
      return { before, after: F.vfxSpawns(), planted: !!F.state().plots[1].cropId };
    });
    assert(sow.planted, "種植成功（走到農土播種）");
    assert(sow.after > sow.before, "種植時地圖出現種子 VFX（" + sow.before + "→" + sow.after + "）");

    // 6. per-building 收集：蓋雞舍 → 走過去 → 收到蛋
    const coop = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const F = window.__farm; const st = F.state();
      st.level = 3; st.coins = 9999; st.materials.wood = 20;
      st.player.tileId = "t4_3"; st.player.x = 4; st.player.y = 3;
      window.buildBuilding(st, "t5_1", "chickenCoop", Date.now());
      // 讓動物已產出 2 輪
      const home = st.buildings.find((b) => b.type === "chickenCoop");
      const animal = st.animals.find((a) => a.homeId === home.id);
      const def = window.ANIMALS[animal.type];
      animal.lastProducedAt = Date.now() - def.produceMs * 2 - 1000;
      const eggBefore = st.storage.items.egg || 0;
      F.refresh(); F.setTool("hand");
      F.clickTile("t5_1"); await sleep(3000);
      const s2 = F.state();
      return { eggBefore, eggAfter: s2.storage.items.egg || 0,
        coopOnTile: s2.map.tiles.find((t) => t.id === "t5_1").buildingId != null };
    });
    assert(coop.coopOnTile, "雞舍蓋在地圖磚 t5_1");
    assert(coop.eggAfter > coop.eggBefore, "per-building：走到雞舍收集到蛋（" + coop.eggBefore + "→" + coop.eggAfter + "）");

    // 7. 無 console / pageerror
    assert(errors.length === 0, "無 console 錯誤 / pageerror" + (errors.length ? "：" + errors.slice(0, 3).join(" | ") : ""));

    await page.close();
  }

  await browser.close();
  server.close();
  if (failed > 0) { console.error("\n❌ " + failed + " 項失敗"); process.exit(1); }
  console.log("\n✅ Stage 3 RPG v3 E2E 全部通過");
}

run().catch((e) => { console.error(e); process.exit(1); });
