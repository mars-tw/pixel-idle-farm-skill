# 《晨光農場》farm R67 — 選單重疊檢修報告

日期：2026-07-17

版本：`0.1.10`／`r67-20260717-1`

結論：**PASS，可交付**

## 1. 真重疊修正

390×844 稽核基線為「訂單」對 `resetBtn` 約 `ox43/oy42`、「升級」對 `resetBtn` 約 `ox50/oy42`；本機控制掃描亦重現約 `44×39` 與 `50×39` 的 rectangle 交集。

R67 在 `max-width: 859px` 改為由 app shell 捲動，讓農場主區、側欄分頁/內容、底部工具列依正常流排列成獨立區段；底部工具列固定為五個等寬欄位，`resetBtn` 不再掉到第二列。手機 footer 在此寬度隱藏，避免非核心外部連結占用控制安全區。

修後 390×844 分別在主場景、側欄分頁可見、底部工具列可見三個狀態掃描，所有非 modal 互動元素兩兩交集均為 0。

## 2. howTo modal 互斥

- `openModal()` 對 `.wrap` 同步原生 `inert` attribute/property，`closeModal()` 在最後一個 modal 關閉後解除。
- modal 開啟時焦點移入 modal；關閉後恢復背景與先前焦點。
- D-pad pointerdown、`actionA`、地圖 click/pointer 與側欄 tab 入口加入 `hasOpenModal()` guard。
- 宣傳場景捷徑也會解除 modal inert，避免直接移除 `.show` 後留下鎖死背景。
- E2E/RWD overlay 清理改走各 modal 的正式關閉鈕，不再繞過 production 關閉流程。

控制守門在桌機檢查底部 5 鍵，在手機另加入 D-pad 四方向與 `actionA`，驗證全部位於 inert subtree、可見控制的 hit target 落在 modal、焦點留在 modal。再送出方向鍵、D-pad pointerdown/up 與 A 鍵 click，玩家座標和面向變更數為 0。

## 3. 控制守門擴充

`scripts/test-controls-reachability.js` 現在包含：

- 7 個桌機、觸控筆電、手機與平板視口。
- 主場景、側欄分頁、手機底部工具列三個非 modal 狀態。
- 可見且可用的 button/link/input/select/textarea/role-button/tabindex 元素兩兩 rectangle 相交檢查；排除 modal、inert、disabled、不可見與父子配對。
- modal z-index、44px 命中、背景 inert、elementFromPoint 攔截、焦點限制、輸入零 mutation 與關閉後 inert 解除。
- `CONTROLS_VIEWPORT` 可選擇單一視口除錯；完整 gate 預設仍跑 7 視口。高負載啟動等待為 45 秒，避免瀏覽器冷啟動假紅。

## 4. 閘門結果

| Gate | 結果 |
|---|---|
| `npm test` | PASS；系統、經濟、UI smoke、v3/v4 atlas、R66 正式 UI 美術契約全綠 |
| `npm run test:e2e` | PASS；主 E2E + RWD + R67 controls 完整長鏈全綠 |
| `npm run test:rwd` | PASS；桌機/平板/手機/橫向，overlay 開/關皆零出界與零水平溢出 |
| `npm run test:controls` | PASS；7 視口、44px、非 modal 零相交、modal 互斥全綠 |
| `git diff --check` | PASS |
| 秘密掃描 | PASS，0 命中 |

## 5. 證據

證據根目錄：`docs/evidence/R67_menu/`

- `controls/mobile-menu-390x844.png`：側欄分頁、內容、底部五鍵列分區實畫。
- `controls/mobile-390x844.png`：手機主場景與 D-pad/actionA 實畫。
- `controls/desktop-1366x600.png`、`controls/desktop-1440x780.png`：桌機控制實畫。
- `summary.json`：重疊 before/after、modal 互斥、gate 結果與四張截圖 SHA-256。

## 6. 版本與交付

- npm package：`0.1.10`
- app／SW／HTML／manifest cache key：`r67-20260717-1`
- README、CREDITS 與主 E2E 版本斷言已同步。
- 僅建立本地 commit，不 push。
