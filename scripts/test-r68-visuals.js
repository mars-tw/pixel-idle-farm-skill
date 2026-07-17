/* R68 static visual/provenance/budget/contrast/cache gate. */
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file));
const text = (file) => read(file).toString("utf8");
const json = (file) => JSON.parse(text(file));
const hash = (file) => crypto.createHash("sha256").update(read(file)).digest("hex");
let checks = 0;
function gate(condition, message) {
  checks++;
  assert.ok(condition, message);
  console.log("  ✓ " + message);
}

console.log("== R68 seasonal visual static gates ==");
const manifest = json("assets/generated/r68/manifest.json");
const c2pa = json("docs/evidence/R68/c2pa-verification.json");
const source = json("docs/evidence/R68/source-manifest.json");
const contrast = json("docs/evidence/R68/contrast-gate.json");
const memory = json("docs/evidence/R68/texture-memory.json");
const index = text("index.html");
const sw = text("sw.js");

gate(manifest.release === "R68" && manifest.version === "r68-20260717-1" && manifest.modelSlug === "gpt-image-2",
  "manifest release/version/model are exact");
gate(sw.includes(`./assets/generated/r68/manifest.json?v=${hash("assets/generated/r68/manifest.json").slice(0, 8)}`),
  "runtime manifest uses its exact content hash in the SW offline list");
gate(Array.isArray(manifest.palette) && manifest.palette.length === 66 && new Set(manifest.palette).size === 66,
  "shared palette has exactly 66 unique colours");
gate(c2pa.pass && Object.keys(c2pa.assets).length === 5, "Python C2PA verification is PASS for 5/5 masters");
gate(source.actualModel === "gpt-image-2" && source.references.length === 4 && Object.keys(source.assets).length === 5,
  "source manifest records model, four reference hashes, and five prompt-bound masters");

for (const [assetId, tiers] of Object.entries(manifest.assets)) {
  const sourceAsset = source.assets[assetId];
  gate(!!sourceAsset && sourceAsset.master.startsWith("docs/evidence/R68/masters/"), `${assetId} master is evidence-only`);
  gate(sourceAsset.masterSha256 === hash(sourceAsset.master), `${assetId} master SHA-256 matches`);
  const bytes = read(sourceAsset.master);
  gate(bytes.includes(Buffer.from("softwareAgent")) && bytes.includes(Buffer.from("gpt-image")) && bytes.includes(Buffer.from("versionc2.0")),
    `${assetId} embedded softwareAgent is gpt-image 2.0`);
  const tierHashes = [];
  for (const tier of ["low", "med", "high"]) {
    const item = tiers[tier];
    gate(!!item && item.sha256 === hash(item.file), `${assetId}/${tier} runtime SHA-256 matches`);
    gate(item.contentHashQuery === item.sha256.slice(0, 8), `${assetId}/${tier} content hash query is SHA prefix`);
    gate(item.metrics.outOfPalettePixels === 0 && item.metrics.luminanceSteps >= 6 && item.metrics.outlinePixels >= 16,
      `${assetId}/${tier} palette, multi-value, and outline gates pass`);
    gate(index.includes(`${item.file}?v=${item.contentHashQuery}`) && sw.includes(`./${item.file}?v=${item.contentHashQuery}`),
      `${assetId}/${tier} runtime references use exact content hash in UI and SW`);
    tierHashes.push(item.sha256);
  }
  gate(new Set(tierHashes).size === 3, `${assetId} low/med/high tiers are three real distinct assets`);
}

gate(memory.pass && memory.allTiersMiB === manifest.decodedTextureMiBAllTiers && memory.allTiersMiB <= 32,
  `all tiers decoded texture total ${memory.allTiersMiB}MiB <= mobile 32MiB and desktop 64MiB`);
gate(contrast.pass && Object.values(contrast.tiers).every((tier) => tier.pass45 && Object.values(tier.minimumContrast).every((ratio) => ratio >= 4.5)),
  "activity-panel title/body/meta minimum contrast is >=4.5:1 in every tier");
gate(Object.values(contrast.tiers).every((tier) => tier.readabilityNoisePass && tier.luminanceStdDev <= tier.readabilityNoiseLimit),
  "activity-panel text-zone local luminance noise stays <=0.12 in every tier");
gate(Object.values(contrast.loadingCopy).flatMap((tiers) => Object.values(tiers)).every((tier) => tier.pass45 && Object.values(tier.minimumContrast).every((ratio) => ratio >= 4.5)),
  "loading title/body contrast is >=4.5:1 over every seasonal tier");
gate(manifest.pipeline.focalBoxNormalized.join(",") === "0.35,0.32,0.65,0.68" && manifest.pipeline.safeAreaViewportInset === 0.08,
  "loading focal bbox and 8% viewport safe area are commandized");
gate(index.includes("background-size: cover") && index.includes("data-audit=\"r68-loading\"") && index.includes("farm-visual-focus-ready"),
  "loading screen uses cover framing and emits performance focus mark");
gate(index.includes(".season-event-card") && index.includes("var(--r68-activity-panel)"),
  "generated panel is bound only to the existing season-event card");
gate(!index.includes("r67-20260717-1") && !text("src/ui.js").includes("r67-20260717-1") && !sw.includes("r67-20260717-1"),
  "runtime old version reference count is zero");
gate(fs.existsSync(path.join(ROOT, "docs/evidence/R68/style-board.png")) && fs.existsSync(path.join(ROOT, "docs/evidence/R68/quality-low-med-high.png")),
  "style board and low/med/high same-scene evidence exist");

console.log(`\n✅ R68 static visual gates PASS (${checks} assertions)`);
