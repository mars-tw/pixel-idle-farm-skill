# R7 原尺寸證據索引

本輪驗收依據：`../CONTENT_REVIEW_R6_MUSE.md` 第4節五項。PNG均為無頭瀏覽器直接截取的完整viewport，手機430×932／320×568，不裁切、不拼貼。遮字圖僅將文字設透明，沒有停鐘或修改魚的作用窗；同一竿兩張的phase與時間保存在 `browser-checks.json`。最終狀態以 `release-readback.json` 與 `regression-checks.json` 為準。

| Muse項目 | 原圖路徑與驗收 |
| --- | --- |
| ① 三魚不可提／可提 | [河鯉不可提](phone-pond-river_carp-pre-sink-masked.png)、[河鯉合攏](phone-pond-river_carp-sinking-masked.png)；[銀鯽不可提](phone-pond-silver_dace-pre-sink-masked.png)、[銀鯽短噴濺](phone-pond-silver_dace-sinking-masked.png)；[溪鱸彎尾流](phone-pond-river_perch-pre-sink-masked.png)、[溪鱸長直尾流](phone-pond-river_perch-sinking-masked.png)。三魚各有未遮字對應原圖。 |
| ① 捕獲／筆記 | [河鯉捕獲](phone-pond-river_carp-caught.png)、[銀鯽捕獲](phone-pond-silver_dace-caught.png)、[溪鱸捕獲](phone-pond-river_perch-caught.png)；[河鯉筆記](phone-pond-river_carp-note.png)、[銀鯽筆記](phone-pond-silver_dace-note.png)、[溪鱸筆記](phone-pond-river_perch-note.png)。另有各魚學會後重載頁，無即時秒數、固定提竿按鈕外觀。 |
| ② 單列送餐 | [430半路](phone-basket-merchant-430-halfway.png)、[320半路](phone-basket-merchant-320-halfway.png)；居民定位、箭頭、取消同時可見。任務、資源、種子與下層分頁全部收起；控制以實際面積扣除後，地圖可見區≥60%。 |
| ③ 交手連續三格 | [蘿拉未伸手](phone-basket-merchant-430-before-reach.png)、[蘿拉手碰籃](phone-basket-merchant-430-resident.png)、[蘿拉已持籃](phone-basket-merchant-430-handover.png)。班伯、圖圖及320也各有同組檔名；扣料只在第三格接籃作用幀。 |
| ③ 取消零扣料 | [取消前](phone-basket-cancel-before.png)、[取消後](phone-basket-cancel-after.png)。取消後畫面顯示麥餅份數與配料保留；測試逐項比較庫存、停止路徑並重載讀回。 |
| ④ 紀念物無彈窗實景 | [蘿拉茶凳](phone-memory-merchant-farm-object.png)、[班伯魚竿盤架](phone-memory-elder-farm-object.png)、[圖圖壓花空椅](phone-memory-child-farm-object.png)。正常鏡頭移到居民位置，直接點選世界物件。 |
| ④ 點選後個別回話 | [蘿拉](phone-memory-merchant-object-reply.png)、[班伯](phone-memory-elder-object-reply.png)、[圖圖](phone-memory-child-object-reply.png)。三人成功標題與紀念物句各不相同，回話各不相同；本人日常對話另有 `phone-memory-<resident>-farm-response.png`。 |
| ④ 錯味／配對 | [蘿拉錯味](phone-memory-merchant-wrong.png)、[蘿拉配對](phone-memory-merchant-matched.png)；[班伯錯味](phone-memory-elder-wrong.png)、[班伯配對](phone-memory-elder-matched.png)；[圖圖錯味](phone-memory-child-wrong.png)、[圖圖配對](phone-memory-child-matched.png)。 |
| ⑤ 農場共同聚餐 | [完成頁](phone-gathering-complete.png)、[回農場三人就座與三痕跡](phone-gathering-farm-seated.png)、[重載後永久桌](phone-gathering-farm-after.png)。桌子可以點開共同聚餐並翻總手記；三張席位由獨立遊戲角色坐姿組成，沒有插圖中的額外空椅。 |
| ⑤ 分籃保存 | `phone-gathering-merchant-decision.png`、`phone-gathering-elder-decision.png`、`phone-gathering-child-decision.png`；每籃分開存檔、各新context讀回，三籃齊才赴約。三頁總手記 `phone-gathering-review-<resident>.png`。 |
| 離線／適配 | `phone-offline-basket-<taste>.png`、`phone-offline-gathering.png`、`phone-offline-pond.png`；橫式844×390、平板768×1024、矮筆電1366×600的layout原圖與控制尺寸收據。 |

精選 `review-set/` 恰15張，餐籃／池塘／記憶各5張。01半路、02取消、03–05連續交手；06河鯉合攏、07銀鯽短噴濺、08–09溪鱸兩格、10捕獲成功；11–13三人各自配對、14聚餐完成、15可點聚餐桌與三項痕跡。其餘原圖在本層保留，不能說Muse已看過未入選圖。

`before/` 為從原有R6證據複製的歷史對照，來源逐筆記在 `before/sources.json`，不是冒充本輪重新實玩的基線。商店新圖為 `../../store/screenshots/iphone-13-farm-table-r7.png`（1290×2796）、`ipad-13-farm-table-r7.png`（2064×2752）。全部來源、尺寸及SHA-256收於最終讀回。

BLOCKED：真人／親子試玩、實體裝置、乾淨主機效能與Muse獨立8分複審，需裝置／受測者與獨立審查結果。
