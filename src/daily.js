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
    for (const id of ["water", "talk", "sell"]) if (d.claimed && d.claimed[id] === true) claimed[id] = true;
    const stamps = count(d.stamps);
    return { day, cropId: d.cropId, water: count(d.water, 3), talk: count(d.talk, 1), sell: count(d.sell, 1), claimed, stamps,
      stamped: d.stamped === true, collected: Object.fromEntries(keepsakes.filter((k) => stamps >= k.at).map((k) => [k.id, true])) };
  }
  function ensure(s, now) {
    let d = normalize(s.daily);
    const today = Math.max(0, dayNumber(now));
    // A device clock rollback cannot replay a claimed day. This is not server anti-cheat.
    if (d.day === null || today > d.day) {
      const pool = ["wheat", "carrot", "tomato"].filter((id) => C.CROPS[id].unlockLevel <= s.level);
      d = { day: today, cropId: pool[today % pool.length] || "wheat", water: 0, talk: 0, sell: 0, claimed: {}, stamps: d.stamps, stamped: false, collected: d.collected };
    }
    if (!["wheat", "carrot", "tomato"].includes(d.cropId) || C.CROPS[d.cropId].unlockLevel > s.level) d.cropId = "wheat";
    s.daily = d;
    return d;
  }
  function record(s, type, amount, now) {
    const d = ensure(s, now);
    if (type === "water") d.water = Math.min(3, d.water + count(amount, 3));
    if (type === "talk") d.talk = Math.min(1, d.talk + count(amount, 1));
    if (type === "sell") d.sell = Math.min(1, d.sell + count(amount, 1));
  }
  function marketUnlocked(s) {
    return !!(s && s.adventure && s.adventure.claimed && s.adventure.claimed.c1_first_harvest);
  }
  function status(s, now) {
    const d = ensure(s, now);
    const waterNeed = 2 + d.day % 2;
    const tasks = [
      { id: "water", title: "替新芽添水", detail: "種下作物後，用澆水工具照顧它。每株只算一次。", have: d.water, need: waterNeed, coins: 4 },
      { id: "talk", title: "向鎮民問早", detail: "找任一位鎮民交談一次，聽聽今天農場有什麼新鮮事。", have: d.talk, need: 1, coins: 5 },
      { id: "sell", title: "賣出一份作物", detail: marketUnlocked(s) ? "把任一份作物賣到市集；訂單交付不算在這一項。" : "市集開放後：先把 2 份小麥交給老農班伯，市集就會開放。", have: d.sell, need: 1, coins: 6, available: marketUnlocked(s) },
    ].map((t) => ({ ...t, available: t.available !== false, completed: t.available !== false && t.have >= t.need, claimed: !!d.claimed[t.id], ready: t.available !== false && !d.claimed[t.id] && t.have >= t.need }));
    const available = tasks.filter((t) => t.available);
    return { day: d.day, date: key(d.day), nextAt: (d.day + 1) * DAY - OFFSET, tasks, stamps: d.stamps, stamped: d.stamped,
      available: available.length, completed: available.filter((t) => t.completed).length, claimed: available.filter((t) => t.claimed).length,
      done: available.filter((t) => t.claimed).length, keepsakes: keepsakes.map((k) => ({ ...k, owned: !!d.collected[k.id] })) };
  }
  function claim(s, id, expectedDay, now) {
    const st = status(s, now), task = st.tasks.find((t) => t.id === id), d = s.daily;
    if (st.day !== expectedDay) return { ok: false, reason: "new_day" };
    if (!task || task.claimed || !task.ready) return { ok: false, reason: task && task.claimed ? "claimed" : "not_ready" };
    d.claimed[id] = true;
    s.coins += task.coins;
    s.stats.totalCoinsEarned = (s.stats.totalCoinsEarned || 0) + task.coins;
    let stamp = false;
    const unlocked = [];
    if (st.tasks.filter((t) => t.available).every((t) => d.claimed[t.id]) && !d.stamped) {
      d.stamped = true; d.stamps++; stamp = true;
      s.materials.compost = (s.materials.compost || 0) + 1;
      for (const k of keepsakes) if (d.stamps >= k.at && !d.collected[k.id]) { d.collected[k.id] = true; unlocked.push(k.name); }
    }
    return { ok: true, coins: task.coins, stamp, unlocked };
  }
  const API = { normalize, ensure, record, status, claim, dayNumber, marketUnlocked };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.FarmDaily = API;
})(typeof window !== "undefined" ? window : globalThis);
