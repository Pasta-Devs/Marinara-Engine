#!/usr/bin/env node
// Idle animation guard (phone heat/battery). Opens Home, Professor Mari and a character editor on a phone and a
// tablet against a running server, waits for them to settle, and fails when an endless animation keeps running on
// something nobody can see (covered by another screen, or scrolled off). Those loops kept a phone CPU core 40-67%
// busy while idle before the Nov 2026 fix.
//
// Usage: node scripts/perf/idle-animation-guard.mjs [baseUrl=http://localhost:7860] [--classic]
// Needs at least one character on the server. Settings are server-synced, so point it at a test data dir.
import { chromium, devices } from "@playwright/test";

const args = process.argv.slice(2);
const baseUrl = (args.find((arg) => !arg.startsWith("--")) ?? "http://localhost:7860").replace(/\/$/, "");
const overhaul = !args.includes("--classic");
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
};

const click = async (page, selector, settleMs = 1200) => {
  await page
    .locator(selector)
    .first()
    .evaluate((element) => element.click());
  await page.waitForTimeout(settleMs);
};

const SCREENS = {
  home: async () => {},
  "professor-mari": async (page) => click(page, 'button:visible:has-text("Ask Professor Mari")', 1500),
  "character-editor": async (page, character) => {
    if (overhaul) {
      await click(page, '[aria-label="Library"]:visible', 800);
      await click(page, 'button:visible:has-text("Characters")', 1500);
    } else {
      await page
        .locator('[aria-label="More"]:visible')
        .first()
        .evaluate((element) => element.click())
        .catch(() => {});
      await page.waitForTimeout(800);
      await click(page, 'button:visible:has-text("Characters")', 1500);
    }
    await click(page, `text=${character} >> visible=true`, 2000);
  },
};

/** Running endless animations whose element is not on top at its own centre (covered, hidden or off screen). */
function hiddenLoops() {
  const out = [];
  for (const animation of document.getAnimations()) {
    if (animation.playState !== "running") continue;
    if (animation.effect?.getTiming().iterations !== Infinity) continue;
    const element = animation.effect.target;
    if (!(element instanceof Element)) continue;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const onScreen = rect.width > 0 && rect.height > 0 && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
    const hit = onScreen ? document.elementFromPoint(x, y) : null;
    // pointer-events: none decorations (a blink frame over its idle frame) never win a hit test, so a hit on the
    // element's own parent also counts as visible.
    const visible = hit && (element.contains(hit) || (element.parentElement ?? element).contains(hit));
    if (!visible) {
      const name = animation.animationName ?? animation.constructor.name;
      const cls =
        typeof element.className === "string" ? element.className.split(" ").slice(0, 3).join(".") : element.tagName;
      out.push(`${name} on .${cls}${animation.effect.pseudoElement ?? ""}${onScreen ? " (covered)" : " (off screen)"}`);
    }
  }
  return [...new Set(out)];
}

const characters = await fetch(`${baseUrl}/api/characters`).then((response) => response.json());
const nameOf = (item) => {
  const data = typeof item?.data === "string" ? JSON.parse(item.data) : item?.data;
  return data?.name ?? item?.name;
};
const character = (Array.isArray(characters) ? characters : (characters.items ?? [])).map(nameOf).find(Boolean);
if (!character) {
  console.error("No character on the server; create one first.");
  process.exit(2);
}

const browser = await chromium.launch();
let failures = 0;
for (const [deviceName, device] of Object.entries(DEVICES)) {
  for (const [screen, open] of Object.entries(SCREENS)) {
    const context = await browser.newContext(device);
    await context.addInitScript((enabled) => {
      localStorage.setItem("marinara-overhaul-layout", JSON.stringify({ state: { enabled }, version: 3 }));
    }, overhaul);
    const page = await context.newPage();
    try {
      await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      const skip = page.getByText("Skip Tutorial");
      if (await skip.count()) await skip.first().click();
      for (let i = 0; i < 3 && (await page.locator("[role=dialog]:visible").count()); i++) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
      }
      await page
        .locator('[aria-label="Close toast"]')
        .first()
        .evaluate((element) => element.click())
        .catch(() => {});
      await page
        .locator('[aria-label="Hide chat list"]:visible, [aria-label="Close chats"]:visible')
        .first()
        .evaluate((element) => element.click())
        .catch(() => {});
      await page.waitForTimeout(800);
      await open(page, character);
      await page.waitForTimeout(1500);
      const loops = await page.evaluate(hiddenLoops);
      if (loops.length) {
        failures++;
        console.log(`FAIL ${deviceName} ${screen}:\n  ${loops.join("\n  ")}`);
      } else console.log(`ok   ${deviceName} ${screen}`);
    } catch (error) {
      failures++;
      console.log(`FAIL ${deviceName} ${screen}: could not open (${String(error.message).split("\n")[0]})`);
    }
    await context.close();
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
