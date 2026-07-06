const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PROBE_MISSING_CACHE = process.argv.includes("--probe-missing-cache");

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.error("  ✗ " + msg); failed++; }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function normalizeAssetPath(raw) {
  if (!raw || typeof raw !== "string") return null;
  let value = raw.trim().replace(/\\/g, "/");
  if (!value || /^(https?:|data:|mailto:|tel:|#)/i.test(value)) return null;
  value = value.split("#")[0].split("?")[0];
  if (!value || value === "./") return ".";
  if (value.startsWith("./")) value = value.slice(2);
  if (value.startsWith("/")) value = value.slice(1);
  return value || null;
}

function localFileExists(rel) {
  const target = rel === "." ? ROOT : path.join(ROOT, rel);
  return fs.existsSync(target);
}

function parseSwCacheEntries(swText) {
  const constants = {};
  for (const m of swText.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*"([^"]+)"/g)) constants[m[1]] = m[2];
  const array = swText.match(/const\s+CORE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  if (!array) return [];
  const entries = [];
  for (const token of array[1].split(",")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const quoted = trimmed.match(/^["']([^"']+)["']$/);
    const value = quoted ? quoted[1] : constants[trimmed];
    const normalized = normalizeAssetPath(value);
    if (normalized) entries.push(normalized);
  }
  if (PROBE_MISSING_CACHE) {
    const idx = entries.indexOf("src/config.js");
    if (idx >= 0) entries.splice(idx, 1);
  }
  return entries;
}

function collectHtmlLocalRefs(html) {
  const refs = new Set(["index.html", "offline.html"]);
  const attrRe = /\b(?:src|href)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(attrRe)) {
    const rel = normalizeAssetPath(m[1]);
    if (rel) refs.add(rel);
  }
  const cssUrlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  for (const m of html.matchAll(cssUrlRe)) {
    const rel = normalizeAssetPath(m[1]);
    if (rel) refs.add(rel);
  }
  return refs;
}

function addManifestRefs(required) {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  for (const icon of manifest.icons || []) {
    const rel = normalizeAssetPath(icon.src);
    if (rel) required.add(rel);
  }

  const assetManifest = JSON.parse(read("assets/manifest.json"));
  for (const asset of assetManifest.assets || []) {
    for (const key of ["file", "cutout"]) {
      const rel = normalizeAssetPath(asset[key]);
      if (rel) required.add(rel);
    }
  }

  const atlasManifest = JSON.parse(read("assets/generated/v4/manifest.json"));
  for (const sheet of Object.values(atlasManifest.sheets || {})) {
    for (const key of ["image", "map"]) {
      const rel = normalizeAssetPath(sheet[key]);
      if (rel) required.add(rel);
    }
  }
}

function addRuntimeAssetRefs(required) {
  for (const relFile of ["src/ui.js"]) {
    const text = read(relFile);
    for (const m of text.matchAll(/["'`](assets\/[^"'`]+)["'`]/g)) {
      const rel = normalizeAssetPath(m[1]);
      if (rel && !rel.endsWith("/") && localFileExists(rel)) required.add(rel);
    }
  }
}

function runSwCacheGuard() {
  console.log("== R39 SW 快取完整性守門 ==");
  const required = collectHtmlLocalRefs(read("index.html"));
  addManifestRefs(required);
  addRuntimeAssetRefs(required);

  const swEntries = parseSwCacheEntries(read("sw.js"));
  const swSet = new Set(swEntries);
  const missing = [...required].filter((rel) => !swSet.has(rel));
  const nonexistent = swEntries.filter((rel) => !localFileExists(rel));

  assert(missing.length === 0, "index/manifest/runtime 關鍵本地資產皆列入 SW cache" + (missing.length ? "：\n    " + missing.join("\n    ") : ""));
  assert(nonexistent.length === 0, "SW cache 清單內檔案皆實際存在" + (nonexistent.length ? "：\n    " + nonexistent.join("\n    ") : ""));
}

function lineCol(text, idx) {
  const before = text.slice(0, idx);
  const lines = before.split(/\r?\n/);
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

const badTextPatterns = [
  ["U+FFFD replacement", /\uFFFD/u],
  ["連續問號", /\?{3,}/u],
  ["UTF-8/Latin-1 mojibake", /[\u00c2\u00c3][\u0080-\u00bf]|[\u00e0-\u00ff][\u00a0-\u00bf]/u],
  ["Big5/私用區 mojibake", /[\uE000-\uF8FF]|[嚗蝝銝撠雿憭摮蝔頝瘞鞈韏閮璅皜蝺摰甈銋隤銴頛餈閬頞霈撟蝡摨暺脣]/u],
];

function checkTextQuality(label, fileText, value, startIdx, hits) {
  if (!value || !value.trim()) return;
  for (const [name, re] of badTextPatterns) {
    const m = re.exec(value);
    if (!m) continue;
    const where = lineCol(fileText, startIdx + m.index);
    hits.push(`${label}:${where.line}:${where.col} ${name} → ${JSON.stringify(value.slice(0, 90))}`);
  }
}

function blankHtmlBlocks(html) {
  return html.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, (m) => " ".repeat(m.length));
}

function scanHtmlVisibleText(relFile, hits) {
  const text = read(relFile);
  const blanked = blankHtmlBlocks(text);
  for (const m of blanked.matchAll(/>([^<>]+)</g)) {
    checkTextQuality(relFile, text, m[1].replace(/\s+/g, " ").trim(), m.index + 1, hits);
  }
  const attrRe = /\b(?:title|aria-label|placeholder|alt)\s*=\s*(["'])(.*?)\1/gi;
  for (const m of text.matchAll(attrRe)) {
    checkTextQuality(relFile, text, m[2], m.index + m[0].indexOf(m[2]), hits);
  }
}

function scanJsStringLiterals(relFile, hits) {
  const text = read(relFile);
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== "\"" && ch !== "'" && ch !== "`") { i++; continue; }
    const quote = ch;
    const start = i + 1;
    let value = "";
    i++;
    while (i < text.length) {
      const cur = text[i];
      if (cur === "\\") {
        value += cur + (text[i + 1] || "");
        i += 2;
        continue;
      }
      if (cur === quote) break;
      value += cur;
      i++;
    }
    checkTextQuality(relFile, text, value, start, hits);
    i++;
  }
}

function runCopyGuard() {
  console.log("\n== R39 文案品質守門 ==");
  const hits = [];
  scanHtmlVisibleText("index.html", hits);
  for (const rel of fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".js")).map((f) => "src/" + f)) {
    scanJsStringLiterals(rel, hits);
  }
  assert(hits.length === 0, "index.html 與 src/*.js 可見字串無 U+FFFD/連續問號/mojibake" + (hits.length ? "：\n    " + hits.join("\n    ") : ""));
}

runSwCacheGuard();
runCopyGuard();

if (failed === 0) {
  console.log("\n✅ R39 自動化守門測試通過");
  process.exit(0);
}
console.error(`\n❌ ${failed} 項守門失敗`);
process.exit(1);
