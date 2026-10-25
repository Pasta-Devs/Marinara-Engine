// Novel Mode: a Roleplay chat shown as one page. Passages carry no chat chrome, the writer's own text
// is saved as story text, and the bar under the page only steers the next passage: it never sends a
// user message.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { buildNovelGuideInstructionMessage } from "../packages/shared/src/utils/generation-guide.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const REPLY = "The rain kept falling on the harbour.";

async function openChat(page: Page, chatId: string, ui: Parameters<typeof seedUIState>[1] = {}) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    trackerPanelEnabled: false,
    trackerPanelOpen: false,
    chatHelpSeenModes: ["roleplay", "conversation", "game"],
    roleplayDisplayStyle: "classic",
    streamingSpeed: 100,
    ...ui,
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

/** A provider that answers every chat completion with REPLY and keeps each prompt it was sent. */
async function startFixtureProvider() {
  const prompts: string[] = [];
  const provider = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk) => chunks.push(chunk));
    incoming.on("end", () => {
      if (incoming.method !== "POST" || incoming.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
      }
      prompts.push(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString()).messages));
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: REPLY }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
      );
    });
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Novel fixture provider did not bind");
  return {
    prompts,
    port: address.port,
    close: () => new Promise<void>((resolve) => provider.close(() => resolve())),
  };
}

