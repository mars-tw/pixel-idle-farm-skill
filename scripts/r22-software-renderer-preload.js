'use strict';
// Test-only process preload. Every Chromium launch must prove SwiftShader before
// returning control to a test. Flags are inherited by Node child processes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=require('playwright');
const flags=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-compositing'];
let sequence=0;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const out=path.resolve(process.env.FARM_R22_RENDERER_DIR||'docs/content/r22/renderer');
fs.mkdirSync(out,{recursive:true});
function options(old={}){
 const args=(old.args||[]).filter(a=>!/^--(use-gl|use-angle|enable-unsafe-swiftshader|disable-gpu-compositing)(=|$)/.test(a));
 return {...old,args:[...args,...flags]};
}
async function prove(browser,context,kind,launchOptions){
 let owned,page,session,receipt={status:'EXECUTED',kind,pid:process.pid,command:process.argv,flags:launchOptions.args,preloadSha256:sha(__filename)};
 const filename=path.join(out,`${Date.now()}-${process.pid}-${++sequence}.json`);
 try{
  owned=context||await browser.newContext();page=await owned.newPage();
  const cdp=await (browser||context.browser()).newBrowserCDPSession();
  const info=await cdp.send('SystemInfo.getInfo');await cdp.detach();
  receipt.gpu=info.gpu;
  receipt.webgl=await page.evaluate(()=>{const c=document.createElement('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return null;const d=g.getExtension('WEBGL_debug_renderer_info');return {vendor:g.getParameter(d?d.UNMASKED_VENDOR_WEBGL:g.VENDOR),renderer:g.getParameter(d?d.UNMASKED_RENDERER_WEBGL:g.RENDERER)};});
  if(!/SwiftShader/i.test(receipt.webgl?.renderer||'')||!/SwiftShader/i.test(info.gpu.auxAttributes?.glRenderer||''))throw new Error('R22 software-renderer guard: actual WebGL and CDP renderer must both be SwiftShader');
  receipt.status='VERIFIED';console.log('VERIFIED CPU renderer '+receipt.webgl.renderer);
 }catch(e){receipt.status='BLOCKED';receipt.failure=e.stack;throw e;}
 finally{fs.writeFileSync(filename,JSON.stringify(receipt,null,2)+'\n');await page?.close();if(!context)await owned?.close();}
}
const launch=pw.chromium.launch.bind(pw.chromium),persistent=pw.chromium.launchPersistentContext.bind(pw.chromium);
pw.chromium.launch=async old=>{const opts=options(old),browser=await launch(opts);try{await prove(browser,null,'launch',opts);return browser;}catch(e){await browser.close();throw e;}};
pw.chromium.launchPersistentContext=async(dir,old)=>{const opts=options(old),context=await persistent(dir,opts);try{await prove(null,context,'launchPersistentContext',opts);return context;}catch(e){await context.close();throw e;}};
// The preload never permits an implicit browser engine change.
for(const name of ['firefox','webkit'])for(const method of ['launch','launchPersistentContext'])pw[name][method]=async()=>{throw new Error('R22 CPU proof supports Chromium SwiftShader only: '+name);};
