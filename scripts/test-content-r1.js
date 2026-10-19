"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), crypto = require("node:crypto");
const A = require("../src/adventure"), S = require("../src/state"), C = require("../src/config");
const T = 2000000;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
function fresh(unlocked = true) {
  const s = S.defaultState(T); A.ensure(s, T);
  if (unlocked) s.adventure.claimed.c1_first_harvest = true;
  s.adventure.meals.rustic_bread = 12;
  s.storage.items.carrot = 4; s.storage.items.wild_berry = 4;
  return s;
}
function fishable() { const s = fresh(); s.adventure.projects.fishing_dock.restored = true; return s; }
const choices = [["merchant", "sour"], ["elder", "hot"], ["child", "sweet"]];
for (const [id,taste] of choices) {
  test(id + " first basket opens a distinct story and a clue; matching first visit does not skip listening", () => {
    const s = fresh(), before = s.coins, r = A.deliverNeighbor(s,id,taste,T);
    assert.equal(r.ok,true); assert.equal(r.firstDelivery,true); assert.equal(r.matched,false);
    assert.ok(r.neighbor.story.length > 50 && r.neighbor.reply.length > 10 && r.neighbor.reaction.length > 20);
    assert.equal(s.adventure.meals.rustic_bread,11); assert.equal(s.coins,before);
    assert.equal(r.neighbor.matched,false);
  });
  test(id + " wrong taste keeps a clue; remembered taste alone opens personal response and survives real save/load", () => {
    const s = fresh(); A.deliverNeighbor(s,id,"plain",T);
    const wrong = taste === "sweet" ? "sour" : "sweet";
    const bad = A.deliverNeighbor(s,id,wrong,T+1);
    assert.equal(bad.matched,false); assert.equal(bad.neighbor.matched,false);
    const right = A.deliverNeighbor(s,id,taste,T+2);
    assert.equal(right.matched,true); assert.equal(right.neighbor.matched,true);
    assert.notEqual(right.neighbor.reaction,bad.neighbor.reaction);
    const map = new Map(); global.localStorage = { getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v) };
    try {
      assert.equal(S.safeSave(s).ok,true);
      const loaded = S.load(); A.ensure(loaded,T+2);
      const n = A.neighbors(loaded,T+2).find(n=>n.id===id);
      assert.equal(n.deliveries,3); assert.equal(n.reaction,right.neighbor.reaction); assert.equal(n.story,right.neighbor.story);
      assert.equal(n.matched,true); assert.equal(n.lastTaste,taste);
    } finally { delete global.localStorage; }
  });
}
test("three stories and replies differ; no preference answer is exposed before receiving a basket", () => {
  const s = fresh(), before = A.neighbors(s,T);
  before.forEach(n=>{ assert.equal(n.story,null);assert.equal(n.reaction,null); assert.equal(n.taste,undefined); });
  choices.forEach(([id])=>A.deliverNeighbor(s,id,"plain",T));
  const people = A.neighbors(s,T);
  assert.equal(new Set(people.map(n=>n.story)).size,3); assert.equal(new Set(people.map(n=>n.reply)).size,3);
});
test("missing bread, missing flavor, invalid resident/taste/time and locked chapter never spend ingredients", () => {
  const s = fresh();
  assert.equal(A.deliverNeighbor(s,"mayor","plain",T).reason,"bad_basket");
  assert.equal(A.deliverNeighbor(s,"elder","bogus",T).reason,"bad_basket");
  assert.equal(A.deliverNeighbor(s,"elder","plain",NaN).reason,"bad_time");
  assert.equal(A.deliverNeighbor(fresh(false),"elder","plain",T).reason,"locked");
  s.storage.items.wild_berry = 0;
  assert.equal(A.deliverNeighbor(s,"merchant","sour",T).reason,"missing_resources");
  assert.equal(s.adventure.meals.rustic_bread,12);
  s.adventure.meals.rustic_bread = 0;
  assert.equal(A.deliverNeighbor(s,"child","sweet",T).reason,"missing_resources");
  assert.equal(s.storage.items.carrot,4); assert.equal(s.adventure.neighbors.child.deliveries,0);
});
test("each flavor consumes exactly the shown meal and ingredient, without money or XP rewards", () => {
  for (const taste of ["plain","sweet","sour","hot"]) {
    const s = fresh(), before = {coins:s.coins,xp:s.xp};
    const f = A.basketFlavors(s,T).find(f=>f.id===taste);
    const counts = f.requirements.map(r=>r.current);
    assert.equal(A.deliverNeighbor(s,"child",taste,T).ok,true);
    const after = A.basketFlavors(s,T).find(f=>f.id===taste);
    after.requirements.forEach((r,i)=>assert.equal(r.current,counts[i]-r.required));
    assert.equal(s.coins,before.coins); assert.equal(s.xp,before.xp);
  }
});
test("old and malformed saves normalize without inventing stories, catches or matched preferences", () => {
  const s = fresh(); delete s.adventure.neighbors; delete s.adventure.fishNotes;
  const loaded = S.migrate(JSON.parse(JSON.stringify(s))); A.ensure(loaded,T);
  assert.equal(A.fishNotes(loaded,T).length,0); assert.ok(A.neighbors(loaded,T).every(n=>n.deliveries===0));
  loaded.adventure.neighbors={elder:{deliveries:-2,matched:true},child:{deliveries:1,matched:true,lastMatched:true}};
  loaded.adventure.fishNotes={bogus:true,river_carp:"true"}; loaded.adventure.fishingCast={fishId:"__proto__",startedAt:T};
  A.ensure(loaded,T); assert.equal(loaded.adventure.fishingCast,null); assert.equal(A.fishNotes(loaded,T).length,0);
  assert.ok(A.neighbors(loaded,T).every(n=>!n.matched));
});
const rhythms = [
  {id:"river_carp",roll:0,poses:[[0,"still"],[900,"tap"],[1180,"still"],[1600,"tap"],[1880,"strike"]],strike:1880,end:3180},
  {id:"silver_dace",roll:.5,poses:[[0,"still"],[2199,"still"],[2200,"strike"]],strike:2200,end:3600},
  {id:"river_perch",roll:.99,poses:[[0,"still"],[650,"pull"],[1250,"still"],[2000,"strike"]],strike:2000,end:3100},
];
for(const rhythm of rhythms) {
  test(rhythm.id + " has observable distinct phases; premature and late reels grant nothing",()=>{
    for(const when of [rhythm.strike-1,rhythm.end]) {
      const s=fishable(); assert.equal(A.startFishing(s,T,()=>rhythm.roll).ok,true);
      rhythm.poses.forEach(([ms,pose])=>assert.equal(A.fishingObservation(s,T+ms).pose,pose));
      assert.equal(A.reelFishing(s,T+when).ok,false); assert.equal(A.summary(s,T+when).fishing.used,0);
      assert.equal(s.adventure.lastFishAt,null); assert.equal(A.fishNotes(s,T).length,0);
    }
  });
  test(rhythm.id + " proper impact window catches the observed species once and saves its first river note",()=>{
    const s=fishable(); A.startFishing(s,T,()=>rhythm.roll);
    const r=A.reelFishing(s,T+rhythm.strike+50);
    assert.equal(r.ok,true);assert.equal(r.catch.id,rhythm.id);assert.equal(r.firstCatch,true);
    assert.equal(A.reelFishing(s,T+rhythm.strike+60).reason,"no_cast");
    assert.equal(A.startFishing(s,T+rhythm.strike+60).reason,"cooldown");
    const loaded=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(loaded,T+40000);
    assert.equal(A.fishNotes(loaded,T+40000)[0].id,rhythm.id);
    A.startFishing(loaded,T+40000,()=>rhythm.roll);
    const again=A.reelFishing(loaded,T+40000+rhythm.strike);
    assert.equal(again.ok,true);assert.equal(again.firstCatch,false);assert.equal(A.fishNotes(loaded,T+45000).length,1);
  });
}
test("fishing guard covers restored dock, full basket, invalid RNG/time, and reload during a cast",()=>{
  assert.equal(A.startFishing(fresh(),T).reason,"locked");
  const s=fishable();
  assert.equal(A.startFishing(s,T,()=>NaN).reason,"bad_rng");assert.equal(A.startFishing(s,-1).reason,"bad_time");
  A.startFishing(s,T,()=>0);
  const loaded=S.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(A.fishingObservation(loaded,T+1880).pose,"strike");assert.equal(A.reelFishing(loaded,T+1880).ok,true);
  s.adventure.catch.river_carp=99;
  assert.equal(A.startFishing(s,T+40000,()=>{throw Error("do not draw");}).reason,"catch_full");
});
test("all six actual generated runtime assets match manifest sizes/hashes and are cached offline",()=>{
  const manifest=JSON.parse(fs.readFileSync("assets/generated/content-r1/manifest.json","utf8"));
  assert.equal(manifest.tool,"image_gen.imagegen");assert.equal(manifest.assets.length,6);
  assert.deepEqual(manifest.palette,JSON.parse(fs.readFileSync("assets/generated/r89/manifest.json","utf8")).palette);
  for(const asset of [...manifest.assets,manifest.master,...manifest.references]) {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(asset.path)).digest("hex"),asset.sha256,asset.path);
  }
  const sw=fs.readFileSync("sw.js","utf8");
  for(const name of ["merchant.webp","elder.webp","child.webp","pond.webp","water.webp","bobber.png"]) assert.ok(sw.includes('"'+name+'"'));
  assert.ok(sw.includes('versioned("./src/content-r1.js")'));
  assert.ok(sw.includes('versioned("./src/content-r1.css")'));
});
console.log(`VERIFIED ${passed} content R1 rule groups`);
