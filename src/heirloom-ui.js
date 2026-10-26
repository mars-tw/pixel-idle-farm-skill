(function () {
  "use strict";
  const H = window.FarmHeirloom, el = (id) => document.getElementById(id), farm = () => window.__farm;
  let signature = "", deliveredAcknowledged = false;
  function step(s) {
    const h = H.status(s), now = Date.now(), sun = window.sunpatchStatus(s, now);
    const plots = s.map.tiles.filter((t) => t.plotIndex != null && t.plotIndex < window.activePlotCount(s) && window.planMoveTo(s,t.id));
    const wheat = plots.filter((t) => s.plots[t.plotIndex].cropId === "wheat");
    const ripe = wheat.find((t) => window.getCropProgress(s,s.plots[t.plotIndex],now).ready);
    if (h.ready) return { kind:"deliver", title:"第一份餐籃，送給誰？", detail:"替葛瑞留兩份小麥。送到門邊，或邀他一起坐下。", label:"裝好餐籃", target:null };
    if (ripe) return { kind:"harvest", title:"把這束陽光收進餐籃", detail:"小麥成熟了。收成後，留下兩份給葛瑞。", label:"走近收成", target:ripe };
    const lit = plots.find((t) => sun.plots.includes(t.plotIndex) && (!s.plots[t.plotIndex].cropId || (s.plots[t.plotIndex].cropId === "wheat" && !window.getCropProgress(s,s.plots[t.plotIndex],now).wet)));
    if (lit && h.sunWheat < 2) return { kind:s.plots[lit.plotIndex].cropId ? "water" : "plant", title:"光落在這裡", detail:`光斑還有 ${Math.ceil(sun.remainingMs/1000)} 秒。在光裡${s.plots[lit.plotIndex].cropId ? "澆水" : "種小麥"}，這株的收穫會記進餐籃。`, label:s.plots[lit.plotIndex].cropId ? "去光裡澆水" : "在光裡播種", target:lit };
    const growing = wheat[0];
    if (growing) {
      const p = s.plots[growing.plotIndex], progress = window.getCropProgress(s,p,now);
      return { kind:"wait", title:p.sunGrown === true ? "陽光已經留在麥穗裡" : "等第一道光落下", detail:p.sunGrown === true ? `再等約 ${Math.ceil(progress.remainingMs/1000)} 秒成熟。光散了，這株仍記得你在光裡的照料。` : `種下後約四秒會出現光斑。看見光，再去澆水；錯過會再來。`, label:"看看這株小麥", target:growing };
    }
    const empty = plots.find((t) => !s.plots[t.plotIndex].cropId);
    return { kind:"plant", title:"先種一株，等光來", detail:h.sunWheat >= 2 ? "陽光收成已記下。倉庫還要留兩份小麥，才裝得成餐籃。" : "種一株小麥，留著水，等光落下再澆。餐籃不用等換日。", label:"種第一株小麥", target:empty };
  }
  function guide(s) {
    H.start(s);
    const q = step(s);
    if (q.kind === "deliver") { window.DailyUI.openHeirloom(); return; }
    if (!q.target) { farm().toast("先收成田裡的作物，騰一格來種小麥。"); return; }
    farm().setTool(q.kind === "water" ? "water" : "hand");
    if (q.kind === "plant") farm().selectSeed("wheat");
    if (q.kind === "wait") { farm().focusTile(q.target.id); farm().toast(q.detail); return; }
    farm().clickTile(q.target.id);
  }
  function renderObjective(s, box) {
    const h = H.status(s);
    if (!h.started) { signature = ""; return false; }
    if (h.delivered && !deliveredAcknowledged) {
      if(signature==='delivered' && box.dataset.quest==='first_sun_basket_delivered')return true;
      signature = "delivered";
      box.dataset.quest = "first_sun_basket_delivered";
      box.innerHTML = '<div class="world-chapter"><span>祖母手記・第一份陽光餐籃</span><span>3/3</span></div><div class="world-objective-title">餐籃送到了</div><div class="world-objective-detail">兩份小麥，換來一張留給你的椅子。</div><div class="world-objective-bottom"><span>回應已夾進手記</span><button type="button" data-world-go>繼續農場故事</button></div>';
      box.querySelector('button').onclick = () => { deliveredAcknowledged=true;signature='';window.FarmWorld.renderObjective(s); };
      return true;
    }
    if(h.delivered){signature='';return false;}
    const q = step(s), sig = JSON.stringify([q.kind,q.target && q.target.id,h.sunWheat,h.wheat]);
    if (sig !== signature || box.dataset.quest !== "first_sun_basket") {
      signature = sig;
      box.dataset.quest = "first_sun_basket"; box.dataset.targetId = q.target ? q.target.id : "";
      box.innerHTML = `<div class="world-chapter"><span>祖母手記・第一份陽光餐籃</span><span>${h.sunWheat >= 2 ? "2" : "1"}/3</span></div><div class="world-objective-title"></div><div class="world-objective-detail"></div><div class="world-objective-bottom"><span>光裡照料 → 收成 → 分享</span><button type="button" data-world-go></button></div>`;
      box.querySelector("button").onclick = () => guide(s);
    }
    box.querySelector(".world-objective-title").textContent = q.title;
    box.querySelector(".world-objective-detail").textContent = q.detail;
    box.querySelector("button").textContent = q.label;
    return true;
  }
  function renderPage(s, body) {
    const h = H.status(s);
    if (h.delivered) {
      body.innerHTML = `<article class="heirloom-paper"><span class="daily-kicker">第一份陽光餐籃・已送達</span><h3>${h.note.title}</h3><p>${h.note.text}</p><p class="heirloom-reply">葛瑞：「${h.note.reply}」</p><p class="heirloom-caption">這一頁留在日誌裡。今日農務的印章，還會帶來兩頁手記。</p></article>`;
      const source = `assets/generated/${h.choice==='table'?'r89':'r88'}/${h.choice}-result-512.webp`;
      const reply=body.querySelector('.heirloom-reply');
      const face=document.createElement('img');face.src='assets/generated/r89/grey-2.png'+(window.FARM_VERSION_QUERY || '');face.alt='葛瑞笑著留一張椅子';face.width=64;face.height=64;face.className='reply-portrait';reply.prepend(face);
      if (typeof source === "string" && /^assets\/(heirloom|generated)\/[a-z0-9_/-]+\.(png|webp)$/.test(source)) {
        const img = document.createElement("img"); img.className = "heirloom-illustration"; img.alt = h.note.title;
        img.onerror = () => img.remove(); img.src = source + (window.FARM_VERSION_QUERY || ""); body.querySelector("article").prepend(img);
      }
      const detail=document.createElement('figure');detail.className='story-detail';
      const detailImage=document.createElement('img');detailImage.src=(h.choice==='table'?'assets/generated/r89/chair-detail-256.webp':H.illustrations[h.choice])+(window.FARM_VERSION_QUERY||'');
      detailImage.alt=h.choice==='table'?'茶桌旁多留一張椅子':'留在葛瑞門邊的紅格餐籃';
      const caption=document.createElement('figcaption');caption.textContent=h.choice==='table'?'座位圖・一起坐下':'門邊的餐籃';
      detail.append(detailImage,caption);body.querySelector('article').append(detail);
      return;
    }
    body.innerHTML = `<article class="heirloom-paper"><span class="daily-kicker">祖母的第一張餐籃便箋</span><h3>先留一籃，再去賣</h3><p>在光裡種小麥或澆水，再收成這一株。從倉庫留兩份，走到葛瑞身邊，選一種送法。</p><p class="daily-progress">陽光照料後收成 ${h.sunWheat}/2 份・倉庫 ${Math.min(h.wheat,2)}/2 份</p><div class="heirloom-choices">${h.ready ? '<button id="heirloomDoorstep" type="button">留在門邊</button><button id="heirloomTable" type="button">一起坐下</button>' : '<button id="heirloomGuide" type="button">回田裡找陽光</button>'}</div><p class="heirloom-caption">交付取走兩份小麥。手記永久保留，不用連續登入。</p></article>`;
    if (el("heirloomGuide")) el("heirloomGuide").onclick = () => { H.start(s); farm().closeModal("dailyModal"); farm().safeSaveNow(); farm().refresh(); guide(s); };
    const illustration = document.createElement("img");
    illustration.className = "heirloom-illustration"; illustration.src = "assets/generated/r88/basket-512.webp" + (window.FARM_VERSION_QUERY || '');
    illustration.alt = "把麥穗留進紅格餐布的餐籃"; illustration.width = 384; illustration.height = 192;
    body.querySelector("article").prepend(illustration);
    const progress=body.querySelector('.daily-progress');
    progress.classList.add('wheat-progress');progress.setAttribute('aria-label',`陽光收成 ${h.sunWheat}／2、倉庫 ${Math.min(h.wheat,2)}／2`);
    progress.innerHTML=`<span>留給葛瑞<span class="wheat-slots"><span class="wheat-slot ${h.wheat>=2?'filled':'empty'}"><img src="assets/generated/r88/wheat-32.png${window.FARM_VERSION_QUERY || ''}" width="40" height="40" alt="庫存小麥"><strong>×${Math.min(h.wheat,2)}</strong></span></span></span><small>需要 ×2<br>光裡收成 ${Math.min(2,h.sunWheat)}／2</small>`;
    for (const [id,source,alt] of [["heirloomDoorstep",H.illustrations.doorstep,"一籃麥穗留在門邊"],["heirloomTable",H.illustrations.table,"兩張椅子、兩杯茶，等你一起坐下"]]) {
      const button = el(id); if (!button) continue;
      const img = document.createElement("img"); img.className = "heirloom-choice-image"; img.src = source + (window.FARM_VERSION_QUERY || ""); img.alt = alt; img.width = 192; img.height = 96;
      button.prepend(img);
      const consequence=document.createElement('small');consequence.className='heirloom-choice-consequence';
      consequence.textContent=id==='heirloomDoorstep'?'留下餐籃，收到門邊的謝意':'坐下喝茶，留下一張空椅子';button.append(consequence);
    }
    for (const id of ['heirloomDoorstep','heirloomTable']) if(el(id)) {
      el(id).setAttribute('aria-pressed','false');
      const hint=document.createElement('span');hint.className='choice-confirmation';hint.textContent='點選送法';el(id).append(hint);
    }
    let selectedChoice=null, deliveryStarted=false;
    const confirm=document.createElement('button');confirm.id='heirloomConfirm';confirm.type='button';confirm.className='heirloom-confirm';confirm.disabled=true;confirm.textContent='先選一種送法';
    if(h.ready)el('dailyFooter').before(confirm);
    for (const [id,choice] of [["heirloomDoorstep","doorstep"],["heirloomTable","table"]]) if (el(id)) el(id).onclick = () => {
      if(deliveryStarted)return;
      selectedChoice=choice;
        for(const buttonId of ['heirloomDoorstep','heirloomTable']){
          const button=el(buttonId),selected=buttonId===id;
          button.setAttribute('aria-pressed',String(selected));
          button.querySelector('.choice-confirmation').textContent=selected?'已選・按下方按鈕交付':'點選送法';
        }
      confirm.disabled=false;confirm.textContent='交付小麥 ×2 給葛瑞';
    };
    confirm.onclick = () => {
      if(deliveryStarted || !selectedChoice)return;
      const choice=selectedChoice;
      deliveryStarted=true;
      confirm.disabled=true;confirm.textContent='送籃中';
      const tile = s.map.tiles.find((t) => t.npc === "mayor");
      farm().closeModal("dailyModal");
      const moving = tile && farm().travelAndDo(tile.id,"use",() => {
        const r = H.deliver(s,choice,Date.now());
        farm().toast(r.ok ? "小麥餐籃送到了。祖母的便箋，夾在籃底。" : "先留兩份小麥，才能送出這籃。");
        farm().safeSaveNow(); farm().refresh(); window.DailyUI.openHeirloom();
      });
      if (!moving) { deliveryStarted=false;confirm.disabled=false;confirm.textContent='交付小麥 ×2 給葛瑞';farm().toast("先回到田邊，再走去找葛瑞。"); }
    };
  }
  window.HeirloomUI = { guide, step, renderObjective, renderPage };
})();
