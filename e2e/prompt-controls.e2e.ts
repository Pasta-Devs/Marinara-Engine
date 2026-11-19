import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chooseOption } from "./select-field.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("typed illustration prompts wait for review and send only the confirmed subject", async ({ page, request }) => {
  const resources: string[] = [];
  try {
    const connection = await (
      await request.post("/api/connections", {
        data: { name: "Illustration review fixture", provider: "custom", baseUrl: "http://127.0.0.1:9/v1" },
      })
    ).json();
    resources.push(`/api/connections/${connection.id}`);
    const chat = await (
      await request.post("/api/chats", {
        data: { name: "Illustration review", mode: "roleplay", characterIds: [], connectionId: connection.id },
      })
    ).json();
    resources.push(`/api/chats/${chat.id}`);
    const historicalMessage = await (
      await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "assistant", content: "A quiet room." } })
    ).json();
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({
        json: [
          {
            id: "illustrator",
            version: "1.0.0",
            status: "active",
            readiness: "ready",
            manifest: {
              schemaVersion: 1,
              id: "illustrator",
              name: "Illustrator",
              version: "1.0.0",
              engine: { min: "2.0.0", maxExclusive: "3.0.0" },
              kind: ["agent"],
              entrypoints: { agents: "agents.json" },
              permissions: ["agent-runtime"],
              files: [],
            },
          },
        ],
      }),
    );
    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: [
          {
            id: "illustrator",
            name: "Illustrator",
            phase: "post_processing",
            execution: "feature",
            enabledByDefault: false,
            category: "misc",
            defaultPromptTemplate: "Plan an image.",
          },
        ],
      }),
    );
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    const calls: Record<string, unknown>[] = [];
    await page.route("**/api/generate/retry-agents", (route) => {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ contentType: "text/event-stream", body: "event: done\ndata: {}\n\n" });
    });
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay"],
      reviewImagePromptsBeforeSend: true,
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    const input = page.locator("textarea[data-chat-composer]");
    const send = async () => {
      await input.fill("/illustrate cup of tea");
      await page.locator(".mari-chat-send-btn").click();
    };
    await send();
    const dialog = page.getByRole("dialog", { name: "Review Image Prompt", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveValue("cup of tea");
    expect(calls).toHaveLength(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(calls).toHaveLength(0);
    await send();
    await dialog.getByRole("textbox").fill("cup of green tea");
    await dialog.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]?.illustratorPromptReviewOverride).toMatchObject({
      prompt: "cup of green tea",
      subjectOnly: true,
      resultData: { characters: [] },
    });
    await expect(dialog).not.toBeVisible();
    await input.fill("/illustrate range=1 cup of tea");
    // WebKit once sent an empty composer here (37469221766). Fail on the composer, not on the missing review dialog.
    await expect(input).toHaveValue("/illustrate range=1 cup of tea");
    await page.locator(".mari-chat-send-btn").click();
    await expect(dialog).toBeVisible();
    expect(calls).toHaveLength(1);
    // A new message during review must not move the selected image to the newest reply.
    await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "assistant", content: "A later scene." } });
    await dialog.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]?.illustratorMessageRange).toEqual([historicalMessage.id, historicalMessage.id]);
    await expect(dialog).not.toBeVisible();

    await page.route("**/api/generate/retry-agents", (route) => {
      const body = route.request().postDataJSON();
      calls.push(body);
      return route.fulfill({
        contentType: "text/event-stream",
        body: body.illustratorPromptReviewOverride
          ? "event: done\ndata: {}\n\n"
          : `data: ${JSON.stringify({ type: "image_prompt_review", data: { chatId: chat.id, resultData: { prompt: "Historical room", characters: [] }, item: { id: "roleplay-scene-illustration", kind: "illustration", title: "Scene illustration", prompt: "Historical room" } } })}\n\ndata: {"type":"done","data":{}}\n\n`,
      });
    });
    await input.fill("/illustrate range=1");
    await page.locator(".mari-chat-send-btn").click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => calls.length).toBe(4);
    expect(calls[2]?.illustratorMessageRange).toEqual([historicalMessage.id, historicalMessage.id]);
    expect(calls[3]?.illustratorMessageRange).toEqual([historicalMessage.id, historicalMessage.id]);
    await expect(dialog).not.toBeVisible();
    // template=: the server writes the prompt with that Prompt Mode first, and the resume keeps references.
    await input.fill("/illustrate template=default range=1 cup of tea");
    await expect(input).toHaveValue("/illustrate template=default range=1 cup of tea");
    await page.locator(".mari-chat-send-btn").click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveValue("Historical room");
    expect(calls[4]).toMatchObject({
      agentPromptTemplateIds: { illustrator: "default" },
      illustratorRequest: "cup of tea",
      illustratorMessageRange: [historicalMessage.id, historicalMessage.id],
    });
    expect(calls[4]).not.toHaveProperty("illustratorPromptReviewOverride");
    await dialog.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => calls.length).toBe(6);
    expect(calls[5]?.illustratorPromptReviewOverride).toMatchObject({ prompt: "Historical room" });
    expect(calls[5]?.illustratorPromptReviewOverride).not.toHaveProperty("subjectOnly");
    await expect(dialog).not.toBeVisible();
    const conversation = await (
      await request.post("/api/chats", {
        data: { name: "Conversation review", mode: "conversation", characterIds: [], connectionId: connection.id },
      })
    ).json();
    resources.push(`/api/chats/${conversation.id}`);
    await request.post(`/api/chats/${conversation.id}/messages`, {
      data: { role: "assistant", content: "Conversation fixture." },
    });
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, conversation.id);
    await expect(page.getByText("Conversation fixture.", { exact: true })).toBeVisible();
    await page.evaluate(
      (id) =>
        window.dispatchEvent(
          new CustomEvent("marinara:image-prompt-review", {
            detail: {
              chatId: id,
              resultData: { prompt: "A reviewed scene", characters: [] },
              item: { id: "conversation-review", kind: "illustration", title: "Scene", prompt: "A reviewed scene" },
            },
          }),
        ),
      conversation.id,
    );
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveValue("A reviewed scene");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(calls).toHaveLength(6);
  } finally {
    await Promise.all(resources.map((path) => request.delete(path)));
  }
});

