# 陽光農場 R86｜美術第五輪

2026-10-18，main，起點 `1fa220d`。版本 **0.1.20 / r86-20261018-1**。只處理 ART_RESCORE4_MUSE 第四節五項，並對照第三輪未解的陽光、三件套與浮層遮擋。沒有新增系統、關卡或故事頁。

**VERIFIED：本機素材、整合、截圖與測試。BLOCKED：獨立8分複評、真人辨識與原生實機；不宣稱已達8分。**

## 唯一五項驗收與原尺寸證據

| Muse驗收項目 | 改動與驗證範圍 | 改後原尺寸截圖 |
|---|---|---|
| 1. 圖3／5底部結構、完整文字與邊框 | 導覽移到內容上方，返回獨立48px底列；說明不再與導覽爭高度。紙面與8px紅格裝訂分層，外框overflow裁齊。六視口檢查列間無重疊、控制≥44px且中心命中；手機直式整冊不用捲動。 | `docs/store/screenshots/iphone-03-basket.png`、`ipad-03-basket.png`；`iphone-05-daily.png`、`ipad-05-daily.png`。iPhone 1290×2796、iPad 2064×2752，以下相同。 |
| 2. 發光耕地改成葉隙陽光 | 新生成樹枝與葉緣明暗圖，以亮度遮罩分出不均透光、斜向樹影及半影。光跨草地與土壟；樹影由樹根往右下落；人物帽肩有左上暖光。刪掉十個均勻CSS光點，測試改為精確驗證實際生成圖、可見display與投影範圍。無文字圖可見方向，真人三秒盲測仍BLOCKED。 | `iphone-02-sunlight.png`、`ipad-02-sunlight.png`；無文字完整圖：`docs/evidence/r86-art/390x844-no-text.png`、`430x932-no-text.png`、`1032x1376-no-text.png`。 |
| 3. 同作物、同齡、同大小對照 | 第六張是明示的視覺fixture：兩株小麥同一plantedAt、同一階段、同一atlas frame，光內葉片大14%、略亮與淡金邊，光外原色。這是可重現的實際遊戲渲染，沒有當成玩家真實賺得的進度。圖2則保留真實澆水帶來的加速與生長差，不冒稱兩株精確同齡。 | `docs/store/screenshots/iphone-06-same-age.png`、`ipad-06-same-age.png`；時間／階段／frame：`docs/evidence/r86-art/art-validation.json`。 |
| 4. 三件套、比例、落影 | 先鎖正側背＋三表情設定表，再生成四向行走／農務。大紅白格帽帶、藤簍編織與簍口紅格布，取代硬背包輪廓。相對R85縮小約10%，最小40px；靴下橢圓接觸影與樹根影更清楚。physics tile、尋路與430ms作用時間保留。64px圖由本機自審，不冒稱真人辨識測試。 | 兩種圖2與圖6；`docs/art/character-sheets/miri-r86.png`；`docs/evidence/r86-art/character-three-views-64.png`、`character-side-64.png`。 |
| 5. 統一進度、三種章 | 冊內只用「今日 n/3」，開冊時隱藏後方章節HUD，消除0/9與完成3項並存。三種同紅泥圓章為澆水壺、麥穗、餐籃；圖5由實際農務與領取取得。新增測試核對精確三條圖源、三個不同章與今日3/3。真人五秒辨識仍未做。 | `docs/store/screenshots/iphone-05-daily.png`、`ipad-05-daily.png`。 |

## 新素材、畫風與授權

**8張生成母圖、19張runtime圖片；實際工具 `image_gen.imagegen`，精確模型slug未揭露，manifest為null。** 未用API型號名稱代替工具證據。

- 角色設定表、四向各6幀行走、澆水／農務各四向6幀、三表情與相容農務圖集。生成側向列方向有誤，重排完整行走列、逐姿勢鏡像農務左向列；沒有用單圖平移／旋轉／縮放冒充動作。
- 地面葉隙光／樹影母圖，輸出透光、影與合成遮罩；三種紅泥印章；生成紙面與裁切的舊紅格裝訂；生成澆水作用幀中的藍色水滴；繁中Logo、App圖示64／192／512。
- 全套共用暖鄉村色盤、左上光與深茶描邊；人物48×64 native、共用68色盤、最近鄰。葉緣半影保留alpha；角色與圖示二值alpha、透明RGB清空。需要去背的表情用連通外側奶油matte移除，其餘保留工具真alpha。流程依VISUAL_REFRESH_PLAN的cutout與alpha檢查，不將棋盤格當透明。
- 暖餐籃／手記語言與工作單的交通、末日、元素戰場、卡牌與寫實反詐不同；只以工作單與本作證據比較，沒有修改或宣稱審查其他repo。

母圖 `docs/art/masters/r86/`、`docs/art/character-sheets/`；實際完整提示詞 `docs/art/PROMPTS_R86.json`，入口PROMPTS.json。來源／輸出SHA-256、逐幀hash及下半身差、雙閘門原值在 `assets/generated/r86/manifest.json`。CREDITS.md追加，沿用素材授權保留。

