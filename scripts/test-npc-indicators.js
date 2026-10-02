const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };
async function server() {
  const s = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
    const file = path.resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
    const rel = path.relative(ROOT, file);
    if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => s.listen(0, "127.0.0.1", resolve)); return s;
}
async function checkMarkers(page, tag) {
  const rows = await page.evaluate(() => [...document.querySelectorAll('.ob[data-kind="npc"]')].map((npc) => {
    const bounds = npc.getBoundingClientRect();
    const marks = [...document.querySelectorAll('.ob-dot[data-kind="npc-indicator"], .qmarker[data-npc]')].filter((m) => m.dataset.npc === npc.dataset.npc);
    return { npc: npc.dataset.npc, count: marks.length, gaps: marks.map((m) => bounds.top - m.getBoundingClientRect().bottom), pointers: marks.map((m) => getComputedStyle(m).pointerEvents) };
  }));
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert(row.count <= 1, tag + " " + row.npc + ": duplicate indicators");
    assert(row.gaps.every((gap) => gap >= 10), tag + " " + row.npc + ": glow overlaps the full sprite bounds " + JSON.stringify(row));
    assert(row.pointers.every((value) => value === "none"), tag + " " + row.npc + ": marker intercepts clicks");
  }
  return rows;
}
async function main() {
  const s = process.env.FARM_URL ? null : await server(), browser = await chromium.launch();
  const base = process.env.FARM_URL || "http://127.0.0.1:" + s.address().port;
  try {
    for (const [name, width, height, mobile] of [["desktop", 1440, 900, false], ["mobile", 390, 844, true], ["small", 320, 568, true], ["landscape", 844, 390, true]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, serviceWorkers: "block" });
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__farm && window.Atlas.isReady() && !document.querySelector("#startupLoading"));
      await page.locator("#worldBegin").click();
      await page.addStyleTag({ content: ".ob-dot { animation:none!important;transform:scale(1.3)!important } .qmarker { animation:none!important;transform:translate(-50%,-100%)!important }" });
      const initial = await checkMarkers(page, name + " unread");
      assert(initial.every((row) => row.count === 1), name + ": each unread NPC has exactly one indicator");
      await page.evaluate(() => {
        const s = __farm.state(); s.settings.mapViewMode = "fit";
        dispatchEvent(new Event("resize"));
      });
      await page.waitForTimeout(150); await checkMarkers(page, name + " fit");
      await page.evaluate(() => { __farm.state().settings.mapViewMode = "natural"; dispatchEvent(new Event("resize")); window.MOVE_MS = 10; });
      await page.waitForTimeout(150);
      await page.locator("#questDock [data-world-go]").click();
      await page.waitForFunction(() => __farm.state().story.dialogueSeen.mayor && document.querySelector('.npc-bubble[data-npc="mayor"]'));
      await page.waitForTimeout(220);
      const speechGap = await page.evaluate(() => {
        const n = document.querySelector('.ob[data-kind="npc"][data-npc="mayor"]').getBoundingClientRect();
        const b = document.querySelector('.npc-bubble[data-npc="mayor"]').getBoundingClientRect();
        return n.top - b.bottom;
      });
      assert(speechGap >= 10, name + ": speech bubble/tail covers the NPC");
      await checkMarkers(page, name + " talking");
      await page.evaluate(() => {
        const s = __farm.state(); s.storage.items.wheat = 1;
        s.npcRequests.merchant = { id: "marker_ready_fixture", npcId: "merchant", wants: { wheat: 1 }, createdAt: Date.now(), rewardCoins: 1, rewardXp: 1 };
        __farm.refresh();
      });
      assert.equal(await page.locator('.ob-dot-ready[data-npc="merchant"]').count(), 1);
      await checkMarkers(page, name + " ready");
      if (name === "desktop") {
        const icons = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/generated/r66/manifest.json"), "utf8")).assets.filter((a) => a.outputs.native.endsWith("-32.png"));
        const iconResults = await page.evaluate(async (icons) => {
          const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-1000px;top:0"; document.body.appendChild(host);
          const result = [];
          for (const icon of icons) {
            const expected = "assets/generated/r66/" + icon.outputs.native;
            const node = document.createElement("span"); node.className = "ui-icon i-" + icon.slug.replace(/_/g, "-"); host.appendChild(node);
            const style = getComputedStyle(node), url = style.backgroundImage.slice(5, -2);
            const image = new Image(); image.src = url; await image.decode();
            const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
            const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
            const data = context.getImageData(0, 0, 32, 32).data;
            const alpha = [0, 31, 31 * 32, 32 * 32 - 1].map((i) => data[i * 4 + 3]);
            const sizes = [];
            for (const size of [20, 24, 28, 32]) {
              node.style.width = node.style.height = size + "px";
              const cs = getComputedStyle(node), rect = node.getBoundingClientRect();
              sizes.push(rect.width === size && rect.height === size && cs.backgroundSize === "contain" && cs.backgroundPosition === "50% 50%" && cs.backgroundColor === "rgba(0, 0, 0, 0)");
            }
            result.push({ slug: icon.slug, correctFile: new URL(url, location.href).pathname.endsWith(expected), dimensions: [image.width, image.height], alpha, sizes });
            node.remove();
          }
          host.remove(); return result;
        }, icons);
        assert.equal(iconResults.length, 32);
        for (const icon of iconResults) { assert(icon.correctFile, icon.slug); assert.deepEqual(icon.dimensions, [32, 32]); assert(icon.alpha.every((a) => a === 0), icon.slug + " opaque background"); assert(icon.sizes.every(Boolean), icon.slug + " responsive clipping"); }
      }
      assert.deepEqual(errors, []);
      await page.close(); console.log("PASS " + name + ": unread/ready/quest/talking NPC markers stay clear of sprites, at natural and fit zoom.");
    }
    console.log("PASS 32 transparent UI icons at 20/24/28/32px: individual image, clear corners, no atlas clipping.");
  } finally { await browser.close(); if (s) await new Promise((resolve) => s.close(resolve)); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
