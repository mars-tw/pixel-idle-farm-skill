/* R80: a small daily farm loop. No DOM, network, random rewards or login streak. */
(function (root) {
  "use strict";
  const C = typeof module !== "undefined" && module.exports ? require("./config.js") : root;
  const DAY = 86400000, OFFSET = 8 * 3600000;
  const keepsakes = [
    { at: 3, id: "pressed_wheat", name: "祖母壓的小麥", text: "第一年收成不好，她還是留了一穗。她說，肯再種一次的人，總會等到下一季。" },
    { at: 7, id: "table_note", name: "餐桌下的紙條", text: "桌子修好那天，祖母在背面寫了每個人的名字。你的名字旁邊，空著一格給下一個回來的人。" },
  ];
  const count = (v, max = 1000000) => Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
  const dayNumber = (now) => Math.floor(((Number.isFinite(now) ? now : 0) + OFFSET) / DAY);
  const key = (day) => new Date(day * DAY).toISOString().slice(0, 10);
  function normalize(raw) {
    const d = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const day = Number.isSafeInteger(d.day) && d.day >= 0 && d.day < 1000000 ? d.day : null;
    const claimed = {};
    for (const id of ["water", "harvest", "basket"]) if (d.claimed && d.claimed[id] === true) claimed[id] = true;
    const stamps = count(d.stamps);
    return { day, cropId: d.cropId, water: count(d.water, 3), harvest: count(d.harvest, 8), claimed, stamps,
      stamped: d.stamped === true, collected: Object.fromEntries(keepsakes.filter((k) => stamps >= k.at).map((k) => [k.id, true])) };
  }
  function ensure(s, now) {
    let d = normalize(s.daily);
    const today = Math.max(0, dayNumber(now));
    // A device clock rollback cannot replay a claimed day. This is not server anti-cheat.
    if (d.day === null || today > d.day) {
      const pool = ["wheat", "carrot", "tomato"].filter((id) => C.CROPS[id].unlockLevel <= s.level);
      d = { day: today, cropId: pool[today % pool.length] || "wheat", water: 0, harvest: 0, claimed: {}, stamps: d.stamps, stamped: false, collected: d.collected };
    }
    if (!["wheat", "carrot", "tomato"].includes(d.cropId) || C.CROPS[d.cropId].unlockLevel > s.level) d.cropId = "wheat";
    s.daily = d;
    return d;
  }
  function record(s, type, amount, now) {
    const d = ensure(s, now);
    if (type === "water") d.water = Math.min(3, d.water + count(amount, 3));
    if (type === "harvest") d.harvest = Math.min(8, d.harvest + count(amount, 8));
  }
  function status(s, now) {
    const d = ensure(s, now), crop = C.CROPS[d.cropId];
    const waterNeed = 2 + d.day % 2, harvestNeed = 4 + d.day % 3 * 2;
    const items = s.storage && s.storage.items || {};
    const tasks = [
      { id: "water", title: "替新芽添水", detail: "種下作物後，用澆水工具照顧它。每株只算一次。", have: d.water, need: waterNeed, coins: 4 },
      { id: "harvest", title: "收一籃新鮮", detail: "成熟後點右下角收成鍵。作物進倉庫才算數。", have: d.harvest, need: harvestNeed, coins: 6 },
      { id: "basket", title: `${crop.name}餐籃`, detail: `留 ${2} 份${crop.name}給鄰居，交付後會從倉庫取走。`, have: count(items[d.cropId]), need: 2, coins: crop.sellValue * 2 + 4, cropId: d.cropId },
    ].map((t) => ({ ...t, claimed: !!d.claimed[t.id], ready: !d.claimed[t.id] && t.have >= t.need }));
    return { day: d.day, date: key(d.day), nextAt: (d.day + 1) * DAY - OFFSET, tasks, stamps: d.stamps, stamped: d.stamped,
      done: tasks.filter((t) => t.claimed).length, keepsakes: keepsakes.map((k) => ({ ...k, owned: !!d.collected[k.id] })) };
  }
  function claim(s, id, expectedDay, now) {
    const st = status(s, now), task = st.tasks.find((t) => t.id === id), d = s.daily;
    if (st.day !== expectedDay) return { ok: false, reason: "new_day" };
    if (!task || task.claimed || !task.ready) return { ok: false, reason: task && task.claimed ? "claimed" : "not_ready" };
    if (task.cropId) {
      s.storage.items[task.cropId] -= task.need;
      if (!s.storage.items[task.cropId]) delete s.storage.items[task.cropId];
    }
    d.claimed[id] = true;
    s.coins += task.coins;
    s.stats.totalCoinsEarned = (s.stats.totalCoinsEarned || 0) + task.coins;
    let stamp = false;
    const unlocked = [];
    if (["water", "harvest", "basket"].every((k) => d.claimed[k]) && !d.stamped) {
      d.stamped = true; d.stamps++; stamp = true;
      s.materials.compost = (s.materials.compost || 0) + 1;
      for (const k of keepsakes) if (d.stamps >= k.at && !d.collected[k.id]) { d.collected[k.id] = true; unlocked.push(k.name); }
    }
    return { ok: true, coins: task.coins, stamp, unlocked };
  }
  const API = { normalize, ensure, record, status, claim, dayNumber };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.FarmDaily = API;
})(typeof window !== "undefined" ? window : globalThis);
