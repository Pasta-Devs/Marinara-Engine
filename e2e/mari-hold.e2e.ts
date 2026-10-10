import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    localStorage.setItem(
      "marinara:home:widget-visibility:v2",
      JSON.stringify(["professor", "character", "whats-new", "learn", "community", "clock", "discovery"]),
    );
  }, version);
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
});

// Slice 85: press and hold the Home Mari widget to lift her, drag her, and let her spring home.
async function holdWidgetAndDrag(page: Page) {
  const art = page.locator("[data-home-professor-art]");
  await expect(art).toBeVisible({ timeout: 30_000 });
  const box = await art.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY - 30, { steps: 6 });
  const figure = page.locator(".mari-hold-figure");
  await expect(figure).toBeVisible();
  await expect(figure.locator(".mari-hold-figure__line")).toHaveText("W-What are you doing? Put me down! (>_<)");
  await expect(art).toHaveCSS("opacity", "0");
  return { figure, art, startX, startY };
}

test("pressing and dragging the Home Mari widget lifts her, then she springs back to her slot", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const { figure, art, startX, startY } = await holdWidgetAndDrag(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath(`mari-hold-held-${testInfo.project.name}.png`) });
  await page.mouse.up();
  await expect(figure).toBeHidden({ timeout: 3_000 });
  await expect(art).toHaveCSS("opacity", "1");
  const back = await art.boundingBox();
  expect(back).not.toBeNull();
  expect(Math.abs(back!.x + back!.width / 2 - startX)).toBeLessThan(40);
  expect(Math.abs(back!.y + back!.height / 2 - startY)).toBeLessThan(260);
});

test("a tap on the Home Mari widget keeps the normal action and never lifts her", async ({ page }) => {
  await page.goto("/");
  const art = page.locator("[data-home-professor-art]");
  await expect(art).toBeVisible({ timeout: 30_000 });
  await art.click();
  await expect(page.locator(".mari-hold-figure")).toHaveCount(0);
});

test("a tap on the omnibar door opens Mari and never lifts her", async ({ page, isMobile }) => {
  // The address row is desktop-only; a phone opens Search from the top bar.
  test.skip(isMobile, "desktop address row opens the omnibar");
  await page.goto("/");
  await page.locator('[data-component="HomeBrowserHub.Address"]').click();
  const door = page.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]');
  await expect(door).toBeVisible({ timeout: 30_000 });
  await door.click();
  await expect(page.locator(".mari-hold-figure")).toHaveCount(0);
});

test("with reduced motion a hold only bounces her in place and shows her line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const art = page.locator("[data-home-professor-art]");
  await expect(art).toBeVisible({ timeout: 30_000 });
  const box = (await art.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 30, { steps: 6 });
  await expect(page.locator(".mari-hold-figure__line")).toHaveText("W-What are you doing? Put me down! (>_<)");
  await expect(page.locator(".mari-hold-figure__sprite")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toBeHidden();
});

test("after a drag that ends away from her head, Enter on the door still opens Mari", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop address row opens the omnibar");
  await page.goto("/");
  await page.locator('[data-component="HomeBrowserHub.Address"]').click();
  const door = page.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]');
  await expect(door).toBeVisible({ timeout: 30_000 });
  const box = (await door.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(120, 600, { steps: 10 });
  await expect(page.locator(".mari-hold-figure")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".mari-hold-figure")).toBeHidden({ timeout: 3_000 });
  await door.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toBeVisible();
});

// Slice 85 full spin: circling the pointer while holding her swings her over the top; still, she settles.
async function figureAngle(figure: ReturnType<Page["locator"]>) {
  return figure.evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.atan2(matrix.b, matrix.a);
  });
}

test("circling the pointer while holding her turns her upside down, and she settles when still", async ({ page }) => {
  await page.goto("/");
  const { figure, startX, startY } = await holdWidgetAndDrag(page);
  // Circle in the middle of the screen: a 390 px phone has no room for a circle around her corner, and a
  // pointer past the edge would hold her against the wall.
  const radius = 160;
  const centreX = (page.viewportSize()?.width ?? 1440) / 2;
  const centreY = startY;
  let peak = 0;
  const started = Date.now();
  while (Date.now() - started < 3_000) {
    const turn = ((Date.now() - started) / 1_000) * 1.5 * 2 * Math.PI;
    await page.mouse.move(centreX + radius * Math.cos(turn), centreY + radius * Math.sin(turn));
    peak = Math.max(peak, Math.abs(await figureAngle(figure)));
  }
  expect(peak, "circular drag takes her past upside down").toBeGreaterThan(Math.PI / 2);
  // Still: she swings out and hangs straight down again.
  await expect.poll(async () => Math.abs(await figureAngle(figure)), { timeout: 8_000 }).toBeLessThan(0.05);
  await page.mouse.up();
  await expect(figure).toBeHidden({ timeout: 3_000 });
});

// Slice 85 smash: the viewport edges are walls. A fast hit bonks her and she stays on screen; two
// hits in a row count as shaking her, so she gets dizzy.
test("a fast flick into the left edge bonks her, and she stays on screen", async ({ page }) => {
  await page.goto("/");
  const { figure, startY } = await holdWidgetAndDrag(page);
  await page.mouse.move(2, startY, { steps: 2 });
  await expect(figure.locator(".mari-hold-figure__line")).toHaveText("Ow! The walls are not soft.");
  const box = await figure.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  await page.mouse.up();
  await expect(figure).toBeHidden({ timeout: 3_000 });
});

