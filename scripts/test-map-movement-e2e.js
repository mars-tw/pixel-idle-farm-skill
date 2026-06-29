/* =========================================================================
 * test-map-movement-e2e.js — 可走動地圖 E2E（真瀏覽器，非 mock DOM）
 *
 * 對應「Playable Map Movement Acceptance」gate：必須在真實瀏覽器驗證
 * 角色在地圖上移動（DOM 位置改變），mock DOM 不足。
 * 用 Playwright(chromium) + 內建 http server，驗證：
 *   - 地圖場景為主畫面、#player 在地圖層
 *   - 點可走磚 → player.tileId 改變 + #player DOM 位置改變 + 走路列
 *   - 清除工具：點障礙 → 角色先移動，障礙才消失
 *   - 建造工具：地圖上蓋雞舍 → 收集到蛋
 *   - 1280x900 與 390x844 兩種視窗
 * 執行：node scripts/test-map-movement-e2e.js   （需 devDependency: playwright）
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
  catch (e) { console.error("需要 devDependency: playwright（npm i -D playwright && npx playwright install chromium）"); process.exit(2); }

  const server = await startServer();
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port + "/index.html";
  const browser = await chromium.launch();

  for (const vp of [{ w: 1280, h: 900, name: "桌面 1280x900" }, { w: 390, h: 844, name: "手機 390x844" }]) {
    console.log("\n== 視窗 " + vp.name + " ==");
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await page.evaluate(() => { const b = document.getElementById("howToOk"); if (b) b.click(); });

    // 1. 地圖為主畫面、#player 在地圖層
    const layer = await page.evaluate(() => {
      const player = document.getElementById("player");
      const wrap = document.querySelector(".map-scene-wrap");
      const sceneTiles = document.querySelectorAll("#mapScene .tile").length;
      // 地圖場景在主面板（farm-panel）內、出現在第一屏
      const inFarmPanel = !!document.querySelector(".farm-panel #mapScene");
      return { inLayer: wrap && wrap.contains(player), sceneTiles, inFarmPanel };
    });
    assert(layer.sceneTiles >= 40, "地圖場景磚渲染（" + layer.sceneTiles + "）");
    assert(layer.inLayer, "#player 是地圖場景層的子元素");
    assert(layer.inFarmPanel, "地圖場景在主面板（第一遊戲畫面）");

    // 2. 點可走磚 → tileId + DOM 位置改變 + 走路列
    const move = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const F = window.__farm; const pl = document.getElementById("player"); const sp = document.getElementById("playerSprite");
      F.setTool("hand");
      const startTile = F.playerTileId();
      const beforePos = pl.style.left + "|" + pl.style.top;
      F.clickTile("t7_3");
      await sleep(120);
      const walkingRow = sp.style.backgroundPosition; const walking = F.playerAction() === "walk" || F.moving();
      await sleep(2600);
      return { startTile, afterTile: F.playerTileId(), beforePos, afterPos: pl.style.left + "|" + pl.style.top, walking, walkingRow };
    });
    assert(move.afterTile !== move.startTile && move.afterTile === "t7_3", "點磚後 player.tileId 改變（" + move.startTile + "→" + move.afterTile + "）");
    assert(move.afterPos !== move.beforePos, "點磚後 #player DOM 位置改變");
    assert(move.walking, "移動期間角色為走路狀態（使用走路列）");

    // 3. 清除工具：先移動，障礙才消失
    const clear = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const F = window.__farm; const st = F.state(); st.coins = 9999; F.refresh();
      F.setTool("clear");
      const start = F.playerTileId();
      const rockBefore = st.map.tiles.find((t) => t.id === "t7_0").object;
      F.clickTile("t7_0");
      await sleep(150);
      const duringMove = (F.moving() || F.playerAction() === "walk");
      const rockDuring = st.map.tiles.find((t) => t.id === "t7_0").object;
      await sleep(2600);
      return { rockBefore, duringMove, rockDuring, moved: F.playerTileId() !== start,
               rockAfter: st.map.tiles.find((t) => t.id === "t7_0").object, stone: st.materials.stone || 0 };
    });
    assert(clear.rockBefore === "rock" && clear.duringMove && clear.rockDuring === "rock", "清除：角色先移動、障礙仍在");
    assert(clear.moved && clear.rockAfter === null && clear.stone >= 2, "清除：抵達後障礙消失並得建材");

    // 4. 地圖上蓋雞舍 → 收集到蛋
    const coop = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const F = window.__farm; const st = F.state(); st.level = 3; st.coins = 9999; st.materials.wood = 20; F.refresh();
      F.setTool("build"); F.clickTile("t5_1"); await sleep(2600);
      const btn = [...document.querySelectorAll("#tileContext .bbtn")].find((b) => b.dataset.type === "chickenCoop");
      if (btn) btn.click(); await sleep(150);
      const c = st.buildings.find((b) => b.type === "chickenCoop");
      const onTile = c ? st.map.tiles.find((t) => t.id === c.tileId).buildingId === c.id : false;
      st.storage.items.wheat = 10;
      if (c) { const ch = window.Game.animalsInHome(st, c.id)[0]; window.Game.feedAnimal(st, ch.id, Date.now()); }
      return { built: !!c, onTile, egg: st.storage.items.egg || 0 };
    });
    assert(coop.built && coop.onTile, "建造工具在地圖草地蓋出雞舍（佔地圖磚）");
    assert(coop.egg >= 1, "從雞舍收集到雞蛋");

    await page.close();
  }

  await browser.close();
  server.close();
  console.log("");
  if (failed === 0) { console.log("✅ 可走動地圖 E2E 全部通過"); process.exit(0); }
  else { console.error(`❌ ${failed} 項失敗`); process.exit(1); }
}

run().catch((e) => { console.error(e); process.exit(1); });
