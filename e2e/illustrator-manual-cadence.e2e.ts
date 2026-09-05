import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Illustrator manual-only interval saves and survives reopening and chat setup", async ({
  page,
  request,
}, testInfo) => {
  const reset = await request.put("/api/app-settings/ui", { data: { value: "" } });
  expect(reset.ok()).toBeTruthy();
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    if (!localStorage.getItem("marinara-engine-ui")) {
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            chatHelpSeenModes: ["roleplay"],
          },
          version: 65,
        }),
      );
    }
  }, version);
  await page.route("**/api/capability-packages/agents", (route) =>
    route.fulfill({
      json: [
        {
          id: "illustrator",
          name: "Illustrator",
          description: "Manual-only cadence regression fixture.",
          author: "Pasta Devs",
          phase: "post_processing",
          execution: "host",
          enabledByDefault: false,
          category: "misc",
          modeAllowlist: ["roleplay"],
          runInterval: 5,
          defaultPromptTemplate: "Return an image prompt.",
        },
      ],
    }),
  );

  const agentResponse = await request.post("/api/agents", {
    data: {
      type: "illustrator",
      name: "Illustrator",
      description: "Manual-only cadence regression fixture.",
      phase: "post_processing",
      connectionId: null,
      promptTemplate: "Return an image prompt.",
      settings: { runInterval: 5 },
    },
  });
  expect(agentResponse.ok()).toBeTruthy();
  const agent = (await agentResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Illustrator manual-only cadence",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const readSettings = async () => {
    const response = await request.get(`/api/agents/${agent.id}`);
    const row = (await response.json()) as { settings: string | Record<string, unknown> };
    return typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings;
  };
  const openEditor = async () => {
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openAgentDetail("illustrator");
    });
    await expect(page.locator(".mari-editor-shell")).toBeVisible();
  };

  try {
    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");
    await openEditor();
    const interval = page.locator('.mari-editor-shell input[type="number"][placeholder="5"][max="100"]');
    await expect(interval).toHaveValue("5");
    await expect(interval).toHaveAttribute("min", "0");
    await interval.fill("0");
    await expect(interval).toHaveValue("0");
    await expect(page.getByText(/^Set to 0 for manual-only generation/)).toBeVisible();
    await testInfo.attach("illustrator-manual-only-setup", { body: await page.screenshot(), contentType: "image/png" });
    await page.locator(".mari-editor-header .mari-editor-action--primary").click();
    await expect.poll(async () => (await readSettings()).runInterval).toBe(0);
    await page.reload();
    await openEditor();
    await expect(interval).toHaveValue("0");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAgentDetail();
    });

    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "More options", exact: true }).click();
    }
    await page.getByRole("button", { name: "Chat Settings", exact: true }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    const agents = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
    if ((await agents.getAttribute("aria-expanded")) !== "true") await agents.click();
    const enable = drawer.getByRole("checkbox", { name: /^Enable Agents/ });
    if (!(await enable.isChecked())) await enable.check();
    await drawer.getByRole("button", { name: /Misc Agents/ }).click();
    await drawer.getByRole("button").filter({ hasText: "Illustrator" }).last().click();
    const add = page.getByRole("dialog", { name: "Add Illustrator" });
    await expect(add).toBeVisible();
    const addInterval = add.locator('input[type="number"][max="100"]');
    await expect(addInterval).toHaveValue("0");
    await expect(addInterval).toHaveAttribute("min", "0");
    await addInterval.fill("1");
    await addInterval.fill("0");
    await expect(addInterval).toHaveValue("0");
    await testInfo.attach("illustrator-manual-only-chat-add", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(add).toBeHidden();
    await expect.poll(async () => (await readSettings()).runInterval).toBe(0);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/agents/${agent.id}`);
  }
});
