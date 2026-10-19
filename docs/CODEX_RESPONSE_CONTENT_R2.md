# 陽光農場｜新內容第二輪

2026-10-19，main，起點86621cc。版本 **0.1.25／content-r2-20261019-1**。本輪只處理 Muse 第一輪最後五項；功能、截圖與自動驗證狀態見下方，真人、實體裝置與穩定出貨條件不以自動測試代替。

**VERIFIED：本機三項內容、80項新內容瀏覽器檢查、既有現行CI、六張美術與原尺寸證據。BLOCKED：桌機釣台18ms、乾淨機況／實機與真人驗收、Muse獨立8分。**

## 三項內容、入口與操作

| 內容 | 本輪修訂 | 正常遊玩入口 |
| --- | --- | --- |
| 餐籃送到以後 | 三篇重新生成較粗像素插圖，保留第八輪色盤、紅格餐籃與右上暖光。首次明寫「還沒送過」，收到才出現重讀。搬送時明示麥餅尚未取用，走到居民旁的既有農務作用幀才扣料；可以取消。 | 底列「更多」→「故事」→「裝一份鄰居餐籃」，或灶台同名入口。學會麥餅後烹調、選居民、裝籃、送到。 |
| 池塘的三種脾氣 | 放大浮標，河鯉兩短點與圓紋、銀鯽長停與急沉、溪鱸橫移尾流與停頓。下沉當幀才提示提竿；提前點灰色等待鈕只得到早提原因，不給魚。過時自動結束並說原因。成功移除提竿字樣，明示魚名×1已入簍、容量與30秒倒數。三魚各有一張筆記插圖與個別紙頁。 | 修復地圖「河畔釣台」後點釣台；看水面下沉再提竿。底列「河畔筆記」可重讀已釣到的魚。 |
| 鄰居的口味記憶 | 餐籃頁不再重貼上次偏好，讓玩家回想。原味說清楚是初訪一份麥餅、之後也收下但不算配對。首送、錯配、配對各有不同回話，農場點居民交談會透過可見對話框提起最近餐籃。 | 同一餐籃入口，送後回農場點原居民，再按「交談」。甜加胡蘿蔔、酸加野莓、熱回烤；第二次起送對才出現「你記得的那一味」。 |

## 唯一五項驗收對照

所有下列`content/r2/`圖片均為瀏覽器原尺寸PNG，不是縮圖或排版合成。完整路徑／當時玩家位置、姿勢、食材、交付次數、浮標階段、魚簍數值在`content/r2/browser-checks.json`。

1. **六頁插圖與缺圖守門：VERIFIED。** 320×568、430×932各實際開三篇與三筆記；每頁等待圖片decode，檢查可見尺寸與原稿hash。故意阻斷六張圖各一次，測試必須拋出含檔名的錯誤，玩家看到明確錯誤訊息，沒有無聲空白。例：`content/r2/phone-note-missing-art.png`。原R1空白截圖的確切原因未重現，不將先前隱藏樣式推測當作已證實根因。
2. **釣魚狀態與回饋：自動驗證VERIFIED；新玩家口頭辨識BLOCKED。** 等待、早提、晚提、真正下沉、成功與冷卻各有截圖；成功紙頁不再有「提竿」文字。六次UI捕獲、三次真等30秒、倒數與重載驗證可重跑。尚需未看說明的新玩家實玩三魚各兩次並口述狀態。
3. **三魚可見軌跡：程式／連續圖VERIFIED；5人≥80%盲測BLOCKED。** 三魚各三格原尺寸圖在下表。read-only視覺觀察與提竿判定逐毫秒／邊界對帳；真正下沉取消CSS延遲，浮標消失與可提竿在同一render更新。沒有把三格圖稱為完整錄影逐格檢查或真人辨識率。
4. **生活口味記憶：自動操作與截圖VERIFIED；無攻略玩家回述BLOCKED。** 三人各完成首送→錯配→配對，以及每階段離開餐籃、實際點原居民交談。熱味另拍選取／成本、送出後回話與農場回話。需要新玩家第二次自行說出選味依據才能完成該項真人驗收。
5. **效能歸因：同時段對照EXECUTED，完整出貨驗收BLOCKED。** 不把並發主機當乾淨機況，也不將手機模擬當實體手機。18ms門檻原樣保留；原始紀錄與最終數值見後段。

