"""Exact, clickable phone screenshot paths for the five review requirements."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/content/r4'
b=json.loads((OUT/'browser-checks.json').read_text(encoding='utf-8'));assert b['status']=='VERIFIED'
def link(name):assert (OUT/name).is_file(),name;return f'[{name}]({name})'
def image(name):assert (OUT/name).is_file(),name;return f'[![{name}]({name})]({name})'
names={'river_carp':'河鯉','silver_dace':'銀鯽','river_perch':'溪鱸'}
text=['# 第四輪｜Muse 五項複審原圖索引','','VERIFIED：本機證據。點縮圖或檔名可開原尺寸PNG；主圖430×932，小手機320×568。遮字只隱藏文字與Logo，不換水面、不調時間。實體裝置／真人試玩／Muse獨立分數仍BLOCKED。','','## 一、已解鎖後不再給節奏答案','','| 魚種 | 解鎖後進行中 | 第二次捕獲 |','| --- | --- | --- |']
for fish,label in names.items():
 p=next(f for f in b['screenshots'] if f'/phone-learned-{fish}-' in f)
 text.append(f'| {label} | {link(Path(p).name)} | {link(f"phone-pond-{fish}-caught-again.png")} |')
text+=['','## 二、同階段水面差異與三格動靜','','| 階段 | 河鯉 | 銀鯽 | 溪鱸 |','| --- | --- | --- | --- |']
for phase in ['pre-sink-masked','submerging','masked']:
 text.append('| '+phase+' | '+' | '.join(image(f'phone-water-{fish}-{phase}.png') for fish in names)+' |')
text+=['','| 魚種 | 連續三格以上 | 筆記對照 | 冷卻開始／途中／已滿30秒 |','| --- | --- | --- | --- |']
for fish,label in names.items():
 frames=sorted(OUT.glob(f'phone-rhythm-{fish}-*.png'))
 text.append(f'| {label} | '+ '、'.join(link(p.name) for p in frames)+f' | {link(f"phone-note-{fish}-first.png")} | '+ '、'.join(link(n) for n in [f'phone-pond-{fish}-caught.png',f'phone-pond-{fish}-cooldown.png',f'phone-cooldown-{fish}-ready.png'])+' |')
text+=['','## 三、圖圖：裝籃、首送與配對並排','','| 裝籃近景 | 首送：空椅留點心 | 配對：空椅壓花＋桌上書籤 |','| --- | --- | --- |','| '+' | '.join(image(n) for n in ['phone-taste-child-plain-packed.png','phone-story-child-first.png','phone-taste-child-matched.png'])+' |','','## 四、窄手機完整操作列','','| 320×568 | 430×932 |','| --- | --- |','| '+image('phone-basket-320x568.png')+' | '+image('phone-basket-430x932.png')+' |','','兩視口都實點送餐／回灶台／重讀／回想；主鈕至多兩行，三次鈕各一行，至少48px高。橫向844×390、iPad768×1024、矮桌機1366×600亦有相同檢查。','','## 五、三人的情境回想與獨有配對回話','','| 居民 | 回想：無口味／食材名 | 配對：書籤＋專屬回話 |','| --- | --- | --- |']
for who,label in [('merchant','蘿拉'),('elder','班伯'),('child','圖圖')]:
 text.append(f'| {label} | {image(f"phone-recall-{who}-context.png")} | {image(f"phone-taste-{who}-matched.png")} |')
text+=['','## 前輪未見證據：完整矩陣、離線與來源收據','','| 居民 | 首送 | 錯配 | 配對 | 農場首送／錯配／配對 | 離線重載 |','| --- | --- | --- | --- | --- | --- |']
for who,label in [('merchant','蘿拉'),('elder','班伯'),('child','圖圖')]:
 text.append(f'| {label} | {link(f"phone-story-{who}-first.png")} | {link(f"phone-taste-{who}-wrong.png")} | {link(f"phone-taste-{who}-matched.png")} | '+'、'.join(link(f'phone-memory-{who}-{s}.png') for s in ['first','wrong','matched'])+f' | {link(f"phone-story-{who}-offline.png")} |')
text+=['',link('phone-note-offline.png')+'：魚筆記離線重載。','','| 本機收據（非獨立審查） | 原圖 |','| --- | --- |']
for name,label in [('checks','自動檢查與全部CI瀏覽器命令'),('art-r3','前輪三張場景來源／輸出hash'),('art-r4','本輪兩張美術來源／輸出hash'),('integrity','版本、秘密掃描、保存與效能邊界')]:
 text.append(f'| {label} | {link("phone-receipt-"+name+".png")} |')
text+=['','## 全部最終原尺寸檔','','以下不含初跑失敗圖；初跑保留在initial-attempt/。','']
for p in b['screenshots']:
 text.append('- '+(link(Path(p).name) if p.startswith('docs/content/r4/') else f'[{p}](../../store/screenshots/{Path(p).name})'))
(OUT/'REVIEW_INDEX.md').write_text('\n'.join(text)+'\n',encoding='utf-8')
print('VERIFIED exact five-item screenshot index:',len(b['screenshots']),'files')
