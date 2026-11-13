/* R76B：第 8～13 項——開場選擇對白與回訪、鄰居頭像、收穫祭評比明細、任務卡去重。
   純邏輯可由 Node 載入；瀏覽器段提供逐句對話框，並包住鄰居交付以累計回訪訂單數。 */
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const A = isNode ? require("./adventure.js") : (root.AdventureAPI || null);

  const PORTRAITS = {
    mayor: "assets/generated/content-r77/portrait-mayor.png",
    elder: "assets/generated/content-r76/portrait-elder.png",
    merchant: "assets/generated/content-r76/portrait-merchant.png",
    child: "assets/generated/content-r76/portrait-child.png",
    miri: "assets/generated/r84/miri-0.png",
  };
  const PORTRAIT_BY_NAME = { "鎮長葛瑞": PORTRAITS.mayor, "老農班伯": PORTRAITS.elder, "商人蘿拉": PORTRAITS.merchant, "蘿拉": PORTRAITS.merchant, "孩童圖圖": PORTRAITS.child, "圖圖": PORTRAITS.child, "米莉": PORTRAITS.miri };
  function portraitFor(key) {
    if (!key) return "";
    if (PORTRAITS[key]) return PORTRAITS[key];
    return PORTRAIT_BY_NAME[key] || "";
  }

  /* 與 adventure.js R60_STORY_CHOICES 同一份問句：最後一句就是手札「當時問」。 */
  const CHOICES = {
    mayor: { storyId: "mayor_welcome", npcId: "mayor", speaker: "鎮長葛瑞", lines: ["你祖母把這片田照顧了很多年。", "現在輪到你替農場寫下一段新故事。", "第一格種下去以前，想先從哪裡開始？"], options: [
      { id: "farm", label: "我先去種田", result: "小麥種子包 +1", immediate: "馬上拿到：小麥種子包 1 包", longTerm: "之後一直有效：農舍門口的種子袋每天送 1 包小麥種子", reply: "好，先把第一格種起來。種子拿去，田不會等人，種下去農場就醒了。" },
      { id: "town", label: "先聽你講鎮上的事", result: "金幣 +5", immediate: "馬上拿到：金幣 5 枚", longTerm: "之後一直有效：鎮長每日委託的金幣多一成", reply: "好，我先說給你聽。班伯懂田、蘿拉懂買賣、圖圖最熟河邊的小路，慢慢認識他們。" },
    ] },
    elder: { storyId: "elder_wheat", npcId: "elder", speaker: "老農班伯", lines: ["這批新麥聞起來不錯。", "賣掉能換現金，留下來也能替下一輪打底。", "你想先賣，還是先留種？"], options: [
      { id: "sell", label: "先賣一小袋", result: "金幣 +5", immediate: "馬上拿到：金幣 5 枚", longTerm: "之後一直有效：老農班伯的河畔委託金幣多一成", reply: "好，先賣一小袋換現金周轉。記得下一輪也要替自己留一點，別全賣光了。" },
      { id: "seed", label: "先留一包種子", result: "小麥種子包 +1", immediate: "馬上拿到：小麥種子包 1 包", longTerm: "之後一直有效：每天向班伯請教時，多拿 1 包當季種子", reply: "好，先留種的人走得遠。這包種子收好，下一輪收成就接得上了。" },
    ] },
    merchant: { storyId: "merchant_hello", npcId: "merchant", speaker: "蘿拉", lines: ["我替你的農場留了一格攤位。", "第一批貨不用多，重點是讓客人記住名字。", "你想把牌子擺得醒目，還是先問客人喜歡什麼？"], options: [
      { id: "sign", label: "先把農場牌掛起來", result: "金幣 +5", immediate: "馬上拿到：金幣 5 枚", longTerm: "之後一直有效：農場入口立起招牌，蘿拉的河畔委託金幣多一成", reply: "好，先把牌子掛起來。客人先記住你的農場名字，之後買東西就會指名找你。" },
      { id: "listen", label: "先聽客人想買什麼", result: "草莓種子包 +1", immediate: "馬上拿到：草莓種子包 1 包", longTerm: "之後一直有效：蘿拉的今日特價從一樣變兩樣", reply: "好，先聽客人想要什麼。這樣種下去的東西有人等著買，就不會白忙一場。" },
    ] },
  };
  function choiceDef(npcId) { return CHOICES[npcId] || null; }
  function questionOf(npcId) { const def = CHOICES[npcId]; return def ? def.lines[def.lines.length - 1] : ""; }

  const FOLLOWUPS = {
    "mayor:farm": { lines: ["前幾天你說要先去種田，我後來經過田邊看了一眼，那包小麥種子長得還順吧？", "種子落進土裡只是開始，之後每天去看看它，農場才會慢慢跟你熟起來。"], summary: "鎮長問起那包小麥種子長得怎樣，還提醒我每天去田邊看看。" },
    "mayor:town": { lines: ["上次你先聽我講鎮上的事，後來去認得班伯和蘿拉了嗎？", "鎮上的人都好相處，你有空多走走，委託和消息都是這樣一點一點多起來的。"], summary: "鎮長問我認得鎮上的人了沒，提醒我多走動，消息自然會多起來。" },
    "elder:sell": { lines: ["你上次先賣的那一小袋新麥，價錢還合意吧？那批麥香，客人到現在還會問起。", "賣得掉是好事，不過記得替下一輪留一點種，田不能只顧眼前這一袋。"], summary: "班伯問起先賣掉的那袋新麥賣得怎樣，提醒我下一輪也要留種。" },
    "elder:seed": { lines: ["你上次留下的那包種子，後來長得怎樣？有沒有接上下一輪的收成？", "會留種的人我最放心。田就是這樣一輪接一輪，急不得，也斷不得。"], summary: "班伯問起我留下的那包種子長得怎樣，說會留種的人最讓他放心。" },
    "merchant:sign": { lines: ["你那塊農場牌掛起來之後，真的有人指名問起你的攤位，今天又來了一個。", "牌子醒目只是第一步，貨要穩定，人家記住名字之後還要記住你的東西好。"], summary: "蘿拉說農場牌掛起來後有人指名來問，提醒我貨也要穩定供應。" },
    "merchant:listen": { lines: ["你上次說要先聽客人想買什麼，後來有沒有聽到什麼新鮮的需求？", "最近好多人問甜的和能配茶的東西，你種之前先想想客人那一桌，比較不會白忙。"], summary: "蘿拉問我有沒有聽到客人的新需求，還說最近大家常問甜的和能配茶的東西。" },
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
    const stars = judging && Number.isFinite(judging.stars) ? judging.stars : (total >= 3 ? 3 : total >= 2 ? 2 : 1);
    const missing = rows.filter((r) => !r.got).map((r) => r.label);
    return { rows, total, max: 5, stars, missing, nextForThree: total === 2 && missing.length ? missing[0] : null, thresholdText: "一星要 1 分、二星要 2 分、三星要 3 分，滿分 5 分" };
  }
  function festivalTip(judging) {
    const b = festivalBreakdown(judging);
    if (b.stars >= 3) return "五項裡已經拿到 " + b.total + " 分，下次可以換不同的當季作物再試一次。";
    if (b.nextForThree) return "再補這一項就三星：" + b.nextForThree + "。還沒拿到的有：" + b.missing.join("、") + "。";
    return "還沒拿到的有：" + b.missing.join("、") + "，補上其中一項，分數就會往上加。";
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

  const StoryR76 = { PORTRAITS, CHOICES, FOLLOWUPS, FESTIVAL_ROWS, portraitFor, choiceDef, questionOf, ensure, selectedChoiceId, followupDef, followupDue, noteOrder, noteTalk, markFollowupSeen, followupSummary, festivalBreakdown, festivalTip, isDuplicateQuestRow };
  root.StoryR76 = StoryR76;
  if (isNode) module.exports = StoryR76;
  if (typeof document === "undefined") return;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const versionQuery = () => root.FARM_VERSION_QUERY || "";
  function farm() { return root.__farm; }
  function saveNow() { const f = farm(); if (f && f.safeSaveNow) f.safeSaveNow(); if (f && f.refresh) f.refresh(); }

  function openDialogue(state, npcId, lines, options) {
    document.querySelectorAll(".r76b-dialogue").forEach((n) => n.remove());
    const def = CHOICES[npcId];
    const speaker = options && options.speaker || (def ? def.speaker : npcId);
    const overlay = document.createElement("div");
    overlay.className = "r76b-dialogue";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", speaker + "的對話");
    overlay.dataset.r76bDialogue = npcId;
    document.body.appendChild(overlay);
    let step = 0;
    let mode = "lines";
    function render() {
      const portrait = portraitFor(npcId) || portraitFor(speaker);
      const head = '<div class="r76b-dialogue-head">' + (portrait ? '<img class="r76b-portrait" src="' + esc(portrait) + esc(versionQuery()) + '" alt="' + esc(speaker) + '" width="64" height="64">' : "") + "<b>" + esc(speaker) + "</b></div>";
      if (mode === "lines") {
        overlay.innerHTML = '<div class="r76b-dialogue-card">' + head + '<p class="r76b-dialogue-line" data-r76b-line>' + esc(lines[step]) + '</p><p class="r76b-dialogue-step">第 ' + (step + 1) + " 句，共 " + lines.length + ' 句</p><div class="r76b-dialogue-actions"><button type="button" data-r76b-next>' + (step >= lines.length - 1 ? "聽完了" : "下一句") + '</button><button type="button" data-r76b-later>晚點再說</button></div></div>';
        overlay.querySelector("[data-r76b-next]").onclick = () => {
          if (step < lines.length - 1) { step++; render(); return; }
          if (options && options.onLinesDone) { const nextMode = options.onLinesDone(); if (nextMode === "choices") { mode = "choices"; render(); return; } }
          close();
        };
      } else if (mode === "choices") {
        const choiceOptions = (options && options.choiceOptions) || [];
        overlay.innerHTML = '<div class="r76b-dialogue-card">' + head + '<p class="r76b-dialogue-line">' + esc(lines[lines.length - 1]) + '</p><div class="r76b-choice-list">' + choiceOptions.map((o) => '<button type="button" class="r76b-choice" data-r76b-choice="' + esc(o.id) + '"><b>' + esc(o.label) + '</b><small>' + esc(o.immediate) + '</small><small>' + esc(o.longTerm) + "</small></button>").join("") + '</div><div class="r76b-dialogue-actions"><button type="button" data-r76b-later>晚點再說</button></div></div>';
        overlay.querySelectorAll("[data-r76b-choice]").forEach((btn) => { btn.onclick = () => { if (options && options.onChoice) options.onChoice(btn.dataset.r76bChoice, (reply) => { mode = "reply"; linesReply = reply; render(); }); }; });
      } else {
        overlay.innerHTML = '<div class="r76b-dialogue-card">' + head + '<p class="r76b-dialogue-line">' + esc(linesReply) + '</p><div class="r76b-dialogue-actions"><button type="button" data-r76b-next>知道了</button></div></div>';
        overlay.querySelector("[data-r76b-next]").onclick = () => close();
      }
      const later = overlay.querySelector("[data-r76b-later]");
      if (later) later.onclick = () => close();
    }
    let linesReply = "";
    function close() { overlay.remove(); if (options && options.onClose) options.onClose(); }
    render();
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
