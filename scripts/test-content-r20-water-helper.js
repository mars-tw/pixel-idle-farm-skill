'use strict';
const assert=require('node:assert/strict');
// Inspect rendered pixels rather than trusting a data-* label or the prose.
async function auditWater(page,id,report){
 await page.waitForFunction(id=>document.querySelector('.pond-effects')?.dataset.generatedWater===id+'-2',id);
 const row=await page.locator('.pond-effects').evaluate((c,id)=>{
  const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data,points=[];
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(data[i+3]>100)points.push([x,y,data[i],data[i+1],data[i+2]]);}
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),bounds={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
  const r=c.getBoundingClientRect(),pane=c.closest('.blind-practice'),text=pane.querySelector('.practice-reveal').textContent;
  // Two spatially separate elliptical bands with highlights in multiple sectors.
  // At frame 2 the generated rings occupy these native-canvas radial bands.
  const rings=[[16,26],[30,43]].map(([lo,hi])=>{
   const sectors=new Set();let pixels=0;
   for(const[x,y,red,green]of points){if(red<145||green<120)continue;const dx=x-64,dy=(y-37)/.60,rad=Math.hypot(dx,dy);if(rad>=lo&&rad<=hi){pixels++;sectors.add(Math.floor((Math.atan2(dy,dx)+Math.PI)/(2*Math.PI)*16));}}
   return{lo,hi,pixels,sectors:sectors.size};
  });
  const bright=points.filter(p=>Math.max(p[2],p[3],p[4])>=170);
  const upper=bright.filter(p=>p[1]<24),lower=bright.filter(p=>p[1]>42);
  return{id,frame:c.dataset.generatedWater,bounds,widthPx:(bounds.right-bounds.left)*r.width/c.width,heightPx:(bounds.bottom-bounds.top)*r.height/c.height,rings,upper:upper.length,lower:lower.length,text,revealed:pane.dataset.revealed==='true',fishPictures:pane.querySelectorAll('.practice-fish').length,points:points.length};
 },id);
 assert(row.points>300&&row.widthPx>=70&&row.heightPx>=40,JSON.stringify(row));
 assert.equal(row.fishPictures,row.revealed?1:0,'no answer picture before choosing');
 if(id==='river_carp'){assert(row.rings.every(r=>r.pixels>=8&&r.sectors>=5),'two visible broken rings: '+JSON.stringify(row));if(row.revealed)assert.match(row.text,/圓環向外擴散/);}
 if(id==='silver_dace'){assert(row.upper>=10&&row.bounds.top<15,'rising spray and droplets: '+JSON.stringify(row));if(row.revealed)assert.match(row.text,/窄水花向上/);}
 if(id==='river_perch'){assert(row.widthPx>row.heightPx*1.6,'long lateral wake: '+JSON.stringify(row));if(row.revealed)assert.match(row.text,/尾流斜向一側/);}
 (report.waterPixelAudits||=[]).push(row);return row;
}
async function auditMotion(page,id,report){
 const samples=[];
 for(let frame=0;frame<4;frame++){
  const row=await page.waitForFunction(({id,frame})=>{
   const c=document.querySelector('.pond-effects');if(c?.dataset.generatedWater!==id+'-'+frame)return false;
   const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data,points=[];
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(a[i+3]>100)points.push([x,y]);}
   return{frame,left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),radius:Math.max(...points.map(([x,y])=>Math.hypot(x-64,(y-37)/.6))),bobberX:parseFloat(c.parentElement.style.getPropertyValue('--bobber-x'))};
  },{id,frame},{polling:'raf'});samples.push(await row.jsonValue());await row.dispose();
 }
 (report.waterMotionAudits||=[]).push({id,samples});
 if(id==='river_carp')assert(samples[3].radius>samples[2].radius+5,'actual ring radius grows between successive broad frames: '+JSON.stringify(samples));
 if(id==='silver_dace')assert(samples[1].top<samples[0].top-12&&samples[3].top>samples[1].top+8,'actual spray rises then droplets fall back: '+JSON.stringify(samples));
 if(id==='river_perch')assert(samples[3].right>samples[0].right+5&&samples[3].bobberX>samples[0].bobberX+20,'wake tip and bobber both move laterally: '+JSON.stringify(samples));
}
module.exports={auditWater,auditMotion};
