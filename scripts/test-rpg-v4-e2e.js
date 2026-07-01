/* =========================================================================
 * test-rpg-v4-e2e.js — Stage 4–6 RPG 場景 gate E2E（真瀏覽器）
 *
 * 對應 references/production-directive-stage4-game-audit.md：
 *   1. 大世界：地圖 ≥22×12，世界像素 > 視口（camera 可平移）
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
async function storyProgress(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("storyPanel");
    const bar = document.querySelector(".story-progress");
    const completed = (window.__farm.state().story && window.__farm.state().story.completed) || {};
    return {
      quest: window.__farm.state().story.questId,
      count: Object.keys(completed).length,
      progress: bar ? bar.dataset.progress : "",
      text: panel ? panel.innerText : "",
    };
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
    page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errors.push("console: " + m.text()); });
    page.on("pageerror", (e) => errors.push("pageerror: " + (e && e.message)));

    await page.goto(base);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__farm && window.__farm.state);
    await page.waitForFunction(() => window.Atlas && window.Atlas.isReady && window.Atlas.isReady(), { timeout: 20000 });
    await page.evaluate(() => document.querySelectorAll(".modal.show").forEach((m) => m.classList.remove("show")));
    await sleep(300);

    const chrome = await page.evaluate(() => ({
      title: document.title,
      heading: document.querySelector(".title") ? document.querySelector(".title").innerText : "",
      story: document.getElementById("storyPanel") ? document.getElementById("storyPanel").innerText : "",
    }));
    assert(chrome.title === "阿軒割割陽光農場開源遊戲世界", "文件標題已改為新遊戲名");
    assert(chrome.heading.includes("阿軒割割陽光農場開源遊戲世界"), "頁首顯示新遊戲名");
    assert(chrome.story.includes("任務完成度") && chrome.story.includes("0/6"), "故事面板初始顯示 0/6 完成度");

    // 1. 大世界 ≥22×12 + 世界像素 > 視口
    const world = await page.evaluate(() => {
      const st = window.__farm.state();
      const scene = document.getElementById("mapScene"), wEl = document.getElementById("mapWorld");
      return { w: st.map.width, h: st.map.height,
        worldW: wEl.offsetWidth, worldH: wEl.offsetHeight,
        sceneW: scene.clientWidth, sceneH: scene.clientHeight };
    });
    assert(world.w >= 22 && world.h >= 12, `地圖 ≥22×12（${world.w}×${world.h}）`);
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

    // 3b. 穩定稽核 hook（data-audit / data-kind / data-sheet）— 外部稽核不需依賴內部函式
    const audit = await page.evaluate(() => {
      const q = (sel) => document.querySelectorAll(sel).length;
      const player = document.querySelector('[data-audit="player"]');
      return {
        ground: q('#groundLayer [data-audit="ground-tile"]'),
        structure: q('#mapWorld [data-audit="object"][data-kind="structure"]'),
        station: q('#mapWorld [data-audit="object"][data-kind="station"]'),
        animal: q('#mapWorld [data-audit="object"][data-kind="animal"]'),
        animalSheet: q('#mapWorld [data-sheet="animals"]'),
        playerTile: player ? player.getAttribute("data-tile-id") : null,
        marker: (() => { const m = document.querySelector('[data-audit="quest-marker"]'); return m ? { tile: m.getAttribute("data-tile-id"), quest: m.getAttribute("data-quest") } : null; })(),
      };
    });
    assert(audit.ground >= 16 * 12 * 0.9, `data-audit=ground-tile 可稽核（${audit.ground}）`);
    assert(audit.structure >= 4, `data-kind=structure 多格建築可稽核（${audit.structure}）`);
    assert(audit.station >= 5, `data-kind=station 站點可稽核（${audit.station}）`);
    assert(audit.animal >= 1 && audit.animalSheet >= 1, `data-kind=animal / data-sheet=animals 動物可稽核（${audit.animal}）`);
    assert(!!audit.playerTile, `data-audit=player 帶 data-tile-id（${audit.playerTile}）`);
    assert(audit.marker && audit.marker.quest === "intro_reopen_farm", `data-audit=quest-marker 帶 data-quest（${audit.marker && audit.marker.quest}）`);

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

    // ===== Stage 6：NPC 鎮民 + 走近對話泡泡 + 主角性別切換 =====
    const npcAudit = await page.evaluate(() => ({
      npc: document.querySelectorAll('#mapWorld [data-audit="object"][data-kind="npc"]').length,
      sheet: document.querySelectorAll('#mapWorld [data-sheet="npcs"]').length,
    }));
    assert(npcAudit.npc >= 4 && npcAudit.sheet >= 4, `NPC 鎮民可稽核 data-kind=npc / data-sheet=npcs（${npcAudit.npc}）`);
    const npcMeta = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const child = st.map.tiles.find((t) => t.npc === "child");
      return { childId: child.id, walkable: window.isWalkable(st, child),
        reachable: window.Game.planMoveTo(st, child.id) !== null, phase: window.Game.npcPhase(st) };
    });
    assert(!npcMeta.walkable && npcMeta.reachable, "NPC 阻擋移動但相鄰可達（走近交談）");
    assert(npcMeta.phase === "start", `序章階段 NPC 對話 phase=start（${npcMeta.phase}）`);
    await page.evaluate((id) => window.__farm.clickTile(id), npcMeta.childId);
    await waitArrive(page, 9000);
    await sleep(500);
    const bubble = await page.evaluate(() => {
      const b = document.querySelector('[data-audit="dialogue-bubble"]');
      const log = (window.__farm.state().story.dialogueLog || []).length;
      return { has: !!b, npc: b ? b.dataset.npc : null, text: b ? b.innerText.replace(/\s+/g, " ").trim() : "", log };
    });
    assert(bubble.has && bubble.npc === "child" && bubble.text.includes("圖圖"), `走近孩童出現對話泡泡（${bubble.text}）`);
    assert(bubble.log >= 1, `對話進入側欄記錄（${bubble.log} 則）`);

    const gender = await page.evaluate(() => {
      const before = window.__farm.state().gender;
      document.getElementById("genderToggle").click();
      const after = window.__farm.state().gender;
      const bg = getComputedStyle(document.getElementById("playerSprite")).backgroundImage;
      document.getElementById("genderToggle").click(); // 切回女，避免影響後續斷言
      return { before, after, male: /max-walk|max-actions/.test(bg), back: window.__farm.state().gender };
    });
    assert(gender.before === "f" && gender.after === "m" && gender.male, "主角性別可切換為男（sprite 換 max atlas）");
    assert(gender.back === "f", "性別可切回女");

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
    const signProgress = await storyProgress(page);
    assert(signProgress.progress === "1/6" && signProgress.text.includes("1/6"), `讀告示後完成度 1/6（${signProgress.progress}）`);

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
    const sowProgress = await storyProgress(page);
    assert(sowProgress.progress === "2/6" && sowProgress.text.includes("種下第一批小麥") && sowProgress.text.includes("1/1"),
      `種麥後完成度 2/6 並顯示作物 1/1（${sowProgress.progress}）`);

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
    const waterProgress = await storyProgress(page);
    assert(waterProgress.progress === "3/6", `澆水後完成度 3/6（${waterProgress.progress}）`);

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
    const harvestProgress = await storyProgress(page);
    assert(harvestProgress.progress === "4/6", `收成後完成度 4/6（${harvestProgress.progress}）`);

    // 9. 交付一張故事訂單 → 完成度 5/6，下一步才是清路
    const deliveryRes = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      st.storage.items.wheat = Math.max(st.storage.items.wheat || 0, 1);
      st.orders = [{ id: "story_order", wants: { wheat: 1 }, rarity: "common", rewardCoins: 20, rewardXp: 4, expiresAt: Date.now() + 999999 }];
      const f = window.Game.fulfillOrder(st, "story_order", Date.now());
      const adv = window.Game.advanceStory(st, "deliver");
      F.refresh();
      return { fulfilled: f.ok, advanced: adv.ok, quest: st.story.questId };
    });
    assert(deliveryRes.fulfilled && deliveryRes.advanced && deliveryRes.quest === "clear_old_path",
      `交付故事訂單後推進到清路任務（${deliveryRes.quest}）`);
    const deliveryProgress = await storyProgress(page);
    assert(deliveryProgress.progress === "5/6", `交付訂單後完成度 5/6（${deliveryProgress.progress}）`);

    // 10. 清除工具路由：清掉樹樁 → 變草地 + 故事完成
    const clear = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      st.coins = 9999; F.refresh();
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
    assert(clearRes.quest === "repair_bridge", `清路後接第二章「修橋」（${clearRes.quest}）`);
    const clearProgress = await storyProgress(page);
    assert(clearProgress.progress === "6/6", `序章完成度 6/6（${clearProgress.progress}）`);

    // ===== Stage 5：世界可探索（封鎖東林 → 修橋 → 解鎖 → 事件點）=====
    // 11. 修橋前：斷橋不可走、東林 BFS 封鎖；data-audit bridge/locked-area/event-point 可稽核
    const pre = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const bridge = window.Game.bridgeTile(st), event = window.Game.eventTile(st, "east_clearing");
      return {
        bridgeId: bridge.id, eventId: event.id,
        bridgeWalkable: window.isWalkable(st, bridge),
        eastBfs: window.Game.bfsPath(st, st.player.tileId, event.id),
        lockedArea: document.querySelectorAll('#groundLayer [data-kind="locked-area"]').length,
        bridgeOb: document.querySelectorAll('#mapWorld [data-audit="object"][data-kind="bridge"]').length,
        eventOb: document.querySelectorAll('#mapWorld [data-audit="object"][data-kind="event-point"]').length,
      };
    });
    assert(!pre.bridgeWalkable && pre.eastBfs === null, "修橋前：斷橋不可走、東林封鎖區 BFS 不可達");
    assert(pre.lockedArea >= 30, `修橋前：東林封鎖區可稽核 data-kind=locked-area（${pre.lockedArea}）`);
    assert(pre.bridgeOb >= 1 && pre.eventOb >= 1, `斷橋 / 事件點 data-audit 可稽核（bridge=${pre.bridgeOb} event=${pre.eventOb}）`);

    // 12. 走過去修橋（給真資源 木6石4，消耗後解鎖；marker 指向斷橋）
    const repair = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      st.materials.wood = 6; st.materials.stone = 4; F.refresh();
      const bridge = window.Game.bridgeTile(st);
      const marker = window.questMarkerTile(st, Date.now());
      F.setTool("hand"); F.clickTile(bridge.id);
      return { bridgeId: bridge.id, marker };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    const repairRes = await page.evaluate(() => {
      const st = window.__farm.state();
      return { repaired: !!st.flags.bridgeRepaired, wood: st.materials.wood, stone: st.materials.stone, quest: st.story.questId };
    });
    assert(repair.marker === repair.bridgeId, "修橋任務標記指向斷橋");
    assert(repairRes.repaired, "走到橋邊用建材修好斷橋");
    assert(repairRes.wood === 0 && repairRes.stone === 0, "修橋消耗木材 6、石頭 4（真資源）");
    assert(repairRes.quest === "explore_new_area", `修橋推進到「探索新區」（${repairRes.quest}）`);

    // 13. 修橋後：東林解鎖可達、走到事件點觸發獎勵、camera 跟隨進新區、第二章 2/2
    const explore = await page.evaluate(async () => {
      const F = window.__farm; const st = F.state();
      const event = window.Game.eventTile(st, "east_clearing");
      const marker = window.questMarkerTile(st, Date.now());
      F.setTool("hand"); F.clickTile(event.id);
      return { eventId: event.id, marker, coinsBefore: st.coins, eastReachable: window.Game.bfsPath(st, st.player.tileId, event.id) !== null };
    });
    await waitArrive(page, 12000);
    await sleep(400);
    const exploreRes = await page.evaluate(() => {
      const st = window.__farm.state();
      const ch2 = document.querySelector('.chapter2-progress');
      return {
        claimed: !!(st.flags.eventsClaimed && st.flags.eventsClaimed.east_clearing),
        quest: st.story.questId, coins: st.coins, camX: st.camera.x, playerX: st.player.x,
        ch2: ch2 ? ch2.getAttribute('data-progress2') : null,
        lockedAfter: document.querySelectorAll('#groundLayer [data-kind="locked-area"]').length,
      };
    });
    assert(explore.eastReachable, "修橋後：東林 BFS 可達");
    assert(explore.marker === explore.eventId, "探索任務標記指向東林事件點");
    assert(exploreRes.claimed && exploreRes.coins > explore.coinsBefore, `走到東林古樹觸發一次性獎勵（+${exploreRes.coins - explore.coinsBefore} 金）`);
    assert(exploreRes.playerX >= 17 && exploreRes.camX < -50, `角色進入東林、camera 跟隨平移（playerX=${exploreRes.playerX} camX=${exploreRes.camX}）`);
    assert(exploreRes.quest === "learn_animal_care" && exploreRes.ch2 === "2/2",
      `探索完成第二章，接上第三章「跟老農學動物照護」（探索完成度 ${exploreRes.ch2}，quest=${exploreRes.quest}）`);
    assert(exploreRes.lockedAfter === 0, "修橋後封鎖區解除（locked-area 清零）");

    // 13b. Stage 6：對話依故事進度改變（通關後 → ch2done 階段台詞，與序章不同）
    const lateTalk = await page.evaluate(() => {
      const st = window.__farm.state();
      return { phase: window.Game.npcPhase(st), line: window.Game.npcDialogue(st, "mayor", 0).line,
        startLine: window.NPCS.mayor.lines.start[0] };
    });
    assert(lateTalk.phase === "ch2done", `通關後 NPC 對話 phase=ch2done（${lateTalk.phase}）`);
    assert(lateTalk.line !== lateTalk.startLine, "鎮長台詞隨故事進度改變（非序章台詞）");

    // ===== Stage 7：動物照護（老農對話 → 走到雞舍餵食 → 親密度 → 品質 → 賣出）=====
    // 15. 走到老農（elder）→ 觸發 npc_elder → 推進到第三章「餵食/澆水/梳理」
    const elderInfo = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      const elderTile = st.map.tiles.find((t) => t.npc === "elder");
      const marker = window.questMarkerTile(st, Date.now());
      F.clickTile(elderTile.id);
      return { elderId: elderTile.id, marker };
    });
    await waitArrive(page, 9000);
    await sleep(500);
    const afterElder = await page.evaluate(() => window.__farm.state().story.questId);
    assert(elderInfo.marker === elderInfo.elderId, "第三章開頭任務標記指向老農");
    assert(afterElder === "feed_care_animal", `跟老農對話推進到「餵食/澆水/梳理」任務（${afterElder}）`);

    // 16. 雞從未照護過應顯示 hungry 狀態圖示（data-audit 可稽核）
    const hungryAudit = await page.evaluate(() => {
      const animalEl = document.querySelector('[data-audit="object"][data-kind="animal"]');
      return { status: animalEl ? animalEl.dataset.status : null, sheet: animalEl ? animalEl.dataset.sheet : null };
    });
    assert(hungryAudit.status === "hungry", `起始雞從未照護過，狀態為 hungry（實際 ${hungryAudit.status}）`);

    // 17. 走到雞舍 → 點餵食 4 次（4×22=88 親密度，跨過開心門檻 70）→ 一次連跳 raise_affinity_happy + collect_quality_product
    const coopInfo = await page.evaluate(() => {
      const F = window.__farm; const st = F.state();
      st.storage.items.wheat = 20;
      const coop = st.buildings.find((b) => b.type === "chickenCoop");
      const marker = window.questMarkerTile(st, Date.now());
      F.refresh(); F.clickTile(coop.tileId);
      return { coopTileId: coop.tileId, marker };
    });
    await waitArrive(page, 9000);
    await sleep(400);
    assert(coopInfo.marker === coopInfo.coopTileId, "「餵食/澆水/梳理」任務標記指向雞舍（structure marker）");
    // Stage 7.1：餵食現在有冷卻（CARE_COOLDOWN_MS），E2E 不用真的等 20 秒 —
    // 每次點擊後把該動物的 lastFedAt 往回撥，模擬冷卻已過，驗證的是「連續餵食後親密度/品質正確累積」
    // 而非冷卻計時器本身（冷卻邏輯已由 test-systems.js 的 node 單元測試覆蓋）。
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => { const b = document.querySelector(".afeed"); if (b) b.click(); });
      await sleep(200);
      await page.evaluate(() => {
        const F = window.__farm; const st = F.state();
        const coop = st.buildings.find((b) => b.type === "chickenCoop");
        for (const a of window.Game.animalsInHome(st, coop.id)) a.lastFedAt = 0;
        F.refresh(); // 按鈕的 disabled 狀態是渲染當下算的，直接改 state 要重繪面板才會反映
      });
    }
    const afterFeed = await page.evaluate(() => {
      const st = window.__farm.state();
      const ch3 = document.querySelector(".chapter3-progress");
      return { quest: st.story.questId, ch3: ch3 ? ch3.getAttribute("data-progress3") : null,
        hasQualityItem: Object.keys(st.storage.items).some((k) => k.endsWith("_good") || k.endsWith("_premium")) };
    });
    assert(afterFeed.hasQualityItem, "連續餵食後倉庫出現優質/頂級品項");
    assert(afterFeed.quest === "deliver_quality_order", `連跳兩關後接上「賣出優質品」任務（${afterFeed.quest}）`);
    assert(afterFeed.ch3 === "4/5", `第三章完成度 4/5（老農對話+餵食+開心+優質品，實際 ${afterFeed.ch3}）`);

    // 18. 賣出全部庫存（含優質品）→ qualitySold 增加 → 第三章 5/5 完成
    await page.evaluate(() => { const b = document.getElementById("sellAllBtn"); if (b) b.click(); });
    await sleep(300);
    const afterSell = await page.evaluate(() => {
      const st = window.__farm.state();
      const ch3 = document.querySelector(".chapter3-progress");
      return { qualitySold: st.stats.qualitySold, quest: st.story.questId, ch3: ch3 ? ch3.getAttribute("data-progress3") : null };
    });
    assert(afterSell.qualitySold > 0, `賣出優質品後 qualitySold 增加（${afterSell.qualitySold}）`);
    assert(afterSell.quest === null && afterSell.ch3 === "5/5", `第三章完成（照護完成度 ${afterSell.ch3}）`);

    // 14. 無 console / pageerror
    assert(errors.length === 0, "無 console 錯誤 / pageerror" + (errors.length ? "：" + errors.slice(0, 3).join(" | ") : ""));

    await page.close();
  }

  await browser.close();
  server.close();
  if (failed > 0) { console.error("\n❌ " + failed + " 項失敗"); process.exit(1); }
  console.log("\n✅ Stage 4+5+6+7 RPG v4 E2E 全部通過");
}

run().catch((e) => { console.error(e); process.exit(1); });
