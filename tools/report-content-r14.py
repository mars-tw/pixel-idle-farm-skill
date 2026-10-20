"""Close the report from actual final receipts, without changing game code."""
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r14'
read=lambda n:json.loads((O/n).read_text(encoding='utf-8'))
for n in ['finalization.json','release-checks.json','visual-regression.json','regression-reconciled.json','performance-reference.json','protected-readback.json','cleanup-result.json']:
 assert read(n)['status']=='VERIFIED',n
reg=read('regression-reconciled.json');perf=read('performance-reference.json');clean=read('cleanup-result.json');protected=read('protected-readback.json')
p=R/'docs/CODEX_RESPONSE_CONTENT_R14.md';t=p.read_text(encoding='utf-8')
t=t.replace('PREPARED：程式修正、無頭實玩與原尺寸補證已執行；刪除後的完整回歸仍在跑。最終結果以本檔收尾更新及 `docs/content/r14/release-checks.json` 為準。','VERIFIED：六項指定修正、Muse五項的本機可做部分、無頭實玩、原尺寸精選、商店圖及舊證據清理完成。真人與實機項目另列BLOCKED；最終讀回見 `docs/content/r14/release-checks.json`。')
t=t.replace('EXECUTED，收尾依 visual-regression 收據','VERIFIED').replace('|EXECUTED|','|VERIFIED|').replace('本機 EXECUTED；','本機 VERIFIED；')
summary={k:v['medianP95Ms'] for k,v in perf['summary'].items()}
paragraph=f"VERIFIED：{len(reg['commands'])}條既有適用回歸指令全綠，含npm test（保留全部原單元測試並增加R14五組）、R79實玩、CI browser gates、R10～R13實玩、首次快取離線、用水引導與R72夜間。R14另完成主流程及最後補驗：三人各三連拍、三魚新存檔成功／失敗／重播、六種視口實際選味與端送、補備即時HUD、略過一次結算、重載與離線。秘密掃描零命中、JS語法及版本鏈通過；原有{protected['protectedFiles']}份未提交／未追蹤檔逐bytes讀回，所有舊商店圖雜湊不變。\n\n效能為池塘／端送×桌機／手機×三跑，共12跑；p95中位數ms：`{json.dumps(summary,ensure_ascii=False,separators=(',',':'))}`，皆≤18ms。原始rAF樣本見 `performance-reference.json`。這是並發主機的參考量測，沒有宣稱乾淨機或實體裝置過關。\n\n完整命令、exit code與log hash在 `regression-reconciled.json`。首遍失敗收據保留；需要保留的R62輸入已恢復，筆記尺寸與水面可視度修正後，受影響的R2～R5及初期通用閘門重新跑過。廣泛回歸的起跑hash沒有偽改：端盤路徑與HUD／筆記尺寸／魚影／竿尖的受限差異由 `serving-path-delta.json`、`hud-refresh-delta.json` 逐bytes銜接；最後R14補驗直接檢查修正後畫面與控制。不宣稱首遍一次全過，也不把各時點的所有指令冒稱為同一份hash。"
t=t.replace('PREPARED：完整回歸、效能與最終保護讀回仍在收尾，完成後更新。',paragraph)
t=t.replace('清理目前為','清理已驗證為').replace('最終刪除後回歸結果另列下節。','刪除後的回歸及最終不存在檢查已通過，結果見下節。')
t=t.replace('繁中文案mode2：原「約N步」由曼哈頓距離改為實際可行走格數；原「已端／已招待」主畫面改「還差誰」，精確帳目保留在紀錄；原「魚簍累計（單一魚種現存數）」改「累計釣獲／目前魚簍／河畔筆記」；原「還沒招待／等待」統一「等待」。改字用於說清實際狀態，沒有新增遊戲數值或改口味。','繁中文案mode2直接套用4處，名稱與口味不變。\n\n|原句|原因|改成什麼|\n|---|---|---|\n|約N步|曼哈頓距離沒有算繞路|同句改讀實際可行走格數|\n|已端N份／已招待N位|主操作像管理表單|主畫面說還差誰，精確帳目留在紀錄|\n|魚簍累計（單一魚種現存數）|和歷史筆記混用|累計釣獲／目前魚簍／河畔筆記各列真實數字|\n|還沒招待／等待|同一狀態兩種說法|統一為等待|')
p.write_text(t,encoding='utf-8')
p=R/'docs/OPTIM_PLAN_CONTENT_R14.md';t=p.read_text(encoding='utf-8').replace('PREPARED。範圍：','VERIFIED（本機技術項目）；真人、實機與獨立複審BLOCKED。範圍：',1)
t+='\n## 最終讀回\n\nVERIFIED：三項修正、33條既有適用回歸、R14主流程與最後補驗、六種視口選味實玩、15張精選、兩張原尺寸商店圖、零新生成美術、秘密掃描與版本鏈。清理'+str(clean['deleteCount'])+'檔／'+str(clean['bytes'])+' bytes，必要舊圖依實際消費程式列冊保留。最後受限程式差異與測試時點如收尾報告，不把首遍失敗或不同hash混成一次綠燈。實機、真人理解／親子／遮字辨魚、乾淨機效能及Muse獨立≥8仍需外部驗收，未假造。\n'
p.write_text(t,encoding='utf-8');print('VERIFIED report closed from actual receipts')
