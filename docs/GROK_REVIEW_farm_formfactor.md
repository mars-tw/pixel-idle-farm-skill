# Grok 監工快掃 — 農土 form factor／觸控偵測（兩段確認）

- **專案**：pixel-idle-farm-skill（《阿軒割割陽光農場》vanilla JS PWA）
- **對照版本**：`package.json` `appVersion` = `r57-20260713-1`（實作源於 R55 手機農土二段確認，`docs/CODEX_RESPONSE_farm_mobile.md`）
- **審查角色**：form factor 誤傷監工（**只審不改**）
- **問題焦點**：是否存在「**偵測到裝置有觸控 → 一律套手機行為、不看視口**」，以致**平板／觸控筆電上的滑鼠使用者被強制兩段確認**？
- **方法**：靜態讀碼（`src/ui.js`、`index.html`、守門／E2E）＋對照既有手機監工與 Codex 回應；**未改任何產品碼**
- **優先級**（本報告）：
  - **P0**：裝置級錯誤分類導致桌面滑鼠主路徑被鎖進兩段確認
  - **P1**：混合裝置真實可重現的短暫誤分類，或測試無法鎖住真實瀏覽器路徑
  - **P2**：邊界（pen、programmatic、非農土）與文件／命名落差

---

## 執行摘要

| 命題 | 結論 | 嚴重度 |
|------|------|--------|
| 是否「有觸控能力就套手機、不看視口」？ | **否。** 兩段確認**不**依 viewport、`isMobile`、`maxTouchPoints`、`matchMedia('(pointer: coarse)')` 等裝置／視口旗標 | — |
| 平板／觸控筆電**只用滑鼠**會否被強制兩段？ | **正常不會。** 純滑鼠路徑最終落 `activationType !== "touch"`，農土單擊直作 | — |
| 判斷方式是否為 pointer type？ | **意圖是** per-event 分類（`mapActivationType`）；但真實 `click` 多半是 `MouseEvent`，**常無 `pointerType`**，實際多靠 `firesTouchEvents` 與 **700ms `lastTouchMapAt` 啟發式** | P1（設計債） |
| 混合裝置誤傷？ | **有窄窗**：地圖上任一次 `touchend` 後 **700ms 內**的後續 `click`（若無 `pointerType` / `firesTouchEvents`）會被標成 `touch` → 滑鼠也可能短暫進兩段 | **P1** |
| 建議修法方向 | 以 **pointer 事件當下的 `pointerType`** 為準；`mouse`／`pen` 單擊直作，**僅 `touch` 兩段**；拿掉或嚴格限縮時間啟發式 | 建議，本輪不改 |

**一句話**：懷疑的「裝置有觸控就不看視口全套手機」**不成立**；實作是 **事件級** 分類，對 hybrid 比 viewport 旗標正確。殘留風險在 **`lastTouchMapAt < 700` 啟發式** 與 **E2E 用合成 `PointerEvent('click')` 未模擬真實 `MouseEvent` 路徑**。

---

## 1. 呼叫鏈（農土首點 → 是否兩段）

```
.gtile  touchend  → lastTouchMapAt = now()          (ui.js:1803)
.gtile  click     → mapActivationType(ev)           (ui.js:1804, 2256-2261)
                  → handleMapClick(tileId, type)    (ui.js:2305+)
                       isTouch = (type === "touch")
                       若 isTouch && 農土(plotIndex) && 有 action
                         → confirmTouchFarmAction   // 首點 false → 只預覽
                       否則
                         → moveAndAct 直作
```

視覺／UX（僅 touch 待確認態）：

| 元素 | 位置 | 用途 |
|------|------|------|
| `#touchActionPreview` | `index.html` | 「預覽：… · 再點同格確認」 |
| `.gtile.touch-pending` | `index.html` CSS | 待確認高亮 |
| `.gtile.farm-plot` | 2px padding 間距 | 命中視覺分隔（非偵測邏輯） |

---

## 2. 偵測邏輯（逐條判斷條件）

### 2.1 `mapActivationType(ev)` — 回傳字串

| 順序 | 條件 | 回傳 | 含義 |
|------|------|------|------|
| 1 | `!ev` | `"direct"` | 無事件（程式化呼叫） |
| 2 | `ev.pointerType` 為 truthy | **原字串**（`"mouse"` / `"touch"` / `"pen"` …） | 有 Pointer 語意時直接採用 |
| 3 | `ev.sourceCapabilities?.firesTouchEvents` | `"touch"` | 此 click 由觸控合成 |
| 4 | `now() - lastTouchMapAt < 700` | `"touch"` | 地圖磚近期曾 `touchend` |
| 5 | 其餘 | `"mouse"` | 預設桌面直作 |

程式原文（`src/ui.js`）：

