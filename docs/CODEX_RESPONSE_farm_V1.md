# Codex Response farm V1

目標版本：`r56-20260713-1`

## 結論

- V-P0 已修：`radish`／`sunflower` 改走 `crops4` 48×48 五階段 atlas；世界地圖不再使用 `🔴`／`🌻` 系統 emoji。種子列、訂單與 HUD 屬 UI 鉻層，依監工判定保留 emoji。
- V-P1 已修：春夏秋冬常駐同步到頁面天空與地圖底調；雨／暴雨增加濕冷暗色與靜態反光紋，雪天增加冷白覆蓋感，其餘天氣保留既有粒子並補靜態 grade。
- `performanceMode=low` 保留較淡的靜態季節／天氣表意，停用新增轉場；未增加粒子或動畫密度。
- 純規則、經濟數值、存檔 shape 均未變更。

## 資產與管線

- 新增 `tools/generate-crops4-atlas.py`（Pillow 程序化生成，可重跑）。
- 新增 `assets/generated/v4/crops4-48.png`／`.json`：240×96、2 列×5 階段、anchor `[0.5, 0.9]`、暖棕輪廓＋土台。
- v4 manifest、SW 離線快取、renderer config 與 v4 validator 已同步；validator 會檢查 10 幀存在、非空白、anchor、邊界與 config 實際解析。

## 驗證

- `npm test`：通過（含 `validate-v3-atlas`／`validate-v4-atlas`；`crops4` 10 幀通過像素檢查）。
- E2E 成功組 ×3：RPG v4 桌機／手機、真 SW 離線、主地圖 0 emoji，以及 RWD 9 視口 × overlay 開／關均通過。
- 新增 e2e 斷言：冬季底調同步 `html`／`#mapScene`；雨天同步粒子層與地面濕潤層。
- 版本同步：runtime／PWA／測試的舊版 `r55-20260712-1` grep 為 0；`r56-20260713-1` 已同步。
- `git diff --check`：通過；未 commit／push。
