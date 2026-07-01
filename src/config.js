/* =========================================================================
 * config.js — Pixel Idle Farm 資料層（純資料，無副作用）
 * 所有作物、升級、訂單、遊戲常數都在這裡。改平衡只動這個檔。
 * 同時被 index.html（瀏覽器）與 scripts/test-economy.js（Node）載入。
 * ========================================================================= */

// ===== 遊戲常數 =====
const GAME = {
  saveKey: "pixel_idle_farm_save_v1",
  version: 1,
  startCoins: 16,
  startPlots: 6,
  maxPlots: 12,
  baseStorage: 30,
  offlineCapMs: 8 * 60 * 60 * 1000, // 離線收益上限 8 小時
  tickMs: 250,                       // 畫面更新間隔
  autosaveMs: 5000,                  // 自動存檔間隔
  orderSlots: 3,                     // 同時掛單數
  orderTtlMs: 12 * 60 * 1000,        // 訂單存活 12 分鐘
};

// ===== 作物 =====
// growMs 成長毫秒、seedCost 種子成本、yield 收成數量、sellValue 單位直售價、
// xp 每次收成 XP、unlockLevel 解鎖等級、spriteRow crop-growth.png 的列、
// emoji 後備圖示、color 後備色塊（土壤上作物色）
const CROPS = {
  wheat:      { id: "wheat",      name: "小麥",   growMs: 15000,  seedCost: 1,  yield: 2, sellValue: 1,  xp: 1,  unlockLevel: 1, spriteRow: 0, emoji: "🌾", color: "#e3c567" },
  carrot:     { id: "carrot",     name: "胡蘿蔔", growMs: 45000,  seedCost: 4,  yield: 3, sellValue: 3,  xp: 3,  unlockLevel: 2, spriteRow: 1, emoji: "🥕", color: "#f08a3c" },
  tomato:     { id: "tomato",     name: "番茄",   growMs: 120000, seedCost: 12, yield: 4, sellValue: 8,  xp: 8,  unlockLevel: 3, spriteRow: 2, emoji: "🍅", color: "#e0473b" },
  strawberry: { id: "strawberry", name: "草莓",   growMs: 300000, seedCost: 30, yield: 5, sellValue: 22, xp: 18, unlockLevel: 4, spriteRow: 3, emoji: "🍓", color: "#e23e57" },
  pumpkin:    { id: "pumpkin",    name: "南瓜",   growMs: 900000, seedCost: 85, yield: 3, sellValue: 80, xp: 55, unlockLevel: 5, spriteRow: 5, emoji: "🎃", color: "#e8821e" },
};
const CROP_SHEET = { cols: 5, rows: 6, stages: 5 }; // crop-growth.png 版面

// ===== 等級曲線（累計 XP 門檻）=====
// 解鎖節奏對齊 game-design：碼表 lv2 約 20 秒、lv5 約 8 分鐘內可達
const LEVEL_XP = [0, 8, 30, 90, 220, 480, 900, 1600, 2700, 4300];
function levelFromXp(xp) {
  let lv = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lv = i + 1;
  return lv;
}
function xpForLevel(level) { return LEVEL_XP[level - 1] != null ? LEVEL_XP[level - 1] : Infinity; }

