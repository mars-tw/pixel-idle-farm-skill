/* One farm dock. The original controls and handlers remain the source of truth. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const dock = document.createElement('nav'); dock.id='farmDock'; dock.setAttribute('aria-label','農場工具與日誌');
    const more=document.createElement('button'); more.id='farmMore'; more.type='button'; more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','farmMenu');
    more.innerHTML=`<img src="assets/generated/r84/menu-32.png${window.FARM_VERSION_QUERY||''}" width="28" height="28" alt=""><span>更多</span>`;
    const menu=document.createElement('div');menu.id='farmMenu';menu.hidden=true;menu.setAttribute('aria-label','農場選單');
    document.querySelector('.side-panel').append(menu);
    menu.append(document.getElementById('sideTabs'),document.querySelector('.toolbar'),document.getElementById('mapFitToggle'));
    const moreTools=document.createElement('div'); moreTools.className='r55-more-tools'; moreTools.setAttribute('aria-label','更多工具');
    const moreToolDefs=[['clear','清除','i-tool-clear'],['inspect','查看','i-tool-inspect']];
    const syncMoreTools=()=>{ moreTools.querySelectorAll('.r55-more-tool').forEach((b)=>{ const def=moreToolDefs.find((d)=>d[0]===b.dataset.r55Tool); const target=def?[...document.querySelectorAll('#farmDock .tool')].find((e)=>e.getAttribute('aria-label')===def[1]):null; const sel=!!(target&&target.classList.contains('sel')); b.classList.toggle('sel',sel); b.setAttribute('aria-pressed',sel?'true':'false'); }); };
    moreToolDefs.forEach(([id,label,icon])=>{ const b=document.createElement('button'); b.type='button'; b.className='r55-more-tool'; b.dataset.r55Tool=id; b.setAttribute('aria-label',label+'工具'); b.setAttribute('aria-pressed','false'); b.innerHTML='<span class="ui-icon '+icon+'" aria-hidden="true"></span><span>'+label+'</span>'; b.onclick=()=>{ const target=[...document.querySelectorAll('#farmDock .tool')].find((e)=>e.getAttribute('aria-label')===label); if(target)target.click(); syncMoreTools(); }; moreTools.appendChild(b); });
    menu.prepend(moreTools);
    dock.append(document.getElementById('toolBar'),document.getElementById('dailyOpen'),more);
    const toolBarEl=document.getElementById('toolBar'); if(toolBarEl&&typeof MutationObserver==='function') new MutationObserver(syncMoreTools).observe(toolBarEl,{childList:true,subtree:true,attributes:true,attributeFilter:['class']}); syncMoreTools();
    document.querySelector('.wrap').append(dock);
    const sync=()=>{if(window.FarmWorld)window.FarmWorld.syncWorldHitTargets();};
    const close=()=>{if(!menu.hidden){menu.hidden=true;sync();}if(more.getAttribute('aria-expanded')!=='false')more.setAttribute('aria-expanded','false');};
    more.onclick=(event)=>{event.stopPropagation();const dlg=document.getElementById('worldDialogue');if(menu.hidden&&dlg&&!dlg.hidden)dlg.hidden=true;/* R37：對話開著時按「更多」，先收起對話再開選單，不再被對話擋住 */menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden));sync();};
    menu.addEventListener('click',event=>{if(event.target.closest('button'))close();});
    dock.addEventListener('click',event=>{if(!event.target.closest('#farmMore'))close();});
    document.addEventListener('pointerdown',event=>{if(!event.target.closest('#farmMenu,#farmMore'))close();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){close();more.focus();}});
    // Dialogue visibility also controls movement/dock hit surfaces through CSS.
    const observer=new MutationObserver(()=>{
      if(document.querySelector('.modal.show,#worldDialogue:not([hidden])'))close();
    });
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class']});
  });
})();
