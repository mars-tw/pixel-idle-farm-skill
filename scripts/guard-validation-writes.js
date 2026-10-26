'use strict';
// Detect the exact subprocess responsible for provenance drift. The guard never
// restores or rewrites user files: a mutation fails at its originating step.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const files=['docs/evidence/R68/source-manifest.json','assets/generated/r68/manifest.json',...fs.readdirSync('assets/generated/r68').filter(f=>f.endsWith('.png')).map(f=>'assets/generated/r68/'+f)];
const snapshot=()=>Object.fromEntries(files.map(p=>[p,{sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),mtimeMs:fs.statSync(p).mtimeMs}]));
const before=snapshot();
const unit=[
  "node scripts/test-version-chain.js",
  "node scripts/test-guards.js",
  "node scripts/test-economy.js",
  "node scripts/test-systems.js",
  "node scripts/test-adventure.js",
  "node scripts/test-world-migration.js",
  "node scripts/test-r74-building-upgrades.js",
  "node scripts/test-r79-sunpatch.js",
  "node scripts/test-r80-daily.js",
  "node scripts/test-r81-heirloom.js",
  "node scripts/test-ui-smoke.js",
  "node scripts/validate-v3-atlas.js",
  "node scripts/validate-v4-atlas.js",
  "python tools/generate-r66-ui.py --check",
  "node scripts/test-r66-ui-art.js",
  "python tools/process-r68-visuals.py --check",
  "node scripts/test-r68-visuals.js",
  "node scripts/test-content-r1.js",
  "node scripts/test-content-r2.js",
  "node scripts/test-content-r3.js",
  "node scripts/test-content-r4.js",
  "node scripts/test-content-r5.js",
  "node scripts/test-content-r6.js",
  "node scripts/test-content-r7.js",
  "node scripts/test-content-r8.js",
  "node scripts/test-content-r9.js",
  "node scripts/test-content-r10.js",
  "node scripts/test-content-r11.js",
  "node scripts/test-content-r12.js",
  "node scripts/test-content-r13.js",
  "node scripts/test-content-r14.js",
  "node scripts/test-content-r15.js",
  "python tools/check-content-r15-art.py",
  "node scripts/test-content-r16.js",
  "node scripts/test-content-r17.js",
  "node scripts/test-content-r18.js",
  "node scripts/test-content-r19.js",
  "node scripts/test-content-r20.js",
  "node scripts/test-content-r21.js",
  "node scripts/test-content-r22.js",
  "node scripts/test-content-r23.js",
];
const commands=process.argv[2]==='r79'?['node scripts/test-r79-sunpatch.js','node scripts/test-r79-fun-e2e.js']:unit;
for(const command of commands){console.log('EXECUTED '+command);const [exe,...args]=command.split(' '),r=cp.spawnSync(exe,args,{stdio:'inherit',windowsHide:true});assert.deepEqual(snapshot(),before,'Read-only provenance changed during '+command);if(r.status!==0)process.exit(r.status||1);}
console.log('VERIFIED all validation steps preserve R68 hashes and mtimes');
