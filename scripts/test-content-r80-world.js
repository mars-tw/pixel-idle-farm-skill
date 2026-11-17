"use strict";
/* R80C：選擇的後果玩得到——兩個決定各有每天真的入帳的效果、具名解鎖不低於一般訂單、決定換地圖物件、
   新存檔十分鐘內走完「鎮長選擇 → 地圖物件改變 → 第一張具名訂單」、手札標題跟著內容、對話框只剩一種、升級卡與升級面板、種子卡與名牌。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.window = global;
const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const C = require("../src/config.js");
const A = require("../src/adventure.js");
const State = require("../src/state.js");
const G = require("../src/game.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const SP = require("../src/sunplay-r75.js");
const Q = require("../src/choices-r77.js");
Q.install();

const T0 = 1794172800000, DAY = 86400000, MIN = 60000;
const ROUTES = [["mayor", "farm"], ["mayor", "town"], ["elder", "sell"], ["elder", "seed"], ["merchant", "sign"], ["merchant", "listen"]];
const NO_LATIN = /[A-Za-z]/;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh(level) { const s = State.defaultState(T0); s.level = level || 5; s.xp = C.xpForLevel(s.level); s.coins = 500; A.ensure(s, T0); M.ensure(s, T0); K.ensure(s, T0); return s; }
function choose(s, npcId, choiceId, at) {
  if (npcId === "elder") s.adventure.claimed.c1_first_harvest = true;
  if (npcId === "merchant") s.adventure.claimed.c1_homecoming = true;
  A.ensure(s, at || T0);
  const r = A.resolveMainStoryChoice(s, npcId, choiceId, at || T0);
  assert.equal(r.ok, true, npcId + "/" + choiceId + " " + JSON.stringify(r));
  return r;
}
/* 做到第二步的決定（招牌是做完三步選顏色）。 */
function decide(s, npcId, choiceId, key, at) {
  const def = Q.questDef(npcId, choiceId);
  for (let i = 0; i < 3; i++) {
    const step = def.steps[i];
    if (step.act === "give_dried") s.storage.items.sun_wheat = 1;
    if (step.act === "meal") s.adventure.meals.rustic_bread = 1;
    if (step.act === "seed_meal") { s.adventure.r58.r59.seedPacks.wheat = 2; s.adventure.meals.rustic_bread = 1; }
    if (step.act === "wood") s.materials.wood = 2;
    if (step.act === "special_crop") { const d = K.merchantDeals(s, at)[0]; s.storage.items[d.cropId] = (s.storage.items[d.cropId] || 0) + 1; }
    const arg = step.act === "decision" || step.act === "color" ? key : undefined;
    assert.equal(Q.act(s, npcId, at + i, arg).ok, true, npcId + " 第 " + (i + 1) + " 步");
    if (step.act === "decision" || step.act === "color") return;
  }
}
function finish(s, npcId, choiceId, at) {
  const def = Q.questDef(npcId, choiceId);
  while (s.adventure.r77.quests[npcId].step < 3) {
    const step = def.steps[s.adventure.r77.quests[npcId].step];
    if (step.act === "give_dried") s.storage.items.sun_wheat = 1;
    if (step.act === "meal") s.adventure.meals.rustic_bread = 1;
    if (step.act === "seed_meal") { s.adventure.r58.r59.seedPacks.wheat = 2; s.adventure.meals.rustic_bread = 1; }
    if (step.act === "special_crop") { const d = K.merchantDeals(s, at)[0]; s.storage.items[d.cropId] = (s.storage.items[d.cropId] || 0) + 1; }
    assert.equal(Q.act(s, npcId, at).ok, true);
  }
}
/* 一般訂單平均：直接照 game.js makeOrder 的單價規則重算一次（每份單價四捨五入，再依稀有度出現機率加權）。 */
function generalAverage(itemId, qty) {
  const sell = (C.CROPS[itemId] || {}).sellValue || 0, rows = Object.values(C.ORDER_RARITY), w = rows.reduce((x, r) => x + r.weight, 0);
  return rows.reduce((x, r) => x + r.weight * Math.max(1, Math.round(sell * r.payMult)) * qty, 0) / w;
}
const snapshot = (s) => ({ coins: s.coins, sun: SP.sunlight(s), wood: (s.materials || {}).wood || 0, compost: (s.materials || {}).compost || 0, packs: JSON.stringify(s.adventure.r58.r59.seedPacks), items: JSON.stringify(s.storage.items) });
function readyPlot(s, i, cropId, at) { s.plots[i].cropId = null; const r = G.plant(s, i, cropId, at - 30 * MIN); assert.equal(r.ok, true, "播種 " + JSON.stringify(r)); }
/* 觸發一次那個決定對應的遊戲事件；回傳事件前後的差別。 */
function trigger(s, on, at) {
  const before = snapshot(s);
  if (on === "harvest" || on === "sun_harvest") {
    readyPlot(s, 0, "wheat", at);
    if (on === "sun_harvest") s.sun = { plots: [0], startsAt: at - 1000, endsAt: at + 10000, nextAt: at + 60000, used: [], introduced: true };
    const r = G.harvest(s, 0, at); assert.equal(r.ok, true, JSON.stringify(r));
    if (on === "sun_harvest") assert.ok(r.sun && r.sun.xpBonus > 0, "這次是光裡收成");
  } else if (on === "order") {
    s.orders = [{ id: "r80c_test", wants: { tomato: 1 }, rarity: "common", rewardCoins: 11, rewardXp: 1, expiresAt: at + 600000, npcId: "mayor" }];
    s.storage.items.tomato = (s.storage.items.tomato || 0) + 1;
    const r = G.fulfillOrder(s, "r80c_test", at); assert.equal(r.ok, true, JSON.stringify(r));
  } else if (on === "sell") {
    s.storage.items.wheat = (s.storage.items.wheat || 0) + 1;
    assert.equal(G.sellItem(s, "wheat", 1, at).ok, true);
  } else if (on === "plant") {
    s.plots[1].cropId = null;
    assert.equal(G.plant(s, 1, "wheat", at).ok, true);
  } else if (on === "dried") {
    s.storage.items.wheat = (s.storage.items.wheat || 0) + 2; SP.addSunlight(s, 1);
    assert.equal(SP.startDrying(s, "wheat", at).ok, true);
    Q.hookDried();
    assert.equal(SP.collectDrying(s, at + SP.DRYING_MS + 1).ok, true);
  }
  /* 曬架收下的掛勾（sunplay 的 onDried）不帶時間，遊戲裡用的是當下時間；其餘事件用傳進去的時間。 */
  return { before, after: snapshot(s), at: on === "dried" ? Date.now() : at };
}

