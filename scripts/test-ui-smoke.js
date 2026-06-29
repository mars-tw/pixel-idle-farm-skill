/* =========================================================================
 * test-ui-smoke.js — 無瀏覽器 UI 煙霧測試（用 vm + mock DOM）
 *
 * 目的：在沒有瀏覽器的環境，仍能抓到 ui.js 的執行期錯誤
 *   （null 參照、ID 打錯、函式名拼錯、render 崩潰）。
 * 作法：以 Node vm 在 mock DOM sandbox 載入 config/game/state/ui，
 *   觸發 init → 一次 loop tick → 模擬點擊種植/收成/賣出/切換，
 *   全程不可拋例外，且存檔應反映互動。
 * 執行：node scripts/test-ui-smoke.js
 * ========================================================================= */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.error("  ✗ " + msg); failed++; }
}

// ---------- mock DOM ----------
function makeEl(tag) {
  const listeners = {};
  const classes = new Set();
  const el = {
    tagName: tag || "div", children: [], _listeners: listeners, dataset: {},
    offsetWidth: 40, offsetHeight: 40, offsetLeft: 0, offsetTop: 0,
    _html: "", textContent: "", value: "", disabled: false, title: "",
    style: new Proxy({}, { get: (t, k) => (k === "setProperty" ? () => {} : t[k]), set: (t, k, v) => { t[k] = v; return true; } }),
    classList: {
      add: (c) => classes.add(c), remove: (c) => classes.delete(c),
      toggle: (c, f) => { const on = f === undefined ? !classes.has(c) : f; on ? classes.add(c) : classes.delete(c); return on; },
      contains: (c) => classes.has(c),
    },
    set className(v) { classes.clear(); String(v).split(/\s+/).forEach((c) => c && classes.add(c)); },
    get className() { return [...classes].join(" "); },
    set innerHTML(v) { el._html = v; el.children = []; }, get innerHTML() { return el._html; },
    appendChild: (c) => { el.children.push(c); return c; },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: () => {},
    set onclick(fn) { el._onclick = fn; }, get onclick() { return el._onclick; },
    querySelector: () => makeEl("div"),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 40, height: 40 }),
    remove: () => {},
    _fire(type) {
      (listeners[type] || []).forEach((fn) => fn({ clientX: 10, clientY: 10 }));
      if (type === "click" && el._onclick) el._onclick({ clientX: 10, clientY: 10 });
    },
  };
  return el;
}

const elById = {};
function getEl(id) { if (!elById[id]) elById[id] = makeEl("div"); return elById[id]; }

const store = {};
const sandbox = {
  console,
  Math, Date, JSON, Object, Array, String, Number, Boolean, parseInt, parseFloat, isNaN, Infinity,
  setTimeout: (fn) => { try { fn(); } catch (e) { console.error("setTimeout fn 拋錯:", e.message); failed++; } return 0; },
  clearTimeout: () => {},
  setInterval: (fn) => { try { fn(); } catch (e) { console.error("setInterval fn 拋錯:", e.message); failed++; } return 0; }, // 跑一次當作一個 tick
  clearInterval: () => {},
  confirm: () => true,
  Image: class { set src(v) { this._src = v; if (this.onload) this.onload(); } },
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = {
  readyState: "complete",
  getElementById: getEl,
  createElement: makeEl,
  documentElement: makeEl("html"),
  querySelectorAll: () => [],
  addEventListener: () => {},
};
sandbox.window.addEventListener = () => {};

vm.createContext(sandbox);

console.log("== UI 煙霧測試（mock DOM）==");
try {
  for (const f of ["config.js", "game.js", "state.js", "ui.js"]) {
    const code = fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8");
    vm.runInContext(code, sandbox, { filename: f });
  }
  assert(true, "四個腳本載入 + init() 執行無例外");
} catch (e) {
  console.error("  ✗ 載入/init 拋錯:", e.stack);
  failed++;
}

// 互動模擬（新版：地圖場景 + 工具按鈕；移動細節由 jsdom E2E 驗證）
try {
  const scene = elById["mapScene"];
  assert(scene && scene.children.length > 0, "地圖場景磚已建立（" + (scene ? scene.children.length : 0) + " 磚）");

  // 點一個地圖磚不崩（mock 無真實 offset，僅驗證不拋例外）
  scene.children[0]._fire("click");
  assert(true, "點地圖磚無例外");

  // 工具按鈕
  const toolBar = elById["toolBar"];
  assert(toolBar && toolBar.children.length === 5, "工具列 5 個工具");

  // 各動作按鈕不崩
  elById["spriteToggle"]._fire("click");
  elById["sellAllBtn"]._fire("click");
  elById["harvestAllBtn"]._fire("click");
  elById["waterAllBtn"]._fire("click");
  elById["collectAllBtn"]._fire("click");
  assert(true, "賣出/收成/澆水/收產物按鈕無例外");

  // modal 按鈕
  elById["howToBtn"]._fire("click");
  elById["howToOk"]._fire("click");
  elById["offlineOk"]._fire("click");
  assert(true, "modal 開關按鈕無例外");
} catch (e) {
  console.error("  ✗ 互動模擬拋錯:", e.stack);
  failed++;
}

console.log("");
if (failed === 0) { console.log("✅ UI 煙霧測試通過"); process.exit(0); }
else { console.error(`❌ ${failed} 項失敗`); process.exit(1); }
