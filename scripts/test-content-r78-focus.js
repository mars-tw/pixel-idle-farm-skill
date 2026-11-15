"use strict";
/* R78B 驗收：第一分鐘只教一件事、一次只有一個主要互動層。
   每一條都對著評審抓到的實際狀況寫：任務卡按鈕對不上現況、第一株就跳三種照顧方式、
   同屏四個浮層、三種照顧方式沒有取捨、等光還是現在收沒有數字。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../src/config.js");
const State = require("../src/state.js");
const Sun = require("../src/sunplay-r75.js");
const Game = require("../src/game.js");
const A = require("../src/adventure.js");
global.window = { getCropProgress: Game.getCropProgress };

const T = 1794172800000;
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh(now) { const s = State.defaultState(now || T); Sun.normalize(s); A.ensure(s, now || T); return s; }
function clone(s) { return JSON.parse(JSON.stringify(s)); }
function ripen(s, index, now) { s.plots[index].plantedAt = now - Game.plotGrowMs(s, s.plots[index], now) - 1; }
function grow(s, index, cropId, now, care) { s.coins = Math.max(s.coins, 999); assert.equal(Game.plant(s, index, cropId, now, care).ok, true, "種得下去"); ripen(s, index, now); }
/* 第 4 章「把市集撐大一點」：前三章全部交付，等級夠種番茄與草莓。 */
function chapter4() {
  const s = State.defaultState(T); Sun.normalize(s); A.ensure(s, T); s.coins = 999; s.stats.plantCount = 20; s.flags.r78CareIntro = true;
  /* 等級是從經驗值算出來的（收成時會重算），所以給足經驗值，不只改等級那個數字。 */
  while (C.levelFromXp(s.xp) < 8) s.xp += 50; s.level = C.levelFromXp(s.xp);
  for (const q of A.quests(s, T)) if (q.chapter < 4) s.adventure.claimed[q.id] = true;
  A.ensure(s, T);
  return s;
}
const sunlightOf = (s) => Sun.sunlight(s);

test("4a 小麥已經熟、光快到了：主要按鈕不寫「去種小麥」，寫等光再收", () => {
  const s = fresh(); grow(s, 0, "wheat", T); s.sun.previewPlots = [0]; s.sun.previewAt = T + 8000; s.sun.nextAt = T + 8000;
  s.adventure.r58.r59.seedPacks.wheat = 2;
  const step = A.nextFarmStep(s, T + 1000);
  assert.notEqual(step.actionLabel, "去種小麥", "田上寫先別收的時候，任務卡不能叫玩家去種小麥");
  assert.equal(step.action, "catch_sun"); assert.equal(step.plotIndex, 0); assert.equal(step.holdPlotIndex, 0, "等光的那一格要帶出去，田上才會寫先別收");
  assert.equal(step.actionLabel, "等光再收"); assert.match(step.text, /等光到了再收成/);
  assert.doesNotMatch(step.text, /\d+ 秒/, "任務卡文字不放會跳動的秒數");
  /* 沒有光的預告時，熟了就是去收。 */
  const plain = fresh(); grow(plain, 0, "wheat", T); plain.adventure.r58.r59.seedPacks.wheat = 2;
  const harvest = A.nextFarmStep(plain, T + 1000); assert.equal(harvest.action, "harvest"); assert.equal(harvest.actionLabel, "去收成");
  /* 還在長的那一格等光時，這幾秒照舊先把種子包種完（追光教學的原本順序不變）。 */
  const young = fresh(); young.coins = 99; Game.plant(young, 0, "wheat", T); young.sun.previewPlots = [0]; young.sun.previewAt = T + 8000; young.sun.nextAt = T + 8000; young.adventure.r58.r59.seedPacks.wheat = 2;
  const sow = A.nextFarmStep(young, T + 1000); assert.equal(sow.action, "plant"); assert.equal(sow.holdPlotIndex, 0);
});

