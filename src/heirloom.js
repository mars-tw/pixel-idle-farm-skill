/* First sunlight basket: a permanent, local story, independent of the daily clock. */
(function (root) {
  "use strict";
  const notes = {
    doorstep: { title: "門邊那一籃", text: "祖母在門邊總留一籃小麥，從不敲門催人來拿。「有人還沒準備好說話，也得吃飯。」你把餐籃放下時，葛瑞從屋裡搬出第二張椅子。", reply: "餐籃我看到了。明天椅子也替你留著。" },
    table: { title: "多擺一張椅子", text: "祖母的手記夾著一張座位圖，自己的位置畫在最外側。「坐這裡，後來的人才有地方加一張椅子。」你提著小麥坐下，葛瑞把空杯子往你這邊推。", reply: "先坐。田裡的事，吃完再說。" },
  };
  // Narrative illustrations; locomotion remains in the existing frame-based atlases.
  const illustrations = { doorstep: "assets/heirloom/r83/doorstep-r82.webp", table: "assets/heirloom/r83/table-r82.webp" };
  function normalize(raw) {
    const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const choice = Object.hasOwn(notes, r.choice) ? r.choice : null;
    return { started: r.started === true, sunWheat: Number.isFinite(r.sunWheat) ? Math.max(0, Math.min(2, Math.floor(r.sunWheat))) : 0,
      delivered: r.delivered === true && !!choice, choice, deliveredAt: Number.isFinite(r.deliveredAt) ? Math.max(0, r.deliveredAt) : 0 };
  }
  function ensure(s) { s.heirloom = normalize(s.heirloom); return s.heirloom; }
  function start(s) { const h = ensure(s); h.started = true; return h; }
  function recordHarvest(s, cropId, added, sunny) {
    const h = ensure(s);
    if (cropId === "wheat" && sunny === true && Number.isFinite(added) && added > 0) h.sunWheat = Math.min(2, h.sunWheat + Math.floor(added));
  }
  function status(s) {
    const h = ensure(s), stock = s.storage && s.storage.items && s.storage.items.wheat;
    const wheat = Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
    return { ...h, wheat, ready: !h.delivered && h.sunWheat >= 2 && wheat >= 2, note: h.delivered ? notes[h.choice] : null };
  }
  function deliver(s, choice, now) {
    const st = status(s);
    if (!Object.hasOwn(notes, choice)) return { ok:false, reason:"choice" };
    if (st.delivered) return { ok:false, reason:"delivered" };
    if (!st.ready) return { ok:false, reason:"ingredients" };
    s.storage.items.wheat -= 2;
    if (s.storage.items.wheat === 0) delete s.storage.items.wheat;
    Object.assign(s.heirloom, { started:true, delivered:true, choice, deliveredAt:Number.isFinite(now) ? Math.max(0,now) : 0 });
    return { ok:true, note:notes[choice] };
  }
  const API = { normalize, ensure, start, recordHarvest, status, deliver, illustrations };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.FarmHeirloom = API;
})(typeof window !== "undefined" ? window : globalThis);
