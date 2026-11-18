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
  /* R80C 第 2 項：後續委託第二步的兩個決定（招牌是三種顏色）各接一張地圖物件圖，檔名照計畫 assets/generated/content-r80/decision-<鄰居>-<回答>-<決定>.png。
     圖到之前不載入，物件上先疊一個現成的小圖示（種子包、蓄光瓶、金幣、樹枝、麥餅、麥穗、嫩芽、草莓、胡蘿蔔），遮住名牌也分得出是哪個決定；
     圖到了以後把那一項加進 DECISION_ART_READY，地圖就整張換成新圖、不再疊小圖示。 */
  const DECISION_KEYS = {
    "mayor:farm": ["seed", "sun"], "mayor:town": ["town_gate", "river_path"], "elder:sell": ["cash", "sample"],
    "elder:seed": ["sturdy", "quick"], "merchant:sign": ["red", "blue", "green"], "merchant:listen": ["sweet", "fresh"],
  };
  const DECISION_ART = {};
  Object.keys(DECISION_KEYS).forEach((route) => DECISION_KEYS[route].forEach((key) => {
    DECISION_ART[route + ":" + key] = "assets/generated/content-r80/decision-" + route.replace(":", "-") + "-" + key.replace(/_/g, "-") + ".png";
  }));
  /* R80 整合：13 張決定物件圖由 MUSE 補齊（content-r80/decision-*.png），全部登記為已到。 */
  /* R85C：晨耕種子籃的兩個決定縮到 64px 分不出來（R84 圖 109、116），MUSE 重畫成剪影與主色都不同的兩只籃子（寬矮綠色留種籃、高瘦金色晨光瓶籃），改接 content-r85。 */
  const R85_DECISION_ART = {
    "mayor:farm:seed": "assets/generated/content-r85/decision-mayor-farm-seed.png",
    "mayor:farm:sun": "assets/generated/content-r85/decision-mayor-farm-sun.png",
  };
  Object.assign(DECISION_ART, R85_DECISION_ART);
  const DECISION_ART_READY = Object.keys(DECISION_ART);
  const DECISION_BADGE = {
    seed: "assets/generated/r83/seed-32.png", sun: "assets/generated/content-r75/sun_jar.png",
    town_gate: "assets/generated/r66/native/system_coin-32.png", river_path: "assets/generated/content-r73/item-fallen_branch.png",
    cash: "assets/generated/r66/native/system_coin-32.png", sample: "assets/generated/content-r73/item-rustic_bread.png",
    sturdy: "assets/generated/r66/native/crop_wheat-32.png", quick: "assets/generated/r66/native/tool_plant-32.png",
    sweet: "assets/generated/r66/native/crop_strawberry-32.png", fresh: "assets/generated/r66/native/crop_carrot-32.png",
  };
  function decisionArt(route, key) { const id = route + ":" + key; return key && DECISION_ART_READY.includes(id) && DECISION_ART[id] ? DECISION_ART[id] : ""; }
  /* R80C 第 1 項：兩個決定各有一項「每天第一次做某件事就真的入帳」的效果，做了決定當天就開始。
     on 是觸發的遊戲事件，reward 是實際入帳的東西（sameCrop＝同一種作物、growCut＝這一格少等的比例、sameDried＝同一種乾貨）。 */
  const DECISION_DAILY = {
    "mayor:farm": {
      seed: { on: "harvest", text: "每天第一次收成，多拿 1 包當季種子", reward: { seasonalSeed: 1 } },
      sun: { on: "sun_harvest", text: "每天第一次在光裡收成，多接 2 點陽光", reward: { sunlight: 2 } },
    },
    "mayor:town": {
      town_gate: { on: "order", text: "每天第一張市集訂單，鎮口的客人多付 8 金", reward: { coins: 8 } },
      river_path: { on: "order", text: "每天第一張市集訂單，修路的人多給 2 份木料", reward: { materials: { wood: 2 } } },
    },
    "elder:sell": {
      cash: { on: "sell", text: "每天第一次賣出作物，班伯替你多談 6 金", reward: { coins: 6 } },
      sample: { on: "sell", text: "每天第一次賣出作物，試吃過的鄰居回送 1 包當季種子", reward: { seasonalSeed: 1 } },
    },
    "elder:seed": {
      sturdy: { on: "harvest", text: "每天第一次收成，多收 1 份同一種作物", reward: { sameCrop: 1 } },
      quick: { on: "plant", text: "每天第一格種下的作物，少等三成時間", reward: { growCut: 0.3 } },
    },
    "merchant:sign": {
      red: { on: "order", text: "每天第一張市集訂單，熟客多付 5 金", reward: { coins: 5 } },
      blue: { on: "order", text: "每天第一張市集訂單，熟客多送 2 點陽光", reward: { sunlight: 2 } },
      green: { on: "order", text: "每天第一張市集訂單，熟客多送 2 份堆肥", reward: { materials: { compost: 2 } } },
    },
    "merchant:listen": {
      sweet: { on: "dried", text: "每天第一次從曬架收乾貨，多收 1 份", reward: { sameDried: 1 } },
      fresh: { on: "sell", text: "每天第一次賣出作物，多送 2 包胡蘿蔔種子", reward: { seedPacks: { carrot: 2 } } },
    },
  };

  /* R78C：每條路線先有角色專屬的現場事件，再由玩家做一次會留下紀錄的決定。
     decision 的兩個結果給不同物品；完成後 marker.doneLabel 會留在地圖上。
     R79C：每一步都標 place——marker 是走到地圖上那個物件旁邊做，npc 是走到鄰居旁邊做；手札只顯示進度與「帶我去」。
     special 是做完三步才解鎖、有名字的新訂單或新配方（依第二步的決定分兩種）；chatter 是物件旁每天輪替的鄰居對白。
     R81C 第 2 項：brief、ask、thanks 是鄰居親口說的話，只講立場與心情；要交什麼、做完拿到什麼，留給手札、選項與提示。 */
  const QUESTS = {
    "mayor:farm": {
      id: "morning_field", name: "晨耕", npcId: "mayor", choiceId: "farm",
      intro: ["（鎮長葛瑞沒有叫你等到明天。）", "我把田格草圖塞進種子籃了。先種田的人，今天就該看見第一個改變。"],
      marker: { anchor: "station:sign", spot: "告示牌旁", art: ROUTE_ART.seed, earlyLabel: "晨耕種子籃", doneLabel: "晨耕種子籃・{decision}" },
      steps: [
        { title: "到田邊看鎮長畫的晨耕草圖", where: "走到告示牌旁的晨耕種子籃，看鎮長夾在籃裡的草圖。", place: "marker", act: "scene", actLabel: "看晨耕草圖", need: 1, lines: ["（鎮長指著草圖上的兩個角落。）", "一邊適合留種，一邊適合曬穀。這個農場先長成哪個樣子，由你決定。"] },
        { title: "決定種子籃先裝什麼", where: "在晨耕種子籃旁邊選：留種小包，或一瓶早晨收下的陽光。", place: "marker", act: "decision", need: 1, options: [
          { id: "seed", label: "留種小包", result: "籃裡放進小麥種子 2 包", reward: { seedPacks: { wheat: 2 } } },
          { id: "sun", label: "晨光小瓶", result: "蓄光瓶裝進陽光 2 點", reward: { sunlight: 2 } },
        ] },
        { title: "帶 1 份日曬乾貨給鎮長", where: "倉庫備好日曬乾貨後，走到鎮長葛瑞旁邊交給他。", place: "npc", play: "rack", act: "give_dried", actLabel: "把乾貨交給鎮長", need: 1,
          ask: "乾貨帶來了嗎？我想親眼看看，你曬出來的跟你祖母像不像。", thanks: "曬得透。……跟她曬的一個味道。告示牌旁那只種子籃，你就收下吧。" },
      ],
      brief: ["田邊的種子籃，我一早就擺好了。", "說來好笑，我年輕時也想過先種田。後來會開久了，就忘了土是什麼味道。", "你替我把那個早上種回來吧。"],
      upgradeText: "田邊留下晨耕種子籃；每天可翻一次，領 1 包當季種子與 1 點陽光。",
      afterText: "鎮長收下乾貨，田邊的種子籃也照我的決定留了下來。",
      daily: { id: "field_basket", label: "翻今天的晨耕種子籃", result: "拿到 1 包當季種子與 1 點陽光", reward: { seasonalSeed: 1, sunlight: 1 } },
      special: { kind: "新訂單", variants: {
        seed: { name: "留種合作單", want: { type: "seasonal", qty: 3 }, coinsRate: 1.2, reward: { nextSeed: 1, seasonalSeed: 1 }, diff: "會送一包還買不到的作物種子，拿到就能種",
          line: "籃邊夾著鎮長的字條：「交三份當季收成，鎮上照一般訂單多兩成付錢，再回你一包鋪子裡還買不到的種子。照規矩，一天一張。」" },
        sun: { name: "晨光合作單", want: { type: "seasonal", qty: 3 }, coinsRate: 1.2, reward: { sunlight: 2, materials: { compost: 1 } }, diff: "一般訂單不給陽光，這張會把蓄光瓶裝進 2 點",
          line: "籃邊夾著鎮長的字條：「交三份當季收成，照一般訂單多兩成付錢，我再替你把晨光小瓶裝滿兩格。照規矩，一天一張。」" },
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
      intro: ["（鎮長葛瑞當場攤開兩張空白公告。）", "一張貼鎮口，一張送河邊。你先替農場選一個說話的地方。"],
      marker: { anchor: "station:mailbox", spot: "信箱旁", art: ROUTE_ART.note, earlyLabel: "公告草稿", doneLabel: "農場公告・{decision}" },
      steps: [
        { title: "和鎮長一起讀兩張公告草稿", where: "走到信箱旁的公告草稿，和鎮長一起讀公告草稿。", place: "marker", act: "scene", actLabel: "讀公告草稿", need: 1, lines: ["（第一張寫著農場重新開門，第二張畫了通往河邊的箭頭。）", "你要先讓人記住農場，還是先把人帶去河邊？"] },
        { title: "決定公告先貼哪裡", where: "在公告草稿旁邊選：貼在鎮口，或送到河邊。", place: "marker", act: "decision", need: 1, options: [
          { id: "town_gate", label: "貼在鎮口", result: "鎮長給 18 金作為公告工錢", reward: { coins: 18 } },
          { id: "river_path", label: "送到河邊", result: "修路剩下的木料 2 份交給你", reward: { materials: { wood: 2 } } },
        ] },
        { title: "帶一道料理，和鎮長交換鎮上消息", where: "在灶台做好料理後，走到鎮長葛瑞旁邊，端料理去聽消息。", place: "npc", play: "cook", act: "meal", actNpc: "mayor", actLabel: "端料理去聽消息", need: 1,
          ask: "公告貼出去了。邊吃邊聊吧，鎮上的消息，我一個人憋了好久。", thanks: "橋頭要修，麵包店缺麥……這些事我記了一整本。有人肯聽，我今晚睡得著了。" },
      ],
      brief: ["公告草稿我壓在信箱旁了，字寫得有點抖。", "好久沒替農場寫公告。上一張，是你祖母要我寫的。", "這次換你決定，貼在哪裡，大家就從哪裡認識你。"],
      upgradeText: "鎮長每日委託的金幣從多一成變成多兩成，每天還可以換一次委託。",
      afterText: "我帶料理去找鎮長，公告也照選的地方貼好；不合手的鎮長委託每天能換一張。",
      special: { kind: "新訂單", variants: {
        town_gate: { name: "鎮口代辦單", want: { type: "most", qty: 4 }, coinsRate: 1.3, reward: { coins: 12 }, diff: "不指定作物，交倉庫裡最多的那一種，另付代辦費",
          line: "公告底下多釘了一張小單：「鎮口的人看了公告來訂貨。四份同一種作物，價錢比一般訂單多三成，另付十二金代辦費。」" },
        river_path: { name: "河邊代辦單", want: { type: "most", qty: 4 }, coinsRate: 1.1, reward: { materials: { wood: 2 } }, diff: "不指定作物，還多給一般訂單沒有的木料",
          line: "公告底下多釘了一張小單：「河邊修路的人要四份口糧。價錢比一般訂單多一成，另外補你兩份木料。」" },
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
      intro: ["（老農班伯立刻把一只舊秤放到市集木箱旁。）", "要學做生意，就先看秤怎麼說實話。"],
      marker: { anchor: "station:storage", spot: "倉庫旁", art: ROUTE_ART.basket, earlyLabel: "試賣秤", doneLabel: "生意木箱・{decision}" },
      steps: [
        { title: "和班伯在舊秤旁試秤一袋麥", where: "走到倉庫旁的試賣秤，跟班伯試秤一袋麥。", place: "marker", act: "scene", actLabel: "跟班伯試秤", need: 1, lines: ["（班伯把秤砣往左挪一格，又往右挪回來。）", "價錢不是越高越好。第一袋貨要替你帶回客人，還是先帶回現金？"] },
        { title: "決定第一袋貨怎麼賣", where: "在試賣秤旁邊選：現金成交，或留一份給鄰里試吃。", place: "marker", act: "decision", need: 1, options: [
          { id: "cash", label: "現金成交", result: "班伯替你談到 24 金", reward: { coins: 24 } },
          { id: "sample", label: "鄰里試吃", result: "換回胡蘿蔔種子 3 包", reward: { seedPacks: { carrot: 3 } } },
        ] },
        { title: "把第一筆帳記進木箱上的帳簿", where: "走到老農班伯旁邊，讓他陪你把這筆帳記完。", place: "npc", act: "scene_close", actLabel: "和班伯記帳", need: 1, lines: ["（班伯在帳簿最上面寫下日期。）", "記住客人怎麼來，比只記今天賺多少更有用。"] },
      ],
      brief: ["舊秤我搬到市集木箱旁了。", "這秤跟了我四十年，沒騙過一個客人。", "你第一袋貨怎麼賣，我就站旁邊看，不出聲。"],
      upgradeText: "老農班伯的河畔委託金幣從多一成變成多兩成。",
      afterText: "班伯陪我把第一筆帳寫好，市集木箱旁一直留著那只舊秤。",
      daily: { id: "market_price", label: "問班伯今天的行情", result: "班伯替你談到今日行情 8 金", reward: { coins: 8 } },
      special: { kind: "新訂單", variants: {
        cash: { name: "整箱現金單", want: { type: "most", qty: 5 }, coinsRate: 1.4, reward: {}, diff: "不指定作物、一次收五份，價錢比一般訂單多四成",
          line: "木箱蓋上用粉筆寫著：「整箱五份，一次點清。價錢比一般訂單多四成，不賒帳。」" },
        sample: { name: "試吃回頭單", want: { type: "most", qty: 5 }, coinsRate: 1.1, reward: { seasonalSeed: 1 }, diff: "不指定作物，另外還你一包當季種子",
          line: "木箱蓋上用粉筆寫著：「吃過的人回頭訂五份。價錢比一般訂單多一成，另外還你一包種。」" },
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
      intro: ["（老農班伯把兩只小木盤擺到田邊，一盤深色、一盤飽滿。）", "留種不是把剩下的收起來，是先想下一輪要什麼。"],
      marker: { anchor: "station:well", spot: "水井旁", art: ROUTE_ART.wheat, earlyLabel: "選種盤", doneLabel: "留種木盤・{decision}" },
      steps: [
        { title: "聽班伯比較兩只選種盤", where: "走到水井旁的選種盤，聽班伯比較兩盤種子。", place: "marker", act: "scene", actLabel: "聽選種課", need: 1, lines: ["（班伯捏起一顆深色種子，又拿起一顆飽滿的。）", "深色的耐放，飽滿的長得快。你這一季要哪一種？"] },
        { title: "替下一季選一盤種", where: "在選種盤旁邊選：耐放的一盤，或長得快的一盤。", place: "marker", act: "decision", need: 1, options: [
          { id: "sturdy", label: "耐放種", result: "拿到小麥種子 3 包", reward: { seedPacks: { wheat: 3 } } },
          { id: "quick", label: "快長種", result: "拿到堆肥 2 份", reward: { materials: { compost: 2 } } },
        ] },
        { title: "帶 2 包種子和 1 道料理給班伯", where: "備齊種子包和料理後，走到老農班伯旁邊交給他。", place: "npc", play: "cook", act: "seed_meal", actLabel: "把種子和料理帶給班伯", need: 1,
          ask: "來啦？留種的事要邊吃邊說，我爹以前也是這樣教我的。", thanks: "嗯。……這盤種子，我爹當年也是這樣挑的。盤子就留在井邊吧。" },
      ],
      brief: ["兩只選種盤，我擺到田邊了。", "你祖母挑種比我快，眼睛一掃就知道哪盤會發。", "我想看看，你像不像她。"],
      upgradeText: "每天向老農班伯請教時，多拿的當季種子從 1 包變成 2 包。",
      afterText: "班伯一邊吃我帶去的菜，一邊教我看種子的顏色和飽不飽滿；現在每天向他請教，他都多塞兩包當季種子給我。",
      daily: { id: "seed_lesson", label: "向班伯領今天的選種包", result: "拿到當季種子 2 包", reward: { seasonalSeed: 2 } },
      special: { kind: "新配方", variants: {
        sturdy: { name: "耐放留種法", want: { type: "seasonal", qty: 2 }, coinsRate: 1, reward: { seasonalSeed: 3 }, diff: "兩份收成照一般訂單換錢，還留得出三包種子",
          line: "盤底壓著班伯的字：「深色的陰乾三天再收。兩份收成照一般訂單的價換錢，還留得出三包種。」" },
        quick: { name: "快長留種法", want: { type: "seasonal", qty: 2 }, coinsRate: 1, reward: { seasonalSeed: 2, materials: { compost: 1 } }, diff: "兩份收成照一般訂單換錢，再留兩包種子和一份堆肥",
          line: "盤底壓著班伯的字：「飽的先泡水催芽。兩份收成照一般訂單的價換錢，留兩包種，剩下的渣拌成堆肥。」" },
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
      intro: ["（蘿拉把三塊漆色樣板靠在還沒釘牢的農場牌下。）", "牌子不是裝飾。客人看見哪個顏色，就會記住哪種心情。"],
      marker: { anchor: "structure:shop", spot: "市集攤前", art: ROUTE_ART.sign, earlyLabel: "招牌色樣", doneLabel: "農場招牌（{color}）" },
      steps: [
        { title: "和蘿拉比較三塊招牌色樣", where: "走到市集攤前的招牌色樣，和蘿拉比較三塊色樣。", place: "marker", act: "scene", actLabel: "看招牌色樣", need: 1, lines: ["（蘿拉把三塊色樣排到陽光下。）", "紅色讓人想到甜果，藍色像河風，綠色則像剛冒芽。我偏心紅色，不過這是你的牌子。"] },
        { title: "備齊 2 份木料把招牌釘牢", where: "市集建材行有木料；備齊後走到蘿拉旁邊交給她。", place: "npc", play: "market", act: "wood", actLabel: "把木料交給蘿拉", need: 2,
          ask: "這塊牌子要是被風吹倒，我會比你還難過。木料要釘牢一點。", thanks: "好了，牌子釘牢了！顏色你來挑，我只負責誇它好看。" },
        { title: "替招牌選一個顏色", where: "走到市集攤前的招牌色樣，三種顏色選一種。", place: "marker", play: "", act: "color", need: 1 },
      ],
      brief: ["三塊色樣我都靠在市集旁了。", "我擺攤這麼多年，第一次替別人的牌子緊張。", "選你自己喜歡的就好，客人看得出來。"],
      upgradeText: "蘿拉的河畔委託金幣從多一成變成多兩成，地圖上的招牌換成你選的顏色。",
      afterText: "蘿拉把招牌釘牢，照我選的{color}重新漆過；她說遠遠就認得出是我家的貨，委託的酬勞從多一成變成多兩成。",
      daily: { id: "sign_care", label: "擦亮今天的農場招牌", result: "從招牌下找到木料 1 份", reward: { materials: { wood: 1 } } },
      special: { kind: "新訂單", variants: {
        red: { name: "莓果紅熟客單", want: { type: "meal", qty: 1 }, coinsRate: 1.2, reward: { coins: 18, seedPacks: { strawberry: 1 } }, diff: "收料理（一般訂單不收料理），外加草莓種子",
          line: "招牌腳下壓著一張訂單：「看見紅招牌來的熟客，指名要一道你做的菜。材料照一般訂單多兩成算，另付十八金，外加一包草莓種子。」" },
        blue: { name: "河水藍熟客單", want: { type: "meal", qty: 1 }, coinsRate: 1.2, reward: { coins: 18, sunlight: 1 }, diff: "收料理（一般訂單不收料理），外加陽光",
          line: "招牌腳下壓著一張訂單：「看見藍招牌來的熟客，指名要一道你做的菜。材料照一般訂單多兩成算，另付十八金，外加一點陽光。」" },
        green: { name: "嫩葉綠熟客單", want: { type: "meal", qty: 1 }, coinsRate: 1.2, reward: { coins: 18, materials: { compost: 1 } }, diff: "收料理（一般訂單不收料理），外加堆肥",
          line: "招牌腳下壓著一張訂單：「看見綠招牌來的熟客，指名要一道你做的菜。材料照一般訂單多兩成算，另付十八金，外加一份堆肥。」" },
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
      intro: ["（蘿拉沒有先談價錢，而是在攤前多放了兩張客人留言卡。）", "願意先聽，就讓客人今天先留下話。"],
      marker: { anchor: "structure:shop", spot: "市集攤前", art: ROUTE_ART.stamp, earlyLabel: "客人留言卡", doneLabel: "口味牌・{decision}" },
      steps: [
        { title: "和蘿拉讀今天的兩張留言卡", where: "走到市集攤前的客人留言卡，和蘿拉一起讀留言。", place: "marker", act: "scene", actLabel: "讀客人留言", need: 1, lines: ["（一張留言想要甜一點的點心，另一張想帶清爽的作物去河邊。）", "不能兩邊都先做。你要我先替哪一桌留貨？"] },
        { title: "決定先回哪一種客人", where: "在客人留言卡旁邊選：先回甜口味，或先回清爽口味。", place: "marker", act: "decision", need: 1, options: [
          { id: "sweet", label: "先回甜口味", tag: "甜口味", result: "蘿拉給草莓種子 2 包試種", reward: { seedPacks: { strawberry: 2 } } },
          { id: "fresh", label: "先回清爽口味", tag: "清爽口味", result: "蘿拉給胡蘿蔔種子 3 包試種", reward: { seedPacks: { carrot: 3 } } },
        ] },
        { title: "帶 1 份今天特價的作物給蘿拉", where: "備好今天特價的作物後，走到蘿拉旁邊交給她。", place: "npc", play: "market", act: "special_crop", actLabel: "把特價作物交給蘿拉", need: 1,
          ask: "客人還在等回音呢。我答應過他們，要拿最新鮮的去。", thanks: "客人的話我都記在口味牌上了。說真的，被人記住口味，比被記住價錢開心。" },
      ],
      brief: ["兩張留言卡我放到攤前了。", "以前沒人留話給我，客人買完就走。", "現在有人肯寫字給農場，我捨不得讓他們等太久。"],
      upgradeText: "蘿拉的今日特價從兩樣變成三樣。",
      afterText: "蘿拉把客人的話一句一句轉給我聽：有人誇上次的作物新鮮，也有人問下次能不能多留幾份；她說以後每天替我多留一樣特價。",
      special: { kind: "新配方", variants: {
        sweet: { name: "甜口味禮盒", want: { type: "deal", qty: 2 }, coinsRate: 1.5, reward: { coins: 6 }, diff: "收今天特價的作物（每天換一種），價錢最高",
          line: "口味牌背面是蘿拉的字：「兩份今天特價的作物，裹上糖霜裝盒。甜口味的客人肯比一般訂單多出五成，再加六金盒子錢。」" },
        fresh: { name: "清爽口味禮盒", want: { type: "deal", qty: 2 }, coinsRate: 1.2, reward: { seasonalSeed: 1 }, diff: "收今天特價的作物（每天換一種），另外回送一包種子",
          line: "口味牌背面是蘿拉的字：「兩份今天特價的作物，洗淨配薄荷葉裝盒。清爽口味的客人比一般訂單多出兩成，還會回送一包種子。」" },
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
    q.trialAt = Number.isFinite(q.trialAt) && q.trialAt > 0 ? q.trialAt : 0;
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
  /* R80C：等級還沒到、但種子包可以先種的作物裡，等級最低的那一種（全部都解鎖了就回空字串）。 */
  function nextSeedCropId(state) {
    const level = Number.isFinite(state && state.level) ? state.level : 1;
    const locked = Object.values(C.CROPS || {}).filter((c) => (c.unlockLevel || 1) > level).sort((x, y) => (x.unlockLevel || 1) - (y.unlockLevel || 1) || (x.seedCost || 0) - (y.seedCost || 0));
    return locked.length ? locked[0].id : "";
  }
  /* R84B 第 1 項：送的那包是商店還買不到的種子，拿到就能種；不再寫「Lv 3 才解鎖，現在就能種」這種前後打架的句子（圖 87、111）。 */
  const NEXT_SEED_NOTE = "還買不到，拿到就能種";
  function rewardText(reward, state) {
    const parts = [];
    if (reward && reward.coins) parts.push(reward.coins + " 金");
    if (reward && reward.nextSeed) { const id = nextSeedCropId(state); parts.push(id ? cropName(id) + "種子 " + reward.nextSeed + " 包（" + NEXT_SEED_NOTE + "）" : cropName(seasonalCropId(state)) + "種子 " + reward.nextSeed + " 包"); }
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
    if (reward.nextSeed) addSeedPacks(state, { [nextSeedCropId(state) || seasonalCropId(state)]: reward.nextSeed });
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

  /* ---------- R79C：每個選擇解鎖、有名字的新訂單或新配方 ----------
     R81A 第 1 項：報酬先對照玩家當下看得到、內容完全相同的一般訂單；看板還沒開時則對照市集預告。
     沒有完全相同的卡才退回 R80 的一般訂單平均。具名單依 coinsRate 從同一個基準算，卡片與實際入帳共用這筆數字。
     第 3 項：做了決定就能接「第一張」（只要同一種作物 2 份，新存檔幾分鐘內就交得出來）；三步做完以後每天一張，照單上的要求。 */
  const RATE_TEXT = { 1: "跟一般訂單一樣", 1.1: "比一般訂單多一成", 1.2: "比一般訂單多兩成", 1.3: "比一般訂單多三成", 1.4: "比一般訂單多四成", 1.5: "比一般訂單多五成" };
  const TRIAL_WANT = { type: "most", qty: 2 };
  /* R84B 第 1 項：同一張具名訂單只有一個份數（圖 87 寫 3 份、圖 89 寫 2 份）。第一張跟之後每天那一張要的份數一樣，
     只是不限當季或今天特價（交倉庫裡最多的那一種），新存檔做了決定就交得出來；收料理的那幾張第一張也收料理。
     TRIAL_WANT 只在找不到那張單時當後備。 */
  function trialWant(v) {
    const want = v && v.want;
    if (!want || !(want.qty > 0)) return TRIAL_WANT;
    return { type: want.type === "meal" ? "meal" : "most", qty: want.qty };
  }
  function itemSellValue(id) {
    if (C.CROPS && C.CROPS[id]) return C.CROPS[id].sellValue || 0;
    const def = typeof C.getItemDef === "function" ? C.getItemDef(id) : null;
    return def && Number.isFinite(def.sellValue) ? def.sellValue : 0;
  }
  /* 市集看板上，交 qty 份 itemId 的一般訂單平均給幾金（四種稀有度依出現機率加權）。 */
  function generalOrderAverage(itemId, qty) {
    const sell = itemSellValue(itemId), rarities = Object.values(C.ORDER_RARITY || {});
    if (!sell || !rarities.length || !(qty > 0)) return 0;
    const weight = rarities.reduce((sum, r) => sum + (r.weight || 0), 0) || 1;
    return rarities.reduce((sum, r) => sum + (r.weight || 0) * Math.max(1, Math.round(sell * r.payMult)) * qty, 0) / weight;
  }
  function shownGeneralOrder(state, itemId, qty, now) {
    if (!state || !itemId || !(qty > 0)) return 0;
    let rows = Array.isArray(state.orders) && state.orders.length ? state.orders : [];
    if (!rows.length && G && typeof G.previewMarketOrders === "function") {
      try { rows = G.previewMarketOrders(state, nowOf(now)) || []; } catch (_) { rows = []; }
    }
    return rows.reduce((best, order) => {
      const wants = order && order.wants || {}, ids = Object.keys(wants);
      if (ids.length !== 1 || ids[0] !== itemId || Number(wants[itemId]) !== Number(qty)) return best;
      return Math.max(best, Math.max(0, Number(order.rewardCoins) || 0));
    }, 0);
  }
  /* 熟客單收的那一道料理：照 shareMeal 會交出去的那一道，材料用一般訂單平均算。 */
  function mealPick(state) {
    const meals = mealsOf(state);
    return Object.keys(meals).filter((id) => (meals[id] || 0) >= 1).sort((x, y) => meals[y] - meals[x])[0] || "";
  }
  function mealAverage(state, recipeId) {
    let rows = [];
    try { rows = A && typeof A.recipes === "function" ? A.recipes(state) : []; } catch (_) { rows = []; }
    const recipe = rows.find((row) => row.id === recipeId) || rows.find((row) => row.id === "rustic_bread");
    const ingredients = recipe && isObj(recipe.ingredients) ? recipe.ingredients : { wheat: 2 };
    return Object.keys(ingredients).reduce((sum, id) => sum + generalOrderAverage(id, ingredients[id]), 0);
  }
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
  /* 手札與對話框用：做了決定會解鎖什麼（已經決定就只講那一項）。 */
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
  /* 這一張要交的東西，在一般訂單平均能拿多少金（料理照材料算）；沒有東西可比時回 0。 */
  function specialBase(state, want, itemId, now) {
    if (want.type === "meal") return state ? mealAverage(state, mealPick(state)) : 0;
    return itemId ? Math.max(generalOrderAverage(itemId, want.qty), shownGeneralOrder(state, itemId, want.qty, now)) : 0;
  }
  function specialCoins(v, itemId, state, want, now) {
    const w = want || v.want, base = specialBase(state, w, itemId, now);
    return (v.coinsRate && base ? Math.ceil(base * v.coinsRate) : 0) + ((v.reward && v.reward.coins) || 0);
  }
  function specialRewardText(state, v, itemId, want, now) {
    const w = want || v.want;
    const other = Object.assign({}, v.reward || {}); delete other.coins;
    const parts = [];
    const base = specialBase(state, w, itemId, now);
    if (v.coinsRate && !base) parts.push("金幣" + RATE_TEXT[v.coinsRate] + (v.reward && v.reward.coins ? "，再加 " + v.reward.coins + " 金" : ""));
    else { const coins = specialCoins(v, itemId, state, w, now); if (coins) parts.push(coins + " 金" + (v.coinsRate ? "（" + RATE_TEXT[v.coinsRate] + (v.reward && v.reward.coins ? "，另加 " + v.reward.coins + " 金" : "") + "）" : "")); }
    const rest = rewardText(other, state);
    if (rest) parts.push(rest);
    return parts.join("、");
  }
  function specialInfo(state, npcId, now) {
    const t = nowOf(now), r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    if (!q || !def || !def.special) return { eligible: false, can: false };
    const v = specialVariant(def, q);
    if (!v) return { eligible: false, can: false, kind: def.special.kind, unlockText: unlockText(def, q) };
    const trial = q.step < 3;
    if (trial && q.trialAt) return { eligible: false, can: false, trial: true, trialUsed: true, kind: def.special.kind, name: v.name, unlockText: unlockText(def, q) };
    const want = trial ? trialWant(v) : v.want;
    const key = (trial ? "trial:" : "special:") + def.id, today = dayKeyOf(t), used = !trial && r.daily[key] === today;
    const plan = wantPlan(state, want, t), enough = plan.have >= plan.need;
    return { eligible: true, trial, kind: def.special.kind, name: v.name, used, enough, can: !used && enough, key, today, wantText: plan.text, diff: v.diff || "",
      have: plan.have, need: plan.need, itemId: plan.itemId, rewardText: specialRewardText(state, v, plan.itemId, want, t), line: v.line,
      general: Math.round(specialBase(state, want, plan.itemId, t)), coins: specialCoins(v, plan.itemId, state, want, t),
      missingText: enough ? "" : "還差 " + (plan.need - plan.have) + (plan.kind === "meal" ? " 道料理" : " 份"), unlockText: unlockText(def, q) };
  }
  function takeSpecial(state, npcId, now) {
    const t = nowOf(now), info = specialInfo(state, npcId, t), r = ensure(state);
    if (!info.eligible) return fail("locked", info.trialUsed ? "第一張「" + info.name + "」已經交過了，做完第三步以後每天都能接一張。" : "先做第二步的決定，才會解鎖有名字的新訂單或新配方。");
    if (info.used) return fail("daily_limit", "「" + info.name + "」今天做過了，明天再來。");
    if (!info.enough) return fail("missing_special", "「" + info.name + "」要" + info.wantText + "，" + info.missingText + "。");
    const q = r.quests[npcId], def = questDef(npcId, q.choiceId), v = specialVariant(def, q);
    const want = info.trial ? trialWant(v) : v.want;
    const meal = want.type === "meal";
    const coins = specialCoins(v, meal ? "" : info.itemId, state, want, t);
    if (meal) { const shared = shareMeal(state, npcId, t); if (!shared.ok) return shared; }
    else takeItem(storageItems(state), info.itemId, want.qty);
    const reward = Object.assign({}, v.reward || {});
    if (coins) reward.coins = coins; else delete reward.coins;
    const got = grantChoiceReward(state, reward);
    if (info.trial) q.trialAt = t; else r.daily[info.key] = info.today;
    emit("change");
    const title = info.trial ? "第一張「" + info.name + "」" : "「" + info.name + "」";
    return { ok: true, npcId, name: info.name, trial: !!info.trial, rewardText: got, message: "完成" + title + "，拿到" + got + "。" };
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

  /* ---------- R80C 第 1 項：兩個決定各自的每日效果 ----------
     做了決定當天就開始：每天第一次做到那件事（收成、在光裡收成、交市集訂單、賣出作物、種下作物、從曬架收乾貨）就入帳一次。
     存檔只記今天生效了沒（r77.daily["perk:鄰居"]）與拿到什麼（r77.daily["perkGot:鄰居"]），手札照這兩欄寫「今天已生效」。 */
  const PERK_EVENTS = { harvest: "收成", sun_harvest: "在光裡收成", order: "交市集訂單", sell: "賣出作物", plant: "種下作物", dried: "從曬架收乾貨" };
  function decisionKey(def, q) { return def && q ? (def.colorStep ? (q.step >= 3 ? q.color : "") : q.decision) : ""; }
  function perkTable(npcId, q) { return q ? DECISION_DAILY[npcId + ":" + q.choiceId] || null : null; }
  function perkOf(state, npcId) {
    const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null;
    const key = decisionKey(def, q), table = perkTable(npcId, q);
    return key && table && table[key] ? { r, q, def, key, perk: table[key] } : null;
  }
  function perkInfo(state, npcId, now) {
    const p = perkOf(state, npcId);
    if (!p) return null;
    const used = p.r.daily["perk:" + npcId] === dayKeyOf(nowOf(now));
    return { key: p.key, label: optionLabelOf(p.def, p.key), text: p.perk.text, on: p.perk.on, used, got: used ? String(p.r.daily["perkGot:" + npcId] || "") : "" };
  }
  /* 手札對照表：同一條路線每個決定各一列，標出我選的那一個與今天生效了沒。 */
  function perkRows(state, npcId, now) {
    const r = ensure(state), q = r && r.quests[npcId], def = q ? questDef(npcId, q.choiceId) : null, table = perkTable(npcId, q);
    if (!def || !table) return [];
    const chosen = decisionKey(def, q), info = perkInfo(state, npcId, now);
    return Object.keys(table).map((key) => ({ key, label: optionLabelOf(def, key), text: perkText(state, table[key]), on: table[key].on, chosen: key === chosen,
      used: key === chosen && !!(info && info.used), got: key === chosen && info ? info.got : "" }));
  }
  /* 寫進手札的那一句：當季種子補上今天是哪一種作物。 */
  function perkText(state, perk) {
    const reward = perk.reward || {};
    return perk.text + (reward.seasonalSeed ? "（現在是" + cropName(seasonalCropId(state)) + "）" : "");
  }
  function secondsText(ms) {
    const sec = Math.max(1, Math.round(ms / 1000)), min = Math.floor(sec / 60), rest = sec % 60;
    return min ? min + " 分" + (rest ? " " + rest + " 秒" : "") : sec + " 秒";
  }
  function grantPerk(state, reward, ctx, t) {
    if (reward.sameCrop) {
      const id = ctx.cropId;
      if (!id || !C.CROPS || !C.CROPS[id]) return "";
      let added = reward.sameCrop;
      if (G && typeof G.addToStorage === "function") added = G.addToStorage(state, id, reward.sameCrop).added;
      else storageItems(state)[id] = (storageItems(state)[id] || 0) + added;
      return added > 0 ? cropName(id) + " " + added + " 份" : "";
    }
    if (reward.growCut) {
      const plot = Array.isArray(state.plots) ? state.plots[ctx.plotIndex] : null;
      if (!plot || !plot.cropId || !G || typeof G.plotGrowMs !== "function") return "";
      const cut = Math.round(G.plotGrowMs(state, plot, t) * reward.growCut);
      if (!(cut > 0)) return "";
      plot.plantedAt = (Number.isFinite(plot.plantedAt) ? plot.plantedAt : t) - cut;
      return "這一格" + cropName(plot.cropId) + "少等 " + secondsText(cut);
    }
    if (reward.sameDried) {
      const id = ctx.itemId;
      if (!id) return "";
      storageItems(state)[id] = (storageItems(state)[id] || 0) + reward.sameDried;
      const dried = Sunplay && isObj(Sunplay.DRIED) ? Sunplay.DRIED[id] : null;
      return (dried ? dried.name : cropName(id)) + " " + reward.sameDried + " 份";
    }
    return grantChoiceReward(state, reward);
  }
  /* 遊戲事件發生時呼叫：每位鄰居的決定每天只生效一次；ctx 帶這次的作物、田格或乾貨。 */
  function firePerks(state, event, ctx, now) {
    const r = ensure(state);
    if (!r || !PERK_EVENTS[event]) return [];
    const t = nowOf(now), today = dayKeyOf(t), fired = [];
    for (const npcId of NPC_ORDER) {
      const p = perkOf(state, npcId);
      if (!p || p.perk.on !== event || r.daily["perk:" + npcId] === today) continue;
      let got = "";
      try { got = grantPerk(state, p.perk.reward || {}, ctx || {}, t); } catch (_) { got = ""; }
      if (!got) continue;
      r.daily["perk:" + npcId] = today;
      r.daily["perkGot:" + npcId] = got.slice(0, 80);
      fired.push({ npcId, key: p.key, got });
      pushNote("你選的「" + optionLabelOf(p.def, p.key) + "」今天生效了：" + PERK_EVENTS[event] + "時多拿到" + got + "。");
    }
    if (fired.length) emit("change");
    return fired;
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
        unlock: def.special && def.special.variants[option.id] ? def.special.kind + "「" + def.special.variants[option.id].name + "」" : "",
        perk: perkTable(npcId, q) && perkTable(npcId, q)[option.id] ? perkText(state, perkTable(npcId, q)[option.id]) : "" })) : [],
    }));
    return { npcId, choiceId, name: def.name, status: q.step >= 3 ? "done" : "active", stepsDone: q.step, steps, upgraded: q.step >= 3,
      upgradeText: def.upgradeText, afterText: q.step >= 3 ? fill(def.afterText, q) : "", color: q.color, colorStep: !!def.colorStep,
      decision: q.decision, decisionText: q.decisionText, decisionReward: q.decisionReward, spot: def.marker.spot || "", objectName: def.marker.earlyLabel,
      daily: dailyInfo(state, npcId, t), special: specialInfo(state, npcId, t), unlockText: unlockText(def, q), plays: playsOf(def), rewardCoins: REWARD_COINS, rewardXp: REWARD_XP,
      perks: perkRows(state, npcId, t), decided: !!decisionKey(def, q) };
  }
  /* 「換」後面接數字時空半格（照全專案「交 3 份」的寫法）。 */
  function swapText(t) { return (/^\d/.test(String(t || "")) ? "換 " : "換") + (t || ""); }
  /* R80C 第 1 項：具名單底下一行小字，寫出跟一般訂單差在哪裡、同樣的東西交一般訂單平均能拿多少。 */
  function vsOrderHtml(sp) {
    const parts = [sp.diff ? "跟一般訂單不同：" + sp.diff : "", sp.general ? "同樣的東西交一般訂單平均 " + sp.general + " 金" : ""].filter(Boolean);
    return parts.length ? '<small class="r80c-vs-order">' + esc(parts.join("・")) + "</small>" : "";
  }
  function perkDiffHtml(state, npcId, v) {
    const rows = v.perks || [];
    if (rows.length < 2) return "";
    return '<div class="r80c-daily-diff" data-r80c-daily-diff="' + esc(npcId) + '"><p class="r80c-diff-title">' + (rows.length > 2 ? "三種顏色" : "兩個決定") + "每天的差別</p><ul>"
      + rows.map((row) => '<li class="r80c-diff-row' + (row.chosen ? " is-chosen" : "") + '" data-r80c-option="' + esc(row.key) + '"><b>' + esc(row.label) + "</b><span>" + esc(row.text) + "</span>"
        + (row.chosen ? "<em>" + (row.used ? "你選的・今天已生效：" + esc(row.got) : "你選的・今天" + esc(PERK_EVENTS[row.on] || "") + "時就會生效") + "</em>" : "") + "</li>").join("") + "</ul></div>";
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
        + (s.options && s.options.length ? '<div class="r78c-decisions" data-r78c-decisions>' + s.options.map((option) => '<span class="r79c-option" data-r78c-decision="' + esc(option.id) + '"><b>' + esc(option.label) + '</b><small>馬上拿到：' + esc(option.result) + "</small>" + (option.perk ? "<small>每天：" + esc(option.perk) + "</small>" : "") + (option.unlock ? "<small>做了決定就解鎖：" + esc(option.unlock) + "</small>" : "") + "</span>").join("") + "</div>" : "")
        + (s.status === "current" ? '<button type="button" class="r79c-go" data-r79c-go="' + esc(npcId) + '">帶我去</button>' : "")
        + "</li>").join("") + "</ol>";
    if (v.colorStep && (v.status === "done" || (v.steps[2] && v.steps[2].status === "current"))) {
      html += '<div class="r77b-colors" data-r77b-colors role="list" aria-label="招牌顏色（到市集攤前的色樣旁邊選）">' + SIGN_COLORS.map((c) => '<span class="r79c-swatch-chip" role="listitem" data-r77b-color="' + c.id + '" aria-current="' + (v.color === c.id ? "true" : "false") + '"><i class="r77b-swatch" style="background:' + c.swatch + '"></i>' + esc(c.name) + "</span>").join("") + "</div>";
    }
    if (v.decisionText) html += '<p class="r78c-decision-record" data-r78c-decision-record>我選了：<b>' + esc(v.decisionText) + '</b>・拿到：' + esc(v.decisionReward) + "</p>";
    /* R80C 第 1、3 項：兩個決定每天的差別並排列出；做了決定就能接第一張具名訂單，三步做完以後每天一張。 */
    if (!v.upgraded && v.unlockText) html += '<p class="r79c-unlock" data-r79c-unlock>' + (v.decided ? "已解鎖：" + esc(v.unlockText) + (v.special && v.special.trialUsed ? "——三步做完以後每天一張" : "——第一張現在就能接，三步做完以後每天一張") : "做了決定就解鎖：" + esc(v.unlockText) + "；第一張現在就能接，份數跟之後每天那張一樣，三步做完以後每天一張") + "</p>";
    html += perkDiffHtml(state, npcId, v);
    if (!v.upgraded && v.special && (v.special.eligible || v.special.trialUsed)) {
      const sp = v.special;
      html += '<p class="r80c-trial" data-r80c-trial="' + esc(npcId) + '">' + (sp.eligible
        ? "第一張" + esc(sp.kind) + "「" + esc(sp.name) + "」：到" + esc(v.spot) + "的" + esc(v.objectName) + "交" + esc(sp.wantText) + "，" + esc(swapText(sp.rewardText)) + "（" + (sp.enough ? "現在就能交" : esc(sp.missingText)) + "）"
        : "第一張「" + esc(sp.name) + "」交過了；做完第三步，每天都能接一張。") + (sp.eligible ? vsOrderHtml(sp) : "") + "</p>";
    }
    if (v.upgraded) html += '<p class="r77b-upgrade" data-r77b-upgrade>永久改變（已含原本加成）：' + esc(v.upgradeText) + "</p>";
    if (v.upgraded) {
      const def = questDef(npcId, v.choiceId), r = ensure(state), q = r && r.quests[npcId];
      const objectName = def.colorStep ? signLabel(state) : fill(def.marker.doneLabel.split("・")[0], q);
      const rows = [];
      if (v.daily && v.daily.eligible) rows.push('<li class="r78c-daily" data-r79c-daily="' + esc(npcId) + '">每天一次：' + esc(v.daily.label) + "——" + esc(v.daily.result) + "（" + (v.daily.can ? "今天還沒做" : "今天做過了") + "）</li>");
      const sp = v.special;
      if (sp && sp.eligible) rows.push('<li data-r79c-special="' + esc(npcId) + '"><b>' + esc(sp.kind) + "「" + esc(sp.name) + "」</b>：交" + esc(sp.wantText) + "，" + esc(swapText(sp.rewardText)) + "（" + (sp.used ? "今天做過了" : sp.enough ? "今天可以做" : esc(sp.missingText)) + "）" + vsOrderHtml(sp) + "</li>");
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
      /* R80C 第 2 項：做了決定以後物件換成那個決定的圖；圖還沒到就沿用原物件，再疊一個代表那個決定的現成小圖示。 */
      const chosen = decided ? (def.colorStep ? q.color : q.decision) : "";
      const art = decisionArt(key, chosen);
      return { npcId, choiceId: q.choiceId, done: q.step >= 3, decided, decision: def.colorStep ? q.color : q.decision, label,
        merged: def.colorStep && q.step >= 3 ? "farm_sign" : "", badge: chosen && !art ? DECISION_BADGE[chosen] || "" : "",
        marker: Object.assign({}, def.marker, { art: art || choiceArt(key, def.marker.art) }) };
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
    /* R81C／R82B：藍布舊麥種的主物件，以及封存線分天出現的鎮誌舊物與永久擺飾，一起交給場景層畫。 */
    let storyRows = [];
    try { storyRows = R && typeof R.r81SceneRows === "function" ? R.r81SceneRows(state) : []; } catch (_) { storyRows = []; }
    let branchRows = [];
    try { branchRows = R && typeof R.r82SceneRows === "function" ? R.r82SceneRows(state, Date.now()) : []; } catch (_) { branchRows = []; }
    return choiceRows.concat(chapterRows, storyRows, branchRows);
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
  function isCropItem(id) { const base = String(id || "").replace(/_(good|premium)$/, ""); return !!(C.CROPS && C.CROPS[base]); }
  function harvestPerks(state, info, now) {
    if (!info || !(info.added > 0)) return [];
    const fired = firePerks(state, "harvest", { cropId: info.cropId, plotIndex: info.plotIndex }, now);
    return info.sunlit ? fired.concat(firePerks(state, "sun_harvest", { cropId: info.cropId, plotIndex: info.plotIndex }, now)) : fired;
  }
  function hookDried() {
    if (!Sunplay) return false;
    const prev = Sunplay.onDried;
    if (prev && prev.__r77b) return false;
    const fn = function (state, itemId) {
      if (typeof prev === "function") { try { prev.apply(this, arguments); } catch (_) { /* 其他掛勾出錯不影響曬架 */ } }
      try { noteDried(state, itemId, Date.now()); } catch (_) { /* 委託進度出錯不影響曬架 */ }
      try { firePerks(state, "dried", { itemId }, Date.now()); } catch (_) { /* 每日效果出錯不影響曬架 */ }
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
          try { harvestPerks(state, { cropId: r.cropId, plotIndex, sunlit: !!(pre && pre.sunlit) || !!(r.sun && r.sun.xpBonus > 0), added: r.added }, now); } catch (_) { /* 每日效果出錯不擋收成 */ }
        }
        return r;
      });
      wrapMethod(host, "harvestAll", (orig) => function (state, now) {
        const pre = [];
        try {
          (state.plots || []).forEach((plot, i) => {
            if (plot && plot.cropId && G && typeof G.getCropProgress === "function" && G.getCropProgress(state, plot, nowOf(now)).ready) pre.push(Object.assign({ i, cropId: plot.cropId }, preHarvest(state, i, now)));
          });
        } catch (_) { /* 預掃失敗就不算 */ }
        const r = orig.apply(this, arguments);
        try { pre.forEach((p) => { const plot = state.plots[p.i]; if (plot && !plot.cropId) noteHarvest(state, p, now); }); } catch (_) { /* 委託進度出錯不擋收成 */ }
        try { pre.forEach((p) => { const plot = state.plots[p.i]; if (plot && !plot.cropId) harvestPerks(state, { cropId: p.cropId, plotIndex: p.i, sunlit: p.sunlit, added: 1 }, now); }); } catch (_) { /* 每日效果出錯不擋收成 */ }
        return r;
      });
      wrapMethod(host, "sellItem", (orig) => function (state, cropId, qty, now) {
        const r = orig.apply(this, arguments);
        if (r && r.ok) { try { noteSold(state, cropId, now); } catch (_) { /* 委託進度出錯不擋賣出 */ } }
        if (r && r.ok && isCropItem(cropId)) { try { firePerks(state, "sell", { itemId: cropId }, now); } catch (_) { /* 每日效果出錯不擋賣出 */ } }
        return r;
      });
      wrapMethod(host, "sellAll", (orig) => function (state, now) {
        let before = null;
        try { before = Object.assign({}, state.storage.items); } catch (_) { before = null; }
        const r = orig.apply(this, arguments);
        if (before) {
          try { const after = state.storage.items || {}; Object.keys(before).forEach((id) => { if ((after[id] || 0) < before[id]) noteSold(state, id, now); }); } catch (_) { /* 委託進度出錯不擋賣出 */ }
          try { const after = state.storage.items || {}, sold = Object.keys(before).find((id) => isCropItem(id) && (after[id] || 0) < before[id]); if (sold) firePerks(state, "sell", { itemId: sold }, now); } catch (_) { /* 每日效果出錯不擋賣出 */ }
        }
        return r;
      });
      /* R80C 第 1 項：市集訂單與種下作物也是每日效果的觸發點。 */
      wrapMethod(host, "fulfillOrder", (orig) => function (state, orderId, now) {
        const r = orig.apply(this, arguments);
        if (r && r.ok) { try { firePerks(state, "order", { orderId }, now); } catch (_) { /* 每日效果出錯不擋交訂單 */ } }
        return r;
      });
      wrapMethod(host, "plant", (orig) => function (state, plotIndex, cropId, now) {
        const r = orig.apply(this, arguments);
        if (r && r.ok) { try { firePerks(state, "plant", { plotIndex, cropId }, now); } catch (_) { /* 每日效果出錯不擋種植 */ } }
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
    CHOICE_ART, CHOICE_ART_READY, choiceArt, colorGift, specialInfo, takeSpecial, unlockText, dailyLine, stepPlace,
    DECISION_KEYS, DECISION_ART, DECISION_ART_READY, R85_DECISION_ART, DECISION_BADGE, DECISION_DAILY, decisionArt, perkInfo, perkRows, firePerks, harvestPerks,
    generalOrderAverage, shownGeneralOrder, nextSeedCropId, TRIAL_WANT, trialWant };
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
      /* R80C 第 2 項：三種顏色的招牌圖到了，就整張換成那個顏色的圖（沒到之前照舊用濾色）。 */
      const art = decisionArt("merchant:sign", color), img = node.querySelector("img");
      if (img && art && img.getAttribute("src").indexOf(art) !== 0) { img.setAttribute("src", art + (root.FARM_VERSION_QUERY || "")); node.dataset.r80cSignArt = color; }
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
  /* R80C 第 1 項：選項第二行寫「每天」會發生什麼，再寫解鎖哪一張具名訂單；兩個決定差在哪裡，選之前就看得到。 */
  function perkLine(state, def, key) {
    const table = DECISION_DAILY[def.npcId + ":" + def.choiceId], perk = table && table[key];
    return perk ? "每天：" + perkText(state, perk) : "";
  }
  function decisionChoices(def, step, state) {
    return (step.options || []).map((o) => {
      const v = def.special && def.special.variants[o.id], perk = perkLine(state, def, o.id);
      return { id: o.id, label: o.label, immediate: "馬上拿到：" + o.result,
        longTerm: (perk ? perk + "・" : "") + (v ? "解鎖" + def.special.kind + "「" + v.name + "」，第一張現在就能接" : "之後一直有效：" + def.upgradeText) };
    });
  }
  function colorChoices(state, def, first) {
    return SIGN_COLORS.map((c) => {
      const v = def.special && def.special.variants[c.id], perk = perkLine(state, def, c.id);
      return { id: c.id, label: c.name, immediate: first ? "開張小禮：" + rewardText(colorGift(c.id), state) : "改漆不再送開張小禮",
        longTerm: (perk ? perk + "・" : "") + (v ? (first ? "解鎖" : "熟客單換成") + def.special.kind + "「" + v.name + "」" : "招牌換成這個顏色") };
    });
  }
  function sceneLabelOf(state, npcId) { const row = sceneStates(state).find((r) => r.npcId === npcId); return row ? row.label : ""; }
  function decide(state, npcId, id, showReply) {
    dropStepNotes();
    const res = act(state, npcId, Date.now(), id);
    if (!res.ok) { showReply(res.message); return; }
    const label = sceneLabelOf(state, npcId), sp = specialInfo(state, npcId, Date.now());
    showReply(res.message + (label ? "地圖上的名牌換成「" + label + "」了。" : "") + (sp.eligible && sp.trial ? "旁邊夾著第一張" + sp.kind + "「" + sp.name + "」：交" + sp.wantText + "就能拿到" + sp.rewardText + "。" : ""));
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
    say(state, npcId, ["想換顏色？漆我有，挑吧。"], { startMode: "choices", choiceOptions: colorChoices(state, def, false),
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
      longTerm: sp.used ? "今天做過了，明天再來" : (sp.enough ? "" : sp.missingText + "・") + swapText(sp.rewardText) });
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
    if ((step.place || "marker") === "npc") {
      /* R80C 第 3 項：做了決定、第三步還沒做時，物件旁夾著第一張具名訂單，走過來就能交；第三步照舊去找鄰居。 */
      const sp = specialInfo(state, npcId, Date.now());
      if (sp.eligible && sp.trial) {
        say(state, npcId, ["（" + def.marker.earlyLabel + "旁邊夾著第一張" + sp.kind + "「" + sp.name + "」。第三步還是要走到" + NPC_NAMES[npcId] + "旁邊做。）"], { startMode: "choices",
          choiceOptions: [{ id: "special", label: "交第一張「" + sp.name + "」", immediate: "交" + sp.wantText, longTerm: (sp.enough ? "" : sp.missingText + "・") + swapText(sp.rewardText) }],
          onChoice: (id, showReply) => { const res = takeSpecial(state, npcId, Date.now()); if (res.ok) dirty = true; showReply(res.ok ? res.message + "第三步：" + fill(step.title, q) + "。" : res.message); } });
        return;
      }
      toast("「" + def.marker.earlyLabel + "」先放著，這一步要走到" + NPC_NAMES[npcId] + "旁邊做：" + fill(step.title, q) + "。");
      return;
    }
    if (step.act === "scene") {
      const next = def.steps[q.step + 1];
      const chain = !!(next && next.act === "decision" && (next.place || "marker") === "marker");
      const options = { choiceOptions: [] };
      options.onLinesDone = () => {
        const res = act(state, npcId, Date.now());
        if (!res.ok) { toast(res.message); return undefined; }
        if (chain) { options.choiceOptions = decisionChoices(def, next, state); return "choices"; }
        return undefined;
      };
      options.onChoice = (id, showReply) => decide(state, npcId, id, showReply);
      say(state, npcId, step.lines.slice(), options);
      return;
    }
    if (step.act === "decision") {
      const prev = def.steps[q.step - 1];
      say(state, npcId, [prev && prev.lines ? prev.lines[prev.lines.length - 1] : fill(step.title, q)], { startMode: "choices", choiceOptions: decisionChoices(def, step, state), onChoice: (id, showReply) => decide(state, npcId, id, showReply) });
      return;
    }
    if (step.act === "color") {
      say(state, npcId, ["挑一個吧。顏色定了，客人就記住了。"], { startMode: "choices", choiceOptions: colorChoices(state, def, true),
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
    /* R83B：鎮誌舊物直接指定一格空草地（tile:x,y），不必借站點旁邊的位置。 */
    if (kind === "tile") { const xy = String(id || "").split(",").map(Number); return tiles.find((tile) => tile.x === xy[0] && tile.y === xy[1]) || null; }
    return kind === "structure" ? tiles.find((tile) => tile.structureId === id)
      : kind === "station" ? tiles.find((tile) => tile.station === id)
        : kind === "npc" ? tiles.find((tile) => tile.npc === id) : null;
  }
  function paintScenes(state) {
    const world = document.getElementById("mapWorld");
    if (!world || !state || !state.map) return;
    /* R79C：招牌做完併進市集的「農場招牌（色名）」，不再另畫一塊名牌（圖 41、64 的兩個名牌）。 */
    const states = sceneStates(state).filter((row) => !row.merged), signature = JSON.stringify(states.map((row) => [row.npcId, row.choiceId, row.done, row.decision, row.label, row.marker.art, row.marker.displaySize || 0, row.r82bStage || "", row.badge || "", row.marker.displayTiles || 0, row.marker.footprint || null]));
    if (world.dataset.r78cScenes === signature && world.querySelectorAll(".r78c-scene-change").length === states.length) return;
    world.querySelectorAll(".r78c-scene-change, .r78c-scene-label").forEach((node) => node.remove());
    const size = Math.max(24, Math.round(world.offsetWidth / Math.max(1, state.map.width || 24)));
    /* R78 整合：物件放在錨點旁邊的地上（腳底對齊錨點的底邊），不蓋住告示牌、信箱本體，前後遮擋跟地圖其他東西一樣用腳底位置排。
       站點放左邊，水井左邊是釣魚棧橋所以放右邊；市集攤是兩格高的建築，從攤子左邊沿著攤前往右排（左邊那格是訂單看板）。
       同一個錨點有好幾樣時一樣一樣往外排，名牌往下錯開不互疊。 */
    const RIGHT_SIDE = { "station:well": true }, seen = {}, labelShift = {};
    /* R84C 第 4 項：有物件指定蓋住錨點旁邊的幾格（footprint，例如藍布老麥田 2×2）時，同一個錨點的其他物件改放到錨點正下方，不疊在那塊田上。 */
    const reserved = {}, displaced = {}; states.forEach((row) => { if (row.marker && row.marker.footprint) reserved[row.marker.anchor] = row.marker.footprint; });
    states.forEach((row) => {
      const tile = anchorTile(state, row.marker.anchor);
      if (!tile) return;
      const key = row.marker.anchor, n = seen[key] || 0; seen[key] = n + 1;
      const node = document.createElement("button");
      node.type = "button"; node.className = "r78c-scene-change" + (row.done ? " is-done" : " is-early") + (row.decided ? " is-decided" : "");
      node.dataset.r78cRoute = row.npcId + ":" + row.choiceId; node.dataset.r78cDone = row.done ? "1" : "0";
      if (row.decided && row.decision) node.dataset.r79cDecision = row.decision;
      node.setAttribute("aria-label", row.hint || row.label); node.title = row.hint || row.label;
      const basePx = Math.max(32, Math.min(48, Math.round(size * .64)));
      /* R84C 第 4、5 項：displayTiles／footprint 照格子大小畫（藍布老麥田 2×2、壓穗鎮誌牌至少跟告示牌一樣大）。 */
      const fp = row.marker.footprint || null, tilesWide = fp ? Number(fp.w) || 0 : Number(row.marker.displayTiles) || 0;
      const px = Math.max(basePx, Math.min(96, Math.round(Number(row.marker.displaySize) || 0)), tilesWide > 0 ? Math.round(size * tilesWide) : 0);
      let col, foot;
      if (fp) {
        col = tile.x + (Number(fp.dx) || 0) + tilesWide / 2;
        foot = tile.y + (Number(fp.dy) || 0) + (Number(fp.h) || tilesWide);
      } else if (reserved[key] && key.indexOf("tile:") !== 0) {
        const k = displaced[key] || 0; displaced[key] = k + 1;
        col = tile.x + .5 + k * .72;
        foot = tile.y + 2;
      } else if (key.indexOf("tile:") === 0) {
        /* R83B：指定格子的物件站在那一格正中央，腳底貼著格子下緣。 */
        col = tile.x + .5 + n * .72;
        foot = tile.y + .96;
      } else if (tile.structureId && key.indexOf("structure:") === 0) {
        const body = state.map.tiles.filter((t) => t.structureId === tile.structureId);
        col = Math.min.apply(null, body.map((t) => t.x)) - .2 + n * .72;
        foot = Math.max.apply(null, body.map((t) => t.y)) + 1.06;
      } else {
        /* R84C 第 5 項：比一格大的物件（壓穗鎮誌牌）多讓一點，不疊到同一個錨點前一樣東西。 */
        const extra = n > 0 ? Math.max(0, px / size / 2 - .36) : 0;
        col = RIGHT_SIDE[key] ? tile.x + 1.2 + n * .72 + extra : tile.x - .2 - n * .72 - extra;
        foot = tile.y + 1;
      }
      node.style.cssText = "left:" + Math.round(col * size) + "px;top:" + Math.round(foot * size) + "px;width:" + px + "px;height:" + px + "px;z-index:" + (Math.round(foot * size) + 3) + ";";
      node.innerHTML = '<img src="' + esc(row.marker.art) + '" alt="" draggable="false">'
        /* R80C 第 2 項：決定的圖還沒到之前，疊一個代表那個決定的現成小圖示（不是新畫的圖）。 */
        + (row.badge ? '<img class="r80c-decision-badge" data-r80c-badge="' + esc(row.decision) + '" src="' + esc(row.badge) + '" alt="" draggable="false">' : "");
      if (row.badge) node.dataset.r80cBadge = row.decision;
      /* R79C：點地圖上的物件就走過去打開它（第四章的記號照舊只顯示名字）。 */
      const routeNpc = NPC_ORDER.includes(row.npcId);
      /* R81C：藍布舊麥種的物件點下去也是走過去打開那一段（爭執、具名訂單、收尾或之後的一句話）。 */
      if (row.r81c) node.dataset.r81cStory = row.choiceId;
      if (fp) node.dataset.r84cField = (Number(fp.w) || 0) + "x" + (Number(fp.h) || 0);
      if (row.r82b) {
        node.dataset.r82bBranch = row.r82bKind || row.choiceId;
        if (row.r82bStage) node.dataset.r82bStage = row.r82bStage;
        if (row.artFallback) node.dataset.r82bFallback = "";
      }
      node.onclick = (event) => { event.stopPropagation(); if (routeNpc) walkToMarker(state, row.npcId); else if (row.r81c && R && typeof R.r81Go === "function") R.r81Go(state); else if (row.r82b && R && typeof R.r82Go === "function") R.r82Go(state, row); else toast(row.label); };
      world.appendChild(node);
      /* 名牌另外放一層在最上面：市集攤前面那一排會被農舍屋頂蓋到，名牌不能跟著物件一起被遮。 */
      const tag = document.createElement("span"), shift = labelShift[key] || 0;
      tag.className = "r78c-scene-label" + (row.done ? " is-done" : "") + (row.decided ? " is-decided" : ""); tag.dataset.r78cRoute = node.dataset.r78cRoute; tag.textContent = row.label;
      if (node.dataset.r79cDecision) tag.dataset.r79cDecision = node.dataset.r79cDecision;
      if (row.r82b) tag.dataset.r82bBranch = row.r82bKind || row.choiceId;
      tag.style.cssText = "left:" + Math.round(col * size) + "px;top:" + (Math.round(foot * size) + 4 + shift) + "px;";
      world.appendChild(tag);
      /* R84C 第 4 項：2×2 的田名牌放在田的上緣外面（地圖最下面兩排，下方沒有地方放）。 */
      if (fp) { tag.dataset.r84cField = node.dataset.r84cField; tag.style.top = (Math.round((foot - (Number(fp.h) || tilesWide)) * size) - (tag.offsetHeight || 17) - 2) + "px"; }
      else labelShift[key] = shift + (tag.offsetHeight || 17) + 2;
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

  /* R80C 第 6 項：農舍門口的種子袋原本放在農舍最上面那一格的腳下，整個被農舍蓋住（圖 120 只露出「1 包」）；
     搬到農舍正前方左側（腳底對齊農舍最下面一排），名牌只寫短名「門口的種子袋」、不拆行，整句留在點下去的提示裡。 */
  function fixMapNodes(state, tileSize) {
    const world = document.getElementById("mapWorld");
    if (!world || !state || !state.map || !Array.isArray(state.map.tiles)) return;
    const nodes = world.querySelectorAll(".r75b-map-node[data-r75b-seed-bag]");
    if (!nodes.length) return;
    const size = tileSize > 0 ? tileSize : Math.max(24, Math.round(world.offsetWidth / Math.max(1, state.map.width || 24)));
    nodes.forEach((node) => {
      const body = state.map.tiles.filter((t) => t.structureId === "farmhouse");
      if (!body.length) return;
      const col = Math.min.apply(null, body.map((t) => t.x)) + .35, foot = Math.max.apply(null, body.map((t) => t.y)) + 1.05;
      /* 農舍前的茶桌門廊（地圖小物）腳底比農舍再低一點，名牌要疊在它上面，所以多墊半格的高度。 */
      const left = Math.round(col * size) + "px", top = Math.round(foot * size) + "px", z = String(Math.round((foot + .5) * size));
      if (node.style.left !== left) node.style.left = left;
      if (node.style.top !== top) node.style.top = top;
      if (node.style.zIndex !== z) node.style.zIndex = z;
      const span = node.querySelector("span"), short = String(node.getAttribute("aria-label") || "").split("，")[0];
      if (span && short && span.textContent !== short) span.textContent = short;
      node.dataset.r80cMoved = "1";
    });
  }
  /* R80C 第 6 項：地圖物件的名牌不壓到鄰居名牌（任務目標的「！鎮長葛瑞」、腳下名字）、市集招牌與其他名牌（圖 41）；壓到就往下讓開，最多讓 60px。 */
  function avoidLabels() {
    const world = document.getElementById("mapWorld");
    if (!world) return;
    const tags = Array.from(world.querySelectorAll(".r78c-scene-label"));
    if (!tags.length) return;
    const boxOf = (r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    const others = Array.from(document.querySelectorAll("#markerLayer .npc-nameplate, .npc-footname, .npc-nameplate-near, .r75b-map-node span"))
      .filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden").map((n) => boxOf(n.getBoundingClientRect())).filter((r) => r.right > r.left && r.bottom > r.top);
    const placed = [];
    tags.forEach((tag) => {
      const prev = parseFloat(tag.dataset.r80cShift || "0") || 0, r0 = tag.getBoundingClientRect();
      const scale = tag.offsetHeight ? r0.height / tag.offsetHeight : 1;
      const base = { left: r0.left, right: r0.right, top: r0.top - prev * scale, bottom: r0.bottom - prev * scale };
      let shift = 0;
      for (let i = 0; i < 4; i++) {
        const box = { left: base.left, right: base.right, top: base.top + shift, bottom: base.bottom + shift };
        const hit = others.concat(placed).find((o) => o.left < box.right - 1 && o.right > box.left + 1 && o.top < box.bottom - 1 && o.bottom > box.top + 1);
        if (!hit) break;
        shift = hit.bottom - base.top + 2;
      }
      if (shift > 60 * scale) shift = 0;
      const local = Math.round(shift / (scale || 1));
      if (local !== prev) { tag.style.marginTop = local ? local + "px" : ""; tag.dataset.r80cShift = String(local); }
      placed.push({ left: base.left, right: base.right, top: base.top + shift, bottom: base.bottom + shift });
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
    try { fixMapNodes(state); } catch (_) { /* 種子袋位置失敗不擋主流程 */ }
    try { avoidLabels(); } catch (_) { /* 名牌讓位失敗不擋主流程 */ }
    try { paintChapterRoutes(state); } catch (_) { /* 第四章兩欄顯示失敗不擋主流程 */ }
    try { paintBonus(state); } catch (_) { /* 加成字樣失敗不擋 */ }
    if (pendingNotes().length || dirty) scheduleFlush();
  }
  install();
  hookFollowup();
  /* R80C 第 6 項：地圖每次重畫（R75 會重建種子袋）完立刻把種子袋搬回農舍前，不等下一次定時檢查。 */
  if (root.FarmWorld && typeof root.FarmWorld.paintWorld === "function" && !root.FarmWorld.__r80cPaintWrapped) {
    const origPaint = root.FarmWorld.paintWorld;
    root.FarmWorld.paintWorld = function (s, tileSize) { const out = origPaint.apply(this, arguments); try { fixMapNodes(s, tileSize); } catch (_) { /* 種子袋位置失敗不擋地圖 */ } return out; };
    root.FarmWorld.__r80cPaintWrapped = true;
  }
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