test("4b 材料是 0 時寫去種或去收，不寫去找人；材料齊了寫去回報", () => {
  const s = chapter4();
  const q = A.summary(s, T).currentQuest; assert.equal(q.id, "c4_market_expansion");
  const sow = A.nextFarmStep(s, T);
  assert.equal(sow.questAware, true, "第 2 章以後的下一步也要跟著手上的任務"); assert.equal(sow.questId, "c4_market_expansion");
  assert.equal(sow.action, "plant"); assert.equal(sow.cropId, "tomato"); assert.equal(sow.actionLabel, "去種番茄");
  assert.doesNotMatch(sow.actionLabel, /^前往/, "番茄 0/3 還沒種，不能叫玩家去找蘿拉"); assert.match(sow.text, /番茄/);
  /* 番茄種了還在長：先澆水，澆過了就等，不叫玩家去找人。 */
  Game.plant(s, 0, "tomato", T, "water");
  const tend = A.nextFarmStep(s, T + 10); assert.equal(tend.questAware, true); assert.equal(tend.action, "tend"); assert.equal(tend.plotIndex, 0); assert.equal(tend.actionLabel, "去照顧番茄");
  s.plots[0].wateredAt = T + 20;
  const wait = A.nextFarmStep(s, T + 30); assert.equal(wait.action, "wait"); assert.doesNotMatch(wait.actionLabel, /^前往|去種/); assert.match(wait.text, /番茄/);
  /* 番茄熟了：去收番茄。 */
  ripen(s, 0, T + 40);
  const reap = A.nextFarmStep(s, T + 40); assert.equal(reap.action, "harvest"); assert.equal(reap.plotIndex, 0); assert.equal(reap.actionLabel, "去收番茄");
  /* 番茄夠了、草莓還沒種：換成去種草莓。 */
  s.storage.items.tomato = 3; Game.harvest(s, 0, T + 50, () => 1);
  const berry = A.nextFarmStep(s, T + 60); assert.equal(berry.action, "plant"); assert.equal(berry.cropId, "strawberry"); assert.equal(berry.actionLabel, "去種草莓");
  /* 全部齊了：去回報，對象是發任務的人。 */
  s.storage.items.tomato = 3; s.storage.items.strawberry = 2; s.materials.wood = 2;
  assert.equal(A.summary(s, T + 70).currentQuest.canClaim, true);
  const report = A.nextFarmStep(s, T + 70); assert.equal(report.action, "report"); assert.equal(report.target, "merchant"); assert.equal(report.actionLabel, "去回報"); assert.match(report.text, /蘿拉/);
  /* 田裡剛好還有番茄可以種也一樣：齊了就是回報，不再叫玩家去種。 */
  assert.doesNotMatch(report.actionLabel, /去種/);
});

test("4c 沒有要交作物的任務照舊：第一餐後仍然帶去河邊", () => {
  const s = fresh();
  for (const id of ["c1_homecoming", "c1_first_harvest", "c1_first_meal"]) s.adventure.claimed[id] = true;
  A.ensure(s, T);
  const step = A.nextFarmStep(s, T); assert.equal(step.action, "explore"); assert.equal(step.questAware, undefined);
  /* 任務卡與手札接的是同一個來源。 */
  const world = read("src/world-ui.js");
  assert.match(world, /questAware/, "任務卡要認得跟著任務走的下一步");
  assert.match(world, /step\.action === "report"/, "去回報要帶玩家去找發任務的人");
});

test("1 第一株只教種下、光來、收成：第一次種植不介紹照顧方式，收過一次才開", () => {
  const s = fresh();
  assert.equal(s.flags.r78CareIntro, false, "新存檔還沒學過照顧方式"); assert.equal(Game.careIntroOpen(s), false);
  assert.equal(Game.firstRoundCare(s), "water", "第一輪預設勤澆水");
  s.coins = 99; assert.equal(Game.plant(s, 0, "wheat", T, Game.firstRoundCare(s)).ok, true); assert.equal(s.plots[0].careMode, "water");
  assert.equal(Game.careIntroOpen(s), false, "第一株種下去還不介紹");
  ripen(s, 0, T + 10); assert.equal(Game.harvest(s, 0, T + 10, () => 1).ok, true);
  assert.equal(s.flags.r78CareIntro, true, "收過第一次，第二輪種植才介紹"); assert.equal(Game.careIntroOpen(s), true); assert.equal(Game.firstRoundCare(s), null);
  /* 舊存檔：已經種過的視為學過；沒種過的照新手走；已經寫進存檔的值不被蓋掉。 */
  const old = clone(State.defaultState(T)); delete old.flags.r78CareIntro; old.stats.plantCount = 4;
  assert.equal(State.migrate(old).flags.r78CareIntro, true, "舊存檔種過就算學過");
  const blank = clone(State.defaultState(T)); delete blank.flags.r78CareIntro;
  assert.equal(State.migrate(blank).flags.r78CareIntro, false);
  const kept = clone(State.defaultState(T)); kept.flags.r78CareIntro = false; kept.stats.plantCount = 1;
  assert.equal(State.migrate(kept).flags.r78CareIntro, false, "第一株種了還沒收的新存檔，重新讀進來不會提早跳出照顧方式");
  const ui = read("src/ui.js");
  assert.match(ui, /G\.careIntroOpen\(state\)/, "照顧方式彈窗要看存檔裡的進度旗標");
  assert.match(ui, /G\.firstRoundCare\(state\)/, "第一輪種植用預設的勤澆水");
});

