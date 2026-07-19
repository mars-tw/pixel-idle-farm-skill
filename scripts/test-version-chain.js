// R70 版本鏈守門：index.html 與 manifest.webmanifest 的所有 ?v= 參數，
// 除 SHA-8 內容定址資產（assets/generated/r68/ 豁免）外，必須等於 sw.js 的 CACHE_VERSION。
// 動機：R69 曾發生 manifest icons 停留舊版的漂移（安裝圖示與 SW 預快取走不同 URL）。
const fs = require("fs");

const sw = fs.readFileSync("sw.js", "utf8");
const m = sw.match(/const CACHE_VERSION = "([^"]+)"/);
if (!m) { console.error("✗ sw.js 找不到 CACHE_VERSION"); process.exit(1); }
const version = m[1];

let bad = [];
for (const file of ["index.html", "manifest.webmanifest"]) {
  const text = fs.readFileSync(file, "utf8");
  const refs = [...text.matchAll(/([\w./-]+)\?v=([\w.-]+)/g)];
  for (const [, path, v] of refs) {
    if (path.includes("assets/generated/r68/")) continue; // SHA-8 內容定址豁免
    if (v !== version) bad.push(`${file}: ${path}?v=${v}（應為 ${version}）`);
  }
}
if (bad.length) {
  console.error(`✗ 版本鏈漂移 ${bad.length} 處：\n  ` + bad.join("\n  "));
  process.exit(1);
}
console.log(`✓ 版本鏈一致（CACHE_VERSION=${version}）`);
