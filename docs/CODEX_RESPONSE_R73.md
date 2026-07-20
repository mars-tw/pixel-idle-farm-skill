實作者：Codex（GPT-5）。

# CODEX_RESPONSE R73 — PLAYTEST-R1 缺陷修正輪

2026-07-20。輸入：`docs/playtest/PLAYTEST_R1.md` §5 Bug／控制 audit、§9 阻擋樂趣前 5，以及 `docs/playtest/shots/`。版本：`r72-20260719-1` → **`r73-20260720-1`**。

## 一、逐項修法與驗證

### FARM-R1-01（P1）手機橫式系統工具列不可達

- coarse + short landscape 的 `.toolbar` 改為 fixed，固定在 `.side-tabs` 上方；左右界線沿用既有橫式 D-pad／A 鍵避讓（`left:170px; right:88px`）。
- `bottom` 使用 `--tabs-inset`；R72 的 `updateFixedBottomInset()` 會量到「工具列＋頁籤」總高並回寫 `--fixed-bottom-inset`。844×390 實測 103px、390×844 實測 104px。
- 額外根修從側欄返回後的種子抽屜互蓋：展開抽屜時把 `#mapScene` 以既有 `scroll-margin-bottom: calc(var(--fixed-bottom-inset) + 8px)` 帶回可視區，避免「×全部」落在新工具列下方。
- Playwright 真實 click：844×390 fresh、轉 390×844、再轉 844×390、最後回 390×844；每一姿勢的「設定／玩法／重置」皆 ≥44px、中心命中。設定與玩法 modal 實際開關；重置實際觸發 confirm 後取消。

### FARM-R1-02（P1）市集沿用信箱 stale selection

- `addStructure()` 為所有大型結構圖像掛代表 footprint 的 `data-tile-id`；固定結構 click handler 另保留由 `structureId` 回查 footprint 的防禦式 fallback。
- 原步驟完整重現：touch 信箱→「使用」→關信箱→touch 市集攤→「使用」。現在 selection 由信箱改成 `shop / t11_1`，實際賣出庫存，信箱 modal 不會重開。

### FARM-R1-03（P2）行動裝置沒有系列連結

- 設定 modal 新增木牌式「其他遊戲」區，提供卡牌對戰、無盡塔防、灰燼護航三條等效連結；保留 `target=_blank`／`rel=noopener`。
- 390×844 與 768×1024 tablet 逐一捲入、量測 ≥44px、中心命中並攔截導頁後執行真實 click。
- 控制守門 `EXPECTED_REACHABLE_CONTROLS` **224 → 236**：4 個行動視口 × 3 條新增連結，共 +12；最終實測精確 236/236。

### FARM-R1-05（P2）訂單丟棄無防呆

- 改為 5 秒 inline 二段確認。第一次點「丟棄」不碰 state，只展開「保留／確認丟棄」；保留會復位，5 秒逾時自動復位；只有第二次明確點「確認丟棄」才呼叫 `trashOrder()`。
- Playwright 驗證原訂單第一次點後仍存在、保留後恢復、第二次確認後才換單。

### FARM-R1-04（本輪不做）

- 單棟建物升級是產品成長深度，不是執行缺陷；已記入 `docs/OPTIM_PLAN_R73.md` backlog，包含 Lv、下一級效果、成本與升級動作方向，本輪未實作。

## 二、自動化與 gate

| Gate | 最終結果 |
|---|---|
| `npm test` | ✅ exit 0；version-chain、guards、economy、systems、UI smoke、v3/v4 atlas、R66、R68 static 94 assertions 全綠 |
| `npm run test:e2e` | ✅ exit 0（792.3 秒）；RPG e2e、RWD、controls、R68 browser、R73 回歸串行全綠；瀏覽器全數正常關閉 |
| `npm run test:rwd` | ✅ 12 視口 × overlay 開／關；互動出界 0、頁級捲動 0、水平溢出 0 |
| `npm run test:controls`（整串 e2e 內） | ✅ 236/236；含 844×390、932×430 與三連結新增控制 |
| `npm run test:r72` | ✅ 3 視口；旋轉 inset 103/103、種子抽屜、橫幅、modal、5 分頁、9/9 建造輪全綠 |
| `npm run test:r73` | ✅ 工具列旋轉、市集 stale selection、手機／平板三連結、訂單二段確認全綠 |
| 秘密掃描 | ✅ 常見 OpenAI/xAI/GitHub/AWS token 與 private-key header，排除 `.git`／`node_modules`，0 命中 |

R72 fixed-layer 守門在第一次補跑時成功抓到兩項：舊 inset 斷言只量頁籤、以及種子「×全部」被新工具列遮住。前者同步成最上方 fixed bar 的正確口徑，後者做 runtime 根修；重跑全綠後才進最終總 gate。

## 三、版本鏈

- release id：`r73-20260720-1`。
- 已同步：`package.json.appVersion`、index runtime `VERSION`、HTML runtime query、`src/ui.js` PWA fallback、`sw.js`、`manifest.webmanifest`、RPG e2e 版本釘。
- `scripts/test-version-chain.js` 擴充為同時檢查 package appVersion、index runtime、UI fallback、SW 與 index／manifest query；R68 SHA-8 內容定址資產維持豁免。
- runtime／測試／README／SKILL 範圍搜尋 `r72-20260719-1`：0；`manifest.webmanifest` 為 LF、結尾 LF、CRLF=0。

## 四、證據

`docs/evidence/r73/`：

- `before-390x844-market-stale-selection.png`／`after-390x844-series-links.png`
- `before-844x390-toolbar-unreachable.png`／`after-844x390-toolbar-reachable.png`
- `before-1366x768-order-discard.png`／`after-1366x768-order-confirm.png`

六張均為本輪 Playwright 視口截圖並已目視 QA。`npm test`／browser gates／R72 守門觸碰的 `docs/evidence/R68`、`docs/evidence/r72` 均已用精確路徑還原；歷史 evidence 最終零變動。

## 五、殘留

- FARM-R1-04 單棟建物成長線留在 R73 backlog，未混入缺陷修正 commit。
- 訂單確認是 5 秒、頁面記憶體內的 UI 狀態，不寫入存檔；重載等同取消，沒有誤刪風險。
- 本輪不 push；`docs/audit_openclose/`、`docs/playtest/`、`scripts/audit-oc-r1.js` 保持使用者既有未追蹤狀態，不納入提交。
