實作者：Codex（GPT-5）。

# CODEX_RESPONSE R74 — 單棟建物升級成長線

2026-07-22。目標：解決真人試玩唯一未解項 FARM-R1-04，讓每一棟已放置建物都有獨立等級、真實效果、可負擔的升級動作與舊存檔相容。版本：`r73-20260720-1` → **`r74-20260722-1`**（npm `0.1.11` → `0.1.12`）。

## 一、資料與規則

- 沿用 `BUILDINGS`、既有 cost helper 與 `Game` 規則，直接在每個建物定義加入三段 `levels`；`levels[0]` 同時是建造成本與 Lv1 效果，再衍生既有 `def.cost`／`def.effect`，沒有另建平行經濟系統或雙份 Lv1 真值。
- 每個建物 instance 的 `level` 獨立。成長光環、倉容、動物容量、訂單 XP、當季直售加成都改讀該棟等級；升一棟不會連帶升同類其他棟。
- 每級 `effect` 表示該級完整效果，不與前級重複相加；全場同類 `maxCount` 與原有防重複效果上限維持不變。
- Lv3 封頂。`upgradeBuilding()` 先查目標建物、上限與全部資源，資源不足時 fail-closed，不扣金幣／材料、不改 level。

| 建物 | Lv1（建造） | 升 Lv2 | 升 Lv3 | 效果線 |
|---|---:|---:|---:|---|
| 堆肥場 | 60 金＋堆肥 3 | 160 金＋堆肥 5 | 480 金＋堆肥 9 | 成長時間 ×0.90 → ×0.84 → ×0.78 |
| 筒倉 | 180 金＋石 4 | 360 金＋石 7 | 980 金＋石 12 | 倉容 +90 → +170 → +300 |
| 雞舍 | 140 金＋木 4 | 320 金＋木 7 | 820 金＋木 12 | 每棟 3 → 4 → 5 隻雞 |
| 畜舍 | 420 金＋木 10＋石 4 | 760 金＋木 14＋石 6 | 1800 金＋木 22＋石 10 | 每棟 4 → 5 → 6 隻牛羊 |
| 祖母花圃 | 木 6＋堆肥 4 | 240 金＋木 10＋堆肥 7 | 720 金＋木 18＋堆肥 12 | 訂單 XP +5% → +8% → +12% |
| 蜂箱 | 320 金＋木 6 | 680 金＋木 10＋堆肥 4 | 1540 金＋木 18＋堆肥 8 | 2/3/4 群蜂；成長 ×0.92/×0.88/×0.84 |
| 鴨舍 | 380 金＋木 8＋石 2 | 720 金＋木 12＋石 4 | 1580 金＋木 20＋石 8 | 每棟 3 → 4 → 5 隻鴨 |
| 豐年祭小攤 | 620 金＋木 8＋石 4 | 1300 金＋木 14＋石 7 | 3000 金＋木 24＋石 12 | 當季直售 +15% → +24% → +35% |
| 溫室 | 760 金＋木 10＋石 6 | 1500 金＋木 18＋石 10 | 3400 金＋木 28＋石 18 | 成長時間 ×0.88 → ×0.82 → ×0.76 |

平衡理由：Lv2 金幣約為建造價 1.8～2.7 倍，保留一次中期可企及的強化；Lv3 再為 Lv2 的 2.2～3 倍，作為後期資源池。每階仍消耗該建物對應材料，避免只靠離線金幣瞬間點滿；三段封頂與效果的遞減邊際避免無限膨脹。倉容實測為基礎 30 加單棟筒倉 90／170／300，即 120 → 200 → 330。

## 二、UI 與成功回饋

- 既有「升級」分頁新增「已放置建物」清單；玩家最近放置的建物優先。卡片顯示建物名稱、Lv x/3、木作等級刻度、目前效果、下一級完整效果、逐項成本與 44px 升級按鈕。
- 沿用 R72 語言顯示 `可負擔`／`資源不足` 徽章；成本 chip 逐項標示不足。R72 升級頁籤紅點也納入可負擔的單棟升級，做到「看到數字就有可執行動作」。
- 地圖上點建物的既有泡泡新增「升級」，會導到該棟磚資訊；磚資訊內放同一張升級卡，避免玩家必須猜測全域入口。
- 成功後沿用既有回饋語言：level-up fanfare、程序化升級音、建物位置 `quality_sparkle` 與 toast（建物名、到達等級、實際效果）。沒有新增 AI 美術。

