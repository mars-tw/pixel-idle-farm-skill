/* R75 adventure rules. Load after config.js; no DOM, timers, or save replacement.
 * Call ensure on load, then record successful external game actions only.
 * cook/fish/restore record their own events; record never grants inventory.
 * Selectors return detached arrays. Mutators return { ok, message, ... }.
 */
(function (root) {
  "use strict";
  const C = typeof module !== "undefined" && module.exports ? require("./config.js") : (root.CONFIG || root);
  const Sunplay = typeof module !== "undefined" && module.exports ? require("./sunplay-r75.js") : root.FarmSunplay;
  const Heirloom = typeof module !== "undefined" && module.exports ? require("./heirloom.js") : root.FarmHeirloom;
  const VERSION = 2;
  const COUNT_CAP = 1000000;
  const EVENT_CAP = 100;
  const MEAL_CAP = 99;
  const CATCH_CAP = 99;
  const FISH_COOLDOWN_MS = 30000;
  const FESTIVAL_INTERVAL_MS = 20 * 60 * 1000;
  const FESTIVAL_DURATION_MS = 10 * 60 * 1000;
  const EVENTS = ["plant", "water", "harvest", "talk", "forage", "fish", "cook", "restore", "order", "care"];
  const CHAPTERS = [
    { id: "home", name: "回家與第一餐" },
    { id: "river", name: "河畔復興" },
    { id: "picnic", name: "收穫野餐" },
    { id: "market_day", name: "熱鬧的市集日" },
    { id: "harvest_festival", name: "河畔收穫祭" },
  ];
  const PROJECTS = [
    { id: "fishing_dock", name: "河畔釣台", description: "補好河邊踏板，老農班伯會借你一支魚竿。", target: { kind: "river", id: "fishing_dock", tileId: "t2_9" },
      cost: { wood: 4, stone: 2 }, unlockQuest: "c1_homecoming", unlocks: ["fishing", "fishing_rod"] },
    { id: "picnic_table", name: "野餐桌", description: "鋪好桌面，讓大家帶著料理來河邊坐坐。", target: { kind: "station", id: "picnic_table", tileId: "t10_10" },
      cost: { wood: 6, wheat: 4 }, unlockQuest: "c2_river_basket", unlocks: ["baked_carrot", "mint_tea", "meal_gifts"] },
    { id: "garden", name: "花園", description: "整理一片小花圃，留下壓花和野餐後的留言。", target: { kind: "station", id: "garden", tileId: "t6_2" },
      cost: { coins: 80, wood: 4 }, unlockQuest: "c3_good_neighbors", unlocks: ["pressed_flower", "garden_guestbook"] },
  ];
  const RECIPES = [
    { id: "rustic_bread", name: "農家麥餅", icon: "🍞", description: "把剛收的小麥烤成第一餐。", ingredients: { wheat: 2 }, unlockQuest: "c1_first_harvest", unlockText: "完成主線「老農班伯的開市小麥」後學會", effect: { kind: "growth", mul: 0.75, durationMs: 180000, durationText: "3 分鐘", label: "成長加速 25%", summary: "作物成長時間縮短 25%。" } },
    { id: "baked_carrot", name: "胡蘿蔔烤餅", icon: "🥕", description: "加上胡蘿蔔，烤一份能帶去野餐的點心。", ingredients: { wheat: 1, carrot: 2 }, unlockProject: "picnic_table", unlockText: "修好野餐桌後學會", share: { who: "圖圖", reward: "推進收穫野餐的分享故事" } },
    { id: "mint_tea", name: "溪畔薄荷茶", icon: "🍵", description: "用溪畔薄荷泡茶，配上一小片麥餅。", ingredients: { river_mint: 1, wheat: 1 }, unlockProject: "picnic_table", unlockText: "修好野餐桌後學會", share: { who: "蘿拉", reward: "推進收穫野餐的分享故事" } },
    { id: "wheat_carrot_pancake", name: "小麥胡蘿蔔煎餅", icon: "🥞", description: "小麥和胡蘿蔔煎得香脆。", ingredients: { wheat: 2, carrot: 1 }, unlockQuest: "c1_first_harvest", unlockText: "完成主線「老農班伯的開市小麥」後學會", effect: { kind: "growth", mul: 0.75, durationMs: 300000, durationText: "5 分鐘", label: "成長加速", summary: "作物成長時間縮短 25%。" } },
    { id: "carrot_wheat_stew", name: "胡蘿蔔麥粒燉鍋", icon: "🥘", description: "胡蘿蔔和麥粒慢慢燉成一鍋。", ingredients: { wheat: 1, carrot: 2 }, unlockQuest: "c1_first_harvest", unlockText: "完成主線「老農班伯的開市小麥」後學會", effect: { kind: "order", bonus: 0.2, durationMs: 300000, durationText: "5 分鐘", label: "訂單收入提高", summary: "訂單金幣收入提高 20%。" } },
    { id: "bamber_rain_soup", name: "老農班伯的雨水清湯", icon: "🍲", description: "老農班伯教你的清湯，雨天喝最暖。", ingredients: { rainwater: 1, carrot: 1 }, unlockPersonalNpc: "elder", unlockText: "完成老農班伯的兩件個人委託後學會", share: { who: "老農班伯", reward: "留下灶邊清湯的故事記錄" } },
    { id: "tomato_harvest_stew", name: "番茄豐收燉鍋", icon: "🍅", description: "番茄燉出濃湯，趁熱吃完再下田。", ingredients: { tomato: 2, carrot: 1 }, unlockQuest: "c3_harvest_picnic", unlockText: "完成第三章「把收穫端上桌」後學會", effect: { kind: "harvest", bonus: 1, durationMs: 300000, durationText: "5 分鐘", label: "收成多 1 份", summary: "每次收成多 1 份作物。" } },
    { id: "strawberry_market_tart", name: "草莓市集塔", icon: "🍓", description: "酸甜草莓鋪滿小塔，正好拿去試吃攤。", ingredients: { strawberry: 2, wheat: 1 }, unlockQuest: "c4_market_expansion", unlockText: "完成第四章「把市集撐大一點」後學會", effect: { kind: "order", bonus: 0.15, durationMs: 300000, durationText: "5 分鐘", label: "訂單收入提高 15%", summary: "訂單金幣收入提高 15%。" } },
    { id: "carrot_trail_soup", name: "胡蘿蔔田埂濃湯", icon: "🥕", description: "胡蘿蔔熬得綿甜，走去採集也不怕餓。", ingredients: { carrot: 3, river_mint: 1 }, unlockQuest: "c4_tasting_stall", unlockText: "完成第四章「蘿拉的試吃攤」後學會", effect: { kind: "forage", bonus: 1, durationMs: 300000, durationText: "5 分鐘", label: "採集多 1 份", summary: "每個採集點多取得 1 份採集物。" } },
    { id: "riverside_harvest_platter", name: "河畔豐收拼盤", icon: "🍱", description: "把當季收成排成一盤，留下收穫祭三星評比的味道。", ingredients: { tomato: 1, carrot: 1, wheat: 1 }, unlockFestivalRecipe: true, unlockText: "收穫祭作物評比獲得三星後學會", effect: { kind: "harvest", bonus: 1, durationMs: 300000, durationText: "5 分鐘", label: "收成多 1 份", summary: "每次收成多 1 份作物。" } },
  ];
  const R60_STORY_CHOICES = {
    mayor: { id: "mayor_welcome", speaker: "鎮長葛瑞", lines: ["你祖母把這片田照顧了很多年。", "現在輪到你替農場寫下一段新故事。", "第一格種下去以前，想先從哪裡開始？"], options: [
      { id: "farm", label: "我先去種田", result: "小麥種子包 +1", reward: { seedPack: "wheat" }, journal: "我告訴鎮長，想先把第一格田種起來。他送了我一包小麥種子。" },
      { id: "town", label: "先聽你講鎮上的事", result: "金幣 +5", reward: { coins: 5 }, journal: "我請鎮長先說說晨光鎮的近況。他介紹了老農班伯、蘿拉和圖圖，還給我五枚金幣上路。" },
    ] },
    elder: { id: "elder_wheat", speaker: "老農班伯", lines: ["這批新麥聞起來不錯。", "賣掉能換現金，留下來也能替下一輪打底。", "你想先賣，還是先留種？"], options: [
      { id: "sell", label: "先賣一小袋", result: "金幣 +5", reward: { coins: 5 }, journal: "老農班伯問起新麥，我決定先賣一小袋換些金幣。" },
      { id: "seed", label: "先留一包種子", result: "小麥種子包 +1", reward: { seedPack: "wheat" }, journal: "老農班伯問起新麥，我決定先留一包種子。" },
    ] },
    merchant: { id: "merchant_hello", speaker: "蘿拉", lines: ["我替你的農場留了一格攤位。", "第一批貨不用多，重點是讓客人記住名字。", "你想把牌子擺得醒目，還是先問客人喜歡什麼？"], options: [
      { id: "sign", label: "先把農場牌掛起來", result: "金幣 +5", reward: { coins: 5 }, journal: "第一次和蘿拉打招呼，我選擇先把農場牌掛起來。" },
      { id: "listen", label: "先聽客人想買什麼", result: "草莓種子包 +1", reward: { seedPack: "strawberry" }, journal: "第一次和蘿拉打招呼，我選擇先聽客人想買什麼。" },
    ] },
  };
  // R59A：每件農場小事都有選擇，選項文字就是實際成本與結果。
  const R58_EVENT_MIN_MS = 120000;
  const R58_EVENT_MAX_MS = 180000;
  const R66_DAILY_CANDIDATES = [
    { id: "harvest", type: "farming", category: "種田", rewardText: "16 金、6 經驗與修繕建材" },
    { id: "dock", type: "repair", category: "修建", rewardText: "建材 1 份" },
    { id: "market", type: "social", category: "社交", rewardText: "好感與 5 金" },
    { id: "forage", type: "explore", category: "探索採集", rewardText: "種子 1 包" },
    { id: "cook", type: "cooking", category: "料理", rewardText: "料理食材 1 份" },
  ];
  const R58_EVENTS = [
    { id: "traveling_merchant", name: "旅行商人來訪", icon: "🧳", speaker: "旅行商人", dialogue: "旅行商人掀起布簾，露出幾包草莓種子。", expiresMs: 300000, options: [
      { id: "buy", label: "花 12 金買 2 包", resultText: "草莓種子 2 包" }, { id: "trade", label: "用 2 份小麥換 1 包", resultText: "草莓種子 1 包" }, { id: "decline", label: "這次先婉拒", resultText: "不花資源" }] },
    { id: "crow_steal", name: "烏鴉來偷吃", icon: "🐦‍⬛", speaker: "農場小事", dialogue: "烏鴉在田邊歪著頭，眼睛直盯著麥穗。", expiresMs: 180000, options: [
      { id: "shoo", label: "揮手趕走牠", resultText: "烏鴉羽毛 1 份" }, { id: "feed", label: "撒 1 份小麥餵牠", resultText: "下次帶來小禮物" }] },
    { id: "afternoon_rain", name: "午後小雨", icon: "🌦️", speaker: "農場小事", dialogue: "雨點落在田埂上，乾土和空木桶都等著你。", expiresMs: 180000, options: [
      { id: "water", label: "讓田吸飽雨水", resultText: "田裡作物全部澆水" }, { id: "collect", label: "接一桶雨水", resultText: "雨水 1 份" }] },
    { id: "lost_chick", name: "走失的小雞", icon: "🐣", speaker: "農場小事", dialogue: "一隻小雞卡在草叢裡，圖圖也在遠處著急張望。", expiresMs: 180000, options: [
      { id: "coop", label: "帶回雞舍", resultText: "雞蛋 1 顆" }, { id: "tutu", label: "送去給圖圖", resultText: "圖圖好感 +1" }] },
  ];
  // R58：鄰居個人委託。第一件在第一章展開後出現，第二件在第一章主線完成後出現。
  const R58_PERSONAL_QUESTS = [
    { id: "mayor_first_notice", npcId: "mayor", chapter: 1, unlockClaimed: "c1_homecoming", title: "公告欄的第一張消息", wants: { river_mint: 1 }, reward: { coins: 10, xp: 2, materials: {} }, dialogue: "鎮長葛瑞把公告欄的卷邊壓平，說：「農場重新開工的消息，我想親手貼。帶 1 份溪畔薄荷來，我把它夾在公告旁，讓路過的人聞到河邊的新鮮氣味。」", doneLine: "鎮長葛瑞把薄荷夾在消息角落，說：「這樣大家一進鎮，就知道農場和河邊都醒來了。」" },
    { id: "mayor_road_lunch", npcId: "mayor", chapter: 2, unlockClaimed: "c1_first_meal", title: "巡路人的午餐", wants: { carrot: 2 }, reward: { coins: 12, xp: 3, materials: { wood: 1 } }, dialogue: "鎮長葛瑞要沿著新路巡一圈，說：「包裡有 2 份胡蘿蔔，我就能走到河邊再走回來，不必半路喊餓。」", doneLine: "鎮長葛瑞把木料塞給你，說：「巡路的人吃飽了，橋邊的消息也會準時回來。」" },
    { id: "elder_carrot_break", npcId: "elder", chapter: 1, unlockClaimed: "c1_homecoming", title: "下田前的胡蘿蔔", wants: { carrot: 1 }, reward: { coins: 8, xp: 2, materials: {} }, dialogue: "老農班伯扶著鋤頭說：「老骨頭下田前，得先有一口甜的。帶 1 份胡蘿蔔來，我陪你看一圈田。」", doneLine: "老農班伯咬了一口胡蘿蔔，點點頭說：「甜。有這一口，今天的土就翻得動。」" },
    { id: "elder_seed_check", npcId: "elder", chapter: 2, unlockClaimed: "c1_first_meal", title: "替你驗一把麥", wants: { wheat: 3 }, reward: { coins: 14, xp: 3, materials: { compost: 1 } }, dialogue: "老農班伯攤開手掌說：「拿 3 份小麥來，我替你驗驗今年的麥夠不夠飽滿，順便教你留種。」", doneLine: "老農班伯把最飽滿的幾粒挑出來，說：「留種要留最好的。這包堆肥你拿去，田會記得。」" },
    { id: "merchant_trial_wheat", npcId: "merchant", chapter: 1, unlockClaimed: "c1_homecoming", title: "蘿拉的試賣麥包", wants: { wheat: 4 }, reward: { coins: 18, xp: 4, materials: {} }, dialogue: "商人蘿拉把秤擦得發亮，說：「先給我 4 份小麥試賣。賣得動，我就替你的農場留一格好位置。」", doneLine: "商人蘿拉把麥包擺到攤前，說：「第一包就放這裡。客人先看見的，永遠是農場的名字。」" },
    { id: "merchant_carrot_bundle", npcId: "merchant", chapter: 2, unlockClaimed: "c1_first_meal", title: "胡蘿蔔小綑包", wants: { carrot: 3 }, reward: { coins: 20, xp: 4, materials: {} }, dialogue: "商人蘿拉抽出一條紅繩，說：「3 份胡蘿蔔綁成一綑，顏色好看，旅人一眼就想買。」", doneLine: "商人蘿拉把紅繩打了個結，說：「你看，農產也要穿得整齊，才走得遠。」" },
    { id: "child_carrot_snack", npcId: "child", chapter: 1, unlockClaimed: "c1_homecoming", title: "圖圖的田邊點心", wants: { carrot: 1 }, reward: { coins: 6, xp: 2, materials: {} }, dialogue: "孩童圖圖蹲在田邊說：「我幫你數新芽，你給我 1 份胡蘿蔔當點心，好不好？」", doneLine: "孩童圖圖把胡蘿蔔舉高，說：「這是田邊點心！我數到的新芽，一株都沒有少。」" },
    { id: "child_picnic_route", npcId: "child", chapter: 2, unlockClaimed: "c1_first_meal", title: "野餐路線的小點心", wants: { wheat: 2, carrot: 1 }, reward: { coins: 10, xp: 3, materials: {} }, dialogue: "孩童圖圖攤開自己畫的路線圖，說：「野餐路上要先吃點心。2 份小麥和 1 份胡蘿蔔，我就帶大家走對路。」", doneLine: "孩童圖圖在路線圖上蓋了一個胡蘿蔔印，說：「完成！這條路以後叫點心路。」" },
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
    { id: "elder", name: "老農班伯", title: "灶火還留著", taste: "hot",
      story: "老農班伯把雞舍的門帶上，才發現你站在灶邊。桌上只擺了一個盤子。他接過餐籃，從櫥裡再拿一個，把修了一半的魚竿挪到牆邊。今天那根竿子可以晚點再修。",
      reply: "本來想隨便吃兩口。你一來，倒像該好好坐下吃頓飯了。",
      recallContext: "他剛關好雞舍，先把雙手靠向灶口。魚竿挪到牆邊，留給你的盤子擺在灶旁；他沒急著收拾，先拉開旁邊的凳子。",
      matchedStory: "老農班伯把修好的魚竿靠回雞舍牆邊，灶旁已擺好兩個盤子。他替你拉開凳子，把紅格書籤放進桌上的手記。你護著餐籃走來，他就知道今天可以一起坐下。",
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
    {id:"market_fireside",name:"收攤後的灶邊桌",guests:["merchant","elder"],reward:{coins:10,xp:0,materials:{}},response:"蘿拉把秤收好，老農班伯也把魚竿靠回牆邊。酸香和熱餅都到手，兩人終於一起坐下。"},
    {id:"fireside_garden",name:"灶火旁的空椅子",guests:["elder","child"],reward:{coins:0,xp:0,materials:{wood:2}},response:"老農班伯護著熱餅，圖圖把甜點分給空椅子。灶火旁多留了一個真正能坐下的位置。"},
    {id:"garden_market",name:"花園收攤茶桌",guests:["child","merchant"],reward:{coins:0,xp:5,materials:{}},response:"圖圖端著甜點，蘿拉倒了酸香野莓茶。紅格手記記下花園與市集第一次共用一張桌。"},
  ];
  // R6 presentation is separate from the retained R1–R5 narrative API contract.
  const MEMORIES = {
    merchant: { token: "陽光茶凳", heading: "蘿拉把茶杯留在陽光裡", detail: "秤放回攤上，兩張凳子拉到陽光裡。她把茶杯倒扣在你的位子，下次來就翻過來。", reply: "秤收好了，凳子就留在陽光裡。這只茶杯是你的，來了自己坐。", wrong: "她把這一口配著茶慢慢吃完，又把空杯推向你：『收攤後，想找個能把一整天洗掉的滋味。你也坐下試試。』" },
    elder: { token: "修好的魚竿", heading: "老農班伯掛起魚竿，留下兩只盤子", detail: "魚竿修好了，掛上雞舍外的木架。灶旁的兩個盤子不再收進櫥裡，老農班伯拍拍靠灶那張凳子。", reply: "魚竿掛好囉。灶旁兩個盤子都留著，手涼就坐近一點，吃完再去看河。", wrong: "老農班伯先把盤子挪近灶口，雙手搓了搓：『先別收火。從雞舍回來，連指節都僵了；我想捧著吃，慢慢暖回來。』" },
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
    { id: "c1_homecoming", chapter: 1, name: "種下第一格", npcId: "mayor", description: "先找鎮長葛瑞，再親手種下第一格作物。接下來要做什麼，由你決定。", target: { kind: "npc", id: "mayor" }, wants: {},
      goals: [goal("talk", 1, "找鎮長葛瑞交談", "mayor"), goal("plant", 1, "種下第一格")], reward: reward(12, 2, { wood: 6, stone: 2 }) },
    { id: "c1_first_harvest", chapter: 1, name: "老農班伯的開市小麥", npcId: "elder", description: "交給老農班伯 2 份小麥，讓市集認得農場的新收成。", target: { kind: "npc", id: "elder" }, wants: { wheat: 2 },
      goals: [goal("harvest", 2, "收成老農班伯的開市小麥", "wheat")], reward: reward(16, 6, { wood: 4, stone: 4 }) },
    { id: "c1_first_meal", chapter: 1, name: "回家的第一餐", npcId: "elder", description: "在農舍灶台做一份農家麥餅，替回家的第一天備好晚餐。", target: { kind: "station", id: "kitchen", tileId: "t10_10" }, wants: {},
      goals: [goal("cook", 1, "烤一份農家麥餅", "rustic_bread")], reward: reward(20, 4, { wood: 6 }, { fishingRod: true }) },
    { id: "c2_fishing_dock", chapter: 2, name: "河邊有個落腳處", npcId: "elder", description: "用四份木料、兩份石材修好釣台，再試試老農班伯的魚竿。", target: { kind: "river", id: "fishing_dock", tileId: "t2_9" }, wants: {},
      goals: [goal("restore", 1, "修好河畔釣台", "fishing_dock")], reward: reward(16, 4) },
    { id: "c2_river_basket", chapter: 2, name: "河風裡的提籃", npcId: "merchant", description: "釣兩尾魚，採一份溪畔薄荷。蘿拉收一尾魚和薄荷，替野餐桌備好木料。", target: { kind: "river", id: "fishing_dock", tileId: "t2_9" }, wants: { river_mint: 1 }, wantsCatch: 1,
      goals: [goal("fish", 2, "釣兩尾魚"), goal("forage", 1, "採一份溪畔薄荷", "river_mint")], reward: reward(24, 6, { wood: 6 }) },
    { id: "c2_picnic_table", chapter: 2, name: "多放幾張椅子", npcId: "merchant", description: "修好野餐桌，找蘿拉確認座位，再交兩份胡蘿蔔試做點心。", target: { kind: "station", id: "picnic_table", tileId: "t10_10" }, wants: { carrot: 2 },
      goals: [goal("restore", 1, "修好野餐桌", "picnic_table"), goal("talk", 1, "找蘿拉交談", "merchant")], reward: reward(32, 8) },
    { id: "c3_good_neighbors", chapter: 3, name: "鄰居都到齊", npcId: "elder", description: "照顧動物三次、完成兩張訂單，把兩份小麥帶給老農班伯。野餐前先把日常顧好。", target: { kind: "npc", id: "elder" }, wants: { wheat: 2 },
      goals: [goal("care", 3, "照顧動物"), goal("order", 2, "交付市集訂單"), goal("talk", 1, "找老農班伯交談", "elder")], reward: reward(40, 8, { wood: 4 }) },
    { id: "c3_garden", chapter: 3, name: "桌邊的小花園", npcId: "child", description: "整理花園，烤胡蘿蔔餅、泡薄荷茶。圖圖想把第一朵小花壓進筆記本。", target: { kind: "station", id: "garden", tileId: "t6_2" }, wants: {},
      goals: [goal("restore", 1, "整理花園", "garden"), goal("cook", 1, "烤一份胡蘿蔔餅", "baked_carrot"), goal("cook", 1, "泡一壺溪畔薄荷茶", "mint_tea")], reward: reward(0, 8, {}, { collectible: "pressed_flower" }) },
    { id: "c3_harvest_picnic", chapter: 3, name: "把收穫端上桌", npcId: "child", description: "找圖圖一起開飯。帶一份麥餅、一份胡蘿蔔烤餅、一壺薄荷茶和兩尾魚，留張野餐合照。", target: { kind: "npc", id: "child" }, wants: {},
      wantsMeals: { rustic_bread: 1, baked_carrot: 1, mint_tea: 1 }, wantsCatch: 2,
      goals: [goal("talk", 1, "找圖圖交談", "child"), goal("restore", 1, "修好河畔釣台", "fishing_dock"), goal("restore", 1, "修好野餐桌", "picnic_table"), goal("restore", 1, "整理花園", "garden")],
      reward: reward(24, 12, {}, { collectible: "picnic_memory", guestbook: true }) },
    { id: "c4_market_expansion", chapter: 4, name: "把市集撐大一點", npcId: "merchant", description: "做法甲用新鮮番茄、草莓和木料搭鮮貨桌；做法乙用日曬乾貨與石材搭耐放貨架。備齊哪套，就直接交哪套。", opening: ["商人蘿拉拿捲尺在攤前比了又比。", "「貨多，再擠下去，客人只看得到別人的後腦勺。」", "她畫出兩張完全不同的圖：一張是鮮貨桌，一張是耐放貨架。", "「你實際帶來哪套材料，市集就長成哪個樣子。」"], completion: ["蘿拉把新桌腳踩穩，才退後看了一眼。", "「這樣才像市集，不是大家排隊等撞肩膀。」", "她把最後一面小旗掛好，市集也留下了你真正交付的做法。"], target: { kind: "npc", id: "merchant" }, wants: { tomato: 3, strawberry: 2 }, wantsMaterials: { wood: 2 }, altWantsMaterials: { stone: 2 }, altDriedAny: 3, routeNames: { primary: "做法甲・鮮貨桌", alt: "做法乙・耐放貨架" }, routeConsequences: { primary: "市集多一張鮮貨桌，報酬較高。", alt: "市集多一座耐放貨架，並退回 1 份木料。" }, routeRewards: { primary: reward(36, 8), alt: reward(24, 8, { wood: 1 }) }, goals: [], reward: reward(30, 8) },
    { id: "c4_tasting_stall", chapter: 4, name: "蘿拉的試吃攤", npcId: "merchant", description: "做法甲端草莓市集塔與胡蘿蔔；做法乙端一道好吃以上的料理與 2 份日曬乾貨。備齊哪套，就直接交哪套。", opening: ["蘿拉把空盤一字排開，連角度都一樣。", "「別只說好吃，先讓香味把人拉過來。」", "她把甜點盤和日曬拼盤分到桌子兩邊。", "「你端來哪一套，今天的試吃攤就講哪一個故事。」"], completion: ["第一盤才切開，圖圖已經踮著腳看。", "蘿拉沒急著招呼，只把盤子往前推了一點。", "「看吧，香味比我喊十遍都管用。」", "攤布角落留下了這次實際交付的試吃記號。"], target: { kind: "station", id: "kitchen", tileId: "t10_10" }, wants: { carrot: 2 }, wantsMeals: { strawberry_market_tart: 1 }, altDriedAny: 2, altGradedMealAny: 1, routeNames: { primary: "做法甲・甜點試吃", alt: "做法乙・日曬拼盤" }, routeConsequences: { primary: "攤布繡上草莓記號，報酬較高。", alt: "攤布掛上日曬牌，並拿到堆肥 1 份。" }, routeRewards: { primary: reward(42, 10), alt: reward(28, 10, { compost: 1 }) }, goals: [goal("cook", 1, "做一份草莓市集塔", "strawberry_market_tart")], reward: reward(36, 10) },
    { id: "c4_notice_bench", chapter: 4, name: "公告欄旁的長椅", npcId: "mayor", description: "做法甲用木料、石材與熱食整修；做法乙出示 6 枚追光印章，再交 2 份乾貨做成防潮坐墊。備齊哪套，就直接交哪套。", opening: ["鎮長葛瑞扶住歪掉的椅背，木板立刻吱了一聲。", "「這張椅子聽過不少消息，也該讓它喘口氣了。」", "他放下傳統修繕圖，又拿出一張防潮坐墊圖。", "「石木整修，或追光印章加乾貨坐墊；你帶來哪套，我們就做哪套。」"], completion: ["鎮長檢查最後一個接縫，自己先坐了一下。", "長椅沒再出聲，他才滿意地拍拍旁邊的位置。", "「穩了。以後看公告不用站著看到腿麻。」", "公告旁也留下這次真正完成的做法。"], target: { kind: "npc", id: "mayor" }, wantsMaterials: { wood: 4, stone: 2 }, wantsMeals: { tomato_harvest_stew: 1 }, altDriedAny: 2, altSunbookStamps: 6, routeNames: { primary: "做法甲・石木整修", alt: "做法乙・追光坐墊" }, routeConsequences: { primary: "長椅換上石木椅腳，報酬較高。", alt: "長椅多一張防潮坐墊，並退回木料 2 份。" }, routeRewards: { primary: reward(42, 12), alt: reward(30, 12, { wood: 2 }) }, goals: [], reward: reward(42, 12) },
    { id: "c5_festival_tables", chapter: 5, name: "河畔先擺好桌", npcId: "mayor", description: "替河畔收穫祭備妥桌面：木料、胡蘿蔔與番茄缺一不可。", opening: ["鎮長把河畔空地分成一格一格，走三步就停下來看。", "「桌子不能擋路，端菜的人也不能踩進草叢。」", "他把配置圖轉向你。", "「帶 5 份木料、3 份胡蘿蔔和 3 份番茄來，我們先把桌子擺穩。」"], completion: ["最後一張桌子落地，河風正好從桌與桌之間穿過。", "鎮長沿著通道走一遍，沒有碰倒任何椅子。", "「可以。今晚大家端著熱湯，也走得安穩。」"], target: { kind: "river", id: "picnic_table", tileId: "t10_10" }, wants: { carrot: 3, tomato: 3 }, wantsMaterials: { wood: 5 }, goals: [], reward: reward(40, 10) },
    { id: "c5_invite_neighbors", chapter: 5, name: "把大家請到河邊", npcId: "child", description: "親口邀請鎮長、老農班伯、蘿拉和圖圖，再準備一份胡蘿蔔田埂濃湯。", opening: ["圖圖抱著四張邀請卡，跑得紙角都翹了。", "「我畫了河、桌子，還有一個超大的湯碗！」", "他把卡片分給你一半。", "「你去找大家說，我來檢查路上的箭頭。少一個人，晚餐就少一個故事。」"], completion: ["圖圖把四張回覆排在桌上，一張不少。", "「鎮長葛瑞會帶燈，老農班伯說他帶大湯杓，蘿拉要帶乾淨盤子。」", "他把自己的卡片塞進口袋。", "「我當然也會來。我還要坐最看得到河的位置。」"], target: { kind: "npc", id: "child" }, wantsMeals: { carrot_trail_soup: 1 }, goals: [goal("talk", 1, "邀請鎮長葛瑞", "mayor"), goal("talk", 1, "邀請老農班伯", "elder"), goal("talk", 1, "邀請蘿拉", "merchant"), goal("talk", 1, "邀請圖圖", "child")], reward: reward(44, 12) },
    { id: "c5_festival_dinner", chapter: 5, name: "河畔收穫祭晚餐", npcId: "merchant", description: "把三道料理端上河畔長桌，跟四位鄰居一起吃完收穫祭晚餐。", opening: ["夕陽碰到河面時，蘿拉已經把盤子排好。", "老農班伯提著湯杓，鎮長在掛燈，圖圖則忙著替每張椅子取名字。", "蘿拉看了看你的餐籃。", "「番茄燉鍋、草莓市集塔、胡蘿蔔濃湯。三道都到，我們就開飯。」"], completion: ["燈一盞一盞亮起來，河面把每個人的笑聲推得很遠。", "老農班伯把最後一勺燉鍋分完，蘿拉難得沒去算還剩幾個盤子。", "圖圖舉起杯子喊：「下次也要辦，而且我要畫新的邀請卡！」", "鎮長望向你說：「農場不只重新開門了。今晚，它把整個鎮都請上了桌。」", "收穫祭會每隔 20 分鐘再開一次；每次有 10 分鐘完成三個小目標，還能到祭典攤位參加作物評比。"], target: { kind: "river", id: "picnic_table", tileId: "t10_10" }, wantsMeals: { tomato_harvest_stew: 1, strawberry_market_tart: 1, carrot_trail_soup: 1 }, goals: [goal("talk", 1, "請四位鄰居到場", "mayor"), goal("talk", 1, "請四位鄰居到場", "elder"), goal("talk", 1, "請四位鄰居到場", "merchant"), goal("talk", 1, "請四位鄰居到場", "child")], reward: reward(60, 18) },
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
    const rows = requirements(state, q.wants, "inventory").concat(requirements(state, q.wantsMeals, "meals"), requirements(state, q.wantsMaterials, "materials"));
    if (q.wantsCatch) rows.push({ source: "catch", id: "any", name: "河魚", current: sum(state.adventure.catch), required: q.wantsCatch, complete: sum(state.adventure.catch) >= q.wantsCatch, consume: true });
    return rows;
  }
  /* R77C 第 14 項：第 4 章第二條路。乾貨讀曬架產物、好吃以上讀料理等級紀錄、印章只認不收。 */
  function driedAnyCount(state) { const items = (state.storage && state.storage.items) || {}; return Sunplay && Sunplay.DRIED ? Object.keys(Sunplay.DRIED).reduce((n, id) => n + qty(items[id]), 0) : 0; }
  function gradedMealCount(state) {
    const grades = state.adventure && state.adventure.r75b && state.adventure.r75b.grades;
    const meals = (state.adventure && state.adventure.meals) || {};
    /* 等級紀錄可能還沒跟餐籃現量對齊（例如擺攤剛賣掉），以餐籃裡真的有的份數為上限。 */
    return RECIPES.reduce((n, r) => { const g = grades && grades[r.id]; return n + Math.min(qty(meals[r.id]), qty(g && g.tasty) + qty(g && g.perfect)); }, 0);
  }
  function sunbookStampCount(state) {
    const stamps = state.sunbook && state.sunbook.stamps;
    if (!stamps || typeof stamps !== "object") return 0;
    return Object.values(stamps).reduce((n, row) => n + (row && typeof row === "object" ? Object.values(row).filter(Boolean).length : 0), 0);
  }
  function altQuestRequirements(state, q) {
    if (!q.altWants && !q.altWantsMeals && !q.altWantsMaterials && !q.altDriedAny && !q.altGradedMealAny && !q.altSunbookStamps) return [];
    const rows = requirements(state, q.altWants, "inventory").concat(requirements(state, q.altWantsMeals, "meals"), requirements(state, q.altWantsMaterials, "materials"));
    if (q.altDriedAny) { const cur = driedAnyCount(state); rows.push({ source: "driedAny", id: "any_dried", name: "任何乾貨", current: cur, required: q.altDriedAny, complete: cur >= q.altDriedAny, consume: true, route: "alt" }); }
    if (q.altGradedMealAny) { const cur = gradedMealCount(state); rows.push({ source: "gradedMeal", id: "any_tasty_meal", name: "任何一道好吃以上的料理", current: cur, required: q.altGradedMealAny, complete: cur >= q.altGradedMealAny, consume: true, route: "alt" }); }
    if (q.altSunbookStamps) { const cur = sunbookStampCount(state); rows.push({ source: "sunbookStamps", id: "sunbook_stamps", name: "追光手冊印章（不消耗）", current: cur, required: q.altSunbookStamps, complete: cur >= q.altSunbookStamps, consume: false, route: "alt" }); }
    for (const r of rows) if (!r.route) r.route = "alt";
    return rows;
  }
  function questRouteStatus(state, q, a) {
    const primary = questRequirements(state, q).map((row) => Object.assign(row, { route: "primary" }));
    const alt = altQuestRequirements(state, q);
    const goalsDone = q.goals.every((g) => goalCount(a, g) >= g.count);
    const primaryReady = goalsDone && primary.every((r) => r.complete);
    const altReady = alt.length > 0 && alt.every((r) => r.complete);
    return { primary, alt, goalsDone, primaryReady, altReady, canClaim: primaryReady || altReady, claimRoute: primaryReady ? "primary" : altReady ? "alt" : null };
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
      else if (rec.readyAt !== null || questRouteStatus(state, q, a).canClaim) {
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
    if (!object(a.earlyGoals)) a.earlyGoals = {};
    a.earlyGoals.marketPreview = a.earlyGoals.marketPreview === true;
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
      rec.claimRoute = rec.claimRoute === "primary" || rec.claimRoute === "alt" ? rec.claimRoute : null;
      rec.routeConsequence = typeof rec.routeConsequence === "string" ? rec.routeConsequence.slice(0, 180) : "";
      rec.routeReceipt = Array.isArray(rec.routeReceipt) ? rec.routeReceipt.filter((row) => object(row) && typeof row.name === "string" && Number.isFinite(row.required)).slice(0, 8).map((row) => ({ name: row.name.slice(0, 80), required: qty(row.required), consume: row.consume !== false })) : [];
      a.quests[q.id] = rec;
    }
    // R58 state: random events, neighbor favor/personal quests, and meal buffs.
    const r58raw = object(a.r58) ? a.r58 : {};
    const r58personalRaw = object(r58raw.personal) ? r58raw.personal : {};
    const r58completed = [...new Set((Array.isArray(r58personalRaw.completed) ? r58personalRaw.completed : []).filter((id) => R58_PERSONAL_QUESTS.some((q) => q.id === id)))];
    const r58completedAtRaw = object(r58personalRaw.completedAt) ? r58personalRaw.completedAt : {};
    const r58buffRaw = object(r58raw.buffs) ? r58raw.buffs : {};
    const cleanBuff = (value, kind) => {
      if (!object(value) || !Number.isSafeInteger(value.until) || value.until < 0) return null;
      const meal = typeof value.meal === "string" && RECIPES.some((x) => x.id === value.meal) ? { meal: value.meal } : {}; // R60：保留吃下的料理，HUD 才能寫名稱
      if (kind === "growth") return Number.isFinite(value.mul) && value.mul > 0 && value.mul < 1 ? Object.assign({ until: value.until, mul: value.mul }, meal) : null;
      return Number.isFinite(value.bonus) && value.bonus > 0 && value.bonus <= 1 ? Object.assign({ until: value.until, bonus: value.bonus }, meal) : null;
    };
    let r58active = null;
    if (object(r58raw.activeEvent) && R58_EVENTS.some((e) => e.id === r58raw.activeEvent.id)
      && Number.isSafeInteger(r58raw.activeEvent.startedAt) && r58raw.activeEvent.startedAt >= 0
      && Number.isSafeInteger(r58raw.activeEvent.expiresAt) && r58raw.activeEvent.expiresAt > r58raw.activeEvent.startedAt) {
      r58active = { id: r58raw.activeEvent.id, startedAt: r58raw.activeEvent.startedAt, expiresAt: r58raw.activeEvent.expiresAt };
    }
    const r59raw = object(r58raw.r59) ? r58raw.r59 : {};
    a.r58 = {
      nextEventAt: Number.isSafeInteger(r58raw.nextEventAt) && r58raw.nextEventAt >= 0 ? r58raw.nextEventAt : now + R58_EVENT_MIN_MS,
      lastEventAt: Number.isSafeInteger(r58raw.lastEventAt) && r58raw.lastEventAt >= 0 ? r58raw.lastEventAt : 0,
      activeEvent: r58active,
      history: (Array.isArray(r58raw.history) ? r58raw.history : []).filter((h) => object(h) && R58_EVENTS.some((e) => e.id === h.id) && Number.isSafeInteger(h.at) && h.at >= 0).slice(-24).map((h) => ({ id: h.id, at: h.at, result: h.result === "resolved" ? "resolved" : "expired" })),
      favor: cleanCounts(r58raw.favor, Object.keys(C.NPCS || {}), 999),
      personal: { completed: r58completed, completedAt: Object.fromEntries(r58completed.map((id) => [id, Number.isSafeInteger(r58completedAtRaw[id]) && r58completedAtRaw[id] >= 0 ? r58completedAtRaw[id] : 0])) },
      buffs: { growth: cleanBuff(r58buffRaw.growth, "growth"), order: cleanBuff(r58buffRaw.order, "order"), harvest: cleanBuff(r58buffRaw.harvest, "harvest"), forage: cleanBuff(r58buffRaw.forage, "forage") },
      r59: {
        eventFlags: object(r59raw.eventFlags) ? copy(r59raw.eventFlags) : {},
        seedPacks: cleanCounts(r59raw.seedPacks, Object.keys(C.CROPS || {}), 99),
        journal: (Array.isArray(r59raw.journal) ? r59raw.journal : []).filter((row) => object(row) && typeof row.text === "string" && Number.isSafeInteger(row.at)).slice(-40).map((row) => ({ at: row.at, eventId: String(row.eventId || ""), choiceId: String(row.choiceId || ""), text: row.text.slice(0, 180) })),
        permanent: object(r59raw.permanent) ? copy(r59raw.permanent) : {},
        r60: object(r59raw.r60) ? copy(r59raw.r60) : { storyChoices: {}, followups: {} },
      },
    };
    if (!object(a.r58.r59.r60.storyChoices)) a.r58.r59.r60.storyChoices = {};
    if (!object(a.r58.r59.r60.followups)) a.r58.r59.r60.followups = {};
    const r61raw = object(a.r61) ? a.r61 : {};
    const festivalRaw = object(r61raw.festival) ? r61raw.festival : {};
    const validChoice = object(r61raw.marketFlagChoice) && ["gate", "stall"].includes(r61raw.marketFlagChoice.id) ? r61raw.marketFlagChoice : null;
    const dailyRaw = object(r61raw.daily) ? r61raw.daily : {};
    const dailyDay = Math.floor(now / 86400000);
    const dailySelected = [...new Set((Array.isArray(dailyRaw.selected) ? dailyRaw.selected : []).filter((id) => R66_DAILY_CANDIDATES.some((row) => row.id === id)))];
    a.r61 = {
      marketFlagChoice: validChoice ? { id: validChoice.id, at: qty(validChoice.at, Number.MAX_SAFE_INTEGER), journal: String(validChoice.journal || "").slice(0, 180) } : null,
      world: { marketFlag: r61raw.world && ["gate", "stall"].includes(r61raw.world.marketFlag) ? r61raw.world.marketFlag : null, tastingMark: !!(r61raw.world && r61raw.world.tastingMark), noticeBench: !!(r61raw.world && r61raw.world.noticeBench), festivalTables: !!(r61raw.world && r61raw.world.festivalTables),
        c4Routes: object(r61raw.world && r61raw.world.c4Routes) ? Object.fromEntries(Object.entries(r61raw.world.c4Routes).filter(([id, route]) => QUESTS.some((q) => q.id === id && q.chapter === 4) && (route === "primary" || route === "alt"))) : {} },
      festival: {
        unlocked: festivalRaw.unlocked === true || claimed(a, "c5_festival_dinner"),
        startsAt: qty(festivalRaw.startsAt, Number.MAX_SAFE_INTEGER),
        endsAt: qty(festivalRaw.endsAt, Number.MAX_SAFE_INTEGER),
        nextAt: qty(festivalRaw.nextAt, Number.MAX_SAFE_INTEGER),
        baseline: object(festivalRaw.baseline) ? copy(festivalRaw.baseline) : null,
        completed: festivalRaw.completed === true,
        rewardGranted: festivalRaw.rewardGranted === true,
        medals: qty(festivalRaw.medals, 999),
        decorations: qty(festivalRaw.decorations, 999),
        rounds: qty(festivalRaw.rounds, 999),
        goalsClaimed: festivalRaw.goalsClaimed === true,
        judging: object(festivalRaw.judging) && Number.isInteger(festivalRaw.judging.stars) ? copy(festivalRaw.judging) : null,
        settlement: object(festivalRaw.settlement) ? copy(festivalRaw.settlement) : null,
        festivalRecipe: festivalRaw.festivalRecipe === true,
        supportProvisioned: festivalRaw.supportProvisioned === true,
        supportMessage: typeof festivalRaw.supportMessage === "string" ? festivalRaw.supportMessage.slice(0, 160) : "",
        harvestCrop: typeof festivalRaw.harvestCrop === "string" && C.CROPS[festivalRaw.harvestCrop] ? festivalRaw.harvestCrop : null,
        harvestRequired: Math.max(1, Math.min(3, qty(festivalRaw.harvestRequired) || 3)),
      },
      daily: dailyRaw.day === dailyDay ? { day: dailyDay, selected: dailySelected.length === 3 ? dailySelected : ["harvest", "dock", "market"], chosen: dailyRaw.chosen === true, swapped: dailyRaw.swapped === true, claimed: dailyRaw.claimed === true } : { day: dailyDay, selected: ["harvest", "dock", "market"], chosen: false, swapped: false, claimed: false },
    };
    if (a.r61.festival.unlocked && !a.r61.festival.startsAt && !a.r61.festival.nextAt) a.r61.festival.startsAt = now;
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
    let marketPreviewReward = null;
    if (claimed(a, "c1_homecoming") && e.type === "talk" && id === "merchant" && !a.earlyGoals.marketPreview) {
      a.earlyGoals.marketPreview = true;
      marketPreviewReward = reward(5, 0);
      grant(state, marketPreviewReward);
    }
    sync(state, at(state, now));
    return ok(marketPreviewReward ? "蘿拉給了你 5 金，市集開張後再來看看。" : "已記下這次行動。", { type: e.type, count, total: a.counts[e.type], marketPreviewReward });
  }

  function finishTutorial(state, now) {
    const init = ensure(state, now); if (!init.ok) return init;
    if (claimed(state.adventure, "c1_homecoming")) return fail("already_claimed", "新手教學已經完成了。");
    if (state.adventure.quests.c1_homecoming.status !== "ready") return fail("not_ready", "先找鎮長葛瑞，再種下第一格。");
    const result = claim(state, "c1_homecoming", now);
    if (result.ok) {
      const r59 = state.adventure.r58.r59;
      r59.seedPacks.wheat = Math.min(99, (r59.seedPacks.wheat || 0) + 2);
      result.tutorialSeeds = { wheat: 2 };
      result.message = "第一格種好了。再送你 2 包小麥種子，三格一起照顧就不用乾等。";
    }
    return result;
  }

  function activePlotTotal(state) { return state.upgrades && state.upgrades.plotCount > 0 && C.UPGRADES && C.UPGRADES.plotCount ? C.UPGRADES.plotCount.levels[state.upgrades.plotCount - 1].value : C.GAME.startPlots; }
  function readyHarvestPlots(state, now) {
    const t = at(state, now); const active = activePlotTotal(state);
    return (state.map && state.map.tiles || []).filter((tile) => tile.plotIndex != null && tile.plotIndex < active).filter((tile) => {
      const plot = state.plots && state.plots[tile.plotIndex]; if (!plot || !plot.cropId || !C.CROPS[plot.cropId]) return false; if (typeof window !== "undefined" && typeof window.getCropProgress === "function") return !!window.getCropProgress(state, plot, t).ready; // R65 整合：成熟判斷以遊戲本身為準，避免任務卡說可收成、田上還在倒數
      let growMs = C.CROPS[plot.cropId].growMs; const growth = state.adventure && state.adventure.r58 && state.adventure.r58.buffs && state.adventure.r58.buffs.growth;
      if (growth && growth.until > t) growMs = Math.max(1000, Math.floor(growMs * growth.mul));
      if ((plot.wateredAt || 0) >= plot.plantedAt) growMs = Math.max(1000, Math.floor(growMs * (C.MOISTURE_MUL || 0.75)));
      return t - plot.plantedAt >= growMs;
    });
  }
  /* R78B：第 2 章以後，下一步也跟著手上的任務走。
     缺作物：田裡有熟的就去收、在長就澆水或等、沒種就去種；缺木料石材：去清樹樁石頭；全部齊了才去回報。
     任務沒有要交的東西（修釣台、找人說話那一類）回傳 null，照原本的走法。 */
  function questFarmStep(state, a, ctx) {
    const index = QUESTS.findIndex((q) => !claimed(a, q.id)); if (index < 0 || !unlockedQuest(a, index)) return null;
    const q = QUESTS[index]; const route = questRouteStatus(state, q, a);
    if (!route.primary.length && !route.alt.length) return null;
    const npc = (C.NPCS || {})[q.npcId] || { name: "鎮民" }; const tag = { questAware: true, questId: q.id };
    if (route.canClaim) return Object.assign({ action: "report", target: q.npcId, tileId: null, text: `「${q.name}」要的東西都齊了，去找${npc.name}回報。`, short: `去找${npc.name}回報`, actionLabel: "去回報" }, tag);
    if (!route.goalsDone) return null;
    const row = route.primary.find((r) => !r.complete); if (!row) return null;
    const lack = Math.max(1, row.required - row.current);
    if (row.source === "materials") {
      const spot = (state.map && state.map.tiles || []).find((tile) => tile.object && (C.OBSTACLES || {})[tile.object] && ((C.OBSTACLES[tile.object].grants || {})[row.id] || 0) > 0);
      if (!spot) return null;
      return Object.assign({ action: "gather", target: "obstacle", tileId: spot.id, materialId: row.id, text: `還差 ${lack} 份${row.name}，清掉農場上的${C.OBSTACLES[spot.object].name}就有。`, short: `去農場找${row.name}`, actionLabel: `去找${row.name}` }, tag);
    }
    if (row.source !== "inventory" || !C.CROPS[row.id]) return null;
    const crop = C.CROPS[row.id]; const need = `還差 ${lack} 份${crop.name}`; const mine = (tile) => ctx.plotOf(tile).cropId === crop.id;
    const extra = Object.assign({ cropId: crop.id }, tag);
    const ripe = ctx.ready.filter(mine);
    if (ripe.length) return ctx.field("harvest", ripe[0], `${need}，田裡的${crop.name}熟了，點一下收成。`, `去收${crop.name}`, `去田邊收${crop.name}`, Object.assign({ count: ripe.length }, extra));
    const thirsty = ctx.dry.find(mine);
    if (thirsty) return ctx.field("tend", thirsty, `${need}，田裡的${crop.name}正在長，先澆水，長得更快。`, `去照顧${crop.name}`, `去田邊澆${crop.name}`, extra);
    const young = ctx.growing.find(mine);
    if (young) return ctx.field("wait", young, `${need}，等田裡的${crop.name}成熟就能收。`, `等${crop.name}成熟`, `等${crop.name}成熟`, extra);
    const packs = qty((((a.r58 || {}).r59 || {}).seedPacks || {})[crop.id]);
    const unlocked = crop.unlockLevel <= (state.level || 1) && (crop.id !== "carrot" || ((state.upgrades || {}).plotCount || 0) >= 1);
    if (!unlocked && packs <= 0) return null;
    if (ctx.empty.length) return ctx.field("plant", ctx.empty[0], `${need}，先種下${crop.name}。`, `去種${crop.name}`, `去田邊種${crop.name}`, extra);
    /* 田都種滿了：先收掉熟的空出一格；沒有熟的就交回原本的走法。 */
    if (ctx.ready.length) return ctx.field("harvest", ctx.ready[0], `${need}，田都種滿了，先收成空出一格來種${crop.name}。`, "去收成", "先收一格空出田地", Object.assign({ count: ctx.ready.length }, tag));
    return null;
  }
  /* R82C：讀遊戲本身的「現在收／等光」規則（game.js 載入後才有），讀不到就當沒有取捨。 */
  function r82cLightChoice(state, plotIndex, now) {
    try {
      const G = typeof module !== "undefined" && module.exports ? require("./game.js") : root;
      return G && typeof G.lightHarvestChoice === "function" ? G.lightHarvestChoice(state, plotIndex, now) : null;
    } catch (_) { return null; }
  }
  // R75 整合：開場的下一步跟著光走——折光 → 光裡照料 → 等光時先把種子包種完 → 收成 → 催熟 → 交付。
  // 文字裡不放會跳動的秒數（任務卡靠文字判斷要不要重畫），倒數交給任務卡提示列與陽光標籤。
  function nextFarmStep(state, now) {
    if (!ensure(state, now).ok) return { action: "wait", target: null, tileId: null, text: "先回到農場看看。", short: "回農場看看", actionLabel: "回到農場" };
    const a = state.adventure; const t = at(state, now); const ready = readyHarvestPlots(state, now); const wheat = ((state.storage || {}).items || {}).wheat || 0; const bread = (a.meals || {}).rustic_bread || 0;
    const active = activePlotTotal(state); const plotOf = (tile) => (state.plots || [])[tile.plotIndex];
    const tiles = (state.map && state.map.tiles || []).filter((tile) => tile.plotIndex != null && tile.plotIndex < active && plotOf(tile));
    const cropped = tiles.filter((tile) => plotOf(tile).cropId && C.CROPS[plotOf(tile).cropId]);
    const growing = cropped.filter((tile) => !ready.includes(tile));
    const dry = growing.filter((tile) => (plotOf(tile).wateredAt || 0) < plotOf(tile).plantedAt);
    const empty = tiles.filter((tile) => !plotOf(tile).cropId);
    const packs = qty((((a.r58 || {}).r59 || {}).seedPacks || {}).wheat);
    const cropName = (tile) => C.CROPS[plotOf(tile).cropId].name;
    const lightHarvestReward = (tile) => {
      if (!tile || !Sunplay || !Sunplay.harvestOutcome) return "多收 1 份＋陽光 2";
      const out = Sunplay.harvestOutcome(state, plotOf(tile), { exposedNow: true, caughtSunlight: 1 });
      return `多收 ${Math.max(0, out.yieldBonus || 0)} 份＋陽光 ${Math.max(0, out.sunlightTotal || 0)}`;
    };
    const field = (action, tile, text, actionLabel, short, extra) => Object.assign({ action, target: "field", tileId: tile ? tile.id : null, plotIndex: tile ? tile.plotIndex : null, text, short, actionLabel }, extra || {});
    const mealDone = claimed(a, "c1_first_meal"); const sunplay = Sunplay && !mealDone ? Sunplay.normalize(state).r75Sunplay : null; let litGrowing = null, lightOn = false;
    if (sunplay) {
      const sun = state.sun || {}; const used = sun.used || [];
      const activeLight = t >= (sun.startsAt || 0) && t < (sun.endsAt || 0) ? (sun.plots || []).filter((i) => !used.includes(i)) : [];
      const previewLight = !activeLight.length && t < (sun.previewAt || 0) ? sun.previewPlots || [] : [];
      const lit = activeLight.length ? activeLight : previewLight; const litCrops = cropped.filter((tile) => lit.includes(tile.plotIndex));
      if (!sunplay.firstRefracted && lit.length && !litCrops.length && cropped.length) {
        const target = dry[0] || growing[0] || cropped[0];
        /* 作物已經熟了還叫玩家折光，要講清楚為什麼：在光裡收成才接得到陽光，所以先別收。 */
        const ripe = ready.includes(target);
        if (Sunplay.canRefract(state, target.plotIndex, t)) return field("refract", target, ripe ? `${cropName(target)}熟了，先別收。拿祖母的手鏡把光折過來，在光裡收成會${lightHarvestReward(target)}。` : activeLight.length ? `光落在空田上。拿祖母的手鏡，把光折到你的${cropName(target)}上。` : `光快落在空田上了。拿祖母的手鏡，先把光折到你的${cropName(target)}上。`, "把光折過來", `把光折到${cropName(target)}上`);
      }
      if (activeLight.length && litCrops.length) {
        const ripe = litCrops.find((tile) => ready.includes(tile));
        if (ripe) return field("harvest", ripe, `光正照著，點一下收成：${lightHarvestReward(ripe)}。`, "在光裡收成", `趁光收成${cropName(ripe)}`, { count: ready.length, sunlit: true });
        const thirsty = litCrops.find((tile) => dry.includes(tile));
        if (thirsty) return field("tend", thirsty, `光到了！趁光還在替${cropName(thirsty)}澆水，接住${sunplay.firstCaught ? "" : "第一點"}陽光。`, "在光裡澆水", `趁光澆${cropName(thirsty)}`, { sunlit: true });
      }
      /* 光快落在有作物的格子上：那一格留到光到了再收成或澆水，這幾秒先做別格的事。
         已經熟的也先留著——不然玩家會在光到之前把它收掉，光就落在空田上。 */
      const hold = previewLight.length ? litCrops.find((tile) => ready.includes(tile)) || litCrops.find((tile) => dry.includes(tile)) : null;
      if (hold) {
        /* 這幾秒叫玩家先做別格的事，也把「留著等光」的那一格帶出去：田上標籤與動作鈕才會跟著寫「先別收」，不會任務卡說去種、田上卻寫可收成。 */
        const held = { holdPlotIndex: hold.plotIndex };
        const queued = state.flags && state.flags.r79WaitHarvest && state.flags.r79WaitHarvest.plotIndex === hold.plotIndex ? state.flags.r79WaitHarvest : null;
        /* R78B：等光的那一格已經熟了，就只講「等光再收」這一件事。原本這裡叫玩家去種小麥，田上卻寫先別收，兩邊對不起來。 */
        const holdRipe = ready.includes(hold);
        /* R80B：教學後玩家選了「等光再收」就不再自動收。等待的幾秒把一件別格農事交給任務卡，
           但 holdPlotIndex 仍保留，快速收成不會誤收這一格。 */
        const canDoOther = !holdRipe || (queued && !queued.autoHarvest);
        if (canDoOther && empty.length && packs > 0) return field("plant", empty[0], `已選等光再收。光還沒到，先把剩下的 ${packs} 包小麥種子種下。`, "去種小麥", "先去田邊種小麥", held);
        const other = canDoOther ? dry.find((tile) => !lit.includes(tile.plotIndex)) : null;
        if (other) return field("tend", other, `光還沒到，先替另一格${cropName(other)}澆水。`, "去澆水", `先澆另一格${cropName(other)}`, held);
        const otherReady = ready.filter((tile) => !lit.includes(tile.plotIndex));
        if (otherReady.length) return field("harvest", otherReady[0], `光還沒到，先收別格：田裡有 ${otherReady.length} 格可以收成。`, "去收成", "先收另一格作物", { count: otherReady.length, holdPlotIndex: hold.plotIndex });
        /* R82C 第 3 項：早市（限時收購）是真的二選一，還沒選之前任務卡不先寫「等光再收」，兩邊結果交給田邊兩顆鈕。 */
        const r82cChoice = holdRipe && !queued ? r82cLightChoice(state, hold.plotIndex, t) : null;
        if (r82cChoice && r82cChoice.ok && r82cChoice.hasTradeoff) return field("catch_sun", hold, `${cropName(hold)}熟了，光也快到了：現在收趕得上${r82cChoice.kind === "market" ? "早市" : "限時收購"}，等光收得比較多。到田邊選一個。`, "到田邊選一個", "到田邊選收成方式", Object.assign({ lightChoice: r82cChoice.kind }, held));
        return field("catch_sun", hold, queued && !queued.autoHarvest
          ? `已選等光再收。光到了要自己收成：${lightHarvestReward(hold)}。`
          : `光快落在${cropName(hold)}上了。${holdRipe ? `等光再收：${lightHarvestReward(hold)}。` : "光到了再澆水，才接得住陽光。"}`,
        holdRipe ? (queued && !queued.autoHarvest ? "看看田裡" : "等光再收") : "看光落在哪", holdRipe ? `等光再收${cropName(hold)}` : `等光落下再澆${cropName(hold)}`, holdRipe ? held : null);
      }
      litGrowing = growing.find((tile) => lit.includes(tile.plotIndex)) || null; lightOn = activeLight.length > 0;
    }
    if (mealDone) { const questStep = questFarmStep(state, a, { ready, growing, dry, empty, plotOf, field }); if (questStep) return questStep; }
    if (ready.length) return field("harvest", ready[0], `田裡有 ${ready.length} 格可以收成，點一下收成。`, "去收成", `去田邊收${cropName(ready[0])}`, { count: ready.length });
    if (sunplay && sunplay.sunlight >= 2 && !sunplay.firstRipened && growing.length) {
      const target = growing.slice().sort((x, y) => plotOf(y).plantedAt - plotOf(x).plantedAt)[0];
      return field("ripen", target, `蓄光瓶有 ${sunplay.sunlight} 點陽光。用掉 2 點，讓還在長的${cropName(target)}立刻成熟。`, "用陽光催熟", `用陽光催熟${cropName(target)}`);
    }
    const harvestDone = claimed(a, "c1_first_harvest");
    /* R79 整合：第一個任務「找鎮長葛瑞交談」還沒做完時，老農班伯的開市任務還沒開，先帶玩家去找鎮長。
       原本小麥一湊滿 2 份就叫玩家交給老農班伯，任務卡與驚嘆號卻都指向鎮長，三處講不同的人。 */
    if (!harvestDone && wheat >= 2 && !claimed(a, "c1_homecoming")) return { action: "report", target: "mayor", questId: "c1_homecoming", tileId: null, text: "小麥收好了。先去找鎮長葛瑞打聲招呼，他會告訴你這 2 份要交給誰。", short: "去找鎮長葛瑞", actionLabel: "前往交談" };
    if (!harvestDone && wheat >= 2) return { action: "deliver", target: "elder", tileId: null, text: "2 份小麥已備齊，帶去交給老農班伯。", short: "把小麥交給老農班伯", actionLabel: "帶去交付" };
    if (harvestDone && !mealDone && bread > 0) return { action: "eat", target: "kitchen", tileId: "t10_10", text: "農家麥餅做好了，趁熱吃下第一餐。", short: "回農舍吃農家麥餅", actionLabel: "吃麥餅" };
    if (harvestDone && !mealDone && wheat >= 2) return { action: "cook", target: "kitchen", tileId: "t10_10", text: "食材已齊，前往農舍灶台做農家麥餅。", short: "回農舍做農家麥餅", actionLabel: "前往灶台" };
    if (mealDone) return { action: "explore", target: "fishing_dock", tileId: null, text: "第一餐吃完了，去河邊看看釣台。", short: "去河邊看看釣台", actionLabel: "去河邊看看" };
    if (dry.length) return field("tend", dry[0], `${cropName(dry[0])}正在長，先澆水，長得更快。`, "去澆水", `去田邊澆${cropName(dry[0])}`);
    const mealNeed = `回家的第一餐還差 ${Math.max(0, 2 - wheat)} 份小麥`;
    /* R82A：受光中的作物還在長時，先照顧眼前這株，不要一邊顯示「還沒成熟」一邊又叫玩家去種別格。 */
    if (litGrowing && lightOn) return field("wait", litGrowing, `光正照著${cropName(litGrowing)}，等這株成熟再收。`, "看看田裡", `等${cropName(litGrowing)}成熟再收`);
    if (empty.length && packs > 0 && cropped.length) return field("plant", empty[0], `把剩下的 ${packs} 包小麥種子也種下，幾格一起照顧。`, "去種小麥", "去田邊種小麥");
    if (!growing.length) return field("plant", empty[0] || null, harvestDone ? `${mealNeed}，先種下小麥。` : "先種下第一格小麥，接著跟著光走。", "去種小麥", "去田邊種小麥");
    if (litGrowing) return field("wait", litGrowing, `${lightOn ? "光正照著" : "光快落在"}${cropName(litGrowing)}${lightOn ? "" : "上了"}，熟了就趁光收成：${lightHarvestReward(litGrowing)}。`, "看看田裡", `等${cropName(litGrowing)}成熟再收`);
    return field("wait", growing[0], harvestDone ? `${mealNeed}，等田裡的${cropName(growing[0])}成熟。` : `${cropName(growing[0])}正在長，成熟了就來收。`, "看看田裡", `等${cropName(growing[0])}成熟再收`);
  }

  /* R82A：所有玩家看得到的「下一步」都從這裡取。nextFarmStep 保留純農務排序；
     nextGuidance 再把陽光餐籃與藍布舊麥種的故事階段放到同一條時間線上。 */
  function guidanceGame() {
    if (root && root.getCropProgress && root.activePlotCount) return root;
    if (typeof module !== "undefined" && module.exports) return require("./game.js");
    return null;
  }
  function guidanceFieldStep(state, now, cropId, need, sourceText) {
    const G = guidanceGame(); if (!G) return null;
    const active = G.activePlotCount(state), crop = C.CROPS[cropId] || { name: "作物" };
    const tiles = (state.map && state.map.tiles || []).filter((tile) => tile.plotIndex != null && tile.plotIndex < active && state.plots[tile.plotIndex]);
    const mine = tiles.filter((tile) => state.plots[tile.plotIndex].cropId === cropId);
    const ready = mine.find((tile) => G.getCropProgress(state, state.plots[tile.plotIndex], now).ready);
    const dry = mine.find((tile) => { const p = G.getCropProgress(state, state.plots[tile.plotIndex], now); return !p.ready && !p.wet; });
    const growing = mine.find((tile) => !G.getCropProgress(state, state.plots[tile.plotIndex], now).ready);
    const empty = tiles.find((tile) => !state.plots[tile.plotIndex].cropId);
    const prefix = sourceText + "還差 " + Math.max(1, need) + " 份" + crop.name + "，";
    const field = (action, tile, text, short, actionLabel) => ({ guidanceScope: "r81_story", action, kind: action, target: "field", tileId: tile ? tile.id : null, plotIndex: tile ? tile.plotIndex : null, cropId, text, short, actionLabel });
    if (ready) return field("harvest", ready, prefix + "田裡的" + crop.name + "熟了，先去收成。", "去田邊收" + crop.name, "去收" + crop.name);
    if (dry) return field("tend", dry, prefix + "田裡的" + crop.name + "正在長，先澆水。", "去田邊澆" + crop.name, "去照顧" + crop.name);
    if (growing) return field("wait", growing, prefix + "田裡已經有" + crop.name + "，等成熟再收。", "等" + crop.name + "成熟再收", "看看田裡");
    if (empty) return field("plant", empty, prefix + "先種一株" + crop.name + "。", "去田邊種" + crop.name, "去種" + crop.name);
    return { guidanceScope: "r81_story", action: "wait", kind: "wait", target: "field", tileId: null, text: prefix + "先收成或清出一格田。", short: "先清出一格田地", actionLabel: "看看田裡" };
  }
  function heirloomGuidance(state, now) {
    if (!Heirloom || !state) return null;
    const h = Heirloom.status(state); if (!h.started || h.delivered) return null;
    const G = guidanceGame(); if (!G) return null;
    const sun = G.sunpatchStatus(state, now), active = G.activePlotCount(state);
    const plots = (state.map && state.map.tiles || []).filter((tile) => tile.plotIndex != null && tile.plotIndex < active && state.plots[tile.plotIndex]);
    const wheat = plots.filter((tile) => state.plots[tile.plotIndex].cropId === "wheat");
    const ripe = wheat.find((tile) => G.getCropProgress(state, state.plots[tile.plotIndex], now).ready);
    const step = (kind, title, detail, short, label, target, extra) => Object.assign({ guidanceScope: "heirloom", action: kind === "deliver" ? "deliver_heirloom" : kind, kind, title, text: detail, short, detail, actionLabel: label, label, target: target || null, tileId: target ? target.id : null, plotIndex: target ? target.plotIndex : null }, extra || {});
    if (h.ready) return step("deliver", "第一份餐籃，送給誰？", "替鎮長葛瑞留兩份小麥。送到門邊，或邀他一起坐下。", "把餐籃送給鎮長葛瑞", "裝好餐籃", null);
    const base = nextFarmStep(state, now), mirror = base && base.action === "refract" ? wheat.find((tile) => tile.id === base.tileId) : null;
    if (mirror) return step("refract", "拿祖母的手鏡折光", base.text, base.short, base.actionLabel, mirror);
    const pending = sun.previewPlots || [];
    if (ripe && h.sunWheat < 2 && pending.includes(ripe.plotIndex) && state.plots[ripe.plotIndex].sunGrown !== true) return step("wait", "光快落在麥穗上了", "先別收。等光落下再收成，這一株才算陽光小麥。", "等光落下再收小麥", "看看這株小麥", ripe);
    if (ripe) return step("harvest", "把這束陽光收進餐籃", "小麥成熟了。收成後，留下兩份給鎮長葛瑞。", "去田邊收小麥", "走近收成", ripe);
    const lit = plots.find((tile) => sun.plots.includes(tile.plotIndex) && (!state.plots[tile.plotIndex].cropId || (state.plots[tile.plotIndex].cropId === "wheat" && !G.getCropProgress(state, state.plots[tile.plotIndex], now).wet)));
    if (lit && h.sunWheat < 2) return step(state.plots[lit.plotIndex].cropId ? "water" : "plant", "光落在這裡", `光斑還有 ${Math.ceil(sun.remainingMs / 1000)} 秒。在光裡${state.plots[lit.plotIndex].cropId ? "澆水" : "種小麥"}，這株的收穫會記進餐籃。`, state.plots[lit.plotIndex].cropId ? "趁光去田邊澆小麥" : "趁光去田邊種小麥", state.plots[lit.plotIndex].cropId ? "去光裡澆水" : "在光裡播種", lit);
    const growing = wheat[0];
    if (growing) {
      const p = state.plots[growing.plotIndex], progress = G.getCropProgress(state, p, now);
      if (p.sunGrown !== true && pending.includes(growing.plotIndex)) return step("wait", "光快落在這株小麥上了", progress.wet ? "水已經澆了。等光落下、小麥熟了，趁光收成。" : "先別澆水。等光落下再澆，才接得住陽光。", progress.wet ? "等光落下再收小麥" : "等光落下再澆小麥", "看看這株小麥", growing);
      return step("wait", p.sunGrown === true ? "陽光已經留在麥穗裡" : "等第一道光落下", p.sunGrown === true ? `再等約 ${Math.ceil(progress.remainingMs / 1000)} 秒成熟。光散了，這株仍記得你在光裡的照料。` : "光落下前，田上會先亮起預告圈。看見光落下，再去澆水；錯過會再來。", p.sunGrown === true ? "等小麥成熟再收" : "等光落下再澆小麥", "看看這株小麥", growing);
    }
    const empty = plots.find((tile) => !state.plots[tile.plotIndex].cropId);
    return step("plant", "先種一株，等光來", h.sunWheat >= 2 ? "陽光收成已記下。倉庫還要留兩份小麥，才裝得成餐籃。" : "種一株小麥，先別澆水；看見光落下，再去澆水。餐籃不用等換日。", "去田邊種小麥", "種第一株小麥", empty);
  }
  function storyGuidance(state, now) {
    const S = root && root.StoryR76;
    if (!S || typeof S.r81Stage !== "function") return null;
    const stage = S.r81Stage(state); if (!stage || stage === "done") return null;
    if (stage === "conflict") return { guidanceScope: "r81_story", action: "story_choice", kind: "story_choice", target: "r81c_story", tileId: null, text: "鎮長葛瑞想封存舊麥種，老農班伯想種回田裡。聽完兩人的話，再決定交給誰。", short: "到藍布老麥田看看", actionLabel: "去做決定" };
    const info = S.r81Order(state, now);
    if (stage === "order" && info) {
      if (info.enough) return { guidanceScope: "r81_story", action: "story_order", kind: "story_order", target: info.side, tileId: null, text: `具名訂單「${info.name}」的 ${info.need} 份${(C.CROPS[info.itemId] || {}).name || "作物"}已備齊，帶去交付。`, short: info.side === "elder" ? "把訂單交給老農班伯" : "把訂單交給鎮長葛瑞", actionLabel: "交付具名訂單" };
      return guidanceFieldStep(state, now, info.itemId, info.need - info.have, `具名訂單「${info.name}」`);
    }
    if (stage === "scene") return { guidanceScope: "r81_story", action: "story_scene", kind: "story_scene", target: "r81c_story", tileId: null, text: "具名訂單已交付。回到舊麥種旁，聽完這段故事。", short: "回藍布老麥田聽故事", actionLabel: "繼續舊麥種故事" };
    return null;
  }
  function nextGuidance(state, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const next = storyGuidance(state, t) || heirloomGuidance(state, t) || nextFarmStep(state, t);
    if (!next || typeof next.text !== "string" || typeof next.short !== "string") return next;
    return next;
  }

  function earlyGoals(state, now) {
    if (!ensure(state, now).ok) return { available: false, goals: [] };
    const a = state.adventure;
    const available = claimed(a, "c1_homecoming") && !claimed(a, "c1_first_meal");
    const harvest = quests(state, now).find((q) => q.id === "c1_first_harvest");
    const harvestDone = claimed(a, "c1_first_harvest");
    const wheatHave = ((state.storage || {}).items || {}).wheat || 0;
    const next = nextFarmStep(state, now);
    const allGoals = [
      { id: "harvest", type: "farming", name: `交給老農班伯 2 份小麥（已收 ${harvestDone ? 2 : Math.min(2, wheatHave)}/2）`, detail: harvestDone ? "已交付，市集已開放" : next.text, rewardText: "16 金、6 經驗與修繕建材", complete: harvestDone, canClaim: !!(harvest && harvest.canClaim), target: next.target, tileId: next.tileId, actionLabel: harvestDone ? "" : next.actionLabel },
      { id: "dock", type: "repair", name: "修好河畔釣台", detail: ((state.materials || {}).wood || 0) >= 4 && ((state.materials || {}).stone || 0) >= 2 && !restored(a, "fishing_dock") ? "材料齊了，可以修" : `木料 ${(state.materials || {}).wood || 0}/4・石材 ${(state.materials || {}).stone || 0}/2`, rewardText: "開放釣魚", complete: restored(a, "fishing_dock"), target: "fishing_dock", actionLabel: ((state.materials || {}).wood || 0) >= 4 && ((state.materials || {}).stone || 0) >= 2 ? "去修" : "" },
      { id: "market", type: "social", name: "跟蘿拉打招呼", detail: "蘿拉在農場東側的市集攤位", rewardText: "5 金", complete: a.earlyGoals.marketPreview === true, target: "merchant" },
      { id: "forage", type: "explore", name: "去溪畔採集 1 次", detail: "到東側溪畔找找野外採集物", rewardText: "種子 1 包", complete: qty(a.counts.forage) >= 1, target: "forage" },
      { id: "cook", type: "cooking", name: "做 1 道料理", detail: "到農舍灶台準備一道料理", rewardText: "料理食材 1 份", complete: qty(a.counts.cook) >= 1, target: "kitchen", tileId: "t10_10" },
    ];
    const goals = a.r61.daily.selected.map((id) => allGoals.find((goal) => goal.id === id)).filter(Boolean);
    const meal = quests(state, now).find((q) => q.id === "c1_first_meal");
    const mealHave = (a.meals || {}).rustic_bread || 0;
    const nextStep = !harvestDone ? null : {
      id: "meal", label: "主線下一步", name: "回家的第一餐",
      detail: next.text, complete: claimed(a, "c1_first_meal"), canClaim: !!(meal && meal.canClaim), target: next.target, tileId: next.tileId, action: next.action, actionLabel: next.actionLabel,
    };
    return { available, complete: goals.every((goal) => goal.complete), goals, nextStep, candidates: allGoals.map((goal) => Object.assign({}, goal, { selected: a.r61.daily.selected.includes(goal.id), locked: goal.id === "harvest" && !harvestDone })), chosen: a.r61.daily.chosen, canSwap: a.r61.daily.chosen && !a.r61.daily.swapped, swapped: a.r61.daily.swapped };
  }
  function chooseDailyGoals(state, ids, now) {
    if (!ensure(state, now).ok) return fail("bad_state", "每日事項還沒準備好。");
    if (state.adventure.r61.daily.chosen) return fail("already_chosen", "今天已經選好三件事了；還能換一件。");
    const picked = [...new Set(Array.isArray(ids) ? ids : [])];
    if (picked.length !== 3 || picked.some((id) => !R66_DAILY_CANDIDATES.some((row) => row.id === id))) return fail("pick_three", "請從五件候選中挑三件。");
    if (!claimed(state.adventure, "c1_first_harvest") && !picked.includes("harvest")) return fail("story_locked", "第一天要保留交給老農班伯的主線事項。");
    state.adventure.r61.daily.selected = picked; state.adventure.r61.daily.chosen = true;
    return ok("今天就做這三件事。", { selected: picked.slice(), candidates: R66_DAILY_CANDIDATES.map(copy) });
  }
  function swapDailyGoal(state, removeId, addId, now) {
    if (!ensure(state, now).ok) return fail("bad_state", "每日事項還沒準備好。");
    const daily = state.adventure.r61.daily;
    if (!daily.chosen) return fail("choose_first", "先從五件候選中挑三件。");
    if (daily.swapped) return fail("already_swapped", "今天已經換過一件了。");
    if (removeId === "harvest" && !claimed(state.adventure, "c1_first_harvest")) return fail("story_locked", "交給老農班伯是第一天主線，不能換掉。");
    if (!daily.selected.includes(removeId) || daily.selected.includes(addId) || !R66_DAILY_CANDIDATES.some((row) => row.id === addId)) return fail("bad_swap", "請用未選的一件換掉目前事項。");
    daily.selected = daily.selected.map((id) => id === removeId ? addId : id); daily.swapped = true;
    return ok("今天的一件事已換好。", { selected: daily.selected.slice(), swapped: true });
  }
  function claimDailyGoals(state, now) {
    const view = earlyGoals(state, now); if (!view.available) return fail("locked", "完成教學後才會有今日三件事。");
    const daily = state.adventure.r61.daily; if (daily.claimed) return fail("already_claimed", "今天的三件事已領過獎勵了。");
    if (!view.goals.every((goal) => goal.complete)) return fail("not_ready", "先完成今天選的三件事。");
    const rewardInfo = { coins: 10, materials: {}, seedPacks: {}, favor: {}, items: {} };
    for (const goal of view.goals) {
      if (goal.type === "farming") rewardInfo.coins += 5;
      else if (goal.type === "repair") { state.materials.wood = credit(state.materials.wood, 1); rewardInfo.materials.wood = 1; }
      else if (goal.type === "social") { state.adventure.r58.favor.merchant = Math.min(999, qty(state.adventure.r58.favor.merchant) + 1); rewardInfo.favor.merchant = 1; }
      else if (goal.type === "explore") { state.adventure.r58.r59.seedPacks.carrot = Math.min(99, qty(state.adventure.r58.r59.seedPacks.carrot) + 1); rewardInfo.seedPacks.carrot = 1; }
      else if (goal.type === "cooking") { state.storage.items.wheat = qty(state.storage.items.wheat) + 1; rewardInfo.items.wheat = 1; }
    }
    state.coins = credit(state.coins, rewardInfo.coins); daily.claimed = true;
    return ok(`今日三件事完成，另得全完成小獎 10 金。`, { reward: rewardInfo, selected: daily.selected.slice() });
  }
  function quests(state, now) {
    if (!ensure(state, now).ok) return [];
    const a = state.adventure;
    return QUESTS.map((q, index) => {
      const objectives = q.goals.map((g) => ({ type: g.type, id: g.id, name: g.name, current: goalCount(a, g), required: g.count, complete: goalCount(a, g) >= g.count, consume: false }));
      const route = questRouteStatus(state, q, a);
      const needs = route.primary;
      const rec = a.quests[q.id];
      return Object.assign(copy(q), { chapterName: CHAPTERS[q.chapter - 1].name, previousId: index ? QUESTS[index - 1].id : null, nextId: QUESTS[index + 1] ? QUESTS[index + 1].id : null,
        status: a.quests[q.id].status, readyAt: a.quests[q.id].readyAt, claimedAt: a.quests[q.id].claimedAt, objectives, requirements: needs,
        altRequirements: route.alt, hasAltRoute: route.alt.length > 0, claimRoute: route.claimRoute, chosenRoute: rec.claimRoute, routeReceipt: copy(rec.routeReceipt || []), routeConsequence: rec.routeConsequence || "",
        canClaim: !claimed(a, q.id) && unlockedQuest(a, index) && route.canClaim });
    });
  }
  function consume(state, rows) {
    for (const r of rows) {
      if (r.consume === false) continue;
      if (r.source === "driedAny") {
        let left = r.required;
        for (const id of Object.keys(Sunplay && Sunplay.DRIED ? Sunplay.DRIED : {})) { const take = Math.min(left, qty(state.storage.items[id])); if (take > 0) { state.storage.items[id] -= take; if (!state.storage.items[id]) delete state.storage.items[id]; left -= take; } }
      } else if (r.source === "gradedMeal") {
        let left = r.required;
        const grades = state.adventure.r75b && state.adventure.r75b.grades;
        for (const recipe of RECIPES) {
          if (!left) break;
          const bucket = grades && grades[recipe.id]; if (!bucket) continue;
          /* 只收餐籃裡真的有的份數，等級紀錄多出來的不算，也不會把餐籃扣成負數。 */
          const takeTasty = Math.min(left, qty(bucket.tasty), qty(state.adventure.meals[recipe.id])); if (takeTasty > 0) { bucket.tasty -= takeTasty; state.adventure.meals[recipe.id] -= takeTasty; left -= takeTasty; }
          const takePerfect = Math.min(left, qty(bucket.perfect), qty(state.adventure.meals[recipe.id])); if (takePerfect > 0) { bucket.perfect -= takePerfect; state.adventure.meals[recipe.id] -= takePerfect; left -= takePerfect; }
        }
      } else if (r.source === "catch") {
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
    const beforeLevel = state.level || 1;
    if (claimed(a, id)) return fail("already_claimed", "這份獎勵已經領過了。");
    if (!unlockedQuest(a, index)) return fail("locked", "先完成前一個任務。");
    const route = questRouteStatus(state, q, a);
    if (!route.canClaim) {
      if (!route.goalsDone && !route.altReady) return fail("not_ready", "任務目標還沒完成。");
      return fail("missing_resources", "要交付的物品還沒備齊。", { requirements: route.primary.concat(route.alt) });
    }
    const rows = route.claimRoute === "alt" ? route.alt : route.primary;
    const actualReward = q.routeRewards && q.routeRewards[route.claimRoute] ? q.routeRewards[route.claimRoute] : q.reward;
    const routeConsequence = q.routeConsequences && q.routeConsequences[route.claimRoute] ? q.routeConsequences[route.claimRoute] : "";
    a.quests[id].routeReceipt = rows.map((row) => ({ name: row.name, required: row.required, consume: row.consume !== false }));
    a.quests[id].routeConsequence = routeConsequence;
    consume(state, rows);
    a.quests[id].claimRoute = route.claimRoute;
    a.claimed[id] = true;
    a.quests[id].status = "claimed";
    a.quests[id].rewardGranted = true;
    a.quests[id].claimedAt = at(state, now);
    grant(state, actualReward);
    if (q.chapter === 4) a.r61.world.c4Routes[id] = route.claimRoute;
    if (id === "c4_tasting_stall") a.r61.world.tastingMark = true;
    if (id === "c4_notice_bench") a.r61.world.noticeBench = true;
    if (id === "c5_festival_tables") a.r61.world.festivalTables = true;
    if (id === "c5_festival_dinner") {
      a.r61.festival.unlocked = true;
      a.r61.festival.startsAt = at(state, now);
      a.r61.festival.nextAt = 0;
    }
    sync(state, at(state, now));
    const milestone = (type, data) => typeof root.milestoneCard === "function" ? root.milestoneCard(type, data) :
      type === "market_open" ? { kind: "milestone", type, title: "市集開放", earned: "16 金與修繕建材", unlocked: "市集訂單與出貨看板", next: "照任務列去灶台做晚餐；訂單看板之後隨時可以接單。" } :
      type === "chapter_one" ? { kind: "milestone", type, title: "第一章完成", earned: "農場重新有了第一批收成", unlocked: "河畔復興與下一章故事", next: "前往河邊，看看等待修復的設施。" } :
      { kind: "milestone", type, title: `升到 Lv ${data.level}`, earned: `農場等級提升到 ${data.level} 級`, unlocked: "新的作物與農場能力", next: data.actionLabel || "繼續目前任務" };
    const milestones = [];
    if (id === "c1_first_harvest") milestones.push(milestone("market_open"));
    if (id === "c1_first_meal") milestones.push(milestone("chapter_one"));
    if ((state.level || 1) > beforeLevel) milestones.push(milestone("level_up", { level: state.level, state, now, actionLabel: guide(state, now).actionLabel }));
    /* R77C 第 12 項：晚宴對白提到擺攤賣得最好的那一樣。 */
    const bestSeller = state.adventure.r72b && state.adventure.r72b.lastBestSeller;
    const dinnerLine = id === "c5_festival_dinner" && bestSeller && bestSeller.name ? "晚宴上，蘿拉還提起你攤上賣得最好的" + bestSeller.name + "，大家都說那一味最搶手。" : "";
    return ok("「" + q.name + "」完成了。" + (routeConsequence ? routeConsequence : ""), { id, reward: copy(actualReward), claimRoute: route.claimRoute, routeConsequence, dinnerLine, nextId: QUESTS[index + 1] ? QUESTS[index + 1].id : null,
      milestones,
      settlement: { kind: "quest", coins: actualReward.coins || 0, xp: actualReward.xp || 0,
        next: id === "c1_first_harvest" ? nextFarmStep(state, now).text : (QUESTS[index + 1] ? "繼續進行「" + QUESTS[index + 1].name + "」。" : "繼續經營陽光農場。") } });
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
  function recipeUnlocked(a, r) {
    if (r.unlockFestivalRecipe) return !!(a.r61 && a.r61.festival && a.r61.festival.festivalRecipe);
    if (r.unlockPersonalNpc) return !!(a.r58 && a.r58.r59 && a.r58.r59.permanent[r.unlockPersonalNpc]);
    return r.unlockQuest ? claimed(a, r.unlockQuest) : restored(a, r.unlockProject);
  }
  function recipeRequirements(state, ingredients) {
    return Object.entries(ingredients || {}).flatMap(([id, required]) => requirements(state, { [id]: required }, own(C.MATERIALS, id) ? "materials" : "inventory"));
  }
  function recipes(state) {
    if (!ensure(state).ok) return [];
    return RECIPES.map((r) => {
      const unlocked = recipeUnlocked(state.adventure, r); const rows = recipeRequirements(state, r.ingredients);
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
    const rows = recipeRequirements(state, r.ingredients);
    if (!rows.every((need) => need.complete)) return fail("missing_resources", "料理食材還沒備齊。", { requirements: rows });
    const firstCook = Object.values(state.adventure.meals || {}).every((qty) => !qty);
    consume(state, rows);
    state.adventure.meals[id]++;
    record(state, { type: "cook", recipeId: id }, now);
    return ok(r.name + "做好了。" + (firstCook ? "這是回家後做的第一份料理。" : "已放進餐籃。"), { meal: { id, name: r.name, qty: 1 }, quantity: state.adventure.meals[id], consumed: copy(r.ingredients), storyAdvance: null, firstCook });
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
    if (!claimed(state.adventure, "c1_first_harvest")) return fail("locked", "先跟老農班伯學做農家麥餅。");
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
      elder:'老農班伯捧起茶杯：「熱味麥餅，還記得我的熱味餐籃！先吃，魚竿晚點再修。」',
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
  function guide(state, now) {
    const view = summary(state, now);
    if (!view.ok) return view;
    const q = view.currentQuest;
    if (!q) return ok("冒險主線已完成。", { questId: null, chapter: 3, chapterProgress: { claimed: 3, total: 3 }, step: null, stepText: "繼續經營農場", actionLabel: "繼續經營" });
    const step = q.canClaim ? null : q.objectives.find((row) => !row.complete) || q.requirements.find((row) => !row.complete) || (q.altRequirements || []).find((row) => !row.complete) || null;
    const npc = (C.NPCS || {})[q.npcId] || { name: "鎮民" };
    const chapterProgress = view.chapters.find((row) => row.number === q.chapter) || { claimed: 0, total: 3 };
    const choice = firstChoiceStatus(state);
    if (q.id === "c1_first_meal" && choice.selected === "order" && choice.tracked === "order" && !choice.orderCompleted) {
      const have = Math.max(0, (state.storage && state.storage.items && state.storage.items.wheat) || 0);
      return ok("先完成蘿拉的小麥單。", {
        questId: q.id, chapter: q.chapter,
        chapterProgress: { claimed: chapterProgress.claimed, total: chapterProgress.total },
        route: "order", step: { type: "order", id: "beginner_wheat_4", name: "交付蘿拉的小麥單", current: Math.min(4, have), required: 4, complete: false },
        stepText: `備妥小麥 ${Math.min(4, have)}/4`, actionLabel: "查看蘿拉的訂單",
        displayTitle: "蘿拉的 4 份小麥單", displayDescription: "交出 4 份小麥先賺 28 金；之後要再種一輪小麥，才能做農家麥餅。",
      });
    }
    return ok(step ? "前往目前目標。" : "回報目前任務。", {
      questId: q.id,
      chapter: q.chapter,
      chapterProgress: { claimed: chapterProgress.claimed, total: chapterProgress.total },
      step: step ? copy(step) : null,
      stepText: step ? `${step.name} ${Math.min(step.current, step.required)}/${step.required}` : `找${npc.name}回報`,
      actionLabel: taskActionLabel(q, step, npc),
    });
  }
  function firstChoiceStatus(state) {
    const a = state && state.adventure;
    const available = !!(a && a.claimed && a.claimed.c1_first_harvest) && !(a.claimed && a.claimed.c1_first_meal);
    const saved = a && object(a.firstChoice) ? a.firstChoice : {};
    const selected = saved.selected === "meal" || saved.selected === "order" ? saved.selected : null;
    const tracked = saved.tracked === "meal" || saved.tracked === "order" ? saved.tracked : selected;
    return { available, selected, tracked, orderCompleted: saved.orderCompleted === true };
  }
  function chooseFirstPath(state, choice) {
    if (choice !== "meal" && choice !== "order") return fail("bad_choice", "請選一條想先追蹤的路線。");
    const status = firstChoiceStatus(state);
    if (!status.available) return fail("locked", "市集開放後才能選擇第一條路線。");
    if (!object(state.adventure.firstChoice)) state.adventure.firstChoice = {};
    state.adventure.firstChoice.selected = choice;
    state.adventure.firstChoice.tracked = choice;
    state.adventure.firstChoice.orderCompleted = state.adventure.firstChoice.orderCompleted === true;
    return ok(choice === "meal" ? "已先追蹤農家麥餅主線。" : "已先追蹤蘿拉的小麥單。", firstChoiceStatus(state));
  }
  function trackFirstPath(state, choice) {
    const status = firstChoiceStatus(state);
    if (!status.available || !status.selected) return fail("locked", "先選擇第一條路線。");
    if (choice !== "meal" && choice !== "order") return fail("bad_choice", "找不到這條路線。");
    if (choice === "order" && status.orderCompleted) return fail("complete", "蘿拉的小麥單已完成。");
    state.adventure.firstChoice.tracked = choice;
    return ok(choice === "meal" ? "任務列已切回農家麥餅。" : "任務列已切到蘿拉的小麥單。", firstChoiceStatus(state));
  }
  function taskActionLabel(q, step, npc) {
    if (!step || step.type === "talk") return "前往交談";
    if (step.type === "harvest") return step.id === "wheat" ? "收成小麥" : "收成作物";
    if (step.type === "water") return "替作物澆水";
    if (step.type === "plant") return "種下作物";
    if (step.type === "cook") return "前往料理";
    if (step.type === "restore") return "前往修復";
    if (step.type === "fish") return "前往釣魚";
    if (step.type === "forage") return "前往採集";
    if (step.type === "care") return "照顧動物";
    return `前往${npc && npc.name ? npc.name : "目標"}`;
  }
  function storyPanelAvailability(state) {
    const marketUnlocked = !!(state && state.adventure && state.adventure.claimed && state.adventure.claimed.c1_first_harvest);
    return { marketUnlocked, showNeighborBasket: marketUnlocked, showRiverCommissions: marketUnlocked };
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
    { id: "elder_supper", name: "老農班伯的灶邊晚餐", npcId: "elder", wantsCatch: 1, wantsMeals: { rustic_bread: 1 }, reward: reward(14, 3, { wood: 2 }) },
    { id: "child_tea", name: "圖圖的野餐茶", npcId: "child", wantsMeals: { mint_tea: 1 }, reward: reward(12, 3) },
  ];
  /* R75B：開場選擇讓老農班伯與蘿拉的河畔委託金幣多一成（先賣一小袋、先掛農場牌）。 */
  function r75bCommissionBonus(state, c) {
    const choices = state.adventure && state.adventure.r58 && state.adventure.r58.r59 && state.adventure.r58.r59.r60 && state.adventure.r58.r59.r60.storyChoices;
    const elder = choices && choices.elder_wheat && choices.elder_wheat.choiceId === "sell";
    const merchant = choices && choices.merchant_hello && choices.merchant_hello.choiceId === "sign";
    if (c.npcId === "elder" && elder) return r77Upgraded(state, "elder") ? { rate: 0.2, text: "你做完了「第一筆生意」，老農班伯的委託金幣從多一成變成多兩成。" } : { rate: 0.1, text: "因為你先賣了一小袋新麥，老農班伯的委託金幣多一成。" };
    if (c.npcId === "merchant" && merchant) return r77Upgraded(state, "merchant") ? { rate: 0.2, text: "你做完了「招牌」，蘿拉的委託金幣從多一成變成多兩成。" } : { rate: 0.1, text: "因為你先掛起農場牌，蘿拉的委託金幣多一成。" };
    return { rate: 0, text: "" };
  }
  /* R77B：後續委託三步做完，開場選擇的長期加成升一級（資料在 state.adventure.r77，由 choices-r77.js 維護）。 */
  function r77Upgraded(state, npcId) {
    const a = state && state.adventure;
    const q = a && object(a.r77) && object(a.r77.quests) ? a.r77.quests[npcId] : null;
    const storyId = { mayor: "mayor_welcome", elder: "elder_wheat", merchant: "merchant_hello" }[npcId];
    const saved = a && a.r58 && a.r58.r59 && a.r58.r59.r60 && a.r58.r59.r60.storyChoices ? a.r58.r59.r60.storyChoices[storyId] : null;
    return !!(object(q) && q.upgraded === true && q.step >= 3 && saved && saved.choiceId === q.choiceId);
  }
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
      const bonus = r75bCommissionBonus(state, c);
      const reward = bonus.rate ? Object.assign(copy(c.reward), { coins: Math.round((c.reward.coins || 0) * (1 + bonus.rate)) }) : copy(c.reward);
      return Object.assign(copy(c), { reward, choiceBonusRate: bonus.rate, choiceBonusText: bonus.text, unlocked, completed: done, requirements: rows, canClaim: unlocked && !done && rows.every((r) => r.complete), refreshAt: (a.commissions.cycle + 1) * 300000 });
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
  // ----- R58: farm events, personal quests, meal buffs -----
  function r58EventView(state, now) {
    const a = state.adventure;
    if (!a.r58.activeEvent) return null;
    const def = R58_EVENTS.find((e) => e.id === a.r58.activeEvent.id);
    if (!def) return null;
    const out = Object.assign(copy(def), { startedAt: a.r58.activeEvent.startedAt, expiresAt: a.r58.activeEvent.expiresAt, remainingMs: Math.max(0, a.r58.activeEvent.expiresAt - at(state, now)) });
    const flags = a.r58.r59.eventFlags;
    if (out.id === "traveling_merchant" && flags.merchantDeclined) out.dialogue = "旅行商人認出你，笑說：「上次沒買也不要緊，今天還是讓你慢慢挑。」";
    if (out.id === "crow_steal" && flags.crowFed) out.dialogue = "那隻烏鴉又來了，先把一顆亮亮的小石子放在田邊，才抬頭等你。";
    const recall = randomEventRecall(state, now);
    if (recall) out.dialogue = `${recall} ${out.dialogue}`;
    out.options = (out.options || []).map((option) => Object.assign(option, { available: eventChoiceAvailable(state, out.id, option.id), unavailableReason: eventChoiceReason(state, out.id, option.id) }));
    return out;
  }
  function eventChoiceAvailable(state, eventId, choiceId) {
    if (eventId === "traveling_merchant" && choiceId === "buy") return state.coins >= 12;
    if (eventId === "traveling_merchant" && choiceId === "trade") return ((state.storage.items || {}).wheat || 0) >= 2;
    if (eventId === "crow_steal" && choiceId === "feed") return ((state.storage.items || {}).wheat || 0) >= 1;
    return true;
  }
  function eventChoiceReason(state, eventId, choiceId) {
    if (eventChoiceAvailable(state, eventId, choiceId)) return "";
    if (eventId === "traveling_merchant" && choiceId === "buy") return `金幣不足：有 ${Math.max(0, state.coins || 0)}／需 12`;
    const need = eventId === "traveling_merchant" && choiceId === "trade" ? 2 : 1;
    return `小麥不足：有 ${Math.max(0, ((state.storage || {}).items || {}).wheat || 0)}／需 ${need}`;
  }
  function randomEvents(state, now) {
    if (!ensure(state, now).ok) return { active: null, nextEventAt: 0, history: [] };
    settleExpiredWorldEvent(state, now);
    return { active: r58EventView(state, now), nextEventAt: state.adventure.r58.nextEventAt, history: copy(state.adventure.r58.history) };
  }
  function worldEventObject(state, now) {
    const view = randomEvents(state, now).active;
    if (!view || !["crow_steal", "lost_chick"].includes(view.id)) return null;
    return Object.assign({}, view, { tileId: view.id === "crow_steal" ? ((state.map.tiles || []).find((tile) => tile.plotIndex === 0) || {}).id : "t8_7", label: view.id === "crow_steal" ? "田邊的烏鴉" : "走失的小雞" });
  }
  function settleExpiredWorldEvent(state, now) {
    const a = state.adventure && state.adventure.r58, t = at(state, now);
    if (!a || !a.activeEvent || a.activeEvent.expiresAt > t) return null;
    const def = R58_EVENTS.find((row) => row.id === a.activeEvent.id); if (!def) { a.activeEvent = null; return null; }
    let text = `${def.name}：你沒有及時處理，事情只好用比較不理想的方式收場。`;
    if (def.id === "crow_steal") { const have = qty(state.storage && state.storage.items && state.storage.items.wheat); if (have) { state.storage.items.wheat = have - 1; if (!state.storage.items.wheat) delete state.storage.items.wheat; text = "烏鴉來偷吃：你沒及時趕到，牠叼走了 1 份小麥。"; } }
    if (def.id === "lost_chick") text = "走失的小雞：等太久後，小雞自己鑽回雞舍，沒有留下謝禮。";
    a.r59.journal.push({ eventId: def.id, choiceId: "timeout", at: t, text }); a.r59.journal = a.r59.journal.slice(-40);
    a.history.push({ id: def.id, at: t, result: "expired", choiceId: "timeout" }); a.history = a.history.slice(-24); a.activeEvent = null;
    if (a.nextEventAt <= t) a.nextEventAt = t + R58_EVENT_MIN_MS;
    return { id: def.id, choiceId: "timeout", journalText: text };
  }
  function maybeTriggerRandomEvent(state, now, rng) {
    const init = ensure(state, now); if (!init.ok) return init;
    settleExpiredWorldEvent(state, now);
    const a = state.adventure; const t = at(state, now);
    if (a.r58.activeEvent) return ok("農場小事正在等你處理。", { triggered: false, event: r58EventView(state, now) });
    if (t < a.r58.nextEventAt) return ok("農場暫時很平靜。", { triggered: false, event: null, nextEventAt: a.r58.nextEventAt });
    let pick, gapRoll;
    try { const random = rng === undefined ? Math.random : rng; pick = random(); gapRoll = random(); }
    catch (_) { return fail("bad_rng", "這次小事沒有出現。"); }
    if (!Number.isFinite(pick) || !Number.isFinite(gapRoll)) return fail("bad_rng", "這次小事沒有出現。");
    const unit = (n) => Math.max(0, Math.min(1 - Number.EPSILON, n));
    const def = R58_EVENTS[Math.floor(unit(pick) * R58_EVENTS.length)];
    a.r58.activeEvent = { id: def.id, startedAt: t, expiresAt: t + def.expiresMs };
    if (def.id === "crow_steal" && a.r58.r59.eventFlags.crowFed && !a.r58.r59.eventFlags.crowGifted) {
      if (!object(state.materials)) state.materials = {};
      state.materials.stone = credit(state.materials.stone, 1);
      a.r58.r59.eventFlags.crowGifted = true;
    }
    a.r58.lastEventAt = t;
    a.r58.nextEventAt = t + R58_EVENT_MIN_MS + Math.floor(unit(gapRoll) * (R58_EVENT_MAX_MS - R58_EVENT_MIN_MS));
    return ok(def.dialogue, { triggered: true, event: r58EventView(state, now) });
  }
  function resolveRandomEvent(state, choiceId, now) {
    if (typeof choiceId === "number" || choiceId === undefined) { now = choiceId === undefined ? now : choiceId; choiceId = null; }
    const init = ensure(state, now); if (!init.ok) return init;
    const a = state.adventure; const t = at(state, now);
    const view = r58EventView(state, now);
    if (!view) return fail("no_event", "現在沒有等你處理的農場小事。");
    const option = (view.options || []).find((row) => row.id === choiceId) || (view.options || [])[0];
    if (!option) return fail("unknown_choice", "這件小事沒有這個選項。");
    if (!eventChoiceAvailable(state, view.id, option.id)) return fail("missing_resources", "手邊的資源還不夠，先換個做法吧。");
    choiceId = option.id;
    let message = ""; const rewardInfo = { items: {}, materials: {}, seedPacks: {}, favor: {}, coins: 0, wateredPlots: 0 };
    const r59 = a.r58.r59;
    if (view.id === "traveling_merchant") {
      if (choiceId === "buy") { state.coins -= 12; rewardInfo.coins = -12; r59.seedPacks.strawberry += 2; rewardInfo.seedPacks.strawberry = 2; message = "你付了 12 金，收下 2 包草莓種子。種草莓時會先用這兩包，不再扣金幣。"; }
      else if (choiceId === "trade") { state.storage.items.wheat -= 2; if (!state.storage.items.wheat) delete state.storage.items.wheat; r59.seedPacks.strawberry += 1; rewardInfo.seedPacks.strawberry = 1; message = "旅行商人收下 2 份小麥，換給你 1 包草莓種子。"; }
      else { r59.eventFlags.merchantDeclined = true; message = "你這次沒有買。旅行商人收起布簾，說下回見面還會記得你。"; }
    } else if (view.id === "crow_steal" && choiceId === "shoo") {
      if (!object(state.materials)) state.materials = {};
      state.materials.feather = credit(state.materials.feather, 1); rewardInfo.materials.feather = 1;
      message = "你揮揮手趕走烏鴉，牠慌忙飛起，掉下一根亮亮的羽毛。";
    } else if (view.id === "crow_steal") {
      state.storage.items.wheat -= 1; if (!state.storage.items.wheat) delete state.storage.items.wheat;
      r59.eventFlags.crowFed = true; message = "烏鴉吃完小麥，歪著頭看了你一會兒。下次再來，牠也許會帶點東西。";
    } else if (view.id === "afternoon_rain" && choiceId === "water") {
      const plots = Array.isArray(state.plots) ? state.plots : [];
      for (const plot of plots) if (plot && plot.cropId) { plot.wateredAt = Math.max(qty(plot.wateredAt, Number.MAX_SAFE_INTEGER), t); rewardInfo.wateredPlots++; }
      message = rewardInfo.wateredPlots ? "午後小雨落下來，田裡的作物都喝飽了水。" : "午後小雨落下來，田埂濕潤了，只是現在還沒有種下的作物。";
    } else if (view.id === "afternoon_rain") {
      state.materials.rainwater = credit(state.materials.rainwater, 1); rewardInfo.materials.rainwater = 1; message = "你接滿一桶乾淨雨水，收進材料箱。";
    } else if (view.id === "lost_chick" && choiceId === "coop") {
      if (!object(state.storage)) state.storage = { items: {} };
      if (!object(state.storage.items)) state.storage.items = {};
      state.storage.items.egg = qty(state.storage.items.egg, Number.MAX_SAFE_INTEGER) + 1; rewardInfo.items.egg = 1;
      message = "你把小雞帶回雞舍，母雞在門口迎接，順手留下一顆還帶著暖意的蛋。";
    } else if (view.id === "lost_chick") {
      a.r58.favor.child = Math.min(999, (a.r58.favor.child || 0) + 1); rewardInfo.favor.child = 1; r59.eventFlags.chickToTutu = true;
      message = "圖圖抱穩小雞，認真向你道謝。圖圖好感 +1。";
    }
    const journalText = `${view.name}：${message}`;
    r59.eventFlags.lastResolved = { eventId: view.id, choiceId, at: t, availableAt: t + 120000 };
    r59.journal.push({ eventId: view.id, choiceId, at: t, text: journalText }); r59.journal = r59.journal.slice(-40);
    a.r58.history.push({ id: view.id, at: t, result: "resolved", choiceId }); a.r58.history = a.r58.history.slice(-24);
    a.r58.activeEvent = null;
    if (a.r58.nextEventAt <= t) a.r58.nextEventAt = t + R58_EVENT_MIN_MS;
    return ok(message, { id: view.id, choiceId, reward: rewardInfo, journalText, nextEventAt: a.r58.nextEventAt });
  }
  function randomEventRecall(state, now) {
    if (!ensure(state, now).ok) return "";
    const last = state.adventure.r58.r59.eventFlags.lastResolved;
    if (!last || at(state, now) < last.availableAt) return "";
    const key = `${last.eventId}:${last.choiceId}`;
    return ({
      "traveling_merchant:buy": "旅行商人笑著說，上回買走的草莓種子正適合這季。",
      "traveling_merchant:trade": "旅行商人還記得上回換走的兩份小麥。",
      "traveling_merchant:decline": "旅行商人說，上回沒買也不要緊，今天照樣慢慢挑。",
      "crow_steal:shoo": "老農班伯撿起田邊的羽毛，笑說那隻烏鴉還記得你。",
      "crow_steal:feed": "烏鴉把亮亮的小石子放在田邊，算是回送你的小禮物。",
      "afternoon_rain:water": "老農班伯看了看濕潤的田，說上回那場雨接得正好。",
      "afternoon_rain:collect": "老農班伯指著材料箱，提醒你上回接的雨水正好能煮湯。",
      "lost_chick:coop": "圖圖說，上回送回雞舍的小雞今天安穩多了。",
      "lost_chick:tutu": "圖圖說，上回那隻小雞現在很乖，他每天都有去看。",
    })[key] || "";
  }
  function personalQuests(state, now) {
    if (!ensure(state, now).ok) return [];
    const a = state.adventure;
    return R58_PERSONAL_QUESTS.map((q) => {
      const npc = (C.NPCS || {})[q.npcId] || { name: q.npcId };
      const completed = a.r58.personal.completed.includes(q.id);
      const unlocked = !!a.claimed[q.unlockClaimed];
      const rows = requirements(state, q.wants, "inventory");
      let dialogue = q.dialogue;
      if (q.npcId === "child" && a.r58.r59.eventFlags.chickToTutu) dialogue += " 圖圖又補了一句：「上次那隻小雞現在很乖，我每天都有去看牠。」";
      return Object.assign(copy(q), { npcName: npc.name, favor: a.r58.favor[q.npcId] || 0, completed, unlocked, dialogue,
        status: completed ? "completed" : unlocked ? "available" : "locked", requirements: rows,
        canComplete: !completed && unlocked && rows.every((r) => r.complete) });
    });
  }
  function completePersonalQuest(state, id, now) {
    const q = R58_PERSONAL_QUESTS.find((entry) => entry.id === id);
    if (!q) return fail("unknown_personal_quest", "找不到這件鄰居委託。");
    const init = ensure(state, now); if (!init.ok) return init;
    const a = state.adventure;
    if (a.r58.personal.completed.includes(id)) return fail("already_claimed", "這件委託已經完成了。");
    if (!a.claimed[q.unlockClaimed]) return fail("locked", q.chapter === 2 ? "先完成第一章主線，再來看看這件委託。" : "先讓第一章的故事展開，再來看看這件委託。");
    const rows = requirements(state, q.wants, "inventory");
    if (!rows.every((r) => r.complete)) return fail("missing_resources", "委託要的東西還沒備齊。", { requirements: rows });
    consume(state, rows);
    a.r58.personal.completed.push(id);
    a.r58.personal.completedAt[id] = at(state, now);
    a.r58.favor[q.npcId] = Math.min(999, (a.r58.favor[q.npcId] || 0) + 1);
    grant(state, copy(q.reward));
    const sameNpcDone = R58_PERSONAL_QUESTS.filter((entry) => entry.npcId === q.npcId).every((entry) => a.r58.personal.completed.includes(entry.id));
    if (sameNpcDone) a.r58.r59.permanent[q.npcId] = true;
    return ok(q.doneLine, { id, npcId: q.npcId, favor: a.r58.favor[q.npcId], reward: copy(q.reward), doneLine: q.doneLine });
  }
  function permanentResults(state, now) {
    if (!ensure(state, now).ok) return [];
    const p = state.adventure.r58.r59.permanent;
    return [
      { npcId: "mayor", unlocked: !!p.mayor, icon: "📌", name: "鎮長葛瑞的新公告", kind: "object", text: "農場重新開張的告示已貼上公告欄。", revisit: "鎮長葛瑞說：「公告每天都有人看，農場的名字已經傳到河對岸了。」" },
      { npcId: "elder", unlocked: !!p.elder, icon: "🍲", name: "老農班伯的雨水清湯", kind: "recipe", text: "灶台永久新增一道料理。", revisit: "老農班伯說：「雨水清湯學會就不會忘，灶火留給你。」" },
      { npcId: "merchant", unlocked: !!p.merchant, icon: "🍓", name: "蘿拉的草莓種子包", kind: "product", text: "市集攤位永久多出草莓種子包。", revisit: "蘿拉說：「紅格布旁的位置替草莓種子留著。」" },
      { npcId: "child", unlocked: !!p.child, icon: "🌾", name: "圖圖的小稻草人", kind: "object", text: "田邊永久放上一個小稻草人。", revisit: "圖圖說：「小稻草人每天都替我跟新芽打招呼。」" },
    ];
  }
  function activeBuffs(state, now) {
    const fallback = { growthMul: 1, orderBonus: 0, harvestBonus: 0, forageBonus: 0, growthUntil: 0, orderUntil: 0, harvestUntil: 0, forageUntil: 0, growthRemainingMs: 0, orderRemainingMs: 0, harvestRemainingMs: 0, forageRemainingMs: 0 };
    if (!ensure(state, now).ok) return fallback;
    const t = at(state, now); const buffs = state.adventure.r58.buffs;
    const growth = buffs.growth && buffs.growth.until > t ? buffs.growth : null;
    const order = buffs.order && buffs.order.until > t ? buffs.order : null;
    const harvest = buffs.harvest && buffs.harvest.until > t ? buffs.harvest : null;
    const forage = buffs.forage && buffs.forage.until > t ? buffs.forage : null;
    const mealName = (buff) => buff && buff.meal ? (RECIPES.find((x) => x.id === buff.meal) || {}).name || "" : "";
    return { growthMul: growth ? growth.mul : 1, orderBonus: order ? order.bonus : 0, harvestBonus: harvest ? harvest.bonus : 0, forageBonus: forage ? forage.bonus : 0,
      growthUntil: growth ? growth.until : 0, orderUntil: order ? order.until : 0, harvestUntil: harvest ? harvest.until : 0, forageUntil: forage ? forage.until : 0,
      growthMeal: mealName(growth), orderMeal: mealName(order), harvestMeal: mealName(harvest), forageMeal: mealName(forage), growthPct: growth ? Math.round((1 - growth.mul) * 100) : 0, orderPct: order ? Math.round(order.bonus * 100) : 0,
      growthRemainingMs: growth ? growth.until - t : 0, orderRemainingMs: order ? order.until - t : 0, harvestRemainingMs: harvest ? harvest.until - t : 0, forageRemainingMs: forage ? forage.until - t : 0 };
  }
  function eatMeal(state, id, now) {
    const r = RECIPES.find((entry) => entry.id === id);
    if (!r) return fail("unknown_recipe", "找不到這道料理。");
    if (!r.effect) return fail("not_edible", "這道料理是帶去分享的，先留給鄰居吧。");
    const init = ensure(state, now); if (!init.ok) return init;
    if ((state.adventure.meals[id] || 0) < 1) return fail("missing_resources", "餐籃裡還沒有這道料理，先去灶台做一份。");
    state.adventure.meals[id]--;
    const t = at(state, now); const until = t + r.effect.durationMs;
    if (r.effect.kind === "growth") state.adventure.r58.buffs.growth = { until, mul: r.effect.mul, meal: r.id };
    else state.adventure.r58.buffs[r.effect.kind] = { until, bonus: r.effect.bonus, meal: r.id };
    let storyAdvance = null;
    if (id === "rustic_bread" && !claimed(state.adventure, "c1_first_meal") && claimed(state.adventure, "c1_first_harvest")) storyAdvance = claim(state, "c1_first_meal", now);
    return ok(r.name + "享用完了。" + r.effect.summary + (storyAdvance && storyAdvance.ok ? "「回家的第一餐」也完成了。" : ""), { id, effect: copy(r.effect), until, buffs: activeBuffs(state, now), storyAdvance });
  }
  function firstMealTask(state, now) {
    if (!ensure(state, now).ok) return { available: false, missing: 0, text: "" };
    const available = !!state.adventure.claimed.c1_first_harvest && !state.adventure.claimed.c1_first_meal;
    const have = Math.max(0, ((state.storage || {}).items || {}).wheat || 0);
    const missing = Math.max(0, 2 - have);
    return { available, missing, target: missing ? "field" : "kitchen", text: missing ? `回家的第一餐：還差 ${missing} 份小麥，先回田裡收成。` : "做一份自己的晚餐：食材已齊，前往農舍灶台。" };
  }
  function mainStoryChoice(state, npcId, now) {
    if (!ensure(state, now).ok || !R60_STORY_CHOICES[npcId]) return null;
    const def = R60_STORY_CHOICES[npcId];
    const saved = state.adventure.r58.r59.r60.storyChoices[def.id];
    const available = npcId === "mayor" ? !state.adventure.claimed.c1_homecoming
      : npcId === "elder" ? !!state.adventure.claimed.c1_first_harvest
      : !!state.adventure.claimed.c1_homecoming && state.adventure.earlyGoals.marketPreview !== true;
    return Object.assign(copy(def), { available: available && !saved, selected: saved ? saved.choiceId : null, resolvedAt: saved ? saved.at : 0 });
  }
  function r60SeedPack(state, cropId) {
    const packs = state.adventure.r58.r59.seedPacks;
    packs[cropId] = Math.min(99, (packs[cropId] || 0) + 1);
  }
  function resolveMainStoryChoice(state, npcId, choiceId, now) {
    const view = mainStoryChoice(state, npcId, now);
    if (!view || !view.available) return fail("locked", "這段對話現在不能選擇。");
    const option = view.options.find((row) => row.id === choiceId);
    if (!option) return fail("bad_choice", "找不到這個回答。");
    const t = at(state, now); const r60 = state.adventure.r58.r59.r60;
    if (option.reward.coins) grant(state, reward(option.reward.coins, 0));
    if (option.reward.materials) grant(state, reward(0, 0, option.reward.materials));
    if (option.reward.seedPack) r60SeedPack(state, option.reward.seedPack);
    r60.storyChoices[view.id] = { npcId, choiceId, at: t, journal: option.journal };
    r60.followups[npcId] = { choiceId, availableAt: t + 120000, expiresAt: t + 180000 };
    state.adventure.r58.r59.journal.push({ eventId: view.id, choiceId, at: t, text: option.journal });
    state.adventure.r58.r59.journal = state.adventure.r58.r59.journal.slice(-40);
    return ok(`${option.journal} ${option.result}。`, { nodeId: view.id, npcId, choiceId, reward: copy(option.reward), journalText: option.journal });
  }
  function mainStoryRecall(state, npcId, now) {
    if (!ensure(state, now).ok) return "";
    const follow = state.adventure.r58.r59.r60.followups[npcId];
    if (!follow || at(state, now) < follow.availableAt) return "";
    const lines = {
      mayor: { farm: "田種得還順吧？那包小麥種子落進土裡，農場就算真正醒了。", town: "鎮上的事先聽過，路就不陌生了。老農班伯懂田，蘿拉懂買賣，圖圖最熟河邊的小路。" },
      elder: { sell: "那袋新麥賣得不錯，記得也替下一輪留一點。", seed: "你留下的種子很飽滿，下一輪收成會接得上。" },
      merchant: { sign: "你的農場牌已經有人記住了，今天還有人指名問起。", listen: "你先問客人想要什麼，這一批貨就不會白忙。" },
    };
    return (lines[npcId] && lines[npcId][follow.choiceId]) || "";
  }
  function r61MarketChoice(state, now) {
    if (!ensure(state, now).ok) return null;
    const r61 = state.adventure.r61;
    if (!claimed(state.adventure, "c4_market_expansion")) return null;
    const options = [
      { id: "gate", label: "掛在市集入口", result: "入口多一面迎客旗", journal: "我把橘紅小旗掛在市集入口。風一吹，遠遠就看得到今天有新攤位。" },
      { id: "stall", label: "掛在試吃攤旁", result: "試吃攤多一面招牌旗", journal: "我把橘紅小旗掛在試吃攤旁。客人先看到旗，再循著香味走過來。" },
    ];
    return { id: "c4_market_flag", speaker: "蘿拉", lines: ["新桌都站穩了，現在只差這面旗。", "入口醒目，試吃攤則會更熱鬧。", "你選吧。掛下去以後，我就照那個位置布置。"], options, selected: r61.marketFlagChoice ? copy(r61.marketFlagChoice) : null, available: !r61.marketFlagChoice };
  }
  function chooseR61MarketFlag(state, choiceId, now) {
    const view = r61MarketChoice(state, now);
    if (!view) return fail("locked", "先完成市集擴建。");
    if (view.selected) return fail("already_chosen", "旗子的位置已經決定了。");
    const option = view.options.find((row) => row.id === choiceId);
    if (!option) return fail("unknown_choice", "沒有這個掛旗位置。");
    const t = at(state, now);
    state.adventure.r61.marketFlagChoice = { id: option.id, at: t, journal: option.journal };
    state.adventure.r61.world.marketFlag = option.id;
    state.adventure.r58.r59.journal.push({ eventId: "c4_market_flag", choiceId: option.id, at: t, text: option.journal });
    state.adventure.r58.r59.journal = state.adventure.r58.r59.journal.slice(-40);
    return ok(option.journal, { choiceId: option.id, journalText: option.journal, world: copy(state.adventure.r61.world) });
  }
  function r61MarketRecall(state, now) {
    if (!ensure(state, now).ok || !state.adventure.r61.marketFlagChoice) return "";
    return state.adventure.r61.marketFlagChoice.id === "gate" ? "入口那面旗很管用，旅人還沒走近就知道今天有市集。" : "試吃攤旁的旗一動，客人就跟著香味轉過來了。";
  }
  function festivalBaseline(a) {
    return Object.assign(Object.fromEntries(Object.keys(C.CROPS || {}).map((id) => [id, qty(a.byTarget.harvest[id])])), { cook: qty(a.counts.cook), talks: Object.fromEntries(["mayor", "elder", "merchant", "child"].map((id) => [id, qty(a.byTarget.talk[id])])) });
  }
  function festivalStatus(state, now) {
    if (!ensure(state, now).ok) return { unlocked: false, active: false, goals: [] };
    const t = at(state, now), f = state.adventure.r61.festival;
    if (!f.unlocked) return { unlocked: false, active: false, goals: [], message: "完成第五章後解鎖收穫祭。" };
    if (f.endsAt && t >= f.endsAt) {
      const base = f.baseline || festivalBaseline(state.adventure);
      const harvestCrop = f.harvestCrop || "tomato", harvestRequired = Math.max(1, Math.min(3, f.harvestRequired || 3));
      const tomato = Math.max(0, qty(state.adventure.byTarget.harvest[harvestCrop]) - qty(base[harvestCrop]));
      const cooked = Math.max(0, qty(state.adventure.counts.cook) - qty(base.cook));
      const talked = ["mayor", "elder", "merchant", "child"].filter((id) => qty(state.adventure.byTarget.talk[id]) > qty(base.talks && base.talks[id])).length;
      const goalsCompleted = [tomato >= harvestRequired, cooked >= 1, talked >= 2].filter(Boolean).length;
      const participation = !f.goalsClaimed ? 5 : 0;
      if (participation) grant(state, reward(participation, 0));
      f.settlement = { roundAt: f.startsAt, goalsCompleted, stars: f.judging ? f.judging.stars : 0, rewards: [f.goalsClaimed ? "收穫祭獎章 1 枚與河畔彩旗裝飾 1 件" : "參加獎 5 金", f.judging ? f.judging.rewardText : "本場未參加作物評比"], nextAt: f.endsAt + FESTIVAL_INTERVAL_MS, shown: false };
      f.startsAt = 0; f.endsAt = 0; f.baseline = null; f.nextAt = f.settlement.nextAt; f.completed = f.goalsClaimed; f.rounds = Math.min(999, f.rounds + 1);
    }
    if (!f.endsAt && ((f.startsAt && t >= f.startsAt) || (f.nextAt && t >= f.nextAt))) {
      f.startsAt = t; f.endsAt = t + FESTIVAL_DURATION_MS; f.nextAt = 0; f.baseline = festivalBaseline(state.adventure); f.completed = false; f.rewardGranted = false; f.goalsClaimed = false; f.judging = null; f.supportProvisioned = false;
      const unlocked = Object.keys(C.CROPS || {}).filter((id) => !C.CROPS[id].unlockLevel || C.CROPS[id].unlockLevel <= (state.level || 1));
      f.harvestCrop = unlocked.includes("tomato") ? "tomato" : (unlocked[0] || "wheat"); f.harvestRequired = 3;
    }
    if (f.endsAt > t && !f.supportProvisioned) {
      const haveTomato = qty(state.storage && state.storage.items && state.storage.items.tomato);
      const fieldTomato = (state.plots || []).some((plot) => plot && plot.cropId === "tomato");
      if (!haveTomato && !fieldTomato) { state.adventure.r58.r59.seedPacks.tomato = Math.min(99, qty(state.adventure.r58.r59.seedPacks.tomato) + 3); f.supportMessage = `送你 3 包番茄種子，先去種番茄（約 ${Math.ceil((C.CROPS.tomato && C.CROPS.tomato.growMs || 60000) / 1000)} 秒）。`; }
      f.supportProvisioned = true;
    }
    const active = f.endsAt > t, base = f.baseline || festivalBaseline(state.adventure);
    const harvestCrop = f.harvestCrop || "tomato"; const harvestRequired = Math.max(1, Math.min(3, f.harvestRequired || 3));
    const tomato = Math.max(0, qty(state.adventure.byTarget.harvest[harvestCrop]) - qty(base[harvestCrop]));
    const cooked = Math.max(0, qty(state.adventure.counts.cook) - qty(base.cook));
    const talked = ["mayor", "elder", "merchant", "child"].filter((id) => qty(state.adventure.byTarget.talk[id]) > qty(base.talks && base.talks[id])).length;
    const goals = [
      { id: "tomato", cropId: harvestCrop, name: `收成 ${harvestRequired} 份${C.CROPS[harvestCrop] ? C.CROPS[harvestCrop].name : "作物"}`, current: Math.min(harvestRequired, tomato), required: harvestRequired, complete: tomato >= harvestRequired },
      { id: "cook", name: "做 1 道料理", current: Math.min(1, cooked), required: 1, complete: cooked >= 1 },
      { id: "talk", name: "跟 2 位鄰居說話", current: Math.min(2, talked), required: 2, complete: talked >= 2 },
    ];
    return { unlocked: true, active, completed: f.completed, goalsClaimed: f.goalsClaimed, canComplete: active && !f.goalsClaimed && goals.every((g) => g.complete), startsAt: f.startsAt, endsAt: f.endsAt, nextAt: f.nextAt, remainingMs: active ? f.endsAt - t : Math.max(0, f.nextAt - t), goals, judging: f.judging ? copy(f.judging) : null, medals: f.medals, decorations: f.decorations, rounds: f.rounds, supportMessage: f.supportMessage || "", target: f.supportMessage ? "field" : null };
  }
  function completeFestival(state, now) {
    const status = festivalStatus(state, now), f = state.adventure.r61.festival;
    if (!status.active) return fail("not_active", "收穫祭現在沒有開放。");
    if (!status.canComplete) return fail("not_ready", "三個收穫祭目標還沒全部完成。", { goals: status.goals });
    f.completed = true; f.goalsClaimed = true; f.rewardGranted = true; f.medals = Math.min(999, f.medals + 1); f.decorations = Math.min(999, f.decorations + 1);
    return ok("三個目標都完成了。獲得收穫祭獎章 1 枚與河畔彩旗裝飾 1 件。", { reward: { medals: 1, decorations: 1 }, status: festivalStatus(state, now) });
  }
  function festivalEntries(state, now) {
    const status = festivalStatus(state, now);
    if (!status.active) return [];
    const crops = Object.entries((state.storage && state.storage.items) || {}).filter(([id, count]) => C.CROPS[id] && qty(count) > 0).map(([id, count]) => ({ id, cropId: id, kind: "crop", name: C.CROPS[id].name, icon: C.CROPS[id].emoji || "🌱", quantity: qty(count), season: C.CROPS[id].season || "四季", quality: false }));
    const qualityCrops = Object.entries((state.storage && state.storage.quality) || {}).filter(([id, count]) => C.CROPS[id] && qty(count) > 0).map(([id, count]) => ({ id: "quality:" + id, cropId: id, kind: "crop", name: "優質" + C.CROPS[id].name, icon: "✨", quantity: qty(count), season: C.CROPS[id].season || "四季", quality: true }));
    const meals = RECIPES.filter((r) => qty(state.adventure.meals[r.id]) > 0).map((r) => ({ id: r.id, kind: "meal", name: r.name, icon: r.icon || "🍽️", quantity: qty(state.adventure.meals[r.id]), season: "料理" }));
    const dried = Sunplay ? Object.entries((state.storage && state.storage.items) || {}).filter(([id, count]) => Sunplay.driedDef(id) && qty(count) > 0).map(([id, count]) => { const def = Sunplay.driedDef(id); return { id, driedCropId: def.cropId, kind: "dried", name: def.name, icon: "☀", quantity: qty(count), season: "日曬乾貨" }; }) : [];
    return crops.concat(qualityCrops, meals, dried);
  }
  function judgeFestivalEntry(state, selectedIds, now) {
    const status = festivalStatus(state, now);
    if (!status.active) return fail("not_active", "收穫祭現在沒有開放。");
    let f = state.adventure.r61.festival;
    if (f.judging && f.judging.roundAt === f.startsAt) return fail("already_judged", "這一場已經評比過了，每場只能參加一次。");
    if (!Array.isArray(selectedIds) || selectedIds.length !== 3 || selectedIds.some((id) => typeof id !== "string")) return fail("bad_entry", "請選三樣作物或料理上桌。");
    const entries = festivalEntries(state, now); const used = {};
    f = state.adventure.r61.festival;
    for (const id of selectedIds) used[id] = (used[id] || 0) + 1;
    const chosen = [];
    for (const [id, count] of Object.entries(used)) { const row = entries.find((item) => item.id === id); if (!row || row.quantity < count) return fail("missing_resources", "上桌的品項或數量不足。"); for (let i = 0; i < count; i++) chosen.push(row); }
    const currentSeason = state.season && state.season.id ? state.season.id : "春";
    const diverse = new Set(selectedIds).size === 3;
    const seasonal = chosen.some((row) => row.kind === "crop" && (row.season === currentSeason || row.season === "四季"));
    const hasMeal = chosen.some((row) => row.kind === "meal");
    const quality = chosen.some((row) => row.quality);
    const hasDried = chosen.some((row) => row.kind === "dried");
    const judgingPoints = (diverse ? 1 : 0) + (seasonal ? 1 : 0) + (hasMeal ? 1 : 0) + (quality ? 1 : 0) + (hasDried ? 1 : 0);
    const stars = judgingPoints >= 4 ? 3 : judgingPoints >= 2 ? 2 : 1;
    for (const [id, count] of Object.entries(used)) { const row = entries.find((item) => item.id === id); const target = row.kind === "meal" ? state.adventure.meals : row.quality ? state.storage.quality : state.storage.items; const targetId = row.cropId || id; target[targetId] -= count; if (target[targetId] === 0 && row.kind === "crop") delete target[targetId]; }
    const baseCoins = stars === 1 ? 8 : stars === 2 ? 24 : 50;
    const qualityBonus = quality ? 8 : 0, driedBonus = hasDried ? 8 : 0;
    const coins = baseCoins + qualityBonus + driedBonus; grant(state, reward(coins, 0));
    if (stars >= 2) f.decorations = Math.min(999, f.decorations + 1);
    if (stars === 3) f.festivalRecipe = true;
    const rewardBaseText = stars === 1 ? "8 金" : stars === 2 ? "24 金與豐收花環裝飾 1 件" : "50 金、專屬豐收花環裝飾 1 件，並學會專屬配方「河畔豐收拼盤」";
    const bonusText = [quality ? "優質作物加獎 8 金" : "", hasDried ? "日曬乾貨加獎 8 金" : ""].filter(Boolean);
    const rewardText = rewardBaseText + (bonusText.length ? "；" + bonusText.join("、") : "");
    const mayorLine = stars === 1 ? "鎮長葛瑞說：「肯把收成端上桌，就是收穫祭的第一步。」" : stars === 2 ? "鎮長葛瑞說：「三樣滋味各有個性，再補 " + Math.max(1, 4 - judgingPoints) + " 項就是三星。」" /* R79C：跟下次提示的「還差 N 項」用同一個數字 */ : "鎮長葛瑞說：「至少四項都照顧到了，這就是今晚的三星桌！」";
    const credited = new Set();
    const details = chosen.map((row) => {
      const sources = [];
      const take = (id, label, yes) => { if (yes && !credited.has(id)) { credited.add(id); sources.push(label + " +1"); } };
      take("seasonal", "當季作物", row.kind === "crop" && (row.season === currentSeason || row.season === "四季"));
      take("hasMeal", "有料理", row.kind === "meal");
      take("quality", "優質作物", row.quality);
      take("hasDried", "日曬乾貨", row.kind === "dried");
      return { id: row.id, name: row.name, sources };
    });
    if (diverse && details.length) details[0].sources.unshift("種類不同 +1（整桌只算一次）");
    const breakdown = [{ id: "diverse", label: "種類不同", got: diverse }, { id: "seasonal", label: "當季作物", got: seasonal }, { id: "hasMeal", label: "有料理", got: hasMeal }, { id: "quality", label: "優質作物", got: quality }, { id: "hasDried", label: "日曬乾貨", got: hasDried }];
    const missingLabels = breakdown.filter((row) => !row.got).map((row) => row.label);
    const tip = judgingPoints >= 5 ? "五項全拿到了；下次可換別的作物組合挑戰同樣的滿分。"
      : stars >= 3 ? "三星已到手；下次直接補「" + missingLabels[0] + "」就能拿滿五項。"
        : "三星要四項，還差 " + Math.max(0, 4 - judgingPoints) + " 項；下次先補「" + missingLabels.slice(0, Math.max(1, 4 - judgingPoints)).join("」和「") + "」。";
    /* R77C 第 12 項：這一場擺攤 2 星以上，評比多一行攤位口碑；五個分項與總分算法不變。 */
    const stallRound = state.adventure.r72b && state.adventure.r72b.rounds && state.adventure.r72b.rounds[String(f.startsAt)];
    const stallStars = Math.max(qty(stallRound && stallRound.stallStars), qty(stallRound && stallRound.bestStars));
    const stallReputation = stallStars >= 2 ? { stars: stallStars, text: "攤位口碑：這一場擺攤拿到 " + stallStars + " 顆星，大家記得你的攤子，評比時先有好印象（口碑不列入五個分項）。" } : null;
    f.judging = { roundAt: f.startsAt, stars, selected: selectedIds.slice(), details, tip, breakdown, totalScore: judgingPoints, maxScore: 5, scoreSources: { diverse, seasonal, hasMeal, quality, hasDried }, reward: { coins, decorations: stars >= 2 ? 1 : 0, recipe: stars === 3 ? "riverside_harvest_platter" : null }, rewardText, mayorLine, stallReputation };
    return ok(`${stars} 顆星！${mayorLine}`, copy(f.judging));
  }
  function takeFestivalSettlement(state, now) {
    festivalStatus(state, now); const f = state.adventure.r61.festival;
    if (!f.settlement || f.settlement.shown) return null;
    f.settlement.shown = true; return copy(f.settlement);
  }
  function festivalScene(state, now) {
    const status = festivalStatus(state, now);
    if (!status.unlocked || !status.active) return { active: false, decorations: [], neighbors: [], stall: null };
    return {
      active: true,
      decorations: [
        { id: "bunting", name: "收穫祭彩旗", icon: "🎏", tileId: "t12_8" },
        { id: "lanterns", name: "河畔燈籠", icon: "🏮", tileId: "t14_8" },
        { id: "long_table", name: "收穫祭長桌", icon: "🍽️", tileId: "t13_10" },
      ],
      neighbors: [
        { id: "mayor", name: "鎮長葛瑞", tileId: "t12_8" },
        { id: "elder", name: "老農班伯", tileId: "t13_9" },
        { id: "merchant", name: "蘿拉", tileId: "t14_9" },
        { id: "child", name: "圖圖", tileId: "t15_8" },
      ],
      stall: { id: "harvest_festival_stall", name: "祭典攤位", icon: "🎪", tileId: "t15_9", goals: copy(status.goals), judging: status.judging, rewardText: "三目標：收穫祭獎章 1 枚與河畔彩旗；作物評比：一至三星獎勵" },
    };
  }
  /* R82C 第 2 項：第一次收成之後，給兩個一樣有效的目標讓玩家自己挑。
     「下一步」照舊由上面的 nextFarmStep 決定，這裡不另外判斷要做什麼，只在「已收成過、鎮長的開工任務交了、
     第一餐還沒吃、河畔釣台材料齊了還沒修」這一段，把「先修河畔釣台」掛成 step.alternative，任務卡並排兩個選項。
     釣台正是第 2 章第一個任務要修的東西，先修也算數；主線那一邊不變，所以選哪個都不會卡。
     光正在等人處理（折光、等光、催熟、在光裡照料）時不掛，光只停幾秒，不拿另一件事分心。 */
  const R82C_PICK_HOLD_ACTIONS = ["refract", "catch_sun", "ripen"];
  function r82cFirstPick(state, step, now) {
    if (!step || typeof step !== "object" || !state || !state.adventure) return step;
    const a = state.adventure;
    /* 先修好釣台、吃完第一餐之後：主線不要再叫玩家「去河邊看看釣台」，直接請他把第 2 章的釣台任務交掉。 */
    if (step.action === "explore" && step.target === "fishing_dock" && restored(a, "fishing_dock")) {
      const q = quests(state, now).find((row) => row.id === "c2_fishing_dock");
      if (q && q.canClaim) { const npc = (C.NPCS || {})[q.npcId] || { name: "鎮民" }; return { action: "report", target: q.npcId, questId: q.id, tileId: null, text: `河畔釣台已經修好了，去找${npc.name}回報，借他的魚竿。`, short: `去找${npc.name}回報`, actionLabel: "去回報" }; }
      return step;
    }
    const harvested = Object.values((state.stats && state.stats.harvested) || {}).some((n) => Number(n) > 0);
    if (!harvested || !claimed(a, "c1_homecoming") || claimed(a, "c1_first_meal") || restored(a, "fishing_dock")) return step;
    if (R82C_PICK_HOLD_ACTIONS.includes(step.action) || step.sunlit === true || step.holdPlotIndex != null) return step;
    const dock = projects(state).find((p) => p.id === "fishing_dock");
    if (!dock || !dock.canRestore) return step;
    const cost = Object.entries(dock.cost || {}).map(([id, n]) => `${((C.MATERIALS || {})[id] || {}).name || id} ${n}`).join("、");
    return Object.assign({}, step, { alternative: { id: "fishing_dock", action: "restore", target: "fishing_dock", tileId: dock.target && dock.target.tileId || null,
      text: `修好河畔釣台（${cost} 已備齊），修好就能借魚竿釣魚，之後的釣台任務直接算完成。`, short: "去修河畔釣台", actionLabel: "去修釣台" } });
  }
  const r82cBaseFarmStep = nextFarmStep;
  nextFarmStep = function (state, now) { return r82cFirstPick(state, r82cBaseFarmStep(state, now), now); };
  const AdventureAPI = { ensure, record, finishTutorial, nextFarmStep, nextGuidance, quests, questRequirements, altQuestRequirements, sunbookStampCount, gradedMealCount, claim, earlyGoals, chooseDailyGoals, swapDailyGoal, claimDailyGoals, projects, restore, recipes, cook, fish, summary, guide, firstChoiceStatus, chooseFirstPath, trackFirstPath, taskActionLabel, storyPanelAvailability, buyMaterial, commissions, deliverCommission, eatMeal, activeBuffs, firstMealTask, randomEvents, maybeTriggerRandomEvent, resolveRandomEvent, randomEventRecall, worldEventObject, settleExpiredWorldEvent, personalQuests, completePersonalQuest, permanentResults,
    mainStoryChoice, resolveMainStoryChoice, mainStoryRecall, r61MarketChoice, chooseR61MarketFlag, r61MarketRecall, festivalStatus, completeFestival, festivalEntries, judgeFestivalEntry, takeFestivalSettlement, festivalScene, neighbors, basketFlavors, deliverNeighbor, startFishing, fishingObservation, observeFishingCast, reelFishing, fishNotes, gathering, packGathering, completeGathering, servingReply, serveGathering, serveGatheringCourse, serveGatheringTaste, gatheringPortions, refillGathering, serveGatheringPortion, sharedMealChoices, shareMeal, r77Upgraded };
  if (typeof window !== "undefined") window.AdventureAPI = AdventureAPI;
  if (typeof module !== "undefined" && module.exports) module.exports = AdventureAPI;
})(typeof window !== "undefined" ? window : globalThis);
