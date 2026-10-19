'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
// Exact generated native alpha and phase-specific water marks. No color fish body.
async function verifyWaterPixels(page,id,frame){
 const round='content-r13';
 const file=`assets/generated/${round}/${id}-shadow.png`,m=JSON.parse(fs.readFileSync(`assets/generated/${round}/manifest.json`));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),m.derived.find(a=>a.path===file).sha256);
 const r=await page.locator('.pond-effects').evaluate(async(c,{id,frame,file})=>{
  const i=new Image();i.src=file+(window.FARM_VERSION_QUERY||'');await i.decode();const ref=document.createElement('canvas');ref.width=128;ref.height=112;const ctx=ref.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(i,25,31,78,68);
  const ink=ctx.getImageData(0,0,ref.width,ref.height);for(let k=0;k<ink.data.length;k+=4){if(ink.data[k+3]){ink.data[k]=41;ink.data[k+1]=61;ink.data[k+2]=70;ink.data[k+3]=Math.round(ink.data[k+3]*.95);}}ctx.putImageData(ink,0,0);
  const water=new Image();water.src='assets/generated/content-r12/'+c.dataset.waterFrame+'.png'+(window.FARM_VERSION_QUERY||'');await water.decode();const xy={river_carp:[18,12,92,31],silver_dace:[47,1,35,66],river_perch:[12,15,105,35]}[id];ctx.globalAlpha=.82;ctx.drawImage(water,...xy);ctx.globalAlpha=1;
  const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data,b=ref.getContext('2d').getImageData(0,0,ref.width,ref.height).data;
  let mismatch=0,opaque=0;for(let k=0;k<a.length;k++){if(a[k]!==b[k])mismatch++;if(k%4===3&&a[k])opaque++;}
  return{frame:c.dataset.frame,w:c.width,h:c.height,mismatch,opaque,smoothing:c.getContext('2d').imageSmoothingEnabled};
 },{id,frame,file});
 assert.deepEqual({frame:r.frame,w:r.w,h:r.h,mismatch:r.mismatch,smoothing:r.smoothing},{frame:id+'-'+frame,w:128,h:112,mismatch:0,smoothing:false});assert(r.opaque>400);
 return true;
}
module.exports={verifyWaterPixels};
