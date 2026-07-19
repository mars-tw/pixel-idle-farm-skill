# CODEX_RESPONSE R72 — 美術＋內容＋選單/裝置 P0 修正輪

實作：Claude subagent（Codex 額度封鎖至 7/24）。

2026-07-19。輸入：menuscan farm 掃描（28 測，P0×2）＋ OPTIM_PLAN_R70 裁決＋ AGENTS.md（R69-R71 事實）。
計畫：docs/OPTIM_PLAN_R72.md（先產清單再動工）。版本：r70-20260719-1 → **r72-20260719-1**。

## 一、P0 修正（掃描固定層遮擋族）

### P0-1 固定層避讓機制（A-1〜A-5）
- 新增 CSS 變數 `--fixed-bottom-inset`（底部固定欄總高：頁籤欄＋直式工具列＋安全區）與 `--tabs-inset`（僅頁籤欄）；`:root` 預設 0px、行動媒體帶靜態 fallback，`updateFixedBottomInset()` 實測 fixed 欄實高回寫（resize / pointer change / 初始化時同步；mock DOM 守衛式呼叫，ui-smoke 不退化）。
- 引用處統一改變數：`.error-recovery`／`.pwa-update`／`#toast-zone` 的 bottom、`.modal` padding-bottom、`.modal-card`/`.settings-card` max-height、行動抽片 `.side-pane.sel` bottom、`.wrap` padding-bottom、直式 `.toolbar` bottom（修工具列蓋抽片底 ~6px：菜單掃描「蓋」被 #resetBtn 遮）。
- 錯誤恢復/更新橫幅 z-index 260/255 → 9940/9935（原本被 z9800 頁籤欄蓋死是 menuscan P0 主因之一）。
- 附帶互蓋清償：建造輪/物件泡泡開啟時暫收 smart assistant（:has 擴充）；橫式 scene-action-bar 改實測「場景底 ∩ 固定 D-pad」交疊量讓位，不再固定抬 158px 蓋住種子列「×全部」；直式 ≤480 種子快捷列讓開右上「整圖」鈕＋允許換行。

### P0-2 建造輪（menuscan：844×390 僅 1/7 可點；390×844 5/7）
- `placeSceneOverlay` 改「先錨點、後全框夾擠」三段式：
  1. 全框夾入「#mapScene 可視範圍 ∩（視口 − `--fixed-bottom-inset`）」；
  2. 場景大半在摺疊外時先 `scrollIntoView`（`#mapScene` 加 `scroll-margin-bottom: calc(var(--fixed-bottom-inset) + 8px)`，不會捲進固定底欄後面）再夾一次；
  3. 仍放不下→限高＋內捲（overflow-y:auto）保證每格可捲入可點。
- `.build-wheel`/`.object-bubble` z 9890 → 9910（高於 D-pad 9900：選擇期間輪盤優先可點）。

### P0 驗證（scripts/test-r72-fixed-layers.js，59 項全綠 ×3 視口）
390×844、844×390、1366×768 各驗：
- 錯誤恢復「繼續/重載」：中心 elementFromPoint 命中自身＋「繼續」真實 click 收合＋「重載」click actionability（trial）通過（menuscan 原兩視口 0/2）。
- 離線摘要 `#offlineOk`／設定 `#settingsOk`／玩法 `#howToOk`／信箱 `#lettersClose`／PWA 橫幅：全部命中自身且真實 click 生效。
- **建造輪 9/9 格**（本輪測試給足建材，9 型全開，涵蓋掃描時的 7 型）：中心在視口內、命中自身、≥44px、逐格 Playwright click actionability（真實 hit-test 管線）通過；另抽 2 型全真 click 驗證建築數 +1 落地。844×390 原 1/7 → 9/9。
- 5 個 side-pane 內按鈕（tile 0／orders 3／upgrades 1／story 1／journal 42 顆）捲入後全命中；行動視口種子抽屜「×全部」命中自身。

