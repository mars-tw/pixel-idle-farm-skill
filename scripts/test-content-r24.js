'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),A=require('../src/adventure');
function state(){return{coins:20,xp:0,level:1,lastSeenAt:1000,materials:{wood:0,stone:0},storage:{items:{wild_berry:6,carrot:6,wheat:4,river_mint:1}},stats:{},story:{completed:{},dialogueSeen:{}},plots:[],animals:[],adventure:{migrated:true,counts:{},byTarget:{},meals:{mint_tea:0,rustic_bread:20,baked_carrot:0},catch:{river_carp:0,silver_dace:0,river_perch:0},neighbors:{merchant:{deliveries:2,lastTaste:'sour',matched:true,lastMatched:true,deliveredAt:10,history:[]},elder:{deliveries:2,lastTaste:'hot',matched:true,lastMatched:true,deliveredAt:11,history:[]},child:{deliveries:2,lastTaste:'sweet',matched:true,lastMatched:true,deliveredAt:12,history:[]}},gathering:{packed:{merchant:'sour',elder:'hot',child:'sweet'},completed:true,completedAt:20,recorded:true,refills:[],servings:[]}}};}
const stock=s=>({bread:s.adventure.meals.rustic_bread,berry:s.storage.items.wild_berry,carrot:s.storage.items.carrot,coins:s.coins,xp:s.xp,wood:s.materials.wood});
{
 const s=state(),m=A.sharedMealChoices(s,1000);assert.equal(m.order.guests.length,2);assert.equal(m.pairings.length,3);assert.deepEqual(m.order.guests.map(g=>[g.id,g.taste]),[['merchant','sour'],['elder','hot']]);assert.deepEqual(m.pairings.map(p=>p.tastes),[['sour','hot'],['hot','sweet'],['sweet','sour']]);
 console.log('PASS current order has two real resident needs and three stable dual-flavor pairings');
}
{
 const s=state(),before=stock(s),r=A.shareMeal(s,'sour_hot','market_fireside','token-perfect-001',1100);assert(r.ok&&r.completed&&r.rewardGranted);assert.equal(r.completionMode,'once');assert.deepEqual(r.newlyFulfilled,['merchant','elder']);assert.deepEqual(stock(s),{bread:before.bread-2,berry:before.berry-1,carrot:before.carrot,coins:before.coins+10,xp:0,wood:0});assert.equal(s.adventure.sharedMeals.currentIndex,1);assert.equal(s.adventure.sharedMeals.records.length,1);
 const reloaded=JSON.parse(JSON.stringify(s)),frozen=JSON.stringify(reloaded),replay=A.shareMeal(reloaded,'sour_hot','market_fireside','token-perfect-001',1101);assert.equal(replay.ok,false);assert.equal(replay.reason,'duplicate_commit');assert.equal(JSON.stringify(reloaded),frozen);
 const stale=A.shareMeal(reloaded,'sour_hot','market_fireside','token-stale-new',1102);assert.equal(stale.ok,false);assert.equal(stale.reason,'stale_order');assert.equal(JSON.stringify(reloaded),frozen);
 console.log('PASS exact dual pairing fulfills both, conserves ingredients, records once, and rewards only completed order');
}
{
 const s=state(),before=stock(s),partial=A.shareMeal(s,'hot_sweet','market_fireside','token-partial-001',1200);assert(partial.ok&&!partial.completed&&!partial.rewardGranted);assert.deepEqual(partial.newlyFulfilled,['elder']);assert.deepEqual(stock(s),{bread:before.bread-2,berry:before.berry,carrot:before.carrot-1,coins:before.coins,xp:0,wood:0});assert.equal(s.adventure.sharedMeals.currentIndex,0);
 const reload=JSON.parse(JSON.stringify(s)),model=A.sharedMealChoices(reload,1300);assert.deepEqual(model.order.guests.map(g=>[g.id,g.fulfilled]),[['merchant',false],['elder',true]]);
 const beforeDup=stock(reload),attempts=reload.adventure.sharedMeals.orders.market_fireside.attempts.length,dup=A.shareMeal(reload,'hot_sweet','market_fireside','token-partial-dup',1400);assert.equal(dup.ok,false);assert.equal(dup.reason,'no_progress');assert.deepEqual(stock(reload),beforeDup);assert.equal(reload.adventure.sharedMeals.orders.market_fireside.attempts.length,attempts);
 const fix=A.shareMeal(reload,'sweet_sour','market_fireside','token-correct-001',1500);assert(fix.ok&&fix.completed&&fix.rewardGranted);assert.deepEqual(fix.newlyFulfilled,['merchant']);assert.equal(fix.completionMode,'supplemented');assert.equal(reload.adventure.meals.rustic_bread,before.bread-4);assert.equal(reload.storage.items.carrot,before.carrot-2);assert.equal(reload.storage.items.wild_berry,before.berry-1);assert.equal(reload.coins,before.coins+10);
 console.log('PASS partial survives reload, duplicate adds nothing, and corrective meal really consumes again before one bounded reward');
}
{
 const s=state();s.adventure.meals.rustic_bread=1;A.ensure(s,1600);const before=JSON.stringify(stock(s)),r=A.shareMeal(s,'sour_hot','market_fireside','token-missing-001',1600);assert.equal(r.ok,false);assert.equal(r.reason,'missing_resources');assert.equal(JSON.stringify(stock(s)),before);assert.equal(s.adventure.sharedMeals.orders.market_fireside.fulfilled.length,0);
 console.log('PASS insufficient stock is atomic: no deduction and no fulfillment');
}
{
 const s=state();assert(A.shareMeal(s,'sour_hot','market_fireside','token-rotate-001',1700).completed);assert(A.shareMeal(s,'hot_sweet','fireside_garden','token-rotate-002',1800).completed);assert(A.shareMeal(s,'sweet_sour','garden_market','token-rotate-003',1900).completed);const m=A.sharedMealChoices(JSON.parse(JSON.stringify(s)),2000);assert(m.complete);assert.equal(m.records.length,3);assert.deepEqual(m.records.map(r=>r.completionMode),['once','once','once']);assert.equal(s.coins,30);assert.equal(s.materials.wood,2);assert.equal(s.xp,5);
 console.log('PASS three rotating two-person orders advance and each completed order rewards exactly once');
}
{
 const legacy=state();delete legacy.adventure.sharedMeals;assert(A.ensure(legacy,2100).ok);assert.equal(legacy.adventure.sharedMeals.version,2);assert.equal(legacy.adventure.sharedMeals.currentIndex,0);assert.equal(legacy.adventure.sharedMeals.records.length,0);assert.equal(A.sharedMealChoices(legacy,2100).order.guests.length,2);
 console.log('PASS legacy save migrates without invented partials, records, or rewards');
}
for(const f of ['index.html','sw.js','package.json','src/content-r24.js','src/content-r24.css'])assert(fs.existsSync(f));assert.match(fs.readFileSync('index.html','utf8'),/content-r24\.js\?v=content-r24-20261026-2/);assert.match(fs.readFileSync('src/content-r6.js','utf8'),/id="sharedMealEntry"/);
{
 const ui=fs.readFileSync('src/content-r24.js','utf8'),resultBody=ui.slice(ui.indexOf('function showResult'),ui.indexOf('function open'));
 assert.match(ui,/busy=true;box\.querySelectorAll\('\.content-footer button,\[data-pairing-tab\]'\)\.forEach\(b=>b\.disabled=true\)/);
 assert.match(ui,/R\.save\(state\);showResult\(state,r,order,selected\)/);assert.doesNotMatch(resultBody,/A\.shareMeal|id="sharePairing"/);
 assert.match(resultBody,/sharedMealResultNext/);assert.match(resultBody,/onclick=\(\)=>open\(state\)/);
 console.log('PASS successful submit enters a no-commit result page before any next meal CTA');
}
console.log('VERIFIED R24 rotating two-resident shared-meal gameplay');