test("第 1 項：六條委託每個決定都有一項每天的效果，同一條路線兩邊的效果不同、手札寫得出數字", () => {
  const all = new Set();
  for (const [npc, choice] of ROUTES) {
    const table = Q.DECISION_DAILY[npc + ":" + choice];
    assert.ok(table, npc + "/" + choice + " 要有每日效果");
    assert.deepEqual(Object.keys(table).sort(), Q.DECISION_KEYS[npc + ":" + choice].slice().sort(), "每個決定各一項");
    const sig = new Set();
    for (const key of Object.keys(table)) {
      const p = table[key];
      assert.match(p.text, /^每天第一/, "寫成每天第一次……");
      assert.match(p.text, /\d|三成/, "寫出數字：" + p.text);
      assert.doesNotMatch(p.text, NO_LATIN);
      sig.add(p.on + JSON.stringify(p.reward)); all.add(p.text);
    }
    assert.equal(sig.size, Object.keys(table).length, npc + "/" + choice + " 兩邊每天的效果不一樣");
  }
  assert.equal(all.size, 13, "十三個決定的每日效果各寫各的");
});

test("第 1 項：做了決定當天就生效——事件真的入帳、一天一次、隔天又生效；沒選的那一邊不會發生", () => {
  for (const [npc, choice] of ROUTES) {
    const keys = Q.DECISION_KEYS[npc + ":" + choice], gains = [];
    for (const key of keys) {
      const s = fresh(5); choose(s, npc, choice, T0); decide(s, npc, choice, key, T0 + 10); Q.takeNotes();
      const perk = Q.DECISION_DAILY[npc + ":" + choice][key];
      const info0 = Q.perkInfo(s, npc, T0 + 100);
      assert.equal(info0.used, false, "還沒觸發");
      const first = trigger(s, perk.on, T0 + 1000);
      const base = first.at, info = Q.perkInfo(s, npc, base + 1);
      assert.equal(info.used, true, npc + "/" + key + " 觸發後今天已生效");
      assert.ok(info.got && !NO_LATIN.test(info.got), "記下拿到什麼：" + info.got);
      assert.ok(Q.takeNotes().some((n) => n.includes("今天生效了")), "跳提示告訴玩家");
      const r = perk.reward;
      if (r.coins) assert.ok(first.after.coins - first.before.coins >= r.coins, key + " 金幣多拿 " + r.coins);
      if (r.sunlight) assert.ok(first.after.sun > first.before.sun, key + " 陽光進帳");
      if (r.materials && r.materials.wood) assert.equal(first.after.wood - first.before.wood, r.materials.wood, key + " 木料進帳");
      if (r.materials && r.materials.compost) assert.equal(first.after.compost - first.before.compost, r.materials.compost, key + " 堆肥進帳");
      if (r.seasonalSeed || r.seedPacks) assert.notEqual(first.after.packs, first.before.packs, key + " 種子包進帳");
      if (r.sameCrop) assert.ok(s.storage.items.wheat >= 2 + r.sameCrop, key + " 多收一份");
      if (r.sameDried) assert.equal(s.storage.items.sun_wheat, 1 + r.sameDried, key + " 多收一份乾貨");
      if (r.growCut) { const p = G.getCropProgress(s, s.plots[1], T0 + 1000 + Math.ceil(G.plotGrowMs(s, s.plots[1], T0) * 0.71)); assert.equal(p.ready, true, key + " 少等三成就熟"); }
      /* 同一天第二次不再入帳 */
      const again = Q.firePerks(s, perk.on, { cropId: "wheat", plotIndex: 1, itemId: "sun_wheat" }, base + 5);
      assert.deepEqual(again, [], key + " 一天只生效一次");
      const next = Q.firePerks(s, perk.on, { cropId: "wheat", plotIndex: 1, itemId: "sun_wheat" }, base + DAY + 5);
      if (!r.growCut) assert.equal(next.length, 1, key + " 隔天又生效");
      /* 沒選的那一邊：同樣的事件不會給那一邊的東西 */
      const other = keys.find((k) => k !== key), otherPerk = Q.DECISION_DAILY[npc + ":" + choice][other];
      if (otherPerk.on !== perk.on) assert.deepEqual(Q.firePerks(s, otherPerk.on, { cropId: "wheat", plotIndex: 1, itemId: "sun_wheat" }, base + 2 * DAY).filter((f) => f.npcId === npc && f.key === other), [], "沒選的那一邊不會發生");
      gains.push(JSON.stringify([perk.on, perk.reward]));
    }
    assert.equal(new Set(gains).size, keys.length, npc + "/" + choice + " 兩邊每天實際拿到的不一樣");
  }
});

