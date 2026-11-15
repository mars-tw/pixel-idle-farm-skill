/* R77B／R78C：六種開場回答各接一條三步的角色事件。
   - 回訪對白（story-r76.js）播完後，對方多交代一件事；手札「我做過的選擇」那張卡底下列出三個步驟、去哪裡做與進度。
   - 每條至少用到兩種玩法（追光、料理、曬架、鄰居委託、市集）；第三步做完，當初那個長期加成升一級，真的作用在數字上。
   - 第 8 項：兩套回訪只留 R76 對話框那一套；AdventureAPI.mainStoryRecall 遇到有 R76 回訪的選擇就不再補一句固定台詞。
   存檔放在 state.adventure.r77。純邏輯可由 Node 載入測試；瀏覽器段只包住既有函式與介面，不改既有流程。 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const C = isNode ? require("./config.js") : (root.CONFIG || root);
  const G = isNode ? require("./game.js") : (root.Game || root);
  const A = isNode ? require("./adventure.js") : (root.AdventureAPI || null);
  const M = isNode ? require("./midgame-r66.js") : (root.MidgameR66 || null);
  const K = isNode ? require("./cooking-r75.js") : (root.CookingR75 || null);
  const R = isNode ? require("./story-r76.js") : (root.StoryR76 || null);
  const Sunplay = isNode ? require("./sunplay-r75.js") : (root.FarmSunplay || null);

  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nowOf = (now) => (Number.isFinite(now) ? now : Date.now());

  const NPC_ORDER = ["mayor", "elder", "merchant"];
  const STORY_IDS = { mayor: "mayor_welcome", elder: "elder_wheat", merchant: "merchant_hello" };
  const NPC_NAMES = { mayor: "鎮長葛瑞", elder: "老農班伯", merchant: "蘿拉", child: "圖圖" };
  const PRONOUN = { mayor: "他", elder: "他", merchant: "她" };
  const TALK_NPCS = ["mayor", "elder", "merchant", "child"];
  const PLAY_NAMES = { sun: "追光", cook: "料理", rack: "曬架", order: "鄰居委託", market: "市集" };
  const SIGN_COLORS = [
    { id: "red", name: "莓果紅", swatch: "#c9463d" },
    { id: "blue", name: "河水藍", swatch: "#3f7fb5" },
    { id: "green", name: "嫩葉綠", swatch: "#5a9a3c" },
  ];
  const REWARD_COINS = 30;
  const REWARD_XP = 12;
  /* 交談步驟：上一步剛完成的同一個動作不能順便把「說話」也算掉，至少隔一點時間。 */
  const TALK_GAP_MS = 1500;
  const COMMISSION_NPC = { river_market: "merchant", elder_supper: "elder", child_tea: "child" };
  const DRIED_FALLBACK = ["sun_wheat", "sun_carrot", "sun_tomato", "sun_strawberry"];

  const ROUTE_ART = {
    seed: "assets/generated/r83/seed-32.png", note: "assets/generated/r83/note-32.png",
    basket: "assets/generated/r83/basket-32.png", wheat: "assets/generated/r83/wheat-32.png",
    sign: "assets/generated/content-r75/farm_sign.png", stamp: "assets/generated/r83/stamp-32.png",
  };
  /* R79C：六種開場回答的地圖物件各有一張自己的圖（檔名照計畫 assets/generated/content-r79/choice-<鄰居>-<選項>.png）。
     圖還沒到之前不去載入（避免要不到檔案），先用現有小圖當後備；圖到了以後把路線加進 CHOICE_ART_READY，地圖就換成新圖。 */
  const CHOICE_ART = {
    "mayor:farm": "assets/generated/content-r79/choice-mayor-farm.png", "mayor:town": "assets/generated/content-r79/choice-mayor-town.png",
    "elder:sell": "assets/generated/content-r79/choice-elder-sell.png", "elder:seed": "assets/generated/content-r79/choice-elder-seed.png",
    "merchant:sign": "assets/generated/content-r79/choice-merchant-sign.png", "merchant:listen": "assets/generated/content-r79/choice-merchant-listen.png",
  };
  const CHOICE_ART_READY = [];
  function choiceArt(key, fallback) { return CHOICE_ART_READY.includes(key) && CHOICE_ART[key] ? CHOICE_ART[key] : fallback; }

  /* R78C：每條路線先有角色專屬的現場事件，再由玩家做一次會留下紀錄的決定。
     decision 的兩個結果給不同物品；完成後 marker.doneLabel 會留在地圖上。
     R79C：每一步都標 place——marker 是走到地圖上那個物件旁邊做，npc 是走到鄰居旁邊做；手札只顯示進度與「帶我去」。
     special 是做完三步才解鎖、有名字的新訂單或新配方（依第二步的決定分兩種）；chatter 是物件旁每天輪替的鄰居對白。 */
  const QUESTS = {
    "mayor:farm": {
      id: "morning_field", name: "晨耕", npcId: "mayor", choiceId: "farm",
      intro: ["鎮長葛瑞沒有叫你等到明天。", "他把一張田格草圖塞進種子籃：「先種田的人，今天就該看見第一個改變。」"],
      marker: { anchor: "station:sign", spot: "告示牌旁", art: ROUTE_ART.seed, earlyLabel: "晨耕種子籃", doneLabel: "晨耕種子籃・{decision}" },
      steps: [
        { title: "到田邊看鎮長畫的晨耕草圖", where: "走到告示牌旁的晨耕種子籃，看鎮長夾在籃裡的草圖。", place: "marker", act: "scene", actLabel: "看晨耕草圖", need: 1, lines: ["鎮長指著草圖上的兩個角落。", "「一邊適合留種，一邊適合曬穀。這個農場先長成哪個樣子，由你決定。」"] },
        { title: "決定種子籃先裝什麼", where: "在晨耕種子籃旁邊選：留種小包，或一瓶早晨收下的陽光。", place: "marker", act: "decision", need: 1, options: [
          { id: "seed", label: "留種小包", result: "籃裡放進小麥種子 2 包", reward: { seedPacks: { wheat: 2 } } },
          { id: "sun", label: "晨光小瓶", result: "蓄光瓶裝進陽光 2 點", reward: { sunlight: 2 } },
        ] },
        { title: "帶 1 份日曬乾貨給鎮長", where: "倉庫備好日曬乾貨後，走到鎮長葛瑞旁邊交給他。", place: "npc", play: "rack", act: "give_dried", actLabel: "把乾貨交給鎮長", need: 1,
          ask: "「乾貨帶來了嗎？照規矩，我得先看過成色，才好記進鎮誌。」", thanks: "鎮長把乾貨舉到光下看了看：「曬得透。告示牌旁那只種子籃，從今天起就算你的了。」" },
      ],
      brief: ["田邊的種子籃已經擺好了。", "先看草圖、決定籃裡裝什麼，再帶一份乾貨給我。", "做完以後，種子籃每天都能親手翻一次。"],
      upgradeText: "田邊留下晨耕種子籃；每天可翻一次，領 1 包當季種子與 1 點陽光。",
      afterText: "鎮長收下乾貨，田邊的種子籃也照我的決定留了下來。",
      daily: { id: "field_basket", label: "翻今天的晨耕種子籃", result: "拿到 1 包當季種子與 1 點陽光", reward: { seasonalSeed: 1, sunlight: 1 } },
      special: { kind: "新訂單", variants: {
        seed: { name: "留種合作單", want: { type: "seasonal", qty: 3 }, reward: { seasonalSeed: 2, materials: { compost: 1 } }, line: "籃邊夾著鎮長的字條：「交三份當季收成，鎮上回你兩包種。照規矩，一天一張。」" },
        sun: { name: "晨光合作單", want: { type: "seasonal", qty: 3 }, reward: { sunlight: 2, materials: { compost: 1 } }, line: "籃邊夾著鎮長的字條：「交三份當季收成，我替你把晨光小瓶裝滿兩格。照規矩，一天一張。」" },
      } },
      chatter: [
        "今天風往東吹，我把籃子挪到背風那一側了。照規矩，種子不能受潮。",
        "鎮公所的鐘我調快了五分鐘，你照舊起床就好，別跟著鐘跑。",
        "昨晚巡田，看見你的田埂修得很直。這種事我會記在鎮誌裡。",
        "種田的人最先知道季節。哪天覺得土不對勁，先來跟我說一聲。",
        "籃底多墊了一層乾草，是你祖母以前教我的老法子。",
        "開會的人都說要等等看，只有田不等人。今天也麻煩你了。",
      ],
    },
    "mayor:town": {
      id: "town_news", name: "鎮上的事", npcId: "mayor", choiceId: "town",
      intro: ["鎮長葛瑞當場攤開兩張空白公告。", "「一張貼鎮口，一張送河邊。你先替農場選一個說話的地方。」"],
      marker: { anchor: "station:mailbox", spot: "信箱旁", art: ROUTE_ART.note, earlyLabel: "公告草稿", doneLabel: "農場公告・{decision}" },
      steps: [
        { title: "和鎮長一起讀兩張公告草稿", where: "走到信箱旁的公告草稿，和鎮長一起讀公告草稿。", place: "marker", act: "scene", actLabel: "讀公告草稿", need: 1, lines: ["第一張寫著農場重新開門，第二張畫了通往河邊的箭頭。", "鎮長問：「你要先讓人記住農場，還是先把人帶去河邊？」"] },
        { title: "決定公告先貼哪裡", where: "在公告草稿旁邊選：貼在鎮口，或送到河邊。", place: "marker", act: "decision", need: 1, options: [
          { id: "town_gate", label: "貼在鎮口", result: "鎮長給 18 金作為公告工錢", reward: { coins: 18 } },
          { id: "river_path", label: "送到河邊", result: "修路剩下的木料 2 份交給你", reward: { materials: { wood: 2 } } },
        ] },
        { title: "帶一道料理，和鎮長交換鎮上消息", where: "在灶台做好料理後，走到鎮長葛瑞旁邊，端料理去聽消息。", place: "npc", play: "cook", act: "meal", actNpc: "mayor", actLabel: "端料理去聽消息", need: 1,
          ask: "「公告貼出去了。帶一道菜來，我拿鎮上的消息跟你換，這樣才公道。」", thanks: "鎮長邊吃邊說：「橋頭要修，麵包店缺麥。往後不合手的委託，到公告旁邊找我換，一天一張。」" },
      ],
      brief: ["公告草稿已經壓在信箱旁。", "讀完後選一個先貼的地方，再帶一道料理來交換消息。", "做完以後，不合手的鎮長委託每天能換一張。"],
      upgradeText: "鎮長每日委託的金幣從多一成變成多兩成，每天還可以換一次委託。",
      afterText: "我帶料理去找鎮長，公告也照選的地方貼好；不合手的鎮長委託每天能換一張。",
      special: { kind: "新訂單", variants: {
        town_gate: { name: "鎮口代辦單", want: { type: "most", qty: 4 }, coinsRate: 1, reward: { coins: 12 }, line: "公告底下多釘了一張小單：「鎮口的人看了公告來訂貨。照市價收四份，另付十二金代辦費。」" },
        river_path: { name: "河邊代辦單", want: { type: "most", qty: 4 }, coinsRate: 1, reward: { materials: { wood: 2 } }, line: "公告底下多釘了一張小單：「河邊修路的人要四份口糧。照市價收，另外補你兩份木料。」" },
      } },
      chatter: [
        "今天有三個人站在公告前面唸出聲。字我特地寫大了一號。",
        "橋頭的木板鬆了一塊，我已經記進待辦。你路過時走靠欄杆那邊。",
        "麵包店問農場什麼時候再送麥來。我替你回了「快了」，別讓我失信。",
        "公告欄照規矩七天換一次，你的那張我多留了三天。",
        "昨天有外地人照著公告找到農場門口。看吧，話要先說出去。",
        "鎮上的事說大不大，可是少一個人聽，就少一件辦得成。",
      ],
    },
    "elder:sell": {
      id: "first_deal", name: "第一筆生意", npcId: "elder", choiceId: "sell",
      intro: ["老農班伯立刻把一只舊秤放到市集木箱旁。", "「要學做生意，就先看秤怎麼說實話。」"],
      marker: { anchor: "station:storage", spot: "倉庫旁", art: ROUTE_ART.basket, earlyLabel: "試賣秤", doneLabel: "生意木箱・{decision}" },
      steps: [
        { title: "和班伯在舊秤旁試秤一袋麥", where: "走到倉庫旁的試賣秤，跟班伯試秤一袋麥。", place: "marker", act: "scene", actLabel: "跟班伯試秤", need: 1, lines: ["班伯把秤砣往左挪一格，又往右挪回來。", "「價錢不是越高越好。第一袋貨要替你帶回客人，還是先帶回現金？」"] },
        { title: "決定第一袋貨怎麼賣", where: "在試賣秤旁邊選：現金成交，或留一份給鄰里試吃。", place: "marker", act: "decision", need: 1, options: [
          { id: "cash", label: "現金成交", result: "班伯替你談到 24 金", reward: { coins: 24 } },
          { id: "sample", label: "鄰里試吃", result: "換回胡蘿蔔種子 3 包", reward: { seedPacks: { carrot: 3 } } },
        ] },
        { title: "把第一筆帳記進木箱上的帳簿", where: "走到老農班伯旁邊，讓他陪你把這筆帳記完。", place: "npc", act: "scene_close", actLabel: "和班伯記帳", need: 1, lines: ["班伯在帳簿最上面寫下日期。", "「記住客人怎麼來，比只記今天賺多少更有用。」"] },
      ],
      brief: ["舊秤已經放到市集木箱旁。", "跟班伯試秤、決定第一袋貨怎麼賣，再把帳記好。", "以後每天都能問一次今日行情。"],
      upgradeText: "老農班伯的河畔委託金幣從多一成變成多兩成。",
      afterText: "班伯陪我把第一筆帳寫好，市集木箱旁一直留著那只舊秤。",
      daily: { id: "market_price", label: "問班伯今天的行情", result: "班伯替你談到今日行情 8 金", reward: { coins: 8 } },
      special: { kind: "新訂單", variants: {
        cash: { name: "整箱現金單", want: { type: "most", qty: 5 }, coinsRate: 1.3, reward: {}, line: "木箱蓋上用粉筆寫著：「整箱五份，一次點清。價錢比零賣多三成，不賒帳。」" },
        sample: { name: "試吃回頭單", want: { type: "most", qty: 5 }, coinsRate: 1.1, reward: { seasonalSeed: 1 }, line: "木箱蓋上用粉筆寫著：「吃過的人回頭訂五份。價錢多一成，另外還你一包種。」" },
      } },
      chatter: [
        "秤我校過了。少一兩，是你的臉。",
        "貨好不用喊。箱子擺正，人就來。",
        "昨天那個殺價的，今天又來了。這就叫回頭客。",
        "賣剩的別硬賣。曬一曬，明天是另一種貨。",
        "零錢我放箱底。要找錢，手別抖。",
        "早市看貨，晚市看人。你自己挑時辰。",
      ],
    },
    "elder:seed": {
      id: "keep_seed", name: "留種", npcId: "elder", choiceId: "seed",
      intro: ["老農班伯把兩只小木盤擺到田邊，一盤深色、一盤飽滿。", "「留種不是把剩下的收起來，是先想下一輪要什麼。」"],
      marker: { anchor: "station:well", spot: "水井旁", art: ROUTE_ART.wheat, earlyLabel: "選種盤", doneLabel: "留種木盤・{decision}" },
      steps: [
        { title: "聽班伯比較兩只選種盤", where: "走到水井旁的選種盤，聽班伯比較兩盤種子。", place: "marker", act: "scene", actLabel: "聽選種課", need: 1, lines: ["班伯捏起一顆深色種子，又拿起一顆飽滿的。", "「深色的耐放，飽滿的長得快。你這一季要哪一種？」"] },
        { title: "替下一季選一盤種", where: "在選種盤旁邊選：耐放的一盤，或長得快的一盤。", place: "marker", act: "decision", need: 1, options: [
          { id: "sturdy", label: "耐放種", result: "拿到小麥種子 3 包", reward: { seedPacks: { wheat: 3 } } },
          { id: "quick", label: "快長種", result: "拿到堆肥 2 份", reward: { materials: { compost: 2 } } },
        ] },
        { title: "帶 2 包種子和 1 道料理給班伯", where: "備齊種子包和料理後，走到老農班伯旁邊交給他。", place: "npc", play: "cook", act: "seed_meal", actLabel: "把種子和料理帶給班伯", need: 1,
          ask: "「種子兩包，菜一道。帶齊了再來。」", thanks: "班伯把種子倒進木盤，夾了一口菜：「嗯。盤子留在井邊，每天來領一包。」" },
      ],
      brief: ["兩只選種盤已經擺到田邊。", "先聽班伯比較，再替下一季選一盤；最後帶種子和料理來。", "做完以後，每天可以向班伯領一次選種包。"],
      upgradeText: "每天向老農班伯請教時，多拿的當季種子從 1 包變成 2 包。",
      afterText: "班伯一邊吃我帶去的菜，一邊教我看種子的顏色和飽不飽滿；現在每天向他請教，他都多塞兩包當季種子給我。",
      daily: { id: "seed_lesson", label: "向班伯領今天的選種包", result: "拿到當季種子 2 包", reward: { seasonalSeed: 2 } },
      special: { kind: "新配方", variants: {
        sturdy: { name: "耐放留種法", want: { type: "seasonal", qty: 2 }, reward: { seasonalSeed: 3 }, line: "盤底壓著班伯的字：「深色的陰乾三天再收。兩份收成，留得出三包種。」" },
        quick: { name: "快長留種法", want: { type: "seasonal", qty: 2 }, reward: { seasonalSeed: 2, materials: { compost: 1 } }, line: "盤底壓著班伯的字：「飽的先泡水催芽。兩份收成，兩包種，剩下的渣拌成堆肥。」" },
      } },
      chatter: [
        "種子要陰乾。急著曬，芽就死在殼裡。",
        "飽的沉底，空的浮起來。泡一碗水就知道。",
        "好種留給明年，次的才下鍋。別弄反了。",
        "我爹留的那袋麥，傳到你這邊是第四手。",
        "下雨前螞蟻搬家。盤子我替你蓋好了。",
        "一年看苗，三年看種。不急。",
      ],
    },
    "merchant:sign": {
      id: "farm_sign", name: "招牌", npcId: "merchant", choiceId: "sign", colorStep: true,
      intro: ["蘿拉把三塊漆色樣板靠在還沒釘牢的農場牌下。", "「牌子不是裝飾。客人看見哪個顏色，就會記住哪種心情。」"],
      marker: { anchor: "structure:shop", spot: "市集攤前", art: ROUTE_ART.sign, earlyLabel: "招牌色樣", doneLabel: "農場招牌（{color}）" },
      steps: [
        { title: "和蘿拉比較三塊招牌色樣", where: "走到市集攤前的招牌色樣，和蘿拉比較三塊色樣。", place: "marker", act: "scene", actLabel: "看招牌色樣", need: 1, lines: ["蘿拉把三塊色樣排到陽光下。", "「紅色讓人想到甜果，藍色像河風，綠色則像剛冒芽。選色也會決定我送你的開張小禮。」"] },
        { title: "備齊 2 份木料把招牌釘牢", where: "市集建材行有木料；備齊後走到蘿拉旁邊交給她。", place: "npc", play: "market", act: "wood", actLabel: "把木料交給蘿拉", need: 2,
          ask: "「兩份木料，釘牢了才不怕風。建材行有賣，別買貴了。」", thanks: "蘿拉三兩下把牌子釘牢：「好了。去攤前的色樣那邊挑個顏色，客人以後就認它。」" },
        { title: "替招牌選一個顏色", where: "走到市集攤前的招牌色樣，三種顏色選一種。", place: "marker", play: "", act: "color", need: 1 },
      ],
      brief: ["三塊色樣已經靠在市集旁。", "先比較顏色，再用兩份木料釘牢；最後選色。", "三種顏色各有不同的開張小禮。"],
      upgradeText: "蘿拉的河畔委託金幣從多一成變成多兩成，地圖上的招牌換成你選的顏色。",
      afterText: "蘿拉把招牌釘牢，照我選的{color}重新漆過；她說遠遠就認得出是我家的貨，委託的酬勞從多一成變成多兩成。",
      daily: { id: "sign_care", label: "擦亮今天的農場招牌", result: "從招牌下找到木料 1 份", reward: { materials: { wood: 1 } } },
      special: { kind: "新訂單", variants: {
        red: { name: "莓果紅熟客單", want: { type: "meal", qty: 1 }, reward: { coins: 18, seedPacks: { strawberry: 1 } }, line: "招牌腳下壓著一張訂單：「看見紅招牌來的熟客，指名要一道你做的菜。十八金，外加一包草莓種子。」" },
        blue: { name: "河水藍熟客單", want: { type: "meal", qty: 1 }, reward: { coins: 18, sunlight: 1 }, line: "招牌腳下壓著一張訂單：「看見藍招牌來的熟客，指名要一道你做的菜。十八金，外加一點陽光。」" },
        green: { name: "嫩葉綠熟客單", want: { type: "meal", qty: 1 }, reward: { coins: 18, materials: { compost: 1 } }, line: "招牌腳下壓著一張訂單：「看見綠招牌來的熟客，指名要一道你做的菜。十八金，外加一份堆肥。」" },
      } },
      chatter: [
        "今天有個客人說，遠遠看到招牌就知道是你家的貨。這句話值三枚金幣。",
        "招牌歪了半指，我順手扶正了。門面的事，差一點都不行。",
        "下雨天顏色最漂亮。我叫擺攤的都抬頭看了一眼。",
        "有人問牌子是誰漆的，我說是農場主人自己挑的色。對方直說有眼光。",
        "記得常擦。灰一厚，客人會以為貨也放了很久。",
        "隔壁攤想照抄你的顏色，被我瞪回去了。",
      ],
    },
    "merchant:listen": {
      id: "customer_words", name: "客人的話", npcId: "merchant", choiceId: "listen",
      intro: ["蘿拉沒有先談價錢，而是在攤前多放了兩張客人留言卡。", "「願意先聽，就讓客人今天先留下話。」"],
      marker: { anchor: "structure:shop", spot: "市集攤前", art: ROUTE_ART.stamp, earlyLabel: "客人留言卡", doneLabel: "口味牌・{decision}" },
      steps: [
        { title: "和蘿拉讀今天的兩張留言卡", where: "走到市集攤前的客人留言卡，和蘿拉一起讀留言。", place: "marker", act: "scene", actLabel: "讀客人留言", need: 1, lines: ["一張留言想要甜一點的點心，另一張想帶清爽的作物去河邊。", "蘿拉說：「不能兩邊都先做。你要我先替哪一桌留貨？」"] },
        { title: "決定先回哪一種客人", where: "在客人留言卡旁邊選：先回甜口味，或先回清爽口味。", place: "marker", act: "decision", need: 1, options: [
          { id: "sweet", label: "先回甜口味", tag: "甜口味", result: "蘿拉給草莓種子 2 包試種", reward: { seedPacks: { strawberry: 2 } } },
          { id: "fresh", label: "先回清爽口味", tag: "清爽口味", result: "蘿拉給胡蘿蔔種子 3 包試種", reward: { seedPacks: { carrot: 3 } } },
        ] },
        { title: "帶 1 份今天特價的作物給蘿拉", where: "備好今天特價的作物後，走到蘿拉旁邊交給她。", place: "npc", play: "market", act: "special_crop", actLabel: "把特價作物交給蘿拉", need: 1,
          ask: "「帶一份今天特價的作物來，我拿去回客人的話。貨要新鮮，別拿隔夜的。」", thanks: "蘿拉把作物擺上攤：「客人的話我都記在口味牌上。以後每天多替你留一樣特價。」" },
      ],
      brief: ["兩張留言卡已經放到攤前。", "先讀留言、決定回哪一桌，再帶一份今天特價的作物來。", "做完以後，今日特價會多留第三樣。"],
      upgradeText: "蘿拉的今日特價從兩樣變成三樣。",
      afterText: "蘿拉把客人的話一句一句轉給我聽：有人誇上次的作物新鮮，也有人問下次能不能多留幾份；她說以後每天替我多留一樣特價。",
      special: { kind: "新配方", variants: {
        sweet: { name: "甜口味禮盒", want: { type: "deal", qty: 2 }, coinsRate: 1.5, reward: { coins: 6 }, line: "口味牌背面是蘿拉的字：「兩份今天特價的作物，裹上糖霜裝盒。甜口味的客人肯出一倍半的價，再加六金盒子錢。」" },
        fresh: { name: "清爽口味禮盒", want: { type: "deal", qty: 2 }, coinsRate: 1.2, reward: { seasonalSeed: 1 }, line: "口味牌背面是蘿拉的字：「兩份今天特價的作物，洗淨配薄荷葉裝盒。清爽口味的客人出價多兩成，還會回送一包種子。」" },
      } },
      chatter: [
        "今天的留言寫：「上次的菜很脆，還要。」你看，客人會自己回來。",
        "有個小孩畫了一顆草莓貼在板上。我沒捨得撕。",
        "三張留言裡有兩張在問價錢。先聽完，再開口，價才談得穩。",
        "河邊洗衣的大嬸說想要耐放一點的。我替你記下了。",
        "有人嫌貴，我請他先試一口。後來他買了兩份。",
        "留言板快滿了，這是好事。空板子才叫人擔心。",
      ],
    },
  };

  function questDef(npcId, choiceId) { return QUESTS[npcId + ":" + choiceId] || null; }
  function playsOf(def) { return def ? Array.from(new Set(def.steps.map((s) => s.play).filter((p) => PLAY_NAMES[p]))) : []; }
  function naturalName() { const care = G && G.FARM_CARE && G.FARM_CARE.natural; return care && care.name ? String(care.name) : "放著長"; }
  function cropName(id) { const c = C.CROPS && C.CROPS[id]; return c ? c.name : String(id); }
  function colorDef(id) { return SIGN_COLORS.find((c) => c.id === id) || null; }
  function driedIds() { return Sunplay && isObj(Sunplay.DRIED) ? Object.keys(Sunplay.DRIED) : DRIED_FALLBACK.slice(); }
  function fill(text, q) {
    const color = q && colorDef(q.color);
    return String(text || "").replace(/\{natural\}/g, naturalName()).replace(/\{color\}/g, color ? color.name : "顏色");
  }

  /* ---------- 存檔 ---------- */
  function storyChoices(state) {
    const a = isObj(state) && isObj(state.adventure) ? state.adventure : null;
    const r60 = a && isObj(a.r58) && isObj(a.r58.r59) && isObj(a.r58.r59.r60) ? a.r58.r59.r60 : null;
    return r60 && isObj(r60.storyChoices) ? r60.storyChoices : null;
  }
  function savedChoice(state, npcId) {
    const choices = storyChoices(state);
    const saved = choices && STORY_IDS[npcId] ? choices[STORY_IDS[npcId]] : null;
    return isObj(saved) && questDef(npcId, saved.choiceId) ? saved.choiceId : null;
  }
  /* R76 回訪看過了沒（只讀，不改 R76 的資料）。 */
  function followupSeen(state, npcId, choiceId) {
    const seen = isObj(state) && isObj(state.r76story) && isObj(state.r76story.seen) ? state.r76story.seen[npcId] : null;
    return isObj(seen) && seen.choiceId === choiceId;
  }
  function cleanQuest(q, def) {
    q.choiceId = String(q.choiceId);
    q.startedAt = Number.isFinite(q.startedAt) && q.startedAt > 0 ? q.startedAt : 0;
    q.step = Number.isInteger(q.step) ? Math.max(0, Math.min(3, q.step)) : 0;
    q.count = Number.isInteger(q.count) ? Math.max(0, Math.min(99, q.count)) : 0;
    q.seen = Array.isArray(q.seen) ? Array.from(new Set(q.seen.filter((v) => typeof v === "string" && v))).slice(0, 12) : [];
    q.doneAt = Array.isArray(q.doneAt) ? q.doneAt.filter((v) => Number.isFinite(v) && v >= 0).slice(0, 3) : [];
    q.color = colorDef(q.color) ? q.color : "";
    q.introSeen = q.introSeen === true;
    q.briefSeen = q.briefSeen === true;
    q.decision = typeof q.decision === "string" && def.steps.some((step) => Array.isArray(step.options) && step.options.some((o) => o.id === q.decision)) ? q.decision : "";
    q.decisionText = typeof q.decisionText === "string" ? q.decisionText.slice(0, 120) : "";
    q.decisionReward = typeof q.decisionReward === "string" ? q.decisionReward.slice(0, 120) : "";
    q.decisionAt = Number.isFinite(q.decisionAt) && q.decisionAt > 0 ? q.decisionAt : 0;
    q.upgraded = q.step >= 3;
    q.rewardedAt = Number.isFinite(q.rewardedAt) && q.rewardedAt > 0 ? q.rewardedAt : 0;
    const step = def.steps[q.step];
    if (step && step.distinct) q.count = Math.min(step.need, q.seen.length);
  }
  /* 正規化 state.adventure.r77；只刪掉對不上開場選擇的資料，不在這裡補發獎勵。 */
  function ensure(state) {
    if (!isObj(state) || !isObj(state.adventure)) return null;
    const a = state.adventure;
    if (!isObj(a.r77)) a.r77 = {};
    const r = a.r77;
    r.version = 2;
    if (!isObj(r.quests)) r.quests = {};
    if (!isObj(r.daily)) r.daily = {};
    if (typeof r.daily.mayorSwapDay !== "string") r.daily.mayorSwapDay = "";
    const choices = storyChoices(state);
    for (const npcId of Object.keys(r.quests)) {
      const q = r.quests[npcId];
      const def = NPC_ORDER.includes(npcId) && isObj(q) ? questDef(npcId, q.choiceId) : null;
      const saved = choices ? choices[STORY_IDS[npcId]] : null;
      if (!def || (choices && !(isObj(saved) && saved.choiceId === q.choiceId))) { delete r.quests[npcId]; continue; }
      cleanQuest(q, def);
    }
    return r;
  }

  /* ---------- 通知 ---------- */
  const notes = [];
  let listener = null;
  function emit(kind) { if (typeof listener === "function") { try { listener(kind); } catch (_) { /* 畫面更新失敗不擋進度 */ } } }
  function pushNote(text) {
    if (!text) return;
    notes.push(String(text));
    if (notes.length > 12) notes.splice(0, notes.length - 12);
    emit("note");
  }
  function takeNotes() { return notes.splice(0, notes.length); }
  function pendingNotes() { return notes.slice(); }
  function setListener(fn) { listener = typeof fn === "function" ? fn : null; }

  /* R78C：開場回答一落定就開始角色事件；舊存檔載入時也立即補上，不再等隔天回訪。 */
  function sync(state, now, opts) {
    const r = ensure(state);
    if (!r) return [];
    const t = nowOf(now);
    const started = [];
    for (const npcId of NPC_ORDER) {
      if (r.quests[npcId]) continue;
      const choiceId = savedChoice(state, npcId);
      if (!choiceId) continue;
      r.quests[npcId] = { choiceId, startedAt: t, step: 0, count: 0, seen: [], doneAt: [], upgraded: false, color: "", introSeen: false, briefSeen: false, decision: "", decisionText: "", decisionReward: "", decisionAt: 0, rewardedAt: 0 };
      started.push(npcId);
    }
    if (started.length && !(opts && opts.silent)) {
      if (started.length === 1) {
        const def = questDef(started[0], r.quests[started[0]].choiceId);
        pushNote(NPC_NAMES[started[0]] + "現在就改變了農場：角色事件「" + def.name + "」開始，三個步驟寫在手札「我做過的選擇」。");
      } else {
        pushNote(started.map((id) => NPC_NAMES[id]).join("、") + "的選擇事件已經開始：" + started.map((id) => "「" + questDef(id, r.quests[id].choiceId).name + "」").join("、") + "，步驟寫在手札「我做過的選擇」。");
      }
    }
    if (started.length) emit("change");
    return started;
  }
  /* R76 回訪剛播完：開始後續委託，並把這次交談算進去（ui.js 是先記交談再開回訪）。 */
  function onFollowupSeen(state, npcId, now) {
    const started = sync(state, now);
    const r = ensure(state), q = r && r.quests[npcId];
    if (!q || q.briefSeen) return false;
    q.briefSeen = true;
    emit("change");
    return true;
  }

  function currentStep(r, npcId) {
    const q = r && r.quests[npcId];
    const def = q ? questDef(npcId, q.choiceId) : null;
    return q && def && q.step < 3 ? { q, def, step: def.steps[q.step] } : null;
  }
  function completeStep(state, npcId, t) {
    const r = ensure(state);
    const q = r && r.quests[npcId];
    const def = q ? questDef(npcId, q.choiceId) : null;
    if (!q || !def || q.step >= 3) return;
    q.step += 1; q.count = 0; q.seen = []; q.doneAt.push(t);
    if (q.step < 3) {
      pushNote("後續委託「" + def.name + "」第 " + q.step + " 步完成！下一步：" + fill(def.steps[q.step].title, q) + "。");
      return;
    }
    q.upgraded = true;
    if (!q.rewardedAt) {
      q.rewardedAt = t;
      state.coins = (Number.isFinite(state.coins) ? state.coins : 0) + REWARD_COINS;
      if (!isObj(state.stats)) state.stats = {};
      state.stats.totalCoinsEarned = (Number.isFinite(state.stats.totalCoinsEarned) ? state.stats.totalCoinsEarned : 0) + REWARD_COINS;
      if (G && typeof G.addXp === "function") G.addXp(state, REWARD_XP);
      else state.xp = (Number.isFinite(state.xp) ? state.xp : 0) + REWARD_XP;
    }
    pushNote("後續委託「" + def.name + "」三步都完成了，拿到 " + REWARD_COINS + " 金和 " + REWARD_XP + " 點經驗。" + def.upgradeText);
  }
  /* 遊戲事件推進：每條委託只看「目前這一步」，一次事件最多推進一步。 */
  function dispatch(state, types, id, now, onlyNpc) {
    const r = ensure(state);
    if (!r) return [];
    const t = nowOf(now);
    sync(state, t);
    const moved = [];
    for (const npcId of NPC_ORDER) {
      if (onlyNpc && npcId !== onlyNpc) continue;
      const cur = currentStep(r, npcId);
      if (!cur || !cur.step.event || !types.includes(cur.step.event)) continue;
      const { q, step } = cur;
      if (step.ids && !step.ids.includes(id)) continue;
      const last = q.doneAt.length ? q.doneAt[q.doneAt.length - 1] : -Infinity;
      if (step.event === "talk" && t >= last && t - last < TALK_GAP_MS) continue;
      if (step.distinct) {
        if (!id || q.seen.includes(id)) continue;
        q.seen.push(id);
        q.count = q.seen.length;
      } else q.count += 1;
      if (q.count >= step.need) completeStep(state, npcId, t);
      moved.push(npcId);
    }
    if (moved.length) emit("change");
    return moved;
  }
  function needsEvent(state, eventName) {
    const r = ensure(state);
    return !!r && NPC_ORDER.some((npcId) => { const cur = currentStep(r, npcId); return !!(cur && cur.step.event === eventName); });
  }
  function todaySpecialIds(state, now) {
    if (!M || typeof M.merchantSpecial !== "function") return [];
    try {
      const s = M.merchantSpecial(state, nowOf(now));
      return (Array.isArray(s.deals) && s.deals.length ? s.deals : [s]).map((d) => d.cropId).filter(Boolean);
    } catch (_) { return []; }
  }
  function noteHarvest(state, info, now) {
    const types = [];
    if (info && info.sunlit) types.push("sun_harvest");
    if (info && info.natural) types.push("natural_harvest");
    return types.length ? dispatch(state, types, "", now) : [];
  }
  function noteSold(state, itemId, now) {
    const base = String(itemId || "").replace(/_(good|premium)$/, "");
    if (!C.CROPS || !C.CROPS[base]) return [];
    if (!ensure(state)) return [];
    sync(state, now);
    const types = ["sold"];
    if (needsEvent(state, "sold_special") && todaySpecialIds(state, now).includes(base)) types.push("sold_special");
    return dispatch(state, types, base, now);
  }
  function noteTalk(state, npcId, now) { return TALK_NPCS.includes(npcId) ? dispatch(state, ["talk"], npcId, now) : []; }
  function noteOrder(state, npcId, now, opts) {
    if (!TALK_NPCS.includes(npcId)) return [];
    const types = [npcId + "_order"];
    if (opts && opts.meal) types.push("meal_" + npcId);
    return dispatch(state, types, "", now);
  }
  function noteDried(state, itemId, now) { return dispatch(state, ["dried"], String(itemId || ""), now); }

  /* ---------- 手札按鈕交付 ---------- */
  function fail(reason, message) { return { ok: false, reason, message }; }
  function storageItems(state) { return isObj(state.storage) && isObj(state.storage.items) ? state.storage.items : {}; }
  function takeItem(items, id, n) { items[id] = (items[id] || 0) - n; if (items[id] <= 0) delete items[id]; }
  function woodOf(state) { return isObj(state.materials) && Number.isFinite(state.materials.wood) ? state.materials.wood : 0; }
  function driedTotal(state) { const items = storageItems(state); return driedIds().reduce((s, id) => s + (items[id] > 0 ? items[id] : 0), 0); }
  function mealsOf(state) { return isObj(state.adventure) && isObj(state.adventure.meals) ? state.adventure.meals : {}; }
  function mealTotal(state) { return Object.values(mealsOf(state)).reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0); }
  function seedPacksOf(state) {
    const a = state.adventure;
    return isObj(a) && isObj(a.r58) && isObj(a.r58.r59) && isObj(a.r58.r59.seedPacks) ? a.r58.r59.seedPacks : {};
  }
  function seedPackTotal(state) { return Object.values(seedPacksOf(state)).reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0); }
  function takeSeedPacks(state, n) {
    const packs = seedPacksOf(state);
    let left = n;
    while (left > 0) {
      const id = Object.keys(packs).filter((k) => packs[k] > 0).sort((x, y) => packs[y] - packs[x])[0];
      if (!id) break;
      packs[id] -= 1; left -= 1;
    }
    return n - left;
  }
  function addSeedPacks(state, plan) {
    const packs = seedPacksOf(state);
    for (const id of Object.keys(plan || {})) packs[id] = Math.min(99, Math.max(0, packs[id] || 0) + Math.max(0, Math.floor(plan[id] || 0)));
  }
  function seasonalCropId(state) {
    if (K && typeof K.seasonalCropId === "function") return K.seasonalCropId(state);
    const level = Number.isFinite(state.level) ? state.level : 1;
    const season = state.season && state.season.id;
    const ids = Object.keys(C.CROPS || {}).filter((id) => (C.CROPS[id].unlockLevel || 1) <= level && (!C.CROPS[id].season || C.CROPS[id].season === season));
    return ids[ids.length - 1] || "wheat";
  }
  function rewardText(reward, state) {
    const parts = [];
    if (reward && reward.coins) parts.push(reward.coins + " 金");
    for (const id of Object.keys((reward && reward.materials) || {})) parts.push(cropName(id) === id && C.MATERIALS && C.MATERIALS[id] ? C.MATERIALS[id].name + " " + reward.materials[id] + " 份" : id + " " + reward.materials[id] + " 份");
    for (const id of Object.keys((reward && reward.seedPacks) || {})) parts.push(cropName(id) + "種子 " + reward.seedPacks[id] + " 包");
    for (const id of Object.keys((reward && reward.items) || {})) parts.push(cropName(id) + " " + reward.items[id] + " 份");
    if (reward && reward.seasonalSeed) parts.push(cropName(seasonalCropId(state)) + "種子 " + reward.seasonalSeed + " 包");
    if (reward && reward.sunlight) parts.push("陽光 " + reward.sunlight + " 點");
    return parts.join("、");
  }
  function grantChoiceReward(state, reward) {
    if (!isObj(reward)) return "";
    if (reward.coins) {
      state.coins = Math.max(0, Number.isFinite(state.coins) ? state.coins : 0) + reward.coins;
      if (!isObj(state.stats)) state.stats = {};
      state.stats.totalCoinsEarned = Math.max(0, Number.isFinite(state.stats.totalCoinsEarned) ? state.stats.totalCoinsEarned : 0) + reward.coins;
    }
    if (!isObj(state.materials)) state.materials = {};
    for (const id of Object.keys(reward.materials || {})) state.materials[id] = Math.max(0, state.materials[id] || 0) + reward.materials[id];
    const items = storageItems(state);
    for (const id of Object.keys(reward.items || {})) items[id] = Math.max(0, items[id] || 0) + reward.items[id];
    addSeedPacks(state, reward.seedPacks || {});
    if (reward.seasonalSeed) addSeedPacks(state, { [seasonalCropId(state)]: reward.seasonalSeed });
    if (reward.sunlight && Sunplay && typeof Sunplay.addSunlight === "function") Sunplay.addSunlight(state, reward.sunlight);
    return rewardText(reward, state);
  }
  function shareMeal(state, npcId, t) {
    const meals = mealsOf(state);
    const recipeId = Object.keys(meals).filter((id) => (meals[id] || 0) >= 1).sort((x, y) => meals[y] - meals[x])[0];
    if (!recipeId) return fail("missing_meal", "餐籃裡還沒有料理，先去農舍灶台做一份。");
    if (K && typeof K.shareBestMeal === "function") {
      const r = K.shareBestMeal(state, recipeId, npcId, t);
      return r && r.ok ? r : fail("missing_meal", (r && r.message) || "餐籃裡還沒有料理，先去農舍灶台做一份。");
    }
    meals[recipeId] -= 1;
    if (meals[recipeId] <= 0) delete meals[recipeId];
    return { ok: true, recipeId };
  }
  function lastNote() { return notes.length ? notes[notes.length - 1] : ""; }
  /* R79C：招牌三色各自的開張小禮（第一次選色時送；之後改漆不再送）。 */
  function colorGift(id) { return id === "red" ? { seedPacks: { strawberry: 2 } } : id === "blue" ? { sunlight: 2 } : { materials: { compost: 2 } }; }
  function act(state, npcId, now, arg) {
    const r = ensure(state);
    if (!r) return fail("bad_state", "存檔還沒準備好，稍後再試一次。");
    const t = nowOf(now);
    sync(state, t);
    const q = r.quests[npcId];
    const def = q ? questDef(npcId, q.choiceId) : null;
    if (!q || !def) return fail("no_quest", (NPC_NAMES[npcId] || "這位鄰居") + "還沒有交代後續委託。");
    if (q.step >= 3) {
      if (def.colorStep && arg) {
        const c = colorDef(arg);
        if (!c) return fail("pick_color", "先從三種顏色裡選一種。");
        q.color = c.id;
        pushNote("招牌改漆成" + c.name + "了。");
        emit("change");
        return { ok: true, npcId, step: q.step, color: c.id, message: lastNote() };
      }
      return fail("done", "後續委託「" + def.name + "」已經做完了。");
    }
    const step = def.steps[q.step];
    if (!step.act) return fail("not_here", "這一步不用在手札按，去哪裡做：" + fill(step.where, q));
    const done = () => { completeStep(state, npcId, t); emit("change"); return { ok: true, npcId, step: q.step, message: lastNote() }; };
    const items = storageItems(state);
    if (step.act === "scene" || step.act === "scene_close") {
      q.introSeen = true;
      q.sceneLines = Array.isArray(step.lines) ? step.lines.slice(0, 4) : [];
      const lines = q.sceneLines;
      completeStep(state, npcId, t);
      emit("change");
      return { ok: true, npcId, step: q.step, lines, message: lines.join(" ") };
    }
    if (step.act === "decision") {
      const option = (step.options || []).find((row) => row.id === arg);
      if (!option) return fail("pick_decision", "先選一個做法；兩個結果拿到的東西不同。");
      if (q.decision) return fail("already_decided", "這次已經選了「" + q.decisionText + "」，手札會一直記著。");
      const got = grantChoiceReward(state, option.reward || {});
      q.decision = option.id; q.decisionText = option.label; q.decisionReward = got || option.result; q.decisionAt = t;
      completeStep(state, npcId, t);
      emit("change");
      return { ok: true, npcId, step: q.step, decision: option.id, rewardText: q.decisionReward, message: "你選了「" + option.label + "」；" + option.result + "。" };
    }
    if (step.act === "give_dried") {
      const id = driedIds().filter((d) => (items[d] || 0) >= 1).sort((x, y) => (items[y] || 0) - (items[x] || 0))[0];
      if (!id) return fail("missing_dried", "倉庫裡沒有日曬乾貨，先到曬架曬一批。");
      takeItem(items, id, 1);
      return done();
    }
    if (step.act === "meal") {
      const shared = shareMeal(state, step.actNpc || npcId, t);
      if (!shared.ok) return shared;
      return done();
    }
    if (step.act === "wood") {
      const wood = woodOf(state);
      if (wood < 2) return fail("missing_wood", "木料還差 " + (2 - wood) + " 份，蘿拉的市集「建材行」買得到。");
      state.materials.wood = wood - 2;
      return done();
    }
    if (step.act === "special_crop") {
      const ids = todaySpecialIds(state, t);
      const id = ids.find((c) => (items[c] || 0) >= 1);
      if (!id) return fail("missing_special", "倉庫裡還沒有蘿拉今天特價的作物（今天是" + ids.map(cropName).join("、") + "）。");
      takeItem(items, id, 1);
      return done();
    }
    if (step.act === "seed_meal") {
      const packs = seedPackTotal(state);
      const meals = mealTotal(state);
      if (packs < 2 || meals < 1) {
        const gaps = [packs < 2 ? "種子包還差 " + (2 - packs) + " 包" : "", meals < 1 ? "料理還差 1 份" : ""].filter(Boolean).join("、");
        return fail("missing_seed_meal", gaps + "。用「" + naturalName() + "」收成會退回種子包，料理在農舍灶台做。");
      }
      const shared = shareMeal(state, "elder", t);
      if (!shared.ok) return shared;
      takeSeedPacks(state, 2);
      return done();
    }
    if (step.act === "color") {
      const c = colorDef(arg);
      if (!c) return fail("pick_color", "先從三種顏色裡選一種。");
      q.color = c.id;
      q.decision = c.id; q.decisionText = c.name;
      q.decisionReward = grantChoiceReward(state, colorGift(c.id)); q.decisionAt = t;
      return done();
    }
    return fail("unknown_step", "這一步還不能在這裡做。");
  }

  /* ---------- 升級後才有的動作 ---------- */
  function dayKeyOf(t) { return M && typeof M.dayKey === "function" ? M.dayKey(t) : new Date(t).toISOString().slice(0, 10); }
  function upgraded(state, npcId) { return !!(A && typeof A.r77Upgraded === "function" && A.r77Upgraded(state, npcId)); }
  function dailyInfo(state, npcId, now) {
    const t = nowOf(now), r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!q || q.step < 3 || !def || !def.daily) return { eligible: false, can: false };
    const key = "route:" + def.daily.id, today = dayKeyOf(t), used = r.daily[key] === today;
    return { eligible: true, can: !used, used, today, key, label: def.daily.label, result: def.daily.result };
  }
  function takeDaily(state, npcId, now) {
    const info = dailyInfo(state, npcId, now), r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!info.eligible || !def || !def.daily) return fail("locked", "先完成這條角色事件，地圖上的新互動才會留下來。");
    if (!info.can) return fail("daily_limit", "今天已經互動過了，明天再來。");
    const got = grantChoiceReward(state, def.daily.reward || {});
    r.daily[info.key] = info.today;
    emit("change");
    return { ok: true, npcId, rewardText: got, message: def.daily.result + "。" };
  }

  /* ---------- R79C：每個選擇解鎖、有名字的新訂單或新配方 ---------- */
  const RATE_TEXT = { 1: "照市價", 1.1: "比市價多一成", 1.2: "比市價多兩成", 1.3: "比市價多三成", 1.5: "市價的一倍半" };
  /* 依第二步的決定（招牌是顏色）挑出這條路線解鎖的那一項；還沒決定就回 null。 */
  function specialVariant(def, q) {
    if (!def || !def.special || !q) return null;
    const key = def.colorStep ? q.color : q.decision;
    return key && def.special.variants[key] ? def.special.variants[key] : null;
  }
  function optionLabelOf(def, key) {
    if (def.colorStep) { const c = colorDef(key); return c ? c.name : key; }
    for (const step of def.steps) { const o = (step.options || []).find((row) => row.id === key); if (o) return o.label; }
    return key;
  }
  /* 手札與對話框用：做完三步會解鎖什麼（已經決定就只講那一項）。 */
  function unlockText(def, q) {
    if (!def || !def.special) return "";
    const v = specialVariant(def, q);
    if (v) return def.special.kind + "「" + v.name + "」";
    return def.special.kind + Object.keys(def.special.variants).map((key) => "「" + def.special.variants[key].name + "」（選" + optionLabelOf(def, key) + "）").join("或");
  }
  function wantPlan(state, want, t) {
    if (want.type === "meal") { const have = mealTotal(state); return { kind: "meal", itemId: "", have, need: want.qty, text: "任一道料理 " + want.qty + " 道" }; }
    const items = storageItems(state);
    const ids = want.type === "seasonal" ? [seasonalCropId(state)]
      : want.type === "deal" ? todaySpecialIds(state, t)
        : Object.keys(items).filter((id) => C.CROPS && C.CROPS[id] && items[id] > 0).sort((x, y) => items[y] - items[x]);
    const pick = ids.find((id) => (items[id] || 0) >= want.qty) || ids.slice().sort((x, y) => (items[y] || 0) - (items[x] || 0))[0] || "";
    const have = pick ? Math.max(0, items[pick] || 0) : 0;
    const text = want.type === "seasonal" ? "當季的" + cropName(pick) + " " + want.qty + " 份"
      : want.type === "deal" ? "今天特價的作物 " + want.qty + " 份（今天是" + (ids.length ? ids.map(cropName).join("或") : "還沒公布") + "）"
        : "同一種作物 " + want.qty + " 份" + (pick ? "（倉庫裡最多的是" + cropName(pick) + "，有 " + have + " 份）" : "");
    return { kind: "crop", itemId: pick, have, need: want.qty, text };
  }
  function specialCoins(v, itemId) {
    const sell = itemId && C.CROPS && C.CROPS[itemId] ? C.CROPS[itemId].sellValue || 1 : 0;
    return (v.coinsRate && sell ? Math.round(v.want.qty * sell * v.coinsRate) : 0) + ((v.reward && v.reward.coins) || 0);
  }
  function specialRewardText(state, v, itemId) {
    const other = Object.assign({}, v.reward || {}); delete other.coins;
    const parts = [];
    if (v.coinsRate && !itemId) parts.push(RATE_TEXT[v.coinsRate] + "算的金幣" + (v.reward && v.reward.coins ? "，再加 " + v.reward.coins + " 金" : ""));
    else { const coins = specialCoins(v, itemId); if (coins) parts.push(coins + " 金" + (v.coinsRate ? "（" + RATE_TEXT[v.coinsRate] + (v.reward && v.reward.coins ? "，另加 " + v.reward.coins + " 金" : "") + "）" : "")); }
    const rest = rewardText(other, state);
    if (rest) parts.push(rest);
    return parts.join("、");
  }
  function specialInfo(state, npcId, now) {
    const t = nowOf(now), r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!q || !def || !def.special) return { eligible: false, can: false };
    const v = specialVariant(def, q);
    if (q.step < 3 || !v) return { eligible: false, can: false, kind: def.special.kind, unlockText: unlockText(def, q) };
    const key = "special:" + def.id, today = dayKeyOf(t), used = r.daily[key] === today;
    const plan = wantPlan(state, v.want, t), enough = plan.have >= plan.need;
    return { eligible: true, kind: def.special.kind, name: v.name, used, enough, can: !used && enough, key, today, wantText: plan.text,
      have: plan.have, need: plan.need, itemId: plan.itemId, rewardText: specialRewardText(state, v, plan.itemId), line: v.line,
      missingText: enough ? "" : "還差 " + (plan.need - plan.have) + (plan.kind === "meal" ? " 道料理" : " 份"), unlockText: unlockText(def, q) };
  }
  function takeSpecial(state, npcId, now) {
    const t = nowOf(now), info = specialInfo(state, npcId, t), r = ensure(state);
    if (!info.eligible) return fail("locked", "先完成這條角色事件，才會解鎖有名字的新訂單或新配方。");
    if (info.used) return fail("daily_limit", "「" + info.name + "」今天做過了，明天再來。");
    if (!info.enough) return fail("missing_special", "「" + info.name + "」要" + info.wantText + "，" + info.missingText + "。");
    const q = r.quests[npcId], def = questDef(npcId, q.choiceId), v = specialVariant(def, q);
    if (v.want.type === "meal") { const shared = shareMeal(state, npcId, t); if (!shared.ok) return shared; }
    else takeItem(storageItems(state), info.itemId, v.want.qty);
    const reward = Object.assign({}, v.reward || {});
    const coins = specialCoins(v, v.want.type === "meal" ? "" : info.itemId);
    if (coins) reward.coins = coins; else delete reward.coins;
    const got = grantChoiceReward(state, reward);
    r.daily[info.key] = info.today;
    emit("change");
    return { ok: true, npcId, name: info.name, rewardText: got, message: "完成「" + info.name + "」，拿到" + got + "。" };
  }
  /* 物件旁每天輪替的一句鄰居對白（同一天固定同一句）。 */
  function dailyLine(state, npcId, now) {
    const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!def || !Array.isArray(def.chatter) || !def.chatter.length) return "";
    const ms = Date.parse(dayKeyOf(nowOf(now)) + "T00:00:00Z");
    const day = Math.floor((Number.isFinite(ms) ? ms : nowOf(now)) / 86400000);
    return def.chatter[((day % def.chatter.length) + def.chatter.length) % def.chatter.length];
  }
  /* 地圖上的物件在哪裡（給「帶我去」與對話用）：目前步驟要找鄰居就回 npc，其餘都是那個物件。 */
  function stepPlace(state, npcId) {
    const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!q || !def) return "";
    if (q.step >= 3) return "marker";
    return def.steps[q.step].place || "marker";
  }
  function mayorSwapInfo(state, now) {
    const t = nowOf(now);
    const r = ensure(state);
    const eligible = !!(r && savedChoice(state, "mayor") === "town" && upgraded(state, "mayor"));
    if (!eligible || !M || typeof M.mayorQuest !== "function") return { eligible: false, can: false };
    const quest = M.mayorQuest(state, t);
    const today = dayKeyOf(t);
    const swapped = r.daily.mayorSwapDay === today;
    return { eligible: true, can: !quest.claimed && !swapped, claimed: !!quest.claimed, swapped, today, quest };
  }
  /* 做完「鎮上的事」：鎮長的每日委託每天可以換一次，優先換成倉庫裡已經夠數的作物。 */
  function swapMayorQuest(state, now) {
    const t = nowOf(now);
    const info = mayorSwapInfo(state, t);
    if (!info.eligible) return fail("locked", "做完後續委託「鎮上的事」之後，才能換鎮長的委託。");
    if (info.claimed) return fail("claimed", "今天的鎮公所委託已經交了，明天再來換。");
    if (info.swapped) return fail("daily_limit", "今天已經換過一次鎮長的委託了，明天再換。");
    const q = info.quest;
    const level = Number.isFinite(state.level) ? state.level : 1;
    const season = state.season && state.season.id;
    const pool = Object.values(C.CROPS || {}).filter((c) => (c.unlockLevel || 1) <= level && (!c.season || c.season === season)).map((c) => c.id);
    const items = storageItems(state);
    const others = pool.filter((id) => id !== q.cropId);
    let cropId = others.find((id) => (items[id] || 0) >= q.qty);
    if (!cropId) cropId = others.length ? (pool.indexOf(q.cropId) >= 0 ? pool[(pool.indexOf(q.cropId) + 1) % pool.length] : others[0]) : q.cropId;
    const qty = cropId === q.cropId ? (q.qty === 2 ? 3 : 2) : q.qty;
    const sell = (C.CROPS[cropId] && C.CROPS[cropId].sellValue) || 1;
    const base = qty * sell * 3 + 12;
    state.adventure.r66b.mayorQuest = { day: M.mayorQuest(state, t).day, cropId, qty, baseRewardCoins: base, rewardCoins: base, rewardXp: q.rewardXp || 6, claimed: false };
    ensure(state).daily.mayorSwapDay = info.today;
    const next = M.mayorQuest(state, t);
    emit("change");
    return { ok: true, cropId, cropName: next.cropName, qty, rewardCoins: next.rewardCoins, message: "鎮長換了一張委託：今天改收 " + qty + " 份" + next.cropName + "，完成給 " + next.rewardCoins + " 金。" };
  }
  function thirdDeal(state, now) {
    if (savedChoice(state, "merchant") !== "listen" || !M || typeof M.merchantSpecial !== "function") return null;
    const s = M.merchantSpecial(state, nowOf(now));
    return Array.isArray(s.deals) && s.deals.length > 2 ? s.deals[2] : null;
  }

  /* ---------- 手札畫面 ---------- */
  function waitingHint(npcId) {
    const name = NPC_NAMES[npcId];
    const he = PRONOUN[npcId] || "他";
    if (npcId === "mayor") return "隔天再去找" + name + "聊聊，" + he + "還有一件事要交代。";
    return "再去找" + name + "聊聊（隔天再去，或先送" + he + "兩次餐籃或河畔委託），" + he + "還有一件事要交代。";
  }
  function whereOf(state, step, q, t) {
    let text = fill(step.where, q);
    if (step.act === "special_crop") {
      const ids = todaySpecialIds(state, t);
      if (ids.length) text += "今天特價的是" + ids.map(cropName).join("、") + "。";
    }
    return text;
  }
  function stepProgress(state, def, q, i, t) {
    const step = def.steps[i];
    if (i < q.step) return "進度 " + step.need + "/" + step.need;
    if (i > q.step) return "進度 0/" + step.need;
    if (step.act === "wood") return "木料 " + Math.min(2, woodOf(state)) + "/2";
    if (step.act === "give_dried") return "日曬乾貨 " + Math.min(1, driedTotal(state)) + "/1";
    if (step.act === "meal" && !step.event) return "料理 " + Math.min(1, mealTotal(state)) + "/1";
    if (step.act === "meal") return "進度 0/1・手上的料理 " + Math.min(1, mealTotal(state)) + "/1";
    if (step.act === "special_crop") { const items = storageItems(state); return "進度 0/1・手上的特價作物 " + (todaySpecialIds(state, t).some((id) => (items[id] || 0) >= 1) ? 1 : 0) + "/1"; }
    if (step.act === "seed_meal") return "種子包 " + Math.min(2, seedPackTotal(state)) + "/2・料理 " + Math.min(1, mealTotal(state)) + "/1";
    if (step.act === "color") return "進度 0/1";
    return "進度 " + Math.min(q.count, step.need) + "/" + step.need;
  }
  function questView(state, npcId, now) {
    const t = nowOf(now);
    const choiceId = savedChoice(state, npcId);
    if (!choiceId) return null;
    const def = questDef(npcId, choiceId);
    const r = ensure(state);
    if (!r) return null;
    sync(state, t);
    const q = r.quests[npcId];
    if (!q) return { npcId, choiceId, name: def.name, status: "waiting", stepsDone: 0, hint: waitingHint(npcId), plays: playsOf(def), steps: [] };
    const steps = def.steps.map((step, i) => ({
      index: i + 1, title: fill(step.title, q), where: whereOf(state, step, q, t), play: step.play || "", playName: PLAY_NAMES[step.play] || "",
      status: i < q.step ? "done" : i === q.step ? "current" : "todo", progress: stepProgress(state, def, q, i, t),
      act: i === q.step ? step.act || "" : "", actLabel: i === q.step && step.act && step.act !== "color" ? step.actLabel : "", place: step.place || "marker",
      options: i === q.step && step.act === "decision" ? (step.options || []).map((option) => ({ id: option.id, label: option.label, result: option.result,
        unlock: def.special && def.special.variants[option.id] ? def.special.kind + "「" + def.special.variants[option.id].name + "」" : "" })) : [],
    }));
    return { npcId, choiceId, name: def.name, status: q.step >= 3 ? "done" : "active", stepsDone: q.step, steps, upgraded: q.step >= 3,
      upgradeText: def.upgradeText, afterText: q.step >= 3 ? fill(def.afterText, q) : "", color: q.color, colorStep: !!def.colorStep,
      decision: q.decision, decisionText: q.decisionText, decisionReward: q.decisionReward, spot: def.marker.spot || "", objectName: def.marker.earlyLabel,
      daily: dailyInfo(state, npcId, t), special: specialInfo(state, npcId, t), unlockText: unlockText(def, q), plays: playsOf(def), rewardCoins: REWARD_COINS, rewardXp: REWARD_XP };
  }
  function cardHtml(state, npcId, now) {
    const t = nowOf(now);
    const v = questView(state, npcId, t);
    if (!v) return "";
    const head = '<div class="r77b-quest" data-r77b-quest="' + esc(npcId) + '" data-r77b-state="' + esc(v.status) + '" data-r77b-done="' + v.stepsDone + '">';
    if (v.status === "waiting") return head + '<p class="r77b-quest-title">後續委託<span class="r77b-quest-count">還沒開始</span></p><p class="r77b-hint">' + esc(v.hint) + "</p></div>";
    let html = head + '<p class="r77b-quest-title">後續委託：' + esc(v.name) + '<span class="r77b-quest-count">' + (v.status === "done" ? "三步都完成了" : "已完成 " + v.stepsDone + "/3 步") + "</span></p>"
      + '<ol class="r77b-steps">' + v.steps.map((s) => '<li class="r77b-step is-' + s.status + '" data-r77b-step="' + s.index + '">'
        + '<span class="r77b-step-name">' + (s.status === "done" ? "✓ " : "") + "第 " + s.index + " 步：" + esc(s.title) + "</span>"
        + (s.playName ? '<span class="r77b-play">' + esc(s.playName) + "</span>" : "")
        + '<span class="r77b-progress">' + esc(s.progress) + "</span>"
        + (s.status !== "done" ? '<span class="r77b-where">去哪裡做：' + esc(s.where) + "</span>" : "")
        /* R79C：手札不再有直接完成步驟的按鈕；決定只預覽，真正的選擇在地圖上那個物件旁邊做。 */
        + (s.options && s.options.length ? '<div class="r78c-decisions" data-r78c-decisions>' + s.options.map((option) => '<span class="r79c-option" data-r78c-decision="' + esc(option.id) + '"><b>' + esc(option.label) + '</b><small>馬上拿到：' + esc(option.result) + "</small>" + (option.unlock ? "<small>做完三步解鎖：" + esc(option.unlock) + "</small>" : "") + "</span>").join("") + "</div>" : "")
        + (s.status === "current" ? '<button type="button" class="r79c-go" data-r79c-go="' + esc(npcId) + '">帶我去</button>' : "")
        + "</li>").join("") + "</ol>";
    if (v.colorStep && (v.status === "done" || (v.steps[2] && v.steps[2].status === "current"))) {
      html += '<div class="r77b-colors" data-r77b-colors role="list" aria-label="招牌顏色（到市集攤前的色樣旁邊選）">' + SIGN_COLORS.map((c) => '<span class="r79c-swatch-chip" role="listitem" data-r77b-color="' + c.id + '" aria-current="' + (v.color === c.id ? "true" : "false") + '"><i class="r77b-swatch" style="background:' + c.swatch + '"></i>' + esc(c.name) + "</span>").join("") + "</div>";
    }
    if (v.decisionText) html += '<p class="r78c-decision-record" data-r78c-decision-record>我選了：<b>' + esc(v.decisionText) + '</b>・拿到：' + esc(v.decisionReward) + "</p>";
    if (!v.upgraded && v.unlockText) html += '<p class="r79c-unlock" data-r79c-unlock>做完三步會解鎖：' + esc(v.unlockText) + "</p>";
    if (v.upgraded) html += '<p class="r77b-upgrade" data-r77b-upgrade>永久改變（已含原本加成）：' + esc(v.upgradeText) + "</p>";
    if (v.upgraded) {
      const def = questDef(npcId, v.choiceId), r = ensure(state), q = r && r.quests[npcId];
      const objectName = def.colorStep ? signLabel(state) : fill(def.marker.doneLabel.split("・")[0], q);
      const rows = [];
      if (v.daily && v.daily.eligible) rows.push('<li class="r78c-daily" data-r79c-daily="' + esc(npcId) + '">每天一次：' + esc(v.daily.label) + "——" + esc(v.daily.result) + "（" + (v.daily.can ? "今天還沒做" : "今天做過了") + "）</li>");
      const sp = v.special;
      if (sp && sp.eligible) rows.push('<li data-r79c-special="' + esc(npcId) + '"><b>' + esc(sp.kind) + "「" + esc(sp.name) + "」</b>：交" + esc(sp.wantText) + "，換" + esc(sp.rewardText) + "（" + (sp.used ? "今天做過了" : sp.enough ? "今天可以做" : esc(sp.missingText)) + "）</li>");
      if (npcId === "mayor" && v.choiceId === "town") {
        const info = mayorSwapInfo(state, t);
        if (info.eligible) rows.push('<li data-r77b-swap-box>換鎮長委託：今天鎮長想收 ' + esc(info.quest.qty) + " 份" + esc(info.quest.cropName) + "，完成給 " + esc(info.quest.rewardCoins) + " 金（" + (info.can ? "今天還能換一次" : info.claimed ? "今天的委託已經交了" : "今天已經換過了") + "）</li>");
      }
      if (npcId === "merchant" && v.choiceId === "listen") {
        const d = thirdDeal(state, t);
        if (d) rows.push('<li data-r77b-third>今天第三樣特價：' + esc(d.cropName) + "種子 " + esc(d.specialPrice) + " 金</li>");
      }
      if (rows.length) html += '<div class="r77b-extra r79c-perks" data-r79c-perks><p>每天到' + esc(v.spot) + "的" + esc(objectName) + "可以做：</p><ul>" + rows.join("") + '</ul><button type="button" class="r79c-go" data-r79c-go="' + esc(npcId) + '">帶我去</button></div>';
    }
    if (v.afterText) html += '<p class="r77b-after" data-r77b-after>再後來：' + esc(v.afterText) + "</p>";
    return html + "</div>";
  }

  /* ---------- 地圖招牌與種子袋的字樣 ---------- */
  function signColor(state) {
    const r = ensure(state);
    const q = r && r.quests.merchant;
    return q && q.choiceId === "sign" && q.step >= 3 && colorDef(q.color) ? q.color : "";
  }
  function signLabel(state) { const c = colorDef(signColor(state)); return c ? "農場招牌（" + c.name + "）" : "農場招牌"; }
  function signDataset(state) { const c = signColor(state); return c ? { r77bSignColor: c } : null; }
  function seedBagLabel(state) {
    return savedChoice(state, "mayor") === "farm" && upgraded(state, "mayor") ? "門口的種子袋，每天送 2 包種子：小麥和當季作物各 1 包" : "門口的種子袋，每天送 1 包小麥種子";
  }
  function sceneStates(state) {
    const r = ensure(state);
    if (!r) return [];
    const choiceRows = NPC_ORDER.map((npcId) => {
      const q = r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
      if (!q || !def || !def.marker) return null;
      /* R79C：一做決定，名牌就換成帶決定的那一種（不用等三步做完），兩種選擇在地圖上馬上看得出不同。
         招牌做完後併進市集那塊「農場招牌（色名）」，這一列標 merged，地圖上就只剩一塊名牌。 */
      const option = def.steps.reduce((found, step) => found || (step.options || []).find((row) => row.id === q.decision), null);
      const decided = def.colorStep ? q.step >= 3 && !!colorDef(q.color) : !!q.decisionText;
      const decision = (option && option.tag) || q.decisionText || "等待你的決定";
      const label = fill(decided ? def.marker.doneLabel : def.marker.earlyLabel, q).replace(/\{decision\}/g, decision);
      const key = npcId + ":" + q.choiceId;
      return { npcId, choiceId: q.choiceId, done: q.step >= 3, decided, decision: def.colorStep ? q.color : q.decision, label,
        merged: def.colorStep && q.step >= 3 ? "farm_sign" : "", marker: Object.assign({}, def.marker, { art: choiceArt(key, def.marker.art) }) };
    }).filter(Boolean);
    const a = state.adventure, routes = a && a.r61 && a.r61.world && a.r61.world.c4Routes;
    const c4Markers = {
      c4_market_expansion: { anchor: "structure:shop", art: ROUTE_ART.basket, primary: "市集鮮貨桌", alt: "市集耐放貨架" },
      c4_tasting_stall: { anchor: "structure:shop", art: ROUTE_ART.stamp, primary: "草莓試吃記號", alt: "日曬拼盤牌" },
      c4_notice_bench: { anchor: "station:sign", art: ROUTE_ART.note, primary: "石木公告長椅", alt: "追光坐墊長椅" },
    };
    const chapterRows = Object.keys(c4Markers).filter((id) => routes && (routes[id] === "primary" || routes[id] === "alt")).map((id) => {
      const route = routes[id], marker = c4Markers[id];
      return { npcId: id, choiceId: route, done: true, decision: route, label: marker[route], marker: { anchor: marker.anchor, art: marker.art } };
    });
    return choiceRows.concat(chapterRows);
  }

  /* ---------- 接上既有函式（每個只包一次） ---------- */
  let onTalkBrowser = null;
  function wrapMethod(host, name, make) {
    if (!host || typeof host[name] !== "function" || host[name].__r77b) return false;
    const orig = host[name];
    const fn = make(orig);
    fn.__r77b = true;
    fn.__r77bOrig = orig;
    host[name] = fn;
    return true;
  }
  function preHarvest(state, plotIndex, now) {
    const plot = state && Array.isArray(state.plots) ? state.plots[plotIndex] : null;
    const sunlit = !!(G && typeof G.isSunlit === "function" && plot && G.isSunlit(state, plotIndex, nowOf(now)));
    return { natural: !!(plot && plot.careMode === "natural"), sunlit };
  }
  function hookDried() {
    if (!Sunplay) return false;
    const prev = Sunplay.onDried;
    if (prev && prev.__r77b) return false;
    const fn = function (state, itemId) {
      if (typeof prev === "function") { try { prev.apply(this, arguments); } catch (_) { /* 其他掛勾出錯不影響曬架 */ } }
      try { noteDried(state, itemId, Date.now()); } catch (_) { /* 委託進度出錯不影響曬架 */ }
    };
    fn.__r77b = true;
    Sunplay.onDried = fn;
    return true;
  }
  function install() {
    const hosts = [root];
    if (G && G !== root) hosts.push(G);
    hosts.forEach((host) => {
      wrapMethod(host, "harvest", (orig) => function (state, plotIndex, now) {
        let pre = null;
        try { pre = preHarvest(state, plotIndex, now); } catch (_) { pre = null; }
        const r = orig.apply(this, arguments);
        if (r && r.ok) {
          try { noteHarvest(state, { sunlit: !!(pre && pre.sunlit) || !!(r.sun && r.sun.xpBonus > 0), natural: !!(pre && pre.natural) || r.careMode === "natural" }, now); } catch (_) { /* 委託進度出錯不擋收成 */ }
        }
        return r;
      });
      wrapMethod(host, "harvestAll", (orig) => function (state, now) {
        const pre = [];
        try {
          (state.plots || []).forEach((plot, i) => {
            if (plot && plot.cropId && G && typeof G.getCropProgress === "function" && G.getCropProgress(state, plot, nowOf(now)).ready) pre.push(Object.assign({ i }, preHarvest(state, i, now)));
          });
        } catch (_) { /* 預掃失敗就不算 */ }
        const r = orig.apply(this, arguments);
        try { pre.forEach((p) => { const plot = state.plots[p.i]; if (plot && !plot.cropId) noteHarvest(state, p, now); }); } catch (_) { /* 委託進度出錯不擋收成 */ }
        return r;
      });
      wrapMethod(host, "sellItem", (orig) => function (state, cropId, qty, now) {
        const r = orig.apply(this, arguments);
        if (r && r.ok) { try { noteSold(state, cropId, now); } catch (_) { /* 委託進度出錯不擋賣出 */ } }
        return r;
      });
      wrapMethod(host, "sellAll", (orig) => function (state, now) {
        let before = null;
        try { before = Object.assign({}, state.storage.items); } catch (_) { before = null; }
        const r = orig.apply(this, arguments);
        if (before) {
          try { const after = state.storage.items || {}; Object.keys(before).forEach((id) => { if ((after[id] || 0) < before[id]) noteSold(state, id, now); }); } catch (_) { /* 委託進度出錯不擋賣出 */ }
        }
        return r;
      });
      wrapMethod(host, "fulfillNpcRequest", (orig) => function (state, npcId, now) {
        const r = orig.apply(this, arguments);
        if (r && r.ok) { try { noteOrder(state, npcId, now); } catch (_) { /* 委託進度出錯不擋交付 */ } }
        return r;
      });
    });
    if (A) {
      wrapMethod(A, "resolveMainStoryChoice", (orig) => function (state, npcId, choiceId, now) {
        const result = orig.apply(this, arguments);
        if (!result || !result.ok) return result;
        try {
          sync(state, nowOf(now), { silent: true });
          const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
          if (q && def) {
            q.introSeen = true;
            q.sceneState = "early";
            result.r78cIntro = def.intro.slice();
            result.r78cScene = def.marker.earlyLabel;
            pushNote("你的回答立刻改變了農場：" + (def.marker.spot || "地圖上") + "多了「" + def.marker.earlyLabel + "」，走過去看看。");
            if (typeof document !== "undefined" && R && typeof R.openDialogue === "function") {
              let waits = 0;
              const showIntro = () => {
                if (document.querySelector(".r76b-dialogue") && waits++ < 80) { setTimeout(showIntro, 120); return; }
                try { R.openDialogue(state, npcId, def.intro.slice(), {}); } catch (_) { /* 對白打不開仍保留狀態與場景 */ }
              };
              setTimeout(showIntro, 0);
            }
          }
        } catch (_) { /* 選擇本身已成功，不讓角色事件接線擋住 */ }
        return result;
      });
      wrapMethod(A, "record", (orig) => function (state, event, now) {
        const r = orig.apply(this, arguments);
        const e = typeof event === "string" ? { type: event } : event;
        if (r && r.ok && isObj(e) && e.type === "talk") {
          try { noteTalk(state, e.npcId || e.id, now); } catch (_) { /* 委託進度出錯不擋交談 */ }
          /* R79C：走到鄰居旁邊交談時，若後續委託這一步要交給這位鄰居，就接著開下方對話框。 */
          if (typeof onTalkBrowser === "function") { try { onTalkBrowser(state, e.npcId || e.id); } catch (_) { /* 對話框打不開不擋交談 */ } }
        }
        return r;
      });
      wrapMethod(A, "deliverNeighbor", (orig) => function (state, id, taste, now) {
        const r = orig.apply(this, arguments);
        if (r && r.ok) { try { noteOrder(state, id, now, { meal: true }); } catch (_) { /* 委託進度出錯不擋餐籃 */ } }
        return r;
      });
      wrapMethod(A, "deliverCommission", (orig) => function (state, id, now) {
        const r = orig.apply(this, arguments);
        if (r && r.ok && COMMISSION_NPC[id]) { try { noteOrder(state, COMMISSION_NPC[id], now); } catch (_) { /* 委託進度出錯不擋交付 */ } }
        return r;
      });
      /* 第 8 項：有 R76 回訪的開場選擇，只播 R76 回訪對話框，不再另外補一句固定的回訪台詞。 */
      if (wrapMethod(A, "mainStoryRecall", (orig) => function (state, npcId) {
        try { if (R && typeof R.followupDef === "function" && R.followupDef(state, npcId)) return ""; } catch (_) { /* 查不到就照舊 */ }
        return orig.apply(this, arguments);
      })) A.__r77bOrigMainStoryRecall = A.mainStoryRecall.__r77bOrig;
    }
    if (M && !(M.onMayorQuestDelivered && M.onMayorQuestDelivered.__r77b)) {
      const prev = M.onMayorQuestDelivered;
      const fn = function (state, now) {
        if (typeof prev === "function") { try { prev.apply(this, arguments); } catch (_) { /* 其他掛勾出錯不影響 */ } }
        noteOrder(state, "mayor", now);
      };
      fn.__r77b = true;
      M.onMayorQuestDelivered = fn;
    }
    hookDried();
    return true;
  }

  const ChoicesR77 = { QUESTS, SIGN_COLORS, PLAY_NAMES, NPC_NAMES, REWARD_COINS, REWARD_XP, TALK_GAP_MS,
    questDef, playsOf, naturalName, ensure, sync, savedChoice, followupSeen, onFollowupSeen, dispatch,
    noteHarvest, noteSold, noteTalk, noteOrder, noteDried, act, swapMayorQuest, mayorSwapInfo, dailyInfo, takeDaily, thirdDeal,
    questView, cardHtml, bind: function () {}, signColor, signLabel, signDataset, seedBagLabel,
    sceneStates, takeNotes, pendingNotes, setListener, install, hookDried,
    CHOICE_ART, CHOICE_ART_READY, choiceArt, colorGift, specialInfo, takeSpecial, unlockText, dailyLine, stepPlace };
  root.ChoicesR77 = ChoicesR77;
  if (isNode) module.exports = ChoicesR77;
  if (typeof document === "undefined") return;

  /* ---------- 瀏覽器接線 ---------- */
  const farm = () => root.__farm;
  function browserState() {
    const f = farm();
    if (!f) return null;
    try { return typeof f.state === "function" ? f.state() : null; } catch (_) { return null; }
  }
  function toast(message) { const f = farm(); if (message && f && f.toast) f.toast(message); }
  function persist() {
    const f = farm();
    if (f && f.safeSaveNow) f.safeSaveNow();
    if (f && f.refresh) f.refresh();
  }
  function repaintJournal(state) {
    try { if (root.MidgameR66 && typeof root.MidgameR66.injectJournal === "function") root.MidgameR66.injectJournal(state); } catch (_) { /* 鄰居區塊重畫失敗不擋 */ }
    try { if (root.CookingR75 && typeof root.CookingR75.injectChoices === "function") root.CookingR75.injectChoices(state); } catch (_) { /* 選擇區塊重畫失敗不擋 */ }
  }
  function paintSign(state) {
    const color = signColor(state);
    const label = signLabel(state);
    document.querySelectorAll(".r75b-map-node[data-r75b-sign]").forEach((node) => {
      if ((node.dataset.r77bSignColor || "") !== color) { if (color) node.dataset.r77bSignColor = color; else delete node.dataset.r77bSignColor; }
      if (node.getAttribute("aria-label") !== label) node.setAttribute("aria-label", label);
      const span = node.querySelector("span");
      if (span && span.textContent !== label) span.textContent = label;
      /* R79C：選了「招牌」的話，點市集的農場招牌就走過去（之前選色、之後每天擦亮與熟客單都在這裡）。 */
      const r = ensure(state), q = r && r.quests.merchant;
      if (q && q.choiceId === "sign" && node.dataset.r79cBound !== "1") {
        node.dataset.r79cBound = "1";
        node.onclick = (event) => { event.stopPropagation(); walkToMarker(state, "merchant"); };
      }
    });
  }
  /* 河畔委託卡補上開場選擇的加成字樣（升級後寫多兩成）；先比對再改，避免觸發其他監聽器重畫。 */
  function paintBonus(state) {
    const buttons = document.querySelectorAll("button[data-commission]");
    if (!buttons.length || !A || typeof A.commissions !== "function") return;
    let rows = [];
    try { rows = A.commissions(state, Date.now()); } catch (_) { return; }
    buttons.forEach((btn) => {
      const card = btn.closest(".adventure-quest");
      if (!card) return;
      const row = rows.find((c) => c.id === btn.dataset.commission);
      const text = row && row.choiceBonusText ? row.choiceBonusText : "";
      const old = card.querySelector("[data-r77b-bonus]");
      if (!text) { if (old) old.remove(); return; }
      if (old && old.textContent === text) return;
      if (old) { old.textContent = text; return; }
      const p = document.createElement("p");
      p.className = "r77b-bonus";
      p.dataset.r77bBonus = row.npcId || "";
      p.textContent = text;
      card.insertBefore(p, btn);
    });
  }

  let dirty = false;
  let flushTimer = 0;
  let holdUntil = 0;
  function scheduleFlush(delay) { if (!flushTimer) flushTimer = setTimeout(flush, delay || 0); }
  function flush() {
    flushTimer = 0;
    if (holdUntil > Date.now() || document.querySelector(".r76b-dialogue") || document.querySelector("#startupLoading")) { scheduleFlush(400); return; }
    const messages = takeNotes();
    if (messages.length) toast(messages.join(" "));
    if (messages.length || dirty) {
      dirty = false;
      const state = browserState();
      if (state) { persist(); repaintJournal(state); paintSign(state); }
    }
  }
  setListener(() => { dirty = true; scheduleFlush(); });

  /* 回訪對白播完：接著讓對方多交代一件事，交代完才跳「後續委託開始了」。 */
  function openBrief(state, npcId) {
    const r = ensure(state);
    const q = r && r.quests[npcId];
    const def = q ? questDef(npcId, q.choiceId) : null;
    const S = root.StoryR76;
    if (!def || !S || typeof S.openDialogue !== "function") { holdUntil = 0; scheduleFlush(); return; }
    try {
      S.openDialogue(state, npcId, def.brief.map((line) => fill(line, q)), { onClose: () => { holdUntil = 0; scheduleFlush(); } });
    } catch (_) { holdUntil = 0; scheduleFlush(); }
  }
  function hookFollowup() {
    const S = root.StoryR76;
    if (!S || typeof S.openFollowup !== "function" || S.openFollowup.__r77b) return;
    const orig = S.openFollowup;
    const fn = function (state, npcId, callbacks) {
      const cb = Object.assign({}, callbacks || {});
      const prevSeen = cb.onSeen;
      cb.onSeen = function () {
        if (typeof prevSeen === "function") { try { prevSeen.apply(this, arguments); } catch (_) { /* 原本的回呼出錯不擋 */ } }
        let started = false;
        try { started = onFollowupSeen(state, npcId, Date.now()); } catch (_) { started = false; }
        if (started) { holdUntil = Date.now() + 60000; setTimeout(() => openBrief(state, npcId), 0); }
      };
      return orig.call(this, state, npcId, cb);
    };
    fn.__r77b = true;
    S.openFollowup = fn;
  }

  /* ---------- R79C：後續委託走到地圖上做 ----------
     手札只放進度與「帶我去」；步驟在地圖物件旁（marker）或鄰居旁（npc）用下方那一種對話框完成。 */
  function liveState(fallback) { return browserState() || fallback; }
  /* 連著做兩步時，「第 N 步完成！下一步：…」只留最後一則，不讓提示排一長串。 */
  function dropStepNotes() { for (let i = notes.length - 1; i >= 0; i--) if (/^後續委託「[^」]+」第 \d 步完成/.test(notes[i])) notes.splice(i, 1); }
  function say(state, npcId, lines, options) {
    const S = root.StoryR76;
    const list = (lines || []).filter(Boolean);
    if (!S || typeof S.openDialogue !== "function") { toast(list[list.length - 1]); return null; }
    document.querySelectorAll(".npc-bubble").forEach((node) => node.remove());
    try { if (root.FarmWorld && typeof root.FarmWorld.hushSpeak === "function") root.FarmWorld.hushSpeak(); } catch (_) { /* 舊對話框收不掉不擋 */ }
    /* 用同一個物件（不複製）：看完現場接著做決定時，onLinesDone 會在這個物件上補選項。 */
    const opts = options || {};
    const prevClose = opts.onClose;
    opts.onClose = () => { if (typeof prevClose === "function") { try { prevClose(); } catch (_) { /* 回呼出錯不擋 */ } } dirty = true; scheduleFlush(); };
    try { return S.openDialogue(state, npcId, list.length ? list : [""], opts); } catch (_) { toast(list[list.length - 1]); return null; }
  }
  function decisionChoices(def, step) {
    return (step.options || []).map((o) => ({ id: o.id, label: o.label, immediate: "馬上拿到：" + o.result,
      longTerm: def.special && def.special.variants[o.id] ? "做完三步解鎖：" + def.special.kind + "「" + def.special.variants[o.id].name + "」" : "之後一直有效：" + def.upgradeText }));
  }
  function colorChoices(state, def, first) {
    return SIGN_COLORS.map((c) => {
      const v = def.special && def.special.variants[c.id];
      return { id: c.id, label: c.name, immediate: first ? "開張小禮：" + rewardText(colorGift(c.id), state) : "改漆不再送開張小禮",
        longTerm: v ? (first ? "做完三步解鎖：" : "熟客單換成：") + def.special.kind + "「" + v.name + "」" : "招牌換成這個顏色" };
    });
  }
  function sceneLabelOf(state, npcId) { const row = sceneStates(state).find((r) => r.npcId === npcId); return row ? row.label : ""; }
  function decide(state, npcId, id, showReply) {
    dropStepNotes();
    const res = act(state, npcId, Date.now(), id);
    if (!res.ok) { showReply(res.message); return; }
    const label = sceneLabelOf(state, npcId);
    showReply(res.message + (label ? "地圖上的名牌換成「" + label + "」了。" : ""));
  }
  function needText(state, step, t) {
    const items = storageItems(state);
    if (step.act === "give_dried") return "日曬乾貨 " + Math.min(1, driedTotal(state)) + "/1";
    if (step.act === "meal") return "料理 " + Math.min(1, mealTotal(state)) + "/1";
    if (step.act === "wood") return "木料 " + Math.min(2, woodOf(state)) + "/2";
    if (step.act === "special_crop") { const ids = todaySpecialIds(state, t); return "今天特價的作物 " + (ids.some((id) => (items[id] || 0) >= 1) ? 1 : 0) + "/1" + (ids.length ? "（今天是" + ids.map(cropName).join("或") + "）" : ""); }
    if (step.act === "seed_meal") return "種子包 " + Math.min(2, seedPackTotal(state)) + "/2・料理 " + Math.min(1, mealTotal(state)) + "/1";
    return "";
  }
  /* 走到鄰居旁邊：這一步要交給這位鄰居時才開對話框。 */
  function openNpcStep(state, npcId) {
    const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!q || !def || q.step >= 3) return false;
    const step = def.steps[q.step];
    if ((step.place || "marker") !== "npc") return false;
    if (step.act === "scene_close") {
      say(state, npcId, step.lines.slice(), { onLinesDone: () => { dropStepNotes(); const res = act(state, npcId, Date.now()); if (!res.ok) toast(res.message); } });
      return true;
    }
    const last = q.step === 2;
    say(state, npcId, [step.ask || fill(step.title, q)], { startMode: "choices",
      choiceOptions: [{ id: "give", label: step.actLabel, immediate: "現在手上：" + needText(state, step, Date.now()), longTerm: last ? "交了就做完三步，拿到 " + REWARD_COINS + " 金和 " + REWARD_XP + " 點經驗" : "交了就完成第 " + (q.step + 1) + " 步" }],
      onChoice: (id, showReply) => { dropStepNotes(); const res = act(state, npcId, Date.now()); showReply(res.ok ? (step.thanks || res.message) : res.message); } });
    return true;
  }
  const queuedTalk = {};
  function queueNpcStep(state, npcId) {
    if (queuedTalk[npcId] || stepPlace(state, npcId) !== "npc") return;
    queuedTalk[npcId] = true;
    let tries = 0;
    const attempt = () => {
      if (document.querySelector(".r76b-dialogue") || document.querySelector(".modal.show") || holdUntil > Date.now()) {
        if (tries++ < 240) { setTimeout(attempt, 250); return; }
        queuedTalk[npcId] = false; return;
      }
      queuedTalk[npcId] = false;
      if (stepPlace(state, npcId) === "npc") openNpcStep(state, npcId);
    };
    setTimeout(attempt, 60);
  }
  onTalkBrowser = queueNpcStep;
  function openRepaint(state, npcId) {
    const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!def || !def.colorStep) return;
    say(state, npcId, ["蘿拉敲了敲招牌：「想換顏色？漆我有，挑吧。」"], { startMode: "choices", choiceOptions: colorChoices(state, def, false),
      onChoice: (id, showReply) => {
        const res = act(state, npcId, Date.now(), id), v = specialVariant(def, r.quests[npcId]);
        showReply(res.ok ? "蘿拉把招牌改漆成" + colorDef(id).name + "。" + (v ? "熟客單也跟著換成「" + v.name + "」。" : "") : res.message);
      } });
  }
  /* 三步做完：物件旁每天換一句對白，底下列出每天能做的事與解鎖的具名內容。 */
  function openMarkerMenu(state, npcId) {
    const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null, t = Date.now();
    if (!def) return;
    const choices = [];
    const daily = dailyInfo(state, npcId, t);
    if (daily.eligible) choices.push({ id: "daily", label: daily.can ? daily.label : "今天做過了，明天再來", immediate: daily.result, longTerm: "每天一次" });
    const sp = specialInfo(state, npcId, t);
    if (sp.eligible) choices.push({ id: "special", label: sp.kind + "「" + sp.name + "」", immediate: "交" + sp.wantText,
      longTerm: sp.used ? "今天做過了，明天再來" : (sp.enough ? "" : sp.missingText + "・") + "換" + sp.rewardText });
    if (npcId === "mayor" && q.choiceId === "town") {
      const info = mayorSwapInfo(state, t);
      if (info.eligible) choices.push({ id: "swap", label: "換一張鎮長委託", immediate: "今天想收 " + info.quest.qty + " 份" + info.quest.cropName + "，完成給 " + info.quest.rewardCoins + " 金", longTerm: info.can ? "每天能換一次" : info.claimed ? "今天的委託已經交了" : "今天已經換過了" });
    }
    if (npcId === "merchant" && q.choiceId === "listen") {
      const d = thirdDeal(state, t);
      if (d) choices.push({ id: "third", label: "買第三樣特價種子", immediate: d.cropName + "種子 " + d.specialPrice + " 金", longTerm: "蘿拉每天替你多留一樣特價" });
    }
    if (def.colorStep) choices.push({ id: "repaint", label: "改漆招牌顏色", immediate: "現在是" + ((colorDef(q.color) || {}).name || "原色"), longTerm: "熟客單會跟著換顏色" });
    say(state, npcId, [dailyLine(state, npcId, t) || def.afterText], { startMode: "choices", choiceOptions: choices,
      onChoice: (id, showReply) => {
        if (id === "repaint") { openRepaint(state, npcId); return; }
        let res = null;
        if (id === "daily") res = takeDaily(state, npcId, Date.now());
        else if (id === "special") res = takeSpecial(state, npcId, Date.now());
        else if (id === "swap") res = swapMayorQuest(state, Date.now());
        else if (id === "third") {
          const d = thirdDeal(state, Date.now());
          res = d && K && typeof K.buyMerchantDeal === "function" ? K.buyMerchantDeal(state, Date.now(), d.cropId, 2) : fail("no_deal", "今天沒有第三樣特價。");
        }
        if (!res) return;
        if (res.ok) { dirty = true; }
        showReply(id === "special" && !res.ok && sp.line ? sp.line + " " + res.message : res.message || "");
      } });
  }
  /* 走到地圖物件旁邊之後打開：看現場、做決定、選顏色，三步做完就是每天的互動。 */
  function openMarker(state, npcId) {
    const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!q || !def) return;
    if (q.step >= 3) { openMarkerMenu(state, npcId); return; }
    const step = def.steps[q.step];
    if ((step.place || "marker") === "npc") { toast("「" + def.marker.earlyLabel + "」先放著，這一步要走到" + NPC_NAMES[npcId] + "旁邊做：" + fill(step.title, q) + "。"); return; }
    if (step.act === "scene") {
      const next = def.steps[q.step + 1];
      const chain = !!(next && next.act === "decision" && (next.place || "marker") === "marker");
      const options = { choiceOptions: [] };
      options.onLinesDone = () => {
        const res = act(state, npcId, Date.now());
        if (!res.ok) { toast(res.message); return undefined; }
        if (chain) { options.choiceOptions = decisionChoices(def, next); return "choices"; }
        return undefined;
      };
      options.onChoice = (id, showReply) => decide(state, npcId, id, showReply);
      say(state, npcId, step.lines.slice(), options);
      return;
    }
    if (step.act === "decision") {
      const prev = def.steps[q.step - 1];
      say(state, npcId, [prev && prev.lines ? prev.lines[prev.lines.length - 1] : fill(step.title, q)], { startMode: "choices", choiceOptions: decisionChoices(def, step), onChoice: (id, showReply) => decide(state, npcId, id, showReply) });
      return;
    }
    if (step.act === "color") {
      say(state, npcId, ["蘿拉把三塊色樣排在釘牢的招牌旁：「挑一個吧。顏色定了，客人就記住了。」"], { startMode: "choices", choiceOptions: colorChoices(state, def, true),
        onChoice: (id, showReply) => {
          dropStepNotes();
          const res = act(state, npcId, Date.now(), id);
          const c = colorDef(id);
          showReply(res.ok ? "蘿拉把招牌漆成" + c.name + "，順手塞給你開張小禮：" + r.quests[npcId].decisionReward + "。" : res.message);
        } });
    }
  }
  function closeSidePanel() { const panel = document.querySelector(".side-panel"); if (panel) panel.classList.remove("world-panel-open"); }
  function walkToMarker(state, npcId) {
    const s = liveState(state), r = ensure(s), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null, f = farm();
    if (!def || !f || typeof f.travelAndDo !== "function") return false;
    const tile = anchorTile(s, def.marker.anchor);
    const ok = !!tile && f.travelAndDo(tile.id, "collect", () => openMarker(liveState(s), npcId));
    if (!ok) toast("現在走不過去，先把手上的事做完再來。");
    return ok;
  }
  /* 手札「帶我去」：要找鄰居就走到鄰居旁邊交談，其餘走到地圖上那個物件旁邊。 */
  function goTo(state, npcId) {
    const s = liveState(state), place = stepPlace(s, npcId);
    if (!place) return false;
    closeSidePanel();
    if (place === "npc") {
      const tile = anchorTile(s, "npc:" + npcId), f = farm();
      if (!tile || !f || typeof f.clickTile !== "function") { toast("現在找不到" + NPC_NAMES[npcId] + "，晚點再試。"); return false; }
      f.clickTile(tile.id);
      return true;
    }
    return walkToMarker(s, npcId);
  }
  function bindBrowser(section, state) {
    if (!section || typeof section.querySelectorAll !== "function" || !state) return;
    section.querySelectorAll("[data-r79c-go]").forEach((btn) => { btn.onclick = (ev) => { if (ev) { ev.preventDefault(); ev.stopPropagation(); } goTo(state, btn.dataset.r79cGo); }; });
  }
  ChoicesR77.bind = bindBrowser;
  ChoicesR77.goTo = goTo;
  ChoicesR77.openMarker = openMarker;
  ChoicesR77.openNpcStep = openNpcStep;

  function anchorTile(state, spec) {
    const pair = String(spec || "").split(":"), kind = pair[0], id = pair[1];
    const tiles = state && state.map && Array.isArray(state.map.tiles) ? state.map.tiles : [];
    return kind === "structure" ? tiles.find((tile) => tile.structureId === id)
      : kind === "station" ? tiles.find((tile) => tile.station === id)
        : kind === "npc" ? tiles.find((tile) => tile.npc === id) : null;
  }
  function paintScenes(state) {
    const world = document.getElementById("mapWorld");
    if (!world || !state || !state.map) return;
    /* R79C：招牌做完併進市集的「農場招牌（色名）」，不再另畫一塊名牌（圖 41、64 的兩個名牌）。 */
    const states = sceneStates(state).filter((row) => !row.merged), signature = JSON.stringify(states.map((row) => [row.npcId, row.choiceId, row.done, row.decision, row.label, row.marker.art]));
    if (world.dataset.r78cScenes === signature && world.querySelectorAll(".r78c-scene-change").length === states.length) return;
    world.querySelectorAll(".r78c-scene-change, .r78c-scene-label").forEach((node) => node.remove());
    const size = Math.max(24, Math.round(world.offsetWidth / Math.max(1, state.map.width || 24)));
    /* R78 整合：物件放在錨點旁邊的地上（腳底對齊錨點的底邊），不蓋住告示牌、信箱本體，前後遮擋跟地圖其他東西一樣用腳底位置排。
       站點放左邊，水井左邊是釣魚棧橋所以放右邊；市集攤是兩格高的建築，從攤子左邊沿著攤前往右排（左邊那格是訂單看板）。
       同一個錨點有好幾樣時一樣一樣往外排，名牌往下錯開不互疊。 */
    const RIGHT_SIDE = { "station:well": true }, seen = {}, labelShift = {};
    states.forEach((row) => {
      const tile = anchorTile(state, row.marker.anchor);
      if (!tile) return;
      const key = row.marker.anchor, n = seen[key] || 0; seen[key] = n + 1;
      const node = document.createElement("button");
      node.type = "button"; node.className = "r78c-scene-change" + (row.done ? " is-done" : " is-early") + (row.decided ? " is-decided" : "");
      node.dataset.r78cRoute = row.npcId + ":" + row.choiceId; node.dataset.r78cDone = row.done ? "1" : "0";
      if (row.decided && row.decision) node.dataset.r79cDecision = row.decision;
      node.setAttribute("aria-label", row.label); node.title = row.label;
      const px = Math.max(32, Math.min(48, Math.round(size * .64)));
      let col, foot;
      if (tile.structureId && key.indexOf("structure:") === 0) {
        const body = state.map.tiles.filter((t) => t.structureId === tile.structureId);
        col = Math.min.apply(null, body.map((t) => t.x)) - .2 + n * .72;
        foot = Math.max.apply(null, body.map((t) => t.y)) + 1.06;
      } else {
        col = RIGHT_SIDE[key] ? tile.x + 1.2 + n * .72 : tile.x - .2 - n * .72;
        foot = tile.y + 1;
      }
      node.style.cssText = "left:" + Math.round(col * size) + "px;top:" + Math.round(foot * size) + "px;width:" + px + "px;height:" + px + "px;z-index:" + (Math.round(foot * size) + 3) + ";";
      node.innerHTML = '<img src="' + esc(row.marker.art) + '" alt="" draggable="false">';
      /* R79C：點地圖上的物件就走過去打開它（第四章的記號照舊只顯示名字）。 */
      const routeNpc = NPC_ORDER.includes(row.npcId);
      node.onclick = (event) => { event.stopPropagation(); if (routeNpc) walkToMarker(state, row.npcId); else toast(row.label); };
      world.appendChild(node);
      /* 名牌另外放一層在最上面：市集攤前面那一排會被農舍屋頂蓋到，名牌不能跟著物件一起被遮。 */
      const tag = document.createElement("span"), shift = labelShift[key] || 0;
      tag.className = "r78c-scene-label" + (row.done ? " is-done" : "") + (row.decided ? " is-decided" : ""); tag.dataset.r78cRoute = node.dataset.r78cRoute; tag.textContent = row.label;
      if (node.dataset.r79cDecision) tag.dataset.r79cDecision = node.dataset.r79cDecision;
      tag.style.cssText = "left:" + Math.round(col * size) + "px;top:" + (Math.round(foot * size) + 4 + shift) + "px;";
      world.appendChild(tag);
      labelShift[key] = shift + (tag.offsetHeight || 17) + 2;
    });
    world.dataset.r78cScenes = signature;
  }
  function routeRewardLabel(reward, state) {
    if (!reward) return "";
    const parts = rewardText(reward, state).split("、").filter(Boolean);
    if (reward.xp) parts.push(reward.xp + " 點經驗");
    return parts.join("、");
  }
  function paintChapterRoutes(state) {
    if (!A || typeof A.quests !== "function") return;
    let list = [];
    try { list = A.quests(state, Date.now()).filter((q) => q.chapter === 4 && q.hasAltRoute); } catch (_) { return; }
    list.forEach((q) => {
      const card = document.querySelector('#adventurePanel [data-quest="' + q.id + '"]');
      const box = card && card.querySelector(".r68a-card-requirements");
      if (!box) return;
      const names = q.routeNames || { primary: "做法甲", alt: "做法乙" };
      const chosen = q.chosenRoute;
      const make = (route, rows) => {
        const selected = chosen === route;
        const receipt = selected && q.routeReceipt && q.routeReceipt.length ? q.routeReceipt : null;
        const display = receipt || rows;
        const lines = display.map((row) => '<li>' + (receipt || row.complete ? "✓ " : "○ ") + esc(row.name) + " " + (receipt ? row.required + "/" + row.required : Math.min(row.current, row.required) + "/" + row.required) + "</li>").join("");
        const reward = q.routeRewards && q.routeRewards[route] ? q.routeRewards[route] : q.reward;
        const consequence = q.routeConsequences && q.routeConsequences[route] ? q.routeConsequences[route] : "";
        return '<section class="r78c-route is-' + route + (selected ? " is-chosen" : "") + '" data-r78c-route="' + route + '"><h4>' + esc(names[route]) + (selected ? '<b data-r78c-chosen>已走這條</b>' : "") + '</h4><ul>' + lines + '</ul><p>報酬：' + esc(routeRewardLabel(reward, state)) + '</p><small>' + esc(consequence) + "</small></section>";
      };
      const signature = JSON.stringify([q.id, q.status, q.chosenRoute, q.requirements, q.altRequirements, q.routeReceipt]);
      if (box.dataset.r78cSignature === signature) return;
      box.classList.add("r78c-route-grid");
      box.innerHTML = make("primary", q.objectives.concat(q.requirements)) + make("alt", q.altRequirements)
        + (chosen ? '<p class="r78c-route-result">手札記錄：' + esc(names[chosen]) + '。' + esc(q.routeConsequence || "") + "</p>" : '<p class="r78c-route-result">不用先按選擇；實際交付哪套材料，就走哪一條。</p>');
      box.dataset.r78cSignature = signature;
    });
  }

  function tick() {
    hookDried();
    hookFollowup();
    if (document.querySelector("#startupLoading")) return;
    const state = browserState();
    if (!state || !isObj(state.adventure)) return;
    try { sync(state, Date.now()); } catch (_) { /* 補委託失敗下次再試 */ }
    try { paintSign(state); } catch (_) { /* 招牌字樣失敗不擋 */ }
    try { paintScenes(state); } catch (_) { /* 場景變化失敗不擋主流程 */ }
    try { paintChapterRoutes(state); } catch (_) { /* 第四章兩欄顯示失敗不擋主流程 */ }
    try { paintBonus(state); } catch (_) { /* 加成字樣失敗不擋 */ }
    if (pendingNotes().length || dirty) scheduleFlush();
  }
  install();
  hookFollowup();
  const start = () => {
    root.addEventListener("farm-panel-rendered", () => { const state = browserState(); if (state) paintChapterRoutes(state); });
    tick(); setInterval(tick, 700);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  ChoicesR77.paintSign = paintSign;
  ChoicesR77.paintScenes = paintScenes;
  ChoicesR77.paintChapterRoutes = paintChapterRoutes;
  ChoicesR77.paintBonus = paintBonus;
  ChoicesR77.flush = flush;
})(typeof window !== "undefined" ? window : globalThis);
