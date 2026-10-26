/* R23: immutable delivery-only table clearance in native world coordinates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ContentR23=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 function deliveryTableMap(state,tables,size){
  if(!Number.isFinite(size)||size<=0)throw new TypeError('A positive native tile size is required');
  const rects=tables.filter(r=>[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top);
  if(!rects.length)return state;
  const tiles=state.map.tiles.map(t=>{
   // Include articulated boot width and the existing -86% player root anchor.
   // This changes the delivery plan only; save tiles and colliders stay intact.
   const cx=(t.x+.5)*size,baseline=(t.y+.92)*size;
   const feet={left:cx-size*.65,right:cx+size*.65,top:baseline-size*.35,bottom:baseline+size*.4};
   return rects.some(r=>overlap(feet,r))?{...t,blocked:true}:t;
  });
  return {...state,map:{...state.map,tiles}};
 }
 return {deliveryTableMap};
});
