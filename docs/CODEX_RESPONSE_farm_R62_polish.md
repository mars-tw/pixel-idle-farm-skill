# farm R62：像素精緻化回報

## 結論

R62 已完成地形重繪與全套 runtime atlas 色盤收斂。`assets/generated/v4/terrain-organic-32.png` 不再沿用 Stage 4 的 v3 位元組：v3 SHA-256 為 `C3D910E7D28E67AD961B002AA1E5B83C18EE1E1821747C154EE7D8A30FD33E16`，R62 v4 為 `8461DD97E5DDE4C73FDA60ADDFA760BA1B652E0025015A14D3A39C8274C1873D`。

本輪只改點陣圖與版本／快取接線，沒有修改 atlas JSON、frame id、config、遊戲邏輯或存檔 schema。版本為 `0.1.6` / `r62-20260715-1`。

## 六項精緻化標準：before / after

| 標準 | Before | After |
|---|---|---|
| 1. 多階明度與色相偏移 | 地形大面積使用單一中間色，邊緣多為同色加深；建築、作物、動物各自使用不同來源色盤。 | 每個材質族使用至少 4 階、最多 9 階：陰影往藍紫／冷綠偏，亮部往黃綠／赭金偏。草、土、水、木、紅、金、紫、neutral 均有獨立 ramp。 |
| 2. 選擇性 dithering | 草／路／水主要靠隨機單點，土壤以平行色帶表現，放大後可見生硬 banding。 | 草、路、土只在局部 4–7px 區域套規律 4×4 Bayer pattern；水面與 soft shadow 依曲面／距離套 ordered dither，不鋪滿整張，色帶已拆散。 |
| 3. 邊緣處理 | path/soil 是筆直 3px 綠邊，water 是筆直灰邊；素材間 outline 色不一致。 | path/soil 改成 3–5px 不規則草緣，water 改成自然土岸；接觸線用共同冷紫 outline，內側加 1px 暖色 selective AA/rim。透明 sprite 的下／右輪廓收冷、上／左受光邊收暖。 |
| 4. Rim light | 地形幾乎沒有受光邊；建築、作物和圖示的 rim 色溫不一致。 | 草岸、土岸、橋板、水波、土壤溝紋都補 1px 暖色亮邊；全 runtime sprite 依上／左受光、下／右冷影的同一規則整理。 |
| 5. 統一有限色盤 | v3/v4、AI 來源、程式生成素材各自保留大量近似雜色。 | 22 張 runtime sheet（terrain + 21 張 sprites）統一到 66 色 master palette；腳本驗證所有不透明 RGB 均屬於這 66 色。 |
| 6. 大面積地形細節 | v3/v4 terrain 完全相同；草是噴點綠色、土是平直條紋、水是簡單水平線，同框中像貼色紙。 | 原生 32px 重畫 49 個既有 frame：草葉群集、花叢、土粒／小土塊、破碎溝紋、路面卵石、水面細波、自然岸線、木橋木紋／釘點與 dither soft shadow。 |

R60 重畫的鴨、`crops3-48`、`crops4-48` 保留原 pose、frame 內容與 alpha，只做共同色盤、邊緣與明度統一。

## 色盤

R62 master palette 共 66 色：

- outline 4 色：`#251D35` → `#5B4758`
- foliage 8 色：`#344657` → `#D0E47A`
- earth/wood 8 色：`#483044` → `#F0D082`
- water 8 色：`#2F3450` → `#B7E5D4`
- red 8 色、gold 8 色、violet 8 色
- neutral 9 色、sky 5 色

完整色票：[palette-r62.png](evidence/R62_polish/palette-r62.png)

## 地形重繪細節

- `512×512`、`32×32` frame、16 欄 atlas 尺寸不變；49 個 frame id 與座標沿用原 JSON。
- `grass_center_01..04` 以不同 seed 產生可替換草葉群集；flower/clump 仍在原位置。
- path、dry soil、wet soil、water 的 `c/n/s/e/w/ne/nw/se/sw` 命名與連接語意不變。
- 土壤溝紋改成斷裂、錯列的冷影＋暖下緣；乾土與濕土共享土色族但濕土影部更偏紫。
- 水面使用 4 階藍綠 ramp、低頻 ordered dither 與 1px 波峰；岸線改為不規則土岸並混入稀疏草唇。
- bridge 保留 horizontal/vertical frame，加入 5 階木色、板縫、木紋、釘點與 rim。
- `shadow_soft` 不再使用平滑 radial gradient，改用 3 階 alpha 的規律 dither 橢圓。

