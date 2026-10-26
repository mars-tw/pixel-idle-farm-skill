/* Offline observation rounds and one shared-bite invitation. No rewards or clocks are granted. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ContentR16=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const names={merchant:'蘿拉',elder:'班伯',child:'圖圖'};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const replies={merchant:'蘿拉把兩支小匙分開：「這次換我招待你。酸莓配一口麥餅，兩個人吃剛剛好。」',elder:'班伯挪近共享碟：「我把熱麥餅撥小塊，你添一點野莓。留一口，話就能慢慢說。」',child:'圖圖把小匙推向米莉：「米莉，這一口留給你。我們一起吃，盤子裡還有呢。」'};
 function invite(s,id,now){
  const g=s?.adventure?.gathering,hs=g?.servings||[];
  if(!Object.hasOwn(names,id)||!Number.isSafeInteger(now)||now<0||!g?.completed||!hs.some(h=>!h.matched)||!Object.keys(names).every(n=>hs.some(h=>h.matched&&h.id===n)))return {ok:false,message:'先讓三位都吃到，再邀一位朋友分食桌中央那盤。'};
  if(g.invitation)return {ok:false,message:'這個邀請已收進手記，不會再取用點心。'};
  g.invitation={id,at:now,reply:replies[id]};return {ok:true,message:replies[id]};
 }
 function pick(notes,rng=Math.random){const list=notes.filter(n=>n&&n.id);if(!list.length)return null;const r=rng();return Number.isFinite(r)?list[Math.floor(Math.max(0,Math.min(.999999,r))*list.length)]:null;}
 function timing(cast,now,A){const p=A.observeFishingCast(cast,now);if(p?.canReel)return 'perfect';return p?.pose==='missed'||p?.motion==='splash-gone'||now-cast.startedAt>=3000?'late':'early';}
 function practice(s,box,notes,back){
  const A=window.AdventureAPI,n=pick(notes);if(!n)return;
  box.querySelector('.blind-practice')?.remove();
  const q=window.FARM_VERSION_QUERY||'',cast={fishId:n.id,startedAt:Date.now(),observationVersion:2};
  const pane=document.createElement('section');pane.className='note-replay blind-practice';
  pane.innerHTML='<p class="practice-rule">隨機一竿，先認水，再猜魚。看碎環、水花或尾流；浮標沉下再試著提竿。<br>先觀察，結束才揭曉魚種。</p><div class="pond-stage" data-rhythm="'+n.id+'" data-blind="true"><canvas class="pond-effects"></canvas><img class="pond-bobber" src="assets/generated/content-r1/bobber.png'+q+'" alt="紅白浮標"><img class="pond-fisher" src="assets/generated/content-r13/fishing-0.png'+q+'" alt="米莉持竿看水面"></div><p class="practice-cue" role="status"></p><p class="practice-reveal" role="status"></p><p class="practice-ledger">練習竿：不入魚簍（目前 '+Object.values(s.adventure.catch).reduce((a,b)=>a+b,0)+' 尾）・筆記 '+notes.length+' 頁・材料不取用</p><nav class="practice-guesses" hidden><p>剛才是哪種魚？</p>'+notes.map(f=>'<button data-guess="'+f.id+'">'+f.name+'</button>').join('')+'</nav>';
  box.querySelector('.modal-body').prepend(pane);box.dataset.practice='true';box.querySelector('h2').textContent='看水紋猜魚・隨機一竿';
  const footer=box.querySelector('.content-footer');footer.innerHTML='<button class="practice-reel content-primary">試著提竿</button><button class="practice-again content-primary" hidden>再練一竿</button><button class="stop-note-replay content-secondary">回筆記</button>';
  let attempted=false,result=null,frozen=null,ended=false,raf=0,replayAt=0;
  const stage=pane.querySelector('.pond-stage'),cue=pane.querySelector('.practice-cue'),reveal=pane.querySelector('.practice-reveal');
  function finish(r){if(ended)return;ended=true;result=r;pane.dataset.result=r;stage.dataset.result=r;frozen=Date.now();stage.dataset.elapsed=String(frozen-cast.startedAt);
   footer.querySelector('.practice-reel').hidden=true;pane.querySelector('.practice-guesses').hidden=false;
   cue.textContent=window.ContentR17.result(r).time+'。請依剛才的水形選出魚種。';
  }
  footer.querySelector('.practice-reel').onclick=()=>{if(attempted||ended)return;attempted=true;finish(timing(cast,Date.now(),A));};
  footer.querySelector('.stop-note-replay').onclick=()=>{cancelAnimationFrame(raf);back();};
  footer.querySelector('.practice-again').onclick=()=>{cancelAnimationFrame(raf);practice(s,box,notes,back);};
  pane.querySelectorAll('[data-guess]').forEach(b=>b.onclick=()=>{if(!ended||pane.dataset.revealed)return;pane.dataset.revealed='true';pane.dataset.guess=b.dataset.guess;pane.querySelector('.practice-guesses').hidden=true;pane.querySelectorAll('[data-guess]').forEach(e=>{e.disabled=true;e.setAttribute('aria-pressed',String(e===b));});const r=window.ContentR17.result(result,b.dataset.guess===n.id);pane.dataset.success=String(r.success);cue.textContent=r.conclusion;stage.dataset.revealed='true';let fish=stage.querySelector('.practice-fish');if(!fish){fish=document.createElement('img');fish.className='practice-fish';stage.appendChild(fish);}fish.src='assets/generated/content-r13/'+n.id+'-color.png'+q;fish.alt=n.name+'的揭曉魚圖';const shapes={river_carp:'圓環向外擴散，寬尾攪起低處濁水。',silver_dace:'窄水花向上升起，亮水珠落回原處。',river_perch:'尾流斜向一側，浮標跟著橫移。'};reveal.innerHTML='<div class="practice-result-labels"><span>'+r.time+'</span><span>'+r.recognition+'</span></div><p>'+n.name+'：'+shapes[n.id]+'</p><small>魚簍、材料、筆記都沒變。</small><div class="practice-timing" style="--reel-position:'+(result==='early'?'15%':result==='late'?'92%':'50%')+'"></div><div class="practice-timing-label">紅線：本次提竿；綠段：浮標沉下的時機</div><p>你選了'+notes.find(f=>f.id===b.dataset.guess).name+'；水形來自'+n.name+'。</p><button class="practice-replay-water">回看剛才的水形</button>';reveal.querySelector('.practice-replay-water').onclick=()=>{replayAt=Date.now();};footer.querySelector('.practice-again').hidden=false;});
  function draw(){if(!pane.isConnected||box.dataset.practice!=='true'||!box.classList.contains('show'))return;
   const elapsed=ended?frozen-cast.startedAt:Date.now()-cast.startedAt;let phase=A.observeFishingCast(cast,Date.now());
   if(!ended&&(phase.pose==='missed'||phase.motion==='splash-gone'))finish('late');
   if(ended&&result==='late')phase={...phase,canReel:false,pose:'missed',motion:'ended'};
   if(ended&&result==='early')phase={...phase,canReel:false,pose:'missed',motion:'ended'};
   if(ended&&result==='perfect')phase=A.observeFishingCast(cast,frozen);
   stage.dataset.reel=phase.canReel?'active':'wait';stage.dataset.motion=phase.motion;stage.dataset.pose=phase.pose;stage.dataset.phase=String(phase.index);stage.dataset.elapsed=String(elapsed);
   if(!ended)cue.textContent='觀察水形與浮標，再決定何時提竿。';
   stage.dataset.waterReplay=String(!!replayAt);
   if(replayAt){stage.dataset.elapsed=String(Date.now()-replayAt);phase={...phase,canReel:true,pose:'strike'};}
   window.ContentR8.drawWater(stage,phase);raf=requestAnimationFrame(draw);
  }draw();
 }
 function invitation(s,back){
  const g=s.adventure.gathering,old=g.invitation,R=window.ContentR1,q=window.FARM_VERSION_QUERY||'';
  const shared=g.servings.find(h=>!h.matched),food={sour:'酸味野莓',hot:'熱味麥餅',sweet:'甜味胡蘿蔔點心'}[shared.taste];
  const box=R.page('留一口，邀你一起吃','<img class="sharing-bowl" src="assets/generated/content-r10/'+shared.taste+'.png'+q+'" alt="桌中央留下的'+food+'"><p>桌中央留著這盤'+food+'。你想和誰一起分食？<br>只取共享盤，不再拿材料。</p><nav class="invite-choices">'+Object.keys(names).map(id=>'<button data-invite="'+id+'" aria-pressed="false">邀'+names[id]+'</button>').join('')+'</nav><p class="invite-reply" role="status">'+(old?esc(old.reply):'選一位，留一口話慢慢說。')+'</p>','<button id="inviteConfirm" class="content-primary" disabled>先選一位鄰居</button><button id="inviteBack" class="content-secondary">回聚餐手記</button>');
  box.dataset.contentView='sharing-invitation';let selected=old?.id||null;const btn=box.querySelector('#inviteConfirm');
  function select(){box.querySelectorAll('[data-invite]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.invite===selected));b.disabled=!!old;});btn.disabled=!!old||!selected;btn.dataset.complete=String(!!old);btn.textContent=old?'已留一口給'+names[old.id]:selected?'請'+names[selected]+'一起分食':'先選一位鄰居';}select();
  box.querySelectorAll('[data-invite]').forEach(b=>b.onclick=()=>{selected=b.dataset.invite;select();});
  btn.onclick=()=>{const r=invite(s,selected,Date.now());if(!r.ok)return;R.save(s);box.dataset.invited=selected;box.querySelector('.invite-reply').textContent=r.message;box.querySelectorAll('[data-invite]').forEach(b=>b.disabled=true);btn.disabled=true;btn.dataset.complete='true';btn.textContent='已留一口給'+names[selected];};
  box.querySelector('#inviteBack').onclick=back;
 }
 return {invite,pick,timing,practice,invitation,names,replies};
});
