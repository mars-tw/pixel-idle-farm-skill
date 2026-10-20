# Credits

本文件盤點《陽光農場：籃底的手記》的素材、字型、圖示與第三方開發工具。最後更新日期：2026-10-18（R88，美術第七輪）。

## 視覺素材與 AI 揭露

- R82（2026-10-16）新增 8 張 OpenAI 內建 `image_gen.imagegen` 來源圖：餐籃主背景、農夫肖像、門邊餐籃、雙椅茶桌、紙面材質、8 格圖示組、繁中 Logo、App 圖示提案。工具沒有提供精確模型 slug，記錄為 null，不把它假定為特定 gpt-image 版本。完整實際提示詞與一致前綴在 `docs/art/PROMPTS.json`，原始 PNG 保存在 `docs/art/masters/`。
- `tools/process-r82-art.py` 將來源縮成原生像素尺寸並套用既有共用 66 色盤；背景為無損 WebP，肖像／Logo／圖示為真正 RGBA PNG，保留模型提供的 alpha，產生二值像素 mask、來源與 runtime SHA-256。資產與亮度／飽和度數據見 `assets/generated/r82/manifest.json`；農夫 64px 預覽與透明遮罩在 `docs/evidence/r82-art/`。來源不是第三方素材包，沒有額外圖庫授權或外部字型。
- 兩張送達故事圖已接 `assets/heirloom/` 與真實餐籃選擇；農夫近景屬靜態敘事肖像，不是新走路／遞籃動畫。保留原有全部角色、作物階段、建物與四季圖集和其授權。手記標題使用作業系統 KaiTi／DFKai-SB 備援，字型檔不隨 repo 散布。

- R76 專用釣台與野餐桌共四張損壞／修復來源圖，由 Codex 內建 `image_gen` 製作，保留原始透明 PNG 與完整提示詞。來源 metadata 揭露 `ChatGPT / gpt-image`，精確版本未揭露，不把本輪標成 `gpt-image-2` API 生成。runtime 經 `scripts/process-world-project-art.js` 對齊共同 bbox、96px frame、腳底錨點與既有 66 色盤；來源、處理契約和 SHA-256 見 `assets/generated/r76/manifest.json`。

- `assets/generated/` 下的角色、作物、動物、建築、場景物件與 VFX，主要由 OpenAI 圖像生成工具協助製作。repo 內的 `art-config*.json`、素材 manifest 與生成腳本將主要模型記為 `gpt-image-2`；R59 的 Miri／Kai 動作圖集與 `crops2` 作物圖集，以及 R60 的鴨子、鴨蛋品質與 `crops3`／`crops4` 作物圖集，均由內建 `imagegen` 工作流程重繪。
- R66 正式 UI 使用 `gpt-image-2` 經 Codex 內建 `image_gen` 製作 512px 概念母版：15 個作物、6 個工具、5 個分頁、6 個系統圖示，以及 3 張智慧農務助手狀態皮膚。金色南瓜沿用已通過 Wave 0 校準的同模型母版；其餘 34 張為 R66 生成。完整 prompt、來源／中間層／runtime SHA-256、模型與 C2PA 偵測結果記於 `assets/generated/r66/manifest.json`。
- R66 產出 `assets/generated/r66/ui-icons-32.png`（8×4 圖集）、32 張單獨的透明圖示與三張 `assistant_*-64.png`。R77 按鈕改載入 `native/*-32.png` 的完整圖像，保留透明 alpha，避免 20–28px 顯示框用 32px 圖集座標裁切而破圖。生成母版的 matte 去背、限定 palette 與原生像素清稿紀錄保留；本輪沒有重生或覆寫美術。
- R68 四季 loading 與既有活動面板底圖由 Codex 內建 `imagegen`（`gpt-image-2`）生成；五張含 C2PA 的原始母版保存在 `docs/evidence/R68/masters/`，runtime 與母版分軌，不互相覆寫。
- R68 runtime 經 `tools/process-r68-visuals.py` 確定性後製：固定 BOX 像素網格、每季 hue-shift 陰影、R62 統一 66 色盤、僅天空／遠景或面板外框套用選擇性 dithering，並保留深色 1px 原生像素輪廓。完整 prompt、reference hash、C2PA 摘要與 master/runtime SHA-256 見 `docs/evidence/R68/source-manifest.json` 與 `assets/generated/r68/manifest.json`。
- 生成後的來源圖會經專案內腳本去背、裁切、縮放、像素修整、anchor 設定與 JSON frame map 產生；部分地形、季相與補充圖集由 JavaScript／Python 程序化產生或修整。因此執行時 atlas 並非未處理的模型輸出。
- `assets/cover.png` 為專案的 AI 輔助像素風封面。`references/visual-targets/` 內圖片是製作參考，不是直接載入遊戲的 runtime atlas。
- `references/promo/` 與 `artifacts/` 內圖片為本遊戲畫面截圖；README 使用其中的春、夏、冬季宣傳截圖。
- 圖像提示詞、模型設定與可重製流程可參考 `art-config-rpg-v4.json`、`assets/manifest.json`、`assets/generated/v4/manifest.json` 與 `references/art-pipeline-v4.md`。

