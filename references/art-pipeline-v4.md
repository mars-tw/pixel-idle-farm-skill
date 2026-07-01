# v4 像素美術產線

這份文件講「怎麼從一個 prompt 變成遊戲裡精確可用的 sprite atlas」，適用於任何用
gpt-image-2（或類似模型）產生像素美術、再切成 frame atlas 的專案。目前這個遊戲用這套
產線生成了 16 張 sheet（角色 × 2 性別、四向動作、NPC、作物、動物、建築、自然結構、
動物照護系列），全部驗證通過、零人工修圖。

## 產線四步

```
art-config-rpg-v4.json  →  scripts/gen-art-v4.js  →  scripts/process-v4-atlas.js  →  scripts/validate-v4-atlas.js
     （規格）                  （呼叫 gpt-image-2）      （去背/切割/縮放/錨點）         （品質驗證）
                                      ↓                         ↓
                         assets/generated/v4/source/*.png   assets/generated/v4/*.png + *.json + manifest.json
```

四步都要做完才算一個素材週期完成；不要生了圖就先放著，先切割驗證過才進下一步的開發。

## 第一步：art-config 規格

`art-config-rpg-v4.json` 是唯一的素材清單。一個 sheet 的格式：

```json
{
  "id": "npcs-48x64-v4",
  "targetFile": "npcs-48x64.png",
  "size": "1024x1024",
  "grid": "4 columns x 4 rows",
  "rows": ["mayor", "merchant", "elder", "child"],
  "prompt": "Pixel RPG townsfolk NPC spritesheet, original characters, all FRONT-FACING..."
}
```

`globalConstraints` 陣列會附加到每個 sheet 的 prompt 後面，放跨 sheet 一致的規則
（不要文字、不要浮水印、透明背景、格子間留白）。

**寫 prompt 的原則**：
- 明確給格數、每格代表什麼（例如「四列四欄，欄=idle_a/idle_b/talk_a/talk_b」）
- 明確要求「generous spacing between objects」——物件間距太近會讓切割演算法把兩個物件
  合併成一個（見下方 `sliceLoose` 的教訓）
- 角色類 sheet 要重申完整服裝描述（髮型/上衣/吊帶/配件），不要只寫「同上一張」——
  gpt-image-2 每次呼叫是獨立的，沒有記憶
- 明確寫「absolutely NO person / NO human character」在純物件類 sheet 的 prompt
  裡——這個專案第一版美術漏了這句，導致農場物件/動物 sheet 裡混進了農夫（見下方
  「常見陷阱」）

## 第二步：生圖

```bash
OPENAI_API_KEY="你的金鑰" node scripts/gen-art-v4.js                    # 全部 sheet
OPENAI_API_KEY="你的金鑰" node scripts/gen-art-v4.js npcs-48x64-v4      # 只生指定 sheet（用 id）
```

輸出到 `assets/generated/v4/source/*.png`。**金鑰只能用環境變數傳入，絕不寫進檔案或
commit**（見 README「安全：API 金鑰請用你自己的」）。

## 第三步：切割

`scripts/process-v4-atlas.js` 是 Node 端的 Playwright 驅動器：起一個本地 HTTP server、
開 `scripts/gen-v4/processor.html`（在瀏覽器 canvas 裡做實際切割，因為需要 `Image`/
`Canvas` API），讀 `window.__v4`，把結果存成 PNG + JSON + `manifest.json`。

切割核心有三種模式，看源圖的排版選：

### `sliceGrid`：規則網格（大多數 sheet）

先用「內容帶偵測」（`findBands`）而非單純等分格找每列/每欄的實際邊界：計算每一列/欄
的 alpha 投影，找出「投影 > 門檻」的連續內容帶，數量對不上預期格數時，合併最窄的間隙
或拆分最高的帶，直到帶數等於格數。切點落在相鄰帶的間隙中點。

**這是從舊版「引導式最小值切割」（`guidedCuts`：在名目格線附近找最空的位置下刀）升級來
的**——引導式切割在源圖行距不規則時，切點可能真的落在一整列都是空白的地方，導致整列
frame 是空的。內容帶偵測直接找內容，不會切到空白帶。

每格再取「最大連續垂直內容塊」的緊緻 bbox（用意是丟掉相鄰格洩漏進來的碎片，同時保留
貼身的特效如水花），用同一列的中位數高/寬定出這一整列的縮放比例（保持同列角色大小
一致），並用 `fill`/`wfill` 參數控制縮放上限（留 padding，避免作物成熟階段這種比較大
的內容觸碰格邊被裁切）。

### `sliceActions`：合併兩張 12 列成一張 24 列

角色動作太多（8 個動作 × 3 方向 = 24 列），一次生圖容易品質下降，所以拆成兩張
`xxx-actions-a.png`/`xxx-actions-b.png` 各生 12 列，切割時合併進同一個輸出 atlas
（`sliceActions` 內部呼叫兩次 `sliceInto`，`rowBase` 分別是 0 和 12）。遊戲端完全不用
知道背後是兩張源圖，讀到的是一個連續 24 列的 atlas。

### `sliceLoose`：不規則排版（自然結構/裝飾物）

