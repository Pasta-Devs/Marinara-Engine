import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

test("library portraits keep their proportions in compact and full layouts", async ({ page, request }, testInfo) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    professorMariNavigationEnabled: false,
  });
  await page.addInitScript(
    (version: string) => {
      localStorage.setItem("marinara:home:widget-visibility:v2", JSON.stringify(["character-library", "recent"]));
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
  );
  const avatarPath = "/api/avatars/file/portrait-proportions.png";
  await page.route(`**${avatarPath}`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="400" viewBox="0 0 240 400" preserveAspectRatio="none"><rect width="240" height="400" fill="#526679"/><circle cx="120" cy="100" r="70" fill="#e2b78b"/><path d="M40 400V250Q120 160 200 250V400" fill="#b5c9c4"/><path d="M0 200H240M120 0V400" stroke="#efdecc" stroke-width="2"/></svg>',
    }),
  );
  const response = await request.post("/api/characters", {
    data: {
      avatarPath,
      data: {
        name: "Portrait proportions",
        description: "A portrait with a circular face and a saved square crop.",
        extensions: { avatarCrop: { srcX: 0, srcY: 0, srcWidth: 1, srcHeight: 0.6 } },
      },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const character = (await response.json()) as { id: string };
  let chatId: string | undefined;
  try {
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Portrait rendering", mode: "roleplay", characterIds: [character.id] },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    chatId = ((await chatResponse.json()) as { id: string }).id;
    await page.goto("/");
    for (const layout of ["compact", "full"]) {
      if (layout === "full") {
        await page.locator('[data-tour="panel-characters"]').click();
        await page.getByRole("button", { name: "Open Library", exact: true }).click();
      }
      const card = page.locator(`[data-card-library-card="${character.id}"]`).filter({ visible: true }).first();
      const portrait = card.locator("img");
      await expect(portrait).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(240);
      const geometry = await portrait.evaluate((img: HTMLImageElement) => {
        const bounds = img.getBoundingClientRect();
        return {
          fit: getComputedStyle(img).objectFit,
          renderedRatio: bounds.width / bounds.height,
          sourceRatio: img.naturalWidth / img.naturalHeight,
        };
      });
      expect(
        geometry.fit !== "fill" || Math.abs(geometry.renderedRatio - geometry.sourceRatio) < 0.01,
        `${layout} portrait must use proportional fitting or an undistorted image box: ${JSON.stringify(geometry)}`,
      ).toBe(true);
      if (!testInfo.project.name.includes("mobile")) {
        const before = await portrait.boundingBox();
        await card.hover();
        await card.evaluate((element) =>
          Promise.allSettled(
            element
              .getAnimations({ subtree: true })
              .filter((animation) => animation instanceof CSSTransition)
              .map((animation) => animation.finished),
          ),
        );
        expect(await portrait.boundingBox(), "hover must not rescale or move the portrait").toEqual(before);
      }
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        if (layout === "compact") {
          const surface = page.locator('[data-home-widget-id="character-library"] > :not([data-home-drag-handle])');
          await expect(surface).toHaveCSS("filter", "none");
          await expect(surface).toHaveCSS("transform", "none");
        }
        await page.screenshot({ path: testInfo.outputPath(`${layout}-${theme}.png`), animations: "disabled" });
      }
      if (layout === "compact") {
        const recent = page.locator("[data-recent-chat-index]").filter({ hasText: "Portrait rendering" });
        await expect(recent).toBeVisible();
        await recent.scrollIntoViewIfNeeded();
        const recentPortrait = recent.locator("img");
        const before = await recentPortrait.boundingBox();
        if (!testInfo.project.name.includes("mobile")) {
          await recent.hover();
          await expect(recent).toHaveCSS("translate", "none");
          await expect(page.locator('[data-home-widget-id="recent"] > :not([data-home-drag-handle])')).toHaveCSS(
            "filter",
            "none",
          );
          expect(await recentPortrait.boundingBox()).toEqual(before);
        }
      }
    }
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    await request.delete(`/api/characters/${character.id}`);
  }
});
