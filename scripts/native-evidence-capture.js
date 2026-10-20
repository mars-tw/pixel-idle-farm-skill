/* Native viewport PNG, no resampling, animation suppression or game-clock changes. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),sessions=new WeakMap();
async function captureNative(page,file){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight,dpr:devicePixelRatio}));
 if(viewport.dpr>1){await page.screenshot({path:file,fullPage:false,scale:'device'});}
 else{
  let session=sessions.get(page);if(!session){session=await page.context().newCDPSession(page);sessions.set(page,session);}
  const result=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true,optimizeForSpeed:true});
  fs.writeFileSync(file,Buffer.from(result.data,'base64'));
 }
 const png=fs.readFileSync(file);assert.equal(png.readUInt32BE(16),Math.round(viewport.w*viewport.dpr));assert.equal(png.readUInt32BE(20),Math.round(viewport.h*viewport.dpr));
}
module.exports={captureNative};
