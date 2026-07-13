# Codex 回應：farm form factor P1

## 結果

- 已修 F-P1-01／F-P1-02：現代瀏覽器先採 click 本身或同次 `pointerdown` 的 `PointerEvent.pointerType`；touch 合成 click 仍可由 `sourceCapabilities.firesTouchEvents` 辨識。
- 700ms 全域誤判窗已移除。只有 `window.PointerEvent` 完全不存在的舊瀏覽器才使用 `lastTouchMapAt` fallback，時窗為 350ms。
- 混合裝置回歸已改用真實形狀：`touchend` 後立即派發無 `pointerType`／無 `firesTouchEvents` 的純 `MouseEvent("click")`，驗證農土單擊直作且不產生 touch pending。
- touch 二段確認、mouse／pen／direct 單擊語意維持不變。

## 版本與驗證

- app／HTML query／manifest icon／SW cache／UI fallback／e2e 版本錨已同步 `r58-20260713-1`；`package.json index.html manifest.webmanifest sw.js src scripts` 內舊 `r57-20260713-1` grep = 0（歷史 review／response 文件不改寫）。
- `npm test`：PASS。
- `npm run test:e2e` ×3：PASS（145.3s／144.5s／145.1s），每輪含 RPG e2e 與 9 視口 × overlay 開／關 RWD 矩陣。
- `git diff --check`：PASS。
- 基準 HEAD：`fda1d35`；未 commit、未 push。
