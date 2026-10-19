/* Offline neighborhood stories and observable bobber rhythms. No hidden auto-reward. */
(function () {
  "use strict";
  const A = window.AdventureAPI;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const farm = () => window.__farm;
  const art = (name) => `assets/generated/content-r1/${name}${window.FARM_VERSION_QUERY || ""}`;
  const noteArt = (name) => `assets/generated/content-r8/${name.replace('.webp','-3.png')}${window.FARM_VERSION_QUERY || ""}`;
  const storyArt = (name) => `assets/generated/content-r3/${name}.webp${window.FARM_VERSION_QUERY || ""}`;
  const newArt = (name) => `assets/generated/content-r4/${name}.webp${window.FARM_VERSION_QUERY || ""}`;
  const returnArt = (name) => `assets/generated/content-r5/${name}.webp${window.FARM_VERSION_QUERY || ""}`;
  let fishingTimer = 0;
  let pondResize = null;
  let paperResize = null;

  function guardArt(box) {
    box.querySelectorAll("img.content-illustration").forEach((img) => {
      const original = img.getAttribute("src");
      const label = document.createElement("div"); label.className = "art-load-status";
      label.innerHTML = `<img class="art-placeholder" src="assets/generated/r89/note-32.png${window.FARM_VERSION_QUERY || ''}" alt="紅格裝訂的農場手記" width="64" height="64"><p role="status">插圖載入中…</p><button class="retry-art" hidden>重試插圖</button>`;
      img.after(label);
      const text = label.querySelector("p"), retry = label.querySelector("button");
      const loaded = () => { if (!img.naturalWidth) return failed(); img.dataset.artState = "loaded"; img.hidden = false; label.hidden = true; };
      const failed = () => { img.dataset.artState = "failed"; img.hidden = true; label.hidden = false; text.setAttribute("role", "alert"); text.textContent = "插圖讀不到，先看文字筆記"; retry.hidden = false; retry.disabled = false; };
      retry.onclick = () => { retry.disabled = true; text.setAttribute("role", "status"); text.textContent = "正在重試插圖，文字筆記仍可閱讀。"; img.src = original + (original.includes('?') ? '&' : '?') + 'retry=' + Date.now(); };
      img.onload = loaded; img.onerror = failed;
      if (img.complete) { if (img.naturalWidth) loaded(); else failed(); }
    });
  }
  async function verifyArtwork(box = document.querySelector("#worldModal")) {
    for (const img of box.querySelectorAll("img.content-illustration")) {
      try { await img.decode(); } catch (_) { throw new Error(`插圖載入失敗：${img.getAttribute("src")}`); }
      const r = img.getBoundingClientRect();
      if (!img.naturalWidth || r.width < 100 || r.height < 40 || getComputedStyle(img).visibility === "hidden") throw new Error(`插圖空白：${img.getAttribute("src")}`);
    }
    if (box.querySelector('[data-art-state="failed"]')) throw new Error("插圖守門失敗");
    return true;
  }

  function page(title, body, footer) {
    if (paperResize) paperResize.disconnect();
    const box = window.FarmWorld.contentModal(title, body);
    box.classList.add("content-r1");
    const bar = document.createElement("div");
    bar.className = "content-footer"; bar.innerHTML = footer;
    box.querySelector(".modal-card").appendChild(bar);
    const paper = box.querySelector('.modal-body');
    const hint = document.createElement('p'); hint.className = 'content-scroll-hint';
    bar.before(hint);
    const scrollHint = () => {
      const overflow = paper.scrollHeight > paper.clientHeight + 2;
      hint.hidden = !overflow;
      hint.textContent = paper.scrollTop + paper.clientHeight >= paper.scrollHeight - 3 ? '已讀到這一頁底部' : '往下滑，還有文字可以讀';
    };
    paper.addEventListener('scroll', scrollHint, {passive:true});
    paperResize = new ResizeObserver(scrollHint); paperResize.observe(paper);
    guardArt(box);
    requestAnimationFrame(scrollHint);
    return box;
  }
  function save(s) {
    window.FarmWorld.refresh(s);
    const result = farm().safeSaveNow();
    if (result && result.ok === false) farm().toast("這次還沒存好。請先留在農場，確認裝置有儲存空間。");
  }
  function close() { stopFishing(); if (paperResize) paperResize.disconnect(); farm().closeModal("worldModal"); }
  function openNeighbors(s, id = "merchant", selectedTaste = "plain") {
    document.querySelectorAll('body > .basket-cancelled').forEach(e => e.remove());
    const people = A.neighbors(s, Date.now()), n = people.find((p) => p.id === id) || people[0];
    const flavors = A.basketFlavors(s, Date.now());
    let taste = selectedTaste, busy = false;
    const box = page(`${n.name}的餐籃`, `
      <div class="neighbor-tabs" role="group" aria-label="餐籃收件人">${people.map((p) => `<button data-neighbor="${p.id}" aria-pressed="${p.id === n.id}">${p.name}</button>`).join("")}</div>
      <div class="taste-options" role="group" aria-label="搭配口味">${flavors.map((f) => `<button data-taste="${f.id}" aria-pressed="${f.id === taste}">${f.name}</button>`).join("")}</div>
      <img class="content-illustration" src="${newArt('basket')}" alt="灶邊工作桌上，麥餅裝進紅格藤籃，準備帶去拜訪" width="512" height="256">
      <p class="neighbor-hint" id="basketVisitState">${n.deliveries ? `已送到 ${n.deliveries} 籃，短篇已留下。今天想帶哪一味？想想上回坐在一起時說的話。` : "還沒送過餐籃。帶一份麥餅去坐坐，送到後才會留下短篇與回話。"}</p>
      <p id="basketDescription"></p><p id="basketCost"></p>
      ${!n.unlocked ? '<p class="basket-lock">先跟班伯學做農家麥餅，餐籃就能裝起來了。</p>' : ""}`,
      `<button id="sendNeighbor" class="content-primary"></button><button id="basketKitchen" class="content-secondary">回灶台</button>${n.deliveries ? '<button class="content-secondary" id="readNeighbor">重讀短篇</button><button class="content-secondary" id="recallNeighbor">翻手記回想</button>' : ''}`);
    box.dataset.resident = n.id;
    box.dataset.contentView = "basket";
    box.querySelector('.content-footer').classList.add('basket-footer');
    const selection = document.createElement('p'); selection.id='basketSelection'; box.querySelector('.content-footer').prepend(selection);
    function select() {
      const f = flavors.find((v) => v.id === taste);
      box.querySelectorAll("[data-taste]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.taste === taste)));
      box.querySelector("#basketDescription").textContent = f.description;
      box.querySelector("#basketCost").textContent = f.requirements.map((r) => `持有${r.name} ${r.current} 份，本次需要 ${r.required} 份`).join("；");
      selection.textContent = `送給${n.name}・${f.name}${f.name==='原味'?'':'味'}｜`+f.requirements.map(r=>`${r.name}剩 ${Math.max(0,r.current-r.required)} 份`).join('、');
      if(window.ContentR6)window.ContentR6.flavor(box,taste);
      const b = box.querySelector("#sendNeighbor");
      b.textContent = f.canSend ? `送一份${f.name}餐籃給${n.name}` : "餐籃食材還沒齊";
      b.disabled = !f.canSend || busy;
    }
    box.querySelectorAll("[data-neighbor]").forEach((b) => { b.onclick = () => openNeighbors(s, b.dataset.neighbor, taste); });
    box.querySelectorAll("[data-taste]").forEach((b) => { b.onclick = () => { taste = b.dataset.taste; select(); }; });
    box.querySelector("#basketKitchen").onclick = () => window.FarmWorld.openKitchen();
    if (n.deliveries) box.querySelector("#readNeighbor").onclick = () => openResponse(s, n.id);
    if (n.deliveries) box.querySelector("#recallNeighbor").onclick = () => openRecall(s, n, taste);
    box.querySelector("#sendNeighbor").onclick = () => {
      if (busy) return;
      busy = true; select();
      const tile = s.map.tiles.find((t) => t.npc === n.id);
      close();
      if(window.ContentR6) { window.ContentR6.carry(s,n,taste,result=>result.ok?openResponse(s,n.id,result):openNeighbors(s,n.id)); return; }
      // Keep a second tap off the map while the basket is carried to its recipient.
      const carrying = document.createElement("div"); carrying.className = "basket-carrying";
      carrying.innerHTML = `<div role="status">把餐籃送給${esc(n.name)}…<small>農家麥餅 ${s.adventure.meals.rustic_bread} 份，送到手上才取用。</small><button>先不送了</button></div>`;
      document.body.appendChild(carrying);
      let cancelled = false;
      const cleanup = () => { carrying.remove(); document.removeEventListener("keydown", onMove, true); };
      const cancel = () => { cancelled = true; cleanup(); const notice = document.createElement('p'); notice.className = 'basket-cancelled'; notice.setAttribute('role', 'status'); notice.textContent = `已取消送餐・農家麥餅 ${s.adventure.meals.rustic_bread} 份全數保留，配料也沒取用。`; document.body.appendChild(notice); setTimeout(() => notice.remove(), 6000); };
      const onMove = (e) => { if (/^(Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|w|a|s|d)$/i.test(e.key)) cancel(); };
      document.addEventListener("keydown", onMove, true);
      carrying.querySelector("button").onclick = cancel;
      const started = tile && farm().travelAndDo(tile.id, "collect", () => {
        cleanup(); if (cancelled) return;
        const result = A.deliverNeighbor(s, n.id, taste, Date.now());
        if (result.ok) { save(s); openResponse(s, n.id, result); }
        else { farm().toast(result.message); openNeighbors(s, n.id); }
      });
      if (!started) { cleanup(); busy = false; farm().toast("路還沒走通，先看看鄰居在哪裡。"); openNeighbors(s, n.id); }
    };
    select();
  }
  function openRecall(s, n, taste) {
    const box = page(`${n.name}的手記`, `<div class="recall-page"><img src="assets/generated/r89/note-32.png${window.FARM_VERSION_QUERY || ''}" alt="紅格手記" width="64" height="64"><p class="recall-context">${esc(n.recallContext)}</p><p>想想那天坐下來的地方、對方做的事，再搭配今天這一籃。</p></div>`, '<button id="backToBasket" class="content-primary">回餐籃，接著搭配</button>');
    box.dataset.contentView = 'recall'; box.dataset.resident = n.id;
    box.querySelector('#backToBasket').onclick = () => openNeighbors(s, n.id, taste);
  }
  function openResponse(s, id, result) {
    const n = A.neighbors(s, Date.now()).find((p) => p.id === id);
    if (!n || !n.deliveries) return openNeighbors(s, id);
    const matched = n.lastMatched;
    const memory = n.memory, reaction = matched ? memory.reply : n.deliveries>1 ? memory.wrong : n.reaction;
    const box = page(matched ? memory.heading : n.title,
      `<div class="story-occasion ${matched ? 'matched memory-'+id : 'first'}"><img src="assets/generated/r89/${matched ? 'basket' : 'note'}-32.png${window.FARM_VERSION_QUERY || ''}" alt="" width="32" height="32"><span>${matched ? memory.heading : n.deliveries === 1 ? '第一籃・一起坐下的那天' : n.name+'嚐了一口，還想起另一件事'}</span></div>
      <img class="content-illustration" src="${matched ? window.ContentR8.art('token-'+id+'.png') : storyArt(id)}" alt="${matched ? esc(memory.detail) : esc(n.title)}" width="512" height="256">
      <div class="neighbor-story"><p>${esc(matched?memory.detail:n.story)}</p><blockquote>${esc(n.reply)}</blockquote></div>
      <p class="neighbor-reaction" role="status">${esc(reaction)}</p><p class="content-saved">${matched ? `回到農場，${memory.token}會一直留在那裡。` : result ? '麥餅與配料已交到手上，這句話也記下來了。' : '再見到本人，還能接著聊這句話。'}</p>`,
      '<button id="anotherBasket" class="content-primary">再裝一籃</button><button id="backToFarm" class="content-secondary">回農場</button>');
    box.dataset.resident = id; box.dataset.contentView = "response"; box.dataset.matched = String(matched);
    box.querySelector("#anotherBasket").onclick = () => openNeighbors(s, id);
    box.querySelector("#backToFarm").onclick = close;
    if(window.ContentR6)window.ContentR6.response(box,s,id,matched);
  }
  function stopFishing() { if (fishingTimer) cancelAnimationFrame(fishingTimer); fishingTimer = 0; if (pondResize) pondResize.disconnect(); pondResize = null; }
  function drawWater(stage, phase) { window.ContentR8.drawWater(stage,phase); }
  function openFishNotes(s, selected) {
    const notes = A.fishNotes(s, Date.now());
    const n = notes.find(n => n.id === selected) || notes[notes.length - 1];
    const box = page(n ? `河畔筆記・${n.name}` : "河畔筆記", `${n ? `<nav class="neighbor-tabs" aria-label="已釣到的魚">${notes.map(f => `<button data-note="${f.id}" aria-pressed="${f.id === n.id}">${esc(f.name)}</button>`).join("")}</nav>` : ''}<img class="content-illustration" src="${n ? noteArt(n.id+'.webp') : 'assets/generated/content-r7/quiet-water.webp'+(window.FARM_VERSION_QUERY||'')}" alt="${n ? esc(n.name)+'的河畔觀察插圖' : '暖光裡的河畔釣台'}" width="512" height="256">${n ? `<article class="fish-note"><h3>${esc(n.clue)}</h3><p>${esc(n.note)}</p></article>` : '<p>還沒有記下魚的脾氣。釣到第一尾，就能寫下一則自己的觀察。</p>'}`, '<button id="backToPond" class="content-primary">回釣台看浮標</button>');
    box.dataset.contentView = "note";
    const guide=document.createElement('section');guide.className='fish-comparison';
    guide.innerHTML='<h3>自己的水邊觀察</h3>'+[['river_carp','河鯉','寬尾攪水，寬圈合起時提竿。'],['silver_dace','銀鯽','小嘴啄水，短水花還在時提竿。'],['river_perch','溪鱸','彎身橫移，尾流展開時提竿。']].map(([id,name,clue])=>{const known=notes.some(f=>f.id===id);return `<div data-fish-note="${id}" data-unlocked="${known}"><img src="assets/generated/content-r13/${id}-${known?'color':'shadow'}.png${window.FARM_VERSION_QUERY||''}" alt="${known?name:'還沒觀察到的魚'}${known?'':'的剪影'}"><p>${known?name+'・'+clue:'還沒觀察到'}</p>${known?'<button data-replay="'+id+'">重看水紋</button>':''}</div>`;}).join('');
    if(!n){box.querySelector('.content-illustration')?.remove();box.querySelector('.modal-body>p')?.remove();}
    box.querySelector('.modal-body').prepend(guide);
    if(n){const proof=document.createElement('div');proof.className='catch-receipt';proof.innerHTML=`<img src="assets/generated/content-r13/${n.id}-color.png${window.FARM_VERSION_QUERY||''}" alt="${esc(n.name)}的魚體"><p>魚簍累計 ${s.adventure.catch[n.id]} 尾<br>已記下 ${notes.length} 頁河畔筆記</p>`;box.querySelector('.fish-note').before(proof);}
    box.querySelectorAll('[data-replay]').forEach(b=>b.onclick=()=>{
      box.querySelector('.note-replay')?.remove();const id=b.dataset.replay;
      const pane=document.createElement('section');pane.className='note-replay';pane.innerHTML='<p>重看已學會的水紋・不會投餌，也不會得到魚</p><div class="pond-stage" data-rhythm="'+id+'"><canvas class="pond-effects"></canvas><img class="pond-bobber" src="'+art('bobber.png')+'" alt="紅白浮標"><img class="pond-fisher" src="assets/generated/content-r13/fishing-0.png'+(window.FARM_VERSION_QUERY||'')+'" alt="米莉坐在釣台持竿"></div><button class="stop-note-replay">收起重播</button>';
      guide.after(pane);pane.querySelector('button').onclick=()=>pane.remove();const start=performance.now();
      function replay(t){if(!pane.isConnected||box.dataset.contentView!=='note')return;const stage=pane.querySelector('.pond-stage'),phase=A.observeFishingCast({fishId:id,startedAt:Date.now()-((t-start)%5000),observationVersion:2},Date.now());stage.dataset.reel=phase.canReel?'active':'wait';stage.dataset.motion=phase.motion;stage.dataset.pose=phase.pose;window.ContentR8.drawWater(stage,phase);requestAnimationFrame(replay);}requestAnimationFrame(replay);
    });
    box.querySelectorAll('[data-note]').forEach(b => { b.onclick = () => openFishNotes(s, b.dataset.note); });
    box.querySelector("#backToPond").onclick = () => openFishing(s);
  }
  function openFishing(s) {
    stopFishing();
    let view = A.summary(s, Date.now()), casting = false, caughtText = "", lastTick = 0, lastText = "", landed = false;
    const box = page("池塘的三種脾氣", `<details class="pond-help"><summary>水面線索 ▸</summary><p class="pond-guide">看水面，再決定什麼時候提竿。</p></details>
      <div class="pond-stage" data-pose="still" role="img" aria-label="紅白浮標在水面上等魚"><canvas class="pond-effects" aria-hidden="true"></canvas><img class="pond-bobber" src="${art('bobber.png')}" alt="" width="32" height="48"><img class="pond-fisher" src="assets/generated/content-r13/fishing-0.png${window.FARM_VERSION_QUERY||''}" alt="米莉坐在釣台持竿"></div>
      <p class="pond-elapsed" aria-live="off"></p>
      <p class="world-fishing-result" role="status" aria-live="polite"></p>
      <p class="pond-capacity">魚簍 ${view.fishing.used} 尾</p><img class="pond-catch" hidden alt="" width="512" height="256">`,
      `<button id="worldCatch" class="content-primary">提竿</button><button id="worldFishNotes" class="content-secondary">河畔筆記（${A.fishNotes(s, Date.now()).length}）</button>`);
    box.dataset.contentView = "fishing";
    const button = box.querySelector("#worldCatch"), resultBox = box.querySelector(".world-fishing-result"), stage = box.querySelector(".pond-stage");
    const resize = new ResizeObserver(() => { stage.querySelector('canvas').dataset.frame = ''; });
    pondResize = resize;
    resize.observe(stage);
    function cast() {
      const r = s.adventure.fishingCast ? {ok:true} : A.startFishing(s, Date.now());
      casting = r.ok;
      if (r.ok) {
        box.querySelector('.pond-catch').hidden=true;
        s.adventure.fishingCast.observationVersion=2;
        const learned = !!s.adventure.fishNotes[s.adventure.fishingCast.fishId];
        box.dataset.learned = String(learned);
        box.querySelector('.pond-guide').textContent = {river_carp:'寬尾慢慢攪起濁水；等寬尾翻近浮標，再提竿。',silver_dace:'小嘴朝上啄水；等短水花冒起，還沒散就提竿。',river_perch:'魚影先彎身，再衝向一側；等尾流展開，才提竿。'}[s.adventure.fishingCast.fishId];
      }
      if (!r.ok) resultBox.textContent = r.message;
      return r;
    }
    if (view.fishing.remainingMs === 0 && view.fishing.used < view.fishing.capacity) cast();
    function update(t = performance.now()) {
      if (!box.classList.contains("show") || !box.querySelector("#worldCatch")) { resize.disconnect(); stopFishing(); return; }
      if (t - lastTick >= 1000 || lastTick === 0) {
        lastTick = t; view = A.summary(s, Date.now());
      }
        const phase = casting && A.observeFishingCast(s.adventure.fishingCast, Date.now());
        const elapsed = '';
        const elapsedBox = box.querySelector('.pond-elapsed'); if (elapsedBox.textContent !== elapsed) elapsedBox.textContent = elapsed;
        const learned = box.dataset.learned === 'true';stage.dataset.reel = phase?.canReel?'active':'wait';
        const assisted=box.querySelector(".pond-help").open;const pose = phase ? phase.pose : "still", label = phase && assisted ? phase.text : "紅白浮標與水面的動靜";
        if (phase && pose === "missed") { const r = A.reelFishing(s, Date.now()); casting = false; caughtText = r.message; }
        if (stage.dataset.pose !== pose) stage.dataset.pose = pose;
        const phaseId = String(phase ? phase.index : "ended");
        if (stage.dataset.phase !== phaseId) stage.dataset.phase = phaseId;
        if(phase)stage.dataset.motion=phase.motion;else if(landed)stage.dataset.motion='ended';
        if (casting && s.adventure.fishingCast && stage.dataset.rhythm !== s.adventure.fishingCast.fishId) stage.dataset.rhythm = s.adventure.fishingCast.fishId;
        drawWater(stage, phase);
        if (stage.getAttribute("aria-label") !== label) stage.setAttribute("aria-label", label);
        const full = view.fishing.used >= view.fishing.capacity;
        const waiting = view.fishing.remainingMs > 0;
        if (button.disabled !== (full || waiting)) button.disabled = full || waiting;
        const disabled = String(full || waiting), ready = String(!casting || phase?.canReel);
        if (button.getAttribute("aria-disabled") !== disabled) button.setAttribute("aria-disabled", disabled);
        if (button.dataset.ready !== ready) button.dataset.ready = ready;
        const actionLabel = full ? "魚簍滿了" : waiting ? `再等 ${Math.ceil(view.fishing.remainingMs / 1000)} 秒` : casting ? "提竿" : "重新拋竿";
        if (button.textContent !== actionLabel) button.textContent = actionLabel;
        const text = waiting ? caughtText || "上一尾已入簍。魚群散開中，等倒數結束再拋。" : full ? "魚簍滿了，先帶一籃河魚給鄰居吧。" : casting && phase ? (!assisted ? "認認水面的變化，再決定要不要提竿。" : ({'closed-rings':'寬尾翻起、浮標沉下了，現在提竿。','short-splash':'短水花冒起了，趁水花還在提竿。','splash-gone':'短水花散了，這一竿晚了。','straight-wake':'魚影衝向一側，尾流展開了，現在提竿。','wide-swell':'濁水慢慢散開，浮標稍微下探；等寬尾翻近浮標。','bent-wake':'魚影轉身，浮標往側邊拉；先等尾流展開。'}[phase.motion]||phase.text)) : caughtText || "再拋一竿，試著認認這個節奏。";
        if (text !== lastText) { resultBox.textContent = text; lastText = text; }
        const fishingState = waiting || landed ? 'caught' : casting ? pose === 'strike' ? 'bite' : 'waiting' : 'missed';
        if (box.dataset.fishingState !== fishingState) box.dataset.fishingState = fishingState;
      fishingTimer = requestAnimationFrame(update);
    }
    update();
    button.onclick = () => {
      if (button.disabled) return;
      if (!casting) { cast(); caughtText = ""; lastText = ""; landed = false; lastTick = 0; cancelAnimationFrame(fishingTimer); update(); return; }
      const r = A.reelFishing(s, Date.now()); casting = false;
      caughtText = r.ok ? `${r.catch.name} ×1 已放進魚簍。${r.firstCatch ? '河畔筆記多了一頁。' : '這回也認出牠的脾氣了。'}` : r.message;
      resultBox.textContent = caughtText; lastText = "";
      if (r.ok) {
        landed = true;
        const photo=box.querySelector('.pond-catch');photo.src=noteArt(r.catch.id+'.webp');photo.alt='剛釣到的'+r.catch.name;photo.hidden=false;
        box.querySelector('.pond-guide').textContent = "河畔筆記收著沿岸的觀察，下回還能翻看。";
        window.ContentR8.catchReceipt(box,s,r.catch.id,r.firstCatch);
        button.disabled = true; save(s);
        box.querySelector("#worldFishNotes").textContent = `河畔筆記（${A.fishNotes(s, Date.now()).length}）`;
        box.querySelector(".pond-capacity").textContent = `魚簍 ${A.summary(s, Date.now()).fishing.used} 尾`;
      }
      lastTick = 0; cancelAnimationFrame(fishingTimer); update();
    };
    box.querySelector("#worldFishNotes").onclick = () => openFishNotes(s);
  }
  window.ContentR1 = { openNeighbors, openResponse, openFishing, openFishNotes, stopFishing, verifyArtwork, page, save, close, guardArt };
})();
