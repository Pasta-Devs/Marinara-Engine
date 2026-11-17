import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * A long Professor Mari chat opened slowly: every 2 Hz accent tick restarted the color fades of each
 * copy / edit / delete button in her transcript (~600 transitions per tick), and every older turn was
 * styled and laid out even off screen. With the RGB accent on, her idle transcript now starts no
 * transitions on those buttons, and older turns off screen are skipped by the browser.
 *
 * #9340: typing in her composer re-rendered the whole transcript on every keystroke, and each turn with a
 * change receipt re-parsed its reply and put new copy buttons on its code blocks. Typing now leaves the
 * transcript alone.
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

test("a long Mari chat stays light under the RGB accent and while you type", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The browser work is the same on mobile.");
  test.setTimeout(90_000);

  const restart = await request.post("/api/chats/internal/professor-mari/restart?name=Long%20thread");
  expect(restart.ok(), await restart.text()).toBeTruthy();
  const chatId = ((await restart.json()) as { id: string }).id;
  // A failed run in an earlier spec leaves the server's last error, which shows her "broken" in every chat and
  // keeps typing below from turning her to "composing". Clear it the way her Dismiss does.
  const reset = await request.post("/api/professor-mari/workspace/reset", { data: { keepRun: true } });
  expect(reset.ok(), await reset.text()).toBeTruthy();
  try {
    const turns = 30;
    const t0 = Date.parse("2026-09-01T10:00:00Z");
    for (let i = 0; i < turns; i += 1) {
      const at = t0 + i * 60_000;
      // Every third turn changed a character and shows code, like most of her real work.
      const changed = i % 3 === 0;
      const text = changed ? `Done with step ${i}.\n\n\`\`\`json\n{ "step": ${i} }\n\`\`\`` : `Done with step ${i}.`;
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
          content: text,
          characterId: "professor-mari",
          extra: {
            ...(changed
              ? {
                  mariWorkspaceActionResults: [
                    {
                      status: "updated",
                      resource: { kind: "character", id: `c${i}`, label: `Character ${i}` },
                      changedFields: ["description"],
                      summary: "Updated the description",
                      changes: [{ field: "description", kind: "text", before: "old", after: "new" }],
                    },
                  ],
                }
              : {}),
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
              { type: "text", content: text },
            ],
          },
          createdAt: new Date(at + 30_000).toISOString(),
        },
      });
      expect(reply.ok(), await reply.text()).toBeTruthy();
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await isolateSyncedUISettings(page);
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

    // #9340: twenty keystrokes in her composer put no new copy buttons on the transcript's code blocks (a turn
    // that re-renders replaces them) and change nothing else in it. The first one, outside the count, starts
    // her "composing" state.
    const transcript = mariPane.locator('[data-component="HomeProfessorMariChat.Transcript"]');
    await expect.poll(() => transcript.locator(".docs-copy-button").count()).toBeGreaterThan(5);
    const composer = mariPane.locator("textarea:visible").first();
    await composer.click();
    await page.keyboard.type("x");
    await expect(transcript).toHaveAttribute("data-mari-state", "composing");
    await transcript.evaluate((element) => {
      const record = { mutations: 0, copyButtons: 0 };
      (window as unknown as { __mariTyping: typeof record }).__mariTyping = record;
      new MutationObserver((list) => {
        for (const mutation of list) {
          record.mutations += 1;
          for (const node of [...mutation.addedNodes, ...mutation.removedNodes])
            if ((node as Element).classList?.contains("docs-copy-button")) record.copyButtons += 1;
        }
      }).observe(element, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    await page.keyboard.type("abcdefghijklmnopqrst", { delay: 20 });
    await expect(composer).toHaveValue("xabcdefghijklmnopqrst");
    // Two frames, so a late commit or resize would be counted.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(
      await page.evaluate(() => (window as unknown as { __mariTyping: Record<string, number> }).__mariTyping),
    ).toEqual({ mutations: 0, copyButtons: 0 });
  } finally {
    await request.delete(`/api/chats/internal/professor-mari/chats/${chatId}`).catch(() => undefined);
  }
});
