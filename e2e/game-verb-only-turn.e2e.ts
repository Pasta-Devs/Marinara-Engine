import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const EARLIER_NARRATION = "Lantern light pools at the gatehouse.";
const GM_NARRATION = "Rain hammers the ridge road.";
const HIDDEN_CONTEXT = "Continuity note the player never reads.";

/**
 * A game turn that parsed nothing but GM verb tags strips to empty prose, so the
 * server saves it as a hidden, command-only anchor for the turn's writes to hang on
 * (#5798). That anchor is then the newest assistant row in the chat, and the hidden
 * narrator rows a scene fork copies in sit in the same list. The narration surface
 * has to look past both and keep showing the last turn the player can actually read.
 *
 * Rows carry explicit timestamps: the message list orders by (createdAt, id), and
 * ids are random, so same-millisecond seeds would scramble the fixture's order.
 *
 * The row order is the fixture's whole point — each of the three unreadable shapes
 * sits newer than the turn that must stay on screen, so the surface has to skip all
 * three in sequence to land on it. Walking back from newest: an empty-but-visible
 * row, the anchor, the hidden continuity note, then the readable turn.
 */
async function seedVerbOnlyTurn(request: APIRequestContext) {
  const created = await request.post("/api/chats", {
    data: { name: "Verb-only GM turn", mode: "game", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };

  // A campaign that already has a gameId skips the setup wizard, and a presented
  // intro skips the "the adventure begins" first-turn screen, so the chat opens
  // straight onto the narration surface.
  const meta = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { gameId: "verb-only-fixture", gameSessionStatus: "active", gameIntroPresented: true },
  });
  expect(meta.ok()).toBeTruthy();

  const base = Date.now();
  const at = (step: number) => new Date(base + step * 1000).toISOString();
  const seed = async (data: Record<string, unknown>) => {
    const saved = await request.post(`/api/chats/${chat.id}/messages`, { data });
    expect(saved.ok()).toBeTruthy();
    return ((await saved.json()) as { id: string }).id;
  };

  // The turn wheel-nav must step back to. Plain single-line prose parses to exactly
  // one narration segment, so the flat log is one entry per seeded readable turn.
  await seed({ role: "assistant", content: EARLIER_NARRATION, createdAt: at(0) });
  await seed({ role: "assistant", content: GM_NARRATION, createdAt: at(1) });
  // Hidden but not empty — the shape a scene fork writes for carried-over context.
  await seed({
    role: "assistant",
    content: HIDDEN_CONTEXT,
    createdAt: at(2),
    extra: { hiddenFromUser: true, isGenerated: true },
  });
  // The verb-only anchor, exactly as the empty-response branch saves it.
  const anchorId = await seed({
    role: "assistant",
    content: "",
    createdAt: at(3),
    extra: { hiddenFromUser: true, hiddenFromAI: true, commandOnly: true, isGenerated: true },
  });
  // Empty but NOT hidden and NOT command-only: a GM turn the player edited down to
  // nothing. `PATCH /messages/:id` takes any string, blank included, and touches no
  // visibility flag, so this shape is reachable without the anchor's flags. It is the
  // only row in the fixture that the predicate's content test has to reject on its own.
  const editedEmptyId = await seed({ role: "assistant", content: "Struck from the log.", createdAt: at(4) });
  const edited = await request.patch(`/api/chats/${chat.id}/messages/${editedEmptyId}`, { data: { content: "" } });
  expect(edited.ok()).toBeTruthy();

  return { chatId: chat.id, anchorId, editedEmptyId };
}

async function openGameChat(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    messagesPerPage: 20,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    // Read settled text; explicitly enable the otherwise disabled wheel navigation.
    gameInstantTextReveal: true,
    gameMiddleMouseNav: true,
  });
  await page.addInitScript(
    ({ id, appVersion }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    },
    { id: chatId, appVersion: version },
  );
  await page.goto("/");
}

/**
 * Wheel back one entry in the flat log, the way a player scrolling over the scene art
 * does. The listener ignores wheels that start inside interactive UI or any
 * `[data-game-skip-bg-nav]` container — the narration panel is one — so probe for a
 * point that clears a deliberately *stricter* filter than the app's (every `[role]`
 * rather than the app's named roles). Anything that passes this probe passes the app's.
 */
async function wheelBackOneEntry(page: Page) {
  const point = await page.evaluate(() => {
    const skip =
      'button,a,input,textarea,select,label,[role],[data-radix-popper-content-wrapper],[data-game-skip-bg-nav="true"]';
    for (let y = 80; y < window.innerHeight - 80; y += 20) {
      for (let x = 60; x < window.innerWidth - 60; x += 40) {
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest(skip)) return { x, y };
      }
    }
    return null;
  });
  expect(point, "no scene background point outside the wheel-nav skip filter").not.toBeNull();
  await page.mouse.move(point!.x, point!.y);
  await page.mouse.wheel(0, -120);
}

test("a hidden verb-only anchor does not blank the GM narration panel", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "One proof of the narration filter is sufficient.");
  const { chatId, anchorId, editedEmptyId } = await seedVerbOnlyTurn(request);
  try {
    await openGameChat(page, chatId);
    const narrationPanel = page.locator('[data-component="GameNarration.ActivePanel"]');
    await expect(narrationPanel).toBeVisible({ timeout: 30_000 });
    // Without the hidden/command-only/empty filter on the latest-GM-turn pick, one of
    // the three unreadable rows above becomes the rendered turn and the panel falls
    // back to its "send an action to begin the scene" empty state (anchor, edited-empty)
    // or leaks the continuity note (hidden row).
    await expect(narrationPanel).toContainText(GM_NARRATION);
    await expect(narrationPanel).not.toContainText(HIDDEN_CONTEXT);
    await expect(narrationPanel).not.toContainText(EARLIER_NARRATION);

    // Wheel-nav walks the flat log, which is built from its own copy of the filter. One
    // step back must reach the previous readable turn: if the hidden continuity note is
    // still in that list it takes this slot instead, and the earlier turn is one step
    // further away than the player's history says it is.
    await wheelBackOneEntry(page);
    await expect(narrationPanel).toContainText(EARLIER_NARRATION, { timeout: 10_000 });
    await expect(narrationPanel).not.toContainText(HIDDEN_CONTEXT);

    // Both unreadable rows are still real rows on the server — the surface skipped them,
    // they were not dropped from the chat. Re-asserting the edited row's shape keeps the
    // fixture honest: it only exercises the predicate's content test while it stays the
    // newest row, empty, and free of the anchor's visibility flags.
    const stored = await request.get(`/api/chats/${chatId}/messages`);
    expect(stored.ok()).toBeTruthy();
    const rows = (await stored.json()) as Array<{ id: string; content?: string; extra?: unknown }>;
    expect(rows.some((row) => row.id === anchorId)).toBe(true);
    const newest = rows[rows.length - 1];
    expect(newest?.id).toBe(editedEmptyId);
    expect(newest?.content ?? "").toBe("");
    const newestExtra = (
      typeof newest?.extra === "string" ? JSON.parse(newest.extra) : (newest?.extra ?? {})
    ) as Record<string, unknown>;
    expect(newestExtra.hiddenFromUser).not.toBe(true);
    expect(newestExtra.commandOnly).not.toBe(true);
  } finally {
    await request.delete(`/api/chats/${chatId}`);
  }
});
