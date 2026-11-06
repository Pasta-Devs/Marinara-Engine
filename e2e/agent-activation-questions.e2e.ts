import { expect, test, type Locator } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { hideExistingItems } from "./connections-panel.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Decision settings, test errors and custom-agent questions survive reload", async ({
  page,
  request,
}, testInfo) => {
  let reject = false;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    res.writeHead(reject ? 422 : 200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: "noul", noul: 0.8 }])),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing mock server port");
  // The page sees only the Model this spec makes, whatever earlier specs left on the shared server.
  await hideExistingItems(page, request, "/api/connections");
  const created = await request.post("/api/connections", {
    data: {
      name: `Decision ${testInfo.project.name}`,
      provider: "decision",
      decisionSource: "custom",
      baseUrl: `http://127.0.0.1:${address.port}`,
      model: "jev-latest",
      maxStateTokens: 3500,
    },
  });
  expect(created.ok()).toBeTruthy();
  const connection = await created.json();
  const type = `custom-decision-${testInfo.project.name}`;
  const agentResponse = await request.post("/api/agents", {
    data: {
      type,
      name: "Scene observer",
      phase: "post_processing",
      resultType: "context_injection",
      promptTemplate: "Describe the scene.",
      settings: { activationQuestion: "Did the location change?", activationThreshold: 0.6 },
    },
  });
  expect(agentResponse.ok()).toBeTruthy();
  const agent = await agentResponse.json();
  await seedUIState(
    page,
    { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false, theme: "dark" },
    "if-missing",
  );
  await page.addInitScript(
    (appVersion) => localStorage.setItem("marinara:whats-new:seen-version", appVersion),
    version,
  );
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  const openAgent = async () => {
    await page.evaluate(async (agentType) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
      useUIStore.getState().openAgentDetail(agentType);
    }, type);
    await expect(page.getByLabel("Question", { exact: true })).toBeVisible();
  };
  // #8456: Decision is one row of the Jobs box. The row opens its "Model for Decision" picker, and its gear opens
  // the rest of the job's settings in place.
  const decisionTile = page.locator('[data-defaults-tile="decision"]');
  const openDefaults = async () => {
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
      useUIStore.getState().openRightPanel("connections");
    });
    const defaults = page.locator('[data-connections-row="defaults"]');
    await expect(defaults).toBeVisible();
    if ((await defaults.getAttribute("aria-expanded")) !== "true") await defaults.click();
    await expect(decisionTile).toBeVisible();
    const gear = page.getByRole("button", { name: "Decision settings", exact: true });
    if ((await gear.getAttribute("aria-expanded")) !== "true") await gear.click();
    await expect(page.getByRole("region", { name: "Decision settings", exact: true })).toBeVisible();
  };
  const pickDecision = async (choice: (picker: Locator) => Locator) => {
    await decisionTile.click();
    const picker = page.getByRole("dialog", { name: "Model for Decision", exact: true });
    await expect(picker).toBeVisible();
    // Checked first, so a missing choice fails here and the cleanup below still runs.
    await expect(choice(picker)).toBeVisible();
    await choice(picker).click();
    await expect(picker).toBeHidden();
  };
  const screenshot = async (name: string) => {
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
    await testInfo.attach(name, { path: testInfo.outputPath(`${name}.png`), contentType: "image/png" });
  };
  try {
    await page.goto("/");
    await openAgent();
    const question = page.getByLabel("Question", { exact: true });
    await question.scrollIntoViewIfNeeded();
    await expect(question).toBeDisabled();
    await expect(question).toHaveValue("Did the location change?");
    await screenshot("activation-without-default-dark");
    await openDefaults();
    // A user who was told activation questions work with the built-in model must see why it is not offered. #8456
    // dropped the disabled built-in and decision-sidecar entries (with their reasons) from the Decision model list:
    // the picker offers only models that can answer, and the job's settings offer to set the built-in model up.
    await expect(page.getByRole("button", { name: "Set up the built-in model", exact: true })).toBeVisible();
    const smartOrder = page.getByLabel(/pick who speaks in Smart response order/u);
    // Offered once a model is chosen: with None there is nothing to ask.
    await expect(smartOrder).toHaveCount(0);
    // The only Model the page knows is this Decision connection, so the picker has no chat models to list.
    await pickDecision((picker) => picker.locator(`[data-switcher-extra="${connection.id}"]`));
    await expect(decisionTile).toContainText(connection.name);
    await expect(smartOrder).not.toBeChecked();
    await smartOrder.check();
    await expect.poll(async () => (await (await request.get("/api/decision/smart-order")).json()).enabled).toBe(true);
    // #8456: a Decision connection is tested from its Model editor; the job's own Test is left to the built-in slots.
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
      useUIStore.getState().openConnectionDetail(id);
    }, connection.id);
    const testButton = page.getByRole("button", { name: "Test provider", exact: true });
    await testButton.click();
    await expect(page.getByRole("status").filter({ hasText: "Probability of yes: 0.800" })).toBeVisible();
    reject = true;
    await testButton.click();
    await expect(page.getByRole("status").filter({ hasText: "server rejected the input" })).toBeVisible();
    await screenshot("decision-default-error-dark");
    await openAgent();
    await expect(question).toBeEnabled();
    await question.fill("Did {{char}} enter a new location?");
    await page.getByLabel("Bypass the question after this many messages without a successful run").fill("6");
    const editor = page.locator(".mari-editor-shell").filter({ has: question });
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => {
        const saved = await (await request.get(`/api/agents/${agent.id}`)).json();
        return JSON.parse(saved.settings);
      })
      .toMatchObject({
        activationQuestion: "Did {{char}} enter a new location?",
        activationThreshold: 0.6,
        activationMaxSkip: 6,
      });
    await page.reload();
    await openAgent();
    await expect(question).toHaveValue("Did {{char}} enter a new location?");
    await question.scrollIntoViewIfNeeded();
    await screenshot("activation-configured-dark");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setTheme("light");
    });
    await screenshot("activation-configured-light");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await openDefaults();
    await expect(decisionTile).toContainText(connection.name);
    await expect(smartOrder).toBeChecked();
    await pickDecision((picker) => picker.locator("[data-switcher-default]"));
    await expect(smartOrder).toHaveCount(0);
    await openAgent();
    await expect(question).toBeDisabled();
    await expect(question).toHaveValue("Did {{char}} enter a new location?");
  } finally {
    // A global setting, so it is put back for the specs that run after this one.
    await request.post("/api/decision/smart-order", { data: { enabled: false } });
    await request.delete(`/api/agents/${agent.id}`);
    await request.delete(`/api/connections/${connection.id}`);
    // The Model's account outlives its last Model (#8456).
    if (connection.accountId) await request.delete(`/api/connection-accounts/${connection.accountId}`);
    server.closeAllConnections();
    await new Promise<void>((resolve, rejectClose) =>
      server.close((error) => (error ? rejectClose(error) : resolve())),
    );
  }
});

