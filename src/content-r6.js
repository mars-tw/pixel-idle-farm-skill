/* R6: actual handover frames, resident keepsakes and the shared afternoon. Offline only. */
(function () {
  'use strict';
  const A=window.AdventureAPI, R=window.ContentR1, farm=()=>window.__farm;
  const art=name=>`assets/generated/content-r6/${name}${window.FARM_VERSION_QUERY||''}`;
  const names={merchant:'蘿拉',elder:'班伯',child:'圖圖'};
  let route=null;
  const newArt=name=>`assets/generated/${/^(hold|reach|idle)-(player|merchant|elder|child)\.png$/.test(name)?'content-r19':'content-r9'}/${name}${window.FARM_VERSION_QUERY||''}`;
  function flavor(box,taste) {
    let image=box.querySelector('.basket-flavor');
    if(!image){image=document.createElement('img');image.className='basket-flavor';image.width=128;image.height=128;box.querySelector('.content-illustration').after(image);}
    image.src=art('basket-'+taste+'.png');image.alt={plain:'籃內只有金黃麥餅',sweet:'麥餅上放著橘色烤胡蘿蔔',sour:'麥餅旁放著紫紅野莓杯',hot:'保溫厚布包著麥餅，銅罐冒著蒸氣'}[taste];
    box.dataset.flavor=taste;
  }
  function carry(s,n,taste,done) {
    if(route){route.cancel();if(route){farm().toast('對方正在接籃，等他說完這一句。');return;}}
    const tile=s.map.tiles.find(t=>t.npc===n.id), before=A.basketFlavors(s,Date.now()).find(f=>f.id===taste).requirements;
    const bar=document.createElement('div');bar.className='basket-carrying';bar.dataset.resident=n.id;bar.dataset.phase='walking';
    bar.innerHTML=`<div role="status"><span class="carry-name">${n.name}・${{plain:'原',sweet:'甜',sour:'酸',hot:'熱'}[taste]}味</span><span class="carry-distance"></span><span class="carry-memory"></span><button>先不送了</button><small class="carry-receipt">${before.map(r=>r.name+' '+r.current+'份').join('、')}，送到才取用</small></div><span class="carry-direction" aria-label="餐籃送達方向">➤</span>`;
    document.body.appendChild(bar);
    let cancelled=false,impact=false,raf=0,timers=[];const began=performance.now();
    const stop=()=>{cancelAnimationFrame(raf);timers.forEach(clearTimeout);document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',redirect,true);document.removeEventListener('click',redirect,true);bar.remove();document.body.removeAttribute('data-delivering');document.body.removeAttribute('data-handover');document.querySelectorAll('.handover-actor,.handover-player,.handover-parcel,.delivery-walker,.carry-target,.carry-label,.delivery-dots,.delivery-goal,.delivery-goal-label,.handover-frame').forEach(e=>e.remove());document.querySelector('#player')?.removeAttribute('data-delivery-visible');document.querySelectorAll('[data-delivery-cutaway]').forEach(e=>{e.style.maskImage='';e.removeAttribute('data-delivery-cutaway');});route=null;};
    const cancel=()=>{if(impact)return;cancelled=true;farm().cancelJourney();stop();const p=document.createElement('p');p.className='basket-cancelled';p.textContent=`已取消送餐・農家麥餅 ${s.adventure.meals.rustic_bread} 份全數保留，配料也沒取用。`;document.body.appendChild(p);setTimeout(()=>p.remove(),6000);};
    const key=e=>{if(/^(Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|w|a|s|d)$/i.test(e.key)){if(impact){e.preventDefault();e.stopImmediatePropagation();}else cancel();}};
    const redirect=e=>{if(impact||(!bar.contains(e.target)&&performance.now()-began<350)){e.preventDefault();e.stopImmediatePropagation();return;}if(e.type==='pointerdown'&&!bar.contains(e.target)&&e.target.closest('#mapScene,.dpad'))cancel();};
    document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',redirect,true);document.addEventListener('click',redirect,true);bar.querySelector('button').onclick=cancel;
    document.body.dataset.delivering=n.id;
    // Start navigation from the actual player view, after the carry HUD layout
    // is applied; never inherit a still-easing focus from the previous screen.
    farm().followPlayer?.();
    const marker=document.createElement('img');marker.className='carry-target';marker.src=newArt('idle-'+n.id+'.png');marker.alt=n.name+'的位置';marker.width=44;marker.height=44;document.body.appendChild(marker);const markLabel=document.createElement('span');markLabel.className='carry-label';markLabel.textContent=n.name+'・'+{plain:'原',sweet:'甜',sour:'酸',hot:'熱'}[taste]+'味';document.body.appendChild(markLabel);
    const actor=document.createElement('img');actor.className='handover-actor';actor.alt=n.name+'伸手準備接籃';actor.dataset.pose='reach';
    const giver=document.createElement('img');giver.className='handover-player';giver.alt='米莉把唯一的餐籃送向鄰居';giver.src=newArt('hold-player.png');
    const parcel=document.createElement('img');parcel.className='handover-parcel';parcel.src='assets/generated/content-r11/basket.png'+(window.FARM_VERSION_QUERY||'');parcel.alt='正在交到雙手之間的餐籃';
    let distanceTile='',distance=0,standId=null;
    const dots=document.createElement('div');dots.className='delivery-dots';document.querySelector('#mapWorld').appendChild(dots);
    const world=document.querySelector('#mapWorld'),goalRing=document.createElement('span');goalRing.className='delivery-goal';world.appendChild(goalRing);
    const goalLabel=document.createElement('span');goalLabel.className='delivery-goal-label';goalLabel.textContent='站這裡交籃';goalLabel.setAttribute('role','status');goalLabel.setAttribute('aria-label','站這裡交籃');goalLabel.hidden=true;world.appendChild(goalLabel);
    // A replaceable empty upper body plus six real leg drawings. Physics and
    // collider remain on #player; only its visual is replaced while carrying.
    const walker=document.createElement('canvas');walker.className='delivery-walker';walker.width=48;walker.height=64;document.querySelector('#player').appendChild(walker);
    const upper=new Image(),legs=new Image();upper.src=newArt('hold-player.png');legs.src='assets/generated/r89/walk.png'+(window.FARM_VERSION_QUERY||'');
    actor.src=newArt('idle-'+n.id+'.png');actor.dataset.pose='waiting';world.appendChild(actor);world.appendChild(parcel);
    function position() {
      if(cancelled)return;
      const npc=document.querySelector(`.ob[data-kind="npc"][data-npc="${n.id}"]`),player=document.querySelector('#player'),scene=document.querySelector('#mapScene');
      if(npc&&player&&scene){const nr=npc.getBoundingClientRect(),pr=(bar.dataset.phase==='walking'?walker:(player.querySelector('#playerSprite')||player)).getBoundingClientRect(),sr=scene.getBoundingClientRect(),dx=nr.x-pr.x,dy=nr.y-pr.y;
        const plan=farm().deliveryRoute(tile.id,standId),routeKey=JSON.stringify(plan?.path);if(!standId)standId=plan?.targetId;
        if(distanceTile!==routeKey){distanceTile=routeKey;distance=plan?.path.length??null;dots.innerHTML=(plan?.path||[]).map((id,i)=>{const t=s.map.tiles.find(t=>t.id===id),shift=n.id==='child'&&t.x===tile.x&&t.y===tile.y-1?.8:0;return `<i data-path-tile="${id}" style="left:${(t.x+.5-shift)*plan.size}px;top:${(t.y+.75)*plan.size}px">${i+1}</i>`;}).join('');}
        dots.hidden=bar.dataset.phase!=='walking';
        const dist=distance;bar.querySelector('.carry-distance').textContent=impact?'已接到手上':dist===null?'先找通路':dist?'剩 '+dist+' 格':'可以交籃';
        const goal=s.map.tiles.find(t=>t.id===plan?.targetId);
        goalRing.hidden=false;if(goal){const shift=n.id==='child'&&goal.x===tile.x&&goal.y===tile.y-1?.8:0;goalRing.style.cssText=`left:${(goal.x+.5-shift)*plan.size}px;top:${(goal.y+.92)*plan.size+20}px`;}
        const blockers=[...document.querySelectorAll('.ob[data-kind="structure"],.ob[data-kind="tea-porch"],.ob[data-kind="building"]')];
        const rects=blockers.map(e=>e.getBoundingClientRect());
        const scenery=[...document.querySelectorAll('.ob[data-kind="structure"],.ob[data-kind="tea-porch"],.ob[data-kind="building"],.world-site,.farm-gathering,.farm-memory')].filter(e=>{const r=e.getBoundingClientRect(),style=getComputedStyle(e);return !e.hidden&&style.visibility!=='hidden'&&style.display!=='none'&&r.width>0&&r.height>0;}).map(e=>e.getBoundingClientRect());
        const visiblePeople=[...document.querySelectorAll('.ob[data-kind="npc"]')].filter(e=>{const style=getComputedStyle(e);return style.visibility!=='hidden'&&style.display!=='none'&&e.getClientRects().length;}).map(e=>e.getBoundingClientRect());
        const visibleHandover=[...document.querySelectorAll('.delivery-walker,.handover-actor,.handover-player,.handover-parcel')].filter(e=>{const style=getComputedStyle(e);return style.visibility!=='hidden'&&style.display!=='none'&&e.getClientRects().length;}).map(e=>e.getBoundingClientRect());
        const people=[pr,...visiblePeople,...visibleHandover];
        dots.querySelectorAll('[data-path-tile]').forEach((e,i)=>{e.hidden=false;const t=s.map.tiles.find(t=>t.id===e.dataset.pathTile);e.hidden=i>=3||!window.ContentR17.groundMarker(s,t,e.getBoundingClientRect(),rects.concat(people),window.isWalkable);});
        const first=dots.firstElementChild;
        if(first){first.hidden=false;const r=first.getBoundingClientRect();if(people.some(p=>window.ContentR17.overlaps(r,p))){const wr=world.getBoundingClientRect(),scale=wr.width/world.offsetWidth,candidates=[{x:pr.left-16,y:pr.bottom+16},{x:pr.right+16,y:pr.bottom+16},{x:pr.left-16,y:pr.bottom+32}],point=candidates.find(c=>!people.some(p=>window.ContentR17.overlaps({left:c.x-12,right:c.x+12,top:c.y-9,bottom:c.y+9},p)))||candidates[0];first.style.left=(point.x-wr.left)/scale+'px';first.style.top=(point.y-wr.top)/scale+'px';}}
        goalRing.hidden=impact||!goal||rects.concat(people).some(r=>window.ContentR17.overlaps(goalRing.getBoundingClientRect(),r));
        goalLabel.hidden=true;goalLabel.dataset.position='';let stationCueFallback=false;
        if(goal&&bar.dataset.phase==='walking'){
          const worldRect=world.getBoundingClientRect(),worldScale=worldRect.width/world.offsetWidth,ringWasHidden=goalRing.hidden;
          goalRing.hidden=false;const ringRect=goalRing.getBoundingClientRect();goalRing.hidden=ringWasHidden;
          const bounds={left:sr.left+8,right:sr.right-8,top:Math.max(sr.top+75,80),bottom:sr.bottom-92},targetVisible=ringRect.right>bounds.left&&ringRect.left<bounds.right&&ringRect.bottom>bounds.top&&ringRect.top<bounds.bottom;
          if(targetVisible){
            goalLabel.hidden=false;goalLabel.style.cssText='left:0;top:0';
            const labelRect=goalLabel.getBoundingClientRect(),hudRects=[bar.querySelector('[role="status"]'),markLabel,marker,bar.querySelector('.carry-direction')].filter(e=>e&&!e.hidden&&e.getClientRects().length).map(e=>e.getBoundingClientRect());
            const cueBlockers=people.concat(scenery,hudRects,[ringRect]),position=window.ContentR17.goalLabelPlacement(ringRect,{width:labelRect.width,height:labelRect.height},cueBlockers,bounds);
            if(position){goalLabel.style.left=(position.left-worldRect.left)/worldScale+'px';goalLabel.style.top=(position.top-worldRect.top)/worldScale+'px';goalLabel.dataset.position=position.side;}else{goalLabel.hidden=true;stationCueFallback=true;}
          }
        }
        // Follow the actual interpolated feet, not the next physics tile.
        // The walking sprite stays articulated and opaque inside a local roof window.
        player.dataset.deliveryVisible='true';
        const visualWorld=world.getBoundingClientRect(),visualScale=visualWorld.width/world.offsetWidth,feet=(pr.bottom-visualWorld.top)/visualScale;
        player.style.zIndex=String(Math.round(feet));
        blockers.forEach(e=>{
          if(e.dataset.deliveryCutaway){e.style.maskImage='';e.removeAttribute('data-delivery-cutaway');}
          const r=e.getBoundingClientRect();
          if(+e.style.zIndex>feet&&window.ContentR17.overlaps(pr,r)){
            e.dataset.deliveryCutaway='true';
            e.style.maskImage=`radial-gradient(ellipse ${pr.width*.7/visualScale}px ${pr.height*.65/visualScale}px at ${(pr.x+pr.width/2-r.x)/visualScale}px ${(pr.y+pr.height/2-r.y)/visualScale}px,transparent 85%,black 100%)`;
          }
        });
        const arrow=bar.querySelector('.carry-direction'),onScreen=nr.left>=sr.left+8&&nr.right<=sr.right-8&&nr.top>=Math.max(sr.top+75,80)&&nr.bottom<=sr.bottom-100;
        const labelBox={left:nr.x-15,right:nr.right+25,top:nr.top-29,bottom:nr.top-7};
        const edge=true;
        const slots=[95,innerHeight-210,Math.round(innerHeight*.65)].flatMap(y=>[8,Math.max(8,innerWidth-212)].map(x=>({x,y})));
        const safe=slots.find(({x,y})=>!people.some(p=>window.ContentR17.overlaps({left:x,right:x+206,top:y,bottom:y+80},{left:p.left,top:p.top-16,right:p.right,bottom:p.bottom})))||{x:8,y:95};
        const {x,y}=safe;
        const next=s.map.tiles.find(t=>t.id===plan?.path[0]),current=s.map.tiles.find(t=>t.id===plan?.from),angle=next&&current?Math.atan2(next.y-current.y,next.x-current.x):0;
        arrow.hidden=bar.dataset.phase!=='walking';arrow.style.cssText=`left:${x+176}px;top:${y}px;rotate:${angle}rad`;arrow.dataset.direction=String(angle);arrow.setAttribute('aria-label','下一步的路線方向');
        bar.querySelector('.carry-distance').dataset.targetDirection=String(Math.atan2(nr.y-pr.y,nr.x-pr.x));
        bar.querySelector('.carry-distance').style.setProperty('--target-angle',Math.atan2(nr.y-pr.y,nr.x-pr.x)+'rad');
        markLabel.textContent='往'+n.name+'・'+(next&&current?next.y>current.y?'先往下':next.y<current.y?'先往上':next.x>current.x?'先往右':'先往左':'已到鄰居旁');
        markLabel.dataset.r21StationCue=String(stationCueFallback);markLabel.setAttribute('aria-label',markLabel.textContent+(stationCueFallback?'・沿路線走近交籃':''));
        marker.style.cssText=`left:${x}px;top:${y}px`;markLabel.style.cssText=`left:${x+25}px;top:${y+2}px`;markLabel.dataset.anchor=edge?'edge':'resident';markLabel.hidden=bar.dataset.phase!=='walking';marker.hidden=bar.dataset.phase!=='walking';
        if(bar.dataset.phase!=='walking'){
          parcel.hidden=false;const wr=world.getBoundingClientRect(),scale=wr.width/world.offsetWidth;
          const put=(e,r)=>e.style.cssText=`left:${(r.x-wr.x)/scale}px;top:${(r.y-wr.y)/scale}px;width:${r.width/scale}px;height:${r.height/scale}px`;
          const handRight=n.id==='elder'?false:pr.x>nr.x;
          const handRect={x:handRight?nr.right-pr.width*.18:nr.x-pr.width*.82,y:nr.bottom-pr.height,width:pr.width,height:pr.height};
          put(giver,handRect);put(actor,nr);
          const received=bar.dataset.phase==='contact'||bar.dataset.phase==='reply',reach=bar.dataset.phase==='reach',right=handRight;
          giver.style.setProperty('--face',right?-1:1);actor.style.setProperty('--face',right?1:-1);
          giver.style.setProperty('--depth',String(Math.round((nr.bottom-wr.y)/scale)));actor.style.setProperty('--depth',String(Math.round((nr.bottom-wr.y)/scale)+1));
          const gx=handRect.x+pr.width*(right?.26:.74),gy=handRect.y+pr.height*.54,ax=nr.x+nr.width*(right?.65:.35),ay=nr.y+nr.height*.55,blend=received?1:reach?.55:0;
          const w=32*scale;put(parcel,{x:gx+(ax-gx)*blend-w/2,y:gy+(ay-gy)*blend-w/2,width:w,height:w});
        }else{
          const wr=world.getBoundingClientRect(),scale=wr.width/world.offsetWidth,flip=s.player.facing==='left',gait=farm().moving()?Math.floor(performance.now()/140)%6:0,ctx=walker.getContext('2d');
          walker.hidden=false;walker.dataset.gait=String(gait);walker.style.transform=flip?'scaleX(-1)':'';
          if(upper.complete&&upper.naturalWidth&&legs.complete&&legs.naturalWidth){ctx.clearRect(0,0,48,64);ctx.imageSmoothingEnabled=false;ctx.drawImage(upper,0,0,48,64);ctx.clearRect(0,42,48,22);ctx.drawImage(legs,gait*48,170,48,22,0,42,48,22);}
          actor.style.cssText=`left:${(nr.left-wr.left)/scale}px;top:${(nr.top-wr.top)/scale}px;width:${nr.width/scale}px;height:${nr.height/scale}px;--face:-1;--depth:${Math.round((nr.bottom-wr.top)/scale)}`;
          const px=pr.left+pr.width*(flip?.26:.74),py=pr.top+pr.height*.58,w=26*scale;
          parcel.hidden=false;parcel.style.cssText=`left:${(px-w/2-wr.left)/scale}px;top:${(py-w/2-wr.top)/scale}px;width:${w/scale}px;height:${w/scale}px`;
        }
        walker.hidden=bar.dataset.phase!=='walking';
      }
      raf=requestAnimationFrame(position);
    }
    world.appendChild(parcel);route={cancel};position();
    const start=tile&&farm().travelAndDo(tile.id,'collect',()=>{
      if(cancelled)return;
      // The child is visually staged north of its collider. In a short landscape
      // view, center that visual row so the full heads clear the delivery HUD.
      const focus=n.id==='child'&&innerHeight<450?s.map.tiles.find(t=>t.x===tile.x&&t.y===tile.y-1):tile;
      document.body.dataset.handover='true';farm().focusTile(focus?.id||tile.id);bar.dataset.phase='arrived';actor.dataset.pose='waiting';actor.src=newArt('idle-'+n.id+'.png');world.appendChild(actor);world.appendChild(giver);world.appendChild(parcel);
      timers.push(setTimeout(()=>{if(cancelled)return;bar.dataset.phase='reach';actor.dataset.pose='reach';actor.src=newArt('reach-'+n.id+'.png');giver.src=newArt('reach-player.png');world.appendChild(parcel);bar.querySelector('.carry-receipt').textContent=n.name+'伸出雙手，碰到餐籃。';},1200));
      bar.querySelector('.carry-receipt').textContent='你把餐籃捧好，'+n.name+'正要伸手。';
      timers.push(setTimeout(()=>{
        if(cancelled)return;
        const result=A.deliverNeighbor(s,n.id,taste,Date.now());
        if(!result.ok){stop();farm().toast(result.message);done(result);return;}
        impact=true;giver.src=newArt('idle-player.png');giver.alt='米莉張開空手，餐籃已交給鄰居';bar.dataset.phase='contact';goalRing.hidden=true;actor.dataset.pose='receive';actor.src=newArt('hold-'+n.id+'.png');actor.alt=n.name+'雙手捧住餐籃';
        bar.querySelector('button').hidden=true;marker.hidden=true;R.save(s);
        const remembered=A.neighbors(s,Date.now()).filter(n=>n.matched).length;
        bar.querySelector('.carry-memory').textContent='已記住 '+remembered+'／3 位鄰居的口味'+(remembered===3?'・三籃備齊後，到聚餐桌一起吃。':'');
        const after=A.basketFlavors(s,Date.now()).find(f=>f.id===taste).requirements;
        bar.querySelector('.carry-receipt').textContent=before.map((r,i)=>`${r.name} ${r.current}→${after[i].current} 份`).join('、')+'・'+n.name+'已接到'+{sour:'酸味',hot:'熱味',sweet:'甜味',plain:'原味'}[taste]+'餐籃';
        timers.push(setTimeout(()=>{bar.dataset.phase='reply';actor.dataset.pose='reply';actor.src=newArt((n.id==='elder'?'idle':'hold')+'-'+n.id+'.png');bar.querySelector('.carry-receipt').textContent=result.firstDelivery?result.neighbor.reply:result.matched?result.neighbor.memory.reply:result.neighbor.memory.wrong;},1200));
        timers.push(setTimeout(()=>{stop();done(result);},2600));
      },2600));
    },{standId});
    if(!start){stop();farm().toast('路還沒走通，先看看鄰居在哪裡。');done({ok:false});}
  }
  function response(box,s,id,matched) {
    if(matched){const p=document.createElement('figure');p.className='memory-token';p.innerHTML=`<img src="${art('token-'+id+'.png')}" alt="${A.neighbors(s,Date.now()).find(n=>n.id===id).memory.token}" width="96" height="96"><figcaption>${{merchant:'茶杯倒扣著，等你來翻開',elder:'魚竿掛好，灶旁總有兩只盤子',child:'花和第三塊點心，替後到的人留著'}[id]}</figcaption>`;box.querySelector('.story-occasion').after(p);}
    window.ContentR8.memory(box,s,id);
    const g=A.gathering(s,Date.now());
    if(g.unlocked){const b=document.createElement('button');b.id='gatheringEntry';b.className='content-secondary';b.textContent=g.completed?'翻聚餐總手記':'約三位鄰居一起吃';box.querySelector('.content-footer').appendChild(b);b.onclick=()=>openGathering(s);}
  }
  function openGathering(s,selected='merchant') {
    const g=A.gathering(s,Date.now());if(!g.unlocked){
      const missing=A.neighbors(s,Date.now()).filter(n=>!n.matched).map(n=>n.name);
      const box=R.page('餐桌先留著', '<p>還沒記住'+missing.join('、')+'的口味。再送一籃、聽聽他們怎麼說。</p>','<button id="gatherMissing" class="content-primary">回去裝餐籃</button>');
      box.dataset.contentView='gathering-locked';box.querySelector('#gatherMissing').onclick=()=>R.openNeighbors(s);return;
    }
    if(g.completed)return gatheringReview(s);
    const n=g.people.find(n=>n.id===selected), f=A.basketFlavors(s,Date.now()).find(f=>f.id===n.taste),packed=!!g.packed[n.id];
    const box=R.page('三個位子，同一個下午',`<p>你已經記住大家了。這次不用猜，照手記準備三籃，再一起走到陽光下。</p><nav class="neighbor-tabs">${g.people.map(p=>`<button data-gather-person="${p.id}" aria-pressed="${p.id===n.id}">${p.name}${g.packed[p.id]?'・已備':''}</button>`).join('')}</nav><img class="gather-basket" src="${art('basket-'+n.taste+'.png')}" alt="${n.name}的${n.flavor}味餐籃"><h3>${n.name}・${n.flavor}味</h3><p>${n.detail}</p><p>${f.requirements.map(r=>`持有${r.name} ${r.current}份，這籃需要 ${r.required}份`).join('；')}</p><p class="gather-list">${g.people.map(p=>`${p.name}・${p.flavor}味：${g.packed[p.id]?'已放好':'還沒裝'}`).join('／')}</p>`,
      `<button id="packGathering" class="content-primary" ${packed||!f.canSend?'disabled':''}>${packed?'這一籃已放好':`裝好${n.name}的${n.flavor}味餐籃`}</button><button id="goGathering" class="content-primary" ${g.ready?'':'disabled'}>三籃備齊，一起赴約</button><button id="gatherKitchen" class="content-secondary">回灶台</button>`);
    box.dataset.contentView='gathering';box.dataset.resident=n.id;
    box.querySelectorAll('[data-gather-person]').forEach(b=>b.onclick=()=>openGathering(s,b.dataset.gatherPerson));
    box.querySelector('#packGathering').onclick=()=>{const r=A.packGathering(s,n.id,n.taste,Date.now());if(r.ok)R.save(s);else farm().toast(r.message);openGathering(s,n.id);};
    box.querySelector('#gatherKitchen').onclick=()=>window.FarmWorld.openKitchen();
    box.querySelector('#goGathering').onclick=()=>{
      R.close();const target=s.map.tiles.find(t=>t.npc==='child');
      const started=farm().travelAndDo(target.id,'collect',()=>{const r=A.completeGathering(s,Date.now());if(r.ok){R.save(s);showGathering(s);}else farm().toast(r.message);});
      if(!started){farm().toast('路還沒走通，三籃會留在手記裡。');openGathering(s);}
    };
  }
  // Both the modal and the real map compose the SAME native table, keepsakes and actors.
  // The fixed meal root is separate from its articulated walking visual. Upper
  // body holds the plate; six existing R89 leg poses provide real locomotion.
  function mountServer(root) {
    if(root.dataset.mounted)return;root.dataset.mounted='true';
    const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),walk=new Image(),poses={};
    walk.src='assets/generated/r89/walk.png'+(window.FARM_VERSION_QUERY||'');
    for(const pose of ['rest','lift','push']){const im=new Image();im.src='assets/generated/content-r12/serve-'+pose+'.png'+(window.FARM_VERSION_QUERY||'');poses[pose]=im;}
    let active='rest',motion=null,returning=null,raf=0;
    Object.defineProperty(root,'src',{set(src){active=src.includes('push')?'push':src.includes('lift')?'lift':'rest';root.dataset.pose=active;},get(){return poses[active].src;}});
    root.beginPlate=(plate,id)=>{motion={plate,id,at:performance.now()};returning=null;};
    root.endPlate=()=>{if(motion){returning={x:Number(canvas.dataset.x||0),y:Number(canvas.dataset.y||0),at:performance.now()};motion=null;}};
    function draw(){if(!root.isConnected)return;raf=requestAnimationFrame(draw);ctx.clearRect(0,0,48,64);ctx.imageSmoothingEnabled=false;
      const im=poses[active];if(!im.complete||!im.naturalWidth)return;ctx.drawImage(im,0,0,48,64);
      let x=0,y=0,flip=false,gait=-1;
      if(motion){const {plate,id,at}=motion,t=performance.now()-at,p=Math.max(0,Math.min(1,(t-700)/1550)),[px,py]=window.ContentR17.platePosition(id,p);
        flip=id==='merchant'&&p>.6;const palm=active==='push'?[44,27]:[35,36],hx=px+(flip?29:3),hy=py+20;
        x=hx-(flip?(48-palm[0]):palm[0])*4/3-35;y=hy-palm[1]*86/64-173;
        plate.style.left=px+'px';plate.style.top=py+'px';plate.dataset.handX=String(hx);plate.dataset.handY=String(hy);
        if(t>700&&p<1)gait=Math.floor(t/130)%6;
      }else if(returning){const p=Math.min(1,(performance.now()-returning.at)/900);x=returning.x*(1-p);y=returning.y*(1-p);if(p<1)gait=Math.floor(performance.now()/130)%6;else returning=null;}
      if(gait>=0&&walk.complete&&walk.naturalWidth){ctx.clearRect(0,42,48,22);ctx.drawImage(walk,gait*48,128+42,48,22,0,42,48,22);}
      canvas.style.transform=`translate(${x}px,${y}px) scaleX(${flip?-1:1})`;canvas.dataset.x=String(x);canvas.dataset.y=String(y);canvas.dataset.gait=String(gait);canvas.dataset.pose=active;
    }draw();
  }
  function tableScene(served=[]) {
    const positions=window.ContentR17.plates.end;
    return `<span class="meal-layout"><span class="meal-table" aria-hidden="true"></span><span class="meal-player" role="img" aria-label="米莉端送點心"><canvas class="meal-server" width="48" height="64"></canvas></span>${Object.keys(names).map(id=>`<img class="meal-trace meal-trace-${id}" src="assets/generated/content-r10/cup.png${window.FARM_VERSION_QUERY||''}" alt="${names[id]}的茶杯"><img class="meal-person meal-person-${id}" data-seated-resident="${id}" data-fed="${served.some(h=>h.id===id&&h.matched)}" src="${served.some(h=>h.id===id&&h.matched)?newArt('sip-'+id+'.png'):'assets/generated/content-r13/wait-'+id+'.png'+(window.FARM_VERSION_QUERY||'')}" alt="${names[id]}坐在餐桌旁">`).join('')}${served.map(h=>{const xy=h.matched?positions[h.id]:window.ContentR17.plates.shared;return `<img class="serving-plate" data-for="${h.id}" data-matched="${h.matched}" src="assets/generated/content-r10/${h.taste}.png${window.FARM_VERSION_QUERY||''}" style="left:${xy[0]}px;top:${xy[1]}px" alt="${h.matched?names[h.id]+'手邊的點心':'大家分食的共享盤'}">`;}).join('')}</span>`;
  }
  function styleTables(root) {
    root.querySelectorAll('.meal-player:has(canvas)').forEach(mountServer);
    root.querySelectorAll('.meal-table').forEach(e=>{Object.assign(e.style,window.Atlas.frameStyleFor('world_projects','picnic_table_repaired',240,120));});
    root.querySelectorAll('.meal-layout').forEach(e=>{const p=e.parentElement,w=p.clientWidth||340,worldScale=p.getBoundingClientRect().width/w||1;e.style.setProperty('--meal-scale',Math.min(1,(w-8)/340,(innerWidth-24)/(340*worldScale)));});
  }
  function sitInFarm() {
    R.close();document.body.dataset.reunion='true';farm().focusTile('t7_8');
    const leave=e=>{if(e.target.closest?.('.farm-gathering'))return;document.body.removeAttribute('data-reunion');document.removeEventListener('pointerdown',leave,true);document.removeEventListener('keydown',leave,true);};
    document.addEventListener('pointerdown',leave,true);document.addEventListener('keydown',leave,true);
  }
  function showGathering(s) {
    const flavors={sour:'酸味野莓',hot:'熱味麥餅',sweet:'甜味胡蘿蔔點心'},ids=Object.keys(names);
    const choices=ids.map(id=>`<button data-serve-person="${id}" aria-pressed="false">先端給${names[id]}</button>`).join('');
    const foods=Object.entries(flavors).map(([taste,label])=>`<button data-serve-taste="${taste}" aria-pressed="false"><img src="assets/generated/content-r10/${taste}.png${window.FARM_VERSION_QUERY||''}" alt=""><span>${label}</span><small></small></button>`).join('');
    const box=R.page('今天，四個人一起吃',`<div class="gather-stage" role="img" aria-label="米莉、蘿拉、班伯、圖圖四人圍坐餐桌">${tableScene()}</div><p class="gather-progress" role="status"></p><p class="gather-shared" role="status"></p><div class="gather-status" aria-label="鄰居招待狀態"></div><div class="gather-choices"><nav class="neighbor-tabs">${choices}</nav><div class="serving-foods">${foods}</div><details class="other-foods"><summary>換一種味道</summary><div></div></details></div><section class="gather-extras" hidden><h3>補備與上菜紀錄</h3><div class="restock-foods"></div><div class="gather-supply" role="status"></div><div class="gather-seats"></div></section>`, '<button id="gatherSip" class="content-primary" disabled>先選一位鄰居</button><button id="gatherSkip" class="content-secondary" hidden>略過這次端送</button><button id="gatherContinue" class="content-primary" hidden>繼續，選下一份</button><button id="gatherChoosePerson" class="content-secondary" hidden>換人</button><button id="gatherSupplies" class="content-secondary">補備</button><button id="gatherReturn" class="content-primary" hidden>回餐桌選點心</button><button id="gatherReview" class="content-secondary">手記</button><button id="gatherBack" class="content-secondary">回農場</button>');
    box.dataset.contentView='gathering-complete';styleTables(box);
    let selected=null,taste=null,busy=false,timers=[],commit=null;
    const shared=box.querySelector('.gather-shared'),button=box.querySelector('#gatherSip'),next=box.querySelector('#gatherContinue'),skip=box.querySelector('#gatherSkip'),stage=box.querySelector('.gather-stage'),layout=stage.querySelector('.meal-layout');
    const servings=()=>A.gathering(s,Date.now()).servings||[];
    const history=()=>{const hs=servings();box.querySelector('.gather-seats').innerHTML=hs.length?'<details class="serving-history"><summary>翻開今天的上菜紀錄（'+hs.length+'）</summary>'+hs.map((h,i)=>`<p>${i+1}．${h.matched?names[h.id]+'・個別招待':'大家分食・先端給'+names[h.id]}・${flavors[h.taste]}<br>${h.reply}</p>`).join('')+'</details>':'';};
    function refreshPoses(){const hs=servings();layout.querySelectorAll('[data-seated-resident]').forEach(e=>{const fed=hs.some(h=>h.matched&&h.id===e.dataset.seatedResident);e.dataset.fed=String(fed);e.dataset.reactingUntil='0';window.FarmWorld.requestResidentPose(e,fed?newArt('sip-'+e.dataset.seatedResident+'.png'):'assets/generated/content-r13/wait-'+e.dataset.seatedResident+'.png'+(window.FARM_VERSION_QUERY||''),{pose:fed?'sip':'wait'});});}
    function progress(){const hs=servings(),fed=ids.filter(id=>hs.some(h=>h.id===id&&h.matched)),waiting=ids.filter(id=>!fed.includes(id));box.querySelector('.gather-progress').textContent=waiting.length?(fed.length?fed.map(id=>names[id]).join('、')+'已吃到；':'')+'還差'+waiting.map(id=>names[id]).join('、'):'三位都吃到了，謝謝這個下午。';
      box.querySelector('.gather-progress').dataset.servings=String(hs.length);box.querySelector('.gather-progress').dataset.guests=String(fed.length);
      box.querySelector('.gather-status').innerHTML=ids.map(id=>'<span><img alt="" src="'+newArt('idle-'+id+'.png')+'">'+names[id]+(hs.some(h=>h.id===id&&h.matched)?'・已吃到':'・等待')+'</span>').join('');
      stage.querySelector('.shared-dish-label')?.remove();if(hs.some(h=>!h.matched)){const label=document.createElement('span');label.className='shared-dish-label';label.textContent='大家分食';layout.appendChild(label);}}
    function choose(){
      busy=false;selected=null;taste=null;box.dataset.servingPhase='choose';box.dataset.gatherStep='person';skip.hidden=true;refreshPoses();
      box.querySelector('.other-foods').open=false;
      box.querySelector('.gather-extras').hidden=true;box.querySelector('#gatherReturn').hidden=true;box.querySelector('#gatherChoosePerson').hidden=true;box.querySelector('#gatherSupplies').hidden=false;
      const hs=servings(),done=new Set(hs.filter(h=>h.matched).map(h=>h.id)).size>=3;
      progress();shared.textContent=done?'三位都接到了。'+(hs.some(h=>!h.matched)?'桌中央還留著大家分食的那份。':'今天三份都送到了本人手邊。'):hs.at(-1)&&!hs.at(-1).matched?'這份大家分食，不算'+names[hs.at(-1).id]+'的那一份。':'選一位鄰居，再選一份點心。';
      box.querySelector('.gather-choices').hidden=done;button.hidden=true;button.disabled=true;button.textContent='先選一位鄰居';next.hidden=!done;next.disabled=done&&!!s.adventure.gathering.recorded;next.textContent=s.adventure.gathering.recorded?'已收進手記':'收進手記';
      box.querySelector('#gatherReview').hidden=false;box.querySelector('#gatherBack').hidden=false;
      box.querySelector('#gatherReview').textContent=done?'重讀回話':'手記';box.querySelector('#gatherReview').className='content-secondary';box.querySelector('#gatherSupplies').hidden=done;
      box.querySelectorAll('[data-serve-person]').forEach(b=>{const served=hs.some(h=>h.id===b.dataset.servePerson&&h.matched);b.disabled=served;b.setAttribute('aria-pressed','false');b.textContent=names[b.dataset.servePerson]+(served?'・已吃到':'・等待');});
      const portions=A.gatheringPortions(s,Date.now());
      box.querySelectorAll('[data-serve-taste]').forEach(b=>{const p=portions.find(p=>p.taste===b.dataset.serveTaste);b.disabled=p.finished||p.remaining===0;b.setAttribute('aria-pressed','false');b.querySelector('small').textContent='剩 '+p.remaining+' 份';});
      const restocks=portions.filter(p=>!p.finished&&p.remaining===0);
      box.querySelector('.restock-foods').innerHTML=restocks.map(p=>`<button data-refill="${p.taste}" ${p.canRefill?'':'disabled'}>再備${flavors[p.taste]}一份<small>取用：${p.requirements.map(r=>r.name+' '+r.required+' 份（持有 '+r.current+'）').join('、')}${p.canRefill?'':'・材料不足'}</small></button>`).join('');
      box.querySelectorAll('[data-refill]').forEach(b=>b.onclick=()=>{const r=A.refillGathering(s,b.dataset.refill,Date.now());if(r.ok){R.save(s);choose();supplies();box.querySelector('.gather-supply').textContent=r.message;}else farm().toast(r.message);});
      const refills=A.gathering(s,Date.now()).refills||[];box.querySelector('.gather-supply').textContent=refills.length?'本次聚餐已補備：'+refills.map(r=>flavors[r.taste]+'・'+r.receipt).join('；'):'';
      history();
    }
    function selection(){
      box.dataset.gatherStep='food';box.querySelector('#gatherChoosePerson').hidden=false;
      button.hidden=false;
      const preferred={merchant:'sour',elder:'hot',child:'sweet'}[selected],primary=box.querySelector('.serving-foods');
      box.querySelectorAll('[data-serve-taste]').forEach(b=>{primary.appendChild(b);b.querySelector('span').textContent=flavors[b.dataset.serveTaste];});
      button.disabled=!(selected&&taste);button.textContent=selected&&taste?'把'+flavors[taste]+'端給'+names[selected]:'先替'+names[selected]+'點選口味卡';box.querySelectorAll('[data-serve-person]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.servePerson===selected)));box.querySelectorAll('[data-serve-taste]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.serveTaste===taste)));
      const previous=servings().filter(h=>h.id===selected).at(-1);
      shared.innerHTML='<details class="gather-recall"><summary>看看記過的口味</summary><p>'+names[selected]+'喜歡'+{sour:'酸味',hot:'熱味',sweet:'甜味'}[preferred]+'，上回送餐籃時記下來的。'+(previous?'剛才的'+flavors[previous.taste]+(previous.matched?'已送到本人手邊。':'大家共享，還等著'+flavors[preferred]+'。'):'今天還沒招待。')+'</p></details>';
    }
    function supplies(){box.dataset.gatherStep='supplies';box.querySelector('.gather-extras').hidden=false;box.querySelector('.gather-choices').hidden=true;button.hidden=true;box.querySelector('#gatherSupplies').hidden=true;box.querySelector('#gatherChoosePerson').hidden=true;box.querySelector('#gatherReturn').hidden=false;}
    box.querySelector('#gatherChoosePerson').onclick=choose;box.querySelector('#gatherSupplies').onclick=supplies;box.querySelector('#gatherReturn').onclick=choose;
    box.querySelectorAll('[data-serve-person]').forEach(b=>b.onclick=()=>{if(busy)return;selected=b.dataset.servePerson;taste=null;selection();});
    box.querySelectorAll('[data-serve-taste]').forEach(b=>b.onclick=()=>{if(busy)return;taste=b.dataset.serveTaste;selection();});
    // Keep a clear lane beside the central shared bowl, including after a wrong taste.
    const {end:pos,start,lanes,shared:sharedPosition}=window.ContentR17.plates;
    function plate(h){const e=document.createElement('img');e.className='serving-plate';e.src='assets/generated/content-r10/'+h.taste+'.png'+(window.FARM_VERSION_QUERY||'');e.alt=names[h.id]+'的'+flavors[h.taste];e.dataset.for=h.id;e.dataset.matched=String(h.matched);layout.appendChild(e);return e;}
    function place(e,h){const xy=h.matched?pos[h.id]:sharedPosition;e.style.left=xy[0]+'px';e.style.top=xy[1]+'px';}
    for(const h of servings()){const e=plate(h);place(e,h);}
    button.onclick=()=>{
      if(busy||!selected||!taste)return;busy=true;
      const id=selected,food=taste,player=layout.querySelector('.meal-player'),resident=layout.querySelector('[data-seated-resident="'+id+'"]');
      const h={id,taste:food,matched:{merchant:'sour',elder:'hot',child:'sweet'}[id]===food},e=plate(h);e.classList.add('in-transit');
      const pose='sip';let committed=false;const trail=document.createElement('span');trail.className='plate-landing';trail.style.left=pos[id][0]+'px';trail.style.top=pos[id][1]+'px';layout.appendChild(trail);
      box.dataset.lastServed=id;box.dataset.lastTaste=food;box.dataset.matched=String(h.matched);box.dataset.servingPhase='lift';
      box.querySelector('.gather-choices').hidden=true;button.hidden=true;next.hidden=true;skip.hidden=false;box.querySelector('.gather-seats').hidden=true;
      box.querySelector('#gatherBack').hidden=true;box.querySelector('#gatherReview').hidden=true;
      box.querySelector('#gatherChoosePerson').hidden=true;box.querySelector('#gatherSupplies').hidden=true;
      shared.textContent='米莉端起'+flavors[food]+'。';
      player.src='assets/generated/content-r12/serve-lift.png'+(window.FARM_VERSION_QUERY||'');player.dataset.action='offer';player.beginPlate(e,id);resident.dataset.reactingUntil=String(performance.now()+4500);e.style.left=start[0]+'px';e.style.top=start[1]+'px';
      timers.push(setTimeout(()=>{if(!stage.isConnected||!box.classList.contains('show'))return;box.dataset.servingPhase='carry';shared.textContent='米莉端著點心，走向'+names[id]+'伸出的手。';player.src='assets/generated/content-r12/serve-push.png'+(window.FARM_VERSION_QUERY||'');player.dataset.action='reach';window.FarmWorld.requestResidentPose(resident,newArt('offer-'+id+'.png'),{pose:'offer'});e.style.left=lanes[id][0]+'px';e.style.top=lanes[id][1]+'px';},700));
      timers.push(setTimeout(()=>{if(!stage.isConnected||!box.classList.contains('show'))return;e.style.left=pos[id][0]+'px';e.style.top=pos[id][1]+'px';},1550));
      commit=()=>{if(committed||!stage.isConnected||!box.classList.contains('show'))return;committed=true;timers.forEach(clearTimeout);skip.hidden=true;
        const r=A.serveGatheringPortion(s,id,food,Date.now());if(!r.ok){e.remove();farm().toast(r.message);choose();return;}
        R.save(s);trail.remove();player.endPlate();e.classList.remove('in-transit');box.dataset.servingPhase='received';refreshPoses();const personal='sip';window.FarmWorld.requestResidentPose(resident,r.serving.matched?newArt(personal+'-'+id+'.png'):'assets/generated/content-r13/wait-'+id+'.png'+(window.FARM_VERSION_QUERY||''),{pose:r.serving.matched?personal:'wait'});resident.dataset.reactingUntil=String(performance.now()+1800);player.src='assets/generated/content-r12/serve-rest.png'+(window.FARM_VERSION_QUERY||'');player.dataset.action='sit';place(e,r.serving);
        shared.textContent=r.serving.matched?window.ContentR17.received(names[id],flavors[food]):names[id]+'把這份放到桌中央，留給大家一起吃。';history();progress();next.hidden=false;
        const allFed=new Set(servings().filter(h=>h.matched).map(h=>h.id)).size>=3;next.textContent=allFed?'收進手記':'繼續，選下一份';if(allFed){box.querySelector('#gatherBack').hidden=false;box.querySelector('#gatherReview').hidden=false;box.querySelector('#gatherReview').textContent='重讀回話';}
        timers.push(setTimeout(()=>{if(!stage.isConnected||!box.classList.contains('show'))return;box.dataset.servingPhase='reply';if(r.serving.matched){const reaction={merchant:'offer',elder:'sip',child:'offer'}[id];window.FarmWorld.requestResidentPose(resident,newArt(reaction+'-'+id+'.png'),{pose:reaction,personalReaction:id});resident.dataset.reactingUntil=String(performance.now()+1800);}shared.textContent=r.message+(r.serving.matched?'':' 這份大家分食，不算'+names[id]+'的那一份。');next.hidden=false;next.textContent=allFed?'收進手記':'繼續，選下一份';box.querySelector('#gatherBack').hidden=false;box.querySelector('#gatherReview').hidden=false;box.querySelector('.gather-seats').hidden=false;},1000));
      };timers.push(setTimeout(commit,2450));
    };
    skip.onclick=()=>commit?.();next.onclick=()=>{timers.forEach(clearTimeout);if(new Set(servings().filter(h=>h.matched).map(h=>h.id)).size>=3){s.adventure.gathering.recorded=true;R.save(s);}box.querySelector('.gather-seats').hidden=false;choose();};choose();box.querySelector('#gatherReview').onclick=()=>gatheringReview(s);box.querySelector('#gatherBack').onclick=sitInFarm;
  }
  let journalPage=0;
  function gatheringReview(s) {
    const g=A.gathering(s,Date.now()),flavors={sour:'酸味野莓',hot:'熱味麥餅',sweet:'甜味胡蘿蔔點心'},servings=g.servings||[],refills=g.refills||[],portions=A.gatheringPortions(s,Date.now()),invitation=s.adventure.gathering.invitation,hasShared=servings.some(h=>!h.matched);
    const servingHtml='<section class="serving-journal"><h3>今天端出的點心</h3>'+servings.map((h,i)=>`<p>${i+1}．${h.matched?'個別招待・':'大家分食・先端給'}${names[h.id]}・${flavors[h.taste]}<br>${h.reply}</p>`).join('')+(servings.length?'':'<p>今天還沒有端出點心。</p>')+'</section>';
    const reserveHtml='<section class="reserve-journal supply-history" data-refill-count="'+refills.length+'"><h3>本次聚餐的補備與剩餘</h3>'+ (refills.length?refills.map(r=>'<article class="reserve-item"><strong>'+flavors[r.taste]+'</strong><small class="reserve-receipt">補備時已取用：'+r.receipt+'</small></article>').join(''):'<p>本次沒有另行補備。</p>')+'<p class="portion-balances">還能端送：'+portions.map(p=>'<span data-remaining-taste="'+p.taste+'" data-remaining="'+p.remaining+'">'+flavors[p.taste]+' '+p.remaining+' 份</span>').join('、')+'</p><p class="invitation-status" data-invitation="'+(invitation?invitation.id:'none')+'">'+(invitation?'已邀'+names[invitation.id]+'分食桌中央那盤。':hasShared?'尚未邀朋友分食桌中央那盤。':'這次沒有另留共享盤。')+(hasShared?'邀請只取共享盤，不再拿食材。':'')+'</p></section>';
    const memoriesHtml=g.people.map(n=>`<article class="gather-review"><img class="content-illustration" src="assets/generated/${n.id==='child'?'content-r4':'content-r3'}/${n.id}.webp${window.FARM_VERSION_QUERY||''}" alt="${n.token}"><h3>${n.name}・喜歡${n.flavor}味</h3><p>${n.detail}</p></article>`).join('');
    const content=`<div class="gather-stage" role="img" aria-label="這個下午的四人聚餐">${tableScene(servings)}</div>${servingHtml}${reserveHtml}${memoriesHtml}`;
    const box=R.page('同一個下午・總手記',content,'<button id="sharedMealEntry" class="content-primary">下一桌・搭配餐點</button><button id="gatherAgain" class="content-secondary">重看共同聚餐</button><button id="gatherBack" class="content-secondary">回農場</button>');
    if(invitation){const entry=document.createElement('section');entry.className='invitation-journal';const dish=g.servings.find(h=>!h.matched);const img=document.createElement('img');img.src='assets/generated/content-r10/'+dish.taste+'.png'+(window.FARM_VERSION_QUERY||'');img.alt='留下分食的同一道點心';entry.appendChild(img);const text=document.createElement('p');text.textContent=new Date(invitation.at).toLocaleDateString('zh-TW')+'・這個下午，邀'+names[invitation.id]+'分食。'+invitation.reply;entry.appendChild(text);box.querySelector('.modal-body').prepend(entry);}
    box.dataset.contentView='gathering-review';styleTables(box);const ready=(g.servings||[]).some(h=>!h.matched)&&Object.keys(names).every(id=>(g.servings||[]).some(h=>h.id===id&&h.matched));
    if(ready){const invite=document.createElement('button');invite.id='gatherInvite';invite.className='content-primary';invite.textContent=s.adventure.gathering.invitation?'重讀分食邀請':'留一口，邀朋友分食';box.querySelector('.content-footer').prepend(invite);invite.onclick=()=>window.ContentR16.invitation(s,()=>gatheringReview(s));}
    const body=box.querySelector('.modal-body'),journal=body.querySelector('.serving-journal');
    if(journal){
      const entries=[...journal.querySelectorAll(':scope > p')],pages=[];
      for(let i=0;i<entries.length;i+=3){const page=document.createElement('section');page.className='journal-page';page.append(...entries.slice(i,i+3));pages.push(page);}
      if(!pages.length)pages.push(document.createElement('section'));
      const invitationEntry=body.querySelector('.invitation-journal');
      const reserveSection=body.querySelector('.reserve-journal');
      const memories=document.createElement('details');memories.className='journal-memories';memories.innerHTML='<summary>看聚餐合照與三位鄰居的故事</summary>';body.querySelectorAll('.gather-stage,.gather-review').forEach(e=>memories.appendChild(e));
      const summary=document.createElement('section');summary.className='journal-tastes';summary.innerHTML='<h3>記得你喜歡的那一口</h3>'+g.people.map(n=>{const h=g.servings.filter(h=>h.id===n.id&&h.matched).at(-1);return '<article><img alt="'+n.name+'" src="'+newArt('idle-'+n.id+'.png')+'"><div><strong>'+n.name+'・喜歡'+n.flavor+'味</strong><br><span>已招待：'+(h?{sour:'酸味野莓',hot:'熱味麥餅',sweet:'甜味胡蘿蔔點心'}[h.taste]:'還在等你端來')+'</span></div></article>';}).join('');
      pages.at(-1).appendChild(summary);
      journal.replaceChildren(...pages);body.replaceChildren();const pager=document.createElement('nav');pager.className='journal-pager';pager.innerHTML='<button type="button" class="journal-prev">上一頁</button><span></span><button type="button" class="journal-next">下一頁</button>';body.append(pager,journal,...(reserveSection?[reserveSection]:[]),...(invitationEntry?[invitationEntry]:[]),memories);
      let current=Math.min(journalPage,pages.length-1);const turn=()=>{journalPage=current;pages.forEach((e,i)=>e.hidden=i!==current);if(invitationEntry)invitationEntry.hidden=current!==pages.length-1;pager.querySelector('span').textContent='點心手記 '+(current+1)+'／'+pages.length+' 頁';pager.querySelector('.journal-prev').disabled=current===0;pager.querySelector('.journal-next').disabled=current===pages.length-1;body.scrollTop=0;box.dataset.journalPage=String(current+1);};
      pager.querySelector('.journal-prev').onclick=()=>{current--;turn();};pager.querySelector('.journal-next').onclick=()=>{current++;turn();};turn();
    }
    box.querySelector('#sharedMealEntry').onclick=()=>window.ContentR24.open(s);box.querySelector('#gatherAgain').onclick=()=>showGathering(s);box.querySelector('#gatherBack').onclick=sitInFarm;
  }
  function paintWorld(s,size) {
    const world=document.querySelector('#mapWorld');if(!world)return;
    const g=s.adventure?.gathering;
    let creek=world.querySelector('.r13-creek');if(!creek){creek=document.createElement('div');creek.className='r13-creek';creek.setAttribute('aria-hidden','true');world.prepend(creek);}creek.style.cssText=`left:${size*15}px;top:${-size*4}px;width:${size*3}px;height:${size*20}px`;
    for(const id of Object.keys(names)) {
      let e=world.querySelector(`[data-memory-token="${id}"]`);const matched=s.adventure?.neighbors?.[id]?.matched;
      if(!matched){if(e)e.remove();continue;}
      const tile=s.map.tiles.find(t=>t.npc===id);if(!tile)continue;
      if(!e){e=document.createElement('button');e.className='farm-memory';e.dataset.memoryToken=id;e.setAttribute('aria-label',names[id]+'留下的位子');e.innerHTML=`<img src="${'assets/generated/content-r10/'+{merchant:'cup',elder:'hot',child:'sweet'}[id]+'.png'+(window.FARM_VERSION_QUERY||'')}" alt="" width="64" height="64"><span class="memory-caption">${{merchant:'茶凳',elder:'魚竿架',child:'壓花椅'}[id]}・點一下</span>`;e.onclick=event=>{event.stopPropagation();R.openResponse(s,id);};world.appendChild(e);}
      e.style.cssText=`left:${(tile.x+.7)*size}px;top:${(tile.y+.35) *size}px;width:${size*1.5}px;height:${size*1.5}px;z-index:${Math.round((tile.y+1)*size+3)}`;
    }
    let table=world.querySelector('[data-gathering-table]');
    if((g?.completed||Object.values(s.adventure?.neighbors||{}).some(n=>n.matched))&&!table){table=document.createElement('button');table.className='farm-gathering';table.dataset.gatheringTable='true';table.setAttribute('aria-label','三位鄰居的聚餐桌與手記');table.innerHTML=tableScene(g.servings||[]);table.onclick=e=>{e.stopPropagation();s.adventure.gathering.completed?showGathering(s):openGathering(s);};world.appendChild(table);}
    if(table&&(table.dataset.portions!==String(g.servings?.length||0)||table.dataset.ready!==String(g.completed))){table.innerHTML=g.completed?tableScene(g.servings||[]):'<span class="meal-layout"><span class="meal-table"></span><span class="reserved-table">聚餐桌・先記住三位鄰居</span></span>';table.dataset.portions=String(g.servings?.length||0);table.dataset.ready=String(g.completed);}
    if(table){const width=Math.max(size*4.2,340),site=s.map.tiles.find(t=>t.id===s.adventure?.siteTiles?.picnic_table),center=site?site.x+.5:10.5;table.style.cssText=`left:${size*center-width/2}px;top:${size*7.5}px;width:${width}px;height:${size*2.2}px;z-index:${Math.round(size*(g.completed?10:7))}`;styleTables(table);}
    fitMapLabels();

  }
  let labelFrame=0;
  function fitMapLabels(){
    cancelAnimationFrame(labelFrame);labelFrame=requestAnimationFrame(()=>{
      const table=document.querySelector('.farm-gathering'),scene=document.querySelector('#mapScene');
      let label=document.querySelector('body>.gather-map-label');
      if(!table||!scene){label?.remove();return;}
      if(!label){label=document.createElement('span');label.className='gather-map-label';document.body.appendChild(label);}
      const r=table.getBoundingClientRect(),s=scene.getBoundingClientRect();
      label.hidden=r.right<s.left||r.left>s.right||r.bottom<s.top||r.top>s.bottom||!!document.querySelector('.modal.show')||!!document.body.dataset.handover;
      label.textContent=table.dataset.ready==='true'?'聚餐桌・點桌子翻手記':'聚餐桌・先記住三位鄰居';
      const w=label.offsetWidth,x=Math.max(s.left+6,Math.min(s.right-w-6,r.left+r.width/2-w/2)),y=Math.max(s.top+70,Math.min(s.bottom-150,r.top-28));
      label.style.left=x+'px';label.style.top=y+'px';
    });
  }
  window.ContentR6={flavor,carry,response,openGathering,showGathering,paintWorld,fitMapLabels};
})();
