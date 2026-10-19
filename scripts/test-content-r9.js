'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const S=require('../src/state'),A=require('../src/adventure');let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('new generated poses have complete source hashes, exact R89 palette and offline URLs',()=>{
 const m=JSON.parse(fs.readFileSync('assets/generated/content-r9/manifest.json')),p=JSON.parse(fs.readFileSync(m.prompts));
 assert.equal(m.tool,'image_gen.imagegen');assert.equal(m.actualModelSlug,null);assert.equal(m.assets.length,24);assert.equal(m.masters.length,1);assert.equal(p.stylePrefix,JSON.parse(fs.readFileSync('docs/art/PROMPTS_R89.json')).stylePrefix);assert(p.jobs.every(j=>j.prompt.startsWith(p.stylePrefix)));
 assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
 for(const a of [...m.assets,...m.masters])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.path)).digest('hex'),a.sha256);
 for(const a of m.assets){assert.equal(a.width,48);assert.equal(a.height,64);assert(fs.existsSync(a.path));}
 const sw=fs.readFileSync('sw.js','utf8');assert(sw.includes('./src/content-r9.css'));assert(sw.includes('"./assets/generated/content-r9/"+p+"-"+id+".png"'));
 execFileSync('python',['tools/verify-content-r9-pixels.py'],{stdio:'inherit'});
});
test('three gifts consume only once, all branches migrate and three baskets unlock permanent gathering',()=>{
 let s=S.defaultState(9000000);A.ensure(s,9000000);s.adventure.claimed.c1_first_harvest=true;s.adventure.meals.rustic_bread=12;s.storage.items={carrot:5,wild_berry:5};
 for(const[id,taste]of [['merchant','sour'],['elder','hot'],['child','sweet']]){
  for(const flavor of ['plain',taste==='sweet'?'sour':'sweet',taste]){const before=s.adventure.meals.rustic_bread;assert(A.deliverNeighbor(s,id,flavor,9000010).ok);assert.equal(s.adventure.meals.rustic_bread,before-1);s=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(s,9000011);}
  assert.deepEqual(s.adventure.neighbors[id].history.map(h=>h.branch),['first','wrong','matched']);assert(s.adventure.neighbors[id].history[1].reaction);
 }
 for(const[id,taste]of [['merchant','sour'],['elder','hot'],['child','sweet']])assert(A.packGathering(s,id,taste,9000020).ok);
 assert(A.completeGathering(s,9000030).ok);assert(!A.completeGathering(s,9000031).ok);s=S.migrate(JSON.parse(JSON.stringify(s)));assert(A.gathering(s,9000040).completed);assert.equal(s.adventure.meals.rustic_bread,0);
});
test('three real hitboxes keep early/late failures and first/repeat notebook counts authoritative',()=>{
 const s=S.defaultState(9000000);A.ensure(s,9000000);s.adventure.projects.fishing_dock.restored=true;let t=9000000;
 for(const[roll,hit,late]of [[0,1950,3181],[.5,2250,3101],[.99,2050,3101]]){
  A.startFishing(s,t,()=>roll);s.adventure.fishingCast.observationVersion=2;assert(!A.reelFishing(s,t+1).ok);
  A.startFishing(s,t+2,()=>roll);s.adventure.fishingCast.observationVersion=2;assert(!A.reelFishing(s,t+2+late).ok);
  A.startFishing(s,t+late+3,()=>roll);s.adventure.fishingCast.observationVersion=2;assert(A.observeFishingCast(s.adventure.fishingCast,t+late+3+hit).canReel);assert(A.reelFishing(s,t+late+3+hit).ok);t+=40000;
 }
 assert.equal(Object.values(s.adventure.catch).reduce((a,b)=>a+b),3);assert.equal(A.fishNotes(s,t).length,3);
 A.startFishing(s,t,()=>0);assert(A.reelFishing(s,t+1950).ok);assert.equal(A.fishNotes(s,t+1950).length,3);assert.equal(s.adventure.catch.river_carp,2);
 const loaded=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(loaded,t+2000);assert.deepEqual(loaded.adventure.catch,s.adventure.catch);assert.equal(A.fishNotes(loaded,t+2000).length,3);
});
console.log('VERIFIED R9 '+checks+' groups');
