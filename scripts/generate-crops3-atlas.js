const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "assets", "generated", "v4");
const W = 240;
const H = 144;
const FW = 48;
const FH = 48;
const rows = ["pea", "sweet_potato", "winter_kale"];
const cols = ["seed", "sprout", "young", "mature", "ready"];
const data = Buffer.alloc(W * H * 4, 0);

const P = {
  outline: [54, 44, 28, 255],
  shadow: [67, 45, 24, 255],
  soil: [132, 85, 47, 255],
  soilHi: [188, 130, 72, 255],
  stem: [71, 119, 48, 255],
  stemDark: [42, 83, 39, 255],
  pea: [75, 168, 61, 255],
  peaHi: [153, 214, 94, 255],
  pod: [50, 139, 62, 255],
  podHi: [137, 209, 82, 255],
  sp: [191, 92, 48, 255],
  spDark: [116, 58, 44, 255],
  spHi: [229, 147, 82, 255],
  vine: [70, 135, 55, 255],
  vineHi: [132, 192, 85, 255],
  kale: [53, 139, 107, 255],
  kaleDark: [31, 91, 83, 255],
  kaleHi: [146, 210, 160, 255],
  frost: [184, 226, 219, 255],
};

function idx(x, y) { return (y * W + x) * 4; }
function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x, y);
  data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3];
}
function at(row, col, x, y) { return [col * FW + x, row * FH + y]; }
function dot(row, col, x, y, c, s = 1) {
  for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
    const p = at(row, col, x + xx, y + yy); px(p[0], p[1], c);
  }
}
function rect(row, col, x, y, w, h, c) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) dot(row, col, x + xx, y + yy, c);
}
function ellipse(row, col, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) dot(row, col, x, y, c);
    }
  }
}
function outlineEllipse(row, col, cx, cy, rx, ry, fill, outline = P.outline) {
  ellipse(row, col, cx, cy, rx + 1, ry + 1, outline);
  ellipse(row, col, cx, cy, rx, ry, fill);
}
function line(row, col, x0, y0, x1, y1, c, s = 1) {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    dot(row, col, x, y, c, s);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function soil(row, col, x = 20, y = 38, w = 9) {
  rect(row, col, x, y, w, 3, P.outline);
  rect(row, col, x + 1, y, w - 2, 2, P.soil);
  rect(row, col, x + 3, y, Math.max(2, w - 6), 1, P.soilHi);
}
function leaf(row, col, cx, cy, rx, ry, fill, dir = 1, hi = P.vineHi) {
  outlineEllipse(row, col, cx, cy, rx, ry, fill, P.stemDark);
  line(row, col, cx - dir * Math.floor(rx * 0.6), cy, cx + dir * Math.floor(rx * 0.6), cy - 1, P.stemDark);
  dot(row, col, cx - dir, cy - 1, hi);
}
function curlLeaf(row, col, cx, cy, fill, hi) {
  outlineEllipse(row, col, cx, cy, 5, 4, fill, P.kaleDark);
  dot(row, col, cx - 2, cy - 2, hi);
  dot(row, col, cx + 1, cy - 1, hi);
}

function peaStage(stage) {
  const r = 0, c = stage;
  soil(r, c, 19, 39, 10);
  if (stage === 0) {
    outlineEllipse(r, c, 24, 35, 4, 3, P.pea, P.outline);
    dot(r, c, 23, 34, P.peaHi);
  } else if (stage === 1) {
    line(r, c, 24, 37, 24, 27, P.stemDark, 2);
    line(r, c, 25, 36, 25, 27, P.stem);
    leaf(r, c, 20, 29, 4, 3, P.pea, -1, P.peaHi);
    leaf(r, c, 29, 28, 4, 3, P.pea, 1, P.peaHi);
  } else if (stage === 2) {
    line(r, c, 24, 39, 23, 22, P.stemDark, 2);
    line(r, c, 25, 38, 24, 23, P.stem);
    line(r, c, 23, 27, 16, 23, P.stemDark);
    line(r, c, 24, 26, 32, 21, P.stemDark);
    leaf(r, c, 17, 23, 5, 3, P.pea, -1, P.peaHi);
    leaf(r, c, 31, 21, 5, 3, P.pea, 1, P.peaHi);
    leaf(r, c, 20, 31, 4, 3, P.pea, -1, P.peaHi);
    leaf(r, c, 29, 30, 4, 3, P.pea, 1, P.peaHi);
  } else if (stage === 3) {
    line(r, c, 24, 40, 24, 18, P.stemDark, 2);
    line(r, c, 25, 39, 25, 19, P.stem);
    for (const [x1, y1, x2, y2] of [[24,23,14,20],[24,25,35,20],[24,30,15,30],[24,31,34,29]]) line(r, c, x1, y1, x2, y2, P.stemDark);
    [[15,20,-1],[35,20,1],[16,30,-1],[33,29,1],[21,25,-1],[29,25,1]].forEach(([x,y,d]) => leaf(r, c, x, y, 5, 3, P.pea, d, P.peaHi));
    outlineEllipse(r, c, 31, 28, 3, 6, P.pod, P.stemDark);
    dot(r, c, 30, 25, P.podHi);
  } else {
    line(r, c, 24, 41, 24, 16, P.stemDark, 2);
    line(r, c, 25, 40, 25, 17, P.stem);
    for (const [x1, y1, x2, y2] of [[24,20,13,18],[24,23,36,18],[24,29,13,31],[24,30,36,30],[24,35,17,38],[24,35,32,38]]) line(r, c, x1, y1, x2, y2, P.stemDark);
    [[13,18,-1],[36,18,1],[14,31,-1],[35,30,1],[18,38,-1],[32,38,1],[20,24,-1],[29,24,1]].forEach(([x,y,d]) => leaf(r, c, x, y, 5, 3, P.pea, d, P.peaHi));
    [[18,27],[31,26],[28,34]].forEach(([x,y]) => { outlineEllipse(r, c, x, y, 3, 6, P.pod, P.stemDark); dot(r, c, x - 1, y - 2, P.podHi); });
  }
}

function sweetPotatoStage(stage) {
  const r = 1, c = stage;
  soil(r, c, 18, 39, 12);
  if (stage === 0) {
    outlineEllipse(r, c, 24, 35, 5, 3, P.sp, P.outline);
    dot(r, c, 22, 34, P.spHi); dot(r, c, 27, 36, P.spDark);
  } else if (stage === 1) {
    outlineEllipse(r, c, 23, 36, 5, 3, P.sp, P.outline);
    dot(r, c, 21, 35, P.spHi);
    line(r, c, 24, 34, 24, 27, P.stemDark, 2);
    leaf(r, c, 20, 28, 4, 3, P.vine, -1, P.vineHi);
    leaf(r, c, 28, 27, 4, 3, P.vine, 1, P.vineHi);
  } else if (stage === 2) {
    line(r, c, 16, 36, 34, 28, P.stemDark, 2);
    line(r, c, 18, 34, 30, 24, P.vine);
    [[17,35,-1],[23,31,-1],[30,25,1],[33,29,1],[21,27,-1]].forEach(([x,y,d]) => leaf(r, c, x, y, 5, 4, P.vine, d, P.vineHi));
    outlineEllipse(r, c, 24, 37, 6, 4, P.sp, P.outline);
    dot(r, c, 22, 35, P.spHi);
  } else if (stage === 3) {
    line(r, c, 13, 35, 37, 24, P.stemDark, 2);
    line(r, c, 17, 30, 35, 35, P.stemDark, 2);
    [[14,35,-1],[19,31,-1],[26,28,1],[34,24,1],[33,35,1],[24,34,-1],[29,31,1]].forEach(([x,y,d]) => leaf(r, c, x, y, 5, 4, P.vine, d, P.vineHi));
    outlineEllipse(r, c, 22, 38, 6, 4, P.sp, P.outline);
    outlineEllipse(r, c, 29, 37, 5, 3, P.spDark, P.outline);
    dot(r, c, 20, 36, P.spHi);
  } else {
    line(r, c, 12, 34, 38, 21, P.stemDark, 2);
    line(r, c, 13, 28, 37, 36, P.stemDark, 2);
    line(r, c, 19, 22, 31, 38, P.stemDark, 2);
    [[13,34,-1],[18,29,-1],[24,25,1],[36,21,1],[35,36,1],[28,34,1],[19,22,-1],[22,37,-1]].forEach(([x,y,d]) => leaf(r, c, x, y, 5, 4, P.vine, d, P.vineHi));
    [[20,39,6,4,P.sp],[28,38,6,4,P.spDark],[34,40,4,3,P.sp]].forEach(([x,y,rx,ry,fill]) => outlineEllipse(r, c, x, y, rx, ry, fill, P.outline));
    dot(r, c, 18, 37, P.spHi); dot(r, c, 31, 37, P.spHi);
  }
}

function kaleStage(stage) {
  const r = 2, c = stage;
  soil(r, c, 19, 39, 10);
  if (stage === 0) {
    outlineEllipse(r, c, 24, 36, 3, 2, P.kaleDark, P.outline);
    dot(r, c, 24, 35, P.frost);
  } else if (stage === 1) {
    line(r, c, 24, 38, 24, 30, P.kaleDark, 2);
    leaf(r, c, 20, 31, 4, 3, P.kale, -1, P.kaleHi);
    leaf(r, c, 28, 30, 4, 3, P.kale, 1, P.kaleHi);
  } else if (stage === 2) {
    line(r, c, 24, 39, 24, 24, P.kaleDark, 2);
    [[18,31],[23,27],[29,30],[20,35],[28,35]].forEach(([x,y]) => curlLeaf(r, c, x, y, P.kale, P.kaleHi));
    dot(r, c, 22, 25, P.frost); dot(r, c, 30, 28, P.frost);
  } else if (stage === 3) {
    line(r, c, 24, 40, 24, 20, P.kaleDark, 2);
    [[17,30],[22,25],[28,24],[33,30],[19,36],[29,36],[24,32]].forEach(([x,y]) => curlLeaf(r, c, x, y, P.kale, P.kaleHi));
    [[21,24],[31,27],[17,31],[29,35]].forEach(([x,y]) => dot(r, c, x, y, P.frost));
  } else {
    line(r, c, 24, 41, 24, 18, P.kaleDark, 2);
    [[15,29],[19,23],[25,21],[31,23],[36,30],[17,37],[24,34],[32,37],[24,28]].forEach(([x,y]) => curlLeaf(r, c, x, y, P.kale, P.kaleHi));
    [[19,22],[27,20],[34,28],[16,36],[31,35],[23,31]].forEach(([x,y]) => dot(r, c, x, y, P.frost));
  }
}

for (let s = 0; s < 5; s++) peaStage(s);
for (let s = 0; s < 5; s++) sweetPotatoStage(s);
for (let s = 0; s < 5; s++) kaleStage(s);

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
}
const CRC = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const tb = Buffer.from(type, "ascii");
  const out = Buffer.alloc(8 + body.length + 4);
  out.writeUInt32BE(body.length, 0);
  tb.copy(out, 4);
  body.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([tb, body])), 8 + body.length);
  return out;
}
function png() {
  const scan = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    scan[y * (W * 4 + 1)] = 0;
    data.copy(scan, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(scan, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "crops3-48.png"), png());

const frames = {};
rows.forEach((row, r) => cols.forEach((col, c) => {
  frames[row + "_" + col] = { x: c * FW, y: r * FH, w: FW, h: FH, anchor: [0.5, 0.9] };
}));
fs.writeFileSync(path.join(OUT, "crops3-48.json"), JSON.stringify({
  image: "assets/generated/v4/crops3-48.png",
  meta: { w: W, h: H, frameW: FW, frameH: FH, cols: 5, rows: 3 },
  frames,
}, null, 2) + "\n");

console.log("generated crops3-48.png/json");
