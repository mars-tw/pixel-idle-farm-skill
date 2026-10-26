'use strict';
// Owned inert/review candidate only. Never imported by frozen375.
// All browser mutations belong to the inert fixture, never to this observer.
function installWindow({selector,expectation,maxWindowMs,windowId}){
 const nativeDecode=HTMLImageElement.prototype.decode,nodeIds=new WeakMap(),entries=[],timeline=[],signals=new Set();
 let nextNodeId=0,initial=null,raf,observer,deadline,deadlineExpired=false,stopped=false,firstFatal=null,stage='installing',cutoffSnapshot=null,frozenUrlRefs=null,nativeSettlementPromise=null,nativeTerminal=null,deadlineStartedBrowserMs=null,deadlineDueBrowserMs=null;
 const now=()=>performance.now(),id=n=>{if(!nodeIds.has(n))nodeIds.set(n,++nextNodeId);return nodeIds.get(n);};
 const errorData=e=>({name:e.name,message:e.message,stack:e.stack??null,code:e.code??null,isNativeDomException:e instanceof DOMException});
 const wake=()=>{for(const resolve of signals)resolve();signals.clear();};
 const event=(kind,data={})=>{timeline.push({at:now(),kind,stage,...data});wake();};
 const fatal=(error,context)=>{if(!firstFatal){firstFatal={error,context,at:now()};event('fatal',{error:errorData(error),context});}wake();};
 const violation=(code,context)=>{const e=new Error(code);e.name='ImageReadinessContractError';e.contractCode=code;fatal(e,context);};
 const inspect=e=>({nodeId:id(e),tagName:e.tagName,isConnected:e.isConnected,srcAttribute:e.getAttribute('src'),srcset:e.getAttribute('srcset'),sizes:e.getAttribute('sizes'),resolvedSrc:e instanceof HTMLImageElement?e.src:null,currentSrc:e instanceof HTMLImageElement?e.currentSrc:null,complete:e instanceof HTMLImageElement?e.complete:null,naturalWidth:e.naturalWidth??null,naturalHeight:e.naturalHeight??null,rect:e.getBoundingClientRect().toJSON(),details:e.closest('details')?{open:e.closest('details').open,className:e.closest('details').className}:null});
 function exactSource(img){
  // currentSrc is the browser-selected resource. A plain src may still be
  // pending at the initial scan; responsive sources may not use this fallback.
  const current=img.currentSrc;
  const responsive=img.hasAttribute('srcset')||img.hasAttribute('sizes')||!!img.closest('picture');
  const plainPendingAllowed=!!img.getAttribute('src')?.trim()&&!responsive;
  const raw=current||(plainPendingAllowed?img.src:'');
  if(!raw){violation('SOURCE_UNKNOWN',{image:inspect(img),responsive});return null;}
  try{return {url:new URL(raw,document.baseURI).href,sourceSelection:current?'exact-currentSrc':'resolved-src-pending-plain-only',currentSrcAtObservation:current};}
  catch(e){violation('SOURCE_UNKNOWN',{image:inspect(img),raw,error:errorData(e)});return null;}
 }
 function observeUrl(entry,selected,reason){
  if(entry.urls.has(selected.url))return;
  const immutable=new Image(),row={url:selected.url,sourceSelection:selected.sourceSelection,currentSrcAtObservation:selected.currentSrcAtObservation,firstObservedAt:now(),firstObservedBy:reason,status:'pending',srcAssignments:1,everConnected:false};
  if(entry.node.crossOrigin!==null)immutable.crossOrigin=entry.node.crossOrigin;
  if(entry.node.referrerPolicy)immutable.referrerPolicy=entry.node.referrerPolicy;
  // Exactly one source assignment, no srcset, no connection and no exposure
  // of the private Image object outside this closure.
  immutable.src=selected.url;
  row.immutableAtCreation={src:immutable.src,currentSrc:immutable.currentSrc,isConnected:immutable.isConnected};
  entry.urls.set(selected.url,row);event('url-observed',{nodeId:entry.nodeId,...row});
  const nativePromise=nativeDecode.call(immutable);
  row.completion=nativePromise.then(()=>{
   row.fulfilledAt=now();row.immutable={src:immutable.src,currentSrc:immutable.currentSrc,isConnected:immutable.isConnected,naturalWidth:immutable.naturalWidth,naturalHeight:immutable.naturalHeight};
   row.everConnected||=immutable.isConnected;
   if(row.everConnected||immutable.src!==row.url||!immutable.complete||immutable.naturalWidth<=0||immutable.naturalHeight<=0){row.status='contract-rejected';violation('IMMUTABLE_DECODE_INVARIANT',{nodeId:entry.nodeId,url:row.url,immutable:row.immutable});}
   else{row.status='fulfilled';event('native-decode-fulfilled',{nodeId:entry.nodeId,url:row.url,immutable:row.immutable});}
   wake();
  },error=>{
   // Record the exact native rejection immediately and make the entire window
   // fatal. The SAME error is thrown by readiness/finalization; never ignored,
   // never retried, and never redeemed by a later valid URL.
   row.status='rejected';row.rejectedAt=now();row.immutable={src:immutable.src,currentSrc:immutable.currentSrc,isConnected:immutable.isConnected,naturalWidth:immutable.naturalWidth,naturalHeight:immutable.naturalHeight};row.nativeError=errorData(error);fatal(error,{code:'NATIVE_IMMUTABLE_DECODE_REJECTED',nodeId:entry.nodeId,url:row.url});
  });
 }
 function scan(reason){
  if(cutoffSnapshot)return cutoffSnapshot.rows; // Never query future DOM after cutoff.
  const nodes=[...document.querySelectorAll(selector)],rows=nodes.map(inspect);
  event('scan',{reason,rows});
  if(initial===null){
   initial=nodes;
   if(expectation.kind==='images'&&(nodes.length<expectation.minCount||(expectation.expectedCount!==undefined&&nodes.length!==expectation.expectedCount)))violation('EXPECTED_IMAGE_COUNT',{expectation,rows});
   if(expectation.kind==='canvas-only'&&(expectation.expectedCount!==0||!expectation.reason?.trim()||nodes.length!==0))violation('CANVAS_ONLY_EXPECTATION_INVALID',{expectation,rows});
   for(const node of nodes)entries.push({node,nodeId:id(node),urls:new Map()});
  }else if(nodes.length!==initial.length||nodes.some((n,i)=>n!==initial[i]))violation('NODE_SET_IDENTITY_ORDER_COUNT_CHANGED',{initialNodeIds:initial.map(id),currentNodeIds:nodes.map(id),rows});
  for(const entry of entries){
   if(!(entry.node instanceof HTMLImageElement)){violation('SELECTED_NON_IMG',{image:inspect(entry.node)});continue;}
   if(!entry.node.isConnected){violation('SELECTED_NODE_DISCONNECTED',{image:inspect(entry.node)});continue;}
   const selected=exactSource(entry.node);if(selected)observeUrl(entry,selected,reason);
  }
  return rows;
 }
 function containsTracked(node){return entries.some(e=>node===e.node||node.contains?.(e.node));}
 function onMutations(records){
  if(stopped)return;
  for(const r of records){
   const relevant=r.type==='childList'||r.target instanceof HTMLImageElement||(r.target instanceof HTMLSourceElement&&r.target.closest('picture'));
   if(!relevant)continue;
   event('mutation',{type:r.type,targetNodeId:id(r.target),targetTag:r.target.tagName,attribute:r.attributeName,oldValue:r.oldValue,newValue:r.attributeName?r.target.getAttribute(r.attributeName):null,added:[...r.addedNodes].map(n=>({nodeId:id(n),tagName:n.tagName??n.nodeName})),removed:[...r.removedNodes].map(n=>({nodeId:id(n),tagName:n.tagName??n.nodeName}))});
   if(r.type==='childList'){
    if([...r.removedNodes].some(containsTracked))violation('TRACKED_NODE_REMOVED_EVEN_IF_REINSERTED',{targetNodeId:id(r.target),removed:[...r.removedNodes].map(id)});
    // A same-task insertion/removal may disappear before querySelectorAll runs.
    // Reconstruct membership for this exact modal-selector branch from its
    // mutation parent; detached handover classes still match directly.
    const modalBranch=selector.includes('#worldModal.show img[src]')&&(r.target.matches?.('#worldModal.show')||r.target.closest?.('#worldModal.show'));
    const affectsSet=node=>node.nodeType===Node.ELEMENT_NODE&&(node.matches(selector)||node.querySelector(selector)||(modalBranch&&(node.matches('img[src]')||node.querySelector('img[src]'))));
    if([...r.addedNodes,...r.removedNodes].some(affectsSet))violation('SELECTED_CANDIDATE_ADDED_OR_REMOVED',{targetNodeId:id(r.target),added:[...r.addedNodes].map(id),removed:[...r.removedNodes].map(id)});
   }
  }
  scan('mutation');
 }
 const onImageEvent=e=>{if(stopped)return;if(!(e.target instanceof HTMLImageElement))return;event('img-'+e.type,{image:inspect(e.target)});scan('img-'+e.type);if(e.type==='error'&&entries.some(row=>row.node===e.target))violation('ACTUAL_DOM_IMG_ERROR',{image:inspect(e.target)});};
 function drainRecords(){const pending=observer.takeRecords();if(pending.length)onMutations(pending);}
 const allCurrentReady=()=>entries.every(e=>e.node instanceof HTMLImageElement&&e.node.isConnected&&!!e.node.currentSrc&&e.node.complete&&e.node.naturalWidth>0&&e.node.naturalHeight>0);
 const allUrlsFulfilled=()=>entries.every(e=>[...e.urls.values()].every(r=>r.status==='fulfilled'));
 const allUrlsSettled=()=>entries.every(e=>[...e.urls.values()].every(r=>r.status!=='pending'));
 const throwFatal=()=>{if(firstFatal)throw firstFatal.error;};
 const waitSignal=()=>new Promise(resolve=>signals.add(resolve));
 function disconnectObservation(reason){if(stopped)return;observer.disconnect();cancelAnimationFrame(raf);document.removeEventListener('load',onImageEvent,true);document.removeEventListener('error',onImageEvent,true);stopped=true;event('disconnect',{reason});}
 function stop(reason){if(stopped)return;drainRecords();disconnectObservation(reason);}
 function data(){return {schemaVersion:3,windowId,selector,expectation,stage,stopped,cutoffSnapshot,nativeTerminal,initialNodeIds:(initial||[]).map(id),status:firstFatal?'REJECTED':stage==='complete'?(expectation.kind==='canvas-only'?'NOT_APPLICABLE':'ASSET_WINDOW_VALIDATED'):stopped?'INCOMPLETE':'OBSERVING',notApplicableReason:expectation.kind==='canvas-only'?expectation.reason:null,interpretation:'Finite observed node/URL readiness window, not a claim about a single PNG frame',firstFatal:firstFatal?{at:firstFatal.at,error:errorData(firstFatal.error),contractCode:firstFatal.error.contractCode??null,context:firstFatal.context}:null,nodes:entries.map(e=>({nodeId:e.nodeId,urls:[...e.urls.values()].map(({completion,...row})=>row)})),timeline};}
 async function ready(label){if(stopped){const error=new Error('LIVE_READY_REQUEST_AFTER_OBSERVATION_STOPPED');error.name='ImageReadinessApiError';throw error;}stage=label;for(;;){drainRecords();scan(label);throwFatal();if(allCurrentReady()&&allUrlsFulfilled()){event('dom-and-observed-urls-ready',{label,rows:initial.map(inspect)});return data();}await waitSignal();}}
 function frozenCopy(value){const copy=structuredClone(value);const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const item of Object.values(v))freeze(item);Object.freeze(v);}return v;};return freeze(copy);}
 function captureReturnCutoff(){
  if(cutoffSnapshot)return cutoffSnapshot; // Idempotent: never re-query later UI.
  const startedBrowserMs=now(),observationWasAlreadyStopped=stopped;
  stage='capture-return-cutoff';let rows=[],sampleStartedBrowserMs=null,sampleCompletedBrowserMs=null;
  if(observationWasAlreadyStopped)violation('OBSERVATION_STOPPED_BEFORE_CUTOFF',{});
  try{
   drainRecords();sampleStartedBrowserMs=now();rows=scan('capture-return-final-scan');sampleCompletedBrowserMs=now();
  }catch(error){fatal(error,{code:'CUTOFF_SCAN_ERROR'});}
  finally{disconnectObservation('capture-return-cutoff');}
  const disconnectedBrowserMs=now(),countSatisfied=expectation.kind==='canvas-only'?rows.length===0:rows.length>=expectation.minCount&&(expectation.expectedCount===undefined||rows.length===expectation.expectedCount);
  const returnReady=countSatisfied&&rows.every(r=>r.tagName==='IMG'&&r.isConnected&&!!r.currentSrc&&r.complete&&r.naturalWidth>0&&r.naturalHeight>0);
  if(!returnReady)violation('RETURN_SNAPSHOT_NOT_READY',{rows,countSatisfied});
  // Keep private references only to URL decodes already issued before disconnect.
  // All public cutoff rows/statuses below are detached, deeply frozen copies.
  frozenUrlRefs=entries.flatMap(e=>[...e.urls.values()].map(row=>({nodeId:e.nodeId,row})));
  cutoffSnapshot=frozenCopy({schemaVersion:3,windowId,selector,expectation,startedBrowserMs,sampleStartedBrowserMs,sampleCompletedBrowserMs,disconnectedBrowserMs,observationWasAlreadyStopped,originalDeadlineMs:maxWindowMs,deadlineStartedBrowserMs,deadlineDueBrowserMs,initialNodeIds:(initial||[]).map(id),currentNodeIds:rows.map(r=>r.nodeId),countSatisfied,rows,returnReady,disposition:returnReady&&!firstFatal?'FROZEN_READY':'FROZEN_REJECTED',firstFatalAtCutoff:firstFatal?{at:firstFatal.at,error:errorData(firstFatal.error),contractCode:firstFatal.error.contractCode??null,context:firstFatal.context}:null,issuedUrlsAtCutoff:frozenUrlRefs.map(({nodeId,row})=>({nodeId,url:row.url,firstObservedAt:row.firstObservedAt,statusAtCutoff:row.status,srcAssignments:row.srcAssignments})),manualOriginalPngRequired:true,pixelAcceptance:'UNKNOWN_REQUIRES_ORIGINAL_PNG_MANUAL_REVIEW'});
  // Start now, before protocol serialization/Node wx I/O. No DOM read occurs
  // in this promise; a late native rejection stays fatal against the fixed set.
  nativeSettlementPromise=settleFrozenNativeUrls();return cutoffSnapshot;
 }
 async function settleFrozenNativeUrls(){
  const settled=()=>frozenUrlRefs.every(({row})=>row.status!=='pending');
  while(!settled()&&!deadlineExpired)await waitSignal();
  nativeTerminal=frozenCopy({atBrowserMs:now(),deadlineExpired,deadlineStartedBrowserMs,deadlineDueBrowserMs,disposition:firstFatal?'REJECTED':'NATIVE_URLS_FULFILLED',firstFatal:firstFatal?{at:firstFatal.at,error:errorData(firstFatal.error),contractCode:firstFatal.error.contractCode??null,context:firstFatal.context}:null,rows:frozenUrlRefs.map(({nodeId,row})=>({nodeId,url:row.url,status:row.status,fulfilledAt:row.fulfilledAt??null,rejectedAt:row.rejectedAt??null,immutable:row.immutable??null,nativeError:row.nativeError??null}))});
  clearTimeout(deadline);event('frozen-native-terminal',{disposition:nativeTerminal.disposition});return nativeTerminal;
 }
 async function finish(){
  if(!cutoffSnapshot){violation('CAPTURE_RETURN_CUTOFF_REQUIRED',{});stop('invalid-finish-without-cutoff');throwFatal();}
  stage='awaiting-frozen-native';await nativeSettlementPromise;
  // No querySelector, scan, drainMO, RAF, live-image wait or source assignment.
  // Never overwrite the fixed returnReady with a later DOM observation.
  throwFatal();
  if(!cutoffSnapshot.returnReady||frozenUrlRefs.some(({row})=>row.status!=='fulfilled')){violation('FROZEN_CAPTURE_CONTRACT_NOT_ACCEPTABLE',{});throwFatal();}
  stage='complete';return data();
 }

 async function rejectAndCollect(){
  // Diagnostic collection never clears or redeems firstFatal. Let each already
  // issued native decode settle, bounded by the same original window deadline.
  stop('caller-preserves-rejection');while(!allUrlsSettled()&&!deadlineExpired)await waitSignal();clearTimeout(deadline);return data();
 }
 // Install the readonly observer and event listeners BEFORE the first query.
 observer=new MutationObserver(onMutations);observer.observe(document,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['src','srcset','sizes','media','type','class','id']});
 document.addEventListener('load',onImageEvent,true);document.addEventListener('error',onImageEvent,true);
 event('observer-installed');stage='initial';scan('initial-query');
 const tick=()=>{if(stopped)return;drainRecords();scan('raf');raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
 deadlineStartedBrowserMs=now();deadlineDueBrowserMs=deadlineStartedBrowserMs+maxWindowMs;deadline=setTimeout(()=>{deadlineExpired=true;violation('FINITE_WINDOW_DEADLINE',{maxWindowMs});stop('deadline');wake();},maxWindowMs);
 const api={ready,captureReturnCutoff,finish,data,rejectAndCollect};(window.__r22FiniteImageWindows??=new Map()).set(windowId,api);return windowId;
}
let sequence=0;
async function beginImageWindow(page,{selector,expectation,maxWindowMs=10000}){
 if(!['images','canvas-only'].includes(expectation?.kind))throw new Error('Explicit scene image/canvas-only expectation required');
 if(expectation.kind==='images'&&!(expectation.minCount>=1))throw new Error('Image scenes require minCount>=1');
 const windowId='r22-image-window-'+(++sequence);await page.evaluate(installWindow,{selector,expectation,maxWindowMs,windowId});return windowId;
}
const awaitInitialImageReady=(page,windowId)=>page.evaluate(id=>window.__r22FiniteImageWindows.get(id).ready('initial-ready'),windowId);
const finishImageWindow=(page,windowId)=>page.evaluate(id=>window.__r22FiniteImageWindows.get(id).finish(),windowId);
const readImageWindow=(page,windowId)=>page.evaluate(id=>window.__r22FiniteImageWindows.get(id).data(),windowId);
const closeRejectedImageWindow=(page,windowId)=>page.evaluate(id=>window.__r22FiniteImageWindows.get(id).rejectAndCollect(),windowId);
module.exports={beginImageWindow,awaitInitialImageReady,finishImageWindow,readImageWindow,closeRejectedImageWindow};
