(function () {
  "use strict";
  const H = window.FarmHeirloom, A = window.AdventureAPI, el = (id) => document.getElementById(id), farm = () => window.__farm;
  let signature = "";
  function step(s) {
    return A && A.nextGuidance ? A.nextGuidance(s, Date.now()) : null;
  }
  function setGuidance(node, full, short) {
    if (!node) return;
    node.replaceChildren();
    const longCopy = document.createElement("span"), shortCopy = document.createElement("span");
    longCopy.className = "r82a-guidance-full"; longCopy.textContent = full;
    shortCopy.className = "r82a-guidance-short"; shortCopy.textContent = short;
    node.append(longCopy, shortCopy); node.title = full;
  }
  function guide(s) {
    H.start(s);
    const q = step(s);
    if (q.kind === "deliver") { window.DailyUI.openHeirloom(); return; }
    if (q.kind === "refract") {
      const r = window.FarmSunplay.refract(s, q.target.plotIndex, Date.now());
      farm().focusTile(q.target.id);
      farm().toast(r.ok ? "光折過來了。之後先點一格田，再按「把光折到這裡」，光照哪一格由你決定。" : q.detail);
      if (r.ok) { farm().safeSaveNow(); signature = ""; farm().refresh(); if (window.FarmSunplay.playBeam) window.FarmSunplay.playBeam(s, r.from, r.to); } /* 重畫地圖之後才放光束，免得被清掉 */
      return;
    }
    if (!q.target) { farm().toast("先收成田裡的作物，騰一格來種小麥。"); return; }
    farm().setTool(q.kind === "water" ? "water" : "hand");
    if (q.kind === "plant") farm().selectSeed("wheat");
    if (q.kind === "wait") { farm().focusTile(q.target.id); farm().toast(q.detail); return; }
    farm().clickTile(q.target.id);
  }
  function renderObjective(s, box) {
    const h = H.status(s);
    if (!h.started) { signature = ""; return false; }
    if(h.delivered){signature='';return false;}
    const q = step(s), sig = JSON.stringify([q.kind,q.target && q.target.id,q.text,q.short,h.sunWheat,h.wheat]);
    if (sig !== signature || box.dataset.quest !== "first_sun_basket") {
      signature = sig;
      box.dataset.quest = "first_sun_basket"; box.dataset.targetId = q.target ? q.target.id : "";
      box.dataset.stepType = q.kind; if (document.body) document.body.dataset.questStep = q.kind;
      box.innerHTML = `<div class="world-chapter"><span>祖母手記・第一份陽光餐籃</span><span>${h.sunWheat >= 2 ? "2" : "1"}/3</span></div><div class="world-objective-title"></div><div class="world-objective-detail"></div><div class="world-objective-bottom"><span>光裡照料 → 收成 → 分享</span><button type="button" data-world-go></button></div>`;
      box.querySelector("button").onclick = () => guide(s);
    }
    box.querySelector(".world-objective-title").textContent = q.title;
    setGuidance(box.querySelector(".world-objective-detail"), q.detail, q.short);
    box.querySelector("button").textContent = q.label;
    return true;
  }
  function renderPage(s, body) {
    const h = H.status(s);
    const guidance = A && A.nextGuidance ? A.nextGuidance(s, Date.now()) : null;
    const guidanceHtml = guidance ? `<section class="r82a-grandma-guidance" data-r82a-grandma-guidance><b>現在做</b><p>${guidance.text}</p></section>` : "";
    if (h.delivered) {
      body.innerHTML = guidanceHtml + `<article class="heirloom-paper"><span class="daily-kicker">第一份陽光餐籃・已送達</span><h3>${h.note.title}</h3><p>${h.note.text}</p><p class="heirloom-reply">葛瑞：「${h.note.reply}」</p><p class="heirloom-caption">這一頁留在日誌裡。今日農務的印章，還會帶來兩頁手記。</p></article>`;
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
      /* R81C 第 1 項：送完餐籃，這一頁接著記下籃底那包藍布舊麥種後來怎麼了。 */
      const S = window.StoryR76, stage = S && S.r81Stage ? S.r81Stage(s) : "";
      if (stage) { const m = document.createElement("p"); m.className = "r81c-mystery"; m.dataset.r81cMystery = stage; m.textContent = stage === "done" ? S.r81Summary(s) : stage === "conflict" ? "籃底那包藍布舊麥種滾了出來，葛瑞的臉色一下子變了。" : s.r81story.choice === "plant" ? "藍布舊麥種照班伯說的種回田裡了，故事還沒說完。" : "藍布舊麥種交給葛瑞封存了，故事還沒說完。"; reply.after(m); }
      return;
    }
    body.innerHTML = guidanceHtml + `<article class="heirloom-paper"><span class="daily-kicker">祖母的第一張餐籃便箋</span><h3>先留一籃，再去賣</h3><p>在光裡種小麥或澆水，再收成這一株。從倉庫留兩份，走到葛瑞身邊，選一種送法。</p><p class="daily-progress">陽光照料後收成 ${h.sunWheat}/2 份・倉庫 ${Math.min(h.wheat,2)}/2 份</p><div class="heirloom-choices">${h.ready ? '<button id="heirloomDoorstep" type="button">留在門邊</button><button id="heirloomTable" type="button">一起坐下</button>' : '<button id="heirloomGuide" type="button">回田裡找陽光</button>'}</div><p class="heirloom-caption">交付取走兩份小麥。手記永久保留，不用連續登入。</p></article>`;
    /* R81C 第 1 項：便箋留下的謎，跟開場那張便箋同一句；餐籃送到鎮長葛瑞手上時揭開。 */
    const mysteryText = window.StoryR76 && window.StoryR76.R81_MYSTERY;
    if (mysteryText) { const m = document.createElement("p"); m.className = "r81c-mystery"; m.dataset.r81cMystery = ""; m.textContent = mysteryText; const prog = body.querySelector(".daily-progress"); if (prog) prog.before(m); }
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