test("a novel chat reads as a page, saves the writer's text and only steers the next passage", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120_000);
  const { prompts, port, close } = await startFixtureProvider();
  const cleanup: string[] = [];
  try {
    const create = async (path: string, data: unknown) => {
      const response = await request.post(path, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      const row = await response.json();
      cleanup.unshift(`${path}/${row.id}`);
      return row as { id: string };
    };
    const connection = await create("/api/connections", {
      name: "Novel fixture provider",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiKey: "synthetic-test-key",
      model: "novel-fixture",
      maxContext: 32768,
      treatAsLocalEndpoint: true,
    });
    const presets = (await (await request.get("/api/prompts")).json()) as Array<{ id: string; systemKey?: string }>;
    const novelPreset = presets.find((preset) => preset.systemKey === "marinara-novel-preset");
    expect(novelPreset).toBeTruthy();
    // No characters: a novel needs none.
    const chat = await create("/api/chats", {
      name: "Harbour novel",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: novelPreset!.id,
    });
    const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { roleplayDisplayStyle: "novel", enableAgents: false, enableTools: false, enableMemoryRecall: false },
    });
    expect(metadata.ok(), await metadata.text()).toBeTruthy();
    // Long enough to scroll: the opening lines, then filler paragraphs.
    const filler = Array.from({ length: 40 }, (_, i) => `The tide turned for the ${i + 1}th time that night.`);
    const openingText = ["Mara walked down to the harbour.", "The gulls cried over the boats.", ...filler].join("\n\n");
    const opening = await create(`/api/chats/${chat.id}/messages`, {
      role: "assistant",
      characterId: null,
      content: openingText,
    });
    const messages = async () =>
      (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{
        id: string;
        role: string;
        content: string;
      }>;

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await openChat(page, chat.id);
    const surface = page.locator('[data-roleplay-presentation="novel"]');
    await expect(surface).toBeVisible();
    const passage = page.locator(`[data-message-id="${opening.id}"]`);
    const paragraphs = passage.locator(".mari-novel-paragraph");
    await expect(passage).toHaveClass(/mari-novel-passage/);
    // Book paragraphs: one per line, indented, with no blank line between them.
    await expect(paragraphs).toHaveCount(42);
    const firstLineIndent = () =>
      paragraphs.first().evaluate((p) => {
        const range = document.createRange();
        range.setStart(p.firstChild!, 0);
        range.setEnd(p.firstChild!, 1);
        return range.getBoundingClientRect().left - p.getBoundingClientRect().left;
      });
    await expect.poll(firstLineIndent).toBeGreaterThan(10);
    await expect(paragraphs.nth(1)).toHaveCSS("margin-top", "0px");
    // No chat chrome: no avatar, name or bubble.
    await expect(passage.locator(".mari-message-avatar, .mari-message-name, .mari-rp-bubble")).toHaveCount(0);
    await capture(page, info, "novel-page");
    // The bar only steers: it takes no attachments, which would need a message of yours.
    await expect(page.getByRole("button", { name: "Attach files" })).toHaveCount(0);

    // The page scrolls with the wheel or a swipe while the pointer is over a passage.
    const scroller = page.locator("#roleplay-chat-history");
    const scrollTop = () => scroller.evaluate((el) => el.scrollTop);
    if (info.project.name.includes("desktop")) {
      await expect.poll(scrollTop).toBeGreaterThan(0);
      const bottom = await scrollTop();
      await paragraphs.nth(20).hover();
      await page.mouse.wheel(0, -400);
      await expect.poll(scrollTop).toBeLessThan(bottom);
      // Hovering a passage shows its actions beside it, in the margin.
      const actions = passage.locator(".mari-novel-passage-actions");
      await expect(actions).toHaveCSS("opacity", "1");
      // The highlight spans the page panel, and the pointer reaches the actions without leaving the passage.
      const actionsBox = (await actions.boundingBox())!;
      const highlight = await paragraphs.nth(20).evaluate((p) => {
        const box = p.closest(".mari-novel-passage-text")!;
        const before = getComputedStyle(box, "::before");
        const rect = box.getBoundingClientRect();
        return {
          bleed: [parseFloat(before.left), parseFloat(before.right)],
          right: rect.right - parseFloat(before.right),
          radius: before.borderRadius,
        };
      });
      expect(highlight.bleed[0]).toBeLessThan(-16);
      expect(highlight.bleed[1]).toBe(highlight.bleed[0]);
      expect(highlight.radius).toBe("0px");
      expect(Math.abs(actionsBox.x - highlight.right)).toBeLessThanOrEqual(1);
      const textBox = (await paragraphs.nth(20).boundingBox())!;
      const steps = 12;
      for (let step = 0; step <= steps; step++) {
        const x = textBox.x + textBox.width / 2 + ((actionsBox.x + 12 - textBox.x - textBox.width / 2) * step) / steps;
        const y =
          textBox.y + textBox.height / 2 + ((actionsBox.y + 12 - textBox.y - textBox.height / 2) * step) / steps;
        await page.mouse.move(x, y);
        expect(await passage.evaluate((el) => el.matches(":hover")), `hovered at step ${step}`).toBe(true);
      }
      // The toolbar's box covers its buttons, so the gaps between them keep the hover too.
      const gaps = await actions.evaluate((toolbar) => {
        const box = toolbar.getBoundingClientRect();
        const buttons = [...toolbar.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
        const [a, b] = buttons;
        const between = document.elementFromPoint((a!.right + b!.left) / 2, (a!.top + a!.bottom) / 2);
        return {
          contained: buttons.every((r) => r.left >= box.left - 1 && r.right <= box.right + 1),
          betweenInToolbar: !!between && toolbar.contains(between),
        };
      });
      expect(gaps).toEqual({ contained: true, betweenInToolbar: true });
      await capture(page, info, "novel-passage-hover");
    }

    // The page is one editor: click into a passage and type, and the change saves to its message.
    await scroller.evaluate((el) => (el.scrollTop = 0));
    await expect(passage.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await paragraphs.nth(1).click();
    await page.keyboard.press("Home");
    await page.keyboard.type("Later. ");
    await expect(paragraphs.nth(1)).toHaveText("Later. The gulls cried over the boats.");
    await expect
      .poll(async () => (await messages()).find((message) => message.id === opening.id)?.content)
      .toContain("\n\nLater. The gulls cried");
    await expect(paragraphs).toHaveCount(42);

    // The writer's own line becomes the next passage; the chat input's text only steers the one after it.
    await page.locator(".mari-novel-draft .mari-novel-paragraph").click();
    await page.keyboard.type("She lit a lantern against the dark.");
    const input = page.locator(".mari-chat-input-textarea");
    await input.fill("a storm arrives");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(async () => (await messages()).length, { timeout: 30_000 }).toBe(3);
    await expect(page.locator(".mari-novel-passage").filter({ hasText: REPLY })).toBeVisible({ timeout: 30_000 });
    await capture(page, info, "novel-after-send");
    if (info.project.name.includes("desktop")) {
      // A short last passage's margin toolbar stays inside the page when scrolled to the bottom.
      const last = page.locator(".mari-novel-passage").filter({ hasText: REPLY });
      await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await last.hover();
      const toolbar = await last.locator(".mari-novel-passage-actions").boundingBox();
      const view = await scroller.boundingBox();
      expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(view!.y + view!.height);
    }

    const saved = await messages();
    expect(saved.map((message) => message.role)).toEqual(["assistant", "assistant", "assistant"]);
    expect(saved[1]?.content).toBe("She lit a lantern against the dark.");
    expect(saved[2]?.content).toContain(REPLY);
    const prompt = prompts.at(-1) ?? "";
    expect(prompt).toContain("She lit a lantern against the dark.");
    expect(prompt).toContain(buildNovelGuideInstructionMessage("a storm arrives"));
    // Marinara's Novel Preset with no persona and no characters: the AI establishes the protagonist.
    expect(prompt).toContain("Write the next passage of the manuscript");
    expect(prompt).toContain("establish a protagonist in this passage");
    expect(prompt).not.toContain("Never narrate");
    expect(prompt).toContain("You may use *italics* for a character's thoughts and for emphasis");

    // A selection across passages deletes inside each one: no passage, and no message, is lost.
    const writerLine = page.locator(`[data-message-id="${saved[1]!.id}"]`);
    await page.evaluate(() => {
      const paragraphsOnPage = [...document.querySelectorAll(".mari-novel-paragraph")];
      const from = paragraphsOnPage.find((el) => el.textContent?.startsWith("The tide turned for the 40th"))!;
      const to = paragraphsOnPage.find((el) => el.textContent?.startsWith("She lit a lantern"))!;
      const range = document.createRange();
      range.setStart(from.firstChild!, "The tide turned".length);
      range.setEnd(to.firstChild!, "She lit".length);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
    });
    await page.keyboard.press("Backspace");
    await expect(writerLine.locator(".mari-novel-paragraph")).toHaveText(" a lantern against the dark.");
    await expect
      .poll(async () => (await messages()).map((message) => message.content.split("\n\n").at(-1)))
      .toEqual(["The tide turned", " a lantern against the dark.", expect.stringContaining(REPLY)]);

    // /guided saves the writer's line first, then steers the next passage with the novel's guidance.
    await page.locator(".mari-novel-draft .mari-novel-paragraph").click();
    await page.keyboard.type("The bell rang twice.");
    await input.fill("/guided the bell tolls");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(async () => (await messages()).length, { timeout: 30_000 }).toBe(5);
    expect((await messages()).slice(3).map((message) => message.content)).toEqual([
      "The bell rang twice.",
      expect.stringContaining(REPLY),
    ]);
    expect(prompts.at(-1)).toContain("The bell rang twice.");
    expect(prompts.at(-1)).toContain(buildNovelGuideInstructionMessage("the bell tolls"));
    expect(prompts.at(-1)).not.toContain("do not include a reply from");

    // Slash commands still run from the input.
    await input.fill("/sys Chapter Two");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(async () => (await messages()).at(-1)).toMatchObject({ role: "system", content: "Chapter Two" });
    // A system message is a passage like any other: its text shows once, as an editable book paragraph.
    await expect(page.locator(".mari-novel-editor").getByText("Chapter Two", { exact: true })).toHaveCount(1);
    await expect(
      page.locator(".mari-novel-editor .mari-novel-paragraph").filter({ hasText: /^Chapter Two$/ }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    for (const path of cleanup) await request.delete(path).catch(() => undefined);
    await close();
  }
});

test("choosing Novel in the setup wizard selects the Novel preset and keeps its agents", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120_000);
  const connection = await request.post("/api/connections", {
    data: {
      name: "Novel wizard provider",
      provider: "custom",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "synthetic-test-key",
      model: "novel-fixture",
      treatAsLocalEndpoint: true,
    },
  });
  expect(connection.ok(), await connection.text()).toBeTruthy();
  const connectionId = (await connection.json()).id as string;
  const presets = (await (await request.get("/api/prompts")).json()) as Array<{ id: string; systemKey?: string }>;
  const novelPreset = presets.find((preset) => preset.systemKey === "marinara-novel-preset");
  expect(novelPreset).toBeTruthy();
  const defaultPreset = (await (await request.get("/api/prompts/default")).json()) as { id: string; name: string };
  const defaultPresetId = defaultPreset.id;
  expect(defaultPresetId).not.toBe(novelPreset!.id);
  const customPreset = await request.post("/api/prompts", { data: { name: "Novel wizard custom preset" } });
  expect(customPreset.ok(), await customPreset.text()).toBeTruthy();
  const customPresetId = (await customPreset.json()).id as string;
  const before = new Set(
    ((await (await request.get("/api/chats")).json()) as Array<{ id: string }>).map((chat) => chat.id),
  );
  let chatId: string | undefined;
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay", "conversation", "game"],
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    await page.getByRole("button", { name: "Start a new roleplay" }).click();
    await expect
      .poll(async () => {
        const chats = (await (await request.get("/api/chats")).json()) as Array<{ id: string }>;
        chatId = chats.find((chat) => !before.has(chat.id))?.id;
        return chatId;
      })
      .toBeTruthy();
    const savedChat = async () => {
      const chat = await (await request.get(`/api/chats/${chatId}`)).json();
      const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
      return {
        mode: chat.mode,
        style: metadata?.roleplayDisplayStyle,
        agents: metadata?.enableAgents,
        activeAgentIds: metadata?.activeAgentIds,
        preset: chat.promptPresetId,
      };
    };
    // A new roleplay starts with agents on, on the default preset.
    await expect.poll(async () => (await savedChat()).agents).toBe(true);
    await expect.poll(async () => (await savedChat()).preset).toBe(defaultPresetId);
    // Give it a text agent and the visual ones; the wizard picks them up with its next save, and Novel keeps them all.
    const agentsPatch = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { activeAgentIds: ["prose-guardian", "expression", "world-state"] },
    });
    expect(agentsPatch.ok(), await agentsPatch.text()).toBeTruthy();
    await page.getByRole("radio", { name: "Visual Novel", exact: true }).click();
    await expect.poll(async () => (await savedChat()).style).toBe("visual-novel");
    expect((await savedChat()).preset).toBe(defaultPresetId);
    // The radio follows the saved chat, so it shows checked once the save lands.
    await page.getByRole("radio", { name: "Novel", exact: true }).click();
    await expect.poll(savedChat).toEqual({
      mode: "roleplay",
      style: "novel",
      agents: true,
      activeAgentIds: ["prose-guardian", "expression", "world-state"],
      preset: novelPreset!.id,
    });

    await expect(page.getByRole("radio", { name: "Novel", exact: true })).toBeChecked();
    await expect(
      page.locator('[data-component="ChatSetupWizard"] h3').filter({ hasText: /^New Novel$/ }),
    ).toBeVisible();
    if (info.project.name.includes("desktop")) {
      await expect(page.locator(`[data-chat-id="${chatId}"] .lucide-book-open`)).toBeVisible();
    }
    const path = info.outputPath("novel-wizard.png");
    await page.screenshot({ path, animations: "disabled" });
    await info.attach("novel-wizard", { path, contentType: "image/png" });

    // Choosing another style again in the same wizard puts the earlier preset back.
    await page.getByRole("radio", { name: "Classic", exact: true }).click();
    await expect.poll(savedChat).toEqual({
      mode: "roleplay",
      style: "classic",
      agents: true,
      activeAgentIds: ["prose-guardian", "expression", "world-state"],
      preset: defaultPresetId,
    });

    // A preset of the writer's own, picked in the Preset step, comes back the same way.
    const presetSelect = page.getByRole("combobox", { name: "Preset", exact: true });
    const pickPreset = async (name: string) => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await presetSelect.click();
      await page.getByRole("option", { name, exact: true }).click();
      await page.getByRole("button", { name: "Back", exact: true }).click();
    };
    await pickPreset("Novel wizard custom preset");
    await expect.poll(async () => (await savedChat()).preset).toBe(customPresetId);
    await page.getByRole("radio", { name: "Novel", exact: true }).click();
    await expect.poll(async () => (await savedChat()).preset).toBe(novelPreset!.id);
    // The Preset step shows the Novel preset it picked.
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(presetSelect).toHaveText(/Marinara's Novel Preset/u);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("radio", { name: "Classic", exact: true }).click();
    await expect.poll(async () => (await savedChat()).preset).toBe(customPresetId);

    // A preset picked while on Novel is kept when the writer leaves Novel.
    await pickPreset(defaultPreset.name);
    await expect.poll(async () => (await savedChat()).preset).toBe(defaultPresetId);
    await page.getByRole("radio", { name: "Novel", exact: true }).click();
    await expect.poll(async () => (await savedChat()).preset).toBe(novelPreset!.id);
    await pickPreset("Novel wizard custom preset");
    await expect.poll(async () => (await savedChat()).preset).toBe(customPresetId);
    await page.getByRole("radio", { name: "Classic", exact: true }).click();
    await expect.poll(async () => (await savedChat()).style).toBe("classic");
    expect((await savedChat()).preset).toBe(customPresetId);
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
    await request.delete(`/api/prompts/${customPresetId}`).catch(() => undefined);
    await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
  }
});

