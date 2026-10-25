import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const appVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: { success: true, data: route.request().method() === "GET" ? null : undefined } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme: "dark" });
  await page.addInitScript((version) => {
    localStorage.removeItem("marinara-active-chat-id");
    localStorage.setItem("marinara:whats-new:seen-version", version);
  }, appVersion);
  await page.setViewportSize({ width: 874, height: 402 });
});

test("iPhone camera gutter follows rotation without mirroring", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Phone layout proof.");
  await page.addInitScript((userAgent) => {
    Object.defineProperty(navigator, "userAgent", { get: () => userAgent });
    // Prefer the iPhone's longstanding angle: older Safari inverted the newer API's angle.
    (window as any).cameraAngles = { legacy: 90, modern: 270 };
    // Keep WebKit's DOM wrapper alive so its mocked angle survives garbage collection.
    (window as any).cameraOrientation = screen.orientation;
    Object.defineProperty(window, "orientation", {
      configurable: true,
      get: () => (window as any).cameraAngles.legacy,
    });
    Object.defineProperty((window as any).cameraOrientation, "angle", {
      configurable: true,
      get: () => (window as any).cameraAngles.modern,
    });
  }, iphone);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?" })).toBeVisible();
  // WebKit's browser emulation cannot override env(). A :root rule stands in for both system
  // insets while letting the more specific camera-side rule select the effective one.
  const insets = await page.addStyleTag({
    content: ":root { --mari-safe-area-inset-left: 59px; --mari-safe-area-inset-right: 59px; }",
  });
  const shell = page.locator(".mari-app");
  const expectGutter = async (left: number, right: number) => {
    await expect.poll(async () => (await shell.boundingBox())!.x).toBeCloseTo(left, 0);
    await expect.poll(async () => (await shell.boundingBox())!.width).toBeCloseTo(874 - left - right, 0);
    for (const surface of [page.locator('[data-component="TopBar"]'), page.locator(".mari-home-browser-chrome")]) {
      const bounds = (await surface.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(left - 1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(874 - right + 1);
    }
    const safe = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return ["left", "right"].map((side) => parseFloat(style.getPropertyValue(`--mari-safe-area-inset-${side}`)));
    });
    await expect(page.locator('[data-component="TopBar"] .mari-topbar-action:visible').first()).toBeVisible();
    for (const button of await page.locator('[data-component="TopBar"] .mari-topbar-action:visible').all()) {
      const bounds = (await button.boundingBox())!;
      expect(bounds.x, "TopBar buttons still clear the rounded left corner").toBeGreaterThanOrEqual(safe[0]! - 1);
      expect(bounds.x + bounds.width, "TopBar buttons still clear the rounded right corner").toBeLessThanOrEqual(
        874 - safe[1]! + 1,
      );
    }
    expect(
      await page.evaluate(() => [20, 854].map((x) => Boolean(document.elementFromPoint(x, 200)?.closest(".mari-app")))),
    ).toEqual([left === 0, right === 0]);
  };
  const rotate = async (legacy: number | undefined, modern: number | undefined) => {
    await page.evaluate(
      ({ legacy, modern }) => {
        (window as any).cameraAngles = { legacy, modern };
        if (legacy !== undefined) window.dispatchEvent(new Event("orientationchange"));
        screen.orientation.dispatchEvent(new Event("change"));
      },
      { legacy, modern },
    );
  };
  await expectGutter(59, 0);
  await testInfo.attach("camera-left.png", {
    body: await page.screenshot({ path: testInfo.outputPath("camera-left.png"), animations: "disabled" }),
    contentType: "image/png",
  });
  await rotate(-90, 90);
  await expectGutter(0, 59);
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().setTheme("light");
    useUIStore.getState().setSidebarOpen(true);
  });
  const sidebar = page.locator('[data-component="ChatSidebarPanel"]');
  await expect(sidebar).toBeVisible();
  await expect.poll(async () => (await sidebar.boundingBox())!.x).toBeCloseTo(0, 0);
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeCloseTo(815, 0);
  await testInfo.attach("camera-right-light-sidebar.png", {
    body: await page.screenshot({
      path: testInfo.outputPath("camera-right-light-sidebar.png"),
      animations: "disabled",
    }),
    contentType: "image/png",
  });
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().setSidebarOpen(false);
  });
  await expect(sidebar).toHaveCount(0);
  await rotate(270, 270);
  await expectGutter(0, 59);
  await rotate(undefined, 90);
  await expectGutter(59, 0);
  await rotate(undefined, 270);
  await expectGutter(0, 59);
  // Missing orientation information must preserve system protection rather than guess a side.
  await rotate(undefined, undefined);
  await expectGutter(59, 59);
  await rotate(0, 0);
  await expectGutter(59, 59);
  await insets.evaluate((element) => element.parentNode?.removeChild(element));
  await page.setViewportSize({ width: 402, height: 874 });
  await expect.poll(async () => (await shell.boundingBox())!.width).toBe(402);
  await page.setViewportSize({ width: 874, height: 402 });
  await rotate(90, 90);
  await expectGutter(0, 0);
});

for (const userAgent of [
  "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36",
  "Mozilla/5.0 (iPad) AppleWebKit/605.1.15",
]) {
  test(`other devices keep their system side insets: ${userAgent.includes("Android") ? "Android" : "iPad"}`, async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Touch layout proof.");
    await page.addInitScript((userAgent) => {
      Object.defineProperty(navigator, "userAgent", { get: () => userAgent });
      Object.defineProperty(window, "orientation", { get: () => 90 });
    }, userAgent);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What shall we cook tonight?" })).toBeVisible();
    await page.addStyleTag({
      content: ":root { --mari-safe-area-inset-left: 31px; --mari-safe-area-inset-right: 17px; }",
    });
    await expect.poll(async () => (await page.locator(".mari-app").boundingBox())!.x).toBeCloseTo(31, 0);
    await expect.poll(async () => (await page.locator(".mari-app").boundingBox())!.width).toBeCloseTo(826, 0);
  });
}
