/* R75 adventure rules. Load after config.js; no DOM, timers, or save replacement.
 * Call ensure on load, then record successful external game actions only.
 * cook/fish/restore record their own events; record never grants inventory.
 * Selectors return detached arrays. Mutators return { ok, message, ... }.
 */
(function (root) {
  "use strict";
  const C = typeof module !== "undefined" && module.exports ? require("./config.js") : (root.CONFIG || root);
  const VERSION = 2;
  const COUNT_CAP = 1000000;
  const EVENT_CAP = 100;
  const MEAL_CAP = 99;
  const CATCH_CAP = 99;
  const FISH_COOLDOWN_MS = 30000;
  const EVENTS = ["plant", "water", "harvest", "talk", "forage", "fish", "cook", "restore", "order", "care"];
  const CHAPTERS = [
    { id: "home", name: "回家與第一餐" },
    { id: "river", name: "河畔復興" },
    { id: "picnic", name: "收穫野餐" },
  ];
  const PROJECTS = [
    { id: "fishing_dock", name: "河畔釣台", description: "補好河邊踏板，班伯會借你一支魚竿。", target: { kind: "river", id: "fishing_dock", tileId: "t2_9" },
      cost: { wood: 4, stone: 2 }, unlockQuest: "c1_first_meal", unlocks: ["fishing", "fishing_rod"] },
    { id: "picnic_table", name: "野餐桌", description: "鋪好桌面，讓大家帶著料理來河邊坐坐。", target: { kind: "station", id: "picnic_table", tileId: "t10_10" },
      cost: { wood: 6, wheat: 4 }, unlockQuest: "c2_river_basket", unlocks: ["baked_carrot", "mint_tea", "meal_gifts"] },
    { id: "garden", name: "花園", description: "整理一片小花圃，留下壓花和野餐後的留言。", target: { kind: "station", id: "garden", tileId: "t6_2" },
      cost: { coins: 80, wood: 4 }, unlockQuest: "c3_good_neighbors", unlocks: ["pressed_flower", "garden_guestbook"] },
  ];
  const RECIPES = [
    { id: "rustic_bread", name: "農家麥餅", description: "把剛收的小麥烤成第一餐。", ingredients: { wheat: 2 }, unlockQuest: "c1_first_harvest" },
    { id: "baked_carrot", name: "胡蘿蔔烤餅", description: "加上胡蘿蔔，烤一份能帶去野餐的點心。", ingredients: { wheat: 1, carrot: 2 }, unlockProject: "picnic_table" },
    { id: "mint_tea", name: "溪畔薄荷茶", description: "用溪畔薄荷泡茶，配上一小片麥餅。", ingredients: { river_mint: 1, wheat: 1 }, unlockProject: "picnic_table" },
  ];
  const FISH = [
    { id: "river_carp", name: "河鯉" },
    { id: "silver_dace", name: "銀鯽" },
    { id: "river_perch", name: "溪鱸" },
  ];
  // These are observations of people, never a new list of orders or daily goals.
  const NEIGHBORS = [
    { id: "merchant", name: "蘿拉", title: "攤子外的那張凳子", taste: "sour",
      story: "市集收攤了，蘿拉還在數空籃。你把麥餅放到秤旁，她先擦乾雙手，才解開紅格布。原本藏在攤子底下的小凳子，被她拉到陽光裡。她替你也倒了一杯茶。",
      reply: "整天站在攤子後面，都快忘了外面有張凳子。明天收攤，再一起坐一下。",
      recallContext: "那天收攤後，她把凳子拉到陽光裡，也替你挪出一個位子。她終於放下手裡的秤，舉起茶杯，笑說這一口很像走到溪邊時吹來的風。",
      matchedStory: "這次蘿拉先把秤放回攤上，再把兩張凳子拉到陽光裡。她分好餅，替你倒茶，還在桌上的手記夾了一條紅格書籤。今天不用等收攤，你們就坐到了一起。",
      matchedConversation: "秤先放著。凳子都拉出來了，這杯茶換我替你倒。",
      hint: "今天這籃麥餅，我要配著茶吃。忙了一天，倒想添一點酸酸的野莓，嘴裡會清爽些。",
      wrongReply: "你上回帶的麥餅我收好了。這一籃也分一半給你；只是收攤後，我還惦著那口酸酸的野莓。",
      matchedReply: "你還記得那口酸！秤放回攤上，兩張凳子都拉到陽光裡了。野莓餅一人一半；紅格書籤留在你的手記，下回接著聊。" },
    { id: "elder", name: "班伯", title: "灶火還留著", taste: "hot",
      story: "班伯把雞舍的門帶上，才發現你站在灶邊。桌上只擺了一個盤子。他接過餐籃，從櫥裡再拿一個，把修了一半的魚竿挪到牆邊。今天那根竿子可以晚點再修。",
      reply: "本來想隨便吃兩口。你一來，倒像該好好坐下吃頓飯了。",
      recallContext: "他剛關好雞舍，先把雙手靠向灶口。魚竿挪到牆邊，留給你的盤子擺在灶旁；他沒急著收拾，先拉開旁邊的凳子。",
      matchedStory: "班伯把修好的魚竿靠回雞舍牆邊，灶旁已擺好兩個盤子。他替你拉開凳子，把紅格書籤放進桌上的手記。你護著餐籃走來，他就知道今天可以一起坐下。",
      matchedConversation: "魚竿修好了，先靠在牆邊。你的盤子就在灶旁，坐下吃完再去看河。",
      hint: "你今天送來的麥餅，讓我想多吃兩口。從雞舍回來手都涼了，還冒熱氣的餅，最合胃口。",
      wrongReply: "今天這籃我留在灶旁了，等回烤再吃。從雞舍回來，手裡捧一塊熱餅才暖和。",
      matchedReply: "還熱著呢，你一路護著帶來的吧？魚竿靠在牆邊，灶旁兩個盤子都擺好了。紅格書籤替你夾著，吃完再一起去看河。" },
    { id: "child", name: "圖圖", title: "空椅子也有點心", taste: "sweet",
      story: "圖圖把小花壓進本子裡，頁角卻一直翹起來。你拿餐籃壓住，他就空出雙手，把餅分成三塊。兩塊放在你們面前，剩下一塊，他端到旁邊的空椅子上。",
      reply: "這塊先留著。等一下有人來，就不用看我們吃了。花乾了以後，也分你一朵。",
      recallContext: "他數了數在座的人，還是把點心分成三份，替空椅子留了一份。那天說起最喜歡的滋味，他笑得瞇起眼睛，手裡仍護著那朵小花。",
      matchedStory: "圖圖遠遠就看見你的餐籃。他把壓好的花擺在空椅子上，再把紅格書籤攤在桌上的手記裡。這次不用再問，他知道你記得那天說過的話。",
      matchedConversation: "這次換我準備一份禮物。花和書籤都留給你，下次坐下來，還能接著聊。",
      hint: "今天這籃麥餅，我留一塊給空椅子了。我想要像烤胡蘿蔔那樣甜甜的，下次也一起吃嗎？",
      wrongReply: "這一籃我也分好囉。不過我還是想著烤胡蘿蔔甜甜的味道，酸的會讓我瞇眼睛。",
      matchedReply: "是甜甜的胡蘿蔔！你記得耶。壓好的花先放在空椅子上，紅格書籤夾進你的手記裡；下次還留這張椅子給你。" },
  ];
  const FLAVORS = [
    { id: "plain", name: "原味", description: "一份麥餅，不加配料。初次拜訪聽回話；之後送原味也會收下，但不會觸發口味配對。", ingredients: {} },
    { id: "sweet", name: "甜", description: "夾一片烤胡蘿蔔，添一點甜。", ingredients: { carrot: 1 } },
    { id: "sour", name: "酸", description: "配一把溪邊野莓，酸香清爽。", ingredients: { wild_berry: 1 } },
    { id: "hot", name: "熱", description: "灶邊回烤，用布包好趁熱送。", ingredients: {} },
  ];
  const SHARED_PAIRINGS = [
    { id:"sour_hot",name:"野莓酸香＋灶邊熱餅",tastes:["sour","hot"],description:"一份加野莓、一份趁熱包好。" },
    { id:"hot_sweet",name:"灶邊熱餅＋甜胡蘿蔔",tastes:["hot","sweet"],description:"一份趁熱、一份加烤胡蘿蔔。" },
    { id:"sweet_sour",name:"甜胡蘿蔔＋野莓酸香",tastes:["sweet","sour"],description:"一份甜、一份酸，裝成兩個獨立小盤。" },
  ];
  const SHARED_ORDERS = [
    {id:"market_fireside",name:"收攤後的灶邊桌",guests:["merchant","elder"],reward:{coins:10,xp:0,materials:{}},response:"蘿拉把秤收好，班伯也把魚竿靠回牆邊。酸香和熱餅都到手，兩人終於一起坐下。"},
    {id:"fireside_garden",name:"灶火旁的空椅子",guests:["elder","child"],reward:{coins:0,xp:0,materials:{wood:2}},response:"班伯護著熱餅，圖圖把甜點分給空椅子。灶火旁多留了一個真正能坐下的位置。"},
    {id:"garden_market",name:"花園收攤茶桌",guests:["child","merchant"],reward:{coins:0,xp:5,materials:{}},response:"圖圖端著甜點，蘿拉倒了酸香野莓茶。紅格手記記下花園與市集第一次共用一張桌。"},
  ];
  // R6 presentation is separate from the retained R1–R5 narrative API contract.
  const MEMORIES = {
    merchant: { token: "陽光茶凳", heading: "蘿拉把茶杯留在陽光裡", detail: "秤放回攤上，兩張凳子拉到陽光裡。她把茶杯倒扣在你的位子，下次來就翻過來。", reply: "秤收好了，凳子就留在陽光裡。這只茶杯是你的，來了自己坐。", wrong: "她把這一口配著茶慢慢吃完，又把空杯推向你：『收攤後，想找個能把一整天洗掉的滋味。你也坐下試試。』" },
    elder: { token: "修好的魚竿", heading: "班伯掛起魚竿，留下兩只盤子", detail: "魚竿修好了，掛上雞舍外的木架。灶旁的兩個盤子不再收進櫥裡，班伯拍拍靠灶那張凳子。", reply: "魚竿掛好囉。灶旁兩個盤子都留著，手涼就坐近一點，吃完再去看河。", wrong: "班伯先把盤子挪近灶口，雙手搓了搓：『先別收火。從雞舍回來，連指節都僵了；我想捧著吃，慢慢暖回來。』" },
    child: { token: "壓花空椅", heading: "圖圖替空椅子放了一朵花", detail: "壓好的花放上空椅子，圖圖把第三塊點心也留好。不是等誰來領獎，是想讓後到的人也能坐下吃。", reply: "是甜甜的胡蘿蔔！壓好的花放在空椅子上了。這塊點心先不動，下次你帶誰來，我都留位子。", wrong: "圖圖把眼睛瞇成兩條線，仍把餅分了三塊：『這一口會讓臉皺起來耶！我想要吃完還忍不住舔手指的那種。空椅子也要一塊。』" }
  };
  const RHYTHMS = {
    river_carp: { clue: "寬尾攪起濁水，等浮標沉下", note: "河鯉慢慢擺尾，攪起一團濁水。碎水紋向浮標合攏，寬尾翻起、浮標沉下時再提竿。", phases: [[900,"still","水面很靜"],[280,"tap","輕點一下"],[420,"still","浮回來了"],[280,"tap","又輕點一下"],[1300,"strike","浮標沉下去了"]] },
    silver_dace: { clue: "魚嘴啄水，短水花裡提竿", note: "銀鯽的小嘴朝上啄水，幾滴碎水花跳起來。水花還在時提竿才來得及，等水花散掉就晚了。", phases: [[2200,"still","停得比平常久"],[1400,"strike","忽然往下沉了"]] },
    river_perch: { clue: "魚影轉身，等尾流展開", note: "溪鱸先彎身轉向，魚影拖出彎彎的水痕。浮標沉下去時還別急；等魚影衝向一側、V形尾流向兩側展開，再把竿子提起來。", phases: [[650,"still","水紋慢慢散開"],[600,"pull","浮標被橫拉了"],[750,"still","又停住了"],[1100,"strike","這次沉下去了"]] },
  };
  const COLLECTIBLES = {
    pressed_flower: { id: "pressed_flower", name: "河畔壓花", description: "花園整理好後留下的第一朵小花。" },
    picnic_memory: { id: "picnic_memory", name: "收穫野餐合照", description: "麥餅、薄荷茶和鎮民一起入鏡的那個下午。" },
  };
  const goal = (type, count, name, id) => ({ type, count, name, id: id || null });
  const reward = (coins, xp, materials, extra) => Object.assign({ coins, xp, materials: materials || {} }, extra || {});
  const QUESTS = [
    { id: "c1_homecoming", chapter: 1, name: "把田叫醒", npcId: "mayor", description: "跟葛瑞打聲招呼，再種下三格作物，替它們澆水。", target: { kind: "npc", id: "mayor" }, wants: {},
      goals: [goal("talk", 1, "和葛瑞交談", "mayor"), goal("plant", 3, "播種農地"), goal("water", 3, "澆水農地")], reward: reward(12, 2, { wood: 6, stone: 2 }) },
    { id: "c1_first_harvest", chapter: 1, name: "留一把小麥", npcId: "elder", description: "收下第一批作物，找班伯聊聊，把兩份小麥留給他的灶台。", target: { kind: "npc", id: "elder" }, wants: { wheat: 2 },
      goals: [goal("harvest", 6, "收穫作物數量"), goal("talk", 1, "和班伯交談", "elder")], reward: reward(16, 6, { wood: 4, stone: 4 }) },
    { id: "c1_first_meal", chapter: 1, name: "回家的第一餐", npcId: "elder", description: "在野餐廚房做一份農家麥餅，帶給班伯嚐嚐。他準備好了修釣台的木料。", target: { kind: "station", id: "kitchen", tileId: "t10_10" }, wants: {}, wantsMeals: { rustic_bread: 1 },
      goals: [goal("cook", 1, "烹調農家麥餅", "rustic_bread")], reward: reward(20, 4, { wood: 6 }, { fishingRod: true }) },
    { id: "c2_fishing_dock", chapter: 2, name: "河邊有個落腳處", npcId: "elder", description: "用四份木材、兩份石材修好釣台，再試試班伯的魚竿。", target: { kind: "river", id: "fishing_dock", tileId: "t2_9" }, wants: {},
      goals: [goal("restore", 1, "修復河畔釣台", "fishing_dock")], reward: reward(16, 4) },
    { id: "c2_river_basket", chapter: 2, name: "河風裡的提籃", npcId: "merchant", description: "釣兩尾魚，採一份溪畔薄荷。蘿拉收一尾魚和薄荷，替野餐桌備好木料。", target: { kind: "river", id: "fishing_dock", tileId: "t2_9" }, wants: { river_mint: 1 }, wantsCatch: 1,
      goals: [goal("fish", 2, "釣獲魚隻"), goal("forage", 1, "採集溪畔薄荷", "river_mint")], reward: reward(24, 6, { wood: 6 }) },
    { id: "c2_picnic_table", chapter: 2, name: "多放幾張椅子", npcId: "merchant", description: "修好野餐桌，找蘿拉確認座位，再交兩份胡蘿蔔試做點心。", target: { kind: "station", id: "picnic_table", tileId: "t10_10" }, wants: { carrot: 2 },
      goals: [goal("restore", 1, "修復野餐桌", "picnic_table"), goal("talk", 1, "和蘿拉交談", "merchant")], reward: reward(32, 8) },
    { id: "c3_good_neighbors", chapter: 3, name: "鄰居都到齊", npcId: "elder", description: "照顧動物三次、完成兩張訂單，把兩份小麥帶給班伯。野餐前先把日常顧好。", target: { kind: "npc", id: "elder" }, wants: { wheat: 2 },
      goals: [goal("care", 3, "照顧動物"), goal("order", 2, "完成訂單"), goal("talk", 1, "和班伯交談", "elder")], reward: reward(40, 8, { wood: 4 }) },
    { id: "c3_garden", chapter: 3, name: "桌邊的小花園", npcId: "child", description: "整理花園，烤胡蘿蔔餅、泡薄荷茶。圖圖想把第一朵小花壓進筆記本。", target: { kind: "station", id: "garden", tileId: "t6_2" }, wants: {},
      goals: [goal("restore", 1, "整理花園", "garden"), goal("cook", 1, "烹調胡蘿蔔烤餅", "baked_carrot"), goal("cook", 1, "烹調溪畔薄荷茶", "mint_tea")], reward: reward(0, 8, {}, { collectible: "pressed_flower" }) },
    { id: "c3_harvest_picnic", chapter: 3, name: "把收穫端上桌", npcId: "child", description: "找圖圖一起開飯。帶一份麥餅、一份胡蘿蔔烤餅、一壺薄荷茶和兩尾魚，留張野餐合照。", target: { kind: "npc", id: "child" }, wants: {},
      wantsMeals: { rustic_bread: 1, baked_carrot: 1, mint_tea: 1 }, wantsCatch: 2,
      goals: [goal("talk", 1, "和圖圖交談", "child"), goal("restore", 1, "修復河畔釣台", "fishing_dock"), goal("restore", 1, "修復野餐桌", "picnic_table"), goal("restore", 1, "整理花園", "garden")],
      reward: reward(24, 12, {}, { collectible: "picnic_memory", guestbook: true }) },
  ];

  function object(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
  function own(value, id) { return object(value) && Object.prototype.hasOwnProperty.call(value, id); }
  function qty(value, cap) { return Number.isFinite(value) && value > 0 ? Math.min(cap || COUNT_CAP, Math.floor(value)) : 0; }
  function credit(value, amount) { return Math.min(Number.MAX_SAFE_INTEGER, qty(value, Number.MAX_SAFE_INTEGER) + amount); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function sum(values) { return Math.min(COUNT_CAP, Object.values(values || {}).reduce((n, v) => n + qty(v), 0)); }
  function at(state, now) {
    if (now === undefined) return Math.max(qty(state && state.lastSeenAt, Number.MAX_SAFE_INTEGER), qty(state && state.adventure && state.adventure.updatedAt, Number.MAX_SAFE_INTEGER));
    return Number.isSafeInteger(now) && now >= 0 ? now : null;
  }
  function fail(reason, message, extra) { return Object.assign({ ok: false, reason, message }, extra || {}); }
  function ok(message, extra) { return Object.assign({ ok: true, message }, extra || {}); }
  function itemName(id) {
    const def = (C.getItemDef && C.getItemDef(id)) || (C.MATERIALS || {})[id] || RECIPES.find((r) => r.id === id);
    return def ? def.name : id;
  }
  function cleanCounts(map, ids, cap) {
    const out = {};
    for (const id of ids) out[id] = qty(own(map, id) ? map[id] : 0, cap);
    return out;
  }
  function claimed(a, id) { return own(a.claimed, id) && a.claimed[id] === true; }
  function restored(a, id) { return !!(a.projects[id] && a.projects[id].restored); }

  // One-time lower bounds only: no invented repeated care/talk history or rewards.
  function backfill(state, a) {
    const s = object(state.stats) ? state.stats : {};
    const completed = (state.story && state.story.completed) || {};
    const harvest = object(s.harvested) ? sum(s.harvested) : qty(s.harvested);
    const floor = {
      plant: Math.max(qty(s.plantCount), (Array.isArray(state.plots) ? state.plots : []).filter((p) => p && p.cropId).length, completed.plant_wheat ? 1 : 0),
      water: Math.max(qty(s.waterCount), (Array.isArray(state.plots) ? state.plots : []).filter((p) => p && p.cropId && Number.isFinite(p.wateredAt) && p.wateredAt >= p.plantedAt).length, completed.first_water ? 1 : 0),
      harvest: Math.max(harvest, qty(s.totalHarvested)),
      order: qty(s.fulfilledOrders),
      forage: sum(Object.fromEntries(Object.keys(C.FORAGE_ITEMS || {}).map((id) => [id, s.collected && s.collected[id]]))),
      care: Math.max(qty(s.careCount), qty(s.animalCareCount), qty(s.cared), (Array.isArray(state.animals) ? state.animals : []).reduce((n, animal) => n + ["lastFedAt", "lastWateredAt", "lastGroomedAt"].filter((key) => animal && qty(animal[key], Number.MAX_SAFE_INTEGER) > 0).length, 0), completed.feed_care_animal ? 1 : 0),
    };
    for (const type of Object.keys(floor)) a.counts[type] = Math.max(a.counts[type], qty(floor[type]));
    for (const id of Object.keys(C.NPCS || {})) {
      if (state.story && state.story.dialogueSeen && state.story.dialogueSeen[id]) a.byTarget.talk[id] = Math.max(a.byTarget.talk[id] || 0, 1);
    }
    if (completed.learn_animal_care) a.byTarget.talk.elder = Math.max(a.byTarget.talk.elder || 0, 1);
    for (const id of Object.keys(C.FORAGE_ITEMS || {})) a.byTarget.forage[id] = Math.max(a.byTarget.forage[id] || 0, qty(s.collected && s.collected[id]));
    a.counts.talk = Math.max(a.counts.talk, sum(a.byTarget.talk));
    a.counts.fish = Math.max(a.counts.fish, sum(a.catch));
    a.counts.cook = Math.max(a.counts.cook, sum(a.meals));
    for (const r of RECIPES) a.byTarget.cook[r.id] = Math.max(a.byTarget.cook[r.id] || 0, a.meals[r.id]);
    for (const id of Object.keys(C.CROPS || {})) a.byTarget.harvest[id] = Math.max(a.byTarget.harvest[id] || 0, qty(s.harvested && s.harvested[id]));
    a.counts.restore = Math.max(a.counts.restore, PROJECTS.filter((p) => restored(a, p.id)).length);
    a.migrated = true;
  }
  function goalCount(a, g) {
    if (g.type === "restore" && g.id) return restored(a, g.id) ? 1 : 0;
    return g.id ? qty(a.byTarget[g.type] && a.byTarget[g.type][g.id]) : a.counts[g.type];
  }
  function requirements(state, wants, source) {
    const inventory = source === "meals" ? state.adventure.meals : source === "materials" ? state.materials : source === "coins" ? { coins: state.coins } : (state.storage && state.storage.items);
    return Object.entries(wants || {}).map(([id, required]) => {
      const current = qty(inventory && inventory[id], Number.MAX_SAFE_INTEGER);
      return { source, id, name: id === "coins" ? "金幣" : itemName(id), current, required, complete: current >= required, consume: true };
    });
  }
  function questRequirements(state, q) {
    const rows = requirements(state, q.wants, "inventory").concat(requirements(state, q.wantsMeals, "meals"));
    if (q.wantsCatch) rows.push({ source: "catch", id: "any", name: "河魚", current: sum(state.adventure.catch), required: q.wantsCatch, complete: sum(state.adventure.catch) >= q.wantsCatch, consume: true });
    return rows;
  }
  function costRequirements(state, cost) {
    return Object.entries(cost).flatMap(([id, required]) => requirements(state, { [id]: required }, id === "coins" ? "coins" : own(C.MATERIALS, id) ? "materials" : "inventory"));
  }
  function unlockedQuest(a, index) { return index === 0 || claimed(a, QUESTS[index - 1].id); }
  function sync(state, now) {
    const a = state.adventure;
    QUESTS.forEach((q, index) => {
      const rec = a.quests[q.id];
      if (claimed(a, q.id)) rec.status = "claimed";
      else if (!unlockedQuest(a, index)) rec.status = "locked";
      else if (rec.readyAt !== null || (q.goals.every((g) => goalCount(a, g) >= g.count) && questRequirements(state, q).every((r) => r.complete))) {
        rec.status = "ready";
        if (rec.readyAt === null) rec.readyAt = now;
      } else rec.status = "active";
    });
  }
  function ensure(state, now) {
    if (!object(state)) return fail("bad_state", "存檔資料不完整。");
    now = at(state, now);
    if (now === null) return fail("bad_time", "時間資料無效。");
    if (!object(state.adventure)) state.adventure = {};
    const a = state.adventure;
    a.version = VERSION;
    a.createdAt = Number.isSafeInteger(a.createdAt) && a.createdAt >= 0 ? a.createdAt : now;
    a.updatedAt = Math.max(qty(a.updatedAt, Number.MAX_SAFE_INTEGER), now);
    a.counts = cleanCounts(a.counts, EVENTS);
    if (!object(a.byTarget)) a.byTarget = {};
    a.byTarget.talk = cleanCounts(a.byTarget.talk, Object.keys(C.NPCS || {}));
    a.byTarget.forage = cleanCounts(a.byTarget.forage, Object.keys(C.FORAGE_ITEMS || {}));
    a.byTarget.harvest = cleanCounts(a.byTarget.harvest, Object.keys(C.CROPS || {}));
    a.byTarget.cook = cleanCounts(a.byTarget.cook, RECIPES.map((r) => r.id));
    a.byTarget.restore = cleanCounts(a.byTarget.restore, PROJECTS.map((p) => p.id));
    a.meals = cleanCounts(a.meals, RECIPES.map((r) => r.id), MEAL_CAP);
    a.catch = cleanCounts(a.catch, FISH.map((f) => f.id), CATCH_CAP);
    const neighbors = object(a.neighbors) ? a.neighbors : {};
    a.neighbors = Object.fromEntries(NEIGHBORS.map((n) => {
      const old = object(neighbors[n.id]) ? neighbors[n.id] : {};
      const deliveries = qty(old.deliveries);
      return [n.id, { deliveries, lastTaste: deliveries && FLAVORS.some((f) => f.id === old.lastTaste) ? old.lastTaste : "plain",
        matched: deliveries > 1 && old.matched === true, lastMatched: deliveries > 1 && old.lastMatched === true,
        deliveredAt: deliveries ? qty(old.deliveredAt, Number.MAX_SAFE_INTEGER) : 0,
        history: (Array.isArray(old.history)?old.history:[]).filter(h=>object(h)&&FLAVORS.some(f=>f.id===h.taste)&&['first','wrong','matched'].includes(h.branch)&&Number.isFinite(h.at)).slice(-12).map(h=>({taste:h.taste,branch:h.branch,at:qty(h.at,Number.MAX_SAFE_INTEGER),reaction:typeof h.reaction==='string'?h.reaction.slice(0,600):''})) }];
    }));
    const gathering = object(a.gathering) ? a.gathering : {};
    a.gathering = { packed: Object.fromEntries(NEIGHBORS.filter(n => gathering.packed && gathering.packed[n.id] === n.taste && a.neighbors[n.id].matched).map(n => [n.id, n.taste])),
      completed: gathering.completed === true && NEIGHBORS.every(n => a.neighbors[n.id].matched), completedAt: qty(gathering.completedAt, Number.MAX_SAFE_INTEGER),
      recorded: gathering.recorded===true,
      refills: (Array.isArray(gathering.refills)?gathering.refills:[]).filter(h=>object(h)&&['sour','hot','sweet'].includes(h.taste)&&Number.isFinite(h.at)&&typeof h.receipt==='string').slice(-24).map(h=>({taste:h.taste,at:qty(h.at,Number.MAX_SAFE_INTEGER),receipt:h.receipt.slice(0,240)})),
      servings: (gathering.completed === true && NEIGHBORS.every(n => a.neighbors[n.id].matched) && Array.isArray(gathering.servings) ? gathering.servings : []).filter(h => object(h) && NEIGHBORS.some(n => n.id === h.id) && ['sour','hot','sweet'].includes(h.taste) && Number.isFinite(h.at)).slice(-24).map((h,i,hs) => ({id:h.id,taste:h.taste,at:qty(h.at,Number.MAX_SAFE_INTEGER),matched:NEIGHBORS.find(n=>n.id===h.id).taste===h.taste,reply:servingReply(h.id,h.taste,hs.slice(0,i).some(x=>NEIGHBORS.find(n=>n.id===x.id).taste!==x.taste))})) };
    const invitation=gathering.invitation;
    if(object(invitation)&&NEIGHBORS.some(n=>n.id===invitation.id)&&Number.isSafeInteger(invitation.at)&&invitation.at>=0&&a.gathering.servings.some(h=>!h.matched)&&NEIGHBORS.every(n=>a.gathering.servings.some(h=>h.id===n.id&&h.matched)))a.gathering.invitation={id:invitation.id,at:invitation.at,reply:typeof invitation.reply==='string'?invitation.reply.slice(0,240):''};
    const sharedMeals=object(a.sharedMeals)&&a.sharedMeals.version===2?a.sharedMeals:{};
    const orders=object(sharedMeals.orders)?sharedMeals.orders:{};
    a.sharedMeals={version:2,currentIndex:Math.min(SHARED_ORDERS.length,qty(sharedMeals.currentIndex,SHARED_ORDERS.length)),orders:{},records:[],processedTokens:(Array.isArray(sharedMeals.processedTokens)?sharedMeals.processedTokens:[]).filter(t=>typeof t==='string'&&t.length>=8&&t.length<=120).slice(-48)};
    for(const order of SHARED_ORDERS){const old=object(orders[order.id])?orders[order.id]:{},fulfilled=[...new Set((Array.isArray(old.fulfilled)?old.fulfilled:[]).filter(id=>order.guests.includes(id)))],attempts=(Array.isArray(old.attempts)?old.attempts:[]).filter(x=>object(x)&&SHARED_PAIRINGS.some(p=>p.id===x.pairingId)&&Number.isSafeInteger(x.at)&&x.at>=0).slice(-8).map(x=>({pairingId:x.pairingId,at:x.at,newlyFulfilled:[...new Set((Array.isArray(x.newlyFulfilled)?x.newlyFulfilled:[]).filter(id=>order.guests.includes(id)))]}));const completed=fulfilled.length===2&&Number.isSafeInteger(old.completedAt)&&old.completedAt>=0;a.sharedMeals.orders[order.id]={fulfilled,attempts,completedAt:completed?old.completedAt:null,rewardGranted:completed&&old.rewardGranted===true,completionMode:completed&&old.completionMode==='supplemented'?'supplemented':completed?'once':null};}
    a.sharedMeals.records=SHARED_ORDERS.filter(o=>a.sharedMeals.orders[o.id].completedAt!==null).map(o=>({id:o.id,at:a.sharedMeals.orders[o.id].completedAt,completionMode:a.sharedMeals.orders[o.id].completionMode,response:o.response,rewardGranted:a.sharedMeals.orders[o.id].rewardGranted}));
    while(a.sharedMeals.currentIndex<SHARED_ORDERS.length&&a.sharedMeals.orders[SHARED_ORDERS[a.sharedMeals.currentIndex].id].completedAt!==null)a.sharedMeals.currentIndex++;
    a.fishNotes = Object.fromEntries(FISH.filter((f) => object(a.fishNotes) && a.fishNotes[f.id] === true).map((f) => [f.id, true]));
    // Old saves retain their real notes and remaining fish. Historical catch
    // events also include fish already delivered; never invent current fish.
    a.totalCaught = Math.max(qty(a.totalCaught), qty(a.counts.fish), sum(a.catch), Object.keys(a.fishNotes).length);
    const cast = a.fishingCast;
    a.fishingCast = object(cast) && Object.hasOwn(RHYTHMS, cast.fishId) && Number.isSafeInteger(cast.startedAt) && cast.startedAt >= 0
      ? { fishId: cast.fishId, startedAt: cast.startedAt, ...(cast.observationVersion === 2 ? {observationVersion:2} : {}) } : null;
    let free = CATCH_CAP;
    for (const f of FISH) { a.catch[f.id] = Math.min(free, a.catch[f.id]); free -= a.catch[f.id]; }
    if (!object(a.collectibles)) a.collectibles = {};
    if (!object(a.unlocks)) a.unlocks = {};
    if (!object(a.claimed)) a.claimed = {};
    if (!object(a.quests)) a.quests = {};
    if (!object(a.projects)) a.projects = {};
    for (const p of PROJECTS) {
      const previous = object(a.projects[p.id]) ? a.projects[p.id] : {};
      a.projects[p.id] = Object.assign({}, previous, { restored: previous.restored === true || previous.status === "restored", restoredAt: Number.isSafeInteger(previous.restoredAt) && previous.restoredAt >= 0 ? previous.restoredAt : null });
    }
    for (const q of QUESTS) {
      const rec = object(a.quests[q.id]) ? a.quests[q.id] : {};
      if (rec.status === "claimed" || rec.rewardGranted === true) a.claimed[q.id] = true;
      rec.readyAt = Number.isSafeInteger(rec.readyAt) && rec.readyAt >= 0 ? rec.readyAt : rec.status === "ready" ? now : null;
      rec.claimedAt = Number.isSafeInteger(rec.claimedAt) && rec.claimedAt >= 0 ? rec.claimedAt : claimed(a, q.id) ? now : null;
      a.quests[q.id] = rec;
    }
    if (a.lastFishAt !== null && !(Number.isSafeInteger(a.lastFishAt) && a.lastFishAt >= 0)) a.lastFishAt = null;
    if (a.migrated !== true) backfill(state, a);
    if (restored(a, "fishing_dock") || claimed(a, "c1_first_meal")) a.unlocks.fishingRod = true;
    if (restored(a, "garden")) a.collectibles.pressed_flower = true;
    sync(state, now);
    return ok("冒險資料已就緒。", { adventure: a });
  }
  function record(state, event, now) {
    const e = typeof event === "string" ? { type: event } : event;
    if (!object(e) || !EVENTS.includes(e.type)) return fail("unknown_event", "沒有這個冒險事件。");
    if (e.ok === false) return fail("failed_event", "未完成的行動不會計入任務。");
    const raw = e.count !== undefined ? e.count : e.qty !== undefined ? e.qty : e.added !== undefined ? e.added : 1;
    if (!Number.isSafeInteger(raw) || raw <= 0) return fail("bad_count", "事件數量必須是正整數。");
    const candidates = e.type === "talk" ? [e.npcId, e.id] : e.type === "cook" ? [e.recipeId, e.id] : e.type === "restore" ? [e.projectId, e.id] : [e.itemId, e.cropId, e.id];
    const id = candidates.find((value) => value !== undefined && value !== null);
    const allowed = e.type === "talk" ? Object.keys(C.NPCS || {}) : e.type === "cook" ? RECIPES.map((r) => r.id) : e.type === "restore" ? PROJECTS.map((p) => p.id) : e.type === "forage" ? Object.keys(C.FORAGE_ITEMS || {}) : ["plant", "water", "harvest"].includes(e.type) ? Object.keys(C.CROPS || {}) : e.type === "fish" ? FISH.map((f) => f.id) : null;
    if ((id !== undefined && allowed && (typeof id !== "string" || !allowed.includes(id))) || (e.type === "talk" && id === undefined)) return fail("unknown_target", "找不到事件對象。");
    const init = ensure(state, now); if (!init.ok) return init;
    const a = state.adventure;
    const count = Math.min(EVENT_CAP, raw);
    a.counts[e.type] = Math.min(COUNT_CAP, a.counts[e.type] + count);
    if (id && a.byTarget[e.type]) a.byTarget[e.type][id] = Math.min(COUNT_CAP, (a.byTarget[e.type][id] || 0) + count);
    sync(state, at(state, now));
    return ok("已記下這次行動。", { type: e.type, count, total: a.counts[e.type] });
  }
  function quests(state, now) {
    if (!ensure(state, now).ok) return [];
    const a = state.adventure;
    return QUESTS.map((q, index) => {
      const objectives = q.goals.map((g) => ({ type: g.type, id: g.id, name: g.name, current: goalCount(a, g), required: g.count, complete: goalCount(a, g) >= g.count, consume: false }));
      const needs = questRequirements(state, q);
      return Object.assign(copy(q), { chapterName: CHAPTERS[q.chapter - 1].name, previousId: index ? QUESTS[index - 1].id : null, nextId: QUESTS[index + 1] ? QUESTS[index + 1].id : null,
        status: a.quests[q.id].status, readyAt: a.quests[q.id].readyAt, claimedAt: a.quests[q.id].claimedAt, objectives, requirements: needs,
        canClaim: !claimed(a, q.id) && unlockedQuest(a, index) && objectives.every((g) => g.complete) && needs.every((r) => r.complete) });
    });
  }
  function consume(state, rows) {
    for (const r of rows) {
      if (r.source === "catch") {
        let left = r.required;
        for (const f of FISH) { const take = Math.min(left, state.adventure.catch[f.id]); state.adventure.catch[f.id] -= take; left -= take; }
      } else if (r.source === "coins") state.coins -= r.required;
      else {
        const map = r.source === "materials" ? state.materials : r.source === "meals" ? state.adventure.meals : state.storage.items;
        map[r.id] -= r.required;
        if (map[r.id] === 0 && r.source === "inventory") delete map[r.id];
      }
    }
  }
  function grant(state, r) {
    if (r.coins) {
      state.coins = credit(state.coins, r.coins);
      if (!object(state.stats)) state.stats = {};
      state.stats.totalCoinsEarned = credit(state.stats.totalCoinsEarned, r.coins);
    }
    if (r.xp) {
      state.xp = credit(state.xp, r.xp);
      state.level = Math.max(qty(state.level) || 1, C.levelFromXp(state.xp));
    }
    if (Object.keys(r.materials).length && !object(state.materials)) state.materials = {};
    for (const [id, count] of Object.entries(r.materials)) state.materials[id] = credit(state.materials[id], count);
    if (r.fishingRod) state.adventure.unlocks.fishingRod = true;
    if (r.collectible) state.adventure.collectibles[r.collectible] = true;
    if (r.guestbook) state.adventure.unlocks.gardenGuestbook = true;
  }
  function claim(state, id, now) {
    const index = QUESTS.findIndex((q) => q.id === id);
    if (index < 0) return fail("unknown_quest", "找不到這個任務。");
    const init = ensure(state, now); if (!init.ok) return init;
    const a = state.adventure; const q = QUESTS[index];
    if (claimed(a, id)) return fail("already_claimed", "這份獎勵已經領過了。");
    if (!unlockedQuest(a, index)) return fail("locked", "先完成前一個任務。");
    if (!q.goals.every((g) => goalCount(a, g) >= g.count)) return fail("not_ready", "任務目標還沒完成。");
    const rows = questRequirements(state, q);
    if (!rows.every((r) => r.complete)) return fail("missing_resources", "要交付的物品還沒備齊。", { requirements: rows });
    consume(state, rows);
    a.claimed[id] = true;
    a.quests[id].status = "claimed";
    a.quests[id].rewardGranted = true;
    a.quests[id].claimedAt = at(state, now);
    grant(state, q.reward);
    sync(state, at(state, now));
    return ok("「" + q.name + "」完成了。", { id, reward: copy(q.reward), nextId: QUESTS[index + 1] ? QUESTS[index + 1].id : null });
  }
  function projects(state) {
    if (!ensure(state).ok) return [];
    return PROJECTS.map((p) => {
      const done = restored(state.adventure, p.id); const unlocked = claimed(state.adventure, p.unlockQuest);
      const rows = costRequirements(state, p.cost);
      return Object.assign(copy(p), { target: Object.assign({}, p.target, { tileId: (state.adventure.siteTiles || {})[p.id] || p.target.tileId }), status: done ? "restored" : unlocked ? "available" : "locked", restored: done, restoredAt: state.adventure.projects[p.id].restoredAt,
        requirements: rows, canRestore: !done && unlocked && rows.every((r) => r.complete) });
    });
  }
  function restore(state, id, now) {
    const p = PROJECTS.find((entry) => entry.id === id);
    if (!p) return fail("unknown_project", "找不到這個修復計畫。");
    const init = ensure(state, now); if (!init.ok) return init;
    if (restored(state.adventure, id)) return fail("already_restored", "這裡已經修好了。");
    if (!claimed(state.adventure, p.unlockQuest)) return fail("locked", "先完成前面的鎮民任務。");
    const rows = costRequirements(state, p.cost);
    if (!rows.every((r) => r.complete)) return fail("missing_resources", "修復材料還沒備齊。", { requirements: rows });
    consume(state, rows);
    state.adventure.projects[id] = { restored: true, restoredAt: at(state, now) };
    if (id === "fishing_dock") state.adventure.unlocks.fishingRod = true;
    if (id === "garden") state.adventure.collectibles.pressed_flower = true;
    record(state, { type: "restore", projectId: id }, now);
    return ok(p.name + "修好了。", { id, cost: copy(p.cost), unlocks: p.unlocks.slice() });
  }
  function recipeUnlocked(a, r) { return r.unlockQuest ? claimed(a, r.unlockQuest) : restored(a, r.unlockProject); }
  function recipes(state) {
    if (!ensure(state).ok) return [];
    return RECIPES.map((r) => {
      const unlocked = recipeUnlocked(state.adventure, r); const rows = requirements(state, r.ingredients, "inventory");
      return Object.assign(copy(r), { target: { kind: "station", id: "kitchen", tileId: "t10_10" }, status: unlocked ? "available" : "locked", unlocked, quantity: state.adventure.meals[r.id], output: { id: r.id, source: "meals", qty: 1 },
        requirements: rows, canCook: unlocked && state.adventure.meals[r.id] < MEAL_CAP && rows.every((need) => need.complete) });
    });
  }
  function cook(state, id, now) {
    const r = RECIPES.find((entry) => entry.id === id);
    if (!r) return fail("unknown_recipe", "找不到這道料理。");
    const init = ensure(state, now); if (!init.ok) return init;
    if (!recipeUnlocked(state.adventure, r)) return fail("locked", "這道料理還沒解鎖。");
    if (state.adventure.meals[id] >= MEAL_CAP) return fail("meals_full", "這道料理已經備得夠多了。");
    const rows = requirements(state, r.ingredients, "inventory");
    if (!rows.every((need) => need.complete)) return fail("missing_resources", "料理食材還沒備齊。", { requirements: rows });
    consume(state, rows);
    state.adventure.meals[id]++;
    record(state, { type: "cook", recipeId: id }, now);
    return ok(r.name + "做好了。", { meal: { id, name: r.name, qty: 1 }, quantity: state.adventure.meals[id], consumed: copy(r.ingredients) });
  }
  function fish(state, now, rng) {
    const init = ensure(state, now); if (!init.ok) return init;
    const a = state.adventure; now = at(state, now);
    if (!restored(a, "fishing_dock")) return fail("locked", "先修好河畔釣台。");
    const remainingMs = a.lastFishAt === null ? 0 : Math.max(0, FISH_COOLDOWN_MS - (now - a.lastFishAt));
    if (remainingMs > 0) return fail("cooldown", "魚還沒靠近，等一下再拋竿。", { remainingMs });
    if (sum(a.catch) >= CATCH_CAP) return fail("catch_full", "魚簍滿了，先把魚交給鎮民。");
    let pick, qualityRoll;
    try { const random = rng === undefined ? Math.random : rng; pick = random(); qualityRoll = random(); }
    catch (_) { return fail("bad_rng", "這次拋竿沒有成功。"); }
    if (!Number.isFinite(pick) || !Number.isFinite(qualityRoll)) return fail("bad_rng", "這次拋竿沒有成功。");
    const unit = (n) => Math.max(0, Math.min(1 - Number.EPSILON, n));
    const def = FISH[Math.floor(unit(pick) * FISH.length)];
    const quality = unit(qualityRoll) < 0.7 ? "normal" : unit(qualityRoll) < 0.95 ? "good" : "premium";
    a.catch[def.id]++;
    a.totalCaught++;
    a.lastFishAt = now;
    const firstCatch = !a.fishNotes[def.id];
    a.fishNotes[def.id] = true;
    record(state, { type: "fish" }, now);
    return ok("釣到了" + def.name + "。", { catch: { id: def.id, name: def.name, quality, qty: 1, caughtAt: now }, firstCatch, note: RHYTHMS[def.id].note, cooldownMs: FISH_COOLDOWN_MS, nextFishAt: now + FISH_COOLDOWN_MS });
  }
  function neighbors(state, now) {
    if (!ensure(state, now).ok) return [];
    return NEIGHBORS.map((n) => {
      const rec = state.adventure.neighbors[n.id];
      return { id: n.id, name: n.name, title: n.title, unlocked: claimed(state.adventure, "c1_first_harvest"), ...copy(rec),
        memory: rec.deliveries ? { ...copy(MEMORIES[n.id]), ...(n.id==='child'&&rec.lastTaste!=='sour'?{wrong:"圖圖把餅分成三塊，先留一塊給空椅子：『這次還少了那個讓我想舔手指的滋味。花也放好囉，下次再一起試。』"}:{}) } : null,
        story: rec.deliveries ? (rec.lastMatched && n.matchedStory ? n.matchedStory : n.story) : null,
        reply: rec.deliveries ? (rec.lastMatched && n.matchedConversation ? n.matchedConversation : n.reply) : null,
        reaction: rec.deliveries ? (rec.lastMatched ? n.matchedReply : rec.deliveries > 1 ? n.wrongReply : n.hint) : null,
        recallContext: rec.deliveries ? n.recallContext : null,
        illustration: "assets/generated/content-r3/" + n.id + ".webp" };
    });
  }
  function basketFlavors(state, now) {
    if (!ensure(state, now).ok) return [];
    return FLAVORS.map((f) => {
      const rows = requirements(state, { rustic_bread: 1 }, "meals").concat(requirements(state, f.ingredients, "inventory"));
      return { ...copy(f), requirements: rows, canSend: claimed(state.adventure, "c1_first_harvest") && rows.every((r) => r.complete) };
    });
  }
  function deliverNeighbor(state, id, taste, now) {
    if (!NEIGHBORS.some((n) => n.id === id) || !FLAVORS.some((f) => f.id === taste)) return fail("bad_basket", "找不到這份餐籃。");
    const init = ensure(state, now); if (!init.ok) return init;
    if (!claimed(state.adventure, "c1_first_harvest")) return fail("locked", "先跟班伯學做農家麥餅。");
    const flavor = basketFlavors(state, now).find((f) => f.id === taste);
    if (!flavor.canSend) return fail("missing_resources", "餐籃還沒裝齊。先做一份農家麥餅，再留好配料。", { requirements: flavor.requirements });
    const n = NEIGHBORS.find((entry) => entry.id === id), rec = state.adventure.neighbors[id];
    // First visit opens the story and the hint; only a later considered gift earns the reply.
    const firstDelivery = rec.deliveries === 0, matched = !firstDelivery && n.taste === taste;
    consume(state, flavor.requirements);
    rec.deliveries = Math.min(COUNT_CAP, rec.deliveries + 1);
    rec.lastTaste = taste; rec.deliveredAt = at(state, now); rec.lastMatched = matched; rec.matched = rec.matched || matched;
    rec.history.push({taste,branch:firstDelivery?'first':matched?'matched':'wrong',at:rec.deliveredAt});
    rec.history=rec.history.slice(-12);
    const neighbor=neighbors(state,now).find(v=>v.id===id);
    state.adventure.neighbors[id].history.at(-1).reaction=firstDelivery?neighbor.reply:matched?neighbor.memory.reply:neighbor.memory.wrong;
    return ok("餐籃送到" + n.name + "手上了。", { firstDelivery, matched, neighbor });
  }
  function fishingObservation(state, now) {
    if (!ensure(state, now).ok) return null;
    return observeFishingCast(state.adventure.fishingCast, at(state, now));
  }
  // Read-only visual observation: no save normalization or quest scans per animation frame.
  function observeFishingCast(cast, now) {
    if (!cast || !RHYTHMS[cast.fishId] || !Number.isFinite(now)) return null;
    let left = now - cast.startedAt;
    if (left < 0) return { pose: "still", text: "等浮標落穩", index: -1 };
    const phases = RHYTHMS[cast.fishId].phases;
    for (let i = 0; i < phases.length; i++) {
      if (left < phases[i][0]) {
        const pose = phases[i][1], advanced = cast.observationVersion === 2;
        const canReel = pose === 'strike' && (!advanced || cast.fishId !== 'silver_dace' || left < 850);
        const motion = cast.fishId === 'river_carp' ? (i===3?'wide-swell':i===4?'closed-rings':'wide-rise') : cast.fishId==='silver_dace' ? (i===1?(canReel?'short-splash':'splash-gone'):'straight-probe') : (i===2?'bent-wake':i===3?'straight-wake':'side-drag');
        return { pose, text: phases[i][2], index: i, canReel, motion };
      }
      left -= phases[i][0];
    }
    return { pose: "missed", text: "水紋散開了，這次沒有咬住", index: phases.length };
  }
  function startFishing(state, now, rng) {
    const s = summary(state, now); if (!s.ok) return s;
    if (!s.unlocks.fishing) return fail("locked", "先修好河畔釣台。");
    if (s.fishing.remainingMs > 0) return fail("cooldown", "等魚群散開再拋竿。", { remainingMs: s.fishing.remainingMs });
    if (s.fishing.used >= CATCH_CAP) return fail("catch_full", "魚簍滿了，先把魚交給鎮民。");
    let roll; try { roll = (rng || Math.random)(); } catch (_) { return fail("bad_rng", "這次拋竿沒有成功。"); }
    if (!Number.isFinite(roll)) return fail("bad_rng", "這次拋竿沒有成功。");
    const fishId = FISH[Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, roll)) * FISH.length)].id;
    state.adventure.fishingCast = { fishId, startedAt: at(state, now) };
    return ok("浮標落穩了，看看水面的動靜。");
  }
  function reelFishing(state, now) {
    const init = ensure(state, now); if (!init.ok) return init;
    const cast = state.adventure.fishingCast, phase = fishingObservation(state, now);
    if (!cast || !phase) return fail("no_cast", "先拋竿，看看浮標。");
    state.adventure.fishingCast = null;
    if (phase.pose !== "strike" || phase.canReel === false) {
      const late=phase.pose === 'missed' || phase.motion === 'splash-gone';
      return fail(late?'too_late':'too_early',late?'魚溜走了。水花已散，這一竿晚了，再看看牠怎麼咬。':{
        river_carp:'提早了。寬尾還沒翻到浮標旁，等寬圈合起來。',
        silver_dace:'提早了。小嘴還在水下，等那一下短水花。',
        river_perch:'提早了。彎身還沒衝出去，等橫向尾流展開。'
      }[cast.fishId]);
    }
    const index = FISH.findIndex((f) => f.id === cast.fishId);
    let draws = 0;
    return fish(state, now, () => draws++ === 0 ? (index + 0.5) / FISH.length : Math.random());
  }
  function fishNotes(state, now) {
    if (!ensure(state, now).ok) return [];
    return FISH.filter((f) => state.adventure.fishNotes[f.id]).map((f) => ({ ...f, clue: RHYTHMS[f.id].clue, note: RHYTHMS[f.id].note }));
  }
  function gathering(state, now) {
    if (!ensure(state, now).ok) return { unlocked: false, packed: {}, completed: false };
    const unlocked = NEIGHBORS.every(n => state.adventure.neighbors[n.id].matched);
    return { ...copy(state.adventure.gathering), unlocked, ready: unlocked && NEIGHBORS.every(n => state.adventure.gathering.packed[n.id] === n.taste),
      people: unlocked ? NEIGHBORS.map(n => ({ id:n.id, name:n.name, taste:n.taste, flavor:FLAVORS.find(f => f.id===n.taste).name, ...copy(MEMORIES[n.id]) })) : [] };
  }
  function packGathering(state, id, taste, now) {
    const g = gathering(state, now), n = NEIGHBORS.find(n => n.id===id);
    if (!g.unlocked || g.completed) return fail("locked", "先記住三位鄰居，再約大家坐下。聚餐完成後不用再備餐。");
    if (!n || n.taste!==taste) return fail("wrong_basket", "照手記替這位鄰居準備他記得的那一籃。");
    if (g.packed[id]) return fail("already_packed", "這一籃已放好，材料不會再取用。");
    const f = basketFlavors(state, now).find(f=>f.id===taste);
    if (!f.canSend) return fail("missing_resources", "食材還沒齊，先回灶台準備。", {requirements:f.requirements});
    consume(state, f.requirements); state.adventure.gathering.packed[id]=taste;
    return ok(n.name+"的餐籃已放好。", {gathering:gathering(state,now)});
  }
  function completeGathering(state, now) {
    const g = gathering(state, now);
    if (!g.ready || g.completed) return fail("not_ready", "三籃都備好，再一起走到陽光下。");
    state.adventure.gathering.completed=true; state.adventure.gathering.completedAt=at(state,now);
    return ok("三個位子，今天都有人坐了。", {gathering:gathering(state,now)});
  }
  function servingReply(id,taste,shared=false) {
    const n=NEIGHBORS.find(n=>n.id===id),flavor={sour:'酸味野莓',hot:'熱味麥餅',sweet:'甜味胡蘿蔔點心'}[taste];
    if(!n||!flavor)return '';
    return n.taste===taste ? {
      merchant:'蘿拉抬手招呼米莉：「酸味野莓，和你送來的酸味餐籃一樣。這杯換我請你！」',
      elder:'班伯捧起茶杯：「熱味麥餅，還記得我的熱味餐籃！先吃，魚竿晚點再修。」',
      child:shared?'圖圖捧著甜味點心：「上次甜味餐籃的滋味我還記得，剛才那盤也很好吃！」':'圖圖捧著甜味點心：「上次甜味餐籃的滋味我還記得，這份也很好吃！」'
    }[id]+(shared&&id!=='child'?{merchant:'「剛才分食的那盤，留著配茶吧。」',elder:'「剛才大家分的那盤，也別放涼了。」'}[id]:'') : n.name+'接過'+flavor+'：「這份先放中間，大家一起吃。我還是想念'+{sour:'酸味野莓',hot:'熱味麥餅',sweet:'甜味胡蘿蔔點心'}[n.taste]+'。」';
  }
  function serveGathering(state,id,taste,now) {
    const g=gathering(state,now);
    if(!g.completed)return fail('locked','三籃備齊、大家入座後，再分桌上的點心。');
    if(!NEIGHBORS.some(n=>n.id===id)||!['sour','hot','sweet'].includes(taste))return fail('bad_serving','先選一位鄰居和桌上的一份點心。');
    const h={id,taste,at:at(state,now),matched:NEIGHBORS.find(n=>n.id===id).taste===taste,reply:servingReply(id,taste,(g.servings||[]).some(h=>!h.matched))};
    state.adventure.gathering.servings.push(h);state.adventure.gathering.servings=state.adventure.gathering.servings.slice(-24);
    return ok(h.reply,{serving:copy(h)});
  }
  // The current picnic has three physical portions. Historical replay records remain readable.
  function serveGatheringCourse(state,id,taste,now) {
    const g=gathering(state,now),hs=g.servings||[];
    if(hs.some(h=>h.id===id))return fail('already_served','這位已經接到一份，換還沒招待的鄰居。');
    if(hs.some(h=>h.taste===taste))return fail('already_shared','這份已端出去了，選桌上剩下的點心。');
    if(new Set(hs.map(h=>h.id)).size>=3)return fail('meal_finished','三位都接到了，把這個下午收進手記。');
    return serveGathering(state,id,taste,now);
  }
  // R12: a shared wrong taste does not use the guest's own place setting.
  // Keep serveGatheringCourse as the legacy three-portion API for old callers.
  function serveGatheringTaste(state,id,taste,now) {
    const g=gathering(state,now),hs=g.servings||[];
    if(hs.some(h=>h.id===id&&h.matched))return fail('already_served','這位已收到合口味的點心，換還沒招待的鄰居。');
    if(hs.some(h=>h.id===id&&h.taste===taste))return fail('already_shared','這個組合已經分過了，選另一份點心。');
    if(hs.some(h=>h.taste===taste&&h.matched))return fail('already_shared','這份已在鄰居手邊，選桌上剩下的點心。');
    if(new Set(hs.filter(h=>h.matched).map(h=>h.id)).size>=3)return fail('meal_finished','三位都接到了，把這個下午收進手記。');
    return serveGathering(state,id,taste,now);
  }
  // R13 current UI: every physical dish has a paid source. Old replay APIs stay readable.
  function gatheringPortions(state,now) {
    const g=gathering(state,now),hs=g.servings||[];
    return ['sour','hot','sweet'].map(taste=>{
      const f=basketFlavors(state,now).find(f=>f.id===taste);
      const remaining=Math.max(0,(g.ready?1:0)+(g.refills||[]).filter(h=>h.taste===taste).length-hs.filter(h=>h.taste===taste).length);
      const finished=hs.some(h=>h.taste===taste&&h.matched);
      return {taste,remaining,finished,requirements:f.requirements,canRefill:g.completed&&!finished&&remaining===0&&f.canSend};
    });
  }
  function refillGathering(state,taste,now) {
    const g=gathering(state,now),portion=gatheringPortions(state,now).find(p=>p.taste===taste);
    if(!portion||!portion.canRefill)return fail('cannot_refill','這份還有剩、已招待完成，或材料不足；不會憑空多出點心。');
    const before=portion.requirements;
    consume(state,before);
    const after=basketFlavors(state,now).find(f=>f.id===taste).requirements;
    const receipt=before.map((r,i)=>r.name+' '+r.current+'→'+after[i].current+' 份').join('、');
    state.adventure.gathering.refills.push({taste,at:at(state,now),receipt});
    return ok('再備一份，已取用：'+receipt,{receipt});
  }
  function serveGatheringPortion(state,id,taste,now) {
    const p=gatheringPortions(state,now).find(p=>p.taste===taste);
    if(!p||p.remaining<1)return fail('no_portion','這份已端完；先備齊材料，再補一份。');
    return serveGatheringTaste(state,id,taste,now);
  }
  function sharedMealRequirements(state,pairing) {
    const ingredients={};
    for(const taste of pairing.tastes){const flavor=FLAVORS.find(f=>f.id===taste);for(const [id,n] of Object.entries(flavor.ingredients))ingredients[id]=(ingredients[id]||0)+n;}
    return requirements(state,{rustic_bread:2},'meals').concat(requirements(state,ingredients,'inventory'));
  }
  function sharedMealChoices(state,now) {
    if(!ensure(state,now).ok)return [];
    const book=state.adventure.sharedMeals,index=book.currentIndex,order=SHARED_ORDERS[index]||null;
    if(!order)return {complete:true,currentIndex:index,total:SHARED_ORDERS.length,order:null,pairings:[],records:copy(book.records)};
    const progress=book.orders[order.id],guestRows=order.guests.map(id=>{const n=NEIGHBORS.find(x=>x.id===id);return{id,name:n.name,taste:n.taste,flavor:FLAVORS.find(f=>f.id===n.taste).name,fulfilled:progress.fulfilled.includes(id)};});
    const pairings=SHARED_PAIRINGS.map(pairing=>{const requirements=sharedMealRequirements(state,pairing),newlyFulfilled=guestRows.filter(g=>!g.fulfilled&&pairing.tastes.includes(g.taste)).map(g=>g.id);return{...copy(pairing),requirements,newlyFulfilled,canShare:state.adventure.gathering.completed&&newlyFulfilled.length>0&&requirements.every(r=>r.complete)};});
    return {complete:false,currentIndex:index,total:SHARED_ORDERS.length,order:{...copy(order),guests:guestRows,fulfilled:copy(progress.fulfilled),attempts:copy(progress.attempts)},pairings,records:copy(book.records)};
  }
  function shareMeal(state,pairingId,expectedOrderId,interactionToken,now) {
    let preBook=state&&state.adventure&&state.adventure.sharedMeals,normalized=false;
    if(!preBook||preBook.version!==2){const first=ensure(state,now);if(!first.ok)return first;preBook=state.adventure.sharedMeals;normalized=true;}
    const currentOrder=SHARED_ORDERS[preBook.currentIndex];
    if(typeof interactionToken!=='string'||interactionToken.length<8||interactionToken.length>120)return fail('bad_token','這次確認資料不完整，請重新打開訂單。');
    if(preBook&&Array.isArray(preBook.processedTokens)&&preBook.processedTokens.includes(interactionToken))return fail('duplicate_commit','這次交單已經處理過，不會再次取用餐點。');
    if(!currentOrder||currentOrder.id!==expectedOrderId)return fail('stale_order','訂單已經換頁，請依目前兩位客人的需要重新選擇。');
    if(!normalized){const init=ensure(state,now);if(!init.ok)return init;}
    if(!state.adventure.gathering.completed)return fail('locked','先完成第一次共同聚餐，再從手記安排下一桌。');
    const book=state.adventure.sharedMeals,order=SHARED_ORDERS[book.currentIndex];if(!order)return fail('all_orders_complete','三張雙人共餐訂單都完成了。');
    const pairing=SHARED_PAIRINGS.find(p=>p.id===pairingId);if(!pairing)return fail('unknown_shared_meal','找不到這組雙口味搭配。');
    const progress=book.orders[order.id],newlyFulfilled=order.guests.filter(id=>!progress.fulfilled.includes(id)&&pairing.tastes.includes(NEIGHBORS.find(n=>n.id===id).taste));
    if(!newlyFulfilled.length)return fail('no_progress','這組搭配不會滿足尚未吃到的居民，不扣食材也不加進度。');
    const requirements=sharedMealRequirements(state,pairing);
    if(!requirements.every(r=>r.complete))return fail('missing_resources','食材還沒齊，這次不會取用任何東西。',{requirements});
    consume(state,requirements);
    book.processedTokens.push(interactionToken);book.processedTokens=book.processedTokens.slice(-48);
    progress.fulfilled.push(...newlyFulfilled);progress.fulfilled=[...new Set(progress.fulfilled)];progress.attempts.push({pairingId,at:at(state,now),newlyFulfilled:copy(newlyFulfilled)});progress.attempts=progress.attempts.slice(-8);
    const completed=progress.fulfilled.length===2;let rewardGranted=false,record=null;
    if(completed){progress.completedAt=at(state,now);progress.completionMode=progress.attempts.length===1?'once':'supplemented';if(!progress.rewardGranted){grant(state,order.reward);progress.rewardGranted=true;rewardGranted=true;}record={id:order.id,at:progress.completedAt,completionMode:progress.completionMode,response:order.response,rewardGranted:progress.rewardGranted};book.records.push(record);book.currentIndex++;}
    const names=newlyFulfilled.map(id=>NEIGHBORS.find(n=>n.id===id).name).join('、'),message=completed?order.response:names+'吃到合口味的一份；另一位仍保留在訂單上，下次補餐會再取用兩份麥餅與配料。';
    return ok(message,{orderId:order.id,pairingId,newlyFulfilled:copy(newlyFulfilled),fulfilled:copy(progress.fulfilled),completed,completionMode:progress.completionMode,consumed:copy(requirements),reward:rewardGranted?copy(order.reward):reward(0,0,{}),rewardGranted,record:record?copy(record):null,nextOrderId:SHARED_ORDERS[book.currentIndex]?.id||null});
  }
  function summary(state, now) {
    const init = ensure(state, now); if (!init.ok) return init;
    const a = state.adventure; const list = quests(state, now);
    const current = list.find((q) => q.status !== "claimed") || null;
    const chapters = CHAPTERS.map((c, i) => {
      const done = list.filter((q) => q.chapter === i + 1 && q.status === "claimed").length;
      return Object.assign({}, c, { number: i + 1, claimed: done, total: 3, status: done === 3 ? "complete" : current && current.chapter === i + 1 ? "active" : "locked" });
    });
    return ok(current ? "下一件事：" + current.name : "鎮民已經到齊，野餐開始了。", { chapter: current ? current.chapter : 3, chapters, currentQuest: current, claimed: list.filter((q) => q.status === "claimed").length, total: 9, complete: current === null,
      counts: copy(a.counts), meals: copy(a.meals), catch: copy(a.catch),
      collectibles: Object.values(COLLECTIBLES).filter((entry) => a.collectibles[entry.id]).map(copy),
      unlocks: { kitchen: claimed(a, "c1_first_harvest"), fishing: restored(a, "fishing_dock"), fishingRod: a.unlocks.fishingRod === true, mealGifts: restored(a, "picnic_table"), gardenGuestbook: restored(a, "garden") && claimed(a, "c3_harvest_picnic") },
      fishing: { cooldownMs: FISH_COOLDOWN_MS, remainingMs: a.lastFishAt === null ? 0 : Math.max(0, FISH_COOLDOWN_MS - (at(state, now) - a.lastFishAt)), used: sum(a.catch), capacity: CATCH_CAP } });
  }
  function buyMaterial(state, id, count, now) {
    const prices = { wood: 6, stone: 8 };
    if (!own(prices, id) || !Number.isSafeInteger(count) || count < 1 || count > 10) return fail("bad_purchase", "找不到這筆建材訂購。");
    const init = ensure(state, now); if (!init.ok) return init;
    const cost = prices[id] * count;
    if (!Number.isFinite(state.coins) || state.coins < cost) return fail("missing_resources", "金幣不夠，先交一張訂單吧。");
    if (!object(state.materials)) state.materials = {};
    const previous = qty(state.materials[id], Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(previous + count)) return fail("materials_full", "建材已經備得夠多了。");
    state.coins -= cost; state.materials[id] = previous + count;
    return ok("買到 " + count + " 份" + itemName(id) + "。", { id, count, cost });
  }
  const COMMISSIONS = [
    { id: "river_market", name: "蘿拉的河鮮籃", npcId: "merchant", wantsCatch: 2, reward: reward(18, 3) },
    { id: "elder_supper", name: "班伯的灶邊晚餐", npcId: "elder", wantsCatch: 1, wantsMeals: { rustic_bread: 1 }, reward: reward(14, 3, { wood: 2 }) },
    { id: "child_tea", name: "圖圖的野餐茶", npcId: "child", wantsMeals: { mint_tea: 1 }, reward: reward(12, 3) },
  ];
  function commissions(state, now) {
    if (!ensure(state, now).ok) return [];
    const a = state.adventure;
    const cycle = Math.floor(at(state, now) / 300000);
    if (!object(a.commissions) || !Number.isSafeInteger(a.commissions.cycle) || a.commissions.cycle < cycle) a.commissions = { cycle, completed: [] };
    if (!Array.isArray(a.commissions.completed)) a.commissions.completed = [];
    return COMMISSIONS.map((c) => {
      const unlocked = restored(a, "fishing_dock") && (c.id !== "child_tea" || restored(a, "picnic_table"));
      const rows = questRequirements(state, c);
      const done = a.commissions.completed.includes(c.id);
      return Object.assign(copy(c), { unlocked, completed: done, requirements: rows, canClaim: unlocked && !done && rows.every((r) => r.complete), refreshAt: (a.commissions.cycle + 1) * 300000 });
    });
  }
  function deliverCommission(state, id, now) {
    if (!COMMISSIONS.some((c) => c.id === id)) return fail("unknown_commission", "找不到這份河畔委託。");
    const entry = commissions(state, now).find((c) => c.id === id);
    if (!entry) return fail("bad_state", "委託資料還沒準備好。");
    if (!entry.unlocked) return fail("locked", "先修好河畔釣台和需要的餐桌。");
    if (entry.completed) return fail("already_claimed", "這批委託已經交付了，等下一批吧。");
    if (!entry.canClaim) return fail("missing_resources", "先把餐籃裡的東西備齊。");
    consume(state, entry.requirements);
    state.adventure.commissions.completed.push(id);
    grant(state, entry.reward);
    record(state, "order", now);
    return ok(entry.name + "已送到。", { id, reward: entry.reward });
  }
  const AdventureAPI = { ensure, record, quests, claim, projects, restore, recipes, cook, fish, summary, buyMaterial, commissions, deliverCommission,
    neighbors, basketFlavors, deliverNeighbor, startFishing, fishingObservation, observeFishingCast, reelFishing, fishNotes, gathering, packGathering, completeGathering, servingReply, serveGathering, serveGatheringCourse, serveGatheringTaste, gatheringPortions, refillGathering, serveGatheringPortion, sharedMealChoices, shareMeal };
  if (typeof window !== "undefined") window.AdventureAPI = AdventureAPI;
  if (typeof module !== "undefined" && module.exports) module.exports = AdventureAPI;
})(typeof window !== "undefined" ? window : globalThis);
