'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),R=require('../src/content-r17');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let n=0;const test=(name,fn)=>{fn();n++;console.log('PASS '+name);};
test('12 native generated water frames are unique, source-bound and available offline',()=>{
 const m=JSON.parse(fs.readFileSync('assets/generated/content-r18/manifest.json')),sw=fs.readFileSync('sw.js','utf8');assert.equal(m.tool,'image_gen.imagegen');assert.equal(hash(m.master),m.masterSha256);assert.equal(m.frames.length,12);assert.equal(new Set(m.frames.map(a=>a.sha256)).size,12);
 assert.deepEqual(m.palette,JSON.parse(fs.readFileSync('assets/generated/r89/manifest.json')).palette);
 for(const fish of ['river_carp','silver_dace','river_perch']){const frames=m.frames.filter(a=>a.fish===fish);assert.deepEqual(frames.map(a=>a.frame),[0,1,2,3]);for(const a of frames){const b=fs.readFileSync(a.file);assert.equal(hash(a.file),a.sha256);assert.equal(b.readUInt32BE(16),96);assert.equal(b.readUInt32BE(20),72);assert(sw.includes(a.file));}}
});
test('failure states identify timing or fish choice with one complete conclusion',()=>{for(const t of ['early','perfect','late'])for(const c of [true,false]){const r=R.result(t,c);assert.equal(r.success,t==='perfect'&&c);assert.equal((r.conclusion.match(/本竿/g)||[]).length,1);assert(r.conclusion.includes(t==='early'?'太早':t==='late'?'晚了':c?'成功':'辨魚不同'));}});
test('all 501 points on each hand-bound route avoid the shared plate and all seated faces',()=>{const shared={left:147.5,top:132.5,right:210.5,bottom:183.5},faces=[[77,37],[207,37],[256,173]].map(([x,y])=>({left:x+64*.2,top:y+86*.08,right:x+64*.72,bottom:y+86*.46}));for(const id of ['merchant','elder','child']){for(let k=0;k<=500;k++){const[x,y]=R.platePosition(id,k/500),plate={left:x,top:y,right:x+32,bottom:y+26};assert(!R.overlaps(plate,shared),id+'/'+k);assert(faces.every(face=>!R.overlaps(plate,face)),id+' face/'+k);}assert.deepEqual(R.platePosition(id,0),R.plates.start);assert.deepEqual(R.platePosition(id,1),R.plates.end[id]);}});
test('validation keeps R68 historical provenance and every runtime image byte unchanged',()=>{
 const files=['docs/evidence/R68/source-manifest.json','assets/generated/r68/manifest.json',...fs.readdirSync('assets/generated/r68').filter(f=>f.endsWith('.png')).map(f=>'assets/generated/r68/'+f)],before=files.map(p=>[hash(p),fs.statSync(p).mtimeMs]);
 const r=cp.spawnSync('python',['tools/process-r68-visuals.py','--check'],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);files.forEach((p,i)=>assert.deepEqual([hash(p),fs.statSync(p).mtimeMs],before[i],p));assert(fs.readFileSync('package.json','utf8').includes('process-r68-visuals.py --check'));
});
console.log('VERIFIED R18 '+n+' groups');
