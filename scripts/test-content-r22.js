'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),R=require('../src/content-r17'),A=require('../src/adventure');
const source=fs.readFileSync('src/content-r6.js','utf8');
for(const who of ['蘿拉','班伯','圖圖']){
 const received=R.received(who,'甜味胡蘿蔔點心');assert.equal(received,who+'把甜味胡蘿蔔點心接到手邊。');assert.doesNotMatch(received,/喝|舉手/);
}
console.log('PASS received captions describe only the actual handover');
const s=JSON.parse(fs.readFileSync('docs/content/r21/completed-save.json','utf8'));
assert.deepEqual(A.gatheringPortions(s,Date.now()).map(p=>({taste:p.taste,remaining:p.remaining})),[{taste:'sour',remaining:0},{taste:'hot',remaining:0},{taste:'sweet',remaining:0}]);
// ensure() may normalize legacy shape once; the journal is separately checked
// in the browser against the live UI-earned state and material snapshots.
assert(s.adventure.gathering.invitation==null);assert.equal(s.adventure.gathering.refills.length,1);
console.log('PASS actual R21 counterexample has zero portions despite one sour refill');
const marker={left:100,top:100,right:144,bottom:121,width:44,height:21},bounds={left:0,top:0,right:400,bottom:400};
assert.equal(R.goalLabelPlacement(marker,{width:100,height:26},[{left:0,top:0,right:400,bottom:400}],bounds),null);
const table={left:80,top:70,right:240,bottom:160},slot=R.goalLabelPlacement(marker,{width:100,height:26},[table],bounds);assert(slot&&!R.overlaps(slot,table));
console.log('PASS a real table rectangle is avoided and full occlusion requests fallback');
assert.doesNotMatch(source,/下次邀請先預留|邀請對象尚未指定|為下次邀請預留/);
const currentVersion=JSON.parse(fs.readFileSync('package.json','utf8')).appVersion;
for(const name of ['index.html',...fs.readdirSync('src').filter(n=>/\.(css|js)$/.test(n)).map(n=>'src/'+n)])for(const match of fs.readFileSync(name,'utf8').matchAll(/\?v=(content-[\w.-]+)/g))assert.equal(match[1],currentVersion,name+' embedded asset query must match the SW precache version');
console.log('PASS every active embedded asset query uses the current offline-cache version');
console.log('VERIFIED R22 caption, existing portion authority and geometry contracts');
