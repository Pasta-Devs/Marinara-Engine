import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/**
 * R8: a mouse pull on the desktop top bar must not drag a text selection across the page, and the block
 * must end with the drag: bar buttons still click, chat text still selects afterwards.
 */

const selection = (page: Page) => page.evaluate(() => window.getSelection()?.toString() ?? "");
const blocked = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("mari-pull-no-select"));

/** A point on the bar's own surface, not on one of its controls (a mouse pull starts only there). */
async function emptyBarPoint(page: Page) {
  const point = await page.evaluate(() => {
    const bar = document.querySelector('[data-component="TopBar"]')!.getBoundingClientRect();
    const y = bar.top + bar.height / 2;
    // The left half opens Search (the right half opens Mari).
    for (let x = bar.left + bar.width * 0.3; x < bar.right - 4; x += 8) {
      const hit = document.elementFromPoint(x, y);
      if (hit && !hit.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="tab"]'))
        return { x, y };
    }
    return null;
  });
  expect(point, "an empty spot on the top bar").not.toBeNull();
  return point!;
}

async function dragBar(page: Page, distance: number) {
  // The previous pull has finished landing or snapping back.
  await expect(page.locator(".mari-pull-overlay")).toHaveCount(0);
  const start = await emptyBarPoint(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(start.x, start.y + (distance * step) / 10);
  }
  // Recognized as a pull: the page is not selected while the mouse still holds it.
  await expect.poll(() => blocked(page)).toBe(true);
  expect(await selection(page)).toBe("");
  // Held still before the release, so a short pull is not a flick.
  await page.waitForTimeout(150);
  await page.mouse.up();
  expect(await selection(page)).toBe("");
  await expect.poll(() => blocked(page)).toBe(false);
}

test("a mouse pull on the top bar selects no text, and the block ends with the drag", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The mouse pull is a desktop gesture.");

  const transcript = [
    JSON.stringify({ user_name: "You", character_name: "Guide", chat_metadata: {} }),
    ...Array.from({ length: 6 }, (_, index) =>
      JSON.stringify({
        name: index % 2 ? "Guide" : "You",
        is_user: index % 2 === 0,
        mes: `Selectable transcript line ${index + 1} with enough words to drag across.`,
      }),
    ),
  ].join("\n");
  const response = await request.post("/api/import/st-chat", {
    multipart: {
      file: { name: "pull-select.jsonl", mimeType: "application/jsonl", buffer: Buffer.from(transcript) },
      mode: "conversation",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { chatId } = (await response.json()) as { chatId: string };
  try {
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
      { id: chatId, version },
    );
    await page.goto("/");
    const line = page.getByText("Selectable transcript line 3 with enough words to drag across.");
    await expect(line).toBeVisible();

    // A partial pull that is let go (cancelled), then a full one that opens the omnibar.
    await dragBar(page, 200);
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    await expect(page.locator(".mari-pull-overlay")).toHaveCount(0);
    await expect(omnibar).toBeHidden();
    await dragBar(page, 340);
    await expect(omnibar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(omnibar).toBeHidden();

    // Text in a chat message still selects after the pulls.
    const box = (await line.boundingBox())!;
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await selection(page)).toContain("Selectable transcript line 3");

    // A bar button still does its job.
    await page.locator('[data-topbar-hover-key="home"]').click();
    await expect(line).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`);
  }
});
