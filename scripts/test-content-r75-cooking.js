"use strict";
/* R75B 第 7 項：灶台看火候——三檔判定、成果對增益時間與好感的影響、跳過、鍵盤操作、庫存成果與舊存檔相容。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const K = require("../src/cooking-r75.js");
const T0 = 1794172800000;
const DAY = 24 * 60 * 60 * 1000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh() {
  const st = S.defaultState(T0);
  A.ensure(st, T0);
  st.adventure.claimed.c1_first_harvest = true;
  A.ensure(st, T0);
  st.storage.items.wheat = 40;
  st.storage.items.carrot = 20;
  return st;
}
/* 把火候穩穩留在金色區間：每秒檢查一次，太涼添柴、太熱掀蓋。 */
function playWell(session) {
  for (let i = 0; i < 120; i++) {
    const snap = session.snapshot();
    if (snap.heat < 48) session.addWood();
    else if (snap.heat > 62) session.vent();
    session.tick(100);
  }
  return session.snapshot();
}

test("1 三檔判定：七成以上絕品、四成以上好吃、其餘家常", () => {
  assert.equal(K.gradeForRatio(0.7), "perfect");
  assert.equal(K.gradeForRatio(0.85), "perfect");
  assert.equal(K.gradeForRatio(0.4), "tasty");
  assert.equal(K.gradeForRatio(0.69), "tasty");
  assert.equal(K.gradeForRatio(0.39), "home");
  assert.equal(K.gradeForRatio(0), "home");
  const idle = K.createFireSession();
  const idleSnap = idle.tick(K.DURATION_MS);
  assert.equal(idleSnap.finished, true);
  assert.equal(K.gradeForRatio(idleSnap.ratio), "home", "放著不管火會變小，只能家常: " + idleSnap.ratio);
  const well = playWell(K.createFireSession());
  assert.ok(well.ratio >= 0.7, "顧好火候要在金色區間七成以上: " + well.ratio);
  assert.equal(K.gradeForRatio(well.ratio), "perfect");
});

test("2 添柴加一段、掀蓋降一段，火會慢慢變小", () => {
  const s = K.createFireSession();
  const start = s.snapshot().heat;
  s.tick(1000);
  assert.ok(s.snapshot().heat < start, "過一秒火要變小");
  const before = s.snapshot().heat;
  s.addWood();
  assert.ok(s.snapshot().heat > before, "添柴要加熱");
  const hot = s.snapshot().heat;
  s.vent();
  assert.ok(s.snapshot().heat < hot, "掀蓋要降溫");
  assert.equal(K.GOLD_MIN < K.GOLD_MAX, true);
});

test("3 成果對增益時間的影響：好吃乘一點二五、絕品乘一點五", () => {
  assert.equal(K.scaledDurationMs(180000, "home"), 180000);
  assert.equal(K.scaledDurationMs(180000, "tasty"), 225000);
  assert.equal(K.scaledDurationMs(180000, "perfect"), 270000);
  for (const [grade, mult] of [["tasty", 1.25], ["perfect", 1.5]]) {
    const st = fresh();
    const cooked = K.cookWithGrade(st, "rustic_bread", grade, T0);
    assert.equal(cooked.ok, true, JSON.stringify(cooked));
    assert.equal(cooked.grade, grade);
    const eaten = K.eatMeal(st, "rustic_bread", T0);
    assert.equal(eaten.ok, true, JSON.stringify(eaten));
    assert.equal(eaten.grade, grade);
    assert.equal(eaten.until, T0 + Math.round(180000 * mult), grade + " 的增益時間要加長");
    assert.equal(st.adventure.r58.buffs.growth.until, eaten.until);
  }
  const home = fresh();
  K.cookDirect(home, "rustic_bread", T0);
  const eatenHome = K.eatMeal(home, "rustic_bread", T0);
  assert.equal(eatenHome.until, T0 + 180000, "家常維持原本時間");
});

