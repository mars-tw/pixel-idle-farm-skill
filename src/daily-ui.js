(function () {
  "use strict";
  const D = window.FarmDaily, el = (id) => document.getElementById(id);
  let current, tab = "today", page = 0, signature = "";
  function refresh(s) {
    if (!D || !s || !el("dailyOpen")) return;
    current = s;
    const st = D.status(s, Date.now());
    el("dailyOpen").dataset.ready = String(st.tasks.some((t) => t.ready));
    el("dailyOpen").setAttribute("aria-label", `晨光日誌，今日 ${st.done}/3 項${st.tasks.some((t) => t.ready) ? "，可以領取獎勵" : ""}`);
    if (!el("dailyModal").classList.contains("show")) return;
    const sig = JSON.stringify([st, tab, page, window.FarmHeirloom.status(s)]);
    if (sig === signature) return;
    signature = sig;
    const body = el("dailyBody"), list = tab === "today" ? st.tasks : st.keepsakes;
    const restoreClaimFocus = !!(document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-claim-task'));
    page = Math.max(0, Math.min(page, list.length - 1));
    const row = list[page];
    el("dailyDate").textContent = `${st.date}・已集 ${st.stamps} 枚印章`;
    el("dailyToday").setAttribute("aria-pressed", String(tab === "today"));
    el("dailyCollection").setAttribute("aria-pressed", String(tab === "collection"));
    el("dailyHeirloom").setAttribute("aria-pressed", String(tab === "heirloom"));
    el("dailyModal").dataset.artPage = tab;
    el("dailyModal").dataset.story = String(tab === 'heirloom' && window.FarmHeirloom.status(s).delivered);
    el('dailyTitle').textContent=tab==='today'?'今日印章冊':tab==='heirloom'?'陽光餐籃':'祖母手記';
    el('dailyToday').textContent='今日農務';
    el('dailyTitle').dataset.done=String(st.done);
    const banner=el('basketBanner');if(banner)banner.hidden=tab!=='heirloom'||window.FarmHeirloom.status(s).delivered;
    const headingPortrait = el('dailyModal').querySelector('.daily-heading .sun-portrait');
    if (headingPortrait) headingPortrait.src = `assets/generated/${tab==='today'?'r89':'r84'}/${tab === 'collection' ? 'grandma-1.png' : tab === 'heirloom' ? (window.FarmHeirloom.status(s).ready ? 'grandma-2.png' : 'grandma-0.png') : 'miri-0.png'}`+(window.FARM_VERSION_QUERY || '');
    el("dailyPrev").parentElement.hidden = tab !== "collection";
    const previousConfirm=el('heirloomConfirm');if(previousConfirm)previousConfirm.remove();
    if (tab === "today") {
      body.innerHTML = `<div class="daily-kicker">今日 ${st.done}/3・澆水、收成、分享</div><div class="daily-task-strip" aria-label="三張今日農務牌">${st.tasks.map((task,index)=>`<article class="daily-chore ${index===page?'selected':''}" data-task="${task.id}"><button class="daily-task-thumb" type="button" aria-pressed="${index===page}" data-select-task="${index}"><img src="assets/generated/r89/${task.id==='water'?'water':task.id==='basket'?'basket':'wheat'}-32.png${window.FARM_VERSION_QUERY||''}" width="48" height="48" alt=""><span>${task.title}<small>${task.claimed?'已蓋章':`${Math.min(task.have,task.need)}／${task.need}`}</small></span>${task.claimed?`<img class="chore-stamp" src="assets/generated/r86/stamp-${task.id}-32.png${window.FARM_VERSION_QUERY||''}" width="40" height="40" alt="已蓋${task.id==='water'?'澆水壺':task.id==='harvest'?'麥穗':'餐籃'}章">`:''}</button><p>${task.detail}</p>${task.ready?`<button ${index===page?'id="dailyClaim"':''} data-claim-task="${task.id}" type="button">${task.id==='basket'?'交付餐籃':'領取'}・${task.coins} 金</button>`:`<div class="chore-progress" aria-label="${task.claimed?'已領取':'進行中'}"><i style="width:${Math.min(100,task.have/task.need*100)}%"></i></div>`}</article>`).join('')}</div>`;
      body.querySelectorAll('[data-select-task]').forEach(button=>button.onclick=()=>{page=Number(button.dataset.selectTask);signature='';refresh(current);});
      body.querySelectorAll('[data-claim-task]').forEach(button=>button.onclick = () => {
        const result = D.claim(current, button.dataset.claimTask, st.day, Date.now());
        if (!result.ok) { window.__farm.toast(result.reason === "new_day" ? "換日了，來看看今天的新餐籃。" : "先備齊這項農務需要的東西。"); refresh(current); return; }
        window.__farm.toast(`日誌獎勵 +${result.coins} 金${result.stamp ? "・印章 +1、堆肥 +1" : ""}${result.unlocked.length ? `・收藏：${result.unlocked.join("、")}` : ""}`);
        window.__farm.safeSaveNow(); window.__farm.refresh();
        const next = D.status(current, Date.now()).tasks.findIndex((t) => !t.claimed);
        if (next >= 0) page = next;
        refresh(current);
      });
    } else if (tab === "heirloom") {
      window.HeirloomUI.renderPage(s, body);
    } else {
      body.innerHTML = `<div class="daily-copy"><div class="daily-kicker">祖母手記 ${page + 1}/2・${row.at} 枚印章解鎖</div><h3>${row.owned ? row.name : "還沒翻開的手記"}</h3><p>${row.owned ? row.text : `再集 ${Math.max(0, row.at - st.stamps)} 枚印章，就能讀到這一頁。隔幾天再來也算，不用連續登入。`}</p></div><div class="daily-result daily-progress">${Math.min(st.stamps, row.at)}/${row.at} 枚</div>`;
    }
    if (tab==='collection') { const face=document.createElement('img');face.src='assets/generated/r84/grandma-1.png'+(window.FARM_VERSION_QUERY || '');face.alt='祖母讀著手記';face.className='grandma-note';face.width=80;face.height=80;body.prepend(face); }
    el("dailyPrev").disabled = page === 0;
    el("dailyNext").disabled = page === list.length - 1;
    el("dailyPage").textContent = `${page + 1}/${list.length}`;
    el('dailyPrev').textContent=tab==='today' && page>0 ? st.tasks[page-1].title : '前一頁';
    el('dailyNext').textContent=tab==='today' && page<2 ? st.tasks[page+1].title : '下一頁';
    el("dailyFooter").textContent = tab === "heirloom" ? "第一份陽光餐籃不換日、不重領。你選的那一頁會留下來。" : st.stamped ? "今天已蓋章。明天 00:00 有新餐籃。" : "三項都領完，得印章與堆肥各 1。每日 00:00 更新。";
    if (restoreClaimFocus) {
      const claim = el("dailyClaim");
      (claim && !claim.disabled ? claim : el("dailyClose")).focus();
    }
  }
  function open() {
    if (!window.__farm) return;
    current = window.__farm.state();
    tab = "today"; page = Math.max(0, D.status(current, Date.now()).tasks.findIndex((t) => !t.claimed)); signature = "";
    window.__farm.openModal("dailyModal", "#dailyClose"); refresh(current);
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (!el("dailyOpen")) return;
    const heading = el("dailyModal").querySelector(".daily-modal-card > div:first-child");
    if (heading) {
      heading.classList.add("daily-heading");
      const copy = document.createElement("div");
      while (heading.firstChild) copy.append(heading.firstChild);
      heading.append(copy);
      const portrait = document.createElement("img"); portrait.className = "sun-portrait";
      portrait.src = "assets/generated/r89/miri-0.png?v=content-r15-20261019-1"; portrait.alt = "農夫的晨光日誌"; portrait.width = 52; portrait.height = 52;
      heading.prepend(portrait);
      const banner=document.createElement('div');banner.id='basketBanner';banner.hidden=true;banner.innerHTML='<img src="assets/generated/r88/basket-32.png" width="48" height="48" alt=""><span>把光收進餐籃<small>兩份小麥，替葛瑞留一籃。</small></span>';
      heading.after(banner);
      const links=el('dailyHeirloom').parentElement;links.classList.add('journal-links');links.prepend(el('dailyToday'));el('dailyBody').before(links);
    }
    el("dailyOpen").onclick = open;
    el("dailyClose").onclick = () => window.__farm.closeModal("dailyModal");
    el("dailyToday").onclick = () => { tab = "today"; page = 0; refresh(current); };
    el("dailyCollection").onclick = () => { tab = "collection"; page = 0; refresh(current); };
    el("dailyHeirloom").onclick = () => { tab = "heirloom"; page = 0; refresh(current); };
    el("dailyPrev").onclick = () => { page--; refresh(current); };
    el("dailyNext").onclick = () => { page++; refresh(current); };
  });
  function openHeirloom() { if (!window.__farm) return; current = window.__farm.state(); tab = "heirloom"; page = 0; signature = ""; window.__farm.openModal("dailyModal", "#dailyClose"); refresh(current); }
  window.DailyUI = { refresh, open, openHeirloom };
})();
