import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { DEFAULT_IMAGE_CAPTIONING_PROMPT } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("image captioning prompt shows under the toggle, saves, and resets", async ({ page, request }, testInfo) => {
  const connection = await (
    await request.post("/api/connections", {
      data: { name: "Caption prompt fixture", provider: "custom", model: "fixture", baseUrl: "http://127.0.0.1:9/v1" },
    })
  ).json();
  const chat = await (
    await request.post("/api/chats", {
      data: { name: "Caption prompt", mode: "conversation", characterIds: [], connectionId: connection.id },
    })
  ).json();
  try {
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: { conversationSetupComplete: true } });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ chatId, appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      },
      { chatId: chat.id, appVersion: version },
    );
    const section = page.locator('.mari-chat-settings-drawer [data-chat-settings-section="advanced-parameters"]');
    const prompt = section.getByRole("textbox", { name: "Captioning Prompt", exact: true });
    const reset = section.getByRole("button", { name: "Reset to default prompt", exact: true });
    const openSettings = async () => {
      await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
      await section.getByText("Advanced Parameters", { exact: true }).click();
    };
    const readMeta = async () => {
      const saved = await (await request.get(`/api/chats/${chat.id}`)).json();
      return typeof saved.metadata === "string" ? JSON.parse(saved.metadata) : saved.metadata;
    };

    await page.goto("/");
    await openSettings();
    await expect(prompt).toHaveCount(0);
    await section.getByText("Image Captioning", { exact: true }).click();
    await expect.poll(async () => (await readMeta()).imageCaptioningEnabled).toBe(true);
    await expect(prompt).toHaveValue(DEFAULT_IMAGE_CAPTIONING_PROMPT);
    await expect(reset).toHaveCount(0);

    await prompt.fill("Describe every detail, including colors.");
    await prompt.blur();
    await expect
      .poll(async () => (await readMeta()).imageCaptioningPrompt)
      .toBe("Describe every detail, including colors.");
    await page.reload();
    await openSettings();
    await expect(prompt).toHaveValue("Describe every detail, including colors.");

    await reset.click();
    await expect.poll(async () => (await readMeta()).imageCaptioningPrompt ?? null).toBeNull();
    await expect(prompt).toHaveValue(DEFAULT_IMAGE_CAPTIONING_PROMPT);
    await expect(reset).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/connections/${connection.id}`);
  }
});

test("image captioning sends the chat's prompt and reports a broken captioning connection", async ({
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Provider integration uses one isolated desktop fixture.");
  const requests: Array<{ stream?: boolean; messages: unknown[] }> = [];
  const provider = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    incoming.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests.push(body);
      if (body.stream === false) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ choices: [{ index: 0, message: { content: "A red apple." } }] }));
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      response.end(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Nice apple." }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
      );
    });
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Provider fixture did not bind");
  const cleanup: string[] = [];
  try {
    const post = async (path: string, data: unknown) => {
      const created = await (await request.post(path, { data })).json();
      cleanup.unshift(`${path}/${created.id}`);
      return created;
    };
    const main = await post("/api/connections", {
      name: "Caption route fixture",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "fixture",
      model: "fixture",
      maxContext: 32768,
    });
    const broken = await post("/api/connections", {
      name: "Caption broken fixture",
      provider: "custom",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "fixture",
      model: "fixture",
    });
    const character = await post("/api/characters", { data: { name: "Grocer", description: "Talks about fruit." } });
    const chat = await post("/api/chats", {
      name: "Caption route",
      mode: "roleplay",
      characterIds: [character.id],
      connectionId: main.id,
    });
    await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: false, imageCaptioningEnabled: true, imageCaptioningConnectionId: broken.id },
    });
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "user",
        content: "What is this?",
        extra: { attachments: [{ type: "image/png", filename: "apple.png", data: PNG }] },
      },
    });

    // A broken captioning connection stops the turn with an error; the chat model never gets the raw image.
    const failed = await (await request.post("/api/generate", { data: { chatId: chat.id } })).text();
    expect(failed).toContain('"type":"error"');
    expect(failed).toContain("Image captioning failed for");
    expect(requests).toHaveLength(0);

    // A working captioning connection gets the chat's own prompt, and the chat model gets only the caption.
    await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { imageCaptioningConnectionId: main.id, imageCaptioningPrompt: "List every fruit you see." },
    });
    const generated = await (await request.post("/api/generate", { data: { chatId: chat.id } })).text();
    expect(generated).not.toContain('"type":"error"');
    expect(requests[0]?.stream).toBe(false);
    expect(JSON.stringify(requests[0]?.messages[0])).toContain("List every fruit you see.");
    expect(JSON.stringify(requests.at(-1)?.messages)).toContain("A red apple.");
    expect(JSON.stringify(requests.at(-1)?.messages)).not.toContain("image_url");
  } finally {
    for (const path of cleanup) await request.delete(path);
    await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  }
});
