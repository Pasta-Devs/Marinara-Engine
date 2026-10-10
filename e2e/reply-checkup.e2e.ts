// Slice 61 (R2): a trimmed or cut-off reply gets a quiet line ("… · Check") that opens the reply
// checkup, links to the exact setting, and leads the Peek header. Facts are seeded, no model runs.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const shots = fileURLToPath(new URL("../.tmp/omnibar-ux/round9/slice-61/", import.meta.url));

const fit = (patch: Record<string, unknown>) => ({
  trimmed: false,
  droppedHistory: 0,
  tokensBefore: 3000,
  tokensAfter: 3000,
  inputBudget: 7000,
  replyBudgetFrom: 1024,
  replyBudgetTo: 1024,
  ...patch,
});

async function seedChat(
  request: APIRequestContext,
  name: string,
  mode: "roleplay" | "conversation",
  generationInfo: Record<string, unknown>,
) {
  const chat = await (await request.post("/api/chats", { data: { name, mode, characterIds: [] } })).json();
  await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "user", content: "Tell me the story." } });
  const reply = await (
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "Once upon a time the castle stood on the hill, and the",
        extra: { cachedPrompt: [{ role: "system", content: "Tell the story." }] },
      },
    })
  ).json();
  await request.patch(`/api/chats/${chat.id}/messages/${reply.id}/extra`, {
    data: { generationInfo: { provider: "openai", model: "story-model", finishReason: "stop", ...generationInfo } },
  });
  return chat as { id: string };
}

async function open(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    sidebarOpen: false,
    rightPanelOpen: false,
    reduceAmbientEffects: true,
  });
  await page.addInitScript(
    ({ version, chatId }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { version, chatId },
  );
  await page.goto("/");
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name === "mobile-webkit", "390 is covered by mobile-chromium.");
  mkdirSync(shots, { recursive: true });
});

test("a trimmed reply shows how many older messages were not sent, and Peek leads with the checkup", async ({
  page,
  request,
}, info) => {
  const chat = await seedChat(request, "Checkup trimmed", "roleplay", {
    maxContext: 8192,
    contextFit: fit({ trimmed: true, droppedHistory: 42, tokensBefore: 9100, tokensAfter: 6900 }),
  });
  try {
    await open(page, chat.id);
    const line = page.locator("[data-reply-checkup]");
    await expect(line).toContainText("42 older messages not sent");
    await line.getByRole("button", { name: "Check", exact: true }).click();
    // F11: slice 62d's v5 panel shows the finding as a title + why row, not the Peek's full sentence.
    await expect(line).toContainText("42 older messages not sent");
    await expect(line).toContainText("Needed 9,100 tokens, budget 7,000");
    await page.screenshot({ path: `${shots}${info.project.name}-trimmed.png` });

    await line.getByRole("button", { name: "Peek at the prompt" }).click();
    const header = page.locator("[data-peek-checkup]");
    await expect(header).toContainText("Reply checkup");
    await expect(header).toContainText("42 older messages were not sent.");
    await page.waitForTimeout(400); // the modal fades in; the screenshot is proof for a reviewer
    await page.screenshot({ path: `${shots}${info.project.name}-trimmed-peek.png` });
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

test("a cut-off reply says so, links to Max output tokens, and the omnibar Fix row opens the checkup", async ({
  page,
  request,
}, info) => {
  const chat = await seedChat(request, "Checkup cut off", "conversation", {
    finishReason: "length",
    maxTokens: 512,
    contextFit: fit({ replyBudgetFrom: 512, replyBudgetTo: 512 }),
  });
  try {
    await open(page, chat.id);
    const line = page.locator("[data-reply-checkup]");
    await expect(line).toContainText("Cut off");

    if (info.project.name.includes("desktop")) {
      // Door 2: the omnibar Fix row replaces "Preview next prompt" and opens the same checkup.
      await page
        .locator("main")
        .first()
        .click({ position: { x: 5, y: 5 } });
      await page.keyboard.press("Control+k");
      const omnibar = page.locator('[data-component="GlobalOmnibar"]');
      const fixRow = omnibar.locator(`[data-result-id="chat-tool:reply-checkup:${chat.id}"]`);
      await expect(fixRow).toContainText("Fix: Check the last reply");
      await expect(fixRow).toContainText("Cut off");
      await expect(omnibar.getByText("Preview next prompt")).toHaveCount(0);
      await page.screenshot({ path: `${shots}${info.project.name}-cut-off-fix-row.png` });
      await fixRow.getByRole("button").first().click();
      await expect(omnibar).toBeHidden();
    } else {
      await line.getByRole("button", { name: "Check", exact: true }).click();
    }
    // F11: slice 62d's v5 panel shows the finding as a title + why row, not the Peek's full sentence.
    await expect(line).toContainText("Cut off at 512 tokens");
    await expect(line).toContainText("Stopped mid-sentence");
    await page.screenshot({ path: `${shots}${info.project.name}-cut-off.png` });

    await line.getByRole("button", { name: "Max output tokens" }).click();
    await expect(page.locator('[data-chat-settings-section="advanced-parameters"]')).toBeVisible();
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