test("generation gates post agents on the completed reply and fails open without calling keyword misses", async ({
  request,
}, testInfo) => {
  const decisionBatches: Array<Record<string, unknown>> = [];
  let probability = 0.1;
  let failDecision = false;
  let agentCalls = 0;
  const replyText = "We leave the quiet room and enter the garden.";
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (req.url === "/v1/systemone") {
      decisionBatches.push(body);
      res.writeHead(failDecision ? 503 : 200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          answers: Object.fromEntries(
            Object.keys(body.questions).map((id) => [id, { type: "noul", noul: probability }]),
          ),
        }),
      );
      return;
    }
    const isAgent = body.model === "fixture-agent";
    if (isAgent) agentCalls++;
    const batchTypes = [
      ...body.messages
        .map((message: { content: unknown }) => String(message.content))
        .join("\n")
        .matchAll(/<agent_task id="([^"]+)"/g),
    ].map((match) => match[1]!);
    const content = isAgent
      ? batchTypes.length
        ? JSON.stringify(Object.fromEntries(batchTypes.map((type) => [type, "The scene is now a garden."])))
        : "The scene is now a garden."
      : replyText;
    if (body.stream) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
      );
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing mock server port");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cleanup: string[] = [];
  const create = async (path: string, data: Record<string, unknown>) => {
    const response = await request.post(`/api/${path}`, { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    const row = await response.json();
    cleanup.push(`/api/${path}/${row.id}`);
    return row;
  };
  try {
    const main = await create("connections", {
      name: "Main fixture",
      provider: "custom",
      baseUrl: `${baseUrl}/v1`,
      model: "fixture-main",
    });
    const agentConnection = await create("connections", {
      name: "Agent fixture",
      provider: "custom",
      baseUrl: `${baseUrl}/v1`,
      model: "fixture-agent",
    });
    await create("connections", {
      name: "Decision fixture",
      provider: "decision",
      decisionSource: "custom",
      baseUrl,
      model: "jev-latest",
      defaultForAgents: true,
    });
    const suffix = testInfo.project.name;
    const gated = await create("agents", {
      type: `custom-gated-${suffix}`,
      name: "Gated",
      phase: "post_processing",
      connectionId: agentConnection.id,
      resultType: "context_injection",
      promptTemplate: "Describe the scene.",
      settings: { activationQuestion: "Did {{char}} move?", activationScanDepth: 1 },
    });
    const miss = await create("agents", {
      type: `custom-miss-${suffix}`,
      name: "Keyword miss",
      phase: "pre_generation",
      connectionId: agentConnection.id,
      resultType: "context_injection",
      promptTemplate: "Describe the scene.",
      settings: { activationKeywords: ["UNMATCHABLE_KEYWORD"], activationQuestion: "Should I run?" },
    });
    const ungated = await create("agents", {
      type: `custom-ungated-${suffix}`,
      name: "Unchanged agent",
      phase: "post_processing",
      connectionId: agentConnection.id,
      resultType: "context_injection",
      promptTemplate: "Describe the scene.",
    });
    const character = await create("characters", { data: { name: "Mara", first_mes: "" } });
    const otherCharacter = await create("characters", { data: { name: "Rowan", first_mes: "" } });
    const chat = await create("chats", {
      name: "Activation fixture",
      mode: "roleplay",
      characterIds: [character.id, otherCharacter.id],
      connectionId: main.id,
    });
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            enableAgents: true,
            groupChatMode: "individual",
            activeAgentIds: [gated.type, miss.type, ungated.type],
          },
        })
      ).ok(),
    ).toBeTruthy();
    const generate = async () => {
      const response = await request.post("/api/generate", {
        data: { chatId: chat.id, userMessage: "Continue the scene.", forCharacterId: character.id },
      });
      expect(response.ok()).toBeTruthy();
      const text = await response.text();
      expect(text).not.toContain('"type":"error"');
      expect(text).toContain(replyText);
    };
    await generate();
    expect(agentCalls).toBe(1);
    expect(decisionBatches).toHaveLength(1);
    expect(decisionBatches[0]).toMatchObject({
      questions: { [gated.id]: { instructions: "Did Mara, Rowan move?" } },
      state: { recent_messages: [{ role: "assistant", name: "Mara", content: replyText }] },
    });
    expect(Object.keys(decisionBatches[0]!.questions as object)).toEqual([gated.id]);
    probability = 0.8;
    await generate();
    expect(agentCalls).toBe(2);
    expect(decisionBatches).toHaveLength(2);
    failDecision = true;
    await generate();
    expect(agentCalls).toBe(3);
    expect(decisionBatches).toHaveLength(3);
    const runs = await (await request.get(`/api/agents/runs/${chat.id}/custom`)).json();
    expect(
      runs.filter((run: { agentType: string; success: boolean }) => run.agentType === gated.type && run.success),
    ).toHaveLength(2);
    expect(
      runs.filter((run: { agentType: string; success: boolean }) => run.agentType === ungated.type && run.success),
    ).toHaveLength(3);
    expect(runs.some((run: { agentType: string }) => run.agentType === miss.type)).toBe(false);
  } finally {
    for (const path of cleanup.reverse()) await request.delete(path);
    server.closeAllConnections();
    await new Promise<void>((resolve, rejectClose) =>
      server.close((error) => (error ? rejectClose(error) : resolve())),
    );
  }
});