// ===== 升級（5 種，每種多級，cost 累進）=====
// effect 由 game.js 解讀：plotCount 加農地、growthSpeed 乘成長時間、
// sellBonus 加直售/訂單金、storageLevel 加倉容、helperLevel 解鎖自動收成
const UPGRADES = {
  plotCount: {
    name: "開墾農地", icon: "🟫", desc: "增加可種植的農地格數",
    levels: [
      { cost: 40,   value: 8 },
      { cost: 140,  value: 10 },
      { cost: 420,  value: 12 },
    ],
  },
  growthSpeed: {
    name: "肥沃土壤", icon: "🌱", desc: "所有作物成長更快",
    levels: [
      { cost: 50,   value: 0.9 },   // 成長時間 ×0.9
      { cost: 220,  value: 0.8 },
      { cost: 650,  value: 0.7 },
      { cost: 1800, value: 0.6 },
    ],
  },
  sellBonus: {
    name: "市集人脈", icon: "🪙", desc: "賣出與訂單收益提升",
    levels: [
      { cost: 80,   value: 0.15 },  // +15%
      { cost: 260,  value: 0.30 },
      { cost: 720,  value: 0.50 },
      { cost: 2000, value: 0.80 },
    ],
  },
  storageLevel: {
    name: "擴建穀倉", icon: "📦", desc: "提高倉庫容量上限",
    levels: [
      { cost: 50,   value: 40 },    // 容量 base+40 → 70
      { cost: 180,  value: 90 },
      { cost: 520,  value: 160 },
      { cost: 1400, value: 280 },
    ],
  },
  helperLevel: {
    name: "幫手機器人", icon: "🤖", desc: "自動收成成熟作物（離線也運作）",
    levels: [
      { cost: 300,  value: { autoHarvest: true, autoPlant: false } },
      { cost: 1200, value: { autoHarvest: true, autoPlant: true } }, // 進階：自動補種
    ],
  },
};
const UPGRADE_ORDER = ["plotCount", "growthSpeed", "sellBonus", "storageLevel", "helperLevel"];

// ===== 訂單設定 =====
// 訂單由已解鎖作物組成，獎金 = 作物直售總值 × payMultiplier（依稀有度）
const ORDER_RARITY = {
  common:   { label: "一般", payMult: 1.35, xpMult: 1.0, weight: 60, color: "#9aa7b4" },
  good:     { label: "優質", payMult: 1.7,  xpMult: 1.4, weight: 30, color: "#3b9ae0" },
  premium:  { label: "高級", payMult: 2.2,  xpMult: 1.9, weight: 10, color: "#b06ae0" },
};
const ORDER_STREAK_BONUS = 0.05; // 每連續完成一單，獎金 +5%（上限見 game.js）
const ORDER_STREAK_CAP = 1.0;    // 連單獎金上限 +100%

// ===== 天氣（tier 5 解鎖，retention）=====
const WEATHER = {
  clear: { id: "clear", name: "晴朗", icon: "⛅", growthMul: 1.0,  sellMul: 1.0 },
  rain:  { id: "rain",  name: "降雨", icon: "🌧️", growthMul: 0.7,  sellMul: 1.0 },  // 成長加速
  sunny: { id: "sunny", name: "豔陽", icon: "☀️", growthMul: 1.0,  sellMul: 1.25 }, // 售價提升
};
const WEATHER_UNLOCK_LEVEL = 5;
const WEATHER_DURATION_MS = 10 * 60 * 1000; // 每段天氣 10 分鐘

// ===== 成就（永久微加成，非必要）=====
const ACHIEVEMENTS = {
  firstHarvest: { name: "第一桶金", desc: "完成第一次收成", icon: "🌱" },
  order10:      { name: "可靠農戶", desc: "完成 10 筆訂單", icon: "📜" },
  coins1k:      { name: "小富農",   desc: "累計賺得 1000 金幣", icon: "💰" },
  allCrops:     { name: "全作物大師", desc: "解鎖全部作物", icon: "🏆" },
};

// ===== MVP2：動物產品（可賣、可入訂單，與作物同存 storage.items）=====
// Stage 7：每種產品分 normal/good/premium 三級品質，由收集當下的動物親密度決定。
// itemId 命名：normal 用原始 id（如 egg），good/premium 加後綴（egg_good/egg_premium）。
const QUALITY_TIERS = ["normal", "good", "premium"];
const QUALITY_SELL_MUL = { normal: 1, good: 1.6, premium: 2.6 };
const QUALITY_LABEL = { normal: "", good: "優質", premium: "頂級" };
function buildProducts() {
  const base = {
    egg:   { name: "雞蛋", emoji: "🥚", sellValue: 6,  source: "chicken" },
    milk:  { name: "牛奶", emoji: "🥛", sellValue: 18, source: "cow" },
    wool:  { name: "羊毛", emoji: "🧶", sellValue: 24, source: "sheep" },
    honey: { name: "蜂蜜", emoji: "🍯", sellValue: 15, source: "bee" },
  };
  const out = {};
  for (const bid of Object.keys(base)) {
    const b = base[bid];
    for (const q of QUALITY_TIERS) {
      const id = q === "normal" ? bid : bid + "_" + q;
      out[id] = { id, name: QUALITY_LABEL[q] + b.name, emoji: b.emoji, source: b.source,
        sellValue: Math.round(b.sellValue * QUALITY_SELL_MUL[q]), baseProduct: bid, quality: q };
    }
  }
  return out;
}
const PRODUCTS = buildProducts();

