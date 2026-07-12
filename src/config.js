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
  corn:       { id: "corn",       name: "玉米",   growMs: 210000, seedCost: 20, yield: 4, sellValue: 12, xp: 12, unlockLevel: 4, spriteRow: 4, emoji: "🌽", color: "#f0c84a", season: "夏" },
  pumpkin:    { id: "pumpkin",    name: "南瓜",   growMs: 900000, seedCost: 85, yield: 3, sellValue: 80, xp: 55, unlockLevel: 5, spriteRow: 5, emoji: "🎃", color: "#e8821e" },
  radish:      { id: "radish",     name: "櫻桃蘿蔔", growMs: 90000, seedCost: 10, yield: 4, sellValue: 5, xp: 6, unlockLevel: 5, emoji: "🔴", color: "#d94b58", season: "春", sheet: "crops4" },
  bell_pepper: { id: "bell_pepper", name: "甜椒", growMs: 360000, seedCost: 38, yield: 4, sellValue: 24, xp: 22, unlockLevel: 5, emoji: "🫑", color: "#4fae55", season: "夏", sheet: "crops2" },
  potato:      { id: "potato",      name: "馬鈴薯", growMs: 480000, seedCost: 45, yield: 5, sellValue: 22, xp: 28, unlockLevel: 6, emoji: "🥔", color: "#b9834b", season: "春", sheet: "crops2" },
  sunflower:   { id: "sunflower",   name: "向日葵", growMs: 420000, seedCost: 48, yield: 3, sellValue: 26, xp: 26, orderXp: 40, unlockLevel: 6, emoji: "🌻", color: "#e0a72a", season: "夏", sheet: "crops4" },
  grapes:      { id: "grapes",      name: "葡萄", growMs: 720000, seedCost: 72, yield: 4, sellValue: 55, xp: 42, unlockLevel: 7, emoji: "🍇", color: "#7c4aa6", season: "秋", sheet: "crops2" },
  melon:       { id: "melon",       name: "溫室甜瓜", growMs: 840000, seedCost: 90, yield: 3, sellValue: 90, xp: 58, unlockLevel: 8, emoji: "🍈", color: "#8fcf6a", season: "冬", sheet: "crops2" },
  pea:          { id: "pea",         name: "豌豆", growMs: 540000, seedCost: 54, yield: 5, sellValue: 28, xp: 32, unlockLevel: 6, emoji: "🫛", color: "#55b95d", season: "春", sheet: "crops3" },
  sweet_potato: { id: "sweet_potato", name: "地瓜", growMs: 660000, seedCost: 68, yield: 4, sellValue: 48, xp: 40, unlockLevel: 7, emoji: "🍠", color: "#c46a3a", season: "秋", sheet: "crops3" },
  winter_kale:  { id: "winter_kale", name: "冬羽甘藍", growMs: 780000, seedCost: 84, yield: 4, sellValue: 64, xp: 52, unlockLevel: 8, emoji: "🥬", color: "#4f9f83", season: "冬", sheet: "crops3" },
};
const CROP_SHEET = { cols: 5, rows: 6, stages: 5 }; // crop-growth.png 版面

