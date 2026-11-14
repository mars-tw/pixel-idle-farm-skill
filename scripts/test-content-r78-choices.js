"use strict";
/* R78C：開場立即改變、六條角色事件與決定、每日互動、第四章雙路線、評比與追光手冊。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const A = require("../src/adventure.js");
const State = require("../src/state.js");
const M = require("../src/midgame-r66.js");
const K = require("../src/cooking-r75.js");
const Q = require("../src/choices-r77.js");
const Sun = require("../src/sunplay-r75.js");
const Book = require("../src/sunbook-r76.js");
Q.install();

const T0 = 1794172800000, DAY = 86400000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (error) { console.error("FAIL " + name + "\n" + error.stack); process.exitCode = 1; } }
function fresh(level) { const s = State.defaultState(T0); s.level = level || 1; s.coins = 100; A.ensure(s, T0); M.ensure(s, T0); return s; }
function choose(s, npcId, choiceId, at) {
  if (npcId === "elder") s.adventure.claimed.c1_first_harvest = true;
  if (npcId === "merchant") s.adventure.claimed.c1_homecoming = true;
  A.ensure(s, at || T0);
  const result = A.resolveMainStoryChoice(s, npcId, choiceId, at || T0);
  assert.equal(result.ok, true, npcId + "/" + choiceId + " " + JSON.stringify(result));
  return result;
}
function chooseFirstDecision(s, npcId, at) {
  const scene = Q.act(s, npcId, at);
  assert.equal(scene.ok, true, JSON.stringify(scene));
  assert.ok(Array.isArray(scene.lines) && scene.lines.length >= 2, "角色現場要有至少兩句對白");
  let view = Q.questView(s, npcId, at + 1), step = Q.questDef(npcId, view.choiceId).steps[view.stepsDone];
  if (step.act === "wood") { s.materials.wood = 2; assert.equal(Q.act(s, npcId, at + 1).ok, true); view = Q.questView(s, npcId, at + 2); step = Q.questDef(npcId, view.choiceId).steps[view.stepsDone]; }
  assert.ok(step.act === "decision" || step.act === "color");
  if (step.act === "decision") { assert.ok(step.options.length >= 2); assert.notEqual(JSON.stringify(step.options[0].reward), JSON.stringify(step.options[1].reward), "兩個決定要給不同東西"); }
  const decided = Q.act(s, npcId, at + 2, step.act === "color" ? "red" : step.options[0].id);
  assert.equal(decided.ok, true, JSON.stringify(decided));
  return decided;
}
function finishRoute(s, npcId, at) {
  const view = Q.questView(s, npcId, at), step = Q.questDef(npcId, view.choiceId).steps[view.stepsDone];
  if (view.status === "done") return { ok: true, alreadyDone: true };
  if (step.act === "give_dried") s.storage.items.sun_wheat = 1;
  if (step.act === "meal") s.adventure.meals.rustic_bread = 1;
  if (step.act === "scene_close") return Q.act(s, npcId, at);
  if (step.act === "seed_meal") { s.adventure.r58.r59.seedPacks.wheat = 2; s.adventure.meals.rustic_bread = 1; }
  if (step.act === "wood") s.materials.wood = 2;
  if (step.act === "special_crop") { const d = K.merchantDeals(s, at)[0]; s.storage.items[d.cropId] = 1; }
  const result = Q.act(s, npcId, at, step.act === "color" ? "red" : undefined);
  assert.equal(result.ok, true, npcId + " " + JSON.stringify(result));
  return result;
}

test("六種回答在一級、同一分鐘內就建立不同事件狀態與地圖元素", () => {
  const routes = [["mayor", "farm"], ["mayor", "town"], ["elder", "sell"], ["elder", "seed"], ["merchant", "sign"], ["merchant", "listen"]];
  const labels = new Set(), intros = new Set();
  for (const [npc, choice] of routes) {
    const s = fresh(1), result = choose(s, npc, choice, T0 + 1000);
    assert.ok(result.r78cIntro && result.r78cIntro.length >= 2, npc + "/" + choice + " 要立刻接角色對白");
    assert.equal(s.level, 1, "不用升到二級");
    const q = s.adventure.r77.quests[npc];
    assert.equal(q.choiceId, choice); assert.equal(q.step, 0); assert.equal(q.introSeen, true);
    const scene = Q.sceneStates(s).find((row) => row.npcId === npc);
    assert.ok(scene && !scene.done && scene.marker.art, "地圖要有可辨識元素");
    labels.add(scene.label); intros.add(result.r78cIntro.join("|"));
  }
  assert.equal(labels.size, 6); assert.equal(intros.size, 6);
});

test("六條角色事件都有專屬對白、不同結果決定、手札紀錄與完成場景", () => {
  const routes = [["mayor", "farm"], ["mayor", "town"], ["elder", "sell"], ["elder", "seed"], ["merchant", "sign"], ["merchant", "listen"]];
  for (const [npc, choice] of routes) {
    const s = fresh(5); choose(s, npc, choice, T0); Q.takeNotes();
    const first = Q.act(s, npc, T0 + 1);
    assert.equal(first.ok, true); assert.ok(first.lines.length >= 2);
    let step = Q.questDef(npc, choice).steps[1];
    if (step.act === "decision") {
      assert.ok(step.options.length >= 2); assert.notDeepEqual(step.options[0].reward, step.options[1].reward);
      assert.equal(Q.act(s, npc, T0 + 2, step.options[0].id).ok, true);
    } else {
      s.materials.wood = 2; assert.equal(Q.act(s, npc, T0 + 2).ok, true);
    }
    finishRoute(s, npc, T0 + 3);
    const view = Q.questView(s, npc, T0 + 4);
    assert.equal(view.status, "done", npc + "/" + choice);
    assert.ok(view.decisionText && view.decisionReward, "手札要記選項與拿到的東西");
    const scene = Q.sceneStates(s).find((row) => row.npcId === npc);
    assert.ok(scene && scene.done && !/等待/.test(scene.label), "完成後地圖元素要換成結果狀態");
    const html = Q.cardHtml(s, npc, T0 + 4);
    assert.match(html, /data-r78c-decision-record/); assert.match(html, /永久改變（已含原本加成）/);
  }
});

test("至少三條完成路線有每天可親手使用一次的不同互動", () => {
  const routes = [["mayor", "farm"], ["elder", "sell"], ["elder", "seed"], ["merchant", "sign"]];
  const labels = new Set();
  for (const [npc, choice] of routes) {
    const s = fresh(5); choose(s, npc, choice, T0); chooseFirstDecision(s, npc, T0 + 1); finishRoute(s, npc, T0 + 3);
    const info = Q.dailyInfo(s, npc, T0 + 4); assert.equal(info.can, true); labels.add(info.label);
    const first = Q.takeDaily(s, npc, T0 + 4); assert.equal(first.ok, true); assert.ok(first.rewardText);
    assert.equal(Q.takeDaily(s, npc, T0 + 5).reason, "daily_limit");
    assert.equal(Q.dailyInfo(s, npc, T0 + DAY).can, true);
  }
  assert.ok(labels.size >= 3);
});

function unlockToChapterFour(s) {
  A.ensure(s, T0);
  for (const q of A.quests(s, T0)) { if (q.chapter < 4) { s.adventure.claimed[q.id] = true; s.adventure.quests[q.id].status = "claimed"; s.adventure.quests[q.id].rewardGranted = true; } }
  A.ensure(s, T0 + 1);
}
test("第四章每項兩套做法重疊不超過一項，報酬不同，實際交付決定路線並留下紀錄", () => {
  const full = fresh(8); unlockToChapterFour(full);
  Object.keys(full.storage.items).forEach((id) => { full.storage.items[id] = 99; });
  for (const id of Object.keys(require("../src/config.js").CROPS)) full.storage.items[id] = 99;
  Object.assign(full.storage.items, { sun_wheat: 99, sun_carrot: 99, sun_tomato: 99, sun_strawberry: 99 });
  Object.assign(full.materials, { wood: 99, stone: 99 });
  for (const q of A.recipes(full)) full.adventure.meals[q.id] = 9;
  full.adventure.r75b = { grades: { rustic_bread: { home: 0, tasty: 2, perfect: 0 } } };
  full.sunbook = { stamps: { wheat: { lit: 1, trait: 1, dried: 1, perfect: 1 }, carrot: { lit: 1, trait: 1 } }, claimed: {} };
  const chapter = A.quests(full, T0 + 2).filter((q) => q.chapter === 4);
  assert.equal(chapter.length, 3);
  for (const q of chapter) {
    const left = new Set(q.requirements.map((r) => r.source + ":" + r.id));
    const overlap = q.altRequirements.filter((r) => left.has(r.source + ":" + r.id));
    assert.ok(overlap.length <= 1, q.id + " 重疊 " + overlap.length + " 項");
    assert.notDeepEqual(q.routeRewards.primary, q.routeRewards.alt);
    assert.ok(q.routeNames.primary && q.routeNames.alt);
  }
  const primary = fresh(8); unlockToChapterFour(primary); Object.assign(primary.storage.items, { tomato: 3, strawberry: 2 }); primary.materials.wood = 2;
  const p = A.claim(primary, "c4_market_expansion", T0 + 3); assert.equal(p.ok, true); assert.equal(p.claimRoute, "primary");
  const pView = A.quests(primary, T0 + 4).find((q) => q.id === "c4_market_expansion");
  assert.equal(pView.chosenRoute, "primary"); assert.ok(pView.routeReceipt.length === 3); assert.match(pView.routeConsequence, /鮮貨桌/);
  const alt = fresh(8); unlockToChapterFour(alt); Object.assign(alt.storage.items, { sun_wheat: 3 }); alt.materials.stone = 2;
  const a = A.claim(alt, "c4_market_expansion", T0 + 3); assert.equal(a.ok, true); assert.equal(a.claimRoute, "alt");
  assert.notDeepEqual(a.reward, p.reward); assert.equal(alt.adventure.r61.world.c4Routes.c4_market_expansion, "alt");
});

function festivalState() {
  const s = fresh(5), f = s.adventure.r61.festival;
  f.unlocked = true; f.startsAt = T0; f.endsAt = T0 + 600000; f.nextAt = 0; f.supportProvisioned = true;
  f.baseline = { wheat: 0, carrot: 0, tomato: 0, cook: 0, talks: { mayor: 0, elder: 0, merchant: 0, child: 0 } };
  return s;
}
test("評比三星要四項，優質與乾貨各有加獎，分項只算一次且提示點名缺項", () => {
  const two = festivalState(); Object.assign(two.storage.items, { wheat: 1, carrot: 1 }); two.adventure.meals.rustic_bread = 1;
  const r2 = A.judgeFestivalEntry(two, ["wheat", "carrot", "rustic_bread"], T0 + 1);
  assert.equal(r2.totalScore, 3); assert.equal(r2.stars, 2); assert.match(r2.tip, /三星要四項.*優質作物/);
  const quality = festivalState(); quality.storage.quality.wheat = 1; quality.storage.items.carrot = 1; quality.adventure.meals.rustic_bread = 1;
  const rq = A.judgeFestivalEntry(quality, ["quality:wheat", "carrot", "rustic_bread"], T0 + 1);
  assert.equal(rq.totalScore, 4); assert.equal(rq.stars, 3); assert.match(rq.rewardText, /優質作物加獎 8 金/);
  const credits = rq.details.flatMap((row) => row.sources).filter((text) => /\+1/.test(text));
  assert.equal(credits.length, rq.totalScore, "逐筆加分與總分一致");
  const dried = festivalState(); Object.assign(dried.storage.items, { sun_wheat: 1, carrot: 1 }); dried.adventure.meals.rustic_bread = 1;
  const rd = A.judgeFestivalEntry(dried, ["sun_wheat", "carrot", "rustic_bread"], T0 + 1);
  assert.equal(rd.stars, 3); assert.match(rd.rewardText, /日曬乾貨加獎 8 金/); assert.match(rd.tip, /優質作物/);
});

test("追光手冊第一份改為非金幣，舊存檔已領 120 金的收據保留且不能重領", () => {
  assert.equal(Book.MILESTONES[0].count, 3); assert.equal(Book.MILESTONES[0].coins, 0);
  const s = fresh(4); s.coins = 44; Book.normalize(s); s.sunbook.stamps.wheat = { lit: T0, trait: T0, perfect: T0 };
  const before = s.coins, result = Book.claim(s, 3, T0 + 1);
  assert.equal(result.ok, true); assert.equal(s.coins, before); assert.doesNotMatch(result.text, /金幣/); assert.match(result.text, /陽光 1 點.*蓄光瓶/);
  const old = fresh(4); old.sunbook = { stamps: { wheat: { lit: T0, trait: T0, perfect: T0 } }, claimed: { 3: { at: T0, coins: 120, sunlight: 1, jar: 1, mirror: 0, seeds: {} } }, bonus: { jar: 1, mirror: 0 }, hinted: true, folded: false };
  Book.normalize(old); assert.equal(old.sunbook.claimed[3].coins, 120); assert.equal(Book.claim(old, 3, T0 + 2).reason, "claimed");
});

test("來源與樣式：R78C 區段完整、第四章不再顯示一列式『兩種做法擇一』", () => {
  const css = fs.readFileSync("src/content-r58b.css", "utf8"), world = fs.readFileSync("src/world-ui.js", "utf8"), choices = fs.readFileSync("src/choices-r77.js", "utf8");
  assert.match(css, /R78C（選擇改變農場世界）開始[\s\S]*\.r78c-route-grid[\s\S]*R78C 結束/);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  assert.match(choices, /paintChapterRoutes/); assert.match(choices, /data-r78c-chosen/);
  assert.equal((world.match(/src\/choices-r77\.js/g) || []).length, 0, "world-ui 不硬編 C 線模組");
});

console.log("VERIFIED content R78C choices (" + passed + " tests)");
