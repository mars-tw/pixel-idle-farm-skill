/* R17 presentation contracts: read-only outcomes, ground guides and table lanes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ContentR17=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 function groundMarker(state,tile,rect,blockers,walkable){return !!tile&&walkable(state,tile)&&!blockers.some(b=>overlaps(rect,b));}
 function goalLabelPlacement(marker,size,blockers,bounds){
  const cx=marker.left+marker.width/2,cy=marker.top+marker.height/2,gap=6;
  const rect=(left,top,side)=>({left,top,right:left+size.width,bottom:top+size.height,side});
  const candidates=[
   rect(cx-size.width/2,marker.top-size.height-gap,'above'),
   rect(marker.right+gap,cy-size.height/2,'right'),
   rect(marker.left-size.width-gap,cy-size.height/2,'left'),
   rect(cx-size.width/2,marker.bottom+gap,'below'),
   rect(marker.left-size.width-gap,marker.top-size.height-gap,'upper-left'),
   rect(marker.right+gap,marker.top-size.height-gap,'upper-right'),
   rect(marker.left-size.width-gap,marker.bottom+gap,'lower-left'),
   rect(marker.right+gap,marker.bottom+gap,'lower-right'),
  ];
  // Search a short radius around the marker before hiding the cue. A solid
  // label plate can sit over grass; it must still avoid people and the HUD.
  const directions=[[0,-1],[1,0],[-1,0],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]];
  for(const radius of [size.height+gap,size.height*2,size.width*.75,size.width])for(const [dx,dy] of directions)
   candidates.push(rect(cx+dx*radius-size.width/2,cy+dy*radius-size.height/2,'nearby'));
  return candidates.find(r=>r.left>=bounds.left+2&&r.right<=bounds.right-2&&r.top>=bounds.top+2&&r.bottom<=bounds.bottom-2&&!blockers.some(b=>overlaps(r,b)))||null;
 }
 function result(timing,correct){
  const time={early:'太早・尚未咬穩',perfect:'剛好・咬穩提竿',late:'錯過・水紋散開'}[timing];
  if(!time)throw new Error('Unknown fishing timing');
  const answered=typeof correct==='boolean',success=timing==='perfect'&&correct===true;
  return {time,success,conclusion:!answered?'選出剛才的魚，再看結果':success?'本竿成功':timing==='perfect'?'本竿未完成・辨魚不同':timing==='early'?'本竿未完成・提竿太早':'本竿未完成・提竿晚了',recognition:!answered?'辨魚：尚未選擇':timing==='perfect'?(correct?'辨魚：認對了':'辨魚：認錯了'):(correct?'水形核對：與答案一致':'水形核對：與答案不同')};
 }
 // Native layout coordinates. The food stays beside the hand, below the face.
 const plates={start:[110,202],lanes:{merchant:[109,151],elder:[164,151],child:[191,211]},end:{merchant:[107,100],elder:[218,100],child:[273,220]},shared:[158,141]};
  const received=(name,food)=>name+'把'+food+'接到手邊。';
 function platePosition(id,p){const points=id==='elder'?[plates.start,[232,210],[232,100],plates.end[id]]:id==='merchant'?[plates.start,[100,150],plates.end[id]]:[plates.start,plates.end[id]],u=Math.max(0,Math.min(.999999,p))*(points.length-1),i=Math.floor(u),f=u-i;if(p>=1)return plates.end[id].slice();return points[i].map((v,k)=>v+(points[i+1][k]-v)*f);}
 return {overlaps,groundMarker,goalLabelPlacement,result,plates,platePosition,received};
});