const SEASONS = [
  { id: "春", name: "春季", icon: "🌸" },
  { id: "夏", name: "夏季", icon: "☀️" },
  { id: "秋", name: "秋季", icon: "🍂" },
  { id: "冬", name: "冬季", icon: "❄️" },
];
const SEASON_DURATION_MS = 20 * 60 * 1000;
const SEASON_UNLOCK_LEVEL = 6;
const SEASON_ORDER_BIAS = {
  春: {
    id: "spring_pea_market",
    name: "豌豆芽市",
    icon: "🌸",
    preferredItems: ["pea", "radish", "river_mint", "potato"],
    weight: 4,
    toast: "春季市集「豌豆芽市」偏好豌豆、櫻桃蘿蔔與溪畔薄荷。",
  },
  夏: {
    id: "summer_river_pepper_week",
    name: "河岸甜椒週",
    icon: "☀️",
    preferredItems: ["bell_pepper", "sunflower", "amber_resin", "corn"],
    weight: 4,
    toast: "夏季市集「河岸甜椒週」偏好甜椒、向日葵與河岸貨。",
  },
  秋: {
    id: "autumn_grape_chestnut_bundle",
    name: "葡萄栗子合單",
    icon: "🍂",
    preferredItems: ["grapes", "forest_chestnut", "sweet_potato", "wild_berry"],
    weight: 4,
    toast: "秋季市集「葡萄栗子合單」偏好葡萄、栗子與地瓜。",
  },
  冬: {
    id: "winter_frost_leaf_hotpot",
    name: "霜葉鍋物",
    icon: "❄️",
    preferredItems: ["winter_kale", "frost_cherry", "potato", "mooncap_spore"],
    weight: 4,
    toast: "冬季市集「霜葉鍋物」偏好冬羽甘藍、霜櫻果與暖鍋食材。",
  },
};
const SEASON_EVENTS = {
  spring_seed_swap: {
    id: "spring_seed_swap",
    season: "春",
    name: "春播交換",
    icon: "🌱",
    desc: "把早春小麥交給鎮民換一張豌豆播種貼紙，順手記下今年第一輪播種。",
    requires: { wheat: 5 },
    reward: { xp: 8, collectible: "spring_seed_swap_sticker" },
    actionLabel: "交換小麥",
    done: "春播交換完成，豌豆芽市的第一張貼紙收進圖鑑。",
  },
  summer_well_bless: {
    id: "summer_well_bless",
    season: "夏",
    name: "夏井祈願",
    icon: "💧",
    desc: "到井邊打水，替本季第一批乾土補上一輪濕潤。",
    reward: { xp: 4, waterAll: true, collectible: "summer_well_charm" },
    actionLabel: "汲水祈願",
    station: "well",
    done: "夏井祈願完成，水桶旁多了一枚小井繩結。",
  },
  autumn_share_basket: {
    id: "autumn_share_basket",
    season: "秋",
    name: "秋收分籃",
    icon: "🧺",
    desc: "把一籃秋季作物分給孩子們，讓今年的收成有名字也有去處。",
    requiresSeasonCrop: 3,
    reward: { coins: 12, xp: 4, collectible: "autumn_share_label" },
    actionLabel: "分出秋籃",
    done: "秋收分籃完成，圖圖替籃子綁上了姓名牌。",
  },
  winter_hearth_soup: {
    id: "winter_hearth_soup",
    season: "冬",
    name: "冬灶湯",
    icon: "🍲",
    desc: "交一份冬羽甘藍或兩份馬鈴薯，替班伯的灶邊湯鍋添料。",
    requiresAny: { winter_kale: 1, potato: 2 },
    reward: { xp: 7, collectible: "winter_soup_note" },
    actionLabel: "添料入鍋",
    done: "冬灶湯完成，班伯把湯鍋旁的照護短箋交給你。",
  },
};

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
      { cost: 4200, value: 0.52 },
    ],
  },
  sellBonus: {
    name: "市集人脈", icon: "🪙", desc: "賣出與訂單收益提升",
    levels: [
      { cost: 80,   value: 0.15 },  // +15%
      { cost: 260,  value: 0.30 },
      { cost: 720,  value: 0.50 },
      { cost: 2000, value: 0.80 },
      { cost: 4800, value: 1.05 },
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
  festival: { label: "豐年祭", payMult: 2.8, xpMult: 2.3, weight: 5, color: "#d88b2a" },
};
const ORDER_STREAK_BONUS = 0.05; // 每連續完成一單，獎金 +5%（上限見 game.js）
const ORDER_STREAK_CAP = 1.0;    // 連單獎金上限 +100%

// ===== 天氣（tier 5 解鎖，retention）=====
const WEATHER = {
  clear: { id: "clear", name: "晴朗", icon: "⛅", growthMul: 1.0,  sellMul: 1.0 },
  rain:  { id: "rain",  name: "降雨", icon: "🌧️", growthMul: 0.7,  sellMul: 1.0 },  // 成長加速
  sunny: { id: "sunny", name: "豔陽", icon: "☀️", growthMul: 1.0,  sellMul: 1.25 }, // 售價提升
  windy: { id: "windy", name: "微風", icon: "🍃", growthMul: 0.9,  sellMul: 1.05 }, // 小幅成長與售價加成
  fog:   { id: "fog",   name: "晨霧", icon: "🌫️", growthMul: 1.15, sellMul: 1.10 }, // 成長稍慢、售價稍高
  snow:  { id: "snow",  name: "降雪", icon: "🌨️", growthMul: 1.25, sellMul: 1.18 }, // 成長放慢、冬季貨價較高
  storm: { id: "storm", name: "暴風雨", icon: "⛈️", growthMul: 0.82, sellMul: 0.95 }, // 小幅加速但市集人流變少
};
const WEATHER_UNLOCK_LEVEL = 5;
const WEATHER_DURATION_MS = 10 * 60 * 1000; // 每段天氣 10 分鐘

// ===== 成就（永久微加成，非必要）=====
const ACHIEVEMENTS = {
  firstHarvest: { name: "第一桶金", desc: "完成第一次收成", icon: "🌱" },
  order10:      { name: "可靠農戶", desc: "完成 10 筆訂單", icon: "📜" },
  coins1k:      { name: "小富農",   desc: "累計賺得 1000 金幣", icon: "💰" },
  allCrops:     { name: "全作物大師", desc: "解鎖全部作物", icon: "🏆" },
  duckKeeper:   { name: "鴨舍新聲", desc: "收集任一品質的鴨蛋", icon: "🦆" },
  seasonalTable:{ name: "四季餐桌", desc: "收成四種季節作物", icon: "🍽️" },
  festivalDeal: { name: "豐年祭供應商", desc: "完成一張豐年祭訂單", icon: "🏮" },
  letterKeeper: { name: "信箋守護者", desc: "讀完祖母留下的八封季節信", icon: "📬" },
  neighborLetters: { name: "四鄰來信", desc: "讀完葛瑞、蘿拉、班伯與圖圖的鎮民附箋", icon: "💌", noBonus: true },
  fullPantry:   { name: "滿滿食物櫃", desc: "每一種作物都至少收成一次", icon: "🧺" },
  stallOwner:   { name: "四季攤主", desc: "興建豐年祭小攤", icon: "🎪" },
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
    duck_egg: { name: "鴨蛋", emoji: "🥚", sellValue: 9, source: "duck", qualitySheet: "product_quality_duck" },
  };
  const out = {};
  for (const bid of Object.keys(base)) {
    const b = base[bid];
    for (const q of QUALITY_TIERS) {
      const id = q === "normal" ? bid : bid + "_" + q;
      out[id] = { id, name: QUALITY_LABEL[q] + b.name, emoji: b.emoji, source: b.source,
        sellValue: Math.round(b.sellValue * QUALITY_SELL_MUL[q]), baseProduct: bid, quality: q };
      if (b.qualitySheet) out[id].qualitySheet = b.qualitySheet;
    }
  }
  return out;
}
const PRODUCTS = buildProducts();