test("emptying a passage and leaving it asks to delete it, without breaking the page", async ({
  page,
  request,
}, info) => {
  test.setTimeout(120_000);
  const cleanup: string[] = [];
  try {
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Emptied passage novel", mode: "roleplay", characterIds: [] },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    cleanup.push(`/api/chats/${chat.id}`);
    const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { roleplayDisplayStyle: "novel", enableAgents: false },
    });
    expect(metadata.ok(), await metadata.text()).toBeTruthy();
    const ids: string[] = [];
    for (const content of [
      "The first passage.\n\nIts second paragraph.",
      "The second passage.",
      "The third passage.",
      "The fourth passage.",
    ]) {
      const response = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", characterId: null, content },
      });
      ids.push(((await response.json()) as { id: string }).id);
    }
    const messageIds = async () =>
      ((await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{ id: string }>).map(
        (message) => message.id,
      );

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await openChat(page, chat.id);
    const passageText = (id: string) => page.locator(`[data-message-id="${id}"] .mari-novel-paragraph`);
    await expect(passageText(ids[0]!)).toHaveCount(2);
    if (info.project.name.includes("mobile")) {
      // A phone has no margin for the actions: a passage shows them once tapped, or once the caret moves
      // into it, and the others keep their one-line gap.
      const actions = (id: string) => page.locator(`[data-message-id="${id}"] .mari-novel-passage-actions`);
      await expect(actions(ids[1]!)).toBeHidden();
      await passageText(ids[1]!).tap();
      await expect(actions(ids[1]!)).toBeVisible();
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowDown");
      await expect(actions(ids[2]!)).toBeVisible();
      await expect(actions(ids[3]!)).toBeHidden();
    }
    if (info.project.name.includes("desktop")) {
      // A one-line passage is only as tall as its line: the margin toolbar beside it adds no height.
      const row = page.locator(`[data-message-id="${ids[1]}"]`);
      await row.hover();
      const rowBox = (await row.boundingBox())!;
      const lineBox = (await passageText(ids[1]!).boundingBox())!;
      expect(rowBox.height - lineBox.height).toBeLessThan(4);
    }

    const emptyPassage = async (id: string) => {
      await passageText(id).first().click();
      await page.evaluate((messageId) => {
        const paragraphs = document.querySelectorAll(`[data-message-id="${messageId}"] .mari-novel-paragraph`);
        const range = document.createRange();
        range.setStart(paragraphs[0]!.firstChild!, 0);
        const last = paragraphs[paragraphs.length - 1]!.firstChild!;
        range.setEnd(last, last.textContent!.length);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);
      }, id);
      await page.keyboard.press("Backspace");
      await expect(passageText(id)).toHaveText([""]);
    };
    const dialog = page.getByRole("dialog");

    // Cancelling keeps the passage, with its text back.
    await emptyPassage(ids[0]!);
    await passageText(ids[2]!).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(passageText(ids[0]!)).toHaveText(["The first passage.", "Its second paragraph."]);

    // Leaving by clicking outside the page works the same way, and confirming deletes the message.
    await emptyPassage(ids[1]!);
    await page.locator(".mari-chat-input-textarea").click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete this message" }).click();
    await expect.poll(messageIds).toEqual([ids[0], ids[2], ids[3]]);
    await expect(page.locator(`[data-message-id="${ids[1]}"]`)).toHaveCount(0);
    await expect(passageText(ids[2]!)).toHaveText(["The third passage."]);

    // A delete reaching across passages can empty one the caret never enters: its text comes back and the
    // dialog asks about it, rather than the empty passage skipping its save and reappearing on reload.
    await passageText(ids[0]!).last().click();
    await page.evaluate(
      ([fromId, toId]) => {
        const from = document.querySelector(`[data-message-id="${fromId}"] .mari-novel-paragraph:last-child`)!;
        const to = document.querySelector(`[data-message-id="${toId}"] .mari-novel-paragraph`)!;
        const range = document.createRange();
        range.setStart(from.firstChild!, "Its second".length);
        range.setEnd(to.firstChild!, "The fourth".length);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);
      },
      [ids[0]!, ids[3]!],
    );
    await page.keyboard.press("Backspace");
    await expect(dialog).toBeVisible();
    await expect(passageText(ids[2]!)).toHaveText(["The third passage."]);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(passageText(ids[0]!)).toHaveText(["The first passage.", "Its second"]);
    await expect(passageText(ids[3]!)).toHaveText([" passage."]);
    await expect(passageText(ids[2]!)).toHaveText(["The third passage."]);
    await expect
      .poll(async () =>
        ((await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{ content: string }>).map(
          (message) => message.content,
        ),
      )
      .toEqual(["The first passage.\n\nIts second", "The third passage.", " passage."]);
    await page.screenshot({ path: info.outputPath("novel-emptied.png") });
    expect(errors).toEqual([]);

    // A passage that fails to save is reported once, not by both the editor and the bar.
    await page.route(`**/api/chats/${chat.id}/messages`, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 500, json: { error: "Synthetic create failure" } })
        : route.fallback(),
    );
    await page.locator(".mari-novel-draft .mari-novel-paragraph").click();
    await page.keyboard.type("A line that will not save.");
    // A dispatched click keeps the editor focused, so only Send's own flush tries to save the line.
    await page.getByRole("button", { name: "Send", exact: true }).dispatchEvent("click");
    const failureToasts = async () =>
      (await page.locator("[data-sonner-toast]").allTextContents()).filter((text) =>
        text.includes("Synthetic create failure"),
      ).length;
    await expect.poll(failureToasts).toBe(1);
    await page.waitForTimeout(500);
    expect(await failureToasts()).toBe(1);
    await page.unroute(`**/api/chats/${chat.id}/messages`);

    // An edit that fails to save stops Send too: it is reported once, and no passage is asked for.
    const generateRequests: string[] = [];
    page.on("request", (req) => {
      if (/\/api\/generate(\?|$)/.test(new URL(req.url()).pathname)) generateRequests.push(req.url());
    });
    await page.route(`**/api/chats/${chat.id}/messages/${ids[2]}`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, json: { error: "Synthetic edit failure" } })
        : route.fallback(),
    );
    await passageText(ids[2]!).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Changed.");
    await page.locator(".mari-chat-input-textarea").fill("");
    await page.getByRole("button", { name: "Send", exact: true }).dispatchEvent("click");
    const editFailureToasts = async () =>
      (await page.locator("[data-sonner-toast]").allTextContents()).filter((text) =>
        text.includes("Synthetic edit failure"),
      ).length;
    await expect.poll(editFailureToasts).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(1000);
    expect(generateRequests).toEqual([]);
  } finally {
    for (const path of cleanup) await request.delete(path).catch(() => undefined);
  }
});

