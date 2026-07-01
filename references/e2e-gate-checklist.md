# E2E Gate Checklist

這是「一個 RPG 農場/放置遊戲要算過關，E2E 具體要驗什麼」的清單，以及怎麼延伸現有的
`scripts/test-rpg-v4-e2e.js` 加新斷言。跟 `stage-gate-playbook.md` 的關係：playbook 講
「什麼時候該補 E2E」，這份文件講「E2E 裡具體要斷言什麼」。

## 固定要過的 7 大類

| 類別 | 具體檢查 |
|---|---|
| 世界規模 | 地圖邏輯尺寸 ≥ 設計下限、世界像素尺寸 > 視口（camera 才有意義平移）|
| camera | 角色移動後 `state.camera.x/y` 改變、`#mapWorld` 有套用 `transform` |
| 視覺純度 | 主地圖 **0 emoji**、地面磚/物件全部用 atlas sprite（`backgroundImage` 含 `url(`）、無 CSS 格線（`gap`/`border`）|
| 互動路由 | 選工具 → 點地圖 → 角色走過去 → 播動作 → 結算；不能有「不用走過去就能觸發」的早期全域捷徑 |
| 故事/任務 | 任務鏈可以從頭跑到尾完成、地圖任務標記（marker）指向正確的目標磚 |
| RWD | 桌機 `1280×900`、手機 `390×844` 都要跑；`scrollWidth - innerWidth <= 2`（無水平溢出）|
| 穩定性 | 全程 `console error` 與 `pageerror` 數量為 0 |

外部稽核（人類或另一個 agent 用 DOM 檢查遊戲狀態，不讀原始碼）額外要求：

- 每個可稽核物件都掛 `data-audit="object"` + `data-kind="<類型>"` + `data-sheet="<atlas key>"`
- 玩家角色掛 `data-audit="player"` + `data-tile-id`
- 任務標記掛 `data-audit="quest-marker"` + `data-quest`
- 這些屬性的存在本身就是驗收項——不要只讓內部函式（`window.__farm.state()`）能查，
  外部稽核不應該需要讀懂你的程式碼結構

## E2E 檔案的固定樣板

```js
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");   // 一定用 path.resolve，Windows 反斜線陷阱見下方
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".png": "image/png", ".css": "text/css" };

let failed = 0;
function assert(cond, msg) { if (cond) console.log("  ✓ " + msg); else { console.error("  ✗ " + msg); failed++; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() { /* 起本地 http server 供 chromium 開 */ }
async function waitArrive(page, max) { /* 輪詢 window.__farm.moving() 直到 false，取代固定 sleep */ }

async function run() {
  const { chromium } = require("playwright");
  const server = await startServer();
  const browser = await chromium.launch();
  for (const vp of [{ w: 1280, h: 900 }, { w: 390, h: 844 }]) {   // 桌機 + 手機都跑同一套斷言
    const page = await browser.newPage({ viewport: vp });
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    // ...實際斷言...
    assert(errors.length === 0, "無 console 錯誤 / pageerror");
  }
  if (failed > 0) process.exit(1);
}
```

**Windows 路徑陷阱**：`ROOT` 一定要用 `path.resolve(__dirname, "..")`，不要自己拼字串。
`path.join` 在 Windows 回傳反斜線路徑，如果你拿它跟 URL 解碼出來的正斜線路徑做
`fp.startsWith(ROOT)` 比對，會永遠比對失敗（本機開發時看起來像 404，很難第一時間
意識到是路徑分隔符號問題）。

## 怎麼延伸現有 E2E 加新斷言

新增一個 Stage 的 E2E 覆蓋，遵守這個模式（`test-rpg-v4-e2e.js` 目前每個 Stage 都是這樣）：

1. 在檔案最上面的註解列表補一行，說明這個 Stage 具體驗什麼
2. 找到「上一個 Stage 結束的狀態」在哪裡（通常是某個 `quest === null` 或某個完成度 100%
   的斷言），把新的 Stage 邏輯接在那之後——**不要新開一個獨立的 page/session**，因為
   Stage 越往後的故事推進通常依賴前面 Stage 已完成的狀態（例如 Stage 7 依賴 Stage 5/6
   都已完成才能開始）
3. 用 `page.evaluate()` 直接操作 `window.__farm.state()` 快轉不重要的前置條件（例如給
   夠金幣、直接標記某個舊任務已完成），只留下你這次真正要驗證的互動用真的點擊/走路
4. 需要等真實冷卻/計時器的行為（例如這個遊戲的 `CARE_COOLDOWN_MS`），**不要在 E2E 裡
   真的 sleep 那麼久**——直接用 `page.evaluate()` 回撥 state 裡的時間戳欄位模擬「已經
   過了那麼久」，冷卻邏輯本身的正確性交給 Node 單元測試覆蓋，E2E 只驗證「串起來的流程
   對不對」
5. 跑之前的完整測試（`node scripts/test-rpg-v4-e2e.js`），確認新斷言跟舊斷言都過，
   桌機/手機都要看

## UI 行為變更後的隱藏回歸

改一個純邏輯函式的行為（例如幫某個動作加冷卻）看起來只影響 `src/game.js`，但常常會
連動 UI 層沒被注意到的假設：

- 按鈕如果依「能不能執行」算出 `disabled` 屬性，直接用 `page.evaluate()` 改 state
  **不會**觸發重新渲染，DOM 上的 `disabled` 還是舊的——瀏覽器對 disabled 元素呼叫
  `.click()` 不會觸發 handler，E2E 會卡住卻不容易看出原因。修法：state 改完後主動呼叫
  UI 曝露的刷新函式（例如 `window.__farm.refresh()`）強制重繪
- 任何「連續呼叫同一個動作」的既有測試（Node 或 E2E），行為變更後都要重跑全部，
  不能只跑新加的斷言

## 驗收描述（可直接複製當 Stage Gate 的完成標準）

> 桌機 `1280×900` 與手機 `390×844` 都跑過一輪完整任務鏈（從序章到目前最新章節）：
> 地圖無 emoji、無 CSS 格線、無水平溢出；所有互動走「選動作 → 走到目標 → 播動作 → 結算」；
> 任務標記正確指向目標；`data-audit` 稽核屬性齊全；全程無 console error / pageerror。
