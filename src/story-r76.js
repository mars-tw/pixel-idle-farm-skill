/* R76B：第 8～13 項——開場選擇對白與回訪、鄰居頭像、收穫祭評比明細、任務卡去重。
   純邏輯可由 Node 載入；瀏覽器段提供逐句對話框，並包住鄰居交付以累計回訪訂單數。 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const A = isNode ? require("./adventure.js") : (root.AdventureAPI || null);
  const C = isNode ? require("./config.js") : (root.CONFIG || root);
  const G = isNode ? require("./game.js") : (root.Game || root);

  const PORTRAITS = {
    mayor: "assets/generated/content-r77/portrait-mayor.png",
    elder: "assets/generated/content-r76/portrait-elder.png",
    merchant: "assets/generated/content-r76/portrait-merchant.png",
    child: "assets/generated/content-r76/portrait-child.png",
    miri: "assets/generated/r84/miri-0.png",
  };
  const PORTRAIT_BY_NAME = { "鎮長葛瑞": PORTRAITS.mayor, "老農班伯": PORTRAITS.elder, "商人蘿拉": PORTRAITS.merchant, "蘿拉": PORTRAITS.merchant, "孩童圖圖": PORTRAITS.child, "圖圖": PORTRAITS.child, "米莉": PORTRAITS.miri };
  const SPEAKER_NAMES = { mayor: "鎮長葛瑞", elder: "老農班伯", merchant: "蘿拉", child: "圖圖" };
  function portraitFor(key) {
    if (!key) return "";
    if (PORTRAITS[key]) return PORTRAITS[key];
    return PORTRAIT_BY_NAME[key] || "";
  }

  /* 與 adventure.js R60_STORY_CHOICES 同一份問句：最後一句就是手札「當時問」。 */
  const CHOICES = {
    mayor: { storyId: "mayor_welcome", npcId: "mayor", speaker: "鎮長葛瑞", lines: ["你祖母把這片田照顧了很多年。", "現在輪到你替農場寫下一段新故事。", "第一格種下去以前，想先從哪裡開始？"], options: [
      { id: "farm", label: "我先去種田", result: "小麥種子包 +1", immediate: "馬上拿到：小麥種子包 1 包", longTerm: "之後一直有效：農舍門口的種子袋每天送 1 包小麥種子", reply: "好。種子拿去，田不會等人。你祖母當年也是這樣，話還沒聽完就下田了。" },
      { id: "town", label: "先聽你講鎮上的事", result: "金幣 +5", immediate: "馬上拿到：金幣 5 枚", longTerm: "之後一直有效：鎮長每日委託的金幣多一成", reply: "好，坐下聽我說。班伯嘴硬心軟，蘿拉什麼都想賣，圖圖認得每一條小路。這個鎮，好久沒來新面孔了。" },
    ] },
    elder: { storyId: "elder_wheat", npcId: "elder", speaker: "老農班伯", lines: ["這批新麥聞起來不錯。", "賣掉能換現金，留下來也能替下一輪打底。", "你想先賣，還是先留種？"], options: [
      { id: "sell", label: "先賣一小袋", result: "金幣 +5", immediate: "馬上拿到：金幣 5 枚", longTerm: "之後一直有效：老農班伯的河畔委託金幣多一成", reply: "賣就賣吧。只是別連明年也一起賣掉——這種傻事，我年輕時幹過。" },
      { id: "seed", label: "先留一包種子", result: "小麥種子包 +1", immediate: "馬上拿到：小麥種子包 1 包", longTerm: "之後一直有效：每天向班伯請教時，多拿 1 包當季種子", reply: "先留種的人走得遠。我爹教我的第一件事就是這個，你祖母也懂。" },
    ] },
    merchant: { storyId: "merchant_hello", npcId: "merchant", speaker: "蘿拉", lines: ["我替你的農場留了一格攤位。", "第一批貨不用多，重點是讓客人記住名字。", "你想把牌子擺得醒目，還是先問客人喜歡什麼？"], options: [
      { id: "sign", label: "先把農場牌掛起來", result: "金幣 +5", immediate: "馬上拿到：金幣 5 枚", longTerm: "之後一直有效：農場入口立起招牌，蘿拉的河畔委託金幣多一成", reply: "好，先把牌子掛起來！我最喜歡看客人指著招牌說「就是那家」。" },
      { id: "listen", label: "先聽客人想買什麼", result: "草莓種子包 +1", immediate: "馬上拿到：草莓種子包 1 包", longTerm: "之後一直有效：蘿拉的今日特價從一樣變兩樣", reply: "好，先聽客人說。說真的，肯先聽的農場主人，我在這個鎮上沒見過幾個。" },
    ] },
  };
  function choiceDef(npcId) { return CHOICES[npcId] || null; }
  function questionOf(npcId) { const def = CHOICES[npcId]; return def ? def.lines[def.lines.length - 1] : ""; }

  const FOLLOWUPS = {
    "mayor:farm": { lines: ["前幾天你說要先去種田，我後來經過田邊看了一眼，那包小麥種子長得還順吧？", "我在田埂上站了好一會兒。好久沒人在那片田裡彎腰了，我竟然有點不習慣。"], summary: "鎮長問起那包小麥種子，說好久沒人在那片田裡彎腰，他竟然有點不習慣。" },
    "mayor:town": { lines: ["上次你先聽我講鎮上的事，後來去認得班伯和蘿拉了嗎？", "鎮上好久沒人肯坐下來聽我囉嗦了。你那天沒急著走，我記到現在。"], summary: "鎮長問我認得鎮上的人了沒，說好久沒人肯坐下來聽他說話。" },
    "elder:sell": { lines: ["你上次先賣的那一小袋新麥，價錢還合意吧？那批麥香，客人到現在還會問起。", "賣得掉，我替你高興。只是看著整袋麥被扛走，心裡還是空了一下。老頭子就是這樣。"], summary: "班伯問起那袋新麥賣得怎樣，說看著整袋麥被扛走，心裡還是空了一下。" },
    "elder:seed": { lines: ["你上次留下的那包種子，後來長得怎樣？有沒有接上下一輪的收成？", "會留種的人我最放心。看你那天捧著種子的樣子，我想起我爹。"], summary: "班伯問起我留下的那包種子，說看我捧著種子的樣子，想起他爹。" },
    "merchant:sign": { lines: ["你那塊農場牌掛起來之後，真的有人指名問起你的攤位，今天又來了一個。", "我差點跟他說那是我挑的位置。好啦，是你的牌子，我只是很得意。"], summary: "蘿拉說農場牌掛起來後有人指名來問，她得意得像是自己的牌子。" },
    "merchant:listen": { lines: ["你上次說要先聽客人想買什麼，後來有沒有聽到什麼新鮮的需求？", "最近好多人問甜的、能配茶的東西。有人說吃到就想起小時候，我聽了一整個下午都很開心。"], summary: "蘿拉說最近大家常問甜的、能配茶的東西，有人吃了就想起小時候。" },
  };
  function dayKeyOf(now) { return new Date(Number.isFinite(now) ? now : 0).toISOString().slice(0, 10); }
  function ensure(state) {
    if (!state || typeof state !== "object") return null;
    if (!state.r76story || typeof state.r76story !== "object" || Array.isArray(state.r76story)) state.r76story = {};
    const b = state.r76story;
    if (!b.seen || typeof b.seen !== "object" || Array.isArray(b.seen)) b.seen = {};
    if (!b.orders || typeof b.orders !== "object" || Array.isArray(b.orders)) b.orders = {};
    return b;
  }
  function selectedChoiceId(state, npcId) {
    const def = CHOICES[npcId];
    if (!def || !state || !state.adventure) return null;
    const saved = state.adventure.r58 && state.adventure.r58.r59 && state.adventure.r58.r59.r60 && state.adventure.r58.r59.r60.storyChoices && state.adventure.r58.r59.r60.storyChoices[def.storyId];
    return saved && saved.choiceId ? saved.choiceId : null;
  }
  function choiceAt(state, npcId) {
    const def = CHOICES[npcId];
    if (!def || !state || !state.adventure) return 0;
    const saved = state.adventure.r58 && state.adventure.r58.r59 && state.adventure.r58.r59.r60 && state.adventure.r58.r59.r60.storyChoices && state.adventure.r58.r59.r60.storyChoices[def.storyId];
    return saved && Number.isFinite(saved.at) ? saved.at : 0;
  }
  function followupDef(state, npcId) {
    const choiceId = selectedChoiceId(state, npcId);
    if (!choiceId) return null;
    const def = FOLLOWUPS[npcId + ":" + choiceId];
    return def ? { npcId, choiceId, lines: def.lines.slice(), summary: def.summary } : null;
  }
  function followupDue(state, npcId, now, via) {
    const b = ensure(state);
    if (!b) return null;
    const def = followupDef(state, npcId);
    if (!def || b.seen[npcId]) return null;
    const orders = Number(b.orders[npcId] || 0);
    if (orders >= 2) return def;
    if (via === "talk") {
      const at = choiceAt(state, npcId);
      if (at && dayKeyOf(now) !== dayKeyOf(at)) return def;
    }
    return null;
  }
  function noteOrder(state, npcId, now) {
    const b = ensure(state);
    if (!b) return { count: 0, due: null };
    b.orders[npcId] = Number(b.orders[npcId] || 0) + 1;
    return { count: b.orders[npcId], due: followupDue(state, npcId, now, "order") };
  }
  function noteTalk(state, npcId, now) { return followupDue(state, npcId, now, "talk"); }
  function markFollowupSeen(state, npcId, now) {
    const b = ensure(state);
    const def = followupDef(state, npcId);
    if (!b || !def) return null;
    b.seen[npcId] = { choiceId: def.choiceId, at: Number.isFinite(now) ? now : Date.now(), summary: def.summary };
    return def;
  }
  function followupSummary(state, npcId) {
    const b = ensure(state);
    if (!b || !b.seen[npcId]) return "";
    return b.seen[npcId].summary || "";
  }

  const FESTIVAL_ROWS = [
    { id: "diverse", label: "種類不同" },
    { id: "seasonal", label: "當季作物" },
    { id: "hasMeal", label: "有料理" },
    { id: "quality", label: "優質作物" },
    { id: "hasDried", label: "日曬乾貨" },
  ];
  function festivalBreakdown(judging) {
    const sources = (judging && judging.scoreSources) || {};
    const rows = FESTIVAL_ROWS.map((row) => ({ id: row.id, label: row.label, got: !!sources[row.id] }));
    if (judging && Array.isArray(judging.breakdown) && judging.breakdown.length) {
      for (const saved of judging.breakdown) { const row = rows.find((r) => r.id === saved.id); if (row) row.got = !!saved.got; }
    }
    const total = rows.filter((r) => r.got).length;
    const stars = judging && Number.isFinite(judging.stars) ? judging.stars : (total >= 4 ? 3 : total >= 2 ? 2 : 1);
    const missing = rows.filter((r) => !r.got).map((r) => r.label);
    return { rows, total, max: 5, stars, missing, nextForThree: total < 4 ? missing.slice(0, Math.max(1, 4 - total)) : [], thresholdText: "一星要 1 分、二星要 2 分、三星要 4 分，滿分 5 分" };
  }
  function festivalTip(judging) {
    const b = festivalBreakdown(judging);
    if (b.total >= 5) return "五項全拿到了；下次可換別的作物組合挑戰同樣的滿分。";
    if (b.stars >= 3) return "三星已到手；下次直接補「" + b.missing[0] + "」就能拿滿五項。";
    return "三星要四項，還差 " + Math.max(0, 4 - b.total) + " 項；下次先補「" + b.nextForThree.join("」和「") + "」。";
  }

  function isDuplicateQuestRow(mainText, rows) {
    const main = String(mainText || "").replace(/^主線：/, "").trim();
    if (!main) return false;
    return (rows || []).some((row) => {
      const text = typeof row === "string" ? row : (row && row.text) || "";
      const name = (row && row.name) || "";
      const cleaned = String(text).replace(/^[○✓]\s*/, "").replace(/（與祭典共用）$/, "").trim();
      return cleaned && (main === cleaned || main.includes(cleaned) || (name && main.includes(name) && /\d+\s*\/\s*\d+/.test(main) && /\d+\s*\/\s*\d+/.test(cleaned)));
    });
  }

  /* ---------- R81C：新存檔前十分鐘的小故事「藍布舊麥種」 ----------
     一、祖母便箋留一個謎：籃底那包藍布舊麥種，布上沒寫名字，是誰的？
     二、餐籃送到鎮長葛瑞手上時，舊麥種滾出來：鎮長葛瑞要封存（不想再看見它），老農班伯要種回田裡（種子關著就死了）——同一包種子，兩個人要的相反。
     三、玩家選一邊：地圖上多一個物件（水井旁的藍布老麥田，或告示牌旁的鎮公所封存箱），並解鎖那一邊的一張具名訂單。
     四、交完那張訂單，演一段收尾場景：謎底是鎮長葛瑞他爹留下的麥種，鎮長葛瑞從板著臉講規矩，到說出當年的事。
     鄰居說的話只講立場與心情；要交什麼、拿多少，寫在選項、手札與地圖物件的對話選項上。 */
  const R81_MYSTERY = "籃底還壓著一小包藍布舊麥種，布上沒寫名字。便箋最後一行寫著：「這包不是我的。它的主人一看就認得。」";
  const R81_TITLE = "藍布舊麥種是誰的？";
  const R81_CONFLICT = [
    { by: "", text: "（餐籃見了底，那包藍布舊麥種滾到葛瑞腳邊。他彎腰去撿，手停在半空。）" },
    { by: "mayor", text: "這包……布上沒寫名字。沒人認的舊東西，就送鎮公所封起來，誰都別碰。" },
    { by: "", text: "（老農班伯扛著鋤頭經過，一眼就盯住那塊藍布。）" },
    { by: "elder", text: "封起來？種子關一年就死一年。這麥我聞得出來，它是要下田的。" },
    { by: "mayor", text: "班伯，這不關你的事。" },
    { by: "elder", text: "也不關你的事，葛瑞。籃子是她留給這孩子的。" },
    { by: "", text: "（兩個人都轉過來看你。藍布包還在你手上。）" },
  ];
  /* 兩個選項：地圖物件放哪裡、名牌寫什麼、解鎖哪一張具名訂單、交完以後演哪一段收尾。
     訂單金幣以「同樣東西的一般訂單最多給多少」為底（市集新手單每份是售價七倍，其餘訂單照稀有度倍率），再乘 rate。 */
  const R81_OPTIONS = {
    plant: {
      label: "照班伯說的，種回田裡", side: "elder", anchor: "station:well", spot: "水井旁", object: "藍布老麥田",
      reply: { by: "elder", text: "好。我去井邊翻一小塊地給它。你看葛瑞那張臉，我好多年沒見他這麼慌了。" },
      labels: { order: "藍布老麥田・班伯在等", scene: "藍布老麥田・班伯有話要說", done: "藍布老麥田・等你播種" },
      order: { name: "班伯的老麥回禮單", want: { wheat: 2 }, rate: 1.2, extra: { seedPacks: { wheat: 2 } }, extraText: "小麥種子 2 包",
        line: { by: "elder", text: "老麥要配新麥一起曬，種才養得回來。拿你自己種的麥來，別人的我不要。" } },
      scene: [
        { by: "", text: "（班伯把兩把小麥和藍布老麥並排攤開，湊近聞了很久。）" },
        { by: "elder", text: "就是這個味道。葛瑞他爹以前每年秋天，都扛這種麥來換我的鋤頭。" },
        { by: "", text: "（葛瑞不知道什麼時候站到了田埂另一頭，沒有走過來。）" },
        { by: "mayor", text: "……那包是我放在你祖母門口的。那年我爹走了，我說我再也不種田。" },
        { by: "mayor", text: "我以為她早就拿去餵雞了。原來她每年偷偷種一小格，替我留著。" },
        { by: "elder", text: "她是在等你哪天肯回來看一眼。" },
        { by: "", text: "（葛瑞蹲下來摸了摸剛翻過的土，很久都沒有說話。）" },
        { by: "mayor", text: "明天這一格我自己來翻。你……先別跟別人說我哭過。" },
      ],
      summary: "藍布舊麥種是葛瑞他爹留下的。我照班伯說的種回田裡，葛瑞說明天要自己來翻土。",
      after: { by: "elder", text: "葛瑞今天一早就來翻土了。翻得歪七扭八，我一句都沒敢笑。" },
    },
    seal: {
      label: "交給葛瑞，先封存起來", side: "mayor", anchor: "station:sign", spot: "告示牌旁", object: "鎮公所封存箱",
      reply: { by: "mayor", text: "……謝謝。我不是要搶。只是有些東西封起來，比較不會痛。" },
      labels: { order: "鎮公所封存箱・等登記", scene: "鎮公所封存箱・葛瑞有話要說", done: "鎮公所封存箱・三粒留給你" },
      order: { name: "葛瑞的鎮誌登記單", want: { wheat: 2 }, rate: 1.5, extra: {}, extraText: "",
        line: { by: "mayor", text: "登記要附同一塊田收的麥。我想讓它看起來……像還有人在種。" } },
      scene: [
        { by: "", text: "（葛瑞翻開鎮誌，在「原主」那一欄停了筆。）" },
        { by: "mayor", text: "照規矩，原主那欄要寫名字。" },
        { by: "mayor", text: "……寫我爹。那年他走了，我把這包麥放在你祖母門口，說我再也不種田。" },
        { by: "", text: "（班伯站在門邊，哼了一聲，卻沒有走。）" },
        { by: "elder", text: "封起來，你這輩子就不用看它發芽了。" },
        { by: "mayor", text: "我知道。所以我才想封。" },
        { by: "", text: "（葛瑞從藍布包裡數出三粒麥，放進你手心，手指有點抖。）" },
        { by: "mayor", text: "其餘的我收著。這三粒你替我種。等它結穗，我自己去看。" },
      ],
      summary: "藍布舊麥種是葛瑞他爹留下的。我讓葛瑞封存起來，他留了三粒要我替他種。",
      after: { by: "mayor", text: "封存箱我天天都擦。……那三粒要是發芽了，記得先叫我。" },
    },
  };
  const R81_PENDING = { anchor: "npc:mayor", label: "藍布舊麥種・等你決定" };
  /* 地圖物件圖：檔名先接好，圖到了把那一項加進 R81_ART_READY；沒到之前用現成的小圖（種子包、種植、印章）當後備，三個樣子彼此不同。 */
  const R81_ART = { pending: "assets/generated/content-r81/story-pouch.png", plant: "assets/generated/content-r81/story-oldwheat-field.png", seal: "assets/generated/content-r81/story-seal-box.png" };
  const R81_ART_READY = ["pending", "plant", "seal"];
  const R81_ART_FALLBACK = { pending: "assets/generated/r83/seed-32.png", plant: "assets/generated/r66/native/tool_plant-32.png", seal: "assets/generated/r83/stamp-32.png" };
  function r81Art(key) { return R81_ART_READY.includes(key) && R81_ART[key] ? R81_ART[key] : R81_ART_FALLBACK[key]; }

  /* ---------- R82B：藍布舊麥種兩條路線的專屬玩法 ----------
     R81 的具名訂單與揭謎場景照舊保留；看完收尾後，種植線接「跨兩個遊戲日照光」的傳家作物，
     封存線接「分三個遊戲日找鎮誌舊物」的地圖支線。新圖先接正式路徑，缺圖時才走明列的既有後備。 */
  const R82_BLUE_LIGHT_PLOT = 0;
  const R82_BLUE_CROP = { id: "blue_cloth_wheat", name: "藍布老麥", icon: "cropIcon" };
  /* R83B：種回田裡是老農班伯這一邊，專屬訂單以老農班伯具名；名稱跟 R81 的「班伯的老麥回禮單」分開，手札裡不會混成同一張。 */
  const R82_BLUE_ORDER = { name: "班伯的第一穗留種單", side: "elder", need: 1, coins: 60 };
  const R82_ART = {
    cropIcon: "assets/generated/content-r82/blue-cloth-wheat-icon.png",
    cropSprout: "assets/generated/content-r82/blue-cloth-wheat-sprout.png",
    cropOneLight: "assets/generated/content-r82/blue-cloth-wheat-one-light.png",
    cropRipe: "assets/generated/content-r82/blue-cloth-wheat-ripe.png",
    cropHarvested: "assets/generated/content-r82/blue-cloth-wheat-harvested.png",
    oldSeedTag: "assets/generated/content-r82/old-seed-tag.png",
    fadedPhoto: "assets/generated/content-r82/faded-photo.png",
    ledgerPage: "assets/generated/content-r82/ledger-page.png",
    townJournalDecoration: "assets/generated/content-r82/town-journal-decoration.png",
  };
  const R82_ART_READY = ["cropIcon", "cropSprout", "cropOneLight", "cropRipe", "cropHarvested", "oldSeedTag", "fadedPhoto", "ledgerPage", "townJournalDecoration"];
  const R82_ART_FALLBACK = {
    cropIcon: "assets/generated/r66/native/crop_wheat-32.png",
    cropSprout: "assets/generated/r66/native/tool_plant-32.png",
    cropOneLight: "assets/generated/r83/sun-32.png",
    cropRipe: "assets/generated/r66/native/crop_wheat-32.png",
    cropHarvested: "assets/generated/r66/native/tool_harvest-32.png",
    oldSeedTag: "assets/generated/r83/seed-32.png",
    fadedPhoto: "assets/generated/content-r81/mayor-map.png",
    ledgerPage: "assets/generated/r83/note-32.png",
    townJournalDecoration: "assets/generated/r83/wheat-32.png",
  };
  function r82Art(key) { return R82_ART_READY.includes(key) && R82_ART[key] ? R82_ART[key] : R82_ART_FALLBACK[key]; }
  function r82ArtFallback(key) { return !R82_ART_READY.includes(key); }
  /* R83B：三樣舊物各放在一格空草地上（tile:x,y），避開市集攤、玩家起點、鄰居站位與其他名牌；number 是名牌上的「鎮誌 N／3」。
     舊種子籤在穀倉前、褪色照片在穀倉右邊的河岸草地、帳本一頁在水井右邊。 */
  const R82_RELICS = [
    { id: "old_seed_tag", name: "舊種子籤", number: 1, dayOffset: 0, anchor: "tile:12,8", artKey: "oldSeedTag", memory: [
      { by: "mayor", text: "這張籤是我爹留下的。小時候他老叫我幫忙寫，我總嫌田裡的名字怎麼也寫不完。" },
      { by: "", text: "（他用拇指輕輕擦過背面那道被雨暈開的鉛筆痕。）" },
      { by: "mayor", text: "現在再看到他的字，我反而希望這張籤再長一點，讓我多看一會兒。" },
    ] },
    { id: "faded_photo", name: "褪色照片", number: 2, dayOffset: 1, anchor: "tile:14,7", artKey: "fadedPhoto", memory: [
      { by: "mayor", text: "這是我第一次跟我爹去巡田。那頂草帽太大，我一路扶著，最後還是被風吹進田裡。" },
      { by: "", text: "（葛瑞看著照片裡笑得只剩一雙眼睛的人，指尖停在褪色的邊角。）" },
      { by: "mayor", text: "我那時嫌他笑得吵。現在想聽，卻怎麼也想不起那個聲音了。" },
    ] },
    { id: "ledger_page", name: "帳本一頁", number: 3, dayOffset: 2, anchor: "tile:4,10", artKey: "ledgerPage", memory: [
      { by: "mayor", text: "這頁帳是我爹寫的。他什麼都記，連我鬧脾氣不吃飯也不肯漏掉。" },
      { by: "", text: "（沾泥的頁角旁，最後一行只寫著「留給葛瑞」。）" },
      { by: "mayor", text: "我以前覺得他不懂我。也許，是我一直不敢把後面那句看完。" },
    ] },
  ];
  const R82_DECORATION = { id: "town_journal_keepsake", name: "壓穗鎮誌牌", anchor: "station:sign", artKey: "townJournalDecoration" };

  function cleanDay82(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : ""; }
  function dayDiff82(from, to) {
    const a = Date.parse(cleanDay82(from) + "T00:00:00Z"), b = Date.parse(cleanDay82(to) + "T00:00:00Z");
    return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / 86400000)) : 0;
  }
  function r82Ensure(state, now) {
    if (!isObj81(state)) return null;
    const r81 = r81Ensure(state), route = r81 && Object.prototype.hasOwnProperty.call(R81_OPTIONS, r81.choice) ? r81.choice : "";
    const hadBranch = isObj81(state.r82branches), raw = hadBranch ? state.r82branches : {};
    const rawPlant = isObj81(raw.plant) ? raw.plant : {}, rawSeal = isObj81(raw.seal) ? raw.seal : {};
    const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
    const lightDays = Array.isArray(rawPlant.lightDays) ? [...new Set(rawPlant.lightDays.map(cleanDay82).filter(Boolean))].slice(0, 2) : [];
    const found = {};
    for (const relic of R82_RELICS) { const at = num(rawSeal.found && rawSeal.found[relic.id]); if (at) found[relic.id] = at; }
    /* R81 舊存檔第一次接上 R82 時，以這次讀到的遊戲日為支線第一天，避免三件舊物一次補發。 */
    const fallbackAt = hadBranch ? ((r81 && (r81.choiceAt || r81.sceneAt)) || state.lastSeenAt || state.createdAt || Date.now()) : (Number.isFinite(now) ? now : Date.now());
    const startDay = route === "seal" ? (cleanDay82(rawSeal.startDay) || dayKeyOf(fallbackAt)) : "";
    const allFoundAt = R82_RELICS.every((relic) => found[relic.id]) ? Math.max(...Object.values(found)) : 0;
    state.r82branches = {
      route,
      plant: {
        plantedAt: num(rawPlant.plantedAt),
        lightDays,
        harvestedAt: num(rawPlant.harvestedAt),
        stock: Math.max(0, Math.min(1, Math.floor(Number.isFinite(rawPlant.stock) ? rawPlant.stock : 0))),
        orderAt: num(rawPlant.orderAt),
      },
      seal: { startDay, found, decoratedAt: num(rawSeal.decoratedAt) || allFoundAt },
    };
    if (!state.r82branches.plant.plantedAt) Object.assign(state.r82branches.plant, { lightDays: [], harvestedAt: 0, stock: 0, orderAt: 0 });
    if (!state.r82branches.plant.harvestedAt) Object.assign(state.r82branches.plant, { stock: 0, orderAt: 0 });
    if (state.r82branches.plant.orderAt) state.r82branches.plant.stock = 0;
    return state.r82branches;
  }
  function r82PlantStatus(state, now) {
    const b = r82Ensure(state, now), p = b && b.plant, t = Number.isFinite(now) ? now : Date.now();
    if (!b || b.route !== "plant") return { eligible: false, stage: "locked", lightDays: 0, lightNow: false, todayCaught: false };
    if (r81Stage(state) !== "done") return { eligible: true, stage: "story", lightDays: p.lightDays.length, lightNow: false, todayCaught: false };
    const today = dayKeyOf(t), lightNow = !!(G && typeof G.isSunlit === "function" && G.isSunlit(state, R82_BLUE_LIGHT_PLOT, t));
    const stage = p.orderAt ? "done" : p.harvestedAt ? "order" : !p.plantedAt ? "empty" : p.lightDays.length >= 2 ? "ripe" : "growing";
    return { eligible: true, stage, lightDays: p.lightDays.length, lightNow, todayCaught: p.lightDays.includes(today), today, plantedAt: p.plantedAt, harvestedAt: p.harvestedAt, orderAt: p.orderAt };
  }
  /* R83B：名牌、正式圖與成熟特效共用同一份 r82PlantStatus；這裡只把已判定的階段翻成畫面資料，不另算進度。
     還沒播種時畫的是那一包種子（R81 的種子包正式圖），不再借用長滿麥穗的田圖，免得跟「可以收成」看起來一樣。 */
  const R83_PLANT_STAGES = {
    empty: { stageKey: "empty", key: "", label: "藍布老麥田・等你播種" },
    planted: { stageKey: "planted", key: "cropSprout", label: "藍布老麥田・剛種下" },
    oneLight: { stageKey: "one-light", key: "cropOneLight", label: "藍布老麥田・照過 1 次光" },
    ripe: { stageKey: "ripe", key: "cropRipe", label: "藍布老麥田・可以收成" },
    harvested: { stageKey: "harvested", key: "cropHarvested", label: "藍布老麥田・已收成" },
  };
  function r82PlantPresentation(state, now) {
    const status = r82PlantStatus(state, now);
    if (!status.eligible || status.stage === "story") return { status, stageKey: status.stage, key: "", art: r81Art("plant"), fallback: false, label: R81_OPTIONS.plant.labels.done };
    const row = status.stage === "empty" ? R83_PLANT_STAGES.empty
      : status.stage === "growing" ? (status.lightDays < 1 ? R83_PLANT_STAGES.planted : R83_PLANT_STAGES.oneLight)
        : status.stage === "ripe" ? R83_PLANT_STAGES.ripe : R83_PLANT_STAGES.harvested;
    const art = row.key ? r82Art(row.key) : r81Art("pending");
    return { status, stageKey: row.stageKey, key: row.key, art, fallback: row.key ? r82ArtFallback(row.key) : false, label: row.label };
  }
  function r82PlantArt(state, now) {
    const view = r82PlantPresentation(state, now);
    return { key: view.key, art: view.art, fallback: view.fallback };
  }
  function r82Plant(state, now) {
    const status = r82PlantStatus(state, now), b = r82Ensure(state, now), t = Number.isFinite(now) ? now : Date.now();
    if (!b || b.route !== "plant") return { ok: false, reason: "wrong_route", message: "這包舊麥種沒有留在田裡。" };
    if (status.stage === "story") return { ok: false, reason: "story", message: "先把藍布舊麥種的故事聽完。" };
    if (status.stage !== "empty") return { ok: false, reason: "already_planted", message: "藍布老麥已經種在這一格了。" };
    b.plant.plantedAt = t; b.plant.lightDays = [];
    return { ok: true, cropId: R82_BLUE_CROP.id, message: "藍布老麥種下了。這一格要在不同的遊戲日接到光，麥穗才會成熟。" };
  }
  function r82CatchLight(state, now) {
    const status = r82PlantStatus(state, now), b = r82Ensure(state, now), t = Number.isFinite(now) ? now : Date.now();
    if (!b || b.route !== "plant" || !b.plant.plantedAt) return { ok: false, reason: "not_planted", message: "先把藍布老麥種進專用田。" };
    if (status.stage === "ripe" || status.stage === "order" || status.stage === "done") return { ok: false, reason: "already_ready", message: "藍布老麥已經成熟，不必再等光了。" };
    if (status.todayCaught) return { ok: false, reason: "same_day", message: "今天這一格已經照過光，要等另一個遊戲日。" };
    if (!status.lightNow) return { ok: false, reason: "no_light", message: "光還沒照到藍布老麥田，等光斑落在這一格再試。" };
    b.plant.lightDays.push(dayKeyOf(t)); b.plant.lightDays = [...new Set(b.plant.lightDays)].slice(0, 2);
    const ripe = b.plant.lightDays.length >= 2;
    return { ok: true, ripe, lightDays: b.plant.lightDays.length, message: ripe ? "第二個遊戲日的光也照到了，藍布老麥成熟了。" : "藍布老麥接到第一天的光，還要等另一個遊戲日。" };
  }
  function r82HarvestBlueWheat(state, now) {
    const status = r82PlantStatus(state, now), b = r82Ensure(state, now), t = Number.isFinite(now) ? now : Date.now();
    if (!b || b.route !== "plant") return { ok: false, reason: "wrong_route", message: "這裡沒有藍布老麥。" };
    if (status.stage !== "ripe") return { ok: false, reason: status.stage === "order" || status.stage === "done" ? "already_harvested" : "not_ready", message: status.stage === "order" || status.stage === "done" ? "藍布老麥已經收成了。" : "藍布老麥還沒成熟。" };
    b.plant.harvestedAt = t; b.plant.stock = 1;
    return {
      ok: true, cropId: R82_BLUE_CROP.id, added: 1, order: R82_BLUE_ORDER.name,
      speakerLine: { by: "elder", text: "好，這一穗總算回家了。別急著收進倉裡，先讓我再聞一下。" },
      message: "收成藍布老麥 1 份，專屬訂單「" + R82_BLUE_ORDER.name + "」已經開放。",
    };
  }
  function r82BlueOrder(state) {
    const b = r82Ensure(state), have = b && b.plant ? b.plant.stock : 0;
    if (!b || b.route !== "plant" || !b.plant.harvestedAt) return null;
    return { name: R82_BLUE_ORDER.name, itemId: R82_BLUE_CROP.id, itemName: R82_BLUE_CROP.name, need: R82_BLUE_ORDER.need, have, enough: have >= R82_BLUE_ORDER.need, coins: R82_BLUE_ORDER.coins, done: !!b.plant.orderAt };
  }
  function r82DeliverBlueOrder(state, now) {
    const info = r82BlueOrder(state), b = r82Ensure(state, now), t = Number.isFinite(now) ? now : Date.now();
    if (!info) return { ok: false, reason: "locked", message: "先收成藍布老麥。" };
    if (info.done) return { ok: false, reason: "done", message: "這張專屬訂單已經交過了。" };
    if (!info.enough) return { ok: false, reason: "missing", message: "「" + info.name + "」要藍布老麥 1 份。" };
    state.coins = Math.max(0, Number.isFinite(state.coins) ? state.coins : 0) + info.coins;
    if (!isObj81(state.stats)) state.stats = {};
    state.stats.totalCoinsEarned = Math.max(0, Number.isFinite(state.stats.totalCoinsEarned) ? state.stats.totalCoinsEarned : 0) + info.coins;
    b.plant.stock = 0; b.plant.orderAt = t;
    return { ok: true, name: info.name, coins: info.coins,
      speakerLine: { by: "elder", text: "這一穗我留著當種。明年井邊這一格，會長得比今年更密。" },
      message: "完成專屬訂單「" + info.name + "」，拿到 " + info.coins + " 金。" };
  }
  function r82AvailableRelics(state, now) {
    const b = r82Ensure(state, now), t = Number.isFinite(now) ? now : Date.now();
    if (!b || b.route !== "seal" || r81Stage(state) !== "done") return [];
    const elapsed = dayDiff82(b.seal.startDay, dayKeyOf(t));
    return R82_RELICS.filter((relic) => relic.dayOffset <= elapsed).map((relic) => Object.assign({}, relic, { found: !!b.seal.found[relic.id], foundAt: b.seal.found[relic.id] || 0, art: r82Art(relic.artKey), artFallback: r82ArtFallback(relic.artKey) }));
  }
  function r82SealStatus(state, now) {
    const b = r82Ensure(state, now), available = r82AvailableRelics(state, now), foundCount = b && b.route === "seal" ? R82_RELICS.filter((relic) => b.seal.found[relic.id]).length : 0;
    const next = available.find((relic) => !relic.found) || null;
    return { eligible: !!(b && b.route === "seal"), startDay: b && b.seal.startDay || "", foundCount, available, decorated: !!(b && b.seal.decoratedAt), next, nextNumber: next ? next.number : 0 };
  }
  function r82FindRelic(state, relicId, now) {
    let b = r82Ensure(state, now); const t = Number.isFinite(now) ? now : Date.now(), relic = R82_RELICS.find((row) => row.id === relicId);
    if (!b || b.route !== "seal") return { ok: false, reason: "wrong_route", message: "這條鎮誌支線沒有開放。" };
    if (r81Stage(state) !== "done") return { ok: false, reason: "story", message: "先把藍布舊麥種的故事聽完。" };
    if (!relic) return { ok: false, reason: "bad_relic", message: "這件舊物不在鎮誌清單裡。" };
    if (b.seal.found[relic.id]) return { ok: false, reason: "found", message: relic.name + "已經收進鎮誌了。" };
    const open = r82AvailableRelics(state, t).some((row) => row.id === relic.id);
    if (!open) return { ok: false, reason: "not_today", message: "今天還找不到這件舊物，換個遊戲日再來看看。" };
    b = r82Ensure(state, t);
    b.seal.found[relic.id] = t;
    const complete = R82_RELICS.every((row) => b.seal.found[row.id]);
    if (complete && !b.seal.decoratedAt) b.seal.decoratedAt = t;
    return { ok: true, relic: relic.id, name: relic.name, memory: relic.memory.slice(), complete, decoration: complete ? R82_DECORATION.name : "", message: complete ? "三樣鎮誌舊物都找齊了，封存箱旁多了「" + R82_DECORATION.name + "」。" : "找到「" + relic.name + "」，葛瑞想起了一段往事。" };
  }
  /* R83B：名牌只寫「鎮誌 N／3」（N 是固定編號，同時出現兩件也不會撞號），舊物名字放在點下去的提示與手札。 */
  function r83RelicLabel(relic) { return "鎮誌 " + relic.number + "／" + R82_RELICS.length; }
  /* R83B：玩家可能在那一格蓋了東西；那一格被占用時，改放到最近的一格空草地（不踩路、不壓建築與站點），三件不放同一格。 */
  function r83FreeTile(t) { return !!t && t.terrain === "grass" && !t.object && !t.buildingId && !t.adventureSite && !t.station && !t.npc && !t.structureId && !t.blocked && !t.event && !t.forage; }
  function r83RelicAnchor(state, relic, taken) {
    const m = /^tile:(\d+),(\d+)$/.exec(relic.anchor || ""), tiles = isObj81(state) && isObj81(state.map) && Array.isArray(state.map.tiles) ? state.map.tiles : [];
    if (!m || !tiles.length) return relic.anchor;
    const x0 = Number(m[1]), y0 = Number(m[2]), at = (x, y) => tiles.find((t) => t.x === x && t.y === y);
    for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const t = at(x0 + dx, y0 + dy), key = t ? "tile:" + t.x + "," + t.y : "";
      if (t && r83FreeTile(t) && !taken.includes(key)) { taken.push(key); return key; }
    }
    return relic.anchor;
  }
  function r82SceneRows(state, now) {
    const status = r82SealStatus(state, now);
    if (!status.eligible || r81Stage(state) !== "done") return [];
    const taken = [];
    const rows = status.available.filter((relic) => !relic.found).map((relic) => ({
      npcId: "r82b_relic_" + relic.id, choiceId: relic.id, r82b: true, r82bKind: "relic", relicId: relic.id,
      done: false, decided: true, decision: "seal", label: r83RelicLabel(relic), hint: r83RelicLabel(relic) + "・" + relic.name,
      marker: { anchor: r83RelicAnchor(state, relic, taken), art: relic.art, displaySize: 64 }, artFallback: relic.artFallback,
    }));
    if (status.decorated) rows.push({
      npcId: "r82b_decoration", choiceId: R82_DECORATION.id, r82b: true, r82bKind: "decoration", done: true, decided: true, decision: "seal",
      label: R82_DECORATION.name + "・鎮誌留存", marker: { anchor: R82_DECORATION.anchor, art: r82Art(R82_DECORATION.artKey) }, artFallback: r82ArtFallback(R82_DECORATION.artKey),
    });
    return rows;
  }
  function r82Today(state, now) {
    const b = r82Ensure(state, now);
    if (!b || !b.route || r81Stage(state) !== "done") return null;
    if (b.route === "plant") {
      const status = r82PlantStatus(state, now), order = r82BlueOrder(state);
      if (status.stage === "done") return null;
      if (status.stage === "empty") return { key: "r82b-plant", title: "傳家作物「藍布老麥」", line: "到藍布老麥田那一格種下傳家作物。" };
      if (status.stage === "growing") return { key: "r82b-plant", title: "傳家作物「藍布老麥」", line: "不同遊戲日照光 " + status.lightDays + "/2；光照到專用田時去接光。" };
      if (status.stage === "ripe") return { key: "r82b-plant", title: "藍布老麥成熟了", line: "回藍布老麥田收成，接上專屬訂單。" };
      return { key: "r82b-plant", title: "專屬訂單「" + R82_BLUE_ORDER.name + "」", line: "藍布老麥 " + Math.min(order.have, order.need) + "/" + order.need + "，交單拿 " + order.coins + " 金。" };
    }
    const status = r82SealStatus(state, now);
    if (status.decorated) return null;
    if (status.next) return { key: "r82b-seal", title: "鎮誌支線", line: "地圖上的「" + r83RelicLabel(status.next) + "」是" + status.next.name + "；走近看看葛瑞想起什麼。" };
    return { key: "r82b-seal", title: "鎮誌支線", line: "鎮誌舊物 " + status.foundCount + "/3；另一件會在不同的遊戲日出現。" };
  }
  const isObj81 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  function r81Ensure(state) {
    if (!isObj81(state)) return null;
    if (!isObj81(state.r81story)) state.r81story = {};
    const b = state.r81story, num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
    b.choice = typeof b.choice === "string" && Object.prototype.hasOwnProperty.call(R81_OPTIONS, b.choice) ? b.choice : "";
    for (const key of ["choiceAt", "shownAt", "orderAt", "sceneAt"]) b[key] = num(b[key]);
    for (const key of Object.keys(b)) if (!["choice", "choiceAt", "shownAt", "orderAt", "sceneAt"].includes(key)) delete b[key];
    if (!b.choice) { b.choiceAt = 0; b.orderAt = 0; b.sceneAt = 0; }
    if (!b.orderAt) b.sceneAt = 0;
    return b;
  }
  function basketDelivered(state) { return !!(isObj81(state) && isObj81(state.heirloom) && state.heirloom.delivered === true); }
  /* 進度：""＝餐籃還沒送到；conflict＝兩人在等你決定；order＝具名訂單還沒交；scene＝收尾還沒看；done＝收尾了。 */
  function r81Stage(state) {
    if (!basketDelivered(state)) return "";
    const b = r81Ensure(state);
    if (!b) return "";
    if (!b.choice) return "conflict";
    if (!b.orderAt) return "order";
    return b.sceneAt ? "done" : "scene";
  }
  function r81Choose(state, choice, now) {
    const b = r81Ensure(state), stage = r81Stage(state);
    if (!b) return { ok: false, reason: "bad_state", message: "存檔還沒準備好。" };
    if (!stage) return { ok: false, reason: "locked", message: "先把祖母的餐籃送到葛瑞手上。" };
    if (stage !== "conflict") return { ok: false, reason: "decided", message: "這包舊麥種已經決定好了。" };
    if (!Object.prototype.hasOwnProperty.call(R81_OPTIONS, choice)) return { ok: false, reason: "bad_choice", message: "先選一邊。" };
    b.choice = choice; b.choiceAt = Number.isFinite(now) ? now : Date.now();
    const opt = R81_OPTIONS[choice];
    return { ok: true, choice, reply: opt.reply, object: opt.object, spot: opt.spot, order: opt.order.name, message: opt.spot + "多了「" + opt.object + "」；解鎖具名訂單「" + opt.order.name + "」。" };
  }
  function itemsOf(state) { return isObj81(state.storage) && isObj81(state.storage.items) ? state.storage.items : {}; }
  function cropNameOf(id) { const c = C && C.CROPS && C.CROPS[id]; return c ? c.name : String(id); }
  /* 同樣的東西交一般訂單最多拿幾金：市集新手單每份＝售價 × 7，其他訂單每份＝售價 × 稀有度倍率（四捨五入，至少 1），取最高的那一種。 */
  function r81GeneralMax(itemId, qty) {
    const crop = C && C.CROPS && C.CROPS[itemId], sell = crop ? crop.sellValue || 0 : 0;
    const rarities = Object.values((C && C.ORDER_RARITY) || {});
    const unit = Math.max(sell * 7, ...rarities.map((r) => Math.max(1, Math.round(sell * (r.payMult || 1)))), 1);
    return unit * qty;
  }
  function r81Order(state, now) {
    const b = r81Ensure(state), opt = b && R81_OPTIONS[b.choice];
    if (!opt) return null;
    const o = opt.order, id = Object.keys(o.want)[0], need = o.want[id], have = Math.max(0, Math.floor(itemsOf(state)[id] || 0));
    const general = r81GeneralMax(id, need), coins = Math.ceil(general * o.rate);
    return { name: o.name, side: opt.side, itemId: id, need, have, enough: have >= need, done: !!b.orderAt, general, coins, extraText: o.extraText,
      wantText: "交 " + need + " 份" + cropNameOf(id), rewardText: coins + " 金" + (o.extraText ? "和" + o.extraText : ""),
      vsText: "同樣 " + need + " 份" + cropNameOf(id) + "的一般訂單最多 " + general + " 金", line: o.line };
  }
  /* 還沒選之前，選項上先寫出那一張要交什麼、拿多少（跟選了以後的訂單同一套算法）。 */
  function r81OrderPreview(choice) {
    const opt = R81_OPTIONS[choice];
    if (!opt || !Object.prototype.hasOwnProperty.call(R81_OPTIONS, choice)) return "";
    const id = Object.keys(opt.order.want)[0], need = opt.order.want[id], coins = Math.ceil(r81GeneralMax(id, need) * opt.order.rate);
    return "交 " + need + " 份" + cropNameOf(id) + "，拿 " + coins + " 金" + (opt.order.extraText ? "和" + opt.order.extraText : "");
  }
  function r81Deliver(state, now) {
    const stage = r81Stage(state), info = r81Order(state, now);
    if (stage !== "order" || !info) return { ok: false, reason: stage === "conflict" || !stage ? "locked" : "done", message: stage ? "這張訂單已經交過了。" : "先把祖母的餐籃送到葛瑞手上。" };
    if (!info.enough) return { ok: false, reason: "missing", message: "「" + info.name + "」要" + info.wantText + "，倉庫還差 " + (info.need - info.have) + " 份。" };
    const items = itemsOf(state), b = r81Ensure(state), opt = R81_OPTIONS[b.choice];
    items[info.itemId] -= info.need; if (items[info.itemId] <= 0) delete items[info.itemId];
    state.coins = Math.max(0, Number.isFinite(state.coins) ? state.coins : 0) + info.coins;
    if (!isObj81(state.stats)) state.stats = {};
    state.stats.totalCoinsEarned = Math.max(0, Number.isFinite(state.stats.totalCoinsEarned) ? state.stats.totalCoinsEarned : 0) + info.coins;
    const packs = isObj81(state.adventure) && isObj81(state.adventure.r58) && isObj81(state.adventure.r58.r59) && isObj81(state.adventure.r58.r59.seedPacks) ? state.adventure.r58.r59.seedPacks : null;
    const extraPacks = opt.order.extra.seedPacks || {};
    for (const id of Object.keys(extraPacks)) if (packs) packs[id] = Math.min(99, Math.max(0, packs[id] || 0) + extraPacks[id]);
    b.orderAt = Number.isFinite(now) ? now : Date.now();
    return { ok: true, name: info.name, coins: info.coins, rewardText: info.rewardText, scene: opt.scene.slice(), message: "完成具名訂單「" + info.name + "」，拿到 " + info.rewardText + "。" };
  }
  function r81Scene(state) { const b = r81Ensure(state), opt = b && R81_OPTIONS[b.choice]; return opt ? opt.scene.slice() : []; }
  function r81SceneSeen(state, now) {
    const b = r81Ensure(state);
    if (!b || !b.orderAt) return false;
    if (!b.sceneAt) b.sceneAt = Number.isFinite(now) ? now : Date.now();
    return true;
  }
  function r81Summary(state) { const b = r81Ensure(state), opt = b && R81_OPTIONS[b.choice]; return opt && b.sceneAt ? opt.summary : ""; }
  /* 地圖物件（交給 choices-r77 的 sceneStates 一起畫）：還沒決定時藍布包在鎮長葛瑞腳邊；決定後換到那一邊的地點與名牌。 */
  function r81SceneRows(state) {
    const stage = r81Stage(state);
    if (!stage) return [];
    if (stage === "conflict") return [{ npcId: "r81c_story", choiceId: "pending", r81c: true, done: false, decided: false, decision: "", label: R81_PENDING.label, marker: { anchor: R81_PENDING.anchor, art: r81Art("pending") } }];
    const b = r81Ensure(state), opt = R81_OPTIONS[b.choice];
    const plantView = b.choice === "plant" && stage === "done" ? r82PlantPresentation(state) : null;
    return [{ npcId: "r81c_story", choiceId: b.choice, r81c: true, r82b: !!plantView, r82bKind: plantView ? "plant" : "", r82bStage: plantView ? plantView.stageKey : "", artFallback: !!(plantView && plantView.fallback), done: stage === "done", decided: true, decision: b.choice, label: plantView ? plantView.label : (opt.labels[stage] || opt.labels.order), marker: { anchor: opt.anchor, art: plantView ? plantView.art : r81Art(b.choice), displaySize: plantView ? 64 : 0 } }];
  }
  /* 手札「今天可做」用的那一項（收尾了就不再佔位）。 */
  function r81Today(state, now) {
    const stage = r81Stage(state);
    if (!stage || stage === "done") return null;
    if (stage === "conflict") return { key: "r81c", stage, title: R81_TITLE, line: "葛瑞想封起來，班伯要種回田裡，兩個人在等你決定。" };
    const b = r81Ensure(state), opt = R81_OPTIONS[b.choice];
    if (stage === "scene") return { key: "r81c", stage, title: R81_TITLE, line: (opt.side === "elder" ? "班伯" : "葛瑞") + "收下了麥，好像還有話要說。" };
    const info = r81Order(state, now);
    return { key: "r81c", stage, title: "具名訂單「" + info.name + "」", line: info.wantText + "（倉庫 " + Math.min(info.have, info.need) + "/" + info.need + "），拿 " + info.rewardText + "。" + info.vsText + "。" };
  }

  const StoryR76 = { PORTRAITS, CHOICES, FOLLOWUPS, FESTIVAL_ROWS, portraitFor, choiceDef, questionOf, ensure, selectedChoiceId, followupDef, followupDue, noteOrder, noteTalk, markFollowupSeen, followupSummary, festivalBreakdown, festivalTip, isDuplicateQuestRow,
    SPEAKER_NAMES, R81_MYSTERY, R81_TITLE, R81_CONFLICT, R81_OPTIONS, R81_PENDING, R81_ART, R81_ART_READY, R81_ART_FALLBACK, r81Art, r81Ensure, r81Stage, r81Choose, r81Order, r81Deliver, r81Scene, r81SceneSeen, r81Summary, r81SceneRows, r81Today, r81GeneralMax, r81OrderPreview,
    R82_BLUE_LIGHT_PLOT, R82_BLUE_CROP, R82_BLUE_ORDER, R82_ART, R82_ART_READY, R82_ART_FALLBACK, R82_RELICS, R82_DECORATION, r82Art, r82Ensure, r82PlantStatus, r82PlantPresentation, r82PlantArt, r82Plant, r82CatchLight, r82HarvestBlueWheat, r82BlueOrder, r82DeliverBlueOrder, r82AvailableRelics, r82SealStatus, r82FindRelic, r82SceneRows, r82Today };
  root.StoryR76 = StoryR76;
  if (isNode) module.exports = StoryR76;
  if (typeof document === "undefined") return;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const versionQuery = () => root.FARM_VERSION_QUERY || "";
  function farm() { return root.__farm; }
  function saveNow() { const f = farm(); if (f && f.safeSaveNow) f.safeSaveNow(); if (f && f.refresh) f.refresh(); }

  /* R80C 第 5 項：寫成「（……）」的是旁白（第三人稱的動作描寫），不再掛說話者的頭像與名字，改用旁白樣式；其餘照舊是那位鄰居自己說的話。 */
  /* R81C 第 1 項：一段對話可以有兩位鄰居輪流說——句子可以寫成 { by: "elder", text: "……" }，by 是說話的鄰居；
     by 留空或整句包在全形括號裡就是旁白。純字串的句子照舊算這個對話框的主說話者。 */
  function lineText(line) { return line && typeof line === "object" ? String(line.text || "") : String(line == null ? "" : line); }
  function lineBy(line) { return line && typeof line === "object" && typeof line.by === "string" ? line.by : null; }
  function isNarration(line) { return /^（[\s\S]*）$/.test(lineText(line).trim()) || lineBy(line) === ""; }
  function narrationText(line) { return lineText(line).trim().replace(/^（/, "").replace(/）$/, ""); }
  function openDialogue(state, npcId, lines, options) {
    document.querySelectorAll(".r76b-dialogue").forEach((n) => n.remove());
    /* R82A：新版逐句對話接手時，直接移除舊 NPC 泡泡；舊泡泡裡的兩張選項卡正是圖 114／120 的空白卡片來源。 */
    document.querySelectorAll(".npc-bubble").forEach((n) => n.remove());
    const def = CHOICES[npcId];
    const speaker = options && options.speaker || (def ? def.speaker : npcId);
    const overlay = document.createElement("div");
    overlay.className = "r76b-dialogue";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", speaker + "的對話");
    overlay.dataset.r76bDialogue = npcId;
    /* R80C 第 5 項：好感故事也用這一種下方對話框；呼叫端可以帶自己的標記（例如 data-r61b-story）與故事名稱。 */
    if (options && options.dataset) Object.keys(options.dataset).forEach((key) => { overlay.dataset[key] = options.dataset[key]; });
    document.body.appendChild(overlay);
    let step = 0;
    let mode = options && options.startMode === "choices" ? "choices" : "lines"; /* R79C：地圖物件旁的選擇可以直接從選項開始 */
    function headFor(line) {
      if (isNarration(line)) return '<div class="r76b-dialogue-head r80c-narration-head"><b>旁白</b></div>';
      const by = lineBy(line), who = by ? (SPEAKER_NAMES[by] || by) : speaker;
      const portrait = by ? portraitFor(by) : (portraitFor(npcId) || portraitFor(speaker));
      const title = options && options.title ? '<small class="r80c-dialogue-title">' + esc(options.title) + "</small>" : "";
      return '<div class="r76b-dialogue-head' + (options && options.headClass ? " " + esc(options.headClass) : "") + '"' + (by ? ' data-r81c-speaker="' + esc(by) + '"' : "") + ">" + (portrait ? '<img class="r76b-portrait" src="' + esc(portrait) + esc(versionQuery()) + '" alt="' + esc(who) + '" width="64" height="64">' : "") + "<b>" + esc(who) + "</b>" + title + "</div>";
    }
    function lineHtml(line, attr) {
      const narr = isNarration(line);
      return '<p class="r76b-dialogue-line' + (narr ? " r80c-narration" : "") + '"' + (attr || "") + ">" + esc(narr ? narrationText(line) : lineText(line)) + "</p>";
    }
    function render() {
      const current = mode === "lines" ? lines[step] : mode === "choices" ? lines[lines.length - 1] : linesReply;
      const head = headFor(current);
      const cardClass = "r76b-dialogue-card" + (isNarration(current) ? " is-narration" : "");
      if (mode === "lines") {
        overlay.innerHTML = '<div class="' + cardClass + '">' + head + lineHtml(lines[step], " data-r76b-line") + '<p class="r76b-dialogue-step">第 ' + (step + 1) + " 句，共 " + lines.length + ' 句</p><div class="r76b-dialogue-actions"><button type="button" data-r76b-next>' + (step >= lines.length - 1 ? "聽完了" : "下一句") + '</button><button type="button" data-r76b-later>晚點再說</button></div></div>';
        overlay.querySelector("[data-r76b-next]").onclick = () => {
          if (step < lines.length - 1) { step++; render(); return; }
          if (options && options.onLinesDone) { const nextMode = options.onLinesDone(); if (nextMode === "choices") { mode = "choices"; render(); return; } }
          close();
        };
      } else if (mode === "choices") {
        const choiceOptions = (options && options.choiceOptions) || [];
        overlay.innerHTML = '<div class="' + cardClass + '">' + head + lineHtml(lines[lines.length - 1]) + '<div class="r76b-choice-list">' + choiceOptions.map((o) => '<button type="button" class="r76b-choice" data-r76b-choice="' + esc(o.id) + '"><b>' + esc(o.label) + '</b><small>' + esc(o.immediate) + '</small><small>' + esc(o.longTerm) + "</small></button>").join("") + '</div><div class="r76b-dialogue-actions"><button type="button" data-r76b-later>晚點再說</button></div></div>';
        overlay.querySelectorAll("[data-r76b-choice]").forEach((btn) => { btn.onclick = () => { if (options && options.onChoice) options.onChoice(btn.dataset.r76bChoice, (reply) => { mode = "reply"; linesReply = reply; render(); }); }; });
      } else {
        overlay.innerHTML = '<div class="' + cardClass + '">' + head + lineHtml(linesReply) + '<div class="r76b-dialogue-actions"><button type="button" data-r76b-next>知道了</button></div></div>';
        overlay.querySelector("[data-r76b-next]").onclick = () => close();
      }
      const later = overlay.querySelector("[data-r76b-later]");
      if (later) later.onclick = () => close();
      if (options && typeof options.onRender === "function") { try { options.onRender(overlay, { mode, step, last: step >= lines.length - 1 }); } catch (_) { /* 呼叫端補標記失敗不擋對話 */ } }
    }
    let linesReply = "";
    function close() { overlay.remove(); if (options && options.onClose) options.onClose(); }
    render();
    try { root.dispatchEvent(new Event("farm-dialogue-open")); } catch (_) { /* 通知不到就等任務卡的定時檢查 */ }
    return { close };
  }

  function openOpeningChoice(state, npcId, view, callbacks) {
    const def = CHOICES[npcId];
    if (!def || !view) return null;
    const lines = (view.lines && view.lines.length ? view.lines : def.lines).slice();
    return openDialogue(state, npcId, lines, {
      speaker: def.speaker,
      choiceOptions: def.options,
      onLinesDone: () => "choices",
      onChoice: (choiceId, showReply) => {
        const api = root.AdventureAPI;
        const result = api && api.resolveMainStoryChoice ? api.resolveMainStoryChoice(state, npcId, choiceId, Date.now()) : { ok: false, message: "現在還不能選。" };
        const opt = def.options.find((o) => o.id === choiceId);
        if (callbacks && callbacks.onResolve) callbacks.onResolve(result);
        if (!result.ok) { showReply(result.message || "現在還不能選。"); return; }
        saveNow();
        showReply(opt ? opt.reply : result.message);
      },
      onClose: () => { if (callbacks && callbacks.onClose) callbacks.onClose(); },
    });
  }
  function openFollowup(state, npcId, callbacks) {
    const def = followupDef(state, npcId);
    if (!def) return null;
    return openDialogue(state, npcId, def.lines.slice(), {
      speaker: (CHOICES[npcId] && CHOICES[npcId].speaker) || npcId,
      onLinesDone: () => { markFollowupSeen(state, npcId, Date.now()); saveNow(); if (callbacks && callbacks.onSeen) callbacks.onSeen(def); return null; },
    });
  }
  StoryR76.openDialogue = openDialogue;
  StoryR76.openOpeningChoice = openOpeningChoice;
  StoryR76.openFollowup = openFollowup;

  /* ---------- R81C 瀏覽器：藍布舊麥種的對話、地圖物件與手札「帶我去」 ----------
     餐籃剛送到（半小時內）且畫面上沒有別的對話框、彈窗時，自動演一次兩人爭執；之後點地圖上的藍布包或手札「帶我去」再打開。 */
  const R81_AUTO_MS = 30 * 60000;
  function liveState81(fallback) { const f = farm(); try { return (f && typeof f.state === "function" && f.state()) || fallback; } catch (_) { return fallback; } }
  function toast81(message) { const f = farm(); if (message && f && f.toast) f.toast(message); }
  function busy81() { return !!(document.querySelector(".r76b-dialogue") || document.querySelector(".modal.show") || document.querySelector("#startupLoading")); }
  function speakerOf81(side) { return SPEAKER_NAMES[side] || side; }
  function focusR82Choice(state, choice) {
    const f = farm(), opt = R81_OPTIONS[choice], tile = opt && anchorTile81(state, opt.anchor);
    /* ui.js 的 focusTile 會聚焦約 2.6 秒後自己回到玩家跟隨；它不加遮罩，也不接管點擊。 */
    return !!(f && tile && typeof f.focusTile === "function" && f.focusTile(tile.id));
  }
  function openR81Conflict(state) {
    if (r81Stage(state) !== "conflict") return null;
    const b = r81Ensure(state);
    if (!b.shownAt) b.shownAt = Date.now();
    let picked = null;
    const choiceOptions = [
      { id: "plant", label: R81_OPTIONS.plant.label, immediate: "地圖上：水井旁多一格「藍布老麥田」", longTerm: "之後可種傳家作物「藍布老麥」，收成後接專屬訂單" },
      { id: "seal", label: R81_OPTIONS.seal.label, immediate: "地圖上：告示牌旁多一個「鎮公所封存箱」", longTerm: "之後可分天找鎮誌舊物，找齊會留下永久擺飾" },
    ];
    return openDialogue(state, "mayor", R81_CONFLICT.slice(), { speaker: speakerOf81("mayor"), dataset: { r81cStory: "conflict" }, choiceOptions, onLinesDone: () => "choices",
      onChoice: (id, showReply) => { const r = r81Choose(state, id, Date.now()); if (!r.ok) { showReply(r.message); return; } picked = r; saveNow(); showReply(r.reply); },
      onClose: () => { saveNow(); if (picked) { focusR82Choice(liveState81(state), picked.choice); toast81(picked.message); } } });
  }
  function playR81Scene(state) {
    const b = r81Ensure(state), opt = b && R81_OPTIONS[b.choice];
    if (!opt || !b.orderAt) return null;
    return openDialogue(state, opt.side, r81Scene(state), { speaker: speakerOf81(opt.side), dataset: { r81cStory: "scene" },
      onLinesDone: () => { r81SceneSeen(state, Date.now()); saveNow(); toast81("手札記下了：" + r81Summary(state)); return null; } });
  }
  function addR82CropIcon(overlay) {
    const card = overlay && overlay.querySelector(".r76b-dialogue-card"), line = card && card.querySelector(".r76b-dialogue-line");
    if (!card || !line || card.querySelector("[data-r82b-crop-icon]")) return;
    const img = document.createElement("img"); img.className = "r82b-crop-icon"; img.dataset.r82bCropIcon = ""; img.src = r82Art("cropIcon"); img.alt = "藍布老麥圖示";
    if (r82ArtFallback("cropIcon")) img.dataset.r82bFallback = "";
    line.before(img);
  }
  /* R83B：鎮長葛瑞講回憶時，旁邊一直擺著那件舊物的正式圖（點下去以後地圖上的舊物就收進鎮誌了）。 */
  function addR83RelicIcon(overlay, artKey, name) {
    const card = overlay && overlay.querySelector(".r76b-dialogue-card"), line = card && card.querySelector(".r76b-dialogue-line");
    if (!card || !line || card.querySelector("[data-r83b-relic-icon]")) return;
    const img = document.createElement("img"); img.className = "r83b-relic-icon"; img.dataset.r83bRelicIcon = artKey; img.src = r82Art(artKey); img.alt = name;
    if (r82ArtFallback(artKey)) img.dataset.r82bFallback = "";
    line.before(img);
  }
  /* R83B：動作結果的規則句（份數、金幣）用旁白呈現，不掛在鄰居頭像底下；鄰居自己要說的話另外放在 speakerLine。 */
  function r83ResultLine(result) { return result && result.ok && result.speakerLine ? result.speakerLine : { by: "", text: (result && result.message) || "" }; }
  function openR82PlantMarker(state) {
    const s = liveState81(state), status = r82PlantStatus(s, Date.now()), order = r82BlueOrder(s);
    if (!status.eligible) return null;
    let line, choice;
    if (status.stage === "story") return openDialogue(s, "elder", [R81_OPTIONS.plant.after], { speaker: speakerOf81("elder"), dataset: { r82bBranch: "plant" } });
    if (status.stage === "empty") {
      line = { by: "", text: "（藍布包裡的老麥種躺在剛翻鬆的土邊，這一格只留給它。）" };
      choice = { id: "plant", label: "在這一格種藍布老麥", immediate: "專用田：尚未種植", longTerm: "要在不同的遊戲日各照到一次光" };
    } else if (status.stage === "growing") {
      line = { by: "", text: status.lightDays ? "（麥苗留著前一次日照的暖意，葉尖正等另一日的光。）" : "（細小的麥苗從藍布老麥田冒出頭，葉片朝著田邊的光轉。）" };
      choice = { id: "light", label: status.todayCaught ? "今天已照過光" : "讓藍布老麥接住這道光", immediate: "不同遊戲日照光 " + status.lightDays + "/2", longTerm: status.lightNow ? "光正照在專用田" : "等光照到這一格再按" };
    } else if (status.stage === "ripe") {
      line = { by: "", text: "（兩次不同日子的光都留在穗上，藍布老麥沉甸甸地彎了腰。）" };
      choice = { id: "harvest", label: "收成藍布老麥", immediate: "成熟度 2/2", longTerm: "收成後開放專屬訂單「" + R82_BLUE_ORDER.name + "」" };
    } else if (status.stage === "order") {
      line = { by: "", text: "（新收的藍布老麥用原本那塊藍布包著。班伯站在不遠處，一直往這邊看。）" };
      choice = { id: "order", label: "交專屬訂單「" + order.name + "」", immediate: "藍布老麥 " + Math.min(order.have, order.need) + "/" + order.need, longTerm: "完成拿 " + order.coins + " 金" };
    } else {
      return openDialogue(s, "mayor", [{ by: "mayor", text: "那一穗我看見了。原來有些留下來的東西，不一定只會讓人難過。" }], { speaker: speakerOf81("mayor"), dataset: { r82bBranch: "plant" }, onRender: addR82CropIcon });
    }
    /* R83B：收成與交單由老農班伯本人回一句（帶頭像），規則句等對話框關掉再用提示訊息出來，不被對話框蓋住。 */
    let note = "";
    return openDialogue(s, "elder", [line], { speaker: speakerOf81("elder"), startMode: "choices", dataset: { r82bBranch: "plant" }, choiceOptions: [choice], onRender: addR82CropIcon,
      onChoice: (id, showReply) => {
        const t = Date.now(); let result;
        if (id === "plant") result = r82Plant(s, t);
        else if (id === "light") result = r82CatchLight(s, t);
        else if (id === "harvest") result = r82HarvestBlueWheat(s, t);
        else result = r82DeliverBlueOrder(s, t);
        if (result.ok) saveNow();
        if (result.ok && result.speakerLine) note = result.message;
        showReply(r83ResultLine(result));
      },
      onClose: () => { if (note) toast81(note); } });
  }
  function openR82Relic(state, relicId) {
    const s = liveState81(state), result = r82FindRelic(s, relicId, Date.now()), relic = R82_RELICS.find((row) => row.id === relicId);
    if (!result.ok) { toast81(result.message); return null; }
    saveNow();
    return openDialogue(s, "mayor", result.memory, { speaker: speakerOf81("mayor"), dataset: { r82bBranch: "seal", r82bRelic: relicId },
      onRender: (overlay) => addR83RelicIcon(overlay, relic.artKey, relic.name),
      onLinesDone: () => { toast81(result.message); saveNow(); return null; } });
  }
  function openR82Decoration(state) {
    return openDialogue(liveState81(state), "mayor", [
      { by: "", text: "（三樣舊物壓在一束乾麥穗下，鎮誌牌安靜地立在封存箱旁。）" },
      { by: "mayor", text: "我原本只想把那段日子關起來。你把它們找回來以後，我才發現自己其實怕的是忘掉。" },
    ], { speaker: speakerOf81("mayor"), dataset: { r82bBranch: "seal", r82bRelic: "decoration" },
      onRender: (overlay) => addR83RelicIcon(overlay, R82_DECORATION.artKey, R82_DECORATION.name) });
  }
  function openR81Marker(state) {
    const stage = r81Stage(state);
    if (stage === "conflict") return openR81Conflict(state);
    const b = r81Ensure(state), opt = b && R81_OPTIONS[b.choice];
    if (!opt) return null;
    if (stage === "scene") return playR81Scene(state);
    if (stage === "done" && b.choice === "plant") return openR82PlantMarker(state);
    if (stage === "done") return openDialogue(state, opt.side, [opt.after], { speaker: speakerOf81(opt.side), dataset: { r81cStory: "after" } });
    const info = r81Order(state, Date.now());
    return openDialogue(state, opt.side, [info.line], { speaker: speakerOf81(opt.side), startMode: "choices", dataset: { r81cStory: "order" },
      choiceOptions: [{ id: "deliver", label: "交具名訂單「" + info.name + "」", immediate: info.wantText + "（倉庫 " + Math.min(info.have, info.need) + "/" + info.need + "）", longTerm: "拿 " + info.rewardText + "・" + info.vsText }],
      onChoice: (id, showReply) => { const r = r81Deliver(state, Date.now()); if (!r.ok) { showReply(r83ResultLine(r)); return; } saveNow(); toast81(r.message); playR81Scene(state); } });
  }
  function anchorTile81(state, spec) {
    const pair = String(spec || "").split(":"), kind = pair[0], id = pair[1];
    const tiles = state && state.map && Array.isArray(state.map.tiles) ? state.map.tiles : [];
    if (kind === "tile") { const xy = String(id || "").split(",").map(Number); return tiles.find((t) => t.x === xy[0] && t.y === xy[1]) || null; }
    return kind === "structure" ? tiles.find((t) => t.structureId === id) : kind === "station" ? tiles.find((t) => t.station === id) : kind === "npc" ? tiles.find((t) => t.npc === id) : null;
  }
  /* 地圖物件與手札「帶我去」共用：走到物件旁（還沒決定時是鎮長葛瑞旁邊），到了就打開那一段。 */
  function r81Go(state) {
    const s = liveState81(state), rows = r81SceneRows(s), f = farm();
    if (!rows.length || !f) return false;
    const panel = document.querySelector(".side-panel"); if (panel) panel.classList.remove("world-panel-open");
    const tile = anchorTile81(s, rows[0].marker.anchor);
    const ok = !!tile && typeof f.travelAndDo === "function" && f.travelAndDo(tile.id, "collect", () => openR81Marker(liveState81(s)));
    if (!ok) toast81("現在走不過去，先把手上的事做完再來。");
    return ok;
  }
  function r82Go(state, row) {
    const s = liveState81(state), f = farm();
    if (!s || !f) return false;
    const status = r82Ensure(s, Date.now()), route = status && status.route;
    let target = row || null;
    if (!target && route === "plant") target = r81SceneRows(s)[0] || null;
    if (!target && route === "seal") target = r82SceneRows(s, Date.now()).find((item) => item.r82bKind === "relic") || r82SceneRows(s, Date.now()).find((item) => item.r82bKind === "decoration") || null;
    if (!target && route === "seal") {
      const tile = anchorTile81(s, R81_OPTIONS.seal.anchor); if (tile && f.focusTile) f.focusTile(tile.id);
      toast81("今天還沒有新的鎮誌舊物，換個遊戲日再來看看。"); return !!tile;
    }
    if (!target) return false;
    const panel = document.querySelector(".side-panel"); if (panel) panel.classList.remove("world-panel-open");
    const tile = anchorTile81(s, target.marker.anchor);
    const effect = target.r82bKind === "relic" ? () => openR82Relic(liveState81(s), target.relicId)
      : target.r82bKind === "decoration" ? () => openR82Decoration(liveState81(s)) : () => openR82PlantMarker(liveState81(s));
    const ok = !!tile && typeof f.travelAndDo === "function" && f.travelAndDo(tile.id, "collect", effect);
    if (!ok) toast81("現在走不過去，先把手上的事做完再來。");
    return ok;
  }
  function r81Tick() {
    const s = liveState81(null);
    if (!s || busy81() || r81Stage(s) !== "conflict" || r81Ensure(s).shownAt) return;
    const at = s.heirloom && Number.isFinite(s.heirloom.deliveredAt) ? s.heirloom.deliveredAt : 0;
    if (!at || Date.now() - at > R81_AUTO_MS) return;
    openR81Conflict(s);
  }
  setInterval(r81Tick, 900);
  StoryR76.openR81Conflict = openR81Conflict;
  StoryR76.openR81Marker = openR81Marker;
  StoryR76.playR81Scene = playR81Scene;
  StoryR76.r81Go = r81Go;
  StoryR76.openR82PlantMarker = openR82PlantMarker;
  StoryR76.openR82Relic = openR82Relic;
  StoryR76.openR82Decoration = openR82Decoration;
  StoryR76.r82Go = r82Go;

  /* 鄰居交付累計：選完後完成兩張該鄰居的訂單，下次找他就會觸發回訪。 */
  if (A && !A.__r76bWrapped) {
    A.__r76bWrapped = true;
    const origDeliverNeighbor = A.deliverNeighbor;
    if (typeof origDeliverNeighbor === "function") A.deliverNeighbor = function (state, id, taste, now) {
      const r = origDeliverNeighbor(state, id, taste, now);
      if (r && r.ok) { try { noteOrder(state, id, now); } catch (_) { /* 回訪累計失敗不擋交付 */ } }
      return r;
    };
    const origDeliverCommission = A.deliverCommission;
    if (typeof origDeliverCommission === "function") A.deliverCommission = function (state, id, now) {
      const r = origDeliverCommission(state, id, now);
      if (r && r.ok) {
        try {
          const row = (A.commissions ? A.commissions(state, now) : []).find((c) => c.id === id);
          if (row && row.npcId) noteOrder(state, row.npcId, now);
        } catch (_) { /* 回訪累計失敗不擋交付 */ }
      }
      return r;
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