test("4 分享時先用最好的，絕品讓好感多 1，沒有增益的料理只影響好感", () => {
  const st = fresh();
  st.adventure.projects.picnic_table = { restored: true, restoredAt: T0 };
  A.ensure(st, T0);
  K.cookWithGrade(st, "baked_carrot", "home", T0);
  K.cookWithGrade(st, "baked_carrot", "perfect", T0);
  const favorBefore = (st.adventure.r58.favor.elder || 0);
  const shared = K.shareBestMeal(st, "baked_carrot", "elder", T0);
  assert.equal(shared.ok, true);
  assert.equal(shared.grade, "perfect", "分享要先用最好的");
  assert.equal(shared.favorBonus, 1);
  assert.equal(st.adventure.r58.favor.elder, favorBefore + 1, "絕品分享好感多 1");
  const left = K.mealGrades(st, "baked_carrot");
  assert.equal(left.perfect, 0);
  assert.equal(left.home, 1);
  const sharedHome = K.shareBestMeal(st, "baked_carrot", "elder", T0);
  assert.equal(sharedHome.grade, "home");
  assert.equal(sharedHome.favorBonus, 0, "家常分享不加好感");
  /* 鄰居餐籃（既有流程扣麥餅）: 絕品麥餅一樣多 1 好感 */
  const st2 = fresh();
  K.cookWithGrade(st2, "rustic_bread", "perfect", T0);
  st2.adventure.meals.rustic_bread -= 0;
  const fav2 = st2.adventure.r58.favor.merchant || 0;
  st2.adventure.meals.rustic_bread = 0;
  const note = K.noteSharedMeal(st2, "rustic_bread", "merchant");
  assert.equal(note.grade, "perfect");
  assert.equal(note.favorBonus, 1);
  assert.equal(st2.adventure.r58.favor.merchant, fav2 + 1);
});

test("5 跳過小遊戲直接做就是家常，舊呼叫 A.cook 行為維持家常", () => {
  const st = fresh();
  const direct = K.cookDirect(st, "rustic_bread", T0);
  assert.equal(direct.ok, true);
  assert.equal(direct.grade, "home");
  assert.equal(K.mealGrades(st, "rustic_bread").home, 1);
  const st2 = fresh();
  const legacy = A.cook(st2, "rustic_bread", T0);
  assert.equal(legacy.ok, true, "舊測試直接呼叫 A.cook 必須維持可用");
  const grades = K.mealGrades(st2, "rustic_bread");
  assert.equal(grades.total, 1);
  assert.equal(grades.home, 1, "舊呼叫做出的料理等同家常");
  assert.equal(grades.bestEver, "home");
});

test("6 庫存記得每份成果、最高成果徽章、吃的時候先用最好的", () => {
  const st = fresh();
  K.cookWithGrade(st, "rustic_bread", "home", T0);
  K.cookWithGrade(st, "rustic_bread", "tasty", T0);
  K.cookWithGrade(st, "rustic_bread", "perfect", T0);
  let info = K.mealGrades(st, "rustic_bread");
  assert.deepEqual([info.home, info.tasty, info.perfect], [1, 1, 1]);
  assert.equal(info.bestEver, "perfect");
  assert.equal(info.bestEverLabel, "絕品");
  const eaten = K.eatMeal(st, "rustic_bread", T0);
  assert.equal(eaten.grade, "perfect", "吃的時候先用最好的");
  info = K.mealGrades(st, "rustic_bread");
  assert.equal(info.perfect, 0);
  assert.equal(info.bestEver, "perfect", "吃掉後最高成果徽章還在");
});

test("7 舊存檔已有的料理一律當作家常", () => {
  const st = S.defaultState(T0);
  A.ensure(st, T0);
  st.adventure.meals.rustic_bread = 3;
  const info = K.mealGrades(st, "rustic_bread");
  assert.deepEqual([info.home, info.tasty, info.perfect], [3, 0, 0]);
  assert.equal(info.bestEver, "home");
  const reloaded = S.migrate(JSON.parse(JSON.stringify(st)));
  const again = K.mealGrades(reloaded, "rustic_bread");
  assert.equal(again.home, 3, "重讀存檔後家常數量不變");
});

test("8 鍵盤操作（空白鍵添柴、Enter 掀蓋）與減少動態有寫進畫面接線", () => {
  const src = fs.readFileSync("src/cooking-r75.js", "utf8");
  assert.match(src, /Space/, "要有空白鍵添柴");
  assert.match(src, /Enter/, "要有 Enter 掀蓋");
  assert.match(src, /prefers-reduced-motion/, "要尊重減少動態設定");
  assert.match(src, /data-r75b-start/, "灶台要有開始煮按鈕");
  assert.match(src, /直接做（家常）/, "要保留直接做家常");
  const session = K.createFireSession({ reducedMotion: true });
  assert.equal(session.snapshot().reducedMotion, true);
});

test("9 看完一局火候再入庫，成果跟判定一致", () => {
  const st = fresh();
  const session = K.createFireSession();
  playWell(session);
  const done = K.finishFireSession(st, "rustic_bread", session, T0);
  assert.equal(done.ok, true);
  assert.equal(done.grade, "perfect");
  assert.equal(K.mealGrades(st, "rustic_bread").perfect, 1);
  const st2 = fresh();
  const idle = K.createFireSession();
  idle.tick(K.DURATION_MS);
  const done2 = K.finishFireSession(st2, "rustic_bread", idle, T0);
  assert.equal(done2.grade, "home");
});

console.log("VERIFIED content R75B cooking (" + passed + " tests)");
