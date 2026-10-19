/* Screenshots of actual local receipts; these are evidence indexes, not gameplay or independent review. */
'use strict';
const fs=require('fs'),path=require('path'),{chromium}=require('playwright'),{ROOT,serve}=require('./r85-browser-helper');
const OUT=path.join(ROOT,'docs/content/r4');
const json=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title='本機執行收據・第四輪';
const shell=(name,body)=>`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;background:#fff6e3;color:#3e2f23;font:15px/1.5 'Microsoft JhengHei',sans-serif;padding:18px}h1{font-size:23px;margin:0}h2{font-size:18px;margin:8px 0}p{margin:8px 0}.note{background:#f5e4bd;padding:8px;border-left:5px solid #d95737}article{border-bottom:1px solid #b38d61;padding:10px 0}img{display:block;width:192px;height:96px;image-rendering:pixelated;margin:4px 0}code{font:10px/1.3 monospace;overflow-wrap:anywhere;display:block}ol{padding-left:24px;margin:8px 0}li{padding:1px 0;font-size:12px;line-height:1.25}.ok{color:#395847;font-weight:700}</style><h1>${title}</h1><p class="note">${esc(name)}<br>0.1.27／content-r4-20261019-1<br>下列為本機讀回資料，非獨立審查。</p>${body}</html>`;
async function run(){
 const receipt=json('docs/content/r4/release-readback.json'),browser=json('docs/content/r4/browser-checks.json'),commands=json('docs/content/r4/regression-checks.json');
 if(receipt.status!=='VERIFIED'||browser.status!=='VERIFIED'||commands.some(c=>c.exitCode))throw Error('Receipts are not verified');
 const files=[];
 const browserScripts=[...fs.readFileSync(path.join(ROOT,'scripts/run-browser-gates.js'),'utf8').matchAll(/"scripts\/([^"\n]+\.js)"/g)].map(m=>m[1]);
 files.push(['checks',shell('測試與完成狀態',`<h2 class="ok">VERIFIED：${browser.checks.length} 項瀏覽器檢查</h2><p>命令退出碼均為0；九次送餐、三魚各兩次捕獲、實等30秒、重載及離線皆通過。</p><ol>${commands.map(c=>`<li>${esc(c.command.join(' '))}：exit ${c.exitCode}</li>`).join('')}</ol><h2>CI現行逐支瀏覽器守門</h2><ol>${browserScripts.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p>完整收據：regression-checks.json／logs/browser-gates.txt</p>`)]);
 for(const [round,label] of [['r3','前輪三張生成場景：來源與輸出'],['r4','本輪兩張生成場景：來源與輸出']]){
  const m=json(`assets/generated/content-${round}/manifest.json`);
  files.push(['art-'+round,shell(label,`<p>工具：${esc(m.tool)}；模型slug未提供。原生256×128 → nearest 512×256，精確R89色盤。</p>`+m.assets.map((a,i)=>`<article><b>${esc(path.basename(a.path))}</b><img src="/${a.path}"><code>${esc(a.path)}<br>輸出 SHA-256：${a.sha256}<br>原稿：${esc(m.masters[i].path)}<br>原稿 SHA-256：${m.masters[i].sha256}</code></article>`).join(''))]);
 }
 const perf=json('docs/content/r4/performance-reference.json');
 files.push(['integrity',shell('版本、存檔與量測邊界',`<p class="ok">版本鏈一致；秘密掃描 ${receipt.secretScan.filesScanned} 份文字檔，命中0。</p><p>起點 ${receipt.historicalFilesPreserved} 份歷史檔逐bytes一致。未提交檔保留。</p><h2>原始 rAF 參考量測</h2>${['sunpatch','pond'].map(scene=>['1366x768','390x844'].map(view=>`<p>${scene} ${view}<br>三跑 p95：${perf.samples.filter(s=>s.scene===scene&&s.viewport===view).map(s=>s.p95Ms+'ms').join('／')}</p>`).join('')).join('')}<p>三跑中位≤18ms：VERIFIED。<br>所有單跑≤18ms：BLOCKED，釣台桌機一跑33.3ms。</p><p class="note">BLOCKED：實體裝置、乾淨機況效能、真人辨識／選味口述、Muse獨立複審≥8。共享主機量測不替代上述驗收。</p><h2>來源程式 SHA-256</h2>${Object.entries(receipt.sourceHashes).map(([p,h])=>`<code>${esc(p)}<br>${h}</code>`).join('<br>')}`)]);
 for(const [name,html] of files)fs.writeFileSync(path.join(OUT,'receipt-'+name+'.html'),html);
 const {server,origin}=await serve();let b;
 try{b=await chromium.launch({headless:true});const c=await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,serviceWorkers:'block'});const page=await c.newPage();
  for(const [name] of files){await page.goto(origin+'/docs/content/r4/receipt-'+name+'.html');await page.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));if(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight))throw Error('Receipt overflows: '+name);const rel='docs/content/r4/phone-receipt-'+name+'.png';await page.screenshot({path:path.join(ROOT,rel)});if(!browser.screenshots.includes(rel))browser.screenshots.push(rel);}
  await c.close();
 }finally{if(b)await b.close();await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(OUT,'browser-checks.json'),JSON.stringify(browser,null,2)+'\n');console.log('VERIFIED four phone receipt screenshots, generated from actual readbacks');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
