const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "assets/generated/r76");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, manifest.runtime.map), "utf8"));
  const image = fs.readFileSync(path.join(ROOT, manifest.runtime.image));
  assert.equal(sha(image), manifest.runtime.sha256);
  assert.equal(map.meta.w, 192); assert.equal(map.meta.h, 192);
  assert.equal(Object.keys(map.frames).length, 4);
  for (const s of manifest.sources) assert.equal(sha(fs.readFileSync(path.join(ROOT, s.path))), s.sha256);
  const registered = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/generated/v4/manifest.json"), "utf8")).sheets.world_projects;
  assert.equal(registered.image, manifest.runtime.image); assert.equal(registered.map, manifest.runtime.map);
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert(sw.includes(manifest.runtime.image)); assert(sw.includes(manifest.runtime.map));
  const browser = await chromium.launch();
  let metrics;
  try {
    const page = await browser.newPage();
    metrics = await page.evaluate(async ({ png, frames, palette }) => {
      const image = new Image(); image.src = png; await image.decode();
      const c = document.createElement("canvas"); c.width = image.width; c.height = image.height;
      const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
      const allowed = new Set(palette.map((hex) => hex.slice(1).toLowerCase()));
      const out = {};
      for (const [id, f] of Object.entries(frames)) {
        const data = ctx.getImageData(f.x, f.y, f.w, f.h).data;
        let edge = 0, badAlpha = 0, outside = 0, pixels = 0, bottom = -1;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
          const k = (y * f.w + x) * 4, a = data[k + 3];
          if (a !== 0 && a !== 255) badAlpha++;
          if (!a) continue;
          pixels++; bottom = Math.max(bottom, y);
          if (x < 6 || y < 6 || x >= f.w - 6 || y >= f.h - 6) edge++;
          const hex = Array.from(data.slice(k, k + 3)).map((n) => n.toString(16).padStart(2, "0")).join("");
          if (!allowed.has(hex)) outside++;
        }
        out[id] = { edge, badAlpha, outside, pixels, bottom };
      }
      return out;
    }, { png: "data:image/png;base64," + image.toString("base64"), frames: map.frames, palette: manifest.pipeline.palette });
  } finally { await browser.close(); }
  for (const [id, m] of Object.entries(metrics)) {
    assert.equal(m.edge, 0, id + " has 6px transparent padding");
    assert.equal(m.badAlpha, 0, id + " uses binary alpha");
    assert.equal(m.outside, 0, id + " stays in shared palette");
    assert(m.pixels >= 500, id + " is nonblank");
    assert.deepEqual(map.frames[id].anchor, [.5, .9375]);
  }
  for (const family of ["fishing_dock", "picnic_table"]) {
    const a = family + "_broken", b = family + "_repaired";
    assert(Math.abs(metrics[a].bottom - metrics[b].bottom) <= 1, family + " foot stays aligned after restoration");
    assert.equal(manifest.metrics[a].sourceScale, manifest.metrics[b].sourceScale);
  }
  console.log("PASS R76 art: 4 exact frames, real alpha, shared palette, 6px padding, matching scale/feet, provenance hashes and SW cache.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
