import { expect, test, type Locator } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// The two halves of the branch block. Exactly one of them survives the turn, and which
// one is genuinely random, so every assertion below is written about "one and not the
// other" rather than about a fixed outcome. Pinning a winner would mean pinning a die.
const SUCCESS_HALF = "The guard's gaze slides over the crates and away.";
const FAILURE_HALF = "A boot scuffs stone and he turns.";
// d1 faces are the only way to assert on a real roll's value without faking the roller:
// the engine still throws for real, the faces are just all the same. 2d1+41 = 43 and
// 6d1+11 = 17, two totals that appear nowhere else in the turn.
const ONE_REQUEST_DRAFT = [
  `[skill_check: skill="Stealth" dc="15" branch="crates"]`,
  `[branch: crates]`,
  `[on success] ${SUCCESS_HALF}`,
  `[on failure] ${FAILURE_HALF}`,
  `[/branch]`,
  `The axe bites deep for [[roll: 2d1+41]] damage, and the burn lasts [[roll: 6d1+11]] rounds.`,
].join("\n");
// The shipped shape, for the switched-off half of the test: a sparse check the engine
// rolls and then narrates in a second request.
const TWO_REQUEST_DRAFT = `You press yourself flat against the wall. [skill_check: skill="Stealth" dc="15"]`;
const REWRITE_INSTRUCTION = "The engine has now rolled the requested dice:";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bring the reply up after a reload. The panel reopens on whatever segment the player
 * last confirmed, which on WebKit is their own turn rather than the reply, so one Next
 * per segment brings the reply into view, the way the native-dice spec does. Bounded, so
 * a panel that never shows the reply fails on the assertion instead of looping.
 */
async function revealReply(narration: Locator, playerText: string, replyText: string): Promise<void> {
  await expect(narration).toContainText(new RegExp(`${escapeRegExp(replyText)}|${escapeRegExp(playerText)}`));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await narration.textContent())?.includes(replyText)) break;
    await narration.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(narration).toContainText(replyText);
}