// ===== Stage 12: East Forest forage, stored as items so orders/NPC requests can reuse it. =====
const FORAGE_ITEMS = {
  forest_herb:   { id: "forest_herb",   name: "東林藥草", emoji: "🌿", sellValue: 4, region: "east" },
  glow_mushroom: { id: "glow_mushroom", name: "螢光菇",   emoji: "🍄", sellValue: 5, region: "east" },
  wild_berry:    { id: "wild_berry",    name: "東林野莓", emoji: "🫐", sellValue: 6, region: "east", season: "秋" },
  river_mint:    { id: "river_mint",    name: "溪畔薄荷", emoji: "🍃", sellValue: 7, region: "east", season: "春" },
  mooncap_spore: { id: "mooncap_spore", name: "月帽菇孢", emoji: "🌙", sellValue: 18, region: "east_deep", season: "冬" },
  amber_resin:   { id: "amber_resin",   name: "古樹琥珀脂", emoji: "🟠", sellValue: 24, region: "east_deep", season: "夏" },
  forest_chestnut: { id: "forest_chestnut", name: "東林栗子", emoji: "🌰", sellValue: 20, region: "east_deep", season: "秋" },
  frost_cherry:    { id: "frost_cherry",    name: "霜櫻果", emoji: "🍒", sellValue: 28, region: "east_deep", season: "冬" },
};
const FORAGE_NODE_COOLDOWN_MS = 10 * 60 * 1000;
const EAST_DEEP_FORAGE_COOLDOWN_MS = 30 * 60 * 1000;
const FORAGE_NODES = [
  { id: "east_herb_patch", itemId: "forest_herb", x: 18, y: 5, yield: 1, name: "東林藥草叢",
    desc: "橋後林地才長得好的清香藥草。", cooldownMs: FORAGE_NODE_COOLDOWN_MS },
  { id: "east_mushroom_log", itemId: "glow_mushroom", x: 21, y: 4, yield: 1, name: "螢光菇木",
    desc: "靠近古樹根部的微光菇蕈。", cooldownMs: FORAGE_NODE_COOLDOWN_MS },
  { id: "east_berry_thicket", itemId: "wild_berry", x: 18, y: 7, yield: 1, name: "東林野莓叢",
    desc: "秋天最甜的灌木野莓，適合做小點心。", cooldownMs: FORAGE_NODE_COOLDOWN_MS },
  { id: "east_mint_spring", itemId: "river_mint", x: 20, y: 6, yield: 1, name: "溪畔薄荷",
    desc: "靠近濕潤溪岸的清涼香草。", cooldownMs: FORAGE_NODE_COOLDOWN_MS },
  { id: "deep_mooncap_ring", itemId: "mooncap_spore", x: 20, y: 9, yield: 1, name: "月帽菇環",
    desc: "東林深處夜色較重的菇環，恢復很慢。", cooldownMs: EAST_DEEP_FORAGE_COOLDOWN_MS, requiresFlag: "eastDeepUnlocked" },
  { id: "deep_amber_root", itemId: "amber_resin", x: 21, y: 10, yield: 1, name: "古樹琥珀根",
    desc: "老樹根部滲出的琥珀色樹脂，少量即可入委託。", cooldownMs: EAST_DEEP_FORAGE_COOLDOWN_MS, requiresFlag: "eastDeepUnlocked" },
  { id: "deep_chestnut_bush", itemId: "forest_chestnut", x: 20, y: 8, yield: 1, name: "東林栗木叢",
    desc: "深處草地旁的秋栗，殼厚但香氣足。", cooldownMs: EAST_DEEP_FORAGE_COOLDOWN_MS, requiresFlag: "eastDeepUnlocked" },
  { id: "deep_frost_cherry", itemId: "frost_cherry", x: 19, y: 10, yield: 1, name: "霜櫻果叢",
    desc: "冬霜後才轉甜的小果，採收後要慢慢恢復。", cooldownMs: EAST_DEEP_FORAGE_COOLDOWN_MS, requiresFlag: "eastDeepUnlocked" },
];
const EAST_FORAGE_REPORT = {
  npcId: "merchant",
  wants: { forest_herb: 1, glow_mushroom: 1 },
  rewardCoins: 18,
  rewardXp: 6,
  offer: "東林的新貨源要先登記。藥草和螢光菇各帶一份，我幫你開鎮民委託。",
  done: "這批樣品很穩，之後我會把東林採集品放進委託清單。",
};
const EAST_DEEP_UNLOCK_COST = { coins: 90, wood: 4, stone: 2 };
const COLLECTIBLES = {
  east_deep_rubbing: {
    id: "east_deep_rubbing",
    name: "東林年輪拓印",
    emoji: "📜",
    source: "解鎖東林深處",
    desc: "古樹根旁留下的年輪拓印，只作收藏紀錄，不產生收益。",
  },
  festival_lantern: {
    id: "festival_lantern",
    name: "豐年祭小燈籠",
    emoji: "🏮",
    source: "完成豐年祭訂單",
    desc: "祭典攤位留下的小燈籠，象徵農場能供應四季物產。",
  },
  grandma_hat: {
    id: "grandma_hat",
    name: "祖母的草帽",
    emoji: "👒",
    source: "讀完祖母的動物照護信",
    desc: "帽緣有補過的針腳，像是她在田埂上彎腰看小雞時留下的影子。",
  },
  seed_pouch: {
    id: "seed_pouch",
    name: "手縫種子袋",
    emoji: "👝",
    source: "寫下給祖母的回信",
    desc: "舊布袋重新裝進新種子，提醒農場不是被繼承，而是被繼續照顧。",
  },
  spring_seed_swap_sticker: {
    id: "spring_seed_swap_sticker",
    name: "春播交換貼紙",
    emoji: "🌱",
    source: "完成春播交換",
    desc: "豌豆芽市的小貼紙，只記錄第一輪春播，不提供收益加成。",
  },
  summer_well_charm: {
    id: "summer_well_charm",
    name: "夏井繩結",
    emoji: "💧",
    source: "完成夏井祈願",
    desc: "綁在井桶上的短繩結，提醒人們夏季先留水給田。",
  },
  autumn_share_label: {
    id: "autumn_share_label",
    name: "秋籃姓名牌",
    emoji: "🏷️",
    source: "完成秋收分籃",
    desc: "圖圖寫上的小姓名牌，讓分享出去的收成也留在記憶裡。",
  },
  winter_soup_note: {
    id: "winter_soup_note",
    name: "冬灶湯短箋",
    emoji: "🍲",
    source: "完成冬灶湯",
    desc: "班伯夾在照護筆記裡的小紙條，只作故事收藏。",
  },
};

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
function getItemDef(id) { return CROPS[id] || PRODUCTS[id] || FORAGE_ITEMS[id] || null; }
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
                 maxCount: 1,
                 desc: "作物成長時間 ×0.90（全場，最多 1 座生效）" },
  silo:        { id: "silo", name: "筒倉", emoji: "🏗️", unlockLevel: 3,
                 cost: { coins: 180, stone: 4 }, effect: { storageBonus: 90 },
                 maxCount: 1,
                 desc: "倉庫容量 +90（最多 1 座生效）" },
  chickenCoop: { id: "chickenCoop", name: "雞舍", emoji: "🐔", unlockLevel: 3,
                 cost: { coins: 140, wood: 4 }, effect: { unlockAnimal: ["chicken"], capacity: 3 },
                 maxCount: 2,
                 desc: "解鎖雞，生產雞蛋（每座最多 3 隻；全場最多 2 座）" },
  barn:        { id: "barn", name: "畜舍", emoji: "🛖", unlockLevel: 5,
                 cost: { coins: 420, wood: 10, stone: 4 }, effect: { unlockAnimal: ["cow", "sheep"], capacity: 4 },
                 maxCount: 2,
                 desc: "解鎖牛與羊（每座最多 4 隻；全場最多 2 座）" },
  beeBox:      { id: "beeBox", name: "蜂箱", emoji: "🐝", unlockLevel: 6,
                 cost: { coins: 320, wood: 6 }, effect: { unlockAnimal: ["bee"], capacity: 2, growthAura: 0.92 },
                 maxCount: 1,
                 desc: "產蜂蜜 + 作物成長 ×0.92（最多 1 座生效）" },
  duckPen:     { id: "duckPen", name: "鴨舍", emoji: "🦆", unlockLevel: 6,
                 cost: { coins: 380, wood: 8, stone: 2 }, effect: { unlockAnimal: ["duck"], capacity: 3 },
                 maxCount: 1,
                 desc: "解鎖鴨，生產鴨蛋（每座最多 3 隻；全場最多 1 座）" },
  memory_garden: { id: "memory_garden", name: "祖母花圃", emoji: "🏵️", unlockLevel: 4,
                 cost: { wood: 6, compost: 4 }, effect: { orderXpBonus: 0.05, mailFlavor: true },
                 maxCount: 1,
                 desc: "訂單 XP +5%，並解鎖一封花圃短箋（最多 1 座；不影響售價或成長）" },
  greenhouse:  { id: "greenhouse", name: "溫室", emoji: "🏡", unlockLevel: 8,
                 cost: { coins: 760, wood: 10, stone: 6 }, effect: { growthAura: 0.88 },
                 maxCount: 1,
                 desc: "全年控溫，作物成長時間 ×0.88（最多 1 座生效）" },
  festival_stall: { id: "festival_stall", name: "豐年祭小攤", emoji: "🎪", unlockLevel: 7,
                 cost: { coins: 620, wood: 8, stone: 4 }, effect: { seasonalSellBonus: 0.15 },
                 maxCount: 1,
                 desc: "當季作物直售額外 +15%（最多 1 座生效）" },
};
const BUILDING_ORDER = ["compostHeap", "silo", "chickenCoop", "barn", "memory_garden", "beeBox", "duckPen", "festival_stall", "greenhouse"];