test("prompt controls persist and preview preserves the selected history shape", async ({
  page,
  request,
}, testInfo) => {
  page.setDefaultTimeout(10_000);
  const resources: string[] = [];
  const create = async (path: string, data: Record<string, unknown>) => {
    const response = await request.post(path, { data });
    expect(response.ok()).toBeTruthy();
    const row = await response.json();
    resources.unshift(`${path}/${row.id}`);
    return row;
  };
  try {
    const connection = await create("/api/connections", {
      name: "Prompt controls",
      provider: "nanogpt",
      model: "fixture",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "",
    });
    expect(
      (
        await request.put(`/api/connections/${connection.id}/default-parameters`, {
          data: { serviceTier: "flex", customHeaders: { "X-Provider": "first" } },
        })
      ).ok(),
    ).toBeTruthy();
    const preset = await create("/api/prompts", { name: "History shape", wrapFormat: "none" });
    for (const [order, data] of [
      { identifier: "rules", name: "Rules", role: "system", content: "SYSTEM_RULES" },
      { identifier: "world", name: "World", role: "system", content: "SYSTEM_WORLD" },
      { identifier: "history", name: "History", isMarker: true, markerConfig: { type: "chat_history" } },
    ].entries()) {
      expect(
        (await request.post(`/api/prompts/${preset.id}/sections`, { data: { ...data, order } })).ok(),
      ).toBeTruthy();
    }
    const chat = await create("/api/chats", {
      name: "History controls",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    for (const [role, content] of [
      ["user", "HISTORY_ONE"],
      ["user", "HISTORY_TWO"],
      ["assistant", "HISTORY_THREE"],
      ["assistant", "HISTORY_FOUR"],
    ]) {
      expect((await request.post(`/api/chats/${chat.id}/messages`, { data: { role, content } })).ok()).toBeTruthy();
    }
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      chibiProfessorMariEnabled: false,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay"],
    });
    await page.addInitScript(
      ({ id, appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      },
      { id: chat.id, appVersion: version },
    );
    await page.goto("/");
    const openSettings = async () => {
      await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
      await page
        .locator('[data-chat-settings-section="advanced-parameters"]')
        .getByText("Advanced Parameters", { exact: true })
        .click();
    };
    const selector = page.getByRole("combobox", { name: "Post-Processing Messages" });
    const savedParameters = async () => {
      const row = await (await request.get(`/api/chats/${chat.id}`)).json();
      const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      return meta.chatParameters ?? {};
    };
    const preview = async () => {
      const response = await request.post("/api/generate/dryRun", { data: { chatId: chat.id, returnPrompt: true } });
      expect(response.ok()).toBeTruthy();
      return (await response.json()).prompt.messages as Array<{ role: string; content: string }>;
    };
    await openSettings();
    await expect(selector).toHaveAttribute("data-value", "apply");
    await expect(page.getByText("Service Tier", { exact: true })).toBeVisible();
    await chooseOption(page, selector, "Don't Apply");
    await expect.poll(async () => (await savedParameters()).strictRoleFormatting).toBe(false);
    await page.reload();
    await openSettings();
    await expect(selector).toHaveAttribute("data-value", "none");
    let prompt = await preview();
    expect(prompt.some((m) => m.content.includes("HISTORY_ONE") && m.content.includes("HISTORY_TWO"))).toBe(false);
    expect(prompt[0]?.role).toBe("system");
    expect(prompt[0]?.content).toContain("SYSTEM_RULES");
    expect(prompt[0]?.content).toContain("SYSTEM_WORLD");
    await chooseOption(page, selector, "Single User Message");
    await expect.poll(async () => (await savedParameters()).singleUserMessage).toBe(true);
    prompt = await preview();
    expect(prompt.map((m) => m.role)).toEqual(["system", "user"]);
    expect(prompt[1]?.content).toContain("HISTORY_FOUR");
    await chooseOption(page, selector, "Apply");
    await expect.poll(async () => (await savedParameters()).strictRoleFormatting).toBe(true);
    prompt = await preview();
    expect(prompt.some((m) => m.content.includes("HISTORY_ONE") && m.content.includes("HISTORY_TWO"))).toBe(true);
    await testInfo.attach("post-processing-controls", { body: await page.screenshot(), contentType: "image/png" });
    await page.getByRole("button", { name: "Close chat settings", exact: true }).click();

    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
    }, connection.id);
    const editor = page.locator(".mari-editor-shell");
    const headers = editor.getByRole("textbox", { name: "Custom Request Headers", exact: true });
    await expect(headers).toHaveValue(/X-Provider/);
    await headers.fill('{"X-Provider":"second"}');
    await headers.blur();
    await editor.getByRole("button", { name: "Priority", exact: true }).click();
    // The editor saves its defaults first, with the real header value in the body.
    const defaultsRequest = page.waitForRequest(
      (req) =>
        req.method() === "PUT" &&
        new URL(req.url()).pathname === `/api/connections/${connection.id}/default-parameters`,
    );
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    expect((await defaultsRequest).postDataJSON().customHeaders).toEqual({ "X-Provider": "second" });
    // Header values are stored encrypted and read back masked; the header name stays visible.
    await expect
      .poll(async () => {
        const row = await (await request.get(`/api/connections/${connection.id}`)).json();
        return JSON.parse(row.defaultParameters).serviceTier;
      })
      .toBe("priority");
    const stored = await (await request.get(`/api/connections/${connection.id}`)).json();
    expect(JSON.parse(stored.defaultParameters).customHeaders).toEqual({ "X-Provider": "••••••••" });
    await testInfo.attach("connection-header-controls", { body: await page.screenshot(), contentType: "image/png" });

    const received = await page.evaluate(async (chatId) => {
      const { matchSlashCommand } = await import("/src/lib/slash-commands.ts" as string);
      const calls: Array<string | null> = [];
      for (const text of ["/illustrate cup of tea", "/illustrate"]) {
        const match = matchSlashCommand(text);
        await match.command.execute(match.args, {
          chatId,
          illustrate: (prompt?: string) => {
            calls.push(prompt ?? null);
          },
        });
      }
      return calls;
    }, chat.id);
    expect(received).toEqual(["cup of tea", null]);
  } finally {
    await Promise.all(resources.map((path) => request.delete(path)));
  }
});
