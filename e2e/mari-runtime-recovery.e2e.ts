import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

for (const width of [390, 768, 1440]) {
  test(`Pi recovery offers Classic after three errors and a way back at ${width}px`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium" && width !== 390,
      "Touch browsers cover the phone width; desktop Chromium also covers tablet and desktop.",
    );
    test.setTimeout(120_000);
    await acquireMariThreadLock();
    const provider = createServer((_req, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Fixture provider unavailable" } }));
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture port");
    let connectionId: string | undefined;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const response = await request.post("/api/connections", {
        data: {
          name: `Pi recovery ${width}`,
          provider: "custom",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          apiKey: "fixture",
          model: "fixture",
          enabled: true,
        },
      });
      expect(response.ok()).toBe(true);
      connectionId = ((await response.json()) as { id: string }).id;
      await request.put("/api/professor-mari/workspace/runtime", { data: { runtime: "pi" } });
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.setViewportSize({ width, height: 900 });
      // Her connection is a server setting now.
      await page.route("**/api/app-settings/feature-model-connections", (route) =>
        route.fulfill({
          json: {
            mariConnectionId: connectionId,
            omnibarAsideConnectionId: null,
            impersonateConnectionId: null,
            visionConnectionId: null,
          },
        }),
      );
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        theme: "dark",
      });
      await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
      await page.goto("/");
      await page.getByRole("button", { name: "Home", exact: true }).first().click();
      await page.getByRole("button", { name: "Ask Professor Mari", exact: true }).click();
      const window = page.locator('[data-component="GlobalOmnibar.Mari"]');
      const composer = window.getByPlaceholder("Ask Professor Mari to check or change something");
      const classic = window.getByRole("button", { name: "Switch to Classic", exact: true });
      for (let n = 1; n <= 3; n++) {
        await composer.fill(`Hello ${n}`);
        await composer.press("Control+Enter");
        await expect
          .poll(async () => {
            const status = await (await request.get("/api/professor-mari/workspace/status")).json();
            return status.piConsecutiveFailures;
          })
          .toBe(n);
        if (n < 3) await expect(classic).toBeHidden();
      }
      await expect(classic).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath(`pi-third-error-${width}.png`), fullPage: true });
      if (width === 1440) {
        for (const visualTheme of ["default", "sillytavern"]) {
          for (const theme of ["light", "dark"]) {
            await page.evaluate(
              async ({ theme, visualTheme }) => {
                const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
                useUIStore.getState().setTheme(theme);
                useUIStore.getState().setVisualTheme(visualTheme);
              },
              { theme, visualTheme },
            );
            await page.screenshot({ path: testInfo.outputPath(`pi-third-error-${visualTheme}-${theme}.png`) });
          }
        }
      }
      const before = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as { id: string }[];
      await classic.click();
      const tryPi = window.getByRole("button", { name: "Try Pi again", exact: true });
      await expect(tryPi).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath(`classic-${width}.png`), fullPage: true });
      expect(await (await request.get("/api/professor-mari/workspace/runtime")).json()).toEqual({ runtime: "classic" });
      expect(await (await request.get("/api/chats/internal/professor-mari/chats")).json()).toEqual(before);
      await tryPi.click();
      await expect(tryPi).toBeHidden();
      expect(await (await request.get("/api/professor-mari/workspace/runtime")).json()).toEqual({ runtime: "pi" });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await Promise.allSettled([
        connectionId ? request.delete(`/api/connections/${connectionId}`) : Promise.resolve(),
        request.put("/api/professor-mari/workspace/runtime", { data: { runtime: "pi" } }),
        new Promise<void>((resolve) => provider.close(() => resolve())),
      ]);
      releaseMariThreadLock();
    }
  });
}
