'use strict';
const assert=require('node:assert/strict'),S=require('../src/state'),A=require('../src/adventure');
let checks=0;const test=(n,f)=>{f();checks++;console.log('PASS '+n);};
function pond(){let s=S.defaultState(100000);A.ensure(s,100000);s.adventure.projects.fishing_dock.restored=true;return s;}
test('one fresh save: three successful species give exactly 1/1, 2/2, 3/3 and survive migration',()=>{
 let s=pond();for(const [i,roll,hit]of [[0,0,2000],[1,.5,2400],[2,.99,2550]]){const t=100000+i*40000;assert(A.startFishing(s,t,()=>roll).ok);assert(A.reelFishing(s,t+hit).ok);assert.equal(s.adventure.totalCaught,i+1);assert.equal(Object.values(s.adventure.catch).reduce((a,b)=>a+b,0),i+1);assert.equal(A.fishNotes(s,t+hit).length,i+1);s=S.migrate(structuredClone(s));A.ensure(s,t+hit+1);assert.equal(s.adventure.totalCaught,i+1);assert.equal(A.fishNotes(s,t+hit+1).length,i+1);}
});
test('early/late/no cast never grant a fish, note or cumulative success',()=>{
 for(const roll of [0,.5,.99])for(const hit of [1,6000]){const s=pond();assert(A.startFishing(s,100000,()=>roll).ok);assert(!A.reelFishing(s,100000+hit).ok);assert(!A.reelFishing(s,106001).ok);assert.equal(s.adventure.totalCaught,0);assert.equal(A.fishNotes(s,106002).length,0);assert.equal(Object.values(s.adventure.catch).reduce((a,b)=>a+b,0),0);}
});
test('repeat success adds fish once and retains only one species note; read-only replay mutates nothing',()=>{
 const s=pond();for(const t of [100000,140000]){assert(A.startFishing(s,t,()=>0).ok);assert(A.reelFishing(s,t+2000).ok);assert(!A.reelFishing(s,t+2001).ok);}assert.equal(s.adventure.totalCaught,2);assert.equal(s.adventure.catch.river_carp,2);assert.equal(A.fishNotes(s,142002).length,1);const before=JSON.stringify(s);for(let t=0;t<6000;t+=16)A.observeFishingCast({fishId:'river_carp',startedAt:100000,observationVersion:2},100000+t);assert.equal(JSON.stringify(s),before);
});
test('legacy catches already delivered stay in the cumulative count, without spawning current fish',()=>{
 const s=pond();s.adventure.catch={river_carp:1};s.adventure.fishNotes={river_carp:true,silver_dace:true,river_perch:true};s.adventure.counts.fish=7;delete s.adventure.totalCaught;A.ensure(s,100001);assert.equal(s.adventure.totalCaught,7);assert.equal(s.adventure.catch.river_carp,1);assert.equal(s.adventure.catch.silver_dace,0);assert.equal(A.fishNotes(s,100001).length,3);const loaded=S.migrate(structuredClone(s));A.ensure(loaded,100002);assert.equal(loaded.adventure.totalCaught,7);
});
test('wrong then corrected table preserves exact material cost, 4 actual plates, 3 guests and 3 distinct replies',()=>{
 let s=pond();s.adventure.claimed.c1_first_harvest=true;s.adventure.meals.rustic_bread=20;s.storage.items={carrot:20,wild_berry:20};
 for(const [id,taste]of [['merchant','sour'],['elder','hot'],['child','sweet']]){assert(A.deliverNeighbor(s,id,'plain',100001).ok);assert(A.deliverNeighbor(s,id,taste,100002).ok);}for(const [id,taste]of [['merchant','sour'],['elder','hot'],['child','sweet']])assert(A.packGathering(s,id,taste,100003).ok);assert(A.completeGathering(s,100004).ok);assert(A.serveGatheringPortion(s,'child','sour',100005).ok);assert.equal(A.gathering(s,100005).servings.filter(h=>h.matched).length,0);const before=s.adventure.meals.rustic_bread,berry=s.storage.items.wild_berry;assert(A.refillGathering(s,'sour',100006).ok);assert.equal(s.adventure.meals.rustic_bread,before-1);assert.equal(s.storage.items.wild_berry,berry-1);
 for(const [id,taste]of [['merchant','sour'],['elder','hot'],['child','sweet']])assert(A.serveGatheringPortion(s,id,taste,100007).ok);assert.equal(s.adventure.gathering.servings.length,4);assert.equal(s.adventure.gathering.servings.filter(h=>h.matched).length,3);assert.equal(new Set(s.adventure.gathering.servings.filter(h=>h.matched).map(h=>h.reply)).size,3);const old=JSON.stringify(s.adventure.gathering);s=S.migrate(structuredClone(s));A.ensure(s,100008);assert.equal(JSON.stringify(s.adventure.gathering),old);
});
console.log('VERIFIED R14 '+checks+' groups');