// ===== Stage 7：動物照護（餵食/澆水/梳理 → 親密度 → 產物品質）=====
// 親密度 0-100，「已收藏值 + 距上次照護的時間衰減」推導，不用 tick 模擬（跟作物成長同一套哲學）。
const AFFINITY_MAX = 100;
const AFFINITY_DECAY_PER_HOUR = 6;                 // 沒照護時，每小時衰減多少
const AFFINITY_HAPPY_THRESHOLD = 70;                // 達到「開心」狀態，UI 顯示 happy、掉 premium
const AFFINITY_GOOD_THRESHOLD = 35;                 // 達到 good 品質門檻
const CARE_GAIN = { feed: 22, water: 16, groom: 18 }; // 各照護動作的親密度增量
const CARE_COOLDOWN_MS = 20 * 1000;                 // 澆水/梳理（免費動作）冷卻，避免瘋狂點擊瞬間衝滿
const STATUS_STALE_MS = 3 * 60 * 1000;              // 超過此時間沒做某動作 → UI 顯示對應提示圖示
// 統一查作物或產品的賣價/名稱/emoji（訂單與倉庫共用）
function getItemDef(id) { return CROPS[id] || PRODUCTS[id] || null; }
function itemSellValue(id) { const d = getItemDef(id); return d ? d.sellValue : 0; }

// ===== MVP2：建材（清障礙取得，用於蓋建築/加成；存 state.materials）=====
const MATERIALS = {
  wood:    { id: "wood",    name: "木材", emoji: "🪵" },
  stone:   { id: "stone",   name: "石材", emoji: "🪨" },
  compost: { id: "compost", name: "堆肥", emoji: "🍂" },
};

// ===== MVP2：地形（地圖磚規則，非裝飾）=====
const TERRAIN = {
  grass: { id: "grass", name: "草地", buildable: true,  walkable: true,  desc: "可興建建築" },
  soil:  { id: "soil",  name: "農土", buildable: false, walkable: true,  desc: "作物耕地（在上方農場種植）" },
  water: { id: "water", name: "水域", buildable: false, walkable: false, desc: "需架橋才能跨越/使用" },
  path:  { id: "path",  name: "步道", buildable: false, walkable: true,  desc: "加速移動與動作" },
};

// ===== MVP2：障礙物（可清除 → 取建材 + 釋出草地）=====
const OBSTACLES = {
  rock:  { id: "rock",  name: "巨石", emoji: "🪨", clearCost: 25, grants: { stone: 2 },   tall: false, desc: "清除得石材，釋出草地" },
  stump: { id: "stump", name: "樹樁", emoji: "🪵", clearCost: 18, grants: { wood: 2 },    tall: false, desc: "清除得木材，釋出草地" },
  bush:  { id: "bush",  name: "灌木", emoji: "🌿", clearCost: 10, grants: { compost: 3 }, tall: false, desc: "清除得堆肥，釋出草地" },
  tree:  { id: "tree",  name: "大樹", emoji: "🌳", clearCost: 40, grants: { wood: 4 },    tall: true,  desc: "高大會遮擋；清除得木材，釋出草地" },
};