// Slice 85 phone flick: the page sends touch-type pointer events on a real clock, so the hand's speed is
// exactly what `durMs` says. A CDP touch round trip is too slow to pace a flick. Returns whether she bonked
// and how far her figure went past the screen during the flick.
async function phoneFlick(page: Page, toX: number, durMs: number) {
  return page.evaluate(
    async ({ toX, durMs }) => {
      const art = document.querySelector<HTMLElement>("[data-home-professor-art]")!;
      const box = art.getBoundingClientRect();
      const startX = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const pointer = (type: string, x: number) =>
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: x,
          clientY: y,
        });
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      let bonked = false;
      let watching = true;
      let outside = 0;
      const watch = () => {
        const figure = document.querySelector<HTMLElement>(".mari-hold-figure");
        if (figure) {
          if (figure.dataset.bonk === "true") bonked = true;
          const rect = figure.getBoundingClientRect();
          outside = Math.max(outside, -rect.left, rect.right - window.innerWidth);
        }
        if (watching) requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
      art.dispatchEvent(pointer("pointerdown", startX));
      await sleep(380);
      const mid = window.innerWidth / 2;
      for (let i = 1; i <= 8; i++) {
        window.dispatchEvent(pointer("pointermove", startX + ((mid - startX) * i) / 8));
        await sleep(16);
      }
      await sleep(200);
      const steps = Math.max(2, Math.round(durMs / 16));
      for (let i = 1; i <= steps; i++) {
        window.dispatchEvent(pointer("pointermove", mid + ((toX - mid) * i) / steps));
        await sleep(durMs / steps);
      }
      await sleep(100);
      watching = false;
      window.dispatchEvent(pointer("pointerup", toX));
      return { bonked, outside };
    },
    { toX, durMs },
  );
}

test("a fast phone flick into either edge bonks her, and she stays on screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone flick: touch pointers");
  const width = (page.viewportSize() ?? { width: 390 }).width;
  for (const toX of [2, width - 2]) {
    await page.goto("/");
    await expect(page.locator("[data-home-professor-art]")).toBeVisible({ timeout: 30_000 });
    const flick = await phoneFlick(page, toX, 150);
    expect(flick.bonked, `a 150 ms flick to x=${toX} bonks her`).toBe(true);
    expect(flick.outside, "she stays on screen").toBeLessThanOrEqual(1);
  }
});

test("a slow phone push into an edge does not bonk her", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone flick: touch pointers");
  const width = (page.viewportSize() ?? { width: 390 }).width;
  for (const toX of [2, width - 2]) {
    await page.goto("/");
    await expect(page.locator("[data-home-professor-art]")).toBeVisible({ timeout: 30_000 });
    const push = await phoneFlick(page, toX, 900);
    expect(push.bonked, `a slow push to x=${toX} does not bonk her`).toBe(false);
  }
});

test("two fast hits on opposite edges make her dizzy", async ({ page }) => {
  await page.goto("/");
  const { figure, startY } = await holdWidgetAndDrag(page);
  const width = page.viewportSize()!.width;
  await page.mouse.move(2, startY, { steps: 2 });
  await page.mouse.move(width - 2, startY, { steps: 2 });
  await expect(figure).toHaveAttribute("data-dizzy", "true");
  const box = await figure.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  await page.mouse.up();
});

// Slice 85 hover: a mouse resting on Mari swaps to her hover pose with nothing moving. Touch has no hover.
test("hovering the Home Mari card swaps to her hover pose without moving her", async ({ page, isMobile }) => {
  await page.goto("/");
  const art = page.locator("[data-home-professor-art]");
  await expect(art).toBeVisible({ timeout: 30_000 });
  const hoverPose = art.locator('img[src*="portrait-hover"]');
  const before = await art.boundingBox();
  await art.hover();
  if (isMobile) {
    await expect(hoverPose).toHaveCSS("opacity", "0");
    return;
  }
  await expect(hoverPose).toHaveCSS("opacity", "1");
  expect(await art.boundingBox()).toEqual(before);
  await page.mouse.move(0, 0);
  await expect(hoverPose).toHaveCSS("opacity", "0");
});

test("hovering the omnibar door swaps to her hover pose", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop address row opens the omnibar");
  await page.goto("/");
  await page.locator('[data-component="HomeBrowserHub.Address"]').click();
  const door = page.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]');
  await expect(door).toBeVisible({ timeout: 30_000 });
  const hoverPose = door.locator('img[src*="portrait-hover"]');
  const before = await door.boundingBox();
  await door.hover();
  await expect(hoverPose).toHaveCSS("opacity", "1");
  expect(await door.boundingBox()).toEqual(before);
});

test("hovering her window sprite swaps to her hover pose", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop address row opens the omnibar");
  await page.goto("/");
  await page.locator('[data-component="HomeBrowserHub.Address"]').click();
  const door = page.locator('[data-component="GlobalOmnibar.ProfessorMariButton"]');
  await expect(door).toBeVisible({ timeout: 30_000 });
  await door.click();
  const sprite = page.locator('[data-component="GlobalOmnibar.Mari"] .mari-story-sprite').first();
  await expect(sprite).toBeVisible({ timeout: 30_000 });
  const hoverPose = sprite.locator("img.mari-story-sprite__hover");
  await expect(hoverPose).toBeHidden();
  await sprite.hover();
  await expect(hoverPose).toBeVisible();
});
