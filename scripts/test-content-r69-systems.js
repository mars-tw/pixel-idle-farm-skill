"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { serve } = require("./r85-browser-helper");

(async () => {
  const { server, origin } = await serve();
  let browser;
  try {
    const args = ["--no-sandbox", "--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
    try { browser = await chromium.launch({ headless: true, args }); }
    catch (_) { browser = await chromium.launch({ headless: true, channel: "chrome", args }); }
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(origin);
    await page.waitForFunction(() => window.__farm && !document.querySelector("#startupLoading"), null, {timeout: 30000});
    await page.evaluate(() => document.querySelector("#worldBegin")?.click());
    await page.evaluate(() => {
      const s = __farm.state(), now = Date.now();
      AdventureAPI.ensure(s, now);
      Object.assign(s.adventure.r61.festival, {
        unlocked: true, startsAt: now-1000, endsAt: now+480000, nextAt: 0,
        baseline: {tomato:0, cook:0, talks:{mayor:0, elder:0, merchant:0, child:0}},
        harvestCrop: "tomato", harvestRequired: 3
      });
      __farm.refresh(); FarmWorld.refresh(s);
    });
    const focus = await page.evaluate(() => {
      const dock = document.querySelector("#questDock");
      return {
        now: dock.querySelector(".r69a-festival-now .r82a-guidance-full")?.textContent,
        main: dock.querySelector(".r69a-main-row")?.textContent || "",
        requirements: Array.from(dock.querySelectorAll(".r68a-requirements span"), e => e.textContent),
        button: dock.querySelector("[data-r69a-festival-go]")?.textContent
      };
    });
    assert.equal(focus.now, "祭典：收成 3 份番茄（0/3）。田裡的番茄還不夠，先去種。");
    assert.equal(focus.button, "去種番茄");
    assert.equal(focus.main, "");
    assert.ok(focus.requirements.includes("○ 找鎮長葛瑞交談 0/1"), JSON.stringify(focus));
    await page.evaluate(() => FarmWorld.openPanel("story"));
    const story = page.locator("[data-r63a-main-story]");
    assert.equal(await story.locator(".r68a-card-now small").textContent(), focus.now,
      "祭典開著時手札與任務卡都說明先種番茄");
    // With the festival closed, the ordinary farming step becomes the priority.
    await page.evaluate(() => {
      const s = __farm.state(), now = Date.now();
      s.adventure.r61.festival.unlocked = false;
      s.sun = {...s.sun, plots:[], previewPlots:[], used:[], startsAt:0, endsAt:0, previewAt:0, nextAt:now+600000, introduced:true};
      s.adventure.claimed.c1_homecoming = true;
      s.plots[0] = {...s.plots[0], cropId:"wheat", plantedAt:now, wateredAt:0};
      AdventureAPI.record(s, {type:"plant", cropId:"wheat"}, now);
      __farm.refresh(); FarmWorld.refresh(s);
    });
    await page.waitForFunction(() => document.querySelector("[data-r63a-main-story]")?.dataset.quest === "c1_first_harvest");
    const before = await page.evaluate(() => {
      document.querySelectorAll(".r81c-later-toggle[aria-expanded=false]").forEach(b => b.click());
      const body = document.querySelector(".side-body");
      body.scrollTop = 37;
      const card = document.querySelector("[data-r63a-main-story]");
      window.__r69Card = card;
      return { text:card.querySelector(".r68a-card-now small").textContent, scroll:body.scrollTop };
    });
    assert.equal(before.scroll, 37);
    await page.evaluate(() => {
      const s = __farm.state(), now = Date.now();
      s.plots[0].plantedAt = now-120000; s.plots[0].wateredAt = now-120000;
      FarmWorld.refresh(s);
    });
    const after = await page.evaluate(() => {
      const card = document.querySelector("[data-r63a-main-story]");
      return { same:card === window.__r69Card, text:card.querySelector(".r68a-card-now small").textContent,
        step:FarmWorld.currentStep(), scroll:document.querySelector(".side-body").scrollTop };
    });
    assert.equal(after.same, true, "手札更新時保留同一張卡");
    assert.notEqual(after.text, before.text, "小麥成熟後更新手札文字");
    assert.equal(after.step.action, "harvest");
    assert.equal(after.text, after.step.text);
    assert.equal(after.scroll, before.scroll, "手札更新時保留捲動位置");
    console.log("VERIFIED content R69A festival focus and journal sync");
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
