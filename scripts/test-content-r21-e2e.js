'use strict';
const {spawnSync}=require('node:child_process');
const root=process.cwd();
const plan=[
  {mode:'delivery',views:[[320,568],[390,844],[430,932]]},
  {mode:'fishing',views:[[430,932]]},
  {mode:'serving',views:[[430,932]]},
];
for(const item of plan)for(const [width,height] of item.views){
  const title=`R21 ${item.mode} ${width}x${height}`;
  console.log('EXECUTED '+title);
  const result=spawnSync(process.execPath,['scripts/test-content-r20-e2e.js','--only='+item.mode],{
    cwd:root,stdio:'inherit',windowsHide:true,
    env:{...process.env,FARM_CONTENT_EVIDENCE:'docs/content/r21',FARM_CONTENT_STORE:'docs/content/r21/store',FARM_VIEWPORT_WIDTH:String(width),FARM_VIEWPORT_HEIGHT:String(height)},
  });
  if(result.status!==0)process.exit(result.status||1);
  console.log('VERIFIED '+title);
}
console.log('VERIFIED R21 public delivery, three-fish selection, serving dialogue and reserve journal');
