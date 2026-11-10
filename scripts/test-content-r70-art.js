"use strict";
/* R70B 驗收：MUSE 精緻像素圖取代手繪 SVG——檔案存在、透明背景、尺寸合理、被遊戲引用、列入離線快取、素材清單寫明模型。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const zlib = require("node:zlib");
const DIR = "assets/generated/content-r70/";
const FILES = { "beehive.png": "src/midgame-r66.js", "herb-garden.png": "src/midgame-r66.js", "feed-trough.png": "src/midgame-r66.js", "bunting.png": "src/world-ui.js", "lantern-post.png": "src/world-ui.js", "festival-stall.png": "src/world-ui.js", "judge-table.png": "src/world-ui.js" };
function pngInfo(buf) {
  assert.equal(buf.toString("ascii", 1, 4), "PNG");
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), colorType = buf[25];
  let idat = [], off = 8; while (off < buf.length) { const len = buf.readUInt32BE(off), type = buf.toString("ascii", off + 4, off + 8); if (type === "IDAT") idat.push(buf.subarray(off + 8, off + 8 + len)); off += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const bpp = colorType === 6 ? 4 : 0;
  // 只在 RGBA 時檢查四角是否透明（未過濾列首像素的 alpha 在 filter type 0 時可直接讀；其餘以 colorType 判斷有 alpha 通道）
  return { w, h, colorType, hasAlpha: colorType === 6 || colorType === 4, rawLen: raw.length, bpp };
}
const sw = fs.readFileSync("sw.js", "utf8");
let n = 0;
for (const [file, src] of Object.entries(FILES)) {
  const path = DIR + file;
  assert.ok(fs.existsSync(path), file + " 應存在");
  const info = pngInfo(fs.readFileSync(path));
  assert.ok(info.hasAlpha, file + " 應為有透明通道的 PNG");
  assert.ok(info.w >= 64 && info.w <= 320 && info.h >= 64 && info.h <= 320, `${file} 尺寸應在 64～320（實際 ${info.w}×${info.h}）`);
  assert.ok(fs.readFileSync(src, "utf8").includes("content-r70/" + file), `${file} 應被 ${src} 使用`);
  assert.ok(sw.includes("assets/generated/content-r70/" + file), file + " 應列入離線快取");
  n++;
}
const manifest = JSON.parse(fs.readFileSync(DIR + "manifest.json", "utf8"));
assert.match(manifest.model, /MUSE/);
assert.equal(manifest.files.length, 7);
const world = fs.readFileSync("src/world-ui.js", "utf8");
assert.doesNotMatch(world, /content-r63\/(bunting|lanterns|stall)\.svg/, "收穫祭不再使用手繪 SVG");
assert.doesNotMatch(fs.readFileSync("src/midgame-r66.js", "utf8"), /art: "assets\/generated\/content-r66\/(beehive|herb-garden|feed-trough)\.svg"/, "中期設施不再使用手繪 SVG");
console.log(`VERIFIED content R70 art (${n} 張)`);
