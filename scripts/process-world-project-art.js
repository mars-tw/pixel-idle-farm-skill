/* Pack single-object sources with shared per-family scale and foot alignment. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets/generated/r76");
const SIZE = 96, GUTTER = 6;
const definitions = [
  { id: "fishing_dock_broken", family: "dock", file: "fishing-dock-broken.png" },
  { id: "fishing_dock_repaired", family: "dock", file: "fishing-dock.png" },
  { id: "picnic_table_broken", family: "picnic", file: "picnic-table-broken.png" },
  { id: "picnic_table_repaired", family: "picnic", file: "picnic-table.png" },
];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
async function main() {
  const palette = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/generated/r68/manifest.json"), "utf8")).palette;
  const sources = definitions.map((def) => {
    const bytes = fs.readFileSync(path.join(OUT, "source", def.file));
    return { ...def, sha256: hash(bytes), data: "data:image/png;base64," + bytes.toString("base64") };
  });
  const browser = await chromium.launch();
  let result;
  try {
    const page = await browser.newPage();
    result = await page.evaluate(async ({ sources, palette, size, gutter }) => {
      const colours = palette.map((hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)));
      const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
      const decoded = await Promise.all(sources.map(async (s) => {
        const image = new Image(); image.src = s.data; await image.decode();
        const c = canvas(image.width, image.height), ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
        const px = ctx.getImageData(0, 0, c.width, c.height);
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1, transparent = 0;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          const alpha = px.data[(y * c.width + x) * 4 + 3];
          if (!alpha) transparent++;
          if (alpha < 128) continue;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        if (x1 < 0 || transparent < c.width * c.height * .2) throw new Error(s.id + ": empty or opaque source");
        return { ...s, canvas: c, bbox: { x0, y0, x1, y1 } };
      }));
      const families = {};
      for (const s of decoded) {
        const b = families[s.family] || { ...s.bbox };
        b.x0 = Math.min(b.x0, s.bbox.x0); b.y0 = Math.min(b.y0, s.bbox.y0);
        b.x1 = Math.max(b.x1, s.bbox.x1); b.y1 = Math.max(b.y1, s.bbox.y1); families[s.family] = b;
      }
      const atlas = canvas(size * 2, size * 2), atlasCtx = atlas.getContext("2d");
      const frames = {}, metrics = {}, sprites = {};
      decoded.forEach((s, i) => {
        const bounds = families[s.family], sw = bounds.x1 - bounds.x0 + 1, sh = bounds.y1 - bounds.y0 + 1;
        const scale = Math.min((size - gutter * 2) / sw, (size - gutter * 2) / sh);
        const w = Math.round(sw * scale), h = Math.round(sh * scale);
        const sprite = canvas(size, size), ctx = sprite.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(s.canvas, bounds.x0, bounds.y0, sw, sh, Math.floor((size - w) / 2), size - gutter - h, w, h);
        const pixels = ctx.getImageData(0, 0, size, size), used = new Set();
        let coverage = 0, x0 = size, y0 = size, x1 = -1, y1 = -1;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const k = (y * size + x) * 4;
          if (pixels.data[k + 3] < 128) { pixels.data[k] = pixels.data[k + 1] = pixels.data[k + 2] = pixels.data[k + 3] = 0; continue; }
          let best = 0, distance = Infinity;
          colours.forEach((colour, index) => {
            const d = 2 * (pixels.data[k] - colour[0]) ** 2 + 3 * (pixels.data[k + 1] - colour[1]) ** 2 + (pixels.data[k + 2] - colour[2]) ** 2;
            if (d < distance) { distance = d; best = index; }
          });
          pixels.data.set([...colours[best], 255], k); used.add(palette[best]); coverage++;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        if (coverage < 500 || x0 < gutter || y0 < gutter || x1 >= size - gutter || y1 >= size - gutter) throw new Error(s.id + ": clipping/coverage gate");
        ctx.putImageData(pixels, 0, 0);
        const x = (i % 2) * size, y = Math.floor(i / 2) * size;
        atlasCtx.drawImage(sprite, x, y);
        frames[s.id] = { x, y, w: size, h: size, anchor: [.5, (size - gutter) / size] };
        metrics[s.id] = { bbox: [x0, y0, x1 + 1, y1 + 1], coveragePixels: coverage, colourCount: used.size, sourceBbox: s.bbox, familyBbox: bounds, sourceScale: scale };
        sprites[s.id] = sprite.toDataURL("image/png");
      });
      return { png: atlas.toDataURL("image/png"), frames, metrics, sprites };
    }, { sources, palette, size: SIZE, gutter: GUTTER });
  } finally { await browser.close(); }
  fs.mkdirSync(OUT, { recursive: true });
  const imagePath = "assets/generated/r76/world-projects-96.png", mapPath = "assets/generated/r76/world-projects-96.json";
  const bytes = Buffer.from(result.png.split(",")[1], "base64");
  fs.writeFileSync(path.join(ROOT, imagePath), bytes);
  const meta = { w: SIZE * 2, h: SIZE * 2, frameW: SIZE, frameH: SIZE, cols: 2, rows: 2 };
  fs.writeFileSync(path.join(ROOT, mapPath), JSON.stringify({ image: imagePath, meta, frames: result.frames }, null, 2) + "\n");
  for (const [id, png] of Object.entries(result.sprites)) fs.writeFileSync(path.join(OUT, id + ".png"), Buffer.from(png.split(",")[1], "base64"));
  const manifest = {
    release: "R76", generator: "Codex built-in image_gen", softwareAgent: "ChatGPT / gpt-image", exactModelVersion: "not exposed by the tool or source metadata",
    prompts: "assets/generated/r76/prompts.json",
    pipeline: { frameSize: SIZE, gutter: GUTTER, boundsAlphaThreshold: 128, scaling: "nearest-neighbor, common bounding box per family", alpha: "binary pixel alpha", paletteSource: "assets/generated/r68/manifest.json", palette },
    runtime: { image: imagePath, map: mapPath, sha256: hash(bytes) },
    sources: sources.map(({ data, ...s }) => ({ ...s, path: "assets/generated/r76/source/" + s.file })), metrics: result.metrics,
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const atlasPath = path.join(ROOT, "assets/generated/v4/manifest.json");
  const atlasManifest = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
  atlasManifest.sheets.world_projects = { image: imagePath, map: mapPath, meta, frameCount: 4, generatedBy: "process-world-project-art.js" };
  fs.writeFileSync(atlasPath, JSON.stringify(atlasManifest, null, 2) + "\n");
  console.log(JSON.stringify({ imagePath, bytes: bytes.length, metrics: result.metrics }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
