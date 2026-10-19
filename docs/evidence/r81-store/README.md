# R81 證據入口

- 最終結論：`verification.json`、`review-results.json`。
- 最終全套執行：`npm-test.txt`、`e2e.txt`、`water-guide.txt`、`night-gate.txt`。全部 exit 0。日誌統一轉為 UTF-8／LF，保留原始測試文字；SHA-256 在 verification.json。
- 審查路徑：91 項檢查，兩部裝置各自從新存檔真觸控取得不同手記；關閉／斷網重開使用相同 Chromium profile，沒有進度 fixture 或加速時鐘。
- 商店圖：`../../store/screenshots/`；尺寸與雜湊在 `../../store/screenshots-manifest.json`。
- `before/` 是本輪改前；`after/` 是十視口便箋／開場與重開／旋轉補證。
- `regression-summaries/` 保留本輪舊閘門的結果，原來 R72／R79／R80 的受版控歷史圖檔已回復，不將本輪結果覆蓋舊輪證據。
- `review-log.txt` 是首次完整審查測試的中間失敗，停在服務工作者自動重載造成失效 walk 狀態；`journey-diagnostic.txt` 記錄 moving=false 卻 action=walk 的重現。已由 state 遷移修正，最終 e2e 與規則測試覆蓋。
- `journey-final.txt` 是修正後單獨生命週期補驗；之後完整 e2e 又驗證兩部裝置與全部視口。以上中間紀錄保留以便追溯，不代表仍有未解失敗。
- `performance-reference.json` 所有數字均為「並發載量測，僅供參考」，待總稽核於閒置機器重測。
- `preserved-existing-work.json` 記錄起始 R68 髒檔的 SHA-256 與不納入本輪的既有未追蹤檔。
