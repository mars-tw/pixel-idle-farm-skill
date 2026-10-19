"""Apply the bounded R13 implementation; exact replacements fail on source drift."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def replace(p,a,b):
    f=R/p;s=f.read_text(encoding='utf-8');assert a in s,(p,a[:70]);f.write_text(s.replace(a,b),encoding='utf-8')
replace('src/content-r6.js','<span class="carry-distance"></span><button>','<span class="carry-distance"></span><span class="carry-memory"></span><button>')
replace('src/content-r6.js',"bar.querySelector('button').hidden=true;marker.hidden=true;R.save(s);", """bar.querySelector('button').hidden=true;marker.hidden=true;R.save(s);
        const remembered=A.neighbors(s,Date.now()).filter(n=>n.matched).length;
        bar.querySelector('.carry-memory').textContent='已記住 '+remembered+'／3 位鄰居的口味'+(remembered===3?'・三籃備齊後，到聚餐桌一起吃。':'');""")
replace('src/content-r6.js',"const g=A.gathering(s,Date.now());if(!g.unlocked)return;", """const g=A.gathering(s,Date.now());if(!g.unlocked){
      const missing=A.neighbors(s,Date.now()).filter(n=>!n.matched).map(n=>n.name);
      const box=R.page('餐桌先留著', '<p>還沒記住'+missing.join('、')+'的口味。再送一籃、聽聽他們怎麼說。</p>','<button id="gatherMissing" class="content-primary">回去裝餐籃</button>');
      box.dataset.contentView='gathering-locked';box.querySelector('#gatherMissing').onclick=()=>R.openNeighbors(s);return;
    }""")
replace('src/content-r6.js','child:[195,185]','child:[195,166]')
replace('src/content-r6.js','data-seated-resident="${id}" src="${newArt(\'sit-\'+id+\'.png\')}"', 'data-seated-resident="${id}" data-fed="${served.some(h=>h.id===id&&h.matched)}" src="${served.some(h=>h.id===id&&h.matched)?newArt(\'sip-\'+id+\'.png\'):\'assets/generated/content-r13/wait-\'+id+\'.png\'+(window.FARM_VERSION_QUERY||\'\')}"')
f=R/'src/content-r6.js';s=f.read_text(encoding='utf-8');start=s.index('  function showGathering(s) {');end=s.index('  function gatheringReview(s)',start)
s=s[:start]+'''  function showGathering(s) {
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
''' + s[end:]
s=s.replace("if(g?.completed&&!table)","if((g?.completed||Object.values(s.adventure?.neighbors||{}).some(n=>n.matched))&&!table)")
s=s.replace("table.onclick=e=>{e.stopPropagation();showGathering(s);}","table.onclick=e=>{e.stopPropagation();g?.completed?showGathering(s):openGathering(s);}")
s=s.replace("const width=Math.max(size*4.2,340);", "const width=Math.max(size*4.2,340);")
s=s.replace("    const g=s.adventure?.gathering;", """    const g=s.adventure?.gathering;
    let creek=world.querySelector('.r13-creek');if(!creek){creek=document.createElement('div');creek.className='r13-creek';creek.setAttribute('aria-hidden','true');world.prepend(creek);}creek.style.cssText=`left:${size*15}px;top:${-size}px;width:${size*3}px;height:${size*14}px`;""")
s=s.replace("${i+1}．先端給${names[h.id]}・", "${i+1}．${h.matched?'個別招待・':'大家分食・先端給'}${names[h.id]}・")
s=s.replace("+'</section>':'')+g.people.map", "+(g.refills||[]).map(r=>'<p class=\"supply-journal\">補備來源：'+r.receipt+'</p>').join('')+'</section>':'')+g.people.map")
f.write_text(s,encoding='utf-8')
replace('src/content-r8.js',"img.src='assets/generated/content-r10/'+id+'-1.png'","img.src='assets/generated/content-r13/'+id+'-shadow.png'")
replace('src/content-r8.js',"ctx.drawImage(img,34,28,60,52);", "ctx.drawImage(img,25,31,78,68);")
replace('src/content-r8.js',"pixels.data[i+3]*.65", "pixels.data[i+3]*.95")
replace('src/content-r8.js',"if(water?.complete&&water.naturalWidth)ctx.drawImage(water,28,17,76,52);", """if(water?.complete&&water.naturalWidth){
    const xy={wide:[18,12,92,31],peck:[47,1,35,66],wake:[12,15,105,35]}[kind];
    ctx.globalAlpha=.82;ctx.drawImage(water,...xy);ctx.globalAlpha=1;
  }
  const fisher=stage.querySelector('.pond-fisher');if(fisher)fisher.src='assets/generated/content-r13/fishing-'+(phase?.canReel?2:phase&&phase.index>0?1:0)+'.png'+(window.FARM_VERSION_QUERY||'');""")
replace('src/content-r8.js',"art(id+'-2.png')", "'assets/generated/content-r13/'+id+'-color.png'+(window.FARM_VERSION_QUERY||'')")
replace('src/content-r8.js',"const phase=(tick+offset)%6,pose=phase<2?'sip':phase<4?'offer':'sit',src='assets/generated/content-r9/'+pose+'-'+id+'.png'+(window.FARM_VERSION_QUERY||'');", "const phase=(tick+offset)%6,pose=e.dataset.fed!=='true'?'wait':phase<2?'sip':phase<4?'offer':'sit',src='assets/generated/'+(pose==='wait'?'content-r13':'content-r9')+'/'+pose+'-'+id+'.png'+(window.FARM_VERSION_QUERY||'');")
replace('src/content-r8.js',"pose==='sit'?'rest':'sip-or-bite'", "pose==='wait'||pose==='sit'?'rest':'sip-or-bite'")
