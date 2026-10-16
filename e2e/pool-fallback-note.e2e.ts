// #7697: an older reply the fallback wrote still names the connection that failed, by tap, on phones
// too, in roleplay and conversation, with the model name and token usage settings off. Facts are
// seeded, no model runs.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const note = "Pool A (pool-model) failed (key rejected); answered with Backup (backup-model).";

async function addMessage(request: APIRequestContext, chatId: string, role: string, content: string) {
  const response = await request.post(`/api/chats/${chatId}/messages`, { data: { role, content } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { id: string };
}

for (const mode of ["conversation", "roleplay"] as const) {
  test(`an older ${mode} reply the fallback wrote names the failed pick by tap`, async ({ page, request }) => {
    const chat = (await (
      await request.post("/api/chats", { data: { name: `Pool fallback ${mode}`, mode, characterIds: [] } })
    ).json()) as { id: string };
    try {
      await addMessage(request, chat.id, "user", "Tell me about the harbor.");
      const fallbackReply = await addMessage(request, chat.id, "assistant", "The harbor was quiet at dawn.");
      await request.patch(`/api/chats/${chat.id}/messages/${fallbackReply.id}/extra`, {
        data: {
          generationInfo: {
            provider: "custom",
            model: "backup-model",
            fallback: {
              category: "main",
              connectionId: "backup",
              connectionName: "Backup",
              model: "backup-model",
              failed: {
                connectionId: "pool-a",
                connectionName: "Pool A",
                model: "pool-model",
                reason: "auth",
                status: 401,
              },
            },
          },
        },
      });
      await addMessage(request, chat.id, "user", "And the lighthouse?");
      // The newest reply came from the pool's pick, so the fallback reply is no longer the last one.
      await addMessage(request, chat.id, "assistant", "The lighthouse kept its lamp lit all night.");

      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        sidebarOpen: false,
        rightPanelOpen: false,
        reduceAmbientEffects: true,
        showModelName: false,
        showTokenUsage: false,
      });
      await page.addInitScript(
        ({ version, chatId }) => {
          localStorage.setItem("marinara:whats-new:seen-version", version);
          localStorage.setItem("marinara-active-chat-id", chatId);
        },
        { version, chatId: chat.id },
      );
      await page.goto("/");
      await expect(page.getByText("The lighthouse kept its lamp lit all night.")).toBeVisible();

      const marker = page.getByRole("button", { name: note });
      await expect(marker).toHaveCount(1);
      await expect(marker).toContainText("Fallback");
      await marker.click();
      await expect(page.getByText(note, { exact: true })).toBeVisible();
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}
