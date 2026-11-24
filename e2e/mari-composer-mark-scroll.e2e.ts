import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

test.beforeEach(async () => {
  await acquireMariThreadLock();
});

test.afterEach(() => {
  releaseMariThreadLock();
});

/** Where a composer mark is painted once every clipping box above it has cut it, and whether that is inside the field. */
function paintedMark(page: Page, tone: "reference" | "pending") {
  return page.evaluate((markTone) => {
    const pane = document.querySelector('[data-component="GlobalOmnibar.Mari"]:not([aria-hidden="true"])');
    const mark = pane?.querySelector(`.mari-composer-mark--${markTone}`);
    const field = pane?.querySelector("textarea.mari-workspace-composer__input");
    if (!pane || !mark || !field) return null;
    let { top, right, bottom, left } = mark.getBoundingClientRect();
    // Up to her pane only: the body clips nothing here (its overflow is the viewport's).
    for (let box = mark.parentElement; box && pane.contains(box); box = box.parentElement) {
      const style = getComputedStyle(box);
      const clip = box.getBoundingClientRect();
      // `overflow-x: clip` leaves the other axis visible, so each axis is cut on its own.
      if (style.overflowX !== "visible") {
        left = Math.max(left, clip.left);
        right = Math.min(right, clip.right);
      }
      if (style.overflowY !== "visible") {
        top = Math.max(top, clip.top);
        bottom = Math.min(bottom, clip.bottom);
      }
    }
    if (bottom <= top || right <= left) return { painted: false, insideField: true };
    const shown = field.getBoundingClientRect();
    return {
      painted: true,
      insideField: top >= shown.top - 0.5 && bottom <= shown.bottom + 0.5,
    };
  }, tone);
}

/**
 * #9763: "the color that wraps around the tag is still there even after I've written enough for it to be
 * scrolled up". The layer that paints the marks moved with the field's scroll together with its own clipping box,
 * so it showed the lines above the field and cut off the lines inside it. A reference scrolled out of view must
 * paint nothing, and a mark on the last line must still paint, inside the field.
 */
test("Mari's composer marks scroll with their text and stay inside the field", async ({ page, request }) => {
  const suffix = Date.now().toString(36);
  const name = `Scrollmark${suffix}`;
  let connectionId = "";
  let characterId = "";
  try {
    const connection = await request.post("/api/connections", {
      data: {
        name: `Composer marks fixture ${suffix}`,
        provider: "custom",
        baseUrl: "http://127.0.0.1:9/v1",
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;
    const character = await request.post("/api/characters", { data: { data: { name } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    characterId = ((await character.json()) as { id: string }).id;

    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
    });
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+j");
    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]:not([aria-hidden="true"])');
    const composer = mariPane.locator("textarea:visible");
    await expect(composer).toBeVisible();

    // Link the character on the first line.
    await composer.focus();
    // The whole name, so this character is the top row even beside one left by an earlier run.
    await page.keyboard.insertText(`@${name}`);
    await expect(mariPane.locator('[data-component="MariReferencePicker"] [role="option"]').first()).toContainText(
      name,
    );
    await page.keyboard.press("Enter");
    await expect(mariPane.locator(".mari-composer-mark--reference")).toHaveCount(1);

    // Enough lines to scroll it out of view, then an `@` still being typed on the last line.
    await page.keyboard.insertText(`${"line\n".repeat(16)}@Scrollmark`);
    await composer.evaluate((field) => {
      field.scrollTop = field.scrollHeight;
    });
    await expect
      .poll(() => composer.evaluate((field) => field.scrollTop), { message: "the field scrolls" })
      .toBeGreaterThan(100);

    await expect
      .poll(() => paintedMark(page, "reference"), { message: "the scrolled-out reference" })
      .toEqual({
        painted: false,
        insideField: true,
      });
    await expect
      .poll(() => paintedMark(page, "pending"), { message: "the mark on the last line" })
      .toEqual({
        painted: true,
        insideField: true,
      });
  } finally {
    // Opening her pane may have started a thread of its own.
    const threads = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
      id: string;
    }>;
    for (const thread of threads)
      await request.delete(`/api/chats/internal/professor-mari/chats/${thread.id}`).catch(() => undefined);
    if (characterId) await request.delete(`/api/characters/${characterId}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
  }
});
