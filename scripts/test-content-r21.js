'use strict';
const assert=require('node:assert/strict');
const A=require('../src/adventure.js');
const R17=require('../src/content-r17.js');
const rows=[];
function test(name,fn){fn();rows.push(name);console.log('PASS '+name);}

test('R21 child reply matches the seated plate pose and names one event',()=>{
  const regular=A.servingReply('child','sweet',false),shared=A.servingReply('child','sweet',true);
  assert.equal(regular,'圖圖捧著甜味點心：「上次甜味餐籃的滋味我還記得，這份也很好吃！」');
  assert.equal(shared,'圖圖捧著甜味點心：「上次甜味餐籃的滋味我還記得，剛才那盤也很好吃！」');
  for(const reply of [regular,shared])assert.doesNotMatch(reply,/高高舉手|留給晚到的朋友|剛才大家分食的那盤/);
  assert.notEqual(regular,shared,'shared tasting receives its own one-sentence line');
});

test('R21 landing cue chooses a free, in-scene slot when nearby positions are covered',()=>{
  const marker={left:120,top:100,right:164,bottom:121,width:44,height:21};
  const size={width:100,height:24};
  const blockers=[
    {left:92,top:70,right:192,bottom:100},
    {left:160,top:98,right:260,bottom:123},
    {left:14,top:98,right:114,bottom:124},
  ];
  const bounds={left:0,top:80,right:320,bottom:500};
  const placed=R17.goalLabelPlacement(marker,size,blockers,bounds);
  assert.ok(placed);
  assert.equal(placed.side,'below');
  assert.ok(placed.left>=bounds.left&&placed.right<=bounds.right);
  assert.ok(placed.top>=bounds.top&&placed.bottom<=bounds.bottom);
  assert.ok(blockers.every(b=>!R17.overlaps(placed,b)));
});

test('R21 landing cue returns no position when every candidate overlaps a blocker',()=>{
  const marker={left:120,top:100,right:164,bottom:121,width:44,height:21};
  const size={width:100,height:24};
  const bounds={left:0,top:80,right:320,bottom:160};
  const blocked=[{left:0,top:80,right:320,bottom:160}];
  assert.equal(R17.goalLabelPlacement(marker,size,blocked,bounds),null);
});

console.log(`VERIFIED R21 ${rows.length} deterministic checks`);
