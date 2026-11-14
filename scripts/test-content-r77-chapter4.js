"use strict";
/* R77C 第 13～14 項：章名不綁季節、第 4 章每個任務兩種交法、交付只扣備齊的那一條。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
const A = require("../src/adventure.js");
const S = require("../src/state.js");
const T0 = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function base() {
  const st = S.defaultState(T0); A.ensure(st, T0); st.level = 8;
  for (const q of A.quests(st, T0)) if (q.chapter < 4) st.adventure.claimed[q.id] = true;
  A.ensure(st, T0);
  return st;
}
function quest(st, id) { return A.quests(st, T0).find((q) => q.id === id); }
/* 主線要照順序交付：先把排在前面的第 4 章任務標成已完成，才輪得到後面的。 */
function unlockBefore(st, id) {
  const order = ["c4_market_expansion", "c4_tasting_stall", "c4_notice_bench"];
  for (const prev of order.slice(0, order.indexOf(id))) st.adventure.claimed[prev] = true;
  A.ensure(st, T0);
}

test("13 章名與文字不再綁秋天", () => {
  const st = base();
  const chapters = A.summary(st, T0).chapters;
  assert.equal(chapters[3].name, "熱鬧的市集日", "第四章章名不綁季節");
  for (const id of ["c4_market_expansion", "c4_tasting_stall", "c4_notice_bench"]) {
    const q = quest(st, id);
    assert.equal(q.chapterName, "熱鬧的市集日");
    assert.doesNotMatch(q.description + (q.opening || []).join(""), /秋天/, id + " 的說明與開場不要再提秋天");
  }
  const src = fs.readFileSync("src/adventure.js", "utf8");
  assert.doesNotMatch(src, /秋天的市集日/, "程式裡不要再留舊章名");
});

test("14a 把市集撐大一點：第一條路（番茄、草莓、木料）", () => {
  const st = base();
  Object.assign(st.storage.items, { tomato: 3, strawberry: 2, sun_wheat: 3 });
  st.materials.wood = 2; st.materials.stone = 2;
  const q = quest(st, "c4_market_expansion");
  assert.equal(q.hasAltRoute, true, "任務要帶第二條路");
  assert.ok(q.altRequirements.some((r) => r.source === "driedAny" && r.required === 3), "第二條路要用 3 份乾貨做耐放貨架");
  assert.equal(q.canClaim, true);
  const r = A.claim(st, "c4_market_expansion", T0);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.claimRoute, "primary", "兩條都齊時先用第一條");
  assert.equal(st.storage.items.strawberry || 0, 0, "草莓要被收走（原本 2 份交出去）");
  assert.equal(st.storage.items.sun_wheat, 3, "第一條路不要動到乾貨");
  assert.equal(st.materials.wood, 0);
  assert.equal(st.materials.stone, 2, "第一條路不要動到第二條的石材");
});

test("14b 把市集撐大一點：第二條路用乾貨與石材搭耐放貨架，只扣這一條", () => {
  const st = base();
  Object.assign(st.storage.items, { sun_tomato: 2, sun_wheat: 1 });
  st.materials.stone = 2;
  const q = quest(st, "c4_market_expansion");
  assert.equal(q.canClaim, true, "沒有草莓、靠乾貨也要能交付");
  assert.equal(q.claimRoute, "alt");
  const r = A.claim(st, "c4_market_expansion", T0);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.claimRoute, "alt");
  assert.equal((st.storage.items.sun_tomato || 0) + (st.storage.items.sun_wheat || 0), 0, "2 份乾貨要被收走");
  assert.equal(st.materials.stone, 0); assert.equal(st.materials.wood, 1, "耐放貨架退回木料 1 份");
});

test("14c 蘿拉的試吃攤：第二條路用任何一道好吃以上的料理代替指定料理", () => {
  const st = base(); unlockBefore(st, "c4_tasting_stall");
  Object.assign(st.storage.items, { sun_wheat: 2 });
  st.adventure.meals.rustic_bread = 1;
  if (!st.adventure.r75b) st.adventure.r75b = {};
  st.adventure.r75b.grades = { rustic_bread: { home: 0, tasty: 1, perfect: 0 } };
  const q = quest(st, "c4_tasting_stall");
  assert.equal(q.canClaim, true, "沒做草莓市集塔、靠好吃料理也要能交付：" + JSON.stringify(q.altRequirements));
  assert.equal(q.claimRoute, "alt");
  const r = A.claim(st, "c4_tasting_stall", T0);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(st.adventure.meals.rustic_bread, 0, "好吃料理要被收走一份");
  assert.equal(st.adventure.r75b.grades.rustic_bread.tasty, 0, "等級紀錄也要跟著扣");
  assert.equal(st.storage.items.sun_wheat || 0, 0, "日曬拼盤要收走 2 份乾貨");
  /* 家常等級不算：只有家常時第二條路不成立。 */
  const st2 = base(); unlockBefore(st2, "c4_tasting_stall");
  Object.assign(st2.storage.items, { sun_wheat: 2 });
  st2.adventure.meals.rustic_bread = 1;
  st2.adventure.r75b = { grades: { rustic_bread: { home: 1, tasty: 0, perfect: 0 } } };
  assert.equal(quest(st2, "c4_tasting_stall").canClaim, false, "家常料理不能代替");
});

