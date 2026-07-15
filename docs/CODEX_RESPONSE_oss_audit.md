# CODEX_RESPONSE — oss-audit 開源版全面檢查與更新

- 專案：`mars-tw/pixel-idle-farm-skill`
- 稽核日期：2026-07-15（Asia/Taipei）
- 基準版本：R59（`r59-20260714-1`）
- 工作範圍：開源文件、授權、素材揭露、repo 衛生、社群分享 metadata、版本一致性與既有測試
- 邊界：未修改 `src/` 遊戲邏輯、遊戲數值或任何 PNG／JSON atlas 素材；未 push

## 結論

oss-audit 已完成。README 已依 R59 現況重寫，MIT 權利人統一為 `mars-tw`，新增素材與第三方工具揭露，補齊 repo 忽略規則、OG URL 與 canonical；R59 release id、npm package 版本及 lockfile 均各自一致。完整本地測試與瀏覽器 E2E 全綠，Markdown 本地連結零失效，未發現應刪暫存檔或疑似 API 密鑰。

## 逐項檢查

### 1. README.md 全面翻新

已更新：

- 遊戲定位、GitHub Pages 線上遊玩連結與現行 R59 release id。
- R59 Miri／Kai 逐幀動作 atlas 重繪、`crops2` 作物品質重繪、15 種作物、四季、動物品質、PWA、放置與 8 小時離線進度等實際特色。
- 滑鼠、觸控二段確認、WASD／方向鍵、`Esc` 與建議開局流程。
- 3 張已入庫的春／夏／冬遊戲截圖。
- 原生 Web 技術棧、專案結構、Node 22／Python 3 本地啟動與 Playwright E2E 指引。
- 現有 `CI & Deploy Pages` badge、MIT badge、Play Online badge，以及 `CREDITS.md`／美術管線連結。

### 2. LICENSE

- 稽核前已存在完整 MIT License。
- 將權利人由別名格式統一為 `Copyright (c) 2026 mars-tw`。
- `package.json` 的 `license` 仍為 `MIT`，與根目錄授權一致。

### 3. CREDITS 與素材盤點

新增 `CREDITS.md`，揭露：

- `assets/generated/` 的 AI 輔助素材來源；repo 設定／manifest 記錄的 `gpt-image-2`，以及 R59 使用內建 `imagegen` 重繪的 Miri、Kai 與 `crops2`。
- 生成後的去背、切圖、縮放、像素修整、anchor 與 frame map 處理，以及部分程序化地形／季相素材。
- AI 輔助封面、製作參考圖與遊戲實機截圖的用途區分。
- 無第三方 Web Font／icon pack；執行時使用系統字型堆疊與 Unicode emoji。
- PWA 圖示為專案檔案；Playwright `1.61.1` 為 Apache-2.0 的 dev-only 工具。

### 4. Repo 衛生與連結

`.gitignore` 新增：

- npm／pnpm／Yarn 快取、coverage。
- Playwright report、test results、blob report。
- `*.tmp`、`*.temp`、`*.bak`、`*.orig`、swap 與尾綴 `~`。
- Python cache、bytecode 與虛擬環境。
- 保留 `.env`／`.env.*` 防護，允許提交無秘密的 `.env.example`。

清理前清單：

| 類別 | 數量 | 處理 |
|---|---:|---|
| tmp／temp／bak／orig／swap／log／pyc／OS 垃圾檔 | 0 | 無檔可刪 |
| `node_modules/` | 1 個已忽略目錄 | 本機測試依賴，保留且未追蹤 |

測試完成後再次掃描，仍為 0 個暫存／測試輸出檔，因此本輪沒有執行刪除。Markdown 連結檢查共解析 9 個本地檔案連結，`BROKEN_COUNT=0`；線上遊玩頁、GitHub Actions workflow 頁與 Playwright 官網連結均可開啟。

### 5. OG metadata

既有 `og:image` 已正確指向：

`https://mars-tw.github.io/pixel-idle-farm-skill/assets/cover.png`

本輪新增：

- `og:url=https://mars-tw.github.io/pixel-idle-farm-skill/`
- `<link rel="canonical" href="https://mars-tw.github.io/pixel-idle-farm-skill/">`

本地瀏覽器驗證兩者均解析為上述正式 GitHub Pages URL，頁面建立 264 個地圖磚且 console 無 warning／error。正式站目前仍是稽核前部署；本地 commit 未 push，需之後由維護者 push 才會觸發 Pages 更新。

### 6. 版本一致性

| 版本域 | 位置 | 結果 |
|---|---|---|
| 遊戲 release id | `package.json.appVersion` | `r59-20260714-1` |
| PWA／資產 release id | `index.html`、`manifest.webmanifest`、`sw.js`、`src/ui.js`、`scripts/capture-promo-trio.js` | 全部 `r59-20260714-1` |
| npm 套件版 | `package.json.version` | `0.1.4` |
| lockfile 根套件版 | `package-lock.json` 頂層與 `packages[""]` | 全部 `0.1.4` |

`0.1.4` 是 npm 套件版，`r59-20260714-1` 是可部署遊戲 release id；兩者是不同版本域，不強制改成同一字面值。存檔 schema `version: 1` 與 atlas manifest `2.0.0`／`3.0.0`／`4.0.0` 也各有獨立相容性用途，本輪不誤改。

### 7. 功能 sanity 與 CI

CI workflow 原先直接執行多支測試，卻漏掉本地 `npm test` 第一關 `scripts/test-guards.js`。本輪僅補上該 CI step，不改任何產品邏輯。

| 驗證 | 結果 | 摘要 |
|---|---|---|
| `npm test` | PASS，exit 0，12.7s | guards、economy、systems、UI smoke、v3/v4 atlas 全綠 |
| `npm run test:e2e` | PASS，exit 0，159.1s | 桌機／手機完整 RPG 流程、真 SW 離線、主地圖 0 emoji、console 0 error |
| RWD matrix | PASS | 9 視口 × overlay 開／關，互動元素零出界、水平溢出 0 |
| 本地瀏覽器 sanity | PASS | 264 tiles、正式 OG/canonical URL、console 0 warning/error |
| `git diff --check` | PASS | 無 whitespace error |

## 變更檔案

- `.github/workflows/ci.yml`
- `.gitignore`
- `CREDITS.md`（新增）
- `LICENSE`
- `README.md`
- `index.html`（僅 metadata）
- `docs/CODEX_RESPONSE_oss_audit.md`（本報告）

## 秘密掃描

依指定模式執行（排除 `.git`）：

```bash
grep -rniE --exclude-dir=.git "sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}" .
```

結果：0 matches（exit 1 代表 grep 未命中）。

## Git 交付

- 本地 commit 訊息：`完成 oss-audit 開源文件與專案衛生更新`
- 本報告與上述變更納入同一個本地 commit，不 push。
