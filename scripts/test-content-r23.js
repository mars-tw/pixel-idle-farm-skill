'use strict';
const assert=require('node:assert/strict'),G=require('../src/game'),R=require('../src/content-r23');
const state=()=>({flags:{bridgeRepaired:true},player:{tileId:'t4_0'},map:{width:9,height:7,tiles:Array.from({length:63},(_,i)=>({id:`t${i%9}_${Math.floor(i/9)}`,x:i%9,y:Math.floor(i/9),terrain:'grass',region:'west'}))}});
const table={left:168,top:144,right:264,bottom:192};
{
 const s=state(),before=JSON.stringify(s),original=G.bfsPath(s,'t4_0','t4_6'),clear=R.deliveryTableMap(s,[table],48),path=G.bfsPath(clear,'t4_0','t4_6');
 assert(original.includes('t4_3'));assert(path&&path.length>original.length);assert(!path.includes('t4_3'));
 assert(path.every(id=>G.isWalkable(clear,clear.map.tiles.find(t=>t.id===id))));assert.equal(JSON.stringify(s),before);
 for(const id of path){const t=clear.map.tiles.find(t=>t.id===id),cx=(t.x+.5)*48,b=(t.y+.92)*48;assert(cx+19.2<=table.left||cx-19.2>=table.right||b+12<=table.top||b-4.8>=table.bottom);}
 console.log('PASS actual BFS detours around the visible table footprint without mutating game state');
}
{
 const s=state(),blocked=R.deliveryTableMap(s,[{left:0,top:130,right:432,bottom:230}],48);
 assert(G.bfsPath(s,'t4_0','t4_6'));assert.equal(G.bfsPath(blocked,'t4_0','t4_6'),null);
 assert.equal(s.map.tiles.find(t=>t.id==='t4_3').blocked,undefined);
 console.log('PASS an unavailable safe route stays unavailable instead of crossing the table');
}
{
 const s=state();s.map.tiles[1].blocked=true;assert.strictEqual(R.deliveryTableMap(s,[],48),s);
 const clear=R.deliveryTableMap(s,[table],48);assert.equal(clear.map.tiles[1].blocked,true);
 assert.throws(()=>R.deliveryTableMap(s,[table],0),TypeError);
 console.log('PASS absent tables preserve the existing map and existing obstacles remain blocked');
}
