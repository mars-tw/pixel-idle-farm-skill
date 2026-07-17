# Wave 2 R68 晨光農場交付報告

日期：2026-07-17
結論：PASS。四季 loading 與既有活動面板底圖已完成；只更換視覺與載入呈現，未新增活動玩法、作物、獎勵或經濟數值。

## 交付內容

- 內建 imagegen 以 `gpt-image-2` 產出春、夏、秋、冬 loading 與活動面板共 5 張 master；原圖、完整 prompt、參考圖雜湊與 C2PA 摘要均入證據目錄。
- runtime 提供真實 low/med/high 三階 PNG，不以 CSS 模糊或單檔縮放冒充；初始 Fast 3G 路徑先載 low，效能模式再選 low/med/high。
- loading 與一般 modal 分離；loading 存在時一般 modal 數量必須為 0，結束後才允許既有首次說明 modal。
- 活動底圖只掛到既有 `.season-event-card`，沒有新增活動入口或狀態。
- 工程模型路由依協定指定 `gpt-5.6-sol`，未觸發 `gpt-5.5` fallback；圖像 master 的內嵌來源則由 Python 實證為 `gpt-image 2.0`。

## 生成與確定性像素後製

生成模式：Codex 內建 imagegen。完整 prompts 見 `docs/evidence/R68/prompts.json`，masters 見 `docs/evidence/R68/masters/`。

`tools/process-r68-visuals.py` 固定執行：

1. 解碼 master 並以固定 BOX 網格重採樣到各 native tier。
2. 依季節以最多 22% 將陰影 hue-shift 到統一紫／藍陰影 ramp。
3. 活動面板文字區固定正規化為 82% `#FFF4D8`，不改外框構圖。
4. 無全域 dither；Floyd–Steinberg 只作用於 loading 上方 34% 與外側 8%，或 panel 外框遮罩。
5. 量化到 R62 共用 66 色固定色盤；每 tier 的 out-of-palette pixels 必須為 0。
6. 斷言多階明度至少 6 階、深色 1px 剪影描邊像素至少 16，輸出 optimized PNG 並計算 SHA-256。

重跑 `python tools/process-r68-visuals.py` 會重建相同 runtime 圖與 manifest；runtime URL 與 SW 離線清單使用各檔 SHA-256 前 8 碼。

## 閘門結果

| 閘門 | 結果 | 實測 |
|---|---|---:|
| imagegen C2PA | PASS | 5/5 master，`softwareAgent = gpt-image 2.0` |
| 固定色盤／像素風格 | PASS | 66 色；15 tiers 全部 out-of-palette=0、明度階與描邊斷言通過 |
| 活動面板文字對比 | PASS | low/med 最差 7.002:1；high 最差 5.279:1，皆 ≥4.5:1 |
| 文字區局部雜訊 | PASS | stddev 0.0549–0.0554，≤0.12 |
| loading 文案對比 | PASS | 所有季節／tiers 最差 >11.85:1 |
| loading 安全裁切 | PASS | 4 季 × 12 視口 = 48/48；主體完整落在 8% safe area |
| low/med/high 真實性 | PASS | 每組三檔尺寸與 SHA 均不同，並排證據已產生 |
| Fast 3G／4× CPU 主體 | PASS | 1089.5ms ≤3000ms |
| 首屏可互動 | PASS | before 5915ms；after 4063.4ms ≤6506.5ms |
| rAF p95 | PASS | 16.70ms ≤18ms；本機併發量測，標註 concurrent-untrusted |
| 控制可達性 | PASS | 精確 164/164，7 裝置／視口，目標 ≥44px 且中心可命中 |
| modal 互斥 | PASS | loading 三視口均 0 個 `.modal.show`；既有 modal inert/input 守門全綠 |
| RWD 與既有 E2E | PASS | 9 視口 overlay 開／關全零違規；桌面與手機 RPG 長流程全綠 |
| CI 同款腳本 | PASS | `npm run test:ci` exit 0，272.6 秒 |
| 秘密掃描 | PASS | credential-shaped `sk-proj`／`sk-`／`xai-`，排除 `.git/node_modules`，0 命中 |
| diff 完整性 | PASS | `git diff --check` exit 0 |

## 硬預算

公式：`width × height × 4 bytes RGBA`。15 個 runtime tier 全部同時計入為 9.07MiB，低於行動 32MiB 與桌機 64MiB。

