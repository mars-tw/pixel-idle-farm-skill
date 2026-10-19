# 陽光農場｜新內容第一輪

2026-10-18 工作單，main，起點 `06d7555`。版本 **0.1.24 / content-r1-20261018-1**。

**EXECUTED：三項功能、存檔、離線與操作驗證 VERIFIED；效能穩定 p95 ≤18ms 仍 BLOCKED。** 沒有把曾經通過的一組量測當成穩定出貨證明。無新增功能缺件；只做本機 commit。

| 新內容 | 做了什麼、怎麼玩 | 正常入口與完成回饋 |
| --- | --- | --- |
| 餐籃送到以後 | 學會農家麥餅後，選蘿拉、班伯或圖圖，送一份真正烹調的麥餅。三人各有〈攤子外的那張凳子〉、〈灶火還留著〉、〈空椅子也有點心〉，各一張插圖與專屬回話。 | 底列「更多」→「故事」→「裝一份鄰居餐籃」；灶台也有同名入口。走到居民旁，在既有農務作用幀才扣料；首次送到開短篇，之後可按固定底列「重讀短篇」。連點只送一次，搬送途中可取消。 |
| 池塘的三種脾氣 | 河鯉短點兩下再沉、銀鯽長停後忽然下沉、溪鱸橫拉後停住再沉。看浮標而非綠區滑條，真正下沉才提竿；早提、晚提不給魚。 | 修好地圖上的河畔釣台後，直接點釣台。首次各魚會留下不同河畔觀察；固定底列「河畔筆記」可重讀。30秒冷卻會自動倒數，魚簍、魚種與筆記可存讀。 |
| 鄰居的口味記憶 | 第一籃先聽反應；之後自行選甜／酸／熱。甜另用胡蘿蔔×1，酸另用野莓×1，熱把麥餅回烤；每份都要麥餅×1。居民不下新訂單，也沒有答案清單。 | 同一鄰居餐籃入口。錯配仍有生活反應，第二次起送對口味才出現「你記得的那一味」與個別對話。已聽過的回話可重讀，平常與居民交談也會回應最近收到的餐籃。無新增金幣／經驗刷取。 |

## 自動驗證與證據

- `npm test` 最終重跑 exit 0；新增規則測試 **18組**，涵蓋三篇、三人錯配／配對、原子扣料、無效輸入、舊存檔、實際 localStorage 存讀、三魚時序、首次筆記、冷卻、容量、來源雜湊與 R89 色盤。
- 初次 `npm run test:e2e` 的 **16支原有現行CI腳本全部 exit 0**，包含指定 `node scripts/test-r79-fun-e2e.js`、四視口第一章實玩、RWD、控制可達性及 R82–R89 美術守門。R75 370項、R79 44項，均零失敗。完整串在最後新增釣台的效能檢查失敗，原始非零結果留存，**沒有宣稱整串命令最後一次 exit 0**。
- 修正後 `node scripts/test-content-r1-e2e.js` 最終 **114項功能檢查，exit 0**。實際點擊烹調10份、送出三人首籃／錯配／配對，驗證連點與取消、走到居民旁才扣料、重載、三種魚實際提竿、六尺寸控制命中及離線實玩。
- `node scripts/test-water-quest-guide.js`、`node scripts/test-r72-night-gate.js` 均 exit 0；夜間4季×7天氣通過。沒有刪除既有測試或降低其結算／冷卻／存檔斷言；舊釣魚E2E只將已退役綠區定位改成「浮標有變化且進入實際咬鉤階段」，仍保留精確一尾、30秒真實等待與重載斷言。
- 新功能測試明示中段 fixture：第一章解鎖、釣台及小麥20／胡蘿蔔5／野莓5；隨後料理、交付、扣料、提竿、存檔由實際UI完成。三魚測試只固定隨機魚種，沒有注入魚或回填冷卻。既有第一章另以真實種植、澆水、收成、烹調取得進度。
- PWA使用既有 `swtest` 入口，等待實際 activated／controller 狀態；讀回預快取後斷網，重新載入短篇與新美術、實際釣到一尾、寫筆記，再次離線重載驗證留存。沒有外連、SDK、帳號、廣告或內購。
- 完整命令、耗時、各次 exit code：`content/r1/final-checks.json`、`content/r1/logs/`。功能結果與35個截圖路徑：`content/r1/browser-checks.json`。語法80檔、版本鏈、原尺寸、hash、秘密掃描零命中：`content/r1/release-readback.json`。未讀取秘密目錄。
- 現行CI外的歷史舊UI腳本未冒稱全部執行；本次回歸口徑是 repo 現行 CI、指定 R79，以及上述補充守門。

## 效能：未穩定達標

| 場景 | 桌機三跑p95／中位 | 手機三跑p95／中位 | 狀態 |
| --- | --- | --- | --- |
| 既有R79陽光農場 | 16.8／16.8／16.8；中位16.8ms | 16.7／16.7／16.8；中位16.7ms | VERIFIED，僅並發參考 |
| 新釣台獨立暖機量測 | 16.8／16.8／33.4；中位16.8ms | 16.7／16.7／16.7；中位16.7ms | 這一次通過，未當成穩定證明 |
| 後續相同程式重測 | 16.8／33.3／33.3；中位33.3ms | 當次桌機失敗後停止，手機未測 | BLOCKED：未穩定≤18ms |

