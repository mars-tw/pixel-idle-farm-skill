"use strict";
/* R79C：後續委託走到地圖上做、每個選擇解鎖有名字的新訂單或新配方、物件旁每天輪替的鄰居對白、
   手札與任務卡同一個來源、升級卡逐項列出解鎖、鎮長一種對話框、晨霧與按鈕樣式。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.window = global;
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const A = require("../src/adventure.js");
const State = require("../src/state.js");
const G = require("../src/game.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const Q = require("../src/choices-r77.js");
Q.install();

const T0 = 1794172800000, DAY = 86400000;
const ROUTES = [["mayor", "farm"], ["mayor", "town"], ["elder", "sell"], ["elder", "seed"], ["merchant", "sign"], ["merchant", "listen"]];
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh(level) { const s = State.defaultState(T0); s.level = level || 5; s.coins = 100; A.ensure(s, T0); M.ensure(s, T0); return s; }
function choose(s, npcId, choiceId, at) {
  if (npcId === "elder") s.adventure.claimed.c1_first_harvest = true;
  if (npcId === "merchant") s.adventure.claimed.c1_homecoming = true;
  A.ensure(s, at || T0);
  const r = A.resolveMainStoryChoice(s, npcId, choiceId, at || T0);
  assert.equal(r.ok, true, npcId + "/" + choiceId + " " + JSON.stringify(r));
  return r;
}
/* 照地圖上的順序把一條路線做完；decisionId 是第二步要選的那一個（招牌是顏色）。 */
function finish(s, npcId, choiceId, decisionId, at) {
  const def = Q.questDef(npcId, choiceId);
  for (let i = 0; i < 3; i++) {
    const step = def.steps[i];
    if (step.act === "give_dried") s.storage.items.sun_wheat = 1;
    if (step.act === "meal") s.adventure.meals.rustic_bread = 1;
    if (step.act === "seed_meal") { s.adventure.r58.r59.seedPacks.wheat = 2; s.adventure.meals.rustic_bread = 1; }
    if (step.act === "wood") s.materials.wood = 2;
    if (step.act === "special_crop") { const d = K.merchantDeals(s, at)[0]; s.storage.items[d.cropId] = (s.storage.items[d.cropId] || 0) + 1; }
    const arg = step.act === "decision" || step.act === "color" ? decisionId : undefined;
    const r = Q.act(s, npcId, at + i, arg);
    assert.equal(r.ok, true, npcId + " 第 " + (i + 1) + " 步 " + JSON.stringify(r));
  }
  assert.equal(Q.questView(s, npcId, at + 5).status, "done");
}
const NO_LATIN = /[A-Za-z]/;

test("第 1 項：六條後續委託每一步都標在地圖上（物件旁或鄰居旁），去哪裡做都寫「走到…」，不再叫玩家在手札裡做", () => {
  for (const [npc, choice] of ROUTES) {
    const def = Q.questDef(npc, choice);
    const onMap = def.steps.filter((step) => step.place === "marker" || step.place === "npc");
    assert.ok(onMap.length >= 2, npc + "/" + choice + " 至少兩步在地圖上做");
    assert.equal(onMap.length, 3, npc + "/" + choice + " 三步都標了地點");
    for (const step of def.steps) {
      assert.doesNotMatch(step.where, /手札|這張卡|在這裡/, npc + "/" + choice + " 去哪裡做不能再指向手札：" + step.where);
      assert.match(step.where, /走到|旁邊/, npc + "/" + choice + " 要寫走到哪裡：" + step.where);
      if (step.place === "npc" && step.act !== "scene_close") { assert.ok(step.ask && step.thanks, npc + "/" + choice + " 交給鄰居的那一步要有開口與道謝"); assert.doesNotMatch(step.ask + step.thanks, NO_LATIN); }
    }
    assert.ok(def.marker.spot && def.marker.earlyLabel.length <= 6, npc + "/" + choice + " 名牌短、寫得出在哪裡");
  }
});

