"use strict";
/* R77C／R78C：分母一致、第一屏先看印章格，差幾枚領什麼全頁只寫一次。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const State = require("../src/state.js");
const Adventure = require("../src/adventure.js");
const Cooking = require("../src/cooking-r75.js");
const Book = require("../src/sunbook-r76.js");
const T = 1794172800000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh(level) {
  const s = State.defaultState(T);
  s.coins = 9999; s.level = level || 1; s.xp = require("../src/config.js").xpForLevel(level || 1); s.upgrades.plotCount = 1;
  return s;
}

test("分母一致：里程碑上限 15 就是畫面上的分母，已解鎖格數不再混進標題", () => {
  assert.equal(Book.LAST_COUNT, 15);
  assert.deepEqual(Book.MILESTONES.map((m) => m.count), [3, 6, 10, 15]);
  const src = fs.readFileSync("src/sunbook-r76.js", "utf8");
  assert.match(src, /data-r78c-first-stamps/, "手冊第一屏要先有各作物印章格");
  assert.match(src, /再蓋 " \+ sum\.next\.remaining \+ " 枚可領：/, "進度區只寫一次再幾枚領什麼");
  assert.doesNotMatch(src, /data-r77c-sunbook-top/, "不再把同一句差額提示重複放到內文頂端");
  assert.doesNotMatch(src, /已蓋 ' \+ sum\.got \+ "／" \+ sum\.total/, "標題不要再用已解鎖格數當分母");
  const s = fresh(1);
  const sum = Book.summary(s);
  assert.equal(sum.got, 0);
  assert.deepEqual(sum.next, { count: 3, remaining: 3 }, "下一份是集滿 3 枚、還差 3 枚");
  assert.match(sum.milestones[0].rewardText, /陽光 1 點.*蓄光瓶/, "第一份改為追光玩法獎勵");
  assert.doesNotMatch(sum.milestones[0].rewardText, /金幣/, "第一份不再壓過二級經濟");
});

test("差幾枚與獎勵正確：蓋到第 1 枚後，還差 2 枚領第一份", () => {
  const s = fresh(1);
  Adventure.ensure(s, T); s.adventure.claimed.c1_first_harvest = true; Adventure.ensure(s, T);
  assert.equal(typeof Cooking.onPerfect, "function");
  Cooking.onPerfect(s, "rustic_bread");
  const events = Book.takeEvents(s);
  assert.equal(events.length, 1);
  const e = events[0];
  assert.equal(e.displayTotal, 15, "小卡分母要是 15");
  assert.equal(e.displayGot, 1);
  assert.match(e.text, /（1／15）/, "小卡文字分母要是 15：" + e.text);
  assert.equal(e.nextRemaining, 2, "還差 2 枚");
  assert.equal(e.nextCount, 3);
  assert.match(e.nextRewardText, /陽光 1 點.*蓄光瓶/, "要寫下一份領什麼：" + e.nextRewardText);
  const sum = Book.summary(s);
  assert.deepEqual(sum.next, { count: 3, remaining: 2 });
});

test("集滿可領時第一行改寫可以領了，領完改指下一份", () => {
  const s = fresh(4);
  Adventure.ensure(s, T); s.adventure.claimed.c1_first_harvest = true; Adventure.ensure(s, T);
  Book.normalize(s);
  s.sunbook.stamps.wheat = { lit: T, trait: T, perfect: T };
  let sum = Book.summary(s);
  assert.deepEqual(sum.claimable, [3], "3 枚可領");
  assert.deepEqual(sum.next, { count: 6, remaining: 3 }, "可領時下一份是集滿 6 枚");
  const claimed = Book.claim(s, 3, T);
  assert.equal(claimed.ok, true);
  sum = Book.summary(s);
  assert.deepEqual(sum.next, { count: 6, remaining: 3 }, "領完要指下一份：集滿 6 枚、還差 3 枚");
  assert.match(sum.milestones[1].rewardText, /金幣 240/, "下一份獎勵內容正確");
});

console.log("VERIFIED content R77C sunbook (" + passed + " tests)");
