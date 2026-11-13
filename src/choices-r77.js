/* R77B：第 7～8 項——六種開場回答各接一條三步的後續委託。
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

  /* 六條後續委託。step.event：由遊戲事件推進；step.act：在手札按鈕交付（兩者都有就任一種都算）。
     文字裡的 {natural} 換成照顧方式「放著長」的現行名稱、{color} 換成選的招牌顏色。 */
  const QUESTS = {
    "mayor:farm": {
      id: "morning_field", name: "晨耕", npcId: "mayor", choiceId: "farm",
      steps: [
        { title: "在光裡收成 3 次", where: "農田：等陽光照到已經熟的那一格，再去收成。", play: "sun", event: "sun_harvest", need: 3 },
        { title: "到曬架曬好並收下 1 批乾貨", where: "農舍旁的曬架：放上 2 份作物、用掉 1 點陽光，曬好以後收下來，四種乾貨都算。", play: "rack", event: "dried", need: 1 },
        { title: "帶 1 份日曬乾貨給鎮長葛瑞", where: "倉庫裡有日曬乾貨時，在這張卡按「把乾貨交給鎮長」。", play: "rack", act: "give_dried", actLabel: "把乾貨交給鎮長", need: 1 },
      ],
      brief: ["對了，還有一件事想麻煩你。", "趁那道光還在的時候多收幾次，再到曬架曬一批乾貨帶來給我看看。", "三件事都做完，門口那袋種子我每天多放一包當季的。"],
      upgradeText: "門口的種子袋從每天 1 包變成每天 2 包，第二包是當季作物。",
      afterText: "鎮長收下那份乾貨，說聞起來都是太陽的味道；從那天起，門口的種子袋每天多一包當季的種子。",
    },
    "mayor:town": {
      id: "town_news", name: "鎮上的事", npcId: "mayor", choiceId: "town",
      steps: [
        { title: "和四位鄰居各說一次話", where: "地圖上找鎮長葛瑞、老農班伯、蘿拉和圖圖，各說一次話。", play: "", event: "talk", ids: TALK_NPCS, distinct: true, need: 4 },
        { title: "完成 2 次鎮長的委託", where: "手札「鄰居專屬互動」裡的鎮公所委託（一天一張）；鎮長開口向你要東西時交給他也算。", play: "order", event: "mayor_order", need: 2 },
        { title: "帶一道自己做的料理去回報鎮長", where: "到農舍灶台做一道料理，再在這張卡按「把料理端給鎮長」。", play: "cook", act: "meal", actNpc: "mayor", actLabel: "把料理端給鎮長", need: 1 },
      ],
      brief: ["既然你想多認識鎮上，我再託你一件事。", "去跟班伯、蘿拉和圖圖都打聲招呼，再幫我跑兩趟委託。", "忙完帶一道你做的菜來，我們邊吃邊聊，之後我的委託酬勞再往上加。"],
      upgradeText: "鎮長每日委託的金幣從多一成變成多兩成，每天還可以換一次委託。",
      afterText: "我帶著自己做的菜去找鎮長，把鎮上四個人的近況都說了一遍；他說以後委託的酬勞再加一成，不合手的委託每天還能換一張。",
    },
    "elder:sell": {
      id: "first_deal", name: "第一筆生意", npcId: "elder", choiceId: "sell",
      steps: [
        { title: "在市集賣出 3 種不同的作物", where: "蘿拉的市集或倉庫賣出：三種不同的作物各賣一次就算，乾貨和料理不算。", play: "market", event: "sold", distinct: true, need: 3 },
        { title: "完成 2 次老農班伯的委託", where: "河畔委託「老農班伯的灶邊晚餐」（修好河畔釣台後開放）、送鄰居餐籃給班伯，或班伯開口要東西時交給他，都算。", play: "order", event: "elder_order", need: 2 },
        { title: "找老農班伯算帳", where: "地圖上找老農班伯說話。", play: "", event: "talk", ids: ["elder"], need: 1 },
      ],
      brief: ["賣東西這回事，一袋是運氣，三樣才是生意。", "去市集賣三種不一樣的作物，再幫我跑兩趟委託。", "都做完再來找我，我教你把帳算清楚，往後我的委託也多算你一成。"],
      upgradeText: "老農班伯的河畔委託金幣從多一成變成多兩成。",
      afterText: "班伯拿樹枝在地上陪我把帳算了一遍，說三種作物都賣得出去才叫生意；之後他託我的委託，酬勞從多一成變成多兩成。",
    },
    "elder:seed": {
      id: "keep_seed", name: "留種", npcId: "elder", choiceId: "seed",
      steps: [
        { title: "用「{natural}」收成 2 次", where: "農田：播種時把照顧方式選成「{natural}」，等作物熟了再收成。", play: "", event: "natural_harvest", need: 2 },
        { title: "到曬架曬好並收下 1 批乾貨", where: "農舍旁的曬架：放上 2 份作物、用掉 1 點陽光，曬好以後收下來，四種乾貨都算。", play: "rack", event: "dried", need: 1 },
        { title: "帶 2 包種子和 1 道料理給班伯", where: "用「{natural}」收成會退回種子包，料理在農舍灶台做；備齊後在這張卡按「把種子和料理帶給班伯」。", play: "cook", act: "seed_meal", actLabel: "把種子和料理帶給班伯", need: 1 },
      ],
      brief: ["留種不是把種子收進袋子就好。", "先用「{natural}」收成兩次，再到曬架曬一批乾貨，看看什麼叫曬得透。", "然後帶兩包種子和一道菜來，我邊吃邊教你認種，以後每天多給你一包。"],
      upgradeText: "每天向老農班伯請教時，多拿的當季種子從 1 包變成 2 包。",
      afterText: "班伯一邊吃我帶去的菜，一邊教我看種子的顏色和飽不飽滿；現在每天向他請教，他都多塞兩包當季種子給我。",
    },
    "merchant:sign": {
      id: "farm_sign", name: "招牌", npcId: "merchant", choiceId: "sign", colorStep: true,
      steps: [
        { title: "備齊 2 份木料交給蘿拉", where: "蘿拉的市集裡有「建材行」，木料一份 6 金；備齊後在這張卡按「把木料交給蘿拉」。", play: "market", act: "wood", actLabel: "把木料交給蘿拉", need: 2 },
        { title: "做一道料理分給蘿拉", where: "到農舍灶台做一道料理，在這張卡按「把料理分給蘿拉」；送鄰居餐籃給她也算。", play: "cook", event: "meal_merchant", act: "meal", actNpc: "merchant", actLabel: "把料理分給蘿拉", need: 1 },
        { title: "替招牌選一個顏色", where: "就在這張卡上，三種顏色選一種。", play: "", act: "color", need: 1 },
      ],
      brief: ["牌子掛上去了，可是風一吹就晃，顏色也還是木頭色。", "幫我備兩份木料把它釘牢，再做一道菜來，我們邊吃邊挑顏色。", "顏色讓你選；招牌漆好以後，我的委託再多算你一成。"],
      upgradeText: "蘿拉的河畔委託金幣從多一成變成多兩成，地圖上的招牌換成你選的顏色。",
      afterText: "蘿拉把招牌釘牢，照我選的{color}重新漆過；她說遠遠就認得出是我家的貨，委託的酬勞從多一成變成多兩成。",
    },
    "merchant:listen": {
      id: "customer_words", name: "客人的話", npcId: "merchant", choiceId: "listen",
      steps: [
        { title: "完成 2 次蘿拉的委託", where: "河畔委託「蘿拉的河鮮籃」（修好河畔釣台後開放）、送鄰居餐籃給蘿拉，或蘿拉開口要東西時交給她，都算。", play: "order", event: "merchant_order", need: 2 },
        { title: "帶 1 份她今天特價的作物給蘿拉", where: "蘿拉的市集：把她今天特價的那種作物賣 1 份給她，或備好後在這張卡按「把特價作物交給蘿拉」。", play: "market", event: "sold_special", act: "special_crop", actLabel: "把特價作物交給蘿拉", need: 1 },
        { title: "聽蘿拉轉述客人的話", where: "地圖上找蘿拉說話。", play: "", event: "talk", ids: ["merchant"], need: 1 },
      ],
      brief: ["你肯先聽客人說話，那我再託你一件事。", "幫我跑兩趟委託，再帶一份我今天特價的那種作物來，我想讓客人看看實際種出來的樣子。", "忙完來找我，我把客人說的話一句一句轉給你聽，特價也替你多留一樣。"],
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
    r.version = 1;
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

  /* 看過 R76 回訪的開場選擇，補上後續委託（舊存檔載入時也走這裡）。 */
  function sync(state, now, opts) {
    const r = ensure(state);
    if (!r) return [];
    const t = nowOf(now);
    const started = [];
    for (const npcId of NPC_ORDER) {
      if (r.quests[npcId]) continue;
      const choiceId = savedChoice(state, npcId);
      if (!choiceId || !followupSeen(state, npcId, choiceId)) continue;
      r.quests[npcId] = { choiceId, startedAt: t, step: 0, count: 0, seen: [], doneAt: [], upgraded: false, color: "", rewardedAt: 0 };
      started.push(npcId);
    }
    if (started.length && !(opts && opts.silent)) {
      if (started.length === 1) {
        const def = questDef(started[0], r.quests[started[0]].choiceId);
        pushNote(NPC_NAMES[started[0]] + "多交代了一件事：後續委託「" + def.name + "」開始了，三個步驟寫在手札「我做過的選擇」。");
      } else {
        pushNote(started.map((id) => NPC_NAMES[id]).join("、") + "都多交代了一件事：" + started.map((id) => "「" + questDef(id, r.quests[id].choiceId).name + "」").join("、") + "這幾條後續委託開始了，步驟寫在手札「我做過的選擇」。");
      }
    }
    if (started.length) emit("change");
    return started;
  }
  /* R76 回訪剛播完：開始後續委託，並把這次交談算進去（ui.js 是先記交談再開回訪）。 */
  function onFollowupSeen(state, npcId, now) {
    const started = sync(state, now);
    if (!started.includes(npcId)) return false;
    dispatch(state, ["talk"], npcId, now, npcId);
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
      return done();
    }
    return fail("unknown_step", "這一步還不能在這裡做。");
  }

  /* ---------- 升級後才有的動作 ---------- */
  function dayKeyOf(t) { return M && typeof M.dayKey === "function" ? M.dayKey(t) : new Date(t).toISOString().slice(0, 10); }
  function upgraded(state, npcId) { return !!(A && typeof A.r77Upgraded === "function" && A.r77Upgraded(state, npcId)); }
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
    }));
    return { npcId, choiceId, name: def.name, status: q.step >= 3 ? "done" : "active", stepsDone: q.step, steps, upgraded: q.step >= 3,
      upgradeText: def.upgradeText, afterText: q.step >= 3 ? fill(def.afterText, q) : "", color: q.color, colorStep: !!def.colorStep,
      plays: playsOf(def), rewardCoins: REWARD_COINS, rewardXp: REWARD_XP };
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
        + "</li>").join("") + "</ol>";
    if (v.colorStep && (v.status === "done" || (v.steps[2] && v.steps[2].status === "current"))) {
      html += '<div class="r77b-colors" data-r77b-colors role="group" aria-label="招牌顏色">' + SIGN_COLORS.map((c) => '<button type="button" class="r77b-color" data-r77b-color="' + c.id + '" aria-pressed="' + (v.color === c.id ? "true" : "false") + '"><i class="r77b-swatch" style="background:' + c.swatch + '"></i>' + esc(c.name) + "</button>").join("") + "</div>";
    }
    if (v.upgraded) html += '<p class="r77b-upgrade" data-r77b-upgrade>加成升一級：' + esc(v.upgradeText) + "</p>";
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
    noteHarvest, noteSold, noteTalk, noteOrder, noteDried, act, swapMayorQuest, mayorSwapInfo, thirdDeal,
    questView, cardHtml, bind: function () {}, signColor, signLabel, signDataset, seedBagLabel,
    takeNotes, pendingNotes, setListener, install, hookDried };
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
    if (!pendingNotes().length && r.message) toast(r.message);
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
    section.querySelectorAll("[data-r77b-swap]").forEach((btn) => on(btn, () => swapMayorQuest(state, Date.now())));
    section.querySelectorAll("[data-r77b-buy-third]").forEach((btn) => on(btn, () => {
      const d = thirdDeal(state, Date.now());
      if (!d || !K || typeof K.buyMerchantDeal !== "function") return fail("no_deal", "今天沒有第三樣特價。");
      return K.buyMerchantDeal(state, Date.now(), d.cropId, 2);
    }));
  }
  ChoicesR77.bind = bindBrowser;

  function tick() {
    hookDried();
    hookFollowup();
    if (document.querySelector("#startupLoading")) return;
    const state = browserState();
    if (!state || !isObj(state.adventure)) return;
    try { sync(state, Date.now()); } catch (_) { /* 補委託失敗下次再試 */ }
    try { paintSign(state); } catch (_) { /* 招牌字樣失敗不擋 */ }
    try { paintBonus(state); } catch (_) { /* 加成字樣失敗不擋 */ }
    if (pendingNotes().length || dirty) scheduleFlush();
  }
  install();
  hookFollowup();
  const start = () => { tick(); setInterval(tick, 700); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  ChoicesR77.paintSign = paintSign;
  ChoicesR77.paintBonus = paintBonus;
  ChoicesR77.flush = flush;
})(typeof window !== "undefined" ? window : globalThis);
