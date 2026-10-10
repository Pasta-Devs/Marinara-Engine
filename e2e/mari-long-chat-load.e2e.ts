import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * A long Professor Mari chat opened slowly: every 2 Hz accent tick restarted the color fades of each
 * copy / edit / delete button in her transcript (~600 transitions per tick), and every older turn was
 * styled and laid out even off screen. With the RGB accent on, her idle transcript now starts no
 * transitions on those buttons, and older turns off screen are skipped by the browser.
 */
test.beforeEach(async ({ request }) => {
  await acquireMariThreadLock();
  const existing = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
    id: string;
  }>;
  await Promise.all(
    existing.map((chat) =>
      request.delete(`/api/chats/internal/professor-mari/chats/${chat.id}`).catch(() => undefined),
    ),
  );
});

test.afterEach(() => {
  releaseMariThreadLock();
});

test("a long Mari chat stays light under the RGB accent", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The browser work is the same on mobile.");
  test.setTimeout(90_000);

  const restart = await request.post("/api/chats/internal/professor-mari/restart?name=Long%20thread");
  expect(restart.ok(), await restart.text()).toBeTruthy();
  const chatId = ((await restart.json()) as { id: string }).id;
  try {
    const turns = 30;
    const t0 = Date.parse("2026-09-01T10:00:00Z");
    for (let i = 0; i < turns; i += 1) {
      const at = t0 + i * 60_000;
      const user = await request.post(`/api/chats/${chatId}/messages`, {
        data: {
          role: "user",
          content: `Improve character ${i}.`,
          characterId: null,
          createdAt: new Date(at).toISOString(),
        },
      });
      expect(user.ok(), await user.text()).toBeTruthy();
      const reply = await request.post(`/api/chats/${chatId}/messages`, {
        data: {
          role: "assistant",
          content: `Done with step ${i}.`,
          characterId: "professor-mari",
          extra: {
            mariWorkspaceTimeline: [
              {
                type: "tool",
                tool: {
                  id: `t${i}`,
                  name: "app_data",
                  status: "done",
                  input: { action: "character.list" },
                  output: "ok",
                },
              },
              { type: "text", content: `Done with step ${i}.` },
            ],
          },
          createdAt: new Date(at + 30_000).toISOString(),
        },
      });
      expect(reply.ok(), await reply.text()).toBeTruthy();
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      appAccentRgbMode: true,
    });
    await page.addInitScript(() => {
      const counter = { actionTransitions: 0 };
      (window as unknown as { __mariTransitions: typeof counter }).__mariTransitions = counter;
      addEventListener(
        "transitionrun",
        (event) => {
          if ((event.target as Element).closest?.(".mari-message-action")) counter.actionTransitions += 1;
        },
        true,
      );
    });
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+j");
    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    await expect(mariPane.getByText(`Done with step ${turns - 1}.`).last()).toBeVisible({ timeout: 20_000 });

    // The accent pauses while you type in her composer; reading the chat (focus elsewhere) resumes it,
    // so the check below is not vacuous.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(page.locator("html")).toHaveAttribute("data-marinara-accent-animation", /.+/);
    await expect.poll(() => mariPane.locator(".mari-message-action").count()).toBeGreaterThan(20);

    // Older turns: the browser skips the ones off screen (the first one is far above the fold).
    const firstPastTurn = mariPane.locator(".mari-transcript-past-turn").first();
    expect(await firstPastTurn.evaluate((element) => getComputedStyle(element).contentVisibility)).toBe("auto");
    // checkVisibility reports a skipped subtree on the row's content, not on the row itself.
    await expect
      .poll(() =>
        firstPastTurn.evaluate((element) =>
          element.firstElementChild?.checkVisibility({ contentVisibilityAuto: true }),
        ),
      )
      .toBe(false);

    // Three accent ticks while she sits idle: no color fade restarts on her message buttons.
    await page.evaluate(() => {
      (window as unknown as { __mariTransitions: { actionTransitions: number } }).__mariTransitions.actionTransitions =
        0;
    });
    await page.waitForTimeout(1_600);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __mariTransitions: { actionTransitions: number } }).__mariTransitions
            .actionTransitions,
      ),
    ).toBe(0);
  } finally {
    await request.delete(`/api/chats/internal/professor-mari/chats/${chatId}`).catch(() => undefined);
  }
});
