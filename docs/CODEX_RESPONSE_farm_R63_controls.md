# farm R63：控制可達性硬化回報

## 結論

R63 已完成裝置分流、矮視口版面、常駐控制與 modal 的 P0 可達性硬化。版本為 `0.1.7` / `r63-20260715-1`。

本輪只修改 UI 尺寸、裝置偵測、modal 互動隔離與測試；沒有修改 R60–R62 點陣素材、角色 frame 動畫、遊戲經濟、任務規則、存檔 schema 或 atlas 座標。

## 修復對照

### A. 手機控制盤只看主指標

- 移除 `navigator.maxTouchPoints`、`any-pointer: coarse` 與收到一次 touch pointer 就永久加 `.has-touch` 的能力式判定。
- `setPrimaryPointerClass()` 只讀 `matchMedia("(pointer: coarse)")`，並且必須同時滿足寬度 `<=859px` 才加 `.mobile-controls-enabled`。
- 1920×1080、1440×780、1366×600、1280×640 非觸控桌機均維持桌機 UI；額外測試 1366×640 `hasTouch:true` 觸控筆電也不顯示 D-pad。
- 390×844 手機與 820×1180 平板的 primary pointer 為 coarse，顯示 D-pad 與 A 鍵。

### B. 控制永遠停在可見視口

- 桌機 `.farm-panel`／`.map-scene-wrap` 改為可縮 flex，`#mapScene` 取消 420px 強制最小高度，依 app shell 剩餘 `dvh` 自適應縮放。
- 智慧助手由地圖底部移到右上，避免「前往」按鈕與底部 action dock／全域工具列互相遮擋。
- 右側 `.side-panel` 維持固定 tab 列，只有 `.side-body` 自身垂直捲動；頁面本體不捲。
- 390px 小手機地圖使用 `50dvh` 上限，D-pad 的下鍵與 A 鍵完整停在全域工具列上方。
- 手機 action dock 移到 D-pad 上方；開啟 action dock 時暫收智慧助手，兩組控制零重疊。
- 所有 `button`／`[role=button]`、small button、圖鑑項目與手機種子 quickbar 命中目標至少 44×44px。

### C. modal 關閉與背景隔離

- modal 提升到 `z-index:20000`，高於 D-pad／智慧助手的 9900 層。
- modal card 改成 flex：`.modal-body` 自身內捲，底部關閉／完成按鈕固定為不縮的 44px 操作列。
- `100dvh` 與 safe-area padding 保證 1366×600、手機與平板均不切關閉鈕。
- modal 開啟時加深遮罩，`body:has(.modal.show) .wrap` 停止背景 pointer interaction；`elementFromPoint` 實測背景命中 modal 遮罩。
- 開新 modal 會先關閉其他 modal，Esc、既有完成按鈕與焦點還原流程保留。

## R63 守門測試

新增 `scripts/test-controls-reachability.js`，並接入 `npm run test:e2e`；另提供 `npm run test:controls`。

測試逐視口驗證：

- 1920×1080、1440×780、1366×600、1280×640：非觸控桌機，D-pad 必須隱藏。
- 1366×640：`hasTouch:true` 觸控筆電，因寬度不符仍維持桌機 UI。
- 390×844、820×1180：primary coarse，D-pad／A 鍵必須顯示。
- 工具、任務「前往」、作物 quickbar、智慧助手、底部工具列、側欄 tabs 與手機控制盤逐顆檢查 `>=44px`。
- 每顆關鍵控制中心須在視口內，且 `document.elementFromPoint()` 命中自身或其子元素。
- 「怎麼玩」關閉鈕須完整在視口內、中心可命中，背景控制須由 modal 遮罩攔截。
- 觸控農地開啟 action dock 後，action 按鈕與 D-pad 逐顆可命中且矩形零重疊。
- 每個視口零頁級捲動、零水平溢出、零 `pageerror`。

既有 `scripts/test-rpg-v4-e2e.js` 另加入互動後 A 鍵的視口／命中斷言；長流程使用測試專用靜態 CSS 與 60 秒操作／移動等待容差，保留正式版 200ms／格逐格走路，以及全部碰撞、任務與存檔功能斷言。

## 證據截圖

- [desktop-1440x780.png](evidence/R63_controls/desktop-1440x780.png)
- [desktop-1366x600.png](evidence/R63_controls/desktop-1366x600.png)
- [mobile-390x844.png](evidence/R63_controls/mobile-390x844.png)

桌機截圖可見底部五顆工具列按鈕與智慧助手兩顆「前往」均在視口內，且沒有 D-pad；手機截圖可見完整四向鍵與 A 鍵停在底部工具列上方。

## 驗收

- `npm test`：通過。
- `npm run test:rwd`：通過，9 視口 × overlay 開／關，零出界、零頁級捲動、零水平溢出。
- `npm run test:controls`：通過，7 種裝置／視口，全部關鍵控制中心可命中。
- `npm run test:e2e`：通過，含 RPG 全流程、真 SW 離線、RWD 與 R63 控制可達性守門。
- `git diff --check`：通過。
- 秘密掃描：排除 `.git`、`node_modules`、`tmp` 後零命中。

本地提交訊息：`修正：完成 R63 控制可達性硬化`。不 push。
