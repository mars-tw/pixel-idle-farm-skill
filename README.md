# 阿軒割割陽光農場

[![CI & Deploy Pages](https://github.com/mars-tw/pixel-idle-farm-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/mars-tw/pixel-idle-farm-skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Play Online](https://img.shields.io/badge/Play-Pages-brightgreen)](https://mars-tw.github.io/pixel-idle-farm-skill/)

一款純原生 HTML/CSS/JavaScript 製作的像素農場 RPG。玩家在 22 x 12 的可走動地圖上種植、接訂單、照顧動物、修橋進入東林，並透過 localStorage 保存進度與離線收益。

## 主要內容

- 可走動像素農場：22 x 12 tile map、camera 跟隨、任務目標鏡頭導引、y-sort 分層與 v4 sprite atlas。
- 種植循環：小麥、胡蘿蔔、番茄、草莓、南瓜；支援澆水、成長加速、離線最多 8 小時。
- 市集訂單：同時 3 張、12 分鐘期限，訂單獎勵在生成時固定；連單每次 +5%，最高 +100%。
- 新手保底：第一張交付任務會固定生成 2 小麥新手訂單，避免卡在隨機需求。
- 任務 Dock：序章 6 步、東林 5 步、動物照護 5 步；地圖金色箭頭與「前往」會指向當前目標。
- 修橋與東林：完成序章並收集木材 6、石頭 4 後修復東橋，解鎖東林古樹、藥草叢與螢光菇木。
- 東林內容鏈：辨認採集點、收集東林藥草與螢光菇、回報商人後，採集品會進入 NPC 委託池。
- NPC 與敘事訂單：村長、商人、老農與孩子會依章節變換台詞；市集訂單顯示委託人與感謝語。
- 動物與品質：雞、牛、羊、蜜蜂可生產蛋、牛奶、羊毛與蜂蜜；餵食、補水、梳理提升親密度並產出優質/頂級品。
- 建築與升級：田地上限 12、成長加速、售價加成、倉庫容量、幫手自動收成/補種；另有堆肥場、筒倉、雞舍、畜棚與蜂箱。

## 玩法

1. 走到告示牌或信箱啟動序章，依任務 Dock 種下小麥、澆水、收成並交付第一張訂單。
2. 清除舊路與地圖障礙取得木材、石頭，材料足夠後走到斷橋修復。
3. 過橋探索東林，採集藥草與螢光菇並回報商人。
4. 解鎖動物照護後，透過餵食、補水、梳理提升親密度，收集高品質產物。
5. 以市集訂單、NPC 委託與直售累積金幣，再回頭升級田地、倉庫、建築與自動化。

## 關鍵數值

| 類別 | 現況 |
|---|---|
| 存檔 | `pixel_idle_farm_save_v1`，schema version 1 |
| 地圖 | 22 x 12，tile 48px，東林從 x >= 17 開始 |
| 起始 | 16 金幣、6 塊田、倉庫 30 |
| 作物 | 小麥 15 秒、胡蘿蔔 45 秒、番茄 120 秒、草莓 300 秒、南瓜 900 秒 |
| 訂單 | 3 欄、12 分鐘、連單 +5% 至 +100% |
| 修橋 | 木材 6、石頭 4；需序章 6/6 |
| 東林採集 | 藥草/螢光菇各 10 分鐘冷卻，回報商人後進委託池 |
| 親密度 | 0-100；35 以上 good，70 以上 premium |
| 離線 | 最多 8 小時 |

## 專案結構

| 檔案 | 說明 |
|---|---|
| `index.html` | 遊戲主頁、CSS、DOM 容器與系列 footer |
| `src/config.js` | 作物、升級、訂單、地圖、橋、東林、NPC、任務與品質數值 |
| `src/state.js` | localStorage 存檔、遷移、地圖與旗標初始值 |
| `src/game.js` | 種植、訂單、修橋、採集、NPC 委託、動物照護與任務推進規則 |
| `src/ui.js` | UI、任務 Dock、地圖渲染、camera、互動面板 |
| `src/atlas.js` | v4 atlas 載入與 frame 查詢 |
| `references/data-model.md` | 存檔 shape、主要常數與測試契約 |

## 測試

```bash
npm test
npm run test:e2e
```

`npm test` 會跑經濟、系統、UI smoke 與 v3/v4 atlas 驗證；E2E 另檢查 RPG 地圖、任務、RWD 與互動流程。

## 📋 更新日誌

- R5：新增新手訂單保底、任務 Dock、修橋材料導引與斷橋互動。
- R9：補上東林內容鏈、採集樣品回報、訂單敘事化與任務鏡頭導引。
- R7 前後：動物親密度、品質產物、照護互動與多章任務串接完成。
- 早期版本：完成 v4 AI pixel atlas、22 x 12 RPG 地圖、離線收益與原生 localStorage 存檔。

## 授權

[MIT](LICENSE) © 2026 mars-tw
