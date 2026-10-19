"""Build the closeout only from verified local receipts."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1];E=R/'docs/evidence/r87-art'
def read(p):return json.loads((R/p).read_text(encoding='utf8'))
def main():
 v=read('docs/evidence/r87-art/verification.json');a=read('docs/evidence/r87-art/art-validation.json');p=read('docs/evidence/r87-art/package-size.json');perf=read('docs/evidence/r87-art/performance.json');journey=read('docs/evidence/r87-art/store-journey.json');checks=read('docs/evidence/r87-art/final-checks.json');archive=read('docs/evidence/r87-art/regression-index.json');m=read('assets/generated/r87/manifest.json')
 assert all(d['status']=='VERIFIED' for d in [v,a,p,perf,journey,checks,archive])
 dm=perf['measurements']['desktop'];mm=perf['measurements']['mobile'];times='、'.join(j['platform']+' '+str(round(j['elapsedMs']/1000,3))+'秒' for j in journey['journeys'])
 text=f'''# 陽光農場 R87｜美術第六輪

2026-10-18，main，起點565bb46。版本 **0.1.21／r87-20261018-1**。本機素材、接入、截圖與現行CI狀態：**VERIFIED**。獨立8分複評、真人限時辨識與原生實機：**BLOCKED／尚未驗證**；沒有用自評冒稱已達8分。

本輪只依 ART_RESCORE5_MUSE 第四節五項收尾，對照R4仍未解的同齡苗、藤簍、腳影、故事空白與選擇後果。沒有新增系統、地圖、故事頁或數值規則。

## 唯一五項驗收及改後原尺寸圖

| 項目 | 完成與驗證界線 | 原尺寸截圖 |
|---|---|---|
| 1 圖3安全區 | 開冊完整隱藏背景資源列，關冊完整露出；生成紅格裝訂內收3px，沒有半截資源圖示。單一三頁導覽與返回／說明分列，44px命中保留。每張真實流程圖讀回資源列全顯／全隱；fixture主畫面資源列完整。 | docs/store/screenshots/iphone-03-basket.png；docs/store/screenshots/ipad-03-basket.png。圖01～06全組同在該資料夾。 |
| 2 有方向的葉隙光 | 右上暖光，蘋果樹根向左下投影。相同生成明暗母圖拆出枝葉影、大小不一的透光與半影；任務土壟、草地、帽肩同向受光。額外核對最近樹的投影確實與兩株任務苗相交。移除白點與光柱。三秒辨識僅本機自審，未冒稱真人盲測通過。 | docs/store/screenshots/iphone-02-sunlight.png；docs/store/screenshots/ipad-02-sunlight.png。無文字原圖：docs/evidence/r87-art/430x932-no-text.png；1032x1376-no-text.png。 |
| 3 同種同齡對照 | 圖2本身同排兩株小麥，同plantedAt、同階段、同atlas frame；光內葉片大18%、略亮且淡金邊，光外原色。這是明示的視覺fixture，不冒稱真實賺得進度；原有日光加速與加收仍由R79真實操作驗證。 | docs/store/screenshots/iphone-02-sunlight.png；docs/store/screenshots/ipad-02-sunlight.png；圖06同一對照。時間、階段、渲染frame及圖源在 docs/evidence/r87-art/art-validation.json。 |
| 4 尺度／藤簍／接觸影 | 先畫三視圖，再接真幀。外張簍口、橫編紋與紅格布代替硬背包；帽肩右上暖光。行走48×64與農務72×64畫布共用身高；圖2與圖6同裝置root高度相等，田間visual讓開苗株，physics tile與430ms作用保留。靴底與樹根有柔橢圓落影。 | docs/store/screenshots/iphone-02-sunlight.png、iphone-06-same-age.png；ipad-02-sunlight.png、ipad-06-same-age.png。設定表：docs/art/character-sheets/miri-r87.png；原生64px：docs/evidence/r87-art/character-three-views-64.png。 |
| 5 導覽／符號／故事留白 | 移除圖3右上重複入口，三頁入口統一同一列。麥穗章只留在已完成農務；故事台詞旁完全無章。故事頁頂端對齊，頂部空白低於1/8；直式放大插圖且保留兩張臉，iPad正文22px，內容至少使用70%畫高。橫式插圖限30dvh，正文及台詞完整可見。兩種送法補後果提示；保留今日3/3與三種不同章。 | docs/store/screenshots/iphone-03-basket.png、iphone-04-note.png、iphone-05-daily.png；ipad-03-basket.png、ipad-04-note.png、ipad-05-daily.png。 |

以上iPhone均1290×2796、iPad均2064×2752。原尺寸沒有宣傳合成。01／03／04／05共8張從真實播種、澆水、收成、送籃、領獎取得，流程{times}，皆在前三分鐘。額外真實圖02留在 docs/evidence/r87-art/store-real/，沒有拿不同齡的圖替代同齡驗收。

商店02／06共4張明示為精確同齡fixture。02停在原動畫第4張姿勢，等待正常650ms目標光圈消失再拍，沒有遮住光外苗；不結算fixture獎勵。06用真實方向輸入與900ms慢步長擷取換腿，兩張只固定鏡頭，不改角色顯示尺寸。這些不冒稱自然遊玩、原生裝置或玩家研究。

## 新美術與來源

**{len(m['masters'])}張生成母圖、{len(m['records'])}張runtime輸出；實際工具image_gen.imagegen，精確模型slug未揭露，manifest為null。** 新圖包括三視圖／表情、四向行走、澆水／農務、葉影／透光、主地面材質、蘋果樹、紙面／格布、六圖示、繁中Logo與App圖示。統一右上光、深茶輪廓與74色；native像素處理、去背、尺寸、來源及輸出hash在 assets/generated/r87/manifest.json。提示詞完整登錄 docs/art/PROMPTS_R87.json，PROMPTS.json同步。

行走左右列依實際朝向重排；農務生成少一列，缺右向由六張不同左向姿勢逐張鏡像補齊。不是整張晃動／位移補幀。切圖修正真實溝槽與孤立碎片，48×64行走與72×64農務避免為了水壺壓縮整個人。12組動畫列逐幀hash不重複、下半身差與alpha差通過，六人物輸出亮度／飽和度雙閘門通過。材質／光影不假充人物雙閘門。

母圖在 docs/art/masters/r87/ 及 character-sheets/；依VISUAL_REFRESH_PLAN保留真alpha、清零透明RGB、共同色盤與最近鄰輸出。圖示與角色RGBA PNG，背景保留合適native尺寸；像素檔無損壓縮，沿用敘事WebP。CREDITS.md追加，既有素材與授權未刪除。新增圖片 {m['runtimeBytes']:,} bytes；Web runtime由 {p['beforeBytes']:,} 增為 {p['afterBytes']:,} bytes，增加 **{p['deltaBytes']:,} bytes（{p['deltaBytes']/1048576:.2f} MiB）**。母圖／證據不進既有網站發布allowlist；未建IPA／AAB，不把Web差額稱為原生包體。

## 前後對照與測試

先審：docs/art/ART_REVIEW_R87.md；計畫：docs/OPTIM_PLAN_R87.md；方向：docs/art/ART_DIRECTION.md。同場景四視口前後各16張在 docs/art/compare/r87/before/、after/；起始商店原圖在 before/store/；overview.webp為縮圖索引，原PNG不變。

| 驗證 | VERIFIED結果 |
|---|---|
| 核心／實際CI | npm test、npm run test:e2e全部exit0。指定R79真實玩法44項；R75第一章、R80每日、R81送法／離線／旋轉、RWD、控制可達性與R82～R87美術守門均綠。 |
| 本輪五項 | {a['checks']}項通過，320×568、390×844、844×390、1366×600、430×932、1032×1376；含相同root高度、同排同齡同frame、最近樹投影實交兩苗、純台詞、頂部留白與44px命中。 |
| 原有補充檢查 | 夜間四季／天氣及澆水引導exit0，原有斷言不放寬。首輪CI抓到1024×768故事台詞出界，已限制橫式插圖高度；原R84先重跑166項全綠，直式留白另由原R84及本輪守門驗證，再完整重跑CI。首敗保留logs/e2e-first.txt。 |
| 效能 | 桌機p95三跑 {dm['runsP95Ms']} ms、中位{dm['medianP95Ms']}ms；手機 {mm['runsP95Ms']} ms、中位{mm['medianP95Ms']}ms，均≤18ms。共用機並發數據僅供參考，未取代原生出貨測試。 |
| 素材／版本／秘密 | 10母圖與23輸出hash／尺寸／alpha讀回，12張商店原尺寸hash，runtime與scripts全部JS語法通過；版本鏈一致、舊runtime版本0、指定秘密模式0命中；未讀.secrets。 |
| 歷史證據 | {len(archive['records'])}份被本輪測試覆寫的歷史證據封存到本輪regression，再逐bytes還原起始內容，包含使用者原先R68修改；既有未追蹤檔未刪除。 |

證據：docs/evidence/r87-art/final-checks.json、verification.json、art-validation.json、performance.json、package-size.json、regression-index.json、logs/。舊美術測試只將精確圖源更新為當前素材，並依本次明確新契約把故事有章改成無章、兩處導覽改成單一三頁導覽；原來抓出台詞出界的斷言原封保留，沒有刪測試或降低命中／版面門檻。

## 未完成與風險

**Apple 4.3風險：中。** 葉影、同齡光照對比、紅格藤簍及三頁紙冊已進商店原圖；帳號級差異與是否跨過8分仍需獨立複評，不能以本機完成降低成低風險。

BLOCKED：新Muse獨立8分複評、真人三秒光向／64px身份／五秒導覽辨識、原生iOS／Android／Safari／iPad實機。未取得的分數不寫成通過。後期男性、斧頭／建造／釣魚與部分季節物件仍沿用原資產，保留替換管線及授權；沒有以擴張新內容充數。無戰鬥，攻擊／受擊／死亡不適用。

繁中文案mode2直接套用：原日期式今日入口／右上今日印章冊改同列「今日農務」，原因是與祖母手記、陽光餐籃形成唯一導覽；兩送法原本只有標題，補「留下餐籃，收到門邊的謝意／坐下喝茶，留下一張空椅子」，說清原有故事後果，沒有新增獎勵或改故事。

只做繁中本機commit；無push、部署、商店後台操作、外部派工、傳訊或讀取秘密目錄。所有瀏覽器及暫時伺服器逐支finally關閉。
'''
 (R/'docs/CODEX_RESPONSE_R87_ART.md').write_text(text,encoding='utf8',newline='\n')
 plan=R/'docs/OPTIM_PLAN_R87.md';s=plan.read_text(encoding='utf8').replace('PREPARED。repo main','VERIFIED（本機範圍；獨立複評／真人／原生實機仍BLOCKED）。repo main');plan.write_text(s,encoding='utf8',newline='\n')
 print('VERIFIED report written from receipts')
if __name__=='__main__':main()