test("第 1 項：手札列出兩個決定每天的差別（招牌是三種顏色），標出我選的那一邊與今天生效了沒", () => {
  for (const [npc, choice] of ROUTES) {
    const keys = Q.DECISION_KEYS[npc + ":" + choice];
    const s = fresh(5); choose(s, npc, choice, T0);
    const before = Q.cardHtml(s, npc, T0 + 1);
    const box = (html) => (html.match(/<div class="r80c-daily-diff"[\s\S]*?<\/ul><\/div>/) || [""])[0];
    assert.ok(box(before), npc + "/" + choice + " 還沒選就看得到對照");
    for (const key of keys) assert.match(box(before), new RegExp('data-r80c-option="' + key + '"'));
    assert.match(box(before), keys.length > 2 ? /三種顏色每天的差別/ : /兩個決定每天的差別/);
    assert.doesNotMatch(box(before), /is-chosen/);
    decide(s, npc, choice, keys[1], T0 + 10);
    const after = box(Q.cardHtml(s, npc, T0 + 20));
    assert.match(after, new RegExp('class="r80c-diff-row is-chosen" data-r80c-option="' + keys[1] + '"'), "標出我選的那一邊");
    assert.match(after, /你選的・今天.*時就會生效/);
    const fired = trigger(s, Q.DECISION_DAILY[npc + ":" + choice][keys[1]].on, T0 + 1000);
    assert.match(box(Q.cardHtml(s, npc, fired.at + 100)), /你選的・今天已生效：/);
    for (const row of Q.perkRows(s, npc, fired.at + 100)) assert.match(row.text, /每天第一/);
  }
});

