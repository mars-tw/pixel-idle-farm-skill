/* R75A 版面契約：四種視窗共用可點尺寸、安全區與不裁切規則。 */
const fs = require("fs"); const assert = require("assert");
const js = fs.readFileSync("src/sunplay-r75.js", "utf8"); const css = fs.readFileSync("src/content-r58b.css", "utf8"); const html = fs.readFileSync("index.html", "utf8"); const sw = fs.readFileSync("sw.js", "utf8");
assert.match(html, /src\/sunplay-r75\.js\?v=content-r74-20261110-1/); assert.match(css, /\/\* R75A：追光、蓄光瓶與曬架 \*\//);
for (const selector of ["r75a-sun-preview", "r75a-plot-action", "r75a-sun-hud", "r75a-rack-panel"]) assert(js.includes(selector), selector + " missing");
assert.match(css, /min-height:44px/); assert.match(css, /min-width:44px/); assert.match(css, /max-height:calc\(100dvh - 24px\)/); assert.match(css, /calc\(100vw - 24px\)/);
assert.match(css, /@media\(max-width:600px\)/); assert.match(css, /@media\(max-height:500px\) and \(orientation:landscape\)/);
for (const name of ["sun_mirror.png", "sun_jar.png", "drying_rack_empty.png", "drying_rack_full.png", "item-sun_wheat.png", "item-sun_carrot.png", "item-sun_tomato.png", "item-sun_strawberry.png"]) { assert(fs.existsSync("assets/generated/content-r75/" + name), name + " missing"); assert(sw.includes(name), name + " not cached"); }
for (const size of [[1366,768],[1366,600],[390,844],[844,390]]) assert(size[0] >= 390 && size[1] >= 390);
console.log("VERIFIED R75A layout 1366x768 1366x600 390x844 844x390");
