"use strict";
/* R61 B 線驗收（計畫第 5～7 項）：
   5 四位鄰居各 3 段好感故事，好感 1/3/5 解鎖、第 3 段給專屬禮物；
   6 送禮喜歡 +2、普通 +1、每人每天 1 次、台詞依喜好不同、喜好送過才揭曉；
   7 手札鄰居區塊資料（愛心、下一段還差多少、已揭曉喜好、可重看）。
   瀏覽器量測比照 R60：FARM_TEST_FILE=1 FARM_TEST_CHROME=<系統 Chrome> 時跑手札注入與故事播放；
   未指定時略過瀏覽器段（不算失敗），邏輯段必跑。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
global.window = global;
require("../src/config.js");
const S = require("../src/state.js");
const N = require("../src/neighbors-r61.js");
const T0 = 1794172800000;
const DAY = 24 * 60 * 60 * 1000;
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS " + name); } catch (e) { console.error("FAIL " + name + "\n" + e.stack); process.exitCode = 1; } }
function fresh() { const st = S.defaultState(T0); N.ensure(st, T0); return st; }

test("1 四位鄰居各三段故事、門檻一三五、每段三到五句且各有自己的過去與口氣", () => {
  assert.deepEqual(N.STORY_AT, [1, 3, 5]);
  assert.deepEqual(N.PEOPLE.map((p) => p.id), ["mayor", "merchant", "elder", "child"]);
  const keywords = { mayor: /送信|鎮長/, elder: /祖母/, merchant: /生意|帳本/, child: /地圖/ };
  const allText = [];
  for (const p of N.PEOPLE) {
    const stories = N.STORIES[p.id];
    assert.equal(stories.length, 3, p.id);
    for (const s of stories) {
      assert.ok(s.lines.length >= 3 && s.lines.length <= 5, `${p.id} ${s.title} 句數`);
      assert.ok(s.lines.every((l) => l.trim().length >= 10), `${p.id} ${s.title} 每句要有內容`);
      allText.push(s.lines.join(""));
    }
    assert.match(stories.map((s) => s.lines.join("")).join(""), keywords[p.id], `${p.id} 要講自己的事`);
  }
  assert.equal(new Set(allText).size, allText.length, "十二段故事文字不可重複");
  // 口氣彼此不同：四人第一段第一句互不相同
  assert.equal(new Set(N.PEOPLE.map((p) => N.STORIES[p.id][0].lines[0])).size, 4);
});

test("2 送禮喜歡加二、普通加一，物品真的被收下", () => {
  const st = fresh();
  st.storage.items = { wheat: 2, tomato: 1 };
  const normal = N.giveGift(st, "mayor", "wheat", T0);
  assert.equal(normal.ok, true); assert.equal(normal.loved, false); assert.equal(normal.gained, 1); assert.equal(normal.favor, 1);
  assert.equal(st.storage.items.wheat, 1);
  const st2 = fresh();
  st2.storage.items = { tomato: 1 };
  const loved = N.giveGift(st2, "mayor", "tomato", T0);
  assert.equal(loved.loved, true); assert.equal(loved.gained, 2); assert.equal(loved.favor, 2);
  assert.equal(st2.storage.items.tomato, undefined, "送出的番茄要離開背包");
  // 料理也能送：班伯喜歡燉鍋
  const st3 = fresh();
  st3.adventure.meals = { carrot_wheat_stew: 1 };
  const meal = N.giveGift(st3, "elder", "carrot_wheat_stew", T0);
  assert.equal(meal.ok, true); assert.equal(meal.loved, true); assert.equal(meal.gained, 2);
  assert.equal(st3.adventure.meals.carrot_wheat_stew, 0, "送出的料理要從餐籃扣除（歸零後鍵由既有存檔正規化保留）");
  // 沒有的東西送不出
  assert.equal(N.giveGift(fresh(), "child", "strawberry", T0).ok, false);
});

test("3 每人每天最多送一次，跨日可再送，台詞依喜好不同", () => {
  const st = fresh();
  st.storage.items = { wheat: 3, tomato: 2 };
  assert.equal(N.giveGift(st, "elder", "wheat", T0).ok, true);
  const again = N.giveGift(st, "elder", "wheat", T0 + 1000);
  assert.equal(again.ok, false); assert.equal(again.reason, "daily_limit");
  assert.match(again.message, /明天/);
  assert.equal(st.storage.items.wheat, 2, "被拒絕時不可扣物品");
  // 別人同一天仍可送
  assert.equal(N.giveGift(st, "child", "wheat", T0 + 1000).ok, true);
  // 跨日可再送
  assert.equal(N.giveGift(st, "elder", "wheat", T0 + DAY).ok, true);
  // 台詞：喜歡與普通不同，且四人各有自己的話
  for (const id of ["mayor", "merchant", "elder", "child"]) {
    assert.notEqual(N.GIFT_LINES[id].loved, N.GIFT_LINES[id].normal, id);
  }
  assert.equal(new Set(Object.values(N.GIFT_LINES).map((g) => g.loved)).size, 4);
  const stL = fresh(); stL.storage.items = { strawberry: 1 };
  assert.equal(N.giveGift(stL, "child", "strawberry", T0).line, N.GIFT_LINES.child.loved);
  const stN = fresh(); stN.storage.items = { wheat: 1 };
  assert.equal(N.giveGift(stN, "child", "wheat", T0).line, N.GIFT_LINES.child.normal);
});

test("4 喜好送過才揭曉，手札先藏起來", () => {
  const st = fresh();
  let d = N.journalData(st, T0).find((x) => x.id === "merchant");
  assert.deepEqual(d.lovedRevealed, []);
  assert.equal(d.lovedHiddenCount, N.LOVED.merchant.length);
  st.storage.items = { strawberry: 1, wheat: 1 };
  N.giveGift(st, "merchant", "wheat", T0); // 普通，不揭曉喜好
  d = N.journalData(st, T0 + DAY).find((x) => x.id === "merchant");
  assert.deepEqual(d.lovedRevealed, []);
  N.giveGift(st, "merchant", "strawberry", T0 + DAY); // 喜歡，揭曉草莓
  d = N.journalData(st, T0 + DAY).find((x) => x.id === "merchant");
  assert.deepEqual(d.lovedRevealed.map((x) => x.id), ["strawberry"]);
  assert.equal(d.lovedHiddenCount, N.LOVED.merchant.length - 1);
});

test("5 三段故事依好感依序解鎖、看完標記、可重看", () => {
  const st = fresh();
  let list = N.storyState(st, "elder", T0);
  assert.deepEqual(list.map((s) => s.unlocked), [false, false, false]);
  assert.equal(N.markStorySeen(st, "elder", 0, T0).ok, false, "未解鎖不可看");
  st.adventure.r58.favor.elder = 1;
  list = N.storyState(st, "elder", T0);
  assert.deepEqual(list.map((s) => s.unlocked), [true, false, false]);
  assert.equal(N.pendingStory(st, "elder", T0).index, 0);
  const seen = N.markStorySeen(st, "elder", 0, T0);
  assert.equal(seen.ok, true); assert.equal(seen.firstTime, true); assert.equal(seen.gift, null);
  assert.equal(N.pendingStory(st, "elder", T0), null);
  const replay = N.markStorySeen(st, "elder", 0, T0);
  assert.equal(replay.ok, true); assert.equal(replay.firstTime, false, "重看不可重複標記");
  st.adventure.r58.favor.elder = 3;
  assert.deepEqual(N.storyState(st, "elder", T0).map((s) => s.unlocked), [true, true, false]);
  st.adventure.r58.favor.elder = 5;
  assert.deepEqual(N.storyState(st, "elder", T0).map((s) => s.unlocked), [true, true, true]);
});

test("6 第三段專屬禮物只給一次並寫進存檔", () => {
  for (const p of N.PEOPLE) {
    const st = fresh();
    st.adventure.r58.favor[p.id] = 5;
    const r = N.markStorySeen(st, p.id, 2, T0);
    assert.equal(r.ok, true); assert.ok(r.gift, p.id);
    assert.equal(r.gift.name, N.GIFTS[p.id].name);
    if (N.GIFTS[p.id].kind === "meal") assert.equal(st.adventure.meals[N.GIFTS[p.id].id], 1, p.id + " 禮物進餐籃");
    else assert.equal(st.storage.items[N.GIFTS[p.id].id], 1, p.id + " 禮物進背包");
    const again = N.markStorySeen(st, p.id, 2, T0);
    assert.equal(again.gift, null, p.id + " 重看不可重送禮物");
    const d = N.journalData(st, T0).find((x) => x.id === p.id);
    assert.equal(d.giftReceived, true); assert.equal(d.gift.name, N.GIFTS[p.id].name);
    // 存檔序列化後仍在
    const revived = JSON.parse(JSON.stringify(st));
    assert.equal(N.journalData(revived, T0).find((x) => x.id === p.id).giftReceived, true);
  }
});

test("7 手札資料：愛心、下一段還差多少、今日可否送禮", () => {
  const st = fresh();
  st.adventure.r58.favor.child = 2;
  const d = N.journalData(st, T0).find((x) => x.id === "child");
  assert.equal(d.favor, 2);
  assert.equal(d.hearts, "❤❤🤍🤍🤍");
  assert.equal(d.nextNeed, 3); assert.equal(d.remaining, 1); assert.equal(d.allUnlocked, false);
  assert.equal(d.canGiftToday, true);
  st.storage.items = { wheat: 1 };
  N.giveGift(st, "child", "wheat", T0);
  const d2 = N.journalData(st, T0).find((x) => x.id === "child");
  assert.equal(d2.canGiftToday, false); assert.equal(d2.favor, 3); assert.equal(d2.nextNeed, 5); assert.equal(d2.remaining, 2);
  st.adventure.r58.favor.child = 5;
  const d3 = N.journalData(st, T0).find((x) => x.id === "child");
  assert.equal(d3.allUnlocked, true); assert.equal(d3.remaining, 0);
  assert.equal(N.journalData(st, T0).length, 4, "手札要列出四位鄰居");
});

test("8 舊存檔（沒有 R61 欄位、進度只到早期）載入不壞", () => {
  const old = S.defaultState(T0);
  delete old.adventure; // 模擬更舊的存檔形狀
  const d = N.journalData(old, T0);
  assert.equal(d.length, 4);
  assert.ok(d.every((x) => x.favor === 0 && x.stories.length === 3 && x.canGiftToday));
  const partial = S.defaultState(T0);
  N.ensure(partial, T0);
  partial.adventure.r58.favor.mayor = 3;
  delete partial.adventure.r61b; // 有好感、沒有看過紀錄
  const d2 = N.journalData(partial, T0).find((x) => x.id === "mayor");
  assert.equal(d2.favor, 3);
  assert.deepEqual(d2.stories.map((s) => s.unlocked), [true, true, false]);
});

test("9 接線：新檔掛進首頁與快取清單、樣式標 R61B、不動任務與料理資料", () => {
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(index, /src\/neighbors-r61\.js\?v=content-r67-20261110-1/, "首頁要載入鄰居模組且不 bump 版本");
  const sw = fs.readFileSync("sw.js", "utf8");
  assert.match(sw, /versioned\("\.\/src\/neighbors-r61\.js"\)/, "快取清單要有鄰居模組");
  assert.match(sw, /CACHE_VERSION = "content-r67-20261110-1"/, "不可改快取版本");
  const css = fs.readFileSync("src/content-r58b.css", "utf8");
  assert.match(css, /R61B/, "樣式要標 R61B");
  assert.match(css, /\.r61b-neighbors/, "手札鄰居區塊要有樣式");
  const src = fs.readFileSync("src/neighbors-r61.js", "utf8");
  assert.match(src, /window\.NeighborsR61|NeighborsR61 =/, "要暴露鄰居介面");
  assert.doesNotMatch(src, /c1_first_harvest|NPC_SIDE_QUESTS\s*=/, "不可動主線任務與委託資料");
});

async function browserCheck() {
  if (process.env.FARM_TEST_FILE !== "1" || !process.env.FARM_TEST_CHROME) {
    console.log("SKIP 瀏覽器量測（未指定 FARM_TEST_FILE 與 FARM_TEST_CHROME）");
    return;
  }
  const path = require("node:path");
  const { chromium } = require("playwright");
  const ROOT = path.resolve(__dirname, "..");
  const base = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";
  const browser = await chromium.launch({ headless: true, executablePath: process.env.FARM_TEST_CHROME, args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base);
    await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, { timeout: 30000 });
    await page.evaluate(() => {
      const state = window.__farm.state();
      window.NeighborsR61.ensure(state, Date.now());
      state.adventure.r58.favor.child = 5;
      state.storage.items.strawberry = 2;
      window.__farm.refresh();
    });
    await page.waitForFunction(() => !!document.querySelector("[data-r61b-neighbors]"), null, { timeout: 15000 });
    const result = await page.evaluate(() => {
      const state = window.__farm.state();
      const panel = document.querySelector("#journalPanel");
      const section = panel && panel.querySelector("[data-r61b-neighbors]");
      const cards = section ? section.querySelectorAll("[data-r61b-neighbor]") : [];
      let storyOpened = false;
      const playBtn = section && section.querySelector("[data-r61b-play='child:0'],[data-r61b-replay='child:0']");
      if (playBtn) { playBtn.click(); storyOpened = !!document.querySelector("[data-r61b-story='child-0']"); }
      return { hasSection: !!section, cardCount: cards.length, storyOpened,
        text: section ? section.textContent : "" };
    });
    assert.equal(result.hasSection, true, "手札要有鄰居區塊");
    assert.equal(result.cardCount, 4, "手札要列四位鄰居");
    assert.match(result.text, /圖圖/);
    assert.equal(result.storyOpened, true, "點故事要打開對話框");
    assert.deepEqual(errors, [], "頁面不可有錯誤：" + errors.join(";"));
    console.log("PASS 瀏覽器：手札鄰居區塊注入、故事對話框開啟（390×844）");
    passed++;
  } finally { await browser.close(); }
}

(async () => {
  await browserCheck();
  console.log(`VERIFIED content R61 neighbors (${passed}/9${process.env.FARM_TEST_FILE === "1" ? "+browser" : ""})`);
  if (process.exitCode) process.exit(1);
})();
