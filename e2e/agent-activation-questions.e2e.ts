import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
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
  const openDefaults = async () => {
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
      useUIStore.getState().openRightPanel("connections");
    });
    const expand = page.getByRole("button", { name: "Expand connection defaults" });
    await expect(expand.or(page.getByRole("button", { name: "Collapse connection defaults" }))).toBeVisible();
    if (await expand.isVisible()) await expand.click();
    await expect(page.getByLabel("Decision model", { exact: true })).toBeVisible();
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
    // Local model entries are always listed, never hidden: a user who was told
    // activation questions work with their own local model must be able to see why
    // the entry is not selectable rather than wonder where it went.
    const decisionModel = page.getByLabel("Decision model", { exact: true });
    await expect(decisionModel.locator("optgroup[label='Local models']")).toHaveCount(1);
    const primary = decisionModel.locator("option[value='sidecar:local']");
    await expect(primary).toHaveCount(1);
    await expect(primary).toBeDisabled();
    await expect(primary).toContainText("No model downloaded");
    // The managed decision sidecar is listed too, disabled, with whichever reason
    // applies to this machine: it has not been turned on, nothing is installed, or
    // the platform cannot run it. Each is a different fix, so the text is not
    // pinned to one of them.
    const decisionSidecar = decisionModel.locator("option[value='decision-sidecar:local']");
    await expect(decisionSidecar).toHaveCount(1);
    await expect(decisionSidecar).toBeDisabled();
    await expect(decisionSidecar).toContainText(/Not enabled|Not installed|Requires/u);
    await decisionModel.selectOption(connection.id);
    await page.getByRole("button", { name: "Test", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Probability of yes: 0.800" })).toBeVisible();
    reject = true;
    await page.getByRole("button", { name: "Test", exact: true }).click();
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
    await page.getByLabel("Decision model", { exact: true }).selectOption("");
    await openAgent();
    await expect(question).toBeDisabled();
    await expect(question).toHaveValue("Did {{char}} enter a new location?");
  } finally {
    await request.delete(`/api/agents/${agent.id}`);
    await request.delete(`/api/connections/${connection.id}`);
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
  await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  const response = await request.post("/api/connections", {
    data: {
      name: `Borrowed key ${testInfo.project.name}`,
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "fixture-only",
      model: "fixture",
    },
  });
  expect(response.ok()).toBeTruthy();
  const source = await response.json();
  let linkedId = "";
  const open = async (id: string) => {
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
    }, id);
    await expect(page.getByPlaceholder("Connection name")).toBeVisible();
  };
  try {
    await page.goto("/");
    await open(source.id);
    await page.getByRole("button", { name: "Use this key for decisions (Jev)", exact: true }).click();
    await expect(page.getByLabel("Decision source", { exact: true })).toHaveValue("openrouter");
    await expect(page.getByLabel("API key source", { exact: true })).toHaveValue(source.id);
    const rows = await (await request.get("/api/connections")).json();
    const linked = rows.find(
      (row: { credentialsFromConnectionId?: string }) => row.credentialsFromConnectionId === source.id,
    );
    expect(linked).toMatchObject({ provider: "decision", defaultForAgents: "true", apiKeyEncrypted: "" });
    linkedId = linked.id;
    await open(source.id);
    await page.getByRole("button", { name: "Delete connection", exact: true }).click();
    const firstDialog = page.getByRole("dialog");
    await firstDialog.getByRole("button", { name: "Delete", exact: true }).click();
    const linkedDialog = page.getByRole("dialog");
    await expect(linkedDialog).toContainText("This key is used for decisions");
    await linkedDialog.getByRole("button", { name: "Delete connection", exact: true }).click();
    await expect.poll(async () => (await request.get(`/api/connections/${source.id}`)).status()).toBe(404);
    await open(linkedId);
    await expect(page.getByLabel("API key source", { exact: true }).locator("option:checked")).toContainText(
      "missing or incompatible",
    );
    await page.getByRole("button", { name: "Test Connection", exact: true }).click();
    await expect(
      page.getByText(
        "Decision test failed: Linked connection is missing or incompatible. Choose another or enter a key.",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    if (linkedId) await request.delete(`/api/connections/${linkedId}`);
    await request.delete(`/api/connections/${source.id}`);
  }
});