test("第 1 項：十三項具名解鎖的金幣不低於同樣東西交一般訂單的平均，另外都有一項一般訂單沒有的玩法差異", () => {
  const table = [];
  for (const [npc, choice] of ROUTES) {
    const def = Q.questDef(npc, choice);
    for (const key of Object.keys(def.special.variants)) {
      const v = def.special.variants[key];
      assert.ok(v.coinsRate >= 1, v.name + " 金幣倍率至少跟一般訂單一樣");
      const nonCoin = Object.keys(v.reward || {}).some((k) => k !== "coins");
      const flexible = ["most", "deal", "meal"].includes(v.want.type);
      assert.ok(nonCoin || flexible, v.name + " 要有不同作物、時限或獨特物品其中一項");
      assert.ok(v.diff && !NO_LATIN.test(v.diff), v.name + " 寫出玩法差異");
      assert.doesNotMatch(v.line, /市價|零賣/, v.name + " 字條講的基準跟計算一致（一般訂單）");
      for (const level of [1, 3, 5, 8]) {
        const s = fresh(level); choose(s, npc, choice, T0); decide(s, npc, choice, key, T0 + 10); finish(s, npc, choice, T0 + 20);
        let itemId = "";
        if (v.want.type === "meal") { s.adventure.meals.rustic_bread = 0; s.adventure.meals.wheat_carrot_pancake = 2; }
        else if (v.want.type === "seasonal") { itemId = K.seasonalCropId(s); s.storage.items[itemId] = v.want.qty; }
        else if (v.want.type === "deal") { itemId = K.merchantDeals(s, T0 + 30)[0].cropId; s.storage.items[itemId] = v.want.qty; }
        else { itemId = level >= 3 ? "tomato" : "wheat"; s.storage.items[itemId] = v.want.qty + 5; }
        const info = Q.specialInfo(s, npc, T0 + 30);
        assert.equal(info.eligible && info.enough, true, v.name + " Lv " + level + " " + JSON.stringify(info));
        const general = v.want.type === "meal" ? generalAverage("wheat", 2) + generalAverage("carrot", 1) : generalAverage(itemId, v.want.qty);
        const flat = (v.reward && v.reward.coins) || 0;
        assert.ok(info.coins - flat >= general - 1e-9, v.name + " Lv " + level + " 金幣 " + info.coins + "（不含另付 " + flat + "）要不低於一般訂單平均 " + general.toFixed(2));
        const coins0 = s.coins, done = Q.takeSpecial(s, npc, T0 + 31);
        assert.equal(done.ok, true, JSON.stringify(done));
        assert.equal(s.coins - coins0, info.coins, v.name + " 實際入帳就是寫出來的金幣");
        if (level === 1 || level === 5) table.push([v.name, "Lv " + level, info.wantText.replace(/（.*）/, ""), Math.round(general * 100) / 100, info.coins, done.rewardText]);
      }
    }
  }
  console.log("具名解鎖與一般訂單對照（金幣平均＝同樣東西交市集一般訂單的期望值）");
  for (const row of table) console.log("  " + row.join("｜"));
});

