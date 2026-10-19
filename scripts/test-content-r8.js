'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const S=require('../src/state'),A=require('../src/adventure');let checks=0;
function test(n,f){f();checks++;console.log('PASS '+n);}
test('three actual gift histories preserve first/wrong/matched reactions and resources across migration',()=>{
 let s=S.defaultState(9000000);A.ensure(s,9000000);s.adventure.claimed.c1_first_harvest=true;s.adventure.meals.rustic_bread=12;s.storage.items={carrot:6,wild_berry:6};
 for(const[id,taste]of [['merchant','sour'],['elder','hot'],['child','sweet']]){
  for(const flavor of ['plain',taste==='sweet'?'sour':'sweet',taste]){const b=s.adventure.meals.rustic_bread;assert(A.deliverNeighbor(s,id,flavor,9000010).ok);assert.equal(s.adventure.meals.rustic_bread,b-1);s=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(s,9000020);}
  const h=s.adventure.neighbors[id].history;assert.deepEqual(h.map(x=>x.branch),['first','wrong','matched']);assert(h.every(x=>x.reaction.length>12));assert.notEqual(h[1].reaction,h[2].reaction);
 }
 assert(A.gathering(s,9000030).unlocked);
});
test('generated atlas, native dimensions, original prompts and offline precache match exact hashes',()=>{
 const m=JSON.parse(fs.readFileSync('assets/generated/content-r8/manifest.json')),p=JSON.parse(fs.readFileSync(m.prompts));
 assert.equal(m.tool,'image_gen.imagegen');assert.equal(m.actualModelSlug,null);assert.equal(m.assets.length,18);assert.equal(m.masters.length,2);assert.equal(p.stylePrefix,JSON.parse(fs.readFileSync('docs/art/PROMPTS_R89.json')).stylePrefix);assert(p.jobs.every(x=>x.prompt.startsWith(p.stylePrefix)));assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
 for(const a of [...m.assets,...m.masters]){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.path)).digest('hex'),a.sha256);if(m.assets.includes(a))assert(fs.readFileSync('sw.js','utf8').includes('./'+a.path));}
 assert(m.assets.filter(a=>a.kind.startsWith('fish')||a.kind==='water-frame').every(a=>a.width===128&&a.height===112));assert(m.assets.filter(a=>a.kind==='keepsake').every(a=>a.width===64&&a.height===64));
});
test('all impact windows and saved fish counts remain authoritative',()=>{
 for(const[roll,hit]of [[0,1950],[.5,2250],[.99,2050]]){let s=S.defaultState(9000000);A.ensure(s,9000000);s.adventure.projects.fishing_dock.restored=true;assert(A.startFishing(s,9000000,()=>roll).ok);assert(!A.reelFishing(s,9000001).ok);assert(A.startFishing(s,9000002,()=>roll).ok);const r=A.reelFishing(s,9000002+hit);assert(r.ok);s=S.migrate(JSON.parse(JSON.stringify(s)));A.ensure(s,9005000);assert.equal(s.adventure.catch[r.catch.id],1);assert(s.adventure.fishNotes[r.catch.id]);assert(!A.startFishing(s,9005000,()=>roll).ok);}
});
console.log('VERIFIED R8 '+checks+' groups');
