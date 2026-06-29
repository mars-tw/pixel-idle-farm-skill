/* =========================================================================
 * atlas.js — v2 精確 frame atlas 渲染器（瀏覽器）
 * 讀 assets/generated/v2/manifest.json 與各 sheet 的 JSON frame map，
 * 用「整數像素 frame metadata」把某 frame 縮放貼到任意尺寸的元素，
 * 取代舊的「對 1254 概念圖百分比切片」。image-rendering:pixelated 保持銳利。
 * ========================================================================= */
(function (root) {
  "use strict";
  const V2_BASE = "assets/generated/v2/";
  const state = { ready: false, sheets: {}, maps: {}, error: null };
  let readyResolve; const readyPromise = new Promise((r) => (readyResolve = r));

  async function load() {
    try {
      const manifest = await fetch(V2_BASE + "manifest.json").then((r) => r.json());
      const keys = Object.keys(manifest.sheets);
      await Promise.all(keys.map(async (key) => {
        const s = manifest.sheets[key];
        const map = await fetch(s.map.replace(/^.*\/v2\//, V2_BASE)).then((r) => r.json());
        state.maps[key] = map;          // { image, meta, frames:{id:{x,y,w,h,...}} }
        state.sheets[key] = s.image;    // 圖片路徑
      }));
      state.ready = true;
    } catch (e) {
      state.error = e; console.warn("atlas 載入失敗（將用 fallback）：", e);
    }
    readyResolve(state.ready);
  }

  function getFrame(sheetKey, frameId) {
    const map = state.maps[sheetKey];
    if (!map || !map.frames[frameId]) return null;
    return { image: state.sheets[sheetKey], meta: map.meta, ...map.frames[frameId] };
  }

  // 把 frame 縮放貼滿目標元素（背景方式）。fit: "cover"(填滿) 預設 / "contain"(完整顯示)
  function applyTo(el, sheetKey, frameId) {
    const f = getFrame(sheetKey, frameId);
    if (!f || !el) return false;
    const ew = el.clientWidth || el.offsetWidth, eh = el.clientHeight || el.offsetHeight;
    if (!ew || !eh) { el.dataset.pendingFrame = sheetKey + "|" + frameId; return true; }
    const sheetW = (f.meta.w), sheetH = (f.meta.h);
    el.style.backgroundImage = "url(" + f.image + ")";
    el.style.backgroundRepeat = "no-repeat";
    el.style.imageRendering = "pixelated";
    el.style.backgroundSize = (sheetW / f.w * ew) + "px " + (sheetH / f.h * eh) + "px";
    el.style.backgroundPosition = "-" + (f.x / f.w * ew) + "px -" + (f.y / f.h * eh) + "px";
    return true;
  }

  // 回傳可直接套用在「固定像素尺寸」元素上的 style 物件（給絕對定位 sprite，如角色/動物/物件）
  function frameStyleFor(sheetKey, frameId, ew, eh) {
    const f = getFrame(sheetKey, frameId);
    if (!f) return null;
    return {
      backgroundImage: "url(" + f.image + ")",
      backgroundSize: (f.meta.w / f.w * ew) + "px " + (f.meta.h / f.h * eh) + "px",
      backgroundPosition: "-" + (f.x / f.w * ew) + "px -" + (f.y / f.h * eh) + "px",
    };
  }

  const Atlas = {
    load, ready: () => readyPromise, isReady: () => state.ready,
    getFrame, applyTo, frameStyleFor,
    hasFrame: (s, id) => !!getFrame(s, id),
    framesOf: (s) => (state.maps[s] ? Object.keys(state.maps[s].frames) : []),
  };
  if (typeof window !== "undefined") { window.Atlas = Atlas; }
  if (typeof module !== "undefined" && module.exports) module.exports = Atlas;
})(typeof window !== "undefined" ? window : globalThis);
