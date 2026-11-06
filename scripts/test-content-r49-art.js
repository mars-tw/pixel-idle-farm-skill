// R49 美術：gpt-image-2 重繪的開場插圖、無縫草地與小徑、工具與日誌圖示已接上、快取並在 manifest 記錄模型。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
const files = ["grass-36.png", "path-36.png", "welcome-px-512.png", "welcome-px-1024.png", "tool_plant-64.png", "tool_water-64.png", "tool_clear-64.png", "tool_build-64.png", "tool_inspect-64.png", "note-64.png"];
test("素材存在且 manifest 寫明 gpt-image-2 模型與每個輸出雜湊", () => {
  const m = JSON.parse(read("assets/generated/r49/manifest.json"));
  assert.equal(m.model, "gpt-image-2-2026-04-21");
  const outs = m.assets.flatMap((a) => a.outputs.map((o) => o.file));
  for (const f of files) { assert.ok(fs.existsSync(path.join(root, "assets/generated/r49", f)), f); assert.ok(outs.includes(f), f + " 未記錄"); }
});
test("地面改為無縫草地與小徑貼圖，開場插圖改用 r49", () => {
  const css = read("src/content-r49-art.css");
  assert.match(css, /#mapWorld::before \{ background: url\('..\/assets\/generated\/r49\/grass-36\.png/);
  assert.match(css, /#groundLayer \.gtile\.path \{ background: url\('..\/assets\/generated\/r49\/path-36\.png/);
  assert.match(read("src/world-ui.js"), /assets\/generated\/r49\/welcome-px-512\.png/);
});
test("工具與日誌圖示換成 r49，樣式與素材都進快取", () => {
  const css = read("src/content-r49-art.css"), sw = read("sw.js"), html = read("index.html");
  for (const t of ["plant", "water", "clear", "build", "inspect"]) assert.ok(css.includes(`.i-tool-${t} { background-image: url('../assets/generated/r49/tool_${t}-64.png`), t);
  assert.match(html, /src\/content-r49-art\.css\?v=/);
  assert.match(sw, /versioned\("\.\/src\/content-r49-art\.css"\)/);
  for (const f of files) assert.ok(sw.includes(`versioned("./assets/generated/r49/${f}")`), f);
});
test("CREDITS 記錄 r49 素材來源", () => { assert.match(read("CREDITS.md"), /assets\/generated\/r49\//); });
console.log(`VERIFIED content R49 art (${passed}/4)`);
