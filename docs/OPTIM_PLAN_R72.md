# OPTIM_PLAN R72（美術＋內容＋選單/裝置 P0 修正輪）

2026-07-19。實作：Claude subagent（Codex 額度封鎖至 7/24）。
輸入：menuscan farm 章節（P0×2＋固定層互蓋族）、docs/OPTIM_PLAN_R70.md 裁決、AGENTS.md（R69-R71 已出貨事實）。
本輪套用 game-optimization-round 固定閘門；Codex 佇列項（C-02、C-03 剩餘、A-01、A-02、A-03）不碰。

## A. P0-1 固定層避讓機制（掃描 P0：固定層遮擋族）

| id | 內容 | 驗收 |
|---|---|---|
| A-1 | 新增 CSS 變數 `--fixed-bottom-inset`（底欄+工具列+安全區總高）與 `--tabs-inset`（僅頁籤欄）：`:root` 預設 0px、行動媒體給靜態 fallback，JS `updateFixedBottomInset()` 實測 fixed 底欄實高寫回（resize / orientation / pointer change / 初始化時更新；mock DOM 無 matchMedia/querySelector/getComputedStyle 需防呆） | ui-smoke 不退化；桌機視口變數為 0px |
| A-2 | `.error-recovery`、`.pwa-update`、`#toast-zone` 的 `bottom` 改引用 `var(--fixed-bottom-inset)` | 390×844 與 844×390：`#errorContinue`/`#errorReload` elementFromPoint 命中自身（menuscan 原 0/2） |
| A-3 | `.modal` padding-bottom 與 `.modal-card`/`.settings-card` max-height 扣除 `var(--fixed-bottom-inset)` | offline modal `#offlineOk`、settings `#settingsOk`、howTo `#howToOk`、letters `#lettersClose` 兩視口皆可點且完整在視口內 |
| A-4 | `.side-pane.sel` bottom、portrait `.toolbar` bottom、`.wrap` padding-bottom 改以變數為基準（修 portrait 工具列蓋抽片底 ~6px：「蓋」被 #resetBtn 遮） | 每個 side-pane（tile/orders/upgrades/story/journal）390×844 與 844×390 開啟後內容可捲至底、最末互動元素中心命中自身 |
| A-5 | 全面盤點 fixed 層互蓋：assistant／D-pad／seed-hud／tab bar／toolbar／questDock，建造輪與物件泡泡開啟時收起 smart assistant（:has 擴充） | 控制守門 `assertNonModalNoOverlap` 各視口維持綠 |

## B. P0-2 橫向建造輪 7/7 可點

| id | 內容 | 驗收 |
|---|---|---|
| B-1 | `placeSceneOverlay` 改「先錨點、後全框夾擠」：定位後量測 overlay 全框，夾入「#mapScene 可視範圍 ∩（視口 − --fixed-bottom-inset）」；放不下時 max-height 內捲保底（overflow-y:auto） | 844×390 建造輪 7 格全在視口內且中心命中自身（menuscan 原 1/7）；390×844 7/7（原 5/7 被 questDock 蓋） |
| B-2 | 物件泡泡沿用同一夾擠路徑（844×390 原 0/1 被頁籤蓋） | 844×390 物件泡泡「收集」可點 |
| B-3 | Playwright 真實 click 驗證：建造工具＋7 選項情境，逐格 click 成功（建造成功或正確資源 toast） | scripts/test-r72-fixed-layers.js 7/7 PASS 記入 evidence |

## C. 美術（生成工具未連線：僅程序化精緻化）

| id | 內容 | 驗收 |
|---|---|---|
| C-1 | `tools/r72_pixel_polish.py`：v4 crops*/buildings/structures 逐 frame 像素階調精緻化——陰影 hue-shift（偏冷 −10°、+飽和）、亮部微暖；不動 alpha/尺寸/構圖 | 每 frame 明度階 ≥6；全圖 mean luminance 變化 ≤3%；validate-v4-atlas 通過；before/after 對照圖入 evidence |
| C-2 | 夜間/暴風亮度閘：Playwright 掃 4 季 × 最暗天氣（storm/rain/snow/fog）#mapScene mean luminance，過暗（<門檻）調降 CSS 疊層不透明度 | docs/evidence/r72/night-gate.json 全組合 ≥ 門檻 |
| C-3 | 季節色盤一致性：四季 sky/grass/ground tint 隨 C-2 掃描輸出對照，異常色偏（跨季亮度落差 >35%）校正 | 同上 JSON 記錄四季量測 |