test("14d 蘿拉的試吃攤：第一條路照舊（做草莓市集塔）", () => {
  const st = base(); unlockBefore(st, "c4_tasting_stall");
  Object.assign(st.storage.items, { carrot: 2 });
  st.adventure.meals.strawberry_market_tart = 1;
  st.adventure.byTarget.cook.strawberry_market_tart = 1;
  const r = A.claim(st, "c4_tasting_stall", T0);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.claimRoute, "primary");
  assert.equal(st.adventure.meals.strawberry_market_tart, 0);
});

test("14e 公告欄旁的長椅：第二條路用 6 枚印章與 2 份乾貨做坐墊，印章不消耗", () => {
  const st = base(); unlockBefore(st, "c4_notice_bench");
  st.storage.items.sun_wheat = 2;
  st.sunbook = { stamps: { wheat: { lit: 1, trait: 1, dried: 1, perfect: 1 }, carrot: { lit: 1, trait: 1 } }, claimed: {}, bonus: { jar: 0, mirror: 0 }, hinted: true, folded: true };
  assert.equal(A.sunbookStampCount(st), 6);
  const q = quest(st, "c4_notice_bench");
  assert.equal(q.canClaim, true, "沒有石材、靠印章也要能交付");
  assert.equal(q.claimRoute, "alt");
  const r = A.claim(st, "c4_notice_bench", T0);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(st.storage.items.sun_wheat || 0, 0, "乾貨做成防潮坐墊");
  assert.equal(st.materials.wood, 2, "追光坐墊路線退回木料 2 份");
  assert.equal(A.sunbookStampCount(st), 6, "印章只是證明，不可以被收走");
  /* 印章不夠時第二條路不成立。 */
  const st2 = base(); unlockBefore(st2, "c4_notice_bench");
  st2.storage.items.sun_wheat = 2;
  st2.sunbook = { stamps: { wheat: { lit: 1 } }, claimed: {}, bonus: { jar: 0, mirror: 0 }, hinted: true, folded: true };
  assert.equal(quest(st2, "c4_notice_bench").canClaim, false, "印章只有 1 枚又沒石材時不能交付");
});

test("14f 公告欄旁的長椅：第一條路照舊（木料、石材、燉鍋）", () => {
  const st = base(); unlockBefore(st, "c4_notice_bench");
  st.materials.wood = 4; st.materials.stone = 2;
  st.adventure.meals.tomato_harvest_stew = 1;
  const r = A.claim(st, "c4_notice_bench", T0);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.claimRoute, "primary");
  assert.equal(st.materials.stone, 0);
});

test("14g 任務卡看得到做法甲與做法乙兩欄及各自進度", () => {
  const choices = fs.readFileSync("src/choices-r77.js", "utf8");
  assert.match(choices, /paintChapterRoutes/, "任務卡要改成兩欄");
  assert.match(choices, /r78c-route-grid/, "任務卡要有做法甲與做法乙的欄位");
  assert.match(choices, /data-r78c-chosen/, "完成後要標出走了哪一條");
  const st = base();
  Object.assign(st.storage.items, { tomato: 1, sun_wheat: 1 });
  const q = quest(st, "c4_market_expansion");
  const dried = q.altRequirements.find((r) => r.source === "driedAny");
  assert.equal(dried.current, 1); assert.equal(dried.required, 3, "第二條路進度要分開算");
});

test("14h 好吃料理以餐籃現量為準：等級紀錄多出來的不算，交付後餐籃不會變負數", () => {
  /* 擺攤賣掉料理時只扣餐籃，等級紀錄可能暫時多出來。 */
  const st = base();
  st.adventure.meals.rustic_bread = 0;
  st.adventure.r75b = Object.assign(st.adventure.r75b || {}, { grades: { rustic_bread: { home: 0, tasty: 2, perfect: 1 } } });
  assert.equal(A.gradedMealCount(st), 0, "餐籃裡沒有這道料理時不能算有好吃料理");
  st.adventure.meals.rustic_bread = 1;
  assert.equal(A.gradedMealCount(st), 1, "餐籃只有 1 份時最多算 1 份");
  const st2 = base(); unlockBefore(st2, "c4_tasting_stall");
  Object.assign(st2.storage.items, { sun_wheat: 2 });
  st2.adventure.meals.rustic_bread = 1;
  st2.adventure.r75b = Object.assign(st2.adventure.r75b || {}, { grades: { rustic_bread: { home: 0, tasty: 0, perfect: 3 } } });
  const r = A.claim(st2, "c4_tasting_stall", T0);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(st2.adventure.meals.rustic_bread, 0, "只收走餐籃裡那 1 份");
  for (const [id, n] of Object.entries(st2.adventure.meals)) assert.ok(Number.isFinite(n) && n >= 0, id + " 的餐籃份數不可以是負數或壞值：" + n);
});

console.log("VERIFIED content R77C chapter4 (" + passed + " tests)");
