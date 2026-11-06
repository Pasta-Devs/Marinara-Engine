import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function installVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const state = { height: 0, offsetTop: 0 };
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => state.height || innerHeight },
      offsetTop: { get: () => state.offsetTop },
      pageTop: { get: () => state.offsetTop },
      scale: { get: () => 1 },
      width: { get: () => innerWidth },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.assign(window, {
      __setMariViewport(height: number, offsetTop: number) {
        state.height = height;
        state.offsetTop = offsetTop;
        viewport.dispatchEvent(new Event("resize"));
        viewport.dispatchEvent(new Event("scroll"));
      },
    });
  });
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-component="GlobalOmnibar.Panel"]')!;
    const box = panel.getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const styles = getComputedStyle(panel);
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      availableHeight: Number.parseFloat(root.getPropertyValue("--mari-visual-viewport-height")) || innerHeight,
      offsetTop: Number.parseFloat(root.getPropertyValue("--mari-visual-viewport-offset-top")) || 0,
      leftInset: Number.parseFloat(root.getPropertyValue("--mari-shell-inset-left")) || 0,
      rightInset: Number.parseFloat(root.getPropertyValue("--mari-shell-inset-right")) || 0,
      radius: styles.borderTopLeftRadius,
      coarse: matchMedia("(any-pointer: coarse)").matches,
      hover: matchMedia("(hover: hover)").matches,
    };
  });
}

async function expectAvailableScreen(page: Page) {
  await expect
    .poll(async () => {
      const box = await geometry(page);
      return Math.max(
        Math.abs(box.x - box.leftInset),
        Math.abs(box.y - box.offsetTop),
        Math.abs(box.width - (box.viewportWidth - box.leftInset - box.rightInset)),
        Math.abs(box.height - box.availableHeight),
      );
    })
    .toBeLessThanOrEqual(1);
}

test.beforeEach(acquireMariThreadLock);
test.afterEach(releaseMariThreadLock);