// ===== MVP2：動物（蓋家 → 計時生產 → 收集 → 入訂單/賣出；可餵食加速）=====
// produceMs 生產週期、feedCost 餵食成本（用作物加速、立即產出）、unlockLevel 解鎖等級
const ANIMALS = {
  chicken: { id: "chicken", name: "雞",  emoji: "🐔", product: "egg",   produceMs: 6 * 60 * 1000,  home: "chickenCoop", unlockLevel: 3, cost: 40,  feedCost: { wheat: 2 } },
  cow:     { id: "cow",     name: "牛",  emoji: "🐄", product: "milk",  produceMs: 20 * 60 * 1000, home: "barn",        unlockLevel: 5, cost: 220, feedCost: { carrot: 2 } },
  sheep:   { id: "sheep",   name: "羊",  emoji: "🐑", product: "wool",  produceMs: 30 * 60 * 1000, home: "barn",        unlockLevel: 5, cost: 180, feedCost: { carrot: 3 } },
  bee:     { id: "bee",     name: "蜜蜂", emoji: "🐝", product: "honey", produceMs: 15 * 60 * 1000, home: "beeBox",      unlockLevel: 6, cost: 120, feedCost: { wheat: 3 } },
  duck:    { id: "duck",    name: "鴨",  emoji: "🦆", product: "duck_egg", produceMs: 10 * 60 * 1000, home: "duckPen", unlockLevel: 6, cost: 95, feedCost: { potato: 2 }, sheet: "animals_duck", careSheet: "animals_duck" },
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
  set(19, 8, "D");                                   // 東林深處入口（輕門檻解鎖）
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
    id: "east_clearing", name: "東林古樹", tileChar: "E", x: 20, y: 4,
    desc: "穿過修好的斷橋，東林深處有一棵古樹。",
    reward: { coins: 120, materials: { wood: 3 } },   // 首次抵達一次性獎勵
    once: true,
  },
  east_deep_gate: {
    id: "east_deep_gate", name: "東林深處入口", tileChar: "D", x: 19, y: 8,
    desc: "枝葉擋住的小徑，需要補強踏板後才能進入更深處。",
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
// phase：start（序章）→ ch1done → bridge → ch2done → ch3done → ch4done → ch5done → postscript
const NPCS = {
  mayor: { id: "mayor", name: "鎮長 葛瑞", title: "晨光鎮長", frame: "mayor", lines: {
    start:   ["晨光鎮歡迎你回來，孩子。", "你祖母的田荒了好一陣，先到告示牌接第一張委託吧。"],
    ch1done: ["麥香又飄回鎮上了，大家都在談論你。", "東邊那座橋年久失修——把它修好，就能踏進東林。"],
    bridge:  ["橋通了！東林的古樹是晨光鎮的老守護。", "去樹下看看，聽說藏著你祖母留下的舊物。"],
    ch2done: ["連東林都走遍了，真有你祖母的影子。", "想讓農場更熱鬧？去找老農班伯，學學照顧動物吧。"],
    ch3done: ["作物跟動物你都顧得妥妥貼貼，鎮民都看在眼裡。", "以後我這偶爾會帶點小委託來，別嫌我麻煩啊。"],
    ch4done: ["豐年祭辦得穩，四季物產也站上檯面了。", "晨光鎮今年的招牌，就靠你的農場撐起來。"],
    ch5done: ["你祖母把信交給我時，手一直按著那頂草帽。", "現在我懂了，她等的不是舊農場回來，是你願意把它往前帶。"],
    postscript: ["明年的豐年祭我想多留一排攤位，讓四季物產都有自己的牌子。", "農場不用急著變大，只要每一季都有人願意再走回來。"] } },
  merchant: { id: "merchant", name: "商人 蘿拉", title: "市集商人", frame: "merchant", lines: {
    start:   ["新鮮貨色看一下？等你有了作物，市集隨時收購。"],
    ch1done: ["你的麥子品質不錯，訂單看板上的客人會喜歡。"],
    bridge:  ["東林通了？那邊的野花蜜，以後說不定能進貨。"],
    ch2done: ["生意越來越好，多虧你把路打通了。"],
    ch3done: ["聽說你連優質蛋奶都能收成，這可以當晨光鎮的招牌貨！", "手頭有好貨的話，記得留一份給我試賣。"],
    ch4done: ["四季貨架終於補齊，甜椒、葡萄和鴨蛋都能掛上祭典牌。", "豐年祭那張訂單，我會替你放在市集最顯眼的位置。"],
    ch5done: ["你祖母以前總把最好的種子留到最後才賣，說那是替明年留路。", "你回的那封信，我會替她放在貨架最裡側，不給風吹走。"],
    postscript: ["下季的貨單我先替你空著，甜椒、向日葵和葡萄都有人問。", "別把市集看成終點，它只是讓農場故事被更多人帶走的地方。"] } },
  elder: { id: "elder", name: "老農 班伯", title: "隔壁老農", frame: "elder", lines: {
    start:   ["雞舍那隻母雞養得還行，記得常餵牠。"],
    ch1done: ["想要更多蛋奶？把動物顧好，產量自然上來。"],
    bridge:  ["東林的草肥，以後放羊吃草最好。"],
    ch2done: ["下次該認真養群動物了——親密度高，產物品質才好。"],
    ch3done: ["照護的手藝算是出師了，不過動物要天天顧，可別鬆懈。", "手頭若有多的產物，拿來讓我瞧瞧成果也好。"],
    ch4done: ["你連鴨都照顧得服服貼貼，這座農場真的成氣候了。", "季節會輪，手藝不能停，記得讓田地跟著天時走。"],
    ch5done: ["她那年把草帽掛在雞舍旁，說總有一天會有人接著戴。", "你照顧得好，動物知道，土地也知道。"],
    postscript: ["花圃那邊若長了雜草，別急著拔光，有些小花會自己報季節。", "動物明天還是會餓，這很好，表示農場還在活著。"] } },
  child: { id: "child", name: "孩童 圖圖", title: "鎮上孩童", frame: "child", lines: {
    start:   ["你會種田嗎？教教我嘛！"],
    ch1done: ["哇，你收成了好多麥子！"],
    bridge:  ["橋修好了！我可以去河對面玩了嗎？"],
    ch2done: ["東林的古樹好大喔，你看過了嗎？"],
    ch3done: ["我也想幫忙跑腿！可以幫我準備一盒野餐點心嗎？"],
    ch4done: ["豐年祭的燈籠超漂亮！下次我也要幫忙掛。"],
    ch5done: ["我看見信箱亮了一下，好像故事真的住在裡面。", "以後我也要寫信，寫給長大後還記得農場的自己。"],
    postscript: ["我在野餐地圖上又畫了一條路，等秋天我們去找栗子。", "如果你明年還在，我就把最大的向日葵留給農場門口。"] } },
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
  mayor:    { pool: ["wheat", "carrot", "tomato", "radish", "corn", "bell_pepper", "sunflower", "potato", "melon"], rewardMul: 1.0,
    flavorOffer: ["鎮上想辦點小活動，能否勻些{item}給我？"],
    flavorDone:  ["有你真好，晨光鎮又熱鬧一場。"] },
  merchant: { pool: ["strawberry", "corn", "pumpkin", "radish", "bell_pepper", "sunflower", "potato", "grapes", "melon", "forest_herb", "glow_mushroom", "wild_berry", "river_mint", "mooncap_spore", "amber_resin", "forest_chestnut", "frost_cherry", "egg_good", "egg_premium", "duck_egg_good", "duck_egg_premium", "milk_good", "milk_premium", "wool_good", "wool_premium", "honey_good", "honey_premium"], rewardMul: 1.15,
    flavorOffer: ["市集缺貨，手頭有{item}嗎？"],
    flavorDone:  ["生意興隆，多虧你這批貨。"] },
  elder:    { pool: ["radish", "potato", "winter_kale", "egg", "duck_egg", "milk", "wool", "honey", "forest_herb", "glow_mushroom", "wild_berry", "river_mint", "mooncap_spore", "amber_resin", "forest_chestnut", "frost_cherry", "egg_good", "duck_egg_good", "milk_good", "wool_good", "honey_good"], rewardMul: 1.1,
    flavorOffer: ["幫我張羅點{item}，我拿去燉湯。"],
    flavorDone:  ["這品質，照顧得很用心啊。"] },
  child:    { pool: ["wheat", "carrot", "radish", "corn", "sunflower", "strawberry", "grapes", "wild_berry", "frost_cherry"], rewardMul: 0.85,
    flavorOffer: ["可以給我一點{item}嗎？我肚子餓了！"],
    flavorDone:  ["謝謝你！好好吃！"] },
};

// ===== R15/R19：鎮民一次性支線（固定小委託；不使用隨機報酬公式）=====
const NPC_SIDE_QUESTS = {
  mayor: {
    id: "mayor_notice_board", npcId: "mayor", title: "公告欄重新開張",
    wants: { wheat: 4 }, rewardCoins: 16, rewardXp: 3,
    offer: "鎮上的公告欄要重新開張，先送 4 份小麥來當第一批登記樣品吧。",
    done: "公告欄終於像樣了，大家會更常來看你的農場消息。",
    lore: "鎮公所的公告欄其實是舊農場留下的木板，重新貼滿委託後，鎮民才開始把農場當成生活的一部分。",
    steps: [
      { id: "mayor_notice_board_1", title: "公告欄重新開張",
        wants: { wheat: 4 }, rewardCoins: 16, rewardXp: 3,
        offer: "鎮上的公告欄要重新開張，先送 4 份小麥來當第一批登記樣品吧。",
        done: "公告欄終於像樣了，大家會更常來看你的農場消息。" },
      { id: "mayor_notice_board_2", title: "巡路便當",
        wants: { carrot: 2 }, rewardCoins: 9, rewardXp: 2,
        offer: "修好的路要巡一圈，幫我準備 2 份胡蘿蔔當巡路便當。",
        done: "巡路的人有東西吃，橋邊的回報也會更準時。" },
      { id: "mayor_notice_board_3", title: "鎮會樣品",
        wants: { tomato: 1 }, rewardCoins: 10, rewardXp: 3,
        offer: "鎮會想看農場現在能供應什麼，帶 1 份番茄當樣品就好。",
        done: "鎮會記下來了，這塊公告欄會繼續替農場接上鎮上的需求。" },
    ],
  },
  merchant: {
    id: "merchant_forest_bundle", npcId: "merchant", title: "東林試賣組",
    wants: { forest_herb: 1, glow_mushroom: 1 }, rewardCoins: 14, rewardXp: 4,
    offer: "我想把東林貨做成試賣組，藥草和螢光菇各一份就好。",
    done: "包裝起來很有賣相，東林的名字會慢慢傳出去。",
    lore: "商人把東林採集物列成小鎮的新貨架，外地旅人因此開始問起這座被河隔開很久的森林。",
    steps: [
      { id: "merchant_forest_bundle_1", title: "東林試賣組",
        wants: { forest_herb: 1, glow_mushroom: 1 }, rewardCoins: 14, rewardXp: 4,
        offer: "我想把東林貨做成試賣組，藥草和螢光菇各一份就好。",
        done: "包裝起來很有賣相，東林的名字會慢慢傳出去。" },
      { id: "merchant_forest_bundle_2", title: "森林香包",
        wants: { wild_berry: 1, river_mint: 1 }, rewardCoins: 14, rewardXp: 4,
        offer: "下一批要做森林香包，野莓和薄荷各一份，味道會更完整。",
        done: "香味很清楚，這批可以放到市集攤前面。" },
      { id: "merchant_forest_bundle_3", title: "旅人樣貨",
        wants: { corn: 1 }, rewardCoins: 13, rewardXp: 3,
        offer: "外地旅人想買能久放的農產，帶 1 份玉米讓我配成樣貨。",
        done: "有農產也有森林貨，旅人會記得這座鎮不只賣一種東西。" },
    ],
  },
  elder: {
    id: "elder_coop_check", npcId: "elder", title: "雞舍巡查",
    wants: { egg: 2 }, rewardCoins: 12, rewardXp: 4,
    offer: "讓我看看你照顧雞舍的成果，帶 2 顆雞蛋來。",
    done: "蛋殼厚實，雞舍照護算是穩了。",
    lore: "老農以前也替鎮上看顧過動物棚，現在他把照護筆記留給農場，讓年輕鎮民能接手。",
    steps: [
      { id: "elder_coop_check_1", title: "雞舍巡查",
        wants: { egg: 2 }, rewardCoins: 12, rewardXp: 4,
        offer: "讓我看看你照顧雞舍的成果，帶 2 顆雞蛋來。",
        done: "蛋殼厚實，雞舍照護算是穩了。" },
      { id: "elder_coop_check_2", title: "照護筆記",
        wants: { egg_good: 1 }, rewardCoins: 10, rewardXp: 3,
        offer: "若照護得更細，蛋會不一樣。帶 1 顆良好雞蛋讓我記到筆記裡。",
        done: "這個品質能當教學範例，筆記會更完整。" },
      { id: "elder_coop_check_3", title: "老農草藥",
        wants: { forest_herb: 1, glow_mushroom: 1 }, rewardCoins: 11, rewardXp: 3,
        offer: "動物棚也需要驅潮的草藥，東林藥草和螢光菇各帶一份來。",
        done: "棚裡會乾爽些。這套照護法，以後可以交給鎮上的孩子。" },
    ],
  },
  child: {
    id: "child_picnic_pack", npcId: "child", title: "野餐小包",
    wants: { wheat: 2, carrot: 2 }, rewardCoins: 10, rewardXp: 3,
    offer: "我想做一份野餐小包，可以幫我準備小麥和胡蘿蔔嗎？",
    done: "野餐小包完成！我會分一點給大家。",
    lore: "孩子把第一次野餐畫成地圖，標出橋、菇木和薄荷水邊，成了小鎮新的散步路線。",
    steps: [
      { id: "child_picnic_pack_1", title: "野餐小包",
        wants: { wheat: 2, carrot: 2 }, rewardCoins: 10, rewardXp: 3,
        offer: "我想做一份野餐小包，可以幫我準備小麥和胡蘿蔔嗎？",
        done: "野餐小包完成！我會分一點給大家。" },
      { id: "child_picnic_pack_2", title: "森林點心",
        wants: { wild_berry: 1 }, rewardCoins: 7, rewardXp: 2,
        offer: "野餐如果有東林野莓就更像冒險了，可以帶 1 份嗎？",
        done: "甜甜的！我會在地圖上畫一顆莓果記號。" },
      { id: "child_picnic_pack_3", title: "路線標記",
        wants: { wheat: 2, carrot: 1 }, rewardCoins: 7, rewardXp: 2,
        offer: "最後要做路線標記的小點心，再給我 2 份小麥和 1 份胡蘿蔔。",
        done: "完成！大家可以照著我的野餐地圖走到東林邊。" },
    ],
  },
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
    desc: "走到訂單看板，交付首收小麥可完成的新手訂單。", next: "clear_old_path",
    objective: "deliver", marker: { kind: "station", type: "order_board" } },
  clear_old_path:    { id: "clear_old_path", title: "清開荒地舊路",
    desc: "用清除工具清掉擋路的樹樁，取得修橋用木材並打通南邊。", next: "repair_bridge",
    objective: "clear", marker: { kind: "obstacle", object: "stump" }, chapter: 1 },
  // ===== 第二章：世界可探索（Stage 5）=====
  repair_bridge:     { id: "repair_bridge", title: "修復東邊斷橋",
    desc: "依任務 Dock 的材料清單清除大樹與巨石，湊齊木材 6、石頭 4 後走到斷橋修復。", next: "explore_new_area",
    objective: "repair_bridge", marker: { kind: "bridge" }, chapter: 2 },
  explore_new_area:  { id: "explore_new_area", title: "探索東林空地",
    desc: "過橋走到東林古樹，看看封鎖已久的東邊有什麼。", next: "discover_east_forage",
    objective: "reach_event", marker: { kind: "event", event: "east_clearing" }, chapter: 2 },
  discover_east_forage: { id: "discover_east_forage", title: "辨認東林採集點",
    desc: "前往東林的藥草叢或菇木，先記下可採集的位置。", next: "collect_east_forage",
    objective: "discover_forage", marker: { kind: "forage" }, chapter: 2 },
  collect_east_forage: { id: "collect_east_forage", title: "收集東林樣品",
    desc: "各採集一份東林藥草與螢光菇，帶回鎮上確認用途。", next: "report_east_forage",
    objective: "collect_forage", marker: { kind: "forage" }, chapter: 2 },
  report_east_forage: { id: "report_east_forage", title: "回報東林新貨源",
    desc: "把東林藥草與螢光菇交給商人登記，讓採集品進入鎮民委託。", next: "learn_animal_care",
    objective: "report_forage", marker: { kind: "npc", type: "merchant" }, chapter: 2 },
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
    desc: "把優質/頂級產物直售或交付訂單，讓晨光鎮嚐嚐用心照顧的成果。", next: "prepare_four_seasons",
    objective: "deliver_quality", chapter: 3 },
  // ===== 第四章：豐年祭・四季物產（R47）=====
  prepare_four_seasons: { id: "prepare_four_seasons", title: "備齊四季物產",
    desc: "至少收成四種不同季節的作物，讓祭典攤位有春夏秋冬的代表。",
    next: "welcome_ducks", objective: "harvest_four_seasons", marker: { kind: "soil" }, chapter: 4 },
  welcome_ducks: { id: "welcome_ducks", title: "迎接鴨舍新成員",
    desc: "興建鴨舍、飼養鴨，收集一顆鴨蛋作為新物產樣品。",
    next: "finish_festival_order", objective: "collect_duck_egg", marker: { kind: "building", type: "duckPen" }, chapter: 4 },
  finish_festival_order: { id: "finish_festival_order", title: "完成豐年祭訂單",
    desc: "交付一張豐年祭訂單，讓四季物產正式登上晨光鎮祭典。",
    next: null, objective: "festival_order", marker: { kind: "station", type: "order_board" }, chapter: 4 },
};
const FIRST_QUEST = "intro_reopen_farm";
// 章節任務分組（故事面板：第一章完成度 X/6，第二章 X/2、第三章 X/5 另計）
const PROLOGUE_QUESTS = ["intro_reopen_farm", "plant_wheat", "first_water", "first_harvest", "first_delivery", "clear_old_path"];
const CHAPTER2_QUESTS = ["repair_bridge", "explore_new_area", "discover_east_forage", "collect_east_forage", "report_east_forage"];
const CHAPTER3_QUESTS = ["learn_animal_care", "feed_care_animal", "raise_affinity_happy", "collect_quality_product", "deliver_quality_order"];
const CHAPTER4_QUESTS = ["prepare_four_seasons", "welcome_ducks", "finish_festival_order"];

