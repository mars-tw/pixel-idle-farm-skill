'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),os=require('node:os');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'docs/content/r11');
const source=fs.readFileSync(path.join(ROOT,'scripts/run-browser-gates.js'),'utf8'),scripts=JSON.parse('['+source.split('const SCRIPTS = [')[1].split('];')[0].split('\n').filter(l=>/^\s*"/.test(l)).join('\n').replace(/,\s*$/,'')+']');
const arg=process.argv.find(s=>s.startsWith('--only='));const selected=arg?arg.slice(7).split(','):null;
const cmds=[['npm',['test']],...[...scripts,'scripts/test-content-r10-e2e.js'].map(s=>['node',[s]]),['node',['scripts/test-water-quest-guide.js']],['node',['scripts/test-r72-night-gate.js']]];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const runtime=['index.html','sw.js','manifest.webmanifest','package.json','package-lock.json',...fs.readdirSync(path.join(ROOT,'src')).filter(p=>/\.(js|css)$/.test(p)).map(p=>'src/'+p)];
const report={status:'EXECUTED',startedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(runtime.map(p=>[p,hash(path.join(ROOT,p))])),commands:[]},tag=new Date().toISOString().replace(/[:.]/g,'-'),receipt=path.join(OUT,'regression-'+tag+'.json');
for(const [cmd,args]of cmds){
 if(selected&&!selected.some(x=>args.join(' ').includes(x)))continue;
 const log=path.join(OUT,'logs',tag,path.basename(args[0]||cmd)+'.log');fs.mkdirSync(path.dirname(log),{recursive:true});
 const fd=fs.openSync(log,'w'),start=new Date().toISOString();console.log('EXECUTED',cmd,args.join(' '),'freeMiB',Math.round(os.freemem()/1048576));
 const win=process.platform==='win32'&&cmd==='npm',r=cp.spawnSync(win?'cmd.exe':cmd,win?['/d','/s','/c','npm.cmd test']:args,{cwd:ROOT,windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,PYTHONIOENCODING:'utf-8'}});fs.closeSync(fd);
 report.commands.push({command:[cmd,...args],start,end:new Date().toISOString(),exitCode:r.status,error:r.error?.message,log:path.relative(ROOT,log).replaceAll('\\','/'),sha256:hash(log)});fs.writeFileSync(receipt,JSON.stringify(report,null,2)+'\n');console.log(r.status===0?'VERIFIED':'BLOCKED',args.join(' '));
}
report.sourcesUnchanged=runtime.every(p=>hash(path.join(ROOT,p))===report.sourceHashes[p]);report.status=report.commands.every(r=>r.exitCode===0)&&report.sourcesUnchanged?'VERIFIED':'BLOCKED';report.endedAt=new Date().toISOString();fs.writeFileSync(receipt,JSON.stringify(report,null,2)+'\n');process.exitCode=report.status==='VERIFIED'?0:1;
