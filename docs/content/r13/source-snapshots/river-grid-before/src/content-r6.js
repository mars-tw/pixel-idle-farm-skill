/* R6: actual handover frames, resident keepsakes and the shared afternoon. Offline only. */
(function () {
  'use strict';
  const A=window.AdventureAPI, R=window.ContentR1, farm=()=>window.__farm;
  const art=name=>`assets/generated/content-r6/${name}${window.FARM_VERSION_QUERY||''}`;
  const names={merchant:'蘿拉',elder:'班伯',child:'圖圖'};
  let route=null;
  const newArt=name=>`assets/generated/content-r9/${name}${window.FARM_VERSION_QUERY||''}`;
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
    const stop=()=>{cancelAnimationFrame(raf);timers.forEach(clearTimeout);document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',redirect,true);document.removeEventListener('click',redirect,true);bar.remove();document.body.removeAttribute('data-delivering');document.body.removeAttribute('data-handover');document.querySelectorAll('.handover-actor,.handover-player,.handover-parcel,.carry-target,.carry-label').forEach(e=>e.remove());route=null;};
    const cancel=()=>{if(impact)return;cancelled=true;farm().cancelJourney();stop();const p=document.createElement('p');p.className='basket-cancelled';p.textContent=`已取消送餐・農家麥餅 ${s.adventure.meals.rustic_bread} 份全數保留，配料也沒取用。`;document.body.appendChild(p);setTimeout(()=>p.remove(),6000);};
    const key=e=>{if(/^(Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|w|a|s|d)$/i.test(e.key)){if(impact){e.preventDefault();e.stopImmediatePropagation();}else cancel();}};
    const redirect=e=>{if(impact||(!bar.contains(e.target)&&performance.now()-began<350)){e.preventDefault();e.stopImmediatePropagation();return;}if(e.type==='pointerdown'&&!bar.contains(e.target)&&e.target.closest('#mapScene,.dpad'))cancel();};
    document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',redirect,true);document.addEventListener('click',redirect,true);bar.querySelector('button').onclick=cancel;
    document.body.dataset.delivering=n.id;
    const marker=document.createElement('img');marker.className='carry-target';marker.src='assets/generated/r89/note-32.png'+(window.FARM_VERSION_QUERY||'');marker.alt=n.name+'在這裡';marker.width=44;marker.height=44;document.body.appendChild(marker);const markLabel=document.createElement('span');markLabel.className='carry-label';markLabel.textContent=n.name;document.body.appendChild(markLabel);
    const actor=document.createElement('img');actor.className='handover-actor';actor.alt=n.name+'伸手準備接籃';actor.dataset.pose='reach';
    const giver=document.createElement('img');giver.className='handover-player';giver.alt='米莉把唯一的餐籃送向鄰居';giver.src=newArt('hold-player.png');
    const parcel=document.createElement('img');parcel.className='handover-parcel';parcel.src='assets/generated/content-r11/basket.png'+(window.FARM_VERSION_QUERY||'');parcel.alt='正在交到雙手之間的餐籃';
    function position() {
      if(cancelled)return;
      const npc=document.querySelector(`.ob[data-kind="npc"][data-npc="${n.id}"]`),player=document.querySelector('#player'),scene=document.querySelector('#mapScene');
      if(npc&&player&&scene){const nr=npc.getBoundingClientRect(),pr=player.getBoundingClientRect(),sr=scene.getBoundingClientRect(),dx=nr.x-pr.x,dy=nr.y-pr.y;
        const dist=Math.max(0,Math.abs(tile.x-s.player.x)+Math.abs(tile.y-s.player.y)-1);bar.querySelector('.carry-distance').textContent=impact?'已接到手上':dist?'約 '+dist+' 步':'就在眼前';
        const arrow=bar.querySelector('.carry-direction'),x=Math.max(22,Math.min(innerWidth-34,nr.x+nr.width/2)),y=Math.max(sr.top+80,Math.min(sr.bottom-150,nr.y));
        arrow.style.cssText=`left:${x}px;top:${y}px;rotate:${Math.atan2(dy,dx)}rad`;
        marker.style.cssText=`left:${x-4}px;top:${y-42}px`;markLabel.style.cssText=`left:${x-7}px;top:${y-62}px`;markLabel.hidden=dist<=1;
        marker.hidden=dist<=1;
        if(bar.dataset.phase!=='walking'){
          const zoom=Math.min(1.65,(innerWidth-32)/190),width=64*zoom,height=86*zoom,left=Math.max(16,Math.min(innerWidth-190*zoom,pr.x)),top=Math.max(sr.top+90,Math.min(sr.bottom-height-90,pr.bottom-height-70));
          giver.style.cssText=`left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
          actor.style.cssText=`left:${left+84*zoom}px;top:${top}px;width:${width}px;height:${height}px`;const received={merchant:88,elder:106,child:94}[n.id];const offset={arrived:28,reach:52,contact:received,reply:received}[bar.dataset.phase]||28;parcel.style.cssText=`left:${left+offset*zoom}px;top:${top+(bar.dataset.phase==='contact'||bar.dataset.phase==='reply'?{merchant:33,elder:45,child:28}[n.id]:33)*zoom}px;width:${40*zoom}px;height:${40*zoom}px`;
        } else {parcel.style.cssText=`left:${pr.left+pr.width*.48}px;top:${pr.top+pr.height*.40}px;width:32px;height:32px`;}
      }
      raf=requestAnimationFrame(position);
    }
    document.body.appendChild(parcel);route={cancel};position();
    const start=tile&&farm().travelAndDo(tile.id,'collect',()=>{
      if(cancelled)return;
      document.body.dataset.handover='true';bar.dataset.phase='arrived';actor.dataset.pose='waiting';actor.src=newArt('idle-'+n.id+'.png');document.body.appendChild(actor);document.body.appendChild(giver);
      timers.push(setTimeout(()=>{if(cancelled)return;bar.dataset.phase='reach';actor.dataset.pose='reach';actor.src=newArt('reach-'+n.id+'.png');giver.src=newArt('reach-player.png');document.body.appendChild(parcel);bar.querySelector('.carry-receipt').textContent=n.name+'伸出雙手，碰到餐籃。';},1200));
      bar.querySelector('.carry-receipt').textContent='你把餐籃捧好，'+n.name+'正要伸手。';
      timers.push(setTimeout(()=>{
        if(cancelled)return;
        const result=A.deliverNeighbor(s,n.id,taste,Date.now());
        if(!result.ok){stop();farm().toast(result.message);done(result);return;}
        impact=true;giver.src=newArt('idle-player.png');giver.alt='米莉張開空手，餐籃已交給鄰居';bar.dataset.phase='contact';actor.dataset.pose='receive';actor.src=newArt((n.id==='elder'?'idle':'hold')+'-'+n.id+'.png');actor.alt=n.name+{merchant:'雙手捧住餐籃',elder:'單手提著籃把',child:'把餐籃抱在胸前'}[n.id];
        bar.querySelector('button').hidden=true;marker.hidden=true;R.save(s);
        const remembered=A.neighbors(s,Date.now()).filter(n=>n.matched).length;
        bar.querySelector('.carry-memory').textContent='已記住 '+remembered+'／3 位鄰居的口味'+(remembered===3?'・三籃備齊後，到聚餐桌一起吃。':'');
        const after=A.basketFlavors(s,Date.now()).find(f=>f.id===taste).requirements;
        bar.querySelector('.carry-receipt').textContent=before.map((r,i)=>`${r.name} ${r.current}→${after[i].current} 份`).join('、')+'・'+n.name+'已接到'+{sour:'酸味',hot:'熱味',sweet:'甜味',plain:'原味'}[taste]+'餐籃';
        timers.push(setTimeout(()=>{bar.dataset.phase='reply';actor.dataset.pose='reply';actor.src=newArt((n.id==='elder'?'idle':'hold')+'-'+n.id+'.png');bar.querySelector('.carry-receipt').textContent=result.firstDelivery?result.neighbor.reply:result.matched?result.neighbor.memory.reply:result.neighbor.memory.wrong;},1200));
        timers.push(setTimeout(()=>{stop();done(result);},2600));
      },2600));
    });
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
  function tableScene(served=[]) {
    const positions={merchant:[110,100],elder:[218,100],child:[195,166]};
    return `<span class="meal-layout"><span class="meal-table" aria-hidden="true"></span><img class="meal-player" src="assets/generated/content-r12/serve-rest.png${window.FARM_VERSION_QUERY||''}" alt="米莉坐在桌邊，準備分點心">${Object.keys(names).map(id=>`<img class="meal-trace meal-trace-${id}" src="assets/generated/content-r10/cup.png${window.FARM_VERSION_QUERY||''}" alt="${names[id]}的茶杯"><img class="meal-person meal-person-${id}" data-seated-resident="${id}" data-fed="${served.some(h=>h.id===id&&h.matched)}" src="${served.some(h=>h.id===id&&h.matched)?newArt('sip-'+id+'.png'):'assets/generated/content-r13/wait-'+id+'.png'+(window.FARM_VERSION_QUERY||'')}" alt="${names[id]}坐在餐桌旁">`).join('')}${served.map(h=>{const xy=h.matched?positions[h.id]:[158,141];return `<img class="serving-plate" data-for="${h.id}" data-matched="${h.matched}" src="assets/generated/content-r10/${h.taste}.png${window.FARM_VERSION_QUERY||''}" style="left:${xy[0]}px;top:${xy[1]}px" alt="${h.matched?names[h.id]+'手邊的點心':'大家分食的共享盤'}">`;}).join('')}</span>`;
  }
  function styleTables(root) {
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
    const box=R.page('今天，四個人一起吃',`<div class="gather-stage" role="img" aria-label="米莉、蘿拉、班伯、圖圖四人圍坐餐桌">${tableScene()}</div><p class="gather-progress" role="status"></p><p class="gather-shared" role="status"></p><div class="gather-status" aria-label="鄰居招待狀態"></div><div class="gather-choices"><nav class="neighbor-tabs">${choices}</nav><div class="serving-foods">${foods}</div><div class="restock-foods"></div></div><div class="gather-supply" role="status"></div><div class="gather-seats"></div>`, '<button id="gatherSip" class="content-primary" disabled>先選一位鄰居與一份點心</button><button id="gatherSkip" class="content-secondary" hidden>略過這次端送</button><button id="gatherContinue" class="content-primary" hidden>繼續，選下一份</button><button id="gatherReview" class="content-secondary">翻聚餐手記</button><button id="gatherBack" class="content-secondary">回農場看聚餐桌</button>');
    box.dataset.contentView='gathering-complete';styleTables(box);
    let selected=null,taste=null,busy=false,timers=[],commit=null;
    const shared=box.querySelector('.gather-shared'),button=box.querySelector('#gatherSip'),next=box.querySelector('#gatherContinue'),skip=box.querySelector('#gatherSkip'),stage=box.querySelector('.gather-stage'),layout=stage.querySelector('.meal-layout');
    const servings=()=>A.gathering(s,Date.now()).servings||[];
    const history=()=>{const hs=servings();box.querySelector('.gather-seats').innerHTML=hs.length?'<details class="serving-history"><summary>翻開今天的上菜紀錄（'+hs.length+'）</summary>'+hs.map((h,i)=>`<p>${i+1}．${h.matched?names[h.id]+'・個別招待':'大家分食・先端給'+names[h.id]}・${flavors[h.taste]}<br>${h.reply}</p>`).join('')+'</details>':'';};
    function refreshPoses(){const hs=servings();layout.querySelectorAll('[data-seated-resident]').forEach(e=>{const fed=hs.some(h=>h.matched&&h.id===e.dataset.seatedResident);e.dataset.fed=String(fed);e.dataset.reactingUntil='0';e.dataset.upperPose=fed?'sip':'wait';e.src=fed?newArt('sip-'+e.dataset.seatedResident+'.png'):'assets/generated/content-r13/wait-'+e.dataset.seatedResident+'.png'+(window.FARM_VERSION_QUERY||'');});}
    function progress(){const hs=servings();box.querySelector('.gather-progress').textContent=`已端 ${hs.length} 份・已招待 ${new Set(hs.filter(h=>h.matched).map(h=>h.id)).size}／3 位`;
      box.querySelector('.gather-status').innerHTML=ids.map(id=>'<span>'+names[id]+(hs.some(h=>h.id===id&&h.matched)?'・已端':'・等待')+'</span>').join('');
      stage.querySelector('.shared-dish-label')?.remove();if(hs.some(h=>!h.matched)){const label=document.createElement('span');label.className='shared-dish-label';label.textContent='大家分食';layout.appendChild(label);}}
    function choose(){
      busy=false;selected=null;taste=null;box.dataset.servingPhase='choose';skip.hidden=true;refreshPoses();
      const hs=servings(),done=new Set(hs.filter(h=>h.matched).map(h=>h.id)).size>=3;
      progress();shared.textContent=done?'三位都接到了。'+(hs.some(h=>!h.matched)?'桌中央還留著大家分食的那份。':'今天三份都送到了本人手邊。'):hs.at(-1)&&!hs.at(-1).matched?'這份大家分食，不算'+names[hs.at(-1).id]+'的那一份。':'選一位鄰居，再選一份點心。';
      box.querySelector('.gather-choices').hidden=false;button.hidden=done;button.disabled=true;button.textContent='先選一位鄰居與一份點心';next.hidden=true;
      box.querySelector('#gatherReview').hidden=false;box.querySelector('#gatherBack').hidden=false;
      box.querySelector('#gatherReview').textContent=done?'收進手記':'翻聚餐手記';box.querySelector('#gatherReview').className=done?'content-primary':'content-secondary';
      box.querySelectorAll('[data-serve-person]').forEach(b=>{const served=hs.some(h=>h.id===b.dataset.servePerson&&h.matched);b.disabled=served;b.setAttribute('aria-pressed','false');b.textContent=names[b.dataset.servePerson]+(served?'・已端':'・還沒招待');});
      const portions=A.gatheringPortions(s,Date.now());
      box.querySelectorAll('[data-serve-taste]').forEach(b=>{const p=portions.find(p=>p.taste===b.dataset.serveTaste);b.disabled=p.finished||p.remaining===0;b.setAttribute('aria-pressed','false');b.querySelector('small').textContent='剩 '+p.remaining+' 份';});
      const restocks=portions.filter(p=>!p.finished&&p.remaining===0);
      box.querySelector('.restock-foods').innerHTML=restocks.map(p=>`<button data-refill="${p.taste}" ${p.canRefill?'':'disabled'}>再備${flavors[p.taste]}一份<small>取用：${p.requirements.map(r=>r.name+' '+r.required+' 份（持有 '+r.current+'）').join('、')}${p.canRefill?'':'・材料不足'}</small></button>`).join('');
      box.querySelectorAll('[data-refill]').forEach(b=>b.onclick=()=>{const r=A.refillGathering(s,b.dataset.refill,Date.now());if(r.ok){R.save(s);choose();box.querySelector('.gather-supply').textContent=r.message;}else farm().toast(r.message);});
      const refills=A.gathering(s,Date.now()).refills||[];box.querySelector('.gather-supply').textContent=refills.length?'補備來源：'+refills.map(r=>flavors[r.taste]+'・'+r.receipt).join('；'):'';
      history();
    }
    function selection(){button.disabled=!(selected&&taste);button.textContent=selected&&taste?'把'+flavors[taste]+'端給'+names[selected]:'再選'+(selected?'一份點心':'一位鄰居');box.querySelectorAll('[data-serve-person]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.servePerson===selected)));box.querySelectorAll('[data-serve-taste]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.serveTaste===taste)));}
    box.querySelectorAll('[data-serve-person]').forEach(b=>b.onclick=()=>{if(busy)return;selected=b.dataset.servePerson;selection();});
    box.querySelectorAll('[data-serve-taste]').forEach(b=>b.onclick=()=>{if(busy)return;taste=b.dataset.serveTaste;selection();});
    const pos={merchant:[110,100],elder:[218,100],child:[195,166]},start=[87,199];
    function plate(h){const e=document.createElement('img');e.className='serving-plate';e.src='assets/generated/content-r10/'+h.taste+'.png'+(window.FARM_VERSION_QUERY||'');e.alt=names[h.id]+'的'+flavors[h.taste];e.dataset.for=h.id;e.dataset.matched=String(h.matched);layout.appendChild(e);return e;}
    function place(e,h){const xy=h.matched?pos[h.id]:[158,141];e.style.left=xy[0]+'px';e.style.top=xy[1]+'px';}
    for(const h of servings()){const e=plate(h);place(e,h);}
    button.onclick=()=>{
      if(busy||!selected||!taste)return;busy=true;
      const id=selected,food=taste,player=layout.querySelector('.meal-player'),resident=layout.querySelector('[data-seated-resident="'+id+'"]');
      const h={id,taste:food,matched:{merchant:'sour',elder:'hot',child:'sweet'}[id]===food},e=plate(h);
      const pose=food==='sour'?'sip':'offer';let committed=false;
      box.dataset.lastServed=id;box.dataset.lastTaste=food;box.dataset.matched=String(h.matched);box.dataset.servingPhase='lift';
      box.querySelector('.gather-choices').hidden=true;button.hidden=true;next.hidden=true;skip.hidden=false;box.querySelector('.gather-seats').hidden=true;
      box.querySelector('#gatherBack').hidden=true;box.querySelector('#gatherReview').hidden=true;
      shared.textContent='米莉端起'+flavors[food]+'。';
      player.src='assets/generated/content-r12/serve-lift.png'+(window.FARM_VERSION_QUERY||'');player.dataset.action='offer';resident.dataset.reactingUntil=String(performance.now()+4500);e.style.left=start[0]+'px';e.style.top=start[1]+'px';
      timers.push(setTimeout(()=>{if(!stage.isConnected||!box.classList.contains('show'))return;box.dataset.servingPhase='carry';shared.textContent='沿著桌面，推向'+names[id]+'手邊。';player.src='assets/generated/content-r12/serve-push.png'+(window.FARM_VERSION_QUERY||'');player.dataset.action='reach';resident.src=newArt('offer-'+id+'.png');resident.dataset.upperPose='offer';e.style.left=(start[0]+(pos[id][0]-start[0])*.52)+'px';e.style.top=(start[1]+(pos[id][1]-start[1])*.52)+'px';},700));
      timers.push(setTimeout(()=>{if(!stage.isConnected||!box.classList.contains('show'))return;e.style.left=pos[id][0]+'px';e.style.top=pos[id][1]+'px';},1550));
      commit=()=>{if(committed||!stage.isConnected||!box.classList.contains('show'))return;committed=true;timers.forEach(clearTimeout);skip.hidden=true;
        const r=A.serveGatheringPortion(s,id,food,Date.now());if(!r.ok){e.remove();farm().toast(r.message);choose();return;}
        R.save(s);box.dataset.servingPhase='received';refreshPoses();resident.src=r.serving.matched?newArt(pose+'-'+id+'.png'):'assets/generated/content-r13/wait-'+id+'.png'+(window.FARM_VERSION_QUERY||'');resident.dataset.upperPose=r.serving.matched?pose:'wait';resident.dataset.reactingUntil=String(performance.now()+1200);player.src='assets/generated/content-r12/serve-rest.png'+(window.FARM_VERSION_QUERY||'');player.dataset.action='sit';place(e,r.serving);
        shared.textContent=names[id]+(r.serving.matched?'接到手邊，嚐了一口。':'把這份放到桌中央，留給大家一起吃。');history();progress();
        setTimeout(()=>{if(!stage.isConnected||!box.classList.contains('show'))return;box.dataset.servingPhase='reply';shared.textContent=r.message+(r.serving.matched?'':' 這份大家分食，不算'+names[id]+'的那一份。');next.hidden=false;next.textContent=new Set(servings().filter(h=>h.matched).map(h=>h.id)).size>=3?'繼續，收好這個下午':'繼續，選下一份';box.querySelector('#gatherBack').hidden=false;box.querySelector('#gatherReview').hidden=false;box.querySelector('.gather-seats').hidden=false;},1000);
      };timers.push(setTimeout(commit,2450));
    };
    skip.onclick=()=>commit?.();next.onclick=()=>{box.querySelector('.gather-seats').hidden=false;choose();};choose();box.querySelector('#gatherReview').onclick=()=>gatheringReview(s);box.querySelector('#gatherBack').onclick=sitInFarm;
  }
  function gatheringReview(s) {
    const g=A.gathering(s,Date.now()),box=R.page('同一個下午・總手記',`<div class="gather-stage" role="img" aria-label="這個下午的四人聚餐">${tableScene(g.servings||[])}</div>`+((g.servings||[]).length?'<section class="serving-journal"><h3>這個下午，點心怎麼分</h3>'+g.servings.map((h,i)=>`<p>${i+1}．${h.matched?'個別招待・':'大家分食・先端給'}${names[h.id]}・${{sour:'酸味野莓',hot:'熱味麥餅',sweet:'甜味胡蘿蔔點心'}[h.taste]}<br>${h.reply}</p>`).join('')+(g.refills||[]).map(r=>'<p class="supply-journal">補備來源：'+r.receipt+'</p>').join('')+'</section>':'')+g.people.map(n=>`<article class="gather-review"><img class="content-illustration" src="assets/generated/${n.id==='child'?'content-r4':'content-r3'}/${n.id}.webp${window.FARM_VERSION_QUERY||''}" alt="${n.token}"><h3>${n.name}・喜歡${n.flavor}味</h3><p>${n.detail}</p></article>`).join(''),'<button id="gatherAgain" class="content-primary">重看共同聚餐</button><button id="gatherBack" class="content-secondary">回農場</button>');
    box.dataset.contentView='gathering-review';styleTables(box);box.querySelector('#gatherAgain').onclick=()=>showGathering(s);box.querySelector('#gatherBack').onclick=sitInFarm;
  }
  function paintWorld(s,size) {
    const world=document.querySelector('#mapWorld');if(!world)return;
    const g=s.adventure?.gathering;
    let creek=world.querySelector('.r13-creek');if(!creek){creek=document.createElement('div');creek.className='r13-creek';creek.setAttribute('aria-hidden','true');world.prepend(creek);}creek.style.cssText=`left:${size*15}px;top:${-size}px;width:${size*3}px;height:${size*14}px`;
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
    if(table){const width=Math.max(size*4.2,340);table.style.cssText=`left:${size*7.5-width/2}px;top:${size*7.5}px;width:${width}px;height:${size*2.2}px;z-index:${Math.round(size*(g.completed?10:7))}`;styleTables(table);}

  }
  window.ContentR6={flavor,carry,response,openGathering,showGathering,paintWorld};
})();
