'use strict';
const assert=require('assert/strict'),fs=require('fs'),crypto=require('crypto');
const A=require('../src/adventure'),S=require('../src/state');let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
const T=3000000;
check('three residents have distinct first, wrong, matched replies and persist exact latest taste',()=>{
 for(const [id,taste]of [['merchant','sour'],['elder','hot'],['child','sweet']]){
  const s=S.defaultState(T);A.ensure(s,T);s.adventure.claimed.c1_first_harvest=true;s.adventure.meals.rustic_bread=3;s.storage.items.carrot=3;s.storage.items.wild_berry=3;
  const first=A.deliverNeighbor(s,id,'plain',T),wrong=A.deliverNeighbor(s,id,taste==='sweet'?'sour':'sweet',T+1),right=A.deliverNeighbor(s,id,taste,T+2);
  assert.notEqual(first.neighbor.reaction,wrong.neighbor.reaction);assert.notEqual(wrong.neighbor.reaction,right.neighbor.reaction);assert(right.matched);
  const loaded=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(loaded,T+3);const n=A.neighbors(loaded,T+3).find(n=>n.id===id);assert.equal(n.reaction,right.neighbor.reaction);assert.equal(n.illustration,'assets/generated/content-r3/'+id+'.webp');
 }
});
check('read-only animation observation agrees with reel eligibility on every phase boundary without mutating saves',()=>{
 for(const [roll,end]of [[0,3180],[.5,3600],[.99,3100]]){
  const s=S.defaultState(T);A.ensure(s,T);s.adventure.projects.fishing_dock.restored=true;A.startFishing(s,T,()=>roll);
  const unchanged=JSON.stringify(s);for(let ms=0;ms<=end+1;ms++){const visual=A.observeFishingCast(s.adventure.fishingCast,T+ms);assert(visual&&['still','tap','pull','strike','missed'].includes(visual.pose));}assert.equal(JSON.stringify(s),unchanged);
  for(const ms of [0,649,650,899,900,1179,1180,1249,1250,1599,1600,1879,1880,1999,2000,2199,2200,end-1,end]){
   const copy=JSON.parse(unchanged),pose=A.observeFishingCast(copy.adventure.fishingCast,T+ms).pose;assert.equal(A.reelFishing(copy,T+ms).ok,pose==='strike');
  }
 }
});
check('three new notebook images have exact palette, source hashes and offline cache entries',()=>{
 const m=JSON.parse(fs.readFileSync('assets/generated/content-r2/manifest.json'));assert.equal(m.tool,'image_gen.imagegen');assert.equal(m.assets.length,6);
 assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
 for(const f of [...m.masters,...m.assets])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex'),f.sha256,f.path);
 const sw=fs.readFileSync('sw.js','utf8');for(const n of ['river_carp','silver_dace','river_perch'])assert(sw.includes('"'+n+'.webp"'));
});
console.log('VERIFIED content R2 '+passed+' rule groups');
