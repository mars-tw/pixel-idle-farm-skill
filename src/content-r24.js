/* R24: rotating two-resident meal orders with persisted partial fulfillment. */
(function(){
 'use strict';const A=window.AdventureAPI,R=window.ContentR1;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rewardText=r=>[r.coins?`${r.coins} 金幣`:'',r.xp?`${r.xp} 經驗`:'',...Object.entries(r.materials||{}).map(([id,n])=>`${n} 份${id==='wood'?'木材':id}`)].filter(Boolean).join('、')||'共同回話';
 const token=()=>globalThis.crypto?.randomUUID?.()||`meal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 function history(model){return model.records.map((r,i)=>`<article><strong>${i+1}．${esc(r.response)}</strong><small>${r.completionMode==='once'?'一次配好':'補餐後完成'}・${new Date(r.at).toLocaleString('zh-TW')}</small></article>`).join('')||'<p>還沒有完成的雙人訂單。</p>';}
 function showResult(state,result,order,pairing){
  const served=result.newlyFulfilled.map(id=>order.guests.find(g=>g.id===id)?.name||id),missing=order.guests.filter(g=>!result.fulfilled.includes(g.id)).map(g=>g.name),used=result.consumed.map(n=>`${n.name} ${n.required} 份`).join('、');
  const heading=result.completed?'這桌招待完成':'這次先送到一份',nextLabel=result.completed?(result.nextOrderId?'下一桌':'看完成手記'):'繼續這桌';
  const body=`<p class="shared-meal-progress" role="status">${esc(heading)}</p><article class="shared-meal-result-card"><h3>${esc(pairing.name)}</h3><p><strong>這次送給：</strong>${esc(served.join('、'))}</p><p><strong>餐籃用了：</strong>${esc(used)}</p>${missing.length?`<p><strong>還在等：</strong>${esc(missing.join('、'))}</p>`:`<p>${esc(order.response)}</p>`}${result.rewardGranted?`<p><strong>收到：</strong>${esc(rewardText(result.reward))}</p>`:''}</article>`;
  const box=R.page(heading,body,`<button id="sharedMealResultNext" class="content-primary">${nextLabel}</button><button id="sharedMealFarm" class="content-secondary">回農場</button>`);box.dataset.contentView='shared-meal-result';box.querySelector('#sharedMealResultNext').onclick=()=>open(state);box.querySelector('#sharedMealFarm').onclick=()=>R.close();return box;
 }
 function open(state,selectedId,interactionToken){
  const model=A.sharedMealChoices(state,Date.now()),stableToken=interactionToken||token();
  if(model.complete){const box=R.page('雙人共餐手記・完成',`<p class="shared-meal-progress">3／3 張訂單完成</p><section class="shared-meal-history">${history(model)}</section>`,`<button id="sharedMealBack" class="content-secondary">聚餐手記</button><button id="sharedMealFarm" class="content-secondary">回農場</button>`);wireBack(box,state);return box;}
  const order=model.order,selected=model.pairings.find(p=>p.id===selectedId)||model.pairings[0];
  const guests=order.guests.map(g=>`<span class="shared-guest" data-fulfilled="${g.fulfilled}"><strong>${g.fulfilled?'✓ ':''}${esc(g.name)}</strong>・${esc(g.flavor)}味<small>${g.fulfilled?'本單已完成':'還在等'}</small></span>`).join('');
  const tabs=model.pairings.map(p=>`<button type="button" data-pairing-tab="${p.id}" aria-pressed="${p.id===selected.id}">${esc(p.name)}</button>`).join('');
  const result=selected.newlyFulfilled.length?`這次會送到：${selected.newlyFulfilled.map(id=>order.guests.find(g=>g.id===id).name).join('、')}`:'這兩份都已有人吃到，請換一組。';
  const card=`<article class="shared-meal-card" data-shared-pairing="${selected.id}" data-progress="${selected.newlyFulfilled.length}"><h3>${esc(selected.name)}</h3><p>${esc(selected.description)}</p><ul>${selected.requirements.map(n=>`<li data-complete="${n.complete}">${esc(n.name)} ${n.current}／${n.required}</li>`).join('')}</ul><p class="shared-result">${esc(result)}</p></article>`;
  const box=R.page(`雙人共餐 ${model.currentIndex+1}／${model.total}`,`<p class="shared-meal-progress" role="status">${esc(order.name)}・完成後得到 ${esc(rewardText(order.reward))}</p><section class="shared-guests">${guests}</section><nav class="shared-pairing-tabs" aria-label="雙口味搭配">${tabs}</nav>${card}<details class="shared-meal-history"><summary>已完成訂單（${model.records.length}）</summary>${history(model)}</details>`,`<button id="sharePairing" class="content-primary" ${selected.canShare?'':'disabled'}>${selected.canShare?'交這組餐點':'先換一組或備料'}</button><button id="sharedMealBack" class="content-secondary">聚餐手記</button><button id="sharedMealFarm" class="content-secondary">回農場</button>`);
  box.dataset.contentView='shared-meals';box.querySelectorAll('[data-pairing-tab]').forEach(b=>b.onclick=()=>open(state,b.dataset.pairingTab,stableToken));let busy=false;const submit=box.querySelector('#sharePairing');submit.onclick=()=>{if(busy)return;busy=true;box.querySelectorAll('.content-footer button,[data-pairing-tab]').forEach(b=>b.disabled=true);const r=A.shareMeal(state,selected.id,order.id,stableToken,Date.now());if(!r.ok){window.__farm.toast(r.message);if(!['duplicate_commit','stale_order'].includes(r.reason))open(state,selected.id,stableToken);return;}R.save(state);showResult(state,r,order,selected);};wireBack(box,state);return box;
 }
 function wireBack(box,state){box.dataset.contentView='shared-meals';box.querySelector('#sharedMealBack').onclick=()=>window.ContentR6.openGathering(state);box.querySelector('#sharedMealFarm').onclick=()=>R.close();}
 window.ContentR24={open};
})();
