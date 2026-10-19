# 陽光農場 R89｜美術第八輪

2026-10-18，main，起點8b1193e。**0.1.23／r89-20261018-1**。本機素材、接入、截圖、現行CI與來源讀回：**VERIFIED**。目標8分仍待獨立Muse複評，本次沒有自造分數。先審：art/ART_REVIEW_R89.md；計畫：OPTIM_PLAN_R89.md；方向：art/ART_DIRECTION.md。

## 唯一驗收清單：Muse R7第4節五項

| 原項目 | 改動、驗收與證據邊界 | 改後原尺寸截圖 |
| --- | --- | --- |
| 1 一次把光做完 | 地表改為單一1536×1024生成繪圖，延伸地圖外緣；停用重複草／石徑及庭院遮罩拼接。生成右上窄起、左下寬落的斜束與不規則暖光池，冷葉影做半影，避免矩形截斷。帽肩與葉緣同向暖邊光；同齡同frame兩苗，光內大22%、暖亮，光外維持原尺寸與冷色。無字原尺寸也保留可見來向；三秒真人盲測未做。 | [iPhone原圖](store/screenshots/iphone-02-sunlight.png)；[iPad原圖](store/screenshots/ipad-02-sunlight.png)。無字原圖：evidence/r89-art/iphone-no-text.png、ipad-no-text.png。 |
| 2 藤簍與接觸影 | 先畫Miri正／側／背與三表情。生成寬口編藤簍，深色開口、粗金編紋與外垂紅格布映入原背物區；72張真姿勢的alpha、腿部及作用幀不變。主角、四位鎮民、樹、木箱、水桶與大物件加同向柔邊橢圓影。腳下站位環，NPC提示移到旁邊，沒有胸口大記號。64px三視圖為原幀最近鄰輸出，非單圖晃動。 | [iPhone原圖](store/screenshots/iphone-02-sunlight.png)；[iPad原圖](store/screenshots/ipad-02-sunlight.png)；[iPhone原圖](store/screenshots/iphone-detail-porch.png)；[iPad原圖](store/screenshots/ipad-detail-porch.png)。64px：evidence/r89-art/character-three-views-64.png；設定：art/character-sheets/miri-r89.png。 |
| 3 商店時間軸 | 每台裝置同一次真實流程：歡迎→澆水→成熟收成→餐籃二選一→葛瑞回應→印章冊；不再倒回0/9。送達後顯示3/3，按「繼續農場故事」接回既有章節，沒有永久蓋掉主線。金幣與背包保留逐張讀回；選卡不扣、交付只扣小麥2。圖02為明示精確同齡視覺fixture，其餘為真實輸入，不把fixture冒稱賺得進度。 | iPhone與iPad各01-welcome、02-sunlight、03-harvest、04-basket、05-note、06-daily，皆在docs/store/screenshots/。[iPhone原圖](store/screenshots/iphone-03-harvest.png)；[iPad原圖](store/screenshots/ipad-03-harvest.png)；圖組evidence/r89-art/store-six-preview.webp。 |
| 4 明確確認鈕、刪雜訊 | 選卡只顯示紅框與「已選」，重按卡片仍不扣款。固定底列「交付小麥 ×2 給葛瑞」明示對象和代價，未選先disabled；返回降為次操作。小手機確認鈕移出可捲動正文，始終可點。刪第三農務牌選種提示，規則字深茶14px，極小／矮橫式12px下限。 | [iPhone原圖](store/screenshots/iphone-04-basket.png)；[iPad原圖](store/screenshots/ipad-04-basket.png)；[iPhone原圖](store/screenshots/iphone-06-daily.png)；[iPad原圖](store/screenshots/ipad-06-daily.png)。七視口選取／扣款／44px證據：evidence/r89-art/art-validation.json。 |
| 5 圖文／遮擋 | 新故事插畫完整畫出第三張空椅，籃子縮到側邊，手機保留整張寬圖，兩張臉與椅子都不被直式裁掉。葛瑞頭像只刪斷離的下巴殘片。男孩visual向上移位避方向鍵，保留原水平站位與地面排序；標籤移右上，屋頂降飽和，主角腳下站位環。既有門邊以兩張補充商店原圖驗收，不插入六張故事時間軸。 | [iPhone原圖](store/screenshots/iphone-05-note.png)；[iPad原圖](store/screenshots/ipad-05-note.png)；[iPhone原圖](store/screenshots/iphone-detail-porch.png)；[iPad原圖](store/screenshots/ipad-detail-porch.png)。六圖縮圖evidence/r89-art/store-six-preview.webp。 |

以上為本機畫面與確定性守門 **VERIFIED**；真人三秒光向、64px身份及五秒交付辨識沒有受測者，不稱已驗證。R6反覆點名的光向、同齡苗、藤簍、面板完整邊界及故事空紙均併入同五項。

## 新美術與來源

**9張新生成母圖、29張遊戲用輸出；9次實際image_gen.imagegen呼叫，精確模型slug未揭露，actualModelSlug=null。** 母圖涵蓋連續地表、角色設定、斜射暖光、三椅茶桌、苗株／藤簍、紙框、六圖示、四字Logo、App圖示。全部共用相同風格前綴，完整提示：art/PROMPTS_R89.json；PROMPTS.json更新現行入口。母圖：art/masters/r89/與character-sheets/；來源hash、原尺寸、透明、色盤、雙閘門及動畫保留證據：assets/generated/r89/manifest.json。

