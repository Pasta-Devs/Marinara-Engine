import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * D1: ⌘J / Ctrl+J ("Ask Prof. Mari about this") should still show the arrival when Mari's own chat
 * already has history, appended at the bottom of the transcript, not only on an empty chat —
 * otherwise a returning user just sees old history and the door's whole promise goes unmet.
 */

async function startFixtureProvider(reply: string): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      const action = { say: reply, commands: [], stop: true };
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        [
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify(action) }, finish_reason: null }] })}`,
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture provider address");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1` };
}

async function prepareClient(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
  });
}

async function openChatThenAskMari(page: Page, chatId: string) {
  await page.goto("/");
  await page.evaluate(async (id) => {
    const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
    useChatStore.getState().setActiveChatId(id);
  }, chatId);
  await page
    .locator("main")
    .first()
    .click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+j");
}

// F11: every test in this file reads "the most recent Mari thread" to route ⌘J, so another spec with a
// Mari thread of its own (same file or not) mid-run can steal it. The lock keeps this file from running
// at the same time as any other locked Mari-thread spec; the cleanup then starts from a clean slate.
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

test("Ctrl+J in a chat with existing Mari history appends the arrival instead of hiding it", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The keyboard shortcut is covered on desktop.");

  const fixture = await startFixtureProvider("Hi there! How can I help?");
  let connectionId = "";
  let chatId = "";
  let mariChatId = "";
  try {
    const connection = await request.post("/api/connections", {
      data: {
        name: `Arrival fixture ${Date.now().toString(36)}`,
        provider: "custom",
        baseUrl: fixture.baseUrl,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;

    const mariChat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
    expect(mariChat.ok(), await mariChat.text()).toBeTruthy();
    mariChatId = ((await mariChat.json()) as { id: string }).id;
    // One real completed turn, so her own chat is non-empty before the arrival door opens.
    const prompted = await request.post("/api/professor-mari/workspace/prompt", {
      data: { chatId: mariChatId, connectionId, message: "Hello Mari" },
    });
    expect(prompted.ok(), await prompted.text()).toBeTruthy();

    const chat = await request.post("/api/chats", {
      data: { name: "Arrival test chat", mode: "conversation", characterIds: [] },
    });
    expect(chat.ok(), await chat.text()).toBeTruthy();
    chatId = ((await chat.json()) as { id: string }).id;

    await prepareClient(page, 1440);
    await openChatThenAskMari(page, chatId);

    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    await expect(mariPane).toBeVisible();
    // Her existing history is still there, not replaced...
    await expect(mariPane.getByText("Hello Mari")).toBeVisible();
    // ...and the arrival is appended at the bottom.
    const appended = mariPane.locator('[data-component="HomeProfessorMariChat.AppendedArrival"]');
    await expect(appended).toBeVisible();
    await expect(appended).toContainText("Arrival test chat");
    // Slice 73: this chat has no thread of its own yet, so she continues her latest one and offers the choice.
    const choice = appended.getByRole("group", { name: "Where to continue" });
    await expect(choice.getByRole("button", { name: "Continue here" })).toBeVisible();
    await expect(choice.getByRole("button", { name: "New about Arrival test chat" })).toBeVisible();
    // Exactly one pull-morph target on screen: the appended arrival's sprite, not an older resting one.
    await expect(mariPane.locator('[data-mari-pull-target="mari-current"]')).toHaveCount(1);
    await expect(appended.locator('[data-mari-pull-target="mari-current"]')).toHaveCount(1);
    await page.screenshot({ path: "test-results/mari-arrival-append-1440.png" });

    // Leaving and reopening through the same door replaces the block, never stacks a second one.
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setOmnibarOpen(false);
    });
    await expect(page.locator('[data-component="GlobalOmnibar"]')).toBeHidden();
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+j");
    await expect(appended).toHaveCount(1);

    // Sending a real message clears the local-only block (it never lingers once you're really typing to her).
    await mariPane.locator("textarea:visible").fill("What's new here?");
    await page.keyboard.press("Control+Enter");
    await expect(appended).toHaveCount(0);
  } finally {
    fixture.server.close();
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    if (mariChatId)
      await request.delete(`/api/chats/internal/professor-mari/chats/${mariChatId}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
  }
});

test("mobile: Ctrl+J in a chat with existing Mari history appends the arrival", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile-chromium"), "One mobile capture is enough proof.");

  const fixture = await startFixtureProvider("Hi there! How can I help?");
  let connectionId = "";
  let chatId = "";
  let mariChatId = "";
  try {
    const connection = await request.post("/api/connections", {
      data: {
        name: `Arrival fixture mobile ${Date.now().toString(36)}`,
        provider: "custom",
        baseUrl: fixture.baseUrl,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;

    const mariChat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
    mariChatId = ((await mariChat.json()) as { id: string }).id;
    const prompted = await request.post("/api/professor-mari/workspace/prompt", {
      data: { chatId: mariChatId, connectionId, message: "Hello Mari" },
    });
    expect(prompted.ok(), await prompted.text()).toBeTruthy();

    const chat = await request.post("/api/chats", {
      data: { name: "Arrival test chat mobile", mode: "conversation", characterIds: [] },
    });
    chatId = ((await chat.json()) as { id: string }).id;

    await prepareClient(page, 390);
    await openChatThenAskMari(page, chatId);

    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    await expect(mariPane).toBeVisible();
    const appended = mariPane.locator('[data-component="HomeProfessorMariChat.AppendedArrival"]');
    await expect(appended).toBeVisible();
    await expect(appended).toContainText("Arrival test chat mobile");
    await expect(appended.getByRole("button", { name: "New about Arrival test chat mobile" })).toBeVisible();
    // Slice 73: the phone's arrival brings the chat along too (its record was still loading on ⌘J).
    await expect(mariPane.locator('.mari-workspace-composer__context [data-facet="chat"]')).toContainText(
      "Arrival test chat mobile",
    );
    await page.screenshot({ path: "test-results/mari-arrival-append-390.png" });
  } finally {
    fixture.server.close();
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    if (mariChatId)
      await request.delete(`/api/chats/internal/professor-mari/chats/${mariChatId}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
  }
});

/**
 * Slice 73: the phone's pull-down door (a real touch drag on the right half of the top bar) is an arrival
 * like ⌘J. From a chat, and from an editor, that has no Mari thread of its own while another thread has
 * messages, she continues that thread and offers "Continue here" / "New about <context>".
 */
for (const theme of ["dark", "light"] as const) {
  test(`mobile: the pull-down from a chat or an editor offers where to continue (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile-chromium"),
      "The touch pull is a phone gesture (Chromium input).",
    );
    test.setTimeout(90_000);

    const fixture = await startFixtureProvider("Hi there! How can I help?");
    let connectionId = "";
    let chatId = "";
    let characterId = "";
    let mariChatId = "";
    try {
      const connection = await request.post("/api/connections", {
        data: {
          name: `Pull arrival fixture ${Date.now().toString(36)}`,
          provider: "custom",
          baseUrl: fixture.baseUrl,
          apiKey: "fixture",
          model: "fixture",
          maxContext: 65536,
        },
      });
      expect(connection.ok(), await connection.text()).toBeTruthy();
      connectionId = ((await connection.json()) as { id: string }).id;
      const mariChat = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
      mariChatId = ((await mariChat.json()) as { id: string }).id;
      const prompted = await request.post("/api/professor-mari/workspace/prompt", {
        data: { chatId: mariChatId, connectionId, message: "Hello Mari" },
      });
      expect(prompted.ok(), await prompted.text()).toBeTruthy();
      const character = await request.post("/api/characters", {
        data: { data: { name: "Pull Gandalf", first_mes: "" } },
      });
      expect(character.ok(), await character.text()).toBeTruthy();
      characterId = ((await character.json()) as { id: string }).id;
      const chat = await request.post("/api/chats", {
        data: { name: "Pull arrival chat", mode: "conversation", characterIds: [] },
      });
      chatId = ((await chat.json()) as { id: string }).id;

      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        rightPanelOpen: false,
        sidebarOpen: false,
      });
      await page.goto("/");
      await page.evaluate(
        async ({ id, theme }) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
          useChatStore.getState().setActiveChatId(id);
        },
        { id: chatId, theme },
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      // A real touch drag (touch pointer events) down from the right half of the bar: Mari's side.
      const cdp = await page.context().newCDPSession(page);
      const pullDown = async () => {
        await expect(page.locator(".mari-pull-overlay")).toHaveCount(0);
        const bar = (await page.locator('[data-component="TopBar"]').boundingBox())!;
        const x = bar.x + bar.width * 0.75;
        const y = bar.y + bar.height / 2;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let step = 1; step <= 16; step += 1) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + step * 22 }] });
          await page.waitForTimeout(16);
        }
        await page.waitForTimeout(150);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      };
      const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
      const appended = mariPane.locator('[data-component="HomeProfessorMariChat.AppendedArrival"]');
      // "Visible" in Playwright ignores opacity; the offer must really be drawn, not held at its first frame.
      const drawnOpacity = () =>
        appended.getByRole("group", { name: "Where to continue" }).evaluate((node) => {
          let opacity = 1;
          for (let el: Element | null = node; el; el = el.parentElement)
            opacity *= Number(getComputedStyle(el).opacity);
          return { opacity, landing: document.documentElement.dataset.mariPullLanding ?? null };
        });
      const closeMari = async () => {
        await page
          .locator('[data-component="GlobalOmnibar"]')
          .getByRole("button", { name: /^Close/ })
          .first()
          .click();
        await expect(page.locator('[data-component="GlobalOmnibar"]')).toBeHidden();
      };

      // From the chat.
      await pullDown();
      await expect(mariPane).toBeVisible();
      await expect(appended).toContainText("Pull arrival chat");
      await expect(appended.getByRole("button", { name: "Continue here" })).toBeVisible();
      await expect(appended.getByRole("button", { name: "New about Pull arrival chat" })).toBeVisible();
      await expect.poll(drawnOpacity, { timeout: 6_000 }).toEqual({ opacity: 1, landing: null });
      await expect(mariPane.locator('.mari-workspace-composer__context [data-facet="chat"]')).toContainText(
        "Pull arrival chat",
      );
      await page.screenshot({ path: `test-results/mari-pull-arrival-proof/pull-chat-${theme}-390.png` });

      // From an editor.
      await closeMari();
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openCharacterDetail(id);
      }, characterId);
      await expect(page.getByText("Pull Gandalf").first()).toBeVisible();
      await pullDown();
      await expect(mariPane).toBeVisible();
      await expect(appended.getByRole("button", { name: "Continue here" })).toBeVisible();
      await expect(appended.getByRole("button", { name: "New about Pull Gandalf" })).toBeVisible();
      await expect.poll(drawnOpacity, { timeout: 6_000 }).toEqual({ opacity: 1, landing: null });
      await page.screenshot({ path: `test-results/mari-pull-arrival-proof/pull-editor-${theme}-390.png` });
    } finally {
      fixture.server.close();
      if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
      if (characterId) await request.delete(`/api/characters/${characterId}`).catch(() => undefined);
      const threads = (await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{
        id: string;
      }>;
      for (const thread of threads)
        await request.delete(`/api/chats/internal/professor-mari/chats/${thread.id}`).catch(() => undefined);
      if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    }
  });
}

/**
 * R13 (slice 62g): opening Mari from a chat (⌘J) while she is still working in another thread must not
 * reroute the moment the run ends. Slice 62b switched threads as soon as isBusy cleared, so the finished
 * run's done marks and "Worked for" line vanished unseen. The finished run stays on screen first; only
 * then does the arrival land in that chat's own thread.
 * F11: merged into this file (was mari-arrival-during-run.e2e.ts) so it cannot run on a different
 * worker in parallel with the tests above — both read the same global "most recent Mari thread".
 */
test("an arrival during a run waits until the finished run has been shown", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The keyboard door is covered on desktop.");
  test.setTimeout(90_000);

  const rounds: Array<{ delayMs: number; say: string }> = [
    { delayMs: 0, say: "Hi, general thread here." },
    { delayMs: 0, say: "Noted, this thread is about that chat." },
    { delayMs: 5_000, say: "Here is the slow answer." },
  ];
  const provider = createServer((incoming, response) => {
    incoming.resume();
    // Model-list probes are not a round of her run.
    if (incoming.method !== "POST") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "fixture" }] }));
      return;
    }
    incoming.on("end", () => {
      const round = rounds.shift() ?? { delayMs: 0, say: "Done." };
      const action = { say: round.say, commands: [], stop: true };
      setTimeout(() => {
        response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
        response.end(
          [
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify(action) }, finish_reason: null }] })}`,
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
            "data: [DONE]",
            "",
          ].join("\n\n"),
        );
      }, round.delayMs);
    });
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));

  let connectionId = "";
  let chatId = "";
  const mariChatIds: string[] = [];
  try {
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture provider address");
    const connection = await request.post("/api/connections", {
      data: {
        name: `Arrival during run ${Date.now().toString(36)}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "fixture",
        model: "fixture",
        maxContext: 65536,
      },
    });
    expect(connection.ok(), await connection.text()).toBeTruthy();
    connectionId = ((await connection.json()) as { id: string }).id;

    const general = await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`);
    const generalId = ((await general.json()) as { id: string }).id;
    mariChatIds.push(generalId);
    // A first message, so the restart below cannot reuse this thread as an empty one.
    const greeted = await request.post("/api/professor-mari/workspace/prompt", {
      data: { chatId: generalId, connectionId, message: "Hello from Home" },
    });
    expect(greeted.ok(), await greeted.text()).toBeTruthy();

    const chat = await request.post("/api/chats", {
      data: { name: "Arrival during run chat", mode: "conversation", characterIds: [] },
    });
    chatId = ((await chat.json()) as { id: string }).id;
    // That chat's own thread, with one earlier exchange in it.
    const keyed = await request.post(
      `/api/chats/internal/professor-mari/restart?connectionId=${connectionId}&contextKey=chat:${chatId}&contextLabel=Arrival%20during%20run%20chat`,
    );
    expect(keyed.ok(), await keyed.text()).toBeTruthy();
    const keyedId = ((await keyed.json()) as { id: string }).id;
    expect(keyedId).not.toBe(generalId);
    mariChatIds.push(keyedId);
    const seeded = await request.post("/api/professor-mari/workspace/prompt", {
      data: { chatId: keyedId, connectionId, message: "Remember this chat for me" },
    });
    expect(seeded.ok(), await seeded.text()).toBeTruthy();
    await seeded.text();
    await request.post(`/api/chats/internal/professor-mari/chats/${generalId}/activate`);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), APP_VERSION);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      reduceAmbientEffects: true,
    });
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+j");
    const mariPane = page.locator('[data-component="GlobalOmnibar.Mari"]');
    await expect(mariPane).toBeVisible();
    await expect(mariPane.getByText("Hello from Home")).toBeVisible();
    await mariPane.locator("textarea:visible").fill("A slow question");
    await page.keyboard.press("Control+Enter");
    await expect(mariPane.locator('.mari-work-timeline[data-active="true"]')).toBeVisible();

    // While she works: back to search (⌘J inside her pane), over to the chat that has its own thread,
    // and ⌘J from there - the chat's arrival door, with her pane still mounted.
    await page.keyboard.press("Control+j");
    await expect(page.getByPlaceholder(/Search everything/)).toBeVisible();
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, chatId);
    // Slice 78: the empty list no longer repeats the open chat, so wait on the store itself.
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await import("/src/stores/chat.store.ts" as string)).useChatStore.getState().activeChatId,
        ),
      )
      .toBe(chatId);
    await page.keyboard.press("Control+j");
    await expect(page.getByPlaceholder(/Search everything/)).toBeHidden();

    // The run finishes in the thread it ran in, and its done line stays on screen.
    const finished = mariPane.locator('.mari-work-timeline[data-active="false"]').filter({
      hasText: "Here is the slow answer.",
    });
    await expect(finished).toBeVisible({ timeout: 20_000 });
    await expect(finished.locator(".mari-work-timeline__done-mark")).toBeVisible();
    await page.screenshot({ path: "test-results/mari-arrival-during-run-proof/arrival-during-run-finished-1440.png" });
    await page.waitForTimeout(2_500);
    await expect(finished, "no reroute before the finished run has been shown").toBeVisible();

    // Then the arrival lands in that chat's own thread, with its history.
    await expect(mariPane.getByText("Remember this chat for me")).toBeVisible({ timeout: 10_000 });
    await expect(mariPane.getByText("Here is the slow answer.")).toHaveCount(0);
    await page.screenshot({ path: "test-results/mari-arrival-during-run-proof/arrival-during-run-rerouted-1440.png" });
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    for (const id of mariChatIds)
      await request.delete(`/api/chats/internal/professor-mari/chats/${id}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});