## R83 陽光農場第二輪美術（2026-10-16）

- 新增 18 張生成母圖，實際工具 `image_gen.imagegen`；工具未揭露精確模型 slug，記為 `null`，不推定某一 GPT Image 版本。提示詞與共用風格前綴：[PROMPTS_R83.json](docs/art/PROMPTS_R83.json)。
- 原圖：[docs/art/masters/r83](docs/art/masters/r83)；來源／輸出 SHA-256、尺寸、色盤、真透明、包體與動作差異：[manifest](assets/generated/r83/manifest.json)。後製只做 magenta 去背、清除透明 RGB、穩定縮放與腳底對齊、受控定色盤、PNG／無損 WebP，沒有程序圖形冒充新美術。
- 新主角四方向行走、澆水／播種／收成真幀；十五種作物各五階段；農舍、畜舍、雞舍、樹與站點；葛瑞／祖母六表情；四張獨立故事圖、UI 材質、八圖示、繁中 Logo 與 App 圖示提案，皆為本專案生成。後期作物母圖另含四個未採用提案，沒有加入玩法。
- 男主角、斧頭／建造等未重繪動作、冬季樹與其餘後期物件仍使用既有專案素材，原授權保留。專用持籃／遞籃／持竿姿勢未完成，沒有用單圖位移替代動畫。
- 不含第三方商標或圖示套件；沿用素材與下方原授權紀錄均保留。App 圖示只接本機 PWA 提案，未操作商店或提交原生圖示。

## 音樂與音效

- R79 背景音樂 `assets/audio/r79-sunny-farm-loop.ogg`／`.m4a`：本機 AI 派工器 `music` 能力（worker `ace_step_turbo`，ComfyUI 上的 ACE-Step turbo 工作流，本機推論，未使用雲端服務；精確模型版本未由派工器回報）生成，task `c960fc91-f966-48c1-aba4-c1b153f40d75`。提示詞：`cozy pastoral farming game background music, warm sunny spring morning, acoustic guitar and soft flute melody, light hand percussion, gentle marimba, relaxed 92 bpm, major key, instrumental, seamless loop, no vocals`，長度 30 秒。原始 FLAC SHA-256 `7192f0378b028a3b6086597e0749d0185fba0e680be9580650699c2234df2278`。
- 後製（ffmpeg）：原檔 27.45 秒後為靜音，先截到 27.2 秒；再把結尾 2 秒與開頭 2 秒交叉淡化，接在中段之後，做成 25.2 秒無縫循環，音量 −2 dB。輸出 OGG Vorbis（q3，SHA-256 `d62766713e76c625dbf3377b3263696b0c9e468aa2d94757d06224411293c531`）與 AAC 96 kbps M4A（SHA-256 `8d092f3fd72257b93ccedd16fb83735931d3f353a8c7fdfddd1061b2b0f654a6`）。
- 操作音效（種植、收成、澆水、陽光光斑等）全部由 WebAudio oscillator 即時合成，沒有音效檔。

## 字型與圖示

- 專案沒有綁入或從 CDN 載入第三方 Web Font。介面使用作業系統字型堆疊：`Segoe UI`、`PingFang TC`、`Microsoft JhengHei` 與 `system-ui`；這些字型檔不隨 repo 散布。
- 專案沒有使用 Font Awesome、Material Icons、Lucide 等第三方圖示套件。R66 的主要 UI chrome 已改用專案自有像素 atlas；天氣、季節、物品後備與敘事內容仍可能使用 Unicode emoji，因此這些非正式 chrome 的符號在不同平台外觀可能略有差異。
- `assets/icons/icon-192.png` 與 `assets/icons/icon-512.png` 是本專案的 PWA 圖示，不含第三方商標或外部 icon pack。