test("第 1、3 項：做了決定就能接第一張（R84B 同步：份數跟之後每天那張一樣，留種合作單 3 份）；交過以後要做完第三步才每天一張；文案改成以一般訂單為基準", () => {
  const s = fresh(1); choose(s, "mayor", "farm", T0);
  assert.equal(Q.specialInfo(s, "mayor", T0 + 1).eligible, false, "還沒決定不能接");
  decide(s, "mayor", "farm", "seed", T0 + 2);
  const info = Q.specialInfo(s, "mayor", T0 + 5);
  assert.equal(info.eligible, true); assert.equal(info.trial, true); assert.deepEqual(Q.TRIAL_WANT, { type: "most", qty: 2 }); assert.equal(info.need, 3, "R84B 同步：第一張跟每天那張同一個份數（原為 TRIAL_WANT 的 2 份）");
  assert.equal(info.enough, false);
  s.storage.items.wheat = 3; /* R84B 同步：第一張要 3 份（原為 2） */
  const r = Q.takeSpecial(s, "mayor", T0 + 6);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.trial, true); assert.match(r.message, /第一張「留種合作單」/);
  assert.match(r.rewardText, /胡蘿蔔種子 1 包（還買不到，拿到就能種）/, "留種合作單送一包還沒解鎖的作物種子"); /* R84B 同步：原為「Lv 2 才解鎖，現在就能種」（前後矛盾，圖 87、111） */
  assert.equal(s.adventure.r58.r59.seedPacks.carrot, 1);
  assert.equal(G.plant(s, 2, "carrot", T0 + 7).ok, true, "一級就能用那包種子種胡蘿蔔");
  const after = Q.specialInfo(s, "mayor", T0 + 8);
  assert.equal(after.eligible, false); assert.equal(after.trialUsed, true);
  assert.match(Q.takeSpecial(s, "mayor", T0 + 9).message, /做完第三步以後每天都能接一張/);
  assert.match(Q.cardHtml(s, "mayor", T0 + 9), /data-r80c-trial="mayor">第一張「留種合作單」交過了/);
  const src = read("src/choices-r77.js");
  assert.doesNotMatch(src.slice(src.indexOf("const RATE_TEXT"), src.indexOf("const TRIAL_WANT")), /市價/, "倍率說明改用一般訂單");
});