for (const theme of ["dark", "light"] as const) {
  test(`Professor Mari fills the mobile viewport in both orientations (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(90_000);
    const mobile = testInfo.project.name.includes("mobile");
    await isolateSyncedUISettings(page);
    await installVisualViewport(page);
    await seedUIState(page, {
      theme,
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
    });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    const created = await request.post("/api/connections", {
      data: { name: "Mari mobile geometry", provider: "custom", model: "fixture", baseUrl: "http://127.0.0.1:9/v1" },
    });
    expect(created.ok()).toBeTruthy();
    const connection = await created.json();
    try {
      await request.get(`/api/chats/internal/professor-mari?connectionId=${connection.id}`);
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
      await page.goto("/");
      await page.getByRole("button", { name: "Ask Professor Mari", exact: true }).click();
      const pane = page.locator('[data-component="GlobalOmnibar.Mari"]:not([aria-hidden="true"])');
      const composer = pane.locator("textarea:visible");
      await expect(composer).toBeVisible();
      if (mobile) {
        await expectAvailableScreen(page);
        await page.setViewportSize({ width: 844, height: 390 });
        await page.locator('[data-component="GlobalOmnibar"]').evaluate(async (overlay) => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const panel = overlay.querySelector('[data-component="GlobalOmnibar.Panel"]')!;
          await Promise.all(
            [overlay, panel].flatMap((element) => element.getAnimations()).map((animation) => animation.finished),
          );
        });
        const geometryPath = testInfo.outputPath(`mari-${theme}-landscape-geometry.json`);
        writeFileSync(geometryPath, JSON.stringify(await geometry(page), null, 2));
        await testInfo.attach(`mari-${theme}-landscape-geometry`, {
          path: geometryPath,
          contentType: "application/json",
        });
        const landscapePath = testInfo.outputPath(`mari-${theme}-landscape.png`);
        await page.screenshot({ path: landscapePath, animations: "disabled" });
        await testInfo.attach(`mari-${theme}-landscape`, {
          path: landscapePath,
          contentType: "image/png",
        });
        await expectAvailableScreen(page);
        await expect(page.locator('[data-component="GlobalOmnibar.Panel"]')).toHaveCSS("border-top-left-radius", "0px");

        // The older landscape repair must keep the scrollport clear of the composer.
        await expect
          .poll(() =>
            pane.evaluate((element) => {
              const transcript = element.querySelector('[data-component="HomeProfessorMariChat.Transcript"]')!;
              const dock = element.querySelector(".mari-workspace-composer-dock")!;
              return transcript.getBoundingClientRect().bottom - dock.getBoundingClientRect().top;
            }),
          )
          .toBeLessThanOrEqual(1);
        const quickOption = pane.locator(".mari-suggestion-chips button").last();
        await quickOption.scrollIntoViewIfNeeded();
        await expect(quickOption).toBeInViewport();
        await quickOption.click({ trial: true });

        await page.evaluate(() => {
          document.documentElement.style.setProperty("--mari-safe-area-inset-left", "24px", "important");
          document.documentElement.style.setProperty("--mari-safe-area-inset-right", "12px", "important");
          document.documentElement.style.setProperty("--mari-safe-area-inset-bottom", "20px", "important");
        });
        await expectAvailableScreen(page);
        await expect
          .poll(() =>
            pane
              .locator(".mari-workspace-composer-dock")
              .evaluate((dock) => parseFloat(getComputedStyle(dock).paddingBottom)),
          )
          .toBeGreaterThanOrEqual(20);
        await composer.focus();
        await page.evaluate(() => {
          (window as typeof window & { __setMariViewport: (height: number, offset: number) => void }).__setMariViewport(
            260,
            24,
          );
        });
        await expectAvailableScreen(page);
        await expect
          .poll(() => composer.evaluate((field) => field.getBoundingClientRect().bottom))
          .toBeLessThanOrEqual(284);
        await composer.fill("The mobile composer stays reachable.");
        await expect(composer).toBeFocused();
        await expect(composer).toHaveValue("The mobile composer stays reachable.");
        await page.evaluate(() => {
          (window as typeof window & { __setMariViewport: (height: number, offset: number) => void }).__setMariViewport(
            390,
            0,
          );
        });
        await composer.blur();
        await expectAvailableScreen(page);
      } else {
        for (const viewport of [
          { width: 1440, height: 900 },
          { width: 844, height: 390 },
        ]) {
          await page.setViewportSize(viewport);
          await expect.poll(async () => (await geometry(page)).y).toBeGreaterThan(0);
          await expect.poll(async () => (await geometry(page)).height).toBeLessThan(viewport.height);
          const box = await geometry(page);
          expect(box.coarse).toBe(false);
          expect(box.x).toBeGreaterThan(0);
          expect(box.height).toBeLessThan(viewport.height);
          expect(box.width).toBeLessThan(viewport.width);
          expect(box.radius).not.toBe("0px");
        }
      }
      const panel = page.locator('[data-component="GlobalOmnibar.Panel"]');
      const settings = panel.getByRole("button", { name: "Search and Professor Mari settings", exact: true });
      await expect(settings).toBeInViewport();
      await settings.click();
      const sizeGroup = panel.getByRole("region", { name: "Professor Mari window", exact: true, includeHidden: true });
      if (mobile) await expect(sizeGroup).toBeHidden();
      else await expect(sizeGroup).toBeVisible();
      await page.keyboard.press("Escape");
      if (mobile) {
        await expect(composer).toBeVisible();
        await page.evaluate(() => {
          for (const side of ["left", "right", "bottom"])
            document.documentElement.style.removeProperty(`--mari-safe-area-inset-${side}`);
          (window as typeof window & { __setMariViewport: (height: number, offset: number) => void }).__setMariViewport(
            0,
            0,
          );
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await expectAvailableScreen(page);
        const portraitPath = testInfo.outputPath(`mari-${theme}-portrait.png`);
        await page.screenshot({ path: portraitPath, animations: "disabled" });
        await testInfo.attach(`mari-${theme}-portrait`, {
          path: portraitPath,
          contentType: "image/png",
        });
      }
    } finally {
      const threads = await (await request.get("/api/chats/internal/professor-mari/chats")).json();
      for (const thread of threads) {
        if (thread.connectionId === connection.id) await request.delete(`/api/chats/${thread.id}`);
      }
      await request.delete(`/api/connections/${connection.id}`);
    }
  });
}
