'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const S = require('../src/state'), A = require('../src/adventure');
let groups = 0;
function test(name, fn) { fn(); groups++; console.log('PASS ' + name); }
test('all three earned memories preserve first, wrong and matched branches across save migration', () => {
  const s = S.defaultState(5000000); A.ensure(s, 5000000);
  s.adventure.claimed.c1_first_harvest = true; s.adventure.meals.rustic_bread = 9;
  s.storage.items = {carrot:4, wild_berry:4};
  const replies = [];
  for (const [id, taste, objects] of [['merchant','sour',['秤','凳子']],['elder','hot',['魚竿','盤子']],['child','sweet',['空椅子','花']]]) {
    const first = A.deliverNeighbor(s,id,'plain',5000001); assert(first.ok && first.firstDelivery && !first.matched);
    let n = A.neighbors(s,5000002).find(n=>n.id===id);
    assert(!/甜|酸|熱|胡蘿蔔|野莓|小麥|麥餅|果子/.test(n.recallContext));
    const wrong = A.deliverNeighbor(s,id,taste==='sweet'?'sour':'sweet',5000003); assert(wrong.ok && !wrong.matched);
    const correct = A.deliverNeighbor(s,id,taste,5000004); assert(correct.ok && correct.matched);
    const loaded=S.migrate(JSON.parse(JSON.stringify(s))); A.ensure(loaded,5000005);
    n=A.neighbors(loaded,5000006).find(n=>n.id===id);
    assert(n.lastMatched && n.deliveries===3);
    for(const object of objects) assert(n.story.includes(object) && n.reaction.includes(object),id+' '+object);
    assert(n.story.includes('紅格書籤') && n.reaction.includes('紅格書籤'));
    assert.notEqual(n.reply, first.neighbor.reply); replies.push(n.reaction);
  }
  assert.equal(new Set(replies).size,3); assert.equal(s.adventure.meals.rustic_bread,0);
});
test('new return-visit art retains built-in provenance, exact palette, matching prompts and precache', () => {
  const m=JSON.parse(fs.readFileSync('assets/generated/content-r5/manifest.json'));
  assert.equal(m.tool,'image_gen.imagegen'); assert.equal(m.actualModelSlug,null); assert.equal(m.assets.length,2);
  assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
  assert.equal(JSON.parse(fs.readFileSync(m.prompts)).stylePrefix,JSON.parse(fs.readFileSync('docs/art/PROMPTS_R89.json')).stylePrefix);
  for(const x of [...m.assets,...m.masters,...m.references]) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(x.path)).digest('hex'),x.sha256,x.path);
  for(const x of m.assets) {assert.equal(x.width,512);assert.equal(x.height,256);}
  assert(fs.readFileSync('sw.js','utf8').includes('"./assets/generated/content-r5/"'));
});
console.log('VERIFIED content R5 '+groups+' rule groups');
