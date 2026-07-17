/* CI browser gate runner: one browser script at a time with Wave 2 memory courtesy. */
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const REQUIRED_BYTES = 2 * 1024 * 1024 * 1024;
const SCRIPTS = [
  "scripts/test-rpg-v4-e2e.js",
  "scripts/test-rwd-matrix.js",
  "scripts/test-controls-reachability.js",
  "scripts/test-r68-browser.js",
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForMemory(tag) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const free = os.freemem();
    console.log(`[memory] ${tag} attempt ${attempt}: ${(free / 1024 / 1024).toFixed(0)}MiB free`);
    if (free >= REQUIRED_BYTES) return;
    if (attempt < 10) await wait(60000);
  }
  throw new Error(`${tag}: physical memory stayed below 2GiB for 10 attempts`);
}

async function run() {
  for (const script of SCRIPTS) {
    await waitForMemory(script);
    const result = spawnSync(process.execPath, [script], { cwd: ROOT, stdio: "inherit", env: process.env });
    if (result.status !== 0) process.exit(result.status || 1);
  }
  console.log("\n✅ Browser gates ran sequentially; every browser process closed by its owning script.");
}

run().catch((error) => { console.error(error); process.exit(1); });
