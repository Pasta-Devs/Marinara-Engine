// #8621: a sidebar edge that resizes says so with the system's resize cursor. Marinara's custom cursor is on by default
// and forces its own arrow onto every element, so the resize classes are carved out of it; while the edge is dragged the
// pointer leaves the 4px handle, so the whole page keeps the resize cursor until the drag ends.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const cursorOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).cursor);

/** The cursor the element under the pointer shows, as the browser would pick it. */
const cursorAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element ? getComputedStyle(element).cursor : null;
    },
    { x, y },
  );

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "the resize handles are desktop-only (hidden below md)");
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
});

for (const customCursorEnabled of [true, false]) {
  test(`sidebar edges show the resize cursor, and keep it while dragged (custom cursor ${customCursorEnabled ? "on" : "off"})`, async ({
    page,
  }) => {
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: true,
      rightPanelOpen: true,
      customCursorEnabled,
      seasonalThemesDisabled: true,
    });
    await page.goto("/");
    const root = page.locator("html");
    if (customCursorEnabled) await expect(root).toHaveAttribute("data-marinara-custom-cursor", "enabled");
    else await expect(root).not.toHaveAttribute("data-marinara-custom-cursor", /.*/);

    for (const name of ["Resize left sidebar", "Resize right sidebar"]) {
      const handle = page.getByRole("separator", { name, exact: true });
      await expect(handle).toBeVisible();
      expect(await cursorOf(handle), `${name} shows the resize cursor`).toBe("col-resize");
    }

    // A drag: the pointer leaves the handle at once, and the page keeps the resize cursor until the button is released.
    // The handle follows the sidebar's edge, so the page is probed far from both handles, where only the drag rule
    // could give it the resize cursor.
    const handle = page.getByRole("separator", { name: "Resize left sidebar", exact: true });
    const box = (await handle.boundingBox())!;
    const y = box.y + box.height / 2;
    const far = { x: box.x + 420, y };
    expect(await cursorAt(page, far.x, far.y), "the centre of the page is not a resize edge").not.toBe("col-resize");
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, y, { steps: 4 });
    await expect(root).toHaveAttribute("data-marinara-resizing", "col");
    expect(await cursorAt(page, far.x, far.y), "the whole page keeps the resize cursor during the drag").toBe(
      "col-resize",
    );
    // Another resize edge on the way (a floating window's corner, a panel's edge) does not take the cursor over mid-drag.
    // Probed with classes the shipped CSS has: Tailwind emits only the cursor utilities the app uses.
    const edges = await page.evaluate(() =>
      ["cursor-nwse-resize", "mari-resize-x", "mari-resize-y"].map((className) => {
        const edge = document.body.appendChild(document.createElement("div"));
        edge.className = `${className} sidebar-resize-cursor-probe`;
        return className;
      }),
    );
    const probeCursors = () =>
      page.evaluate(() =>
        [...document.querySelectorAll(".sidebar-resize-cursor-probe")].map((edge) => getComputedStyle(edge).cursor),
      );
    expect(await probeCursors(), `mid-drag, ${edges.join(", ")} show the drag's cursor`).toEqual(
      edges.map(() => "col-resize"),
    );
    await page.mouse.up();
    await expect(root).not.toHaveAttribute("data-marinara-resizing", /.*/);
    expect(await cursorAt(page, far.x, far.y), "released, the page shows its usual cursor again").not.toBe(
      "col-resize",
    );
    expect(await probeCursors(), "released, each edge shows its own resize cursor again").toEqual([
      "nwse-resize",
      "ew-resize",
      "ns-resize",
    ]);
  });
}