test("OpenRouter decision shortcut links a key and warns before its deletion", async ({ page, request }, testInfo) => {
  // A stand-in for OpenRouter: its model list, and chat completions with log-probabilities. It keeps the key each
  // decision request carries.
  const keys: string[] = [];
  const server = createServer(async (req, res) => {
    for await (const chunk of req) void chunk;
    if (req.method === "GET" && req.url === "/v1/models") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "fixture", name: "Fixture" }] }));
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404 page not found");
      return;
    }
    keys.push(req.headers.authorization ?? "");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: { role: "assistant", content: "Yes" },
            logprobs: {
              content: [
                {
                  token: "Yes",
                  logprob: Math.log(0.8),
                  top_logprobs: [
                    { token: "Yes", logprob: Math.log(0.8) },
                    { token: "No", logprob: Math.log(0.2) },
                  ],
                },
              ],
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing mock server port");
  await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  const name = `Borrowed key ${testInfo.project.name}`;
  const response = await request.post("/api/connections", {
    data: {
      name,
      provider: "openrouter",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "fixture-only",
      model: "fixture",
    },
  });
  expect(response.ok()).toBeTruthy();
  const source = await response.json();
  const accountId: string = source.accountId;
  const rows = async () => (await (await request.get("/api/connections")).json()) as Array<Record<string, any>>;
  const status = async (path: string) => (await request.get(path)).status();
  const accountName = async (id: string) =>
    ((await (await request.get("/api/connection-accounts")).json()) as Array<Record<string, any>>).find(
      (account) => account.id === id,
    )!.name as string;
  // Done makes the new row the Decision model; the finally block puts back what earlier specs chose.
  const previousDecision = ((await (await request.get("/api/decision/options")).json()) as { selected: string | null })
    .selected;
  let linkedId = "";
  let lender: { id: string; accountId?: string | null } | null = null;
  let borrowerId = "";
  try {
    expect(accountId).toBeTruthy();
    // A Decision Model that borrows another Model's key, for the last part; made before the page loads, so the
    // page's lists have both. The lender has OpenRouter's own address, so the link holds until the deletion. Nothing
    // here sends it a request.
    const lenderName = `Lent key ${testInfo.project.name}`;
    const lent = await request.post("/api/connections", {
      data: {
        name: lenderName,
        provider: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        // A key per project: the mobile projects share one server, and one key would share one Connection.
        apiKey: `fixture-lent-${testInfo.project.name}`,
        model: "fixture",
      },
    });
    expect(lent.ok()).toBeTruthy();
    lender = await lent.json();
    const lenderId = lender!.id;
    const borrowerName = `Borrowed decisions ${testInfo.project.name}`;
    const borrowed = await request.post("/api/connections", {
      data: {
        name: borrowerName,
        provider: "decision",
        decisionSource: "openrouter",
        model: "jev-latest",
        credentialsFromConnectionId: lenderId,
      },
    });
    expect(borrowed.ok()).toBeTruthy();
    borrowerId = (await borrowed.json()).id;
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("connections");
    });
    const actions = page.getByRole("button", { name: `Actions for ${name}`, exact: true });
    await actions.scrollIntoViewIfNeeded();
    await actions.click();
    await page.getByRole("menuitem", { name: "Use this key for decisions", exact: true }).click();
    // #8456: the shortcut opens the key's Connection on its decision models, with a Decision Model for the source's
    // model made under that Connection; testing it there is what keeps it. It reaches the key through its Connection,
    // so the old editor fields (Decision source "openrouter", API key source = the source Model) and the
    // credentialsFromConnectionId link are not used by this Model.
    const dialog = page.getByRole("dialog", { name: "Add models to OpenRouter", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Test decision", exact: true }).click();
    await expect(dialog.getByText(/^Probability of yes: 0\.800/u)).toBeVisible();
    const linked = (await rows()).find((row) => row.provider === "decision" && row.accountId === accountId);
    // Kept, but not the Decision model until Done.
    expect(linked).toMatchObject({ decisionSource: "openai_compatible", model: "fixture", defaultForAgents: "false" });
    expect(linked?.credentialsFromConnectionId ?? null).toBeNull();
    linkedId = linked!.id;
    // The Decision Model has no key of its own: the test went out with the Connection's.
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys)).toEqual(new Set(["Bearer fixture-only"]));
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toBeHidden();
    // Done sets the window's job (AddFor in lib/add-connection.ts): the row becomes the Decision model, with an Undo
    // toast like a pick in "Model for Decision".
    await expect(page.getByText("Decision now uses Fixture", { exact: true })).toBeVisible();
    await expect.poll(async () => (await rows()).find((row) => row.id === linkedId)?.defaultForAgents).toBe("true");
    expect(
      (await rows())
        .filter((row) => row.accountId === accountId)
        .map((row) => row.id)
        .sort(),
    ).toEqual([source.id, linkedId].sort());
    // Deleting the key's Connection warns that its Decision Model goes too.
    const sourceAccountName = await accountName(accountId);
    // The Decision Model is named after its Connection; the card's own menu comes before its Models' menus.
    const accountActions = page
      .locator(`[data-connection-account-id="${accountId}"]`)
      .getByRole("button", { name: `Actions for ${sourceAccountName}`, exact: true })
      .first();
    await accountActions.scrollIntoViewIfNeeded();
    await accountActions.click();
    await page.getByRole("menuitem", { name: "Delete account", exact: true }).click();
    const warning = page.getByRole("dialog", { name: "Delete account", exact: true });
    await expect(warning).toContainText(`Delete ${sourceAccountName}? Its 2 models go too.`);
    await expect(warning).toContainText(name);
    await warning.getByRole("button", { name: "Delete with its 2 models", exact: true }).click();
    // The window deletes the Models one after another, then the Connection.
    await expect
      .poll(async () => [await status(`/api/connections/${linkedId}`), await status(`/api/connections/${source.id}`)])
      .toEqual([404, 404]);

    // A Decision Model can still borrow another Model's key ("API key source" in its editor). Deleting that Model
    // warns first, and the Decision Model then asks to be relinked.
    const openEditor = async (id: string) => {
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().closeAllDetails();
        useUIStore.getState().openConnectionDetail(id);
      }, id);
    };
    const keySource = page.getByLabel("API key source", { exact: true });
    await openEditor(borrowerId);
    await expect(keySource).toHaveValue(lenderId);
    await expect(keySource.locator("option:checked")).toHaveText(
      `Use key from “${await accountName(lender!.accountId!)}”`,
    );
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
      useUIStore.getState().openRightPanel("connections");
    });
    const lenderActions = page.getByRole("button", { name: `Actions for ${lenderName}`, exact: true });
    await lenderActions.scrollIntoViewIfNeeded();
    await lenderActions.click();
    await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
    const removeModel = page.getByRole("dialog", { name: "Delete model", exact: true });
    await expect(removeModel).toContainText(borrowerName);
    await removeModel.getByRole("button", { name: "Delete", exact: true }).click();
    const keyWarning = page.getByRole("dialog", { name: "This key is used for decisions", exact: true });
    await expect(keyWarning).toContainText(`${borrowerName} will need another linked account or a separate key.`);
    await keyWarning.getByRole("button", { name: "Delete account", exact: true }).click();
    await expect.poll(() => status(`/api/connections/${lenderId}`)).toBe(404);
    await openEditor(borrowerId);
    await expect(keySource).toHaveValue(lenderId);
    const relink = "Linked account is missing or incompatible. Choose another or enter a key.";
    await expect(keySource.locator("option:checked")).toHaveText(relink);
    await page.getByRole("button", { name: "Test provider", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `Decision test failed: ${relink}` })).toBeVisible();
  } finally {
    if (linkedId) await request.delete(`/api/connections/${linkedId}`);
    await request.delete(`/api/connections/${source.id}`);
    // The Model's account outlives its last Model (#8456).
    if (accountId) await request.delete(`/api/connection-accounts/${accountId}`);
    if (borrowerId) await request.delete(`/api/connections/${borrowerId}`);
    if (lender) await request.delete(`/api/connections/${lender.id}`);
    if (lender?.accountId) await request.delete(`/api/connection-accounts/${lender.accountId}`);
    await request.post("/api/decision/select", { data: { id: previousDecision } });
    server.closeAllConnections();
    await new Promise<void>((resolve, rejectClose) =>
      server.close((error) => (error ? rejectClose(error) : resolve())),
    );
  }
});