## D. 遊戲內容（非 Codex 佇列，挑 2 件）

| id | 內容 | 驗收 |
|---|---|---|
| D-1 | 收成→升級回饋閉環：升級分頁徽章 `upgradesBadge` 顯示「目前買得起的升級數」，afterChange 即時更新（手機抽片收合時也看得到升級時機） | 金幣達首個升級門檻時徽章 >0、購買後刷新；不新增互動控制（span，不動守門 224） |
| D-2 | 教學引導斷點：一次性情境提示（localStorage 旗標）——首次開建造輪提示「點選項即建造」、首次開種子抽屜提示「橫向捲動看全部」 | 首次觸發各出現一次 toast、再觸發不重複；ui-smoke 無例外 |

## E. 閘門（全過才算完）

- `npm test` 全綠（version-chain/guards/economy/systems/ui-smoke/v3/v4/r66/r68）。
- e2e：test-rpg-v4-e2e、test-rwd-matrix、test-controls-reachability（224 控制不變）、test-r68-browser 全綠。
- 版本鏈 bump `r72-20260719-1`：sw.js/index.html/manifest.webmanifest/src/ui.js fallback；grep 舊版號 `r70-20260719-1` 歸零（r68 SHA-8 資產豁免）。
- 秘密掃描 `sk-proj-…|sk-[a-z0-9]{40}|xai-…` 零命中（排除 .git/node_modules）。
- 證據 before/after（390×844、844×390、1366×768）入 docs/evidence/r72/；R60-R68 歷史證據不可覆寫。
- docs/CODEX_RESPONSE_R72.md 報告；main 分支繁中 commit，不 push。

## F. R72.1 硬化補丁（Grok 對抗複審 NO_P0，七項回鍋裁定）

| id | 內容 | 狀態 |
|---|---|---|
| R72-01/09 | `--fixed-bottom-inset` 已含底欄 safe-area——modal/.settings-card 不得再疊加 env()；設定卡三重扣高去重，收斂 `max(env, var)` 單一來源單次扣減＋口徑註解 | 已修 |
| R72-03 | `#toast-zone` z200 被 9800 固定欄蓋 → 抬 9920（低於橫幅 9935/9940） | 已修 |
| R72-04 | index.html `:root` 註解文件化 z 階表（5/30/9790/9795/9800/9920/9935/9940/20000/30000＋場景內部階） | 已修 |
| R72-08 | 手機媒體查詢內 `--fixed-bottom-inset` 靜態 fallback（JS 失敗/首屏前基本避讓）——R72 已具備，補裁定編號註解 | 已修 |
| R72-10 | error-recovery＋pwa-update 同顯垂直堆疊（syncBottomBanners 實測錯誤橫幅高度上移更新橫幅），守門加同顯不互蓋斷言 | 已修 |
| R72-02 | test-r72-fixed-layers 補旋轉案例：390×844→setViewportSize 844×390，斷言 inset 重測＋錯誤恢復按鈕仍可點 | 已修 |
| R72-12 | 守門 viewport config 移除與實檔脫鉤的 evidence 欄位，截圖檔名統一由 snap() 產生 | 已修 |

### 記錄在案不阻擋本輪（Grok 裁定列殘留）
- R72-05：多固定層並存（抽片＋橫幅＋toast 同顯）組合守門——下輪納入。
- R72-06：SW 版本斷言集中化（e2e 測試釘散在兩處）——下輪重構。
- R72-07：控制守門清點納入新 UI（upgradesBadge 屬 span 非控制，暫不影響 224）——待 C-02 動守門計數時一併。
- R72-11：美術視覺快照回歸（polish 後 baseline diff）——Codex 美術輪（A-02/A-03）一併建。
- R72-13：v4 atlas PNG content-hash 定址（現走 ?v= 版本鏈）——Codex 佇列/下輪。
