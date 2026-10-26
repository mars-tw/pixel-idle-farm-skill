'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
// Exact generated native alpha and phase-specific water marks. No color fish body.
async function verifyWaterPixels(page,id,frame){
 const round='content-r13';
 const file=`assets/generated/${round}/${id}-shadow.png`,m=JSON.parse(fs.readFileSync(`assets/generated/${round}/manifest.json`));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),m.derived.find(a=>a.path===file).sha256);
 const generated=JSON.parse(fs.readFileSync('assets/generated/content-r18/manifest.json'));
 for(const a of generated.frames)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.file)).digest('hex'),a.sha256);
 const current=JSON.parse(fs.readFileSync('assets/generated/content-r19/manifest.json'));for(const a of current.frames)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.file)).digest('hex'),a.sha256);
 const r=await page.locator('.pond-effects').evaluate(async(c,{id,frame,file})=>{
  // Snapshot both pixels and their source index before awaiting image decode;
  // the live water continues animating while the reference is constructed.
  const actual=c.getContext('2d').getImageData(0,0,c.width,c.height).data,source=c.dataset.generatedWater,actualFrame=c.dataset.frame;
  const i=new Image();i.src=file+(window.FARM_VERSION_QUERY||'');await i.decode();const ref=document.createElement('canvas');ref.width=128;ref.height=112;const ctx=ref.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(i,46,52,35,31);
  const ink=ctx.getImageData(0,0,ref.width,ref.height);for(let k=0;k<ink.data.length;k+=4){if(ink.data[k+3]){ink.data[k]=41;ink.data[k+1]=61;ink.data[k+2]=70;ink.data[k+3]=Math.round(ink.data[k+3]*.65);}}ctx.putImageData(ink,0,0);
  const water=new Image();water.src=source?'assets/generated/'+(id==='river_carp'?'content-r19':'content-r18')+'/'+source+'.png'+(window.FARM_VERSION_QUERY||''):'assets/generated/'+(c.dataset.waterFrame==='wide-1'?'content-r15':'content-r12')+'/'+c.dataset.waterFrame+'.png'+(window.FARM_VERSION_QUERY||'');await water.decode();const xy=source?[16,0,96,72]:{river_carp:[18,8,92,48],silver_dace:[47,1,35,66],river_perch:[12,15,105,35]}[id];ctx.globalAlpha=.82;ctx.drawImage(water,...xy);ctx.globalAlpha=1;
  const a=actual,b=ref.getContext('2d').getImageData(0,0,ref.width,ref.height).data;
  let mismatch=0,opaque=0;for(let k=0;k<a.length;k++){if(a[k]!==b[k])mismatch++;if(k%4===3&&a[k])opaque++;}
  return{frame:actualFrame,w:c.width,h:c.height,mismatch,opaque,smoothing:c.getContext('2d').imageSmoothingEnabled};
 },{id,frame,file});
 assert.deepEqual({frame:r.frame,w:r.w,h:r.h,mismatch:r.mismatch,smoothing:r.smoothing},{frame:id+'-'+frame,w:128,h:112,mismatch:0,smoothing:false});assert(r.opaque>400);
 return true;
}
module.exports={verifyWaterPixels};