const LETTERS = [
  {
    id: "letter_first_delivery",
    title: "第一封：田重新會呼吸",
    from: "祖母",
    season: "春",
    unlock: { type: "story_completed", id: "first_delivery" },
    body: [
      "孩子，若你讀到這封信，表示第一批作物已經從土裡回到倉庫，也回到晨光鎮人的餐桌上。",
      "你祖父第一次牽著我的手播種時，整塊田還硬得像睡著的石頭，我們也是從幾把小麥開始，慢慢聽見土地吐氣。",
      "不要急著把荒蕪看成失敗，荒蕪有時只是等一個願意彎腰的人。",
      "你肯回來，我就知道陽光農場還記得家的方向。"
    ],
  },
  {
    id: "letter_bridge",
    title: "第二封：橋那邊的風",
    from: "祖母",
    season: "夏",
    unlock: { type: "flag", flag: "bridgeRepaired" },
    body: [
      "東橋若修好了，你一定會先聽見河面上的風，聲音跟你小時候在門口追蜻蜓時一樣。",
      "那座橋是你祖父跟鎮上的人一起搭的，他說農場不能只顧自己的田，也要替大家留一條路。",
      "後來木板老了，我的膝蓋也老了，只能把那邊的林子交給時間看守。",
      "現在你走過去時，請替我摸摸橋欄，跟它說一聲：我們回來了。"
    ],
  },
  {
    id: "letter_animals",
    title: "第三封：母雞認得溫柔",
    from: "祖母",
    season: "春",
    unlock: { type: "animal_happy" },
    body: [
      "動物其實比人更早知道一座農場有沒有被好好照顧。",
      "旱災那年，我們省下井水給母雞喝，牠少下了好幾週的蛋，卻在第一場雨後站到門口叫我起床。",
      "你祖父笑說，那不是催人工作，是牠在確認家裡的人還在。",
      "如果牠們願意靠近你，就把草帽戴穩，慢慢說話，田邊所有活物都聽得懂溫柔。"
    ],
  },
  {
    id: "letter_spring",
    title: "第四封：春天的第一把泥",
    from: "祖母",
    season: "春",
    unlock: { type: "season_reached", season: "春" },
    body: [
      "春天來時，別只看花，先抓一把濕泥聞聞。",
      "泥裡有去年的葉、有冬天慢慢化開的寒氣，也有你還沒種下去的盼望。",
      "我年輕時總在春分前後種豌豆，因為它們攀得快，好像替人把心事往上拉。",
      "若你覺得重新開始很笨拙，就讓春天教你，所有新芽一開始都站不穩。"
    ],
  },
  {
    id: "letter_summer",
    title: "第五封：夏日要記得留水",
    from: "祖母",
    season: "夏",
    unlock: { type: "season_reached", season: "夏" },
    body: [
      "夏天的晨光鎮會亮得讓人瞇眼，連石板路都像剛烤過。",
      "旱災最嚴重那一年，我跟你祖父把水桶排在井邊，先給苗、再給雞，最後才輪到自己洗手。",
      "那時我學會一件事：豐收不是把所有東西都拿到手，而是知道該替明天留下什麼。",
      "你若種甜椒、玉米或地瓜，記得看天，也記得看自己的力氣。"
    ],
  },
  {
    id: "letter_autumn",
    title: "第六封：秋天把名字留下",
    from: "祖母",
    season: "秋",
    unlock: { type: "season_reached", season: "秋" },
    body: [
      "秋天是我最喜歡記帳的季節，因為每一筆收成後面都有一個人的名字。",
      "葡萄送去給蘿拉，栗子留給圖圖，地瓜要挑幾條細長的，讓鎮長拿去分給巡路的人。",
      "你祖父常說，農場的倉庫若只堆滿貨，就會變得很安靜；若記得要分給誰，門口才會熱鬧。",
      "所以別怕把好東西拿出去，土地給你的，不會因為分享就變少。"
    ],
  },
  {
    id: "letter_winter",
    title: "第七封：霜裡也有綠",
    from: "祖母",
    season: "冬",
    unlock: { type: "season_reached", season: "冬" },
    body: [
      "冬天的田看起來慢，其實只是把力氣藏在土裡。",
      "我晚年最愛種冬羽甘藍，葉子被霜碰過後反而更甜，像人經過一些冷日子，心也會變得更懂珍惜。",
      "你祖父走後的第一個冬天，我每天都到田埂站一下，不說話，只看那些還肯發綠的葉。",
      "孩子，若哪天你覺得孤單，就去看看冬天的菜，它們會告訴你：還能長。"
    ],
  },
  {
    id: "letter_festival",
    title: "第八封：豐年祭的燈",
    from: "祖母",
    season: "四季",
    unlock: { type: "festival_orders", count: 1 },
    body: [
      "若豐年祭的燈籠又掛起來了，我想晨光鎮一定比我記憶裡更亮。",
      "我把這些信交給葛瑞時，沒有把話說滿，因為我不知道回來的人會不會怨我留下太多未完成的事。",
      "可我一直相信，農場不是祖母的，也不是祖父的，它屬於每一個願意讓土地和人重新靠近的人。",
      "現在輪到你寫一封信了，不必寫給過去的我，寫給明天還會走進這塊田的自己。"
    ],
  },
  {
    id: "letter_mayor_notice_back",
    title: "葛瑞：公告欄背面的字",
    from: "葛瑞",
    season: "四季",
    unlock: { type: "side_quest_done", npcId: "mayor" },
    body: [
      "我把舊公告欄翻修時，才看見背面刻著你祖母的字：『留一格給還沒回家的人。』",
      "以前我只當那是她念舊，直到你把委託一張張接回來，鎮上的人又開始在欄前停步。",
      "謝謝你讓這塊木板不只是公告，也像一扇重新打開的門。"
    ],
  },
  {
    id: "letter_merchant_ledger_leaf",
    title: "蘿拉：市集帳本夾層",
    from: "蘿拉",
    season: "四季",
    unlock: { type: "side_quest_done", npcId: "merchant" },
    body: [
      "整理帳本時，我找到一張你祖母留下的夾頁，上面只寫著『好貨要有人情味才賣得遠』。",
      "你送來的森林香包和農產樣貨，讓這句話突然變得很會算帳。",
      "下次來市集，我替你留一格最不怕風吹的位置。"
    ],
  },
  {
    id: "letter_elder_care_note",
    title: "班伯：照護筆記末頁",
    from: "班伯",
    season: "四季",
    unlock: { type: "side_quest_done", npcId: "elder" },
    body: [
      "照護筆記最後一頁本來是空的，我今天補上一行：『有人願意慢慢學，動物就願意慢慢信。』",
      "你送來的蛋、草料和成果都不算誇張，卻很穩，這比一時的熱鬧更難得。",
      "農場的聲音回來了，以後每天照常做就好。"
    ],
  },
  {
    id: "letter_child_picnic_map",
    title: "圖圖：野餐地圖背面",
    from: "圖圖",
    season: "四季",
    unlock: { type: "side_quest_done", npcId: "child" },
    body: [
      "我在野餐地圖背面畫了農場，田是方方的，橋是亮亮的，信箱旁邊有一顆大大的星星。",
      "你給我的點心都很好吃，可是最好的是大家又有地方可以去。",
      "等下次豐年祭，我要把這張地圖拿給所有人看。"
    ],
  },
  {
    id: "letter_memory_garden",
    title: "花圃邊的短箋",
    from: "祖母",
    season: "四季",
    unlock: { type: "building_owned", id: "memory_garden" },
    body: [
      "如果你替我留下一小塊花圃，請別把它整理得太整齊。",
      "有些花會自己選地方長，像人會自己選回家的日子。",
      "你若從旁邊走過，就當我在田埂上向你點頭。"
    ],
  },
];
const CHAPTER5_LETTERS = [
  "letter_first_delivery",
  "letter_bridge",
  "letter_animals",
  "letter_spring",
  "letter_summer",
  "letter_autumn",
  "letter_winter",
  "letter_festival",
];
const TOWNSFOLK_LETTERS = [
  "letter_mayor_notice_back",
  "letter_merchant_ledger_leaf",
  "letter_elder_care_note",
  "letter_child_picnic_map",
];

