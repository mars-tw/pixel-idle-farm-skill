/* Sequential headless gates; retain historical artifacts and all initial user files. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'docs/content/r9'),backup=path.join(ROOT,'.audit-tmp/r9-protected');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const protectedFiles=JSON.parse(fs.readFileSync(path.join(OUT,'protected-start.json')));
const resume=process.argv.includes('--resume'),startAt=Number(process.argv.find(a=>a.startsWith('--from='))?.split('=')[1]||4),tag=process.argv.find(a=>a.startsWith('--run='))?.split('=')[1];
if(!Number.isInteger(startAt)||startAt<4||startAt>9||tag&&!/^[a-z0-9-]+$/.test(tag))throw Error('Invalid bounded continuation');
const receipt=tag?'regression-'+tag+'-checks.json':resume?'regression-continuation.json':'regression-checks.json';
fs.mkdirSync(backup,{recursive:true});
for(const[p,sha]of Object.entries(protectedFiles)){const f=path.join(ROOT,p),b=path.join(backup,p);if(resume){if(hash(b)!==sha)throw Error('Protected backup changed: '+p);continue;}if(hash(f)!==sha)throw Error('Protected start changed before regression: '+p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(f,b);}
const cmds=process.argv.includes('--unit-only')?[['npm',['test']]]:resume?[['npm',['test']],...[4,5,6,7,8,9].filter(i=>i>=startAt).map(i=>['node',[`scripts/test-content-r${i}-e2e.js`]]),['node',['scripts/test-water-quest-guide.js']],['node',['scripts/test-r72-night-gate.js']]]:[['npm',['test']],['node',['scripts/run-browser-gates.js']],['node',['scripts/test-water-quest-guide.js']],['node',['scripts/test-r72-night-gate.js']]];
const report={status:'EXECUTED',startedAt:new Date().toISOString(),commands:[]};
for(let i=0;i<cmds.length;i++){
 const[cmd,args]=cmds[i],log=path.join(OUT,`regression-${tag?tag+'-':resume?'resume-':''}${i+1}.log`),fd=fs.openSync(log,'w');const start=new Date().toISOString();
 const npmOnWindows=process.platform==='win32'&&cmd==='npm';
 const r=cp.spawnSync(npmOnWindows?'cmd.exe':cmd,npmOnWindows?['/d','/s','/c','npm.cmd test']:args,{cwd:ROOT,stdio:['ignore',fd,fd],windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});fs.closeSync(fd);
 report.commands.push({command:[cmd,...args],start,end:new Date().toISOString(),exitCode:r.status,error:r.error?.message,log:path.relative(ROOT,log).replaceAll('\\','/'),sha256:hash(log)});
 fs.writeFileSync(path.join(OUT,receipt),JSON.stringify(report,null,2)+'\n');
 console.log('EXECUTED',i+1,cmd,args.join(' '),'exit',r.status);
 if(r.status!==0){report.status='BLOCKED';process.exitCode=1;break;}
}
if(report.commands.length===cmds.length&&report.commands.every(r=>r.exitCode===0))report.status='VERIFIED';
report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,receipt),JSON.stringify(report,null,2)+'\n');