test("italic and bold show as marks and save back as markdown", async ({ page, request }) => {
  test.setTimeout(120_000);
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Marked novel", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  try {
    const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { roleplayDisplayStyle: "novel", enableAgents: false },
    });
    expect(metadata.ok(), await metadata.text()).toBeTruthy();
    const ids: string[] = [];
    // The first passage keeps its single line breaks; the second, never edited, is never rewritten.
    for (const content of [
      "She knew it.\n*A thought.* Then **more**.",
      "Untouched _x_ and 5 * 3 *.\n\n# Not a heading",
    ]) {
      const response = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", characterId: null, content },
      });
      ids.push(((await response.json()) as { id: string }).id);
    }
    const contents = async () =>
      ((await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{ content: string }>).map(
        (message) => message.content,
      );
    const patched: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && /\/messages\/[^/]+$/.test(req.url())) patched.push(req.url().split("/").at(-1)!);
    });

    await openChat(page, chat.id);
    const first = page.locator(`[data-message-id="${ids[0]}"] .mari-novel-paragraph`);
    const second = page.locator(`[data-message-id="${ids[1]}"] .mari-novel-paragraph`);
    await expect(first.nth(1).locator("em")).toHaveText("A thought.");
    await expect(first.nth(1).locator("strong")).toHaveText("more");
    await expect(second).toHaveText(["Untouched x and 5 * 3 *.", "# Not a heading"]);
    await expect(second.locator("em")).toHaveText("x");

    // Select a word and toggle it with the keyboard.
    const select = (index: number, word: string) =>
      first.nth(index).evaluate((p, word) => {
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        let text = walker.nextNode();
        while (text && !text.textContent!.includes(word)) text = walker.nextNode();
        const start = text!.textContent!.indexOf(word);
        const range = document.createRange();
        range.setStart(text!, start);
        range.setEnd(text!, start + word.length);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);
      }, word);
    await first.first().click();
    await select(0, "She");
    await page.keyboard.press("ControlOrMeta+b");
    await expect(first.first().locator("strong")).toHaveText("She");
    await expect.poll(async () => (await contents())[0]).toBe("**She** knew it.\n*A thought.* Then **more**.");
    await select(0, "knew");
    await page.keyboard.press("ControlOrMeta+i");
    await expect(first.first().locator("em")).toHaveText("knew");
    await expect.poll(async () => (await contents())[0]).toBe("**She** *knew* it.\n*A thought.* Then **more**.");

    await page.waitForTimeout(1_500);
    expect(patched.length).toBeGreaterThan(0);
    expect(patched.every((id) => id === ids[0])).toBe(true);
    expect((await contents())[1]).toBe("Untouched _x_ and 5 * 3 *.\n\n# Not a heading");
  } finally {
    await request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("a passage whose text is hidden cannot be edited through the page", async ({ page, request }) => {
  test.setTimeout(120_000);
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Hidden passage novel", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  try {
    const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { roleplayDisplayStyle: "novel", enableAgents: false },
    });
    expect(metadata.ok(), await metadata.text()).toBeTruthy();
    const ids: string[] = [];
    for (const content of ["The first passage.", "The second passage."]) {
      const response = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", characterId: null, content },
      });
      ids.push(((await response.json()) as { id: string }).id);
    }
    const contents = async () =>
      ((await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{ content: string }>)
        .slice(0, 2)
        .map((message) => message.content);

    await openChat(page, chat.id, {
      summaryPopoverSettings: {
        sourceMode: "last",
        contextSize: null,
        rangeStart: null,
        rangeEnd: null,
        hideSummarisedMessages: false,
        collapseHiddenMessages: true,
      },
    });
    const first = page.locator(`[data-message-id="${ids[0]}"] .mari-novel-paragraph`);
    const second = page.locator(`[data-message-id="${ids[1]}"] .mari-novel-paragraph`);
    await first.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Then more.");
    await expect.poll(contents).toEqual(["The first passage. Then more.", "The second passage."]);

    // Hidden from the model and collapsed, the first passage's text stays in the editor but out of sight.
    const hidden = await request.patch(`/api/chats/${chat.id}/messages/${ids[0]}/extra`, {
      data: { hiddenFromAI: true },
    });
    expect(hidden.ok(), await hidden.text()).toBeTruthy();
    await page.locator(".mari-chat-input-textarea").fill("/sys Chapter Two");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(first).toBeHidden();

    // Undo would take back the edit inside the hidden passage, where the writer cannot see it; it is refused.
    await second.click();
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(1_500);
    expect(await contents()).toEqual(["The first passage. Then more.", "The second passage."]);
    await expect(second).toHaveText(["The second passage."]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("typing is saved to its own chat and swipe before the page moves on", async ({ page, request }, info) => {
  test.setTimeout(120_000);
  const { prompts, port, close } = await startFixtureProvider();
  const cleanup: string[] = [];
  try {
    const connectionResponse = await request.post("/api/connections", {
      data: {
        name: "Novel save fixture provider",
        provider: "custom",
        baseUrl: `http://127.0.0.1:${port}/v1`,
        apiKey: "synthetic-test-key",
        model: "novel-fixture",
        maxContext: 32768,
        treatAsLocalEndpoint: true,
      },
    });
    expect(connectionResponse.ok(), await connectionResponse.text()).toBeTruthy();
    const connection = (await connectionResponse.json()) as { id: string };
    cleanup.push(`/api/connections/${connection.id}`);
    const createNovel = async (name: string, content: string) => {
      const chatResponse = await request.post("/api/chats", {
        data: { name, mode: "roleplay", characterIds: [], connectionId: connection.id },
      });
      expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
      const chat = (await chatResponse.json()) as { id: string };
      cleanup.push(`/api/chats/${chat.id}`);
      const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { roleplayDisplayStyle: "novel", enableAgents: false },
      });
      expect(metadata.ok(), await metadata.text()).toBeTruthy();
      const message = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", characterId: null, content },
      });
      return { chatId: chat.id, messageId: ((await message.json()) as { id: string }).id };
    };
    const first = await createNovel("Saved on the way out", "The first book.");
    const second = await createNovel("Opened next", "The second book.");
    const added = await request.post(`/api/chats/${second.chatId}/messages/${second.messageId}/swipes/bulk`, {
      data: { contents: ["Another telling."] },
    });
    expect(added.ok(), await added.text()).toBeTruthy();
    const content = async (chatId: string) =>
      ((await (await request.get(`/api/chats/${chatId}/messages`)).json()) as Array<{ content: string }>)[0]?.content;

    await openChat(page, first.chatId, { guideGenerations: true });
    const firstText = page.locator(`[data-message-id="${first.messageId}"] .mari-novel-paragraph`);
    await firstText.click();
    await page.keyboard.press("End");
    // Typing then opening another chat before the save is due: the save made on the way out is the first
    // chat's own, not the chat opening.
    const save = page.waitForRequest(
      (req) => req.method() === "PATCH" && req.url().endsWith(`/messages/${first.messageId}`),
    );
    await page.keyboard.type(" Then more.");
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, second.chatId);
    expect((await save).url()).toContain(`/chats/${first.chatId}/messages/`);
    await expect.poll(() => content(first.chatId)).toBe("The first book. Then more.");
    const secondText = page.locator(`[data-message-id="${second.messageId}"] .mari-novel-paragraph`);
    await expect(secondText).toHaveText("The second book.");

    // Changing swipes saves the typing to the swipe it was typed on first: the switch waits for the save.
    const order: string[] = [];
    await page.route(`**/api/chats/${second.chatId}/messages/${second.messageId}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      order.push("saved");
      await route.fulfill({ response });
    });
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().endsWith(`/messages/${second.messageId}/active-swipe`))
        order.push("switched");
    });
    await secondText.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Edited.");
    await page
      .locator(`[data-message-id="${second.messageId}"]`)
      .getByRole("button", { name: "Next swipe", exact: true })
      .click();
    await expect(secondText).toHaveText("Another telling.");
    expect(order).toEqual(["saved", "switched"]);
    await expect
      .poll(async () =>
        (
          (await (
            await request.get(`/api/chats/${second.chatId}/messages/${second.messageId}/swipes`)
          ).json()) as Array<{
            content: string;
          }>
        ).map((swipe) => swipe.content),
      )
      .toEqual(["The second book. Edited.", "Another telling."]);

    // Regenerating with guidance saves the typing first too, so it stays on the swipe being replaced, and
    // steers the new passage with the novel's instruction, not the Roleplay one.
    page.on("request", (req) => {
      if (req.method() === "POST" && new URL(req.url()).pathname === "/api/generate") order.push("generated");
    });
    await page.locator(".mari-chat-input-textarea").fill("the fog lifts");
    await secondText.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Again.");
    await page
      .locator(`[data-message-id="${second.messageId}"]`)
      .getByRole("button", { name: "Regenerate (guided)", exact: true })
      .click();
    // A touch screen asks first.
    if (info.project.name.includes("mobile"))
      await page.getByRole("dialog").getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect.poll(() => prompts.length, { timeout: 30_000 }).toBe(1);
    expect(order).toEqual(["saved", "switched", "saved", "generated"]);
    expect(prompts[0]).toContain(buildNovelGuideInstructionMessage("the fog lifts"));
    expect(prompts[0]).not.toContain("do not include a reply from");
    await expect
      .poll(async () =>
        (
          (await (
            await request.get(`/api/chats/${second.chatId}/messages/${second.messageId}/swipes`)
          ).json()) as Array<{ content: string }>
        ).map((swipe) => swipe.content),
      )
      .toEqual(["The second book. Edited.", "Another telling. Again.", REPLY]);
  } finally {
    for (const path of cleanup) await request.delete(path).catch(() => undefined);
    await close();
  }
});