## 第三方開發工具

- [Playwright](https://playwright.dev/) `1.61.1`：僅作為開發依賴，用於 E2E、RWD 與素材驗證；Playwright 採 Apache License 2.0。遊戲執行時不會載入 Playwright。

除上述 Playwright 外，本次盤點未發現隨遊戲載入的第三方 JavaScript 套件、遠端字型或圖示庫。未來若加入第三方素材或套件，請在合併時同步更新本文件及對應授權條款。

## 專案授權

專案程式、文件與 repo 內一併散布的專案素材依根目錄 [MIT License](LICENSE) 提供，Copyright © 2026 mars-tw。AI 生成內容的使用仍應遵守適用的生成服務條款與所在地法規。

## R86 美術第五輪（2026-10-18）

- 8張母圖使用本會話內建 `image_gen.imagegen`；工具沒有揭露模型slug，沒有推定特定GPT Image API型號。原圖在 `docs/art/masters/r86/` 與 `docs/art/character-sheets/miri-r86.png`；完整提示詞和引用角色表在 `docs/art/PROMPTS_R86.json`。
- 19張runtime圖片：四向行走、四向澆水／農務、相容農務圖集、三表情、三種紅泥印章、紙面、裝訂、葉隙光／樹影／合成光影、水滴、Logo與三尺寸App圖示。來源與輸出hash、尺寸、色盤、alpha、逐幀差與人物雙閘門在 `assets/generated/r86/manifest.json`。
- 行走側向列重排、農務左向列逐姿勢鏡像；所有幀均取自真實生成姿勢，未用單張晃動補幀。水滴取自生成澆水作用幀；光與影由生成葉影圖亮度遮罩取得。工具真alpha保留，角色／圖示透明RGB清空，共用68色盤、native縮圖與最近鄰輸出。
- 裝訂沿用R85生成紙冊邊，農務圖集保留舊斧頭／建造姿勢；敘事、世界作物、建築與葛瑞／祖母沿用既有來源。所有舊授權與署名保留，沒有新增第三方素材。未更新的男角色與後期動作仍是明列缺件。
# R84 美術第三輪（2026-10-16）

- 九張新母圖由 OpenAI 內建 `image_gen.imagegen` 產生。介面未揭露模型 slug，因此未推定特定 GPT Image 型號；沒有使用外部派工或第三方素材。
- 29 張 runtime 圖：餐籃／門廊／樹影圖集、Miri／葛瑞／祖母九表情、兩種送達後插圖及相容路徑、紙面／外框、八圖示、繁中 Logo、三尺寸 App 圖示提案、地面圖集。原圖在 `docs/art/masters/r84/`，提示詞在 `docs/art/PROMPTS_R84.json`；來源與輸出尺寸／SHA-256／色盤／alpha／雙閘門在 `assets/generated/r84/manifest.json`。
- 後製保留工具真 alpha，native 縮圖、固定 68 色盤（保留既有 66 色，新增兩個草地中間色）、透明 RGB 清空、PNG／無損 WebP；草地以兩個受控中間綠色消除定色盤造成的高頻顆粒。角色四向與農務真幀沿用 R83；其來源及所有既有素材授權保留於下文。
# R85 美術第四輪（工作單2026-10-17，執行2026-10-18）

9張新生成母圖、26張runtime圖片：Miri正側背與表情設定、四向行走與澆水／農務真幀、四幅低密度餐籃敘事圖、六地面材質、印章冊紙面、八圖示、繁中標題Logo、App圖示提案。生成工具為 **image_gen.imagegen**；工具未揭露精確模型slug，因此 manifest 的 actualModelSlug 為 null，不冒稱特定GPT Image API型號。

來源與提示詞：`docs/art/PROMPTS_R85.json`、`docs/art/character-sheets/miri-r85.png`、`docs/art/masters/r85/`。生成來源及輸出SHA-256、共用68色盤、真alpha、原始品質數值與逐幀差異收據：`assets/generated/r85/manifest.json`。右向澆水由同套左向六姿勢鏡像，無單張晃動偽動畫。來源圖與後製均為本專案此次授權生成資產；不宣稱排他著作權或未查核的第三方授權。

作物五階段、配角表情、建物、門廊、部分道具與非前3分鐘斧頭／建造等動作沿用既有素材及以下原授權。餐籃world圖集含新籃圖與沿用R84門廊／樹影，逐來源列於manifest。本項只追加來源，既有Kenney／OpenGameArt／音樂等授權條目全部保留。

## R87 美術第六輪（2026-10-18）

- 10張新生成母圖：Miri三視圖與表情、四向行走、澆水／農務、葉影／透光投影、草地背景材質、蘋果樹、紙面格布、六圖示、繁中Logo、App圖示提案。
- 實際工具：`image_gen.imagegen`。工具未揭露精確模型slug，manifest記為null，不推論API模型名稱。提示詞：`docs/art/PROMPTS_R87.json`；來源及輸出SHA-256：`assets/generated/r87/manifest.json`。
- 生成後依使用者授權進行native像素縮圖、共同色盤、透明清邊、姿勢列重排／逐姿勢鏡像、明度遮罩拆光影、無損PNG／WebP。沒有使用他人未授權素材；既有R66～R86素材及其原授權全數保留。
- Runtime新圖接入既有遊戲；後期斧頭／建造等保留R86／v4圖幀與來源。沒有新增系統、地圖、故事頁或付費發行。

## R88 美術第七輪（2026-10-18）

- 8張保留的新生成母圖：庭院主背景、暖黃葉隙光、Miri三視圖／表情、土床／水桶／籬笆／花草、紙框、六圖示、四字Logo、App圖示提案。9次image_gen.imagegen呼叫，Logo錯誤副標初稿已棄用，未接入遊戲。
- 實際工具為 `image_gen.imagegen`，精確模型slug未揭露，manifest為null。完整實際提示詞與Logo修訂在 `docs/art/PROMPTS_R88.json`，來源／尺寸／hash／alpha／角色雙閘門在 `assets/generated/r88/manifest.json`。
- 依使用者要求後製原生像素尺寸、受管色盤、真正alpha清邊、無損WebP／PNG。R87真姿勢與alpha保持不變，藤簍局部取新設定表的編紋與格布像素；R85敘事圖從原生成母圖重取較細像素，R83送法插圖用於iPad座位／門邊特寫，R87葉影改為冷色寬葉叢。來源與舊授權均保留。
- 沒有刪除既有Kenney、OpenGameArt、字型、音樂或其他授權。本輪僅本機製作與驗證，沒有發布或商店操作。

## R89 ??????2026-10-18?

- 9????????????Miri????????????????????????????????????????Logo?App????????? `image_gen.imagegen`?????slug?????null???????
- 30??????????`docs/art/PROMPTS_R89.json` ????????????????`assets/generated/r89/manifest.json` ???????hash?alpha?native???????????
- ??????????Pillow??RGBA?????RGB????????native???nearest-neighbor???WebP?PNG?????R88??????72?????alpha???????????????????????????R84???????????????R88???????
- ??????Kenney?OpenGameArt?????????????????????????commit?????????????

## 新內容第二輪（2026-10-19）

六張新生成插圖：蘿拉、班伯、圖圖的餐籃短篇，以及河鯉、銀鯽、溪鱸的河畔筆記。實際生成工具為 `image_gen.imagegen`；精確模型slug未揭露，manifest記為null。三張居民圖以本專案既有R1圖作身份參考；原始參考與授權保留。

原稿與完整提示詞：`docs/art/masters/content-r2/`、`docs/art/PROMPTS_CONTENT_R2.json`。生成原稿、參考與六張runtime圖片的尺寸、SHA-256及第八輪共用色盤：`assets/generated/content-r2/manifest.json`。Pillow只做群組像素採樣、nearest-neighbor放大、受管色盤與無損WebP輸出，未以程序圖形代替生成美術。

既有角色真姿勢、無縫地面、光影、UI圖示、R1浮標／河水、音樂與第三方素材授權全部保留；不宣稱排他著作權或未查核的第三方授權。

## 新內容第四輪（2026-10-19）

新增裝籃近景與圖圖配對場景共兩張，實際工具 `image_gen.imagegen`，模型slug未揭露。以既有第三輪圖圖場景作風格與場景參考；配對版修改空椅上的壓花與桌上紅格書籤。完整提示詞及原稿：`docs/art/PROMPTS_CONTENT_R4.json`、`docs/art/masters/content-r4/`；來源與輸出SHA-256、原生256×128採樣、共用R89色盤與512×256無損輸出記於 `assets/generated/content-r4/manifest.json`。

河水與浮標沿用既有生成素材，原生像素水紋是由實際拋竿階段驅動的程式效果，不計入生成圖片數。三位居民原始短篇場景仍沿用第三輪受管圖片，來源見 `assets/generated/content-r3/manifest.json`。既有真角色姿勢、所有歷史來源與第三方授權完整保留；不宣稱排他著作權。

## 新內容第五輪（2026-10-19）

新增蘿拉與班伯的配對再訪插圖兩張，實際工具 `image_gen.imagegen`，模型 slug 未揭露。各自以第三輪同居民場景作參考，沿用 R89 完整風格前綴、共用色盤、右上暖光、256×128 原生像素採樣與 512×256 無損 WebP。原稿、提示詞、來源及輸出 SHA-256 分別在 `docs/art/masters/content-r5/`、`docs/art/PROMPTS_CONTENT_R5.json`、`assets/generated/content-r5/manifest.json`。既有角色真逐幀、所有歷史來源與授權保留；水紋屬狀態驅動的程式效果，不計入生成美術。

## 新內容第七輪（2026-10-19）

三居民坐姿、吃餅及伸手姿勢和無預畫水紋的平靜池面由 `image_gen.imagegen` 實際生成，模型slug未揭露。母圖與提示在 `docs/art/masters/content-r7/`、`docs/art/PROMPTS_CONTENT_R7.json`，9個原生48×64姿勢，另3張站姿直接擷取既有R83角色；壓花細節擷取自R6紀念物，池面原生256×160，共14張執行素材。沿用R89色盤、右上暖光與MIT專案授權；來源及hash在 `assets/generated/content-r7/manifest.json`。聚餐為遊戲內地表、桌、紀念物和獨立角色合成，未使用舊聚餐插畫。
# 新內容第八輪（2026-10-19）

魚影／浮標／水花與捕獲魚圖，以及倒扣茶杯、魚竿雙盤、花與空椅：本輪實際使用 `image_gen.imagegen` 生成2張RGBA母圖，工具未揭露模型slug，沒有猜測版本。完整R89風格前綴、生成提示與母圖路徑見 `docs/art/PROMPTS_CONTENT_R8.json`；原圖保存在 `docs/art/masters/content-r8/`。裁成原生128×112水面／魚圖及64×64物件，共15張輸出；保留alpha，nearest-neighbor縮製，無向量替代圖。

三張上身動作衍生圖沿用第七輪image_gen坐姿及吃點心姿勢，下方22列逐像素保留原坐姿，固定腳底與椅子；沒有新增角色身份或替換行走動畫。`assets/generated/content-r8/manifest.json`逐張列來源SHA-256、取框、尺寸、工具與固定區域。程式與本輪生成／衍生素材沿用本專案MIT授權；舊素材及其原授權不變。

## 新內容第九輪（2026-10-19）

實際工具 `image_gen.imagegen` 生成一張四人姿勢母圖；模型 slug 未揭露，manifest 記 null。身份參考為既有 R7 三居民站姿與 R89 米莉真行走圖，蘿拉固定紅頭巾、綠裙，米莉固定草帽、紅辮與綠吊帶褲。母圖與完整 R89 前綴提示在 `docs/art/masters/content-r9/poses.png`、`docs/art/PROMPTS_CONTENT_R9.json`。

24 張原生 48×64 執行姿勢由 nearest-neighbor 取樣、R89 色盤及透明 alpha 處理而來。每人站姿的頭部 0–27 列與下身 46–63 列固定；坐姿下身 46–63 列固定，手臂、杯與點心換真姿勢像素。行走、碰撞及作用時機保留。來源、取框、尺寸與 SHA-256 在 `assets/generated/content-r9/manifest.json`。新增程式與素材沿用本專案 MIT；既有素材與第三方授權完整保留。
# 新內容第15輪美術

米莉捧籃、伸手、收手三格與河鯉閉合水環，由 `image_gen.imagegen` 生成；工具未揭露模型識別。參考本專案第八輪米莉造型與既有水紋，沒有使用外部角色或第三方素材。原圖、提示詞、原生像素處理及 SHA-256 見 `docs/art/PROMPTS_CONTENT_R15.json` 與 `assets/generated/content-r15/manifest.json`，沿用本專案 MIT 授權。
