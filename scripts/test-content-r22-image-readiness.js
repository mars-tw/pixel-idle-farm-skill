'use strict';
// Exhaustive static screenshot/diagnostic expansion from the actual R20 AST.
// Uses Playwright's already installed Babel parser; no dependency install.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {babelParse}=require(path.join(path.dirname(require.resolve('playwright/package.json')),'lib/transform/babelBundle.js'));
const {sceneDefinitions,staticSceneImageExpectation}=require('./r22-image-scenes');
const {writeExclusiveDurable,readbackEnvelope}=require('./r22-capture-envelope');
const testRoot=process.argv.find(a=>a.startsWith('--stage-root='))?.slice(13)||process.cwd(),filename=path.resolve(testRoot,'scripts/test-content-r20-e2e.js'),source=fs.readFileSync(filename,'utf8'),ast=babelParse(source,filename,false),unknown=Symbol('unknown'),calls=[];
function walk(node,parents=[]){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee.type==='Identifier'&&['snap','controls'].includes(node.callee.name))calls.push({node,parents});for(const[k,v]of Object.entries(node)){if(['loc','start','end','extra'].includes(k))continue;if(Array.isArray(v))for(const child of v)if(child?.type)walk(child,[...parents,node]);else{}else if(v?.type)walk(v,[...parents,node]);}}
walk(ast);
function value(n,e){
 if(!n)return unknown;if(['StringLiteral','NumericLiteral','BooleanLiteral'].includes(n.type))return n.value;if(n.type==='NullLiteral')return null;
 if(n.type==='Identifier')return Object.hasOwn(e,n.name)?e[n.name]:unknown;
 if(n.type==='ArrayExpression'){const a=n.elements.map(x=>value(x,e));return a.includes(unknown)?unknown:a;}
 if(n.type==='ObjectExpression'){const o={};for(const p of n.properties){if(p.type!=='ObjectProperty')return unknown;const v=value(p.value,e);if(v===unknown)return unknown;o[p.key.name??p.key.value]=v;}return o;}
 if(n.type==='MemberExpression'){const o=value(n.object,e),k=n.computed?value(n.property,e):n.property.name;return o===unknown||k===unknown?unknown:o?.[k]??unknown;}
 if(n.type==='TemplateLiteral'){let s=n.quasis[0].value.cooked;for(let i=0;i<n.expressions.length;i++){const v=value(n.expressions[i],e);if(v===unknown)return unknown;s+=String(v)+n.quasis[i+1].value.cooked;}return s;}
 if(n.type==='ConditionalExpression'){const t=value(n.test,e);return t===unknown?unknown:value(t?n.consequent:n.alternate,e);}
 if(n.type==='UnaryExpression'&&n.operator==='!'){const v=value(n.argument,e);return v===unknown?unknown:!v;}
 if(n.type==='LogicalExpression'){const a=value(n.left,e),b=value(n.right,e);if(n.operator==='&&'){if(a!==unknown&&!a||b!==unknown&&!b)return false;return a===unknown||b===unknown?unknown:!!b;}if(n.operator==='||'){if(a!==unknown&&a||b!==unknown&&b)return true;return a===unknown||b===unknown?unknown:!!b;}}
 if(n.type==='BinaryExpression'){const a=value(n.left,e),b=value(n.right,e);if(a===unknown||b===unknown)return unknown;return ({'+':()=>a+b,'===':()=>a===b,'!==':()=>a!==b,'==':()=>a==b,'!=':()=>a!=b,'<':()=>a<b,'>':()=>a>b,'<=':()=>a<=b,'>=':()=>a>=b})[n.operator]?.()??unknown;}
 if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.property.name==='replace'){const s=value(n.callee.object,e),r=n.arguments[0],replacement=value(n.arguments[1],e);if(typeof s==='string'&&r.type==='RegExpLiteral'&&replacement!==unknown)return s.replace(new RegExp(r.pattern,r.flags),replacement);}
 return unknown;
}
const globals={};for(const statement of ast.program.body)if(statement.type==='VariableDeclaration')for(const d of statement.declarations)if(d.id.type==='Identifier'){const v=value(d.init,globals);if(v!==unknown)globals[d.id.name]=v;}
assert.equal(globals.pairs.length,3);assert.equal(globals.kinds.length,3);
function freeIds(n,out=new Set()){if(!n)return out;if(n.type==='Identifier')out.add(n.name);for(const[k,v]of Object.entries(n)){if(['loc','start','end','extra','key'].includes(k)||k==='property'&&n.type==='MemberExpression'&&!n.computed)continue;if(Array.isArray(v))for(const c of v)if(c?.type)freeIds(c,out);else{}else if(v?.type)freeIds(v,out);}return out;}
function bind(pattern,v,e){const next={...e};if(pattern.type==='Identifier')next[pattern.name]=v;else if(pattern.type==='ArrayPattern')pattern.elements.forEach((p,i)=>{if(p)next[p.name]=v[i];});else throw new Error('Unsupported finite binding '+pattern.type);return next;}
function contexts(call,tagValues){
 let envs=[{...globals}];
 for(const n of call.parents)if(n.type==='ForOfStatement'){
  const expanded=[];for(const e of envs){const list=value(n.right,e);assert(Array.isArray(list),'Unknown loop domain at '+n.loc.start.line);for(const v of list)expanded.push(bind(n.left.declarations[0].id,v,e));}envs=expanded;
 }else if(n.type==='ForStatement'){
  const d=n.init.declarations[0],start=value(d.init,globals),limit=value(n.test.right,globals);assert(n.test.operator==='<'&&Number.isInteger(start)&&Number.isInteger(limit)&&limit-start<=10);envs=envs.flatMap(e=>Array.from({length:limit-start},(_,i)=>bind(d.id,start+i,e)));
 }
 const ids=freeIds(call.node.arguments[1]);for(const condition of call.parents.filter(n=>n.type==='IfStatement'))freeIds(condition.test,ids);
 const inServing=call.parents.some(n=>n.type==='FunctionDeclaration'&&n.id?.name==='serving');
 const fallback={id:globals.pairs.map(p=>p[0]),first:['0','3'],opposite:['0','3'],allCorrect:[false,true],shots:[false,true],tag:tagValues};
 for(const name of ids)if(envs.some(e=>!Object.hasOwn(e,name))&&fallback[name]){
  if(['allCorrect','shots','id'].includes(name)&&!inServing)continue;
  const options=fallback[name];assert(options,'Missing finite '+name);envs=envs.flatMap(e=>Object.hasOwn(e,name)?[e]:options.map(v=>({...e,[name]:v})));
 }
 return envs.filter(e=>call.parents.filter(n=>n.type==='IfStatement').every(n=>{const v=value(n.test,e);if(v===unknown)return true;const inThen=call.node.start>=n.consequent.start&&call.node.end<=n.consequent.end;return !!v===inThen;}));
}
function expand(call,tagValues){const set=new Set();for(const e of contexts(call,tagValues)){const v=value(call.node.arguments[1],e);assert.equal(typeof v,'string','Unresolved finite screenshot/tag at line '+call.node.loc.start.line);set.add(v);}assert(set.size,'Empty call site domain');return [...set].sort();}
const controlCalls=calls.filter(c=>c.node.callee.name==='controls'),tags=[...new Set(controlCalls.flatMap(c=>expand(c,[])))].sort();
const sites=calls.filter(c=>c.node.callee.name==='snap').map(c=>({line:c.node.loc.start.line,expression:source.slice(c.node.arguments[1].start,c.node.arguments[1].end),finiteNames:expand(c,tags)}));
const actual=[...new Set(sites.flatMap(s=>s.finiteNames))].sort(),registered=[...sceneDefinitions.keys()].sort();
assert.deepEqual(registered,actual,'Static scene map must cover exactly the actual finite snap AST names, no generic fallbacks or unused names');
assert.throws(()=>staticSceneImageExpectation('unknown-scene.png'),/UNKNOWN_SCREENSHOT_SCENE/);assert.throws(()=>staticSceneImageExpectation('control-failure-unlisted.png'),/UNKNOWN_SCREENSHOT_SCENE/);
for(const name of actual){const x=staticSceneImageExpectation(name);if(name.includes('journal')||/^phone-basket-(merchant|elder|child)-/.test(name))assert(x.kind==='images'&&x.minCount>=1);if(x.kind==='canvas-only')assert(x.expectedCount===0&&x.reason&&['phone-basket-cancel-after.png','phone-pond-materials-before.png','phone-pond-materials-after.png'].includes(name));}
const out=process.env.FARM_R22_IMAGE_STATIC_OUT;if(out){fs.mkdirSync(out,{recursive:true});const sha=b=>crypto.createHash('sha256').update(b).digest('hex');fs.writeFileSync(path.join(out,'static-scene-coverage.json'),JSON.stringify({status:'VERIFIED',sourceHashes:Object.fromEntries(['scripts/test-content-r20-e2e.js','scripts/r22-image-scenes.js','scripts/r22-image-readiness.js','scripts/r22-capture-envelope.js','scripts/test-content-r22-image-readiness.js'].map(n=>[n,sha(fs.readFileSync(path.join(testRoot,n)))])),parserPath:require.resolve(path.join(path.dirname(require.resolve('playwright/package.json')),'lib/transform/babelBundle.js')),parserSha256:sha(fs.readFileSync(require.resolve(path.join(path.dirname(require.resolve('playwright/package.json')),'lib/transform/babelBundle.js')))),snapCallSites:sites,controlCallSites:controlCalls.map(c=>({line:c.node.loc.start.line,expression:source.slice(c.node.arguments[1].start,c.node.arguments[1].end),finiteTags:expand(c,[])})),diagnosticTags:tags,registered:actual.map(name=>({name,...staticSceneImageExpectation(name)})),snapCallSiteCount:sites.length,uniqueScreenshotCount:actual.length,diagnosticTagCount:tags.length,limits:'Static finite source-name taxonomy, not proof of game rendering or a whole-suite result.'},null,2)+'\n');}
if(out){const p=path.join(out,'durable-probe.json'),bytes=Buffer.from('{\"probe\":true}\n'),proof=writeExclusiveDurable(p,bytes);assert(proof.fsyncCompleted&&proof.fdClosed&&proof.readbackVerified);assert.throws(()=>writeExclusiveDurable(p,bytes),{code:'EEXIST'});assert.throws(()=>readbackEnvelope(p,'0'.repeat(64),bytes.length),{code:'ENVELOPE_READBACK_SHA_MISMATCH'});assert.throws(()=>writeExclusiveDurable(path.join(p,'not-a-directory.json'),bytes));assert.deepEqual(fs.readFileSync(p),bytes);fs.writeFileSync(path.join(out,'durable-static-probes.json'),JSON.stringify({status:'VERIFIED',exclusiveWriteFsyncCloseReadback:proof,duplicateRejected:true,wrongExpectedHashRejected:true,invalidParentRejected:true,originalBytesUnchanged:true},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:'VERIFIED',snapCallSites:sites.length,finiteScreenshotNames:actual.length,diagnosticTags:tags.length,unknownScenesRejected:true}));
