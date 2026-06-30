/* =========================================================================
 * gen-art-v4.js — 用 gpt-image-2 生成 v4 源圖（art-config-rpg-v4.json）
 * 源圖存 assets/generated/v4/source/；之後由 process-v4-atlas.js 切成精確 frame。
 * 每張 sheet 的輸出尺寸讀 config 的 `size`。需環境變數 OPENAI_API_KEY（絕不寫入檔案/commit）。
 * 執行：OPENAI_API_KEY=sk-... node scripts/gen-art-v4.js [sheetId ...]
 * ========================================================================= */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "art-config-rpg-v4.json"), "utf8"));
const SRC = path.join(ROOT, "assets", "generated", "v4", "source");
fs.mkdirSync(SRC, { recursive: true });

function buildPrompt(sheet) {
  const parts = [sheet.prompt.trim()];
  if (cfg.globalConstraints) parts.push("Constraints: " + cfg.globalConstraints.join("; ") + ".");
  parts.push("Arrange as a clean evenly-spaced grid with consistent padding. Hard: no text, no letters, no numbers, no logo, no watermark, no mockup border.");
  return parts.join("\n");
}

async function genOne(sheet) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.error("缺 OPENAI_API_KEY"); process.exit(2); }
  const size = sheet.size || "1024x1024";
  console.log("== " + sheet.id + " (" + size + ") ==");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.model || "gpt-image-2", prompt: buildPrompt(sheet), size }),
  });
  if (!res.ok) { console.error("  ✗ HTTP " + res.status + ": " + (await res.text()).slice(0, 200)); return false; }
  const j = await res.json();
  const b64 = j.data && j.data[0] && j.data[0].b64_json;
  if (!b64) { console.error("  ✗ 無 b64_json"); return false; }
  const out = path.join(SRC, sheet.targetFile);
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  console.log("  ✓ " + path.relative(ROOT, out) + " (" + Math.round(fs.statSync(out).size / 1024) + "KB)");
  return true;
}

(async function () {
  const only = process.argv.slice(2);
  const sheets = cfg.sheets.filter((s) => only.length === 0 || only.includes(s.id));
  let ok = 0;
  for (const s of sheets) { if (await genOne(s)) ok++; }
  console.log("\n完成 " + ok + "/" + sheets.length + " 張源圖 → assets/generated/v4/source/");
})();
