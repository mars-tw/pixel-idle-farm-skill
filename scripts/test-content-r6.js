'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const S=require('../src/state'),A=require('../src/adventure');let groups=0;const T=6000000;
const people=[['merchant','sour','陽光茶凳'],['elder','hot','修好的魚竿'],['child','sweet','壓花空椅']];
function test(n,fn){fn();groups++;console.log('PASS '+n);}
function fresh(){const s=S.defaultState(T);A.ensure(s,T);s.adventure.claimed.c1_first_harvest=true;s.adventure.meals.rustic_bread=20;s.storage.items={carrot:8,wild_berry:8};s.adventure.projects.fishing_dock.restored=true;return s;}
function matched(){const s=fresh();for(const[id,taste]of people){A.deliverNeighbor(s,id,'plain',T);A.deliverNeighbor(s,id,taste,T+1);}return s;}
test('three earned keepsakes and wrong reactions are personal, no shared bookmark or wrong-answer spoilers',()=>{
 const s=fresh();assert(A.neighbors(s,T).every(n=>n.memory===null));
 for(const[id,taste,token]of people){A.deliverNeighbor(s,id,'plain',T);const n=A.neighbors(s,T).find(n=>n.id===id);assert.equal(n.memory.token,token);assert(!/甜|酸|熱|胡蘿蔔|野莓/.test(n.memory.wrong));assert(!n.memory.detail.includes('書籤'));A.deliverNeighbor(s,id,taste,T+1);}
 const loaded=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(loaded,T+2);assert(A.neighbors(loaded,T+2).every(n=>n.matched));assert.equal(new Set(A.neighbors(loaded,T+2).map(n=>n.memory.reply)).size,3);
});
test('shared meal unlocks only after all three real matches, packing is atomic, one-time and survives every reload',()=>{
 const locked=fresh();const before=JSON.stringify(locked.adventure.meals);assert(!A.packGathering(locked,'merchant','sour',T).ok);assert.equal(JSON.stringify(locked.adventure.meals),before);
 let s=matched();assert(A.gathering(s,T).unlocked);assert(!A.completeGathering(s,T).ok);
 const bread=s.adventure.meals.rustic_bread;
 for(const[id,taste]of people){const b=s.adventure.meals.rustic_bread;assert(!A.packGathering(s,id,'plain',T).ok);assert.equal(s.adventure.meals.rustic_bread,b);assert(A.packGathering(s,id,taste,T+2).ok);assert.equal(s.adventure.meals.rustic_bread,b-1);assert(!A.packGathering(s,id,taste,T+3).ok);assert.equal(s.adventure.meals.rustic_bread,b-1);s=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(s,T+4);assert.equal(A.gathering(s,T+4).packed[id],taste);}
 assert.equal(s.adventure.meals.rustic_bread,bread-3);assert(A.gathering(s,T+4).ready);assert(A.completeGathering(s,T+5).ok);assert(!A.completeGathering(s,T+6).ok);assert(!A.packGathering(s,'child','sweet',T+7).ok);assert(A.gathering(S.migrate(JSON.parse(JSON.stringify(s))),T+8).completed);
 const poor=matched();poor.storage.items.wild_berry=0;const b=poor.adventure.meals.rustic_bread;assert(!A.packGathering(poor,'merchant','sour',T).ok);assert.equal(poor.adventure.meals.rustic_bread,b);assert(!poor.adventure.gathering.packed.merchant);
});
test('malformed legacy gathering cannot invent completion or unearned reserved baskets',()=>{
 const s=fresh();s.adventure.gathering={completed:true,packed:{merchant:'sour',elder:'hot',child:'sweet',bogus:'sweet'}};A.ensure(s,T);assert(!s.adventure.gathering.completed);assert.deepEqual(s.adventure.gathering.packed,{});
});
test('observed fish require circular closure, a short vertical splash or straight wake; late and premature reels grant nothing',()=>{
 for(const[id,roll,early,hit,late,motion]of [['river_carp',0,1750,1950,3180,'closed-rings'],['silver_dace',.5,2100,2250,3100,'short-splash'],['river_perch',.99,1700,2050,3100,'straight-wake']]){
  for(const [ms,success]of [[early,false],[hit,true],[late,false]]){let s=fresh();assert(A.startFishing(s,T,()=>roll).ok);s.adventure.fishingCast.observationVersion=2;s=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(s,T);assert.equal(s.adventure.fishingCast.observationVersion,2);const p=A.observeFishingCast(s.adventure.fishingCast,T+ms);if(success)assert.equal(p.motion,motion);const r=A.reelFishing(s,T+ms);assert.equal(r.ok,success,id+' '+ms);assert.equal(s.adventure.catch[id],success?1:0);assert.equal(!!s.adventure.fishNotes[id],success);if(success){assert(!A.reelFishing(s,T+ms+1).ok);const loaded=S.migrate(JSON.parse(JSON.stringify(s)));assert(A.fishNotes(loaded,T+ms+2).some(n=>n.id===id));}}
 }
});
test('earned notebook teaching names the actual three distinct reel decisions',()=>{
 const s=fresh();s.adventure.fishNotes={river_carp:true,silver_dace:true,river_perch:true};const notes=A.fishNotes(s,T);assert(notes[0].note.includes('碎水紋向浮標合攏'));assert(notes[1].note.includes('小嘴朝上啄水')&&notes[1].note.includes('水花散掉就晚'));assert(notes[2].note.includes('魚影衝向一側、V形尾流向兩側展開'));
});
test('R6 generated atlas and runtime sprites have actual tool provenance, hashes and offline precache',()=>{
 for(const file of ['index.html','manifest.webmanifest','sw.js','package.json','package-lock.json',...fs.readdirSync('src').filter(x=>/\.(js|css)$/.test(x)).map(x=>'src/'+x)])assert(!fs.readFileSync(file,'utf8').includes('content-r5-20261019-1'),'stale runtime version '+file);
 const m=JSON.parse(fs.readFileSync('assets/generated/content-r6/manifest.json'));assert.equal(m.tool,'image_gen.imagegen');assert.equal(m.actualModelSlug,null);assert.equal(m.masters.length,4);assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
 for(const f of [...m.masters,...m.assets])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex'),f.sha256);
 const sw=fs.readFileSync('sw.js','utf8');assert(sw.includes('"./assets/generated/content-r6/"'));for(const f of ['src/content-r6.js','src/content-r6.css'])assert(sw.includes(f));
});
console.log('VERIFIED content R6 '+groups+' rule groups');
