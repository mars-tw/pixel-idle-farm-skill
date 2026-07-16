/* farm R66 formal UI art contract: manifest, atlas wiring, hashes, and assistant skins. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const R66 = path.join(ROOT, "assets", "generated", "r66");
let failed = 0;
function assert(condition, message) {
  if (condition) console.log("  ✅ " + message);
  else { console.error("  ❌ " + message); failed++; }
}
function hash(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

const manifest = JSON.parse(fs.readFileSync(path.join(R66, "manifest.json"), "utf8"));
const frames = JSON.parse(fs.readFileSync(path.join(R66, "ui-icons-32.json"), "utf8"));
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "src", "ui.js"), "utf8");

const expected = [
  "crop_wheat", "crop_carrot", "crop_tomato", "crop_strawberry", "crop_corn", "crop_pumpkin", "crop_radish", "crop_bell_pepper",
  "crop_potato", "crop_sunflower", "crop_grapes", "crop_melon", "crop_pea", "crop_sweet_potato", "crop_winter_kale",
  "tool_plant", "tool_harvest", "tool_water", "tool_clear", "tool_build", "tool_inspect",
  "tab_tile", "tab_orders", "tab_upgrades", "tab_story", "tab_journal",
  "system_coin", "system_xp", "system_storage", "system_settings", "system_help", "system_reset",
];
const assistant = ["assistant_idle", "assistant_tip", "assistant_alert"];
const assets = new Map(manifest.assets.map((item) => [item.slug, item]));

assert(manifest.release === "R66" && manifest.requested_model === "gpt-image-2" && manifest.actual_model === "gpt-image-2", "manifest records R66 and actual gpt-image-2 provenance");
assert(JSON.stringify(manifest.counts) === JSON.stringify({ crops: 15, tools: 6, tabs: 5, systems: 6, icons: 32, assistant_skins: 3 }), "manifest count contract is 15/6/5/6 + 3 skins");
assert(manifest.alpha_gate.status === "PASS" && manifest.alpha_gate.passed === 35, "manifest alpha gate is 35/35 PASS");
assert(Object.keys(frames.frames).length === 32 && expected.every((slug) => frames.frames[slug]), "8x4 atlas frame map contains the exact 32 formal icons");
assert(manifest.runtime.sha256.atlas === hash(path.join(R66, manifest.runtime.atlas)), "runtime atlas SHA-256 matches manifest");

for (const slug of expected.concat(assistant)) {
  const item = assets.get(slug);
  const file = item && path.join(R66, item.outputs.native);
  assert(!!item && !!item.prompt && /^[a-f0-9]{64}$/.test(item.sha256.native) && fs.existsSync(file) && hash(file) === item.sha256.native,
    `${slug} has slug/prompt/native hash and matching file`);
}

assert(expected.every((slug) => html.includes(`.i-${slug.replace(/_/g, "-")}`)), "index CSS maps all 32 atlas positions");
assert(ui.includes('uiIcon("crop_" + c.id)') && Object.values({ hand: "tool_plant", water: "tool_water", clear: "tool_clear", build: "tool_build", inspect: "tool_inspect" }).every((slug) => ui.includes(slug)), "crop and tool renderers use the formal atlas");
assert(["tab-tile", "tab-orders", "tab-upgrades", "tab-story", "tab-journal", "system-settings", "system-help", "system-reset"].every((slug) => html.includes(`i-${slug}`)), "tabs and system controls are wired to formal icons");
assert(assistant.every((slug) => html.includes(`${slug}-64.png`)) && ui.includes('primary.priority >= 100 ? "alert" : "tip"'), "three smart-assistant skins are wired to idle/tip/alert state selection");
assert(ui.includes("smartAssistantCollapsed = true") && html.includes(".smart-assistant.collapsed"), "first-session smart assistant remains collapsed");

if (failed) {
  console.error(`\nR66 UI art contract failed: ${failed}`);
  process.exit(1);
}
console.log("\nR66 UI art contract PASS");
