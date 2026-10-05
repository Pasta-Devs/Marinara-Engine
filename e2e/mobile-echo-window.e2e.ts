import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

type Geometry = { x: number; y: number; width: number; height: number };
type Layout = Geometry & { pinned: boolean; locked: boolean; minimized: boolean };

async function box(locator: Locator): Promise<Geometry> {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

async function drag(page: Page, browserName: string, start: { x: number; y: number }, dx: number, dy: number) {
  if (browserName === "chromium") {
    // Native touch input exercises pointer capture and touch-action, not synthetic DOM events.
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      for (let step = 1; step <= 8; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: start.x + (dx * step) / 8, y: start.y + (dy * step) / 8 }],
        });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await session.detach();
    }
  } else {
    // Playwright exposes touch taps but no native touch drag for WebKit; still check its pointer path.
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
    await page.mouse.up();
  }
}

test("mobile Echo can move, resize, lock and restore its saved window", async ({ page, browserName }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile Echo window regression.");
  const response = await page.request.post("/api/chats", {
    data: { name: "Movable mobile Echo", mode: "roleplay", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  try {
    expect(
      (
        await page.request.patch(`/api/chats/${chat.id}/metadata`, {
          data: { enableAgents: true, activeAgentIds: ["echo-chamber"] },
        })
      ).ok(),
    ).toBeTruthy();
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.route(`**/api/agents/echo-messages/${chat.id}`, (route) =>
      route.fulfill({
        json: Array.from({ length: 20 }, (_, index) => ({
          characterName: "Observer",
          reaction: `Reaction ${index + 1}.`,
          timestamp: index,
        })),
      }),
    );
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      echoChamberOpen: true,
      chatHelpSeenModes: ["roleplay"],
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version: APP_VERSION },
    );
    await page.goto("/");
    const panel = page.locator('.mari-window[data-window="echo-chamber"]');
    const header = panel.locator(".mari-window__header");
    const resize = panel.locator('[data-edge="se"]');
    const bubble = page.getByRole("button", { name: "Open Echo Chamber", exact: true });
    await expect(panel).toHaveAttribute("data-presentation", "window");
    await expect(resize).toBeVisible();
    await expect(panel).toHaveAttribute("data-pinned", "true");
    await expect(panel.getByText("Reaction 20.", { exact: true })).toBeInViewport();
    const initial = await box(panel);
    expect(initial.height).toBeLessThanOrEqual(114);

    const grip = await box(resize);
    await drag(page, browserName, { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }, -80, 70);
    await expect.poll(async () => (await box(panel)).width).toBeCloseTo(initial.width - 80, 0);
    await expect.poll(async () => (await box(panel)).height).toBeCloseTo(initial.height + 70, 0);
    const title = await box(header);
    // The left title text is clear of the header's pin, lock, close and retry buttons.
    await drag(page, browserName, { x: title.x + 45, y: title.y + 12 }, 45, 85);
    await expect.poll(async () => (await box(panel)).x).toBeCloseTo(initial.x + 45, 0);
    await expect.poll(async () => (await box(panel)).y).toBeCloseTo(initial.y + 85, 0);
    const moved = await box(panel);

    const readLayout = async () => {
      const response = await page.request.get(`/api/chats/${chat.id}`);
      const saved = (await response.json()) as { metadata: string | Record<string, unknown> };
      const metadata = typeof saved.metadata === "string" ? JSON.parse(saved.metadata) : saved.metadata;
      return metadata.windowLayout?.windows?.["echo-chamber"] as Layout | undefined;
    };
    await expect.poll(async () => (await readLayout())?.x).toBeCloseTo(moved.x, 0);
    await page.reload();
    await expect(resize).toBeVisible();
    expect(await box(panel)).toEqual(moved);
    await expect(panel.getByText("Reaction 20.", { exact: true })).toBeInViewport();

    // Visual viewport events clamp a mobile window above an onscreen keyboard without rewriting its saved size.
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport!, "height", { configurable: true, value: 350 });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect
      .poll(async () => {
        const value = await box(panel);
        return value.y + value.height;
      })
      .toBeLessThanOrEqual(342);
    expect(await readLayout()).toMatchObject(moved);
    await page.evaluate(() => {
      Reflect.deleteProperty(window.visualViewport!, "height");
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect.poll(() => box(panel)).toEqual(moved);

    await panel.locator('[data-window-control="lock"]').tap();
    await expect(resize).toHaveCount(0);
    const lockedHeader = await box(header);
    await drag(page, browserName, { x: lockedHeader.x + 45, y: lockedHeader.y + 12 }, 15, 30);
    expect(await box(panel)).toEqual(moved);
    await panel.locator('[data-window-control="close"]').tap();
    await expect(bubble).toHaveAttribute("data-locked", "true");
    await expect(bubble).toHaveAttribute("data-presentation", "sheet");
    expect((await box(bubble)).width).toBe(36);
    const lockedBubble = await box(bubble);
    await bubble.press("ArrowDown");
    expect(await box(bubble)).toEqual(lockedBubble);
    await bubble.tap();
    await expect(panel).toBeVisible();
    expect(await box(panel)).toEqual(moved);
    await panel.locator('[data-window-control="lock"]').tap();
    await panel.locator('[data-window-control="pin"]').tap();
    await expect(panel).toHaveAttribute("data-pinned", "false");
    await page.touchscreen.tap(190, moved.y + moved.height + 55);
    await expect(bubble).toBeVisible();
    await expect(panel).toHaveCount(0);
    await expect.poll(async () => (await readLayout())?.minimized).toBe(true);
    await page.reload();
    await expect(bubble).toBeVisible();
    await bubble.tap();
    await expect(panel).toHaveAttribute("data-pinned", "false");
    expect(await box(panel)).toEqual(moved);
    await page.screenshot({ path: testInfo.outputPath("mobile-echo-moved-resized.png") });

    // Even at its minimum size, each preset leaves the controls and last reaction inside the window.
    const finalGrip = await box(resize);
    await drag(
      page,
      browserName,
      { x: finalGrip.x + finalGrip.width / 2, y: finalGrip.y + finalGrip.height / 2 },
      -300,
      -300,
    );
    await expect.poll(async () => (await box(panel)).width).toBe(240);
    await expect.poll(async () => (await box(panel)).height).toBe(112);
    const phoneViewport = page.viewportSize()!;
    for (const [theme, preset] of [
      ["dark", "default"],
      ["dark", "dottore"],
      ["dark", "mari"],
      ["light", "dottore"],
      ["light", "mari"],
    ] as const) {
      await page.evaluate(
        async ({ theme, preset }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setChatWidgetPreset(preset);
          useUIStore.setState({ theme });
        },
        { theme, preset },
      );
      const frame = await box(panel);
      for (const control of await panel.locator(".mari-window__control").all()) {
        const rect = await box(control);
        expect(rect.x).toBeGreaterThanOrEqual(frame.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(frame.x + frame.width);
      }
      await panel.getByText("Reaction 20.", { exact: true }).scrollIntoViewIfNeeded();
      await expect(panel.getByText("Reaction 20.", { exact: true })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`mobile-echo-minimum-${preset}-${theme}.png`) });
      if (preset === "default") continue;
      for (const mobile of [true, false]) {
        await page.setViewportSize(mobile ? phoneViewport : { width: 1024, height: phoneViewport.height });
        await expect(panel).toHaveAttribute("data-presentation", "window");
        await page.screenshot({
          path: testInfo.outputPath(`echo-crest-${preset}-${theme}-${mobile ? "phone" : "desktop"}.png`),
        });
        const crest = await header.evaluate((element) => {
          const style = getComputedStyle(element, "::after");
          const rect = element.getBoundingClientRect();
          return {
            left: parseFloat(style.left),
            top: parseFloat(style.top),
            width: parseFloat(style.width),
            height: parseFloat(style.height),
            headerWidth: element.clientWidth,
            headerHeight: element.clientHeight,
            titleLeft: element.querySelector(".mari-window__title")!.getBoundingClientRect().left - rect.left,
            image: style.backgroundImage,
          };
        });
        expect(crest.image).not.toBe("none");
        if (mobile) {
          expect(crest.top).toBeGreaterThanOrEqual(0);
          expect(crest.top + crest.height).toBeLessThanOrEqual(crest.headerHeight);
          expect(crest.left).toBeGreaterThanOrEqual(0);
          expect(crest.left + crest.width).toBeLessThanOrEqual(crest.titleLeft);
        } else {
          expect(crest.top).toBeLessThan(0);
          expect(crest.left + crest.width / 2).toBeCloseTo(crest.headerWidth / 2, 0);
        }
      }
      await page.setViewportSize(phoneViewport);
    }
  } finally {
    await page.request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
