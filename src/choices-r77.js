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

  /* R78C：每條路線先有角色專屬的現場事件，再由玩家做一次會留下紀錄的決定。
     decision 的兩個結果給不同物品；完成後 marker.doneLabel 會留在地圖上。 */
  const QUESTS = {
    "mayor:farm": {
      id: "morning_field", name: "晨耕", npcId: "mayor", choiceId: "farm",
      intro: ["鎮長葛瑞沒有叫你等到明天。", "他把一張田格草圖塞進種子籃：「先種田的人，今天就該看見第一個改變。」"],
      marker: { anchor: "station:sign", art: ROUTE_ART.seed, earlyLabel: "鎮長放在田邊的晨耕種子籃", doneLabel: "晨耕種子籃・{decision}" },
      steps: [
        { title: "到田邊看鎮長畫的晨耕草圖", where: "手札裡打開這段田邊對話。", act: "scene", actLabel: "看晨耕草圖", need: 1, lines: ["鎮長指著草圖上的兩個角落。", "「一邊適合留種，一邊適合曬穀。這個農場先長成哪個樣子，由你決定。」"] },
        { title: "決定種子籃先裝什麼", where: "選留種小包，或選一瓶早晨收下的陽光。", act: "decision", need: 1, options: [
          { id: "seed", label: "留種小包", result: "籃裡放進小麥種子 2 包", reward: { seedPacks: { wheat: 2 } } },
          { id: "sun", label: "晨光小瓶", result: "蓄光瓶裝進陽光 2 點", reward: { sunlight: 2 } },
        ] },
        { title: "帶 1 份日曬乾貨給鎮長", where: "倉庫備好日曬乾貨後，在這裡交給鎮長。", play: "rack", act: "give_dried", actLabel: "把乾貨交給鎮長", need: 1 },
      ],
      brief: ["田邊的種子籃已經擺好了。", "先看草圖、決定籃裡裝什麼，再帶一份乾貨給我。", "做完以後，種子籃每天都能親手翻一次。"],
      upgradeText: "田邊留下晨耕種子籃；每天可翻一次，領 1 包當季種子與 1 點陽光。",
      afterText: "鎮長收下乾貨，田邊的種子籃也照我的決定留了下來。",
      daily: { id: "field_basket", label: "翻今天的晨耕種子籃", result: "拿到 1 包當季種子與 1 點陽光", reward: { seasonalSeed: 1, sunlight: 1 } },
    },
    "mayor:town": {
      id: "town_news", name: "鎮上的事", npcId: "mayor", choiceId: "town",
      intro: ["鎮長葛瑞當場攤開兩張空白公告。", "「一張貼鎮口，一張送河邊。你先替農場選一個說話的地方。」"],
      marker: { anchor: "station:mailbox", art: ROUTE_ART.note, earlyLabel: "鎮長的新公告草稿", doneLabel: "農場公告・{decision}" },
      steps: [
        { title: "和鎮長一起讀兩張公告草稿", where: "手札裡打開鎮長的公告對話。", act: "scene", actLabel: "讀公告草稿", need: 1, lines: ["第一張寫著農場重新開門，第二張畫了通往河邊的箭頭。", "鎮長問：「你要先讓人記住農場，還是先把人帶去河邊？」"] },
        { title: "決定公告先貼哪裡", where: "選鎮口公告，或河邊路標。", act: "decision", need: 1, options: [
          { id: "town_gate", label: "貼在鎮口", result: "鎮長給 18 金作為公告工錢", reward: { coins: 18 } },
          { id: "river_path", label: "送到河邊", result: "修路剩下的木料 2 份交給你", reward: { materials: { wood: 2 } } },
        ] },
        { title: "帶一道料理，和鎮長交換鎮上消息", where: "在灶台做好料理後，回這裡端給鎮長。", play: "cook", act: "meal", actNpc: "mayor", actLabel: "端料理去聽消息", need: 1 },
      ],
      brief: ["公告草稿已經壓在信箱旁。", "讀完後選一個先貼的地方，再帶一道料理來交換消息。", "做完以後，不合手的鎮長委託每天能換一張。"],
      upgradeText: "鎮長每日委託的金幣從多一成變成多兩成，每天還可以換一次委託。",
      afterText: "我帶料理去找鎮長，公告也照選的地方貼好；不合手的鎮長委託每天能換一張。",
    },
    "elder:sell": {
      id: "first_deal", name: "第一筆生意", npcId: "elder", choiceId: "sell",
      intro: ["老農班伯立刻把一只舊秤放到市集木箱旁。", "「要學做生意，就先看秤怎麼說實話。」"],
      marker: { anchor: "station:storage", art: ROUTE_ART.basket, earlyLabel: "班伯借來的試賣秤", doneLabel: "第一筆生意木箱・{decision}" },
      steps: [
        { title: "和班伯在舊秤旁試秤一袋麥", where: "手札裡打開班伯的試賣對話。", act: "scene", actLabel: "跟班伯試秤", need: 1, lines: ["班伯把秤砣往左挪一格，又往右挪回來。", "「價錢不是越高越好。第一袋貨要替你帶回客人，還是先帶回現金？」"] },
        { title: "決定第一袋貨怎麼賣", where: "選現金成交，或留一份鄰里試吃。", act: "decision", need: 1, options: [
          { id: "cash", label: "現金成交", result: "班伯替你談到 24 金", reward: { coins: 24 } },
          { id: "sample", label: "鄰里試吃", result: "換回胡蘿蔔種子 3 包", reward: { seedPacks: { carrot: 3 } } },
        ] },
        { title: "把第一筆帳記進木箱上的帳簿", where: "回到手札，讓班伯陪你把這筆帳收尾。", act: "scene_close", actLabel: "和班伯記帳", need: 1, lines: ["班伯在帳簿最上面寫下日期。", "「記住客人怎麼來，比只記今天賺多少更有用。」"] },
      ],
      brief: ["舊秤已經放到市集木箱旁。", "跟班伯試秤、決定第一袋貨怎麼賣，再把帳記好。", "以後每天都能問一次今日行情。"],
      upgradeText: "老農班伯的河畔委託金幣從多一成變成多兩成。",
      afterText: "班伯陪我把第一筆帳寫好，市集木箱旁一直留著那只舊秤。",
      daily: { id: "market_price", label: "問班伯今天的行情", result: "班伯替你談到今日行情 8 金", reward: { coins: 8 } },
    },
    "elder:seed": {
      id: "keep_seed", name: "留種", npcId: "elder", choiceId: "seed",
      intro: ["老農班伯把兩只小木盤擺到田邊，一盤深色、一盤飽滿。", "「留種不是把剩下的收起來，是先想下一輪要什麼。」"],
      marker: { anchor: "station:well", art: ROUTE_ART.wheat, earlyLabel: "班伯的兩只選種盤", doneLabel: "留種木盤・{decision}" },
      steps: [
        { title: "聽班伯比較兩只選種盤", where: "手札裡打開班伯的選種課。", act: "scene", actLabel: "聽選種課", need: 1, lines: ["班伯捏起一顆深色種子，又拿起一顆飽滿的。", "「深色的耐放，飽滿的長得快。你這一季要哪一種？」"] },
        { title: "替下一季選一盤種", where: "選耐放的一盤，或長得快的一盤。", act: "decision", need: 1, options: [
          { id: "sturdy", label: "耐放種", result: "拿到小麥種子 3 包", reward: { seedPacks: { wheat: 3 } } },
          { id: "quick", label: "快長種", result: "拿到堆肥 2 份", reward: { materials: { compost: 2 } } },
        ] },
        { title: "帶 2 包種子和 1 道料理給班伯", where: "備齊種子包和料理後，回這裡完成選種。", play: "cook", act: "seed_meal", actLabel: "把種子和料理帶給班伯", need: 1 },
      ],
      brief: ["兩只選種盤已經擺到田邊。", "先聽班伯比較，再替下一季選一盤；最後帶種子和料理來。", "做完以後，每天可以向班伯領一次選種包。"],
      upgradeText: "每天向老農班伯請教時，多拿的當季種子從 1 包變成 2 包。",
      afterText: "班伯一邊吃我帶去的菜，一邊教我看種子的顏色和飽不飽滿；現在每天向他請教，他都多塞兩包當季種子給我。",
      daily: { id: "seed_lesson", label: "向班伯領今天的選種包", result: "拿到當季種子 2 包", reward: { seasonalSeed: 2 } },
    },
    "merchant:sign": {
      id: "farm_sign", name: "招牌", npcId: "merchant", choiceId: "sign", colorStep: true,
      intro: ["蘿拉把三塊漆色樣板靠在還沒釘牢的農場牌下。", "「牌子不是裝飾。客人看見哪個顏色，就會記住哪種心情。」"],
      marker: { anchor: "structure:shop", art: ROUTE_ART.sign, earlyLabel: "蘿拉靠在市集旁的招牌色樣", doneLabel: "農場招牌・{color}" },
      steps: [
        { title: "和蘿拉比較三塊招牌色樣", where: "手札裡打開招牌色樣對話。", act: "scene", actLabel: "看招牌色樣", need: 1, lines: ["蘿拉把三塊色樣排到陽光下。", "「紅色讓人想到甜果，藍色像河風，綠色則像剛冒芽。選色也會決定我送你的開張小禮。」"] },
        { title: "備齊 2 份木料把招牌釘牢", where: "市集建材行有木料；備齊後在這裡交給蘿拉。", play: "market", act: "wood", actLabel: "把木料交給蘿拉", need: 2 },
        { title: "替招牌選一個顏色", where: "就在這張卡上，三種顏色選一種。", play: "", act: "color", need: 1 },
      ],
      brief: ["三塊色樣已經靠在市集旁。", "先比較顏色，再用兩份木料釘牢；最後選色。", "三種顏色各有不同的開張小禮。"],
      upgradeText: "蘿拉的河畔委託金幣從多一成變成多兩成，地圖上的招牌換成你選的顏色。",
      afterText: "蘿拉把招牌釘牢，照我選的{color}重新漆過；她說遠遠就認得出是我家的貨，委託的酬勞從多一成變成多兩成。",
      daily: { id: "sign_care", label: "擦亮今天的農場招牌", result: "從招牌下找到木料 1 份", reward: { materials: { wood: 1 } } },
    },
    "merchant:listen": {
      id: "customer_words", name: "客人的話", npcId: "merchant", choiceId: "listen",
      intro: ["蘿拉沒有先談價錢，而是在攤前多放了兩張客人留言卡。", "「願意先聽，就讓客人今天先留下話。」"],
      marker: { anchor: "structure:shop", art: ROUTE_ART.stamp, earlyLabel: "市集攤前的客人留言卡", doneLabel: "客人口味牌・{decision}" },
      steps: [
        { title: "和蘿拉讀今天的兩張留言卡", where: "手札裡打開客人留言對話。", act: "scene", actLabel: "讀客人留言", need: 1, lines: ["一張留言想要甜一點的點心，另一張想帶清爽的作物去河邊。", "蘿拉說：「不能兩邊都先做。你要我先替哪一桌留貨？」"] },
        { title: "決定先回哪一種客人", where: "選甜口味，或清爽口味。", act: "decision", need: 1, options: [
          { id: "sweet", label: "先回甜口味", result: "蘿拉給草莓種子 2 包試種", reward: { seedPacks: { strawberry: 2 } } },
          { id: "fresh", label: "先回清爽口味", result: "蘿拉給胡蘿蔔種子 3 包試種", reward: { seedPacks: { carrot: 3 } } },
        ] },
        { title: "帶 1 份今天特價的作物給蘿拉", where: "備好今天特價的作物後，在這裡交給蘿拉。", play: "market", act: "special_crop", actLabel: "把特價作物交給蘿拉", need: 1 },
      ],
      brief: ["兩張留言卡已經放到攤前。", "先讀留言、決定回哪一桌，再帶一份今天特價的作物來。", "做完以後，今日特價會多留第三樣。"],
      upgradeText: "蘿拉的今日特價從兩樣變成三樣。",
      afterText: "蘿拉把客人的話一句一句轉給我聽：有人誇上次的作物新鮮，也有人問下次能不能多留幾份；她說以後每天替我多留一樣特價。",
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
      const gift = c.id === "red" ? { seedPacks: { strawberry: 2 } } : c.id === "blue" ? { sunlight: 2 } : { materials: { compost: 2 } };
      q.decisionReward = grantChoiceReward(state, gift); q.decisionAt = t;
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
      act: i === q.step ? step.act || "" : "", actLabel: i === q.step && step.act && step.act !== "color" ? step.actLabel : "",
      options: i === q.step && step.act === "decision" ? (step.options || []).map((option) => ({ id: option.id, label: option.label, result: option.result })) : [],
    }));
    return { npcId, choiceId, name: def.name, status: q.step >= 3 ? "done" : "active", stepsDone: q.step, steps, upgraded: q.step >= 3,
      upgradeText: def.upgradeText, afterText: q.step >= 3 ? fill(def.afterText, q) : "", color: q.color, colorStep: !!def.colorStep,
      decision: q.decision, decisionText: q.decisionText, decisionReward: q.decisionReward,
      daily: dailyInfo(state, npcId, t), plays: playsOf(def), rewardCoins: REWARD_COINS, rewardXp: REWARD_XP };
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
        + (s.actLabel ? '<button type="button" class="r77b-act" data-r77b-act="' + esc(npcId) + '">' + esc(s.actLabel) + "</button>" : "")
        + (s.options && s.options.length ? '<div class="r78c-decisions" data-r78c-decisions>' + s.options.map((option) => '<button type="button" class="r77b-act r78c-decision" data-r78c-decision="' + esc(option.id) + '" data-r78c-npc="' + esc(npcId) + '"><b>' + esc(option.label) + '</b><small>' + esc(option.result) + '</small></button>').join("") + "</div>" : "")
        + "</li>").join("") + "</ol>";
    if (v.colorStep && (v.status === "done" || (v.steps[2] && v.steps[2].status === "current"))) {
      html += '<div class="r77b-colors" data-r77b-colors role="group" aria-label="招牌顏色">' + SIGN_COLORS.map((c) => '<button type="button" class="r77b-color" data-r77b-color="' + c.id + '" aria-pressed="' + (v.color === c.id ? "true" : "false") + '"><i class="r77b-swatch" style="background:' + c.swatch + '"></i>' + esc(c.name) + "</button>").join("") + "</div>";
    }
    if (v.decisionText) html += '<p class="r78c-decision-record" data-r78c-decision-record>我選了：<b>' + esc(v.decisionText) + '</b>・拿到：' + esc(v.decisionReward) + "</p>";
    if (v.upgraded) html += '<p class="r77b-upgrade" data-r77b-upgrade>永久改變（已含原本加成）：' + esc(v.upgradeText) + "</p>";
    if (v.upgraded && v.daily && v.daily.eligible) html += '<div class="r77b-extra r78c-daily"><p>' + esc(v.daily.result) + '</p><button type="button" class="r77b-act" data-r78c-daily="' + esc(npcId) + '"' + (v.daily.can ? "" : " disabled") + '>' + esc(v.daily.can ? v.daily.label : "今天已互動") + "</button></div>";
    if (v.upgraded && npcId === "mayor" && v.choiceId === "town") {
      const info = mayorSwapInfo(state, t);
      if (info.eligible) {
        const label = info.can ? "換一張鎮長委託" : info.claimed ? "今天的委託已經交了" : "今天已經換過了";
        html += '<div class="r77b-extra" data-r77b-swap-box><p>今天鎮長想收 ' + esc(info.quest.qty) + " 份" + esc(info.quest.cropName) + "，完成給 " + esc(info.quest.rewardCoins) + ' 金。</p><button type="button" class="r77b-act" data-r77b-swap' + (info.can ? "" : " disabled") + ">" + esc(label) + "</button></div>";
      }
    }
    if (v.upgraded && npcId === "merchant" && v.choiceId === "listen") {
      const d = thirdDeal(state, t);
      if (d) html += '<div class="r77b-extra" data-r77b-third><p>今天第三樣特價：' + esc(d.cropName) + "種子 " + esc(d.specialPrice) + ' 金。</p><button type="button" class="r77b-act" data-r77b-buy-third>買第三樣特價種子</button></div>';
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
      const decision = q.decisionText || "等待你的決定";
      const label = fill(q.step >= 3 ? def.marker.doneLabel : def.marker.earlyLabel, q).replace(/\{decision\}/g, decision);
      return { npcId, choiceId: q.choiceId, done: q.step >= 3, decision: q.decision, label, marker: Object.assign({}, def.marker) };
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
            pushNote("你的回答立刻改變了農場：" + def.marker.earlyLabel + "出現在地圖上。");
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
        if (r && r.ok && isObj(e) && e.type === "talk") { try { noteTalk(state, e.npcId || e.id, now); } catch (_) { /* 委託進度出錯不擋交談 */ } }
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
    sceneStates, takeNotes, pendingNotes, setListener, install, hookDried };
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

  function afterAction(state, r) {
    if (!r || !r.ok) { toast(r && r.message); return; }
    if (Array.isArray(r.lines) && r.lines.length && root.StoryR76 && typeof root.StoryR76.openDialogue === "function") {
      try { root.StoryR76.openDialogue(state, r.npcId, r.lines, {}); } catch (_) { if (r.message) toast(r.message); }
    } else if (!pendingNotes().length && r.message) toast(r.message);
    dirty = true;
    flush();
  }
  function bindBrowser(section, state) {
    if (!section || typeof section.querySelectorAll !== "function" || !state) return;
    const on = (btn, fn) => { btn.onclick = (ev) => { if (ev) { ev.preventDefault(); ev.stopPropagation(); } afterAction(state, fn()); }; };
    section.querySelectorAll("[data-r77b-act]").forEach((btn) => on(btn, () => act(state, btn.dataset.r77bAct, Date.now())));
    section.querySelectorAll("[data-r77b-color]").forEach((btn) => on(btn, () => {
      const box = btn.closest("[data-r77b-quest]");
      return act(state, box ? box.dataset.r77bQuest : "merchant", Date.now(), btn.dataset.r77bColor);
    }));
    section.querySelectorAll("[data-r78c-decision]").forEach((btn) => on(btn, () => act(state, btn.dataset.r78cNpc, Date.now(), btn.dataset.r78cDecision)));
    section.querySelectorAll("[data-r78c-daily]").forEach((btn) => on(btn, () => takeDaily(state, btn.dataset.r78cDaily, Date.now())));
    section.querySelectorAll("[data-r77b-swap]").forEach((btn) => on(btn, () => swapMayorQuest(state, Date.now())));
    section.querySelectorAll("[data-r77b-buy-third]").forEach((btn) => on(btn, () => {
      const d = thirdDeal(state, Date.now());
      if (!d || !K || typeof K.buyMerchantDeal !== "function") return fail("no_deal", "今天沒有第三樣特價。");
      return K.buyMerchantDeal(state, Date.now(), d.cropId, 2);
    }));
  }
  ChoicesR77.bind = bindBrowser;

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
    const states = sceneStates(state), signature = JSON.stringify(states.map((row) => [row.npcId, row.choiceId, row.done, row.decision, row.label]));
    if (world.dataset.r78cScenes === signature && world.querySelectorAll(".r78c-scene-change").length === states.length) return;
    world.querySelectorAll(".r78c-scene-change").forEach((node) => node.remove());
    const size = Math.max(24, Math.round(world.offsetWidth / Math.max(1, state.map.width || 24)));
    states.forEach((row, index) => {
      const tile = anchorTile(state, row.marker.anchor);
      if (!tile) return;
      const node = document.createElement("button");
      node.type = "button"; node.className = "r78c-scene-change" + (row.done ? " is-done" : " is-early");
      node.dataset.r78cRoute = row.npcId + ":" + row.choiceId; node.dataset.r78cDone = row.done ? "1" : "0";
      node.setAttribute("aria-label", row.label); node.title = row.label;
      const px = Math.max(32, Math.min(48, Math.round(size * .64)));
      node.style.cssText = "left:" + Math.round((tile.x + .18 + index * .12) * size) + "px;top:" + Math.round((tile.y + .42) * size) + "px;width:" + px + "px;height:" + px + "px;z-index:" + (Math.round((tile.y + 2) * size) + 6) + ";";
      node.innerHTML = '<img src="' + esc(row.marker.art) + '" alt="" draggable="false"><span>' + esc(row.label) + "</span>";
      node.onclick = (event) => { event.stopPropagation(); toast(row.label); };
      world.appendChild(node);
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
