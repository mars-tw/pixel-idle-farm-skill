const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

function normalizeAssetPath(raw, options = {}) {
  if (!raw || typeof raw !== "string") return null;
  let value = raw.trim().replace(/\\/g, "/");
  if (!value || /^(https?:|data:|mailto:|tel:|#)/i.test(value)) return null;
  value = options.keepQuery ? value.split("#")[0] : value.split("#")[0].split("?")[0];
  if (!value || value === "./") return ".";
  if (value.startsWith("./")) value = value.slice(2);
  if (value.startsWith("/")) value = value.slice(1);
  return value || null;
}

function stripAssetQuery(rel) {
  return String(rel || "").split("?")[0];
}

function assetVersion(rel) {
  const m = String(rel || "").match(/[?&]v=([^&]+)/);
  return m ? m[1] : "";
}

function withVersion(rel, version) {
  if (!rel || rel === ".") return rel;
  return stripAssetQuery(rel) + "?v=" + version;
}

function localFileExists(rel) {
  const clean = stripAssetQuery(rel);
  const target = clean === "." ? ROOT : path.join(ROOT, clean);
  return fs.existsSync(target);
}

function parseSwCacheMeta(swText) {
  const sandbox = { self: { addEventListener: () => {} }, console };
  vm.runInNewContext(swText + "\nglobalThis.__swMeta = { version: CACHE_VERSION, entries: CORE_ASSETS };", sandbox, { filename: "sw.js" });
  const entries = (sandbox.__swMeta.entries || []).map((value) => normalizeAssetPath(value, { keepQuery: true })).filter(Boolean);
  if (PROBE_MISSING_CACHE) {
    const idx = entries.findIndex((entry) => stripAssetQuery(entry) === "src/config.js");
    if (idx >= 0) entries.splice(idx, 1);
  }
  return { version: sandbox.__swMeta.version, entries };
}

function collectHtmlLocalRefs(html) {
  const refs = new Set(["index.html", "offline.html", "assets/manifest.json", "assets/generated/v4/manifest.json"]);
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

function htmlVersionIssues(html, version) {
  const issues = [];
  const tagRe = /<(script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(tagRe)) {
    const rel = normalizeAssetPath(m[2], { keepQuery: true });
    if (!rel) continue;
    const v = assetVersion(rel);
    if (v !== version) issues.push(`${m[1]} ${m[2]} version=${v || "(missing)"}`);
  }
  return issues;
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
  const swMeta = parseSwCacheMeta(read("sw.js"));
  const required = collectHtmlLocalRefs(read("index.html"));
  addManifestRefs(required);
  addRuntimeAssetRefs(required);

  const swEntries = swMeta.entries;
  const swSet = new Set(swEntries);
  const versionIssues = htmlVersionIssues(read("index.html"), swMeta.version);
  const requiredVersioned = [...required].filter((rel) => rel !== ".").map((rel) => withVersion(rel, swMeta.version));
  const missing = requiredVersioned.filter((rel) => !swSet.has(rel));
  const unversioned = swEntries.filter((rel) => rel !== "." && assetVersion(rel) !== swMeta.version);
  const nonexistent = swEntries.filter((rel) => !localFileExists(rel));

  assert(versionIssues.length === 0, `index.html 本地 script/link 皆帶 ?v=${swMeta.version}` + (versionIssues.length ? "：\n    " + versionIssues.join("\n    ") : ""));
  assert(missing.length === 0, "index/manifest/runtime 關鍵本地資產皆以版本 URL 列入 SW cache" + (missing.length ? "：\n    " + missing.join("\n    ") : ""));
  assert(unversioned.length === 0, `SW cache 清單皆帶 ?v=${swMeta.version}` + (unversioned.length ? "：\n    " + unversioned.join("\n    ") : ""));
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

function runTouchFarmGuard() {
  console.log("\n== R61 手機地圖內 UX 守門 ==");
  const ui = read("src/ui.js");
  const html = read("index.html");
  assert(ui.includes('activationType === "touch"') && ui.includes("renderSceneActionsForSelection()") &&
    ui.includes("sceneActionsForTile(tile)") && ui.includes('if (isTouch && tile.plotIndex != null)'),
    "touch 農土改由地圖內 action dock 承接，不再要求二次確認");
  assert(ui.includes("setupSceneControls()") && ui.includes("stepPlayerDir(dir)") &&
    ui.includes("activateFacingTile()") && html.includes("mobileControls") && html.includes("actionA"),
    "手機有 D-pad 與 A 鍵，且重用逐格移動/面向目標動作");
  assert(ui.includes("showBuildWheel(tile)") && ui.includes("G.buildBuilding(state, tileId, type") &&
    html.includes("buildWheel"),
    "建造工具以地圖內輪盤直接呼叫 buildBuilding");
  assert(ui.includes("showAnimalBubble") && ui.includes("showBuildingBubble") &&
    ui.includes("G.feedAnimal") && ui.includes("G.waterAnimal") && ui.includes("G.groomAnimal") &&
    html.includes("objectBubble"),
    "建築/動物照護改為地圖內小氣泡並重用 care/collect 函式");
  assert(ui.includes('handleMapClick(id)') && ui.includes('return "mouse"'),
    "桌面／程式化地圖操作維持單擊直達路徑");
  assert(ui.includes('typeof window.PointerEvent === "function"') &&
    ui.includes("lastMapPointer = { pointerType: ev.pointerType") &&
    ui.includes("LEGACY_TOUCH_CLICK_WINDOW_MS = 350") &&
    !ui.includes("lastTouchMapAt < 700"),
    "PointerEvent 優先，350ms 時窗只保留給無 PointerEvent 的舊瀏覽器");
  assert(html.includes("sceneActionBar") && html.includes("seedHud") && html.includes(".scene-action-bar") &&
    html.includes(".seed-hud") && html.includes(".mobile-controls"),
    "地圖內 action dock、作物 quickbar 與手機控制盤樣式存在");
  assert(ui.includes("setPrimaryPointerClass()") && ui.includes('matchMedia("(pointer: coarse)")') &&
    ui.includes('classList.toggle("mobile-controls-enabled", primaryCoarse && narrow)') &&
    !ui.includes("maxTouchPoints") && !html.includes("html.has-touch"),
    "R63 手機控制盤只依主指標 coarse + 窄寬度分流，不再把觸控能力當手機");
}

runSwCacheGuard();
runCopyGuard();
runTouchFarmGuard();

if (failed === 0) {
  console.log("\n✅ R39 自動化守門測試通過");
  process.exit(0);
}
console.error(`\n❌ ${failed} 項守門失敗`);
process.exit(1);
