'use strict';
const assert=require('node:assert/strict'),S=require('../src/state'),G=require('../src/game'),R=require('../src/content-r17'),R16=require('../src/content-r16');
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('every timing and recognition combination has one unambiguous conclusion',()=>{
 for(const fish of ['river_carp','silver_dace','river_perch'])for(const timing of ['early','perfect','late'])for(const correct of [true,false]){
  const r=R.result(timing,correct),text=JSON.stringify(r);assert.equal(r.success,timing==='perfect'&&correct);assert.equal((r.conclusion.match(/本竿/g)||[]).length,1);
  if(timing!=='perfect'){assert(!text.includes('認對了'));assert(!r.success);assert(r.conclusion.includes('未完成'));}
  assert(r.time);assert(r.recognition);assert(fish);
 }
 assert.throws(()=>R.result('bad',true));assert.equal(R.result('late').recognition,'辨魚：尚未選擇');
});
test('ground guides reject blocked tiles and roof overlap without mutating the map',()=>{
 const s=S.defaultState(100000),before=JSON.stringify(s);let open=0,blocked=0;
 for(const t of s.map.tiles){const rect={left:t.x*10,right:t.x*10+8,top:t.y*10,bottom:t.y*10+8};assert.equal(R.groundMarker(s,t,rect,[],G.isWalkable),G.isWalkable(s,t));if(G.isWalkable(s,t)){open++;assert(!R.groundMarker(s,t,rect,[rect],G.isWalkable));assert(R.groundMarker(s,t,rect,[{left:-20,right:-10,top:-20,bottom:-10}],G.isWalkable));}else blocked++;}
 assert(open>100&&blocked>20);assert.equal(JSON.stringify(s),before);
});
test('every table lane has distinct lift, mid and hand-side endpoints',()=>{
 for(const id of Object.keys(R.plates.end)){const a=R.plates.start,b=R.plates.lanes[id],c=R.plates.end[id];assert.notDeepEqual(a,b);assert.notDeepEqual(b,c);assert.notDeepEqual(c,R.plates.shared);assert(b[0]>=Math.min(a[0],c[0])-30&&b[0]<=Math.max(a[0],c[0])+30);}
 assert(R.received('圖圖','甜味胡蘿蔔點心').includes('接到手邊'));assert.doesNotMatch(R.received('圖圖','甜味胡蘿蔔點心'),/喝茶|喝一口茶|高高舉手/);assert(!R.received('圖圖','甜味胡蘿蔔點心').includes('嚐了一口'));
});
test('invitation text names both participants and still rejects a second invite',()=>{
 assert(R16.replies.child.includes('米莉'));assert(!R16.replies.child.includes('朋友也坐下'));
 const s=S.defaultState(100000);assert(!R16.invite(s,'child',100001).ok);
});
console.log('VERIFIED R17 '+count+' groups');