test("Game finishes a rolled turn in one request, and leaves the shipped two-request turn alone", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  const providerRequests: Array<{ rewrite: boolean }> = [];
  let draft = TWO_REQUEST_DRAFT;
  const provider = createServer(async (incoming, response) => {
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const rewrite = Boolean(body.messages?.at(-1)?.content?.includes(REWRITE_INSTRUCTION));
    providerRequests.push({ rewrite });
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    const write = (delta: unknown, finishReason: string | null = null) =>
      response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`);
    write({ content: rewrite ? "The guard walks on, and you are past him." : draft });
    write({}, "stop");
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  let connectionId = "";
  let chatId = "";
  try {
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("One-request dice fixture did not bind");
    const connection = await request.post("/api/connections", {
      data: {
        name: "Local one-request dice fixture",
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "synthetic-test-key",
        model: "one-request-fixture",
        maxContext: 32768,
        treatAsLocalEndpoint: true,
      },
    });
    expect(connection.ok()).toBeTruthy();
    connectionId = (await connection.json()).id;
    const chat = await request.post("/api/chats", {
      data: { name: "One-request dice browser proof", mode: "game", characterIds: [], connectionId },
    });
    expect(chat.ok()).toBeTruthy();
    chatId = (await chat.json()).id;
    expect(
      (
        await request.patch(`/api/chats/${chatId}/metadata`, {
          data: {
            gameId: chatId,
            gameSessionStatus: "active",
            gameIntroPresented: true,
            gameImageAutoGenerationEnabled: false,
            enableAgents: false,
            enableTools: false,
          },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.post(`/api/chats/${chatId}/messages`, {
          data: { role: "assistant", content: "A guard paces the warehouse floor." },
        })
      ).ok(),
    ).toBeTruthy();

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
      debugMode: false,
      theme: "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chatId, version },
    );

    const metadata = async () => {
      const row = await (await request.get(`/api/chats/${chatId}`)).json();
      return typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
    };
    const savedMessages = async () =>
      (await (await request.get(`/api/chats/${chatId}/messages`)).json()) as Array<{
        id: string;
        role: string;
        content: string;
        extra: unknown;
      }>;
    const savedExtra = (row: { extra: unknown }) =>
      (typeof row.extra === "string" ? JSON.parse(row.extra) : (row.extra ?? {})) as Record<string, unknown>;
    const openTools = async () => {
      if (testInfo.project.name.includes("mobile"))
        await page.getByRole("button", { name: "Game actions", exact: true }).click();
      await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
      const section = page.locator('[data-chat-settings-section="function-calling"]');
      const header = section.locator('[role="button"][aria-expanded]');
      await expect(header).toBeVisible();
      // The drawer remembers which sections are open, so this expands rather than toggles:
      // reopening the drawer must not collapse the section the previous visit opened.
      if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
      await expect(header).toHaveAttribute("aria-expanded", "true");
      return section;
    };
    const closeTools = async () => {
      await page.locator(".mari-chat-settings-drawer").getByRole("button", { name: "Close Chat Settings" }).click();
      await expect(page.locator(".mari-chat-settings-drawer")).toHaveCount(0);
      // Mobile reaches the drawer through the game actions menu, and that menu stays open
      // behind it. Close it the way a player would: left open, its button column hangs down
      // the right edge over the narration stack, which is where a dice card's dismiss
      // control sits.
      if (testInfo.project.name.includes("mobile")) {
        await page.getByRole("button", { name: "Game actions", exact: true }).click();
        await expect(page.locator("[data-chat-toolbar-overflow-menu]")).toHaveCount(0);
      }
    };
    const dismissCards = async () => {
      const dismiss = page.getByRole("button", { name: "Dismiss dice roll result" });
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if ((await dismiss.count()) === 0) return;
        await dismiss.first().click();
      }
    };
    const sendTurn = async (action: string) => {
      await page.getByPlaceholder("What do you do?", { exact: true }).fill(action);
      await page.getByRole("button", { name: "Send game turn", exact: true }).click();
    };

    await page.goto("/");
    const narration = page.locator('[data-component="GameNarration.ActivePanel"]');
    await expect(narration).toContainText("A guard paces the warehouse floor.");

    // ── The switch renders, defaults off, and the narration toggle is live beside it ──
    let section = await openTools();
    const oneRequest = () => section.getByLabel("Finish rolled turns in one request", { exact: true });
    const narrateOutcomes = () => section.getByLabel("Narrate dice outcomes immediately", { exact: true });
    await expect(oneRequest()).not.toBeChecked();
    await expect(section).toContainText("The Game Master never sees a number before it decides what happens");
    await expect(narrateOutcomes()).toBeEnabled();
    await expect(narrateOutcomes()).toBeChecked();
    await expect(section).not.toContainText("Not used while one-request dice is on");
    await closeTools();

    // ── Switch off: the shipped two-request turn, unchanged ──
    providerRequests.length = 0;
    await sendTurn("Slip past the guard.");
    await expect(narration).toContainText("The guard walks on, and you are past him.");
    expect(providerRequests.map((entry) => entry.rewrite)).toEqual([false, true]);
    const shipped = (await savedMessages()).at(-1)!;
    expect(shipped.content).toContain("The guard walks on, and you are past him.");
    expect(savedExtra(shipped).gameDiceTurn).toBeUndefined();
    await dismissCards();

    // ── Turning the switch on ──
    section = await openTools();
    await section
      .locator("label")
      .filter({ has: page.getByLabel("Finish rolled turns in one request", { exact: true }) })
      .click();
    await expect.poll(async () => (await metadata()).gameOneRequestDice).toBe(true);
    // The narration toggle goes inert and says so, and its stored value is untouched, so
    // turning the switch back off gives the player their own preference back.
    await expect(narrateOutcomes()).toBeDisabled();
    await expect(narrateOutcomes()).toBeChecked();
    await expect(section).toContainText("Not used while one-request dice is on");
    expect((await metadata()).gameDiceOutcomeNarration).toBeUndefined();
    await closeTools();

    // It persists: the chat carries it, and a reload renders it back.
    await page.reload();
    await revealReply(narration, "Slip past the guard.", "The guard walks on, and you are past him.");
    section = await openTools();
    await expect(oneRequest()).toBeChecked();
    await expect(narrateOutcomes()).toBeDisabled();
    await closeTools();

    // ── Switch on: one request, one half kept, both numbers substituted ──
    draft = ONE_REQUEST_DRAFT;
    providerRequests.length = 0;
    await sendTurn("Try the crates instead.");
    // The turn's own text is asserted from the saved row rather than from the active
    // panel: the kept half and the sentence carrying the numbers are two segments, and
    // the panel shows one segment at a time.
    await expect.poll(async () => (await savedMessages()).at(-1)?.content ?? "").toContain("for 43 damage");
    expect(providerRequests.map((entry) => entry.rewrite)).toEqual([false]);

    const rolled = (await savedMessages()).at(-1)!;
    const keptSuccess = rolled.content.includes(SUCCESS_HALF);
    const keptFailure = rolled.content.includes(FAILURE_HALF);
    expect(keptSuccess).not.toEqual(keptFailure);
    expect(rolled.content).not.toContain("[branch:");
    expect(rolled.content).not.toContain("[on success]");
    expect(rolled.content).not.toContain("[on failure]");
    expect(rolled.content).not.toContain("[/branch]");
    expect(rolled.content).not.toContain("[[roll:");
    expect(rolled.content).toContain("for 43 damage");
    expect(rolled.content).toContain("lasts 17 rounds");
    // The check was rolled for real and written back as a settled record, never left
    // sparse for the client to roll a second time.
    expect(rolled.content).toMatch(/\[skill_check:[^\]]*result="/);

    const extra = savedExtra(rolled);
    const rolls = extra.diceRollResults as Array<{ notation: string; total: number }>;
    expect(rolls.map((roll) => [roll.notation, roll.total])).toEqual([
      ["2d1+41", 43],
      ["6d1+11", 17],
    ]);
    const notice = extra.gameDiceTurn as { forms?: string[]; placeholders?: unknown[] };
    expect(notice.forms).toEqual(["branch", "placeholder"]);
    expect(notice.placeholders).toHaveLength(2);
    expect(notice).not.toHaveProperty("unreadablePlaceholders");
    expect(notice).not.toHaveProperty("branchFailures");
    expect(notice).not.toHaveProperty("passFailed");

    // A placeholder roll deliberately pops no full-screen dice card: a damage number
    // burying the narration it belongs to would be worse than no card at all.
    await expect(page.locator(".dice-roll-card--game")).toHaveCount(0);
    await dismissCards();

    // ── The inline markers, and the dice history ──
    await page.reload();
    await revealReply(narration, "Try the crates instead.", "The axe bites deep for 43 damage");
    const markers = narration.locator(".game-dice-marker");
    await expect(markers).toHaveCount(2);
    await expect(markers.first()).toHaveText("43");
    await expect(markers.first()).toHaveAttribute("title", /2d1\+41/);
    await expect(markers.last()).toHaveText("17");
    await expect(markers.last()).toHaveAttribute("title", /6d1\+11/);
    await testInfo.attach(`one-request-dice-markers-${testInfo.project.name}.png`, {
      body: await narration.screenshot({ path: testInfo.outputPath("one-request-dice-markers.png") }),
      contentType: "image/png",
    });

    await dismissCards();
    await page.getByRole("button", { name: "Logs", exact: true }).click();
    const logs = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Session Logs" }) });
    await expect(logs).toContainText("🎲 2d1+41:");
    await expect(logs).toContainText("= 43");
    await expect(logs).toContainText("🎲 6d1+11:");
    await expect(logs).toContainText("= 17");
    await expect(logs).toContainText("Stealth");
    // The log lists every segment, so it is where the kept half is asserted after the
    // reload: the panel shows one segment at a time and which one it opens on differs by
    // browser, while the log does not.
    await expect(logs).toContainText(keptSuccess ? SUCCESS_HALF : FAILURE_HALF);
    await expect(logs).not.toContainText(keptSuccess ? FAILURE_HALF : SUCCESS_HALF);
    // A clean turn records no notice, so none of the failure lines is rendered.
    await expect(logs).not.toContainText("Dice: one number could not be rolled");
    await expect(logs).not.toContainText("Dice: the branch was malformed");
    await expect(logs).not.toContainText("Dice: this turn's dice step failed");
    await testInfo.attach(`one-request-dice-logs-${testInfo.project.name}.png`, {
      body: await logs.screenshot({ path: testInfo.outputPath("one-request-dice-logs.png") }),
      contentType: "image/png",
    });
    await logs.getByRole("button", { name: "Close logs", exact: true }).click();

    // ── Turning it back off restores the shipped behaviour and the stored preference ──
    section = await openTools();
    await section
      .locator("label")
      .filter({ has: page.getByLabel("Finish rolled turns in one request", { exact: true }) })
      .click();
    await expect.poll(async () => (await metadata()).gameOneRequestDice).toBe(false);
    await expect(narrateOutcomes()).toBeEnabled();
    await expect(narrateOutcomes()).toBeChecked();
    await closeTools();

    draft = TWO_REQUEST_DRAFT;
    providerRequests.length = 0;
    await sendTurn("Back to the wall.");
    await expect(narration).toContainText("The guard walks on, and you are past him.");
    expect(providerRequests.map((entry) => entry.rewrite)).toEqual([false, true]);
    await dismissCards();
  } finally {
    await page.close().catch(() => undefined);
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    provider.closeAllConnections();
    await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  }
});

// The sighted pool sub-option, which is the one mechanism in this feature that puts a
// number in front of the Game Master before it decides what happens. It ships off, under
// a parent switch that also ships off, and its help text says the trade-off outright.
//
// Two things are asserted here that no unit lane can see: the sub-option renders under
// its parent in the real drawer, and OVERFLOW DOES NOT REACH THE ENDPOINT. That second
// one is the whole reason the client fallback is gated: ungated, a check the pool had no
// value for would be rolled live by POST /game/skill-check, the notice saying it was left
// unrolled would become false, and overflowing the allotment on purpose would become a
// way to obtain a roll the pool did not contain.
const POOL_CHECK = (index: number) =>
  `[skill_check: skill="Stealth" dc="15" mode="normal" dice="1d20" rolls="10" pool="d20:${index}"]`;
// Seven d20 checks against an allotment of six. The seventh has no value to spend.
const POOL_DRAFT = [
  "You move along the crates, counting your chances.",
  [1, 2, 3, 4, 5, 6, 7].map((index) => POOL_CHECK(index)).join(" "),
].join("\n");

test("Game spends the sighted pool in order and leaves an overflowed check for the next turn", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  const providerRequests: string[] = [];
  const provider = createServer(async (incoming, response) => {
    if (incoming.method !== "POST") {
      incoming.resume();
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    providerRequests.push(JSON.stringify(body.messages ?? []));
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    const write = (delta: unknown, finishReason: string | null = null) =>
      response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`);
    write({ content: POOL_DRAFT });
    write({}, "stop");
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  let connectionId = "";
  let chatId = "";
  try {
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Dice pool fixture did not bind");
    const connection = await request.post("/api/connections", {
      data: {
        name: "Local dice pool fixture",
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "synthetic-test-key",
        model: "dice-pool-fixture",
        maxContext: 32768,
        treatAsLocalEndpoint: true,
      },
    });
    expect(connection.ok()).toBeTruthy();
    connectionId = (await connection.json()).id;
    const chat = await request.post("/api/chats", {
      data: { name: "Dice pool browser proof", mode: "game", characterIds: [], connectionId },
    });
    expect(chat.ok()).toBeTruthy();
    chatId = (await chat.json()).id;
    expect(
      (
        await request.patch(`/api/chats/${chatId}/metadata`, {
          data: {
            gameId: chatId,
            gameSessionStatus: "active",
            gameIntroPresented: true,
            gameImageAutoGenerationEnabled: false,
            enableAgents: false,
            enableTools: false,
            gameOneRequestDice: true,
          },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.post(`/api/chats/${chatId}/messages`, {
          data: { role: "assistant", content: "A guard paces the warehouse floor." },
        })
      ).ok(),
    ).toBeTruthy();

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
      debugMode: false,
      theme: "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chatId, version },
    );

    // Every live roll the client could ask for, counted. Fulfilled rather than aborted so
    // a failure reads as "the client asked" rather than as a network error.
    const liveRolls: string[] = [];
    await page.route("**/api/game/skill-check", async (route) => {
      liveRolls.push(route.request().url());
      await route.fulfill({ json: { result: null } });
    });

    const metadata = async () => {
      const row = await (await request.get(`/api/chats/${chatId}`)).json();
      return typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
    };
    const savedMessages = async () =>
      (await (await request.get(`/api/chats/${chatId}/messages`)).json()) as Array<{
        id: string;
        role: string;
        content: string;
        extra: unknown;
      }>;
    const openTools = async () => {
      if (testInfo.project.name.includes("mobile"))
        await page.getByRole("button", { name: "Game actions", exact: true }).click();
      await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
      const section = page.locator('[data-chat-settings-section="function-calling"]');
      const header = section.locator('[role="button"][aria-expanded]');
      await expect(header).toBeVisible();
      if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
      await expect(header).toHaveAttribute("aria-expanded", "true");
      return section;
    };
    const closeTools = async () => {
      await page.locator(".mari-chat-settings-drawer").getByRole("button", { name: "Close Chat Settings" }).click();
      await expect(page.locator(".mari-chat-settings-drawer")).toHaveCount(0);
      // Mobile reaches the drawer through the game actions menu, and that menu stays open
      // behind it. Close it the way a player would: left open, its button column hangs down
      // the right edge over the narration stack, which is where a dice card's dismiss
      // control sits.
      if (testInfo.project.name.includes("mobile")) {
        await page.getByRole("button", { name: "Game actions", exact: true }).click();
        await expect(page.locator("[data-chat-toolbar-overflow-menu]")).toHaveCount(0);
      }
    };

    await page.goto("/");
    const narration = page.locator('[data-component="GameNarration.ActivePanel"]');
    await expect(narration).toContainText("A guard paces the warehouse floor.");

    // ── The sub-option renders under its parent, defaults off, and names the trade-off ──
    let section = await openTools();
    const dicePool = () => section.getByLabel("Let the Game Master see one die of each size", { exact: true });
    await expect(dicePool()).not.toBeChecked();
    await expect(section).toContainText("it can steer outcomes in a way the blind forms do not allow");
    await section
      .locator("label")
      .filter({ has: page.getByLabel("Let the Game Master see one die of each size", { exact: true }) })
      .click();
    await expect.poll(async () => (await metadata()).gameDicePoolMode).toBe(true);
    // The two sub-controls appear with the defaults that make the mechanism safe to ship.
    await expect(section.getByLabel("Values shown per size", { exact: true })).toHaveValue("1");
    await expect(section.getByLabel("Rethrow after idle turns", { exact: true })).toHaveValue("3");
    await closeTools();

    // ── The turn: one request, the pool shown, six spends and one overflow ──
    providerRequests.length = 0;
    liveRolls.length = 0;
    await page.getByPlaceholder("What do you do?", { exact: true }).fill("Count your chances.");
    await page.getByRole("button", { name: "Send game turn", exact: true }).click();
    await expect.poll(async () => (await savedMessages()).at(-1)?.content ?? "").toContain("You move along the crates");
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0]).toContain("<dice_pool>");
    expect(providerRequests[0]).toContain("<check_modifiers>");

    const rolled = (await savedMessages()).at(-1)!;
    const records = rolled.content.match(/\[skill_check:[^\]]+\]/g) ?? [];
    expect(records).toHaveLength(7);
    // Six spent, in order, each naming the slot the ENGINE spent rather than the one the
    // draft claimed. The seventh overflowed: the ask stands and every number is gone.
    expect(records.slice(0, 6).map((record) => /pool="(d20:\d+)"/.exec(record)?.[1])).toEqual([
      "d20:1",
      "d20:2",
      "d20:3",
      "d20:4",
      "d20:5",
      "d20:6",
    ]);
    expect(records[6]).not.toContain("pool=");
    expect(records[6]).not.toMatch(/total=|result=|used=|modifier=/);
    expect(records[6]).toContain('skill="Stealth"');

    const extra = (typeof rolled.extra === "string" ? JSON.parse(rolled.extra) : (rolled.extra ?? {})) as {
      gameDiceTurn?: { poolSlots?: unknown[]; poolOverflow?: number };
    };
    expect(extra.gameDiceTurn?.poolSlots).toHaveLength(6);
    expect(extra.gameDiceTurn?.poolOverflow).toBe(1);

    // The gate. An overflowed check is left sparse and the client must not roll it live:
    // doing so would bypass the queue and make the notice below a false statement.
    await page.waitForTimeout(1500);
    expect(liveRolls).toEqual([]);

    await page.reload();
    await revealReply(narration, "Count your chances.", "You move along the crates");
    await page.waitForTimeout(1500);
    expect(liveRolls).toEqual([]);

    const dismiss = page.getByRole("button", { name: "Dismiss dice roll result" });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if ((await dismiss.count()) === 0) break;
      await dismiss.first().click();
    }
    await page.getByRole("button", { name: "Logs", exact: true }).click();
    const logs = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Session Logs" }) });
    await expect(logs).toContainText("Dice: this turn asked for more rolls than the pool held");
    await testInfo.attach(`dice-pool-overflow-${testInfo.project.name}.png`, {
      body: await logs.screenshot({ path: testInfo.outputPath("dice-pool-overflow.png") }),
      contentType: "image/png",
    });
    await logs.getByRole("button", { name: "Close logs", exact: true }).click();
  } finally {
    await page.close().catch(() => undefined);
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    provider.closeAllConnections();
    await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  }
});
