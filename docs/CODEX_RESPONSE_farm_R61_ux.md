# farm R61 UX/RWD 重設計回報

## 對照結果

- A. 手機虛擬控制盤：已在 `#mapScene` 疊加 D-pad 與 A 鍵；D-pad 重用逐格移動，A 鍵對玩家面向磚執行情境動作。滑鼠桌機隱藏，觸控或 `<=859px` 顯示。
- B. 畫面內情境動作 dock：已新增 `#sceneActionBar`，點磚後在地圖底緣出現種植、收成、澆水、使用、交付等大圖示鈕，手機不用捲到側欄。
- C. 就地建造輪盤：建造工具點草地時顯示 `#buildWheel`，只列出已解鎖且付得起的建築，點圖示直接呼叫既有 `buildBuilding`。
- D. 點物件就地照護：作物、建築、動物物件可直接點；成熟作物立即收成，建築/動物旁顯示 `#objectBubble`，重用餵食、澆水、梳理、收集流程。
- E. 作物 quickbar：原 15 種常駐作物列改為地圖 HUD quickbar，保留當前作物、最近使用與展開鈕；完整清單收進 drawer，不改存檔資料。
- F. 桌機 RWD 填滿：放寬整頁寬度與地圖高度上限，桌機 grid 改為地圖優先吃剩餘寬度；RWD matrix 9 視口零出界。

## 改動檔案

- `index.html`：RWD/CSS、地圖內 HUD、action dock、build wheel、object bubble、mobile controls。
- `src/ui.js`：quickbar render、scene action 執行、建造輪盤、物件氣泡、D-pad/A 鍵、點物件委派。
- `scripts/test-guards.js`、`scripts/test-rpg-v4-e2e.js`：R61 UX 守門與手機互動 e2e 更新。
- `package.json`、`package-lock.json`、`sw.js`、`manifest.webmanifest`、`README.md`、`CREDITS.md`：R61 版本與快取版本更新。
- `docs/evidence/R61_ux/`：三視口驗收截圖。

## 截圖

- `docs/evidence/R61_ux/desktop-1440.png`
- `docs/evidence/R61_ux/tablet-820.png`
- `docs/evidence/R61_ux/mobile-390x844.png`

## 驗證

- `npm test`：通過。
- `npm run test:e2e`：通過。
- 秘密掃描：`grep -rniE --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=tmp "sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}" .`，0 命中。

未修改 R60 重繪素材，未變更既有存檔資料結構。
