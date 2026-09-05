import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const mode of ["conversation", "roleplay"] as const) {
  test(`${mode} reasoning history limit and prefill placeholder persist`, async ({ page, request }, testInfo) => {
    const connectionResponse = await request.post("/api/connections", {
      data: {
        name: "Reasoning history fixture",
        provider: "custom",
        model: "local-fixture",
        baseUrl: "http://127.0.0.1:9/v1",
        apiKey: "",
      },
    });
    expect(connectionResponse.ok()).toBeTruthy();
    const connection = await connectionResponse.json();
    const created = await request.post("/api/chats", {
      data: { name: "Reasoning history settings", mode, characterIds: [], connectionId: connection.id },
    });
    expect(created.ok()).toBeTruthy();
    const chat = await created.json();
    try {
      await request.patch(`/api/chats/${chat.id}/metadata`, { data: { conversationSetupComplete: true } });
      for (const content of ["first", "second", "third"]) {
        expect(
          (
            await request.post(`/api/chats/${chat.id}/messages`, {
              data: { role: "user", content: `Question ${content}` },
            })
          ).ok(),
        ).toBeTruthy();
        expect(
          (
            await request.post(`/api/chats/${chat.id}/messages`, {
              data: { role: "assistant", content: `Answer ${content}`, extra: { thinking: `Reasoning ${content}` } },
            })
          ).ok(),
        ).toBeTruthy();
      }
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.addInitScript(
        ({ chatId, appVersion }) => {
          localStorage.setItem("marinara-active-chat-id", chatId);
          localStorage.setItem("marinara:whats-new:seen-version", appVersion);
          localStorage.setItem(
            "marinara-engine-ui",
            JSON.stringify({
              state: {
                hasCompletedOnboarding: true,
                rightPanelOpen: false,
                sidebarOpen: false,
                chatHelpSeenModes: ["conversation", "roleplay", "game"],
              },
              version: 65,
            }),
          );
        },
        { chatId: chat.id, appVersion: version },
      );
      const openSettings = async () => {
        if (testInfo.project.name.includes("mobile"))
          await page.getByRole("button", { name: "More options", exact: true }).click();
        await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
        await page
          .locator('.mari-chat-settings-drawer [data-chat-settings-section="advanced-parameters"]')
          .getByText("Advanced Parameters", { exact: true })
          .click();
      };
      const section = page.locator('[data-chat-settings-section="advanced-parameters"]');
      const exclusion = section.getByRole("checkbox", { name: "Exclude Past Reasoning" });
      const limit = section.getByRole("textbox", { name: "Past reasoning blocks", exact: true });
      const prefill = section.getByPlaceholder("Understood. I will now proceed with the output.", { exact: true });
      const readMeta = async () => {
        const saved = await (await request.get(`/api/chats/${chat.id}`)).json();
        return typeof saved.metadata === "string" ? JSON.parse(saved.metadata) : saved.metadata;
      };
      const previewReasoning = async () => {
        const response = await request.post("/api/generate/dryRun", { data: { chatId: chat.id, returnPrompt: true } });
        expect(response.ok()).toBeTruthy();
        const result = await response.json();
        return result.prompt.messages.flatMap((message: { providerMetadata?: { reasoning_content?: string } }) =>
          message.providerMetadata?.reasoning_content ? [message.providerMetadata.reasoning_content] : [],
        );
      };
      await page.goto("/");
      await openSettings();
      await expect(prefill).toHaveValue("");
      await expect(exclusion).toBeChecked();
      await expect(limit).toHaveCount(0);
      expect(await previewReasoning()).toEqual([]);
      await exclusion.uncheck();
      await expect.poll(async () => (await readMeta()).excludePastReasoning).toBe(false);
      await expect(limit).toHaveValue("1");
      expect(await previewReasoning()).toEqual(["Reasoning third"]);
      for (const count of [2, 0]) {
        await limit.fill(String(count));
        await limit.blur();
        await expect.poll(async () => (await readMeta()).pastReasoningLimit).toBe(count);
        expect(await previewReasoning()).toEqual(
          count === 2
            ? ["Reasoning second", "Reasoning third"]
            : ["Reasoning first", "Reasoning second", "Reasoning third"],
        );
      }
      await page.reload();
      await openSettings();
      await expect(limit).toHaveValue("0");
      await expect(exclusion).not.toBeChecked();
      await prefill.fill("My saved prefill.");
      await prefill.blur();
      await expect
        .poll(async () => (await readMeta()).chatParameters?.assistantReasoningPrefill)
        .toBe("My saved prefill.");
      await page.reload();
      await openSettings();
      await expect(prefill).toHaveValue("My saved prefill.");
      await testInfo.attach("reasoning-settings", { body: await section.screenshot(), contentType: "image/png" });
      await exclusion.check();
      await expect.poll(async () => (await readMeta()).excludePastReasoning).toBe(true);
      await expect(limit).toHaveCount(0);
      expect(await previewReasoning()).toEqual([]);
      expect((await readMeta()).pastReasoningLimit, "hiding the field must retain its saved choice").toBe(0);
    } finally {
      await request.delete(`/api/chats/${chat.id}`);
      await request.delete(`/api/connections/${connection.id}`);
    }
  });
}
