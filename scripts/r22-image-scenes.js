'use strict';
// Finite R20 screenshot taxonomy. Classification never reads live IMG counts.
const assert=require('node:assert/strict'),scenes=new Map();
const neighbors=['merchant','elder','child'],fish=['river_carp','silver_dace','river_perch'];
const layoutViews=[[320,568],[390,844],[430,932],[844,390],[768,1024],[1024,768],[1032,1376],[1376,1032],[1366,600]];
function add(name,scene,phase,kind='images',reason=null){
 assert(!scenes.has(name),'Duplicate static screenshot name '+name);
 const expectation=kind==='images'?{kind,minCount:1,scene,phase}:{kind:'canvas-only',expectedCount:0,scene,phase,reason};
 scenes.set(name,Object.freeze(expectation));
}
for(const id of neighbors)for(const pose of ['far','mid','near','reach','received'])add(`phone-basket-${id}-${pose}.png`,'handover',{delivery:['far','mid','near'].includes(pose)?'walking':pose==='received'?'contact':'reach'});
add('phone-basket-cancel-before.png','basket',{view:'basket'});
add('phone-basket-cancel-after.png','cancelled-farm',{delivery:null,modal:false},'canvas-only','Cancellation removes the selected transient handover IMG nodes and closes the basket modal; the remaining farm is rendered by its existing canvas/CSS. Material-preservation and original scene checks remain separate.');
for(const when of ['before','after'])add(`phone-pond-materials-${when}.png`,'market-materials',{market:true},'canvas-only','The original market-materials snapshot is HTML text/buttons and CSS, with no selected modal or handover IMG nodes. This is DOM-image decode NOT_APPLICABLE, not an artwork or PNG-frame PASS.');
for(const id of fish){
 for(const suffix of ['pre','active-1','active-2','guess','reveal','cycle-0','cycle-1','cycle-2','cycle-3'])add(`phone-pond-${id}-${suffix}.png`,'pond-practice',{view:'note',practice:true});
 for(const time of ['perfect','early','late'])for(const correct of ['correct','wrong'])add(`phone-pond-${id}-${time}-${correct}.png`,'pond-practice-result',{view:'note',practice:true});
}
add('phone-pond-offline-active.png','pond-practice-offline',{view:'note',practice:true});
for(const id of neighbors)for(const phase of ['lift','left','right','received','reaction'])add(`phone-memory-${id}-${phase}.png`,'serving',{view:'gathering-complete',serving:phase==='left'||phase==='right'?'carry':phase==='reaction'?'reply':phase});
add('phone-memory-wrong-shared.png','serving-wrong-shared',{view:'gathering-complete',serving:'reply'});
add('phone-memory-refill-supplies.png','serving-refill-supplies',{view:'gathering-complete',gatherStep:'supplies'});
for(const prefix of ['phone-journal','phone-journal-no-shared'])for(const suffix of ['first','last','photo-open'])add(`${prefix}-${suffix}.png`,'journal',{view:'gathering-review'});
add('phone-journal-no-shared-reloaded.png','journal-no-shared-reloaded',{view:'gathering-review'});
for(const id of neighbors){
 for(const suffix of ['reply','reloaded'])add(`phone-memory-invite-${id}-${suffix}.png`,'invitation',{view:'sharing-invitation'});
 add(`phone-journal-invite-${id}-reloaded.png`,'journal-invited-reloaded',{view:'gathering-review'});
}
for(const[w,h]of layoutViews){add(`layout-meal-${w}x${h}.png`,'layout-meal',{view:'gathering-complete',serving:'received'});add(`layout-pond-${w}x${h}.png`,'layout-pond',{view:'note',practice:true});}
for(const device of ['iphone','ipad'])add(device+'-25-water-shapes-r20.png','store-water-shapes',{view:'note',practice:true});
const diagnosticTags=[
 ['choose a guest','gathering-complete'],...neighbors.map(id=>[id+' selected serving','gathering-complete']),
 ['refill supplies','gathering-complete'],['journal first page','gathering-review'],['journal last page','gathering-review'],['all-correct reloaded journal','gathering-review'],['shared invitation choices','sharing-invitation'],
 ...layoutViews.flatMap(([w,h])=>[[`${w}x${h} serving`,'gathering-complete'],[w+' practice','note'],[w+' choose','note'],[w+' result','note']])
];
for(const[tag,view]of diagnosticTags)add('control-failure-'+tag.replace(/[^a-z0-9]+/gi,'-')+'.png','diagnostic-control-failure',{view,...(view==='note'?{practice:true}:{})});
function staticSceneImageExpectation(name){const entry=scenes.get(name);assert(entry,'UNKNOWN_SCREENSHOT_SCENE '+name);return entry;}
async function sceneImageExpectation(page,name){
 const entry=staticSceneImageExpectation(name);
 const observed=await page.evaluate(()=>{const m=document.querySelector('#worldModal.show');return {delivery:document.querySelector('.basket-carrying')?.dataset.phase??null,modal:!!m,view:m?.dataset.contentView??null,serving:m?.dataset.servingPhase??null,gatherStep:m?.dataset.gatherStep??null,practice:m?.dataset.practice==='true',market:!!m?.querySelector('[data-sell]')};});
 for(const[key,value]of Object.entries(entry.phase))assert.equal(observed[key],value,name+' original scene/phase contract '+key);
 return {...entry,phaseAtSelection:observed};
}
module.exports={sceneImageExpectation,staticSceneImageExpectation,sceneDefinitions:scenes,diagnosticTags,layoutViews};