### 六頁兩尺寸的逐張證據

| 畫面 | 320×568 | 430×932 |
| --- | --- | --- |
| 蘿拉短篇 | `content/r2/phone-six-320-story-merchant.png` | `content/r2/phone-six-430-story-merchant.png` |
| 班伯短篇 | `content/r2/phone-six-320-story-elder.png` | `content/r2/phone-six-430-story-elder.png` |
| 圖圖短篇 | `content/r2/phone-six-320-story-child.png` | `content/r2/phone-six-430-story-child.png` |
| 河鯉筆記 | `content/r2/phone-six-320-note-river_carp.png` | `content/r2/phone-six-430-note-river_carp.png` |
| 銀鯽筆記 | `content/r2/phone-six-320-note-silver_dace.png` | `content/r2/phone-six-430-note-silver_dace.png` |
| 溪鱸筆記 | `content/r2/phone-six-320-note-river_perch.png` | `content/r2/phone-six-430-note-river_perch.png` |

### 節奏、回饋與原先「未見證據」項目

以下皆430×932，放在`docs/content/r2/`：

| 證明項目 | 原尺寸截圖檔名 |
| --- | --- |
| 河鯉兩次短點→下沉 | `phone-rhythm-river_carp-1.png`、`phone-rhythm-river_carp-2.png`、`phone-rhythm-river_carp-3.png` |
| 河鯉補拍：短點→浮回→第二短點→下沉 | `phone-rhythm-carp-tap-one.png`、`phone-rhythm-carp-returned.png`、`phone-rhythm-carp-tap-two.png`、`phone-rhythm-carp-submerged.png`；`carp-continuity.json`記錄實際時間與transform，四格後真正提竿入簍 |
| 銀鯽長停前後→急沉 | `phone-rhythm-silver_dace-1.png`、`phone-rhythm-silver_dace-2.png`、`phone-rhythm-silver_dace-3.png` |
| 溪鱸橫移→停住→下沉 | `phone-rhythm-river_perch-1.png`、`phone-rhythm-river_perch-2.png`、`phone-rhythm-river_perch-3.png` |
| 等待／早提／晚提／成功／真實倒數／第二尾 | `phone-pond-river_carp-waiting.png`、`phone-pond-river_carp-early.png`、`phone-pond-river_carp-late.png`、`phone-pond-river_carp-caught.png`、`phone-pond-river_carp-cooldown.png`、`phone-pond-river_carp-caught-again.png`；銀鯽與溪鱸同樣各六張，檔名前綴分別換成`phone-pond-silver_dace`、`phone-pond-river_perch` |
| 走到居民旁、肢體姿勢與到達前尚未扣料 | `phone-delivery-walking-1.png`、`phone-delivery-walking-2.png`、`phone-delivery-walking-3.png`，到達後`phone-story-merchant-first.png`；取消前後`phone-delivery-cancel-before.png`、`phone-delivery-cancel-after.png` |
| 三人首送短篇 | `phone-story-merchant-first.png`、`phone-story-elder-first.png`、`phone-story-child-first.png` |
| 三人錯配與配對 | `phone-taste-merchant-wrong.png`、`phone-taste-merchant-matched.png`；`phone-taste-elder-wrong.png`、`phone-taste-elder-matched.png`；`phone-taste-child-wrong.png`、`phone-taste-child-matched.png` |
| 三人農場首送／錯配／配對回話 | `phone-memory-merchant-first.png`、`phone-memory-merchant-wrong.png`、`phone-memory-merchant-matched.png`；班伯與圖圖同樣各三張，`merchant`換成`elder`、`child` |
| 熱味完整操作 | `phone-taste-elder-hot-packed.png`→`phone-taste-elder-matched.png`→`phone-memory-elder-matched.png` |
| 新圖實際離線載入 | `phone-note-offline.png` |

連點只扣一次屬事件計數證據：UI連點前後麥餅差1、交付次數差1，由`browser-checks.json`與單元測試共同證明；靜態圖片本身無法證明沒有重複callback，沒有把單張圖當成該項充分證據。角色走路／農務沿用真姿勢，physics root與collider未改；浮標是物件動畫，沒有冒充角色動畫。無戰鬥，攻擊／受擊／死亡不適用。