## 二、美術（生成工具未連線：程序化精緻化）
- `tools/r72_pixel_polish.py`：v4 crops×4／buildings／structures-nature 共 75 frames 逐 frame 像素階調精緻化——陰影 hue-shift 冷偏 10°＋飽和 ×1.06、亮部暖偏 6°；明度 V 通道不動、alpha bit-exact 不變。守門：全 sheet mean luminance 漂移 ≤3%（實測 0.80%〜2.38%）、每 frame 明度階（/32 量化）最少 8〜17 階 ≥6。對照條：docs/evidence/r72/art-before-after-strip.png；metrics：art-metrics.json。validate-v4-atlas 通過。
- 夜間亮度閘（scripts/test-r72-night-gate.js）：4 季 × 7 天氣實截 #mapScene 算 mean luminance——最暗組合（夏/秋 storm）90.4〜94.6 ≥ 門檻 56、其餘 ≥103 ≥ 72，全 28 組合綠、無需壓亮調整。
- 季節色盤一致性：同天氣跨季亮度落差 2.1%〜7.9% ≤ 35%；四季 sky/grass 色盤對照記入 docs/evidence/r72/night-gate.json。

## 三、遊戲內容（非 Codex 佇列，2 件）
- D-1 收成→升級回饋閉環：升級頁籤徽章 `#upgradesBadge` 顯示「目前買得起的升級數」，`afterChange` 即時更新——手機抽片收合時也看得到升級時機。span 非互動控制，守門計數不變（224）。
- D-2 教學引導斷點：`onceHint()` 一次性情境提示（localStorage 旗標，不動存檔 schema）——首次開建造輪「點選項即建造；點空白處取消」、首次開種子抽屜「可左右捲動看全部」。

## 四、閘門結果
| 閘門 | 結果 |
|---|---|
| npm test（version-chain/guards/economy/systems/ui-smoke/v3/v4/r66/r68） | ✅ 全綠（R68 static 94 assertions PASS） |
| test-rpg-v4-e2e | ✅ 397 ✓ exit 0（測試釘同步 bump r72） |
| test-rwd-matrix | ✅ 9 視口 × overlay 開/關 全零違規 |
| test-controls-reachability | ✅ 224 項／7 視口（含兩橫式），EXPECTED_REACHABLE_CONTROLS 未動 |
| test-r68-browser | ✅ PASS（淨機重跑；並發載時曾見 loading 秒數超標，屬機況，本機效能僅參考） |
| test-r72-fixed-layers（新） | ✅ 59 項 × 3 視口 |
| test-r72-night-gate（新） | ✅ 28 組合＋7 天氣跨季一致性 |
| 版本鏈 | ✅ CACHE_VERSION=r72-20260719-1；grep 舊版號 `r70-20260719-1` 歸零（r68 SHA-8 資產豁免） |
| 秘密掃描 | ✅ sk-proj／sk-40／xai- 零命中（排除 .git/node_modules） |
| 歷史證據 | ✅ 控制守門寫入 R68 目錄與 process-r68-visuals 觸碰 source-manifest 均已 `git checkout --` 還原（既有債：守門證據輸出路徑仍指 R68，沿 R69.1 註記） |

## 五、證據（docs/evidence/r72/）
- before/：menuscan 掃描原圖（390×844 與 844×390 的 error-recovery／build-wheel，P0 現場）。
- after-390x844-*.png／after-844x390-*.png／after-1366x768-*.png：error-recovery（橫幅完整浮在固定欄之上）、build-wheel（全格在視口內）、overview。
- art-before-after-strip.png（上排前／下排後，64px 縮圖辨識不變）＋ art-metrics.json。
- night/（4 季 storm＋冬雪實截）＋ night-gate.json。

## 六、殘留風險與缺件
- 建造輪高度極端情境（場景可視高 <60px）走限高內捲保底，未另立守門；實測三視口皆整框放得下。
- menuscan P1 殘留未在本輪範圍：橫式設定 modal 長捲（可捲達，僅無捲動提示）、圖鑑 844 六屏長、信箱鎖定列表項被關閉鈕遮（可捲達）——建議併入下輪。
- 工具列 5→3 鍵（C-02）、天氣 tile 化（A-01）、icon 清償（A-02）、主角呼吸幀（A-03）仍屬 Codex 佇列，未動。
- package.json `appVersion` 停在 r68-20260717-1（R70/R71 亦未動，版本鏈守門不含此欄；如需對齊建議下輪連同守門一起擴充）。