// ===== MVP2：建築（生產模組，蓋在草地，影響經濟/進度）=====
// cost 可含 coins 與建材；effect 解讀於 game.js
const BUILDINGS = {
  compostHeap: { id: "compostHeap", name: "堆肥場", emoji: "🍂", unlockLevel: 2,
                 cost: { coins: 60, compost: 3 }, effect: { growthAura: 0.90 },
                 desc: "作物成長時間 ×0.90（全場）" },
  silo:        { id: "silo", name: "筒倉", emoji: "🏗️", unlockLevel: 3,
                 cost: { coins: 180, stone: 4 }, effect: { storageBonus: 90 },
                 desc: "倉庫容量 +90" },
  chickenCoop: { id: "chickenCoop", name: "雞舍", emoji: "🐔", unlockLevel: 3,
                 cost: { coins: 140, wood: 4 }, effect: { unlockAnimal: ["chicken"], capacity: 3 },
                 desc: "解鎖雞，生產雞蛋（最多 3 隻）" },
  barn:        { id: "barn", name: "畜舍", emoji: "🛖", unlockLevel: 5,
                 cost: { coins: 420, wood: 10, stone: 4 }, effect: { unlockAnimal: ["cow", "sheep"], capacity: 4 },
                 desc: "解鎖牛與羊（最多 4 隻）" },
  beeBox:      { id: "beeBox", name: "蜂箱", emoji: "🐝", unlockLevel: 6,
                 cost: { coins: 320, wood: 6 }, effect: { unlockAnimal: ["bee"], capacity: 2, growthAura: 0.92 },
                 desc: "產蜂蜜 + 鄰近作物成長 ×0.92" },
};
const BUILDING_ORDER = ["compostHeap", "silo", "chickenCoop", "barn", "beeBox"];

// ===== MVP2：動物（蓋家 → 計時生產 → 收集 → 入訂單/賣出；可餵食加速）=====
// produceMs 生產週期、feedCost 餵食成本（用作物加速、立即產出）、unlockLevel 解鎖等級
const ANIMALS = {
  chicken: { id: "chicken", name: "雞",  emoji: "🐔", product: "egg",   produceMs: 6 * 60 * 1000,  home: "chickenCoop", unlockLevel: 3, cost: 40,  feedCost: { wheat: 2 } },
  cow:     { id: "cow",     name: "牛",  emoji: "🐄", product: "milk",  produceMs: 20 * 60 * 1000, home: "barn",        unlockLevel: 5, cost: 220, feedCost: { carrot: 2 } },
  sheep:   { id: "sheep",   name: "羊",  emoji: "🐑", product: "wool",  produceMs: 30 * 60 * 1000, home: "barn",        unlockLevel: 5, cost: 180, feedCost: { carrot: 3 } },
  bee:     { id: "bee",     name: "蜜蜂", emoji: "🐝", product: "honey", produceMs: 15 * 60 * 1000, home: "beeBox",      unlockLevel: 6, cost: 120, feedCost: { wheat: 3 } },
};

// ===== 互動工具（roadmap：明確工具模式，點擊行為依工具改變）=====
const TOOLS = {
  hand:    { id: "hand",    name: "手", icon: "👆", desc: "種植/收成作物、收集產物" },
  water:   { id: "water",   name: "澆水", icon: "💧", desc: "對已種植的乾土澆水加速一輪" },
  clear:   { id: "clear",   name: "清除", icon: "⛏️", desc: "清除地圖上的石/樁/灌木取建材" },
  build:   { id: "build",   name: "建造", icon: "🏗️", desc: "在草地興建建築" },
  inspect: { id: "inspect", name: "查看", icon: "🔍", desc: "查看磚/作物的資訊與效果" },
};
const TOOL_ORDER = ["hand", "water", "clear", "build", "inspect"];
const MOISTURE_MUL = 0.75;            // 濕土：當輪成長時間 ×0.75（更快）

