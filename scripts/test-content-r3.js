'use strict';
const assert = require('assert/strict'), fs = require('fs'), crypto = require('crypto');
const A = require('../src/adventure'), S = require('../src/state'), G = require('../src/game');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS '+name); }
const T = 4000000;
check('context recollections are earned, personal and do not reveal flavor answers', () => {
  const s=S.defaultState(T); A.ensure(s,T); s.adventure.claimed.c1_first_harvest=true; s.adventure.meals.rustic_bread=9; s.storage.items={carrot:3,wild_berry:3};
  assert(A.neighbors(s,T).every(n=>n.recallContext===null));
  const lines=[];
  for(const [id,taste] of [['merchant','sour'],['elder','hot'],['child','sweet']]) {
    const first=A.deliverNeighbor(s,id,'plain',T); assert(!first.neighbor.reaction.includes('上回')); assert(first.neighbor.recallContext.length>20);
    assert(!/酸|甜|熱|胡蘿蔔|野莓/.test(first.neighbor.recallContext));
    const wrong=A.deliverNeighbor(s,id,taste==='sweet'?'sour':'sweet',T+1); const right=A.deliverNeighbor(s,id,taste,T+2);
    lines.push(first.neighbor.reaction,wrong.neighbor.reaction,right.neighbor.reaction);
    assert(right.matched); assert.equal(right.neighbor.illustration,'assets/generated/content-r3/'+id+'.webp');
  }
  assert.equal(new Set(lines).size,9);
  const loaded=S.migrate(JSON.parse(JSON.stringify(s))); A.ensure(loaded,T+3);
  assert(A.neighbors(loaded,T+3).every(n=>n.lastMatched&&n.recallContext));
});
check('legacy inventory overflow is preserved and normal harvest still respects real capacity', () => {
  const s=S.defaultState(T); s.storage.items={wheat:20,carrot:6,wild_berry:6};
  const loaded=S.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(G.storageUsed(loaded),32); assert.equal(G.storageCapacity(loaded),30);
  assert.deepEqual(G.addToStorage(loaded,'wheat',1),{added:0,lost:1}); assert.equal(loaded.storage.items.wheat,20);
});
check('three generated dioramas have source hashes, exact R89 palette and offline entries', () => {
  const m=JSON.parse(fs.readFileSync('assets/generated/content-r3/manifest.json'));
  assert.equal(m.tool,'image_gen.imagegen'); assert.equal(m.actualModelSlug,null); assert.equal(m.assets.length,3);
  assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
  for(const r of [...m.assets,...m.masters,...m.references]) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(r.path)).digest('hex'),r.sha256,r.path);
  for(const r of m.assets) { assert.equal(r.width,512); assert.equal(r.height,256); }
  const sw=fs.readFileSync('sw.js','utf8'); assert(sw.includes('"./assets/generated/content-r3/"'));
});
console.log('VERIFIED content R3 '+passed+' rule groups');
