"""Correct the owned plan's review attribution; keep original user files untouched."""
import pathlib,json,hashlib
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r13';p=R/'docs/OPTIM_PLAN_CONTENT_R13.md'
text=p.read_text(encoding='utf-8');heading='## 唯一 Muse R12 五項逐條閘門'
assert heading in text
correct='''## 唯一 Muse R12 原五項逐條驗收

來源：`docs/content/CONTENT_REVIEW_R12_MUSE.md`。補正原計畫的表頭歸屬：下方空白／姿勢／魚體／份數／持竿五列來自本線路另列問題與Claude評分；Muse唯一五項應為本表。兩組均已納入原有三項內容修正，沒有增加第四項玩法。

|Muse項目|設計與驗收|主要檔案|
|---|---|---|
|1 拉開水形|河鯉寬橫環、銀鯽窄直柱、溪鱸側尾流；三種作用幀均留紅標|content-r8.js、content-r13.css|
|2 筆記重播|未解鎖只留剪影；捕獲後該格可重播，不加魚；新檔／一頁／三頁留圖|content-r1.js、R13魚圖|
|3 走近與取消|三人真走近，等雙方同框拍中段與真幀；取消原料不減|content-r6.js、R13行走補驗|
|4 連續端送|盤子CSS連續滑動，班伯／圖圖在carry與received之間各補原尺寸一張；腳底不移|content-r6.js、content-r13.css|
|5 記憶進度|送達顯示1／3、2／3、3／3；未滿點桌子只列缺人，滿三人提示赴約|content-r6.js|

'''
text=text.replace(heading,correct+'## 本線路另列問題與Claude／GPT評分修正')
text+='\nVERIFIED收尾補正：新手圖／日誌頭像另外同步3個舊快取URL字串（world-ui.js、daily-ui.js），逐bytes差異及受影響入口重測見`docs/content/r13/version-query-delta.json`、`cache-offline.json`。\n'
p.write_text(text,encoding='utf-8')
baseline=json.loads((R/'.audit-tmp/content-r13-protection/inventory.json').read_text(encoding='utf-8'))
owned={'docs/OPTIM_PLAN_CONTENT_R13.md','tools/protect-content-r13.py'}
receipt=json.loads((O/'protected-readback.json').read_text(encoding='utf-8'))
receipt['scaffoldsCreatedThisRound']=[{'path':n,'preparedSha256':baseline[n]['sha256'],'finalSha256':hashlib.sha256((R/n).read_bytes()).hexdigest()} for n in sorted(owned)]
receipt['protectedFiles']=sum(v['protected'] for n,v in baseline.items() if n not in owned)
receipt['originalFileReadback']=[r for r in receipt['originalFileReadback'] if r['path'] not in owned]
for n,v in baseline.items():
    if v['protected'] and n not in owned:assert hashlib.sha256((R/n).read_bytes()).hexdigest()==v['sha256'],n
(O/'protected-readback.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('VERIFIED plan attribution and',receipt['protectedFiles'],'original user dirty/untracked files, byte for byte')