保留冷開33.4ms與暖機後仍33.3ms的失敗結果。各次量測均為共享主機、背景無頭；獨立量測每次使用新瀏覽器，先跑完一竿4.2秒，再真正重拋、取4秒rAF樣本，三跑取中位。沒有控制其他線路或聲稱乾淨機況。原因尚未完全隔離；原始農場剛載入的診斷也出現33ms尖峰。

已減少重複DOM寫入，浮標觀察改為80ms計時更新，僅文字／姿勢變化才改DOM，物件過渡交由CSS；提竿仍按真實時間判定。嚴格18ms斷言保留在 `npm run test:content:r1:perf`，與功能CI分開；依工作單「並發量測僅供參考」回報，不拿功能綠燈掩蓋效能未達標。

證據：`content/r1/performance-diagnostic.json`、`performance-diagnostic-before-dom-fix.json`、`performance-diagnostic-before-timer-fix.json`、`performance-diagnostic-cold-timer.json`、`browser-checks-first-performance-failure.json`、`browser-checks-unstable-performance.json`、`renderer-profile.json`。

## 美術與原尺寸截圖

新增 **4張插圖＋2件衍生素材**：三張居民短篇、河畔圖、河水細節與RGBA浮標。實際工具 **image_gen.imagegen**，模型slug未揭露，manifest為null。生成原稿實際887×1774，保留原檔；故事分割成與R89相同512×256原生尺寸，nearest-neighbor縮圖並套用**完全相同的R89色盤**，不以方塊、emoji或純色面代替美術。原有無縫地面與右上暖光保留。

提示與參考：`art/PROMPTS_CONTENT_R1.json`；原稿：`art/masters/content-r1/neighbors-pond.png`；素材尺寸、色盤、來源及SHA-256：`../assets/generated/content-r1/manifest.json`；可重製腳本：`../tools/process-content-r1-art.py`。既有角色走路／農務真姿勢、physics root、碰撞與作用幀未改；浮標是物件動畫，沒有拿它冒充角色動畫。無戰鬥，攻擊／受擊／死亡不適用。

| 證據 | 路徑 |
| --- | --- |
| 進入新內容前 | `content/r1/before-new-content-390x844.png` |
| 三人短篇／口味回應 | `content/r1/story-{merchant,elder,child}-390x844.png`、`taste-{merchant,elder,child}-390x844.png` |
| 三魚與河畔筆記 | `content/r1/fish-{river_carp,silver_dace,river_perch}-390x844.png`、`note-{river_carp,silver_dace,river_perch}-390x844.png` |
| 六尺寸 | `content/r1/basket-*.png`、`response-*.png`、`pond-*.png`：320×568、844×390、768×1024、1366×600、430×932、1032×1376 |
| 離線 | `content/r1/offline-story-390x844.png`、`offline-catch-390x844.png` |
| 新商店iPhone | `store/screenshots/iphone-07-neighbor-memory.png`，**1290×2796**，430×932／DPR3直接擷取 |
| 新商店iPad | `store/screenshots/ipad-07-neighbor-memory.png`，**2064×2752**，1032×1376／DPR2直接擷取 |

商店07為本輪實際送籃與配對後重讀畫面；起始章節／材料仍屬上述明示fixture，沒有假稱從零賺得所有舊進度。既有商店圖全部保留。歷史測試會重產的234個證據已歸檔本輪後逐bytes還原，包含原本未提交的R68檔案；共1773檔讀回一致。八張本輪舊測試新產出的舊命名商店圖，確認起點不存在且未追蹤後，連同hash移入本輪regression；沒有刪除既有未追蹤檔。收據：`historical-readback.json`、`generated-store-artifacts.json`。

## 風險與未完成

**Apple 4.3風險：中（本線自評）。** 三項均以鄰里相處與生活節奏為核心，連到紅格餐籃、祖母手記、陽光農務和既有河畔，沒有新增通用每日任務、徽章冊、抽卡或技能樹。Apple 4.3仍重視同app多Bundle及與市場既有內容難以區辨的問題；本次未做同帳號全部產品／原生包比較，不能保證審核通過。依[Apple官方4.3](https://developer.apple.com/app-store/review/guidelines/#spam)作風險推論，並非Apple審查結果。

**BLOCKED／未完成：穩定p95≤18ms、乾淨機況重測、原生iOS／Android／Safari實機驗證、此輪獨立Muse複評。** 三項內容本身無美術或功能缺件；沒有自造Muse分數。沒有推送、部署、商店後台操作、對外訊息、外部派工或可見視窗。

繁中文案mode2：「等它進到綠色水域，再提竿」→「輕點、橫拉，都還沒咬穩。等浮標下沉，再提竿」，原因是舊滑條提示不再符合新玩法；班伯修釣台後的舊綠區提示同步改為觀察浮標。三篇與口味回話另以具體生活動作新寫，沒有改動既有獎勵或承諾。
