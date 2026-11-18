import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * Every Library page and every page that opens beside a list (Connections, Regex scripts, Agents, Custom tools) must
 * let you reach its last row in a short window. The same bug kept coming back in new pages: a box with overflow
 * hidden (the viewer's right pane, a table's rounded frame) took the window's height while its content was taller,
 * so the end was cut off with nothing to scroll. This walks the pages and fails on any such box.
 */
async function clippedBoxes(page: Page, scope: string) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return [`${selector} is missing`];
    const found: string[] = [];
    for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
      if (!(el instanceof HTMLElement) || !el.getClientRects().length) continue;
      const style = getComputedStyle(el);
      if (style.overflowY !== "hidden" && style.overflowY !== "clip") continue;
      // Clamped text and small chips are cut on purpose.
      if (style.webkitLineClamp !== "none" || el.clientHeight < 40) continue;
      if (el.scrollHeight - el.clientHeight > 4) {
        found.push(
          `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} shows ${el.clientHeight} of ${el.scrollHeight}px`,
        );
      }
    }
    return found;
  }, scope);
}

test.describe("Library pages reach their last row", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop-chromium", "The side-by-side viewers are the desktop layout");
  });

  test("in a short window", async ({ page, request }, info) => {
    const response = await request.post("/api/connection-accounts", {
      data: {
        provider: "openai",
        name: `Reach the end ${info.project.name}`,
        apiKey: "fixture-not-a-real-key",
        baseUrl: "http://127.0.0.1:9/v1",
        model: "gpt-5.5",
      },
    });
    expect(response.ok()).toBeTruthy();
    const created = (await response.json()) as { account: { id: string }; connectionId: string };
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: true, theme: "dark" });
      await page.addInitScript((v) => {
        localStorage.setItem("marinara:whats-new:seen-version", v);
      }, version);
      // Short enough that every built-in model page and account page is taller than the pane.
      await page.setViewportSize({ width: 1280, height: 540 });
      await page.goto("/");

      // The sidebar's Chats | Library switch sits under the auto-hiding top bar, which slides over it when the
      // pointer comes near, so the switch gets the click event directly.
      await page.locator('[data-tour="library-switch"]').filter({ visible: true }).dispatchEvent("click");
      const nav = page.locator('[data-tour="library-nav"]').filter({ visible: true });
      const sections = ["Characters", "Personas", "Lorebooks", "Presets", "Regex scripts", "Agents", "Custom tools"];
      for (const section of [...sections, "Connections"]) {
        await nav.getByText(section, { exact: true }).click();
        await expect(page.locator('main.mari-main [data-mari-part="page"] h1').first()).toContainText(section);
        expect(await clippedBoxes(page, "main.mari-main"), `${section} page`).toEqual([]);
      }

      // Connections: open the viewer, then every account, model and built-in model page beside the list.
      await page.locator("main.mari-main").getByText("Built-in model (decisions)", { exact: true }).first().click();
      const rows = page.locator(".ov-vw__list [role='option'], .ov-vw__list .ov-vw__gopen");
      await expect(rows.first()).toBeVisible();
      const count = await rows.count();
      expect(count).toBeGreaterThan(5);
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const name = (await row.innerText()).split("\n")[0];
        await row.click();
        await expect(page.locator(".ov-vw__main > *").first()).toBeVisible();
        await expect.poll(() => clippedBoxes(page, ".ov-vw__main"), { message: `Connections › ${name}` }).toEqual([]);
      }
    } finally {
      // An account keeps its models until they are removed.
      await request.delete(`/api/connections/${created.connectionId}`).catch(() => undefined);
      await request.delete(`/api/connection-accounts/${created.account.id}`).catch(() => undefined);
    }
  });
});
