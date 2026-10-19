/* One owned headless process/server at a time. Every failed receipt stays on disk. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'docs/content/r12');
const steps=[['node',['scripts/test-content-r12-e2e.js','--gather-only'],'e2e-final.log'],['node',['scripts/run-content-r12-regression.js'],'regression-final.log'],['node',['scripts/measure-content-r12.js'],'performance.log'],['python',['tools/restore-content-r12-history.py'],'protection.log'],['python',['tools/archive-content-r12-test-outputs.py'],'archive.log'],['python',['tools/verify-content-r12-release.py'],'release-readback.log'],['python',['tools/write-content-r12-report.py'],'report.log']];
for(const [cmd,args,name]of steps){console.log('EXECUTED',cmd,...args);const fd=fs.openSync(path.join(OUT,name),'w'),r=cp.spawnSync(cmd,args,{cwd:ROOT,windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,PYTHONIOENCODING:'utf-8'}});fs.closeSync(fd);if(r.status!==0){console.error('BLOCKED',cmd,args.join(' '),'see',name);process.exit(r.status||1);}console.log('VERIFIED',cmd,...args);}