// ===== Stage 4/5 世界（22×12，camera 跟隨，地圖為主畫面）=====
// 西側 0–15＝主農場；col16＝河（含斷橋）；cols17–21＝東林空地（封鎖區，修橋後解鎖）。
// S=農土 g=草地 p=步道 w=水域 R=石 U=樹樁 b=灌木 T=大樹(遮擋) B=斷橋 E=事件點
const MAP_W = 22, MAP_H = 12;
const EAST_REGION_MIN_X = 17;         // x ≥ 此值＝東林封鎖區（state.flags.bridgeRepaired 後可走）
const TILE_PX = 48;                   // 邏輯磚像素邊長（場景以像素佈局 + camera）
function buildV4Layout() {
  const g = Array.from({ length: MAP_H }, () => Array(MAP_W).fill("g"));
  const set = (x, y, c) => { if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) g[y][x] = c; };
  const hline = (y, x0, x1) => { for (let x = x0; x <= x1; x++) if (g[y][x] === "g") set(x, y, "p"); };
  const vline = (x, y0, y1) => { for (let y = y0; y <= y1; y++) if (g[y][x] === "g") set(x, y, "p"); };
  // 農土田 4×3 = 12 plots（cols2-5, rows1-3）
  for (let y = 1; y <= 3; y++) for (let x = 2; x <= 5; x++) set(x, y, "S");
  // 步道網（北南主道 col7、西側連田 row4、北橫道 row3、西道 col1、南橫道 row9、東道 col14、中橫道 row6）
  vline(7, 1, 9); hline(4, 1, 7); hline(3, 7, 14); vline(1, 4, 9);
  hline(9, 1, 14); vline(14, 3, 9); hline(6, 7, 11);
  // 池塘（左下 3×2）+ 旁草地放水井
  for (let y = 10; y <= 11; y++) for (let x = 0; x <= 2; x++) set(x, y, "w");
  // 障礙（可清/遮擋）
  set(4, 0, "T"); set(13, 0, "T"); set(9, 7, "T");   // 大樹（遮擋）
  set(3, 6, "R"); set(10, 5, "R");                   // 巨石
  set(6, 10, "b"); set(13, 11, "b");                 // 灌木
  set(8, 8, "U");                                    // 樹樁（擋住通往南區的舊路 → clear_old_path 任務）
  // ===== Stage 5：河 + 斷橋 + 東林封鎖區 =====
  for (let y = 0; y <= 11; y++) set(16, y, "w");     // col16 整條河（阻斷東西）
  hline(4, 14, 15);                                  // 把 col14 主道往東接到河西岸 (15,4)
  set(16, 4, "B");                                   // 斷橋（修好才可走過河）
  hline(4, 17, 20);                                  // 東岸登陸 (17,4) → 東林步道
  set(20, 4, "E");                                   // 事件點：東林古樹
  set(18, 2, "T"); set(21, 8, "T"); set(19, 9, "b"); // 東林裝飾（樹/灌木）
  return g.map((row) => row.join(""));
}
const MAP_LAYOUT = buildV4Layout();
const TERRAIN_CODE = { S: "soil", g: "grass", p: "path", w: "water" };
const OBSTACLE_CODE = { R: "rock", U: "stump", b: "bush", T: "tree" };
const PLAYER_START = { x: 7, y: 5 };  // 主道中央，可達田地/站點/建築
const MOVE_MS = 200;                  // 每格移動 tween 毫秒
// ===== Stage 5：修橋成本 + 事件點 =====
const BRIDGE_COST = { wood: 6, stone: 4 };   // 修橋消耗（清樹樁得木材、清石得石頭）
const EVENTS = {
  east_clearing: {
    id: "east_clearing", name: "東林古樹", tileChar: "E",
    desc: "穿過修好的斷橋，東林深處有一棵古樹。",
    reward: { coins: 120, materials: { wood: 3 } },   // 首次抵達一次性獎勵
    once: true,
  },
};

// ===== 多格建築/結構（單一大型 sprite 覆蓋多格 footprint，加遮擋）=====
// footprint = w×h 磚；anchorTile = 互動站立基準（玩家走到相鄰）；sheet/frame 為素材；
// occlude = 高於地面、角色走到後方被遮住。
const STRUCTURES = [
  { id: "farmhouse", type: "farmhouse", name: "農舍",   sheet: "buildings", frame: "farmhouse",    x: 11, y: 4, w: 3, h: 2, occlude: true,  interaction: "home" },
  { id: "coop",      type: "coop",      name: "雞舍",   sheet: "buildings", frame: "chicken_coop", x: 3,  y: 7, w: 2, h: 2, occlude: true,  interaction: "coop", building: "chickenCoop" },
  { id: "barn",      type: "barn",      name: "畜舍",   sheet: "buildings", frame: "barn",         x: 12, y: 6, w: 2, h: 2, occlude: true,  interaction: "barn",  building: "barn" },
  { id: "shop",      type: "shop",      name: "市集攤", sheet: "buildings", frame: "shop",         x: 11, y: 1, w: 2, h: 2, occlude: true,  interaction: "shop" },
];

