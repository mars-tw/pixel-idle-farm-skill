/* R61B：四位鄰居好感故事、送禮喜好、手札鄰居區塊。
   只透過既有 AdventureAPI（ensure/favor 存檔欄位）、FarmWorld.contentModal 對話框
   與手札面板（#journalPanel）接線，不改 adventure.js 的任務與料理資料。 */
(function (root) {
  "use strict";
  const A = root.AdventureAPI || (typeof require === "function" ? require("./adventure.js") : null);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const STORY_AT = [1, 3, 5]; // 好感到 1、3、5 各解鎖一段

  const PEOPLE = [
    { id: "mayor", name: "鎮長葛瑞", short: "葛瑞" },
    { id: "merchant", name: "商人蘿拉", short: "蘿拉" },
    { id: "elder", name: "老農班伯", short: "班伯" },
    { id: "child", name: "孩童圖圖", short: "圖圖" },
  ];

  // 每段 4 句，講這個人自己的過去與心事，口氣各不相同。
  const STORIES = {
    mayor: [
      { title: "葛瑞的第一雙皮鞋", lines: [
        "咳，先說好，這段別寫進鎮公所的紀錄裡。我年輕時不是鎮長，是送信的，晨光鎮每一條路，我都用腳走過不下百遍。",
        "那年大水，橋斷了，我背著郵袋涉水過河，鞋泡爛了，信一封沒濕。老鎮長看見，只說了一句：『這孩子把別人的事看得比自己的鞋重。』",
        "後來我穿上第一雙皮鞋當上鎮長，反而常常想起那雙爛鞋。鞋可以換，答應人家的事不能泡湯，這是我做鎮長的第一條規矩。",
        "你把農場種回來，也是把答應祖母的事做完。這點，咱倆是一樣的。",
      ] },
      { title: "公告欄背後的字", lines: [
        "你修公告欄的時候，有沒有翻到背面？那上面有一行很醜的字，是我十五歲刻的：『葛瑞以後要讓大家都有飯吃。』字醜，話倒是沒改過。",
        "當鎮長這些年，開會、蓋章、調解吵架，忙的都是小事。可我跟你說，鎮就是靠這些小事撐起來的，誰家屋頂漏水，都比一份公文要緊。",
        "有人笑我連路邊一張長椅都要管。我說，長椅是給走累的人坐的，鎮上要是連坐下來喘口氣的地方都沒有，那還像個家嗎？",
        "等收穫祭辦起來，我想把那行字描一描，重新漆給大家看。字還是醜的沒關係，心意看得懂就好。",
      ] },
      { title: "葛瑞的銅鈴", lines: [
        "這枚銅鈴你收好，是當年送信時掛在郵袋上的。跑過晨光鎮每一條路，聲音清脆，下雨天老遠就有人探頭出來等信。",
        "我留它留了四十年，本想帶進棺材……咳，這話不吉利。本想等晨光鎮有個肯把每戶人家都放在心上的人，再交出去。",
        "你送來的東西、幫大家做的事，我都看在眼裡。這鈴給你，以後你走在鎮上，人家聽見鈴聲，就知道是自己人來了。",
        "別推辭。鎮長的話就是鎮上的話，收下吧。往後這條路，換你替大家走下去。",
      ] },
    ],
    elder: [
      { title: "班伯和祖母的那畦田", lines: [
        "哼，別看我現在一臉兇，年輕的時候，我可是跟你祖母比賽種田，輸到脫褲……咳，輸到連晚飯都讓她請的人。",
        "那年我們一人一畦蘿蔔，她天天清晨來巡田，還在我田頭插一根竹竿，說：『班啊，你的蘿蔔要是長得比竹竿慢，你就輸啦。』氣得我三天沒睡好。",
        "結果咧？我的蘿蔔還真的輸了。不過打那以後，我種田再沒偷過懶。你祖母那個人，罵人歸罵人，心比誰都軟，我這輩子就服她一個。",
        "你回來把田種回去，我看著高興。她要是還在，肯定又要在田頭插竹竿，催你這少年仔嘍。",
      ] },
      { title: "灶邊那張空凳子", lines: [
        "我家灶邊那張凳子，你坐過，別人問我怎麼不收起來……那是阮老伴的位子。她煮湯的時候就坐在那裡，嫌我燒火燒得煙太大，罵歸罵，湯總是多盛我一碗。",
        "她走了以後，我有好幾年沒好好煮過一頓飯，一個人吃飯，煮什麼都沒味口。田還是種，日子就這麼一天一天過，凳子就一直留著。",
        "後來你們這些少年仔開始往我這裡跑，送湯送菜的，灶邊又熱鬧起來。我才想通，凳子空著不是等人，是等自己想開。",
        "所以啊，你送來的東西我嘴巴上嫌，心裡都記著。人老了不怕窮，怕的是灶冷掉，沒人來坐。",
      ] },
      { title: "一碗雨水清湯", lines: [
        "來，這碗你端著，是我親手煮的雨水清湯，配方就是你學的那一道，不過我多放了一樣——四十年的灶火，買不到的啦。",
        "下雨天接的雨水、田裡現拔的蘿蔔，看起來清清淡淡，喝下去肚子是暖的。我年輕時淋雨病倒，你祖母就是煮這碗把我罵醒的：『命顧好，田才種得久。』",
        "這碗給你帶回去，累的時候熱來喝。喝了就記得，種田慢慢來，雨下再大，田也不會一夜就荒掉。",
        "去吧去吧，別站在這裡掉眼淚，少年仔眼淚不值錢，流汗才值錢。……謝謝你肯聽我這老頭子講古啦。",
      ] },
    ],
    merchant: [
      { title: "蘿拉的第一筆生意", lines: [
        "跟你說個祕密，我蘿拉的第一筆生意，是七歲那年在市集賣檸檬水，一杯兩塊，結果第一天就被我媽抓到——因為我把糖放太多，整桶賠錢！",
        "我媽沒罵我，她說：『生意可以賠，眼光不能賠。你今天學到的，比賺十桶都值錢。』我當場哭出來，隔天就把糖減半，還學會送試喝拉客人。",
        "後來我推著一台小車跑遍附近六個鎮，哪裡有市集哪裡就有我。晴天賣果子，雨天賣傘，人家都笑我是『聞到錢味就出現的蘿拉』。",
        "所以我看你顧農場那股認真勁，就像看到當年的自己。來，握個手，咱們都是靠雙手把日子做起來的人。",
      ] },
      { title: "帳本最後一頁", lines: [
        "你看我帳本記得密密麻麻，最後一頁卻一個字都沒寫。那頁我要留著，等我存夠錢，買下市集口那間空店面，親手把第一筆生意寫上去。",
        "跑攤這些年，風吹日曬雨淋，貨淋濕過、車輪也斷過，半夜在路邊修車的時候，我就想：蘿拉啊蘿拉，你什麼時候才有一扇自己的門？",
        "不過話說回來，跑攤也有跑攤的好，鎮上誰家生孩子、誰家田裡豐收，我全都知道。這些人情，寫進帳本比金幣還難算，我可捨不得丟。",
        "等店面開起來，第一面牆我要留給客人寫字。你農場的名字，我先幫你預約最上面的位子，不收錢，算我投資你！",
      ] },
      { title: "蘿拉的秤砣吊飾", lines: [
        "這個小秤砣吊飾送你，是我阿嬤留下來的。她一輩子擺攤，秤從來只多不少，客人秤完還要再抓一把塞進人家袋子裡，說：『做生意先做人，秤才會準。』",
        "我跑商這麼多年，靠的就是這句話。便宜可以不占，信用不能欠，客人下次還會回來，這才是長久的賺法，懂嗎？",
        "把它掛在你的餐籃上吧。以後你送東西給鄰居，就像我阿嬤一樣，出手大方一點，人家記你的好，會比記你的價錢久得多。",
        "收好收好，這可是不賣的。就算你出十倍價錢……嗯，十倍的話我考慮三秒。開玩笑的啦，快收起來！",
      ] },
    ],
    child: [
      { title: "圖圖的寶藏地圖", lines: [
        "我跟你說喔，我有一張寶藏地圖，是我自己畫的！上面有會發光的河、長著糖果的樹，還有一座……一座我還沒想好要藏什麼的山。",
        "班伯說地圖要畫真的東西，不能亂畫。可是真的東西我都畫不好，河畫得像蚯蚓，房子畫得像饅頭，大家都笑我，哼，我就越要畫。",
        "後來葛瑞爺爺跟我說，他年輕送信的時候也畫過地圖，把每條路都記下來，才不會把信送錯。他說地圖畫家的第一步，是先把自己住的地方畫清楚。",
        "所以我決定了！我要先把晨光鎮畫完，畫到每一棵樹都認得我。等我畫好，第一張就送你，掛在你農舍的牆上喔！",
      ] },
      { title: "不能說的樹洞", lines: [
        "噓——我告訴你一個祕密，你不可以跟別人說喔。森林邊邊那棵大樹有一個樹洞，我把我寫的信都藏在裡面，寫給……寫給長大以後的我。",
        "我寫說：長大以後要記得回来晨光鎮，要畫好多好多地圖，還要記得班伯的蘿蔔田在哪裡、蘿拉阿姨的攤子在哪裡，一個都不可以忘記。",
        "因為我怕長大就會忘記嘛。大人都好忙，忙到忘記小時候答應過的事。所以我要先寫下來，以後自己看了就想起来了。",
        "你也是喔，你答應祖母要把農場種回來，你有做到，所以我才跟你說這個祕密。全鎮我只告訴你一個人，拉鉤！",
      ] },
      { title: "圖圖畫的農場地圖", lines: [
        "鏘鏘——你看！我畫好了，晨光鎮地圖第一張，畫的就是你的農場！這裡是田、這裡是雞舍、這裡是你，這個笑得最開心的人就是你喔。",
        "我量了好久，你的田是十二步寬、二十步長，河邊那條路我走了三遍才畫對。班伯說這次畫得很像，蘿拉阿姨還說要裱起來賣，我說不行，這是要送你的！",
        "背面我有寫字：『送給把農場種回來的人，以後我畫全世界的地圖，也會從這裡開始。』你要收好，不可以弄丟喔。",
        "等我長大當了地圖畫家，回來看到這張圖，就會想起今天。我們說好囉，你也要記得我喔，拉鉤蓋印，一百年不變！",
      ] },
    ],
  };

  // 喜歡的禮物（已有作物與料理）；不在清單裡的都是普通禮物。
  const LOVED = {
    mayor: ["tomato", "rustic_bread"],
    elder: ["carrot", "carrot_wheat_stew"],
    merchant: ["strawberry", "grapes"],
    child: ["strawberry", "wild_berry", "sunflower"],
  };
  // 送禮台詞：喜歡與普通各一句，口氣依人不同。
  const GIFT_LINES = {
    mayor: { loved: "哦……這正是我想擺上鎮公所茶桌的。咳，我是說，謝謝你，這份心意鎮上收到了。", normal: "你有心了。我替晨光鎮謝謝你，東西我會好好用上。" },
    elder: { loved: "哼，算你懂我這老頭子的嘴。這味對了，今晚的湯就靠它了，少年仔會做人喔。", normal: "嗯，收下了收下了。別老是送東西，多來坐坐，陪我講兩句話卡實在。" },
    merchant: { loved: "哎呀——你怎麼知道我愛這個！市價我都不用算了，這份我自己留著享用，謝謝你啦，大客戶！", normal: "謝謝謝謝！你放心，我蘿拉收禮不白收，下次你來攤上，我給你挑最好的。" },
    child: { loved: "哇——是我最喜歡的！你怎麼知道？你是不是有偷看我的地圖！謝謝你，我要把它畫進地圖裡面！", normal: "給我的嗎？謝謝！我要放在我的寶藏盒子裡面，跟我的地圖放一起！" },
  };
  // R64B（第 5 項）：喜好線索——寫進日常對話與手札，讓玩家能推理該送什麼，不必亂試。
  const CLUES = {
    mayor: "鎮公所茶桌上要是擺一盤番茄，或剛烤好的農家麥餅，我批公文都特別有精神。",
    elder: "我這老嘴就愛胡蘿蔔那口甜；胡蘿蔔麥粒燉鍋熱熱地喝一碗，下田全身都暖。",
    merchant: "跑攤一整天，我最想留一顆草莓、幾顆葡萄給自己，酸酸甜甜的才提神。",
    child: "草莓跟野莓酸酸甜甜的最好吃！向日葵黃黃的我也好喜歡，想把它畫進地圖裡。",
  };
  // R64B（第 5 項）：每人一種不喜歡的禮物，送到會被委婉婉拒，好感不增加、東西不收下。
  const DISLIKED = { mayor: "sunflower", elder: "strawberry", merchant: "carrot", child: "river_mint" };
  const DISLIKED_LINES = {
    mayor: "這花是好看，就是花香重了些，我鼻子受不了。先謝謝你，這份你留著擺家裡吧。",
    elder: "這草莓太嬌貴，我這老牙口怕酸甜黏牙。你自己留著吃，我心領了，少年仔。",
    merchant: "哎呀，胡蘿蔔我攤上天天綁、天天賣，休息時就想換個口味。這份先還你，謝謝啦。",
    child: "薄荷涼涼的，好像把牙膏吃進嘴巴……這個我不行啦，謝謝你，我下次想吃甜甜的。",
  };
  // R64B（第 6 項）：聽完第 2 段故事（好感 3 解鎖的那段）後得到的實際好處。
  const BENEFITS = {
    mayor: { id: "mayor_reclaim_discount", text: "開墾農地少付 5 金" },
    elder: { id: "elder_daily_compost", text: "每天做完今日農務，多領 1 份堆肥" },
    merchant: { id: "merchant_sell_bonus", text: "市集收購價多 5%" },
    child: { id: "child_forage_bonus", text: "採集時多拿 1 份" },
  };
  function benefitUnlocked(state, npcId) {
    const seen = state && state.adventure && state.adventure.r61b && state.adventure.r61b.seen;
    return !!(seen && Array.isArray(seen[npcId]) && seen[npcId].includes(1));
  }
  function benefitOf(state, npcId, now) {
    ensure(state, now);
    const def = BENEFITS[npcId];
    return def ? { id: def.id, text: def.text, unlocked: benefitUnlocked(state, npcId) } : null;
  }
  // R64B（第 7 項）：鄰居委託排序——現在能做且章節最接近目前主線的在前，舊章節未完成標可補做排後面。
  function sortPersonalQuests(list, currentChapter) {
    const cur = Math.max(1, Math.min(5, Number(currentChapter) || 1));
    const group = (p) => {
      if (p.completed) return 3;
      if (!p.unlocked) return 2;
      return p.chapter < cur ? 1 : 0;
    };
    return [...(list || [])].map((p) => Object.assign({}, p, {
      canDoNow: !!(p.unlocked && !p.completed),
      catchUp: !!(p.unlocked && !p.completed && p.chapter < cur),
    })).sort((a, b) =>
      group(a) - group(b)
      || Math.abs(a.chapter - cur) - Math.abs(b.chapter - cur)
      || a.chapter - b.chapter
      || Number(b.canComplete) - Number(a.canComplete)
      || String(a.id).localeCompare(String(b.id)));
  }
  // 第 3 段專屬禮物：kind=item 進背包（storage.items），kind=meal 進餐籃（adventure.meals）。
  const GIFTS = {
    mayor: { kind: "item", id: "r61b_mayor_bell", name: "葛瑞的送信銅鈴", note: "掛上之後走在鎮上，鈴聲清脆，像自己人回家。" },
    elder: { kind: "meal", id: "bamber_rain_soup", name: "老農班伯的雨水清湯", note: "班伯親手煮的一碗，已放進你的餐籃，累的時候熱來喝。" },
    merchant: { kind: "item", id: "r61b_merchant_charm", name: "蘿拉的秤砣吊飾", note: "蘿拉阿嬤留下來的吊飾，提醒你做生意先做人。" },
    child: { kind: "item", id: "r61b_child_map", name: "圖圖畫的農場地圖", note: "圖圖量了十二步寬、二十步長，親手畫的第一張地圖。" },
  };

  function ensure(state, now) {
    if (!state || typeof state !== "object") return { ok: false };
    if (A && A.ensure) A.ensure(state, now);
    if (!state.adventure) state.adventure = {};
    if (!state.adventure.r61b || typeof state.adventure.r61b !== "object") state.adventure.r61b = {};
    const b = state.adventure.r61b;
    if (!b.seen || typeof b.seen !== "object") b.seen = {};         // npcId -> [已看段數索引]
    if (!b.giftDay || typeof b.giftDay !== "object") b.giftDay = {}; // npcId -> 上次送禮的日界鍵
    if (!b.revealed || typeof b.revealed !== "object") b.revealed = {}; // npcId -> [已送過的物品]
    if (!b.giftItem || typeof b.giftItem !== "object") b.giftItem = {}; // npcId -> 專屬禮物已領
    if (!b.dislikedSeen || typeof b.dislikedSeen !== "object") b.dislikedSeen = {}; // R64B：npcId -> [送過才知道不喜歡的物品]
    for (const p of PEOPLE) {
      if (!Array.isArray(b.seen[p.id])) b.seen[p.id] = [];
      if (!Array.isArray(b.revealed[p.id])) b.revealed[p.id] = [];
      if (!Array.isArray(b.dislikedSeen[p.id])) b.dislikedSeen[p.id] = [];
    }
    return { ok: true };
  }
  function favorOf(state, npcId) {
    const f = state && state.adventure && state.adventure.r58 && state.adventure.r58.favor;
    return Math.max(0, Number(f && f[npcId]) || 0);
  }
  function addFavor(state, npcId, n) {
    if (!state.adventure.r58) state.adventure.r58 = {};
    if (!state.adventure.r58.favor) state.adventure.r58.favor = {};
    const f = state.adventure.r58.favor;
    f[npcId] = Math.min(999, Math.max(0, (Number(f[npcId]) || 0) + n));
    return f[npcId];
  }
  function dayKey(now) { return new Date(now).toISOString().slice(0, 10); }
  function itemName(itemId) {
    const def = typeof root.getItemDef === "function" ? root.getItemDef(itemId) : null;
    if (def && def.name) return def.name;
    for (const g of Object.values(GIFTS)) if (g.id === itemId) return g.name;
    if (A && A.recipes) { /* 料理名稱由呼叫端補 */ }
    return itemId;
  }
  function mealName(state, mealId) {
    if (A && A.recipes && state) { const r = A.recipes(state).find((x) => x.id === mealId); if (r) return r.name; }
    const fallback = { rustic_bread: "農家麥餅", carrot_wheat_stew: "胡蘿蔔麥粒燉鍋", bamber_rain_soup: "老農班伯的雨水清湯" };
    return fallback[mealId] || mealId;
  }
  function ownedOf(state, itemId) {
    const gift = Object.values(GIFTS).find((g) => g.id === itemId);
    if (gift && gift.kind === "meal") return (state.adventure.meals && state.adventure.meals[itemId]) || 0;
    const isMeal = ["rustic_bread", "carrot_wheat_stew", "bamber_rain_soup", "baked_carrot", "mint_tea", "wheat_carrot_pancake"].includes(itemId);
    if (isMeal) return (state.adventure.meals && state.adventure.meals[itemId]) || 0;
    return (state.storage && state.storage.items && state.storage.items[itemId]) || 0;
  }
  function takeOne(state, itemId) {
    const isMeal = ownedMeal(state, itemId);
    if (isMeal) { state.adventure.meals[itemId] -= 1; if (state.adventure.meals[itemId] <= 0) delete state.adventure.meals[itemId]; return true; }
    if (state.storage && state.storage.items && state.storage.items[itemId] > 0) {
      state.storage.items[itemId] -= 1; if (state.storage.items[itemId] <= 0) delete state.storage.items[itemId]; return true;
    }
    return false;
  }
  function ownedMeal(state, itemId) {
    return !!(state.adventure && state.adventure.meals && state.adventure.meals[itemId] > 0)
      && ["rustic_bread", "carrot_wheat_stew", "bamber_rain_soup", "baked_carrot", "mint_tea", "wheat_carrot_pancake"].includes(itemId);
  }
  function displayName(state, itemId) {
    const gift = Object.values(GIFTS).find((g) => g.id === itemId);
    if (gift) return gift.name;
    if (["rustic_bread", "carrot_wheat_stew", "bamber_rain_soup", "baked_carrot", "mint_tea", "wheat_carrot_pancake"].includes(itemId)) return mealName(state, itemId);
    return itemName(itemId);
  }

  // 可送的禮物清單：背包與餐籃裡實際擁有的作物/料理，標出已揭曉的喜好。
  function giftOptions(state, npcId, now) {
    ensure(state, now);
    const b = state.adventure.r61b;
    const ids = new Set([...Object.keys((state.storage && state.storage.items) || {}), ...Object.keys(state.adventure.meals || {})]);
    const loved = LOVED[npcId] || [];
    return [...ids].filter((id) => ownedOf(state, id) > 0).map((id) => ({
      id, name: displayName(state, id), owned: ownedOf(state, id),
      loved: loved.includes(id),
      disliked: DISLIKED[npcId] === id,
      revealed: b.revealed[npcId].includes(id),
      dislikedRevealed: b.dislikedSeen[npcId].includes(id),
    })).sort((x, y) => Number(y.loved) - Number(x.loved) || x.name.localeCompare(y.name, "zh-Hant"));
  }
  function canGiftToday(state, npcId, now) {
    ensure(state, now);
    return state.adventure.r61b.giftDay[npcId] !== dayKey(now);
  }
  function giveGift(state, npcId, itemId, now) {
    ensure(state, now);
    const person = PEOPLE.find((p) => p.id === npcId);
    if (!person) return { ok: false, reason: "no_npc", message: "找不到這位鄰居。" };
    if (!canGiftToday(state, npcId, now)) return { ok: false, reason: "daily_limit", message: `今天已經送過${person.short}了，明天再來吧。` };
    if (ownedOf(state, itemId) <= 0) return { ok: false, reason: "not_owned", message: "背包裡沒有這樣東西，先去收成或做一道料理吧。" };
    // R64B（第 5 項）：不喜歡的禮物被委婉婉拒——不收下、好感 +0、今天還能再送別的。
    if (DISLIKED[npcId] === itemId) {
      const b0 = state.adventure.r61b;
      if (!b0.dislikedSeen[npcId].includes(itemId)) b0.dislikedSeen[npcId].push(itemId);
      return { ok: true, loved: false, disliked: true, gained: 0, favor: favorOf(state, npcId), line: DISLIKED_LINES[npcId], itemName: displayName(state, itemId), giftRevealed: false,
        message: `${person.short}委婉地婉拒了這份禮物，好感沒有增加。`, pendingStory: null };
    }
    if (!takeOne(state, itemId)) return { ok: false, reason: "not_owned", message: "背包裡沒有這樣東西，先去收成或做一道料理吧。" };
    const loved = (LOVED[npcId] || []).includes(itemId);
    const gained = loved ? 2 : 1;
    const favor = addFavor(state, npcId, gained);
    const b = state.adventure.r61b;
    b.giftDay[npcId] = dayKey(now);
    if (!b.revealed[npcId].includes(itemId)) b.revealed[npcId].push(itemId);
    const line = loved ? GIFT_LINES[npcId].loved : GIFT_LINES[npcId].normal;
    const pending = pendingStory(state, npcId, now);
    return { ok: true, loved, gained, favor, line, itemName: displayName(state, itemId), giftRevealed: loved,
      message: loved ? `${person.short}很喜歡這份禮物，好感 +${gained}。` : `把禮物送給了${person.short}，好感 +${gained}。`,
      pendingStory: pending ? { index: pending.index, title: pending.title } : null };
  }

  function storyState(state, npcId, now) {
    ensure(state, now);
    const favor = favorOf(state, npcId);
    const seen = state.adventure.r61b.seen[npcId];
    return STORIES[npcId].map((story, index) => ({
      index, title: story.title, lines: story.lines.slice(),
      need: STORY_AT[index], unlocked: favor >= STORY_AT[index],
      seen: seen.includes(index),
    }));
  }
  function pendingStory(state, npcId, now) {
    return storyState(state, npcId, now).find((s) => s.unlocked && !s.seen) || null;
  }
  function nextStoryProgress(state, npcId, now) {
    const list = storyState(state, npcId, now);
    const next = list.find((s) => !s.unlocked);
    if (!next) return { nextNeed: null, remaining: 0, allUnlocked: true };
    return { nextNeed: next.need, remaining: Math.max(0, next.need - favorOf(state, npcId)), allUnlocked: false };
  }
  // 看完一段故事：標記已看；第 3 段給專屬禮物（只給一次）。
  function markStorySeen(state, npcId, index, now) {
    ensure(state, now);
    const list = storyState(state, npcId, now);
    const story = list[index];
    if (!story) return { ok: false, reason: "no_story", message: "找不到這段故事。" };
    if (!story.unlocked) return { ok: false, reason: "locked", message: `好感還差 ${story.need - favorOf(state, npcId)}，之後再來聽這段吧。` };
    const b = state.adventure.r61b;
    const firstTime = !b.seen[npcId].includes(index);
    if (firstTime) b.seen[npcId].push(index);
    let gift = null;
    if (index === 2 && firstTime && !b.giftItem[npcId]) {
      const g = GIFTS[npcId];
      if (g.kind === "meal") { if (!state.adventure.meals) state.adventure.meals = {}; state.adventure.meals[g.id] = (state.adventure.meals[g.id] || 0) + 1; }
      else { if (!state.storage.items) state.storage.items = {}; state.storage.items[g.id] = (state.storage.items[g.id] || 0) + 1; }
      b.giftItem[npcId] = true;
      gift = { id: g.id, name: g.name, note: g.note, kind: g.kind };
    }
    // R64B（第 6 項）：第一次聽完第 2 段故事，好處正式生效。
    const benefit = index === 1 && firstTime ? benefitOf(state, npcId, now) : null;
    return { ok: true, firstTime, story: { index, title: story.title, lines: story.lines }, gift, benefit };
  }
  // 手札鄰居區塊資料：好感愛心、下一段還差多少、已揭曉喜好、已看故事可重看。
  function journalData(state, now) {
    ensure(state, now);
    const b = state.adventure.r61b;
    return PEOPLE.map((p) => {
      const favor = favorOf(state, p.id);
      const prog = nextStoryProgress(state, p.id, now);
      const lovedIds = LOVED[p.id] || [];
      return {
        id: p.id, name: p.name, short: p.short, favor,
        hearts: "❤".repeat(Math.min(5, favor)) + "🤍".repeat(Math.max(0, 5 - Math.min(5, favor))),
        nextNeed: prog.nextNeed, remaining: prog.remaining, allUnlocked: prog.allUnlocked,
        canGiftToday: canGiftToday(state, p.id, now),
        pending: (() => { const s = pendingStory(state, p.id, now); return s ? { index: s.index, title: s.title } : null; })(),
        clue: CLUES[p.id],
        disliked: { id: DISLIKED[p.id], name: displayName(state, DISLIKED[p.id]) },
        dislikedRevealed: b.dislikedSeen[p.id].includes(DISLIKED[p.id]),
        benefit: benefitOf(state, p.id, now),
        lovedRevealed: lovedIds.filter((id) => b.revealed[p.id].includes(id)).map((id) => ({ id, name: displayName(state, id) })),
        lovedHiddenCount: lovedIds.filter((id) => !b.revealed[p.id].includes(id)).length,
        giftOptions: giftOptions(state, p.id, now),
        stories: storyState(state, p.id, now),
        giftReceived: !!b.giftItem[p.id],
        gift: b.giftItem[p.id] ? { id: GIFTS[p.id].id, name: GIFTS[p.id].name, note: GIFTS[p.id].note } : null,
      };
    });
  }

  const NeighborsR61 = { PEOPLE, STORIES, LOVED, CLUES, DISLIKED, DISLIKED_LINES, BENEFITS, GIFT_LINES, GIFTS, STORY_AT, ensure, favorOf, benefitUnlocked, benefitOf, sortPersonalQuests, giftOptions, canGiftToday, giveGift, storyState, pendingStory, nextStoryProgress, markStorySeen, journalData, displayName };
  root.NeighborsR61 = NeighborsR61;
  if (typeof module !== "undefined" && module.exports) module.exports = NeighborsR61;

  /* ---------- 瀏覽器接線：手札鄰居區塊 + 對話框播放 + 送禮 ---------- */
  if (typeof document === "undefined" || !root.FarmWorld) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const farm = () => root.__farm;
  function currentState() {
    const f = farm();
    if (!f) return null;
    if (typeof f.state === "function") return f.state();
    return f.state || f.currentState || null;
  }
  function saveNow(state) {
    const f = farm();
    if (f && f.safeSaveNow) f.safeSaveNow();
    if (root.FarmWorld && root.FarmWorld.refresh) root.FarmWorld.refresh(state);
  }
  // R64B（第 9 項）：鄰居面板右上角關閉鈕（至少 44px），按下關掉面板並回到手札鄰居區塊。
  function returnToJournal(state, box) {
    if (farm() && farm().closeModal) farm().closeModal("worldModal");
    if (root.FarmWorld && root.FarmWorld.openPanel) root.FarmWorld.openPanel("journal");
    else if (farm() && farm().selectTab) farm().selectTab("journal");
    injectJournal(state);
    const sec = document.querySelector("[data-r61b-neighbors]");
    if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: "start" });
  }
  function wireNeighborClose(state, box) {
    const btn = box.querySelector(".world-modal-close");
    if (!btn) return;
    btn.classList.add("r64b-neighbor-close");
    btn.dataset.r64bNeighborClose = "";
    btn.setAttribute("aria-label", "關閉鄰居面板，回到手札");
    btn.setAttribute("title", "關閉，回到手札");
    btn.onclick = () => returnToJournal(state, box);
  }
  function beatHearts(npcId) {
    const card = document.querySelector(`[data-r61b-neighbor="${npcId}"]`);
    const hearts = card && card.querySelector(".r61b-hearts");
    if (!hearts) return;
    hearts.classList.remove("r64b-heart-beat");
    void hearts.offsetWidth;
    hearts.classList.add("r64b-heart-beat");
    setTimeout(() => hearts.classList.remove("r64b-heart-beat"), 1300);
  }
  function playStory(state, npcId, index) {
    const list = storyState(state, npcId, Date.now());
    const story = list[index];
    const person = PEOPLE.find((p) => p.id === npcId);
    if (!story || !person) return;
    if (!story.unlocked) { if (farm() && farm().toast) farm().toast(`好感還差 ${story.need - favorOf(state, npcId)}，之後再來聽這段吧。`); return; }
    let step = 0;
    const box = root.FarmWorld.contentModal(`${person.name}・${story.title}`,
      `<div class="r61b-story" data-r61b-story="${npcId}-${index}"><p class="r61b-story-line" data-r61b-line></p><p class="r61b-story-step" data-r61b-step></p></div>`,
      "");
    box.classList.add("r61b-modal");
    wireNeighborClose(state, box);
    const card = box.querySelector(".modal-card");
    const bar = document.createElement("div"); bar.className = "content-footer r61b-footer";
    bar.innerHTML = `<button type="button" class="content-primary" data-r61b-next>下一句</button><button type="button" class="content-secondary" data-r61b-close>先聊到這裡</button>`;
    card.appendChild(bar);
    const lineEl = box.querySelector("[data-r61b-line]"), stepEl = box.querySelector("[data-r61b-step]");
    const render = () => {
      lineEl.textContent = story.lines[step];
      stepEl.textContent = `第 ${step + 1} 句，共 ${story.lines.length} 句`;
      bar.querySelector("[data-r61b-next]").textContent = step >= story.lines.length - 1 ? "聽完了" : "下一句";
    };
    bar.querySelector("[data-r61b-next]").onclick = () => {
      if (step < story.lines.length - 1) { step++; render(); return; }
      const result = markStorySeen(state, npcId, index, Date.now());
      saveNow(state); injectJournal(state);
      if (farm() && farm().closeModal) farm().closeModal("worldModal");
      if (result.gift && farm() && farm().toast) farm().toast(`收到專屬禮物：${result.gift.name}。${result.gift.note}`);
      else if (result.benefit && farm() && farm().toast) farm().toast(`聽完這段故事，獲得好處：${result.benefit.text}。`);
    };
    bar.querySelector("[data-r61b-close]").onclick = () => returnToJournal(state, box);
    render();
  }
  function openGiftPicker(state, npcId) {
    const data = journalData(state, Date.now()).find((d) => d.id === npcId);
    if (!data) return;
    const opts = data.giftOptions;
    const box = root.FarmWorld.contentModal(`送禮給${data.name}`,
      `<p class="r61b-gift-hint r64b-clue">線索：${esc(data.clue)}</p>` + (opts.length
        ? `<p class="r61b-gift-hint">${data.canGiftToday ? "選一樣背包或餐籃裡的東西送出去。今天每人只能送一次喔。" : "今天已經送過了，明天再來吧。"}</p><div class="r61b-gift-list">${opts.map((o) => `<button type="button" class="r61b-gift-btn" data-r61b-gift="${esc(o.id)}" ${data.canGiftToday ? "" : "disabled"}>${esc(o.name)}（有 ${o.owned} 份）${o.revealed && o.loved ? "・他很喜歡" : ""}${o.dislikedRevealed ? "・他不太喜歡" : ""}</button>`).join("")}</div>`
        : `<p class="r61b-gift-hint">背包和餐籃都是空的，先去田裡收成，或到灶台做一道料理再來吧。</p>`), "");
    box.classList.add("r61b-modal");
    wireNeighborClose(state, box);
    const card = box.querySelector(".modal-card");
    const bar = document.createElement("div"); bar.className = "content-footer r61b-footer";
    bar.innerHTML = `<button type="button" class="content-secondary" data-r61b-back>回鄰居手札</button>`;
    card.appendChild(bar);
    bar.querySelector("[data-r61b-back]").onclick = () => returnToJournal(state, box);
    box.querySelectorAll("[data-r61b-gift]").forEach((btn) => {
      btn.onclick = () => {
        const result = giveGift(state, npcId, btn.dataset.r61bGift, Date.now());
        saveNow(state);
        if (farm() && farm().closeModal) farm().closeModal("worldModal");
        if (farm() && farm().toast) farm().toast(result.ok ? `${result.line}（好感 +${result.gained}）` : result.message);
        injectJournal(state);
        if (result.ok && result.loved) beatHearts(npcId);
        if (result.ok && result.pendingStory) setTimeout(() => playStory(state, npcId, result.pendingStory.index), 350);
      };
    });
  }
  function journalSectionHtml(state) {
    const rows = journalData(state, Date.now());
    return `<section class="r61b-neighbors" data-r61b-neighbors aria-label="鄰居好感">
      <div class="story-kicker">🏡 鄰居好感</div>
      ${rows.map((d) => `<article class="r61b-card" data-r61b-neighbor="${d.id}">
        <h3 class="r61b-name">${esc(d.name)}</h3>
        <p class="r61b-hearts" data-r61b-favor="${d.favor}">好感 ${d.hearts}（${d.favor}）</p>
        <p class="r61b-next">${d.allUnlocked ? "三段故事都聽過了" : `下一段故事：好感 ${d.nextNeed} 解鎖，還差 ${d.remaining}`}</p>
        <p class="r61b-loved">喜歡的禮物：${d.lovedRevealed.length ? d.lovedRevealed.map((x) => esc(x.name)).join("、") : `線索：${esc(d.clue)}`}${d.lovedRevealed.length && d.lovedHiddenCount ? `（還有 ${d.lovedHiddenCount} 樣沒發現）` : ""}</p>
        ${d.lovedRevealed.length ? `<p class="r61b-clue r64b-clue">線索：${esc(d.clue)}</p>` : ""}
        ${d.dislikedRevealed ? `<p class="r61b-disliked r64b-disliked">不太喜歡：${esc(d.disliked.name)}（送這個不會增加好感）</p>` : ""}
        <p class="r61b-benefit r64b-benefit" data-r64b-benefit="${d.benefit.unlocked ? "owned" : "locked"}">${d.benefit.unlocked ? `已獲得：${esc(d.benefit.text)}` : `聽完第 2 段故事可獲得：${esc(d.benefit.text)}`}</p>
        ${d.gift ? `<p class="r61b-got">專屬禮物：${esc(d.gift.name)}・${esc(d.gift.note)}</p>` : ""}
        <div class="r61b-actions">
          <button type="button" class="r61b-gift-open" data-r61b-gift-open="${d.id}" ${d.canGiftToday ? "" : "disabled"}>${d.canGiftToday ? "送禮" : "今天送過了"}</button>
          ${d.stories.map((s) => s.seen
            ? `<button type="button" class="r61b-story-btn" data-r61b-replay="${d.id}:${s.index}">重看「${esc(s.title)}」</button>`
            : s.unlocked
              ? `<button type="button" class="r61b-story-btn" data-r61b-play="${d.id}:${s.index}">聽「${esc(s.title)}」</button>`
              : `<button type="button" class="r61b-story-btn" data-r61b-locked="${d.id}:${s.index}" disabled>好感 ${s.need} 解鎖下一段</button>`).join("")}
        </div>
      </article>`).join("")}
    </section>`;
  }
  let injecting = false;
  function injectJournal(state) {
    const panel = document.querySelector("#journalPanel");
    if (!panel || !state) return;
    injecting = true;
    panel.querySelectorAll("[data-r61b-neighbors]").forEach((el) => el.remove());
    const host = document.createElement("div");
    host.innerHTML = journalSectionHtml(state);
    const section = host.firstElementChild;
    panel.appendChild(section);
    section.querySelectorAll("[data-r61b-gift-open]").forEach((b) => { b.onclick = () => openGiftPicker(state, b.dataset.r61bGiftOpen); });
    section.querySelectorAll("[data-r61b-play],[data-r61b-replay]").forEach((b) => {
      b.onclick = () => { const [npcId, idx] = (b.dataset.r61bPlay || b.dataset.r61bReplay).split(":"); playStory(state, npcId, Number(idx)); };
    });
    injecting = false;
  }
  function tryInject() {
    const panel = document.querySelector("#journalPanel");
    if (panel && panel.querySelector("[data-r61b-neighbors]")) return; // 已注入（含自己觸發的觀察），不重複寫入
    const state = currentState();
    if (state) injectJournal(state);
  }
  const observer = new MutationObserver(() => { if (!injecting) tryInject(); });
  const start = () => {
    const panel = document.querySelector("#journalPanel");
    if (panel) observer.observe(panel, { childList: true });
    tryInject();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  root.NeighborsR61.injectJournal = injectJournal;
  root.NeighborsR61.playStory = playStory;
  root.NeighborsR61.openGiftPicker = openGiftPicker;
})(typeof window !== "undefined" ? window : globalThis);
