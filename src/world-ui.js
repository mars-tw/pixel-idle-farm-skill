/* World presentation and adventure integration; core rules stay DOM-free. */
(function () {
  "use strict";
  const A = window.AdventureAPI;
  if (!A) return;
  const sites = {
    fishing_dock: { tileId: "t2_9", sheet: "world_projects", frame: "fishing_dock", width: 1.65, visualYOffset: 1 },
    picnic_table: { tileId: "t10_10", sheet: "world_projects", frame: "picnic_table", width: 1.6 },
    garden: { tileId: "t6_2", sheet: "structures", frame: "flower_bed", width: 1.15 },
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = (id) => document.getElementById(id);
  const farm = () => window.__farm;
  let current = null, lastPanels = "", lastObjective = "", lastSites = "", lastFringe = "", lastTick = 0;
  let dialogueTimer = 0; let lastTargetAvoidAt = 0; let lastTargetAvoidId = "";
  const notify = (text) => { if (farm()) farm().toast(text); };
  // Resident presentation owns decoded bitmaps, never game clocks or served state.
  const residentPoseOwners = new WeakMap(), residentPoseNodes = new WeakMap();
  let residentPoseOwnerSequence = 0;
  const residentPoseIds = ['merchant','elder','child'], residentPoseKinds = ['wait','sit','sip','offer'], residentPoseEventLimit=128, residentPoseErrorLimit=32;
  const poseErrorData = error => ({name:error?.name||'Error',message:error?.message||String(error),stack:error?.stack??null,code:error?.code??null,isNativeDomException:error instanceof DOMException});
  const poseURL = value => new URL(String(value),document.baseURI).href;
  const poseName = value => /\/(wait|sit|sip|offer)-(merchant|elder|child)\.png(?:[?#]|$)/.exec(value)?.[1]||null;
  function poseOwnerLive(owner,node){return owner.active&&owner.root.isConnected&&(!owner.modal||owner.modal.classList.contains('show'))&&(!node||node.isConnected&&owner.root.contains(node)&&residentPoseNodes.get(node)===owner);}
  function poseEvent(owner,row){owner.eventCountTotal++;if(owner.events.length>=residentPoseEventLimit){owner.events.shift();owner.eventLogDrops++;}owner.events.push(row);}
  function poseFailure(owner,error,url,nativeDecode=false){
    const key=JSON.stringify([String(url),error?.name||'Error',error?.code??null]);owner.failed=true;owner.errorCountTotal++;
    let row=owner.requestErrors.find(item=>item.key===key)||(owner.firstNativeDecodeError?.key===key?owner.firstNativeDecodeError:null)||(owner.firstFailure?.key===key?owner.firstFailure:null);
    if(row)row.count++;else{row={key,url,error,count:1};if(owner.requestErrors.length>=residentPoseErrorLimit){owner.requestErrors.shift();owner.errorLogDrops++;}owner.requestErrors.push(row);poseEvent(owner,{kind:'error',url,code:error?.code??null,at:performance.now()});}
    if(!owner.firstFailure)owner.firstFailure=row;if(nativeDecode&&error instanceof DOMException&&!owner.firstNativeDecodeError)owner.firstNativeDecodeError=row;
    if(!poseOwnerLive(owner))return;
    const host=owner.root.closest('.modal-body')||owner.root.parentElement;
    if(host&&!owner.alert){const alert=document.createElement('p');alert.className='project-desc';alert.dataset.residentPoseError=String(owner.id);alert.setAttribute('role','alert');alert.textContent='插圖暫時讀不到，請回農場後再試。';host.appendChild(alert);owner.alert=alert;}
  }
  function disposeResidentPoseScenes(root){
    if(!root)return;const layouts=root.matches?.('.meal-layout')?[root]:[...root.querySelectorAll('.meal-layout')];
    for(const layout of layouts){const owner=residentPoseOwners.get(layout);if(owner){owner.active=false;owner.generation++;poseEvent(owner,{kind:'disposed',at:performance.now()});}}
  }
  function ensureResidentPoseScene(layout){
    const nodes=[...layout.querySelectorAll('img[data-seated-resident]')],prior=residentPoseOwners.get(layout);
    if(prior?.active&&prior.nodes.length===nodes.length&&nodes.every((node,i)=>node===prior.nodes[i]))return prior;
    if(prior){prior.active=false;prior.generation++;}
    const owner={id:++residentPoseOwnerSequence,generation:1,active:true,root:layout,modal:layout.closest('#worldModal'),nodes,pool:new Map(),states:new Map(),requestErrors:[],events:[],alert:null,failed:false,firstFailure:null,firstNativeDecodeError:null,errorCountTotal:0,errorLogDrops:0,eventCountTotal:0,eventLogDrops:0,requestCount:0,noopCount:0,srcCommitCount:0,visualCommitCount:0,coalescedPendingCount:0};residentPoseOwners.set(layout,owner);
    for(const id of residentPoseIds)for(const pose of residentPoseKinds){
      const raw='assets/generated/'+(pose==='wait'?'content-r13':'content-r9')+'/'+pose+'-'+id+'.png'+(window.FARM_VERSION_QUERY||''),url=poseURL(raw),image=new Image(),record={url,image,status:'pending',error:null,decodeCalls:1};owner.pool.set(url,record);image.src=url;
      record.promise=image.decode().then(()=>{if(!image.complete||image.naturalWidth!==48||image.naturalHeight!==64){const error=new Error('Resident pose dimensions are not ready');error.code='RESIDENT_POSE_BAD_DIMENSIONS';throw error;}record.status='ready';poseEvent(owner,{kind:'decoded',url,at:performance.now()});return record;}).catch(error=>{record.status='failed';record.error=error;poseFailure(owner,error,url,true);return record;});
    }
    for(const node of nodes){residentPoseNodes.set(node,owner);owner.states.set(node,{version:0,desiredURL:null,desiredRaw:null,desiredMeta:null,displayedURL:node.complete&&node.naturalWidth>0?node.currentSrc:null,renderedPose:null,pending:false,error:null,promise:null,invalidRaw:null});}
    owner.ready=Promise.all([...owner.pool.values()].map(record=>record.promise));
    for(const node of nodes)requestResidentPose(node,node.getAttribute('src'),{pose:poseName(node.getAttribute('src')||'')});
    return owner;
  }
  function prepareResidentPoses(root){
    if(!root)return Promise.resolve({status:'not-applicable'});const layouts=root.matches?.('.meal-layout')?[root]:[...root.querySelectorAll('.meal-layout')],owners=[];
    for(const layout of layouts)if(!layout.querySelector('.reserved-table'))owners.push(ensureResidentPoseScene(layout));
    return Promise.all(owners.map(owner=>owner.ready)).then(()=>residentPresentationState(root));
  }
  function requestResidentPose(node,raw,meta={}){
    if(!(node instanceof HTMLImageElement))return Promise.resolve(false);
    const layout=node.closest('.meal-layout');if(!layout)return Promise.resolve(false);
    const owner=residentPoseNodes.get(node)||ensureResidentPoseScene(layout),state=owner.states.get(node);if(!state)return Promise.resolve(false);
    owner.requestCount++;const rawValue=String(raw);if(state.invalidRaw===rawValue&&state.error){poseFailure(owner,state.error,rawValue);return Promise.resolve(false);}let url;try{url=poseURL(rawValue);}catch(error){state.version++;state.desiredURL=null;state.desiredRaw=rawValue;state.desiredMeta=meta;state.invalidRaw=rawValue;state.pending=false;state.promise=null;state.error=error;poseFailure(owner,error,rawValue);return Promise.resolve(false);}state.invalidRaw=null;
    if(state.desiredURL===url){state.desiredMeta=meta;if(state.pending){owner.coalescedPendingCount++;return state.promise;}}
    else{state.version++;state.desiredURL=url;state.desiredRaw=String(raw);state.desiredMeta=meta;}
    const version=state.version,generation=owner.generation,record=owner.pool.get(url);
    if(!record){const error=state.error?.code==='RESIDENT_POSE_UNMANAGED_URL'&&state.failedURL===url?state.error:new Error('Requested resident pose is outside the declared frame pool');error.code='RESIDENT_POSE_UNMANAGED_URL';state.failedURL=url;state.error=error;state.pending=false;poseFailure(owner,error,url);return Promise.resolve(false);}
    const commit=()=>{
      if(!poseOwnerLive(owner,node)||owner.generation!==generation||state.version!==version||state.desiredURL!==url){poseEvent(owner,{kind:'stale-commit-blocked',url,at:performance.now()});return false;}
      state.pending=false;
      if(record.status!=='ready'){state.error=record.error||new Error('Resident pose is not decoded');poseFailure(owner,state.error,url);return false;}
      const desiredPose=state.desiredMeta?.pose||poseName(url),desiredGesture=state.desiredMeta?.gesture||(desiredPose==='wait'||desiredPose==='sit'?'rest':'sip-or-bite'),hasReaction=state.desiredMeta?.personalReaction!==undefined;
      const sourceReady=node.currentSrc===url&&node.complete&&node.naturalWidth>0&&node.naturalHeight>0;
      const metadataSame=node.dataset.renderedSrc===url&&node.dataset.renderedPose===(desiredPose||'')&&node.dataset.upperPose===desiredPose&&node.dataset.gesture===desiredGesture&&(!hasReaction||node.dataset.personalReaction===state.desiredMeta.personalReaction);
      if(sourceReady&&metadataSame&&state.displayedURL===url&&state.renderedPose===desiredPose&&!state.error){owner.noopCount++;return true;}
      if(!sourceReady){node.src=state.desiredRaw;owner.srcCommitCount++;}
      if(node.currentSrc!==url||!node.complete||node.naturalWidth<=0||node.naturalHeight<=0){const error=state.error?.code==='RESIDENT_POSE_COMMIT_NOT_READY'?state.error:new Error('Decoded resident pose was not ready after native source commit');error.code='RESIDENT_POSE_COMMIT_NOT_READY';state.error=error;poseFailure(owner,error,url);return false;}
      state.error=null;state.displayedURL=url;state.renderedPose=desiredPose;const setData=(key,value)=>{if(node.dataset[key]!==value)node.dataset[key]=value;};setData('renderedSrc',url);setData('renderedPose',desiredPose||'');if(desiredPose)setData('upperPose',desiredPose);setData('gesture',desiredGesture);if(hasReaction)setData('personalReaction',state.desiredMeta.personalReaction);
      owner.visualCommitCount++;poseEvent(owner,{kind:'committed',url,version,at:performance.now()});return true;
    };
    if(record.status!=='pending')return Promise.resolve(commit());
    state.pending=true;state.error=null;state.promise=record.promise.then(commit).catch(error=>{state.pending=false;state.error=error;poseFailure(owner,error,url);return false;});return state.promise;
  }
  function residentPresentationState(root){
    if(!root)return {status:'not-applicable',atBrowserMs:performance.now(),scenes:[],errors:[]};
    const layouts=(root.matches?.('.meal-layout')?[root]:[...root.querySelectorAll('.meal-layout')]).filter(layout=>!layout.querySelector('.reserved-table'));
    if(!layouts.length)return {status:root.querySelector('.gather-stage')?'missing':'not-applicable',atBrowserMs:performance.now(),scenes:[],errors:[]};
    const scenes=layouts.map(layout=>{
      const nodes=[...layout.querySelectorAll('img[data-seated-resident]')],owner=residentPoseOwners.get(layout),ids=nodes.map(node=>node.dataset.seatedResident),missing=nodes.length!==3||residentPoseIds.some(id=>ids.filter(x=>x===id).length!==1);
      if(!owner)return {status:missing?'missing':'unmanaged',nodes:ids,errors:[]};
      const errorRows=[];for(const row of[owner.firstNativeDecodeError,owner.firstFailure,...owner.requestErrors])if(row&&!errorRows.some(item=>item.key===row.key)&&errorRows.length<residentPoseErrorLimit)errorRows.push(row);const errors=errorRows.map(row=>({url:row.url,count:row.count,error:poseErrorData(row.error)})),rows=nodes.map(node=>{const state=owner.states.get(node);return {id:node.dataset.seatedResident,managed:residentPoseNodes.get(node)===owner&&!!state,version:state?.version??null,desiredRaw:state?.desiredRaw??null,desiredURL:state?.desiredURL??null,desiredPose:state?.desiredMeta?.pose??null,displayedURL:state?.displayedURL??null,renderedPose:state?.renderedPose??null,pending:state?.pending??true,error:state?.error?poseErrorData(state.error):null,native:{src:node.src,currentSrc:node.currentSrc,complete:node.complete,naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight,isConnected:node.isConnected}};});
      const frames=[...owner.pool.values()].map(record=>({url:record.url,status:record.status,decodeCalls:record.decodeCalls,retainedImage:record.image instanceof HTMLImageElement,error:record.error?poseErrorData(record.error):null}));
      const status=!poseOwnerLive(owner)?'disposed':missing?'missing':owner.failed?'error':rows.some(row=>!row.managed)?'unmanaged':frames.some(frame=>frame.status!=='ready')||rows.some(row=>row.pending||row.error||row.desiredURL!==row.displayedURL||!row.native.complete||row.native.currentSrc!==row.displayedURL||row.native.naturalWidth<=0)?'pending':'ready';
      return {ownerId:owner.id,generation:owner.generation,status,failed:owner.failed,eventLogLimit:residentPoseEventLimit,eventLogDrops:owner.eventLogDrops,eventCountTotal:owner.eventCountTotal,errorLogLimit:residentPoseErrorLimit,errorLogSize:owner.requestErrors.length,errorLogDrops:owner.errorLogDrops,errorCountTotal:owner.errorCountTotal,requestCount:owner.requestCount,noopCount:owner.noopCount,srcCommitCount:owner.srcCommitCount,visualCommitCount:owner.visualCommitCount,coalescedPendingCount:owner.coalescedPendingCount,firstNativeDecodeError:owner.firstNativeDecodeError?{url:owner.firstNativeDecodeError.url,count:owner.firstNativeDecodeError.count,error:poseErrorData(owner.firstNativeDecodeError.error)}:null,requiredFrames:12,frames,nodes:rows,errors,events:owner.events.slice()};
    });
    const status=['error','missing','unmanaged','disposed','pending'].find(value=>scenes.some(scene=>scene.status===value))||'ready';return {status,atBrowserMs:performance.now(),scenes,errors:scenes.flatMap(scene=>scene.errors)};
  }

  const refresh = (s) => { current = s || current; if (!current) return; reconcile(current); syncHeaderVars(); renderObjective(current); renderPanels(); if (window.DailyUI) window.DailyUI.refresh(current); setTimeout(ensureTargetVisible, 60); };
  const costText = (rows) => (rows || []).map((r) => `${esc(r.name)} ${Math.min(r.current, r.required)}/${r.required}`).join("・");
  const npcTile = (id) => current.map.tiles.find((t) => t.npc === id);
  const stationTile = (id) => current.map.tiles.find((t) => t.station === id);
  const homeTile = () => current.map.tiles.find((t) => t.structureId === "farmhouse");
  const siteTileId = (id) => (current.adventure.siteTiles || {})[id] || (window.WORLD_PROJECT_SITES || {})[id] || sites[id].tileId;

  // Record only successful mutations. Reading NPC dialogue is not a talk event.
  const hooks = {
    plant: (s, args, r) => ({ type: "plant", cropId: args[2] }),
    waterPlot: () => ({ type: "water" }),
    harvest: (s, args, r) => ({ type: "harvest", cropId: r.cropId, count: r.added }),
    fulfillOrder: () => ({ type: "order" }),
    gatherForage: (s, args, r) => {
      const node = (window.FORAGE_NODES || []).find((n) => n.id === args[1]);
      return { type: "forage", itemId: node && node.itemId, count: r.added };
    },
    feedAnimal: () => ({ type: "care" }), waterAnimal: () => ({ type: "care" }), groomAnimal: () => ({ type: "care" }),
  };
  Object.keys(hooks).forEach((name) => {
    const original = window[name]; if (typeof original !== "function") return;
    window[name] = function (...args) {
      A.ensure(args[0], Date.now());
      const result = original.apply(this, args);
      if (result && result.ok) {
        A.record(args[0], hooks[name](args[0], args, result), Date.now());
        const tutorial = A.finishTutorial && A.finishTutorial(args[0], Date.now());
        if (tutorial && tutorial.ok) notify(tutorial.message);
      }
      return result;
    };
  });

  function prepare(s) {
    current = s;
    A.ensure(s, Date.now());
    window.configureWorld(s);
    const standing = window.getTileById(s, s.player.tileId);
    if (standing && standing.adventureSite) {
      const free = s.map.tiles.filter((t) => window.isWalkable(s, t)).sort((a, b) => (Math.abs(a.x - standing.x) + Math.abs(a.y - standing.y)) - (Math.abs(b.x - standing.x) + Math.abs(b.y - standing.y)))[0];
      if (free) Object.assign(s.player, { tileId: free.id, x: free.x, y: free.y });
    }
    if (s.settings.worldEdition !== 75) {
      s.settings.mapViewMode = "natural";
      s.settings.smartAssistant = false;
      s.settings.worldEdition = 75;
    }
  }
  function reconcile(s) {
    A.ensure(s, Date.now());
    const counts = s.adventure.counts, stats = s.stats || {};
    const total = (map) => Object.values(map || {}).reduce((sum, n) => sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0), 0);
    counts.plant = Math.max(counts.plant, stats.plantCount || 0);
    counts.harvest = Math.max(counts.harvest, total(stats.harvested));
    counts.order = Math.max(counts.order, stats.fulfilledOrders || 0);
    for (const id of Object.keys(window.FORAGE_ITEMS || {})) {
      s.adventure.byTarget.forage[id] = Math.max(s.adventure.byTarget.forage[id] || 0, (stats.collected || {})[id] || 0);
    }
    counts.forage = Math.max(counts.forage, total(s.adventure.byTarget.forage));
  }
  function rowsOf(q) { return (q.objectives || []).concat(q.requirements || []); }
  function targetFor(q) {
    if (!q) return null;
    if (q.canClaim) return npcTile(q.npcId);
    const row = rowsOf(q).find((r) => !r.complete);
    if (row) {
      if (row.type === "talk") return npcTile(row.id);
      if (row.type === "restore") return window.getTileById(current, siteTileId(row.id));
      if (row.type === "cook" || row.source === "meals") return homeTile();
      if (row.type === "fish" || row.source === "catch") return window.getTileById(current, siteTileId("fishing_dock"));
      if (row.type === "forage" || row.id === "river_mint") {
        if (!current.flags.bridgeRepaired) return window.bridgeMaterialTargetTile(current) || current.map.tiles.find((t) => t.bridge);
        const node = (window.FORAGE_NODES || []).find((n) => n.itemId === (row.id || "river_mint"));
        return node && current.map.tiles.find((t) => t.forage === node.id);
      }
      if (row.type === "order") return stationTile("order_board");
      if (row.type === "care") {
        const home = current.buildings.find((b) => b.id === (current.animals[0] || {}).homeId);
        return home && window.getTileById(current, home.tileId);
      }
      const cropId = row.consume && window.CROPS[row.id] ? row.id : "wheat";
      const active = window.activePlotCount(current);
      const plotTiles = current.map.tiles.filter((t) => t.plotIndex != null && t.plotIndex < active);
      const sunlit = (t) => window.isSunlit && window.isSunlit(current, t.plotIndex, Date.now());
      if (row.type === "water") {
        const sunDry = plotTiles.find((t) => {
          const p = current.plots[t.plotIndex];
          const progress = p.cropId && window.getCropProgress(current, p, Date.now());
          return sunlit(t) && progress && !progress.ready && !progress.wet;
        });
        if (sunDry) return sunDry;
        const dryCrop = plotTiles.find((t) => {
          const p = current.plots[t.plotIndex];
          const progress = p.cropId && window.getCropProgress(current, p, Date.now());
          return progress && !progress.ready && !progress.wet;
        });
        return dryCrop || plotTiles.find((t) => !current.plots[t.plotIndex].cropId)
          || plotTiles.find((t) => current.plots[t.plotIndex].cropId && window.getCropProgress(current, current.plots[t.plotIndex], Date.now()).ready)
          || null;
      }
      const fits = (t) => {
        if (t.plotIndex == null || t.plotIndex >= active) return false;
        const p = current.plots[t.plotIndex];
        if (row.type === "plant") return !p.cropId;
        return p.cropId === cropId && window.getCropProgress(current, p, Date.now()).ready;
      };
      const tile = plotTiles.find((t) => fits(t) && sunlit(t)) || plotTiles.find(fits)
        || plotTiles.find((t) => !current.plots[t.plotIndex].cropId) || plotTiles[0];
      return tile;
    }
    return npcTile(q.npcId);
  }
  function renderObjective(s) {
    current = s;
    const box = el("questDock"); if (!box || !s) return false;
    try { updateSunChip(s); } catch (e) {}
    try { markNextPlot(s); } catch (e) {}
    try { if (unstickWaterStep(s)) return renderObjective(s); } catch (e) {}
    if (window.HeirloomUI && window.HeirloomUI.renderObjective(s, box)) { lastObjective = ""; syncSeedHudTop(); return true; }
    const summary = A.summary(s, Date.now());
    const q = summary.currentQuest;
    const guide = A.guide(s, Date.now());
    const early = A.earlyGoals ? A.earlyGoals(s, Date.now()) : { available: false, goals: [] };
    const festival = A.festivalStatus ? A.festivalStatus(s, Date.now()) : { unlocked: false, active: false, goals: [] };
    const festivalTime = Math.max(0, Math.ceil((festival.remainingMs || 0) / 1000));
    const festivalDone = festival.goals ? festival.goals.filter((g) => g.complete).length : 0;
    const festivalCompact = festival.active ? `<span class="r65b-festival-compact" aria-hidden="true">祭典 ${festivalDone}/${festival.goals.length}・${Math.floor(festivalTime / 60) >= 1 ? `剩 ${Math.floor(festivalTime / 60)} 分` : "剩不到 1 分"}</span>` : "";
    const festivalHtml = !festival.unlocked ? "" : `<section class="r61a-festival-banner" data-active="${festival.active}"><b>${festival.active ? "河畔收穫祭進行中" : "下一場河畔收穫祭"}</b>${festivalCompact}<small>${festival.active ? `${festival.goals.map((g) => `${g.complete ? "✓" : "○"}${esc(g.name)} ${g.current}/${g.required}`).join("・")}・剩 ${Math.floor(festivalTime / 60)} 分 ${festivalTime % 60} 秒` : `${Math.floor(festivalTime / 60)} 分 ${festivalTime % 60} 秒後開場`}</small>${festival.canComplete ? '<button type="button" data-complete-festival>領取獎章與裝飾</button>' : ""}</section>`;
    const badge = el("storyBadge");
    if (badge) { badge.textContent = q && q.canClaim ? "!" : ""; badge.hidden = !(q && q.canClaim); }
    const unfinished = q && rowsOf(q).find((r) => !r.complete);
    const hint = objectiveHint(s, unfinished);
    const choiceRoutes = window.FarmEarlyChoiceRoutesHtml ? window.FarmEarlyChoiceRoutesHtml(s) : "";
    // 倒數秒數只更新文字，不重建按鈕，避免玩家按下時按鈕被換掉。
    const sig = JSON.stringify([q, summary.claimed, hint && hint.kind, choiceRoutes, early, festival.active, festival.completed, festival.canComplete, festival.goals, festivalTime]);
    if (sig === lastObjective) {
      syncSeedHudTop();
      const hintEl = box.querySelector(".world-objective-hint");
      if (hintEl && hint && hintEl.textContent !== hint.text) hintEl.textContent = hint.text;
      return true;
    }
    lastObjective = sig;
    if (early.available && !early.complete) {
      box.dataset.quest = "early_free_choice";
      box.dataset.stepType = "choice";
      box.dataset.targetId = "";
      if (document.body) document.body.dataset.questStep = "choice";
      const primaryGoal = early.nextStep && !early.nextStep.complete ? "meal" : (early.goals.find((goal) => !goal.complete) || {}).id; // R63：收合時只留這一顆主要按鈕
      box.innerHTML = `${festivalHtml}<div class="world-objective-title"><span class="qp-step">今日三件事</span> <span data-audit="quest-progress">${early.goals.filter((goal) => goal.complete).length}/3</span></div>
        ${hint ? `<button type="button" class="world-objective-hint" data-hint="${esc(hint.kind)}" data-next-tile="${esc(hint.tileId || "")}">${esc(hint.text)}</button>` : ""}
        <div class="world-objective-routes" data-audit="early-free-goals">${early.goals.map((goal) => `<button type="button" class="world-objective-route${goal.complete ? " tracked" : ""}${goal.id === primaryGoal ? " r63-primary" : ""}" data-early-goal="${goal.id}" ${goal.complete ? "disabled" : ""}><b>${goal.complete ? "✓ " : ""}${esc(goal.name)}</b><small>${esc(goal.detail)}・獎勵：${esc(goal.rewardText)}</small>${goal.actionLabel ? `<em>${esc(goal.actionLabel)}</em>` : ""}</button>`).join("")}</div>
        ${early.nextStep ? `<button type="button" class="r63a-main-next${early.nextStep.complete ? " complete" : ""}${primaryGoal === "meal" ? " r63-primary" : ""}" data-early-goal="meal" ${early.nextStep.complete ? "disabled" : ""}><b>${early.nextStep.complete ? "✓ " : ""}${esc(early.nextStep.label)}：${esc(early.nextStep.name)}</b><small>${esc(early.nextStep.detail)}</small>${early.nextStep.actionLabel && !early.nextStep.complete ? `<em>${esc(early.nextStep.actionLabel)}</em>` : ""}</button>` : ""}`;
      box.querySelectorAll("[data-early-goal]").forEach((button) => { button.onclick = () => goEarlyGoal(button.dataset.earlyGoal); });
      const nextHint = box.querySelector("[data-next-tile]"); if (nextHint) nextHint.onclick = () => goNextFarmStep();
      const festivalButton = box.querySelector("[data-complete-festival]"); if (festivalButton) festivalButton.onclick = () => { const r = A.completeFestival(s, Date.now()); notify(r.message); if (r.ok && farm() && farm().safeSaveNow) farm().safeSaveNow(); lastObjective = ""; renderObjective(s); };
      syncSeedHudTop();
      return true;
    }
    const step = q ? guide.stepText : "村民留下了野餐合照。繼續經營你的農場。";
    const activeGoal = guide.route ? guide.step : (q && rowsOf(q).find((row) => !row.complete));
    // R31：數字前寫出目前步驟，分母換步驟時玩家看得懂（「種下作物 2/3」而不是只有「2/3」）。
    const progressStep = activeGoal && activeGoal.name ? `${q && q.chapter >= 4 ? q.name + "・" : ""}${activeGoal.name}` : "";
    const progressText = activeGoal ? `${activeGoal.current}/${activeGoal.required}` : (q && q.canClaim ? `✓ 回報${((window.NPCS || {})[q.npcId] || { name: "鎮民" }).name}` : (q ? "1/1" : ""));
    const target = targetFor(q);
    box.dataset.quest = q ? q.id : "picnic_complete";
    box.dataset.stepType = guide.step ? (guide.step.type || "goal") : (q ? "claim" : "free");
    if (document.body) document.body.dataset.questStep = box.dataset.stepType;
    box.dataset.targetId = target ? target.id : "";
    box.innerHTML = `<div class="world-objective-title">${q ? `${progressStep ? `<span class="qp-step">${esc(progressStep)}</span> ` : `<span class="qp-step">${esc(guide.displayTitle || q.name)}</span> `}<span data-audit="quest-progress">${esc(progressText)}</span>` : "繼續經營農場"}</div>
      ${choiceRoutes && !/route[^"]*tracked/.test(choiceRoutes) && /你想先做哪一件事/.test(choiceRoutes) ? choiceRoutes : ""}
      <div class="world-objective-bottom">${choiceRoutes && !/route[^"]*tracked/.test(choiceRoutes) && /你想先做哪一件事/.test(choiceRoutes) ? `<button type="button" data-choice-open>選擇下一步</button>` : `<button type="button" data-world-go>${q ? esc(guide.actionLabel) : "繼續經營"}</button>`}</div>`;
    if (festivalHtml) box.insertAdjacentHTML("afterbegin", festivalHtml);
    const festivalButton = box.querySelector("[data-complete-festival]"); if (festivalButton) festivalButton.onclick = () => { const r = A.completeFestival(s, Date.now()); notify(r.message); if (r.ok && farm() && farm().safeSaveNow) farm().safeSaveNow(); lastObjective = ""; renderObjective(s); };
    const chooseFirstRoute = (button) => {
      const status = A.firstChoiceStatus(s);
      const result = status.selected ? A.trackFirstPath(s, button.dataset.firstChoice) : A.chooseFirstPath(s, button.dataset.firstChoice);
      if (result.ok) { if (farm()) farm().safeSaveNow(); lastObjective = ""; farm().closeModal("worldModal"); renderObjective(s); if (!status.selected) { const g2 = A.guide(s, Date.now()); const q2 = A.summary(s, Date.now()).currentQuest; if (g2 && g2.route === "order") openPanel("orders"); else if (q2) goQuest(q2); } }
      else notify(result.message);
    };
    box.querySelectorAll("#questDock > .world-objective-routes [data-first-choice], .world-objective-routes [data-first-choice]").forEach((button) => { if (box.contains(button)) button.onclick = () => chooseFirstRoute(button); }); // R57：展開的任務卡直接列出兩個選項
    const choiceOpen = box.querySelector("[data-choice-open]"); if (choiceOpen) choiceOpen.onclick = () => {
      const choiceModal = modal("選擇下一步", choiceRoutes);
      choiceModal.querySelectorAll("[data-first-choice]").forEach((button) => { button.onclick = () => chooseFirstRoute(button); });
      const first = choiceModal.querySelector("[data-first-choice]"); if (first && first.focus) first.focus();
    };
    const goBtn = box.querySelector("[data-world-go]"); if (goBtn) goBtn.onclick = () => guide.route === "order" ? openPanel("orders") : q ? goQuest(q) : openKitchen();
    syncSeedHudTop();
    return true;
  }
  // R44：作物不澆水也會長大；若玩家還沒澆完、作物就已成熟，成熟作物不能再澆，澆水步驟會卡住。
  // 這時把剩下的澆水次數補記，並告訴玩家原因（只在田裡已沒有可澆的作物時觸發）。
  let waterStuckSince = 0;
  function unstickWaterStep(s) {
    const g = A.guide(s, Date.now());
    if (!g || !g.step || g.step.type !== "water" || g.step.complete) return false;
    const now = Date.now(), active = window.activePlotCount ? window.activePlotCount(s) : 6;
    const planted = (s.plots || []).slice(0, active).filter((p) => p && p.cropId);
    if (!planted.length) return false;
    const waterable = planted.some((p) => !window.getCropProgress(s, p, now).ready && !((p.wateredAt || 0) >= p.plantedAt));
    const anyReady = planted.some((p) => window.getCropProgress(s, p, now).ready);
    if (waterable || !anyReady) { waterStuckSince = 0; return false; }
    if (!waterStuckSince) waterStuckSince = now;
    if (now - waterStuckSince < 8000) return false; // 狀態持續 8 秒才補記，避免剛熟的一瞬間就跳過
    waterStuckSince = 0;
    const remain = Math.max(0, (g.step.required || 0) - (g.step.current || 0));
    if (!remain) return false;
    const r = A.record(s, { type: "water", count: remain }, now);
    if (r && r.ok) { notify("作物已經自己長熟了，澆水這一步算你完成。下次趁早澆水，會長得更快。"); lastObjective = ""; return true; }
    return false;
  }
  // R43：播種步驟時，下一格要種的空田加上「下一格」提示，玩家不必自己找哪一格還沒種
  function markNextPlot(s) {
    if (typeof document.querySelectorAll !== "function") return;
    document.querySelectorAll(".gtile.next-plot").forEach((n) => n.classList.remove("next-plot"));
    const g = A.guide(s, Date.now());
    if (!g || !g.step || g.step.type !== "plant" || g.step.complete) return;
    const active = window.activePlotCount ? window.activePlotCount(s) : 6;
    const idx = (s.plots || []).slice(0, active).findIndex((p) => p && !p.cropId);
    if (idx < 0) return;
    const tile = s.map && s.map.tiles.find((t) => t.plotIndex === idx);
    const node = tile && document.querySelector('.gtile[data-tile-id="' + tile.id + '"]');
    if (node) node.classList.add("next-plot");
  }
  // R42：陽光出現時，畫面上一定看得到一個「陽光在哪、還剩多久」的小標籤（不會被對話或面板藏起），點一下鏡頭帶到受光的田
  function updateSunChip(s) {
    if (typeof document.createElement !== "function" || !document.body) return;
    const now = Date.now();
    const sun = window.sunpatchStatus ? window.sunpatchStatus(s, now) : null;
    const active = window.activePlotCount ? window.activePlotCount(s) : 6;
    const plots = sun && sun.active ? sun.plots.filter((i) => i < active) : [];
    let chip = el("sunChip");
    if (!plots.length) { if (chip) chip.hidden = true; return; }
    if (!chip) {
      chip = document.createElement("button"); chip.type = "button"; chip.id = "sunChip"; chip.className = "sun-chip"; chip.dataset.audit = "sun-chip";
      chip.onclick = () => { const cur = current; const st = cur && window.sunpatchStatus ? window.sunpatchStatus(cur, Date.now()) : null; const idx = st && st.plots && st.plots[0]; const tile = cur && cur.map && cur.map.tiles.find((t) => t.plotIndex === idx); if (tile && farm() && farm().focusTile) farm().focusTile(tile.id); };
      document.body.appendChild(chip);
    }
    chip.hidden = false;
    chip.textContent = `☀ 陽光照在 ${plots.length} 格田・剩 ${Math.ceil(sun.remainingMs / 1000)} 秒`;
    chip.setAttribute("aria-label", chip.textContent + "，點一下看受光的田");
    const dock = el("questDock"); const r = dock && dock.getBoundingClientRect ? dock.getBoundingClientRect() : null;
    if (r && r.height) { const right = r.right + 8 + 230 < window.innerWidth; chip.style.left = Math.round(right ? r.right + 8 : r.left) + "px"; chip.style.top = Math.round(right ? r.top + 4 : r.bottom + 6) + "px"; // R42：優先放在任務卡右側，避免疊到種子欄
      // R63B（第 6 項）：陽光標籤改放任務卡下方時，不得蓋住種子欄（含「全部」鈕）
      const seed = el("seedHud"); const sr = seed && seed.getBoundingClientRect ? seed.getBoundingClientRect() : null; const cr = chip.getBoundingClientRect ? chip.getBoundingClientRect() : null;
      if (sr && cr && sr.height && cr.left < sr.right && cr.right > sr.left && cr.top < sr.bottom && cr.bottom > sr.top) chip.style.top = Math.round(sr.bottom + 6) + "px";
    }
  }
  // R79：等待時告訴玩家還要多久、現在能做什麼；光斑出現時引導去光裡。
  function objectiveHint(s, row) {
    const now = Date.now();
    const next = A.nextFarmStep ? A.nextFarmStep(s, now) : null;
    if (next && next.action === "harvest") return { kind: "ready", text: next.text, tileId: next.tileId };
    const active = window.activePlotCount ? window.activePlotCount(s) : 6;
    const readyCount = (s.plots || []).slice(0, active).filter((p) => p && p.cropId && window.getCropProgress(s, p, now).ready).length;
    if (readyCount > 0) return { kind: "ready", text: `田裡有 ${readyCount} 格可以收成，先收成。` };
    const sun = window.sunpatchStatus ? window.sunpatchStatus(s, now) : null;
    if (sun && sun.active && sun.plots.length) {
      const useful = sun.plots.some((i) => i < active && s.plots[i]);
      if (useful) return { kind: "sun", text: `☀ 陽光 ${Math.ceil(sun.remainingMs / 1000)} 秒・光裡種澆收有加成` };
    }
    if (!row || !(row.type === "harvest" || (row.consume && window.CROPS[row.id]))) return null;
    let soonest = Infinity, anyReady = false;
    for (let i = 0; i < Math.min(active, s.plots.length); i++) {
      const p = s.plots[i]; if (!p.cropId) continue;
      const prog = window.getCropProgress(s, p, now);
      if (prog.ready) anyReady = true; else soonest = Math.min(soonest, prog.remainingMs);
    }
    if (anyReady || !Number.isFinite(soonest)) return null;
    const secs = Math.ceil(soonest / 1000);
    return { kind: "wait", text: secs <= 90 ? `⏳ 最快 ${secs} 秒成熟・澆水更快` : `⏳ 最快 ${Math.ceil(secs / 60)} 分鐘成熟` };
  }
  function openPanel(tab) {
    if (!farm()) return;
    farm().selectTab(tab);
    document.querySelector(".side-panel").classList.add("world-panel-open");
    renderPanels();
  }
  // R62B（第 9 項）：手札頂部「鄰居好感」入口——切到圖鑑分頁並直接捲到鄰居區塊，看愛心、下一段故事與送禮。
  function openNeighborsJournal() {
    if (!farm()) return;
    farm().selectTab("journal");
    document.querySelector(".side-panel").classList.add("world-panel-open");
    const jump = () => {
      if (window.NeighborsR61 && current) window.NeighborsR61.injectJournal(current);
      const sec = document.querySelector("[data-r61b-neighbors]");
      if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: "start" });
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(jump, 30));
    else jump();
  }
  function closePanels() {
    const panel = document.querySelector(".side-panel");
    if (panel) panel.classList.remove("world-panel-open");
  }
  function renderPanels() {
    if (!current) return;
    const panel = el("adventurePanel"); if (!panel) return;
    const list = A.quests(current, Date.now());
    const projects = A.projects(current);
    const commissions = A.commissions(current, Date.now());
    const personal = A.personalQuests ? A.personalQuests(current, Date.now()) : [];
    const permanent = A.permanentResults ? A.permanentResults(current, Date.now()) : [];
    const r58evt = A.randomEvents ? A.randomEvents(current, Date.now()) : { active: null };
    const buffs = A.activeBuffs ? A.activeBuffs(current, Date.now()) : null;
    const sig = JSON.stringify([list, projects, commissions, current.adventure.neighbors, current.adventure.gathering, personal, permanent, r58evt, buffs && Math.floor(buffs.growthRemainingMs / 30000), buffs && Math.floor(buffs.orderRemainingMs / 30000)]);
    if (sig !== lastPanels) {
      lastPanels = sig;
      const availability = A.storyPanelAvailability(current);
      const currentMain = A.summary(current, Date.now()).currentQuest;
      const questCard = (q, main) => { const chapter = A.summary(current, Date.now()).chapters.find((row) => row.number === q.chapter); const chapterLabel = chapter && chapter.claimed === chapter.total ? "已完成" : { locked: "尚未開始", active: "進行中", ready: q.canClaim ? "可以交付" : "補齊物品", claimed: "已完成" }[q.status]; const mainStep = main && A.nextFarmStep ? A.nextFarmStep(current, Date.now()) : null; return `<article class="adventure-quest ${q.status}${main ? " r63a-main-story" : ""}" data-quest="${q.id}"${main ? ' data-r63a-main-story=""' : ""}>
        <div class="world-chapter">第 ${q.chapter} 章・${esc(q.chapterName)} <span>${chapterLabel}</span></div>
        <h3>${esc(q.name)}</h3><p>${esc(mainStep ? mainStep.text : q.description)}</p>
        <div class="adventure-meta">${rowsOf(q).map((r) => `<span>${r.complete ? "✓" : "·"} ${esc(r.name)} ${Math.min(r.current, r.required)}/${r.required}</span>`).join("")}</div>
        ${q.status !== "claimed" && q.status !== "locked" ? `<div class="adventure-meta"><span>報酬 ${q.reward.coins} 金・${q.reward.xp} 經驗</span></div><button data-quest-go="${q.id}"${mainStep ? ' data-main-next="1"' : ""}>${esc(mainStep ? mainStep.actionLabel : q.canClaim ? "前往交談" : A.taskActionLabel(q, rowsOf(q).find((row) => !row.complete), (window.NPCS || {})[q.npcId]))}</button>` : ""}</article>`; };
      panel.innerHTML = `${currentMain ? `<section class="r63a-main-story-wrap"><h3 class="story-subhead">目前主線</h3>${questCard(currentMain, true)}</section>` : ""}<div class="adventure-quests r63a-story-history">${list.filter((q) => !currentMain || q.id !== currentMain.id).map((q) => questCard(q, false)).join("")}</div>
        ${availability.showNeighborBasket ? `<div class="neighbor-entry"><h3>餐籃送到以後</h3><p class="project-desc">帶一份麥餅，坐下聽鄰居說說話。記住那一口味道，下次再帶來。</p><button id="worldNeighborButton">裝一份鄰居餐籃</button></div>` : ""}
        ${availability.showRiverCommissions ? `<h3 class="story-subhead">河畔委託</h3><p class="project-desc">市集每五分鐘整理一批餐籃。多釣的魚和料理，送給需要的鄰居。</p>${commissions.map((c) => `<div class="adventure-quest"><h3>${esc(c.name)}</h3><p class="project-desc">${costText(c.requirements)}・報酬 ${c.reward.coins} 金${c.reward.materials.wood ? `・木料 ${c.reward.materials.wood}` : ""}</p><button data-commission="${c.id}" ${c.canClaim ? "" : "disabled"}>${c.completed ? "本批已送達" : c.unlocked ? c.canClaim ? "帶去交付" : "餐籃未齊" : "修好釣台後開放"}</button></div>`).join("")}` : ""}`;
      const r58host = document.createElement("div"); r58host.className = "r58-section";
      // R60B：鄰居委託先列現在可做的（未鎖定且未完成），其餘收進可展開的「之後的委託」；卡片文字與交付規則不變。
      const personalCard = (p) => `<div class="r58-card${p.unlocked && !p.completed ? " r60-available-card" : " r60-later-card"}" data-r58-personal-card="${esc(p.id)}"${p.unlocked && !p.completed ? ' data-r60-available="1"' : ""}${p.catchUp ? ' data-r64b-catchup="1"' : ""}><h4>${esc(p.npcName)}・${esc(p.title)}${p.catchUp ? '<span class="r64b-catchup">可補做</span>' : ""}</h4><details class="r63a-full-request"><summary>查看委託全文</summary><p>${esc(p.dialogue)}</p></details><p class="r58-meta">第 ${p.chapter} 章・好感 ${p.favor}・${costText(p.requirements)}・報酬 ${p.reward.coins} 金・${p.reward.xp} 經驗</p>${p.completed ? `<p class="r58-done">已完成</p>` : `<button data-r58-personal="${esc(p.id)}" ${p.canComplete ? "" : "disabled"}>${p.unlocked ? (p.canComplete ? "帶去交付" : "物品未齊") : "尚未出現"}</button>`}</div>`;
      const sortedPersonal = window.NeighborsR61 && window.NeighborsR61.sortPersonalQuests ? window.NeighborsR61.sortPersonalQuests(personal, currentMain ? currentMain.chapter : 5) : personal; // R64B（第 7 項）
      const availablePersonal = sortedPersonal.filter((p) => p.unlocked && !p.completed);
      const laterPersonal = sortedPersonal.filter((p) => !p.unlocked || p.completed);
      r58host.innerHTML = `${r58evt.active ? `<div class="r58-card r59-event r60-event-card" data-r58-event="${esc(r58evt.active.id)}"><h4>${esc(r58evt.active.icon)} ${esc(r58evt.active.name)}</h4><p>${esc(r58evt.active.dialogue)}</p><p class="r58-meta">請選一個做法・剩 ${Math.max(1, Math.ceil(r58evt.active.remainingMs / 60000))} 分鐘</p><div class="r59-event-options">${r58evt.active.options.map((option) => `<button data-r58-resolve="${esc(option.id)}" ${option.available ? "" : "disabled"}>${esc(option.label)}<small>${esc(option.available ? option.resultText : option.unavailableReason)}</small></button>`).join("")}</div></div>` : `<div class="r58-card r60-event-note"><h4>🌾 農場小事</h4><p class="r58-meta">小事會在遊玩途中自己找上門，處理完一件，下一件約在 2～3 分鐘後出現。</p></div>`}
        ${buffs && (buffs.growthRemainingMs > 0 || buffs.orderRemainingMs > 0) ? `<div class="r58-card r58-buff"><h4>🍽️ 料理增益生效中</h4><p class="r58-meta">${buffs.growthRemainingMs > 0 ? `成長加速・剩 ${Math.ceil(buffs.growthRemainingMs / 60000)} 分鐘 ` : ""}${buffs.orderRemainingMs > 0 ? `訂單收入提高・剩 ${Math.ceil(buffs.orderRemainingMs / 60000)} 分鐘` : ""}</p></div>` : ""}
        <h3 class="story-subhead">鄰居個人委託</h3><p class="project-desc">每位鄰居有兩件自己的小委託，完成會讓好感 +1。</p>
        ${availablePersonal.map(personalCard).join("")}
        ${laterPersonal.length ? `<details class="r60-later-quests"><summary class="r60-later-summary">之後的委託（${laterPersonal.length}）</summary>${laterPersonal.map(personalCard).join("")}</details>` : ""}
        ${permanent.filter((result) => result.unlocked).map((result) => `<div class="r58-card r59-permanent" data-r59-permanent="${esc(result.npcId)}"><h4>${esc(result.icon)} ${esc(result.name)}</h4><p>${esc(result.text)}</p><p class="r58-meta">${esc(result.revisit)}</p></div>`).join("")}`;
      const mainStoryHost = panel.querySelector(".r63a-main-story-wrap");
      if (mainStoryHost) mainStoryHost.after(r58host); else if (panel.firstChild) panel.insertBefore(r58host, panel.firstChild); else panel.appendChild(r58host); if (typeof window.dispatchEvent === "function" && typeof Event === "function") window.dispatchEvent(new Event("farm-panel-rendered")); /* R59：手札重繪會換掉卡片、清掉首屏收合，通知 ui.js 重新收合 */
      panel.querySelectorAll("[data-r58-resolve]").forEach((b) => { b.onclick = () => { const r = A.resolveRandomEvent(current, b.dataset.r58Resolve, Date.now()); notify(r.message); if (r.ok && farm() && farm().safeSaveNow) farm().safeSaveNow(); lastPanels = ""; refresh(current); }; });
      panel.querySelectorAll("[data-r58-personal]").forEach((b) => { b.onclick = () => {
        closePanels();
        const p = personal.find((entry) => entry.id === b.dataset.r58Personal), tile = p && npcTile(p.npcId);
        if (!p || !tile) { notify("先走完這段路，再去交付。"); return; }
        if (!farm().travelAndDo(tile.id, "collect", () => { const r = A.completePersonalQuest(current, p.id, Date.now()); notify(r.message); if (r.ok) { speak(p.npcName, r.doneLine || r.message); if (farm() && farm().safeSaveNow) farm().safeSaveNow(); } lastPanels = ""; refresh(current); })) notify("先走完這段路，再去交付。");
      }; });
      // R62B（第 9 項）：手札標題列放「鄰居好感」入口，不佔清單高度、不必再去圖鑑最底下找。
      const r62bPane = panel.closest ? panel.closest(".side-pane") : null;
      const r62bHead = r62bPane && r62bPane.querySelector ? r62bPane.querySelector(".pane-head") : null;
      if (r62bHead && !r62bHead.querySelector("[data-r62b-neighbors]")) {
        const r62bBtn = document.createElement("button");
        r62bBtn.type = "button"; r62bBtn.className = "r62b-neighbor-entry"; r62bBtn.dataset.r62bNeighbors = "";
        r62bBtn.textContent = "鄰居好感";
        r62bBtn.setAttribute("aria-label", "查看鄰居好感：四位鄰居的愛心、下一段故事與送禮");
        r62bBtn.onclick = () => openNeighborsJournal();
        r62bHead.appendChild(r62bBtn);
      } else if (!r62bHead) {
        const r62bEntry = document.createElement("div");
        r62bEntry.className = "r62b-neighbor-entry-wrap";
        r62bEntry.innerHTML = '<button type="button" class="r62b-neighbor-entry" data-r62b-neighbors>鄰居好感</button>';
        panel.prepend(r62bEntry);
        r62bEntry.querySelector("[data-r62b-neighbors]").onclick = () => openNeighborsJournal();
      }
      const neighborButton = panel.querySelector("#worldNeighborButton");
      if (neighborButton) neighborButton.onclick = () => window.ContentR1.openNeighbors(current);
      if(window.ContentR6 && availability.showNeighborBasket && A.gathering(current,Date.now()).unlocked){const b=document.createElement('button');b.id='worldGatheringButton';b.textContent=current.adventure.gathering.completed?'翻共同聚餐手記':'三個位子，一起吃';b.onclick=()=>window.ContentR6.openGathering(current);panel.querySelector('.neighbor-entry').appendChild(b);}
      panel.querySelectorAll("[data-quest-go]").forEach((b) => { b.onclick = () => b.dataset.mainNext ? goNextFarmStep() : goQuest(list.find((q) => q.id === b.dataset.questGo)); });
      panel.querySelectorAll("[data-commission]").forEach((b) => { b.onclick = () => {
        closePanels();
        const c = commissions.find((entry) => entry.id === b.dataset.commission), tile = npcTile(c.npcId);
        if (!farm().travelAndDo(tile.id, "collect", () => { const r = A.deliverCommission(current, c.id, Date.now()); notify(r.message); if (r.ok) speak(window.NPCS[c.npcId].name, "東西收到了，下次也留一籃給我們吧。"); refresh(current); })) notify("先走完這段路，再去送餐籃。");
      }; });
    }
    const upgrades = el("buildingUpgrades");
    if (upgrades && !el("worldProjectsButton")) {
      const card = document.createElement("section"); card.id = "worldProjectsCard"; card.className = "riverside-card"; card.dataset.audit = "riverside-card";
      const h = document.createElement("h3"); h.textContent = "河畔復興計畫";
      const p = document.createElement("p"); p.textContent = "用材料修好釣台、花圃與野餐桌，讓河邊重新熱鬧起來。";
      const b = document.createElement("button"); b.id = "worldProjectsButton"; b.className = "btn buy"; b.textContent = "查看河畔復興計畫"; b.onclick = () => openProjects();
      card.append(h, p, b); upgrades.before(card);
    }
    document.querySelectorAll(".side-body .pane-head").forEach((h) => {
      if (h.querySelector(".world-close")) return;
      const b = document.createElement("button"); b.className = "world-close"; b.textContent = "×"; b.title = "關閉選單"; b.setAttribute("aria-label", "關閉選單"); b.onclick = closePanels; h.prepend(b);
    });
  }
  function goQuest(q) {
    closePanels();
    if (!farm()) return; // R79：走路途中按「前往」直接改道，不再擋下
    if (q.canClaim) { claimQuest(q); return; }
    if (Array.isArray(q.opening) && q.opening.length) speak((window.NPCS[q.npcId] || {}).name || "鎮民", q.opening.join(" "));
    const row = rowsOf(q).find((r) => !r.complete);
    if (row && row.type === "restore") { visitSite(row.id); return; }
    if (row && (row.type === "cook" || row.source === "meals")) { visitKitchen(); return; }
    if (row && (row.type === "fish" || row.source === "catch")) { visitSite("fishing_dock"); return; }
    if (row && row.type === "care") { visitAnimals(); return; }
    const target = targetFor(q);
    if (!target) { notify(row && row.type === "water" ? "這批作物都澆過了，等成熟後收成，再種一格來澆水。" : "先到田邊準備下一批收穫。"); return; }
    if (row && row.type === "water") {
      const plot = current.plots[target.plotIndex];
      const ready = plot.cropId && window.getCropProgress(current, plot, Date.now()).ready;
      if (!plot.cropId || ready) {
        farm().setTool("hand");
        if (!plot.cropId && farm().selectSeed) farm().selectSeed("wheat");
        notify(ready ? "這株已成熟，先收成，再種一格來澆水。" : "先種下小麥，下一步再替它澆水。");
      } else farm().setTool("water");
    }
    else if (target.object) farm().setTool("clear");
    else farm().setTool("hand");
    if (row && row.consume && window.CROPS[row.id] && farm().selectSeed) farm().selectSeed(row.id);
    farm().clickTile(target.id);
  }
  function goEarlyGoal(id) {
    const quest = A.quests(current, Date.now()).find((row) => row.id === "c1_first_harvest");
    if (id === "harvest" && quest) { goQuest(quest); return; }
    if (id === "meal") {
      const mealQuest = A.quests(current, Date.now()).find((row) => row.id === "c1_first_meal");
      if (mealQuest && mealQuest.canClaim) goQuest(mealQuest); else visitKitchen();
      return;
    }
    if (id === "dock") { visitSite("fishing_dock"); return; }
    if (id === "market") {
      const target = npcTile("merchant");
      if (!target) return;
      closePanels();
      farm().setTool("hand");
      farm().clickTile(target.id);
    }
  }
  function goNextFarmStep() {
    const step = A.nextFarmStep(current, Date.now()); if (!step || !farm()) return;
    if (step.tileId && farm().focusTile) farm().focusTile(step.tileId);
    if (step.action === "harvest" && step.tileId) { closePanels(); farm().setTool("hand"); farm().clickTile(step.tileId); return; }
    if (step.action === "deliver") { const q = A.quests(current, Date.now()).find((row) => row.id === "c1_first_harvest"); if (q) goQuest(q); return; }
    if (step.action === "cook" || step.action === "eat") { visitKitchen(); return; }
    if (step.action === "explore") { visitSite("fishing_dock"); return; }
    const tiles = (current.map && current.map.tiles || []).filter((tile) => tile.plotIndex != null && tile.plotIndex < (window.activePlotCount ? window.activePlotCount(current) : 6));
    const target = step.action === "tend" ? tiles.find((tile) => { const p = current.plots[tile.plotIndex]; return p && p.cropId && (p.wateredAt || 0) < p.plantedAt; }) : tiles.find((tile) => !current.plots[tile.plotIndex].cropId);
    if (!target) { notify(step.text); return; }
    closePanels(); farm().setTool(step.action === "tend" ? "water" : "hand"); if (step.action === "plant" && farm().selectSeed) farm().selectSeed("wheat"); farm().clickTile(target.id);
  }
  function claimQuest(q) {
    const target = npcTile(q.npcId);
    if (!target) return;
    const started = farm().travelAndDo(target.id, "use", () => {
      const result = A.claim(current, q.id, Date.now());
      if (result.ok) {
        if (window.refreshOrders) window.refreshOrders(current, Date.now());
        if (farm() && farm().enqueueResultFeedback) farm().enqueueResultFeedback(result);
        else if (farm() && farm().enqueueSettlement) {
          farm().enqueueSettlement(result.settlement);
          (result.milestones || []).forEach(farm().enqueueSettlement);
        }
        speak((window.NPCS[q.npcId] || {}).name || "鎮民", completionLine(q));
        if (q.id === "c3_harvest_picnic") showPicnic();
        refresh(current);
      } else notify(result.message);
    });
    if (!started) notify("現在走不到那裡，先把路清出來。");
  }
  function completionLine(quest) {
    const id = typeof quest === "string" ? quest : quest.id;
    if (quest && Array.isArray(quest.completion) && quest.completion.length) return quest.completion.join(" ");
    const lines = {
      c1_homecoming: "門口終於有新苗了。這些木料你先收著，等河邊的釣台修好，咱們再坐下來聊。",
      c1_first_harvest: "把剛收的小麥帶去農舍灶台，做一份自己的晚餐吧。灶火還能用。",
      c1_first_meal: "這塊餅有你祖母的味道。魚竿和剩下的木料拿去吧，河邊一直在等人。",
      c2_fishing_dock: "踏板踩起來穩了。輕點和橫拉都先別急，等浮標沉下去再提竿。多看幾次，你就認得牠們了。",
      c2_river_basket: "魚很新鮮，薄荷也香。我把木料備好了，河邊再多放張桌子，就能招待大家。",
      c2_picnic_table: "座位我來安排。你去看看動物，接兩張訂單，野餐的事慢慢準備。",
      c3_good_neighbors: "雞吃飽了，客人的貨也交了。桌邊缺點顏色，這些木料留給小花園。",
      c3_garden: "我把花壓進本子了！還差你的點心和魚，大家就能坐下來吃飯了。",
      c3_harvest_picnic: "以前這裡好安靜，現在每個人都有想帶來的東西。這張合照，掛在農場吧！",
    };
    return lines[id] || "下次有收穫，也記得來找我們。";
  }
  let pendingSpeak = null;
  let speakWaitTimer = 0;
  function placeDialogue(box, speaker) {
    if (!box || box.hidden || !speaker) return;
    // 實際量兩種擺法與說話者的交集，取遮得少的（同分時沿用中線規則），避免鏡頭動畫時機造成誤判。
    const r = speaker.getBoundingClientRect();
    const overlap = () => { const d = box.getBoundingClientRect(); return Math.max(0, Math.min(r.right, d.right) - Math.max(r.left, d.left)) * Math.max(0, Math.min(r.bottom, d.bottom) - Math.max(r.top, d.top)); };
    const speakerAboveMiddle = (r.top + r.bottom) / 2 < window.innerHeight / 2;
    const compact = window.innerHeight <= 600;
    const set = (top) => {
      if (compact) { box.classList.toggle("dialogue-compact-bottom", !top); box.classList.toggle("dialogue-compact-top", top); box.classList.remove("dialogue-flip-top"); }
      else { box.classList.remove("dialogue-compact-top", "dialogue-compact-bottom"); box.classList.toggle("dialogue-flip-top", top); }
    };
    set(!speakerAboveMiddle); const preferred = overlap();
    if (preferred === 0) return;
    set(speakerAboveMiddle); const other = overlap();
    if (other >= preferred) set(!speakerAboveMiddle);
    // 兩種擺法都還遮到（矮螢幕兩種 class 可能落在同一位置）：把鏡頭移到說話者，每段對話最多補一次。
    if (Math.min(other, preferred) > 0 && !box.dataset.refocused) {
      box.dataset.refocused = "1";
      const f = farm(); if (f && f.focusTile && speaker.dataset.tileId) f.focusTile(speaker.dataset.tileId);
    }
  }
  function speak(name, text) {
    const zone = el("toast-zone");
    const speakBlocked = () => { const z = el("toast-zone"); return !!((z && z.children && z.children.length > 0) || document.querySelector(".side-panel.world-panel-open") || document.querySelector("#farmMenu:not([hidden])") || document.querySelector(".modal.show")); }; // R37：面板開著時對話延後，不蓋過玩家剛打開的面板
    if (speakBlocked()) {
      pendingSpeak = { name, text };
      clearInterval(speakWaitTimer);
      speakWaitTimer = setInterval(() => {
        if (speakBlocked()) return;
        clearInterval(speakWaitTimer);
        const pending = pendingSpeak; pendingSpeak = null;
        if (pending) speak(pending.name, pending.text);
      }, 200);
      return;
    }
    clearTimeout(dialogueTimer);
    let box = el("worldDialogue");
    if (!box) { box = document.createElement("div"); box.id = "worldDialogue"; box.className = "world-dialogue"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    const portrait = /葛瑞/.test(name) ? (/陽光/.test(text)?'grey-1':/坐|餐籃|謝/.test(text)?'grey-2':'grey-0') : /祖母/.test(name) ? (/留|回來/.test(text)?'grandma-2':/等/.test(text)?'grandma-1':'grandma-0') : null;
    box.innerHTML = `<button class="dialogue-close" aria-label="略過對話" title="略過對話">× 略過</button>${portrait ? `<img class="dialogue-portrait" src="assets/generated/r84/${portrait}.png${window.FARM_VERSION_QUERY || ''}" alt="${esc(name)}" width="64" height="64">` : ''}<b>${esc(name)}</b><p>${esc(text)}</p><button class="dialogue-continue">繼續 ▶</button>`;
    box.hidden = false; delete box.dataset.refocused; box.classList.remove("dialogue-flip-top", "dialogue-compact-top", "dialogue-compact-bottom"); box.dataset.dialogueMode = window.innerHeight <= 600 ? "compact" : "standard"; try { const speaker = Array.from(document.querySelectorAll('[data-kind="npc"]')).find((n) => { const fn = ((window.NPCS || {})[n.dataset.npc] || {}).name || ""; return fn && (fn === name || fn.includes(name) || name.includes(fn) || fn.endsWith(name)); }); if (speaker) { const sr = speaker.getBoundingClientRect(), dr = box.getBoundingClientRect(); const hit = Math.max(0, Math.min(sr.right, dr.right) - Math.max(sr.left, dr.left)) * Math.max(0, Math.min(sr.bottom, dr.bottom) - Math.max(sr.top, dr.top)); const outside = sr.top < 0 || sr.bottom > window.innerHeight || sr.left < 0 || sr.right > window.innerWidth; placeDialogue(box, speaker); if (hit > 0 || outside) { const f = farm(); if (f && f.focusTile && speaker.dataset.tileId) f.focusTile(speaker.dataset.tileId); } const trackUntil = performance.now() + 1400; const track = () => { if (box.hidden) return; const node = document.querySelector('[data-kind="npc"][data-tile-id="' + speaker.dataset.tileId + '"]'); placeDialogue(box, node); if (performance.now() < trackUntil) requestAnimationFrame(track); }; requestAnimationFrame(track); } else if (window.innerHeight <= 600) box.classList.add("dialogue-compact-top"); } catch (e) {}
    box.querySelector(".dialogue-close").onclick = () => { box.hidden = true; };
    box.querySelector(".dialogue-continue").onclick = () => { box.hidden = true; };
    // R79：toast 移到對話框上方（CSS 依此變數讓位）
    const top = box.getBoundingClientRect().top;
    if (top > 0) document.documentElement.style.setProperty("--world-dialogue-top-gap", Math.round(window.innerHeight - top + 8) + "px");
    dialogueTimer = setTimeout(() => { box.hidden = true; }, 10000);
  }
  function modal(title, body) {
    closePanels();
    stopFishing();
    let box = el("worldModal");
    if (!box) { box = document.createElement("div"); box.id = "worldModal"; box.className = "modal world-modal"; box.setAttribute("aria-labelledby", "worldModalTitle"); document.body.appendChild(box); }
    delete box.dataset.practice;
    box.classList.remove("content-r1");
    disposeResidentPoseScenes(box);
    box.innerHTML = `<div class="modal-card"><button class="world-modal-close" aria-label="關閉" title="關閉">×</button><h2 id="worldModalTitle">${esc(title)}</h2><div class="modal-body">${body}</div></div>`;
    prepareResidentPoses(box);
    if (title === "籃底有祖母留下的便箋") {
      const hero = document.createElement("div"); hero.className = "sun-welcome";
      hero.innerHTML = '<img class="sun-welcome-scene" src="assets/generated/r49/welcome-px-512.png?v=content-r65-20261109-1" srcset="assets/generated/r49/welcome-px-512.png?v=content-r65-20261109-1 1x, assets/generated/r49/welcome-px-1024.png?v=content-r65-20261109-1 2x" alt="陽光落在餐籃、紅格餐布與祖母的便箋上" width="384" height="192"><img class="sun-portrait" src="assets/generated/r84/grandma-0.png?v=content-r65-20261109-1" alt="留下便箋的祖母" width="96" height="96">';
      box.querySelector(".modal-card").prepend(hero);
      const titlebar=document.createElement('div');titlebar.className='sun-titlebar';
      const heading=box.querySelector('h2'),close=box.querySelector('.world-modal-close');
      heading.before(titlebar);titlebar.append(heading,close);
    }
    box.querySelector(".world-modal-close").onclick = () => { stopFishing(); disposeResidentPoseScenes(box); farm().closeModal("worldModal"); };
    farm().openModal("worldModal", ".world-modal-close");
    return box;
  }
  function visitSite(id) {
    const site = sites[id]; if (!site || !farm()) return;
    const started = farm().travelAndDo(siteTileId(id), "collect", () => {
      if (id === "fishing_dock" && A.projects(current).find((p) => p.id === id).restored) openFishing();
      else if (id === "picnic_table" && A.projects(current).find((p) => p.id === id).restored) openKitchen();
      else if (id === "garden" && A.summary(current, Date.now()).complete) openGuestbook();
      else openProjects(id);
    });
    if (!started) notify("等這段路走完，再靠近這裡。");
  }
  function openProjects(selectedId) {
    const projects = A.projects(current);
    const selected = selectedId ? projects.filter((p) => p.id === selectedId) : projects;
    const box = modal("河畔復興", selected.map((p) => `<div class="project-row" data-project="${p.id}"><h3>${esc(p.name)}</h3><p class="project-desc">${esc(p.description)}</p>
      <div class="project-cost">${costText(p.requirements)}</div>
      ${p.restored ? `<span>已修復</span>${p.id === "garden" ? "<p class='project-desc'>河畔壓花已收進紀念冊。</p>" : ""}` : `<button data-restore="${p.id}" ${p.canRestore ? "" : "disabled"}>${p.status === "locked" ? "先完成鎮民任務" : p.canRestore ? "走過去修復" : "材料未齊"}</button>`}</div>`).join(""));
    box.querySelectorAll("[data-restore]").forEach((b) => { b.onclick = () => {
      farm().closeModal("worldModal");
      const started = farm().travelAndDo(siteTileId(b.dataset.restore), "hoe", () => {
        const r = A.restore(current, b.dataset.restore, Date.now()); notify(r.message); refresh(current); lastSites = ""; farm().paintMap();
      });
      if (!started) notify("先停下腳步，再開始修復。");
    }; });
  }
  function visitKitchen() {
    const target = homeTile();
    if (!farm().travelAndDo(target.id, "collect", openKitchen)) notify("先走完這段路，再回農舍。");
  }
  function visitAnimals() {
    const animal = current.animals[0];
    if (!animal) { notify("先在雞舍迎接一隻動物。"); return; }
    const home = current.buildings.find((b) => b.id === animal.homeId);
    if (!home || !farm().travelAndDo(home.tileId, "collect", () => {
      const box = modal("照顧農場的夥伴", `<p class="project-desc">${esc((window.ANIMALS[animal.type] || {}).name || "動物")}在雞舍前等你。餵食、添水和梳理，都會留下照護紀錄。</p><div class="recipe-row"><button data-care="feed">餵食</button> <button data-care="water">添水</button> <button data-care="groom">梳理</button></div>`);
      box.querySelectorAll("[data-care]").forEach((b) => { b.onclick = () => { farm().closeModal("worldModal"); farm().careAnimal(animal.id, b.dataset.care); }; });
    })) notify("先走完這段路，再到雞舍。");
  }
  function openKitchen() {
    const recipes = A.recipes(current);
    const box = modal("農舍灶台", `<p class="project-desc">每道料理都會寫清楚效果與解鎖方式。做好的料理會留在餐籃裡。</p><button id="kitchenNeighbors">裝一份鄰居餐籃</button>` + recipes.map((r) => `<div class="recipe-row" data-recipe="${r.id}"><h3><span aria-hidden="true">${esc(r.icon || "🍽️")}</span> ${esc(r.name)} <small>餐籃 ${r.quantity}</small></h3><p class="project-desc">${esc(r.description)}</p><p class="r59-recipe-status">${r.unlocked ? "已學會" : esc(r.unlockText || "尚未學會")}</p><div class="project-cost">${costText(r.requirements)}</div>${r.effect ? `<p class="project-desc r58-buff"><b>效果：</b>${esc(String(r.effect.summary).replace(/。$/, ""))}・持續 ${esc(r.effect.durationText)}</p>` : `<p class="project-desc"><b>分享：</b>送給${esc(r.share.who)}，${esc(r.share.reward)}。</p>`}<button data-cook="${r.id}" ${r.canCook ? "" : "disabled"}>${r.unlocked ? r.canCook ? "做一份" : `做一份・${costText(r.requirements.filter((need) => !need.complete))}` : "尚未學會"}</button>${r.effect && r.quantity > 0 ? `<button data-eat="${r.id}">享用一份・${esc(r.effect.label)}・${esc(r.effect.durationText)}</button>` : ""}</div>`).join(""));
    box.querySelector("#kitchenNeighbors").onclick = () => window.ContentR1.openNeighbors(current);
    box.querySelectorAll("[data-cook]").forEach((b) => { b.onclick = () => {
      farm().closeModal("worldModal");
      const target = homeTile();
      if (!farm().travelAndDo(target.id, "collect", () => { const r = A.cook(current, b.dataset.cook, Date.now()); notify(r.message); refresh(current); openKitchen(); })) notify("先走完這段路，再烹調。");
    }; });
    box.querySelectorAll("[data-eat]").forEach((b) => { b.onclick = () => {
      farm().closeModal("worldModal");
      const target = homeTile();
      if (!farm().travelAndDo(target.id, "collect", () => { const r = A.eatMeal(current, b.dataset.eat, Date.now()); notify(r.message); if (r.ok && farm() && farm().safeSaveNow) farm().safeSaveNow(); refresh(current); openKitchen(); })) notify("先走完這段路，再享用。");
    }; });
  }
  function openMarket() {
    const items = Object.entries(current.storage.items).filter(([, qty]) => qty > 0);
    const q = A.summary(current, Date.now()).currentQuest;
    const needs = (q && q.requirements) || [];
    const box = modal("蘿拉的市集", `<p class="project-desc">先留好鎮民要的物品。缺建材時，也可以用收成換木料和石材。</p>
      ${items.map(([id, qty]) => {
        const def = window.getItemDef(id), reserved = needs.filter((r) => r.id === id).reduce((n, r) => n + r.required, 0);
        const sale = Math.max(0, qty - reserved);
        return `<div class="recipe-row"><h3>${esc(def ? def.name : id)}・${qty} 份</h3><p class="project-desc">${reserved ? `替目前委託保留 ${reserved} 份。` : "沒有目前委託預留。"}</p><button data-sell="${esc(id)}" ${sale > 0 ? "" : "disabled"}>出售多餘 ${sale} 份</button></div>`;
      }).join("") || '<p class="project-desc">籃子是空的。下一批作物收好再來。</p>'}
      <div class="recipe-row"><h3>建材行</h3><label class="project-desc" for="worldMaterialQty">數量 <select id="worldMaterialQty"><option value="1">1 份</option><option value="5">5 份</option><option value="10">10 份</option></select></label><br><button data-buy-material="wood">木料 1 份・6 金</button> <button data-buy-material="stone">石材 1 份・8 金</button></div>`);
    const atMarket = (effect) => {
      farm().closeModal("worldModal");
      const tile = current.map.tiles.find((t) => t.structureId === "shop");
      if (!farm().travelAndDo(tile.id, "collect", () => { effect(); refresh(current); openMarket(); })) notify("先走完這段路，再交易。");
    };
    box.querySelectorAll("[data-sell]").forEach((b) => { b.onclick = () => atMarket(() => {
      const id = b.dataset.sell, active = A.summary(current, Date.now()).currentQuest;
      const reserved = ((active && active.requirements) || []).filter((r) => r.id === id).reduce((n, r) => n + r.required, 0);
      const qty = Math.max(0, (current.storage.items[id] || 0) - reserved);
      const r = window.sellItem(current, id, qty, Date.now()); notify(r.coins ? `交易完成，收到 ${r.coins} 金。` : "先把這些留給鎮民。");
    }); });
    box.querySelector("#worldMaterialQty").onchange = () => {
      const count = Number(box.querySelector("#worldMaterialQty").value);
      box.querySelectorAll("[data-buy-material]").forEach((b) => { const wood = b.dataset.buyMaterial === "wood"; b.textContent = `${wood ? "木料" : "石材"} ${count} 份・${count * (wood ? 6 : 8)} 金`; });
    };
    box.querySelectorAll("[data-buy-material]").forEach((b) => { b.onclick = () => { const count = Number(box.querySelector("#worldMaterialQty").value); atMarket(() => { const r = A.buyMaterial(current, b.dataset.buyMaterial, count, Date.now()); notify(r.message); }); }; });
  }
  function openSeedBag() {
    const crops = Object.values(window.CROPS);
    const box = modal("種子袋", `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${crops.map((crop) => `<button class="btn ghost" data-world-seed="${crop.id}" ${window.isCropUnlocked(current, crop.id) ? "" : "disabled"} style="min-height:80px;padding:6px;white-space:normal"><span class="ui-icon i-crop-${crop.id.replace(/_/g, "-")}" aria-hidden="true"></span><br>${esc(crop.name)}<br><small>${window.isCropUnlocked(current, crop.id) ? `${crop.seedCost} 金` : `Lv ${crop.unlockLevel}`}</small></button>`).join("")}</div>`);
    box.querySelectorAll("[data-world-seed]").forEach((b) => { b.onclick = () => { farm().selectSeed(b.dataset.worldSeed); farm().closeModal("worldModal"); }; });
  }
  function stopFishing() { if (window.ContentR1) window.ContentR1.stopFishing(); }
  function arrangePicnic(s) {
    if (!s.adventure.claimed.c3_harvest_picnic) return;
    window.configureWorld(s);
  }
  function showPicnic() {
    arrangePicnic(current);
    const box = modal("這次，大家都回來了", '<p class="project-desc">午後，鎮長葛瑞收起了告示，蘿拉帶來餐籃，老農班伯讓雞舍安靜下來。圖圖把壓好的小花放在桌邊。</p><p class="project-desc">你種的麥子、河裡的魚和溪邊的薄荷，現在都成了大家的第一頓野餐。</p><button class="btn buy" id="worldPicnicGo">到河畔找大家</button>');
    box.querySelector("#worldPicnicGo").onclick = () => { farm().closeModal("worldModal"); farm().setTool("hand"); farm().clickTile("t10_9"); };
  }
  function openGuestbook() {
    const box = modal("河畔留言本", `<p class="project-desc">鎮民留了張合照。也替這座農場寫下一句話吧。</p><label class="project-desc" for="worldNote">留給下一個收穫日</label><input id="worldNote" maxlength="100" value="${esc(current.adventure.note || "")}" style="display:block;width:100%;padding:12px;margin:12px 0;border:1px solid #b7cdb9;border-radius:4px"><button class="btn buy" id="worldNoteSave">留下這句話</button>`);
    box.querySelector("#worldNoteSave").onclick = () => { current.adventure.note = box.querySelector("#worldNote").value.trim().slice(0, 100); farm().safeSaveNow(); farm().closeModal("worldModal"); notify("留言留在花園裡了。"); };
  }
  function openFishing() {
    window.ContentR1.openFishing(current);
  }
  function paintWorld(s, tileSize, t) {
    current = s;
    const world = el("mapWorld"); if (!world || !window.Atlas.isReady()) return;
    paintFringe(s, tileSize, world);
    const projects = A.projects(s);
    const sig = `${tileSize}|` + projects.map((p) => p.status + "@" + siteTileId(p.id)).join("|");
    if (sig !== lastSites || !world.querySelector(".world-site")) {
      lastSites = sig;
      world.querySelectorAll(".world-site").forEach((node) => node.remove());
      projects.forEach((p) => {
        const spec = sites[p.id], tile = window.getTileById(s, siteTileId(p.id));
        const frame = spec.sheet === "world_projects" ? spec.frame + (p.restored ? "_repaired" : "_broken") : spec.frame;
        const f = window.Atlas.getFrame(spec.sheet, frame); if (!f || !tile) return;
        const b = document.createElement("button"); b.type = "button"; b.className = "world-site" + (p.restored ? "" : " unrestored");
        b.dataset.kind = "world-project"; b.dataset.projectId = p.id; b.dataset.tileId = tile.id; b.dataset.restored = String(p.restored);
        b.dataset.sheet = spec.sheet; b.dataset.frame = frame;
        if (spec.sheet === "world_projects") b.classList.add("purpose-built");
        const w = tileSize * spec.width, h = w * f.h / f.w, baseline = (tile.y + .85 + (spec.visualYOffset || 0)) * tileSize;
        const anchor = f.anchor || [.5, 1];
        b.style.cssText = `left:${(tile.x + .5) * tileSize - w * anchor[0]}px;top:${baseline - h * anchor[1]}px;width:${w}px;height:${h}px;z-index:${Math.round(baseline)};`;
        Object.assign(b.style, window.Atlas.frameStyleFor(spec.sheet, frame, w, h));
        b.setAttribute("aria-label", p.name + (p.restored ? "，使用" : "，修復計畫"));
        b.innerHTML = `<span class="world-site-label">${esc(p.name)}${p.restored ? "・已修好" : "・待修"}</span>${p.restored ? '<span class="r65b-site-done" aria-hidden="true">✓</span>' : ""}${p.canRestore ? '<span class="world-marker"></span>' : ""}`;
        b.onclick = (event) => { event.stopPropagation(); visitSite(p.id); }; world.appendChild(b);
      });
    }
    paintMinimap(s, tileSize);
    if(window.ContentR6)window.ContentR6.paintWorld(s,tileSize);
    paintFestivalScene(s, tileSize, world, t);
    document.querySelectorAll('.farm-gathering .meal-layout').forEach(layout=>{if(!layout.querySelector('.reserved-table'))ensureResidentPoseScene(layout);});
    syncWorldHitTargets();
    const location = s.player.x >= 17 ? "東林・溪畔採集地" : s.player.y >= 9 ? "河畔・復興計畫" : "陽光農場・祖母的田";
    if (el("worldLocation").textContent !== location) el("worldLocation").textContent = location;
  }
  function paintFestivalScene(s, size, world, now) {
    world.querySelectorAll(".r63a-festival-scene").forEach((node) => node.remove());
    const scene = A.festivalScene ? A.festivalScene(s, now) : { active: false };
    world.dataset.r63aFestival = scene.active ? "active" : "inactive";
    if (!scene.active) {
      const settlement = A.takeFestivalSettlement ? A.takeFestivalSettlement(s, now) : null;
      if (settlement) {
        const nextMinutes = Math.ceil(Math.max(0, settlement.nextAt - now) / 60000);
        modal("收穫祭小結算", `<p class="r64a-settlement-score">完成 ${settlement.goalsCompleted}/3 項・作物評比 ${settlement.stars ? settlement.stars + " 顆星" : "未參加"}</p><ul>${settlement.rewards.map((row) => `<li>${esc(row)}</li>`).join("")}</ul><p class="project-desc">下一場約在 ${nextMinutes} 分鐘後開始。</p>`);
        if (farm() && farm().safeSaveNow) farm().safeSaveNow();
      }
      return;
    }
    const tileOf = (id) => window.getTileById(s, id);
    // R63 整合：布置改用像素圖（彩旗、燈籠架為手繪像素 SVG，長桌沿用宴席桌素材），不用表情符號。
    const art = { bunting: ["assets/generated/content-r63/bunting.svg", 2.6], lanterns: ["assets/generated/content-r63/lanterns.svg", .8], long_table: ["assets/generated/content-r10/table.png", 1.7] };
    scene.decorations.forEach((item) => { const tile = tileOf(item.tileId); if (!tile) return; const [src, w] = art[item.id] || [null, 1]; const node = document.createElement(src ? "img" : "span"); node.className = "r63a-festival-scene r63a-festival-decoration"; node.dataset.festivalDecoration = item.id; if (src) { node.src = src + "?v=content-r65-20261109-1"; node.alt = item.name; node.draggable = false; } else node.textContent = item.name; node.setAttribute("aria-label", item.name); node.style.cssText = `left:${(tile.x + .5) * size}px;top:${(tile.y + .95) * size}px;width:${Math.round(w * size)}px;z-index:${Math.round((tile.y + 1) * size) - 1};`; world.appendChild(node); });
    // 鄰居留在原位（仍可交談完成「跟鄰居說話」），頭上冒出祭典招呼。
    scene.neighbors.forEach((item) => { const tile = (s.map.tiles || []).find((tl) => tl.npc === item.id); if (!tile) return; const node = document.createElement("span"); node.className = "r63a-festival-scene r63a-festival-cheer"; node.dataset.festivalNeighbor = item.id; node.textContent = ({ mayor: "祭典開始囉！", elder: "來嚐嚐新麥！", merchant: "攤位擺好了", child: "去看彩旗！" })[item.id] || "收穫祭快樂"; node.setAttribute("aria-label", `${item.name}在收穫祭打招呼`); node.style.cssText = `left:${(tile.x + .5) * size}px;top:${(tile.y - .55) * size}px;z-index:${Math.round((tile.y + 2) * size)};`; world.appendChild(node); });
    const stallTile = tileOf(scene.stall.tileId); if (!stallTile) return;
    const stall = document.createElement("button"); stall.type = "button"; stall.className = "r63a-festival-scene r63a-festival-stall"; stall.dataset.festivalStall = scene.stall.id; stall.dataset.tileId = scene.stall.tileId; stall.innerHTML = `<img src="assets/generated/content-r63/stall.svg?v=content-r65-20261109-1" alt="" draggable="false"><b>${esc(scene.stall.name)}</b>`; stall.setAttribute("aria-label", "查看收穫祭三個目標與獎勵，參加作物評比"); stall.style.cssText = `left:${(stallTile.x + .5) * size}px;top:${(stallTile.y + .05) * size}px;z-index:${Math.round((stallTile.y + 1) * size)};`;
    stall.onclick = (event) => {
      event.stopPropagation(); const live = A.festivalScene(s, Date.now());
      if (!live.active || !live.stall) { notify("這一場收穫祭已經結束，布置也收起來了。"); refresh(s); return; }
      const goalText = live.stall.goals.map((goal) => `<li>${goal.complete ? "✓" : "○"} ${esc(goal.name)} ${goal.current}/${goal.required}</li>`).join("");
      const entries = A.festivalEntries(s, Date.now());
      const entryHtml = live.stall.judging ? `<p class="r64a-judged">本場已評比：${live.stall.judging.stars} 顆星・${esc(live.stall.judging.rewardText)}</p>` : entries.length ? `<fieldset class="r64a-festival-entry"><legend>選三樣作物或料理</legend>${entries.map((row) => `<button type="button" data-festival-entry="${esc(row.id)}" aria-pressed="false"><span aria-hidden="true">${esc(row.icon)}</span>${esc(row.name)} <small>${row.quantity} 份</small></button>`).join("")}</fieldset><p class="project-desc">種類多樣、有當季作物又有料理，星等會更高。</p><button type="button" id="festivalJudge" disabled>參加作物評比（已選 0/3）</button>` : '<p class="project-desc">背包裡還沒有可參賽的作物或料理。</p>';
      const box = modal("祭典攤位", `<p class="project-desc">本場有 10 分鐘。完成三個現場目標，也別忘了每場一次的作物評比。</p><ul class="r63a-stall-goals">${goalText}</ul><p class="project-desc"><b>獎勵：</b>${esc(live.stall.rewardText)}</p>${entryHtml}`);
      const picked = [];
      box.querySelectorAll("[data-festival-entry]").forEach((button) => { button.onclick = () => { const id = button.dataset.festivalEntry; const index = picked.indexOf(id); if (index >= 0) picked.splice(index, 1); else if (picked.length < 3) picked.push(id); button.setAttribute("aria-pressed", String(picked.includes(id))); const submit = box.querySelector("#festivalJudge"); submit.disabled = picked.length !== 3; submit.textContent = `參加作物評比（已選 ${picked.length}/3）`; }; });
      const submit = box.querySelector("#festivalJudge"); if (submit) submit.onclick = () => { const result = A.judgeFestivalEntry(s, picked, Date.now()); if (result.ok && farm() && farm().safeSaveNow) farm().safeSaveNow(); const detail = result.ok ? `<ul>${result.details.map((row) => `<li><b>${esc(row.name)}</b>：${esc(row.sources.length ? row.sources.join("、") : "本次沒有加分")}</li>`).join("")}</ul><p><b>下次提示：</b>${esc(result.tip)}</p><p><b>獎勵：</b>${esc(result.rewardText)}</p>` : ""; modal("作物評比結果", `<p class="r64a-stars" aria-label="${result.ok ? result.stars : 0} 顆星">${result.ok ? "★".repeat(result.stars) + "☆".repeat(3 - result.stars) : "☆☆☆"}</p><p>${esc(result.message)}</p>${detail}`); refresh(s); };
    };
    world.appendChild(stall);
  }
  function paintFringe(s, size, world) {
    const sig = `${size}|${s.map.width}|${s.map.height}`;
    if (sig === lastFringe) return;
    lastFringe = sig;
    let layer = el("worldFringe");
    if (!layer) { layer = document.createElement("div"); layer.id = "worldFringe"; layer.setAttribute("aria-hidden", "true"); world.prepend(layer); }
    layer.innerHTML = "";
    for (let y = -6; y < s.map.height + 6; y++) for (let x = -6; x < s.map.width + 6; x++) {
      if (x >= 0 && x < s.map.width && y >= 0 && y < s.map.height) continue;
      const node = document.createElement("div"); node.className = "world-fringe-tile";
      node.style.cssText = `left:${x * size}px;top:${y * size}px;width:${size}px;height:${size}px;`;
      const frame = "grass_center_0" + (1 + Math.abs((x * 13 + y * 17) % 4));
      Object.assign(node.style, window.Atlas.frameStyleFor("terrain", frame, size, size));
      layer.appendChild(node);
    }
  }
  // Camera-clipped scenery remains visible but cannot receive focus or taps.
  // The project menu / quest route remains available to walk into view.
  function syncWorldHitTargets() {
    const modalOpen=!!document.querySelector('.modal.show');
    const overlays = [...document.querySelectorAll("#farmDock, #farmMenu, .tool-bar, .side-tabs, .world-minimap, #questDock, .toolbar, .seed-hud, .scene-action-bar, .world-dialogue, .world-panel-open .side-body, #mobileControls button")]
      .filter((node) => !node.hidden && getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden")
      .map((node) => node.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    document.querySelectorAll(".world-site").forEach((button) => {
      const r = button.getBoundingClientRect();
      button.disabled = modalOpen || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight
        || overlays.some((o) => Math.min(r.right, o.right) > Math.max(r.left, o.left) && Math.min(r.bottom, o.bottom) > Math.max(r.top, o.top));
    });
  }
  function paintMinimap(s, size) {
    const button = el("worldMinimap"); if (!button) return;
    const canvas = button.querySelector("canvas"), ctx = canvas.getContext("2d"); if (!ctx) return;
    const colors = { grass: "#89ae60", soil: "#b98d56", path: "#e0c88c", water: "#6baabe" };
    ctx.clearRect(0, 0, 220, 120);
    s.map.tiles.forEach((tile) => { ctx.fillStyle = tile.region === "east" && !s.flags.bridgeRepaired ? "#516f45" : colors[tile.terrain] || "#89ae60"; ctx.fillRect(tile.x * 10, tile.y * 10, 10, 10); });
    s.map.tiles.filter((tile) => tile.structureId || tile.npc).forEach((tile) => { ctx.fillStyle = tile.npc ? "#eed793" : "#885253"; ctx.fillRect(tile.x * 10 + 2, tile.y * 10 + 2, 6, 6); });
    const scene = el("mapScene");
    ctx.strokeStyle = "rgba(255,255,235,.55)"; ctx.lineWidth = 1;
    ctx.strokeRect(-s.camera.x / size * 10, -s.camera.y / size * 10, scene.clientWidth / size * 10, scene.clientHeight / size * 10);
    ctx.fillStyle = "#2b2118"; ctx.fillRect(s.player.x * 10, s.player.y * 10, 10, 10); ctx.fillStyle = "#ff5a3c"; ctx.fillRect(s.player.x * 10 + 1, s.player.y * 10 + 1, 8, 8); ctx.fillStyle = "#fff6e3"; ctx.fillRect(s.player.x * 10 + 3, s.player.y * 10 + 3, 4, 4); button.dataset.playerDot = s.player.x + "," + s.player.y;
    button.onclick = (e) => { const r = canvas.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / r.width * s.map.width), y = Math.floor((e.clientY - r.top) / r.height * s.map.height); const tile = window.getTileXY(s, x, y); if (tile) { farm().setTool("hand"); farm().clickTile(tile.id); } };
  }
  function updateObjectiveArrow() {
    if (!current || window.innerWidth > 859) { const old = el("objectiveArrow"); if (old) old.classList.remove("show"); return; }
    let arrow = el("objectiveArrow");
    if (!arrow) { arrow = document.createElement("div"); arrow.id = "objectiveArrow"; arrow.className = "objective-arrow"; arrow.dataset.audit = "objective-arrow"; arrow.setAttribute("aria-hidden", "true"); arrow.innerHTML = '<span class="oa-arrow">➤</span><small>目標</small>'; document.body.appendChild(arrow); }
    if (document.querySelector(".side-panel.world-panel-open, .modal.show")) { arrow.classList.remove("show"); return; }
    const dock = el("questDock");
    let tid = dock && dock.dataset.targetId ? dock.dataset.targetId : null;
    if (!tid) { try { tid = markerTile(current); } catch (e) { tid = null; } }
    const node = tid ? document.querySelector('.gtile[data-tile-id="' + tid + '"]') : null;
    if (!node) { arrow.classList.remove("show"); return; }
    const r = node.getBoundingClientRect();
    if (!r.width) { arrow.classList.remove("show"); return; }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, margin = 28;
    if (cx >= margin && cx <= window.innerWidth - margin && cy >= margin && cy <= window.innerHeight - margin) { arrow.classList.remove("show"); return; }
    let x = Math.min(Math.max(cx, 12), window.innerWidth - 64);
    let y = Math.min(Math.max(cy, 76), window.innerHeight - 150); if (dock && dock.getBoundingClientRect) { const dr = dock.getBoundingClientRect(); if (dr.height && x < dr.right + 8 && x + 64 > dr.left - 8 && y < dr.bottom + 8 && y + 44 > dr.top - 8) { y = Math.round(dr.bottom + 8); if (y + 44 > window.innerHeight - 8) x = Math.max(12, Math.round(dr.left - 72)); } } ["seedHud", "sunChip"].forEach((id) => { const sh = el(id); const hr = sh && !sh.hidden && sh.getBoundingClientRect ? sh.getBoundingClientRect() : null; if (hr && hr.height && x < hr.right + 8 && x + 64 > hr.left - 8 && y < hr.bottom + 8 && y + 44 > hr.top - 8) y = Math.round(hr.bottom + 8); }); // R63B（第 6 項）：目標圓鈕不壓任務卡與收合鈕；R63 整合：也不壓種子欄「全部」鈕與陽光標籤
    arrow.style.left = Math.round(x) + "px"; arrow.style.top = Math.round(y) + "px";
    const deg = Math.round(Math.atan2(cy - window.innerHeight / 2, cx - window.innerWidth / 2) * 180 / Math.PI);
    const span = arrow.querySelector(".oa-arrow"); if (span) span.style.transform = "rotate(" + deg + "deg)";
    arrow.dataset.targetId = tid; arrow.classList.add("show");
  }
  function tick(s, t) {
    if (t - lastTick < 750) return;
    lastTick = t; current = s;
    syncWorldHitTargets();
    updateObjectiveArrow(); if (window.DailyUI) window.DailyUI.refresh(s);
    reconcile(s);
    try { if (A.maybeTriggerRandomEvent) { const ev = A.maybeTriggerRandomEvent(s, Date.now()); if (ev && ev.ok && ev.triggered && ev.event) { notify(ev.event.icon + " " + ev.event.name + "：" + ev.event.dialogue); speak(ev.event.speaker || "農場小事", ev.event.dialogue); lastPanels = ""; if (farm() && farm().safeSaveNow) farm().safeSaveNow(); } } } catch (e) {}
    arrangePicnic(s);
    syncHeaderVars();
    renderObjective(s);
    syncSeedHudTop();
    ensureTargetVisible(); if (document.querySelector(".world-panel-open")) renderPanels();
  }
  // 資源列換行時，任務列（直式）與系統鈕（桌機）跟著往下。R79：資源變動當下就同步，不等下一個 tick。
  function syncHeaderVars() {
    const header = document.querySelector("header");
    if (!header) return;
    const bottom = Math.ceil(header.getBoundingClientRect().bottom);
    const portrait = window.innerWidth <= 859 && window.innerHeight > 500;
    if (portrait) document.documentElement.style.setProperty("--world-quest-top", Math.max(112, bottom + 12) + "px");
    if (window.innerWidth > 859) document.documentElement.style.setProperty("--world-system-top", Math.max(78, bottom + 12) + "px");
    // R30：橫式矮視口也要跟著標題列實高走，任務列才不會被資源列蓋住上半。
    if (window.innerHeight <= 500 && window.innerWidth > window.innerHeight) document.documentElement.style.setProperty("--world-quest-top", Math.max(60, bottom + 8) + "px");
  }
  // R79：任務列多一行提示時，種子列跟著往下，不被任務列蓋住。
  function syncSeedHudTop() {
    if (document.querySelector("#buildWheel:not([hidden])")) return;
    if (document.querySelector(".side-panel.world-panel-open, #settingsModal.show")) return;
    const dock = el("questDock");
    if (!dock) return;
    const r = dock.getBoundingClientRect();
    if (!r.height) return;
    const top = Math.ceil(r.bottom + 10) + "px";
    if (document.documentElement.style.getPropertyValue("--world-seed-top") !== top) document.documentElement.style.setProperty("--world-seed-top", top);
  }
  function rectOverlap(a, b) { return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)); }
  function ensureTargetVisible() {
    if (!current) return;
    const dock = el("questDock"), seed = el("seedHud");
    let tid = null;
    try { tid = markerTile(current); } catch (e) { tid = null; }
    if (!tid) { if (dock) dock.classList.remove("quest-target-collapsed"); if (seed) seed.classList.remove("seed-hud-shifted", "seed-hud-bottom"); return; }
    const nodes = [document.querySelector('.gtile[data-tile-id="' + tid + '"]'), document.querySelector('[data-kind="npc"][data-tile-id="' + tid + '"]'), document.querySelector('[data-kind="crop"][data-tile-id="' + tid + '"]')].filter(Boolean);
    const rects = nodes.map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return;
    const plotNodes = [...document.querySelectorAll(".gtile.farm-plot")];
    const targetIsPlot = !!document.querySelector('.gtile.farm-plot[data-tile-id="' + tid + '"]'); // R38 整合：只有目標是田時，才把其他田格也列入避讓
    const plotRects = targetIsPlot ? plotNodes.map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0) : [];
    const coveredBy = (box) => { if (!box) return 0; const r = box.getBoundingClientRect(); if (!r.width || !r.height) return 0; return Math.max.apply(null, rects.concat(plotRects).map((t) => rectOverlap(t, r)).concat([0])); };
    /* R37：plotRects 已併入 coveredBy，任務列與種子欄對任何田格重疊都會觸發避讓。 */
    // R58：「今日三件事」是玩家要自己挑的清單，不因目標被蓋到而收掉（否則手機上三個目標全看不到）。
    if (dock && dock.dataset.quest === "early_free_choice") dock.classList.remove("quest-target-collapsed");
    else if (dock) { if (coveredBy(dock) > 0) dock.classList.add("quest-target-collapsed"); else dock.classList.remove("quest-target-collapsed"); }
    if (seed && coveredBy(seed) > 0) {
      const cx = rects[0].left + rects[0].width / 2;
      seed.classList.toggle("seed-hud-shifted", cx < window.innerWidth / 2);
      if (coveredBy(seed) > 0) seed.classList.add("seed-hud-bottom");
    } else if (seed) { seed.classList.remove("seed-hud-shifted", "seed-hud-bottom"); }
    if ((dock && coveredBy(dock) > 0) || (seed && coveredBy(seed) > 0)) {
      const nowMs = Date.now();
      const targetCovered = rects.some((t) => (dock && rectOverlap(t, dock.getBoundingClientRect()) > 0) || (seed && rectOverlap(t, seed.getBoundingClientRect()) > 0));
      const coveredPlot = targetIsPlot && plotNodes.find((n) => { const r = n.getBoundingClientRect(); return (dock && rectOverlap(r, dock.getBoundingClientRect()) > 0) || (seed && rectOverlap(r, seed.getBoundingClientRect()) > 0); }) ? plotNodes[0] : null;
      const focusId = targetCovered ? tid : (coveredPlot && targetIsPlot ? coveredPlot.dataset.tileId : null);
      const talking = !!document.querySelector("#worldDialogue:not([hidden])"); // R37 整合：對話中鏡頭留給說話者，不為了被蓋的田格移走
      // 新的被蓋目標立即聚焦；同一目標才沿用 3 秒節流，避免鏡頭反覆跳。
      if (focusId && !(talking && !targetCovered) && (focusId !== lastTargetAvoidId || nowMs - lastTargetAvoidAt > 3000 || !(current.camera && current.camera.focusTileId === focusId))) { lastTargetAvoidAt = nowMs; lastTargetAvoidId = focusId; const f = farm(); if (f && f.focusTile) f.focusTile(focusId); }
    }
    syncSeedHudTop();
  }
  function welcome(s, offline) {
    current = s;
    if (!s.adventure.welcomeSeen) {
      const box = modal("籃底有祖母留下的便箋", '<p class="project-desc">先去找鎮長葛瑞，再親手種下第一格。完成這兩步後，你可以自己決定先收成、修釣台，或去跟蘿拉打招呼。</p><button class="btn buy" id="worldSunBegin">去見鎮長葛瑞</button><button class="btn ghost" id="worldBegin">稍後再看便箋</button>');
      const finish = () => { s.adventure.welcomeSeen = true; farm().closeModal("worldModal"); farm().safeSaveNow(); };
      box.querySelector("#worldBegin").onclick = finish;
      box.querySelector("#worldSunBegin").onclick = () => { window.FarmHeirloom.start(s); finish(); farm().refresh(); };
      box.querySelector(".world-modal-close").onclick = finish;
    } else if (offline && offline.offlineMs >= 300000 && s.settings.offlineSummary !== false) {
      notify(`你離開時，農場仍在生長。離線收益 ${offline.coins || 0} 金，成熟作物等你回來。`);
    }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closePanels(); stopFishing(); }
    if ((e.key === "e" || e.key === "E") && farm() && !document.querySelector(".modal.show") && !/input|textarea|select/i.test((e.target || {}).tagName || "")) { el("actionA").click(); e.preventDefault(); }
  });
  document.addEventListener("DOMContentLoaded", () => {
    let dismissMapClick = false;
    document.addEventListener("pointerdown", (event) => {
      if (!document.querySelector(".world-panel-open") || document.querySelector(".modal.show")) return;
      if (!event.target.closest("#mapScene") || event.target.closest(".seed-hud, .mobile-controls, .scene-action-bar, #objectBubble, #buildWheel, #mapFitToggle, #worldMinimap")) return;
      closePanels(); dismissMapClick = true; event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    document.addEventListener("click", (event) => {
      if (!dismissMapClick) return;
      dismissMapClick = false;
      if (event.target.closest("#mapScene")) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".side-panel, .world-dialogue, #questDock, .modal") && !document.querySelector(".modal.show")) closePanels();
    });
    const title = document.querySelector("[data-tab='tile']"); if (title) title.setAttribute("title", "選取目標資訊");
    ["settingsBtn", "howToBtn", "genderToggle"].forEach((id) => { const b = el(id); if (b && !b.title) b.title = b.textContent.trim(); });
  });
  function markerTile(s) {
    current = s;
    const q = A.summary(s, Date.now()).currentQuest;
    const tile = targetFor(q);
    return tile ? tile.id : null;
  }
  function dialogue(npcId, fallback) {
    const basket = window.FarmHeirloom && window.FarmHeirloom.status(current);
    if (npcId === "mayor" && basket && basket.delivered) return basket.note.reply;
    const neighbor = A.neighbors(current, Date.now()).find((n) => n.id === npcId && n.deliveries);
    if (neighbor) return neighbor.lastMatched ? neighbor.memory.reply : neighbor.deliveries>1 ? neighbor.memory.wrong : neighbor.reaction;
    const q = A.summary(current, Date.now()).currentQuest;
    if (npcId === "mayor" && q && q.id === "c1_homecoming") return current.gender === "m" ? "你就是她的孫子凱吧？先去祖母的田種下第一格，讓我看看你的本事。" : "你就是她的孫女米莉吧？先去祖母的田種下第一格，讓我看看你的本事。";
    if (q && q.npcId === npcId) {
      if (q.canClaim) return "東西都備好了？我在這裡等你，帶來一起看看吧。";
      const ownNames = { mayor: ["鎮長葛瑞", "鎮長"], elder: ["老農班伯"], merchant: ["商人蘿拉", "蘿拉"], child: ["孩童圖圖", "圖圖"] }[npcId] || [];
      return ownNames.reduce((line, name) => line.replaceAll(name, "我"), q.description);
    }
    const r64bClue = (window.NeighborsR61 && window.NeighborsR61.CLUES && window.NeighborsR61.CLUES[npcId]) || ""; // R64B（第 5 項）：日常對話帶喜好線索
    if (npcId === "child") return (current.adventure.claimed.c3_harvest_picnic ? "我把野餐合照收好了。下次再帶你新種的東西來！" : "河邊要是有桌子，我想帶小花和點心來。你也會來嗎？") + (r64bClue ? " " + r64bClue : "");
    if (npcId === "merchant") return "新鮮作物可以交訂單。留一點給自己的餐籃，河邊很快會需要它們。" + (r64bClue ? " " + r64bClue : "");
    if (npcId === "elder") return "下田時別忘了雞舍。添水、梳毛、餵食，牠們都記得你。" + (r64bClue ? " " + r64bClue : "");
    return npcId === "mayor" && r64bClue && fallback ? fallback + " " + r64bClue : fallback;
  }
  window.FarmWorld = { prepare, refresh, tick, renderObjective, renderPanels, paintWorld, welcome, openKitchen, openMarket, openSeedBag, openProjects, visitSite, speak, openPanel, markerTile, dialogue, syncWorldHitTargets, contentModal: modal, prepareResidentPoses, requestResidentPose, residentPresentationState, disposeResidentPoseScenes };
})();
