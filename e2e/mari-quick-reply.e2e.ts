import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { acquireMariThreadLock, releaseMariThreadLock } from "./mari-thread-lock.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * #8651: a quick reply whose chat action names a chat the app does not list (her own thread, an id she made up)
 * closed Prof. Mari's window and the chat view fell back to Home, with nothing sent. The chip is saved on her
 * answer, so after reopening it did the same again. Such a chip now asks her; a chat that exists still opens.
 */
test.beforeEach(async ({ request }) => {
  await acquireMariThreadLock();
  // The fixture model answers in the Classic JSON-frame protocol.
  expect((await request.put("/api/professor-mari/workspace/runtime", { data: { runtime: "classic" } })).ok()).toBe(
    true,
  );
});

test.afterEach(async ({ request }) => {
  await request.put("/api/professor-mari/workspace/runtime", { data: { runtime: "pi" } }).catch(() => undefined);
  releaseMariThreadLock();
});

/** A fake model: each request gets the next scripted answer, and its body is kept. */
async function startFixtureModel() {
  const answers: Array<Record<string, unknown>> = [];
  const bodies: string[] = [];
  const server: Server = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      if (incoming.method !== "POST") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: [{ id: "fixture" }] }));
        return;
      }
      bodies.push(Buffer.concat(chunks).toString());
      const answer = answers.shift() ?? { say: "Done.", commands: [], stop: true };
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        [
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: JSON.stringify(answer) }, finish_reason: null }] })}`,
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture model address");
  return { server, answers, bodies, baseUrl: `http://127.0.0.1:${address.port}/v1` };
}

const mariThreadIds = async (request: APIRequestContext) =>
  ((await (await request.get("/api/chats/internal/professor-mari/chats")).json()) as Array<{ id: string }>).map(
    (thread) => thread.id,
  );

/** Her connection, her thread and one ordinary chat the chips can point at. */
async function setUp(page: Page, request: APIRequestContext, baseUrl: string) {
  // Her GET can hand back a thread that was already there, so cleanup removes only threads this test made.
  const knownThreads = new Set(await mariThreadIds(request));
  const connection = await request.post("/api/connections", {
    data: {
      name: `Quick reply fixture ${Date.now().toString(36)}`,
      provider: "custom",
      baseUrl,
      apiKey: "fixture",
      model: "fixture",
      maxContext: 65536,
    },
  });
  expect(connection.ok(), await connection.text()).toBeTruthy();
  const connectionId = ((await connection.json()) as { id: string }).id;
  const thread = (await (
    await request.get(`/api/chats/internal/professor-mari?connectionId=${connectionId}`)
  ).json()) as { id: string };
  const chat = await request.post("/api/chats", { data: { name: "Quick reply target", mode: "conversation" } });
  expect(chat.ok(), await chat.text()).toBeTruthy();
  const chatId = ((await chat.json()) as { id: string }).id;
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false });
  return { connectionId, threadId: thread.id, chatId, knownThreads };
}

async function cleanup(
  request: APIRequestContext,
  { connectionId, chatId, knownThreads }: { connectionId: string; chatId: string; knownThreads: Set<string> },
) {
  for (const id of await mariThreadIds(request)) {
    if (!knownThreads.has(id))
      await request.delete(`/api/chats/internal/professor-mari/chats/${id}`).catch(() => undefined);
  }
  await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
  await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
}

const marisPane = (page: Page) => page.locator('[data-component="GlobalOmnibar.Mari"]:not([aria-hidden="true"])');

async function askFromHome(page: Page, text: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What shall we cook tonight?" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Ask Professor Mari", exact: true }).click();
  const composer = marisPane(page).locator("textarea:visible");
  await expect(composer).toBeVisible();
  await composer.fill(text);
  await composer.press("Enter");
}

test("a quick reply whose chat cannot open asks Mari and keeps her window open, also after reopening", async ({
  page,
  request,
}) => {
  const model = await startFixtureModel();
  const fixture = await setUp(page, request, model.baseUrl);
  const { threadId, chatId } = fixture;
  model.answers.push(
    {
      say: "How long should the story be?",
      commands: [],
      stop: true,
      suggestions: [
        // Her own thread: the chats list hides it, so it never opens as a chat.
        { label: "Keep it short", prompt: "Keep it short", action: { kind: "chat", chatId: threadId } },
        { label: "Make it long", prompt: "Make it long", action: { kind: "peek-prompt", chatId: "made-up-chat" } },
      ],
    },
    {
      say: "Short it is.",
      commands: [],
      stop: true,
      suggestions: [
        { label: "Add a title", prompt: "Add a title", action: { kind: "chat", chatId: "made-up-chat" } },
        { label: "Open my chat", prompt: "Open my chat", action: { kind: "chat", chatId } },
      ],
    },
    { say: "Titled it.", commands: [], stop: true },
  );
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  try {
    await askFromHome(page, "Write me a story");
    const short = marisPane(page).getByRole("button", { name: /Keep it short/ });
    await expect(short).toBeVisible({ timeout: 30_000 });
    await short.click();
    // Her window stays, and the chip went to her as your answer.
    await expect(omnibar).toHaveCount(1);
    await expect(marisPane(page).getByText("Short it is.")).toBeVisible({ timeout: 30_000 });
    expect(model.bodies).toHaveLength(2);
    expect(model.bodies[1]).toContain("Keep it short");

    // Closed, then opened again from Home's Professor tab on a fresh page, so the chips come from her saved
    // answer (extra.mariSuggestions) rather than the live store. They still answer.
    await omnibar.getByRole("button", { name: "Close", exact: true }).click();
    await expect(omnibar).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "What shall we cook tonight?" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: "Professor" }).click();
    const title = marisPane(page).getByRole("button", { name: /Add a title/ });
    await expect(title).toBeVisible({ timeout: 15_000 });
    // The card says it asks her, not that it opens something.
    await expect(title).toHaveAttribute("title", /Asks Professor Mari/);
    await title.click();
    await expect(omnibar).toHaveCount(1);
    await expect(marisPane(page).getByText("Titled it.")).toBeVisible({ timeout: 30_000 });
    expect(model.bodies).toHaveLength(3);
    expect(model.bodies[2]).toContain("Add a title");
  } finally {
    model.server.close();
    await cleanup(request, fixture);
  }
});

test("a quick reply whose chat exists still opens that chat", async ({ page, request }) => {
  const model = await startFixtureModel();
  const fixture = await setUp(page, request, model.baseUrl);
  const { chatId } = fixture;
  model.answers.push({
    say: "Want to go back to it?",
    commands: [],
    stop: true,
    suggestions: [{ label: "Open my chat", prompt: "Open my chat", action: { kind: "chat", chatId } }],
  });
  const omnibar = page.locator('[data-component="GlobalOmnibar"]');
  try {
    await askFromHome(page, "Where was I?");
    const open = marisPane(page).getByRole("button", { name: /Open my chat/ });
    await expect(open).toBeVisible({ timeout: 30_000 });
    await expect(open).toHaveAttribute("title", /Opens now/);
    await open.click();
    await expect(omnibar).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("marinara-active-chat-id"))).toBe(chatId);
    expect(model.bodies).toHaveLength(1);
  } finally {
    model.server.close();
    await cleanup(request, fixture);
  }
});