```2256:2261:src/ui.js
  function mapActivationType(ev) {
    if (!ev) return "direct";
    if (ev.pointerType) return ev.pointerType;
    if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return "touch";
    if (now() - lastTouchMapAt < 700) return "touch";
    return "mouse";
  }
```

`lastTouchMapAt` 寫入點：每個 `.gtile` 的 `touchend`（`ui.js:1803`），**不區分農土／草地**，全圖 264 磚皆會戳時間戳。

### 2.2 `handleMapClick` — 何時兩段

| 條件 | 結果 |
|------|------|
| `activationType === "touch"` **且** `tile.plotIndex != null` **且** `act.action` 存在 **且** 尚未同簽名二次確認 | **兩段**：首點只 `pendingTouchFarmAction` + 預覽 + toast，不 `moveAndAct` |
| 同上且 `confirmTouchFarmAction` 回 `true`（同格／同 action／同 tool／同 seedId） | 清除 pending，執行動作 |
| `activationType` 為 `"mouse"` / `"pen"` / `"direct"` / 其他非 `"touch"` | **單擊直作**（農土亦然） |
| touch 但非農土（走路、站點、建築、NPC…） | **不走** `confirmTouchFarmAction`，仍單次觸發 |

```2305:2331:src/ui.js
  function handleMapClick(tileId, activationType) {
    const isTouch = activationType === "touch";
    // ...
    if (act.action) {
      if (isTouch && tile.plotIndex != null && !confirmTouchFarmAction(tileId, act.action)) { updateMap(now()); return; }
      clearTouchFarmPreview(false);
      spawnRing(tileId, true); moveAndAct(tileId, act.action); updateMap(now()); return;
    }
```

二次確認簽名（`confirmTouchFarmAction`）：`tileId` + `action` + `tool` + `seedId`（僅 plant 帶種子）。改點他格或非 touch 會清 pending（`ui.js:2307`）。

### 2.3 明確**沒有**的東西（反證「裝置旗標套手機」）

在 `src/**` 內對農土兩段確認相關路徑：

| 常見誤傷寫法 | 本專案 |
|--------------|--------|
| `navigator.maxTouchPoints > 0` → mobile UI | **無** |
| `'ontouchstart' in window` | **無** |
| `matchMedia('(pointer: coarse)')` / `any-pointer` | **無**（僅見 `prefers-reduced-motion`） |
| viewport 寬度（如 `<860px`）決定兩段 | **無**（CSS RWD 與兩段邏輯分離） |
| Playwright `hasTouch` / `isMobile` 寫進產品碼 | **無**（僅測試 context） |
| 全域 `isTouchDevice` 狀態機 | **無**；只有 per-click `activationType` + pending 預覽 |

因此：**不是「偵測到觸控硬體就永遠兩段」**；也**不是「窄視口才兩段」**。兩段只在 **該次啟動被判成 `touch` 且點的是可動作農土** 時發生。

---

## 3. 情境矩陣（含平板／觸控筆電）

| 裝置／輸入 | 預期 `mapActivationType` | 農土行為 | 判定 |
|------------|--------------------------|----------|------|
| 純桌機滑鼠 | `"mouse"`（多半走預設分支；`pointerType` 常缺） | 單擊直作 | OK |
| 手機手指 | `"touch"`（`firesTouchEvents` 與／或 700ms） | 兩段 | OK（本輪目標） |
| **平板 + 滑鼠**（全程未摸螢幕） | `"mouse"` | 單擊直作 | **OK，非強制兩段** |
| **觸控筆電 + 滑鼠**（未摸地圖） | `"mouse"` | 單擊直作 | **OK** |
| 同上 + **手指點農土** | `"touch"` | 兩段 | OK（該次是 touch） |
| 手指點地圖後 **700ms 內改用滑鼠點農土** | 可能被 **4 號規則** 判 `"touch"` | **短暫兩段（誤傷）** | **P1** |
| 觸控筆（`pointerType === "pen"`） | `"pen"` → `isTouch === false` | 單擊直作 | 合理（精準指標）；若產品要筆也預覽則屬產品決策 |
| `window.__farm.clickTile(id)` | `"direct"`（`!ev`） | 單擊直作 | OK；靜態 guard 有鎖 |
| 改點相鄰農土（touch） | 新 pending，不沿用舊確認 | 不扣資源 | OK（R55 意圖） |

### 3.1 對使用者問題的直接回答

> 平板與觸控筆電上滑鼠使用者會否被強制兩段確認？

- **不會因為「機器有觸控」或「視口像平板」而被強制。**
- **會**在「剛用手指碰過地圖（任一 `.gtile` 的 `touchend`）後約 0.7 秒內、且該次 `click` 沒帶可靠的非 touch 訊號」時，**偶發**被当成 touch。
- 此誤傷是 **時間窗啟發式**，不是 form-factor 全站旗標。