// ===== 地圖站點（固定設施，需「走過去 + 播動作」才觸發；非裝飾）=====
const STATIONS = {
  order_board: { id: "order_board", name: "訂單看板", frame: "order_board",  action: "station", effect: "orders", desc: "走過去查看市集訂單" },
  storage:     { id: "storage",     name: "倉庫木箱", frame: "storage_crate", action: "carry",   effect: "sell",   desc: "走過去賣出所有庫存" },
  mailbox:     { id: "mailbox",     name: "信箱",     frame: "mailbox",       action: "station", effect: "mail",   desc: "走過去看信件與任務" },
  sign:        { id: "sign",        name: "告示牌",   frame: "order_board",   action: "station", effect: "story",  desc: "走過去閱讀陽光農場告示" },
  well:        { id: "well",        name: "水井",     frame: "well",          action: "water",   effect: "well",   desc: "走過去汲水替全部乾土澆水" },
};
// 放在草地磚（須為 grass、不堵障礙唯一通道、不與 STRUCTURES footprint 重疊）：
const STATION_PLACEMENT = [
  { type: "mailbox",     x: 8,  y: 5 },
  { type: "sign",        x: 6,  y: 5 },
  { type: "order_board", x: 9,  y: 2 },
  { type: "storage",     x: 10, y: 7 },
  { type: "well",        x: 3,  y: 10 },
];

// ===== Stage 6：NPC 鎮民（地圖實體，走近才能交談；台詞依故事進度變化）=====
// phase：start（序章）→ ch1done（清完舊路）→ bridge（修好橋）→ ch2done（探索完東林）
const NPCS = {
  mayor: { id: "mayor", name: "鎮長 葛瑞", title: "晨光鎮長", frame: "mayor", lines: {
    start:   ["晨光鎮歡迎你回來，孩子。", "你祖母的田荒了好一陣，先到告示牌接第一張委託吧。"],
    ch1done: ["麥香又飄回鎮上了，大家都在談論你。", "東邊那座橋年久失修——把它修好，就能踏進東林。"],
    bridge:  ["橋通了！東林的古樹是晨光鎮的老守護。", "去樹下看看，聽說藏著你祖母留下的舊物。"],
    ch2done: ["連東林都走遍了，真有你祖母的影子。", "想讓農場更熱鬧？去找老農班伯，學學照顧動物吧。"],
    ch3done: ["作物跟動物你都顧得妥妥貼貼，鎮民都看在眼裡。", "以後我這偶爾會帶點小委託來，別嫌我麻煩啊。"] } },
  merchant: { id: "merchant", name: "商人 蘿拉", title: "市集商人", frame: "merchant", lines: {
    start:   ["新鮮貨色看一下？等你有了作物，市集隨時收購。"],
    ch1done: ["你的麥子品質不錯，訂單看板上的客人會喜歡。"],
    bridge:  ["東林通了？那邊的野花蜜，以後說不定能進貨。"],
    ch2done: ["生意越來越好，多虧你把路打通了。"],
    ch3done: ["聽說你連優質蛋奶都能收成，這可以當晨光鎮的招牌貨！", "手頭有好貨的話，記得留一份給我試賣。"] } },
  elder: { id: "elder", name: "老農 班伯", title: "隔壁老農", frame: "elder", lines: {
    start:   ["雞舍那隻母雞養得還行，記得常餵牠。"],
    ch1done: ["想要更多蛋奶？把動物顧好，產量自然上來。"],
    bridge:  ["東林的草肥，以後放羊吃草最好。"],
    ch2done: ["下次該認真養群動物了——親密度高，產物品質才好。"],
    ch3done: ["照護的手藝算是出師了，不過動物要天天顧，可別鬆懈。", "手頭若有多的產物，拿來讓我瞧瞧成果也好。"] } },
  child: { id: "child", name: "孩童 圖圖", title: "鎮上孩童", frame: "child", lines: {
    start:   ["你會種田嗎？教教我嘛！"],
    ch1done: ["哇，你收成了好多麥子！"],
    bridge:  ["橋修好了！我可以去河對面玩了嗎？"],
    ch2done: ["東林的古樹好大喔，你看過了嗎？"],
    ch3done: ["我也想幫忙跑腿！可以幫我準備一盒野餐點心嗎？"] } },
};
const NPC_PLACEMENT = [
  { type: "mayor",    x: 10, y: 4, facing: "down" },
  { type: "merchant", x: 14, y: 2, facing: "down" },
  { type: "elder",    x: 5,  y: 8, facing: "down" },
  { type: "child",    x: 8,  y: 7, facing: "down" },
];

