"""Build a plain, clickable inventory from the actual final capture receipt."""
import hashlib,json,pathlib
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r9'
r=json.loads((O/'browser-checks.json').read_text(encoding='utf-8'));assert r['status']=='VERIFIED'
lines=['# R9 原尺寸證據索引','','VERIFIED。來源為本輪無頭實玩；下列路徑取自最終browser-checks.json。精選僅15張，6張餐籃、5張池塘、4張口味／聚餐。未宣稱精選可容納所有三人三格、三魚三態及聚餐三格。','','| 精選 | 內容 | 原始擷取 | SHA-256 |','| --- | --- | --- | --- |']
for f in r['reviewSet']:
 p=R/f['path'];source=R/f['source'];assert p.read_bytes()==source.read_bytes()
 lines.append(f"| [{p.name}](review-set/{p.name}) | {f['content']} | [{source.name}]({source.name}) | {hashlib.sha256(p.read_bytes()).hexdigest()} |")
lines+=['','## 五項驗收定位','','1. 三人各三格：phone-basket-{merchant,elder,child}-{approach,contact,received}.png；原生頭腳像素與DOM量測見native-pixel-checks.json、browser-checks.json。','2. 三魚各沉降前／中：phone-pond-{river_carp,silver_dace,river_perch}-{pre-sink,sinking}.png；三剪影對照：phone-pond-comparison.png。','3. 430寬三紀念物比例、重載後農場：phone-gathering-daily-reloaded.png。','4. 三人錯開動作與玩家實際端杯／分點心：phone-memory-shared-{1,2,3}.png；農場連拍：phone-gathering-living-{1,2,3}.png。','5. 精選01–06班伯／圖圖完整交手、07–11三魚捕獲與溪鱸前後、12–15聚餐連拍及重載。','','## 全部最終擷取','','| 原圖 | 尺寸 | 實際擷取時間（epoch ms） |','| --- | --- | --- |']
for f in r['frames']:
 p=R/f['path'];im=Image.open(p);rel=pathlib.Path(f['path']).relative_to('docs/content/r9').as_posix() if f['path'].startswith('docs/content/r9/') else '../../store/screenshots/'+p.name
 lines.append(f"| [{p.name}]({rel}) | {im.width}×{im.height} | {f['at']} |")
lines+=['','before/三張來自R8歷史原圖，保留作前後對照，沒有冒充本輪重跑舊版。','實機、真人盲辨、乾淨機效能與Muse複審分數：BLOCKED，需求見CODEX_RESPONSE_CONTENT_R9.md。','']
(O/'REVIEW_INDEX.md').write_text('\n'.join(lines),encoding='utf-8')
print('VERIFIED',len(r['frames']),'actual captures indexed;',len(r['checks']),'UI checks')