## 自動測試與效能

VERIFIED：`npm test`、新增R2單元3組與瀏覽器80項、全部現行既有CI的17支腳本（含R79的44項、R75的370項）、water-guide與night-gate皆exit0。RWD九視口／overlay開關零違規，控制可達性339項／七裝置通過，第82至89輪美術守門全部通過。完整命令、耗時、exit code寫入`content/r2/regression-checks.json`、`content/r2/logs/`；功能結果`content/r2/browser-checks.json`。不是聲稱repo所有歷史、已退役UI腳本都重跑。

資料庫起始fixture只供章節、釣台與材料；麥餅由實際烹調、九次交付由路徑／作用幀執行，六尾魚由真正等待與提竿取得。沒有快轉時鐘、注入魚或清除冷卻。搬送三格的真走路frame依序0、2、4，麥餅都是10份；到達後才9份，不是單圖位移冒充走路。

補拍腳本首次因尚未等釣台DOM建立就讀dataset而失敗；補上等待可見後，四個實際姿勢及捕獲斷言重跑通過，未放寬斷言。初次非零結果及修正後紀錄均保留於logs與regression-checks，不將初次錯誤藏成從未發生。

效能初次交錯對照：06d7555桌機33.3／16.8／33.3ms，86621cc桌機16.8／33.3／33.3ms；兩版手機模擬皆16.7–16.8ms。舊版也重現33.3ms，尚無支持「只由新內容造成退步」的證據，與共享主機／桌機呈現負載干擾相符，不能據此保證乾淨機況達標。`content/r2/performance-before.json`保留每一個rAF間隔、時間戳與交錯順序。

最終`performance-complete-fixture-comparison.json`用第一章三個claim、修復釣台的相同前置，交錯測06d7555、86621cc及本輪工作樹。每次新無頭Chromium、DPR1、4.2秒暖機、真實重拋、180ms穩定、4秒rAF取樣、去前5筆、ceil(n×.95)取p95。舊釣台是其當版原有滑條，其餘fixture／瀏覽器／取樣法相同；不是把不同玩法畫面冒稱逐像素相同。門檻保留18ms，不加瀏覽器降載旗標、不關閉農場視覺。新UI改為只讀觀察、每秒讀容量／冷卻、狀態改變才寫DOM，避免每幀正規化整份存檔。

| 釣台，完整前置／同時段交錯 | 桌機1366×768三跑p95／中位 | 手機模擬390×844三跑p95／中位 |
| --- | --- | --- |
| 06d7555美術第八輪 | 16.8／33.3／33.3；33.3ms | 16.8／16.7／16.7；16.7ms |
| 86621cc新內容第一輪 | 33.3／33.4／16.8；33.3ms | 16.8／16.7／16.7；16.7ms |
| 本輪 | 33.3／33.3／33.3；33.3ms | 16.8／16.7／16.7；16.7ms |

**BLOCKED：本輪桌機嚴格18ms斷言exit1，原樣保留。** 三版完整前置的桌機中位皆33.3ms；舊版也在16.8與33.3ms間變動，早期部分前置診斷的本輪亦曾16.8ms。沒有足以將問題單獨歸因R1新增程式的證據；場景／進度與共享桌機呈現負載皆是限制，尚未隔離出單一外部程序或確定根因，不能保證乾淨機況達標。

另已查核第八輪`docs/evidence/r89-art/performance.json`的來源實為R79陽光農場，當時桌機16.8／16.7／16.8ms；它與新釣台不是同一場景，不能直接用舊數字判定新內容退步。這輪現行R79農場桌機、手機三跑中位均16.8ms。

補充三版共同診斷存檔的陽光農場量測在`content/r2/performance-sunpatch-comparison.json`，採同一R79取樣法，但部分章節／釣台fixture與R79原本新存檔不同，檔案已註明。另用**R79原本全新存檔＋worldBegin、沒有章節／釣台fixture**交錯量06d7555與本輪，存`content/r2/performance-sunpatch-original-comparison.json`。場景與fixture分開記錄，不拿農場通過覆蓋釣台失敗。