// ===== Stage 10：NPC 重複委託（走近 NPC 觸發，交付後進冷卻，非到期制）=====
// pool 只是候選白名單，實際生成時會跟 availableOrderItems(state) 取交集，
// 確保永遠不會要求玩家還沒解鎖/還沒收集過的品項（沿用 D 系統的發現閥門）。
const NPC_REQUEST_COOLDOWN_MS = 8 * 60 * 1000; // 交付後多久可再接下一張委託
const NPC_REQUESTS = {
  mayor:    { pool: ["wheat", "carrot", "tomato"], rewardMul: 1.0,
    flavorOffer: ["鎮上想辦點小活動，能否勻些{item}給我？"],
    flavorDone:  ["有你真好，晨光鎮又熱鬧一場。"] },
  merchant: { pool: ["strawberry", "pumpkin", "egg_good", "egg_premium", "milk_good", "milk_premium", "wool_good", "wool_premium", "honey_good", "honey_premium"], rewardMul: 1.15,
    flavorOffer: ["市集缺貨，手頭有{item}嗎？"],
    flavorDone:  ["生意興隆，多虧你這批貨。"] },
  elder:    { pool: ["egg", "milk", "wool", "honey", "egg_good", "milk_good", "wool_good", "honey_good"], rewardMul: 1.1,
    flavorOffer: ["幫我張羅點{item}，我拿去燉湯。"],
    flavorDone:  ["這品質，照顧得很用心啊。"] },
  child:    { pool: ["wheat", "carrot", "strawberry"], rewardMul: 0.85,
    flavorOffer: ["可以給我一點{item}嗎？我肚子餓了！"],
    flavorDone:  ["謝謝你！好好吃！"] },
};

// ===== 故事任務（地圖驅動：信箱/告示觸發、目標在地圖上有標記）=====
const QUESTS = {
  intro_reopen_farm: { id: "intro_reopen_farm", title: "回到阿軒割割陽光農場",
    desc: "先走到告示牌或信箱，看看開源農場的第一張任務。", next: "plant_wheat",
    trigger: "read_sign", marker: { kind: "station", type: "sign" } },
  plant_wheat:       { id: "plant_wheat", title: "種下第一批小麥",
    desc: "選小麥種子，走到空農土種下。", next: "first_water",
    objective: "plant", marker: { kind: "soil" } },
  first_water:       { id: "first_water", title: "替小麥澆水",
    desc: "走到水井汲水，或用澆水工具替麥田澆水。", next: "first_harvest",
    objective: "water", marker: { kind: "station", type: "well" } },
  first_harvest:     { id: "first_harvest", title: "收成小麥",
    desc: "等小麥成熟後走過去收成。", next: "first_delivery",
    objective: "harvest", marker: { kind: "soil" } },
  first_delivery:    { id: "first_delivery", title: "交付第一張訂單",
    desc: "走到訂單看板，交付一張市集訂單。", next: "clear_old_path",
    objective: "deliver", marker: { kind: "station", type: "order_board" } },
  clear_old_path:    { id: "clear_old_path", title: "清開荒地舊路",
    desc: "用清除工具清掉擋路的樹樁，打通南邊。", next: "repair_bridge",
    objective: "clear", marker: { kind: "obstacle", object: "stump" }, chapter: 1 },
  // ===== 第二章：世界可探索（Stage 5）=====
  repair_bridge:     { id: "repair_bridge", title: "修復東邊斷橋",
    desc: "走到河上的斷橋，用木材 6、石頭 4 修好它（清樹樁/石頭可得建材）。", next: "explore_new_area",
    objective: "repair_bridge", marker: { kind: "bridge" }, chapter: 2 },
  explore_new_area:  { id: "explore_new_area", title: "探索東林空地",
    desc: "過橋走到東林古樹，看看封鎖已久的東邊有什麼。", next: "learn_animal_care",
    objective: "reach_event", marker: { kind: "event", event: "east_clearing" }, chapter: 2 },
  // ===== 第三章：動物照護（Stage 7）=====
  learn_animal_care: { id: "learn_animal_care", title: "跟老農學動物照護",
    desc: "找老農班伯聊聊，學習怎麼照顧動物。", next: "feed_care_animal",
    trigger: "npc_elder", marker: { kind: "npc", type: "elder" }, chapter: 3 },
  feed_care_animal:  { id: "feed_care_animal", title: "餵食、澆水或梳理一隻動物",
    desc: "走到雞舍或畜舍，選一隻動物餵食、澆水或梳理。", next: "raise_affinity_happy",
    objective: "care_animal", marker: { kind: "structure", id: "coop" }, chapter: 3 },
  raise_affinity_happy: { id: "raise_affinity_happy", title: "讓一隻動物養到開心",
    desc: "多照顧同一隻動物，親密度達到開心程度。", next: "collect_quality_product",
    objective: "affinity_happy", marker: { kind: "structure", id: "coop" }, chapter: 3 },
  collect_quality_product: { id: "collect_quality_product", title: "收集一份優質或頂級產物",
    desc: "親密度夠高時收集，產物品質會提升。", next: "deliver_quality_order",
    objective: "collect_quality", marker: { kind: "structure", id: "coop" }, chapter: 3 },
  deliver_quality_order: { id: "deliver_quality_order", title: "賣出或交付優質產物",
    desc: "把優質/頂級產物直售或交付訂單，讓晨光鎮嚐嚐用心照顧的成果。", next: null,
    objective: "deliver_quality", chapter: 3 },
};
const FIRST_QUEST = "intro_reopen_farm";
// 章節任務分組（故事面板：第一章完成度 X/6，第二章 X/2、第三章 X/5 另計）
const PROLOGUE_QUESTS = ["intro_reopen_farm", "plant_wheat", "first_water", "first_harvest", "first_delivery", "clear_old_path"];
const CHAPTER2_QUESTS = ["repair_bridge", "explore_new_area"];
const CHAPTER3_QUESTS = ["learn_animal_care", "feed_care_animal", "raise_affinity_happy", "collect_quality_product", "deliver_quality_order"];

