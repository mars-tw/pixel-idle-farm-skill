/* =========================================================================
 * test-rwd-matrix.js — R47 RWD 9 視口矩陣守門（真瀏覽器）
 *
 * 驗收標準（硬性，任一違規即 exit 1）：
 *   1. 所有可互動元素（button/select/input/textarea/a[href]/[role=button]/[onclick]）
 *      必須「完整在視口內」，或「位於一個自身完整可見、overflow-y 可捲的容器內」。
 *   2. 頁級捲動歸零：documentElement.scrollHeight <= innerHeight + 8
 *      （app-shell：body 不捲、區域內捲）。
 *   3. 水平溢出 <= 2px。
 *
 * 視口矩陣：1920x1080 / 1366x700 / 1280x720 / 1024x768 / 820x1180 /
 *           768x1024 / 390x844 / 360x640 / 844x390（橫向手機）。
 * 前置：每個視口載入後先關閉教學/導覽 overlay（.modal.show，如首次遊玩的
 *       「怎麼玩」引導與離線摘要），再進行稽核；另跑一輪「不關 overlay」
 *       確認引導開啟狀態下也零違規。
 * 執行：node scripts/test-rwd-matrix.js   （需 devDependency: playwright）
 * ========================================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".css": "text/css" };

let failed = 0;
function assert(cond, msg) { if (cond) console.log("  ✓ " + msg); else { console.error("  ✗ " + msg); failed++; } }

const VIEWPORTS = [
  { w: 1920, h: 1080, kind: "desktop" },
  { w: 1366, h: 700, kind: "desktop" },
  { w: 1280, h: 720, kind: "desktop" },
  { w: 1024, h: 768, kind: "desktop" },
  { w: 820, h: 1180, kind: "tablet" },
  { w: 768, h: 1024, kind: "tablet" },
  { w: 390, h: 844, kind: "mobile" },
  { w: 360, h: 640, kind: "mobile" },
  { w: 844, h: 390, kind: "landscape" },
];

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
      const safePath = pathname === "/" ? "/index.html" : pathname;
      const fp = path.resolve(ROOT, "." + safePath);
      const rel = path.relative(ROOT, fp);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/* 頁內稽核：回傳違規清單 + 頁捲量 + 水平溢出。
 * 判定邏輯與總稽核器 audit-rwd.js 一致：
 *   OK            完整在視口內
 *   SCROLLABLE_OK 位於「自身完整可見、overflow-y 可捲」的容器內（面板內捲可達）
 *   其餘（PAGE_SCROLL / CLIPPED）→ 違規
 */
async function auditPage(page) {
  return page.evaluate(() => {
    const tol = 2;
    const iw = window.innerWidth, ih = window.innerHeight;
    const els = [...document.querySelectorAll('button, select, input, textarea, a[href], [role="button"], [onclick]')];
    const violations = [];
    const seen = new Set();
    for (const el of els) {
      if (seen.has(el)) continue; seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || el.disabled) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (+cs.opacity === 0) continue;
      let anc = el.parentElement, hidden = false, scrollHost = null;
      while (anc && anc !== document.body) {
        const acs = getComputedStyle(anc);
        if (acs.display === "none" || acs.visibility === "hidden" || +acs.opacity === 0) { hidden = true; break; }
        if (!scrollHost && /(auto|scroll)/.test(acs.overflowY) && anc.scrollHeight > anc.clientHeight + 4) scrollHost = anc;
        anc = anc.parentElement;
      }
      if (hidden) continue;
      const inVp = r.top >= -tol && r.left >= -tol && r.bottom <= ih + tol && r.right <= iw + tol;
      let status;
      if (inVp) status = "OK";
      else if (scrollHost) {
        const hr = scrollHost.getBoundingClientRect();
        const hostVisible = hr.top >= -tol && hr.bottom <= ih + tol && hr.left >= -tol && hr.right <= iw + tol;
        status = hostVisible ? "SCROLLABLE_OK" : "PAGE_SCROLL";
      } else status = (r.top >= ih || r.bottom <= 0) ? "PAGE_SCROLL" : "CLIPPED";
      if (status !== "OK" && status !== "SCROLLABLE_OK") {
        const label = (el.id ? "#" + el.id : "") ||
          (el.getAttribute("aria-label") || el.textContent || el.className || el.tagName).toString().trim().slice(0, 28);
        violations.push(`${label}[${status} t${Math.round(r.top)} b${Math.round(r.bottom)} l${Math.round(r.left)} r${Math.round(r.right)}]`);
      }
    }
    return {
      violations,
      pageScrollY: Math.max(0, document.documentElement.scrollHeight - ih),
      overflowX: Math.max(0, document.documentElement.scrollWidth - iw),
      total: seen.size,
    };
  });
}

async function auditViewport(browser, base, vp, closeOverlays) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    hasTouch: vp.kind === "mobile" || vp.kind === "landscape",
    isMobile: vp.kind === "mobile" || vp.kind === "landscape",
  });
  try {
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => window.__farm && window.__farm.state, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    if (closeOverlays) {
      // 前置：關閉教學/導覽 overlay（首次遊玩「怎麼玩」引導、離線摘要等 modal）
      await page.evaluate(() => document.querySelectorAll(".modal.show").forEach((m) => m.classList.remove("show")));
      await page.waitForTimeout(300);
    }
    const res = await auditPage(page);
    const tag = `${vp.w}x${vp.h}(${vp.kind}${closeOverlays ? "" : ", overlay 未關"})`;
    assert(res.total > 10, `${tag} 可互動元素已載入（${res.total} 個）`);
    assert(res.violations.length === 0, `${tag} 互動元素零出界（違規 ${res.violations.length}）` + (res.violations.length ? "：\n    " + res.violations.join("\n    ") : ""));
    assert(res.pageScrollY <= 8, `${tag} 頁級捲動歸零（scrollHeight - innerHeight = ${res.pageScrollY} <= 8）`);
    assert(res.overflowX <= 2, `${tag} 水平溢出 <= 2px（實測 ${res.overflowX}）`);
  } finally {
    await context.close();
  }
}

async function run() {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.error("需要 devDependency: playwright"); process.exit(2); }

  const server = await startServer();
  const base = "http://127.0.0.1:" + server.address().port + "/index.html";
  const browser = await chromium.launch();
  try {
    console.log("== R47 RWD 9 視口矩陣守門（overlay 先關閉） ==");
    for (const vp of VIEWPORTS) await auditViewport(browser, base, vp, true);
    console.log("\n== R47 RWD 9 視口矩陣守門（overlay 開啟狀態） ==");
    for (const vp of VIEWPORTS) await auditViewport(browser, base, vp, false);
  } finally {
    await browser.close();
    server.close();
  }

  if (failed === 0) {
    console.log("\n✅ R47 RWD 矩陣守門通過（9 視口 × overlay 開/關 全零違規）");
    process.exit(0);
  }
  console.error(`\n❌ ${failed} 項 RWD 守門失敗`);
  process.exit(1);
}

run().catch((e) => { console.error("RWD 守門執行失敗：", e); process.exit(1); });
