/* Native generated water frames and upper-body pose changes. No game clock changes. */
(function(){
 'use strict';
 const art=n=>'assets/generated/content-r8/'+n+(window.FARM_VERSION_QUERY||'');
 const images={};
 for(const id of ['river_carp','silver_dace','river_perch']){const img=new Image();img.src='assets/generated/content-r13/'+id+'-shadow.png'+(window.FARM_VERSION_QUERY||'');images[id]=img;}
 const newWater={};for(const id of ['river_carp','silver_dace','river_perch'])for(let i=0;i<4;i++){const im=new Image();im.src='assets/generated/'+(id==='river_carp'?'content-r19':'content-r18')+'/'+id+'-'+i+'.png'+(window.FARM_VERSION_QUERY||'');newWater[id+'-'+i]=im;}
 const ripples={};for(const kind of ['wide','peck','wake'])for(let i=0;i<3;i++){const img=new Image();img.src='assets/generated/'+(kind==='wide'&&i===1?'content-r15':'content-r12')+'/'+kind+'-'+i+'.png'+(window.FARM_VERSION_QUERY||'');ripples[kind+'-'+i]=img;}
 function drawWater(stage,phase){
  const canvas=stage.querySelector('canvas'),id=stage.dataset.rhythm||'river_carp';
  // The tiny first frame is a premonition, not enough evidence for identifying
  // a fish. Keep the broad generated frame on both answer screens. Replay still
  // runs the original four distinct drawings, without changing the cast clock.
  const inspecting=stage.dataset.blind==='true'&&!!stage.dataset.result&&stage.dataset.waterReplay!=='true';
  const frame=phase?.pose==='strike'?2:phase&&phase.index>0?1:0,key=id+'-'+frame,img=images[id],animation=inspecting?2:Math.floor(Number(stage.dataset.elapsed||Date.now()%1200)/180)%4,cacheKey=key+'-'+stage.dataset.result+'-'+stage.dataset.blind+'-'+animation;
  if(stage.dataset.blind==='true'){
    const r={width:stage.clientWidth,height:stage.clientHeight},scale=Math.min(r.width/128,r.height/112),ox=(r.width-128*scale)/2,oy=(r.height-112*scale)/2;
    const bx=id==='river_perch'?58+animation*7:64,by=phase?.canReel?37:30;
    stage.style.setProperty('--bobber-x',ox+(bx)*scale+'px');stage.style.setProperty('--bobber-y',oy+by*scale+'px');stage.dataset.waterAnchor=bx+','+by;
  }
  drawLine(stage,Number(stage.querySelector('.pond-fisher')?.dataset.pose||0));
  if(!img?.complete||!img.naturalWidth||canvas.dataset.frame===key&&canvas.dataset.cacheKey===cacheKey&&canvas.dataset.ripplePhase===(phase?.motion||'ended'))return;
  canvas.width=128;canvas.height=112;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,128,112);if(stage.dataset.blind!=='true')ctx.drawImage(img,46,52,35,31);const pixels=ctx.getImageData(0,0,128,112);for(let i=0;i<pixels.data.length;i+=4){if(pixels.data[i+3]){pixels.data[i]=41;pixels.data[i+1]=61;pixels.data[i+2]=70;pixels.data[i+3]=Math.round(pixels.data[i+3]*.65);}}ctx.putImageData(pixels,0,0);canvas.dataset.silhouette=stage.dataset.blind==='true'?'hidden':'true';
  // Generated connected water clusters. Never substitute a row of square markers.
  const motion=phase?.motion||'ended',kind={river_carp:'wide',silver_dace:'peck',river_perch:'wake'}[id],waterFrame=phase?.canReel?1:phase?.pose==='missed'||motion==='splash-gone'?2:0,waterSourceFrame=stage.dataset.blind==='true'&&phase?.pose==='missed'?1:waterFrame,water=ripples[kind+'-'+waterSourceFrame];
  if(water?.complete&&water.naturalWidth&&(stage.dataset.blind!=='true'||phase?.canReel||phase?.pose==='missed')){
    const xy={wide:[18,8,92,48],peck:[47,1,35,66],wake:[12,15,105,35]}[kind];
    const current=newWater[id+'-'+animation];
    ctx.globalAlpha=stage.dataset.blind==='true'?1:.82;if(current?.complete&&current.naturalWidth){ctx.drawImage(current,...(stage.dataset.blind==='true'?[4,-8,120,90]:[16,0,96,72]));canvas.dataset.generatedWater=id+'-'+animation;}else ctx.drawImage(water,...xy);ctx.globalAlpha=1;
  }
  // Three accepted, separately drawn upper-body poses. Each species keeps its
  // own active pose; neither the physics root nor the whole sprite is bobbed.
  const pose=phase?.canReel?{river_carp:0,silver_dace:1,river_perch:2}[id]:phase&&phase.index>0?1:0;
  const fisher=stage.querySelector('.pond-fisher');if(fisher){fisher.src='assets/generated/content-r13/fishing-'+pose+'.png'+(window.FARM_VERSION_QUERY||'');fisher.dataset.pose=String(pose);}
  drawLine(stage,pose);
  canvas.dataset.waterFrame=kind+'-'+waterFrame;canvas.dataset.waterSourceFrame=kind+'-'+waterSourceFrame;canvas.dataset.sourceFrame=id+'-1';
  canvas.dataset.frame=key;canvas.dataset.cacheKey=cacheKey;canvas.dataset.ripplePhase=motion;stage.dataset.artFrame=String(frame);
 }
 function drawLine(stage,pose){
  const fisher=stage.querySelector('.pond-fisher'),bobber=stage.querySelector('.pond-bobber');if(!fisher||!bobber)return;
  let line=stage.querySelector('.pond-line');if(!line){line=document.createElementNS('http://www.w3.org/2000/svg','svg');line.classList.add('pond-line');line.setAttribute('aria-hidden','true');line.innerHTML='<path fill="none" stroke="#fff6e3" stroke-width="1.5"/>';stage.appendChild(line);}
  const r=stage.getBoundingClientRect(),f=fisher.getBoundingClientRect(),b=bobber.getBoundingClientRect(),tip=[[95.5,42.5],[95.5,24.5],[85.5,8.5]][pose],x=f.left-r.left+tip[0]*f.width/96,y=f.top-r.top+tip[1]*f.height/96,bx=b.left-r.left+b.width*(15/32),by=b.top-r.top+b.height*(10/48);
  line.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);line.querySelector('path').setAttribute('d',`M${x},${y} Q${(x+bx)/2},${Math.max(y,by)+9} ${bx},${by}`);
 }
 function catchReceipt(box,s,id,first){
  let e=box.querySelector('.catch-receipt');if(!e){e=document.createElement('div');e.className='catch-receipt';box.querySelector('.pond-catch').after(e);}
  const notes=window.AdventureAPI.fishNotes(s,Date.now()).length;
  const name={river_carp:'河鯉',silver_dace:'銀鯽',river_perch:'溪鱸'}[id];
  e.innerHTML=`<img src="${'assets/generated/content-r13/'+id+'-color.png'+(window.FARM_VERSION_QUERY||'')}" alt="這尾魚的咬鉤水花"><p>這次入簍 ＋1 尾・${name}現有 ${s.adventure.catch[id]} 尾<br>河畔筆記 ${notes-(first?1:0)} → ${notes} 頁</p>`;
 }
 function memory(box,s,id){
  const n=window.AdventureAPI.neighbors(s,Date.now()).find(n=>n.id===id),record=s.adventure.neighbors[id];
  box.querySelectorAll('.memory-token img').forEach(img=>img.src=art('token-'+id+'.png'));
  if(!n.lastMatched)return;
  const illustration=box.querySelector('.content-illustration');illustration.src=art('token-'+id+'.png');illustration.classList.add('keepsake-portrait');illustration.alt=n.memory.token;
  const occasion=box.querySelector('.story-occasion span');occasion.textContent={merchant:'倒扣的茶杯',elder:'魚竿與兩只盤子',child:'壓花空椅'}[id]+'・留在農場的心意';const story=box.querySelector('.neighbor-story');const details=document.createElement('details');details.className='memory-story';details.innerHTML='<summary>再讀一起坐下的那天</summary>';story.replaceWith(details);details.appendChild(story);
  const history=document.createElement('section');history.className='taste-history';history.setAttribute('aria-label',n.name+'的實際餐籃手記');
  const labels={plain:'原味',sweet:'甜味',sour:'酸味',hot:'熱味'},branches={first:'第一籃・一起坐下',wrong:'嚐過以後，還想起另一味',matched:'這次記住了，留下這個位子'};
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  history.innerHTML='<details class="memory-history"><summary>翻開送過的餐籃</summary>'+record.history.map((h,i)=>`<p data-delivery-branch="${h.branch}">${i+1}．${labels[h.taste]} → ${branches[h.branch]}${h.branch==='wrong'&&h.reaction?'<small>'+esc(h.reaction)+'</small>':''}</p>`).join('')+'</details>';
  box.querySelector('.neighbor-reaction').after(history);
 }
 // R9 poses have identical lower 18 rows; roots, seats and colliders never move.
 let previous=-1;
 setInterval(()=>{
  if(document.hidden)return;
  const tick=Math.floor(performance.now()/700);if(tick===previous)return;previous=tick;
  document.querySelectorAll('[data-seated-resident]').forEach(e=>{
   if(Number(e.dataset.reactingUntil)>performance.now())return;
   const id=e.dataset.seatedResident,offset={merchant:0,elder:2,child:4}[id];
   const phase=(tick+offset)%6,pose=e.dataset.fed!=='true'?'wait':phase<2?'sip':phase<4?'offer':'sit',src='assets/generated/'+(pose==='wait'?'content-r13':'content-r9')+'/'+pose+'-'+id+'.png'+(window.FARM_VERSION_QUERY||'');
   window.FarmWorld.requestResidentPose(e,src,{pose,gesture:pose==='wait'||pose==='sit'?'rest':'sip-or-bite'});
  });
 },100);
 window.ContentR8={drawWater,drawLine,catchReceipt,memory,art};
})();