---

## 4. 誤傷／脆弱點細拆

### F-P1-01 — `lastTouchMapAt < 700` 把滑鼠短暫升格為 touch

| 項 | 說明 |
|----|------|
| 嚴重度 | **P1** |
| 機制 | 真實瀏覽器的 `click` 多為 `MouseEvent`，**通常沒有 `pointerType`**；滑鼠 click 的 `firesTouchEvents` 為 false；若 700ms 內有過地圖 `touchend`，第 4 規則仍回 `"touch"` |
| 誤傷情境 | Surface／觸控筆電：指尖輕觸地圖（含誤觸草地）後立刻滑鼠點農土 → 多一次確認；或以為滑鼠壞掉 |
| 誤傷範圍 | 僅農土 + 有 `act.action`；走路／站點不受兩段，但 pending 狀態可能被清或干擾 |
| 為何不是 P0 | 需「先 touch 地圖再很快 mouse」；純滑鼠使用者不受影響 |

### F-P1-02 — E2E 與真實事件路徑不一致

| 項 | 說明 |
|----|------|
| 嚴重度 | **P1**（測試債） |
| 證據 | `scripts/test-rpg-v4-e2e.js` 用 `new PointerEvent("click", { pointerType: "touch"|"mouse" })` |
| 問題 | 生產路徑上使用者點擊幾乎不會是帶 `pointerType` 的 `PointerEvent('click')`；測試**跳過**了 `firesTouchEvents` / `lastTouchMapAt` 主路徑，也**測不到** 700ms 誤傷 |
| 靜態 guard | `test-guards.js` `runTouchFarmGuard` 只字串鎖 `activationType === "touch"` 與簽名條件，**不驗證**啟發式順序 |

### F-P2-01 — `pointerType` 分支在真實 `click` 上常失效

| 項 | 說明 |
|----|------|
| 嚴重度 | **P2** |
| 說明 | 條件 2 寫成「有 pointer type 就信」；但若產品只掛 `click`，桌面／多數 Chromium 合成 click **走不到** 這支，文件若寫「靠 pointerType」易誤導 |
| 影響 | 不直接造成「全觸控裝置強制兩段」，但讓修法與測試容易做錯假設 |

### F-P2-02 — 全圖 `touchend` 都刷新時間戳

| 項 | 說明 |
|----|------|
| 嚴重度 | **P2** |
| 說明 | 誤觸草地／遠距磚也會刷新 `lastTouchMapAt`，擴大 700ms 窗的觸發面（與 F-P1-01 疊加） |

### F-P2-03 — 命名／文件「手機」vs 實作「touch 事件」

| 項 | 說明 |
|----|------|
| 嚴重度 | **P2** |
| 說明 | Codex／guard 文案常寫「手機」；實作鍵是 **`activationType === "touch"`**，與螢幕尺寸無關。大平板手指＝兩段；小視口外接滑鼠＝單擊。溝通時勿說成 media-query 行為 |

### 非問題（本輪可關閉的疑慮）

| 疑慮 | 結論 |
|------|------|
| 視口 &lt;860 就兩段 | **無此邏輯** |
| `hasTouch: true` 的 UA 永遠兩段 | **產品碼不讀此旗標** |
| 滑鼠被全域鎖兩段 | **否**（見情境表） |
| 程式化 `clickTile` 被兩段 | **否**（`"direct"`） |

---

## 5. 建議修法（只列方案，本輪不實作）

目標與使用者對齊：**滑鼠事件維持單擊直作；touch 事件才兩段。**

### 5.1 建議主路徑（推薦）

1. 在地圖層聽 **`pointerdown` / `pointerup`**（或至少 `pointerdown`），快取：
   - `lastMapPointerType = ev.pointerType`（`"mouse"|"touch"|"pen"`）
   - 可選：`pointerId` / 座標對應的 `tileId`
2. `click` 處理時：
   - **優先**使用該次手勢對應的 `lastMapPointerType`
   - `isTouch = (type === "touch")` 嚴格相等（**不要**把 `pen` 當 touch，除非產品明確要求）
3. **刪除或降級** `lastTouchMapAt < 700`：
   - 理想：完全移除
   - 過渡：僅當 `pointerType` 與 `sourceCapabilities` 皆不可用時，且同一次 gesture 內使用；**禁止**跨「touch 後換 mouse」升格
4. 可選強化：在 `pointerdown` 若 `pointerType === "mouse"`，立刻 `lastTouchMapAt = 0` 或設 `lastMapPointerType = "mouse"`，切斷誤傷窗

### 5.2 較小 diff 的修補（若要少動架構）

