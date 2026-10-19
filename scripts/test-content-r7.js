'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const S=require('../src/state'),A=require('../src/adventure');
const T=9000000;let checks=0;
const people=[['merchant','sour'],['elder','hot'],['child','sweet']];
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function fresh(){const s=S.defaultState(T);A.ensure(s,T);s.adventure.claimed.c1_first_harvest=true;s.adventure.meals.rustic_bread=20;s.storage.items={carrot:8,wild_berry:8};s.adventure.projects.fishing_dock.restored=true;return s;}
function reload(s){s=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(s,T+100);return s;}
test('each real delivery branches into a different kept place; all three survive reload',()=>{
 let s=fresh();for(const[id,taste]of people){const bread=s.adventure.meals.rustic_bread;assert(A.deliverNeighbor(s,id,'plain',T).ok);assert(A.deliverNeighbor(s,id,'plain',T+1).ok);let n=A.neighbors(s,T+1).find(n=>n.id===id);assert(!n.lastMatched);assert(n.memory.wrong);assert(A.deliverNeighbor(s,id,taste,T+2).ok);assert.equal(s.adventure.meals.rustic_bread,bread-3);s=reload(s);n=A.neighbors(s,T+100).find(n=>n.id===id);assert(n.lastMatched&&n.matched);}
 for(const key of ['heading','token','detail','reply','wrong'])assert.equal(new Set(A.neighbors(s,T+100).map(n=>n.memory[key])).size,3,key);
 assert(A.gathering(s,T+100).unlocked);
 for(const[id,taste]of people){const b=s.adventure.meals.rustic_bread;assert(A.packGathering(s,id,taste,T+100).ok);s=reload(s);assert.equal(s.adventure.meals.rustic_bread,b-1);assert.equal(A.gathering(s,T+100).packed[id],taste);assert(!A.packGathering(s,id,taste,T+101).ok);}
 assert(A.completeGathering(s,T+102).ok);s=reload(s);assert(A.gathering(s,T+103).completed);assert(!A.completeGathering(s,T+104).ok);
});
test('observed motions and saved reel gates agree on early, impact and late frames',()=>{
 for(const[id,roll,early,hit,late,motion]of [['river_carp',0,1750,1950,3180,'closed-rings'],['silver_dace',.5,2100,2250,3100,'short-splash'],['river_perch',.99,1700,2050,3100,'straight-wake']])for(const[ms,success]of[[early,false],[hit,true],[late,false]]){let s=fresh();assert(A.startFishing(s,T,()=>roll).ok);s.adventure.fishingCast.observationVersion=2;s=reload(s);const p=A.observeFishingCast(s.adventure.fishingCast,T+ms);if(success)assert.equal(p.motion,motion);assert.equal(A.reelFishing(s,T+ms).ok,success);s=reload(s);assert.equal(s.adventure.catch[id],+success);assert.equal(!!s.adventure.fishNotes[id],success);}
});
test('all generated and reused poses have exact hashes, sizes and explicit offline entries',()=>{
 const m=JSON.parse(fs.readFileSync('assets/generated/content-r7/manifest.json'));assert.equal(m.tool,'image_gen.imagegen');assert.equal(m.actualModelSlug,null);assert.equal(m.masters.length,2);assert.equal(m.assets.length,14);assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
 const prompts=JSON.parse(fs.readFileSync('docs/art/PROMPTS_CONTENT_R7.json')),prefix=JSON.parse(fs.readFileSync('docs/art/PROMPTS_R89.json')).stylePrefix;assert.equal(prompts.stylePrefix,prefix);assert(prompts.jobs.every(j=>j.prompt.startsWith(prefix)));assert.equal(m.generatedOutputs,10);assert.equal(m.retainedDerivatives,4);
 for(const f of [...m.masters,...m.assets]){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex'),f.sha256);if(m.assets.includes(f)&&!f.path.endsWith('trace-flower.png')&&!f.path.endsWith('quiet-water.webp')){assert.equal(f.width,48);assert.equal(f.height,64);}}
 for(const f of m.assets.filter(f=>f.sourceSha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f.source)).digest('hex'),f.sourceSha256);
 for(const[id]of people)assert.notEqual(m.assets.find(f=>f.path.endsWith('sit-'+id+'.png')).sha256,m.assets.find(f=>f.path.endsWith('eat-'+id+'.png')).sha256);
 assert(fs.readFileSync('sw.js','utf8').includes("./assets/generated/content-r7/"));
 for(const f of ['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json',...fs.readdirSync('src').filter(x=>/\.(js|css)$/.test(x)).map(x=>'src/'+x)])assert(!fs.readFileSync(f,'utf8').includes('content-r6-20261019-1'),'stale runtime version '+f);
});
console.log('VERIFIED content R7 '+checks+' groups');