const MAP_DEFAULT = { width: MAP_W, height: MAP_H };
// 走路方向 → walk-cycle sheet 列（4 列：下/左/右/上）
const FACING_ROW = { down: 0, left: 1, right: 2, up: 3 };

// ===== 匯出（瀏覽器掛 window、Node 用 module.exports）=====
const CONFIG = {
  GAME, CROPS, CROP_SHEET, LEVEL_XP, levelFromXp, xpForLevel,
  UPGRADES, UPGRADE_ORDER, ORDER_RARITY, ORDER_STREAK_BONUS, ORDER_STREAK_CAP,
  WEATHER, WEATHER_UNLOCK_LEVEL, WEATHER_DURATION_MS, ACHIEVEMENTS,
  PRODUCTS, getItemDef, itemSellValue, MATERIALS, TERRAIN, OBSTACLES,
  BUILDINGS, BUILDING_ORDER, ANIMALS, MAP_DEFAULT,
  TOOLS, TOOL_ORDER, MOISTURE_MUL,
  MAP_LAYOUT, TERRAIN_CODE, OBSTACLE_CODE, PLAYER_START, MOVE_MS, FACING_ROW,
  STATIONS, STATION_PLACEMENT,
  MAP_W, MAP_H, TILE_PX, STRUCTURES, QUESTS, FIRST_QUEST,
  EAST_REGION_MIN_X, BRIDGE_COST, EVENTS, PROLOGUE_QUESTS, CHAPTER2_QUESTS, CHAPTER3_QUESTS,
  NPCS, NPC_PLACEMENT, NPC_REQUESTS, NPC_REQUEST_COOLDOWN_MS,
  QUALITY_TIERS, QUALITY_SELL_MUL, QUALITY_LABEL,
  AFFINITY_MAX, AFFINITY_DECAY_PER_HOUR, AFFINITY_HAPPY_THRESHOLD, AFFINITY_GOOD_THRESHOLD,
  CARE_GAIN, CARE_COOLDOWN_MS, STATUS_STALE_MS,
};
if (typeof window !== "undefined") Object.assign(window, CONFIG, { CONFIG });
if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