可重建命令：

```powershell
npm run art:r62:polish
```

生成器會同時驗證：atlas 尺寸不變、21 張非 terrain runtime sheet 的 alpha mask 逐像素不變、所有不透明色都在 R62 palette 內。

## Before / after 證據

- 地形 atlas 對照：[terrain-before-after.png](evidence/R62_polish/terrain-before-after.png)
- 整體同框對照：[overall-before-after.png](evidence/R62_polish/overall-before-after.png)
- 建築／作物／動物／UI 對照：[assets-before-after.png](evidence/R62_polish/assets-before-after.png)
- terrain before：[terrain-before-atlas.png](evidence/R62_polish/terrain-before-atlas.png)
- terrain after：[terrain-after-atlas.png](evidence/R62_polish/terrain-after-atlas.png)
- 遊戲 before：[overall-before.png](evidence/R62_polish/overall-before.png)
- 遊戲 after：[overall-after.png](evidence/R62_polish/overall-after.png)

## Imagegen 方向稿

使用內建 `image_gen` 的 `precise-object-edit` 模式，以舊 terrain atlas 為 edit target 產生材質方向稿：[terrain-direction-imagegen.png](evidence/R62_polish/terrain-direction-imagegen.png)。生成結果只作草葉群集、土粒、冷影暖光、水波與岸線語彙參考；因模型無法保證 32px 格線、透明區和 frame 座標零漂移，production atlas 由確定性像素生成器落地。

最終方向 prompt：

```text
Use case: precise-object-edit
Asset type: production direction sheet for a cozy top-down pixel-art farm terrain atlas
Input images: Image 1 is the edit target and exact atlas layout reference
Primary request: polish the existing grass, dirt path, dry soil, wet soil, water, bridge, flowers, pebbles, grass clump, and soft shadow tiles so they look materially more refined and handcrafted.
Style/medium: crisp true pixel art at native sprite scale, restrained 16-bit cozy farm aesthetic, no blur and no painterly filtering.
Color palette: one finite cohesive palette; grass uses cool violet-green shadows, neutral green midtones and warm yellow-green highlights; soil uses muted plum/brown shadows, earthen midtones and warm ochre highlights; water uses deep blue-violet shadows, teal-blue midtones and pale cyan highlights; wood shares plum-brown shadows and honey highlights.
Materials/textures: every material visibly uses 3-4 value steps; selective ordered 1px dithering only on broad curved/gradient transitions; tiny soil grains, scattered grass blades and tuft clusters; organic non-repeating seams; crisp selective 1px dark outlines/AA on key transitions; warm top/left rim highlights and cool lower/right shadows.
Constraints: preserve the exact 16-column 32px tile order and identity shown in Image 1; preserve grass/path/soil/water connectivity intent; no labels, no grid lines, no text, no watermark. Treat this as a visual direction reference: prioritise legible native-scale pixel clusters, seamless edge continuity and avoidance of color banding.
Avoid: smooth gradients, antialiased vector edges, noise sprayed uniformly over every pixel, photorealism, muddy gray shadows, thick black outlines, new object categories.
```

## 相容性與驗收

- `npm test`：通過。
- `npm run test:e2e`：通過，含桌機／手機故事鏈、真 SW 離線與 atlas 稽核。
- `npm run test:rwd`：通過，9 視口 × overlay 開／關，零出界、零頁級捲動、零水平溢出。
- `scripts/test-rpg-v4-e2e.js` 只同步 R62 SW/PWA 版本斷言，測試條件未放寬。
- `git diff --check`：通過。
- 秘密掃描：排除 `.git`、`node_modules`、`tmp` 後零命中。
- 未修改存檔 schema、config、atlas JSON、frame 名稱／座標或遊戲邏輯；舊存檔遷移測試通過。

本地提交訊息：`美術：完成 R62 像素精緻化與地形重繪`。不 push。