後製：保留真正RGBA、透明RGB清零；cutout四角與occupancy讀回；輸出alpha mask、去污染RGBA master、opaque對照母版，保留各hash。像素圖統一受管色盤、native縮圖、nearest-neighbor；地表無損WebP，光影保留連續alpha。新三表情、行走／農務全過亮度0.30–0.75、近黑<35%、飽和≥0.32、低飽和<20%。原seed與mature階段保留，新苗／長葉／金麥仍使用原五階段ID，沒有改數值。CREDITS.md追加本輪，舊素材與授權完整保留。

新圖片 929,927 bytes；Web runtime allowlist 106,674,929→107,690,714 bytes，增加 **1,015,785 bytes（0.97 MiB）**。母圖及證據不進既有Web發布allowlist。未建IPA／AAB，不把Web差額稱原生包體。

## 截圖與數字軌跡

同場景改前／改後各16張：art/compare/r89/before/、after/；四視口390×844、844×390、1032×1376、1366×600。overview.webp只是索引，原PNG皆保留。商店主圖12張：iPhone1290×2796、iPad2064×2752；另2張同尺寸門邊補充圖。12張真實流程圖＋2張同齡視覺fixture，全部由遊戲直接渲染，無宣傳合成。fixture停在既有澆水第4幀，不執行作用callback、不發獎。

兩次完整實際流程耗時：iphone 28.733秒; ipad 29.322秒。下表的02是同次真實流程讀回，精確同齡替代圖保留同樣的初始金幣／背包，沒有偽造收成；兩者分別保存在store-real與商店原圖中。

| 裝置／階段 | 金幣 | 小麥庫存 | 已送達 |
| --- | ---: | ---: | --- |
| iphone 01-welcome | 16 | 0 | False |
| iphone 02-sunlight | 12 | 0 | False |
| iphone 03-harvest | 12 | 2 | False |
| iphone 04-basket | 12 | 8 | False |
| iphone 05-note | 12 | 6 | True |
| iphone 06-daily | 28 | 4 | True |
| ipad 01-welcome | 16 | 0 | False |
| ipad 02-sunlight | 12 | 0 | False |
| ipad 03-harvest | 12 | 2 | False |
| ipad 04-basket | 12 | 8 | False |
| ipad 05-note | 12 | 6 | True |
| ipad 06-daily | 28 | 4 | True |

## 驗證

- 完整npm run test:ci、指定R79、補充澆水引導／夜間與本輪美術守門全綠；精確命令、exitCode、耗時與log在evidence/r89-art/final-checks.json。本輪133項，七視口320、390、844橫式、768平板、1366矮筆電、430商店、1032商店。既有測試與斷言沒有刪除／放寬，只同步精確新圖路徑與新確認按鈕輸入；另加重按選卡不扣款及作用幀只扣2的檢查。
- desktop三跑[16.8, 16.7, 16.8]，中位16.8ms；mobile三跑[16.7, 16.7, 16.7]，中位16.7ms。三跑中位均≤18ms；共用機並發結果僅參考，未替代原生實機出貨證明。
- JS語法、版本鏈、舊runtime版號零殘留、29圖hash／尺寸／alpha與14張商店原尺寸讀回，秘密掃描3464檔零命中。沒有讀秘密目錄。
- 初次驗證抓到320寬確認鈕進捲動區、既有橫式故事關閉後透明浮層攔點，均修正並保留失敗紀錄。首輪CI的iPad舊送法測試仍重按卡片，已改按獨立確認鈕，原扣款／持久化斷言全部保留；首輪失敗及完整綠燈重跑並列保存。
- 歷史測試覆寫的證據另存本輪regression，再逐bytes還原起點，包括使用者原有R68修改；既有未追蹤檔未刪。歸檔文字副本僅統一LF換行，原始輸出與歸檔SHA皆保留，還原的使用者檔案仍逐bytes相同。舊商店命名只在證明已追蹤且原檔備份hash相等後退役，原圖留before/store。所有瀏覽器／server逐支finally關閉。

## 未完成與風險

**Apple4.3風險：中。** 陽光光池／冷葉影、紅格藤簍、紙冊、三椅敘事與連續故事圖形成專屬畫面；沒有做同帳號全部遊戲的獨立對照，不承諾Apple審核結果。

**BLOCKED／未驗證**：Muse獨立8分複評、真人限時辨識、原生iOS／Android／Safari實機。原因是本輪限定本機無頭、禁止外部服務派工，且沒有原生裝置測試證據；不拿自審當成這些驗收。後期男性與斧頭／建造／釣魚仍沿用受管舊幀，沒有擴張新系統補數量。無戰鬥，攻擊／受擊／死亡不適用。

繁中文案mode2紀錄：「再按一次，交付小麥×2」→選卡後固定「交付小麥 ×2 給葛瑞」，原因是狀態與扣款時機不清；第三任務「種子袋裡可以選種」刪除，原因是與交付無關；完成後0/9主線立即取代→先顯示餐籃3/3並提供「繼續農場故事」，原因是商店故事看起來歸零。敘事與獎勵沒有改寫。

只做本機繁中commit，無push、部署、商店後台操作、對外訊息、外部派工或可見視窗。