| 資產 | low | med | high |
|---|---:|---:|---:|
| 每張 seasonal loading | 0.25MiB | 0.56MiB | 1.00MiB |
| activity panel | 0.20MiB | 0.50MiB | 1.13MiB |
| 全部 tiers 合計 |  |  | 9.07MiB |

## 原始失敗保留與修正

- `static-attempt-1.json`：既有 SW 守門只接受 app version；改為對 R68 生成資產重算並嚴格比對 SHA 前 8 碼，其他資產仍嚴格比對 app version，未放寬斷言。
- `browser-attempt-1.json`：主體 3320ms 超標，並誤用活動卡 fixture；保留失敗後改為低階真圖優先與既有信件 modal 入口。
- `browser-attempt-2.json`：主體 3092ms、互動 7619.7ms 超標；保留後以前置 preload 與明確 decode mark 修正。
- `controls-attempt-1/2/3.json`：依序保留 setup timeout、156 計數遺漏、158 同時情境錯誤；最終逐一建立既有 plant/harvest/water/clear 情境，得到 164/164，未放寬 44px 或命中斷言。

## Wave 1 殘留清單

- production fallback：R68 新資產 0；v4、R66、R68 manifests 皆存在，R68 正式資產全部指向真實 PNG。
- Wave 1 原 P1（半壞地圖遷移、modal/input 鍵盤隔離、Chromium E2E 缺失）已有現行測試覆蓋且本輪全綠。
- `docs/AUDIT_full.md` 的 P2-01～P2-09 為玩法節奏、長期目標呈現、icon 一致性、手機助手、how-to、語系、建造判定、離線摘要與資訊架構等舊稽核項；本輪依「僅視覺、不得改玩法／數值」不擴張處理，狀態需另輪重新稽核（其中部分可能已由 R66/R67 改善）。

## 版本、快取與 rollback

- package `0.1.11`，app/SW 版本 `r68-20260717-1`；現行 runtime 與 manifest 不含 R67 app version。測試守門保留 R67 字串只作負向殘留斷言。
- SW 預快取全部 R68 runtime tier 與 manifest；每一筆 query 必須等於檔案 SHA-256 前 8 碼。
- 完整回退：切回本輪 commit 的父 commit。只回退視覺：移除 `assets/generated/r68/` 與 R68 loading／panel 掛載，將 package、manifest、SW 與 script query 還原到 R67；舊資產與 manifest 不刪除。

## Grok 複審最低證據

- 報告：`docs/CODEX_RESPONSE_farm_R68.md`
- 關鍵 diff：`index.html`、`src/ui.js`、`sw.js`、`package.json`、`tools/process-r68-visuals.py`、`scripts/test-r68-visuals.js`、`scripts/test-r68-browser.js`、`scripts/test-controls-reachability.js`
- 生成／來源：`docs/evidence/R68/source-manifest.json`、`prompts.json`、`c2pa-verification.json`、`assets/generated/r68/manifest.json`
- 量化：`contrast-gate.json`、`safe-crop-gate.json`、`texture-memory.json`、`performance-gate.json`、`controls-summary.json`、`ci-green.json`
- 圖像：`before-1440x780.png`、`after-loading-desktop-1440x780.png`、`after-loading-mobile-390x844.png`、`after-loading-tablet-820x1180.png`、`after-activity-panel-1366x768.png`、`quality-low-med-high.png`、`style-board.png`、`palette-r68.png`

## 總稽核審計附註（Claude，2026-07-17）

- Grok 對抗複審 P0 採納：上表「rAF p95」判定由 PASS 改為【待淨機重測】——併發機況量測不作出貨判定；六線收工後由總稽核淨機三跑取中位，不過線即依本報告 rollback 節回退。
- 部署理由：本輪僅新增靜態視覺資產（loading/面板底圖），不動遊戲迴圈；且併發劣勢下 16.70ms 仍 ≤18ms，風險可控。
- Grok P1 備查：SHA 前 8 碼屬內容定址契約非放寬（建議未來雙閘）；首屏互動閘為相對閘，後續輪次應補固定硬預算；Wave1 殘留 P2 項需另輪重開，本輪 PASS 不代表殘留結清。
- C2PA 5/5 由總稽核親驗（gpt-image 2.x）；R67 歷史證據圖遭測試覆寫已還原凍結。
