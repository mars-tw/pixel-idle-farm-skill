"use strict";
/* R74A：照顧方式觸發、田邊狀態與雜項文字規則。 */
const assert=require("node:assert/strict"),fs=require("node:fs");
const ui=fs.readFileSync("src/ui.js","utf8"),config=fs.readFileSync("src/config.js","utf8"),adventure=fs.readFileSync("src/adventure.js","utf8"),midgame=fs.readFileSync("src/midgame-r66.js","utf8"),css=fs.readFileSync("src/content-r58b.css","utf8");

assert.match(ui,/r74a-care-popover/,"照顧方式須改為田旁彈出層");
assert.match(ui,/空田維持一鍵播種/,"點空田須直接播種");
assert.match(ui,/showCarePopover\(tileId, tile\.plotIndex\)/,"播種後須在田旁顯示照顧方式");
/* R76A：需要等光的成熟格顯示先別收，其他成熟格仍顯示可收成。 */
assert.match(ui,/heldForLight \? `\$\{name\}・留著等光` : `\$\{name\}・可收成`/,"成熟田格依 nextFarmStep 顯示等光再收或可收成"); /* R84C 同步：田上改寫狀態「留著等光」，「等光再收」只留在田邊動作列 */
assert.match(ui,/state\.map\.tiles\.filter\(\(row\) => row\.plotIndex != null && row\.plotIndex < active/,"已種格數須以畫面上的有效田格計算");
assert.doesNotMatch([config,adventure,ui].join("\n"),/["'`][^"'`\n]*木材/,"玩家文字須統一使用木料");
assert.match(adventure,/earned: `農場等級提升到 \$\{data\.level\} 級`, unlocked: "新的作物與農場能力"/,"升級提示的獲得與新解鎖不得重複");
assert.match(adventure,/return ok\(`\$\{stars\} 顆星！\$\{mayorLine\}`, copy\(f\.judging\)\);/,"評比訊息不得重複寫獎勵");
assert.match(midgame,/r74a-facility-name/,"三座中期設施須共用名牌");
assert.match(css,/R74A：照顧方式只在剛種下的田旁出現/);

let depth=0;
for(const ch of css.replace(/\/\*[\s\S]*?\*\//g,"")){if(ch==="{")depth++;else if(ch==="}")depth--;assert.ok(depth>=0,"CSS 多了右大括號");}
assert.equal(depth,0,"CSS 大括號未平衡");
console.log("VERIFIED content R74A systems");
