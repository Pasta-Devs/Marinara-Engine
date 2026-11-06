import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const width of [390, 768, 1440]) {
  test.describe(`help keyboard at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("chat help keeps typed text in the composer and preserves keyboard controls", async ({
      page,
      request,
    }, info) => {
      const response = await request.post("/api/chats", {
        data: { name: "Help keyboard proof", mode: "conversation", characterIds: [] },
      });
      expect(response.ok()).toBeTruthy();
      const { id } = await response.json();
      try {
        await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
        await seedUIState(page, {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
        });
        await page.addInitScript(
          ({ id, version }) => {
            localStorage.setItem("marinara-active-chat-id", id);
            localStorage.setItem("marinara:whats-new:seen-version", version);
          },
          { id, version },
        );
        await page.goto("/");
        const composer = page.locator('[data-chat-mode="conversation"] [data-chat-composer]');
        await expect(composer).toBeVisible({ timeout: 30_000 });
        const overlay = page.locator('[data-chat-help-overlay="conversation"]');
        const opener = page.locator('[data-tour="sidebar-toggle"]:visible').first();
        const openHelp = async () => {
          // A distinct opener exposes cleanup incorrectly restoring focus after a typed dismissal.
          await opener.focus();
          await page.evaluate(() =>
            window.dispatchEvent(
              new CustomEvent("mari-chat-help-open-request", {
                detail: { mode: "conversation" },
              }),
            ),
          );
          await expect(overlay).toBeFocused();
        };
        await openHelp();
        await page.keyboard.press("Escape");
        await expect(overlay).toHaveCount(0);
        await expect(opener).toBeFocused();
        await openHelp();
        await page.keyboard.type("hello");
        await expect(overlay).toHaveCount(0);
        await expect(composer).toBeFocused();
        await expect(composer).toHaveValue("hello");

        await openHelp();
        const highlight = overlay.locator('[data-chat-help-highlight="composer"]');
        await highlight.focus();
        await page.keyboard.press("x");
        await expect(overlay).toBeVisible();
        await expect(highlight).toBeFocused();
        await page.keyboard.press("Space");
        await expect(overlay).toBeVisible();
        if (width < 768) {
          await expect(overlay.locator('[data-chat-help-mobile-detail="composer"]')).toBeVisible();
        }
        await mkdir(".tmp/pr8456-help", { recursive: true });
        await page.screenshot({
          path: `.tmp/pr8456-help/help-${width}-${info.project.name}.png`,
          animations: "disabled",
        });
        const hide = overlay.getByRole("button", { name: "Hide Help button permanently" });
        await hide.focus();
        await page.keyboard.press("Space");
        await expect(overlay).toHaveCount(0);
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("mari-chat-help-open-request", {
              detail: { mode: "conversation" },
            }),
          ),
        );
        await expect(overlay).toHaveCount(0);
      } finally {
        await request.delete(`/api/chats/${id}`);
      }
    });
  });
}