R79原始場景同時段結果：06d7555桌機16.7／16.7／16.7ms、手機16.8／16.7／16.7ms；本輪桌機16.7／16.8／16.8ms、手機16.8／16.8／16.8ms，十二次全部≤18ms。這排除原R79量測下可重現的新內容效能退步；不能外推為釣台／後續進度都達標。

早期診斷fixture僅設定`c1_first_harvest`及修好釣台，沒有聲稱完成第一章，其原始數字留存但不作完整遊玩證明。另以第一章三個claim完整前置、同一修復釣台的狀態交錯三版，結果在`content/r2/performance-complete-fixture-comparison.json`，作為本輪釣台最終判定依據。

## 美術、商店圖與保留範圍

新增 **6張美術**：三居民短篇＋三魚筆記。實際工具`image_gen.imagegen`，未揭露模型slug，manifest為null。原圖每張1774×887，保留原檔；以256×128群組像素採樣、nearest放回512×256，精確套用第八輪色盤，保留1px群組輪廓、hue-shift與右上暖光。原角色姿勢、無縫地面與暖光素材保留。

提示詞`art/PROMPTS_CONTENT_R2.json`；原稿`art/masters/content-r2/`；runtime六圖與SHA-256在`../assets/generated/content-r2/manifest.json`。既有R1素材與商店圖保留。新增商店圖：`store/screenshots/iphone-08-neighbor-story.png`（1290×2796）、`store/screenshots/ipad-08-neighbor-story.png`（2064×2752），直接以DPR3／DPR2擷取本輪已實際完成的圖圖短篇。章節／起始食材fixture明示，未宣稱整份進度從零取得。

八項品質檢查沿用原有角色、地面與圖示；新增內容只使用生成插圖與原生紙頁，固定底列可返回，手機直橫／iPad由現行RWD及控制可達性測試驗證，命中至少44px，沒有手機鍵盤提示。新原尺寸證據共82張（80張手機直式、2張商店圖），不含歷史回歸歸檔。

老測試重產物先歸檔本輪，再依初始hash還原：2,972份既有檔逐bytes驗證一致，269份重產物另存本輪；八張起點不存在、由舊測試新產出的商店舊命名圖確認不在初始清單後移入回歸歸檔。起點既有未提交R68 manifest與未追蹤檔均保留。還原收據`content/r2/historical-readback.json`，沒有把原有商店圖刪掉或換成本輪版本。

## 未完成、風險與狀態

**Apple4.3風險：中，本線自評。** 本輪以送到鄰居、從回話記口味與觀察浮標作為差異，沒有新增通用任務／徽章／抽卡。仍未檢查同開發者全部原生Bundle與市場相似作品，不能當作通過保證；此為根據[Apple官方4.3](https://developer.apple.com/app-store/review/guidelines/#spam)「重複Bundle與難以區辨作品」規定的風險推論（2026-10-19查閱），不是Apple審查結果。

**BLOCKED**：乾淨機況桌機三跑、實體手機三跑p95≤18ms與拋竿到冷卻全流程；五名未讀筆記玩家的≥80%魚種辨識、無攻略玩家的狀態／選味口述、實體iPad／iOS Safari／Android測試、Muse獨立複審8分。需要提供裝置與相應測試者／複審結果。沒有宣稱可上架或已達8分。

本輪只本機commit；無push、部署、商店後台、對外訊息、外部派工、可見視窗、SDK或遊戲外連。秘密掃描只限repo，未讀取秘密目錄。最終hash／尺寸／版本鏈／語法與掃描收據`content/r2/release-readback.json`。

最終讀回VERIFIED：版本鏈與runtime舊版本參照零殘留、六張美術及其原稿／參考hash、82張PNG尺寸、秘密掃描零命中；語法與檔案保留亦通過。這份VERIFIED只指功能與產物完整性，效能／實機／真人／獨立複審的BLOCKED仍保留。

繁中文案mode2摘要：原「釣到了」卻仍顯示提竿→將等待、咬鉤、完成分開，成功寫「溪鱸×1已放進魚簍」，原因是舊狀態易誤導；原餐籃頁直接重貼口味反應→改為「今天想帶哪一味？想想上回坐在一起時說的話」，原因是保留生活回想；原味只寫「先送一份」→補清楚消耗一份麥餅且不算後續口味配對。三人新增錯配句各自對應生活場景，數值與配料規則保留。