const MAP_DEFAULT = { width: MAP_W, height: MAP_H };
// 走路方向 → walk-cycle sheet 列（4 列：下/左/右/上）
const FACING_ROW = { down: 0, left: 1, right: 2, up: 3 };

// ===== 匯出（瀏覽器掛 window、Node 用 module.exports）=====
const CONFIG = {
  GAME, CROPS, CROP_SHEET, SEASONS, SEASON_DURATION_MS, SEASON_UNLOCK_LEVEL,
  SEASON_ORDER_BIAS, SEASON_EVENTS,
  LEVEL_XP, levelFromXp, xpForLevel,
  UPGRADES, UPGRADE_ORDER, ORDER_RARITY, ORDER_STREAK_BONUS, ORDER_STREAK_CAP,
  WEATHER, WEATHER_UNLOCK_LEVEL, WEATHER_DURATION_MS, ACHIEVEMENTS,
  PRODUCTS, FORAGE_ITEMS, FORAGE_NODES, FORAGE_NODE_COOLDOWN_MS, EAST_DEEP_FORAGE_COOLDOWN_MS,
  EAST_FORAGE_REPORT, EAST_DEEP_UNLOCK_COST, COLLECTIBLES,
  getItemDef, itemSellValue, MATERIALS, TERRAIN, OBSTACLES,
  BUILDINGS, BUILDING_ORDER, ANIMALS, MAP_DEFAULT,
  TOOLS, TOOL_ORDER, MOISTURE_MUL,
  MAP_LAYOUT, TERRAIN_CODE, OBSTACLE_CODE, PLAYER_START, MOVE_MS, FACING_ROW,
  STATIONS, STATION_PLACEMENT,
  MAP_W, MAP_H, TILE_PX, STRUCTURES, QUESTS, FIRST_QUEST,
  EAST_REGION_MIN_X, BRIDGE_COST, EVENTS, PROLOGUE_QUESTS, CHAPTER2_QUESTS, CHAPTER3_QUESTS, CHAPTER4_QUESTS,
  LETTERS, CHAPTER5_LETTERS, TOWNSFOLK_LETTERS,
  NPCS, NPC_PLACEMENT, NPC_REQUESTS, NPC_REQUEST_COOLDOWN_MS, NPC_SIDE_QUESTS,
  QUALITY_TIERS, QUALITY_SELL_MUL, QUALITY_LABEL,
  AFFINITY_MAX, AFFINITY_DECAY_PER_HOUR, AFFINITY_HAPPY_THRESHOLD, AFFINITY_GOOD_THRESHOLD,
  CARE_GAIN, CARE_COOLDOWN_MS, STATUS_STALE_MS,
};
if (typeof window !== "undefined") Object.assign(window, CONFIG, { CONFIG });
if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
