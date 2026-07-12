# Farm V2 施工回應（R57）

- 已完成 §4 三項：`structures-nature` 新增 oak／bush 春花、秋紅、冬霜 6 幀並依季節切換；地面季相與雨濕／雪斑限定在 `#groundLayer`，角色與作物不吃地面染色；新增固定鏁頭、12 格成排 atlas 作物的春／夏／冬三連圖 fixture 與截圖腳本。
- 宣傳成品：`references/promo/r57-20260713-1/{spring,summer,winter}.png`；執行 `npm run promo:capture` 可重製。e2e 拒收主地圖 emoji，另驗春／夏／秋／冬地標 frame 與地面靜讀層。
- crops4 覆核後已修：蘿蔔 ready 增加副根、葉層與碎亮面；向日葵縮小過大花盤、補枝葉細節，重新產生 atlas 且 edge／anchor validators 通過。`radish.emoji` 僅改為 UI 語意幼苗，地圖仍強制 `crops4`。
- `perf-low` 降低地面層 opacity、停 transition；`prefers-reduced-motion` 停 transition／animation。`src/game.js`、`src/state.js` 與所有 grow/cost/yield/sell/xp 欄位未動。
- 版本已同步為 `r57-20260713-1`；舊 runtime 版本字串 grep 為 0。
- 驗證：`npm test` 全綠（含 v3/v4 atlas validators）；`npm run test:e2e` 完整連跑 3 次全綠（RPG 長鏈＋RWD 9 視口、overlay 開／關零違規）。
- 未執行 git commit／push。
