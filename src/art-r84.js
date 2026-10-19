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
    dock.append(document.getElementById('toolBar'),document.getElementById('dailyOpen'),more);
    document.querySelector('.wrap').append(dock);
    const sync=()=>{if(window.FarmWorld)window.FarmWorld.syncWorldHitTargets();};
    const close=()=>{if(!menu.hidden){menu.hidden=true;sync();}if(more.getAttribute('aria-expanded')!=='false')more.setAttribute('aria-expanded','false');};
    more.onclick=(event)=>{event.stopPropagation();menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden));sync();};
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
