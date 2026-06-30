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
const PRODUCTS = {
  egg:   { id: "egg",   name: "雞蛋", emoji: "🥚", sellValue: 6,  source: "chicken" },
  milk:  { id: "milk",  name: "牛奶", emoji: "🥛", sellValue: 18, source: "cow" },
  wool:  { id: "wool",  name: "羊毛", emoji: "🧶", sellValue: 24, source: "sheep" },
  honey: { id: "honey", name: "蜂蜜", emoji: "🍯", sellValue: 15, source: "bee" },
};
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

// ===== Stage 4 世界（16×12，camera 跟隨，地圖為主畫面）=====
// 用程序化建構器產生地碼（比手打 16×12 字元可靠）。
// S=農土 g=草地 p=步道 w=水域 R=石 U=樹樁 b=灌木 T=大樹(遮擋)
const MAP_W = 16, MAP_H = 12;
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
  return g.map((row) => row.join(""));
}
const MAP_LAYOUT = buildV4Layout();
const TERRAIN_CODE = { S: "soil", g: "grass", p: "path", w: "water" };
const OBSTACLE_CODE = { R: "rock", U: "stump", b: "bush", T: "tree" };
const PLAYER_START = { x: 7, y: 5 };  // 主道中央，可達田地/站點/建築
const MOVE_MS = 200;                  // 每格移動 tween 毫秒

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
    desc: "用清除工具清掉擋路的樹樁，打通南邊。", next: null,
    objective: "clear", marker: { kind: "obstacle", object: "stump" } },
};
const FIRST_QUEST = "intro_reopen_farm";

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
};
if (typeof window !== "undefined") Object.assign(window, CONFIG, { CONFIG });
if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
