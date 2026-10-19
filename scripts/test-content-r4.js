'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),crypto=require('crypto');
const A=require('../src/adventure'),S=require('../src/state');
let groups=0;function test(name,fn){fn();groups++;console.log('PASS '+name);}
test('three earned recollections avoid flavor and ingredient names, matches remain unique after migration',()=>{
 const s=S.defaultState(5000000);A.ensure(s,5000000);s.adventure.claimed.c1_first_harvest=true;s.adventure.meals.rustic_bread=9;s.storage.items={carrot:4,wild_berry:4};const replies=[];
 for(const [id,taste] of [['merchant','sour'],['elder','hot'],['child','sweet']]){
  assert.equal(A.neighbors(s,5000000).find(n=>n.id===id).recallContext,null);
  A.deliverNeighbor(s,id,'plain',5000001);let n=A.neighbors(s,5000002).find(n=>n.id===id);
  assert(n.recallContext.length>=35);assert(!/甜|酸|熱|胡蘿蔔|野莓|小麥|麥餅|果子|烤好|那根菜/.test(n.recallContext));
  A.deliverNeighbor(s,id,taste,5000003);n=A.neighbors(s,5000004).find(n=>n.id===id);replies.push(n.reaction);assert(n.lastMatched);
  if(id==='child')assert(/空椅子/.test(n.story)&&/紅格書籤/.test(n.story)&&/壓好的花/.test(n.reaction));
 }
 assert.equal(new Set(replies).size,3);const loaded=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(loaded,5000005);assert.deepEqual(A.neighbors(loaded,5000005).map(n=>n.reaction),replies);
});
test('all fish require the actual impact window and persist unlocked notes with real cooldown',()=>{
 for(const roll of [0,.5,.99]){
  const s=S.defaultState(5000000);A.ensure(s,5000000);s.adventure.projects.fishing_dock.restored=true;
  A.startFishing(s,5000000,()=>roll);assert.equal(A.reelFishing(s,5000001).reason,'too_early');assert.equal(A.fishNotes(s,5000001).length,0);
  A.startFishing(s,5000002,()=>roll);const phase=A.observeFishingCast(s.adventure.fishingCast,5002302);assert.equal(phase.pose,'strike');
  const caught=A.reelFishing(s,5002302);assert(caught.ok);const loaded=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(loaded,5002303);
  assert(loaded.adventure.fishNotes[caught.catch.id]);assert.equal(A.startFishing(loaded,5002303,()=>roll).reason,'cooldown');assert(A.startFishing(loaded,5032302,()=>roll).ok);
 }
});
test('two generated images retain sources, exact R89 palette contract and offline cache entries',()=>{
 const m=JSON.parse(fs.readFileSync('assets/generated/content-r4/manifest.json'));assert.equal(m.tool,'image_gen.imagegen');assert.equal(m.actualModelSlug,null);assert.equal(m.assets.length,2);
 assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
 for(const x of [...m.assets,...m.masters,...m.references])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(x.path)).digest('hex'),x.sha256,x.path);
 for(const x of m.assets){assert.equal(x.width,512);assert.equal(x.height,256);}
 const jobs=JSON.parse(fs.readFileSync('docs/art/PROMPTS_CONTENT_R4.json'));assert.equal(jobs.stylePrefix,JSON.parse(fs.readFileSync('docs/art/PROMPTS_R89.json')).stylePrefix);
 assert(fs.readFileSync('sw.js','utf8').includes('"./assets/generated/content-r4/"'));
 assert.notEqual(m.assets[0].sha256,crypto.createHash('sha256').update(fs.readFileSync('assets/generated/content-r3/child.webp')).digest('hex'));
});
console.log('VERIFIED content R4 '+groups+' rule groups');
