"""Write the Traditional Chinese evidence index directly from a UTF-8 source file."""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'docs/content/r5'
lines = ['# 第五輪原尺寸證據索引', '',
         'VERIFIED：本機實際UI旅程126項檢查、92次原尺寸擷取。本頁是開發驗證索引，不是獨立評分。', '',
         '精選集只有15張、三項各5張：`review-set/`。每張逐bytes複製原始擷取，無裁切、縮放、拼貼。01–02為同一次送餐真走路姿勢，07–08與09–10為同一竿沉前／下沉，14為口味決策進行中。其餘完整驗收圖保存在本目錄。', '',
         '## 1．320／430三人餐籃與故事全文', '',
         '頂部／底部是同一正文的捲動位置，固定四鈕均≥48px，主鈕≤2行、次鈕各1行；已實點送出、回灶台、重讀、回想。', '',
         '| 居民／寬度 | 餐籃頂部 | 餐籃到底 | 故事頂部 | 故事到底 |',
         '| --- | --- | --- | --- | --- |']
people = [('merchant','蘿拉'),('elder','班伯'),('child','圖圖')]
for who, name in people:
    for width in [320,430]:
        names = [f'phone-basket-{who}-{width}-top.png', f'phone-basket-{who}-{width}-bottom.png',
                 f'phone-story-{who}-{width}-top.png', f'phone-story-{who}-{width}-bottom.png']
        lines.append(f'| {name}／{width} | ' + ' | '.join(f'[原圖]({p})' for p in names) + ' |')
lines += ['', '## 2．三魚同階段原圖／遮字並排', '',
          '只以CSS隱藏DOM文字及Logo，不替換水面，不改時鐘或魚種；同一竿兩張均驗證phase相同。形狀測量來自實際Canvas像素。', '',
          '| 魚／階段與兩個差異點 | 原圖 | 遮字原圖 |', '| --- | --- | --- |']
fish = [('river_carp','河鯉','三個封閉同心圓、左右對稱寬圓面'),
        ('silver_dace','銀鯽','窄直中軸、縱向水線／飛濺，沒有側向尾流'),
        ('river_perch','溪鱸','向右的長三角尾流、右端雙環及斜浮標')]
for who, name, traits in fish:
    for stage, label in [('pre-sink','沉前'),('sinking','下沉')]:
        a, b = f'phone-pond-{who}-{stage}-original.png', f'phone-pond-{who}-{stage}-masked.png'
        lines.append(f'| {name}／{label}：{traits} | ![原圖]({a}) | ![遮字]({b}) |')
lines += ['', '## 3．等待、沉前與結束的單一狀態', '',
          '學會後等待／沉前／下沉不出現魚名與節奏答案。捕獲結果保留魚名與數量，讓玩家確認入簍。', '',
          '| 魚 | 首次等待 | 首次沉前 | 首次結束 | 學會等待 | 學會結束 |', '| --- | --- | --- | --- | --- | --- |']
for who, name, _ in fish:
    names = [f'phone-pond-{who}-{stage}.png' for stage in ['waiting','pre-sink','ended','learned-waiting','learned-ended']]
    lines.append(f'| {name} | ' + ' | '.join(f'[原圖]({p})' for p in names) + ' |')
lines += ['', '## 4．真正離線首次開圖與重試', '',
          'Service Worker完成預快取後切斷網路並重載；三人裝籃、首送、配對圖第一次開啟即解碼成功。異常注入只測原頁重試，不放精選集；重試前後的居民、口味、說明、麥餅及原料逐項相等。', '',
          '| 居民 | 離線裝籃 | 離線首次短篇 | 離線配對 | 原頁重試復原 |', '| --- | --- | --- | --- | --- |']
for who, name in people:
    names = [f'phone-basket-{who}-offline.png',f'phone-story-{who}-offline-first.png',
             f'phone-memory-{who}-offline.png',f'phone-basket-{who}-retry-restored.png']
    lines.append(f'| {name} | ' + ' | '.join(f'[原圖]({p})' for p in names) + ' |')
lines += ['', '## 5．三人記憶線齊全', '',
          '回想全文搜尋甜／酸／熱與食材字零命中。蘿拉以秤與陽光下的凳子、班伯以牆邊魚竿與灶旁盤子、圖圖以空椅與壓花呼應，各有不同的配對回話與紅格書籤。', '',
          '| 居民 | 首送 | 回想 | 錯配 | 配對前決策 | 配對 | 農場回話 |', '| --- | --- | --- | --- | --- | --- | --- |']
for who, name in people:
    names = [f'phone-story-{who}-first.png', *[f'phone-memory-{who}-{stage}.png' for stage in ['recall','wrong','choosing','matched','farm-response']]]
    lines.append(f'| {name} | ' + ' | '.join(f'[原圖]({p})' for p in names) + ' |')
lines += ['', '## 補充與資料邊界', '',
          '- [瀏覽器收據](browser-checks.json)：每張的真實時間、拋竿、phase、sprite、餐籃與魚簍狀態。',
          '- [精選集及商店圖尺寸／雜湊](screenshot-readback.json)：15張均為原尺寸、來源逐bytes相等，每項5張。',
          '- 商店圖：[iPhone 1290×2796](../../store/screenshots/iphone-11-stove-return.png)、[iPad 2064×2752](../../store/screenshots/ipad-11-stove-return.png)。',
          '- 橫式844×390、iPad768×1024、矮筆電1366×600：`layout-basket-<尺寸>.png`。',
          '- `before-*.png`直接複製R4原圖，來源與雜湊在截圖收據，沒有冒稱本輪之前重新實玩。',
          '- [最終讀回](release-readback.json)：21支瀏覽器守門、npm與補充守門全綠；95份JS、秘密零命中、3,972份歷史檔不變，runtime與驗證副本一致。',
          '- [效能原始資料](performance-reference.json)：12跑有3跑33.3ms，桌機農場中位33.3ms未達18ms，參考門檻BLOCKED；其餘三組中位16.8／16.8／16.7ms。共享主機原因尚未隔離。',
          '- 精選集不含缺圖、容量異常、效能與收據畫面。實體裝置、真人試玩、乾淨主機效能、Muse獨立≥8分仍BLOCKED。', '']
text = '\n'.join(lines)
assert '第' in text and '???' not in text
(OUT / 'REVIEW_INDEX.md').write_text(text,encoding='utf-8')
print('VERIFIED UTF-8 evidence index')