有些 sheet 沒辦法用規則網格描述（例如「疏落擺放的樹木/招牌/路燈」，每個物件大小、
長寬比都不同）。`sliceLoose` 改用連通元件（8-鄰接 flood-fill）找出每個獨立物件的 bbox，
合併距離太近的碎塊（避免同一棵樹的葉子被切成兩塊），依 y 座標分列帶、帶內依 x 排序，
對應到 `names` 陣列，用 shelf packing 重新排版輸出。

**常見陷阱**：如果兩個物件在源圖裡靠太近，連通元件合併演算法會把它們當成同一個物件，
導致實際抽出的物件數少於 `names.length`（會印警告 `抽到 X 物件，預期 Y`）。這個專案
真的發生過：`structures-nature.png` 原本要 12 個物件，只抽出 10 個（水槽跟稻草人被
合併吃掉，從未真的產生過 frame）。**修法不是重花 API 額度重生圖**，而是把 `names`
清單改成跟實際可靠抽出的數量一致，同時在 prompt 裡強調更大的物件間距，供未來重生時
使用。

## 第四步：驗證

`scripts/validate-v4-atlas.js` 做兩層檢查：

1. **結構檢查**（純 Node，永遠會跑）：PNG 尺寸是否等於 JSON meta、grid 能否整除、
   `REQUIRED` 清單裡的必要 frame 是否都存在、座標有沒有出界、需要 anchor 的 sheet
   是否都有 anchor、遊戲程式碼實際會用到的 frame id（讀 `src/config.js` 反查）是否都
   能在 atlas 裡解析到。
2. **像素檢查**（需要 Playwright/chromium，缺的話降級成 warning 而非失敗）：每個
   `REQUIRED` frame 的 alpha 覆蓋率是否夠高（抓真正的空白幀）、內容是否貼近或觸碰格邊
   （抓被裁切的作物）。

`REQUIRED` 清單是特意维护的「這個遊戲實際會用到」清單，不是「這張 sheet 理論上有的
所有格子」——像 `structures-nature` 只硬性要求 `oak`（因為只有 tree 障礙物真的會用到
這張 sheet 的內容），其餘裝飾性物件抽取失敗只會 warn。

## 新增一張 sheet 的具體步驟

1. 在 `art-config-rpg-v4.json` 加一筆 sheet 定義（id/targetFile/size/grid/rows/prompt）。
2. `node scripts/gen-art-v4.js <新 sheet 的 id>` 生圖，肉眼檢查
   `assets/generated/v4/source/<targetFile>` 品質（有沒有混進不該有的人物、格線是否
   乾淨、風格是否跟其他 sheet 一致）。
3. 在 `scripts/gen-v4/processor.html` 的 `(async function(){...})()` 主流程裡加一行
   `out.xxx = await sliceGrid(...)`（或 `sliceActions`/`sliceLoose`），決定 frame 命名
   規則（跟遊戲程式碼要用到的 id 對齊，通常是 `${row}_${col}` 或明確列出的變體名）。
4. 在 `scripts/process-v4-atlas.js` 的 `FILES` 物件加一筆 `key: "輸出檔名"` 映射。
5. `node scripts/process-v4-atlas.js` 實際切割，用圖片檢視器、瀏覽器截圖或任何視覺檢查
   工具人工確認切出來的結果——不要只看驗證器綠燈，肉眼看一次品質。
6. 在 `scripts/validate-v4-atlas.js` 的 `REQUIRED` 補上這個 sheet 遊戲會用到的 frame id
   清單，跑 `node scripts/validate-v4-atlas.js` 確認全綠。
7. 在 `src/config.js`／`src/ui.js` 接上實際的遊戲邏輯與渲染（新素材如果沒有接玩法，
   等於沒做——見 SKILL.md 的「開源技能規則」）。

## 常見陷阱總表

| 現象 | 原因 | 修法 |
|---|---|---|
| 去背後角色/物件邊緣有雜色殘留 | gpt-image-2 把棋盤格烤進 RGB（`background:transparent` 參數常不生效） | `debg()` 用自適應 flood-fill（亮度高+低飽和度視為背景），角色深色描邊能隔開背景不被誤吃 |
| 整列 frame 是空的 | 引導式切割的切點落在不規則行距的空白帶 | 改用內容帶偵測（`findBands`），永遠切在有內容的帶邊界 |
| 高大的內容（如成熟作物）觸碰格邊被裁掉一角 | 縮放比例算得太滿，沒留 padding | 調整 `fill`/`wfill` 參數（縮小一點的填充上限） |
| 抽出的鬆散物件數少於預期 | 物件間距太近，連通元件合併把兩個物件當一個 | prompt 要求更大間距；`names` 清單改成跟實際抽出數量一致，不用重花額度重生 |
| 同一角色不同 sheet（如 walk vs actions）比例/服裝不一致 | prompt 沒有重申完整外觀描述 | 每張 sheet 的 prompt 都要完整寫一次角色外觀，不要依賴「跟前一張一樣」 |
| 物件 sheet 混入不該有的人物 | globalConstraints 只講角色規格，沒有明講「其他 sheet 不能有人」 | 每個純物件 sheet 的 prompt 都要加「absolutely NO person, NO human character」 |