```text
// 概念：不要用「近期有過 touch」覆蓋明確的非 touch 訊號
// 1) 若能讀到 pointerType（含從 pointerdown 快取）→ 只用它
// 2) else if firesTouchEvents → touch
// 3) else → mouse
// 刪除 now()-lastTouchMapAt < 700，或僅在完全沒有 capabilities 的舊環境當 fallback
```

Safari 等若缺 `sourceCapabilities`，應用 **同一次 touch 序列** 的 flag（`touchstart`→`touchend`→隨後 click 之間的 `touchGestureActive`），而不是全域 700ms 牆鐘。

### 5.3 測試應補（鎖回歸）

| 案例 | 斷言 |
|------|------|
| 合成 **`MouseEvent('click')`** 無 `pointerType`、無近期 touch | 農土單擊直種／直收 |
| `TouchEvent` 序列或 `firesTouchEvents: true` 的 click | 首點 pending、二點才執行 |
| touchend 後 100ms 再派發**純** mouse click（無 firesTouchEvents） | **必須仍單擊直作**（鎖 F-P1-01） |
| `pointerType: "pen"` | 單擊直作（或依產品文件） |
| `__farm.clickTile` | 單擊直作（既有） |
| 寬視口 + hasTouch 硬體模擬 + 僅 mouse | 單擊直作（證明非 viewport／非 hasTouch） |

E2E 不應再把「`PointerEvent('click', {pointerType})`」當成唯一真相來源；至少加一組 **MouseEvent + 可選 touch 序列**。

### 5.4 不建議的修法

| 做法 | 原因 |
|------|------|
| 用 viewport 寬度決定兩段 | 正好製造「觸控筆電窄窗／平板橫豎」誤傷；與本輪問題同型 |
| `maxTouchPoints > 0` 全域兩段 | **經典 hybrid 誤傷**；本審查已確認目前沒做，不應引入 |
| 僅 CSS `(pointer: coarse)` 切換 | 筆電可同時 fine+coarse；且 CSS 無法可靠標每次 click |

---

## 6. 與 R55／既有文件對照

| 來源 | 說法 | 本輪核對 |
|------|------|----------|
| `docs/CODEX_RESPONSE_farm_mobile.md` | 真實 touch 兩段；mouse 與程式化單擊直達 | **產品意圖正確**；實作主幹吻合 |
| `docs/GROK_REVIEW_farm_mobile.md` | 當時 P0 為單擊即扣資源 | R55 已對 **touch 農土** 補兩段；本輪聚焦 form factor 誤傷 |
| `test-guards.js` R55 守門 | 鎖 touch 二次確認字串 | 有；**未**鎖「禁止裝置旗標」與 700ms 行為 |
| `test-rpg-v4-e2e.js` | touch 首點不扣款、mouse 直達 | 有；**事件型別偏人工** |

---

## 7. 結論清單（給下輪實作／不必本輪改）

| ID | 嚴重度 | 結論 |
|----|--------|------|
| F-OK-01 | — | **無**「偵測觸控硬體／不看視口就強制手機兩段」的全域 bug |
| F-OK-02 | — | 平板／觸控筆電 **純滑鼠** 主路徑應為單擊直作 |
| F-P1-01 | **P1** | `lastTouchMapAt < 700` 可在 hybrid 上把滑鼠短暫標成 touch |
| F-P1-02 | **P1** | E2E 未覆蓋真實 `MouseEvent`／700ms 誤傷 |
| F-P2-01 | P2 | 真實 `click` 常無 `pointerType`，條件 2 名實落差 |
| F-P2-02 | P2 | 全圖 touchend 擴大啟發式觸發面 |
| F-P2-03 | P2 | 「手機」文案 vs 「touch 事件」實作 |

**總評**：農土兩段確認的 form-factor 策略 **方向正確**（事件級 touch vs mouse，而非 viewport／hasTouch 裝置鎖）。監工問題所述的「大 bug 型」**未成立**；若要完全符合「滑鼠永遠單擊、僅 touch 兩段」，應 **以 pointer 手勢型別為準並移除跨手勢時間啟發式**，並用 E2E 鎖 hybrid 回歸。

---

## 8. 審查範圍與限制

- **已讀**：`src/ui.js`（map 建磚、activation、confirm、`__farm` 掛鉤）、`index.html`（touch-pending／preview／farm-plot）、`scripts/test-guards.js`、`scripts/test-rpg-v4-e2e.js` 觸控段、`docs/CODEX_RESPONSE_farm_mobile.md`、`docs/GROK_REVIEW_farm_mobile.md` 開頭；`src/**` 無 maxTouchPoints／coarse pointer 旗標。
- **未做**：實機平板／Surface 手測、改碼、跑完整 `npm test`／e2e（本任務為只審報告）。
- **未改檔**：除本報告 `docs/GROK_REVIEW_farm_formfactor.md` 外無產品變更。
