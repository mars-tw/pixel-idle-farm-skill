'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=process.cwd(),stamp=new Date().toISOString().replace(/[:.]/g,'-'),base=path.join('docs/content/r23/full-runs',stamp);
if(!(process.env.NODE_OPTIONS||'').includes('r22-software-renderer-preload'))throw new Error('R22 E2E requires the CPU-renderer preload; use r22-run-command.js');
const filter=process.env.FARM_R22_ONLY,plan=[
 {mode:'delivery',views:[[320,568],[390,844],[430,932],[844,390],[1366,600]]},
 {mode:'serving',views:[[320,568],[430,932],[844,390],[1366,600]]},
 {mode:'serving-correct',views:[[320,568],[430,932],[844,390],[1366,600]]},
 {mode:'fishing',views:[[430,932]]},
];
for(const item of plan)if(!filter||filter===item.mode)for(const [width,height]of item.views){
 if(process.env.FARM_R22_VIEW&&!process.env.FARM_R22_VIEW.split(',').includes(`${width}x${height}`))continue;
 const out=path.join(base,`${item.mode}-${width}x${height}`),env={...process.env,FARM_CONTENT_EVIDENCE:out,FARM_CONTENT_STORE:path.join(out,'store'),FARM_VIEWPORT_WIDTH:String(width),FARM_VIEWPORT_HEIGHT:String(height),FARM_R22:'true'};
 console.log(`EXECUTED R23 ${item.mode} ${width}x${height}`);
 const r=spawnSync(process.execPath,['scripts/test-content-r23-e2e.js','--only='+item.mode],{cwd:root,env,windowsHide:true,stdio:'inherit'});
 if(r.status!==0)process.exit(r.status||1);
 console.log(`VERIFIED R23 ${item.mode} ${width}x${height}`);
}
console.log('VERIFIED R23 targeted real-UI matrix: '+base);