test("第 2 項：十三張決定物件圖的檔名照計畫接好；圖沒到不載入，兩邊疊不同的現成小圖示（遮住名牌也分得出）", () => {
  let n = 0;
  for (const [npc, choice] of ROUTES) {
    const route = npc + ":" + choice, keys = Q.DECISION_KEYS[route];
    const badges = new Set(), arts = new Set();
    for (const key of keys) {
      const file = Q.DECISION_ART[route + ":" + key];
      assert.equal(file, "assets/generated/content-r80/decision-" + npc + "-" + choice + "-" + key.replace(/_/g, "-") + ".png");
      assert.equal(Q.DECISION_ART_READY.includes(route + ":" + key), fs.existsSync(path.join(ROOT, file)), route + ":" + key + " 清單要跟檔案在不在一致");
      n++;
      if (Q.questDef(npc, choice).colorStep) continue;
      const s = fresh(5); choose(s, npc, choice, T0); decide(s, npc, choice, key, T0 + 10);
      const row = Q.sceneStates(s).find((x) => x.npcId === npc);
      assert.ok(fs.existsSync(path.join(ROOT, row.marker.art)), "地圖上用的圖一定存在：" + row.marker.art);
      if (Q.DECISION_ART_READY.includes(route + ":" + key)) assert.equal(row.marker.art, file);
      else { assert.ok(row.badge && fs.existsSync(path.join(ROOT, row.badge)), route + ":" + key + " 疊一個現成小圖示：" + row.badge); badges.add(row.badge); }
      arts.add(row.marker.art + "|" + (row.badge || ""));
    }
    if (!Q.questDef(npc, choice).colorStep) assert.equal(arts.size, keys.length, route + " 兩個決定在地圖上的樣子不同");
  }
  assert.equal(n, 13);
  const css = read("src/content-r58b.css");
  assert.match(css, /\.r78c-scene-change img\.r80c-decision-badge \{/);
  assert.match(css, /\[data-r80c-badge="sun"\] img\.r80c-decision-badge/);
  const src = read("src/choices-r77.js");
  assert.match(src, /class="r80c-decision-badge" data-r80c-badge="/);
  assert.match(src, /decisionArt\("merchant:sign", color\)/, "招牌三色的圖到了也接得上");
});

test("第 3 項：新存檔十分鐘內走完「鎮長選擇 → 地圖物件改變 → 第一張受這個選擇影響的具名訂單」（只用遊戲本身的動作與時間）", () => {
  for (const choice of ["farm", "town"]) {
    const decisions = Q.DECISION_KEYS["mayor:" + choice];
    const looks = [];
    for (const key of decisions) {
      const s = State.defaultState(T0); A.ensure(s, T0); M.ensure(s, T0); K.ensure(s, T0);
      let t = T0;
      const log = [];
      /* 0:20 走到鎮長旁邊交談，回答開場問題 */
      t += 20000; A.record(s, { type: "talk", npcId: "mayor" }, t);
      const r = A.resolveMainStoryChoice(s, "mayor", choice, t);
      assert.equal(r.ok, true, JSON.stringify(r)); log.push(["鎮長選擇", t - T0]);
      const early = Q.sceneStates(s).find((row) => row.npcId === "mayor");
      assert.ok(early && !early.decided, "回答完地圖上立刻多一個物件");
      /* 0:40 走到物件旁看現場、做決定 */
      t += 20000; assert.equal(Q.act(s, "mayor", t).ok, true);
      t += 8000; const d = Q.act(s, "mayor", t, key); assert.equal(d.ok, true, JSON.stringify(d));
      const changed = Q.sceneStates(s).find((row) => row.npcId === "mayor");
      assert.equal(changed.decided, true); assert.notEqual(changed.label, early.label, "地圖物件換成決定後的樣子");
      log.push(["地圖物件改變", t - T0]); looks.push(changed.label + "|" + changed.marker.art + "|" + (changed.badge || ""));
      /* 種兩格小麥（第一株是教學小麥，10 秒熟；第二株 15 秒），收成 */
      const sp = Q.specialInfo(s, "mayor", t);
      assert.equal(sp.eligible && sp.trial, true, "做了決定就能接第一張具名訂單");
      t += 10000; assert.equal(G.plant(s, 0, "wheat", t).ok, true); assert.equal(G.plant(s, 1, "wheat", t + 2000).ok, true);
      t += 20000; assert.equal(G.harvest(s, 0, t).ok, true); assert.equal(G.harvest(s, 1, t).ok, true);
      assert.ok((s.storage.items.wheat || 0) >= 2, "倉庫有兩份小麥：" + JSON.stringify(s.storage.items));
      /* 走回物件旁交第一張 */
      t += 20000; const coins0 = s.coins, done = Q.takeSpecial(s, "mayor", t);
      assert.equal(done.ok, true, JSON.stringify(done)); assert.equal(done.trial, true);
      assert.ok(s.coins > coins0, "第一張真的入帳");
      log.push(["第一張具名訂單「" + done.name + "」", t - T0]);
      assert.ok(t - T0 <= 10 * MIN, choice + "/" + key + " 要在十分鐘內走完：" + JSON.stringify(log));
      console.log("  " + choice + "/" + key + "：" + log.map(([name, ms]) => name + " " + Math.round(ms / 1000) + " 秒").join(" → "));
    }
    assert.equal(new Set(looks).size, decisions.length, choice + " 兩個決定在地圖上的樣子不同");
  }
});

test("第 4 項：手札分頁標題跟著內容（追光手冊、鄰居互動、鄰居好感、我做過的選擇、後續委託），故事頁籤改叫「手札」", () => {
  const world = read("src/world-ui.js");
  assert.match(world, /const JOURNAL_PAGES = \[\["\[data-r76c-sunbook\]", "追光手冊"\], \["\[data-r66b-panel\]", "鄰居互動"\], \["\[data-r61b-neighbors\]", "鄰居好感"\], \["\[data-r75b-choices\]", "我做過的選擇"\]\];/);
  assert.match(world, /\? "後續委託" : hit\.label/);
  assert.match(world, /text = "手札・" \+ page/);
  assert.match(world, /story: \["手札", "切換到手札分頁"\]/);
  assert.match(world, /bindPaneTitles\(\); syncPaneTitles\(\);/);
  const html = read("index.html");
  assert.match(html, /<div class="pane-head">陽光農場手札<\/div>/, "故事分頁標題仍是陽光農場手札（頁籤改成手札，兩邊同一個名字）");
});

test("第 5 項：對話只剩下方那一種——好感故事改用下方對話框、按鈕「下一句／晚點再說」；第三人稱旁白不掛鄰居頭像", () => {
  const nb = read("src/neighbors-r61.js"), story = read("src/story-r76.js"), world = read("src/world-ui.js");
  assert.match(nb, /S\.openDialogue\(state, npcId, story\.lines\.slice\(\), \{/, "好感故事走 StoryR76.openDialogue");
  assert.match(nb, /dataset: \{ r61bStory: `\$\{npcId\}-\$\{index\}` \}/);
  assert.match(nb, /data-r61b-close>晚點再說<\/button>/, "退回舊面板時也是晚點再說");
  assert.doesNotMatch(nb, /先聊到這裡/);
  assert.match(story, /data-r76b-next>' \+ \(step >= lines\.length - 1 \? "聽完了" : "下一句"\) \+ '<\/button><button type="button" data-r76b-later>晚點再說/);
  assert.match(story, /function isNarration\(line\) \{ return \/\^（\[\\s\\S\]\*）\$\/\.test/);
  assert.match(story, /<div class="r76b-dialogue-head r80c-narration-head"><b>旁白<\/b><\/div>/);
  assert.match(world, /class="dialogue-close" aria-label="晚點再說" title="晚點再說">晚點再說<\/button>/);
  assert.match(world, /class="dialogue-continue">聽完了<\/button>/);
  /* 六條委託：鄰居講的話不再用第三人稱寫自己；第三人稱的動作描寫一律寫成旁白（全形括號）。 */
  const names = /^(鎮長|老農班伯|班伯|蘿拉|他|她|第一張|一張留言)/;
  for (const [npc, choice] of ROUTES) {
    const def = Q.questDef(npc, choice);
    const lines = def.intro.concat(...def.steps.map((s) => (s.lines || []).concat(s.ask ? [s.ask] : [], s.thanks ? [s.thanks] : [])));
    for (const line of lines) {
      const narr = /^（[\s\S]*）$/.test(line);
      if (names.test(line)) assert.ok(narr, npc + "/" + choice + " 第三人稱的句子要寫成旁白：" + line);
      if (!narr) assert.doesNotMatch(line, /^「|」$/, npc + "/" + choice + " 鄰居自己說的話不用再包引號：" + line);
    }
  }
  assert.match(Q.questDef("mayor", "town").intro[0], /^（鎮長葛瑞當場攤開兩張空白公告。）$/, "圖 61 那一句改成旁白");
});

test("第 6 項：升級卡不再重複「獲得：農場等級提升」、天氣與四季有圖示；升級面板只有一層收合；種子卡、名牌與種子袋", () => {
  const ui = read("src/ui.js"), css = read("src/content-r58b.css"), src = read("src/choices-r77.js");
  assert.match(ui, /data\.type === "level_up" \|\| \/\^農場等級提升\/\.test\(String\(data\.earned \|\| ""\)\) \? ""/);
  for (const level of [5, 6]) {
    const card = G.milestoneCard("level_up", { level });
    for (const row of card.unlocks) assert.ok(row.icon || row.mark, "Lv " + level + " 的「" + row.name + "」要有圖示");
  }
  const weather = G.milestoneCard("level_up", { level: 5 }).unlocks.find((row) => row.id === "weather");
  // R80 整合：專屬圖示到了就用圖（content-r79/unlock-weather.png），沒有圖才用資源列同一個天氣符號頂替。
  if (fs.existsSync(path.join(ROOT, "assets/generated/content-r79/unlock-weather.png"))) assert.equal(weather.icon, "assets/generated/content-r79/unlock-weather.png", "天氣變化用專屬圖示");
  else assert.equal(weather.mark, C.WEATHER.rain.icon, "天氣變化先用資源列同一個天氣符號");
  assert.doesNotMatch(ui, /r55-future-upgrades|之後的目標（/, "升級面板不再另折一層「之後的目標」");
  assert.match(ui, /laterCards\.forEach\(\(el\) => box\.appendChild\(el\)\);/);
  const block = (css.match(/R80C（選擇的後果玩得到[\s\S]*R80C 結束/) || [""])[0];
  assert.ok(block, "R80C 區段完整");
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  assert.match(block, /@media \(min-width: 860px\) and \(min-height: 501px\) \{\s*#mapScene \.seed-quickbar \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(block, /\.seed:not\(\.more\) \.sn \{ max-width: none; overflow: visible; text-overflow: clip; white-space: nowrap; \}/);
  assert.match(block, /\.r75b-map-node span \{ position: absolute;[^}]*white-space: nowrap;/);
  assert.match(src, /function avoidLabels\(\)/); assert.match(src, /#markerLayer \.npc-nameplate, \.npc-footname/);
  assert.match(src, /function fixMapNodes\(state, tileSize\)/);
  assert.match(read("src/story-r76.js"), /root\.dispatchEvent\(new Event\("farm-dialogue-open"\)\)/, "下方對話框一打開就通知收任務卡");
  assert.match(ui, /window\.addEventListener\("farm-dialogue-open", \(\) => \{ try \{ r78bSyncFocus\(\); \}/); assert.match(src, /\.r75b-map-node\[data-r75b-seed-bag\]/);
});

test("原始碼：註解不放在程式後面、玩家看到的新字不夾英文、版本字串沒動", () => {
  const src = read("src/choices-r77.js");
  assert.doesNotMatch(src, /[;,)}\]]\s*\/\/.*[一-鿿]/, "中文註解不用 // 放在程式後面");
  for (const route of Object.keys(Q.DECISION_DAILY)) for (const key of Object.keys(Q.DECISION_DAILY[route])) assert.doesNotMatch(Q.DECISION_DAILY[route][key].text, NO_LATIN);
  assert.match(read("sw.js"), /CACHE_VERSION = "content-r83-20261117-1"/);
});

console.log("VERIFIED content R80C world (" + passed + " tests)");