test("1b 任務卡、田上標籤、提示條講同一個秒數", () => {
  assert.equal(Sun.secondsLeft(0), 1); assert.equal(Sun.secondsLeft(1), 1); assert.equal(Sun.secondsLeft(1000), 1); assert.equal(Sun.secondsLeft(1001), 2); assert.equal(Sun.secondsLeft(7999), 8); assert.equal(Sun.secondsLeft(-50), 1);
  assert.equal(Sun.lightSecondsText({ previewAt: T + 4200 }, T), "5 秒");
  for (const file of ["src/world-ui.js", "src/ui.js", "src/sunplay-r75.js"]) {
    const src = read(file);
    assert.doesNotMatch(src, /Math\.ceil\(sun\.previewInMs \/ 1000\)/, file + " 不要自己再算一次秒數");
    assert.doesNotMatch(src, /Math\.ceil\(\(\(sun\.previewAt \|\| 0\) - now\) \/ 1000\)/, file + " 不要自己再算一次秒數");
  }
  assert.match(read("src/world-ui.js"), /data-r78b-light-secs/, "提示條的秒數交給同一個計時更新");
  assert.match(read("src/sunplay-r75.js"), /data-r78b-light-secs/, "預告圈、提示條、田上標籤同一拍更新");
});

test("5 一次只有一個主要互動層：主要面板開著時任務卡收起、提示卡排隊", () => {
  assert.ok(Array.isArray(Sun.FOCUS_PRIMARY) && Sun.FOCUS_PRIMARY.length >= 4); assert.ok(Array.isArray(Sun.FOCUS_CARDS) && Sun.FOCUS_CARDS.length >= 3);
  for (const layer of ["panel", "dialogue", "modal"]) assert.ok(Sun.FOCUS_PRIMARY.includes(layer), layer + " 是主要層");
  for (const card of ["care", "stamp", "settlement"]) assert.ok(Sun.FOCUS_CARDS.includes(card), card + " 是提示卡");
  const idle = Sun.focusRule({ open: [], cards: [] });
  assert.equal(idle.primary, null); assert.equal(idle.card, null); assert.equal(idle.questDock, "shown"); assert.equal(idle.hints, "shown");
  /* 同屏四個浮層的那個畫面：照顧彈窗、集章小卡、收成提示一起來，只留一張，其餘排隊。 */
  const crowd = Sun.focusRule({ open: [], cards: ["stamp", "settlement", "care"] });
  assert.equal(crowd.card, Sun.FOCUS_CARDS.find((id) => ["stamp", "settlement", "care"].includes(id)), "照固定順序留一張");
  assert.equal(crowd.queued.length, 2); assert.ok(!crowd.queued.includes(crowd.card)); assert.equal(crowd.questDock, "shown");
  /* 打開訂單、升級、手札、對話：任務卡收起，提示卡全部排隊，光的提示條也先收。 */
  for (const layer of Sun.FOCUS_PRIMARY) {
    const r = Sun.focusRule({ open: [layer], cards: ["care", "stamp"] });
    assert.equal(r.primary, layer); assert.equal(r.card, null, layer + " 開著時不出提示卡"); assert.deepEqual(r.queued.slice().sort(), ["care", "stamp"]);
    assert.equal(r.questDock, "folded", layer + " 開著時任務卡收起"); assert.equal(r.hints, "hidden");
  }
  /* 兩個主要層同時被標記時只認一個，不認得的名字不算。 */
  const two = Sun.focusRule({ open: ["panel", "dialogue", "whatever"], cards: ["nope", "care"] });
  assert.equal(two.primary, Sun.FOCUS_PRIMARY.find((id) => id === "panel" || id === "dialogue")); assert.deepEqual(two.queued, ["care"]);
  /* 不管怎麼組合，同一時間最多一張提示卡。 */
  const all = Sun.FOCUS_CARDS.slice();
  for (let mask = 0; mask < (1 << all.length); mask++) {
    const cards = all.filter((_, i) => mask & (1 << i));
    const r = Sun.focusRule({ open: [], cards }); assert.equal((r.card ? 1 : 0) + r.queued.length, cards.length); assert.ok(!r.card || cards.includes(r.card));
  }
  const ui = read("src/ui.js");
  assert.match(ui, /focusRule\(/, "畫面上的層級只照這一條規則排"); assert.equal((ui.match(/focusRule\(/g) || []).length, 1, "規則只在一個地方套用，不在每個面板各寫一次");
  assert.match(read("src/sunbook-r76.js"), /r78Focus|data-r78-focus/, "集章小卡跟著同一條規則排隊");
});

test("3 三種照顧方式各有最適合的時候，彈窗那一行跟著手上的需求變", () => {
  const care = Game.FARM_CARE;
  assert.ok(care.water.growMul < 1, "勤澆水最快"); assert.ok(care.compost.growMul > 1, "施堆肥長得慢，換多收與優質"); assert.ok(care.natural.seedBack >= 2, "放著長帶回的種子要比種下去的多");
  const setup = (fn) => { const s = fresh(); s.coins = 50; s.stats.plantCount = 9; s.flags.r78CareIntro = true; s.materials.compost = 3; s.orders = []; fn(s); return s; };
  const trial = (s, mode, at) => { const c = clone(s); assert.equal(Game.plant(c, 0, "wheat", T, mode).ok, true, mode + " 種得下去"); return c; };
  const modes = ["water", "compost", "natural"];
  /* 情境一：限時訂單還差 2 份小麥，13 秒後到期——只有勤澆水趕得上。 */
  const rush = setup((s) => { s.orders = [{ id: "r78_rush", wants: { wheat: 2 }, rewardCoins: 30, rewardXp: 4, rarity: "common", expiresAt: T + 13000 }]; });
  const inTime = modes.filter((mode) => { const c = trial(rush, mode); return T + Game.plotGrowMs(c, c.plots[0], T) <= rush.orders[0].expiresAt; });
  assert.deepEqual(inTime, ["water"], "趕限時訂單只有勤澆水來得及");
  const rushPlanted = trial(rush, "water"); const rushAdvice = Game.careAdvice(rushPlanted, 0, T);
  assert.equal(rushAdvice.need, "rush"); assert.equal(rushAdvice.best, "water"); assert.match(rushAdvice.text, /訂單/); assert.match(rushAdvice.text, /勤澆水/);
  /* 情境二：祭典要比這種作物——施堆肥收得最多，也是唯一有機會優質的。 */
  const fest = setup((s) => { const f = s.adventure.r61.festival; f.unlocked = true; f.startsAt = T - 1000; f.endsAt = T + 600000; f.harvestCrop = "wheat"; f.harvestRequired = 3; });
  const haul = modes.map((mode) => { const c = trial(fest, mode); ripen(c, 0, T + 1); const out = Game.harvest(c, 0, T + 1, () => 0.1); return { mode, added: out.added, quality: !!out.quality }; });
  assert.deepEqual(haul.filter((row) => row.quality).map((row) => row.mode), ["compost"], "拚優質只有施堆肥");
  assert.equal(haul.slice().sort((x, y) => y.added - x.added)[0].mode, "compost");
  const festAdvice = Game.careAdvice(trial(fest, "water"), 0, T);
  assert.equal(festAdvice.need, "quality"); assert.equal(festAdvice.best, "compost"); assert.match(festAdvice.text, /祭典/); assert.match(festAdvice.text, /施堆肥/);
  /* 情境三：種子包用完、金幣也買不起下一輪——放著長帶回的種子最多。 */
  const poor = setup((s) => { s.coins = 0; s.adventure.r58.r59.seedPacks.wheat = 1; s.materials.compost = 3; });
  const packs = modes.map((mode) => { const c = trial(poor, mode); ripen(c, 0, T + 1); Game.harvest(c, 0, T + 1, () => 1); return { mode, packs: c.adventure.r58.r59.seedPacks.wheat || 0 }; });
  assert.deepEqual(packs.filter((row) => row.packs > 0).map((row) => row.mode), ["natural"], "補種子只有放著長"); assert.ok(packs.find((row) => row.mode === "natural").packs >= 2, "種 1 包至少回 2 包");
  const poorAdvice = Game.careAdvice(trial(poor, "water"), 0, T);
  assert.equal(poorAdvice.need, "seeds"); assert.equal(poorAdvice.best, "natural"); assert.match(poorAdvice.text, /種子/); assert.match(poorAdvice.text, /放著長/);
  assert.equal(new Set([rushAdvice.best, festAdvice.best, poorAdvice.best]).size, 3, "三個情境各有不同的最佳選擇");
  assert.equal(new Set([rushAdvice.text, festAdvice.text, poorAdvice.text]).size, 3, "那一行說明跟著需求變");
  /* 沒有特別需求時也給一句話，不留空白。 */
  const calm = Game.careAdvice(trial(setup(() => {}), "water"), 0, T); assert.equal(calm.need, "none"); assert.ok(calm.text.length > 6);
  /* 沒有堆肥時不建議施堆肥。 */
  const noCompost = setup((s) => { const f = s.adventure.r61.festival; f.unlocked = true; f.startsAt = T - 1000; f.endsAt = T + 600000; f.harvestCrop = "wheat"; s.materials.compost = 0; });
  assert.notEqual(Game.careAdvice(trial(noCompost, "water"), 0, T).best, "compost");
  assert.deepEqual(Game.careAdvice(setup(() => {}), 0, T), { ok: false, best: null, need: "none", text: "" }, "空田沒有建議");
  /* 彈窗用的是同一份預測與建議。 */
  const ui = read("src/ui.js"); assert.match(ui, /G\.careAdvice\(/); assert.match(ui, /r78b-care-why/);
});

test("2 等光還是現在收：兩個數字都從規則算出來", () => {
  const s = fresh(); grow(s, 0, "wheat", T, "water"); s.sun.previewPlots = [0]; s.sun.previewAt = T + 5000; s.sun.nextAt = T + 5000;
  const at = T + 200; const choice = Game.lightHarvestChoice(s, 0, at);
  assert.equal(choice.ok, true); assert.equal(choice.seconds, Sun.secondsLeft(4800)); assert.equal(choice.seconds, 5);
  /* 現在收：真的收一次比對。 */
  const nowState = clone(s); const before = sunlightOf(nowState); const nowOut = Game.harvest(nowState, 0, at, () => 1);
  assert.equal(nowOut.added, choice.nowQty, "現在收的份數"); assert.equal(sunlightOf(nowState) - before, choice.nowSunlight, "現在收拿到的陽光");
  /* 等光到了再收：真的等到光落下再收一次比對。 */
  const waitState = clone(s); assert.equal(Game.updateSunpatch(waitState, T + 5000, () => 0).spawned, true);
  const waitBefore = sunlightOf(waitState); const waitOut = Game.harvest(waitState, 0, T + 5001, () => 1);
  assert.equal(waitOut.added, choice.waitQty, "等光再收的份數"); assert.equal(sunlightOf(waitState) - waitBefore, choice.waitSunlight, "等光再收拿到的陽光");
  assert.ok(choice.waitQty > choice.nowQty, "等光要真的比較多"); assert.ok(choice.waitSunlight > choice.nowSunlight);
  assert.equal(choice.nowText, `現在收：${choice.nowQty} 份`); assert.equal(choice.waitText, `等光再收：${choice.waitQty} 份＋陽光 ${choice.waitSunlight}`);
  /* 蓄光瓶快滿時，陽光的數字跟著少，不寫拿不到的量。 */
  const full = clone(s); Sun.addSunlight(full, Sun.bottleCapacity(full)); const fullChoice = Game.lightHarvestChoice(full, 0, at);
  assert.equal(fullChoice.waitSunlight, 0); assert.equal(fullChoice.waitText, `等光再收：${fullChoice.waitQty} 份`);
  /* 施堆肥的那一格兩邊都多 1 份。 */
  const rich = fresh(); rich.materials.compost = 2; grow(rich, 0, "wheat", T, "compost"); rich.sun.previewPlots = [0]; rich.sun.previewAt = T + 5000; rich.sun.nextAt = T + 5000;
  const richChoice = Game.lightHarvestChoice(rich, 0, at); assert.equal(richChoice.nowQty, choice.nowQty + 1); assert.equal(richChoice.waitQty, choice.waitQty + 1);
  /* 光已經落下、光不在這格、還沒熟：都不再給這個二選一。 */
  assert.equal(Game.lightHarvestChoice(waitState, 0, T + 5001).ok, false, "光落下後不再留等光的字");
  assert.equal(Game.lightHarvestChoice(s, 1, at).ok, false);
  const young = fresh(); young.coins = 99; young.stats.plantCount = 9; Game.plant(young, 0, "wheat", T); young.sun.previewPlots = [0]; young.sun.previewAt = T + 5000;
  assert.equal(Game.lightHarvestChoice(young, 0, at).ok, false);
  const ui = read("src/ui.js");
  assert.match(ui, /G\.lightHarvestChoice\(/, "田上標籤用算出來的數字"); assert.match(ui, /r78b-wait-choice/);
  assert.match(ui, /heldForLight \? `等光再收・\$\{name\}` : `\$\{name\}・可收成`/, "成熟田的第一行跟下一步同步");
});

test("2b 光已經落下後，不再留「光會落在這一格」「等光到了再…」", () => {
  const sunSrc = read("src/sunplay-r75.js");
  assert.match(sunSrc, /r78bRefractNote/, "折光後的提示要看光到了沒");
  const s = fresh(); s.coins = 99; s.stats.plantCount = 9; Game.plant(s, 0, "wheat", T);
  assert.equal(Sun.refractToastText({ ok: true, remaining: 0, active: false }), "光會落在這一格。等光到了再澆水或收成。");
  assert.equal(Sun.refractToastText({ ok: true, remaining: 0, active: true }), "光折過來了。趁光還在，在這一格澆水或收成。");
  assert.doesNotMatch(Sun.refractToastText({ ok: true, remaining: 0, active: true }), /光會落在|等光到了再/);
  /* 預告期間折光的提示只留到光落下為止。 */
  assert.equal(Sun.staleLightText("光會落在這一格。等光到了再澆水或收成。", { active: true }), true);
  assert.equal(Sun.staleLightText("光快落在這格了，等光到了再收成，多接 1 點陽光。", { active: true }), true);
  assert.equal(Sun.staleLightText("光會落在這一格。等光到了再澆水或收成。", { active: false }), false);
  assert.equal(Sun.staleLightText("光折過來了。趁光還在，在這一格澆水或收成。", { active: true }), false);
});

test("6 光裡收成的大字：多 1 份、陽光 +N 從收成結果來", () => {
  const s = fresh(); grow(s, 0, "wheat", T, "water"); s.sun.previewPlots = [0]; s.sun.previewAt = T + 5000; s.sun.nextAt = T + 5000;
  Game.updateSunpatch(s, T + 5000, () => 0); const out = Game.harvest(s, 0, T + 5001, () => 1);
  const pop = Sun.harvestPopText(out);
  assert.deepEqual(pop, [`多 ${out.sun.bonus} 份`, `陽光 +${out.sun.sunlight}`]);
  assert.deepEqual(Sun.harvestPopText({ ok: true, sun: { kind: "harvest", bonus: 1, sunlight: 0 } }), ["多 1 份"]);
  assert.deepEqual(Sun.harvestPopText({ ok: true }), []);
  const css = read("src/content-r58b.css");
  const start = css.indexOf("R78B（第一分鐘與互動層級）開始"); const end = css.indexOf("R78B 結束");
  assert.ok(start > 0 && end > start); const block = css.slice(start, end);
  assert.match(block, /\.r78b-sun-pop/); assert.match(block, /\.r78b-wait-choice/); assert.match(block, /steps\(/, "光斑用階梯狀亮度，不用平滑漸層動畫");
  assert.doesNotMatch(block, /blur\(|radial-gradient\(/, "像素風：不用模糊與放射漸層");
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, "大括號要平衡");
});

test("7 右下互動鈕：面前是長著作物的田時不寫「種植・空田」", () => {
  const ui = read("src/ui.js");
  assert.match(ui, /r78bFacingCropLabel/, "面前的田有作物時用它自己的狀態當按鈕文字");
  const s = fresh(); s.coins = 99; Game.plant(s, 0, "wheat", T); s.plots[0].wateredAt = T + 1;
  const tile = s.map.tiles.find((t) => t.plotIndex === 0);
  assert.equal(Game.facingPlotLabel(s, tile, T + 2), "生長中・小麥田");
  const emptyTile = s.map.tiles.find((t) => t.plotIndex === 1);
  assert.equal(Game.facingPlotLabel(s, emptyTile, T + 2), "", "空田交給原本的種植字樣");
});

console.log(`\nR78B focus rules: ${passed} passed`);
