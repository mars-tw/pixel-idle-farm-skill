"""Write the round closeout only after final readback passes."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'docs/evidence/r85-art'
def main():
 v=json.loads((E/'verification.json').read_text(encoding='utf-8'));assert v['status']=='VERIFIED'
 art=json.loads((E/'art-validation.json').read_text(encoding='utf-8'));journey=json.loads((E/'store-journey.json').read_text(encoding='utf-8'));index=json.loads((E/'regression-index.json').read_text(encoding='utf-8'))
 perf=json.loads((E/'regression/r79/r79-fun-e2e.json').read_text(encoding='utf-8'))['perf'];size=v['package'];phone,tablet=journey['journeys'];n=art['checks']
 report=f'''# 陽光農場 R85｜美術第四輪

工作單2026-10-17；實際收尾2026-10-18。版本 **0.1.19 / r85-20261017-1**，main，起點6145ae3。**VERIFIED：本機程式、素材與截圖；BLOCKED：真人三秒盲測、獨立8分複評與原生實機。** 本輪沒有新的Muse分數，不能宣稱已達8分。

本輪只執行 ART_RESCORE3_MUSE 第四節五項，並對照第二輪仍未收完的陽光、三件套、操作遮擋與世界承接。修改前自行重拍16張、逐畫面批評在 `docs/art/ART_REVIEW_R85.md`；方向、色票、字級與像素規格在 `docs/art/ART_DIRECTION.md`。

## 唯一五項驗收與原尺寸改後證據

| Muse五項 | 實作與驗收狀態 | 改後原尺寸截圖路徑 |
|---|---|---|
| 1. 陽光是一片區域 | EXECUTED：從單格擴為2.2×1.8格，10枚大小不同的羽化葉隙光、光內微塵、右下斜樹影。原問題是過大的角色擋住單格光，隔離讀回證明地形z-index正確。無文字實圖與開關差分證明光區可見；**真人三秒辨識仍BLOCKED**。 | `docs/store/screenshots/iphone-02-sunlight.png`（1290×2796）、`docs/store/screenshots/ipad-02-sunlight.png`（2064×2752）；無文字：`docs/evidence/r85-art/390x844-sunlight-no-text.png`。 |
| 2. 同作物光內外、落影 | VERIFIED本機：QA用完全同播種時間的小麥，光內有亮邊與較大葉片；人物雙腳挪到田側，人物與樹有接觸影，physics tile與430ms作用時序不變。正式圖2是實際播種、同階段的兩株，沒有注入作物／光／時間；秒數差異保存在moment資料，未冒稱正式圖完全同齡。 | 同上兩張正式圖2；精確同齡fixture：`docs/evidence/r85-art/390x844-sunlight.png`、`docs/evidence/r85-art/art-validation.json`；真實生長階段：`docs/evidence/r85-art/store-journey.json`。 |
| 3. 三件套與比例 | VERIFIED本機自審：先畫設定表，再生成四向行走與農務。紅格帽帶、紅格領巾、帶紅格布的藤簍，取代普通背包；整體視覺約縮15%，最小40px。64px審圖仍看得到三件套；沒有把單張晃動稱為動畫。 | 兩張正式圖2；`docs/art/character-sheets/miri-r85.png`、`docs/evidence/r85-art/character-three-views-64.png`、`docs/evidence/r85-art/character-side-64.png`。 |
| 4. 拆共用骨架 | VERIFIED：農務改日期帶領的印章冊，三牌同一單層棕框，完成章蓋在右上；原三籤改為日期控制＋兩個頁尾連結。餐籃有專屬格布橫幅，兩種商店畫幅可見。圖5的三枚印章由四株真實種植、澆水、收成與領取取得。 | `docs/store/screenshots/iphone-03-basket.png`、`docs/store/screenshots/ipad-03-basket.png`；`docs/store/screenshots/iphone-05-daily.png`、`docs/store/screenshots/ipad-05-daily.png`。 |
| 5. 三個瑕疵與像素密度 | VERIFIED：灰色污漬章改紅陶圓形麥穗章；兩格1／2改單格×數量、另列需求×2；故事全屏奶油紙，消除上方暗綠與下方半截農場。四張新敘事圖縮到128×64 native後最近鄰輸出384×192，與世界共用色盤；iPad／橫式採contain保留完整人物。農務情境鈕也接同套像素圖示。 | 兩張正式圖3；`docs/store/screenshots/iphone-04-note.png`、`docs/store/screenshots/ipad-04-note.png`。 |

## 新素材、模型與授權

**9張生成母圖、26張runtime圖片；實際工具 `image_gen.imagegen`。精確模型slug未揭露，manifest為null，沒有猜測GPT Image API型號。**

- 角色設定表先行，含正、側、背與三表情；行走四向各6真幀，澆水／農務各四向6真幀。外留白不均以透明谷底切割；水壺方向逐姿勢鏡像校正，並非單圖位移。
- 四幅新敘事背景：開場便箋／備籃／共坐後／門邊收到餐籃；六種地面材質壓低草地與步道對比。
- 新籃物件、麥穗、紅陶麥穗章、水壺、太陽、便箋、格布結、雙杯；紙面與布裝訂外框、繁中Logo、App圖示64／192／512。

來源：`docs/art/masters/r85/`、`docs/art/character-sheets/`。共同前綴及逐圖完整提示詞：`docs/art/PROMPTS_R85.json`，PROMPTS.json已索引。來源與輸出SHA-256、尺寸、68色盤、alpha、逐幀hash、下半身差異與品質原值：`assets/generated/r85/manifest.json`。CREDITS.md追加來源，原授權保留。

後製保留工具真alpha，native縮圖、二值alpha、透明RGB清空、共用68色盤、最近鄰；背景採無損WebP。6張人物runtime圖通過亮度0.30–0.75、近黑<35%、飽和≥0.32、低飽和<20%。紙面／裝訂紙與便箋共3張非人物表面未通過通用雙閘門，原始值完整保留，沒有稱它們通過人物閘門。

新圖 **{size['newImageBytes']:,} bytes**；Web runtime增加 **{size['deltaBytes']:,} bytes（約{size['deltaBytes']/1048576:.2f} MiB）**，詳 `docs/evidence/r85-art/package-size.json`。docs母圖、截圖與報告不在既有runtime發布allowlist；未建IPA／AAB，不把Web差額冒稱原生包體。

## 前後對照與真實商店擷取

`docs/art/compare/r85/before/`、`after/` 各16張，同場景390×844、844×390、1032×1376、1366×600；總覽 `docs/art/compare/r85/overview.webp`。前輪十張原商店圖存 `before/store/`。正式十張為本輪無頭Chromium頁面原尺寸截圖，無宣傳合成、無「原尺寸」／測試工具欄；並非原生實機證據。

`scripts/capture-r85-store.js` 以真實操作與真實時間種四株、澆水、收成、交付不同送法，再領三項日誌獎勵。iPhone完整流程 {phone['elapsedMs']/1000:.2f} 秒；iPad {tablet['elapsedMs']/1000:.2f} 秒。圖2捕捉澆水真幀與同階段光內外小麥；圖5是實際領取的印章。無注入庫存、進度、光區或加速時鐘；只有鏡頭聚焦。紀錄在 `store-journey.json`，尺寸與SHA-256在 `docs/store/screenshots-manifest.json`。

## 最終測試

| 檢查 | 結果 |
|---|---|
| npm test、實際CI npm run test:e2e | 均exit0；包含指定 `node scripts/test-r79-fun-e2e.js`。R75世界370項、R79 44項、R80 62項、R81真實雙送法／離線重開／旋轉、RWD與控制精確339項通過。 |
| 美術呈現與動作 | R82／R83／R84既有守門全綠；R85新增{n}項通過，含同齡對照、physics分離、10光斑、三章、單格數量、紙面故事與來源hash。走路腳部交替、澆水／收成預備—作用—恢復真姿勢；未刪既有測試或放寬時序／命中／庫存斷言。 |
| 夜間與澆水引導 | 4季×7天氣及桌機／手機六情境通過；成熟作物不被水壺誤收。 |
| 像素讀回 | 9母圖／26輸出、真alpha、透明RGB、68色盤、6人物雙閘門、原尺寸商店hash通過。光區開關差分：{v['pixels']['changedLuminanceFraction']:.1%}像素增亮>5／255，平均增亮{v['pixels']['meanLuminanceIncrease255']:.2f}／255；這不是人類三秒盲測。 |
| 效能 | 桌機三跑p95中位{perf['desktop']['medianP95Ms']}ms、手機{perf['mobile']['medianP95Ms']}ms，均≤18ms；並發載參考，不能代替乾淨實機出貨測試。 |
| 版本／秘密／語法 | package與lock0.1.19、runtime／SW版本鏈一致；舊runtime版字串0、秘密指定模式0、全部JS語法通過。未讀取任何 `.secrets`。 |
| 歷史證據保全 | {len(index['records'])}個被測試覆寫的歷史檔已封存至本輪regression並逐bytes還原起始內容，包含原先使用者R68修改；沒有刪既有未追蹤檔。 |

最終證據：`docs/evidence/r85-art/verification.json`、`final-checks.json`、`logs/`。第一次CI遇到R82舊故事檔名斷言，已改為新圖完整精確路徑；R83來源與R84庫存格斷言同步到新設計，保留行為驗證並加數量核對。首跑失敗日誌保留，最後一次完整CI全綠。全程依序一支瀏覽器腳本／暫時server，結束finally關閉。

## 未完成與風險

**Apple 4.3風險：中。** 本輪把陽光、紅格藤簍、紙面故事與印章冊做進核心遊玩及商店圖；同帳號各App的體驗差異仍需帳號級審查，不能只靠本輪美術判為低風險。

BLOCKED：真人三秒光區盲測、獨立8分複評、原生iOS／Android／Safari／iPad實機。沒有受測者或新獨立評分，且本輪禁止對外派工／傳訊，未用自評冒充Muse。**8分目標仍待驗收。**

沿用缺件：Kai、非前3分鐘斧頭／建造／釣魚與部分後期冬季物件尚未全面換裝，保留可替換atlas與原授權；本輪沒有改做新系統充數。本作無戰鬥，無新增攻擊／受擊／死亡動畫。

繁中文案依speak-human-tw及既有mode2直接套用。原「晨光日誌＋三分頁」改「今日印章冊＋日期＋兩頁尾連結」，原因為共用骨架；原兩格「1／2」改「×數量、需要×2」，原因為數量歧義。故事台詞、收成與交付數值保留。

只做本機commit；無push、部署、App Store Connect／Google Play操作、外部派工或對外訊息。
'''
 (ROOT/'docs/CODEX_RESPONSE_R85_ART.md').write_text(report,encoding='utf-8')
 p=ROOT/'docs/OPTIM_PLAN_R85.md';t=p.read_text(encoding='utf-8')
 if '執行結果：本機範圍VERIFIED' not in t:t+='\n執行結果：本機範圍VERIFIED，五項逐條證據、未完成與限制見 CODEX_RESPONSE_R85_ART.md；真人盲測／獨立8分複評仍BLOCKED。\n'
 p.write_text(t,encoding='utf-8')
 print('VERIFIED R85 closeout report written from final receipts')
if __name__=='__main__':main()