test("第 1 項：手札卡只有進度與「帶我去」，沒有任何直接完成步驟的按鈕", () => {
  for (const [npc, choice] of ROUTES) {
    const s = fresh(5); choose(s, npc, choice, T0);
    const def = Q.questDef(npc, choice);
    for (let i = 0; i <= 3; i++) {
      const html = Q.cardHtml(s, npc, T0 + 10 + i);
      const buttons = html.match(/<button[^>]*>/g) || [];
      assert.ok(buttons.every((b) => /data-r79c-go="/.test(b)), npc + "/" + choice + " 第 " + i + " 步的手札只能有「帶我去」：" + buttons.join(" "));
      assert.equal((html.match(/data-r79c-go="/g) || []).length, 1, npc + "/" + choice + " 一張卡只有一顆帶我去");
      assert.doesNotMatch(html, /data-r77b-act=|data-r78c-daily=|data-r77b-swap(?!-box)|data-r77b-buy-third|data-r78c-npc=/);
      if (i === 3) break;
      const step = def.steps[i];
      if (step.act === "give_dried") s.storage.items.sun_wheat = 1;
      if (step.act === "meal") s.adventure.meals.rustic_bread = 1;
      if (step.act === "seed_meal") { s.adventure.r58.r59.seedPacks.wheat = 2; s.adventure.meals.rustic_bread = 1; }
      if (step.act === "wood") s.materials.wood = 2;
      if (step.act === "special_crop") { const d = K.merchantDeals(s, T0)[0]; s.storage.items[d.cropId] = 1; }
      const arg = step.act === "decision" ? step.options[0].id : step.act === "color" ? "red" : undefined;
      assert.equal(Q.act(s, npc, T0 + 20 + i, arg).ok, true);
    }
  }
});

test("第 1 項：每個物件旁每天輪替的鄰居對白至少五句，同一天固定、隔天換一句，三位鄰居的口氣分得出來", () => {
  const all = new Set();
  const avg = {};
  for (const [npc, choice] of ROUTES) {
    const def = Q.questDef(npc, choice);
    assert.ok(Array.isArray(def.chatter) && def.chatter.length >= 5, npc + "/" + choice + " 至少五句");
    assert.equal(new Set(def.chatter).size, def.chatter.length, "同一個物件的對白不重複");
    def.chatter.forEach((line) => { assert.doesNotMatch(line, NO_LATIN); assert.ok(!all.has(line), "不同物件不共用同一句：" + line); all.add(line); });
    (avg[npc] = avg[npc] || []).push(...def.chatter.map((line) => line.length));
    const s = fresh(5); choose(s, npc, choice, T0); finish(s, npc, choice, def.colorStep ? "blue" : def.steps[1].options[1].id, T0 + 1);
    const seen = new Set();
    for (let d = 0; d < def.chatter.length; d++) { const a = Q.dailyLine(s, npc, T0 + d * DAY), b = Q.dailyLine(s, npc, T0 + d * DAY + 3600000); assert.equal(a, b, "同一天同一句"); seen.add(a); }
    assert.equal(seen.size, def.chatter.length, npc + "/" + choice + " 每天輪到不同一句");
  }
  const mean = (rows) => rows.reduce((x, y) => x + y, 0) / rows.length;
  assert.ok(mean(avg.elder) < mean(avg.mayor) && mean(avg.elder) < mean(avg.merchant), "老農班伯話最短（口氣跟鎮長、蘿拉分得出來）");
  assert.ok(Q.questDef("mayor", "farm").chatter.concat(Q.questDef("mayor", "town").chatter).some((line) => /規矩|鎮誌|公告/.test(line)), "鎮長講規矩與鎮上的事");
  assert.ok(Q.questDef("merchant", "sign").chatter.concat(Q.questDef("merchant", "listen").chatter).filter((line) => /客人/.test(line)).length >= 3, "蘿拉三句不離客人");
});

test("第 2 項：每個選擇都解鎖一項有名字的新訂單或新配方；同一條路線兩種選擇名字與內容都不同", () => {
  const names = new Set();
  for (const [npc, choice] of ROUTES) {
    const def = Q.questDef(npc, choice);
    assert.ok(def.special && /^新(訂單|配方)$/.test(def.special.kind), npc + "/" + choice + " 種類寫明");
    const keys = def.colorStep ? ["red", "blue", "green"] : def.steps[1].options.map((o) => o.id);
    assert.deepEqual(Object.keys(def.special.variants).sort(), keys.slice().sort(), npc + "/" + choice + " 每個選擇各有一項");
    const outcomes = new Set();
    for (const key of keys) {
      const v = def.special.variants[key];
      assert.ok(v.name && !names.has(v.name), "名字不重複：" + v.name); names.add(v.name);
      assert.doesNotMatch(v.name + v.line, NO_LATIN);
      outcomes.add(JSON.stringify([v.want, v.reward, v.coinsRate || 0]));
    }
    assert.equal(outcomes.size, keys.length, npc + "/" + choice + " 不同選擇內容也不同（不是只多一成金幣）");
  }
  assert.equal(names.size, 13);
});

test("第 2 項：解鎖前看得到兩個名字、做了決定只剩那一個；做完三步可以每天做一次，東西真的進帳", () => {
  for (const [npc, choice] of ROUTES) {
    const def = Q.questDef(npc, choice);
    const keys = def.colorStep ? ["red", "blue"] : def.steps[1].options.map((o) => o.id);
    const results = [];
    for (const key of keys) {
      const s = fresh(5); choose(s, npc, choice, T0); Q.takeNotes();
      const before = Q.cardHtml(s, npc, T0 + 1);
      const unlock = (before.match(/data-r79c-unlock>([^<]*)</) || [])[1] || "";
      for (const k of Object.keys(def.special.variants)) assert.match(unlock, new RegExp(def.special.variants[k].name), npc + "/" + choice + " 手札先列出可能解鎖的名字");
      assert.equal(Q.specialInfo(s, npc, T0 + 1).eligible, false, "做完以前不能用");
      finish(s, npc, choice, key, T0 + 2);
      const v = def.special.variants[key];
      const card = Q.cardHtml(s, npc, T0 + 10);
      assert.match(card, new RegExp('data-r79c-special="' + npc + '"'), "完成後手札列出解鎖的那一項");
      assert.match(card, new RegExp(v.name));
      for (const other of Object.keys(def.special.variants).filter((k) => k !== key)) assert.doesNotMatch(card, new RegExp(def.special.variants[other].name), "沒選的那一項不出現");
      const info = Q.specialInfo(s, npc, T0 + 10);
      assert.equal(info.eligible, true); assert.equal(info.name, v.name);
      const miss = Q.takeSpecial(s, npc, T0 + 11);
      if (!info.enough) assert.equal(miss.reason, "missing_special", JSON.stringify(miss));
      /* 補齊要的東西 */
      if (v.want.type === "meal") s.adventure.meals.rustic_bread = (s.adventure.meals.rustic_bread || 0) + v.want.qty;
      else if (v.want.type === "seasonal") { const id = K.seasonalCropId(s); s.storage.items[id] = (s.storage.items[id] || 0) + v.want.qty; }
      else if (v.want.type === "deal") { const id = K.merchantDeals(s, T0 + 12)[0].cropId; s.storage.items[id] = (s.storage.items[id] || 0) + v.want.qty; }
      else { s.storage.items.tomato = (s.storage.items.tomato || 0) + v.want.qty + 3; }
      const coins0 = s.coins, sun0 = (s.r75Sunplay && s.r75Sunplay.sunlight) || 0, compost0 = s.materials.compost || 0, wood0 = s.materials.wood || 0;
      const packs0 = JSON.stringify(s.adventure.r58.r59.seedPacks);
      const done = Q.takeSpecial(s, npc, T0 + 12);
      assert.equal(done.ok, true, npc + "/" + choice + "/" + key + " " + JSON.stringify(done));
      assert.match(done.message, new RegExp("完成「" + v.name + "」"));
      const gained = { coins: s.coins - coins0, sun: ((s.r75Sunplay && s.r75Sunplay.sunlight) || 0) - sun0, compost: (s.materials.compost || 0) - compost0, wood: (s.materials.wood || 0) - wood0, packs: JSON.stringify(s.adventure.r58.r59.seedPacks) !== packs0 };
      if (v.coinsRate || (v.reward && v.reward.coins)) assert.ok(gained.coins > 0, "金幣進帳");
      if (v.reward.sunlight) assert.ok(gained.sun > 0, "陽光進帳");
      if (v.reward.materials && v.reward.materials.compost) assert.equal(gained.compost, v.reward.materials.compost, "堆肥進帳");
      if (v.reward.materials && v.reward.materials.wood) assert.equal(gained.wood, v.reward.materials.wood, "木料進帳");
      if (v.reward.seasonalSeed || v.reward.seedPacks) assert.ok(gained.packs, "種子包進帳");
      assert.equal(Q.takeSpecial(s, npc, T0 + 13).reason, "daily_limit", "一天一次");
      assert.equal(Q.specialInfo(s, npc, T0 + DAY).used, false, "隔天又能做");
      results.push(JSON.stringify(gained));
    }
    assert.notEqual(results[0], results[1], npc + "/" + choice + " 兩種選擇實際拿到的東西不同");
  }
});

test("第 2 項：一做決定地圖名牌就換成那個決定；兩種選擇同一個地點名牌不同；招牌做完只剩一塊名牌", () => {
  for (const [npc, choice] of ROUTES) {
    const def = Q.questDef(npc, choice);
    const keys = def.colorStep ? ["red", "blue"] : def.steps[1].options.map((o) => o.id);
    const labels = keys.map((key) => {
      const s = fresh(5); choose(s, npc, choice, T0);
      const early = Q.sceneStates(s).find((row) => row.npcId === npc);
      assert.equal(early.label, def.marker.earlyLabel); assert.equal(early.decided, false);
      if (def.colorStep) { finish(s, npc, choice, key, T0 + 1); } else {
        Q.act(s, npc, T0 + 1);
        assert.equal(Q.act(s, npc, T0 + 2, key).ok, true);
      }
      const row = Q.sceneStates(s).find((r) => r.npcId === npc);
      assert.equal(row.decided, true, "決定一做完就換名牌");
      assert.doesNotMatch(row.label, /等待/);
      assert.equal(row.marker.anchor, def.marker.anchor, "同一個地點");
      if (def.colorStep) assert.equal(row.merged, "farm_sign", "招牌做完併進市集那一塊");
      return row.label;
    });
    assert.notEqual(labels[0], labels[1], npc + "/" + choice + " 兩種選擇名牌不同");
  }
  const s = fresh(5); choose(s, "merchant", "sign", T0); finish(s, "merchant", "sign", "red", T0 + 1);
  assert.equal(Q.signLabel(s), "農場招牌（莓果紅）");
  assert.equal(Q.sceneStates(s).filter((row) => row.npcId === "merchant" && !row.merged).length, 0, "地圖上不再另畫「農場招牌・莓果紅」");
  const notes = []; const s2 = fresh(5); choose(s2, "mayor", "farm", T0); notes.push(...Q.takeNotes());
  assert.ok(notes.some((n) => /立刻改變.*告示牌旁.*晨耕種子籃.*走過去看看/.test(n)), "開場回答後告訴玩家去哪裡看：" + notes.join("|"));
});

test("第 2 項：六張選擇物件圖的檔名照計畫接好；圖還沒到的不載入（用現有小圖當後備）", () => {
  const expected = { "mayor:farm": "choice-mayor-farm", "mayor:town": "choice-mayor-town", "elder:sell": "choice-elder-sell", "elder:seed": "choice-elder-seed", "merchant:sign": "choice-merchant-sign", "merchant:listen": "choice-merchant-listen" };
  for (const key of Object.keys(expected)) {
    assert.equal(Q.CHOICE_ART[key], "assets/generated/content-r79/" + expected[key] + ".png");
    const exists = fs.existsSync(path.join(ROOT, Q.CHOICE_ART[key]));
    assert.equal(Q.CHOICE_ART_READY.includes(key), exists, key + "：清單要跟檔案在不在一致");
    const [npc, choice] = key.split(":"), def = Q.questDef(npc, choice);
    const art = Q.choiceArt(key, def.marker.art);
    assert.ok(fs.existsSync(path.join(ROOT, art)), key + " 地圖上用的圖一定存在：" + art);
  }
  const arts = ROUTES.map(([npc, choice]) => Q.choiceArt(npc + ":" + choice, Q.questDef(npc, choice).marker.art));
  assert.equal(new Set(arts).size, 6, "六種回答的地圖物件各用不同的圖");
});

test("第 3 項：升級卡逐項列出這一級解鎖的作物、設施、功能，附圖示；升級面板第一屏放三個目標", () => {
  for (const level of [2, 3, 4, 5, 6]) {
    const card = G.milestoneCard("level_up", { level });
    assert.ok(Array.isArray(card.unlocks) && card.unlocks.length >= 1, "Lv " + level + " 要列出解鎖項目");
    assert.doesNotMatch(card.unlocked, /新的作物與農場能力/);
    for (const row of card.unlocks) {
      assert.ok(row.name && !NO_LATIN.test(row.name), "名字：" + row.name);
      if (row.icon) assert.ok(fs.existsSync(path.join(ROOT, row.icon)), "圖示存在：" + row.icon);
      if (row.kind === "seed") assert.ok(row.icon, "作物一定有圖示");
    }
  }
  const lv5 = G.milestoneCard("level_up", { level: 5 }).unlocks.map((row) => row.name);
  assert.ok(lv5.includes("南瓜種子") && lv5.includes("畜舍") && lv5.includes("天氣變化"), JSON.stringify(lv5));
  const ui = read("src/ui.js");
  assert.match(ui, /data-r79c-unlocks/, "升級卡畫出逐項清單");
  assert.match(ui, /const firstShown = [^;]*\.slice\(0, 3\);/, "第一屏放三個目標");
  assert.match(ui, /!firstShown\.includes\(key\)/);
});

test("第 4 項：鎮長一律叫「鎮長葛瑞」、頭像跟下方對話框同一張；下方對話框開著時另一種不插進來", () => {
  const world = read("src/world-ui.js"), story = read("src/story-r76.js");
  assert.match(world, /if \(\/葛瑞\/\.test\(name\) && !\/鎮長\/\.test\(name\)\) name = "鎮長葛瑞";/);
  assert.match(world, /\/葛瑞\/\.test\(name\) \? 'content-r77\/portrait-mayor'/);
  assert.match(story, /mayor: "assets\/generated\/content-r77\/portrait-mayor\.png"/, "下方對話框用的就是這一張");
  assert.doesNotMatch(world, /grey-[012]/, "不再用禿頭那一組頭像");
  assert.match(world, /document\.querySelector\("\.r76b-dialogue"\)\); \}; \/\/ R37/, "下方對話框開著時延後");
  assert.match(world, /window\.FarmWorld\.hushSpeak = hushSpeak;/);
  assert.match(story, /options\.startMode === "choices"/);
  const img = fs.readFileSync(path.join(ROOT, "assets/generated/content-r77/portrait-mayor.png"));
  assert.equal(img.readUInt32BE(16) % 80, 0, "頭像原圖是 80 的整數倍，對話框 80px／40px 顯示都整數倍");
});

test("第 5 項：手札「現在做」與任務卡同一個來源；鎮長評比台詞與下次提示講同一個數字", () => {
  const world = read("src/world-ui.js");
  /* R85A 同步（R85 計畫 A 線第 1 項：下一步只有一個來源）：手札與任務卡不再各寫一套規則，兩邊都讀 world-ui 的 presentStep（A.oneStep → nowStep）；
     「任務認得的農務步驟或光的步驟」這套規則現在只寫在 adventure.js 的 nowStep 一處，沒有農務步驟時一樣用 guide。 */
  const adv = read("src/adventure.js");
  assert.match(adv, /function nowStep\(state, now\) \{[\s\S]*?if \(g\.questAware && g\.questId === q\.id\) return g;[\s\S]*?if \(!g\.questAware && \(g\.action === "refract" \|\| g\.action === "catch_sun" \|\| g\.sunlit === true \|\| waiting\)\) return g;/, "第 2 章以後跟任務卡同一套規則（任務認得的農務步驟或光的步驟）");
  assert.match(adv, /function oneStep\(state, now\) \{[\s\S]*?const step = nowStep\(state, t\), g = q \? guide\(state, t\) : null;/, "沒有農務步驟時跟任務卡一樣用 guide");
  assert.equal((world.match(/presentStep\(current, Date\.now\(\)\)/g) || []).length, 3, "目前主線卡、同步函式與 FarmWorld.currentStep 都用同一支");
  assert.match(world, /const present = presentStep\(s, Date\.now\(\)\)/, "任務卡也讀同一支");
  let checked = 0;
  for (const pick of [["wheat", "carrot", "rustic_bread"], ["wheat", "wheat", "carrot"]]) {
    const s = fresh(5), f = s.adventure.r61.festival;
    f.unlocked = true; f.startsAt = T0; f.endsAt = T0 + 600000; f.nextAt = 0; f.supportProvisioned = true;
    f.baseline = { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
    Object.assign(s.storage.items, { wheat: 2, carrot: 1 }); s.adventure.meals.rustic_bread = 1;
    const r = A.judgeFestivalEntry(s, pick, T0 + 1);
    assert.equal(r.ok, true, JSON.stringify(r));
    if (r.stars !== 2) continue;
    const said = Number((r.mayorLine.match(/再補 (\d+) 項/) || [])[1]);
    const tip = Number((r.tip.match(/還差 (\d+) 項/) || [])[1]);
    assert.ok(said > 0 && said === tip, "台詞說補 " + said + " 項、提示說差 " + tip + " 項");
    checked++;
  }
  assert.ok(checked >= 1, "至少比對到一場二星評比");
});

test("第 5、6 項：右側面板標題固定在上緣、評比只用一種符號、晨霧不是水平白條、按鈕只剩兩種", () => {
  const css = read("src/content-r58b.css");
  const block = (css.match(/R79C（選擇搬到地圖上、進度同一個來源）開始[\s\S]*R79C 結束/) || [""])[0];
  assert.ok(block, "R79C 區段完整");
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  assert.match(block, /\.side-pane\.sel > \.pane-head \{ position: sticky; top: -16px;/);
  assert.match(block, /\.r76b-judge-breakdown \{ list-style: none;/);
  const fog = (block.match(/#weatherLayer\.fog::before \{[\s\S]*?\n\}/) || [""])[0];
  assert.ok(fog && !/repeating-linear-gradient/.test(fog) && /radial-gradient/.test(fog), "晨霧改成一團團、邊緣淡");
  assert.match(block, /#weatherLayer\.fog::after \{ background: radial-gradient\(130% 110% at 50% 50%, transparent 52%/, "中間透");
  assert.match(block, /#worldDialogue \.dialogue-continue, \.r66b-act, \.r77b-act, \.r76b-dialogue-actions \[data-r76b-next\] \{\s*border: 2px solid #8a541c; background: #ffd978;/, "主要鈕：黃");
  assert.match(block, /#worldDialogue \.dialogue-close, \.r76b-dialogue-actions \[data-r76b-later\], \.r61b-gift-open, \.r61b-story-btn \{\s*background: #fff8e8;[^}]*inset 0 0 0 2px #6b3f17/, "次要鈕：深棕框");
  assert.match(block, /body:has\(\.r76b-dialogue\) :is\(#mapScene \.seed-hud, #farmDock, #mobileControls\) \* \{ visibility: hidden !important;/, "下方對話框開著時種子卡整張收起來（連裡面的字）");
  assert.match(block, /body:has\(#worldDialogue:not\(\[hidden\]\)\) #mapScene \.seed-hud \*/, "上方那一種開著時種子卡也收起來");
  assert.match(read("src/ui.js"), /dialogue: "#worldDialogue:not\(\[hidden\]\), \.r76b-dialogue"/, "兩種對話開著時任務卡都照 R78B 收成一列");
});

console.log("VERIFIED content R79C world (" + passed + " tests)");