六張人物輸出均通過亮度0.30–0.75、近黑<35%、飽和≥0.32、低飽和<20%。紙張／印泥與光影是材質或單色圖示，不冒稱通過人物飽和度閘門。新增圖片 **501,159 bytes**；Web runtime由104,818,477增為105,396,487 bytes，**增加578,010 bytes，約0.55 MiB**，見 `docs/evidence/r86-art/package-size.json`。既有發布allowlist不包含docs母圖與證據，未建IPA／AAB，不把Web差額當原生包體。

## 截圖與驗證

修改前嚴格自審：`docs/art/ART_REVIEW_R86.md`。計畫：`docs/OPTIM_PLAN_R86.md`。同場景前／後各16張：`docs/art/compare/r86/before/`、`after/`；總覽 `overview.webp`。前輪商店圖原樣存 `before/store/`。

本輪商店12張為無頭Chromium原尺寸畫面，沒有宣傳合成。01–05由真實操作、真實時間完成種植、澆水、收成、送籃與領取；只有鏡頭聚焦，無注入庫存、進度、光區或加速時鐘。圖2捕捉澆水作用幀；粒子縮小，避免遮住主角。06是明示精確同齡fixture，與真實流程分開。來源、時序與hash在 `store-journey.json`、`art-validation.json` 和 `docs/store/screenshots-manifest.json`。

最終結果：

| 檢查 | VERIFIED結果 |
|---|---|
| npm test、實際CI npm run test:e2e | 全部exit0。指定R79真實玩法44項通過；R75完整第一章、R80每日農務、R81真實雙送法／離線重開／旋轉、RWD與控制可達性、R82–R85美術守門均綠。沒有刪除測試或放寬行為斷言。 |
| 本輪美術 | 104項通過；六視口320×568、390×844、430×932、844×390、1032×1376、1366×600。三章不同、單一今日3/3、導覽／說明／返回不重疊、44px命中、精確同齡同frame及physics分離。 |
| 夜間、澆水引導 | 夜間四季／七天氣、桌機與手機澆水引導通過；成熟作物不因水壺輸入誤收。 |
| 效能 | 桌機p95三跑16.8／16.8／16.8ms；手機16.8／16.8／16.7ms；三跑中位皆16.8ms≤18ms。並發載僅參考，不能代替原生實機出貨測試。 |
| 素材／版本／秘密 | 8母圖、19輸出來源hash／尺寸、cutout四角與透明RGB讀回、六人物雙閘門通過；12張商店圖原尺寸hash讀回。全部runtime JS語法通過；版本鏈一致，舊runtime版本字串0；指定秘密模式0命中。未讀 `.secrets`。 |
| 真實商店流程 | iPhone24.705秒、iPad26.505秒，均在前三分鐘內；圖2是第4張澆水姿勢、作用已發生，圖5三項獎勵實領。06明示為精確同齡fixture。兩張歷史iPad輔助圖保留，未算成本輪12張。 |
| 歷史證據 | 145個被測試覆寫的歷史檔封存到本輪regression，再逐bytes還原起始內容，包含使用者原先R68修改；沒有刪既有未追蹤檔。 |

證據：`docs/evidence/r86-art/final-checks.json`、`verification.json`、`performance.json`、`regression-index.json`、`logs/`。首次CI因新增關閉鈕排版擠出橫式返回鍵而失敗，已改為標題與44px關閉鈕並排，先跑原R81檢查，再完整重跑CI全綠；首次失敗紀錄保留於 `logs/e2e-first.txt`。舊精確圖源／光斑DOM數量及分頁位置斷言依新設計更新為精確新圖、可見背景投影、導覽在正文上方與三種不同印章，不以空節點冒充實際葉光。所有瀏覽器及暫時server逐一執行，finally關閉。

## 未完成與風險

**Apple 4.3風險：中。** 餐籃紙冊、紅格藤簍與方向性葉影已進核心畫面及商店圖；帳號級產品相似度仍需獨立審查，不能以美術改完判成低風險。

BLOCKED：本輪獨立Muse複評、真人三秒光向／五秒進度辨識、原生iOS／Android／Safari／iPad實機。禁止外部派工與傳訊，沒有用自評冒稱獨立8分。主角64px及五項畫面只完成本機自審與確定性證據。

沿用缺件：男角色、非前3分鐘斧頭／建造／釣魚及部分後期季節物件尚未全面換裝。保留可替換atlas與原授權；不擴張其他畫面充數。無戰鬥，攻擊／受擊／死亡不適用。

繁中文案直接套用既有mode2：原「今天的小事・完成3項」改「今日3/3・澆水、收成、分享」，避免與背景章節誤讀；原同圖麥穗章改三種農務章，原數值與獎勵不變。葉光回饋去掉重複符號並上移，讓角色動作可見。

只做本機commit；無push、部署、商店後台操作、外部派工、傳訊或讀取 `.secrets`。