## 三、舊存檔遷移證據

`sanitizeBuilding()` 對 R73 舊建物缺少／非法 `level` 時安全預設 Lv1，合法既有等級保留，過低／過高髒值夾到 1～3；不重建或刪除建物，也不改 footprint／tile binding。

`npm run test:r74` 的純規則測試輸出重點：

- `✓ 缺 level 的舊存檔保留全部 4 棟建物（含 b_compostHeap_3、b_silo_4）`
- `✓ 舊存檔遷移保留每棟建物與原地圖 footprint/磚綁定`
- `✓ 舊建物缺 level 時一致安全預設 Lv1`
- `✓ 遷移後 Lv1 堆肥與筒倉效果可正常計算`
- `✓ 合法 Lv2 在遷移後保留`
- `✓ 超過上限的髒 level 夾回 Lv3`

## 四、自動化與 gate

| Gate | 最終結果 |
|---|---|
| `npm test` | ✅ exit 0（22.8 秒）；version-chain、guards、economy、systems、R74 遷移／經濟、UI smoke、v3/v4 atlas、R66、R68 static 94 assertions 全綠 |
| `npm run test:e2e` | ✅ exit 0（226.4 秒）；RPG e2e、12 視口 RWD、controls、R68 browser、R73 回歸、R74 三尺寸實際升級流程串行全綠；瀏覽器全數正常關閉 |
| `npm run test:r74` | ✅ exit 0（17.0 秒）；9 種建物資料、成本／上限、fail-closed、真實效果、舊檔遷移與 3 視口 UI 操作全綠 |
| `npm run test:rwd`（完整 e2e 內） | ✅ 12 視口；頁級捲動、水平溢出、互動出界、overlay 開關全綠 |
| `npm run test:controls`（獨立與完整 e2e） | ✅ `EXPECTED_REACHABLE_CONTROLS` 236 → 272，實測 272/272 |
| `npm run test:r72` | ✅ exit 0（118.2 秒）；390×844、844×390、1366×768 fixed-layer／抽片／建造輪全綠 |
| 版本鏈 | ✅ `CACHE_VERSION=r74-20260722-1`；package、index、UI fallback、SW、manifest query 一致 |
| manifest 格式 | ✅ `CR=0, LF=25`，LF-only |
| 舊 runtime 版號 | ✅ R74 scoped runtime／測試搜尋 `r73-20260720-1` 為 0 命中 |
| 秘密掃描 | ✅ R74 scoped OpenAI／GitHub／AWS／Slack token 與 private-key header 模式 0 命中 |
| `git diff --check` | ✅ 0 whitespace error |

控制差異為 9 個既有守門視口 × 4 個新控制：預置雞舍卡、預置畜舍卡、建物泡泡升級入口、磚資訊升級鈕，共 +36。R74 E2E 另在 390×844、844×390、1366×768 真實 click 新放置堆肥場與筒倉，驗證 44px 命中、資源扣除、Lv2 效果、toast／fanfare／sparkle、筒倉總倉容 120 → 200，且全流程無 pageerror。

## 五、before / after 證據

`docs/evidence/r74/`（六張皆為本輪擷取並已目視 QA）：

- `before-390x844-upgrades.png`／`after-390x844-building-upgrades.png`
- `before-844x390-upgrades.png`／`after-844x390-building-upgrades.png`
- `before-1366x768-upgrades.png`／`after-1366x768-building-upgrades.png`

before 為 R73 只顯示全域升級的狀態；after 為 R74 實際放置堆肥場／筒倉、將堆肥場升到 Lv2 後的建物清單。測試觸碰的 `docs/evidence/R68` 與 `docs/evidence/r72` 已精確還原，歷史 evidence 最終零變動。

## 六、版本與殘留

- release id：`r74-20260722-1`；npm version：`0.1.12`。
- Commit：本報告隨同 R74 file-scoped commit；hash 以最終回報為準。不 push。
- FARM-R1-04 本輪功能／測試殘留：無。
- 使用者既有未追蹤 `docs/audit_openclose/`、`docs/playtest/`、`scripts/audit-oc-r1.js` 保持原狀，不納入提交。
