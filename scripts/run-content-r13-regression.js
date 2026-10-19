/* Sequential owned headless processes; no extra dev server or external dispatch. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'docs/content/r13');
const source=fs.readFileSync(path.join(ROOT,'scripts/run-browser-gates.js'),'utf8');
const gates=JSON.parse('['+source.split('const SCRIPTS = [')[1].split('];')[0].split('\n').filter(l=>/^\s*"/.test(l)).join('\n').replace(/,\s*$/,'')+']');
const commands=[['npm',['test']],...[...gates,'scripts/test-content-r10-e2e.js','scripts/test-content-r11-e2e.js','scripts/test-content-r12-e2e.js','scripts/test-water-quest-guide.js','scripts/test-r72-night-gate.js'].map(p=>['node',[p]])];
const only=process.argv.find(s=>s.startsWith('--only='))?.slice(7).split(',');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const runtime=['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json',...fs.readdirSync(path.join(ROOT,'src')).filter(p=>/\.(js|css)$/.test(p)).map(p=>'src/'+p)];
const report={status:'EXECUTED',startedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(runtime.map(p=>[p,hash(p)])),commands:[]};
const tag=new Date().toISOString().replace(/[:.]/g,'-');fs.mkdirSync(path.join(OUT,'logs',tag),{recursive:true});
for(const[cmd,args]of commands){if(only&&!only.some(x=>x==='npm'?cmd==='npm':args.join(' ').includes(x)))continue;
 const log='docs/content/r13/logs/'+tag+'/'+path.basename(args[0]||cmd)+'.log',fd=fs.openSync(path.join(ROOT,log),'w');console.log('EXECUTED',cmd,...args);
 const win=cmd==='npm'&&process.platform==='win32',r=cp.spawnSync(win?'cmd.exe':cmd,win?['/d','/s','/c','npm.cmd test']:args,{cwd:ROOT,windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,PYTHONIOENCODING:'utf-8'}});fs.closeSync(fd);
 report.commands.push({command:[cmd,...args],exitCode:r.status,error:r.error?.message,log,sha256:hash(log)});console.log(r.status===0?'VERIFIED':'BLOCKED',args.join(' '));fs.writeFileSync(path.join(OUT,'regression-'+tag+'.json'),JSON.stringify(report,null,2)+'\n');
}
report.sourcesUnchanged=runtime.every(p=>hash(p)===report.sourceHashes[p]);report.status=report.sourcesUnchanged&&report.commands.every(r=>r.exitCode===0)?'VERIFIED':'BLOCKED';report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'regression-'+tag+'.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=report.status==='VERIFIED'?0:1;
